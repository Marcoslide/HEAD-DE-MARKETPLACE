/* =============================================================
   PRODUCTION FOUNDATION (10.D) · jobs, worker, import persistente,
   health e backup/restore.
   Fila DURÁVEL no banco (sobrevive restart de API e worker; Redis
   entra como driver alternativo pela mesma interface — documentado).
   Import grande nunca depende de requisição HTTP aberta: upload →
   arquivo → lote → fila → parser → detecção → staging → conciliação
   → revisão → aplicação → auditoria → rollback.
   ============================================================= */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { uid, sha256 } = require('./core.js');
const { parseCsv, parseXlsx } = require('./storage.js');
const V8IMP = require('../../../design/prototipo-v8/import-engine.js');

const now = () => new Date().toISOString();
const JOB_STATES = ['QUEUED', 'RUNNING', 'WAITING_REVIEW', 'WAITING_DATA', 'BLOCKED',
  'SUCCEEDED', 'FAILED', 'CANCELLED', 'ROLLED_BACK'];
const JOB_TYPES = ['PARSE_IMPORT_FILE', 'DETECT_IMPORT_PROFILE', 'MAP_IMPORT_COLUMNS', 'VALIDATE_IMPORT_BATCH',
  'RECONCILE_IMPORT_BATCH', 'APPLY_IMPORT_BATCH', 'ROLLBACK_IMPORT_BATCH', 'GENERATE_IMPORT_REPORT',
  'SEND_NOTIFICATION', 'GENERATE_MASTER_LISTING_SUGGESTION', 'RECALCULATE_METRICS', 'REBUILD_SEARCH_INDEX'];

/* ---------------- fila durável ---------------- */
function createQueue(db, audit) {
  return {
    JOB_STATES, JOB_TYPES,
    enqueue({ type, payload, escopo, createdBy, idemKey, maxAttempts }) {
      if (!JOB_TYPES.includes(type)) throw new Error('tipo de job desconhecido: ' + type);
      escopo = escopo || {};
      const id = uid('job');
      try {
        db.prepare(`INSERT INTO jobs(id,type,status,payload,group_id,company_id,store_id,account_id,
          created_by,max_attempts,idem_key,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id, type, 'QUEUED', JSON.stringify(payload || {}), escopo.groupId || null, escopo.companyId || null,
            escopo.storeId || null, escopo.accountId || null, createdBy || null, maxAttempts || 3,
            idemKey || null, now());
      } catch (e) {
        if (/idem_key/i.test(e.message) && /UNIQUE|duplicate/i.test(e.message)) { /* idempotente: job igual já existe */
          return db.prepare('SELECT id FROM jobs WHERE idem_key = ?').get(idemKey).id;
        }
        throw e;
      }
      db.prepare('INSERT INTO job_events(job_id, evento, em) VALUES(?,?,?)').run(id, 'QUEUED', now());
      return id;
    },
    claim(workerId) { /* ATÔMICO entre N workers: só um vence o UPDATE condicional */
      const stale = new Date(Date.now() - 120000).toISOString();
      for (let tent = 0; tent < 3; tent++) {
        const j = db.prepare(`SELECT id FROM jobs WHERE (status = 'QUEUED' AND (next_retry_at IS NULL OR next_retry_at <= ?))
          OR (status = 'RUNNING' AND (heartbeat_at IS NULL OR heartbeat_at < ?)) ORDER BY criado_em LIMIT 1`).get(now(), stale);
        if (!j) return null;
        const won = db.prepare(`UPDATE jobs SET status='RUNNING', attempt = attempt + 1,
          started_at = COALESCE(started_at, ?), heartbeat_at = ?, lock_owner = ?, lock_expires_at = ?
          WHERE id = ? AND (status = 'QUEUED' OR (status = 'RUNNING' AND (heartbeat_at IS NULL OR heartbeat_at < ?)))`)
          .run(now(), now(), workerId || 'worker', new Date(Date.now() + 120000).toISOString(), j.id, stale).changes;
        if (won === 1) return db.prepare('SELECT * FROM jobs WHERE id = ?').get(j.id);
        /* outro worker venceu — tenta o próximo */
      }
      return null;
    },
    finish(id, status, extra) {
      extra = extra || {};
      db.prepare(`UPDATE jobs SET status = ?, finished_at = ?, error_code = ?, error_message = ?,
        result_summary = ? WHERE id = ?`).run(status, now(), extra.errorCode || null,
        extra.errorMessage || null, JSON.stringify(extra.result || null), id);
      db.prepare('INSERT INTO job_events(job_id, evento, em) VALUES(?,?,?)').run(id, status, now());
      if (status === 'FAILED') audit.record({ action: 'job_falhou', status: 'error', detalhe: id + ': ' + (extra.errorMessage || '') });
    },
    get: id => db.prepare('SELECT * FROM jobs WHERE id = ?').get(id),
    depth: () => db.prepare("SELECT count(*) c FROM jobs WHERE status IN ('QUEUED','RUNNING')").get().c,
  };
}

/* ---------------- import persistente (dedup sobrevive a restart) ---------------- */
function createImportService(db, audit) {
  const perfilDe = det => det.perfil;
  return {
    /* upload já feito → cria lote e enfileira parse */
    createBatch({ fileId, escopo, usuario }) {
      const id = uid('imp');
      db.prepare(`INSERT INTO import_batches(id,file_id,estado,escopo,enviado_por,mapping_version,criado_em)
        VALUES(?,?,?,?,?,?,?)`).run(id, fileId, 'ARQUIVO_ENVIADO', JSON.stringify(escopo), usuario, 'v1', now());
      return id;
    },
    /* PARSE + DETECT + STAGING + RECONCILE — roda no worker */
    stage({ batchId, buffer, filename, periodo }) {
      const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
      const escopo = JSON.parse(batch.escopo);
      const parsed = /\.csv$/i.test(filename) ? parseCsv(buffer.toString('utf8')) : parseXlsx(buffer);
      if (!parsed.headers.length) { const e = new Error('parser não encontrou cabeçalhos'); e.permanent = true; throw e; }
      const file = { nome: filename, periodo: periodo || null, sourceType: 'PLANILHA_SHOPEE',
        abas: [{ nome: 'sheet1', headers: parsed.headers, rows: parsed.rows }] };
      const det = V8IMP.detect(file);
      const fp = V8IMP.fingerprintFile(file);
      const fpKey = ['imp', fp.file_hash, fp.sheet_signature].join('|');
      const dup = db.prepare('SELECT batch_id FROM source_fingerprints WHERE chave = ?').get(fpKey);
      if (dup) { /* mesmo arquivo — bloqueado MESMO após restart, pois vive no banco */
        db.prepare('UPDATE import_batches SET estado = ?, resultado = ? WHERE id = ?')
          .run('BLOQUEADO', JSON.stringify({ motivo: 'ARQUIVO JÁ IMPORTADO no lote ' + dup.batch_id }), batchId);
        audit.record({ ...escopo, action: 'arquivo_duplicado_recusado', status: 'blocked', detalhe: filename });
        return { duplicado: true, batchAnterior: dup.batch_id };
      }
      if (det.perfil === 'UNKNOWN' || ['REFERENCE_ONLY', 'UNSUPPORTED'].includes((V8IMP.PROFILES[det.perfil] || {}).status)) {
        db.prepare('UPDATE import_batches SET estado = ?, perfil = ?, resultado = ? WHERE id = ?')
          .run('AGUARDANDO_MAPEAMENTO', det.perfil, JSON.stringify({ motivo: det.motivo || 'perfil não aplicável' }), batchId);
        return { aplicavel: false, perfil: det.perfil };
      }
      const gran = det.granularidade;
      let jaExistem = 0;
      const insRow = db.prepare('INSERT INTO import_rows(id,batch_id,linha,raw,granularidade,natural_key,fingerprint) VALUES(?,?,?,?,?,?,?)');
      parsed.rows.forEach((r, i) => {
        const base = { marketplace: escopo.marketplace, contaId: escopo.accountId, companyId: escopo.companyId,
          item_id: r['ID do Item'], data: r['Data'], promotion_name: r['Nome da promoção'], voucher_code: r['Código'],
          periodo_ini: (periodo || {}).ini || r['Data'] || null, periodo_fim: (periodo || {}).fim || r['Data'] || null,
          metric_type: det.destino };
        const nk = V8IMP.naturalKey(gran, base);
        if (db.prepare('SELECT 1 FROM metric_snapshots WHERE natural_key = ?').get(nk)) jaExistem++;
        insRow.run(uid('row'), batchId, i + 1, JSON.stringify(r), gran, nk, sha256(nk + '|' + JSON.stringify(r)));
      });
      db.prepare('INSERT INTO source_fingerprints(chave, batch_id, tipo, criado_em) VALUES(?,?,?,?)')
        .run(fpKey, batchId, det.perfil, now());
      db.prepare(`UPDATE import_batches SET estado='AGUARDANDO_REVISÃO', perfil = ?, periodo_ini = ?, periodo_fim = ?,
        resultado = ? WHERE id = ?`).run(perfilDe(det), (periodo || {}).ini || null, (periodo || {}).fim || null,
        JSON.stringify({ registros: parsed.rows.length, jaExistem, granularidade: gran }), batchId);
      audit.record({ ...escopo, action: 'staging_concluido', detalhe: `${batchId}: ${parsed.rows.length} linha(s), ${jaExistem} já existente(s)` });
      return { aplicavel: true, registros: parsed.rows.length, jaExistem, perfil: det.perfil, granularidade: gran };
    },
    /* APPLY — idempotente, nunca soma; grava apply_log p/ rollback.
       Dois usuários não aplicam o mesmo lote: transição de estado é atômica. */
    apply({ batchId, usuario, locks }) {
      const ganhou = db.prepare(`UPDATE import_batches SET estado = 'APLICANDO'
        WHERE id = ? AND estado = 'AGUARDANDO_REVISÃO'`).run(batchId).changes;
      if (ganhou !== 1) {
        const atual = db.prepare('SELECT estado FROM import_batches WHERE id = ?').get(batchId);
        audit.record({ action: 'IMPORT_LOCK_DENIED', status: 'blocked',
          detalhe: batchId + ' já em ' + (atual ? atual.estado : 'inexistente') + ' — aplicação dupla recusada' });
        const e = new Error('lote não está pronto para aplicar: ' + (atual ? atual.estado : 'inexistente'));
        e.permanent = true; throw e;
      }
      const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId);
      audit.record({ action: 'IMPORT_LOCK_ACQUIRED', detalhe: batchId + ' por ' + (usuario || '?') });
      const escopo = JSON.parse(batch.escopo);
      const rows = db.prepare('SELECT * FROM import_rows WHERE batch_id = ?').all(batchId);
      let criados = 0, atualizados = 0, duplicadosEvitados = 0, ordem = 0;
      const logIns = db.prepare('INSERT INTO apply_log(batch_id,natural_key,valor_anterior,valor_novo,autor,em,ordem) VALUES(?,?,?,?,?,?,?)');
      for (const r of rows) {
        const existing = db.prepare('SELECT * FROM metric_snapshots WHERE natural_key = ?').get(r.natural_key);
        if (existing) {
          if (existing.fingerprint === r.fingerprint) { duplicadosEvitados++; continue; }
          logIns.run(batchId, r.natural_key, existing.raw, r.raw, usuario, now(), ++ordem);
          db.prepare('UPDATE metric_snapshots SET raw = ?, batch_id = ?, fingerprint = ?, atualizado_em = ? WHERE natural_key = ?')
            .run(r.raw, batchId, r.fingerprint, now(), r.natural_key);
          atualizados++; continue;
        }
        logIns.run(batchId, r.natural_key, null, r.raw, usuario, now(), ++ordem);
        db.prepare(`INSERT INTO metric_snapshots(natural_key, entidade, granularidade, explicativa, raw, batch_id,
          fingerprint, escopo, origem, atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?)`)
          .run(r.natural_key, 'metric_snapshot', r.granularidade,
            ['CHANNEL_ATTRIBUTION', 'PROMOTION_METRIC', 'FINANCIAL_SUMMARY'].includes(r.granularidade) ? 1 : 0,
            r.raw, batchId, r.fingerprint, batch.escopo, 'DADO IMPORTADO VIA PLANILHA', now());
        criados++;
      }
      const resultado = { criados, atualizados, duplicadosEvitados };
      db.prepare('UPDATE import_batches SET estado = ?, resultado = ? WHERE id = ?')
        .run('APLICADO', JSON.stringify(resultado), batchId);
      audit.record({ ...escopo, userId: usuario, action: 'lote_aplicado', detalhe: `${batchId}: ${JSON.stringify(resultado)}` });
      return resultado;
    },
    /* ANÚNCIO MASTER — nunca dois masters ativos para o mesmo produto/variação.
       Atômico: o UNIQUE de master_links decide quem vence; troca é explícita. */
    approveMaster({ produtoKey, itemId, usuario, force }) {
      if (db.prepare('SELECT 1 FROM import_rows WHERE natural_key LIKE ? AND vinculo LIKE ?').get('%' + produtoKey + '%', '%CONFLITO%'))
        { audit.record({ action: 'MASTER_LINK_LOCKED', status: 'blocked', detalhe: produtoKey + ': conflito de SKU aberto' });
          return { blocked: true, reason: 'conflito de SKU aberto — master bloqueado' }; }
      try {
        db.prepare('INSERT INTO master_links(produto_key, item_id, estado, aprovado_por, em) VALUES(?,?,?,?,?)')
          .run(produtoKey, itemId, 'MASTER CONFIRMADO MANUALMENTE', usuario || null, now());
        audit.record({ action: 'MASTER_LINK_UPDATED', detalhe: produtoKey + ' → ' + itemId + ' (novo)' });
        return { ok: true, itemId };
      } catch (e) {
        const atual = db.prepare('SELECT * FROM master_links WHERE produto_key = ?').get(produtoKey);
        if (!force) {
          audit.record({ action: 'MASTER_LINK_LOCKED', status: 'blocked',
            detalhe: produtoKey + ' já tem master ' + atual.item_id + ' — segunda aprovação recusada' });
          return { blocked: true, reason: 'já existe UM master ativo (' + atual.item_id + ') — troque explicitamente com force', atual: atual.item_id };
        }
        db.prepare('UPDATE master_links SET item_id = ?, aprovado_por = ?, em = ? WHERE produto_key = ?')
          .run(itemId, usuario || null, now(), produtoKey);
        audit.record({ action: 'MASTER_LINK_UPDATED', detalhe: produtoKey + ' → ' + itemId + ' (troca explícita)' });
        return { ok: true, itemId, trocado: true };
      }
    },

    /* ROLLBACK persistente — preserva atualização posterior */
    rollback({ batchId, usuario }) {
      const logs = db.prepare('SELECT * FROM apply_log WHERE batch_id = ? ORDER BY ordem DESC').all(batchId);
      if (!logs.length) throw new Error('lote sem aplicação registrada');
      let removidos = 0, restaurados = 0, preservados = 0;
      for (const l of logs) {
        const snap = db.prepare('SELECT * FROM metric_snapshots WHERE natural_key = ?').get(l.natural_key);
        if (!snap) continue;
        if (snap.batch_id !== batchId) {
          preservados++;
          audit.record({ action: 'ROLLBACK_BLOCKED_BY_NEWER_VERSION',
            detalhe: l.natural_key + ' preservado: atualizado pelo lote ' + snap.batch_id });
          continue; /* lote posterior mexeu — intocável */
        }
        if (l.valor_anterior === null) {
          db.prepare('DELETE FROM metric_snapshots WHERE natural_key = ?').run(l.natural_key);
          removidos++;
        } else {
          const anterior = db.prepare(`SELECT batch_id FROM apply_log WHERE natural_key = ? AND ordem < ? AND batch_id != ?
            ORDER BY ordem DESC LIMIT 1`).get(l.natural_key, l.ordem, batchId);
          db.prepare('UPDATE metric_snapshots SET raw = ?, batch_id = ?, atualizado_em = ? WHERE natural_key = ?')
            .run(l.valor_anterior, anterior ? anterior.batch_id : 'anterior', now(), l.natural_key);
          restaurados++;
        }
      }
      db.prepare('UPDATE import_batches SET estado = ? WHERE id = ?').run('REVERTIDO', batchId);
      audit.record({ userId: usuario, action: 'lote_revertido',
        detalhe: `${batchId}: ${removidos} removido(s), ${restaurados} restaurado(s), ${preservados} preservado(s)` });
      return { removidos, restaurados, preservados };
    },
  };
}

/* ---------------- worker (processa a fila durável) ---------------- */
function createWorker(db, queue, imports, storage, logger) {
  const handlers = {
    PARSE_IMPORT_FILE(payload) {
      const { buffer, meta } = storage.read(payload.fileId);
      return imports.stage({ batchId: payload.batchId, buffer, filename: meta.original_filename, periodo: payload.periodo });
    },
    APPLY_IMPORT_BATCH(payload) { return imports.apply(payload); },
    ROLLBACK_IMPORT_BATCH(payload) { return imports.rollback(payload); },
    SEND_NOTIFICATION(payload) {
      db.prepare('INSERT INTO notifications(id,user_id,escopo,nivel,texto,em) VALUES(?,?,?,?,?,?)')
        .run(uid('ntf'), payload.userId || null, JSON.stringify(payload.escopo || {}), payload.nivel || 'info', payload.texto, now());
      return { enviado: true };
    },
    RECALCULATE_METRICS() { return { ok: true }; },
    GENERATE_IMPORT_REPORT(payload) {
      const b = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(payload.batchId);
      return { batch: b.id, estado: b.estado, resultado: JSON.parse(b.resultado || 'null') };
    },
  };
  return {
    handlers,
    heartbeat() { db.prepare('INSERT INTO system_state(chave, valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run('worker_heartbeat', now()); },
    tick() { /* processa 1 job; idempotente; retry controlado, sem retry infinito */
      this.heartbeat();
      const job = queue.claim();
      if (!job) return null;
      const t0 = Date.now();
      try {
        const h = handlers[job.type];
        if (!h) throw Object.assign(new Error('sem handler para ' + job.type), { permanent: true });
        const result = h(JSON.parse(job.payload));
        const status = result && result.aplicavel === false ? 'WAITING_REVIEW'
          : result && result.duplicado ? 'BLOCKED' : 'SUCCEEDED';
        queue.finish(job.id, status, { result });
        logger.log({ action: 'job', job_id: job.id, type: job.type, status, duration_ms: Date.now() - t0 });
        return { id: job.id, status, result };
      } catch (e) {
        const esgotado = job.attempt >= job.max_attempts;
        const status = (e.permanent || esgotado) ? 'FAILED' : 'QUEUED'; /* erro permanente não repete */
        if (status === 'QUEUED') db.prepare("UPDATE jobs SET status='QUEUED', heartbeat_at = NULL WHERE id = ?").run(job.id);
        else queue.finish(job.id, 'FAILED', { errorCode: e.code || (e.permanent ? 'PERMANENT' : 'RETRY_EXHAUSTED'), errorMessage: e.message });
        logger.log({ action: 'job', job_id: job.id, type: job.type, status, error_code: e.code || null, duration_ms: Date.now() - t0 });
        return { id: job.id, status, error: e.message };
      }
    },
    drain(max) { const out = []; for (let i = 0; i < (max || 50); i++) { const r = this.tick(); if (!r) break; out.push(r); } return out; },
  };
}

/* ---------------- health checks ---------------- */
function createHealth(db, cfg, queue) {
  const get = k => { const r = db.prepare('SELECT valor FROM system_state WHERE chave = ?').get(k); return r ? r.valor : null; };
  return {
    check() {
      const out = { environment: cfg.env, em: now() };
      try { db.prepare('SELECT 1 as ok').get(); out.database = 'ok'; } catch (e) { out.database = 'FALHA: ' + e.message; }
      try {
        const p = path.join(cfg.storageDir, '.healthcheck');
        fs.writeFileSync(p, now()); fs.readFileSync(p); out.storage = 'ok';
      } catch (e) { out.storage = 'FALHA: ' + e.message; }
      const hb = get('worker_heartbeat');
      out.worker = hb && (Date.now() - new Date(hb).getTime() < 180000) ? 'ok' : (hb ? 'PARADO desde ' + hb : 'nunca rodou');
      out.queue = { profundidade: queue.depth(), status: queue.depth() > 500 ? 'TRAVADA?' : 'ok' };
      out.ultimoBackup = get('last_backup') || 'nenhum';
      const mig = db.prepare('SELECT id, aplicada_em FROM _migrations ORDER BY id DESC LIMIT 1').get();
      out.ultimaMigration = mig ? mig.id + ' em ' + mig.aplicada_em : 'nenhuma';
      out.ultimoDeploy = get('last_deploy') || 'nenhum registrado';
      return out;
    },
  };
}

/* ---------------- backup + restore testável ---------------- */
function createBackup(db, cfg) {
  return {
    create() {
      const id = 'bkp-' + Date.now();
      const dest = path.join(cfg.backupDir, id);
      fs.mkdirSync(dest, { recursive: true });
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      fs.copyFileSync(cfg.dbPath, path.join(dest, 'head.sqlite'));
      const dbHash = sha256(fs.readFileSync(path.join(dest, 'head.sqlite')));
      const manifest = { id, em: now(), dbPath: path.join(dest, 'head.sqlite'), db_sha256: dbHash,
        storageDir: cfg.storageDir, retencao: process.env.HEAD_BACKUP_RETENTION || '30d' };
      fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));
      db.prepare('INSERT INTO backups(id, em, db_sha256, manifest) VALUES(?,?,?,?)')
        .run(id, manifest.em, dbHash, JSON.stringify(manifest));
      db.prepare('INSERT INTO system_state(chave, valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
        .run('last_backup', manifest.em);
      return manifest;
    },
    /* restore SEMPRE para um caminho de teste — nunca sobrescreve produção às cegas */
    restore(backupId, targetPath) {
      const src = path.join(cfg.backupDir, backupId, 'head.sqlite');
      const manifest = JSON.parse(fs.readFileSync(path.join(cfg.backupDir, backupId, 'manifest.json')));
      const buf = fs.readFileSync(src);
      if (sha256(buf) !== manifest.db_sha256) throw new Error('backup corrompido: hash não confere');
      fs.writeFileSync(targetPath, buf);
      const { DatabaseSync } = require('node:sqlite');
      const test = new DatabaseSync(targetPath);
      const users = test.prepare('SELECT count(*) c FROM users').get().c; /* valida restauração */
      test.close();
      db.prepare('UPDATE backups SET validado = 1 WHERE id = ?').run(backupId);
      return { restaurado: targetPath, usuarios: users, validado: true };
    },
  };
}

module.exports = { createQueue, createImportService, createWorker, createHealth, createBackup, JOB_STATES, JOB_TYPES };

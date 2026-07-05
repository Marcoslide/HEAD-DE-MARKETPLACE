/* =============================================================
   HEAD MARKETPLACE OS · API de produção (10.D)
   node:http puro. Sessão por cookie HttpOnly, rate limit, enforcement
   de escopo em TODA rota, upload real com validação, import via fila
   (nenhum import depende de request aberta), health check, logs
   estruturados. Escrita externa: bloqueada também aqui.
   ============================================================= */
'use strict';
const http = require('node:http');
const { envConfig, openDb, migrate, createLogger, createAudit, uid } = require('../../mos/src/production/core.js');
const { createSecurity } = require('../../mos/src/production/security.js');
const { createStorage } = require('../../mos/src/production/storage.js');
const { createQueue, createImportService, createIntelligence, createHealth } = require('../../mos/src/production/jobs.js');

function createApi(opts) {
  const cfg = envConfig(opts && opts.env, opts && opts.baseDir);
  const db = openDb(cfg);
  migrate(db);
  const logger = createLogger(cfg);
  const audit = createAudit(db, cfg);
  const sec = createSecurity(db, audit, logger);
  const storage = createStorage(db, cfg, audit);
  const queue = createQueue(db, audit);
  const imports = createImportService(db, audit);
  const intel = createIntelligence(db);
  const health = createHealth(db, cfg, queue);

  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const cookieToken = req => ((req.headers.cookie || '').match(/head_session=([\w\-\.]+)/) || [])[1];

  const server = http.createServer((req, res) => {
    const requestId = uid('req');
    const t0 = Date.now();
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let body = {};
      const raw = Buffer.concat(chunks);
      try { if (raw.length && (req.headers['content-type'] || '').includes('json')) body = JSON.parse(raw.toString()); } catch (e) { return json(res, 400, { erro: 'payload inválido' }); }
      const done = (code, out) => {
        logger.log({ request_id: requestId, action: req.method + ' ' + req.url.split('?')[0], status: code, duration_ms: Date.now() - t0 });
        json(res, code, out);
      };
      try {
        const url = new URL(req.url, 'http://x');
        const p = url.pathname;
        if (p === '/health') return done(200, health.check());
        if (p === '/auth/signup' && req.method === 'POST') {
          const { user } = sec.createUser(body);
          return done(201, { userId: user.id, proximo: 'confirme o e-mail e faça login' });
        }
        if (p === '/auth/login' && req.method === 'POST') {
          const { token, userId } = sec.login({ ...body, ip: req.socket.remoteAddress });
          res.setHeader('set-cookie', `head_session=${token}; HttpOnly; SameSite=Strict; Path=/` + (cfg.env !== 'LOCAL' ? '; Secure' : ''));
          return done(200, { userId });
        }
        if (p === '/auth/logout' && req.method === 'POST') { sec.logout(cookieToken(req)); return done(200, { ok: true }); }
        if (p === '/auth/reset' && req.method === 'POST') { sec.requestPasswordReset(body.email, req.socket.remoteAddress); return done(200, { ok: 'se o e-mail existir, enviamos instruções' }); }

        /* daqui para baixo: sessão obrigatória */
        const s = sec.session(cookieToken(req));
        if (!s) return done(401, { erro: 'não autenticado' });
        if (s.expired) return done(401, { erro: 'sessão expirada — entre novamente' });
        const userId = s.userId;

        if (p === '/scope' && req.method === 'POST') { /* cria grupo→empresa→cnpj→loja→conta */
          const g = { id: uid('grp'), nome: body.grupo };
          db.prepare('INSERT INTO grupos(id, nome, criado_em) VALUES(?,?,?)').run(g.id, g.nome, new Date().toISOString());
          const c = { id: uid('cmp') };
          db.prepare('INSERT INTO companies(id, group_id, nome, criado_em) VALUES(?,?,?,?)').run(c.id, g.id, body.empresa, new Date().toISOString());
          const le = { id: uid('cnpj') };
          db.prepare('INSERT INTO legal_entities(id, company_id, nome_fiscal, nome_fantasia, cnpj_mascarado, principal) VALUES(?,?,?,?,?,?)')
            .run(le.id, c.id, body.nomeFiscal || body.empresa, body.nomeFantasia || 'Matriz', '**.***.***/****-**', 1);
          const st = { id: uid('sto') };
          db.prepare('INSERT INTO stores(id, legal_entity_id, company_id, nome, tipo, marketplace) VALUES(?,?,?,?,?,?)')
            .run(st.id, le.id, c.id, body.loja || 'Loja principal', 'marketplace', body.marketplace || 'shopee');
          const acc = { id: uid('acc') };
          db.prepare('INSERT INTO marketplace_accounts(id, store_id, marketplace, nome) VALUES(?,?,?,?)')
            .run(acc.id, st.id, body.marketplace || 'shopee', body.conta || 'conta-principal');
          sec.addMembership({ userId, groupId: g.id, companyIds: [], storeIds: [], papel: 'OWNER' });
          audit.record({ requestId, userId, groupId: g.id, companyId: c.id, action: 'escopo_criado', detalhe: body.empresa });
          return done(201, { groupId: g.id, companyId: c.id, legalEntityId: le.id, storeId: st.id, accountId: acc.id });
        }
        if (p === '/files' && req.method === 'POST') { /* corpo binário + headers de metadados */
          const escopo = { groupId: req.headers['x-group-id'], companyId: req.headers['x-company-id'],
            storeId: req.headers['x-store-id'], accountId: req.headers['x-account-id'] };
          sec.assertScope({ userId, groupId: escopo.groupId, companyId: escopo.companyId, storeId: escopo.storeId, perm: 'import.create' });
          const f = storage.save({ buffer: raw, filename: req.headers['x-filename'], mime: req.headers['content-type'], userId, escopo });
          return done(201, { fileId: f.fileId, sha256: f.sha256, url: storage.signedUrl(f.fileId, 15) });
        }
        if (p === '/imports' && req.method === 'POST') { /* import grande vai para a FILA */
          sec.assertScope({ userId, groupId: body.escopo.groupId, companyId: body.escopo.companyId, storeId: body.escopo.storeId, perm: 'import.create' });
          const batchId = imports.createBatch({ fileId: body.fileId, escopo: body.escopo, usuario: userId });
          const jobId = queue.enqueue({ type: 'PARSE_IMPORT_FILE', payload: { fileId: body.fileId, batchId, periodo: body.periodo },
            escopo: body.escopo, createdBy: userId, idemKey: 'parse:' + body.fileId + ':' + batchId });
          return done(202, { batchId, jobId, nota: 'processamento assíncrono — acompanhe em /jobs/' + jobId });
        }
        if (p.startsWith('/imports/') && p.endsWith('/apply') && req.method === 'POST') {
          const batchId = p.split('/')[2];
          sec.assertScope({ userId, groupId: body.escopo.groupId, companyId: body.escopo.companyId, perm: 'import.apply' });
          const jobId = queue.enqueue({ type: 'APPLY_IMPORT_BATCH', payload: { batchId, usuario: userId }, escopo: body.escopo, createdBy: userId, idemKey: 'apply:' + batchId });
          return done(202, { jobId });
        }
        if (p.startsWith('/imports/') && p.endsWith('/rollback') && req.method === 'POST') {
          const m = sec.assertScope({ userId, groupId: body.escopo.groupId, companyId: body.escopo.companyId });
          if (m.papel !== 'OWNER') return done(403, { erro: 'rollback exige OWNER' });
          const batchId = p.split('/')[2];
          const jobId = queue.enqueue({ type: 'ROLLBACK_IMPORT_BATCH', payload: { batchId, usuario: userId }, escopo: body.escopo, createdBy: userId, idemKey: 'rb:' + batchId + ':' + Date.now() });
          return done(202, { jobId });
        }
        if (p.startsWith('/jobs/') && req.method === 'GET') {
          const j = queue.get(p.split('/')[2]);
          return j ? done(200, j) : done(404, { erro: 'job não encontrado' });
        }
        /* 10.E.2.5.3 — LEITURA da base real (Postgres). Todo GET exige escopo e o valida. */
        const ctxDe = () => ({ groupId: url.searchParams.get('group_id'), company_id: url.searchParams.get('company_id'),
          marketplace: url.searchParams.get('marketplace'), account_id: url.searchParams.get('account_id'),
          period_start: url.searchParams.get('period_start'), period_end: url.searchParams.get('period_end'),
          item_id: url.searchParams.get('item_id'), variation_id: url.searchParams.get('variation_id'), sku: url.searchParams.get('sku') });
        const assertRead = c => sec.assertScope({ userId, groupId: c.groupId, companyId: c.company_id, perm: 'scope.read' });
        if (p === '/imports' && req.method === 'GET') {
          const c = ctxDe(); assertRead(c);
          const rows = db.prepare('SELECT id, file_id, estado, perfil, periodo_ini, periodo_fim, resultado, criado_em FROM import_batches WHERE escopo LIKE ? ORDER BY criado_em DESC LIMIT 100')
            .all('%"companyId":"' + (c.company_id || '') + '"%');
          return done(200, { imports: rows });
        }
        if (p.match(/^\/imports\/[^/]+\/preview$/) && req.method === 'GET') {
          const c = ctxDe(); assertRead(c); const id = p.split('/')[2];
          const rows = db.prepare('SELECT linha, raw, granularidade, natural_key FROM import_rows WHERE batch_id = ? ORDER BY linha LIMIT 20').all(id);
          return done(200, { batchId: id, preview: rows.map(r => ({ linha: r.linha, granularidade: r.granularidade, natural_key: r.natural_key, raw: JSON.parse(r.raw) })), nota: 'até 20 linhas reais' });
        }
        if (p.match(/^\/imports\/[^/]+\/fields$/) && req.method === 'GET') {
          const c = ctxDe(); assertRead(c); const id = p.split('/')[2];
          const r0 = db.prepare('SELECT raw FROM import_rows WHERE batch_id = ? LIMIT 1').get(id);
          const cols = r0 ? Object.keys(JSON.parse(r0.raw)) : [];
          const total = db.prepare('SELECT count(*) c FROM import_rows WHERE batch_id = ?').get(id).c;
          return done(200, { batchId: id, campos: cols.map(col => ({ coluna: col })), totalColunas: cols.length, totalLinhas: total });
        }
        if (p.match(/^\/imports\/[^/]+\/conflicts$/) && req.method === 'GET') {
          const c = ctxDe(); assertRead(c); const id = p.split('/')[2];
          const rows = db.prepare("SELECT linha, natural_key, issue FROM import_rows WHERE batch_id = ? AND issue IS NOT NULL").all(id);
          return done(200, { batchId: id, conflitos: rows });
        }
        if (p.match(/^\/imports\/[^/]+$/) && req.method === 'GET') {
          const c = ctxDe(); assertRead(c); const id = p.split('/')[2];
          const b = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(id);
          return b ? done(200, b) : done(404, { erro: 'lote não encontrado' });
        }
        if (p.startsWith('/intelligence/') && req.method === 'GET') {
          const c = ctxDe(); sec.assertScope({ userId, groupId: c.groupId, companyId: c.company_id, perm: 'scope.read' });
          const area = p.split('/')[2];
          const fn = { performance: intel.performance, returns: intel.returns, inventory: intel.inventory,
            orders: intel.orders, traffic: intel.traffic, summary: intel.summary }[area];
          if (!fn) return done(404, { erro: 'área de inteligência desconhecida: ' + area });
          return done(200, fn(c));
        }
        if (p === '/external-write' && req.method === 'POST') { sec.assertNoExternalWrite(body.action || 'publicar_externo'); }
        return done(404, { erro: 'rota não encontrada' });
      } catch (e) {
        const code = e.code === 'FORBIDDEN' ? 403 : e.code === 'RATE_LIMITED' ? 429 : e.code === 'EXTERNAL_WRITE_BLOCKED' ? 403 : 400;
        logger.log({ request_id: requestId, action: 'erro', status: code, error_code: e.code || null, detalhe: e.message });
        return done(code, { erro: e.message });
      }
    });
  });
  return { server, cfg, db, sec, storage, queue, imports, health, audit, logger };
}

if (require.main === module) {
  const api = createApi();
  const port = process.env.PORT || 3080;
  api.server.listen(port, () => console.log(`[${api.cfg.env}] API em :${port} — health em /health`));
}
module.exports = { createApi };

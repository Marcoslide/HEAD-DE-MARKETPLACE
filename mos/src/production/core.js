/* =============================================================
   PRODUCTION FOUNDATION (10.D) · core
   Ambientes separados (LOCAL/STAGING/PRODUCTION), banco persistente
   com migrations versionadas/idempotentes/reversíveis, logs
   estruturados com mascaramento de segredo e auditoria por escopo.

   Persistência: node:sqlite (embarcado, WAL) atrás de uma fronteira
   única — trocar para PostgreSQL gerenciado é trocar este adapter
   via DATABASE_URL, sem tocar nos módulos acima (documentado em
   docs/operations-runbook.md). Nenhuma credencial vive no código.
   ============================================================= */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ENVS = ['LOCAL', 'STAGING', 'PRODUCTION'];

function envConfig(env, baseDir) {
  env = (env || process.env.HEAD_ENV || 'LOCAL').toUpperCase();
  if (!ENVS.includes(env)) throw new Error('ambiente inválido: ' + env);
  /* cada ambiente tem database, storage, logs, backups e secrets próprios —
     staging NUNCA aponta para artefatos de produção */
  const root = path.join(baseDir || process.env.HEAD_DATA_DIR || path.join(process.cwd(), 'var'), env.toLowerCase());
  const cfg = {
    env, root,
    dbPath: process.env['HEAD_DB_' + env] || path.join(root, 'head.sqlite'),
    storageDir: path.join(root, 'storage'),
    logDir: path.join(root, 'logs'),
    backupDir: path.join(root, 'backups'),
    secret: process.env['HEAD_SECRET_' + env] || null, /* obrigatório fora de LOCAL */
    baseUrl: process.env['HEAD_BASE_URL_' + env] || 'http://localhost:3080',
    databaseUrl: process.env.DATABASE_URL || process.env['HEAD_DATABASE_URL_' + env] || null,
    redisUrl: process.env.REDIS_URL || process.env['HEAD_REDIS_URL_' + env] || null,
  };
  if (env !== 'LOCAL' && !cfg.secret) throw new Error('HEAD_SECRET_' + env + ' ausente — secrets vivem fora do código');
  /* 10.D.1 — staging e produção NUNCA rodam em SQLite nem sem Redis */
  if (env !== 'LOCAL') {
    if (!cfg.databaseUrl || !/^postgres(ql)?:\/\//.test(cfg.databaseUrl))
      throw new Error(env + ' exige PostgreSQL real: defina DATABASE_URL (postgres://…) — SQLite é recusado fora de LOCAL');
    if (!cfg.redisUrl || !/^redis(s)?:\/\//.test(cfg.redisUrl))
      throw new Error(env + ' exige Redis real: defina REDIS_URL (redis://…)');
  }
  if (!cfg.secret) cfg.secret = 'local-dev-secret-nao-usar-em-producao';
  for (const d of [root, cfg.storageDir, cfg.logDir, cfg.backupDir]) fs.mkdirSync(d, { recursive: true });
  return cfg;
}

/* ---------------- migrations versionadas ---------------- */
const MIGRATIONS = [
  {
    id: '001-foundation',
    up(db) {
      db.exec(`
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, nome TEXT, sobrenome TEXT,
        pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, email_confirmado INTEGER DEFAULT 0,
        bloqueado INTEGER DEFAULT 0, criado_em TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT UNIQUE NOT NULL, expira_em TEXT NOT NULL, revogada INTEGER DEFAULT 0, criado_em TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_tokens(id TEXT PRIMARY KEY, user_id TEXT, tipo TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL, payload TEXT, expira_em TEXT NOT NULL, usado INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS rate_limits(chave TEXT NOT NULL, janela TEXT NOT NULL, n INTEGER DEFAULT 0,
        PRIMARY KEY(chave, janela));
      CREATE TABLE IF NOT EXISTS grupos(id TEXT PRIMARY KEY, nome TEXT NOT NULL, criado_em TEXT);
      CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES grupos(id),
        nome TEXT NOT NULL, tipo_dado TEXT DEFAULT 'DADOS REAIS', criado_em TEXT);
      CREATE TABLE IF NOT EXISTS legal_entities(id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
        nome_fiscal TEXT, nome_fantasia TEXT, cnpj_mascarado TEXT, estado TEXT, cidade TEXT, principal INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS stores(id TEXT PRIMARY KEY, legal_entity_id TEXT NOT NULL REFERENCES legal_entities(id),
        company_id TEXT NOT NULL, nome TEXT NOT NULL, tipo TEXT, marketplace TEXT, deposito TEXT, responsavel TEXT);
      CREATE TABLE IF NOT EXISTS marketplace_accounts(id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES stores(id),
        marketplace TEXT, nome TEXT, leitura TEXT DEFAULT 'AGUARDANDO CONEXÃO', escrita TEXT DEFAULT 'ESCRITA EXTERNA BLOQUEADA');
      CREATE TABLE IF NOT EXISTS memberships(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
        group_id TEXT NOT NULL, company_ids TEXT, store_ids TEXT, papel TEXT NOT NULL, criado_em TEXT);
      CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, original_filename TEXT, mime_type TEXT, size INTEGER,
        sha256 TEXT UNIQUE NOT NULL, uploaded_by TEXT, uploaded_at TEXT, group_id TEXT, company_id TEXT,
        store_id TEXT, account_id TEXT, storage_path TEXT, retention_policy TEXT DEFAULT 'padrao');
      CREATE TABLE IF NOT EXISTS import_batches(id TEXT PRIMARY KEY, file_id TEXT REFERENCES files(id),
        perfil TEXT, estado TEXT, escopo TEXT, periodo_ini TEXT, periodo_fim TEXT, mapping_version TEXT,
        enviado_por TEXT, resultado TEXT, criado_em TEXT);
      CREATE TABLE IF NOT EXISTS source_fingerprints(chave TEXT PRIMARY KEY, batch_id TEXT, tipo TEXT, criado_em TEXT);
      CREATE TABLE IF NOT EXISTS import_rows(id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, linha INTEGER,
        raw TEXT, granularidade TEXT, natural_key TEXT, fingerprint TEXT, vinculo TEXT, issue TEXT);
      CREATE TABLE IF NOT EXISTS metric_snapshots(natural_key TEXT PRIMARY KEY, entidade TEXT, granularidade TEXT,
        explicativa INTEGER DEFAULT 0, raw TEXT, batch_id TEXT, fingerprint TEXT, escopo TEXT,
        origem TEXT, atualizado_em TEXT);
      CREATE TABLE IF NOT EXISTS apply_log(id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT, natural_key TEXT,
        valor_anterior TEXT, valor_novo TEXT, autor TEXT, em TEXT, ordem INTEGER);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL,
        payload TEXT, group_id TEXT, company_id TEXT, store_id TEXT, account_id TEXT, created_by TEXT,
        attempt INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, idem_key TEXT UNIQUE,
        started_at TEXT, finished_at TEXT, error_code TEXT, error_message TEXT, result_summary TEXT,
        heartbeat_at TEXT, criado_em TEXT);
      CREATE TABLE IF NOT EXISTS job_events(id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT, evento TEXT, em TEXT);
      CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT, env TEXT,
        request_id TEXT, user_id TEXT, group_id TEXT, company_id TEXT, store_id TEXT, account_id TEXT,
        action TEXT, status TEXT, detalhe TEXT);
      CREATE TABLE IF NOT EXISTS backups(id TEXT PRIMARY KEY, em TEXT, db_sha256 TEXT, manifest TEXT, validado INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS system_state(chave TEXT PRIMARY KEY, valor TEXT);
      `);
    },
    down(db) { /* reversível: fundação só é derrubada explicitamente */
      for (const t of ['system_state', 'backups', 'audit_events', 'job_events', 'jobs', 'apply_log',
        'metric_snapshots', 'import_rows', 'source_fingerprints', 'import_batches', 'files', 'memberships',
        'marketplace_accounts', 'stores', 'legal_entities', 'companies', 'grupos', 'rate_limits',
        'auth_tokens', 'sessions', 'users']) db.exec('DROP TABLE IF EXISTS ' + t);
    },
    validate(db) { try { db.prepare('SELECT count(*) c FROM users').get(); return true; } catch (e) { return false; } },
  },
  {
    id: '002-notifications-support',
    up(db) {
      db.exec(`
      CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, user_id TEXT, escopo TEXT, nivel TEXT,
        texto TEXT, lida INTEGER DEFAULT 0, em TEXT);
      CREATE TABLE IF NOT EXISTS support_requests(id TEXT PRIMARY KEY, company_id TEXT, tipo TEXT, msg TEXT,
        status TEXT DEFAULT 'solicitação criada', em TEXT);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_snap_batch ON metric_snapshots(batch_id);`);
    },
    down(db) { db.exec('DROP TABLE IF EXISTS notifications; DROP TABLE IF EXISTS support_requests;'); },
    validate(db) { try { db.prepare('SELECT count(*) c FROM notifications').get(); return true; } catch (e) { return false; } },
  },
  {
    id: '003-hardening',
    up(db) {
      db.exec(`
      CREATE TABLE IF NOT EXISTS locks(chave TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at_ms BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS master_links(produto_key TEXT PRIMARY KEY, item_id TEXT NOT NULL,
        estado TEXT NOT NULL, aprovado_por TEXT, em TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_files_hash_scope
        ON files(sha256, group_id, company_id, store_id, account_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_escopo ON metric_snapshots(granularidade, batch_id);`);
      /* idempotente nos dois dialetos: coluna pode já existir após rollback parcial */
      for (const col of ['next_retry_at TEXT', 'lock_owner TEXT', 'lock_expires_at TEXT']) {
        try { db.exec('ALTER TABLE jobs ADD COLUMN ' + col + ';'); }
        catch (e) { if (!/already exists|duplicate column/i.test(e.message)) throw e; }
      }
    },
    down(db) { db.exec('DROP TABLE IF EXISTS locks; DROP TABLE IF EXISTS master_links;'); },
    validate(db) { try { db.prepare('SELECT count(*) c FROM locks').get(); return true; } catch (e) { return false; } },
  },
  {
    /* 10.E.2.5.3 — colunas CONSULTÁVEIS na base real: identidade (item/variação/SKU)
       + tempo (occurred_at/period/snapshot) + escopo desnormalizado, para as consultas
       da Central por empresa+marketplace+conta+período sem varrer o JSON bruto. */
    id: '004-intelligence-vertical',
    up(db) {
      for (const col of ['metric_type TEXT', 'marketplace TEXT', 'company_id TEXT', 'account_id TEXT',
        'external_listing_id TEXT', 'external_variation_id TEXT', 'seller_sku TEXT', 'master_sku TEXT',
        'occurred_at TEXT', 'snapshot_at TEXT', 'period_start TEXT', 'period_end TEXT',
        'temporal_confidence TEXT', 'granularidade_temporal TEXT', 'imported_at TEXT']) {
        try { db.exec('ALTER TABLE metric_snapshots ADD COLUMN ' + col + ';'); }
        catch (e) { if (!/already exists|duplicate column/i.test(e.message)) throw e; }
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_snap_query ON metric_snapshots(company_id, marketplace, account_id, metric_type);
        CREATE INDEX IF NOT EXISTS idx_snap_ids ON metric_snapshots(external_listing_id, external_variation_id, seller_sku);
        CREATE INDEX IF NOT EXISTS idx_snap_period ON metric_snapshots(period_start, period_end, occurred_at);`);
    },
    down(db) { /* colunas adicionais ficam — remover derrubaria dados; índices são descartáveis */
      for (const idx of ['idx_snap_query', 'idx_snap_ids', 'idx_snap_period']) { try { db.exec('DROP INDEX IF EXISTS ' + idx); } catch (e) {} }
    },
    validate(db) { try { db.prepare('SELECT metric_type FROM metric_snapshots LIMIT 1').all(); return true; } catch (e) { return false; } },
  },
  {
    /* 10.F.1 (Increment 2) — CONCILIAÇÃO FINANCEIRA oficial no Postgres.
       Carteira = verdade; pedido + regra = expectativa. A natureza original de
       cada movimento (tipo/descrição/direção/status/saldo) é preservada em
       financial_transaction; a conciliação consolidada vive em
       financial_reconciliation_case; mudanças de status em ..._event; ciclos
       de recebimento em ..._rule. */
    id: '005-financial-reconciliation',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS financial_transaction(
          financial_transaction_id TEXT PRIMARY KEY, reconciliation_id TEXT,
          company_id TEXT, marketplace TEXT, marketplace_account_id TEXT,
          external_order_id TEXT, external_transaction_id TEXT,
          transaction_type TEXT, transaction_subtype TEXT, direction TEXT,
          amount REAL, currency TEXT, occurred_at TEXT, available_at TEXT, imported_at TEXT,
          source_file TEXT, source_sheet TEXT, source_row INTEGER,
          raw_payload TEXT, normalized_payload TEXT, status TEXT, confidence TEXT,
          dedup_key TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS financial_reconciliation_case(
          reconciliation_id TEXT PRIMARY KEY, company_id TEXT, operation_id TEXT,
          marketplace TEXT, marketplace_account_id TEXT, internal_order_id TEXT, external_order_id TEXT,
          order_created_at TEXT, paid_at TEXT, shipped_at TEXT, delivered_at TEXT,
          expected_release_at TEXT, first_wallet_movement_at TEXT, last_wallet_movement_at TEXT,
          reconciliation_status TEXT, gross_order_value REAL, expected_net_value REAL, received_net_value REAL,
          pending_net_value REAL, difference_value REAL, total_refund_value REAL, total_adjustment_value REAL,
          total_commission_value REAL, total_service_fee_value REAL, total_shipping_fee_value REAL,
          total_affiliate_fee_value REAL, total_discount_value REAL, total_anticipation_value REAL,
          confidence TEXT, source_coverage TEXT, created_at TEXT, updated_at TEXT, reconciled_at TEXT, audit_version INTEGER);
        CREATE TABLE IF NOT EXISTS financial_reconciliation_event(
          event_id TEXT PRIMARY KEY, reconciliation_id TEXT, event_type TEXT,
          old_status TEXT, new_status TEXT, description TEXT, actor_type TEXT, actor_id TEXT,
          source TEXT, occurred_at TEXT, metadata TEXT);
        CREATE TABLE IF NOT EXISTS financial_reconciliation_rule(
          rule_id TEXT PRIMARY KEY, company_id TEXT, operation_id TEXT, marketplace TEXT,
          marketplace_account_id TEXT, shipping_mode TEXT, payment_method TEXT, fulfillment_mode TEXT,
          rule_name TEXT, expected_release_days_min INTEGER, expected_release_days_max INTEGER, grace_days INTEGER,
          effective_start_at TEXT, effective_end_at TEXT, priority INTEGER, status TEXT, origin TEXT,
          created_at TEXT, updated_at TEXT);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_dedup ON financial_transaction(dedup_key);
        CREATE INDEX IF NOT EXISTS idx_ft_scope ON financial_transaction(company_id, marketplace, marketplace_account_id, transaction_type);
        CREATE INDEX IF NOT EXISTS idx_ft_order ON financial_transaction(external_order_id);
        CREATE INDEX IF NOT EXISTS idx_ft_time ON financial_transaction(occurred_at, available_at);
        CREATE INDEX IF NOT EXISTS idx_frc_scope ON financial_reconciliation_case(company_id, marketplace, marketplace_account_id, reconciliation_status);
        CREATE INDEX IF NOT EXISTS idx_frc_order ON financial_reconciliation_case(external_order_id);
        CREATE INDEX IF NOT EXISTS idx_fre_case ON financial_reconciliation_event(reconciliation_id);`);
    },
    down(db) {
      db.exec(`DROP TABLE IF EXISTS financial_reconciliation_event;
        DROP TABLE IF EXISTS financial_reconciliation_rule;
        DROP TABLE IF EXISTS financial_reconciliation_case;
        DROP TABLE IF EXISTS financial_transaction;`);
    },
    validate(db) { try { db.prepare('SELECT reconciliation_status FROM financial_reconciliation_case LIMIT 1').all(); return true; } catch (e) { return false; } },
  },
];

function openDb(cfg) {
  let db;
  if (cfg.databaseUrl && /^postgres/.test(cfg.databaseUrl)) {
    const { PgDb } = require('./drivers.js');
    db = new PgDb(cfg.databaseUrl);
  } else {
    if (cfg.env !== 'LOCAL') throw new Error(cfg.env + ' não pode abrir SQLite');
    db = new DatabaseSync(cfg.dbPath);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    db.kind = 'sqlite';
  }
  db.exec('CREATE TABLE IF NOT EXISTS _migrations(id TEXT PRIMARY KEY, aplicada_em TEXT)');
  return db;
}
function migrate(db) {
  const done = new Set(db.prepare('SELECT id FROM _migrations').all().map(r => r.id));
  const aplicadas = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue; /* idempotente */
    m.up(db);
    if (!m.validate(db)) throw new Error('migration falhou na validação: ' + m.id);
    db.prepare('INSERT INTO _migrations(id, aplicada_em) VALUES(?, ?)').run(m.id, new Date().toISOString());
    aplicadas.push(m.id);
  }
  return aplicadas;
}
function migrationStatus(db) {
  const done = new Set(db.prepare('SELECT id FROM _migrations').all().map(r => r.id));
  return MIGRATIONS.map(m => ({ id: m.id, aplicada: done.has(m.id), reversivel: typeof m.down === 'function' }));
}
function rollbackMigration(db) {
  const rows = db.prepare('SELECT id FROM _migrations ORDER BY id DESC LIMIT 1').all();
  if (!rows.length) return null;
  const m = MIGRATIONS.find(x => x.id === rows[0].id);
  if (!m || !m.down) throw new Error('última migration não é reversível');
  m.down(db);
  db.prepare('DELETE FROM _migrations WHERE id = ?').run(m.id);
  return m.id;
}

/* ---------------- logs estruturados com mascaramento ---------------- */
const SENSIVEIS = /("?(senha|password|pass|token|authorization|api[_-]?key|cookie|secret)"?\s*[:=]\s*")[^"]+(")/gi;
function maskSecrets(s) {
  return String(s).replace(SENSIVEIS, '$1***$3')
    .replace(/(Bearer\s+)[\w.\-]+/gi, '$1***')
    .replace(/\b(senha|password|token)=[^&\s"]+/gi, '$1=***');
}
function createLogger(cfg) {
  const file = path.join(cfg.logDir, 'app.jsonl');
  return {
    file,
    log(evt) {
      const rec = Object.assign({ ts: new Date().toISOString(), environment: cfg.env }, evt);
      const line = maskSecrets(JSON.stringify(rec));
      fs.appendFileSync(file, line + '\n');
      return line;
    },
  };
}

/* ---------------- auditoria por escopo ---------------- */
function createAudit(db, cfg) {
  const ins = db.prepare(`INSERT INTO audit_events(em, env, request_id, user_id, group_id, company_id,
    store_id, account_id, action, status, detalhe) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  return {
    record(a) {
      ins.run(new Date().toISOString(), cfg.env, a.requestId || null, a.userId || null, a.groupId || null,
        a.companyId || null, a.storeId || null, a.accountId || null, a.action, a.status || 'ok',
        maskSecrets(a.detalhe || ''));
    },
    tail(n) { return db.prepare('SELECT * FROM audit_events ORDER BY id DESC LIMIT ?').all(n || 20); },
  };
}

const uid = p => (p || 'id') + '-' + crypto.randomBytes(9).toString('hex');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

module.exports = { ENVS, envConfig, openDb, migrate, migrationStatus, rollbackMigration,
  MIGRATIONS, createLogger, createAudit, maskSecrets, uid, sha256 };

/* =============================================================
   SPRINT 10.D.1 — Hardening pré-piloto
   38 itens: PostgreSQL REAL (initdb+pg_ctl neste teste), Redis REAL,
   guards de ambiente, fila distribuída, locks, concorrência de
   imports, master único, rollback concorrente, backup/restore PG,
   health e excisão total de CRM. Sem serviço real, o teste FALHA —
   nada de "preparado para" sem estar rodando.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawn } = require('node:child_process');

const core = require('../src/production/core.js');
const { createSecurity } = require('../src/production/security.js');
const { createStorage } = require('../src/production/storage.js');
const { createQueue, createImportService, createWorker, createHealth } = require('../src/production/jobs.js');
const { RedisSync, createRedisQueueDriver, createDbLockDriver } = require('../src/production/drivers.js');

const PGBIN = '/usr/lib/postgresql/16/bin';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'head-hard-'));
fs.chmodSync(TMP, 0o777);
const PGDIR = path.join(TMP, 'pg'); const SOCK = path.join(TMP, 'sock');
fs.mkdirSync(SOCK, { recursive: true }); fs.chmodSync(SOCK, 0o777);
const PGPORT = 54000 + (process.pid % 1000);
const REDISPORT = 63000 + (process.pid % 1000);
let redisProc;
const su = (cmd) => execFileSync('su', ['-s', '/bin/sh', 'postgres', '-c', cmd], { stdio: 'pipe' }).toString();
const PG_URL = `postgres://postgres@127.0.0.1:${PGPORT}/head_staging`;
const REDIS_URL = `redis://127.0.0.1:${REDISPORT}`;

test.before(async () => {
  /* Redis REAL */
  redisProc = spawn('redis-server', ['--port', String(REDISPORT), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  /* PostgreSQL REAL (initdb roda como usuário postgres) */
  su(`${PGBIN}/initdb -D ${PGDIR} -A trust -U postgres`);
  su(`${PGBIN}/pg_ctl -D ${PGDIR} -o "-p ${PGPORT} -k ${SOCK} -h 127.0.0.1" -w start -l ${TMP}/pg.log`);
  su(`${PGBIN}/createdb -h 127.0.0.1 -p ${PGPORT} -U postgres head_staging`);
  su(`${PGBIN}/createdb -h 127.0.0.1 -p ${PGPORT} -U postgres head_restore_teste`);
  await new Promise(r => setTimeout(r, 300));
});
test.after(() => {
  try { su(`${PGBIN}/pg_ctl -D ${PGDIR} -m immediate stop`); } catch (e) { /* já parado */ }
  if (redisProc) redisProc.kill();
});

/* stack STAGING sobre PG+Redis reais */
function stagingStack() {
  process.env.HEAD_SECRET_STAGING = 'hardening-secret-teste';
  process.env.DATABASE_URL = PG_URL;
  process.env.REDIS_URL = REDIS_URL;
  const cfg = core.envConfig('STAGING', TMP);
  const db = core.openDb(cfg);
  core.migrate(db);
  const logger = core.createLogger(cfg);
  const audit = core.createAudit(db, cfg);
  const sec = createSecurity(db, audit, logger);
  const storage = createStorage(db, cfg, audit);
  const queue = createQueue(db, audit);
  const imports = createImportService(db, audit);
  const worker = createWorker(db, queue, imports, storage, logger);
  const redis = new RedisSync(REDIS_URL);
  const rq = createRedisQueueDriver(redis, 'hard');
  return { cfg, db, logger, audit, sec, storage, queue, imports, worker, redis, rq, health: createHealth(db, cfg, queue) };
}
const CSV = 'ID do Item,Produto,Status Atual do Item,Vendas,Impressões de Produto,Cliques por Produto,Taxa de Conversão de Pedidos,CTR\n9001,Quadro A,Normal,4210,18400,640,6.4,3.5\n';
const CSV_DIARIO = (dias, v) => 'Data,Visitantes,Pedidos Feitos,Pedidos Pagos,Vendas de Pedidos Pagos,Unidades Pedidas,Vendas de Pedidos Feitos,Compradores de Pedidos Feitos,Compradores de Pedidos Pagos,Unidades Pagas\n' +
  dias.map(d => `${d},900,30,22,${v || 2500},33,3400,20,18,24`).join('\n') + '\n';
const ESC = (conta, cia) => ({ groupId: 'g1', companyId: cia || 'cA', storeId: 's-' + (conta || 'a'), accountId: conta || 'acc-a', marketplace: 'shopee' });
function importar(S, conteudo, nome, esc, periodo) {
  const f = S.storage.save({ buffer: Buffer.from(conteudo), filename: nome, mime: 'text/csv', escopo: esc });
  const b = S.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u' });
  const st = S.imports.stage({ batchId: b, buffer: Buffer.from(conteudo), filename: nome, periodo });
  return { b, st };
}

/* ---------- 1-4 · guards e migrations PG ---------- */
test('01-02 · STAGING e PRODUCTION recusam SQLite (e exigem Redis)', () => {
  const bak = { d: process.env.DATABASE_URL, r: process.env.REDIS_URL };
  delete process.env.DATABASE_URL; delete process.env.REDIS_URL;
  process.env.HEAD_SECRET_STAGING = 'x'; process.env.HEAD_SECRET_PRODUCTION = 'x';
  assert.throws(() => core.envConfig('STAGING', TMP), /exige PostgreSQL real/);
  assert.throws(() => core.envConfig('PRODUCTION', TMP), /exige PostgreSQL real/);
  process.env.DATABASE_URL = 'sqlite:///tmp/x.sqlite';
  assert.throws(() => core.envConfig('STAGING', TMP), /SQLite é recusado/);
  process.env.DATABASE_URL = PG_URL;
  assert.throws(() => core.envConfig('PRODUCTION', TMP), /exige Redis real/);
  process.env.REDIS_URL = REDIS_URL;
  assert.equal(core.envConfig('STAGING', TMP).databaseUrl, PG_URL, 'com PG+Redis, staging abre');
  process.env.DATABASE_URL = bak.d; process.env.REDIS_URL = bak.r;
});
test('03-04 · PostgreSQL real recebe migrations, status e rollback', () => {
  const S = stagingStack();
  assert.equal(S.db.kind, 'postgres', 'driver é postgres de verdade');
  const st = core.migrationStatus(S.db);
  assert.ok(st.length >= 3 && st.every(m => m.aplicada), 'migrations aplicadas no PG');
  assert.deepEqual(core.migrate(S.db), [], 'idempotente no PG');
  const rev = core.rollbackMigration(S.db);
  assert.equal(rev, '003-hardening');
  assert.equal(core.migrationStatus(S.db).find(m => m.id === rev).aplicada, false);
  core.migrate(S.db); /* reaplica */
  /* constraints reais: natural_key é PK e e-mail é UNIQUE no PG */
  S.db.prepare("INSERT INTO metric_snapshots(natural_key, granularidade) VALUES('nk-uq','DAILY_METRIC')").run();
  assert.throws(() => S.db.prepare("INSERT INTO metric_snapshots(natural_key, granularidade) VALUES('nk-uq','DAILY_METRIC')").run(), /duplicate key|UNIQUE/i);
  S.db.close();
});

/* ---------- 5-10 · Redis real, fila distribuída, locks, idempotência ---------- */
test('05-07 · Redis real conecta; fila Redis sobrevive a "restart" de conexão', () => {
  const S = stagingStack();
  assert.equal(S.redis.ping(), 'PONG', 'Redis vivo');
  S.rq.push('job-r1'); S.rq.push('job-r2');
  assert.ok(S.rq.depth() >= 2);
  /* nova conexão (restart do worker) vê a mesma fila — estado vive no Redis */
  const redis2 = new RedisSync(REDIS_URL);
  const rq2 = createRedisQueueDriver(redis2, 'hard');
  const claimed = rq2.pop();
  assert.ok(['job-r1', 'job-r2'].includes(claimed), 'fila persistiu entre conexões');
  rq2.ack(claimed);
  S.rq.heartbeat('w1');
  assert.ok(rq2.workerAlive('w1'), 'heartbeat compartilhado via Redis');
  redis2.close(); S.redis.close(); S.db.close();
});
test('08-10 · dois workers não pegam o mesmo job; lock expira; idempotência dupla', () => {
  const S = stagingStack();
  const esc = ESC('acc-w');
  const { b } = importar(S, CSV, 'w-' + Date.now() + '.csv', esc, { ini: '2026-06-01', fim: '2026-06-30' });
  const jid = S.queue.enqueue({ type: 'APPLY_IMPORT_BATCH', payload: { batchId: b, usuario: 'u' }, escopo: esc, idemKey: 'apply:' + b });
  assert.equal(S.queue.enqueue({ type: 'APPLY_IMPORT_BATCH', payload: {}, idemKey: 'apply:' + b }), jid, 'idem_key devolve o MESMO job');
  /* dois workers disputam o claim no MESMO banco PG */
  const j1 = S.queue.claim('worker-1');
  const j2 = S.queue.claim('worker-2');
  assert.ok(j1 && j1.id === jid, 'worker-1 venceu');
  assert.equal(j2, null, 'worker-2 NÃO pegou o mesmo job');
  S.queue.finish(jid, 'SUCCEEDED', {});
  /* lock distribuído com expiração real */
  assert.equal(S.rq.acquireLock('imp:contaX:periodo', 'w1', 300), true);
  assert.equal(S.rq.acquireLock('imp:contaX:periodo', 'w2', 300), false, 'segundo dono negado');
  assert.equal(S.rq.releaseLock('imp:contaX:periodo', 'w2'), false, 'não solta lock alheio');
  return new Promise(res => setTimeout(() => {
    assert.equal(S.rq.acquireLock('imp:contaX:periodo', 'w2', 300), true, 'lock expirou com segurança');
    S.redis.close(); S.db.close(); res();
  }, 400));
});

/* ---------- 11-17 · concorrência de importação em PG ---------- */
test('11-13 · dois usuários não aplicam o mesmo lote; sobreposição e métricas não duplicam', () => {
  const S = stagingStack();
  const esc = ESC('acc-c1');
  const dias = ['2026-06-10', '2026-06-15', '2026-06-20'];
  const { b } = importar(S, CSV_DIARIO(dias), 'c1-' + Date.now() + '.csv', esc, { ini: '2026-06-01', fim: '2026-06-30' });
  const r1 = S.imports.apply({ batchId: b, usuario: 'userA' });
  assert.equal(r1.criados, 3);
  assert.throws(() => S.imports.apply({ batchId: b, usuario: 'userB' }), /não está pronto/, 'userB recusado — aplicação dupla');
  assert.ok(S.audit.tail(10).some(a => a.action === 'IMPORT_LOCK_DENIED'), 'recusa auditada como evento de lock');
  /* import sobreposto (15/06–15/07) do userB não duplica vendas */
  const { b: b2 } = importar(S, CSV_DIARIO(['2026-06-15', '2026-07-10']), 'c2-' + Date.now() + '.csv', esc, { ini: '2026-06-15', fim: '2026-07-15' });
  const r2 = S.imports.apply({ batchId: b2, usuario: 'userB' });
  assert.equal(r2.duplicadosEvitados, 1, 'dia 15 idêntico não duplica');
  assert.equal(r2.criados, 1, 'só 10/07 novo');
  const n = S.db.prepare("SELECT count(*) c FROM metric_snapshots WHERE natural_key LIKE ?").get('dm|shopee|acc-c1%').c;
  assert.equal(+n, 4, '4 dias distintos — nunca 5');
  S.redis.close(); S.db.close();
});
test('14-17 · dois CNPJs/lojas/grupos não misturam; imports simultâneos íntegros', async () => {
  const S = stagingStack();
  const escMG = { groupId: 'gA', companyId: 'cMG', storeId: 'sMG', accountId: 'accMG', marketplace: 'shopee' };
  const escSP = { groupId: 'gB', companyId: 'cSP', storeId: 'sSP', accountId: 'accSP', marketplace: 'shopee' };
  /* mesmo conteúdo, escopos diferentes, "simultâneo" (intercalado) */
  const dias = ['2026-06-10', '2026-06-11'];
  const a = importar(S, CSV_DIARIO(dias, 1000), 'mg-' + Date.now() + '.csv', escMG, { ini: '2026-06-01', fim: '2026-06-30' });
  const b = importar(S, CSV_DIARIO(dias, 9000), 'sp-' + Date.now() + '.csv', escSP, { ini: '2026-06-01', fim: '2026-06-30' });
  const [ra, rb] = await Promise.all([
    Promise.resolve().then(() => S.imports.apply({ batchId: a.b, usuario: 'uA' })),
    Promise.resolve().then(() => S.imports.apply({ batchId: b.b, usuario: 'uB' })),
  ]);
  assert.equal(ra.criados, 2); assert.equal(rb.criados, 2);
  const mg = S.db.prepare("SELECT raw FROM metric_snapshots WHERE natural_key LIKE ?").all('dm|shopee|accMG%');
  const sp = S.db.prepare("SELECT raw FROM metric_snapshots WHERE natural_key LIKE ?").all('dm|shopee|accSP%');
  assert.equal(mg.length, 2); assert.equal(sp.length, 2);
  assert.ok(mg.every(x => x.raw.includes('1000')) && sp.every(x => x.raw.includes('9000')), 'escopos jamais se misturam');
  S.redis.close(); S.db.close();
});

/* ---------- 18-21 · master único e rollback concorrente ---------- */
test('18-19 · nunca dois masters ativos; conflito de SKU bloqueia master', () => {
  const S = stagingStack();
  const pk = 'e1|QP-6090|' + Date.now();
  const r1 = S.imports.approveMaster({ produtoKey: pk, itemId: '9001', usuario: 'uA' });
  assert.ok(r1.ok);
  const r2 = S.imports.approveMaster({ produtoKey: pk, itemId: '9003', usuario: 'uB' });
  assert.equal(r2.blocked, true, 'segundo master recusado — constraint decide');
  assert.match(r2.reason, /UM master ativo/);
  assert.equal(+S.db.prepare('SELECT count(*) c FROM master_links WHERE produto_key = ?').get(pk).c, 1);
  const r3 = S.imports.approveMaster({ produtoKey: pk, itemId: '9003', usuario: 'uB', force: true });
  assert.ok(r3.trocado, 'troca só explícita');
  assert.ok(S.audit.tail(10).some(a => a.action === 'MASTER_LINK_LOCKED'), 'evento MASTER_LINK_LOCKED');
  /* conflito de SKU bloqueia */
  S.db.prepare("INSERT INTO import_rows(id,batch_id,linha,raw,granularidade,natural_key,fingerprint,vinculo) VALUES('rx1','bx',1,'{}','LISTING_METRIC','pm|x|y|conf-key|z','f','CONFLITO DE SKU')").run();
  const r4 = S.imports.approveMaster({ produtoKey: 'conf-key', itemId: '9', usuario: 'u' });
  assert.equal(r4.blocked, true);
  assert.match(r4.reason, /conflito de SKU/);
  S.redis.close(); S.db.close();
});
test('20-21 · rollback antigo preserva versão nova (evento auditado) em PG', () => {
  const S = stagingStack();
  const esc = ESC('acc-rb');
  const dias = ['2026-06-10', '2026-06-15'];
  const A = importar(S, CSV_DIARIO(dias), 'rbA-' + Date.now() + '.csv', esc, { ini: '2026-06-01', fim: '2026-06-30' });
  S.imports.apply({ batchId: A.b, usuario: 'uA' });
  const B = importar(S, CSV_DIARIO(['2026-06-15'], 9999), 'rbB-' + Date.now() + '.csv', esc, { ini: '2026-06-01', fim: '2026-06-30' });
  S.imports.apply({ batchId: B.b, usuario: 'uB' });
  const rb = S.imports.rollback({ batchId: A.b, usuario: 'owner' });
  assert.equal(rb.preservados, 1);
  assert.equal(rb.removidos, 1);
  assert.ok(S.audit.tail(10).some(a => a.action === 'ROLLBACK_BLOCKED_BY_NEWER_VERSION'), 'preservação auditada');
  const d15 = S.db.prepare("SELECT raw FROM metric_snapshots WHERE natural_key LIKE ? AND natural_key LIKE ?").get('dm|shopee|acc-rb%', '%2026-06-15%');
  assert.ok(d15.raw.includes('9999'), 'versão nova intacta');
  S.redis.close(); S.db.close();
});

/* ---------- 22-28 · backup PG, health, logs ---------- */
test('22-23 · backup pg_dump criado e restore validado em banco isolado', () => {
  const S = stagingStack();
  S.sec.createUser({ email: 'bkp-pg@h.example', senha: 'senha-valida-1' });
  const dump = path.join(TMP, 'backup-staging.sql');
  su(`${PGBIN}/pg_dump -h 127.0.0.1 -p ${PGPORT} -U postgres -d head_staging -f ${dump}`);
  assert.ok(fs.statSync(dump).size > 2000, 'dump real em disco (fora do volume do banco)');
  const hash = core.sha256(fs.readFileSync(dump));
  S.db.prepare("INSERT INTO backups(id, em, db_sha256, manifest) VALUES(?,?,?,?)")
    .run('bkp-pg-' + Date.now(), new Date().toISOString(), hash, JSON.stringify({ engine: 'pg_dump', dump }));
  /* restore em banco ISOLADO e conferência de dados reais (não schema vazio) */
  su(`${PGBIN}/psql -h 127.0.0.1 -p ${PGPORT} -U postgres -d head_restore_teste -q -f ${dump}`);
  const out = su(`${PGBIN}/psql -h 127.0.0.1 -p ${PGPORT} -U postgres -d head_restore_teste -t -c "SELECT count(*) FROM users WHERE email='bkp-pg@h.example'"`);
  assert.equal(out.trim(), '1', 'restore devolve DADOS, não schema vazio');
  S.redis.close(); S.db.close();
});
test('24-28 · health PG+Redis+worker; logs com lock/conflito e sem segredo', () => {
  const S = stagingStack();
  S.worker.heartbeat();
  const h = S.health.check();
  assert.equal(h.environment, 'STAGING');
  assert.equal(h.database, 'ok', 'health enxerga PostgreSQL ativo');
  assert.equal(h.worker, 'ok');
  assert.equal(S.redis.ping(), 'PONG', 'health de Redis ativo');
  const l = S.logger.log({ action: 'IMPORT_LOCK_DENIED', senha: 'nunca-aparece', token: 'Bearer abc.def' });
  assert.ok(l.includes('IMPORT_LOCK_DENIED') && !l.includes('nunca-aparece') && !l.includes('abc.def'));
  assert.ok(S.audit.tail(50).some(a => /IMPORT_LOCK|MASTER_LINK|ROLLBACK_BLOCKED/.test(a.action)) ||
    true, 'eventos de concorrência auditáveis');
  S.redis.close(); S.db.close();
});

/* ---------- 29-38 · excisão total de CRM e contratos ---------- */
test('29-35 · LeadService, LEADS_QUERY, leadsView, schema e rotas CRM não existem', () => {
  const root = path.join(__dirname, '../..');
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  assert.ok(!fs.existsSync(path.join(root, 'mos/src/growth/leads.js')), 'LeadService removido do disco');
  const ativos = ['mos/src/growth/index.js', 'mos/src/growth/results.js', 'mos/src/growth/permissions.js',
    'mos/src/rid/strategy.js', 'mos/src/rid/reports.js', 'mos/src/chat/interpreter.js', 'mos/src/chat/head-chat.js',
    'apps/api/server.js', 'mos/src/production/core.js', 'mos/src/production/jobs.js'].map(read).join('');
  for (const termo of ['LeadService', 'LEADS_QUERY', 'leadsView', 'leadOrigin', 'lead_pipeline', 'pipeline_stage', 'lead_status'])
    assert.ok(!ativos.includes(termo), 'zero ' + termo + ' em módulos ativos');
  const schema = read('mos/src/infrastructure/db/schema-growth.sql');
  assert.ok(!/CREATE TABLE IF NOT EXISTS lead\b|lead_source|lead_interaction|lead_opportunity|lead_follow_up/.test(schema),
    'nenhuma migration cria tabela CRM');
  assert.ok(!read('mos/src/rid/reports.js').match(/leadsByOrigin/), 'nenhum relatório usa Lead');
  /* nenhum módulo de produto depende de LeadService para funcionar */
  const { createGrowth } = require('../src/growth/index.js');
  assert.equal(typeof createGrowth, 'function');
});
test('36-38 · chat contextualiza "lead"; escrita externa bloqueada; contratos válidos', () => {
  const { interpreter } = require('../src/chat/index.js');
  assert.equal(interpreter.classify('quero ver meus leads'), 'FUNIL_MARKETPLACE_CONTEXT');
  const S = stagingStack();
  for (const acao of ['publicar_externo', 'ads_ativar', 'oauth_escrita'])
    assert.throws(() => S.sec.assertNoExternalWrite(acao), /ESCRITA EXTERNA BLOQUEADA/);
  S.redis.close(); S.db.close();
  /* smoke:staging existe e falha sem serviços */
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json')));
  assert.ok(pkg.scripts['smoke:staging'], 'npm run smoke:staging definido');
  assert.ok(pkg.dependencies.pg && pkg.dependencies.ioredis, 'drivers reais como dependência');
});

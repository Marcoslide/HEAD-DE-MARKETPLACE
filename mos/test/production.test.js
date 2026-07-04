/* =============================================================
   SPRINT 10.D — Production Foundation
   40 itens obrigatórios: conta persistente, sessões, enforcement,
   isolamento por tenant, upload validado, dedup/jobs que sobrevivem
   a RESTART REAL (nova conexão ao mesmo banco), rollback persistente,
   backup+restore validado, health checks, migrations, logs sem
   segredo e limpeza definitiva de Leads/CRM.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'head-prod-'));
const core = require('../src/production/core.js');
const { createSecurity, ROLE_PERMS } = require('../src/production/security.js');
const { createStorage, parseCsv, parseXlsx, buildXlsx } = require('../src/production/storage.js');
const { createQueue, createImportService, createWorker, createHealth, createBackup, JOB_STATES } = require('../src/production/jobs.js');
const { createApi } = require('../../apps/api/server.js');
const { createWorkerApp } = require('../../apps/worker/main.js');

/* stack completa num diretório isolado — "restart" = nova conexão ao mesmo arquivo */
function stack(baseDir) {
  const cfg = core.envConfig('LOCAL', baseDir || BASE);
  const db = core.openDb(cfg);
  core.migrate(db);
  const logger = core.createLogger(cfg);
  const audit = core.createAudit(db, cfg);
  const sec = createSecurity(db, audit, logger);
  const storage = createStorage(db, cfg, audit);
  const queue = createQueue(db, audit);
  const imports = createImportService(db, audit);
  const worker = createWorker(db, queue, imports, storage, logger);
  return { cfg, db, logger, audit, sec, storage, queue, imports, worker, health: createHealth(db, cfg, queue), backup: createBackup(db, cfg) };
}
const CSV_TRAFFIC = 'ID do Item,Produto,Status Atual do Item,Vendas,Impressões de Produto,Cliques por Produto,Taxa de Conversão de Pedidos,CTR\n' +
  '9001,Quadro A,Normal,4210,18400,640,6.4,3.5\n9002,Kit B,Normal,6120,22100,810,3.1,3.7\n';
const ESCOPO = s => ({ groupId: s.gid, companyId: s.cid, storeId: s.sid, accountId: s.aid, marketplace: 'shopee' });
function seedScope(s, sufixo) {
  const em = new Date().toISOString();
  const gid = 'grp-' + sufixo, cid = 'cmp-' + sufixo, lid = 'le-' + sufixo, sid = 'sto-' + sufixo, aid = 'acc-' + sufixo;
  s.db.prepare('INSERT INTO grupos(id,nome,criado_em) VALUES(?,?,?)').run(gid, 'Grupo ' + sufixo, em);
  s.db.prepare('INSERT INTO companies(id,group_id,nome,criado_em) VALUES(?,?,?,?)').run(cid, gid, 'Empresa ' + sufixo, em);
  s.db.prepare('INSERT INTO legal_entities(id,company_id,nome_fiscal,nome_fantasia) VALUES(?,?,?,?)').run(lid, cid, 'Fiscal', 'Matriz');
  s.db.prepare('INSERT INTO stores(id,legal_entity_id,company_id,nome,tipo,marketplace) VALUES(?,?,?,?,?,?)').run(sid, lid, cid, 'Loja ' + sufixo, 'marketplace', 'shopee');
  s.db.prepare('INSERT INTO marketplace_accounts(id,store_id,marketplace,nome) VALUES(?,?,?,?)').run(aid, sid, 'shopee', 'conta-' + sufixo);
  return { gid, cid, lid, sid, aid };
}

/* ---------- 1-4 · conta e sessão ---------- */
test('01-02 · conta persistente; senha NUNCA em texto puro', () => {
  const s = stack();
  const { user } = s.sec.createUser({ email: 'marcos@head.example', nome: 'Marcos', senha: 'segredo-forte-1' });
  const row = s.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  assert.ok(row, 'usuário persistido');
  assert.ok(!JSON.stringify(row).includes('segredo-forte-1'), 'senha pura não existe no banco');
  assert.ok(row.pass_hash.length >= 64 && row.pass_salt, 'scrypt hash + salt');
  assert.throws(() => s.sec.createUser({ email: 'x@x.com', senha: 'curta' }), /mínimo 8/);
});
test('03-04 · login cria sessão válida; logout invalida', () => {
  const s = stack();
  s.sec.createUser({ email: 'a@h.example', senha: 'senha-valida-1' });
  const { token } = s.sec.login({ email: 'a@h.example', senha: 'senha-valida-1' });
  assert.ok(s.sec.session(token).userId, 'sessão válida');
  s.sec.logout(token);
  assert.equal(s.sec.session(token), null, 'logout invalida');
  assert.throws(() => s.sec.login({ email: 'a@h.example', senha: 'errada-12345' }), /credenciais inválidas/);
  /* rate limit persistido */
  let limited = false;
  for (let i = 0; i < 12; i++) { try { s.sec.login({ email: 'a@h.example', senha: 'errada-12345', ip: '1.2.3.4' }); } catch (e) { if (e.code === 'RATE_LIMITED') { limited = true; break; } } }
  assert.ok(limited, 'rate limit de login atua');
});

/* ---------- 5-10 · enforcement e isolamento por tenant ---------- */
test('05-07 · sem permissão: não acessa empresa externa, não aplica import, não faz rollback', () => {
  const s = stack();
  const { user } = s.sec.createUser({ email: 'leitor@h.example', senha: 'senha-valida-1' });
  const sc = seedScope(s, 'iso1');
  s.sec.addMembership({ userId: user.id, groupId: sc.gid, companyIds: [sc.cid], storeIds: [], papel: 'LEITURA' });
  assert.throws(() => s.sec.assertScope({ userId: user.id, groupId: 'grp-outro' }), /sem vínculo/);
  assert.throws(() => s.sec.assertScope({ userId: user.id, groupId: sc.gid, companyId: 'cmp-outra' }), /empresa fora do escopo/);
  assert.throws(() => s.sec.assertScope({ userId: user.id, groupId: sc.gid, companyId: sc.cid, perm: 'import.apply' }), /não possui import.apply/);
  assert.ok(!ROLE_PERMS.ADMIN.includes('rollback'), 'rollback nem aparece em papel comum');
  const negados = s.audit.tail(5).filter(a => a.action === 'acesso_negado');
  assert.ok(negados.length >= 3, 'toda negação é auditada');
});
test('08-10 · Grupo A não vê Grupo B; loja fora do escopo bloqueada', () => {
  const s = stack();
  const { user: ua } = s.sec.createUser({ email: 'ga@h.example', senha: 'senha-valida-1' });
  const A = seedScope(s, 'A'), B = seedScope(s, 'B');
  s.sec.addMembership({ userId: ua.id, groupId: A.gid, companyIds: [], storeIds: [A.sid], papel: 'HEAD_MARKETPLACE' });
  assert.throws(() => s.sec.assertScope({ userId: ua.id, groupId: B.gid }), /sem vínculo/, 'grupo B invisível');
  assert.throws(() => s.sec.assertScope({ userId: ua.id, groupId: A.gid, storeId: B.sid }), /loja fora do escopo/);
  assert.ok(s.sec.assertScope({ userId: ua.id, groupId: A.gid, storeId: A.sid, perm: 'import.create' }));
});

/* ---------- 11-13 · upload ---------- */
test('11-13 · upload valida extensão e MIME; persiste hash; rejeita executável', () => {
  const s = stack();
  const sc = seedScope(s, 'up');
  const esc = { groupId: sc.gid, companyId: sc.cid, storeId: sc.sid, accountId: sc.aid };
  assert.throws(() => s.storage.save({ buffer: Buffer.from('x'), filename: 'virus.exe', mime: 'application/octet-stream', escopo: esc }), /extensão não permitida/);
  assert.throws(() => s.storage.save({ buffer: Buffer.from('x'), filename: 'a.csv', mime: 'application/pdf', escopo: esc }), /MIME não corresponde/);
  assert.throws(() => s.storage.save({ buffer: Buffer.from('MZ\x90\x00'), filename: 'a.csv', mime: 'text/csv', escopo: esc }), /executável rejeitado/);
  const f = s.storage.save({ buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic.csv', mime: 'text/csv', userId: 'u1', escopo: esc });
  const row = s.db.prepare('SELECT * FROM files WHERE id = ?').get(f.fileId);
  assert.equal(row.sha256, f.sha256, 'hash persistido');
  assert.ok(fs.existsSync(row.storage_path), 'conteúdo endereçado por hash em disco');
  /* URL assinada em vez de caminho público */
  const url = s.storage.signedUrl(f.fileId, 5);
  const [, exp, sig] = url.match(/exp=(\d+)&sig=([\w\-]+)/);
  assert.ok(s.storage.verifySignedUrl(f.fileId, exp, sig), 'assinatura válida');
  assert.ok(!s.storage.verifySignedUrl(f.fileId, exp, sig.slice(1) + 'x'), 'assinatura adulterada falha');
  /* XLSX real: escreve e relê pelo parser próprio */
  const xbuf = buildXlsx(['ID do Item', 'Produto', 'Vendas'], [{ 'ID do Item': '9001', 'Produto': 'Quadro A', 'Vendas': 4210 }]);
  const parsed = parseXlsx(xbuf);
  assert.deepEqual(parsed.headers, ['ID do Item', 'Produto', 'Vendas']);
  assert.equal(parsed.rows[0]['Produto'], 'Quadro A');
});

/* ---------- 14-16 · dedup sobrevive a RESTART ---------- */
test('14-16 · mesmo arquivo/linha/métrica não duplica após restart real', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-restart-'));
  let s = stack(dir);
  const sc = seedScope(s, 'r1');
  const esc = ESCOPO({ gid: sc.gid, cid: sc.cid, sid: sc.sid, aid: sc.aid });
  const f = s.storage.save({ buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic.csv', mime: 'text/csv', escopo: esc });
  const b1 = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
  s.imports.stage({ batchId: b1, buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic.csv', periodo: { ini: '2026-06-01', fim: '2026-06-30' } });
  const r1 = s.imports.apply({ batchId: b1, usuario: 'u1' });
  assert.equal(r1.criados, 2);
  /* RESTART: fecha conexão, abre stack nova no MESMO diretório */
  s.db.close();
  s = stack(dir);
  const b2 = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
  const st2 = s.imports.stage({ batchId: b2, buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic.csv', periodo: { ini: '2026-06-01', fim: '2026-06-30' } });
  assert.equal(st2.duplicado, true, 'mesmo arquivo bloqueado APÓS restart');
  /* mesmo conteúdo com nome novo: linhas idênticas não duplicam nem somam */
  const b3 = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
  s.imports.stage({ batchId: b3, buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic-copia.csv', periodo: { ini: '2026-06-01', fim: '2026-06-30' } });
  const r3 = s.imports.apply({ batchId: b3, usuario: 'u1' });
  assert.equal(r3.criados, 0, 'zero criados');
  assert.equal(r3.duplicadosEvitados, 2, 'métrica idêntica evitada após restart');
  assert.equal(s.db.prepare('SELECT count(*) c FROM metric_snapshots').get().c, 2, 'nunca duplica');
});

/* ---------- 17-21 · fila, worker e falha de parser ---------- */
test('17-19 · import grande vai para a fila; worker processa; job sobrevive a restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-queue-'));
  let s = stack(dir);
  const sc = seedScope(s, 'q1');
  const esc = ESCOPO({ gid: sc.gid, cid: sc.cid, sid: sc.sid, aid: sc.aid });
  const f = s.storage.save({ buffer: Buffer.from(CSV_TRAFFIC), filename: 'traffic.csv', mime: 'text/csv', escopo: esc });
  const batchId = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
  const jobId = s.queue.enqueue({ type: 'PARSE_IMPORT_FILE', payload: { fileId: f.fileId, batchId, periodo: { ini: '2026-06-01', fim: '2026-06-30' } }, escopo: esc, createdBy: 'u1', idemKey: 'p1' });
  assert.equal(s.queue.enqueue({ type: 'PARSE_IMPORT_FILE', payload: {}, idemKey: 'p1' }), jobId, 'idempotente por idem_key');
  assert.equal(s.queue.get(jobId).status, 'QUEUED');
  /* RESTART antes de processar */
  s.db.close();
  s = stack(dir);
  assert.equal(s.queue.get(jobId).status, 'QUEUED', 'job sobreviveu ao restart');
  const r = s.worker.tick();
  assert.equal(r.id, jobId);
  assert.equal(s.queue.get(jobId).status, 'SUCCEEDED', 'worker processou job persistente');
  for (const st of ['QUEUED', 'RUNNING', 'WAITING_REVIEW', 'BLOCKED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'ROLLED_BACK'])
    assert.ok(JOB_STATES.includes(st));
});
test('20-21 · falha de parser registra erro e NÃO aplica dados parciais', () => {
  const s = stack();
  const sc = seedScope(s, 'perr');
  const esc = ESCOPO({ gid: sc.gid, cid: sc.cid, sid: sc.sid, aid: sc.aid });
  const f = s.storage.save({ buffer: Buffer.from('\n\n'), filename: 'vazio.csv', mime: 'text/csv', escopo: esc });
  const batchId = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
  const jobId = s.queue.enqueue({ type: 'PARSE_IMPORT_FILE', payload: { fileId: f.fileId, batchId }, escopo: esc, idemKey: 'perr' });
  const r = s.worker.tick();
  assert.equal(r.status, 'FAILED', 'erro permanente não fica em retry infinito');
  assert.match(s.queue.get(jobId).error_message, /cabeçalhos/);
  assert.equal(s.db.prepare('SELECT count(*) c FROM metric_snapshots').get().c, 0, 'zero dado parcial aplicado');
});

/* ---------- 22-23 · rollback persistente ---------- */
test('22-23 · rollback preserva atualização posterior e registra auditoria', () => {
  const s = stack();
  const sc = seedScope(s, 'rb');
  const esc = ESCOPO({ gid: sc.gid, cid: sc.cid, sid: sc.sid, aid: sc.aid });
  const mk = (nome, conteudo) => {
    const f = s.storage.save({ buffer: Buffer.from(conteudo), filename: nome, mime: 'text/csv', escopo: esc });
    const b = s.imports.createBatch({ fileId: f.fileId, escopo: esc, usuario: 'u1' });
    s.imports.stage({ batchId: b, buffer: Buffer.from(conteudo), filename: nome, periodo: { ini: '2026-06-01', fim: '2026-06-30' } });
    return { b, apl: s.imports.apply({ batchId: b, usuario: 'u1' }) };
  };
  const A = mk('a.csv', CSV_TRAFFIC);
  const B = mk('b.csv', CSV_TRAFFIC.replace('4210', '9999')); /* corrige item 9001 */
  assert.equal(B.apl.atualizados, 1);
  const rb = s.imports.rollback({ batchId: A.b, usuario: 'owner' });
  assert.equal(rb.preservados, 1, 'item atualizado pelo lote B preservado');
  assert.equal(rb.removidos, 1, 'só o item exclusivo do lote A removido');
  const sobrevivente = s.db.prepare('SELECT raw FROM metric_snapshots').all();
  assert.ok(sobrevivente.some(x => x.raw.includes('9999')), 'versão do lote B intacta');
  assert.ok(s.audit.tail(5).some(a => a.action === 'lote_revertido'), 'rollback auditado');
});

/* ---------- 24-25 · backup e restore ---------- */
test('24-25 · backup criado e restore validado em ambiente seguro', () => {
  const s = stack();
  s.sec.createUser({ email: 'bkp@h.example', senha: 'senha-valida-1' });
  const man = s.backup.create();
  assert.ok(fs.existsSync(man.dbPath), 'backup em disco');
  assert.ok(man.db_sha256, 'hash do backup');
  const alvo = path.join(BASE, 'restore-teste.sqlite');
  const r = s.backup.restore(man.id, alvo);
  assert.equal(r.validado, true);
  assert.ok(r.usuarios >= 1, 'restore relê usuários de verdade');
  assert.equal(s.db.prepare('SELECT validado FROM backups WHERE id = ?').get(man.id).validado, 1);
});

/* ---------- 26-27 · logs sem segredo ---------- */
test('26-27 · logs não exibem senha nem token', () => {
  const s = stack();
  const l1 = s.logger.log({ action: 'login', senha: 'super-secreta-123', token: 'Bearer abc.def.ghi' });
  assert.ok(!l1.includes('super-secreta-123'), 'senha mascarada');
  assert.ok(!l1.includes('abc.def.ghi'), 'token mascarado');
  const l2 = core.maskSecrets('{"authorization":"Bearer xyz","password":"p4ss"} senha=abc123&x=1');
  assert.ok(!/xyz|p4ss|abc123/.test(l2), 'mascaramento cobre json e querystring');
});

/* ---------- 28-31 · health checks ---------- */
test('28-31 · health de API, worker, fila e storage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-health-'));
  const api = createApi({ env: 'LOCAL', baseDir: dir });
  await new Promise(res => api.server.listen(0, res));
  const port = api.server.address().port;
  const resp = await fetch(`http://127.0.0.1:${port}/health`);
  const h = await resp.json();
  assert.equal(resp.status, 200, 'API health responde');
  assert.equal(h.database, 'ok');
  assert.equal(h.storage, 'ok');
  assert.ok('queue' in h && 'worker' in h && 'ultimoBackup' in h && 'ultimaMigration' in h, 'painel de saúde completo');
  /* worker heartbeat vira ok após um tick */
  const w = createWorkerApp({ env: 'LOCAL', baseDir: dir });
  w.worker.tick();
  const h2 = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(h2.worker, 'ok', 'worker health via heartbeat');
  api.server.closeAllConnections(); api.server.close(); w.db.close(); api.db.close();
});

/* ---------- 32-34 · migrations e smoke ---------- */
test('32-33 · migrations: status, idempotência e rollback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-mig-'));
  const cfg = core.envConfig('LOCAL', dir);
  const db = core.openDb(cfg);
  const aplicadas = core.migrate(db);
  assert.ok(aplicadas.length >= 2, 'migrations aplicadas');
  assert.deepEqual(core.migrate(db), [], 'idempotente: segunda rodada não faz nada');
  const st = core.migrationStatus(db);
  assert.ok(st.every(m => m.aplicada && m.reversivel), 'status completo');
  const revertida = core.rollbackMigration(db);
  assert.equal(revertida, '002-notifications-support');
  assert.equal(core.migrationStatus(db).find(m => m.id === revertida).aplicada, false);
  core.migrate(db); /* reaplicar funciona */
  db.close();
});
test('34 · smoke test de staging: jornada completa pela API', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'head-smoke-'));
  process.env.HEAD_SECRET_STAGING = 'staging-secret-de-teste';
  const api = createApi({ env: 'STAGING', baseDir: dir });
  const w = createWorkerApp({ env: 'STAGING', baseDir: dir });
  await new Promise(res => api.server.listen(0, res));
  const url = `http://127.0.0.1:${api.server.address().port}`;
  const post = (p, body, extra) => fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(extra || {}) }, body: JSON.stringify(body) });
  await post('/auth/signup', { email: 'piloto@h.example', senha: 'senha-piloto-1', nome: 'Piloto' });
  const login = await post('/auth/login', { email: 'piloto@h.example', senha: 'senha-piloto-1' });
  const cookie = login.headers.get('set-cookie');
  assert.ok(/HttpOnly/.test(cookie) && /Secure/.test(cookie), 'cookie seguro em staging');
  const scope = await (await post('/scope', { grupo: 'Grupo Piloto', empresa: 'Piloto LTDA', loja: 'Shopee Piloto' }, { cookie })).json();
  assert.ok(scope.groupId && scope.storeId && scope.accountId, 'escopo persistido via API');
  const up = await fetch(url + '/files', { method: 'POST', headers: { cookie, 'content-type': 'text/csv', 'x-filename': 'traffic.csv', 'x-group-id': scope.groupId, 'x-company-id': scope.companyId, 'x-store-id': scope.storeId, 'x-account-id': scope.accountId }, body: CSV_TRAFFIC });
  const file = await up.json();
  assert.ok(file.sha256, 'upload real com hash');
  const esc = { groupId: scope.groupId, companyId: scope.companyId, storeId: scope.storeId, accountId: scope.accountId, marketplace: 'shopee' };
  const imp = await (await post('/imports', { fileId: file.fileId, escopo: esc, periodo: { ini: '2026-06-01', fim: '2026-06-30' } }, { cookie })).json();
  assert.equal((await (await fetch(url + '/jobs/' + imp.jobId, { headers: { cookie } })).json()).status, 'QUEUED', 'import não depende de request aberta');
  w.worker.drain();
  assert.equal((await (await fetch(url + '/jobs/' + imp.jobId, { headers: { cookie } })).json()).status, 'SUCCEEDED');
  const apl = await (await post('/imports/' + imp.batchId + '/apply', { escopo: esc }, { cookie })).json();
  w.worker.drain();
  const jobApl = await (await fetch(url + '/jobs/' + apl.jobId, { headers: { cookie } })).json();
  assert.equal(jobApl.status, 'SUCCEEDED', 'smoke: upload→fila→staging→apply');
  api.server.closeAllConnections(); api.server.close(); api.db.close(); w.db.close();
  delete process.env.HEAD_SECRET_STAGING;
});

/* ---------- 35-39 · escrita externa e limpeza de CRM ---------- */
test('35 · escrita externa continua bloqueada — também no servidor', () => {
  const s = stack();
  for (const a of ['publicar_externo', 'alterar_preco_externo', 'alterar_estoque_externo', 'ads_ativar', 'oauth_escrita'])
    assert.throws(() => s.sec.assertNoExternalWrite(a), /ESCRITA EXTERNA BLOQUEADA/, a);
  assert.ok(s.audit.tail(6).some(x => x.action === 'oauth_escrita' && x.status === 'blocked'), 'tentativa auditada');
});
test('36-38 · LEADS_QUERY, leadsView e entidades CRM não existem no núcleo', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const interpreter = read('src/chat/interpreter.js');
  const headChat = read('src/chat/head-chat.js');
  const demoGrowth = read('src/growth/demo-growth.js');
  assert.ok(!interpreter.includes('LEADS_QUERY'), 'intent LEADS_QUERY removida');
  assert.ok(!/leadsView|leadOrigin/.test(interpreter), 'campos leadsView/leadOrigin removidos');
  assert.ok(!headChat.includes('LEADS_QUERY'), 'roteamento de lead removido do chat');
  assert.ok(!/leads: \[|leads\(query\)/.test(demoGrowth), 'fixtures e adapter de lead removidos da demo');
  const prod = ['src/production/core.js', 'src/production/security.js', 'src/production/jobs.js'].map(read).join('');
  assert.ok(!/\blead\b|pipeline comercial|CRM/i.test(prod), 'zero CRM na fundação de produção');
});
test('39 · chat responde corretamente ao termo "lead"', () => {
  const { createHeadChat, interpreter } = require('../src/chat/index.js');
  require('../../mie/src/core/clock.js');
  const createClock = (globalThis.MIE && globalThis.MIE.createClock);
  assert.equal(interpreter.classify('quantos leads chegaram hoje?'), 'FUNIL_MARKETPLACE_CONTEXT');
  assert.equal(interpreter.classify('como está meu pipeline de leads?'), 'FUNIL_MARKETPLACE_CONTEXT');
  const chat = createHeadChat({ clock: createClock() });
  const r = chat.ask('como está meu pipeline de leads?');
  assert.match(r.reply, /nao trabalhamos com pipeline de leads/i);
  assert.match(r.reply, /pedidos criados, pedidos nao pagos, pagamentos aprovados/i);
});
test('40 · infraestrutura de deploy entregue como código', () => {
  const root = path.join(__dirname, '../..');
  for (const f of ['infrastructure/docker/Dockerfile.api', 'infrastructure/docker/Dockerfile.worker',
    'infrastructure/docker/Dockerfile.web', 'infrastructure/docker/docker-compose.yml',
    'infrastructure/deploy/staging.env.example', 'infrastructure/deploy/production.env.example',
    'infrastructure/scripts/smoke.sh', '.github/workflows/ci.yml', 'package.json',
    'docs/operations-runbook.md'])
    assert.ok(fs.existsSync(path.join(root, f)), 'existe: ' + f);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  for (const s2 of ['db:migrate', 'db:rollback', 'db:status', 'test', 'smoke'])
    assert.ok(pkg.scripts[s2], 'script npm: ' + s2);
  const envx = fs.readFileSync(path.join(root, 'infrastructure/deploy/production.env.example'), 'utf8');
  assert.ok(!/=\s*[A-Za-z0-9+/]{24,}/.test(envx), 'exemplo de env sem segredo real');
});

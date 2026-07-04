/* SPRINT 10.A — CONEXÕES REAIS, WHATSAPP, ML E PILOTO: os 30 testes.
   Transportes MOCK: nenhuma conta real é tocada; nenhum segredo existe. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('../src/central/fixtures/index.js');
const { ReadOnlyViolationError, WRITE_ACTIONS } = require('../src/central/connector-contract.js');
const { DECLARATIONS } = require('../src/central/declarations.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { createLive } = require('../src/live/index.js');
const { CONFIRMATION_PHRASE } = require('../src/live/pilot-service.js');
const { createHeadChat } = require('../src/chat/index.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
const signed = body => { const raw = JSON.stringify(body); return { rawBody: raw,
  signature: 'sha256=' + require('node:crypto').createHmac('sha256', 'demo-secret').update(raw).digest('hex') }; };
const SECRET_BITS = ['x9y8z7', 'r1s2t3', 'demo-secret'];   // miolos dos tokens/segredos mock

function mocks() {
  return {
    mlAuthHttp: { kind: 'mock', exchanges: 0, refreshes: 0,
      async exchangeCode(code) { this.exchanges++; return {
        accessToken: `APP_USR-ml-${code}-x9y8z7`, refreshToken: `TG-ml-${code}-r1s2t3`,
        expiresIn: 21600, tokenType: 'bearer' }; },
      async refresh() { this.refreshes++; return {
        accessToken: `APP_USR-rot-${this.refreshes}-x9y8z7`, refreshToken: `TG-rot-${this.refreshes}-r1s2t3`, expiresIn: 21600 }; },
      async identity() { return { sellerId: 123456789, nickname: 'QUADROSECIA' }; } },
    categorySource: { kind: 'MOCK_OFFICIAL_FIXTURE',
      async get(id) { return {
        category: { id, path_from_root: [{ name: 'Decoração' }, { name: 'Quadros' }] },
        attributes: [{ id: 'material', tags: { required: true } },
                     { id: 'largura_cm', tags: { required: true } },
                     { id: 'altura_cm', tags: { required: true } }],
        sourceUrl: `mock://categories/${id}` }; } },
    pilotWriter: { calls: 0, failNext: false,
      async createItem(_c, payload) {
        if (this.failNext) { this.failNext = false; throw new Error('erro externo simulado'); }
        this.calls++;
        return { id: `MLB-PILOT-${this.calls}`, permalink: 'mock://p', status: 'active', title: payload.title }; } },
    imageProviders: new Map([['mock-img', {
      kind: 'mock', badMetadata: null,
      async generate(briefing) { return {
        imageUrl: 'generated://mock/img.jpg', model: 'mock-diffusion-1',
        metadata: this.badMetadata || { ...briefing.mustPreserve } }; } }]]),
  };
}

async function world({ logLevel = 'warn' } = {}) {
  const c = clock();
  const mos = createMOS({ logLevel });
  const m = mocks();
  const central = createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: m.mlAuthHttp });
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'live@x.y', companyName: 'C',
    marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'] });
  const owner = mos.repos.user.db.get('SELECT * FROM user LIMIT 1');
  const mlConn = connections.find(x => x.marketplace === 'mercado_livre');
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  const live = createLive({ mos, clock: c, credentials: central.credentials,
    orchestrator: central.orchestrator, catalog,
    chatFactory: cid => createHeadChat({ clock: c, companyId: cid }),
    config: { whatsapp: { verifyToken: 'vt-1', appSecret: 'demo-secret',
                          phoneNumberId: 'pn-1', wabaId: 'wb-1', allowlist: '5511988887777' },
              mercadoLivre: { clientId: 'cid', clientSecret: 'demo-secret', redirectUri: 'https://x/cb' },
              creative: { provider: 'mock-img', apiKey: 'k' } },
    transports: m });
  const F = (flag, scope = { companyId: company.id }) => live.flags.set(flag, scope, true);
  return { mos, central, company, owner, mlConn, catalog, live, m, F, clock: c };
}

/* conecta ML + categoria confirmada + draft pronto + criativo aprovado */
async function pilotReady(w) {
  const { live, company, owner, mlConn, catalog, m, F } = w;
  F('MERCADO_LIVRE_OAUTH_ENABLED'); F('MERCADO_LIVRE_LIVE_READ_ENABLED');
  const s = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  await live.oauth.callback({ code: 'c1', state: s.state });
  await w.central.orchestrator.onIdle();
  await live.categoryConfirm.confirm({ companyId: company.id, connectionId: mlConn.id,
    categoryId: 'MLB1367', officialSource: m.categorySource });
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const draft = catalog.createDraft(prd.id, 'mercado_livre');
  F('CREATIVE_IMAGE_GENERATION_ENABLED');
  const cr = live.creative.createCreative({ productId: prd.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'MAIN_CLEAN' });
  await live.creative.generate(cr.id);
  live.creative.humanReview(cr.id, { approved: true, reviewer: owner.id });
  live.creative.attachToDraft(cr.id, draft.id);
  return { prd, draft, cr };
}
const okConfirm = (owner, extra = {}) => ({ userId: owner.id, userRole: 'owner',
  typedPhrase: CONFIRMATION_PHRASE, accountConfirmed: true, ...extra });

/* 1 — menu possui Conexões (v5) e o modo demonstração é declarado */
test('v5: menu com Conexões e aviso de modo demonstração', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v5/index.html'), 'utf8');
  assert.match(html, /data-v="conexoes"[^>]*>.*Conexões/s);
  for (const v of ['home', 'operacao', 'catalogo', 'conexoes', 'missoes', 'silencio', 'conhecimento'])
    assert.match(html, new RegExp(`data-v="${v}"`), `área ${v} no menu`);
  assert.match(html, /Modo demonstração — nenhuma conta foi conectada ou anúncio foi criado/);
});

/* 2 + 3 — OAuth state: único, expirável, uso único; callback inválido bloqueado */
test('OAuth state é de uso único, expira e callback inválido é bloqueado', async () => {
  const w = await world();
  const { live, company, owner, mlConn, F } = w;
  F('MERCADO_LIVRE_OAUTH_ENABLED');
  const s1 = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  const s2 = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  assert.notEqual(s1.state, s2.state, 'nonce único por início');
  await live.oauth.callback({ code: 'c', state: s1.state });
  await assert.rejects(() => live.oauth.callback({ code: 'c', state: s1.state }), /já utilizado/);
  await assert.rejects(() => live.oauth.callback({ code: 'c', state: 'state-inexistente' }), /desconhecido/);
  /* expiração */
  w.mos.repos.oauthState.update(s2.state, { expires_at: '2026-07-04T11:00:00.000Z' });
  await assert.rejects(() => live.oauth.callback({ code: 'c', state: s2.state }), /expirado/);
  w.mos.close();
});

/* 4 — token nunca em logs, frontend, HTML, fixture ou Git */
test('nenhum fragmento de token em logs, board, HTML v5 ou fixtures', async () => {
  const w = await world({ logLevel: 'debug' });
  await pilotReady(w);
  const logs = JSON.stringify(w.mos.logger.entries);
  for (const bit of SECRET_BITS) assert.ok(!logs.includes(bit), `token "${bit}" vazou nos logs`);
  const board = JSON.stringify(w.live.connectionsBoard(w.company.id));
  for (const bit of SECRET_BITS) assert.ok(!board.includes(bit), 'board só mostra máscara');
  assert.match(board, /…/, 'credencial mascarada presente');
  for (const f of ['index.html', 'conexoes.js']) {
    const src = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v5', f), 'utf8');
    assert.ok(!/APP_USR-|client_secret|refresh_token/.test(src), `${f} sem segredo`);
  }
  const fixtures = fs.readFileSync(path.join(__dirname, '../src/central/fixtures/index.js'), 'utf8');
  assert.ok(!fixtures.includes('demo-secret'), 'fixtures da Central sem segredo do live');
  w.mos.close();
});

/* 5 — refresh concorrente usa lock (uma troca só) */
test('refresh concorrente compartilha a renovação', async () => {
  const w = await world();
  await pilotReady(w);
  const before = w.m.mlAuthHttp.refreshes;
  await Promise.all([
    w.central.credentials.refreshAccess(w.mlConn.id, 'mercado_livre'),
    w.central.credentials.refreshAccess(w.mlConn.id, 'mercado_livre')]);
  assert.equal(w.m.mlAuthHttp.refreshes - before, 1);
  w.mos.close();
});

/* 6 — conexões isoladas por empresa */
test('empresa B não vê conexão nem conta da empresa A', async () => {
  const w = await world();
  await pilotReady(w);
  const B = w.mos.services.workspace.bootstrap({ workspaceName: 'WB', email: 'b@b.b',
    companyName: 'B', marketplaces: ['mercado_livre'] });
  const boardB = w.live.connectionsBoard(B.company.id);
  const mlB = boardB.cards.find(c => c.id === 'mercado_livre');
  assert.notEqual(mlB.status, 'CONNECTED_READ_ONLY', 'B não herda conexão de A');
  assert.equal(mlB.account, null);
  assert.equal(mlB.credential.hasCredential, false);
  w.mos.close();
});

/* 7 — dados reais × demo claramente diferenciados */
test('fonte demo e fonte real são rotuladas de forma distinta', async () => {
  const w = await world();
  await pilotReady(w);
  const snap = w.mos.repos.categorySnapshot.db.get('SELECT * FROM category_snapshot LIMIT 1');
  assert.equal(snap.source, 'MOCK_OFFICIAL_FIXTURE', 'mock nunca se apresenta como OFFICIAL_API');
  const chat = createHeadChat({ clock: w.clock, companyId: w.company.id });
  assert.match(chat.ask('quanto vendi hoje?').reply, /Dados demonstrativos/);
  w.mos.close();
});

/* 8 — webhook WhatsApp: verificação, assinatura e dedup */
test('webhook: verify token, assinatura HMAC e deduplicação', async () => {
  const w = await world();
  const { live, company } = w;
  assert.equal(live.whatsapp.verifyWebhook({ 'hub.mode': 'subscribe',
    'hub.verify_token': 'ERRADO', 'hub.challenge': 'x' }, company.id).ok, false);
  assert.equal(live.whatsapp.verifyWebhook({ 'hub.mode': 'subscribe',
    'hub.verify_token': 'vt-1', 'hub.challenge': 'ch' }, company.id).challenge, 'ch');
  const body = { entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.1', from: '5511900000000', type: 'text', text: { body: 'oi' }, timestamp: '1782216000' }] } }] }] };
  const raw = JSON.stringify(body);
  const bad = await live.whatsapp.handleInbound(body, { rawBody: raw, signature: 'sha256=deadbeef', companyId: company.id });
  assert.equal(bad.ok, false, 'assinatura inválida rejeitada');
  const sig = 'sha256=' + require('node:crypto').createHmac('sha256', 'demo-secret').update(raw).digest('hex');
  const ok1 = await live.whatsapp.handleInbound(body, { rawBody: raw, signature: sig, companyId: company.id });
  const ok2 = await live.whatsapp.handleInbound(body, { rawBody: raw, signature: sig, companyId: company.id });
  assert.equal(ok1.results[0].duplicate, false);
  assert.equal(ok2.results[0].duplicate, true, 'mesma mensagem não duplica');
  assert.equal(w.mos.repos.waEvent.count(), 1);
  w.mos.close();
});

/* 9 + 10 — resposta: desligada por padrão; allowlist obrigatória */
test('WhatsApp não responde por padrão e respeita allowlist', async () => {
  const w = await world();
  const { live, company } = w;
  const msg = (id, from) => ({ entry: [{ changes: [{ value: { messages: [
    { id, from, type: 'text', text: { body: 'Quanto vendi hoje?' }, timestamp: '1782216000' }] } }] }] });
  const b1 = msg('wamid.a', '5511988887777');
  const r1 = await live.whatsapp.handleInbound(b1, { ...signed(b1), companyId: company.id });
  assert.equal(r1.results[0].replied, false, 'flag desligada → sem resposta');
  w.F('WHATSAPP_HEAD_PILOT_REPLY_ENABLED');
  const b2 = msg('wamid.b', '5511911112222');
  const r2 = await live.whatsapp.handleInbound(b2, { ...signed(b2), companyId: company.id });
  assert.equal(r2.results[0].replied, false, 'fora da allowlist → sem resposta');
  const b3 = msg('wamid.c', '5511988887777');
  const r3 = await live.whatsapp.handleInbound(b3, { ...signed(b3), companyId: company.id });
  assert.equal(r3.results[0].replied, true, 'admin em allowlist com flag → responde');
  w.mos.close();
});

/* 11 + 23 — READ_ONLY geral: conectores sem escrita nas 4 praças */
test('escrita geral segue bloqueada em TODAS as praças', async () => {
  const w = await world();
  for (const name of ['mercado_livre', 'shopee', 'tiktok', 'magalu']) {
    const conn = w.central.registry.connector(name);
    for (const a of WRITE_ACTIONS) assert.throws(() => conn[a]({}), ReadOnlyViolationError);
    assert.equal(DECLARATIONS[name].compliance.supportsExternalPublish, false);
  }
  w.mos.close();
});

/* 12–19 — os gates do piloto, um a um */
test('piloto: cada gate bloqueia individualmente', async () => {
  const w = await world();
  const { live, company, owner, mlConn } = w;
  const { draft } = await pilotReady(w);
  const dry = () => live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  const run = dry();
  assert.equal(run.stage, 'READY_FOR_PILOT');
  assert.equal(run.externalCall, false, 'Dry Run nunca chama API externa');

  const gate = async (over, rx) => {
    const r = await live.pilot.confirm(dry().runId, okConfirm(owner, over));
    assert.equal(r.created, false);
    assert.ok(r.gates.some(g => rx.test(g)), `esperava gate ${rx}: ${r.gates}`);
  };
  await gate({}, /FLAG|ENABLED/i);                                     // 12: sem flag
  w.F('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED');
  await gate({ userRole: 'viewer' }, /administrador/);                 // 13: não-admin
  await gate({ typedPhrase: 'criar anuncio piloto real' }, /confirmação textual/); // 19: frase exata
  await gate({ accountConfirmed: false }, /conta de destino/);         // conta
  await gate({ source: 'chat' }, /NUNCA dispara por Chat/);            // 20: canal proibido
  await gate({ source: 'whatsapp' }, /NUNCA dispara por Chat/);
  /* 14: sem OAuth — revoga e tenta */
  w.mos.repos.connection.update(mlConn.id, { status: 'revoked' });
  await gate({}, /OAuth real/);
  w.mos.repos.connection.update(mlConn.id, { status: 'connected' });
  w.mos.close();
});

/* 15 — categoria oficial confirmada é obrigatória (PROVISIONAL não basta) */
test('piloto sem snapshot oficial de categoria fica em DRY_RUN com issue', async () => {
  const w = await world();
  const { live, company, owner, mlConn, catalog, F } = w;
  F('MERCADO_LIVRE_OAUTH_ENABLED');
  const s = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  await live.oauth.callback({ code: 'c', state: s.state });
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const draft = catalog.createDraft(prd.id, 'mercado_livre');
  const run = live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  assert.equal(run.stage, 'DRY_RUN', 'não avança sem confirmação oficial');
  assert.ok(run.issues.some(i => /confirmação oficial|PROVISIONAL/.test(i)));
  w.mos.close();
});

/* 16 + 27 — draft precisa estar validado; UNKNOWN bloqueia */
test('draft com UNKNOWN/BLOCKER não passa do Dry Run', async () => {
  const w = await world();
  const { live, company, owner, mlConn, catalog, m } = w;
  await pilotReady(w);
  /* KIT3-ABS no ML tem UNKNOWN (GTIN não confirmado + sem EAN) */
  const kit = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'KIT3-ABS'));
  const draft = catalog.createDraft(kit.id, 'mercado_livre');
  await live.categoryConfirm.confirm({ companyId: company.id, connectionId: mlConn.id,
    categoryId: 'MLB1367', officialSource: m.categorySource });
  const run = live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  assert.equal(run.stage, 'DRY_RUN');
  assert.ok(run.issues.some(i => /UNKNOWN/.test(i)), 'UNKNOWN listado como pendência');
  assert.ok(run.issues.some(i => /READY_FOR_REVIEW/.test(i)), 'status do draft exigido');
  w.mos.close();
});

/* 17 — imagem aprovada por humano é obrigatória */
test('piloto exige criativo com revisão humana aprovada', async () => {
  const w = await world();
  const { live, company, owner, mlConn, catalog, m, F } = w;
  F('MERCADO_LIVRE_OAUTH_ENABLED');
  const s = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  await live.oauth.callback({ code: 'c', state: s.state });
  await live.categoryConfirm.confirm({ companyId: company.id, connectionId: mlConn.id,
    categoryId: 'MLB1367', officialSource: m.categorySource });
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const draft = catalog.createDraft(prd.id, 'mercado_livre');   // sem criativo vinculado
  const run = live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  assert.ok(run.issues.some(i => /revisão humana/.test(i)));
  w.mos.close();
});

/* 21 + 22 — idempotência e falha sem retry automático */
test('idempotência: um anúncio só; falha nunca gera retry automático', async () => {
  const w = await world();
  const { live, company, owner, mlConn, m } = w;
  const { draft } = await pilotReady(w);
  w.F('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED');
  const dry = () => live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  /* falha externa → FAILED, sem retry */
  m.pilotWriter.failNext = true;
  const fail = await live.pilot.confirm(dry().runId, okConfirm(owner));
  assert.equal(fail.failed, true);
  assert.equal(fail.retry, 'manual apenas');
  assert.equal(m.pilotWriter.calls, 0, 'nenhuma repetição automática');
  /* sucesso → CREATED; repetição do mesmo payload → bloqueada */
  const ok = await live.pilot.confirm(dry().runId, okConfirm(owner));
  assert.equal(ok.created, true);
  const dup = await live.pilot.confirm(dry().runId, okConfirm(owner));
  assert.equal(dup.created, false);
  assert.ok(dup.gates.some(g => /já criado|duplicação/.test(g)));
  assert.equal(m.pilotWriter.calls, 1, 'exatamente UMA escrita externa');
  w.mos.close();
});

/* 24 + 25 — Truth Pack: insuficiente bloqueia; suficiente é registrado */
test('criativo: sem Truth Pack suficiente não gera; com, registra tudo', async () => {
  const w = await world();
  const { live, company, catalog } = w;
  const esp = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'ESP-ORG'));
  const r = live.creative.createCreative({ productId: esp.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'MAIN_CLEAN' });
  assert.equal(r.status, 'INSUFFICIENT_PRODUCT_TRUTH');
  assert.match(r.message, /Não vou gerar uma imagem porque faltam dados/);
  assert.ok(r.missing.includes('material'));

  const qdr = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const ok = live.creative.createCreative({ productId: qdr.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'AMBIENT' });
  assert.ok(ok.truthPackId, 'Truth Pack registrado');
  const row = w.mos.repos.creativeAsset.byId(ok.id);
  assert.equal(row.truth_pack_id, ok.truthPackId);
  assert.ok(JSON.parse(row.briefing_json).mustPreserve.material, 'invariantes no briefing');
  const tp = w.mos.repos.truthPack.byId(ok.truthPackId);
  assert.ok(tp.assets_hash && tp.profile_hash, 'hashes do pack');
  w.mos.close();
});

/* 26 — divergência de fidelidade bloqueia aprovação */
test('divergência (cor/kit/moldura) bloqueia aprovação humana', async () => {
  const w = await world();
  const { live, company, owner, catalog, m, F } = w;
  F('CREATIVE_IMAGE_GENERATION_ENABLED');
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  m.imageProviders.get('mock-img').badMetadata = { material: 'plástico', kitQuantity: 3 };
  const cr = live.creative.createCreative({ productId: prd.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'MAIN_CLEAN' });
  const gen = await live.creative.generate(cr.id);
  const fid = JSON.parse(gen.fidelity_json);
  assert.ok(fid.divergences.length >= 1, 'divergência detectada');
  assert.throws(() => live.creative.humanReview(cr.id, { approved: true, reviewer: owner.id }),
    /aprovação bloqueada: divergência/);
  m.imageProviders.get('mock-img').badMetadata = null;
  w.mos.close();
});

/* 28 — imagem demo/pendente nunca é apresentada como gerada */
test('sem flag/provider: briefing pronto, fila pendente, NENHUMA imagem', async () => {
  const w = await world();
  const { live, company, catalog } = w;
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const r = live.creative.createCreative({ productId: prd.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'MAIN_CLEAN' });
  assert.equal(r.generation.queued, false);
  assert.match(r.generation.reason, /desligada|provider/);
  const row = w.mos.repos.creativeAsset.byId(r.id);
  assert.equal(row.image_url, null, 'nenhuma imagem fake');
  assert.equal(row.status, 'CREATIVE_DRAFT');
  w.mos.close();
});

/* 29 — WhatsApp usa a MESMA Query Layer do chat */
test('resposta do WhatsApp vem da Operational Query Layer (fonte + hora)', async () => {
  const w = await world();
  const { live, company } = w;
  w.F('WHATSAPP_HEAD_PILOT_REPLY_ENABLED');
  const bq = { entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.q', from: '5511988887777', type: 'text',
      text: { body: 'Quanto vendi hoje?' }, timestamp: '1782216000' }] } }] }] };
  await live.whatsapp.handleInbound(bq, { ...signed(bq), companyId: company.id });
  const reply = live.whatsapp.outbox[0].text;
  assert.match(reply, /R\$ 8\.420/, 'mesmo número da Query Layer');
  assert.match(reply, /Atualizado às/, 'hora presente');
  assert.match(reply, /Dados demonstrativos/, 'fonte presente');
  /* comando de ação → nunca executa, redireciona para Conexões */
  const bx = { entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.x', from: '5511988887777', type: 'text',
      text: { body: 'Cria esse anúncio no Mercado Livre' }, timestamp: '1782216060' }] } }] }] };
  await live.whatsapp.handleInbound(bx, { ...signed(bx), companyId: company.id });
  assert.match(live.whatsapp.outbox[1].text, /revisão e confirmação na área Conexões/);
  w.mos.close();
});

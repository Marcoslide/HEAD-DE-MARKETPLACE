/* Demo das CONEXÕES REAIS + PILOTO (Sprint 10.A).
   Uso: node mos/demo-live.js
   Determinística. Transportes MOCK claramente rotulados — nenhuma conta
   real é tocada. Mostra o caminho inteiro: flags → WhatsApp → OAuth →
   leitura → categoria oficial → criativo fiel → Dry Run → confirmação
   explícita → 1 anúncio piloto (mock) → idempotência. */
'use strict';
const { createMOS } = require('./src/index.js');
const { createCentral } = require('./src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('./src/central/fixtures/index.js');
const { CatalogService } = require('./src/catalog/catalog-service.js');
const { createLive } = require('./src/live/index.js');
const { createHeadChat } = require('./src/chat/index.js');
const C = require('./src/compliance/index.js');
const MIE = require('../mie/src/index.js');

const line = (n = 72) => '─'.repeat(n);
const clock = MIE.frozenClock('2026-07-04T12:00:00Z');

async function main() {
  const mos = createMOS();
  const central = createCentral({ mos, clock, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport() });
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'Fábrica de Quadros', email: 'dono@quadros.com.br',
    companyName: 'Quadros & Cia', marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'] });
  const owner = mos.repos.user.db.get('SELECT * FROM user LIMIT 1');
  const mlConn = connections.find(c => c.marketplace === 'mercado_livre');
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock, logger: mos.logger });

  /* transportes MOCK — rotulados; nunca conta real */
  const mlAuthHttp = {
    kind: 'mock', exchanges: 0,
    async exchangeCode(code) { this.exchanges++; return {
      accessToken: `APP_USR-ml-${code}-x9y8z7`, refreshToken: `TG-ml-${code}-r1s2t3`,
      expiresIn: 21600, tokenType: 'bearer' }; },
    async refresh() { return { accessToken: 'APP_USR-rotated-a1b2', refreshToken: 'TG-rotated-c3d4', expiresIn: 21600 }; },
    async identity() { return { sellerId: 123456789, nickname: 'QUADROSECIA' }; },
  };
  const categorySource = { kind: 'MOCK_OFFICIAL_FIXTURE',
    async get(id) { return {
      category: { id, path_from_root: [{ name: 'Casa, Móveis e Decoração' }, { name: 'Quadros' }] },
      attributes: [
        { id: 'material', tags: { required: true } },
        { id: 'largura_cm', tags: { required: true } },
        { id: 'altura_cm', tags: { required: true } },
        { id: 'estilo', tags: {} }],
      sourceUrl: `mock://categories/${id}`, apiVersion: 'mock-1' }; } };
  const pilotWriter = { calls: 0,
    async createItem(_c, payload) { this.calls++;
      return { id: 'MLB-PILOT-0001', permalink: 'https://mock.permalink/MLB-PILOT-0001', status: 'active', title: payload.title }; } };
  const imageProviders = new Map([['mock-img', {
    kind: 'mock', async generate(briefing) { return {
      imageUrl: 'generated://mock/main-clean.jpg', model: 'mock-diffusion-1',
      metadata: { ...briefing.mustPreserve } }; } }]]);

  const live = createLive({ mos, clock, credentials: central.credentials,
    orchestrator: central.orchestrator, catalog,
    chatFactory: cid => createHeadChat({ clock, companyId: cid }),
    config: { whatsapp: { verifyToken: 'demo-verify', appSecret: null,
                          phoneNumberId: '5511999990000', wabaId: 'waba-demo',
                          allowlist: '5511988887777' },
              mercadoLivre: { clientId: 'demo-client', clientSecret: 'demo-secret',
                              redirectUri: 'https://demo.local/oauth/ml/callback' },
              creative: { provider: 'mock-img', apiKey: 'demo' } },
    transports: { mlAuthHttp, categorySource, pilotWriter, imageProviders } });

  console.log('\n' + line());
  console.log('  CONEXÕES REAIS + PILOTO — transportes MOCK (nenhuma conta real)');
  console.log(line());

  /* 0. tudo desligado por padrão */
  console.log('\n  Flags (default):');
  for (const f of live.connectionsBoard(company.id).flags)
    console.log(`    ${f.enabled ? '●' : '○'} ${f.flag}`);

  /* 1. WhatsApp oficial: verificação + inbound + piloto de resposta */
  live.flags.set('WHATSAPP_INBOUND_ENABLED', { companyId: company.id }, true);
  live.flags.set('WHATSAPP_HEAD_PILOT_REPLY_ENABLED', { companyId: company.id }, true);
  const v = live.whatsapp.verifyWebhook({ 'hub.mode': 'subscribe',
    'hub.verify_token': 'demo-verify', 'hub.challenge': 'ch-123' }, company.id);
  console.log(`\n  WhatsApp: webhook verificado=${v.ok} (challenge devolvido)`);
  const inbound = await live.whatsapp.handleInbound({ entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.demo1', from: '5511988887777', type: 'text',
      text: { body: 'Quanto vendi hoje?' }, timestamp: '1782216000' }] } }] }] },
    { companyId: company.id });
  console.log(`  Mensagem recebida → dedup ok=${!inbound.results[0].duplicate} · respondida=${inbound.results[0].replied}`);
  console.log(`  Resposta (mesma Query Layer): "${live.whatsapp.outbox[0].text.split('\n')[0]}…"`);
  const cmd = await live.whatsapp.handleInbound({ entry: [{ changes: [{ value: { messages: [
    { id: 'wamid.demo2', from: '5511988887777', type: 'text',
      text: { body: 'Cria esse anúncio no Mercado Livre' }, timestamp: '1782216060' }] } }] }] },
    { companyId: company.id });
  console.log(`  Comando de ação → "${live.whatsapp.outbox[1].text.slice(0, 88)}…"`);

  /* 2. OAuth real do Mercado Livre (mock de troca) */
  live.flags.set('MERCADO_LIVRE_OAUTH_ENABLED', { companyId: company.id }, true);
  live.flags.set('MERCADO_LIVRE_LIVE_READ_ENABLED', { companyId: company.id }, true);
  const startd = live.oauth.start({ companyId: company.id, userId: owner.id, connectionId: mlConn.id });
  console.log('\n' + line());
  console.log(`  OAuth ML: state único gerado · URL oficial: ${startd.authorizationUrl.slice(0, 64)}…`);
  const cb = await live.oauth.callback({ code: 'demo-code', state: startd.state });
  console.log(`  Callback: conectado=${cb.connected} · seller ${cb.sellerId} (${cb.nickname}) · READ_ONLY=${cb.readOnly}`);
  await central.orchestrator.onIdle();
  const board1 = live.connectionsBoard(company.id).cards.find(c => c.id === 'mercado_livre');
  console.log(`  Card ML: ${board1.status} · token ${board1.credential.tokenMasked} · último sync ${board1.lastSyncAt}`);

  /* 3. categoria OFICIAL confirmada (trava dos PROVISIONAL) */
  const conf = await live.categoryConfirm.confirm({ companyId: company.id,
    connectionId: mlConn.id, categoryId: 'MLB1367', officialSource: categorySource });
  console.log('\n' + line());
  console.log(`  Categoria MLB1367: ${conf.status} · fonte ${conf.source} · obrigatórios: ${conf.requiredAttributes.join(', ')}`);

  /* 4. produto + draft + criativo fiel */
  const prd = catalog.upsertMaster(company.id, C.DEMO_PRODUCTS.find(p => p.master.sku === 'QDR-SER'));
  const draft = catalog.createDraft(prd.id, 'mercado_livre');
  console.log(`  Draft: ${draft.id} → ${draft.status}`);
  live.flags.set('CREATIVE_IMAGE_GENERATION_ENABLED', { companyId: company.id }, true);
  const cr = live.creative.createCreative({ productId: prd.id, companyId: company.id,
    platform: 'mercado_livre', creativeType: 'MAIN_CLEAN' });
  const gen = await live.creative.generate(cr.id);
  console.log(`  Criativo: Truth Pack ${cr.truthPackId} · gerado por ${gen.provider}/${gen.model} → ${gen.status}`);
  console.log(`  Fidelidade: ${JSON.parse(gen.fidelity_json).verdict}`);
  live.creative.humanReview(cr.id, { approved: true, reviewer: owner.id, note: 'fiel ao produto' });
  live.creative.attachToDraft(cr.id, draft.id);
  console.log('  Revisão humana: APROVADO e vinculado ao draft');

  /* 5. DRY RUN → confirmação explícita → anúncio piloto */
  const dry = live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  console.log('\n' + line());
  console.log(`  DRY RUN: ${dry.stage} · issues: ${dry.issues.length ? dry.issues.join(' | ') : 'nenhuma'} · hash ${dry.payloadHash.slice(0, 10)}… · chamada externa: ${dry.externalCall}`);

  const wrongPhrase = await live.pilot.confirm(dry.runId, { userId: owner.id, userRole: 'owner',
    typedPhrase: 'criar anuncio', accountConfirmed: true });
  console.log(`  Frase errada → bloqueado (${wrongPhrase.gates.length} gate)`);
  const viaWhats = await live.pilot.confirm(dry.runId, { userId: owner.id, userRole: 'owner',
    typedPhrase: 'CRIAR ANÚNCIO PILOTO REAL', accountConfirmed: true, source: 'whatsapp' });
  console.log(`  Via WhatsApp → bloqueado (${viaWhats.gates[0].slice(0, 60)}…)`);
  const noFlag = await live.pilot.confirm(dry.runId, { userId: owner.id, userRole: 'owner',
    typedPhrase: 'CRIAR ANÚNCIO PILOTO REAL', accountConfirmed: true });
  console.log(`  Sem flag → bloqueado (${noFlag.gates[0].slice(0, 60)}…)`);

  live.flags.set('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED',
    { companyId: company.id, accountId: '123456789', userId: owner.id }, true);
  const created = await live.pilot.confirm(dry.runId, { userId: owner.id, userRole: 'owner',
    typedPhrase: 'CRIAR ANÚNCIO PILOTO REAL', accountConfirmed: true });
  console.log(`\n  ✓ ANÚNCIO PILOTO CRIADO (mock): ${created.externalListingId} · ${created.permalink}`);

  /* idempotência: mesmo draft+conta+hash nunca cria dois */
  const dry2 = live.pilot.dryRun({ companyId: company.id, userId: owner.id,
    connectionId: mlConn.id, draftId: draft.id });
  const dup = await live.pilot.confirm(dry2.runId, { userId: owner.id, userRole: 'owner',
    typedPhrase: 'CRIAR ANÚNCIO PILOTO REAL', accountConfirmed: true });
  console.log(`  Segunda tentativa (mesmo payload) → bloqueada: ${dup.gates[0].slice(0, 76)}…`);
  console.log(`  Chamadas de escrita no writer: ${pilotWriter.calls} (exatamente uma)`);

  console.log('\n' + line());
  const board = live.connectionsBoard(company.id);
  console.log('  CONEXÕES (cards):');
  for (const c of board.cards)
    console.log(`    • ${c.name.padEnd(20)} ${c.status}${c.account ? ` · conta ${c.account}` : ''}${c.lastSyncAt ? ` · sync ${c.lastSyncAt}` : ''}`);
  console.log(line() + '\n');
  mos.close();
}

main().catch(e => { console.error(e); process.exit(1); });

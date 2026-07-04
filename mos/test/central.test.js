/* SPRINT 09 — CENTRAL DE MARKETPLACE: os testes obrigatórios.
   Uma Central única: conector oficial autenticado → normalização →
   eventos idempotentes → sinais → EPE → Plano do Dia. READ_ONLY é lei. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createApi } = require('../src/interfaces/http/api.js');
const { createCentral, MarketplaceConnector, CapabilityError, ReadOnlyViolationError, WRITE_ACTIONS } =
  require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport, FIXTURES, OPERATION } = require('../src/central/fixtures/index.js');
const { NORMALIZERS } = require('../src/central/normalizers.js');
const { mappers: mlMappers } = require('../src/central/connectors/mercado-livre.js');
const { mappers: shpMappers } = require('../src/central/connectors/shopee.js');
const { mappers: ttkMappers } = require('../src/central/connectors/tiktok-shop.js');
const { mappers: mglMappers } = require('../src/central/connectors/magalu.js');
const MIE = require('../../mie/src/index.js');

const FROZEN_ISO = '2026-07-04T12:00:00.000Z';

/* monta o mundo: MOS + MIE + Central com fixtures, empresa com N praças */
async function world({ marketplaces = ['mercado_livre', 'shopee', 'tiktok', 'magalu'],
                       transportOpts = {}, connect = true, logLevel = 'warn' } = {}) {
  const clock = MIE.frozenClock('2026-07-04T12:00:00Z');
  const mos = createMOS({ logLevel });
  const mie = MIE.createMIE({ seed: 42, clock });
  const transport = new FixtureTransport(transportOpts);
  const authTransport = new MockAuthTransport();
  const central = createCentral({ mos, clock, transport, authTransport, operation: OPERATION });
  central.attachMIE(mie);
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: `t${Math.abs(hash(marketplaces.join()))}@x.y`, companyName: 'Quadros & Cia',
    marketplaces });
  if (connect)
    for (const c of connections) await central.connections.connectMock(c.id).catch(() => {});
  await central.orchestrator.onIdle();
  return { mos, mie, central, company, connections, clock, transport, authTransport };
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/* 1 — o que existia continua funcionando: publicação simulada do ML intacta */
test('Mercado Livre e Shopee existentes continuam funcionando (publicação intocada)', async () => {
  const { mos, company, connections } = await world({ marketplaces: ['mercado_livre'] });
  const product = mos.services.catalog.createProduct(company.id, { name: 'Quadro Novo' });
  const { ids } = mos.services.catalog.importListings(company.id, connections[0].id,
    [{ productId: product.id, title: 'Quadro Novo Sala 60x90', price: 120 }]);
  const prep = mos.services.publication.prepare(ids[0], {});
  assert.equal(prep.ok, true, 'pipeline de publicação simulada segue de pé');
  assert.equal(prep.preview.marketplace, 'mercado_livre');
  mos.close();
});

/* 2 — novo marketplace entra pelo Registry sem alterar o núcleo */
test('novo marketplace registrável sem tocar o núcleo da Central', async () => {
  const { mos, central, clock } = await world({ marketplaces: ['shopee'] });
  const decl = {
    id: 'americanas_test', displayName: 'Americanas (teste)', countryScope: ['BR'],
    integrationStatus: 'INTEGRATION_READY', authType: 'OAUTH2',
    supportsPolling: true, supportsWebhooks: false,
    capabilities: { listingsRead: true, listingsWrite: false, inventoryWrite: false, pricesWrite: false, adsWrite: false },
  };
  const transport = new FixtureTransport({ data: { americanas_test: {
    listings: [{ id: 'AME-1', title: 'Quadro AME', price: 99, status: 'active',
                 available_quantity: 5, sold_quantity: 2, last_updated: '2026-07-01T00:00:00.000Z' }] } } });
  const connector = new MarketplaceConnector(decl, { transport, clock, mappers: mlMappers });
  central.registry.registerConnector(connector);
  assert.ok(central.registry.hasConnector('americanas_test'));
  assert.deepEqual(central.registry.describe('americanas_test').capabilities, decl.capabilities);
  const raw = await central.registry.connector('americanas_test').fetchListings({});
  assert.equal(raw.length, 1, 'conector novo lê pelas mesmas engrenagens');
  mos.close();
});

/* 3 — capability inexistente bloqueia com erro claro */
test('capability inexistente → CapabilityError com mensagem clara', async () => {
  const { mos, central } = await world({ marketplaces: ['magalu'] });
  const magalu = central.registry.connector('magalu');
  await assert.rejects(() => magalu.fetchMetrics({}), CapabilityError);
  await assert.rejects(() => magalu.fetchAds({}), /magalu não suporta "adsRead"/);
  mos.close();
});

/* 4 + 20 — READ_ONLY tecnicamente garantido em TODOS os conectores */
test('READ_ONLY: toda operação de escrita falha em todos os conectores', async () => {
  const { mos, central } = await world({});
  for (const name of ['mercado_livre', 'shopee', 'tiktok', 'magalu']) {
    const c = central.registry.connector(name);
    assert.equal(c.readOnly, true);
    const caps = central.registry.describe(name).capabilities;
    for (const k of ['listingsWrite', 'inventoryWrite', 'pricesWrite', 'adsWrite'])
      assert.equal(caps[k], false, `${name}.${k} deve ser false`);
    for (const action of WRITE_ACTIONS)
      assert.throws(() => c[action]({}), ReadOnlyViolationError, `${name}.${action} deve ser bloqueado`);
  }
  assert.equal(central.readOnly, true);
  mos.close();
});

/* 5 + 6 — quatro praças, UMA entidade canônica (mesma forma) */
test('ML, Shopee, TikTok e Magalu normalizam para a MESMA entidade canônica', () => {
  const clock = MIE.frozenClock('2026-07-04T12:00:00Z');
  const ctx = { companyId: 'cmp1', platform: 'x', accountId: 'a', storeId: 's' };
  const shapes = [
    NORMALIZERS.listings({ listing: mlMappers.listing }, FIXTURES.mercado_livre.listings[0], ctx, clock),
    NORMALIZERS.listings({ listing: shpMappers.listing }, FIXTURES.shopee.listings[0], ctx, clock),
    NORMALIZERS.listings({ listing: ttkMappers.listing }, FIXTURES.tiktok.listings[0], ctx, clock),
    NORMALIZERS.listings({ listing: mglMappers.listing }, FIXTURES.magalu.listings[0], ctx, clock),
  ].map(e => Object.keys(e).sort().join(','));
  assert.equal(new Set(shapes).size, 1, 'as quatro praças produzem exatamente as mesmas chaves');
  const order = NORMALIZERS.orders({ order: shpMappers.order }, FIXTURES.shopee.orders[0], ctx, clock);
  assert.equal(order.entityType, 'MARKETPLACE_ORDER');
  assert.ok(order.occurredAt && order.observedAt && order.synchronizedAt, 'proveniência temporal completa');
});

/* 7 — evento duplicado não gera nada duplicado */
test('idempotência: o mesmo evento duas vezes → um só registro, um só sinal', async () => {
  const { mos, mie, central, company } = await world({ marketplaces: ['shopee', 'mercado_livre'] });
  const evt = { companyId: company.id, platform: 'shopee', accountId: 'acc-shopee-1',
    eventType: 'ORDER_OBSERVED', entityType: 'MARKETPLACE_ORDER', entityId: 'DUP-1',
    occurredAt: '2026-07-01T00:00:00.000Z', payload: { total: 10 } };
  const a = central.events.publish(evt);
  const b = central.events.publish(evt);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(a.id, b.id, 'mesma chave de idempotência');
  /* sinais: refresh duas vezes → EPE recebe uma vez */
  central.orchestrator.refreshSignals(company.id);
  const n = mie.epe.externalSignals.length;
  central.orchestrator.refreshSignals(company.id);
  assert.equal(mie.epe.externalSignals.length, n, 'sinal repetido não duplica no EPE');
  const plan = mie.planDay();
  const titles = [...plan.decisions, ...plan.missions].map(d => d.title);
  assert.equal(new Set(titles).size, titles.length, 'nenhum alerta duplicado no Plano do Dia');
  mos.close();
});

/* 8 — watermark evita reprocessamento */
test('watermark: segundo sync ignora tudo que já foi visto', async () => {
  const { mos, central, connections } = await world({ marketplaces: ['shopee'] });
  const first = mos.repos.syncState.byConnectionResource(connections[0].id, 'listings');
  assert.ok(first.watermark, 'watermark gravado no primeiro sync');
  assert.ok(first.records_created > 0);
  central.orchestrator.syncConnection(connections[0].id, ['listings']);
  await central.orchestrator.onIdle();
  const second = mos.repos.syncState.byConnectionResource(connections[0].id, 'listings');
  assert.equal(second.records_created, 0, 'nada recriado');
  assert.equal(second.records_ignored, second.records_read, 'tudo ignorado pelo watermark');
  mos.close();
});

/* 9 — Clock congelado → sincronização determinística */
test('Clock congelado torna a sincronização determinística', async () => {
  const { mos } = await world({ marketplaces: ['mercado_livre'] });
  const rows = mos.repos.morder.db.all('SELECT synchronized_at, observed_at FROM marketplace_order');
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.synchronized_at, FROZEN_ISO);
    assert.equal(r.observed_at, FROZEN_ISO);
  }
  const logs = mos.repos.syncLog.db.all('SELECT started_at, finished_at FROM marketplace_sync_log');
  for (const l of logs) assert.equal(l.started_at, FROZEN_ISO);
  mos.close();
});

/* 10 — evento sem observedAt recebe o Clock injetado */
test('evento sem observedAt é carimbado pelo Clock', async () => {
  const { mos, central, company } = await world({ marketplaces: ['shopee'] });
  const { id } = central.events.publish({ companyId: company.id, platform: 'shopee',
    eventType: 'TEST_EVENT', entityType: 'MARKETPLACE_LISTING', entityId: 'T-1',
    occurredAt: '2026-07-01T00:00:00.000Z' });
  const row = mos.repos.integrationEvent.byId(id);
  assert.equal(row.observed_at, FROZEN_ISO);
  assert.equal(row.occurred_at, '2026-07-01T00:00:00.000Z', 'occurredAt da praça preservado');
  mos.close();
});

/* 11 — falha de uma plataforma não derruba as demais */
test('falha da Shopee não derruba o Mercado Livre', async () => {
  const { mos } = await world({ marketplaces: ['mercado_livre', 'shopee'],
    transportOpts: { failPlatforms: ['shopee'] } });
  const states = mos.repos.syncState.db.all('SELECT platform, resource, status FROM marketplace_sync_state');
  const ml = states.filter(s => s.platform === 'mercado_livre');
  const shp = states.filter(s => s.platform === 'shopee');
  assert.ok(ml.length > 0 && ml.every(s => s.status === 'ok'), 'ML sincronizou normalmente');
  assert.ok(shp.length > 0 && shp.every(s => s.status === 'error'), 'Shopee registrou o erro');
  assert.ok(mos.repos.morder.db.get(`SELECT count(*) n FROM marketplace_order WHERE platform='mercado_livre'`).n > 0);
  mos.close();
});

/* 12 — retry respeita rate limit (429 → backoff da fila → sucesso) */
test('rate limit vira retry com backoff e o sync conclui', async () => {
  const { mos } = await world({ marketplaces: ['mercado_livre'],
    transportOpts: { rateLimitOnce: ['mercado_livre'] } });
  const states = mos.repos.syncState.db.all(`SELECT status FROM marketplace_sync_state WHERE platform='mercado_livre'`);
  assert.ok(states.every(s => s.status === 'ok'), 'todos os recursos concluíram após o retry');
  const logs = mos.repos.syncLog.db.all(`SELECT status FROM marketplace_sync_log WHERE platform='mercado_livre'`);
  assert.ok(logs.some(l => l.status === 'error'), 'a tentativa limitada ficou registrada');
  assert.ok(logs.some(l => l.status === 'ok'), 'e o retry venceu');
  mos.close();
});

/* 13 — tokens NUNCA aparecem em logs */
test('token em claro não aparece em nenhum log', async () => {
  const { mos, central, connections, authTransport } = await world({ logLevel: 'debug' });
  await central.credentials.refreshAccess(connections[0].id, 'mercado_livre');
  const secretParts = ['a1b2c3d4e5f6', 'f6e5d4c3b2a1', '9z8y7x6w'];    // miolos dos tokens mock
  const allLogs = JSON.stringify(mos.logger.entries);
  for (const s of secretParts)
    assert.ok(!allLogs.includes(s), `fragmento de token "${s}" vazou para os logs`);
  assert.ok(authTransport.exchanges >= 4, 'houve trocas OAuth reais (mock) no fluxo');
  /* e o banco só guarda cifrado */
  const cred = mos.repos.credential.db.get('SELECT access_token_enc FROM marketplace_credential LIMIT 1');
  assert.ok(!cred.access_token_enc.includes('APP_USR'), 'token no banco está cifrado');
  mos.close();
});

/* 13b — renovação concorrente tem lock: duas chamadas → UMA troca */
test('refresh concorrente compartilha a mesma renovação (lock single-flight)', async () => {
  const { mos, central, connections, authTransport } = await world({ marketplaces: ['shopee'] });
  const before = authTransport.refreshes;
  const [a, b] = await Promise.all([
    central.credentials.refreshAccess(connections[0].id, 'shopee'),
    central.credentials.refreshAccess(connections[0].id, 'shopee'),
  ]);
  assert.equal(authTransport.refreshes, before + 1, 'uma única troca no marketplace');
  assert.equal(a.tokenMasked, b.tokenMasked);
  mos.close();
});

/* 14 — isolamento: empresa A nunca vê dados da empresa B */
test('isolamento por empresa: dados e sinais não vazam entre empresas', async () => {
  const clock = MIE.frozenClock('2026-07-04T12:00:00Z');
  const mos = createMOS();
  const central = createCentral({ mos, clock, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport(), operation: OPERATION });
  const A = mos.services.workspace.bootstrap({ workspaceName: 'WA', email: 'a@a.a',
    companyName: 'Empresa A', marketplaces: ['shopee'] });
  const B = mos.services.workspace.bootstrap({ workspaceName: 'WB', email: 'b@b.b',
    companyName: 'Empresa B', marketplaces: ['mercado_livre'] });
  for (const c of [...A.connections, ...B.connections]) await central.connections.connectMock(c.id);
  await central.orchestrator.onIdle();

  const ordersA = mos.repos.morder.ofCompany(A.company.id);
  const ordersB = mos.repos.morder.ofCompany(B.company.id);
  assert.ok(ordersA.length > 0 && ordersB.length > 0);
  assert.ok(ordersA.every(o => o.company_id === A.company.id && o.platform === 'shopee'));
  assert.ok(ordersB.every(o => o.company_id === B.company.id && o.platform === 'mercado_livre'));
  const signalsA = central.orchestrator.refreshSignals(A.company.id).delivered;
  assert.ok(signalsA.every(s => s.provenance.platform === 'shopee'),
    'sinais da empresa A só citam dados da empresa A');
  const eventsA = mos.repos.integrationEvent.ofCompany(A.company.id);
  assert.ok(eventsA.every(e => e.company_id === A.company.id));
  mos.close();
});

/* 15 — payload bruto NÃO chega ao EPE (bloqueio técnico) */
test('EPE rejeita payload bruto e só carrega sinais normalizados', async () => {
  const { mos, mie, central, company } = await world({});
  assert.throws(() => mie.epe.addExternalSignal({ title: 'x', payload: { raw: true } }),
    /não aceita payload bruto/);
  assert.throws(() => mie.epe.addExternalSignal({ title: 'x', raw: '<json da api>' }),
    /não aceita payload bruto/);
  central.orchestrator.refreshSignals(company.id);
  assert.ok(mie.epe.externalSignals.length > 0);
  for (const s of mie.epe.externalSignals)
    for (const k of ['payload', 'raw', 'rawPayload', 'response', 'body'])
      assert.ok(!(k in s), `sinal no EPE não pode ter campo "${k}"`);
  mos.close();
});

/* 16 — sinal rastreável até plataforma, conta, entidade e evento original */
test('rastreabilidade: do Plano do Dia até o evento e o payload bruto', async () => {
  const { mos, mie, central, company } = await world({});
  central.orchestrator.refreshSignals(company.id);
  mie.runDays(MIE.WARMUP_DAYS + 2);
  const plan = mie.planDay();
  const traced = [...plan.decisions, ...plan.missions].filter(d => d.provenance);
  assert.ok(traced.length > 0, 'itens do plano carregam proveniência');
  for (const d of traced) {
    assert.ok(d.provenance.platform, 'plataforma');
    assert.ok(d.provenance.eventId, 'evento original');
    const evt = mos.repos.integrationEvent.maybeById(d.provenance.eventId);
    assert.ok(evt, 'o evento existe no banco');
    assert.equal(evt.company_id, company.id);
    assert.equal(evt.event_type, 'SIGNAL_RAISED');
  }
  /* e o dado que motivou o sinal aponta para o payload bruto preservado */
  const anyOrder = mos.repos.morder.ofCompany(company.id)[0];
  assert.ok(mos.repos.rawPayload.maybeById(anyOrder.raw_reference), 'pedido → raw payload auditável');
  mos.close();
});

/* 17 — /__dev/central mostra status, última sync, capabilities e READ_ONLY */
test('/__dev/central: saúde dos conectores visível (e sync-mock só com fixtures)', async () => {
  const w = await world({});
  w.central.orchestrator.refreshSignals(w.company.id);
  const server = await createApi(w.mos, { dev: true, mie: w.mie, central: w.central }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const dev = await fetch(`${base}/__dev/central`).then(r => r.json());
  assert.equal(dev.readOnly, true);
  assert.equal(dev.transport.kind, 'fixture');
  assert.equal(dev.platforms.length, 4);
  assert.ok(dev.connections.every(c => c.credential.tokenMasked == null || c.credential.tokenMasked.includes('…')),
    'credencial só aparece mascarada');
  assert.ok(dev.syncStates.length > 0 && dev.syncStates.every(s => s.lastSuccessAt && s.lagMs != null),
    'última sincronização e lag visíveis');
  assert.ok(dev.signalsToEPE.signals > 0, 'sinais entregues ao EPE contados');
  assert.equal(dev.clock.kind, 'frozen');
  const mock = await fetch(`${base}/__dev/central/sync-mock`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.json());
  assert.equal(mock.ok, true);
  assert.equal(mock.transport, 'fixture');
  server.close(); w.mos.close();
});

/* 18 — pesquisa pública separada da integração autenticada */
test('pesquisa pública: rastreável, sem token, fonte separada', async () => {
  const { mos, central, company } = await world({ marketplaces: ['shopee'] });
  const row = central.research.record(company.id, {
    sourceUrl: 'https://shopee.com.br/concorrente-quadro-abstrato',
    platform: 'shopee', subject: 'concorrente direto do KIT3-ABS',
    findings: { price: 119.90, rating: 4.7 }, confidence: 0.7,
  });
  assert.equal(row.source_type, 'PUBLIC_RESEARCH');
  assert.equal(row.observed_at, FROZEN_ISO, 'observedAt do Clock');
  assert.ok(row.source_url.startsWith('https://'), 'evidência rastreável por URL');
  /* separação POR CONSTRUÇÃO: o módulo nem conhece credenciais */
  assert.ok(!('credentials' in central.research), 'PublicResearch não tem acesso a credenciais');
  const src = fs.readFileSync(path.join(__dirname, '../src/central/public-research.js'), 'utf8');
  assert.ok(!/credential|token/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'nenhuma referência a token/credencial no código da pesquisa pública');
  mos.close();
});

/* 19 — nenhum Collector complexo/scraping/navegador neste sprint + Clock puro */
test('sem scraping/navegador na Central; tempo só via Clock injetado', () => {
  const dir = path.join(__dirname, '../src/central');
  const offendersScrape = [], offendersDate = [];
  const scan = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      /* só CÓDIGO conta — comentários podem citar as proibições */
      const src = fs.readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/playwright|puppeteer|selenium|headless|stealth|scrap/i.test(src))
        offendersScrape.push(entry.name);
      if (/new\s+Date\s*\(\s*\)|Date\.now\s*\(/.test(src))
        offendersDate.push(entry.name);
    }
  };
  scan(dir);
  assert.deepEqual(offendersScrape, [], 'nenhuma automação de navegador/scraping');
  assert.deepEqual(offendersDate, [], 'nenhuma fonte de tempo fora do Clock');
});

/* 21 — os quatro canais têm fixtures alimentando sinais */
test('fixtures das 4 praças alimentam sinais do EPE', async () => {
  const { mos, central, company } = await world({});
  const { delivered } = central.orchestrator.refreshSignals(company.id);
  const touched = new Set();
  for (const s of delivered) {
    touched.add(s.provenance.platform);
    if (s.evidence && s.evidence.missingPlatform) touched.add(s.evidence.missingPlatform);
    if (s.evidence && s.evidence.platformBest) touched.add(s.evidence.platformBest);
  }
  for (const p of ['mercado_livre', 'shopee', 'tiktok', 'magalu'])
    assert.ok(touched.has(p), `a praça ${p} participa dos sinais`);
  /* e o cenário do sprint está inteiro: os 6 playbooks dispararam */
  const playbooks = new Set(delivered.map(s => s.playbook));
  for (const pb of ['estoque-critico-campeao', 'margem-melhor-em-outro-canal',
                    'campeao-ausente-no-canal', 'potencial-tiktok',
                    'capacidade-personalizados', 'pedido-perto-de-atrasar'])
    assert.ok(playbooks.has(pb), `playbook ${pb} disparou com as fixtures`);
  mos.close();
});

/* 4b — "execução automática" de sinal da Central é SEMPRE interna ao Head:
   nenhuma chamada externa de escrita existe em todo o fluxo */
test('execuções de sinais da Central são INTERNAL_ONLY — zero escrita externa', async () => {
  const { mos, mie, central, company, transport } = await world({});
  central.orchestrator.refreshSignals(company.id);
  mie.runDays(MIE.WARMUP_DAYS + 2);
  const plan = mie.planDay();

  /* todo item vindo da Central carrega o escopo interno */
  const fromCentral = [...plan.decisions, ...plan.missions, ...plan.investigations]
    .filter(x => x.provenance);
  assert.ok(fromCentral.length > 0);
  for (const item of fromCentral)
    assert.equal(item.executionScope, 'INTERNAL_ONLY',
      `"${item.title}" deve ser execução interna do Head (READ_ONLY absoluto)`);

  /* o transporte só tem superfície de LEITURA — não existe método de escrita */
  const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(transport))
    .concat(Object.keys(transport));
  for (const m of surface)
    assert.ok(!/publish|update|create|cancel|pause|delete|write|post|put/i.test(m),
      `transporte não pode ter método de escrita: ${m}`);
  /* e todas as chamadas feitas foram recursos de leitura */
  const READ = new Set(['listings', 'orders', 'inventory', 'prices', 'metrics',
                        'logistics', 'returns', 'ads', 'finance']);
  assert.ok(transport.calls.length > 0);
  for (const c of transport.calls)
    assert.ok(READ.has(c.resource), `chamada não-leitura detectada: ${c.resource}`);
  mos.close();
});

/* extra — startConnect não finge integração de TikTok/Magalu */
test('TikTok/Magalu: conexão REAL bloqueada até validar credenciais oficiais', async () => {
  const { mos, central, connections } = await world({ marketplaces: ['tiktok', 'magalu'], connect: false });
  assert.throws(() => central.connections.startConnect(connections[0].id), /WAITING_PARTNER_APPROVAL/);
  assert.throws(() => central.connections.startConnect(connections[1].id), /WAITING_CREDENTIALS/);
  mos.close();
});

/* SPRINT 10.B — CRESCIMENTO: WhatsApp controle remoto, leads, afiliados,
   promoções e regras estruturais. Os 15 testes obrigatórios + estruturais.
   Nenhuma escrita externa acontece em lugar nenhum deste arquivo. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createMOS } = require('../src/index.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('../src/central/fixtures/index.js');
const { ReadOnlyViolationError } = require('../src/central/connector-contract.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { createLive } = require('../src/live/index.js');
const { createGrowth, PermissionError, ExternalWriteError } = require('../src/growth/index.js');
const { createHeadChat } = require('../src/chat/index.js');
const HG = require('../src/growth/demo-growth.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
const ADMIN_PHONE = '5511988887777';
const signed = body => { const raw = JSON.stringify(body); return { rawBody: raw,
  signature: 'sha256=' + crypto.createHmac('sha256', 'demo-secret').update(raw).digest('hex') }; };
const inboundMsg = (id, text, from = ADMIN_PHONE) => ({ entry: [{ changes: [{ value: {
  messages: [{ id, from, type: 'text', text: { body: text }, timestamp: '1782000000' }] } }] }] });

function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport() });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'g@x.y', companyName: 'C',
    marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'] });
  const owner = mos.repos.user.db.get('SELECT * FROM user LIMIT 1');
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  const growth = createGrowth({ mos, clock: c, catalog });
  growth.margin.ensureFeeProfiles(company.id);
  /* produtos reais do S10 na empresa do teste */
  const products = {};
  for (const dp of C.DEMO_PRODUCTS)
    products[dp.master.sku] = catalog.upsertMaster(company.id, dp);
  return { mos, c, company, owner, catalog, growth, products };
}

function withWhatsApp(w) {
  const { mos, c, company, catalog, growth } = w;
  const central2 = { credentials: null, orchestrator: null };
  const live = createLive({ mos, clock: c,
    credentials: { load: () => null, maskedStatus: () => ({ hasCredential: false }) },
    orchestrator: central2.orchestrator, catalog,
    chatFactory: cid => createHeadChat({ clock: c, companyId: cid,
      growth: HG.createGrowthAdapter(HG.createDemoGrowthDataset(c), c) }),
    config: { whatsapp: { verifyToken: 'vt', appSecret: 'demo-secret',
      phoneNumberId: 'pn', wabaId: 'wb', allowlist: ADMIN_PHONE } },
    transports: { commandGateway: growth.gateway } });
  live.flags.set('WHATSAPP_INBOUND_ENABLED', { companyId: company.id }, true);
  live.flags.set('WHATSAPP_HEAD_PILOT_REPLY_ENABLED', { companyId: company.id }, true);
  return live;
}

/* 1 — comando WhatsApp e ação visual usam o MESMO serviço de adaptação */
test('WhatsApp e dashboard usam o mesmo Adaptation Engine (nenhuma automação paralela)', async () => {
  const w = world();
  const { growth, company, owner } = w;
  /* caminho VISUAL (dashboard) */
  const planUi = growth.adaptation.plan({ companyId: company.id,
    targetPlatform: 'shopee', filters: { skus: ['QDR-NOME'] } });
  const { job: jobUi } = growth.adaptation.requestExecution({
    companyId: company.id, userId: owner.id, origin: 'DASHBOARD_MANUAL', plan: planUi });
  await growth.adaptation.execute(jobUi.id, { userId: owner.id });
  /* caminho WHATSAPP (gateway) — mesmo engine, mesma instância */
  const before = growth.adaptation.executions;
  const r1 = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'Cria drafts shopee dos produtos com margem acima de 10%' });
  assert.ok(r1.awaitingConfirmation, 'em massa pede confirmação');
  const r2 = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE, text: 'SIM' });
  assert.ok(r2.executed);
  assert.equal(growth.adaptation.executions, before + 1, 'gateway passou pelo MESMO engine');
  /* os dois caminhos geraram jobs do MESMO kind e drafts na MESMA tabela */
  const jobs = w.mos.repos.job.db.all(
    `SELECT * FROM internal_job WHERE kind = 'adaptation.create_drafts' AND status = 'DONE'`);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map(j => j.origin).sort(), ['DASHBOARD_MANUAL', 'WHATSAPP_COMMAND']);
});

/* 2 — origem da ação registrada corretamente (e origem inválida recusada) */
test('origem da ação é registrada e validada em todo job', () => {
  const w = world();
  const { growth, company } = w;
  const j = growth.jobs.create({ companyId: company.id, kind: 'x',
    origin: 'CHAT_OPERACIONAL', total: 1 });
  assert.equal(j.origin, 'CHAT_OPERACIONAL');
  assert.throws(() => growth.jobs.create({ companyId: company.id, kind: 'x',
    origin: 'ROBO_MALUCO' }), /origem de ação inválida/);
  const audit = w.mos.repos.audit.tail(20).find(a =>
    a.action === 'created' && a.actor === 'job');
  assert.ok(JSON.stringify(audit).includes('CHAT_OPERACIONAL'), 'origem na auditoria');
});

/* 3 — comando WhatsApp em massa exige confirmação (nada criado antes) */
test('comando em massa via WhatsApp: resumo primeiro, execução só após SIM', async () => {
  const w = world();
  const { growth, company, mos } = w;
  const before = mos.repos.listingDraft.count();
  const r = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'cria drafts shopee dos produtos com margem acima de 10%' });
  assert.ok(r.awaitingConfirmation);
  assert.match(r.reply, /Responda SIM/i);
  assert.match(r.reply, /NENHUMA publicação externa/i);
  assert.equal(mos.repos.listingDraft.count(), before, 'NADA criado antes da confirmação');
  const job = mos.repos.job.byId(r.jobId);
  assert.equal(job.status, 'AWAITING_CONFIRMATION');
  const r2 = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE, text: 'sim' });
  assert.ok(r2.executed);
  assert.ok(mos.repos.listingDraft.count() > before, 'drafts criados após confirmação');
  assert.match(r2.reply, /Catálogo/, 'resultado aponta para a tela');
});

/* 4 — WhatsApp nunca executa escrita externa */
test('WhatsApp não executa escrita externa: recusa honesta + conectores READ_ONLY', async () => {
  const w = world();
  const { growth, company, mos } = w;
  const r = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'ativa a promoção na shopee agora' });
  assert.match(r.reply, /não executo por WhatsApp/i);
  assert.match(r.reply, /READ_ONLY/);
  /* e o webhook inteiro (fluxo oficial) também nunca escreve fora */
  const live = withWhatsApp(w);
  const body = inboundMsg('wamid-ext-1', 'publica o anúncio na shopee');
  const s = signed(body);
  const res = await live.whatsapp.handleInbound(body, { ...s, companyId: company.id });
  assert.ok(res.ok);
  const ev = mos.repos.waEvent.byId('wamid-ext-1');
  assert.match(ev.reply_text, /não executo por WhatsApp|modo leitura/i);
  for (const name of mos.providers.connectorNames())
    assert.throws(() => mos.providers.connector(name).updatePrice({}),
      ReadOnlyViolationError);
});

/* 5 — lead manual possui histórico e auditoria */
test('lead manual: histórico de status, interações e auditoria completos', () => {
  const w = world();
  const { growth, company, owner } = w;
  const { lead } = growth.leads.create({ companyId: company.id, userId: owner.id,
    origin: 'INDICACAO', name: 'Maria Compradora', phone: '5511911112222' });
  growth.leads.interact(lead.id, { kind: 'contato', note: 'primeiro contato', byUser: owner.id });
  growth.leads.setStatus(lead.id, 'EM_ATENDIMENTO', { userId: owner.id });
  growth.leads.setStatus(lead.id, 'OPORTUNIDADE', { userId: owner.id, reason: 'quer 2 quadros' });
  const h = growth.leads.history(lead.id);
  assert.equal(h.status.length, 3, 'NOVO + 2 mudanças');
  assert.deepEqual(h.status.map(s => s.to_status), ['NOVO', 'EM_ATENDIMENTO', 'OPORTUNIDADE']);
  assert.equal(h.interactions.length, 1);
  const audit = w.mos.repos.audit.tail(50).filter(a => a.actor === 'lead');
  assert.ok(audit.some(a => a.action === 'created'));
  assert.ok(audit.some(a => a.action === 'status_changed'));
  assert.throws(() => growth.leads.setStatus(lead.id, 'STATUS_FALSO'), /status inválido/);
});

/* 6 — lead vinculado a produto, marketplace e afiliado */
test('lead vincula produto, marketplace, afiliado e campanha', () => {
  const w = world();
  const { growth, company, owner, products } = w;
  const aff = growth.affiliates.createPartner({ companyId: company.id, userId: owner.id,
    name: 'Parceira Influencer', commissionPct: 10, code: 'PARC10' });
  const { lead } = growth.leads.create({ companyId: company.id, userId: owner.id,
    origin: 'AFILIADO', name: 'João Interessado', email: 'joao@x.y' });
  growth.leads.link(lead.id, { productId: products['QDR-SER'].id,
    marketplace: 'mercado_livre', affiliateId: aff.id, byUser: owner.id });
  const row = w.mos.repos.lead.byId(lead.id);
  assert.equal(row.product_id, products['QDR-SER'].id);
  assert.equal(row.marketplace, 'mercado_livre');
  assert.equal(row.affiliate_id, aff.id);
});

/* 7 — dados de lead demo e reais são diferenciados (nunca misturados) */
test('leads demo × reais: rotulados e contados separadamente', () => {
  const w = world();
  const { growth, company, owner } = w;
  growth.leads.create({ companyId: company.id, userId: owner.id, origin: 'WHATSAPP',
    name: 'Lead Demonstrativo X', dataSource: 'DEMO' });
  growth.leads.create({ companyId: company.id, userId: owner.id, origin: 'FORMULARIO',
    name: 'Lead Real Y', phone: '5511933334444' });
  const s = growth.leads.summary({ companyId: company.id });
  assert.equal(s.demo.total, 1);
  assert.equal(s.real.total, 1);
  assert.match(s.demo.label, /demonstrativos/);
  assert.match(s.real.label, /CRM externo não conectado/);
  assert.equal(s.crmConnected, false, 'nunca finge CRM conectado');
});

/* 8 — afiliado recebe dados manuais/importados com fonte identificada */
test('importação manual de afiliado: fonte gravada e rótulo honesto', () => {
  const w = world();
  const { growth, company, owner } = w;
  const aff = growth.affiliates.createPartner({ companyId: company.id, userId: owner.id,
    name: 'Parceiro CSV', commissionPct: 8 });
  const r = growth.affiliates.importPerformance({ companyId: company.id, userId: owner.id,
    affiliateId: aff.id, rows: [
      { orderRef: 'PED-1001', amount: 250, marketplace: 'shopee' },
      { orderRef: 'PED-1002', amount: 180, marketplace: 'mercado_livre' }] });
  assert.equal(r.imported, 2);
  assert.match(r.note, /importados manualmente/);
  const convs = w.mos.repos.affiliateConversion.db.all(
    'SELECT * FROM affiliate_conversion WHERE affiliate_id = ?', aff.id);
  assert.ok(convs.every(c => c.source === 'IMPORTACAO_MANUAL'));
  assert.ok(convs.every(c => c.confidence === 'ESTIMADA'), 'nunca CONFIRMADA sem integração');
  const panel = growth.affiliates.panel({ companyId: company.id });
  assert.match(panel.partners[0].attribution.note, /importados manualmente/);
  assert.equal(panel.integrationConnected, false);
});

/* 9 — comissão nunca vira pagamento real automaticamente */
test('comissão nasce ESTIMADA; lote fica EM_REVISAO; pagar lança erro', () => {
  const w = world();
  const { growth, company, owner } = w;
  const aff = growth.affiliates.createPartner({ companyId: company.id, userId: owner.id,
    name: 'P', commissionPct: 10 });
  growth.affiliates.attributeSale({ companyId: company.id, affiliateId: aff.id,
    orderRef: 'PED-2001', amount: 300, source: 'IMPORTACAO_MANUAL' });
  const comm = w.mos.repos.affiliateCommission.db.all(
    'SELECT * FROM affiliate_commission WHERE affiliate_id = ?', aff.id);
  assert.equal(comm.length, 1);
  assert.equal(comm[0].status, 'ESTIMADA');
  assert.equal(comm[0].amount, 30);
  const { batch } = growth.affiliates.createPayoutBatch({
    companyId: company.id, userId: owner.id, period: '2026-07' });
  assert.equal(batch.status, 'EM_REVISAO');
  assert.throws(() => growth.affiliates.pay(), /não habilitado.*fluxo futuro/);
});

/* extra estrutural — atribuição: dedup de venda e clique nunca vira comissão */
test('atribuição: uma venda = um afiliado; clique não gera comissão; regra+janela+confiança registradas', () => {
  const w = world();
  const { growth, company, owner } = w;
  const a1 = growth.affiliates.createPartner({ companyId: company.id, userId: owner.id, name: 'A1', commissionPct: 10 });
  const a2 = growth.affiliates.createPartner({ companyId: company.id, userId: owner.id, name: 'A2', commissionPct: 10 });
  const r1 = growth.affiliates.attributeSale({ companyId: company.id, affiliateId: a1.id,
    orderRef: 'PED-3001', amount: 100, rule: 'last-click', windowDays: 7,
    confidence: 'ESTIMADA', source: 'IMPORTACAO_MANUAL' });
  assert.ok(r1.attributed);
  const r2 = growth.affiliates.attributeSale({ companyId: company.id, affiliateId: a2.id,
    orderRef: 'PED-3001', amount: 100, source: 'IMPORTACAO_MANUAL' });
  assert.equal(r2.attributed, false, 'mesma venda NUNCA em dois afiliados');
  assert.match(r2.reason, /já atribuída/);
  /* clique: evento sim, comissão NÃO */
  const commBefore = w.mos.repos.affiliateCommission.count();
  growth.affiliates.trackEvent({ companyId: company.id, affiliateId: a2.id,
    kind: 'click', source: 'IMPORTACAO_MANUAL' });
  assert.equal(w.mos.repos.affiliateCommission.count(), commBefore, 'clique não vira comissão');
  const ev = w.mos.repos.attributionEvent.db.get(
    `SELECT * FROM affiliate_attribution_event WHERE kind = 'sale' AND order_ref = 'PED-3001'`);
  assert.equal(ev.rule, 'last-click'); assert.equal(ev.window_days, 7);
  assert.equal(ev.confidence, 'ESTIMADA');
  /* lead duplicado pelo mesmo telefone */
  const l1 = growth.leads.create({ companyId: company.id, userId: owner.id,
    origin: 'WHATSAPP', name: 'Dup', phone: '5511955556666' });
  const l2 = growth.leads.create({ companyId: company.id, userId: owner.id,
    origin: 'FORMULARIO', name: 'Duplicada', phone: '5511955556666' });
  assert.equal(l1.duplicate, false);
  assert.equal(l2.duplicate, true, 'dedup por telefone');
});

/* 10 — promoção é entidade compartilhada Catálogo ↔ Crescimento */
test('promoção compartilhada: mesma entidade nas duas visões', () => {
  const w = world();
  const { growth, company, owner, products } = w;
  const promo = growth.promotions.create({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_MANUAL', name: 'Semana da Sala', marketplace: 'shopee',
    discountValue: 10, targets: [{ productId: products['KIT3-ABS'].id }], capUnits: 20 });
  const catalogView = growth.promotions.catalogView(products['KIT3-ABS'].id);
  const growthView = growth.promotions.growthView(company.id);
  assert.equal(catalogView[0].id, promo.id, 'Catálogo vê a MESMA promoção');
  assert.equal(growthView[0].id, promo.id, 'Crescimento vê a MESMA promoção');
  /* update numa visão reflete na outra: é a mesma linha */
  growth.promotions.submitReview(promo.id);
  assert.equal(growth.promotions.catalogView(products['KIT3-ABS'].id)[0].status, 'EM_REVISAO');
});

/* 11 — promoção calcula margem e risco de estoque; sem margem → revisão */
test('promoção simula margem, preço mínimo e risco de ruptura; sem custo → EM_REVISAO', () => {
  const w = world();
  const { growth, company, owner, products, catalog } = w;
  const promo = growth.promotions.create({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_MANUAL', name: 'Kit -15%', marketplace: 'shopee',
    discountValue: 15, targets: [{ productId: products['KIT3-ABS'].id }], capUnits: 100 });
  const sim = growth.promotions.simulate(promo.id);
  const s = sim.simulations[0];
  assert.ok(s.computable);
  assert.ok(s.fees.commission > 0 && s.fees.tax > 0, 'taxas por praça no breakdown');
  assert.ok(s.minPrice > 0, 'preço mínimo calculado');
  assert.match(s.stockRisk, /ALTO/, 'limite 100 > estoque → risco de ruptura');
  /* produto SEM custo → margem não computável → promoção em revisão */
  const semCusto = catalog.upsertMaster(company.id, {
    ...C.DEMO_PRODUCTS[0],
    master: { id: 'prd-sem-custo', companyId: company.id, name: 'Produto Sem Custo', sku: 'SEM-CUSTO' },
    profile: { ...C.DEMO_PRODUCTS[0].profile, cost: null } });
  const promo2 = growth.promotions.create({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_MANUAL', name: 'Sem margem', marketplace: 'shopee',
    discountValue: 10, targets: [{ productId: semCusto.id }] });
  const sim2 = growth.promotions.simulate(promo2.id);
  assert.equal(sim2.marginOk, false);
  assert.equal(sim2.status, 'EM_REVISAO', 'sem margem calculada → revisão obrigatória');
  assert.throws(() => growth.promotions.approveInternal(promo2.id, { userId: owner.id }),
    /não computável/);
});

/* 12 — promoção não ativa externamente */
test('ativação externa de promoção é bloqueada; status máximo AGUARDANDO_AUTORIZACAO_DE_ESCRITA', () => {
  const w = world();
  const { growth, company, owner, products } = w;
  const promo = growth.promotions.create({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_MANUAL', name: 'P', marketplace: 'shopee',
    discountValue: 10, targets: [{ productId: products['QDR-NOME'].id }], capUnits: 5 });
  growth.promotions.simulate(promo.id);
  growth.promotions.approveInternal(promo.id, { userId: owner.id });
  assert.equal(w.mos.repos.promotion.byId(promo.id).status, 'APROVADA_INTERNAMENTE');
  assert.throws(() => growth.promotions.activateExternally(promo.id), ExternalWriteError);
  assert.equal(w.mos.repos.promotion.byId(promo.id).status,
    'AGUARDANDO_AUTORIZACAO_DE_ESCRITA', 'nunca ATIVA_EXTERNAMENTE');
});

/* 13 — métricas mostram fonte, período e cobertura */
test('Resultados: todo número com período, fonte, cobertura e atualização', () => {
  const w = world();
  const { growth, company, owner } = w;
  growth.leads.create({ companyId: company.id, userId: owner.id,
    origin: 'FORMULARIO', name: 'L', phone: '5511900001111' });
  const r = growth.results.consolidated({ companyId: company.id });
  for (const key of ['salesByMarketplace', 'leadsByOrigin', 'leadConversion',
                     'affiliateRevenue', 'commissions', 'promotionCost', 'stockCommitted', 'roi']) {
    const m = r[key];
    assert.ok(m.period, `${key}: período`);
    assert.ok(m.source, `${key}: fonte`);
    assert.ok(m.coverage, `${key}: cobertura`);
    assert.ok(m.updatedAt, `${key}: atualização`);
    assert.ok(['REAL', 'IMPORTADO', 'DEMONSTRATIVO', 'SEM_DADO'].includes(m.source),
      `${key}: natureza declarada (${m.source})`);
  }
  assert.equal(r.salesByMarketplace.source, 'SEM_DADO', 'sem sync → nunca inventa venda');
  assert.equal(r.roi.value, null, 'ROI sem base → null, nunca estimado');
});

/* 14 — nenhum dado demonstrativo aparece como real */
test('demo nunca vira real: resumos separam e rotulam; chat imprime o rótulo', () => {
  const w = world();
  const { growth, company, owner, c } = w;
  growth.leads.create({ companyId: company.id, userId: owner.id, origin: 'WHATSAPP',
    name: 'Demo Lead', dataSource: 'DEMO' });
  const summary = growth.leads.summary({ companyId: company.id });
  assert.equal(summary.real.total, 0, 'demo não conta como real');
  /* chat com adapter demo: rodapé rotulado */
  const chat = createHeadChat({ clock: c, companyId: company.id,
    growth: HG.createGrowthAdapter(HG.createDemoGrowthDataset(c), c) });
  /* 10.D — contrato atualizado: "lead" no chat contextualiza o funil de
     marketplace; o produto não tem pipeline de leads/CRM. */
  const r = chat.ask('Quantos leads chegaram hoje?');
  assert.equal(r.intent, 'FUNIL_MARKETPLACE_CONTEXT');
  assert.match(r.reply, /nao trabalhamos com pipeline de leads/i);
  assert.match(r.reply, /pedidos criados, pedidos nao pagos/i);
  const r2 = chat.ask('Quem são meus melhores afiliados?');
  assert.equal(r2.intent, 'AFFILIATE_QUERY');
  assert.match(r2.reply, /importados manualmente/);
  assert.match(r2.reply, /ESTIMADAS/);
});

/* extra — permissões e Approval Flow */
test('papéis: LEITURA não edita; operador cria draft mas não aprova; decisor certo por tipo', () => {
  const w = world();
  const { growth, company, mos } = w;
  const mk = (name, role) => {
    const u = mos.repos.user.insert({ workspace_id: company.workspace_id,
      name, email: `${name}@x.y`, role: 'operator' });
    growth.permissions.grant(u.id, company.id, role);
    return u;
  };
  const leitura = mk('leitor', 'LEITURA');
  const operador = mk('op', 'OPERADOR_CATALOGO');
  const gestor = mk('gestor', 'GESTOR_MARKETPLACE');
  const financeiro = mk('fin', 'FINANCEIRO');
  assert.throws(() => growth.permissions.assert(leitura.id, company.id, 'catalog.edit'), PermissionError);
  assert.throws(() => growth.permissions.assert(leitura.id, company.id, 'job.execute'), PermissionError);
  assert.equal(growth.permissions.can(operador.id, company.id, 'draft.create'), true);
  assert.equal(growth.permissions.can(operador.id, company.id, 'draft.approve'), false);
  assert.equal(growth.permissions.can(gestor.id, company.id, 'draft.approve'), true);
  /* decisor por tipo: comissão é do FINANCEIRO/ADMIN, não do gestor */
  const ap = growth.approvals.require({ companyId: company.id, kind: 'COMMISSION_PAYOUT',
    entity: 'x', entityId: '1' });
  assert.throws(() => growth.approvals.decide(ap.id, { userId: gestor.id, approve: true }),
    PermissionError);
  const decided = growth.approvals.decide(ap.id, { userId: financeiro.id, approve: true });
  assert.equal(decided.status, 'APPROVED');
});

/* extra — conflito manual × sync com proveniência por campo */
test('sync nunca apaga edição manual em silêncio: conflito + revisão + fonte por campo', () => {
  const w = world();
  const { growth, company, owner, products } = w;
  const pid = products['QDR-SER'].id;
  growth.provenance.setFields(pid, { base_price: 205 }, 'MANUAL', { byUser: owner.id });
  const r = growth.provenance.setFields(pid, { base_price: 189, warranty: '90 dias' },
    'MARKETPLACE_SYNC');
  assert.deepEqual(r.applied, ['warranty'], 'campo sem edição manual atualiza normal');
  assert.equal(r.conflicts.length, 1, 'campo manual vira CONFLITO, não sobrescrita');
  const profile = w.mos.repos.productProfile.db.get(
    'SELECT * FROM product_profile WHERE product_id = ?', pid);
  assert.equal(profile.base_price, 205, 'valor manual PERMANECE');
  const sources = JSON.parse(profile.field_sources_json);
  assert.equal(sources.base_price, 'MANUAL');
  assert.equal(sources.warranty, 'MARKETPLACE_SYNC');
  /* resolução humana escolhe o lado */
  const conflicts = growth.provenance.openConflicts(company.id);
  growth.provenance.resolve(conflicts[0].id, { choose: 'SYNC', userId: owner.id });
  assert.equal(w.mos.repos.productProfile.db.get(
    'SELECT base_price FROM product_profile WHERE product_id = ?', pid).base_price, 189);
});

/* extra — jobs: contadores, pausa, cancelamento e rollback interno */
test('job em massa: contadores, cancelar só antes de executar, rollback interno', async () => {
  const w = world();
  const { growth, company, owner } = w;
  /* cancelar antes de executar: ok */
  const plan = growth.adaptation.plan({ companyId: company.id, targetPlatform: 'magalu' });
  const { job } = growth.adaptation.requestExecution({ companyId: company.id,
    userId: owner.id, origin: 'DASHBOARD_MANUAL', plan });
  growth.jobs.cancel(job.id, { userId: owner.id });
  assert.equal(w.mos.repos.job.byId(job.id).status, 'CANCELLED');
  /* executar outro e conferir contadores + rollback */
  const plan2 = growth.adaptation.plan({ companyId: company.id, targetPlatform: 'tiktok' });
  const { job: job2 } = growth.adaptation.requestExecution({ companyId: company.id,
    userId: owner.id, origin: 'DASHBOARD_MANUAL', plan: plan2 });
  growth.jobs.confirm(job2.id, { userId: owner.id });
  const result = await growth.adaptation.execute(job2.id, { userId: owner.id });
  const done = w.mos.repos.job.byId(job2.id);
  assert.equal(done.status, 'DONE');
  assert.equal(done.processed, done.succeeded + done.blocked + done.failed);
  assert.ok(done.report_json, 'relatório final');
  assert.throws(() => growth.jobs.cancel(job2.id), /já executou|encerrado/);
  const rb = growth.jobs.rollbackInternal(job2.id, { userId: owner.id });
  assert.equal(rb.undone, result.draftIds.length);
  assert.equal(rb.external, false, 'rollback é interno — marketplace intocado');
  for (const id of result.draftIds)
    assert.equal(w.mos.repos.listingDraft.byId(id).status, 'ARCHIVED');
});

/* extra — privacidade: mascaramento por papel + auditoria de acesso + isolamento */
test('privacidade: contato mascarado fora do comercial, acesso auditado, empresas isoladas', () => {
  const w = world();
  const { growth, company, owner, mos } = w;
  growth.leads.create({ companyId: company.id, userId: owner.id, origin: 'WHATSAPP',
    name: 'Sigiloso', phone: '5511987654321', email: 'sigiloso@x.y' });
  const op = mos.repos.user.insert({ workspace_id: company.workspace_id,
    name: 'op2', email: 'op2@x.y', role: 'operator' });
  growth.permissions.grant(op.id, company.id, 'LEITURA');
  const rows = growth.leads.list({ companyId: company.id, userId: op.id });
  assert.ok(rows[0].contactMasked);
  assert.ok(!rows[0].phone.includes('87654'), `mascarado: ${rows[0].phone}`);
  const admin = growth.leads.list({ companyId: company.id, userId: owner.id });
  assert.equal(admin[0].phone, '5511987654321', 'ADMIN vê contato');
  const audits = mos.repos.audit.tail(30).filter(a =>
    a.actor === 'lead' && a.action === 'list_accessed');
  assert.equal(audits.length, 2, 'todo acesso à lista é auditado');
  /* isolamento: empresa B não vê leads da empresa A */
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'b@x.y', companyName: 'B', marketplaces: ['shopee'] });
  const ownerB = mos.repos.user.db.get(
    'SELECT u.* FROM user u JOIN company c ON c.workspace_id = u.workspace_id WHERE c.id = ?', b.id);
  assert.equal(growth.leads.list({ companyId: b.id, userId: ownerB.id }).length, 0);
});

/* extra — chat: gap de catálogo, risco de promoção e giro sem promoção */
test('chat de Crescimento: gap entre praças, promoções de risco, alto giro e plano de ação', () => {
  const w = world();
  const c = w.c;
  const chat = createHeadChat({ clock: c, companyId: w.company.id,
    growth: HG.createGrowthAdapter(HG.createDemoGrowthDataset(c), c) });
  const gap = chat.ask('Quais produtos vendem na Shopee e ainda não estão no Mercado Livre?');
  assert.equal(gap.intent, 'CATALOG_GAP_QUERY');
  assert.match(gap.reply, /vendem na Shopee e ainda não estão/);
  assert.match(gap.reply, /ESP-ORG|Espelho/);
  const risk = chat.ask('Me mostra promoções que vão derrubar minha margem');
  assert.equal(risk.intent, 'PROMOTION_RISK_QUERY');
  assert.match(risk.reply, /risco de margem|derrubando/);
  assert.match(risk.reply, /Nada disso está ativo externamente/);
  const giro = chat.ask('Mostra produtos com alto giro sem promoção');
  assert.equal(giro.intent, 'PROMOTION_OPPORTUNITY_QUERY');
  assert.match(giro.reply, /alto giro SEM promoção/);
  const plan = chat.ask('Cria drafts shopee dos produtos com margem acima de 25%');
  assert.equal(plan.intent, 'GROWTH_ACTION');
  assert.match(plan.reply, /nada é publicado|não é publicado/i);
  /* 10.D — "lead" nunca ativa CRM, mesmo com motor acoplado */
  const fu = chat.ask('Quais leads precisam de follow-up hoje?');
  assert.equal(fu.intent, 'FUNIL_MARKETPLACE_CONTEXT');
  assert.match(fu.reply, /nao trabalhamos com pipeline de leads/i);
  const bare = createHeadChat({ clock: c, companyId: w.company.id });
  assert.match(bare.ask('Quantos leads chegaram hoje?').reply, /nao trabalhamos com pipeline de leads/i);
});

/* 15 — v6: menu com Crescimento e demonstrações obrigatórias */
test('v6: área Crescimento no menu, subnavegação e modo demonstração declarado', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v6/index.html'), 'utf8');
  for (const v of ['home', 'operacao', 'catalogo', 'crescimento', 'conexoes', 'missoes', 'silencio', 'conhecimento'])
    assert.match(html, new RegExp(`data-v="${v}"`), `área ${v} no menu`);
  assert.match(html, /Modo demonstração/);
  const js = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v6/crescimento.js'), 'utf8');
  for (const sub of ['Visão Geral', 'Leads e Oportunidades', 'Afiliados',
                     'Promoções e Campanhas', 'Resultados', 'Pendências Comerciais'])
    assert.ok(js.includes(sub), `subnavegação: ${sub}`);
});

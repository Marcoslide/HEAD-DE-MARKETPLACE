/* SPRINT 10.B (complementos) — CRIAÇÃO PELA CONVERSA + DATA COMPLETION.
   30 garantias em ~19 blocos. Nenhuma escrita externa em nenhum teste. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('../src/central/fixtures/index.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { createGrowth } = require('../src/growth/index.js');
const { createLive } = require('../src/live/index.js');
const { createHeadChat } = require('../src/chat/index.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');
const crypto = require('node:crypto');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
const ADMIN_PHONE = '5511988887777';

function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport() });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'i@x.y', companyName: 'C',
    marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'] });
  const owner = mos.repos.user.db.get('SELECT * FROM user LIMIT 1');
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  const growth = createGrowth({ mos, clock: c, catalog });
  growth.margin.ensureFeeProfiles(company.id);
  const products = {};
  for (const dp of C.DEMO_PRODUCTS)
    products[dp.master.sku] = catalog.upsertMaster(company.id, dp);
  return { mos, c, company, owner, catalog, growth, products };
}

/* 1 — comando "criar anúncio" abre fluxo de intake (produto desconhecido) */
test('comando de anúncio sem produto conhecido abre PRODUCT_INTAKE (nunca Master direto)', () => {
  const w = world();
  const { growth, company, owner } = w;
  const r = growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'luminária pendente ratan 40cm' });
  assert.equal(r.mode, 'NEW_PRODUCT');
  assert.equal(r.intake.status, 'NEW');
  assert.match(r.question, /já existe ou começar um produto novo/);
  assert.equal(w.mos.repos.product.count('WHERE company_id = ?', company.id), 4,
    'NENHUM Product Master criado');
});

/* 2 — foto anexada cria asset com origem, hash e usuário */
test('foto anexada registra origem, hash, autor e status de revisão', () => {
  const w = world();
  const { growth, company, owner } = w;
  const s = growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'produto novo xyz' });
  const a = growth.intake.attachAsset({ companyId: company.id, intakeId: s.intake.id,
    kind: 'UNCLASSIFIED', url: 'upload://foto-1.jpg', uploadedBy: owner.id,
    origin: 'DASHBOARD_OPERATION' });
  assert.equal(a.asset.origin, 'DASHBOARD_OPERATION');
  assert.equal(a.asset.uploaded_by, owner.id);
  assert.equal(a.asset.hash.length, 24);
  assert.equal(a.asset.review_status, 'PENDING_REVIEW');
  assert.match(a.question, /produto real.*ou.*referência/i);
  assert.equal(a.becomesOfficialAutomatically, false);
});

/* 3 — foto de referência nunca vira asset oficial automaticamente */
test('foto de REFERÊNCIA não entra no anúncio; classificação é explícita', () => {
  const w = world();
  const { growth, company, owner, products } = w;
  const a = growth.intake.attachAsset({ companyId: company.id,
    productId: products['QDR-SER'].id, kind: 'REFERENCE',
    url: 'upload://ref-pinterest.jpg', uploadedBy: owner.id,
    origin: 'DASHBOARD_OPERATION' });
  assert.match(a.asset.allowed_use, /nunca no anúncio/);
  assert.equal(a.officialSuggestion, null, 'referência não sugere Product Asset');
  /* Product Assets do produto permanecem intocados */
  const officialAssets = w.mos.repos.productAsset.count('WHERE product_id = ?', products['QDR-SER'].id);
  assert.equal(officialAssets, 3, 'os 3 assets oficiais do S10 intactos');
  assert.throws(() => growth.intake.classifyAsset(a.asset.id, 'INVENTADO'), /inválida/);
});

/* 4 + 5 — link registrado como referência; concorrente nunca é copiado */
test('link vira Source Reference com finalidade confirmada; conteúdo jamais copiado', () => {
  const w = world();
  const { growth, company, owner } = w;
  const r = growth.intake.registerLink({ companyId: company.id,
    url: 'https://www.mercadolivre.com.br/espelho-organico-concorrente-123',
    origin: 'DASHBOARD_OPERATION', registeredBy: owner.id });
  assert.equal(r.contentCopied, false);
  assert.equal(r.reference.link_kind, 'MARKETPLACE');
  assert.match(r.question, /Como devo usar este link/);
  const conf = growth.intake.confirmLinkPurpose(r.reference.id, 'COMPETITOR',
    { byUser: owner.id });
  assert.equal(conf.reference.link_kind, 'COMPETITOR');
  assert.match(conf.rule, /NUNCA são copiadas/);
  assert.equal(conf.contentCopied, false);
  assert.equal(w.mos.repos.sourceReference.byId(r.reference.id).content_copied, 0);
});

/* 6 — produto existente identificado sem duplicar Product Master */
test('produto existente é identificado; intake parecido vira REJECTED_DUPLICATE', () => {
  const w = world();
  const { growth, company, owner } = w;
  const r = growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'leva esse espelho orgânico para a shopee' });
  assert.equal(r.mode, 'EXISTING_PRODUCT');
  assert.equal(r.matches[0].sku, 'ESP-ORG');
  /* intake novo com nome quase igual a produto existente → duplicado */
  const s = growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'produto totalmente inédito' });
  growth.intake.attachAsset({ companyId: company.id, intakeId: s.intake.id,
    kind: 'OFFICIAL', url: 'upload://f.jpg', origin: 'DASHBOARD_OPERATION' });
  growth.intake.setIntakeData(s.intake.id, { medidas: { h: 70, w: 70 },
    material: 'vidro', pesoEmbalado: 9000, custo: 80, estoque: 5 });
  const promo = growth.intake.promoteToMaster(s.intake.id,
    { userId: owner.id, name: 'Espelho Decorativo Orgânico 70cm', sku: 'ESP-ORG' });
  assert.equal(promo.created, false);
  assert.equal(promo.duplicateOf.sku, 'ESP-ORG');
  assert.equal(w.mos.repos.productIntake.byId(s.intake.id).status, 'REJECTED_DUPLICATE');
  assert.equal(w.mos.repos.product.count('WHERE company_id = ?', company.id), 4,
    'nenhum Master duplicado');
});

/* 7 — produto novo vira Product Intake antes de Product Master */
test('intake completo promove a Master com revisão; incompleto é barrado', () => {
  const w = world();
  const { growth, company, owner } = w;
  const s = growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'luminária ratan pendente' });
  /* incompleto → não promove, e a pergunta é objetiva (só o que falta) */
  assert.throws(() => growth.intake.promoteToMaster(s.intake.id,
    { userId: owner.id, name: 'Luminária Ratan', sku: 'LUM-RAT' }), /complete os dados/);
  assert.match(growth.intake.nextQuestion(s.intake.id), /fotos oficiais.*medidas.*material.*peso embalado.*custo/s);
  growth.intake.attachAsset({ companyId: company.id, intakeId: s.intake.id,
    kind: 'OFFICIAL', url: 'upload://lum-1.jpg', origin: 'DASHBOARD_OPERATION' });
  growth.intake.setIntakeData(s.intake.id, { medidas: { h: 40, w: 40, d: 40 },
    material: 'ratan natural', pesoEmbalado: 2500, custo: 55, estoque: 12, preco: 149 });
  assert.equal(w.mos.repos.productIntake.byId(s.intake.id).status,
    'READY_TO_CREATE_PRODUCT_MASTER');
  const promo = growth.intake.promoteToMaster(s.intake.id,
    { userId: owner.id, name: 'Luminária Pendente Ratan 40cm', sku: 'LUM-RAT' });
  assert.ok(promo.created);
  const profile = w.mos.repos.productProfile.db.get(
    'SELECT * FROM product_profile WHERE product_id = ?', promo.product.id);
  assert.equal(profile.packed_weight_g, 2500);
  assert.equal(JSON.parse(profile.tech_sheet_json).material, 'ratan natural');
});

/* 8 + 9 + 10 + 11 — drafts pela conversa: mesmo engine, praças separadas */
test('drafts pela conversa usam o MESMO Adaptation Engine; multimarketplace separa praças; faltas impedem pronto', async () => {
  const w = world();
  const { growth, company, owner, products, mos } = w;
  const before = growth.adaptation.executions;
  const mlBefore = mos.repos.marketplaceProfile.db.get(
    `SELECT * FROM marketplace_product_profile WHERE product_id = ? AND platform = 'mercado_livre'`,
    products['ESP-ORG'].id);
  const r = await growth.intake.createDrafts({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', productId: products['ESP-ORG'].id,
    marketplaces: ['shopee', 'mercado_livre'] });
  assert.equal(growth.adaptation.executions, before + 2, 'MESMO engine, 1 job por praça');
  assert.equal(r.results.length, 2, 'drafts SEPARADOS');
  assert.notEqual(r.results[0].draftId, r.results[1].draftId);
  assert.equal(r.published, false); assert.equal(r.externalWrite, false);
  const shopee = r.results.find(x => x.marketplace === 'shopee');
  assert.notEqual(shopee.readiness, 'pronto para revisão',
    'ESP-ORG na Shopee tem pendências → não fica pronto');
  assert.ok(shopee.pending.length, 'pendências listadas');
  assert.ok(shopee.openInCatalog.startsWith('catalogo://draft/'), 'deep link para o Catálogo');
  /* draft Shopee NÃO altera dados do Mercado Livre */
  const mlAfter = mos.repos.marketplaceProfile.db.get(
    `SELECT * FROM marketplace_product_profile WHERE product_id = ? AND platform = 'mercado_livre'`,
    products['ESP-ORG'].id);
  assert.deepEqual(mlAfter, mlBefore, 'perfil ML intocado pelo draft Shopee');
});

/* 12 + 13 — WhatsApp inicia criação com foto/link; nunca publica */
test('WhatsApp: foto inicia intake; comando cria drafts internos; publicar é recusado', async () => {
  const w = world();
  const { growth, company } = w;
  /* foto */
  const foto = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: '', kind: 'image', mediaId: 'MEDIA-1', messageId: 'wamid-f1' });
  assert.match(foto.reply, /Recebi a foto/);
  assert.match(foto.reply, /origem e hash/);
  assert.ok(foto.assetId);
  const asset = w.mos.repos.intakeAsset.byId(foto.assetId);
  assert.equal(asset.kind, 'UNCLASSIFIED', 'nunca nasce OFICIAL sozinha');
  assert.equal(asset.origin, 'WHATSAPP_COMMAND');
  /* link */
  const link = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'https://shopee.com.br/produto-referencia-987', kind: 'text' });
  assert.match(link.reply, /registrado como referência/i);
  assert.match(link.reply, /Nunca copio/);
  /* comando com produto existente → drafts internos + pendências perguntadas */
  const cmd = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'Cria anúncio desse espelho para Shopee e Mercado Livre' });
  assert.match(cmd.reply, /Criei 2 rascunho\(s\) interno\(s\)/);
  assert.match(cmd.reply, /Nenhum anúncio foi publicado/);
  assert.equal(cmd.drafts.length, 2);
  /* publicar → recusa */
  const pub = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'publica o anuncio do espelho na shopee' });
  assert.match(pub.reply, /não executo por WhatsApp/i);
});

/* 14 — toda ação registra origem e auditoria */
test('auditoria do intake: origem em intake, asset, link e drafts', async () => {
  const w = world();
  const { growth, company, owner, mos } = w;
  growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'DASHBOARD_OPERATION', text: 'produto abc' });
  assert.throws(() => growth.intake.start({ companyId: company.id, userId: owner.id,
    origin: 'ORIGEM_FALSA', text: 'x' }), /origem de intake inválida/);
  await growth.intake.createDrafts({ companyId: company.id, userId: owner.id,
    origin: 'WHATSAPP_COMMAND', productId: w.products['QDR-NOME'].id,
    marketplaces: ['shopee'] });
  const audits = mos.repos.audit.tail(60).filter(a => a.actor === 'intake');
  assert.ok(audits.some(a => a.action === 'started'));
  assert.ok(audits.some(a => a.action === 'drafts_created'
    && a.detail_json.includes('WHATSAPP_COMMAND')));
  const job = mos.repos.job.db.get(
    `SELECT * FROM internal_job WHERE kind = 'adaptation.create_drafts' ORDER BY id DESC LIMIT 1`);
  assert.equal(job.origin, 'WHATSAPP_COMMAND');
});

/* ================= DATA COMPLETION ENGINE ================= */

function blockedWorld() {
  const w = world();
  const { growth, catalog, company } = w;
  /* produto sem peso embalado nem material → pendências reais */
  const semDados = catalog.upsertMaster(company.id, {
    master: { companyId: company.id, name: 'Espelho Orgânico 170x70', sku: 'ESP-170' },
    profile: { description: 'Espelho orgânico grande', techSheet: {},
      heightCm: 170, widthCm: 70, cost: 210, basePrice: 549, minMarginPct: 18 },
    assets: [{ kind: 'image', role: 'main', url: 'img/e1.jpg', width: 1200, height: 1200,
               format: 'jpg', sizeKb: 320, position: 0 }],
    byPlatform: { shopee: { title: 'Espelho Orgânico 170x70', price: 549, stock: 6,
                            attributes: {} } },
  });
  return { ...w, semDados };
}

/* DC 1 + 13 — pendência ligada a produto/draft/praça, roteada ao papel certo */
test('DataRequest nasce ligado a produto, draft e praça — e roteado ao responsável certo', () => {
  const w = blockedWorld();
  const { growth, company, owner, semDados, mos } = w;
  const op = mos.repos.user.insert({ workspace_id: company.workspace_id,
    name: 'produção', email: 'prod@x.y', role: 'operator' });
  growth.permissions.grant(op.id, company.id, 'OPERADOR_CATALOGO');
  const fin = mos.repos.user.insert({ workspace_id: company.workspace_id,
    name: 'fin', email: 'fin@x.y', role: 'operator' });
  growth.permissions.grant(fin.id, company.id, 'FINANCEIRO');

  const draft = w.catalog.createDraft(semDados.id, 'shopee');
  const peso = growth.dataCompletion.open({ companyId: company.id,
    productId: semDados.id, draftId: draft.id, marketplace: 'shopee',
    field: 'pesoEmbalado', criticality: 'BLOCKER' });
  assert.ok(peso.created);
  assert.equal(peso.request.product_id, semDados.id);
  assert.equal(peso.request.listing_draft_id, draft.id);
  assert.equal(peso.request.marketplace, 'shopee');
  assert.equal(peso.request.responsible_role, 'OPERADOR_CATALOGO');
  assert.equal(peso.request.responsible_user, op.id, 'peso → produção/expedição');
  assert.equal(peso.request.unassigned, 0);
  const custo = growth.dataCompletion.open({ companyId: company.id,
    productId: semDados.id, field: 'custo' });
  assert.equal(custo.created, false, 'custo JÁ preenchido → pergunta não criada');
});

/* DC 2 + 3 — pergunta com contexto, agrupada, com formato sugerido */
test('pergunta agrupa pendências com produto, praça, motivo e formato de resposta', async () => {
  const w = blockedWorld();
  const { growth, company, semDados } = w;
  const r1 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'pesoEmbalado', criticality: 'BLOCKER' });
  const r2 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'material', criticality: 'BLOCKER' });
  const r3 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'embalagem', criticality: 'HIGH' });
  const asked = await growth.dataCompletion.ask(
    [r1.request.id, r2.request.id, r3.request.id],
    { channel: 'whatsapp', to: ADMIN_PHONE });
  assert.match(asked.question, /rascunho shopee do Espelho Orgânico 170x70/);
  assert.match(asked.question, /1\. Peso embalado/);
  assert.match(asked.question, /2\. Material/);
  assert.match(asked.question, /Pode responder assim/);
  assert.match(asked.question, /peso 14,2 kg \| material vidro 4 mm/);
  assert.ok(!/^Qual o peso\?$/m.test(asked.question), 'nunca pergunta solta');
  /* pergunta repetida não é recriada */
  const again = growth.dataCompletion.open({ companyId: company.id,
    productId: semDados.id, marketplace: 'shopee', field: 'pesoEmbalado' });
  assert.equal(again.created, false);
  assert.match(again.reason, /já aberta/);
});

/* DC 5 + 6 + 8 + 9 — interpretação natural, campo certo, versão e auditoria */
test('resposta natural atualiza SÓ o campo certo, com fonte, versão e auditoria', async () => {
  const w = blockedWorld();
  const { growth, company, semDados, mos } = w;
  const r1 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'pesoEmbalado' });
  const r2 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'material' });
  await growth.dataCompletion.ask([r1.request.id, r2.request.id],
    { channel: 'whatsapp', to: ADMIN_PHONE });
  w.catalog.createDraft(semDados.id, 'shopee');
  const beforeVersions = mos.repos.listingDraft.count('WHERE product_id = ?', semDados.id);

  const ans = await growth.dataCompletion.answer({ companyId: company.id,
    from: ADMIN_PHONE, text: 'peso 14,2 kg | material vidro 4 mm' });
  assert.ok(ans.handled);
  assert.match(ans.reply, /Atualizei/);
  assert.match(ans.reply, /Nenhum anúncio foi publicado/);

  const profile = mos.repos.productProfile.db.get(
    'SELECT * FROM product_profile WHERE product_id = ?', semDados.id);
  assert.equal(profile.packed_weight_g, 14200, '14,2 kg → 14200 g normalizado');
  assert.equal(JSON.parse(profile.tech_sheet_json).material, 'vidro 4,0 mm'.replace('4,0', '4'),
    'material atualizado');
  assert.equal(profile.cost, 210, 'custo NÃO foi tocado — só os campos perguntados');
  const sources = JSON.parse(profile.field_sources_json);
  assert.equal(sources.packed_weight_g, 'WHATSAPP_COMMAND', 'fonte registrada');
  /* nova versão de draft (valor anterior/novo na pendência) */
  const afterVersions = mos.repos.listingDraft.count('WHERE product_id = ?', semDados.id);
  assert.ok(afterVersions > beforeVersions, 'revalidação gerou nova versão de draft');
  const resolved = mos.repos.dataRequest.byId(r1.request.id);
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.answered_by, ADMIN_PHONE);
  assert.ok(mos.repos.audit.tail(30).some(a =>
    a.actor === 'data-request' && a.action === 'resolved'));
});

/* DC extra — extenso, medidas, estoque, custo */
test('interpretação: "quatorze quilos", "170 por 70", "18 unidades", "custa 79 reais"', () => {
  const w = world();
  const dc = w.growth.dataCompletion;
  const p1 = dc.interpret('quatorze quilos');
  assert.deepEqual(p1[0], { field: 'pesoEmbalado', value: 14000, display: '14 kg' });
  const p2 = dc.interpret('mede 170 por 70');
  assert.equal(p2[0].field, 'medidas');
  assert.deepEqual(p2[0].value, { h: 170, w: 70, d: null });
  const p3 = dc.interpret('temos 18 unidades');
  assert.deepEqual(p3.find(x => x.field === 'estoque').value, 18);
  const p4 = dc.interpret('custa 79 reais');
  assert.equal(p4.find(x => x.field === 'custo').value, 79);
  const p5 = dc.interpret('kit com 3 peças');
  assert.equal(p5.find(x => x.field === 'kit').value, 3);
});

/* DC 7 — resposta ambígua exige confirmação (nunca assume) */
test('resposta que serviria a dois produtos exige confirmação explícita', async () => {
  const w = blockedWorld();
  const { growth, company, semDados, catalog } = w;
  const outro = catalog.upsertMaster(company.id, {
    master: { companyId: company.id, name: 'Espelho Redondo 60cm', sku: 'ESP-RED' },
    profile: { techSheet: {}, heightCm: 60, widthCm: 60, cost: 90, basePrice: 219 },
    assets: [], byPlatform: {} });
  const r1 = growth.dataCompletion.open({ companyId: company.id,
    productId: semDados.id, marketplace: 'shopee', field: 'pesoEmbalado' });
  const r2 = growth.dataCompletion.open({ companyId: company.id,
    productId: outro.id, marketplace: 'shopee', field: 'pesoEmbalado' });
  await growth.dataCompletion.ask([r1.request.id], { channel: 'whatsapp', to: ADMIN_PHONE });
  await growth.dataCompletion.ask([r2.request.id], { channel: 'whatsapp', to: ADMIN_PHONE });
  const ans = await growth.dataCompletion.answer({ companyId: company.id,
    from: ADMIN_PHONE, text: '14,2 kg' });
  assert.ok(ans.needsConfirmation, 'não assume — pede confirmação');
  assert.match(ans.reply, /Você está confirmando 14,2 kg para peso embalado do Espelho/);
  /* confirmação aplica no produto certo */
  const conf = await growth.dataCompletion.answer({ companyId: company.id,
    from: ADMIN_PHONE, text: 'sim' });
  assert.ok(conf.handled);
  const p = w.mos.repos.productProfile.db.get(
    'SELECT packed_weight_g FROM product_profile WHERE product_id = ?', semDados.id);
  assert.equal(p.packed_weight_g, 14200);
});

/* DC 10 + 11 — revalidação de drafts afetados + encerramento da pendência */
test('resposta revalida os drafts afetados e encerra a pendência com retorno honesto', async () => {
  const w = blockedWorld();
  const { growth, company, semDados } = w;
  w.catalog.createDraft(semDados.id, 'shopee');
  const r1 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'pesoEmbalado', criticality: 'BLOCKER' });
  await growth.dataCompletion.ask([r1.request.id], { channel: 'whatsapp', to: ADMIN_PHONE });
  const ans = await growth.dataCompletion.answer({ companyId: company.id,
    from: ADMIN_PHONE, text: 'peso 14,2 kg' });
  assert.ok(ans.applied.length);
  const reval = ans.applied[0].revalidation;
  assert.ok(reval.drafts.length, 'drafts do produto revalidados');
  assert.equal(reval.drafts[0].marketplace, 'shopee');
  assert.equal(w.mos.repos.dataRequest.byId(r1.request.id).status, 'RESOLVED');
  /* controle: "não sei" e "depois" mantêm a pendência aberta sem drama */
  const r2 = growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
    marketplace: 'shopee', field: 'material' });
  await growth.dataCompletion.ask([r2.request.id], { channel: 'whatsapp', to: ADMIN_PHONE });
  const later = await growth.dataCompletion.answer({ companyId: company.id,
    from: ADMIN_PHONE, text: 'depois' });
  assert.equal(later.control, 'postponed');
  assert.equal(w.mos.repos.dataRequest.byId(r2.request.id).status, 'OPEN');
});

/* DC 12 — WhatsApp responde pendência mas NUNCA publica; DC 14 — isolamento */
test('fluxo WhatsApp completo de pendência: sem publicação externa; empresas isoladas', async () => {
  const w = blockedWorld();
  const { growth, company, semDados, mos } = w;
  const draft = w.catalog.createDraft(semDados.id, 'shopee');
  const reqs = [
    growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
      draftId: draft.id, marketplace: 'shopee', field: 'pesoEmbalado' }).request,
    growth.dataCompletion.open({ companyId: company.id, productId: semDados.id,
      draftId: draft.id, marketplace: 'shopee', field: 'material' }).request];
  await growth.dataCompletion.ask(reqs.map(r => r.id), { channel: 'whatsapp', to: ADMIN_PHONE });
  /* resposta chega pelo GATEWAY (mesmo caminho do WhatsApp oficial) */
  const gw = await growth.gateway.handle({ companyId: company.id, from: ADMIN_PHONE,
    text: 'peso 14,2 kg | material vidro 4 mm' });
  assert.ok(gw.dataCompletion);
  assert.match(gw.reply, /Atualizei/);
  assert.match(gw.reply, /Nenhum anúncio foi publicado/);
  /* nada de publicação: nenhum pilot_run, nenhuma escrita externa */
  assert.equal(mos.repos.pilotRun.count(), 0);
  /* isolamento: pendência de outra empresa não aparece nem responde */
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'b2@x.y', companyName: 'B2', marketplaces: ['shopee'] });
  const none = await growth.dataCompletion.answer({ companyId: b.id,
    from: ADMIN_PHONE, text: 'peso 9 kg' });
  assert.equal(none.handled, false, 'empresa B não tem pendências deste respondente');
  assert.equal(growth.dataCompletion.board(b.id).length, 0);
});

/* v6 — Operação com "Criar anúncio" + demo do Data Completion */
test('v6: botão Criar anúncio na Operação e demo de pendência→WhatsApp→revalidação', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v6/index.html'), 'utf8');
  assert.match(html, /Criar anúncio/);
  const anuncio = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v6/anuncio.js'), 'utf8');
  for (const s of ['Adicionar foto', 'Adicionar link', 'Selecionar produto'])
    assert.ok(html.includes(s), `toolbar do compositor: ${s}`);
  for (const s of ['Abrir no Catálogo', 'produto real', 'referência'])
    assert.ok(anuncio.includes(s), `fluxo de anúncio: ${s}`);
  assert.match(anuncio, /Rascunho Shopee criado/);
  const cat = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v6/catalogo.js'), 'utf8');
  assert.match(cat, /Perguntar no WhatsApp/);
});

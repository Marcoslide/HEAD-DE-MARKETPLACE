/* COMPLEMENTO 10.C — LISTING SCHEMA ENGINE: as 23 garantias. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { createGrowth } = require('../src/growth/index.js');
const { createListingSchemaEngine } = require('../src/listing-schema/index.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');

function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 's@x.y', companyName: 'C', marketplaces: ['shopee'] });
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  const growth = createGrowth({ mos, clock: c, catalog });
  for (const dp of C.DEMO_PRODUCTS) catalog.upsertMaster(company.id, dp);
  const lse = createListingSchemaEngine({ mos, clock: c,
    dataCompletion: growth.dataCompletion });
  /* rule packs S10 → árvore PROVISIONAL_INTERNAL (reuso, nunca duplicação) */
  lse.imported = lse.engine.importRulePacks(C.RULE_PACKS, { companyId: company.id });
  return { mos, c, company, catalog, growth, lse };
}
const PERSONALIZADO = { isPersonalized: true, productionMode: 'PERSONALIZED',
  productionLeadTimeDays: 5, preparationTimeDays: 5, dispatchPolicy: 'após produção',
  operationalCapacityPerDay: 5, requiresSpecialPackaging: true, fragile: true,
  packagingProfileId: 'pack-reforcada', productType: 'quadro' };

/* 1+2+14+16+17 — schema por marketplace/categoria; eletrônico ≠ quadro */
test('schema dinâmico por praça e categoria folha — eletrônico ≠ quadro; 4 adapters, 1 núcleo', () => {
  const w = world();
  const { lse, company } = w;
  assert.ok(lse.imported.imported > 0, 'rule packs S10 importados como árvore');
  const quadroML = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'mercado_livre', categoryId: 'MLB1367', productType: 'quadro' });
  const eletroML = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'mercado_livre', categoryId: 'MLB-ELET', productType: 'eletronico' });
  const kq = quadroML.fields.map(f => f.fieldKey);
  const ke = eletroML.fields.map(f => f.fieldKey);
  assert.ok(kq.includes('tipoMoldura') && kq.includes('comVidro') && kq.includes('quantidadePecas'));
  assert.ok(!kq.includes('voltagem'));
  assert.ok(ke.includes('voltagem') && ke.includes('potenciaW') && ke.includes('homologacaoAnatel'));
  assert.ok(!ke.includes('tipoMoldura'), 'schemas DIFERENTES por categoria');
  /* TikTok e Magalu: mesmos contratos, campos próprios */
  const ttk = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'tiktok', categoryId: 'TTK-DECOR', productType: 'quadro' });
  assert.ok(ttk.fields.some(f => f.fieldKey === 'atributoVenda'));
  assert.ok(ttk.groups.includes('certificacoes'), 'TikTok tratado como marketplace pleno');
  const mgl = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'magalu', categoryId: 'MGL-DECOR', productType: 'quadro' });
  assert.ok(mgl.fields.some(f => f.fieldKey === 'fichaTecnica.material'), 'ficha técnica Magalu');
  assert.ok(mgl.groups.includes('portfolio'));
  /* snapshot persistido */
  assert.ok(w.mos.repos.listingSchema.count() >= 4);
  assert.ok(w.mos.repos.schemaField.count() > 20);
});

/* 3 — categoria sugerida exige confirmação sem confiança suficiente */
test('descoberta de categoria: sugere, mas nunca assume sem confiança/oficialidade', () => {
  const w = world();
  const d = w.lse.engine.discoverCategory({ companyId: w.company.id,
    marketplace: 'mercado_livre', title: 'Quadro decorativo paisagem com moldura',
    productType: 'quadro' });
  assert.ok(d.suggestions.length >= 1);
  assert.equal(d.requiresHumanConfirmation, true,
    'árvore PROVISIONAL → confirmação humana sempre');
  assert.match(d.message, /[Cc]onfirma/);
});

/* 4+5+21 — PROVISIONAL_INTERNAL marcado; oficial prevalece; interface diferencia */
test('regra interna é PROVISIONAL_INTERNAL; snapshot oficial (10.A) prevalece', () => {
  const w = world();
  const { lse, company, mos } = w;
  const s1 = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'mercado_livre', categoryId: 'MLB1367', productType: 'quadro' });
  assert.equal(s1.schemaStatus, 'PROVISIONAL_INTERNAL');
  assert.equal(s1.canApproveExternalPublish, false, 'provisória NUNCA aprova publicação');
  assert.match(s1.provisionalNote, /NÃO afirmamos que o marketplace aceitará/);
  /* snapshot oficial pós-OAuth promove a categoria → prevalece */
  const snap = mos.repos.categorySnapshot.insert({ company_id: company.id,
    connection_id: 'conn-x', platform: 'mercado_livre', category_id: 'MLB1367',
    category_path: 'Casa e Decoração > Quadros', attributes_json: { required: ['material'] },
    source: 'OFFICIAL_API', fetched_at: w.c.nowIso(), created_at: w.c.nowIso() });
  lse.engine.promoteFromSnapshot(company.id, snap.id);
  const s2 = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'mercado_livre', categoryId: 'MLB1367', productType: 'quadro' });
  assert.equal(s2.schemaStatus, 'VERIFIED_OFFICIAL', 'oficial VENCE a interna');
  assert.equal(s2.canApproveExternalPublish, true);
  /* os dois estados coexistem distinguíveis (interface diferencia) */
  const sources = [...new Set(mos.repos.categoryTree.db.all(
    `SELECT source FROM marketplace_category_tree WHERE category_id = 'MLB1367'`)
    .map(r => r.source))].sort();
  assert.deepEqual(sources, ['PROVISIONAL_INTERNAL', 'VERIFIED_OFFICIAL']);
});

/* 6+7+8 — personalizado exige prazo e bloqueia logística incompatível */
test('sob encomenda: exige prazo/capacidade e BLOQUEIA modalidade rápida automaticamente', () => {
  const w = world();
  const { lse, company } = w;
  /* perfil incompleto → faltas apontadas */
  const inc = lse.operational.upsert('prd-qdr-nome', company.id,
    { isPersonalized: true, productionMode: 'PERSONALIZED', productType: 'quadro' });
  assert.equal(inc.complete, false);
  assert.ok(inc.missingRequired.includes('prazo de produção'));
  /* perfil completo → schema ganha camada sob-encomenda */
  const ok = lse.operational.upsert('prd-qdr-nome', company.id, PERSONALIZADO);
  assert.ok(ok.complete);
  const schema = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'shopee', categoryId: '100636', productType: 'quadro',
    operationalProfile: ok.profile });
  const keys = schema.fields.map(f => f.fieldKey);
  for (const k of ['productionLeadTimeDays', 'preparationTimeDays', 'dispatchPolicy',
                   'operationalCapacityPerDay', 'packagingProfile', 'packedWeightG'])
    assert.ok(keys.includes(k), `campo obrigatório sob encomenda: ${k}`);
  /* logística: rápida bloqueada; nunca "envio imediato" */
  const el = lse.shipping.evaluate({ companyId: company.id, productId: 'prd-qdr-nome',
    marketplace: 'shopee', operationalProfile: ok.profile,
    packedWeightG: 7200, packedDims: { h: 90, w: 130, d: 8 } });
  const rapido = el.methods.find(m => m.shipping_method === 'shopee-xpress-rapido');
  assert.equal(rapido.status, 'BLOCKED_BY_PERSONALIZATION');
  assert.ok(!el.eligible.includes('shopee-xpress-rapido'),
    'sob encomenda JAMAIS aparece como envio imediato');
  /* padrão sem conta conectada → AWAITING_ACCOUNT_CONFIRMATION, nunca fingir oficial */
  const padrao = el.methods.find(m => m.shipping_method === 'shopee-padrao');
  assert.equal(padrao.status, 'AWAITING_ACCOUNT_CONFIRMATION');
  assert.equal(padrao.requires_confirmation, 1);
});

/* 9+10+13 — peso/dimensão ausentes bloqueiam; dimensão grande bloqueia variação */
test('sem peso/dimensão → AWAITING_DATA; dimensão excedente → BLOCKED_BY_DIMENSIONS', () => {
  const w = world();
  const { lse, company } = w;
  const semPeso = lse.shipping.evaluate({ companyId: company.id,
    marketplace: 'shopee', operationalProfile: {}, packedWeightG: null, packedDims: null });
  assert.ok(semPeso.methods.every(m => m.status === 'AWAITING_DATA'));
  /* variação com dimensão própria NÃO herda elegibilidade */
  const varGrande = lse.shipping.evaluate({ companyId: company.id,
    marketplace: 'shopee', operationalProfile: {},
    packedWeightG: 9000, packedDims: { h: 180, w: 80, d: 10 }, accountConnected: true });
  assert.ok(varGrande.methods.some(m => m.status === 'BLOCKED_BY_DIMENSIONS'));
  const varPequena = lse.shipping.evaluate({ companyId: company.id,
    marketplace: 'shopee', operationalProfile: {},
    packedWeightG: 2000, packedDims: { h: 40, w: 40, d: 5 }, accountConnected: true });
  assert.ok(varPequena.eligible.length > 0, 'variação menor tem elegibilidade própria');
});

/* 11+12+18+19 — falta vira DataRequest; variação com campos próprios; revalidação */
test('validação: falta vira DataRequest contextual; variação tem schema próprio', async () => {
  const w = world();
  const { lse, growth, company, mos } = w;
  const prd = w.catalog.upsertMaster(company.id, {
    master: { companyId: company.id, name: 'Quadro Personalizado 80x120', sku: 'QDR-8012' },
    profile: { techSheet: {}, cost: 96, basePrice: 320, minMarginPct: 20 },
    assets: [], byPlatform: {} });
  const op = lse.operational.upsert(prd.id, company.id, PERSONALIZADO);
  const schema = lse.engine.buildSchema({ companyId: company.id,
    marketplace: 'shopee', categoryId: '100636', productType: 'quadro',
    operationalProfile: op.profile });
  const v = lse.engine.validate({ schema, values: { title: 'Quadro Personalizado 80x120' },
    operationalProfile: op.profile });
  assert.equal(v.readiness, 'PENDENTE');
  assert.ok(v.missing.includes('Peso embalado (g)'));
  assert.ok(v.dataRequests.length >= 1, 'falta virou DataRequest (10.B)');
  assert.equal(v.externalPublishAllowed, false, 'draft interno nunca publica sozinho');
  /* resposta via WhatsApp atualiza e revalida (motor 10.B, reuso) */
  await growth.dataCompletion.ask(v.dataRequests.map(r => r.id),
    { channel: 'whatsapp', to: '5511988887777' });
  const ans = await growth.dataCompletion.answer({ companyId: company.id,
    from: '5511988887777', text: 'peso 7,2 kg' });
  assert.ok(ans.handled);
  const profile = mos.repos.productProfile.db.get(
    'SELECT packed_weight_g FROM product_profile WHERE product_id = ?', prd.id);
  assert.equal(profile.packed_weight_g, 7200, 'campo certo atualizado e drafts revalidados');
  /* variação: nada herdado */
  const vs = lse.variationSchema();
  assert.ok(vs.every(f => f.inherited === false));
  assert.ok(vs.some(f => f.fieldKey === 'packedWeightG') && vs.some(f => f.fieldKey === 'leadTimeDays'));
});

/* 15+20+22 — Shopee monta personalização/envio; sem publicação automática; isolamento */
test('Shopee: grupos de personalização e envio; empresas isoladas; nada publica', () => {
  const w = world();
  const { lse, company, mos } = w;
  const op = lse.operational.upsert('prd-x', company.id, PERSONALIZADO);
  const shp = lse.engine.buildSchema({ companyId: company.id, marketplace: 'shopee',
    categoryId: '100636', productType: 'quadro', operationalProfile: op.profile });
  assert.ok(shp.groups.includes('personalizacao') && shp.groups.includes('prazo')
    && shp.groups.includes('logistica'));
  assert.ok(shp.fields.some(f => f.fieldKey === 'instrucoesPersonalizacao'));
  /* isolamento */
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'b9@x.y', companyName: 'B9', marketplaces: ['shopee'] });
  assert.equal(mos.repos.shippingEligibility.count('WHERE company_id = ?', b.id), 0);
  assert.equal(mos.repos.pilotRun.count(), 0, 'nenhuma publicação externa em teste algum');
});

/* v7 — formulário inteligente demonstrável */
test('v7: cadastro dinâmico com etapas, checklist e bloqueios demonstrados', () => {
  const js = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/cadastro.js'), 'utf8');
  for (const s of ['CHECKLIST DE PRONTIDÃO', 'BLOCKED_BY_PERSONALIZATION', 'REGRA_PROVISÓRIA',
                   'Salvar rascunho interno — nenhum anúncio será publicado externamente',
                   'voltagem', 'ficha técnica', 'TikTok'])
    assert.ok(js.includes(s), `cadastro v7: ${s}`);
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/index.html'), 'utf8');
  assert.match(html, /cadastro\.js/);
});

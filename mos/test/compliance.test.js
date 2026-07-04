/* SPRINT 10 — CATALOG, RULE & COMPLIANCE ENGINE: os 30 testes obrigatórios.
   Leitura, validação, rascunho e recomendação INTERNA. Sem publicação. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { CentralBridge } = require('../src/central/central-bridge.js');
const { ReadOnlyViolationError, WRITE_ACTIONS } = require('../src/central/connector-contract.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('../src/central/fixtures/index.js');
const { DECLARATIONS } = require('../src/central/declarations.js');
const { createHeadChat } = require('../src/chat/index.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
const product = sku => C.DEMO_PRODUCTS.find(p => p.master.sku === sku);
const evalP = (sku, platform, c = clock()) => C.evaluate(product(sku), platform, { clock: c });

function world() {
  const c = clock();
  const mos = createMOS();
  const mie = MIE.createMIE({ seed: 42, clock: c });
  new CentralBridge({ mosBus: mos.bus, mie });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: `t${Math.random ? '' : ''}c@x.y`.replace('tc', 't' + Date.now?.name || 'x'),
    companyName: 'C', marketplaces: ['mercado_livre', 'shopee'] });
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  return { mos, mie, company, catalog, clock: c };
}

/* 1 — auditoria: reutiliza catálogo/listing/draft existentes, sem duplicar */
test('reuso: Product Master é a tabela product; nada duplicado', () => {
  const { mos, company, catalog } = world();
  const before = mos.repos.product.count();
  const p = catalog.upsertMaster(company.id, product('QDR-SER'));
  assert.equal(mos.repos.product.count(), before + 1, 'produto vive na tabela product existente');
  catalog.upsertMaster(company.id, product('QDR-SER'));   // idempotente por SKU
  assert.equal(mos.repos.product.count(), before + 1, 'upsert não duplica o master');
  assert.ok(mos.repos.productProfile.db.get('SELECT id FROM product_profile WHERE product_id = ?', p.id));
  mos.close();
});

/* 2 — novo marketplace registra rule pack sem alterar o núcleo */
test('novo marketplace: rule pack registrável via registry existente', () => {
  const { mos } = world();
  const pack = { platform: 'americanas_test', version: 'ame-0.1', verifiedAt: '2026-07-04',
    dataSource: 'DEMO_RULE_FIXTURE', taxonomy: [], requirements: [] };
  mos.providers.registerRulePack(pack);
  assert.ok(mos.providers.hasRulePack('americanas_test'));
  assert.equal(mos.providers.rulePack('americanas_test').version, 'ame-0.1');
  const r = C.evaluate(product('QDR-SER'), 'americanas_test',
    { rulePacks: { americanas_test: pack }, clock: clock() });
  assert.notEqual(r.status, 'NOT_SUPPORTED', 'o motor avalia a nova praça sem mudança no núcleo');
  mos.close();
});

/* 3 — regra de categoria carrega versão e fonte */
test('toda regra e taxonomia carregam fonte, versão, verificação e status', () => {
  for (const pack of Object.values(C.RULE_PACKS)) {
    assert.ok(pack.version && pack.verifiedAt && pack.dataSource);
    for (const cat of pack.taxonomy)
      assert.ok(cat.sourceType && cat.sourceReference && cat.status, `${cat.categoryId} com proveniência`);
    for (const r of pack.requirements) {
      assert.ok(r.sourceType && r.sourceReference, `${r.id} tem fonte`);
      assert.ok(C.NS.RULE_STATUS.includes(r.status), `${r.id} tem status válido`);
      assert.ok(C.NS.SOURCE_TYPES.includes(r.sourceType), `${r.id} fonte válida`);
    }
  }
});

/* 4 — categoria de baixa confiança gera REVIEW_REQUIRED */
test('categoria com baixa confiança exige revisão', () => {
  const generic = { master: { id: 'x', companyId: 'demo', name: 'Painel', sku: 'X1' },
    profile: { productType: null, description: '', techSheet: {}, fiscal: {}, basePrice: 50, cost: 20 },
    assets: [{ kind: 'image', role: 'main', width: 1000, height: 1000, sizeKb: 100 }],
    byPlatform: { shopee: { title: 'Painel', attributes: { material: 'mdf' }, price: 50, stock: 5 } } };
  const s = C.suggestCategory(generic, C.RULE_PACKS.shopee);
  assert.equal(s.status, 'LOW_CONFIDENCE');
  assert.equal(s.reviewRequired, true);
  const r = C.evaluate(generic, 'shopee', { clock: clock() });
  assert.notEqual(r.status, 'READY');
  assert.notEqual(r.status, 'READY_WITH_WARNINGS');
});

/* 5 — código de categoria NUNCA é inventado */
test('categoria sugerida sempre existe na taxonomia do pack', () => {
  for (const p of C.DEMO_PRODUCTS)
    for (const platform of Object.keys(C.RULE_PACKS)) {
      const s = C.suggestCategory(p, C.RULE_PACKS[platform]);
      if (s.categoryId)
        assert.ok(C.RULE_PACKS[platform].taxonomy.some(c => c.categoryId === s.categoryId),
          `${s.categoryId} existe na taxonomia de ${platform}`);
    }
});

/* 6 — atributo obrigatório ausente → finding rastreável */
test('atributo obrigatório ausente gera finding com regra e fonte', () => {
  const r = evalP('ESP-ORG', 'shopee');
  const f = r.findings.find(x => x.category === 'REQUIRED_ATTRIBUTES' && /material/.test(x.field));
  assert.ok(f, 'finding do atributo material');
  assert.equal(f.severity, 'BLOCKER');
  assert.ok(f.rule.sourceReference && f.rule.rulePackVersion, 'rastreável até a regra');
});

/* 7 — imagem inválida gera finding correto */
test('imagens: quantidade insuficiente e resolução baixa geram findings', () => {
  const r1 = evalP('ESP-ORG', 'shopee');
  assert.ok(r1.findings.some(f => f.rule.id === 'shp-images-min' && f.severity === 'BLOCKER'));
  const r2 = evalP('QDR-SER', 'mercado_livre');
  assert.ok(r2.findings.some(f => f.rule.id === 'ml-image-resolution' && f.severity === 'WARNING'),
    'imagem 480px → alerta de resolução');
});

/* 8 — peso/dimensões ausentes geram finding */
test('peso e dimensões ausentes bloqueiam a logística', () => {
  const r = evalP('ESP-ORG', 'shopee');
  assert.ok(r.findings.some(f => f.rule.id === 'shp-packed-weight' && f.severity === 'BLOCKER'));
  assert.equal(r.status, 'BLOCKED');
});

/* 9 — prazo de personalizado incompatível → HIGH_RISK */
test('personalizado com prazo acima do teto gera HIGH_RISK', () => {
  const r = evalP('QDR-NOME', 'shopee');
  const f = r.findings.find(x => x.rule.id === 'shp-dts-max');
  assert.ok(f && f.severity === 'HIGH_RISK');
  assert.ok(r.findings.some(x => x.rule.id === 'int-custom-capacity' && x.severity === 'HIGH_RISK'),
    'capacidade vs demanda também acusada');
});

/* 10 + 28 — regra interna separada da oficial, sem fingir bloqueio da praça */
test('margem/regra interna aparece como interna, nunca como bloqueio oficial', () => {
  const cheap = JSON.parse(JSON.stringify(product('KIT3-ABS')));
  cheap.byPlatform.shopee.price = 80;      // margem (80-74.9)/80 ≈ 6% < 20%
  const r = C.evaluate(cheap, 'shopee', { clock: clock() });
  const f = r.findings.find(x => x.rule.id === 'int-min-margin');
  assert.ok(f, 'regra interna de margem disparou');
  assert.equal(f.severity, 'HIGH_RISK');
  assert.equal(f.internal, true, 'marcada como interna');
  assert.equal(f.rule.sourceType, 'INTERNAL_OPERATIONAL_RULE');
  assert.notEqual(f.severity, 'BLOCKER', 'não vira bloqueio oficial');
  /* separação visível: internas × oficiais */
  const oficial = r.findings.filter(x => !x.internal);
  const internas = r.findings.filter(x => x.internal);
  assert.ok(internas.length > 0 && oficial.length >= 0);
});

/* 11 — regra UNKNOWN impede READY */
test('regra UNKNOWN não satisfeita → REVIEW_REQUIRED, nunca READY', () => {
  const r = evalP('KIT3-ABS', 'mercado_livre');   // sem EAN + exigência GTIN não confirmada
  assert.ok(r.findings.some(f => f.severity === 'UNKNOWN'));
  assert.equal(r.status, 'REVIEW_REQUIRED');
  assert.match(r.findings.find(f => f.severity === 'UNKNOWN').message, /não está confirmada/);
});

/* 12 — PROVISIONAL nunca gera aprovação definitiva */
test('regras PROVISIONAL impedem READY puro (nota de não-aprovação-oficial)', () => {
  const r = evalP('QDR-SER', 'mercado_livre');
  assert.ok(r.provisionalApplied > 0);
  assert.notEqual(r.status, 'READY', 'com provisórias aplicadas, nunca READY absoluto');
  assert.match(r.disclaimer, /não é aprovação oficial/);
});

/* 13 — resultado DIFERENTE por marketplace para o mesmo produto */
test('mesmo produto, veredito por praça (KIT3-ABS)', () => {
  assert.equal(evalP('KIT3-ABS', 'shopee').status, 'READY_WITH_WARNINGS');
  assert.equal(evalP('KIT3-ABS', 'magalu').status, 'BLOCKED');
  assert.equal(evalP('KIT3-ABS', 'tiktok').status, 'REVIEW_REQUIRED');
});

/* 14 — Product Master não mistura dados de praças */
test('projeções por praça são independentes (título/preço/categoria)', () => {
  const p = product('KIT3-ABS');
  assert.notEqual(p.byPlatform.shopee.title, p.byPlatform.mercado_livre.title);
  assert.notEqual(p.byPlatform.shopee.price, p.byPlatform.mercado_livre.price);
  const rShp = evalP('KIT3-ABS', 'shopee'), rMgl = evalP('KIT3-ABS', 'magalu');
  assert.notEqual(rShp.rulePackVersion, rMgl.rulePackVersion, 'cada praça valida com o próprio pack');
});

/* 15 — empresa A não acessa catálogo/validação da empresa B */
test('isolamento multiempresa no catálogo e nas validações', () => {
  const c = clock();
  const mos = createMOS();
  const A = mos.services.workspace.bootstrap({ workspaceName: 'WA', email: 'a@a.a', companyName: 'A' });
  const B = mos.services.workspace.bootstrap({ workspaceName: 'WB', email: 'b@b.b', companyName: 'B' });
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus, providers: mos.providers, clock: c });
  const pa = catalog.upsertMaster(A.company.id, product('QDR-SER'));
  catalog.upsertMaster(B.company.id, product('ESP-ORG'));
  catalog.validate(pa.id, 'mercado_livre');
  const boardA = catalog.board(A.company.id);
  assert.ok(boardA.every(b => b.sku === 'QDR-SER'), 'A só vê os próprios produtos');
  const runsB = mos.repos.validationRun.db.all('SELECT * FROM validation_run WHERE company_id = ?', B.company.id);
  assert.equal(runsB.length, 0, 'validação de A não vaza para B');
  mos.close();
});

/* 16 + 17 — Validation Run preserva regra/versão/fonte/hora; histórico não é sobrescrito */
test('trilha de auditoria: runs preservados com pack, fonte e horário', () => {
  const { mos, company, catalog } = world();
  const p = catalog.upsertMaster(company.id, product('ESP-ORG'));
  catalog.validate(p.id, 'shopee');
  catalog.validate(p.id, 'shopee');            // segunda validação
  const runs = catalog.history(p.id, 'shopee');
  assert.equal(runs.length, 2, 'histórico não sobrescrito');
  for (const r of runs) {
    assert.equal(r.rule_pack_version, 'shp-demo-1.1');
    assert.equal(r.data_source, 'DEMO_RULE_FIXTURE');
    assert.equal(r.executed_at, '2026-07-04T12:00:00.000Z');
    assert.ok(JSON.parse(r.findings_json).length > 0, 'findings do momento preservados');
  }
  /* "por que estava bloqueado no dia 4?" → responde com o run daquele dia */
  assert.equal(runs[0].status, 'BLOCKED');
  mos.close();
});

/* 18 — rascunho criado SEM publicar */
test('rascunho interno: criado, versionado e nada publicado', () => {
  const { mos, company, catalog } = world();
  const p = catalog.upsertMaster(company.id, product('QDR-SER'));
  const d1 = catalog.createDraft(p.id, 'mercado_livre');
  const d2 = catalog.createDraft(p.id, 'mercado_livre');
  assert.equal(d1.status, 'READY_FOR_REVIEW');
  assert.equal(d2.version, d1.version + 1, 'versões preservadas');
  assert.equal(d1.readOnly, true);
  assert.match(d1.suggestionsSource, /rule pack/);
  /* NADA publicado: histórico de publicação intocado */
  assert.equal(mos.repos.publication.count(), 0, 'nenhuma publicação registrada');
  assert.equal(mos.repos.listing.db.all(`SELECT * FROM listing WHERE external_id IS NOT NULL`).length, 0);
  mos.close();
});

/* 19 + 20 — READ_ONLY bloqueia publicação; nenhum conector ganha escrita */
test('READ_ONLY: supportsExternalPublish=false e escrita bloqueada em todos', async () => {
  for (const d of Object.values(DECLARATIONS)) {
    assert.equal(d.compliance.supportsExternalPublish, false, `${d.id} não publica`);
    assert.equal(d.capabilities.listingsWrite, false);
  }
  const c = clock();
  const mos = createMOS();
  const central = createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport() });
  for (const name of ['mercado_livre', 'shopee', 'tiktok', 'magalu']) {
    const conn = central.registry.connector(name);
    for (const action of WRITE_ACTIONS)
      assert.throws(() => conn[action]({}), ReadOnlyViolationError);
  }
  mos.close();
});

/* 21 + 22 + 23 — sinais: relevante vira sinal INTERNAL_ONLY; irrelevante não */
test('finding relevante → sinal EPE INTERNAL_ONLY; pendência pequena não vira missão', () => {
  const { mos, mie, company, catalog } = world();
  for (const p of C.DEMO_PRODUCTS) catalog.upsertMaster(company.id, p);
  const { delivered } = catalog.refreshComplianceSignals(company.id);
  assert.ok(delivered.length >= 2, 'expansão impedida + prazo de personalizado');
  assert.ok(delivered.every(s => s.playbook.startsWith('compliance-')));
  /* alerta pequeno (imagem 480px do QDR-SER) NÃO virou sinal */
  assert.ok(!delivered.some(s => /resolução|480/.test(s.title)), 'warning pequeno não vira missão');
  mie.runDays(MIE.WARMUP_DAYS + 2);
  const plan = mie.planDay();
  const items = [...plan.decisions, ...plan.missions, ...plan.investigations]
    .filter(x => x.playbook && x.playbook.startsWith('compliance-'));
  assert.ok(items.length >= 1, 'compliance chega ao Plano do Dia');
  for (const i of items) assert.equal(i.executionScope, 'INTERNAL_ONLY');
  mos.close();
});

/* 24 + 25 + 26 — chat consulta o motor real, não inventa, informa fonte/versão */
test('chat: "o que falta para publicar?" responde pelo motor com fonte e versão', () => {
  const c = clock();
  const chat = createHeadChat({ clock: c,
    compliance: C.createComplianceAdapter({ products: C.DEMO_PRODUCTS, clock: c }) });
  const r = chat.ask('O que falta para publicar o espelho na Shopee?');
  assert.equal(r.intent, 'CATALOG_COMPLIANCE_QUERY');
  assert.equal(r.facts.kind, 'COMPLIANCE_STATUS');
  assert.equal(r.facts.result.status, 'BLOCKED');
  assert.match(r.reply, /peso embalado não informado/);
  assert.match(r.reply, /rule pack shp-demo-1\.1/, 'versão do pack na resposta');
  assert.match(r.reply, /verificado em 2026-07-04/, 'data de verificação');
  assert.match(r.reply, /Rule Pack Demo/, 'demo identificado, nunca vendido como oficial');
  /* não inventa: categoria vem da taxonomia; sem produto → lista, nunca chute */
  const kit = chat.ask('O Kit 3 Quadros pode ir para o Magalu?');
  assert.equal(kit.facts.result.category.categoryId, 'mgl-decoracao-quadros');
  assert.match(kit.reply, /requer confirmação humana/);
  const vago = chat.ask('Esse negócio está pronto para publicar na Shopee?');
  assert.equal(vago.facts.kind, 'COMPLIANCE_BOARD', 'produto ambíguo → visão de lista, nunca invenção');
});

/* 27 — dados demo identificados como DEMO_RULE_FIXTURE */
test('resultado carrega dataSource DEMO_RULE_FIXTURE', () => {
  const r = evalP('QDR-SER', 'mercado_livre');
  assert.equal(r.dataSource, 'DEMO_RULE_FIXTURE');
});

/* 29 — nenhum scraping/automação de navegador na obtenção de regras */
test('sem scraping/navegador no compliance; tempo só via Clock', () => {
  const dir = path.join(__dirname, '../src/compliance');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /playwright|puppeteer|selenium|headless|stealth|scrap/i, f);
    assert.doesNotMatch(src, /new\s+Date\s*\(\s*\)|Date\.now\s*\(/, `${f}: tempo só via Clock`);
  }
});

/* checklist do modo de revisão */
test('checklist de revisão cobre os itens exigidos', () => {
  const r = evalP('QDR-SER', 'mercado_livre');
  const itens = r.checklist.map(c => c.item);
  for (const esperado of ['categoria confirmada', 'atributos obrigatórios preenchidos',
    'imagens válidas', 'peso e medidas preenchidos', 'preço e margem revisados',
    'prazo validado', 'regras desconhecidas revisadas'])
    assert.ok(itens.some(i => i.includes(esperado.split(' ')[0])), esperado);
  assert.equal(r.checklist.find(c => c.item === 'categoria confirmada').ok, true);
});

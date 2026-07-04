/* SPRINT 10.K.1 — STRATEGIC EXPANSION: as 22 garantias. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createStrategy, diagnoseFunnel } = require('../src/knowledge/strategy.js');
const { createKnowledge } = require('../src/knowledge/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'st@x.y', companyName: 'C', marketplaces: ['shopee'] });
  const S = createStrategy({ mos, clock: c });
  S.seeded = S.seed();
  return { mos, c, company, S };
}

/* 1+2+3+4+5 — multinicho: outcomes diferentes por tipo; nada universal; isolado */
test('multinicho: eletrônico ≠ moda ≠ decoração; fixture de quadro nunca vira regra universal', () => {
  const { S, company, mos } = world();
  /* três nichos com perfis TOTALMENTE diferentes — mesmo motor */
  const fone = S.outcomes.upsert({ companyId: company.id, productId: 'prd-fone',
    productType: 'eletronico', source: 'CONFIRMED_BY_OWNER',
    functionalJob: 'trabalhar/estudar com menos distração',
    compatibilityRequired: 'Bluetooth 5+', usageRisk: 'incompatibilidade gera devolução',
    transformationStatement: 'menos distração e mais conforto no deslocamento',
    objections: ['funciona com meu celular?'] });
  const vestido = S.outcomes.upsert({ companyId: company.id, productId: 'prd-vestido',
    productType: 'moda', source: 'CONFIRMED_BY_OWNER',
    functionalJob: 'vestir bem em evento', socialJob: 'ser notada',
    objections: ['caimento', 'tamanho certo', 'troca fácil'],
    riskOfMisunderstanding: 'grade/caimento sem foto em uso' });
  const espelho = S.outcomes.upsert({ companyId: company.id, productId: 'prd-espelho',
    productType: 'decoracao', source: 'CONFIRMED_BY_OWNER',
    transformationStatement: 'amplia visualmente o ambiente e vira ponto de destaque' });
  assert.equal(fone.compatibility_required, 'Bluetooth 5+');
  assert.equal(vestido.social_job, 'ser notada');
  assert.notEqual(fone.functional_job, vestido.functional_job, 'perfis distintos por nicho');
  /* nenhuma coluna/regra específica de quadro no schema da entidade */
  const cols = mos.db.all(`PRAGMA table_info(product_outcome_profile)`).map(x => x.name);
  assert.ok(!cols.some(cn => /quadro|moldura|espelho|lider/i.test(cn)),
    'entidade PRODUCT_AGNOSTIC — nicho nunca vira coluna');
  /* isolamento por empresa e produto */
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'st2@x.y', companyName: 'B', marketplaces: ['shopee'] });
  assert.equal(S.outcomes.get(b.id, 'prd-fone'), null, 'empresa B não vê o perfil da A');
  assert.equal(S.outcomes.get(company.id, 'prd-outro'), null, 'perfil é por produto');
  assert.equal(espelho.status, 'DRAFT');
});

/* 6+7+8+18+21 — playbook ≠ regra oficial; R.E.A.L. preservado; quando usar/não usar */
test('playbooks: nunca oficiais, sempre com quando (não) usar, métrica, risco; R.E.A.L. só estratégia', () => {
  const { S, mos, c } = world();
  assert.ok(S.seeded.playbooks >= 6, 'seed multinicho carregada');
  /* playbook JAMAIS vira regra oficial */
  assert.throws(() => S.playbooks.add({ title: 'x', category: 'Ads Strategy',
    whenToUse: 'a', whenNotToUse: 'b', metrics: ['m'], risk: 'r',
    source: 's', confidence: 'VERIFIED_OFFICIAL' }), /nunca regra oficial/);
  assert.throws(() => S.playbooks.add({ title: 'x', category: 'Ads Strategy',
    whenToUse: 'a', whenNotToUse: null, metrics: ['m'], risk: 'r', source: 's' }),
    /quando usar.*quando não usar/);
  assert.throws(() => S.playbooks.add({ title: 'x', category: 'Ads Strategy',
    whenToUse: 'a', whenNotToUse: 'b', metrics: [], risk: null, source: 's' }),
    /métrica e risco/);
  /* todos os seeds têm quando usar/não usar + PROVISIONAL rotulado */
  const all = mos.repos.playbook.db.all('SELECT * FROM marketplace_playbook');
  assert.ok(all.every(p => p.when_to_use && p.when_not_to_use && p.confidence !== 'VERIFIED_OFFICIAL'));
  /* Método R.E.A.L.: vinculado a playbooks, e a base 10.K segue intacta */
  const real = all.filter(p => p.linked_real_method_principle);
  assert.ok(real.length >= 2, 'princípios R.E.A.L. ligados a estratégia');
  const K = createKnowledge({ mos, clock: c }); K.seed();
  const adv = K.advisor.advise({ companyId: 'cmp-x', marketplace: 'mercado_livre',
    triggers: ['atributo-obrigatorio-ausente-publicacao'], intent: 'external' });
  assert.equal(adv.verdict, 'BLOQUEAR_ACAO_EXTERNA',
    'R.E.A.L./playbook não altera o compliance técnico (10.K intocado)');
});

/* 9+10 — RID consulta outcome antes de criativo/anúncio; identifica uso e objeção */
test('advisor consulta Customer Outcome antes de recomendar criativo; sem outcome → honestidade', () => {
  const { S, company } = world();
  /* sem outcome → não recomenda, pede o perfil */
  const sem = S.advisor.recommend({ companyId: company.id, productId: 'prd-sem',
    goal: 'criativo' });
  assert.equal(sem.recommended, false);
  assert.match(sem.honestLanguage, /Ainda não há dados suficientes/);
  /* com outcome → transformação, uso diário e objeções entram */
  S.outcomes.upsert({ companyId: company.id, productId: 'prd-org',
    productType: 'organizacao', source: 'CONFIRMED_BY_OWNER',
    transformationStatement: 'reduz bagunça, facilita acesso e economiza tempo na rotina',
    dailyUseCases: ['cozinha diária'], objections: ['cabe no meu armário?'],
    proofPoints: ['foto com medidas reais'] });
  const com = S.advisor.recommend({ companyId: company.id, productId: 'prd-org',
    goal: 'criativo' });
  assert.equal(com.outcomeUsed, true);
  assert.match(com.honestLanguage, /vender a transformação/);
  assert.match(com.honestLanguage, /Há indício de/, 'linguagem honesta, nunca fórmula garantida');
  assert.deepEqual(com.outcomeSummary.dailyUse, ['cozinha diária']);
  assert.deepEqual(com.outcomeSummary.objections, ['cabe no meu armário?']);
  assert.ok(com.separation.METRICA && com.separation.TESTE, 'FATO/HIPÓTESE/TESTE separados');
});

/* 11+12+13 — funil por etapa; margem real; devolução = expectativa desalinhada */
test('funil diferencia etapas; venda alta+margem baixa alerta; devolução vira hipótese de expectativa', () => {
  const poucaImpressao = diagnoseFunnel({ impressions: 40 });
  assert.equal(poucaImpressao.findings[0].stage, 'IMPRESSAO');
  assert.ok(poucaImpressao.findings[0].hypotheses.includes('SEO fraco'));
  const ctrBaixo = diagnoseFunnel({ impressions: 5000, clicks: 40 });
  assert.equal(ctrBaixo.findings[0].stage, 'CLIQUE');
  assert.ok(ctrBaixo.findings[0].hypotheses.includes('imagem principal'));
  const convBaixa = diagnoseFunnel({ impressions: 5000, clicks: 300, orders: 2 });
  assert.equal(convBaixa.findings[0].stage, 'COMPRA');
  assert.ok(convBaixa.findings[0].hypotheses.includes('expectativa desalinhada'));
  /* margem REAL: vende mas não rende */
  const margem = diagnoseFunnel({ revenue: 12000, netMarginPct: 6, minMarginPct: 18 });
  const alerta = margem.findings.find(f => f.kind === 'ALERTA_RENTABILIDADE');
  assert.match(alerta.message, /não é falta de demanda; é estrutura de rentabilidade/);
  /* devolução alta com motivos de expectativa */
  const dev = diagnoseFunnel({ returnsPct: 0.098,
    returnReasons: ['tamanho menor que esperava', 'cor diferente da foto', 'não serve no espaço'] });
  const h = dev.findings.find(f => f.stage === 'ENTREGA');
  assert.match(h.message, /não ocorre por falha do produto/);
  assert.match(h.message, /ajustar imagem, vídeo, FAQ/);
  assert.ok(h.hypotheses[0].includes('expectativa'), 'expectativa, não defeito');
});

/* 14+15 — Ads nunca automático; preço com margem, período e parada */
test('Ads exige base validada; estratégia de preço tem métrica, risco e ponto de parada', () => {
  const { S, company } = world();
  const ads = S.advisor.recommend({ companyId: company.id, productId: 'prd-novo',
    goal: 'ads', marginOk: false });
  assert.equal(ads.recommended, false);
  assert.match(ads.reason, /não corrige produto, imagem fraca ou margem errada/);
  assert.match(ads.reason, /margem abaixo do mínimo/);
  /* playbook de preço de lançamento: fim declarado, nunca prejuízo invisível */
  const pricing = S.playbooks.select({ category: 'Product Launch' })[0];
  assert.match(pricing.risk, /prejuízo invisível/);
  assert.ok(pricing.stop_criteria, 'ponto de parada obrigatório');
  assert.ok(JSON.parse(pricing.metrics_json).includes('margem líquida'));
});

/* 16+17 — kit considera margem+logística; estágio muda recomendação */
test('kit exige margem e logística por item; estágio do ciclo muda os movimentos', () => {
  const { S, company } = world();
  const semBase = S.advisor.recommendKit({ companyId: company.id,
    items: [{ sku: 'A', marginPct: 30 }, { sku: 'B', packedWeightG: 900 }] });
  assert.equal(semBase.recommended, false);
  assert.match(semBase.reason, /B: margem/); assert.match(semBase.reason, /A: peso/);
  const ok = S.advisor.recommendKit({ companyId: company.id,
    items: [{ sku: 'A', marginPct: 30, packedWeightG: 500 },
            { sku: 'B', marginPct: 24, packedWeightG: 900 }] });
  assert.equal(ok.recommended, true);
  assert.ok(ok.stopCriteria && ok.metrics.length);
  /* estágio muda a recomendação */
  S.lifecycle.setStage(company.id, 'prd-x', 'LAUNCH');
  const launch = S.advisor.recommend({ companyId: company.id, productId: 'prd-x', goal: 'plano' });
  assert.ok(launch.stageMoves.includes('buscar primeiras conversões'));
  S.lifecycle.setStage(company.id, 'prd-x', 'SATURATING');
  const sat = S.advisor.recommend({ companyId: company.id, productId: 'prd-x', goal: 'plano' });
  assert.ok(sat.stageMoves.includes('renovar criativo'));
  assert.notDeepEqual(launch.stageMoves, sat.stageMoves, 'estágio ALTERA a recomendação');
  const lc = S.lifecycle.get(company.id, 'prd-x');
  assert.equal(JSON.parse(lc.history_json).length, 2, 'histórico de estágios');
});

/* 19+20 — recomendação com métrica/risco; conhecimento não contamina empresas */
test('recomendações declaram métrica e risco; playbook de empresa não vaza; auditoria', () => {
  const { S, company, mos } = world();
  S.playbooks.add({ companyId: company.id, title: 'Playbook privado da empresa A',
    category: 'Pricing Strategy', whenToUse: 'x', whenNotToUse: 'y',
    metrics: ['margem'], risk: 'r', source: 'interno' });
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W3', email: 'st3@x.y', companyName: 'B3', marketplaces: ['shopee'] });
  const forB = S.playbooks.select({ companyId: b.id });
  assert.ok(!forB.some(p => p.title.includes('empresa A')), 'sem contaminação');
  assert.ok(mos.repos.audit.tail(30).some(a => ['strategy', 'lifecycle', 'outcome', 'playbook'].includes(a.actor)), 'trilha auditável');
  /* dados de seed continuam identificados */
  assert.ok(mos.repos.playbook.db.all(`SELECT * FROM marketplace_playbook WHERE company_id IS NULL`)
    .every(p => /seed|interno/.test(p.source)), 'origem sempre declarada');
});

/* v7 — Marketplace Intelligence ganha playbooks/outcome/ciclo de vida */
test('v7: Conhecimento mostra playbooks, Customer Outcome e ciclo de vida com filtros', () => {
  const js = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/conhecimento-mkt.js'), 'utf8');
  for (const s of ['PLAYBOOK', 'Customer Outcome', 'ciclo de vida', 'quando usar',
                   'quando não usar', 'ponto de parada', 'Método R.E.A.L.'])
    assert.ok(js.includes(s), `mkt intelligence estratégico: ${s}`);
});

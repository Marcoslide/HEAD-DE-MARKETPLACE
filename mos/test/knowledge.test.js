/* SPRINT 10.K — KNOWLEDGE & COMPLIANCE FOUNDATION: as 24 garantias. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createKnowledge } = require('../src/knowledge/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'k@x.y', companyName: 'C', marketplaces: ['shopee'] });
  const K = createKnowledge({ mos, clock: c });
  K.seeded = K.seed();
  return { mos, c, company, K };
}

/* 1+2+16+22 — reuso; oficial exige fonte/versão/data; API ≠ regra de anúncio */
test('conhecimento oficial exige fonte oficial versionada; API/OAuth é domínio próprio', () => {
  const { K, mos, c } = world();
  assert.ok(K.seeded.records >= 21 && K.seeded.rules >= 5, 'carga mínima nas 4 praças');
  /* oficial sem fonte → recusado */
  assert.throws(() => K.kb.addRecord({ marketplace: 'shopee', domain: 'cadastro-catalogo',
    title: 'regra X', knowledgeType: 'OFFICIAL_PLATFORM_POLICY',
    confidenceStatus: 'VERIFIED_OFFICIAL' }), /fonte oficial com versão e data/);
  const src = K.kb.registerSource({ marketplace: 'shopee',
    sourceType: 'OFFICIAL_PLATFORM_POLICY', title: 'Política de produto Shopee',
    version: '2026-06', official: true, content: 'texto oficial' });
  const { record } = K.kb.addRecord({ marketplace: 'shopee', domain: 'politicas-compliance',
    title: 'Produtos restritos exigem documento', sourceId: src.id,
    knowledgeType: 'OFFICIAL_PLATFORM_POLICY', confidenceStatus: 'VERIFIED_OFFICIAL' });
  assert.equal(record.confidence_status, 'VERIFIED_OFFICIAL');
  assert.ok(record.last_verified_at && src.source_version && src.fetched_at);
  /* fonte não oficial só como PUBLIC_RESEARCH */
  assert.throws(() => K.kb.registerSource({ marketplace: 'shopee',
    sourceType: 'OFFICIAL_SELLER_GUIDE', title: 'blog aleatório', official: false }),
    /PUBLIC_RESEARCH/);
  /* domínio de API distinto */
  const api = K.kb.recall({ marketplace: 'magalu', domain: 'api-integracoes' });
  assert.ok(api.length && api.every(r => r.domain === 'api-integracoes'));
  assert.ok(mos.repos.audit.tail(10).some(a => a.actor === 'knowledge'), 'auditoria única');
});

/* 3+4+5+6 — provisória não publica; interna não sobrescreve oficial; obsoleta cai; conflito → revisão */
test('prioridade de verdade: oficial vence, interna não sobrescreve, mudança gera revisão', () => {
  const { K, c } = world();
  const src = K.kb.registerSource({ marketplace: 'mercado_livre',
    sourceType: 'OFFICIAL_CATEGORY_REQUIREMENT', title: 'Atributos Quadros ML',
    version: 'v3', official: true, content: 'attrs v3' });
  const { record: oficial } = K.kb.addRecord({ marketplace: 'mercado_livre',
    domain: 'cadastro-catalogo', title: 'Quadros: material é obrigatório',
    sourceId: src.id, knowledgeType: 'OFFICIAL_CATEGORY_REQUIREMENT',
    confidenceStatus: 'VERIFIED_OFFICIAL' });
  /* interna com mesmo assunto NÃO sobrescreve */
  assert.throws(() => K.kb.addRecord({ marketplace: 'mercado_livre',
    domain: 'cadastro-catalogo', title: 'Quadros: material é obrigatório',
    knowledgeType: 'INTERNAL_PRODUCT_RULE', confidenceStatus: 'VERIFIED_INTERNAL' }),
    /não sobrescreve regra oficial/);
  /* conflito entre pares equivalentes → fila de revisão */
  K.kb.addRecord({ marketplace: 'shopee', domain: 'logistica-prazo',
    title: 'Prazo máximo de preparação', knowledgeType: 'INTERNAL_LOGISTICS_RULE',
    confidenceStatus: 'VERIFIED_INTERNAL' });
  const { conflict } = K.kb.addRecord({ marketplace: 'shopee', domain: 'logistica-prazo',
    title: 'Prazo máximo de preparação', knowledgeType: 'INTERNAL_LOGISTICS_RULE',
    confidenceStatus: 'VERIFIED_INTERNAL' });
  assert.ok(conflict, 'conflito registrado');
  assert.ok(K.kb.r.knowledgeReview.count(`WHERE status = 'OPEN'`) >= 1);
  /* ingestão detecta mudança → registro antigo vira STALE e sai do recall */
  K.kb.ingest({ marketplace: 'mercado_livre', sourceType: 'OFFICIAL_CATEGORY_REQUIREMENT',
    title: 'Atributos Quadros ML', version: 'v4', content: 'attrs v4 mudou' });
  const recalled = K.kb.recall({ marketplace: 'mercado_livre', domain: 'cadastro-catalogo' });
  assert.ok(!recalled.some(r => r.id === oficial.id), 'obsoleta (STALE) não prevalece');
  /* dedup de ingestão */
  const again = K.kb.ingest({ marketplace: 'mercado_livre',
    sourceType: 'OFFICIAL_CATEGORY_REQUIREMENT', title: 'Atributos Quadros ML',
    version: 'v4', content: 'attrs v4 mudou' });
  assert.equal(again.duplicate, true);
});

/* 7+8+9+10+11 — consciência sem polícia: alerta, pergunta, bloqueia SÓ externo */
test('advisor: alerta sem bloquear; pergunta quando falta confirmação; bloqueia só ação externa', () => {
  const { K, company } = world();
  /* risco moderado (margem) → PODE SEGUIR COM ALERTA; nada bloqueado */
  const margem = K.advisor.advise({ companyId: company.id, marketplace: 'shopee',
    triggers: ['promocao-margem-abaixo-minimo'], intent: 'internal' });
  assert.equal(margem.verdict, 'PODE_SEGUIR_COM_ALERTA');
  assert.equal(margem.internalAllowed, true);
  assert.match(margem.message, /Não é bloqueio/);
  assert.match(margem.message, /Alternativa:/, 'explica regra, consequência e alternativa');
  /* sob encomenda + entrega rápida → PRECISA DE CONFIRMAÇÃO (conta/regra) */
  const rapida = K.advisor.advise({ companyId: company.id, marketplace: 'shopee',
    triggers: ['entrega-rapida-sob-encomenda'], intent: 'external' });
  assert.equal(rapida.verdict, 'PRECISA_DE_CONFIRMACAO');
  assert.match(rapida.message, /trabalho interno.*confirmar/s);
  /* crítico → bloqueia SOMENTE a ação externa; interno segue */
  const pub = K.advisor.advise({ companyId: company.id, marketplace: 'mercado_livre',
    triggers: ['atributo-obrigatorio-ausente-publicacao'], intent: 'external' });
  assert.equal(pub.verdict, 'BLOQUEAR_ACAO_EXTERNA');
  assert.equal(pub.internalAllowed, true, 'draft/plano/coleta NUNCA bloqueados');
  assert.match(pub.message, /draft interno segue salvo/);
  const pubInterno = K.advisor.advise({ companyId: company.id, marketplace: 'mercado_livre',
    triggers: ['atributo-obrigatorio-ausente-publicacao'], intent: 'internal' });
  assert.notEqual(pubInterno.verdict, 'BLOQUEAR_ACAO_EXTERNA',
    'mesmo o crítico permite preparação interna');
  /* BLOCK sem motivo/fonte/caminho → recusado */
  assert.throws(() => K.advisor.addRiskRule({ marketplace: 'shopee',
    domain: 'enforcement-risco', triggerCondition: 'x', riskLevel: 'CRITICAL',
    actionMode: 'BLOCK_EXTERNAL_ACTION', warningText: 'y' }), /exige/);
  /* nenhuma regra dispara → PODE SEGUIR (sem medo) */
  const livre = K.advisor.advise({ companyId: company.id, marketplace: 'shopee',
    triggers: ['nada-relevante'], intent: 'external' });
  assert.equal(livre.verdict, 'PODE_SEGUIR');
});

/* 12+13 — isolamento por empresa/conta e por marketplace */
test('conhecimento de conta isolado; regra de uma praça não vale na outra', () => {
  const { K, company, mos } = world();
  K.kb.addRecord({ companyId: company.id, marketplace: 'shopee',
    domain: 'cadastro-catalogo', title: 'Regra da conta A',
    knowledgeType: 'ACCOUNT_SPECIFIC_RULE', confidenceStatus: 'VERIFIED_ACCOUNT',
    appliesToAccountId: 'acc-A' });
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'kb@x.y', companyName: 'B', marketplaces: ['shopee'] });
  const forB = K.kb.recall({ companyId: b.id, marketplace: 'shopee',
    domain: 'cadastro-catalogo', accountId: 'acc-B' });
  assert.ok(!forB.some(r => r.title === 'Regra da conta A'), 'conta isolada');
  const daShopee = K.kb.recall({ marketplace: 'shopee', domain: 'logistica-prazo' });
  assert.ok(daShopee.every(r => r.marketplace === 'shopee'), 'praça não vaza');
  const advTikTok = K.advisor.advise({ companyId: company.id, marketplace: 'tiktok',
    triggers: ['promocao-margem-abaixo-minimo'] });
  assert.equal(advTikTok.verdict, 'PODE_SEGUIR', 'regra da Shopee não dispara no TikTok');
});

/* 14+15 — Método R.E.A.L.: playbook estratégico que não toca compliance */
test('Método R.E.A.L. é REAL_METHOD_PLAYBOOK e não interfere em compliance técnico', () => {
  const { K } = world();
  const real = K.kb.recall({ marketplace: 'mercado_livre',
    domain: 'estrategia-performance' }).find(r => /R\.E\.A\.L/.test(r.title));
  assert.ok(real, 'playbook presente e preservado');
  assert.equal(real.knowledge_type, 'REAL_METHOD_PLAYBOOK');
  assert.match(real.summary, /não define categoria, atributo, política/);
  /* nenhum risk rule aponta para o playbook */
  const rules = K.advisor.r.riskRule.db.all(`SELECT * FROM marketplace_risk_rule`);
  assert.ok(rules.every(r => r.domain !== 'estrategia-performance'),
    'playbook não vira regra de bloqueio');
});

/* 17+18+19+20+21 — pontes: Schema Engine, Shipping, Chat/WhatsApp; audit; sem escrita */
test('regras ligam a categoria/logística; aparecem no chat; WhatsApp segue sem escrita', () => {
  const { K, company, mos, c } = world();
  const src = K.kb.registerSource({ marketplace: 'mercado_livre',
    sourceType: 'OFFICIAL_CATEGORY_REQUIREMENT', title: 'Cat MLB1367',
    version: 'v1', official: true, content: 'x' });
  const { record } = K.kb.addRecord({ marketplace: 'mercado_livre',
    domain: 'cadastro-catalogo', title: 'MLB1367 exige quantidade de peças',
    sourceId: src.id, knowledgeType: 'OFFICIAL_CATEGORY_REQUIREMENT',
    confidenceStatus: 'VERIFIED_OFFICIAL', appliesToCategoryId: 'MLB1367',
    relatedRulePackId: 'ml-demo-1.2' });
  assert.equal(record.applies_to_category_id, 'MLB1367', 'ligada ao Schema Engine');
  assert.equal(record.related_rule_pack_id, 'ml-demo-1.2', 'ligada ao rule pack S10');
  const porCategoria = K.kb.recall({ marketplace: 'mercado_livre',
    domain: 'cadastro-catalogo', categoryId: 'MLB1367' });
  assert.ok(porCategoria.some(r => r.id === record.id));
  /* logística: seed liga sob-encomenda ao Shipping Eligibility */
  const log = K.kb.recall({ marketplace: 'shopee', domain: 'logistica-prazo' });
  assert.ok(log.some(r => /sob encomenda/.test(r.title)));
  /* a resposta do advisor é texto pronto para Chat/WhatsApp — e nada escreve fora */
  const adv = K.advisor.advise({ companyId: company.id, marketplace: 'shopee',
    triggers: ['atributo-material-ausente'] });
  assert.match(adv.message, /rascunho interno/);
  assert.equal(mos.repos.pilotRun.count(), 0, 'nenhuma escrita externa');
  const rec2 = K.kb.r.knowledgeRecord.byId(record.id);
  assert.ok(JSON.parse(rec2.audit_json).length >= 1, 'audit trail preservado');
  /* dados simulados/seed identificados */
  const seed = K.kb.recall({ marketplace: 'shopee', domain: 'cadastro-catalogo' });
  assert.ok(seed.every(r => r.confidence_status !== 'VERIFIED_OFFICIAL'
    || r.source_id), 'provisório/seed nunca se passa por oficial sem fonte');
});

/* v7 — subárea Marketplace Intelligence em Conhecimento */
test('v7: Conhecimento ganha Marketplace Intelligence com fonte, confiança e action modes', () => {
  const js = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/conhecimento-mkt.js'), 'utf8');
  for (const s of ['Marketplace Intelligence', 'VERIFIED_OFFICIAL', 'PROVISIONAL',
                   'BLOCK_EXTERNAL_ACTION', 'marcar para revisão', 'fonte'])
    assert.ok(js.includes(s), `mkt intelligence: ${s}`);
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/index.html'), 'utf8');
  assert.match(html, /conhecimento-mkt\.js/);
});

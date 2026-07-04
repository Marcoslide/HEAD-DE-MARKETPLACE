/* Sprint 06 — Specialists Engine: pareceres ricos, Conselho, votação
   ponderada e memória de acertos. Prova a conformidade com Arts. 10-11. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const NS = require('../src/index.js');

const WARMUP = NS.WARMUP_DAYS + 3;
function warmed(seed = 42) { const m = NS.createMIE({ seed }); m.runDays(WARMUP); return m; }

test('Art. 11.2: os 7 especialistas emitem parecer no formato RICO', () => {
  const mie = warmed();
  const reg = mie.specialists;
  assert.equal(reg.domains.length, 7, 'sete especialistas');
  assert.deepEqual(reg.domains,
    ['conversion', 'seo', 'commercial', 'competition', 'operations', 'marketing', 'financial']);
  const pareceres = reg.consult({ world: mie.world, memory: mie.memory, productId: 'p1', anomaly: { kind: 'sales_drop' } });
  assert.equal(pareceres.length, 7);
  for (const p of pareceres) {
    // formato rico + aliases de retrocompatibilidade
    assert.ok(p.diagnostico && p.constatacao === p.diagnostico, 'diagnóstico + alias constatacao');
    assert.ok(Array.isArray(p.evidencias), 'evidências');
    assert.ok(Array.isArray(p.hipoteses), 'hipóteses');
    assert.ok(typeof p.confidence === 'number' && ['alta', 'média', 'baixa'].includes(p.confianca), 'confiança numérica + label');
    assert.ok(p.recomendacao !== undefined, 'recomendação');
    assert.ok('impacto' in p, 'impacto esperado');
    assert.ok(Array.isArray(p.riscos), 'riscos');
    assert.ok(['alta', 'média', 'baixa'].includes(p.urgencia), 'urgência');
  }
});

test('Art. 11.2: especialista opina só no seu domínio (domínios únicos)', () => {
  const mie = warmed();
  const pareceres = mie.specialists.consult({ world: mie.world, memory: mie.memory, productId: 'p1', anomaly: { kind: 'sales_drop' } });
  const domains = pareceres.map(p => p.domain);
  assert.equal(new Set(domains).size, domains.length, 'nenhum domínio repetido');
});

test('guerra de preço: Conselho gera CONCORDÂNCIA de múltiplos especialistas', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const c = mie.investigation.cases.find(x => x.anomaly.productId === 'p1' && x.council && x.council.consolidated.recomendacao === 'reposition');
  assert.ok(c, 'deve haver um caso com recomendação consolidada de reposicionar');
  const council = c.council;
  assert.ok(council.agreements.length >= 2, `concordância de ≥2 especialistas (${council.agreements.join(', ')})`);
  assert.ok(council.agreements.includes('conversion') || council.agreements.includes('commercial'),
    'conversão e/ou comercial no consenso');
  assert.ok(council.consensus.confidence > 0, 'confiança do consenso declarada');
  assert.ok(council.consolidated.consensusStrength > 0 && council.consolidated.consensusStrength <= 1);
});

test('Conselho identifica divergentes sem virar confusão (Art. 11.3)', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const c = mie.investigation.cases.find(x => x.council && x.council.consolidated.recomendacao !== 'observe');
  assert.ok(c);
  // consolidado é UMA posição; divergências ficam listadas à parte, não misturadas
  assert.ok(typeof c.council.consolidated.recomendacao === 'string');
  assert.ok(Array.isArray(c.council.divergent));
  for (const d of c.council.divergent) assert.ok(d.domain && d.recomendacao);
});

test('votação ponderada: parecer com afinidade e evidências pesa mais', () => {
  const mie = warmed();
  const weigher = NS.Specialists.buildWeigher(mie.memory, { problemType: 'ranking_drop' });
  const seoParecer = { domain: 'seo', confidence: 0.8, evidencias: [1, 2, 3], recommendationType: 'visibility' };
  const finParecer = { domain: 'financial', confidence: 0.8, evidencias: [1], recommendationType: 'visibility' };
  // SEO tem afinidade 1.4 com ranking_drop; financial não tem afinidade
  assert.ok(weigher(seoParecer) > weigher(finParecer), 'especialista com afinidade ao problema pesa mais');
});

test('memória de acertos: especialista que acerta ganha peso; que erra, perde', () => {
  const mie = warmed();
  assert.equal(mie.memory.specialistAccuracy('conversion'), 1, 'sem histórico = peso neutro');
  for (let i = 0; i < 5; i++) mie.memory.recordSpecialistOutcome('conversion', true);
  for (let i = 0; i < 5; i++) mie.memory.recordSpecialistOutcome('seo', false);
  assert.ok(mie.memory.specialistAccuracy('conversion') > 1.1, 'quem acerta sobe o peso');
  assert.ok(mie.memory.specialistAccuracy('seo') < 0.9, 'quem erra perde peso');
  const snap = mie.memory.specialistsSnapshot();
  assert.ok(snap.find(s => s.domain === 'conversion').accuracy === 1);
  assert.ok(snap.find(s => s.domain === 'seo').accuracy === 0);
});

test('atribuição ponta a ponta: resultado medido credita os especialistas do consenso', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const decision = mie.prioritization.pendingDecisions()
    .find(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
  assert.ok(decision, 'decisão de reposicionamento na mesa');
  const contributing = decision.diagnosis.council.consolidated.contributingDomains;
  assert.ok(contributing.length >= 1, 'consenso registrou especialistas contribuintes');

  mie.approve(decision.id);
  const plan = mie.execution.plans.find(p => p.decisionId === decision.id);
  assert.deepEqual(plan.prediction.contributingDomains, contributing, 'plano carrega os contribuintes');

  const before = new Map(contributing.map(d => [d, mie.memory.specialists.get(d)?.predictions || 0]));
  mie.runDays(NS.MEASUREMENT_WINDOW + 2); // janela vence → mede → credita
  for (const d of contributing)
    assert.ok((mie.memory.specialists.get(d)?.predictions || 0) > before.get(d),
      `especialista ${d} recebeu crédito/débito pelo resultado`);
});

test('operação: ruptura de estoque aciona o Especialista em Operação', () => {
  const mie = warmed();
  // sem cenário, operação está neutra
  const neutral = mie.specialists.consult(
    { world: mie.world, memory: mie.memory, productId: 'p2', anomaly: { kind: 'sales_drop' } })
    .find(x => x.domain === 'operations');
  assert.equal(neutral.stance, 'neutral', 'operação saudável = parecer neutro');

  // injeta ruptura e reconsulta: cobertura baixa aciona o especialista
  mie.world.applyScenario('stockout-risk', { productId: 'p2' });
  mie.runDays(1);
  const p2 = mie.specialists.consult(
    { world: mie.world, memory: mie.memory, productId: 'p2', anomaly: { kind: 'stockout_risk' } })
    .find(x => x.domain === 'operations');
  assert.equal(p2.recommendationType, 'stock', 'recomenda ação de estoque');
  assert.equal(p2.stance, 'alert');
  assert.ok(['alta', 'média'].includes(p2.urgencia), 'urgência conforme a faixa de cobertura');
  assert.match(p2.diagnostico, /cobertura|ruptura/i);
});

test('financeiro dimensiona impacto em R$ mas NÃO vota na ação (advisory)', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(3);
  const fin = mie.specialists.consult(
    { world: mie.world, memory: mie.memory, productId: 'p1', anomaly: { kind: 'sales_drop' } })
    .find(x => x.domain === 'financial');
  assert.equal(fin.recommendationType, null, 'financeiro não vota em QUAL ação');
  assert.ok(fin.impacto && 'estimateBRL' in fin.impacto, 'mas dimensiona o impacto em R$');
});

test('nada regride: Conselho é advisory — a decisão continua vindo do playbook/motores', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const c = mie.investigation.cases.find(x => x.diagnosis && x.diagnosis.cause === 'competitor_price_cut');
  assert.ok(c, 'o playbook continua determinando a causa');
  assert.equal(c.diagnosis.proposal.type, 'reposition', 'a proposta continua vindo do playbook (MIF)');
  assert.ok(c.diagnosis.council, 'e o Conselho acompanha como camada consultiva');
});

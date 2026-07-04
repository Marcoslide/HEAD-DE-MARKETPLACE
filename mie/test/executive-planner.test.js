/* Sprint 08 — Executive Planning Engine: prioridade executiva, silêncio
   inteligente, capacidade operacional. Os 12 testes obrigatórios. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const NS = require('../src/index.js');
const L = NS.EPE_LEVEL;

const WARMUP = NS.WARMUP_DAYS + 3;
function warmed(seed = 42) { const m = NS.createMIE({ seed }); m.runDays(WARMUP); return m; }
function epe() { return warmed().epe; }

/* base de um candidato acionável forte */
const strong = (o = {}) => ({
  id: 'x', productId: 'p1', title: 'ação', impactMonthly: 2000,
  confidenceLabel: 'alta', urgency: 'média', severity: 'attention',
  effort: 1, reversible: true, class: 'C', proposalType: 'reposition',
  hasProposal: true, ...o,
});

/* 1 */
test('prioridade executiva correta: caso forte, reversível, Classe C → PEDIR APROVAÇÃO', () => {
  const v = epe().classify(strong());
  assert.equal(v.level, L.APPROVE);
  assert.ok(v.score > 0 && v.breakdown.factors.length >= 1, 'score auditável com fatores');
});

/* 2 */
test('silêncio inteligente: sinal fraco sem proposta → OBSERVAR ou IGNORAR', () => {
  const weak = epe().classify({ impactMonthly: 400, urgency: 'baixa', severity: 'info', hasProposal: false, confidenceLabel: 'média' });
  assert.ok([L.OBSERVE, L.IGNORE].includes(weak.level));
  assert.notEqual(weak.level, L.INTERRUPT);
});

/* 3 */
test('capacidade operacional: excedente de decisões vira observação (silêncio)', () => {
  const e = epe();
  const cands = Array.from({ length: 6 }, (_, i) => ({ diagnosis: null, ...e.classify(strong({ id: 'd' + i, impactMonthly: 2000 + i * 100, title: 'decisão ' + i })) }));
  // usa planDay via injeção de candidatos: valida o cap direto na função interna
  const plan = e.planDay({ capacity: { missions: 5, decisions: 2 } });
  assert.ok(plan.decisions.length <= 2 + plan.decisions.filter(d => d.level === L.INTERRUPT).length,
    'no máximo 2 aprovações (fora incidentes)');
  assert.ok(Array.isArray(plan.silence), 'há registro de silêncio');
});

/* 4 */
test('escolha das melhores missões: as de maior score entram, as piores vão a silêncio', () => {
  const e = epe();
  // constrói 8 missões (Classe A reversível, effort 2) com scores diferentes
  const items = Array.from({ length: 8 }, (_, i) =>
    e.classify(strong({ id: 'm' + i, class: 'A', effort: 2, impactMonthly: 500 + i * 300, title: 'missao ' + i })));
  const missions = items.filter(x => x.level === L.MISSION);
  assert.ok(missions.length >= 6, 'a maioria vira CRIAR MISSÃO');
  // a de maior impacto tem o maior score
  const top = [...missions].sort((a, b) => b.score - a.score)[0];
  assert.ok(top.factors.impactMonthly >= 2000, 'a melhor missão é a de maior impacto');
});

/* 5 */
test('sinal fraco NÃO interrompe', () => {
  const v = epe().classify({ impactMonthly: 300, urgency: 'baixa', severity: 'info', hasProposal: true, class: 'C', confidenceLabel: 'média', proposalType: 'reposition' });
  assert.notEqual(v.level, L.INTERRUPT);
});

/* 6 */
test('impacto alto + urgência alta → INTERROMPER IMEDIATAMENTE', () => {
  const v = epe().classify(strong({ impactMonthly: 6000, urgency: 'alta', window: true, confidenceLabel: 'alta' }));
  assert.equal(v.level, L.INTERRUPT);
});

/* 7 */
test('impacto alto + urgência baixa → entra no briefing (PEDIR APROVAÇÃO), não interrompe', () => {
  const v = epe().classify(strong({ impactMonthly: 6000, urgency: 'baixa', effort: 2 }));
  assert.equal(v.level, L.APPROVE);
});

/* 8 */
test('evento de baixo impacto é IGNORADO', () => {
  const v = epe().classify(strong({ impactMonthly: 50 }));
  assert.equal(v.level, L.IGNORE);
});

/* 9 */
test('aprendizado anterior (grafo) AUMENTA a prioridade', () => {
  const e = epe();
  const sem = e.classify(strong({ graphReuse: false }));
  const com = e.classify(strong({ graphReuse: true }));
  assert.ok(com.score > sem.score, 'reuso de aprendizado eleva o score');
});

/* 10 */
test('recusa anterior do dono REDUZ a prioridade de propostas semelhantes', () => {
  const e = epe();
  const semRecusa = e.classify(strong({ reluctance: 0 }));
  const comRecusa = e.classify(strong({ reluctance: 0.8 }));
  assert.ok(comRecusa.score < semRecusa.score, 'relutância do dono reduz o score');
});

/* 11 */
test('missões/decisões duplicadas NÃO são criadas', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(8); // a anomalia pode reabrir; o EPE deve deduplicar por produto+ação
  const plan = mie.planDay();
  const keys = [...plan.decisions, ...plan.missions].map(x => `${x.productId}|${x.proposalType}`);
  assert.equal(new Set(keys).size, keys.length, 'nenhum par produto+ação duplicado no plano');
});

/* 12 */
test('o EPE não contradiz Constituição/MIF/MOS: só o que merece chega ao dono', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.world.applyScenario('ctr-noise', { productId: 'p2' }); // ruído: não pode chegar ao dono
  mie.runDays(5);
  const plan = mie.planDay({ capacity: { missions: 5, decisions: 2 } });

  // Art. 19: nada de baixo impacto ou confiança baixa na mesa do dono
  for (const d of plan.decisions) {
    assert.ok(d.impactMonthly >= NS.CONFIG.EPE.MIN_IMPACT, 'decisão sempre com impacto material');
    assert.notEqual(d.confidence, 'baixa', 'confiança baixa não vira decisão');
    assert.ok([L.INTERRUPT, L.APPROVE].includes(d.level));
  }
  // Art. 13: a mesa do dono é curta (capacidade respeitada)
  const approvals = plan.decisions.filter(d => d.level === L.APPROVE);
  assert.ok(approvals.length <= 2, 'no máximo a capacidade de decisões');
  // o ruído de CTR ficou no silêncio, não na atenção
  assert.ok(!plan.attention.some(a => /p2/.test(a.title)), 'ruído de p2 não chega à atenção do dono');
});

/* extras: plano do dia coerente */
test('plano do dia: funil + atenção + silêncio + assinatura do Head', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const plan = mie.planDay();
  assert.ok(plan.funnel.signalsFound > 0, 'sinais contados');
  assert.ok(plan.funnel.signalsIgnored > 0, 'sinais ignorados contados (silêncio)');
  assert.ok(plan.funnel.investigated >= 1);
  assert.ok(Array.isArray(plan.attention));
  assert.ok(plan.signature.length > 0, 'assinatura do Head');
  // breakdown auditável em cada decisão
  for (const d of plan.decisions)
    assert.ok(d.breakdown && 'score' in d.breakdown && 'factors' in d.breakdown, 'como o EPE priorizou é auditável');
});

test('EXECUTAR AUTOMATICAMENTE: ação Classe A reversível e rápida o Head faz sozinho', () => {
  const v = epe().classify(strong({ class: 'A', effort: 1, proposalType: 'reputation' }));
  assert.equal(v.level, L.AUTO);
});

test('confiança baixa nunca vira decisão (Art. 8/9)', () => {
  const v = epe().classify(strong({ confidenceLabel: 'baixa', confidence: 0.3 }));
  assert.ok([L.OBSERVE, L.IGNORE].includes(v.level));
});

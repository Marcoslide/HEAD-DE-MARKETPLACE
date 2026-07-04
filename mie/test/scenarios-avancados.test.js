/* Bloco 01 — cenários avançados de investigação.
   Prova que os novos playbooks seguem MIF Partes 2-4 e que a memória
   aprende padrões (dia-da-semana, sazonalidade, calibração). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const NS = require('../src/index.js');

const WARMUP = NS.WARMUP_DAYS + 3;
function warmedMIE(seed = 42) {
  const mie = NS.createMIE({ seed });
  mie.runDays(WARMUP);
  return mie;
}
const caseOf = (mie, kind) => mie.investigation.cases.find(c => c.anomaly.kind === kind);

test('decadência silenciosa: nenhum dia grita, mas o detetive percebe a sangria', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('silent-decay', { productId: 'p2' });
  mie.runDays(16);

  const c = caseOf(mie, 'silent_decay');
  assert.ok(c, 'a queda gradual deve abrir investigação própria');
  assert.ok(c.findings.confirmar_tendencia.gradual, 'tendência gradual confirmada');
  assert.ok(['creative_fatigue', 'price_erosion'].includes(c.diagnosis.cause),
    'causa estrutural identificada: ' + c.diagnosis.cause);
  assert.ok(c.diagnosis.proposal, 'decadência sempre termina em proposta (Art. 21)');
});

test('explosão de vendas: oportunidade com janela + checagem de ruptura', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('sales-explosion', { productId: 'p5' });
  mie.runDays(3);

  const c = caseOf(mie, 'sales_explosion');
  assert.ok(c, 'explosão deve abrir investigação (sucesso também é anomalia)');
  assert.ok(c.findings.risco_de_ruptura, 'o playbook SEMPRE checa risco de ruptura na onda');
  assert.equal(c.diagnosis.proposal.type, 'capture_demand');
  assert.ok(c.diagnosis.proposal.window, 'oportunidade com janela marcada (score ×1,5)');
  const d = mie.prioritization.pendingDecisions().find(x => x.productId === 'p5');
  assert.ok(d, 'capturar a onda vai para a mesa do dono (Classe C)');
});

test('ruptura de estoque: pensa em dias de cobertura e freia sem pausar (MIF 3.3)', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('stockout-risk', { productId: 'p2' });
  mie.runDays(2);

  const c = caseOf(mie, 'stockout_risk') || caseOf(mie, 'stockout_critical');
  assert.ok(c, 'cobertura baixa deve abrir investigação');
  assert.equal(c.diagnosis.proposal.type, 'stock_brake');
  assert.match(c.diagnosis.proposal.text, /subir o preço|frear/i);
  assert.match(c.diagnosis.proposal.text, /[Nn]unca pausar/, 'pausar mata o histórico — proibido');
});

test('perda de ranking: separa consequência (círculo vicioso) de pressão externa', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('ranking-loss', { productId: 'p4' });
  mie.runDays(4);

  const c = caseOf(mie, 'ranking_drop');
  assert.ok(c, 'perda de ranking deve abrir investigação');
  assert.ok(c.findings.propria_operacao, 'olha para dentro antes de acusar o mundo');
  assert.ok(c.findings.concorrencia, 'e olha para fora antes de concluir');
  assert.ok(['visibility_pressure', 'competitor_acceleration', 'own_performance_loop', 'unknown']
    .includes(c.diagnosis.cause));
  if (c.diagnosis.cause !== 'unknown')
    assert.ok(c.diagnosis.proposal, 'causa identificada termina em proposta');
});

test('pico de devoluções: lê os MOTIVOS e diagnostica expectativa descalibrada', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('returns-spike', { productId: 'p1' });
  mie.runDays(3);

  const c = caseOf(mie, 'returns_spike');
  assert.ok(c, 'pico de devoluções deve abrir investigação');
  assert.equal(c.findings.padrao_dos_motivos.dominantReason, 'veio diferente da foto');
  assert.equal(c.diagnosis.cause, 'expectation_gap');
  assert.equal(c.diagnosis.proposal.type, 'fix_expectation');
});

test('mudança de algoritmo: métricas em bloco = 1 investigação, não 5 alarmes (MIF 3.6)', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('algorithm-change', {});
  mie.runDays(3);

  const algoCases = mie.investigation.cases.filter(c => c.anomaly.kind === 'algorithm_change');
  assert.equal(algoCases.length, 1, 'exatamente UMA investigação de plataforma');
  const c = algoCases[0];
  assert.ok(c.anomaly.facts.affected.length >= 3, 'assinatura: vários produtos juntos');
  assert.equal(c.diagnosis.cause, 'platform_algorithm');
  assert.match(c.diagnosis.proposal.text, /NÃO consertar o que não quebrou/);
  // nenhum alarme individual de ranking por produto no mesmo evento
  const rankingCases = mie.investigation.cases.filter(c => c.anomaly.kind === 'ranking_drop');
  assert.equal(rankingCases.length, 0, 'sem alarmes individuais redundantes');
});

test('onda de entrantes: mapeia todos e seus pontos fracos, sem pânico (MIF 3.5)', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('competitor-surge', { productId: 'p3' });
  mie.runDays(3);

  const c = caseOf(mie, 'competitor_surge');
  assert.ok(c, 'onda de entrantes deve abrir investigação agregada');
  assert.ok(c.findings.mapear_entrantes.count >= 3, 'todos os entrantes mapeados');
  assert.ok(c.findings.mapear_entrantes.entrants.every(e => e.weakness), 'ponto fraco de cada um');
  assert.equal(c.diagnosis.cause, 'entrant_wave');
});

test('memória de padrões: aprende que domingo é fraco e quinta é forte NESTA operação', () => {
  const mie = NS.createMIE({ seed: 7 });
  mie.runDays(42); // 6 semanas de ritmo
  const sunday = mie.memory.weekdayFactor('p1', 0);
  const thursday = mie.memory.weekdayFactor('p1', 4);
  assert.ok(sunday < thursday, `domingo (${sunday.toFixed(2)}) < quinta (${thursday.toFixed(2)})`);
  assert.ok(mie.memory.seasonality.size >= 1, 'sazonalidade mensal registrada');
  const snap = mie.memory.patternsSnapshot();
  assert.ok(snap.bestDayByProduct.p1, 'melhor dia identificado por produto');
});

test('calibração automática: previsões que erram encolhem as próximas estimativas', () => {
  const mie = warmedMIE();
  // histórico ruim da estratégia: entregou 30% do prometido, duas vezes
  mie.memory.updateCalibration('reposition', 0.3);
  mie.memory.updateCalibration('reposition', 0.3);
  const factorBad = mie.memory.calibrationFactor('reposition');
  assert.ok(factorBad < 1, 'fator de calibração abaixo de 1 após erros');

  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const d = mie.prioritization.pendingDecisions()
    .find(x => x.productId === 'p1' && x.diagnosis.proposal.type === 'reposition');
  assert.ok(d, 'decisão existe');
  const raw = Math.round(mie.world.revenueMonthly('p1') * 0.10);
  assert.ok(d.impactMonthly < raw, `impacto calibrado (${d.impactMonthly}) < bruto (~${raw})`);
});

test('força 3 vira padrão da casa: memória emite strategy.updated na promoção', () => {
  const mie = warmedMIE();
  const events = [];
  mie.bus.on('strategy.updated', e => events.push(e));
  for (let i = 0; i < 3; i++)
    mie.memory.absorb({ key: 'creative.ambientada', kind: 'creative', discovery: 'foto ambientada vence', evidence: { n: i } });
  assert.equal(events.length, 1, 'promoção a padrão da casa emitida exatamente uma vez');
  assert.equal(mie.memory.winners().creatives.length, 1, 'criativo vencedor consultável');
});

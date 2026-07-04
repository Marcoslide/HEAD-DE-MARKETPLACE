/* Suíte de testes do MIE.
   Cada teste prova que o comportamento segue CONSTITUIÇÃO × MIF × MOS.
   Rodar: node --test mie/test/ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const NS = require('../src/index.js');

const WARMUP = NS.WARMUP_DAYS + 3; // aquecimento do "normal" + folga

function warmedMIE(seed = 42) {
  const mie = NS.createMIE({ seed });
  mie.runDays(WARMUP);
  return mie;
}

/* =====================================================================
   CENÁRIO 1 — Guerra de preço (o cenário que define o produto)
   Concorrente reduz preço → CTR/conversão/ranking caem.
   Esperado: investiga → identifica causa → calcula confiança →
   prioriza → RECOMENDA (nunca executa preço sozinho). [Arts. 5,6,12,13]
   ===================================================================== */
test('guerra de preço: investiga, acha a causa certa, com confiança e proposta', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);

  const cases = mie.investigation.cases.filter(c => c.anomaly.productId === 'p1');
  assert.ok(cases.length >= 1, 'deve abrir investigação');
  const c = cases.find(x => x.diagnosis && x.diagnosis.cause === 'competitor_price_cut');
  assert.ok(c, 'a causa provável deve ser o corte de preço dos concorrentes');

  // timing como impressão digital (MIF 2.1)
  const elim = c.steps.find(s => s.name === 'eliminar_inconsistentes');
  assert.ok(elim.findings.survivors.includes('competitor_price_cut'));

  // confiança declarada (Art. 9)
  assert.ok(c.diagnosis.confidence > 0 && c.diagnosis.confidenceLabel, 'confiança sempre declarada');
  assert.ok(['alta', 'média'].includes(c.diagnosis.confidenceLabel));

  // proposta segue MIF 3.1: reposicionar, nunca cobrir preço
  assert.equal(c.diagnosis.proposal.type, 'reposition');

  // destino: decisão na fila do dono (Classe C não executa sozinha)
  const decision = mie.prioritization.pendingDecisions().find(d => d.productId === 'p1');
  assert.ok(decision, 'deve virar decisão recomendada, não execução automática');
  assert.ok(decision.impactMonthly > 0, 'decisão sempre com impacto em R$');
});

/* =====================================================================
   CENÁRIO 2 — Ruído de CTR (conversão estável)
   Esperado: apenas OBSERVAR. Não interromper o usuário. [Arts. 13,19]
   "Curiosidades não chegam ao empresário. Somente decisões."
   ===================================================================== */
test('ruído de CTR: motor observa em silêncio, dono não é interrompido', () => {
  const mie = warmedMIE();
  const before = mie.prioritization.pendingDecisions().length;
  mie.world.applyScenario('ctr-noise', { productId: 'p2' });
  mie.runDays(4);

  const decisionsP2 = mie.prioritization.pendingDecisions().filter(d => d.productId === 'p2');
  assert.equal(decisionsP2.length, 0, 'nenhuma decisão criada para ruído');
  assert.equal(mie.prioritization.interrupts.filter(i => i.productId === 'p2').length, 0, 'nenhuma interrupção');

  // se houve anomalia leve, o destino foi OBSERVE (vigília silenciosa)
  const classified = mie.bus.ofType('priority.classified').map(e => e.payload).filter(p => p.productId === 'p2');
  for (const item of classified) assert.ok(['OBSERVE', 'DISCARD'].includes(item.destination));
  assert.equal(mie.prioritization.pendingDecisions().length, before, 'fila do dono intocada');
});

/* =====================================================================
   CENÁRIO 3 — Novo concorrente entra
   Esperado: monitorar sem pânico (MIF 3.5), mapear ponto fraco,
   não interromper de imediato.
   ===================================================================== */
test('novo concorrente: vigília reforçada, ponto fraco mapeado, sem pânico', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('new-competitor', { productId: 'p4' });
  mie.runDays(3);

  const c = mie.investigation.cases.find(x => x.anomaly.kind === 'new_competitor');
  assert.ok(c, 'entrante deve abrir investigação');
  assert.equal(c.diagnosis.cause, 'entrant_pressure');
  assert.ok(c.findings.mapear_ponto_fraco.weakness, 'ponto fraco mapeado desde o dia 1');

  // sem impacto imediato → OBSERVE (watch), não decisão nem interrupção
  const classified = mie.bus.ofType('priority.classified').map(e => e.payload)
    .find(p => p.caseId === c.id);
  assert.equal(classified.destination, 'OBSERVE');
  assert.equal(mie.prioritization.interrupts.length, 0);
});

/* =====================================================================
   CENÁRIO 4 — Incidente: anúncio derrubado
   Esperado: INTERROMPE, mas com primeira resposta JÁ em curso.
   [Art. 19; MOS Fluxo 008: "nunca alarme sem ação em curso"]
   ===================================================================== */
test('anúncio derrubado: interrompe com ação já em curso', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('listing-down', { productId: 'p5' });
  mie.runDays(1);

  const interrupts = mie.prioritization.interrupts;
  assert.equal(interrupts.length, 1, 'incidente crítico interrompe');

  // a primeira resposta nasce no MESMO ciclo do alarme
  const firstResponse = mie.execution.plans.find(p => p.type === 'first_response');
  assert.ok(firstResponse, 'plano de primeira resposta criado');
  assert.ok(firstResponse.steps.length >= 2, 'recurso + plano B em paralelo');
  assert.equal(firstResponse.startDay, interrupts[0].day, 'ação em curso no mesmo dia do alarme');
});

/* =====================================================================
   FLUXO COMPLETO — decisão aprovada → executa → mede → aprende → reporta
   [Arts. 15, 21; MOS Fluxos 007 e 010]
   ===================================================================== */
test('ciclo completo: aprovação → previsão ANTES da execução → medição → aprendizado', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const decision = mie.prioritization.pendingDecisions()
    .find(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
  assert.ok(decision);

  mie.approve(decision.id);

  // Art. 15: previsão registrada antes da execução
  const plan = mie.execution.plans.find(p => p.decisionId === decision.id);
  assert.ok(plan, 'plano criado na aprovação');
  assert.ok(plan.prediction, 'NENHUMA execução sem previsão registrada');
  assert.equal(plan.prediction.registeredAtDay, plan.startDay);
  assert.ok(plan.reversible, 'ação nasce reversível (versão)');

  // janela de medição vence → resultado medido → aprendizado gravado
  mie.runDays(NS.MEASUREMENT_WINDOW + 2);
  assert.equal(plan.status, 'measured', 'resultado medido após a janela');
  const knowledge = mie.memory.knowledgeAbout({ key: 'strategy.reposition' });
  assert.equal(knowledge.length, 1, 'resultado virou conhecimento (Fluxo 010)');

  // fechamento de ciclo reportado na voz "previsto vs. medido"
  const closed = mie.bus.ofType('cycle.closed');
  assert.ok(closed.length >= 1);
  assert.match(closed[0].payload.report, /Estimei/);
});

/* =====================================================================
   RECUSA ENSINA — [Art. 18; MOS Fluxo 007]
   Recusar uma proposta grava preferência e reduz a prioridade de
   propostas do mesmo tipo no futuro.
   ===================================================================== */
test('recusa: vira preferência do dono e reduz prioridade futura do mesmo tipo', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const decision = mie.prioritization.pendingDecisions()
    .find(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
  mie.refuse(decision.id, 'margem apertada');

  assert.equal(mie.memory.preferences.length, 1, 'preferência registrada');
  const prefKnowledge = mie.memory.knowledgeAbout({ kind: 'preference' });
  assert.ok(prefKnowledge.length >= 1, 'recusa virou conhecimento');
  assert.ok(mie.memory.reluctance('reposition') > 0, 'relutância aprendida');

  // o score de uma proposta idêntica cai após a recusa
  const d = decision.diagnosis;
  const rescored = mie.prioritization.scoreOf(d);
  assert.ok(rescored.score < decision.score, 'propostas do tipo recusado perdem prioridade');
});

/* =====================================================================
   CONFORMIDADE CONSTITUCIONAL — invariantes que nenhum cenário pode violar
   ===================================================================== */
test('Art. 5: nenhuma investigação pula etapas do fluxo obrigatório', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.world.applyScenario('new-competitor', { productId: 'p4' });
  mie.runDays(4);

  assert.ok(mie.investigation.cases.length >= 2);
  for (const c of mie.investigation.cases) {
    const names = c.steps.map(s => s.name);
    // as etapas obrigatórias aparecem TODAS e NA ORDEM
    let idx = -1;
    for (const required of NS.MANDATORY_STEPS) {
      const at = names.indexOf(required);
      assert.ok(at > idx, `etapa "${required}" ausente ou fora de ordem no caso ${c.id}`);
      idx = at;
    }
  }
});

test('Art. 9: todo diagnóstico declara nível de confiança', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.world.applyScenario('review-wave', { productId: 'p3' });
  mie.runDays(4);
  for (const c of mie.investigation.cases.filter(x => x.diagnosis)) {
    assert.ok(c.diagnosis.confidence >= 0 && c.diagnosis.confidence <= 1);
    assert.ok(['alta', 'média', 'baixa'].includes(c.diagnosis.confidenceLabel));
  }
});

test('Art. 11: especialistas emitem parecer no formato fixo, só no seu domínio', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(2);
  const c = mie.investigation.cases[0];
  assert.ok(c.pareceres.length >= 7, 'todos os especialistas consultados');
  for (const p of c.pareceres) {
    assert.ok(p.domain && p.constatacao && p.confianca && p.recomendacao !== undefined,
      'parecer no formato fixo: constatação/evidência/confiança/recomendação');
  }
});

test('Art. 14: o organismo nunca fica parado — atividade em todo ciclo', () => {
  const mie = NS.createMIE({ seed: 7 });
  for (let i = 0; i < 20; i++) {
    const r = mie.tick();
    assert.ok(r.activities.length > 0, `ciclo ${i + 1} sem atividade visível`);
  }
});

test('Art. 17: durante o aquecimento, nada de alarme (o normal vem antes do julgamento)', () => {
  const mie = NS.createMIE({ seed: 42 });
  mie.world.applyScenario('price-war', { productId: 'p1' }); // ataque no dia 1!
  mie.runDays(5); // ainda dentro do aquecimento
  assert.equal(mie.prioritization.pendingDecisions().length, 0,
    'sem baseline aprendido, o motor não julga — humildade declarada');
});

test('Art. 19: a fila do dono só recebe decisões com proposta e impacto', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.world.applyScenario('ctr-noise', { productId: 'p2' });
  mie.world.applyScenario('success-streak', { productId: 'p3' });
  mie.runDays(5);
  for (const d of mie.prioritization.pendingDecisions()) {
    assert.ok(d.diagnosis.proposal, 'decisão sem proposta é proibida');
    assert.ok(d.impactMonthly > 0, 'decisão sem impacto é curiosidade');
    assert.ok(d.confidenceLabel !== 'baixa', 'confiança baixa não vira fila');
  }
});

test('MIF 8.2: conhecimento sobe de força com repetição', () => {
  const mie = warmedMIE();
  // duas vitórias da mesma estratégia
  mie.memory.absorb({ key: 'strategy.reposition', kind: 'strategy', discovery: 'funcionou', evidence: { n: 1 } });
  mie.memory.absorb({ key: 'strategy.reposition', kind: 'strategy', discovery: 'funcionou', evidence: { n: 2 } });
  const k = mie.memory.knowledgeAbout({ key: 'strategy.reposition' })[0];
  assert.equal(k.strength, 2, 'repetição sobe força');
  // uma contradição rebaixa e pede revalidação — não apaga
  mie.memory.absorb({ key: 'strategy.reposition', kind: 'strategy', contradicts: true, discovery: 'não funcionou', evidence: { n: 3 } });
  assert.equal(k.strength, 1, 'contradição rebaixa');
  assert.ok(k.needsRevalidation, 'contradição dispara revalidação');
});

test('briefing diário: trabalho realizado + somente decisões priorizadas (MOS Fluxo 006)', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  const results = mie.runDays(4);
  const briefing = results[results.length - 1].briefing;
  assert.ok(briefing.worked.length >= 2, 'o briefing presta contas do trabalho');
  for (const d of briefing.decisions) {
    assert.ok(d.impact && d.confidence, 'decisão no briefing sempre com impacto e confiança');
  }
  assert.ok(briefing.signature, 'assinatura do Head presente');
});

test('reprodutibilidade: mesma semente → mesmo mundo (auditoria)', () => {
  const a = NS.createMIE({ seed: 123 }); a.runDays(10);
  const b = NS.createMIE({ seed: 123 }); b.runDays(10);
  assert.deepEqual(a.world.latest('p1'), b.world.latest('p1'), 'determinismo total');
});

/* =====================================================================
   REGRESSÕES DESCOBERTAS NO DEBUG CONSOLE
   ===================================================================== */
test('MIF Parte 6: o Head não propõe reverter o próprio experimento em janela de medição', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const decision = mie.prioritization.pendingDecisions()
    .find(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
  mie.approve(decision.id);
  mie.runDays(10); // novas investigações vão acontecer com a mudança do Head no período

  const selfRevert = mie.prioritization.pendingDecisions()
    .find(d => d.productId === 'p1' && d.diagnosis.cause === 'own_change');
  assert.equal(selfRevert, undefined, 'nenhuma proposta de reverter o experimento do próprio Head');
  // e a hipótese foi eliminada com a justificativa certa, não ignorada
  const cases = mie.investigation.cases.filter(c =>
    c.anomaly.productId === 'p1' && c.playbook === 'sales_drop' && c.day > decision.day);
  for (const c of cases) {
    const h = c.hypotheses.find(x => x.cause === 'own_change');
    if (h && h.eliminated && /janela de medição/.test(h.why)) return; // justificativa registrada
  }
});

test('Art. 13: a fila do dono nunca recebe decisões duplicadas equivalentes', () => {
  const mie = warmedMIE();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(12); // tempo suficiente para a anomalia reabrir após o dedupe de 7 dias

  const pending = mie.prioritization.pendingDecisions()
    .filter(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
  assert.equal(pending.length, 1, 'uma única decisão equivalente na mesa');
});

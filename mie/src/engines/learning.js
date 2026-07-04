/* LEARNING ENGINE — Constituição Arts. 15 e 18; MIF Parte 8.
   Fluxo obrigatório: decisão → resultado → avaliação → aprendizado →
   atualização da memória → atualização da estratégia.
   Nunca repetir erros: todo erro tem autópsia; toda recusa ensina. */
(function (NS) {
'use strict';

class LearningEngine {
  constructor(bus, memory, world, graph = null) {
    this.bus = bus; this.memory = memory; this.world = world;
    this.graph = graph; // o grafo se popula pelos eventos que este motor emite (Sprint 07)
    this.evaluations = [];
    bus.on('result.measured', ({ plan, prediction, result }) => this.evaluate(plan, prediction, result));
    bus.on('decision.refused', item => this.learnFromRefusal(item));
  }

  evaluate(plan, prediction, result) {
    const [min, max] = prediction.expectedLiftPct;
    /* efeito "para baixo" (ex.: reduzir devoluções): acerto é cair o prometido */
    const down = prediction.direction === 'down';
    const hit = down ? result.liftPct <= max * 0.6 : result.liftPct >= min * 0.6;
    const evaluation = {
      planId: plan.id, productId: plan.productId, type: plan.type,
      predicted: prediction.expectedLiftPct, actual: result.liftPct, hit,
      day: this.world ? this.world.day : NS._currentDay || 0,
    };
    this.evaluations.push(evaluation);
    this.memory.calibration.predictions += 1;
    if (hit) this.memory.calibration.hits += 1;

    /* calibração automática: o quanto a realidade entregou do prometido —
       corrige o otimismo/pessimismo das PRÓXIMAS estimativas deste tipo */
    const mid = (Math.abs(min) + Math.abs(max)) / 2;
    if (mid > 0) this.memory.updateCalibration(plan.type, Math.abs(result.liftPct) / mid);

    /* histórico de acertos dos especialistas (Sprint 06): os especialistas
       que sustentaram a recomendação executada ganham ou perdem peso. */
    for (const dom of prediction.contributingDomains || [])
      this.memory.recordSpecialistOutcome(dom, hit);

    /* avaliação → conhecimento (forma fixa do MIF 8.1) */
    if (hit) {
      this.bus.emit('learning.recorded', {
        key: `strategy.${plan.type}`,
        kind: 'strategy',
        discovery: `A estratégia "${plan.type}" funcionou: previsto ${pct(min)}–${pct(max)}, medido ${pct(result.liftPct)}.`,
        context: { productId: plan.productId },
        evidence: { planId: plan.id, predicted: prediction.expectedLiftPct, actual: result.liftPct },
      });
    } else {
      /* autópsia curta (Art. 18): o que previ, o que aconteceu, o que muda */
      this.bus.emit('learning.recorded', {
        key: `strategy.${plan.type}`,
        kind: 'strategy',
        contradicts: true,
        discovery: `A estratégia "${plan.type}" ficou abaixo do previsto (${pct(result.liftPct)} vs. ${pct(min)}–${pct(max)}): recalibrar antes de repetir.`,
        context: { productId: plan.productId },
        evidence: { planId: plan.id, predicted: prediction.expectedLiftPct, actual: result.liftPct },
      });
    }

    /* fechamento de ciclo: o dono recebe o "previsto vs. medido" no briefing */
    this.bus.emit('cycle.closed', {
      planId: plan.id, productId: plan.productId,
      report: hit
        ? `Estimei ${pct(min)}–${pct(max)}; deu ${pct(result.liftPct)}.`
        : `Estimei ${pct(min)}–${pct(max)}; veio ${pct(result.liftPct)}. O que aprendi: recalibrei a estratégia "${plan.type}".`,
      hit,
    });
    return evaluation;
  }

  learnFromRefusal(item) {
    // a preferência já foi gravada pelo Prioritization/Memory;
    // aqui registra-se o aprendizado estratégico
    this.bus.emit('learning.recorded', {
      key: `refusal.${item.diagnosis.proposal.type}`,
      kind: 'preference',
      discovery: `Propostas de "${item.diagnosis.proposal.type}" precisam de mais evidência ou outro ângulo para este dono.`,
      evidence: { decisionId: item.id, motive: item.resolution ? item.resolution.motive : null },
    });
  }

  accuracy() {
    const c = this.memory.calibration;
    return c.predictions ? c.hits / c.predictions : null;
  }
}

function pct(x) { return (x * 100).toFixed(0) + '%'; }

NS.LearningEngine = LearningEngine;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

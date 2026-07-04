/* PRIORITIZATION ENGINE — Constituição Arts. 13 e 19; MIF Parte 7.
   Decide o DESTINO de cada diagnóstico. Nunca mostra tudo:
     EXECUTE    — alçada Classe A/B: executa e reporta
     RECOMMEND  — decisão pronta na fila do dono
     INTERRUPT  — incidente: interrompe, mas SEMPRE com ação já em curso
     OBSERVE    — vigília silenciosa (o dono nunca fica sabendo)
     DISCARD    — não serve à missão

   Score (MIF 7.1):
     score = impacto(R$/mês) × probabilidade × urgência ÷ esforço
     × 1,5 se janela expira  · × 1,2 se recorrente
     ÷ 2 se irreversível     · teto baixo se confiança baixa */
(function (NS) {
'use strict';

class PrioritizationEngine {
  constructor(bus, memory, world) {
    this.bus = bus; this.memory = memory; this.world = world;
    this.queue = [];      // decisões aguardando o dono
    this.watchlist = [];  // observação silenciosa
    this.interrupts = []; // incidentes
    this.discarded = [];
    this._counter = 0;
    bus.on('diagnosis.ready', d => this.classify(d));
  }

  classify(d) {
    const item = this.scoreOf(d);

    /* 1. incidente crítico → INTERRUPT (com primeira resposta anexada) */
    if (d.severity === 'critical') {
      item.destination = 'INTERRUPT';
      this.interrupts.push(item);
      this.bus.emit('priority.classified', item);
      this.bus.emit('interrupt.raised', {
        ...item,
        rule: 'Art. 19: se às 18h o dono perguntaria "por que não me avisou?", avise agora — com ação já em curso',
      });
      return item;
    }

    /* 2. sem proposta acionável ou impacto irrelevante → curiosidade.
          Curiosidades NUNCA chegam ao dono (Art. 19). */
    if (!d.proposal || d.proposal.type === 'watch' || d.proposal.type === 'wait' || item.impactMonthly < 100) {
      item.destination = 'OBSERVE';
      this.watchlist.push(item);
      this.bus.emit('priority.classified', item);
      this.bus.emit('watch.added', { id: item.id, reason: item.reason });
      return item;
    }

    /* 3. confiança baixa → observar mais uma rodada, não alarmar (Art. 8.5) */
    if (d.confidenceLabel === 'baixa' || item.score < NS.CONFIG.THRESHOLD_RECOMMEND) {
      item.destination = item.score < 50 ? 'DISCARD' : 'OBSERVE';
      (item.destination === 'DISCARD' ? this.discarded : this.watchlist).push(item);
      this.bus.emit('priority.classified', item);
      if (item.destination === 'OBSERVE') this.bus.emit('watch.added', { id: item.id, reason: item.reason });
      return item;
    }

    /* 4. dentro de alçada (Classe A, e B quando pré-autorizada) → EXECUTE */
    const klass = d.proposal.class || 'C';
    const authorized = klass === 'A' || (klass === 'B' && this.memory.profile?.autoClassB);
    if (authorized) {
      item.destination = 'EXECUTE';
      this.bus.emit('priority.classified', item);
      this.bus.emit('execute.authorized', item);
      return item;
    }

    /* 5. fila curta por princípio (Art. 13): nunca duplicar uma decisão
          equivalente que já espera o dono */
    const duplicate = this.queue.find(q => !q.resolved &&
      q.productId === d.productId && q.diagnosis.proposal.type === d.proposal.type);
    if (duplicate) {
      item.destination = 'OBSERVE';
      item.reason = `equivalente à decisão ${duplicate.id} já na mesa do dono — não duplicar a fila`;
      this.watchlist.push(item);
      this.bus.emit('priority.classified', item);
      return item;
    }

    /* 6. decisão importante, preparada, com proposta → fila do dono */
    item.destination = 'RECOMMEND';
    this.queue.push(item);
    this.bus.emit('priority.classified', item);
    this.bus.emit('decision.created', item);
    return item;
  }

  scoreOf(d) {
    const revenue = this.world ? this.world.revenueMonthly(d.productId) : 10000;
    const pct = d.proposal ? Math.abs(d.proposal.impactPct[0] + d.proposal.impactPct[1]) / 2 : 0.02;
    /* a estimativa é corrigida pelo histórico de acerto das previsões
       deste tipo de estratégia (Learning → Memory → aqui) */
    const calibration = d.proposal ? this.memory.calibrationFactor(d.proposal.type) : 1;
    const impactMonthly = Math.round(revenue * pct * calibration);
    const probability = d.confidence;
    const urgency = d.severity === 'critical' ? 3 : d.severity === 'attention' ? 2 : 1;
    const effort = Math.max(1, d.proposal ? d.proposal.effort : 1);

    let score = (impactMonthly * probability * urgency) / effort;
    if (d.proposal && d.proposal.window) score *= 1.5;          // janela expira
    if (d.recurrence > 0) score *= 1.2;                          // padrão recorrente
    if (d.proposal && d.proposal.reversible === false) score /= 2;
    if (d.confidenceLabel === 'baixa') score = Math.min(score, NS.CONFIG.LOW_CONFIDENCE_CAP);

    /* o jeito do dono (Art. 18): propostas de um tipo que ele recusa perdem prioridade */
    if (d.proposal) score *= (1 - 0.5 * this.memory.reluctance(d.proposal.type));

    return {
      id: 'pr' + (++this._counter), day: NS._currentDay || 0,
      caseId: d.caseId, productId: d.productId, diagnosis: d,
      impactMonthly, probability, urgency, effort,
      score: Math.round(score),
      confidenceLabel: d.confidenceLabel,
      reason: d.causeLabel,
      title: d.proposal ? d.proposal.title : d.causeLabel,
    };
  }

  pendingDecisions() { return this.queue.filter(q => !q.resolved); }

  resolve(id, action, motive) {
    const item = this.queue.find(q => q.id === id);
    if (!item) throw new Error('decisão não encontrada: ' + id);
    item.resolved = true;
    item.resolution = { action, motive: motive || null, day: NS._currentDay || 0 };
    this.memory.recordDecision({
      id, cause: item.diagnosis.anomalyKind, proposalType: item.diagnosis.proposal.type,
      action, motive, day: item.resolution.day,
    });
    if (action === 'refuse') {
      this.memory.recordPreference({
        decisionId: id, proposalType: item.diagnosis.proposal.type, motive: motive || 'não informado',
      });
      this.bus.emit('decision.refused', item);
    } else if (action === 'approve') {
      this.bus.emit('decision.approved', item);
    }
    return item;
  }
}

NS.PrioritizationEngine = PrioritizationEngine;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

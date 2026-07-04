/* EXECUTION ENGINE — nesta fase NÃO executa APIs: gera PLANOS simulados.
   Constituição Art. 15: NENHUMA execução sem previsão registrada antes.
   Toda ação nasce reversível (versão) e com janela de medição definida.

   Ciclo de vida do plano:
     plan.created → (ciclos passam) → execution.completed → result.measured */
(function (NS) {
'use strict';

const MEASUREMENT_WINDOW = 7; // dias mínimos antes de concluir (MIF 5.3)

class ExecutionEngine {
  constructor(bus, world, memory) {
    this.bus = bus; this.world = world; this.memory = memory;
    this.plans = [];
    this._counter = 0;
    bus.on('decision.approved', item => this.execute(item));
    bus.on('execute.authorized', item => this.execute(item));
    bus.on('interrupt.raised', item => this.firstResponse(item));
  }

  execute(item) {
    const d = item.diagnosis;
    const p = this.world.product(d.productId);
    /* a métrica prometida acompanha a alavanca puxada (MIF 5.3: medir o fator certo) */
    const metric = d.proposal.type === 'creative' ? 'ctr' : 'conv';
    const baseline = this.currentMetric(d.productId, metric);

    /* Art. 15: a previsão vem ANTES da ação — sem previsão não há aprendizado */
    const prediction = {
      metric,
      baseline,
      expectedLiftPct: d.proposal.impactPct,
      windowDays: MEASUREMENT_WINDOW,
      registeredAtDay: this.world.day,
    };

    const plan = {
      id: 'plan' + (++this._counter),
      decisionId: item.id, caseId: d.caseId, productId: d.productId,
      title: d.proposal.title, type: d.proposal.type,
      steps: this.stepsFor(d.proposal, p),
      reversible: d.proposal.reversible !== false,
      versionBump: `v${(p.ownChanges.length + 2)}`,
      prediction,
      startDay: this.world.day, status: 'executing',
    };
    this.plans.push(plan);
    this.bus.emit('plan.created', { id: plan.id, title: plan.title, productId: plan.productId, prediction });
    this.bus.emit('activity.started', { text: `Executando: ${plan.title.toLowerCase()}` });

    /* o mundo simulado reage à ação (quando o Collector real chegar,
       isto vira a chamada de publicação de verdade) */
    this.world.applyProposalEffect(d.productId, d.proposal);
    this.bus.emit('execution.completed', { planId: plan.id });
    return plan;
  }

  /* Fluxo 008: incidente nunca chega ao dono sem ação já em curso */
  firstResponse(item) {
    const d = item.diagnosis;
    const actions = (d.proposal && d.proposal.firstResponse) || ['avaliar resposta imediata'];
    const plan = {
      id: 'plan' + (++this._counter),
      decisionId: null, caseId: d.caseId, productId: d.productId,
      title: 'Primeira resposta: ' + (d.proposal ? d.proposal.title : d.causeLabel),
      type: 'first_response', steps: actions.map(a => ({ step: a, status: 'in_progress' })),
      reversible: true, prediction: null, startDay: this.world.day, status: 'executing',
    };
    this.plans.push(plan);
    this.bus.emit('plan.created', { id: plan.id, title: plan.title, firstResponse: true });
    if (d.proposal && d.proposal.type === 'restore') this.world.applyProposalEffect(d.productId, d.proposal);
    return plan;
  }

  /* chamado pelo Scheduler a cada ciclo: mede planos cuja janela venceu */
  onTick() {
    for (const plan of this.plans) {
      if (plan.status !== 'executing' || !plan.prediction) continue;
      if (this.world.day - plan.startDay < plan.prediction.windowDays) continue;
      const actual = this.currentMetric(plan.productId, plan.prediction.metric);
      const liftPct = plan.prediction.baseline ? (actual - plan.prediction.baseline) / plan.prediction.baseline : 0;
      plan.status = 'measured';
      plan.result = { actual, liftPct: Math.round(liftPct * 1000) / 1000, measuredAtDay: this.world.day };
      this.bus.emit('result.measured', { plan, prediction: plan.prediction, result: plan.result });
    }
  }

  stepsFor(proposal, product) {
    const base = {
      reposition: ['redigir novo título/copy pelo diferencial', 'ajustar fotos de apoio', `publicar como nova versão de ${product.name}`, 'armar gatilho de reversão'],
      creative: ['gerar nova imagem principal', 'validar em miniatura de lista', 'publicar como nova versão', 'armar gatilho de reversão'],
      restore: ['restaurar versão anterior', 'confirmar publicação'],
      reputation: ['responder avaliações negativas publicamente', 'abrir verificação de lote/transportadora', 'ajustar foto de embalagem'],
      replicate: ['documentar a causa da vitória', 'aplicar nos produtos irmãos', 'testar elasticidade de preço para cima'],
    };
    return (base[proposal.type] || ['executar proposta']).map(s => ({ step: s, status: 'planned' }));
  }

  currentMetric(pid, metric) {
    const rows = this.world.seriesOf(pid, 3);
    return rows.length ? rows.reduce((s, r) => s + r[metric], 0) / rows.length : null;
  }
}

NS.ExecutionEngine = ExecutionEngine;
NS.MEASUREMENT_WINDOW = MEASUREMENT_WINDOW;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

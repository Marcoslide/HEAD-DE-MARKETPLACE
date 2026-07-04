/* HEAD REPORTER — a fronteira entre o MIE e a Camada de Experiência.
   Os motores nunca falam com o usuário (Art. 11): este módulo é o único
   que traduz o estado interno para a voz do Head (Art. 20 + docs/03).
   Quando um LLM entrar no produto, ele entra AQUI — como redator da voz —
   sem nenhuma mudança nos motores. */
(function (NS) {
'use strict';

class HeadReporter {
  constructor(bus, { world, memory, prioritization, investigation, learning }) {
    this.bus = bus; this.world = world; this.memory = memory;
    this.prioritization = prioritization; this.investigation = investigation;
    this.learning = learning;
    this.closedCycles = [];
    bus.on('cycle.closed', c => this.closedCycles.push(c));
  }

  composeBriefing() {
    const day = this.world.day;
    const decisions = this.prioritization.pendingDecisions();
    const interrupts = this.prioritization.interrupts.filter(i => i.day === day);
    const watching = this.prioritization.watchlist.length;
    const investigations = this.investigation ? this.investigation.cases.filter(c => c.day === day) : [];
    const cyclesToday = this.closedCycles.filter(c => c.day === day);

    const worked = [
      `Analisei ${this.world.products.length * 12} sinais da operação`,
      `Monitorei ${this.world.products.reduce((s, p) => s + p.competitors.length, 0)} concorrentes`,
      investigations.length ? `Abri ${investigations.length} investigação(ões)` : 'Mantive a vigília completa',
    ];

    return {
      day,
      greeting: `Bom dia. Enquanto você descansava, continuei trabalhando na sua operação.`,
      worked,
      decisions: decisions.map(d => ({
        id: d.id, title: d.title,
        impact: `~R$ ${d.impactMonthly.toLocaleString('pt-BR')}/mês`,
        confidence: d.confidenceLabel,
        why: d.reason,
      })),
      interrupts: interrupts.map(i => ({ title: i.title, note: 'já estou agindo — primeira resposta em curso' })),
      closedCycles: cyclesToday.map(c => c.report),
      watching: watching ? `Sigo de olho em ${watching} situação(ões) que ainda não merecem sua atenção.` : null,
      signature: decisions.length ? 'O resto eu toco. — Eu cuido do resto.' : 'Sem pendências. Eu cuido do resto.',
    };
  }

  /* interrupção de incidente (Fluxo 008): nunca alarme sem ação em curso */
  incidentMessage(interrupt) {
    const plan = interrupt.plan;
    return `${interrupt.title}. Já iniciei a primeira resposta${plan ? ` (${plan.steps.map(s => s.step).join('; ')})` : ''}. Próxima atualização em 1 ciclo.`;
  }
}

NS.HeadReporter = HeadReporter;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

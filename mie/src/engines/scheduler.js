/* OBSERVATION SCHEDULER — Constituição Art. 14: nunca fica parado.
   Tempo SIMULADO por ciclos (1 ciclo = 1 dia da operação). Cada ciclo
   percorre a rotina de vigília e SEMPRE emite atividades visíveis —
   é a fonte do Pulso da interface.

   Rotina de um ciclo (cadências diferentes por tarefa):
     leitura de concorrentes → leitura de avaliações → atualização de
     ranking → pesquisa de tendências → leitura de CTR → leitura de
     conversão → medição de planos → geração do briefing */
(function (NS) {
'use strict';

const ROUTINES = [
  { name: 'concorrentes', every: 1, activity: 'Monitorando preços e criativos dos concorrentes…' },
  { name: 'avaliacoes',   every: 1, activity: 'Lendo as avaliações novas da operação e dos concorrentes…' },
  { name: 'ranking',      every: 1, activity: 'Atualizando o ranking dos seus anúncios nas buscas estratégicas…' },
  { name: 'tendencias',   every: 7, activity: 'Pesquisando tendências e sazonalidade da categoria…' },
  { name: 'ctr',          every: 1, activity: 'Comparando o CTR de hoje com o normal da sua operação…' },
  { name: 'conversao',    every: 1, activity: 'Lendo a conversão e cruzando com o funil…' },
];

class ObservationScheduler {
  constructor(bus, { world, observation, execution, prioritization, memory, head }) {
    this.bus = bus; this.world = world; this.observation = observation;
    this.execution = execution; this.prioritization = prioritization;
    this.memory = memory; this.head = head;
    this.cycles = 0;
    this.lastActivities = [];
  }

  /* Um ciclo completo do organismo. */
  tick() {
    this.cycles += 1;
    this.world.advanceDay();
    this.lastActivities = [];

    /* vigília — nunca em silêncio */
    for (const r of ROUTINES) {
      if (this.cycles % r.every !== 0) continue;
      this.lastActivities.push(r.activity);
      this.bus.emit('activity.started', { text: r.activity, routine: r.name });
    }

    /* varredura de observação → anomalias → (bus) investigação → priorização */
    const anomalies = this.observation.scan();

    /* medir planos cuja janela venceu → (bus) aprendizado */
    if (this.execution) this.execution.onTick();

    /* fechamento do ciclo: o briefing do dia */
    const briefing = this.head ? this.head.composeBriefing() : null;
    if (briefing) this.bus.emit('briefing.ready', briefing);

    return { day: this.world.day, activities: this.lastActivities, anomalies, briefing };
  }

  runDays(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.tick());
    return out;
  }
}

NS.ObservationScheduler = ObservationScheduler;
NS.ROUTINES = ROUTINES;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

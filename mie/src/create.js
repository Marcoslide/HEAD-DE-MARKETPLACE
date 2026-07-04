/* createMIE — composição dos motores (Node e navegador).
   Os motores só se conhecem pelo EventBus; este é o único arquivo
   que enxerga todos. */
(function (NS) {
'use strict';

NS.createMIE = function createMIE(options = {}) {
  const audit = new NS.AuditLog();
  const bus = new NS.EventBus(audit);
  const world = NS.Sim.createWorld({ seed: options.seed ?? 42 });
  const graph = new NS.KnowledgeGraph();               // cérebro associativo (Sprint 07)
  NS.wireGraph(graph, bus, world);                     // popula-se a partir dos eventos
  const memory = new NS.MemoryEngine(bus, graph);
  const specialists = NS.Specialists.createRegistry();
  const observation = new NS.ObservationEngine(bus, world, memory);
  const investigation = new NS.InvestigationEngine(bus, memory, specialists, world, graph);
  const prioritization = new NS.PrioritizationEngine(bus, memory, world);
  const execution = new NS.ExecutionEngine(bus, world, memory);
  const learning = new NS.LearningEngine(bus, memory, world, graph);
  const epe = new NS.ExecutivePlanningEngine(bus, { world, memory, prioritization, investigation, graph, learning });
  const head = new NS.HeadReporter(bus, { world, memory, prioritization, investigation, learning });
  const scheduler = new NS.ObservationScheduler(bus, { world, observation, execution, prioritization, memory, head });

  return {
    audit, bus, world, graph, memory, specialists,
    observation, investigation, prioritization, execution, learning, epe, scheduler, head,
    tick: () => scheduler.tick(),
    runDays: n => scheduler.runDays(n),
    planDay: opts => epe.planDay(opts),
    approve: id => prioritization.resolve(id, 'approve'),
    refuse: (id, motive) => prioritization.resolve(id, 'refuse', motive),
  };
};
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

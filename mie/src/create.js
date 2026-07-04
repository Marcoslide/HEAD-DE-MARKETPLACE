/* createMIE — composição dos motores (Node e navegador).
   Os motores só se conhecem pelo EventBus; este é o único arquivo
   que enxerga todos. */
(function (NS) {
'use strict';

NS.createMIE = function createMIE(options = {}) {
  const audit = new NS.AuditLog();
  const bus = new NS.EventBus(audit);
  const world = NS.Sim.createWorld({ seed: options.seed ?? 42 });
  const memory = new NS.MemoryEngine(bus);
  const specialists = NS.Specialists.createRegistry();
  const observation = new NS.ObservationEngine(bus, world, memory);
  const investigation = new NS.InvestigationEngine(bus, memory, specialists, world);
  const prioritization = new NS.PrioritizationEngine(bus, memory, world);
  const execution = new NS.ExecutionEngine(bus, world, memory);
  const learning = new NS.LearningEngine(bus, memory, world);
  const head = new NS.HeadReporter(bus, { world, memory, prioritization, investigation, learning });
  const scheduler = new NS.ObservationScheduler(bus, { world, observation, execution, prioritization, memory, head });

  return {
    audit, bus, world, memory, specialists,
    observation, investigation, prioritization, execution, learning, scheduler, head,
    tick: () => scheduler.tick(),
    runDays: n => scheduler.runDays(n),
    approve: id => prioritization.resolve(id, 'approve'),
    refuse: (id, motive) => prioritization.resolve(id, 'refuse', motive),
  };
};
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

/* EventBus — o único canal de comunicação entre motores.
   Motores não se chamam diretamente: publicam e assinam eventos.
   Isso mantém cada motor desacoplado, testável e substituível.

   Catálogo de eventos (contrato do sistema):
     signal.observed        Observation → (métrica lida em um ciclo)
     anomaly.detected       Observation → Investigation
     activity.started       Scheduler/motores → Experiência (o Pulso)
     investigation.opened   Investigation
     investigation.step     Investigation (diário de bordo)
     diagnosis.ready        Investigation → Prioritization
     priority.classified    Prioritization → (destino decidido)
     decision.created       Prioritization → fila do dono
     interrupt.raised       Prioritization → incidente (com ação já em curso)
     watch.added            Prioritization → vigília silenciosa
     plan.created           Execution (plano simulado, com previsão)
     execution.completed    Execution → Learning
     result.measured        Execution → Learning
     learning.recorded      Learning → Memory
     memory.updated         Memory
     briefing.ready         Scheduler → Experiência
*/
(function (NS) {
'use strict';

class EventBus {
  constructor(audit) {
    this.audit = audit;
    this.subs = new Map();
    this.history = [];
  }
  on(type, fn) {
    if (!this.subs.has(type)) this.subs.set(type, []);
    this.subs.get(type).push(fn);
  }
  emit(type, payload) {
    const event = { type, payload, day: NS._currentDay || 0 };
    this.history.push(event);
    if (this.audit) this.audit.record('bus', type, summarize(payload));
    for (const fn of this.subs.get(type) || []) fn(payload, event);
    return event;
  }
  ofType(type) { return this.history.filter(e => e.type === type); }
}

function summarize(p) {
  if (p == null) return null;
  if (typeof p !== 'object') return p;
  const out = {};
  for (const k of ['id', 'kind', 'productId', 'metric', 'cause', 'destination', 'title', 'severity', 'confidenceLabel'])
    if (p[k] !== undefined) out[k] = p[k];
  return out;
}

NS.EventBus = EventBus;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

/* Kernel · EventBus — comunicação entre módulos da plataforma (Bloco 02).
   Event-Driven Architecture: módulos publicam fatos, não chamam uns aos
   outros. Suporta curingas ("listing.*", "*"), middleware e histórico
   limitado (ring buffer) para não crescer sem teto com milhares de
   anúncios. Síncrono por padrão; o processamento pesado vai para a Queue. */
'use strict';

class EventBus {
  constructor({ historyLimit = 5000, logger = null } = {}) {
    this.subs = new Map();          // pattern → [handler]
    this.middleware = [];           // (event) => event | null (null = veta)
    this.history = [];
    this.historyLimit = historyLimit;
    this.logger = logger;
    this._seq = 0;
  }

  on(pattern, handler) {
    if (!this.subs.has(pattern)) this.subs.set(pattern, []);
    this.subs.get(pattern).push(handler);
    return () => this.off(pattern, handler);
  }
  off(pattern, handler) {
    const list = this.subs.get(pattern) || [];
    const i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  }
  once(pattern, handler) {
    const un = this.on(pattern, (p, e) => { un(); handler(p, e); });
    return un;
  }
  use(fn) { this.middleware.push(fn); }

  emit(type, payload) {
    let event = { seq: ++this._seq, type, payload, at: Date.now() };
    for (const mw of this.middleware) {
      event = mw(event);
      if (!event) return null; // vetado
    }
    this.history.push(event);
    if (this.history.length > this.historyLimit) this.history.shift();
    if (this.logger) this.logger.debug('event', { type, seq: event.seq });
    for (const [pattern, handlers] of this.subs) {
      if (!match(pattern, type)) continue;
      for (const h of [...handlers]) h(event.payload, event);
    }
    return event;
  }

  ofType(pattern) { return this.history.filter(e => match(pattern, e.type)); }
}

function match(pattern, type) {
  if (pattern === '*' || pattern === type) return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return false;
}

module.exports = { EventBus };

/* AuditLog — a caixa-preta do MIE.
   Cada passo de cada motor é registrado aqui. Nada acontece sem trilha.
   (Constituição Art. 12: o dono pode ver o caminho, não só a conclusão.) */
(function (NS) {
'use strict';

class AuditLog {
  constructor({ limit = 20000 } = {}) {
    this.entries = [];
    this.limit = limit; // ring: caixa-preta com teto (não vaza em execuções longas)
    this.listeners = [];
    this._seq = 0;
  }
  record(engine, action, detail) {
    const entry = {
      seq: ++this._seq,
      day: NS._currentDay || 0,
      engine, action,
      detail: detail === undefined ? null : detail,
    };
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
    for (const fn of this.listeners) fn(entry);
    return entry;
  }
  on(fn) { this.listeners.push(fn); }
  byEngine(engine) { return this.entries.filter(e => e.engine === engine); }
  tail(n = 20) { return this.entries.slice(-n); }
}

NS.AuditLog = AuditLog;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

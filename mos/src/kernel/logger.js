/* Kernel · Logger — logs estruturados (Bloco 04).
   Linhas JSON com nível, contexto e correlação — prontos para qualquer
   agregador futuro. Em teste, escreve só na memória. */
'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

class Logger {
  constructor({ level = 'info', sink = null, context = {} } = {}) {
    this.level = LEVELS[level] ?? 20;
    this.sink = sink; // null = memória; função = destino (ex.: console.log)
    this.context = context;
    this.entries = [];
  }
  child(context) {
    const c = new Logger({ sink: this.sink, context: { ...this.context, ...context } });
    c.level = this.level;
    c.entries = this.entries; // compartilha o buffer
    return c;
  }
  log(level, msg, data = {}) {
    if (LEVELS[level] < this.level) return;
    const entry = { ts: new Date().toISOString(), level, msg, ...this.context, ...data };
    this.entries.push(entry);
    if (this.entries.length > 10000) this.entries.shift();
    if (this.sink) this.sink(JSON.stringify(entry));
  }
  debug(msg, data) { this.log('debug', msg, data); }
  info(msg, data) { this.log('info', msg, data); }
  warn(msg, data) { this.log('warn', msg, data); }
  error(msg, data) { this.log('error', msg, data); }
}

module.exports = { Logger };

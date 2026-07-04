/* CLOCK (Sprint 08.1) — a fonte ÚNICA, injetável e testável de tempo.
   O tempo deixa de ser detalhe implícito do runtime e passa a ser parte
   explícita do contexto de decisão.

   Regra de ouro: NENHUM motor do MIE chama `new Date()` ou `Date.now()`
   diretamente — só este arquivo. Todo timestamp de mundo real (proveniência
   de eventos, hora da decisão, geração do plano) vem daqui.

   Distinção importante do MIE:
   - o "dia" simulado (NS._currentDay) é o contador de CICLOS do mundo
     determinístico — usado por score, decaimento do grafo, janelas de medição;
   - o Clock dá o tempo de PAREDE (ISO/timezone) — usado para proveniência
     (occurredAt/observedAt/decidedAt/executedAt) quando os eventos reais
     chegarem (Shopee, ML, Amazon, WhatsApp).
   Os dois coexistem: um é cadência interna, o outro é o relógio do mundo. */
(function (NS) {
'use strict';

const DEFAULT_TZ = 'America/Sao_Paulo';
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

function createClock({ now = () => new Date(), timezone = DEFAULT_TZ, kind = 'system' } = {}) {
  const dayFmt = new Intl.DateTimeFormat('en-CA',
    { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return {
    timezone, kind,
    now() { return new Date(now()); },
    nowMs() { return this.now().getTime(); },
    nowIso() { return this.now().toISOString(); },
    today() { return dayFmt.format(this.now()); },
    dateKey(date = this.now()) { return dayFmt.format(date instanceof Date ? date : new Date(date)); },
    /* início e fim do dia LOCAL (na timezone da operação), em ISO UTC */
    dayBounds(date = this.now()) {
      const key = this.dateKey(date);
      const [y, m, d] = key.split('-').map(Number);
      const noon = new Date(Date.UTC(y, m - 1, d, 12));
      const off = zoneOffsetMs(noon, timezone);
      const startUTC = Date.UTC(y, m - 1, d, 0, 0, 0) - off;
      return { dateKey: key, startIso: new Date(startUTC).toISOString(), endIso: new Date(startUTC + DAY - 1).toISOString() };
    },
    /* preenche observedAt de um evento com o tempo do Clock, se não vier */
    stampEvent(evt = {}) {
      return { ...evt, observedAt: evt.observedAt || this.nowIso() };
    },
  };
}

/* offset (ms) entre a timezone e UTC no instante dado — sem libs externas */
function zoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = dtf.formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === '24' ? 0 : p.hour), +p.minute, +p.second);
  return asUTC - date.getTime();
}

/* Clock congelado — para testes deterministas */
function frozenClock(iso, timezone = DEFAULT_TZ) {
  const fixed = new Date(iso);
  return createClock({ now: () => new Date(fixed), timezone, kind: 'frozen' });
}

const systemClock = createClock();

/* ---------- helpers temporais PUROS (sem regra de negócio) ---------- */
const toMs = d => (d instanceof Date ? d.getTime() : new Date(d).getTime());
const time = {
  MIN, HOUR, DAY, toMs,
  diffMinutes: (a, b) => (toMs(b) - toMs(a)) / MIN,
  diffHours: (a, b) => (toMs(b) - toMs(a)) / HOUR,
  diffDays: (a, b) => (toMs(b) - toMs(a)) / DAY,
  isExpired: (expiresAt, asOf) => expiresAt != null && toMs(asOf) > toMs(expiresAt),
  isRecent: (ts, asOf, withinMs = DAY) => ts != null && (toMs(asOf) - toMs(ts)) <= withinMs && toMs(asOf) >= toMs(ts),
  waitingMs: (since, asOf) => Math.max(0, toMs(asOf) - toMs(since)),
  windowsOverlap: (aStart, aEnd, bStart, bEnd) => toMs(aStart) <= toMs(bEnd) && toMs(bStart) <= toMs(aEnd),
};

NS.createClock = createClock;
NS.frozenClock = frozenClock;
NS.systemClock = systemClock;
NS.time = time;
NS.stampEvent = (clock, evt) => (clock || systemClock).stampEvent(evt);
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

/* HEAD CHAT · PERÍODOS (Sprint 09.A) — todo tempo vem do Clock injetado
   (America/Sao_Paulo). "Hoje" é o dia operacional LOCAL; "até agora" é o
   instante do Clock; comparações parciais são hora-contra-hora (nunca dia
   parcial contra dia inteiro sem avisar). */
(function (NS) {
'use strict';

const DAY = 86400000;

function resolvePeriod(spec, clock) {
  const type = spec && spec.type ? spec.type : 'TODAY';
  const now = clock.now();
  const today = clock.dayBounds(now);
  const dayAgo = n => clock.dayBounds(new Date(clock.nowMs() - n * DAY));

  switch (type) {
    case 'TODAY':
      return { type, startIso: today.startIso, endIso: clock.nowIso(),
               label: `hoje até agora`, partial: true, dateKeys: [today.dateKey] };
    case 'YESTERDAY': {
      const y = dayAgo(1);
      return { type, startIso: y.startIso, endIso: y.endIso,
               label: 'ontem (dia completo)', partial: false, dateKeys: [y.dateKey] };
    }
    case 'SAME_TIME_YESTERDAY': {
      const y = dayAgo(1);
      const elapsed = clock.nowMs() - new Date(today.startIso).getTime();
      return { type, startIso: y.startIso,
               endIso: new Date(new Date(y.startIso).getTime() + elapsed).toISOString(),
               label: 'ontem até o mesmo horário', partial: true, dateKeys: [y.dateKey],
               sameTime: true };
    }
    case 'THIS_WEEK': {   // semana operacional: começa na segunda
      const dow = weekdayInTz(now, clock.timezone);           // 0=domingo
      const daysSinceMonday = (dow + 6) % 7;
      const start = dayAgo(daysSinceMonday);
      return { type, startIso: start.startIso, endIso: clock.nowIso(),
               label: 'esta semana (desde segunda)', partial: true,
               dateKeys: keysBetween(start.dateKey, today.dateKey) };
    }
    case 'LAST_7_DAYS': {
      const start = dayAgo(6);
      return { type, startIso: start.startIso, endIso: clock.nowIso(),
               label: 'últimos 7 dias', partial: true,
               dateKeys: keysBetween(start.dateKey, today.dateKey) };
    }
    case 'LAST_30_DAYS': {
      const start = dayAgo(29);
      return { type, startIso: start.startIso, endIso: clock.nowIso(),
               label: 'últimos 30 dias', partial: true,
               dateKeys: keysBetween(start.dateKey, today.dateKey) };
    }
    case 'THIS_MONTH': {
      const [y, m] = today.dateKey.split('-');
      const startKey = `${y}-${m}-01`;
      const start = clock.dayBounds(new Date(`${startKey}T12:00:00Z`));
      return { type, startIso: start.startIso, endIso: clock.nowIso(),
               label: 'este mês', partial: true, dateKeys: keysBetween(startKey, today.dateKey) };
    }
    case 'LAST_WEEK': {
      const dow = weekdayInTz(now, clock.timezone);
      const daysSinceMonday = (dow + 6) % 7;
      const end = dayAgo(daysSinceMonday + 1);
      const start = dayAgo(daysSinceMonday + 7);
      return { type, startIso: start.startIso, endIso: end.endIso,
               label: 'semana passada (completa)', partial: false,
               dateKeys: keysBetween(start.dateKey, end.dateKey) };
    }
    default:
      return resolvePeriod({ type: 'TODAY' }, clock);
  }
}

function weekdayInTz(date, timeZone) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

function keysBetween(startKey, endKey) {
  const out = [];
  let d = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + DAY);
  }
  return out;
}

/* hora local (HH:MM) do Clock, para o rodapé "Atualizado às ..." */
function localTime(clock) {
  return new Intl.DateTimeFormat('pt-BR',
    { timeZone: clock.timezone, hour: '2-digit', minute: '2-digit' }).format(clock.now());
}

NS.resolvePeriod = resolvePeriod;
NS.localTime = localTime;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCHAT = globalThis.HEADCHAT || {}));

/* SPECIALISTS ENGINE (Sprint 06) — montagem — Constituição Arts. 10-11.
   Assembla o roster (roster.js) e o Conselho (council.js) numa API única.
   Retrocompatível: `createRegistry()` continua com `domains` e `consult()`
   retornando pareceres no formato fixo (agora enriquecido).

   Quem decide continua sendo o Motor de Priorização + Constituição + MIF.
   Este módulo só OPINA e CONSOLIDA (Art. 11.5). */
(function (NS) {
'use strict';
if (typeof require !== 'undefined') { require('./roster.js'); require('./council.js'); }

const { ROSTER, parecer } = NS._roster;
const { deliberate, buildWeigher } = NS._council;

function createRegistry() {
  const domains = Object.keys(ROSTER);
  return {
    domains,
    /* consulta os especialistas (todos, ou um subconjunto) */
    consult(ctx, only) {
      const list = only || domains;
      return list.map(d => ROSTER[d](ctx));
    },
    /* consulta + delibera: pareceres + parecer consolidado do Conselho */
    council(ctx, { memory, problemType } = {}) {
      const pareceres = this.consult(ctx);
      const weightOf = buildWeigher(memory || ctx.memory, { problemType });
      return { pareceres, ...deliberate(pareceres, { weightOf }) };
    },
  };
}

NS.Specialists = { createRegistry, parecer, deliberate, buildWeigher };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

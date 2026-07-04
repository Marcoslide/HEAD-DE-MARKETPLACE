/* Observabilidade (Bloco 12) — painel INTERNO de desenvolvimento.
   NÃO faz parte do produto e não altera a interface do cliente:
   vive sob /__dev na API interna, atrás de flag.

   Visualiza: motores (MIE), especialistas, filas, eventos, logs,
   missões, aprendizado, memória e execution plans. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function mountObservability(router, mos, { mie = null } = {}) {

  router.get('/__dev', { summary: 'Painel de observabilidade (dev)', tags: ['dev'] },
    () => ({ _html: fs.readFileSync(path.join(__dirname, 'dev-panel.html'), 'utf8') }));

  router.get('/__dev/overview', { summary: 'Visão geral: filas, eventos, logs', tags: ['dev'] }, () => ({
    queues: Object.fromEntries(Object.entries(mos.queues).map(([name, q]) =>
      [name, { pending: q.pending.length, active: q.active, processed: q.processed, dead: q.deadLetter.length }])),
    events: { total: mos.bus.history.length,
      lastTypes: mos.bus.history.slice(-8).map(e => e.type) },
    logs: { total: mos.logger.entries.length,
      errors: mos.logger.entries.filter(e => e.level === 'error').length },
    db: {
      decisions: mos.repos.decision.count(), missions: mos.repos.mission.count(),
      listings: mos.repos.listing.count(), memory: mos.repos.memory.count(),
      plans: mos.repos.plan.count(), audit: mos.db.get('SELECT count(*) n FROM audit_log').n,
    },
    mie: mie ? {
      day: mie.world.day,
      investigations: mie.investigation.cases.length,
      pendingDecisions: mie.prioritization.pendingDecisions().length,
      watchlist: mie.prioritization.watchlist.length,
      knowledge: mie.memory.knowledge.length,
    } : null,
  }));

  router.get('/__dev/events', { summary: 'Últimos eventos do bus', tags: ['dev'] },
    ({ query }) => ({ items: mos.bus.history.slice(-(Number(query.limit) || 50)).reverse()
      .map(e => ({ seq: e.seq, type: e.type, payload: e.payload })) }));

  router.get('/__dev/logs', { summary: 'Logs estruturados', tags: ['dev'] },
    ({ query }) => ({ items: mos.logger.entries.slice(-(Number(query.limit) || 50)).reverse() }));

  router.get('/__dev/queues', { summary: 'Detalhe das filas', tags: ['dev'] },
    () => ({ items: Object.entries(mos.queues).map(([name, q]) => ({
      name, concurrency: q.concurrency, pending: q.pending.length, active: q.active,
      processed: q.processed, retryScheduled: q.retryScheduled,
      deadLetter: q.deadLetter.map(d => ({ job: d.job.id, error: d.error })) })) }));

  router.get('/__dev/missions', { summary: 'Missões (todas)', tags: ['dev'] },
    () => ({ items: mos.repos.mission.page({ limit: 100 }).items }));

  router.get('/__dev/memory', { summary: 'Memória da empresa (crua)', tags: ['dev'] },
    () => ({ items: mos.repos.memory.page({ limit: 200 }).items }));

  router.get('/__dev/plans', { summary: 'Execution plans', tags: ['dev'] },
    () => ({ items: mos.repos.plan.page({ limit: 100 }).items }));

  router.get('/__dev/learning', { summary: 'Registros de aprendizado', tags: ['dev'] },
    () => ({ items: mos.repos.learning.page({ limit: 100 }).items }));

  /* motores e especialistas (quando um MIE está acoplado à instância) */
  router.get('/__dev/mie', { summary: 'Estado dos motores do MIE', tags: ['dev'] }, () => {
    if (!mie) return { attached: false };
    return {
      attached: true, day: mie.world.day,
      engines: {
        observation: { openAnomalies: mie.observation.openAnomalies.size },
        investigation: {
          cases: mie.investigation.cases.slice(-10).reverse().map(c => ({
            id: c.id, playbook: c.playbook, productId: c.anomaly.productId,
            cause: c.diagnosis ? c.diagnosis.cause : null,
            confidence: c.diagnosis ? c.diagnosis.confidenceLabel : null,
            steps: c.steps.length })) },
        prioritization: {
          pending: mie.prioritization.pendingDecisions().map(d => ({ id: d.id, title: d.title, score: d.score })),
          watchlist: mie.prioritization.watchlist.length,
          interrupts: mie.prioritization.interrupts.length },
        execution: { plans: mie.execution.plans.slice(-10).map(p => ({ id: p.id, title: p.title, status: p.status })) },
        learning: { evaluations: mie.learning.evaluations.length, accuracy: mie.learning.accuracy() },
        memory: mie.memory.snapshot(),
      },
      specialists: mie.specialists.domains,
      specialistScores: mie.memory.specialistsSnapshot ? mie.memory.specialistsSnapshot() : [],
      lastPareceres: (mie.investigation.cases.at(-1) || { pareceres: [] }).pareceres
        .map(p => ({ domain: p.domain, constatacao: p.constatacao, confianca: p.confianca,
          urgencia: p.urgencia, recommendationType: p.recommendationType })),
      lastCouncil: (() => {
        const c = [...mie.investigation.cases].reverse().find(x => x.council);
        if (!c) return null;
        return {
          caseId: c.id, productId: c.anomaly.productId,
          consensus: c.council.consensus,
          agreements: c.council.agreements,
          conflicts: c.council.conflicts,
          divergent: c.council.divergent.map(d => d.domain),
          consolidated: c.council.consolidated,
        };
      })(),
    };
  });
}

module.exports = { mountObservability };

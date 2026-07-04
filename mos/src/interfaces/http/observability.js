/* Observabilidade (Bloco 12) — painel INTERNO de desenvolvimento.
   NÃO faz parte do produto e não altera a interface do cliente:
   vive sob /__dev na API interna, atrás de flag.

   Visualiza: motores (MIE), especialistas, filas, eventos, logs,
   missões, aprendizado, memória e execution plans. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function mountObservability(router, mos, { mie = null, central = null, chat = null } = {}) {

  /* ---------- Head Chat Operational Intelligence (Sprint 09.A) ---------- */
  if (chat) {
    router.post('/chat', { summary: 'Conversa com o Head (operacional)', tags: ['chat'] },
      ({ body }) => {
        if (!body || !body.text) throw new Error('body.text é obrigatório');
        const r = chat.ask(body.text);
        return { reply: r.reply, intent: r.intent,
                 dataSource: r.facts ? r.facts.dataSource : null };
      });
    router.get('/chat/briefing', { summary: 'Briefing da manhã', tags: ['chat'] },
      () => ({ message: chat.briefing().message }));
    router.get('/chat/radar', { summary: 'Radar operacional', tags: ['chat'] },
      () => ({ message: chat.radar().message }));
    router.get('/chat/closing', { summary: 'Fechamento do dia', tags: ['chat'] },
      () => ({ message: chat.closing().message }));

    router.get('/__dev/chat', { summary: 'Debug do Head Chat: intenção, consulta, fonte', tags: ['dev'] },
      () => ({
        readOnly: chat.readOnly,
        clock: { timezone: chat.clock.timezone, now: chat.clock.nowIso(), kind: chat.clock.kind },
        dataset: { source: chat.dataset.source, isLive: chat.dataset.isLive,
                   coverage: chat.dataset.connectedPlatforms,
                   missingPlatforms: chat.dataset.missingPlatforms },
        lastTrace: chat.lastTrace,                 // intenção + consulta + fonte + falhas
        contextActive: chat.context ? {
          metric: chat.context.metric, platforms: chat.context.platforms,
          period: chat.context.period && chat.context.period.type } : null,
        proposals: chat.proposals,
        memoryNotes: chat.memoryNotes.length,
      }));
  }

  /* ---------- Integrações de Marketplace (Central, Sprint 09) ---------- */
  if (central) {
    router.get('/__dev/central', { summary: 'Central de Marketplace: conexões, syncs, sinais', tags: ['dev'] }, () => {
      const connections = mos.repos.connection.db.all(
        `SELECT mc.*, c.name AS company_name FROM marketplace_connection mc
         JOIN company c ON c.id = mc.company_id ORDER BY mc.id`);
      const nowMs = central.clock.nowMs();
      return {
        readOnly: central.readOnly,                       // lei do sprint, visível
        clock: { timezone: central.clock.timezone, now: central.clock.nowIso(),
                 kind: central.clock.kind },
        transport: { kind: central.transport.kind },      // fixture | http
        platforms: Object.values(central.declarations).map(d => ({
          id: d.id, displayName: d.displayName, integrationStatus: d.integrationStatus,
          authType: d.authType, supportsWebhooks: d.supportsWebhooks,
          capabilities: d.capabilities,
        })),
        connections: connections.map(c => ({
          id: c.id, company: c.company_name, companyId: c.company_id,
          platform: c.marketplace, status: c.status,
          accountId: c.account_id, storeId: c.store_id,
          readOnly: c.read_only !== 0, connectedAt: c.connected_at,
          credential: central.credentials.maskedStatus(c.id),   // máscara, nunca segredo
        })),
        syncStates: mos.repos.syncState.db.all('SELECT * FROM marketplace_sync_state ORDER BY platform, resource')
          .map(s => ({
            platform: s.platform, resource: s.resource, status: s.status,
            watermark: s.watermark, lastSuccessAt: s.last_success_at,
            lagMs: s.last_success_at ? nowMs - new Date(s.last_success_at).getTime() : null,
            records: { read: s.records_read, created: s.records_created,
                       updated: s.records_updated, ignored: s.records_ignored },
            error: s.error,
          })),
        recentSyncLogs: mos.repos.syncLog.db.all(
          'SELECT * FROM marketplace_sync_log ORDER BY id DESC LIMIT 20'),
        events: {
          total: mos.repos.integrationEvent.count(),
          duplicatesBlocked: central.events.duplicates,
          last: mos.repos.integrationEvent.db.all(
            'SELECT id, platform, event_type, entity_id, occurred_at FROM integration_event ORDER BY rowid DESC LIMIT 10'),
        },
        queue: { pending: mos.queues.sync ? mos.queues.sync.size() : 0,
                 processed: mos.queues.sync ? mos.queues.sync.processed : 0,
                 dead: mos.queues.sync ? mos.queues.sync.deadLetter.length : 0 },
        signalsToEPE: central.bridge ? central.bridge.stats : null,
        publicResearch: { total: mos.repos.publicResearch.count() },
      };
    });

    /* botão de dev: sincronização MOCK — recusa qualquer transporte real */
    router.post('/__dev/central/sync-mock', { summary: 'Executa sincronização mock (só fixtures)', tags: ['dev'] }, () => {
      if (central.transport.kind !== 'fixture')
        throw new Error('sync-mock bloqueado: o transporte ativo não é de fixtures — nunca tocar conta real por acidente');
      const companies = mos.repos.company.db.all('SELECT id FROM company');
      const queued = {};
      for (const c of companies) queued[c.id] = central.orchestrator.syncCompany(c.id);
      return { ok: true, transport: 'fixture', queued };
    });
  }

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
      /* Clock ativo (Sprint 08.1) — tempo de mundo real por trás do plano */
      clock: mie.clock ? {
        timezone: mie.clock.timezone,
        now: mie.clock.nowIso(),
        today: mie.clock.today(),
        kind: mie.clock.kind,                         // system | frozen (injetado)
        lastPlanGeneratedAt: (mie.epe && mie.epe.lastPlan) ? mie.epe.lastPlan.generatedAtIso : null,
      } : null,
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
      knowledgeGraph: mie.graph ? {
        ...mie.graph.stats(),
        whatWorkedForCategory: mie.graph.whatWorkedForCategory('Quadros').slice(0, 5),
        topObjections: mie.graph.topObjections().slice(0, 5),
      } : null,
      executivePlan: mie.epe ? (() => {
        const p = mie.epe.planDay();
        return { funnel: p.funnel, levelBreakdown: p.levelBreakdown,
          attention: p.attention, decisions: p.decisions.map(d => ({ level: d.level, title: d.title, score: d.score })),
          silence: p.silence.slice(0, 6) };
      })() : null,
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

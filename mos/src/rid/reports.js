/* RELATÓRIOS PROATIVOS + PERFIL DE LIDERANÇA (Sprint 10.C).

   Relatórios usam as MESMAS fontes (Query Layer/Growth/RID) e declaram
   período, fonte, cobertura e natureza do dado. Anti-spam por dedup:
   um relatório por tipo/período. O perfil do dono ajusta linguagem e
   ritmo — NUNCA a análise: o Head não concorda para agradar. */
'use strict';

class LeadershipProfile {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  /* onboarding progressivo: uma pergunta por vez, em momento natural */
  ONBOARDING = [
    ['preferred_name', 'Como prefere ser chamado? (Marcos, Chefe, Diretor…)'],
    ['communication_tone', 'Você prefere comunicação direta ou detalhada?'],
    ['interruption_preference', 'Posso te interromper quando houver problema importante?'],
    ['decision_style', 'Prefere problema com solução pronta ou discussão antes?'],
    ['strategic_priorities_json', 'Qual a prioridade atual da empresa?'],
    ['approval_boundaries_json', 'Quais decisões você quer aprovar pessoalmente?'],
    ['execution_support_style', 'Quando travar, quer que eu divida em microtarefas?'],
    ['focus_windows_json', 'Quais horários você costuma ter mais foco?'],
    ['anti_preferences_json', 'Quais comportamentos você NÃO quer que o Head tenha?'],
  ];

  get(companyId, userId) {
    return this.r.leadershipProfile.db.get(
      'SELECT * FROM user_leadership_profile WHERE company_id = ? AND user_id = ?',
      companyId, userId) || null;
  }

  ensure(companyId, userId) {
    return this.get(companyId, userId) || this.r.leadershipProfile.insert({
      company_id: companyId, user_id: userId, created_at: this.clock.nowIso() });
  }

  nextQuestion(companyId, userId) {
    const p = this.ensure(companyId, userId);
    const missing = this.ONBOARDING.find(([field]) => !p[field]);
    return missing ? { field: missing[0], question: missing[1] } : null;
  }

  update(companyId, userId, fields) {
    const p = this.ensure(companyId, userId);
    const updated = this.r.leadershipProfile.update(p.id, { ...fields,
      confidence: 'MEDIUM', updated_at: this.clock.nowIso() });
    this.r.audit.record('rid-profile', 'updated', { companyId,
      entity: 'user_leadership_profile', entityId: p.id,
      detail: { fields: Object.keys(fields) } });
    return updated;
  }

  /* VOZ: adapta saudação/tom — o CONTEÚDO da análise não muda nunca */
  voice(companyId, userId, text) {
    const p = this.get(companyId, userId);
    const name = p && p.preferred_name ? p.preferred_name : null;
    return name ? `${name}, ${text[0].toLowerCase()}${text.slice(1)}` : text;
  }
}

class ReportEngine {
  constructor({ repos, growth, memory, dialogues, clock, whatsappSend = null }) {
    this.r = repos; this.growth = growth; this.memory = memory;
    this.dialogues = dialogues; this.clock = clock; this.whatsappSend = whatsappSend;
  }

  _label(v) { return v == null ? 'SEM_DADO' : v; }

  /* DAILY EXECUTIVE BRIEF — 1 por dia (dedup), estrutura fixa e honesta */
  dailyBrief(companyId, { dataset = null, force = false } = {}) {
    const day = this.clock.nowIso().slice(0, 10);
    const dedup = `DAILY_BRIEF:${day}`;
    const existing = this.r.intelReport.db.get(
      'SELECT * FROM intelligence_report WHERE company_id = ? AND dedup_key = ?',
      companyId, dedup);
    if (existing && !force) return { report: existing, deduplicated: true };

    const signals = this.r.radarSignal.db.all(
      `SELECT * FROM radar_signal WHERE company_id = ? AND level IN ('ALERT','DIALOGUE','PLAN')
       AND status = 'OPEN' ORDER BY score DESC LIMIT 6`, companyId);
    const dialogs = this.dialogues.pending(companyId);
    const plans = this.r.actionPlan.db.all(
      `SELECT * FROM intelligence_action_plan WHERE company_id = ?
       AND status IN ('RECOMMENDED','AWAITING_APPROVAL','IN_EXECUTION','MONITORING')`, companyId);
    const interventions = this.r.intervention.db.all(
      `SELECT * FROM operational_intervention WHERE company_id = ?
       AND result IN ('NOT_ENOUGH_DATA','IMPROVING')`, companyId);
    const results = this.growth.results.consolidated({ companyId });
    const dataKinds = {
      vendas: results.salesByMarketplace.source,
      leads: results.leadsByOrigin.source,
      afiliados: results.affiliateRevenue.source,
      radar: dataset ? 'DEMONSTRATIVO' : 'REAL',
    };
    const body = {
      melhorou: dataset ? dataset.melhorou : [],
      piorou: signals.filter(s => /queda|devoluc|margem/.test(s.kind)).map(s => s.title),
      exigeDecisao: dialogs.map(d => d.subject),
      bloqueado: signals.filter(s => /travando|pendencia/.test(s.kind)).map(s => s.title),
      emRisco: signals.filter(s => s.level === 'ALERT').map(s => s.title),
      oportunidade: signals.filter(s => /oportunidade|sem anuncio|gap/.test(s.kind)).map(s => s.title),
      planoDoDia: plans.slice(0, 3).map(p => p.title),
      prioridades: signals.slice(0, 3).map((s, i) => `${i + 1}. ${s.title}`),
      perguntasPendentes: this.growth.dataCompletion.board(companyId, { status: 'ASKED' })
        .slice(0, 3).map(q => q.label),
      intervencoesMonitorando: interventions.map(i => i.description.slice(0, 60)),
    };
    const text = [
      'Resumo do dia:', '',
      ...(body.piorou.length ? [`Piorou: ${body.piorou.join('; ')}.`] : []),
      ...(body.emRisco.length ? [`Em risco: ${body.emRisco.join('; ')}.`] : []),
      ...(body.exigeDecisao.length ? [`Exige sua decisão: ${body.exigeDecisao.join('; ')}.`] : []),
      ...(body.bloqueado.length ? [`Bloqueado: ${body.bloqueado.join('; ')}.`] : []),
      '', 'Prioridades recomendadas:', ...body.prioridades,
      '', `Fontes: vendas ${dataKinds.vendas} · leads ${dataKinds.leads} · afiliados ${dataKinds.afiliados}` +
        ` · período ${day} · nenhum dado demo é apresentado como real`,
    ].join('\n');
    const report = this.r.intelReport.insert({ company_id: companyId,
      kind: 'DAILY_BRIEF', period: day, dedup_key: dedup, body_json: body, text,
      data_kinds_json: dataKinds, coverage: 'radar + planos + diálogos + crescimento',
      confidence: signals.length ? 'MEDIUM' : 'LOW', created_at: this.clock.nowIso() });
    this.r.audit.record('rid-report', 'generated', { companyId,
      entity: 'intelligence_report', entityId: report.id, detail: { kind: 'DAILY_BRIEF' } });
    return { report, deduplicated: false };
  }

  /* WEEKLY INTELLIGENCE REVIEW — cruza TODAS as áreas */
  weeklyReview(companyId) {
    const week = this.clock.nowIso().slice(0, 10);
    const dedup = `WEEKLY_REVIEW:${week}`;
    const existing = this.r.intelReport.db.get(
      'SELECT * FROM intelligence_report WHERE company_id = ? AND dedup_key = ?', companyId, dedup);
    if (existing) return { report: existing, deduplicated: true };
    const results = this.growth.results.consolidated({ companyId });
    const learnings = this.memory.recall({ companyId, category: 'LEARNING' });
    const dialogs = this.r.dialogue.db.all(
      'SELECT * FROM strategic_dialogue WHERE company_id = ?', companyId);
    const interventions = this.r.intervention.db.all(
      'SELECT * FROM operational_intervention WHERE company_id = ?', companyId);
    const body = {
      comercial: { vendas: results.salesByMarketplace, afiliados: results.affiliateRevenue,
        leads: results.leadsByOrigin, promocoes: results.promotionCost },
      intervencoes: interventions.map(i => ({ desc: i.description.slice(0, 60), result: i.result })),
      aprendizados: learnings.map(l => l.discovery.slice(0, 80)),
      conflitosEstrategicos: dialogs.map(d => ({ subject: d.subject, status: d.status })),
      decisoesPendentes: dialogs.filter(d => d.status === 'AWAITING_OWNER_DIRECTION').length,
      planoProximaSemana: this.r.actionPlan.db.all(
        `SELECT title FROM intelligence_action_plan WHERE company_id = ?
         AND status IN ('RECOMMENDED','IN_EXECUTION','MONITORING')`, companyId).map(p => p.title),
    };
    const text = `Revisão semanal (${week}):\n` +
      `• Vendas: ${body.comercial.vendas.source} · Leads: ${body.comercial.leads.source}` +
      ` · Afiliados: ${body.comercial.afiliados.source}\n` +
      `• Intervenções: ${body.intervencoes.length} · Aprendizados: ${body.aprendizados.length}\n` +
      `• Conflitos estratégicos: ${body.conflitosEstrategicos.length} (${body.decisoesPendentes} aguardando você)\n` +
      `• Próxima semana: ${body.planoProximaSemana.join('; ') || 'sem planos abertos'}\n` +
      `Período, fonte e cobertura declarados por bloco; comparação disponível quando houver histórico.`;
    const report = this.r.intelReport.insert({ company_id: companyId,
      kind: 'WEEKLY_REVIEW', period: week, dedup_key: dedup, body_json: body, text,
      data_kinds_json: { vendas: body.comercial.vendas.source,
        leads: body.comercial.leads.source, afiliados: body.comercial.afiliados.source },
      coverage: 'todas as áreas com dado disponível', confidence: 'MEDIUM',
      created_at: this.clock.nowIso() });
    return { report, deduplicated: false };
  }

  /* entrega via WhatsApp oficial: resumo curto + deep link — nunca escrita externa */
  async deliverWhatsApp(reportId, { to }) {
    const report = this.r.intelReport.byId(reportId);
    const short = report.text.split('\n').slice(0, 6).join('\n') +
      `\n\nDetalhes: painel://relatorios/${report.id}`;
    if (this.whatsappSend) await this.whatsappSend(to, short);
    this.r.intelReport.update(reportId, {
      delivered_json: { whatsapp: to, at: this.clock.nowIso() } });
    return { delivered: true, short, externalWrite: false };
  }
}

module.exports = { ReportEngine, LeadershipProfile };

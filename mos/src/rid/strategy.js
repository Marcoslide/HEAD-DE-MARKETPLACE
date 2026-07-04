/* RADAR + DIAGNÓSTICO + DIÁLOGO + PLANO + INTERVENÇÃO (Sprint 10.C).

   Evolução do RID: observa os dados JÁ existentes (Central, Catálogo,
   Crescimento, Data Completion), pontua sinais sem barulho, investiga
   antes de concluir (fato ≠ hipótese), NUNCA ignora decisão anterior do
   dono — conflito abre StrategicDialogue — e transforma análise em
   IntelligenceActionPlan com microtarefas, missão (repos.mission do S02)
   e intervenções monitoradas que viram aprendizado reutilizável. */
'use strict';

const CONFIDENCE = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const r1 = v => Math.round(v * 10) / 10;

/* ---------------- RADAR: sinais pontuados, sem barulho ---------------- */
class RadarEngine {
  constructor({ repos, growth, memory, clock, mie = null }) {
    this.r = repos; this.growth = growth; this.memory = memory;
    this.clock = clock; this.mie = mie;
  }

  _score(s) {
    const w = { financialImpact: 3, urgency: 2, operationalRisk: 2, trend: 1,
                confidence: 1, strategicImportance: 1, learningPotential: 0.5 };
    let total = 0, max = 0;
    for (const [k, weight] of Object.entries(w)) {
      total += (s[k] ?? 0) * weight; max += 3 * weight;
    }
    return r1(total / max * 10);
  }

  _level(score) {
    return score >= 7 ? 'DIALOGUE' : score >= 5.5 ? 'PLAN'
      : score >= 4 ? 'ALERT' : score >= 2.5 ? 'MONITOR' : 'SILENCE';
  }

  /* varre dados disponíveis + observações injetadas (ex.: devoluções) */
  scan({ companyId, observations = [] }) {
    const signals = [];
    /* observações externas (métricas que a Central/Crescimento produzem) */
    for (const o of observations) signals.push({ ...o, source: o.source || 'observation' });
    /* promoções derrubando margem (Crescimento — reuso direto) */
    for (const p of this.growth.promotions.marginRiskList(companyId))
      signals.push({ kind: 'promocao-margem-ruim', title: `Promoção "${p.name}" com margem ruim em ${p.marketplace}`,
        financialImpact: 2, urgency: 2, operationalRisk: 1, trend: 1, confidence: 3,
        entity: 'promotion', entityId: p.id, marketplace: p.marketplace });
    /* pendências de dado travando drafts (Data Completion) */
    const blockers = this.growth.dataCompletion.board(companyId, { status: 'OPEN' })
      .concat(this.growth.dataCompletion.board(companyId, { status: 'ASKED' }));
    if (blockers.length)
      signals.push({ kind: 'dados-travando-expansao', title: `${blockers.length} pendência(s) de dado travando drafts`,
        financialImpact: 2, urgency: 1, operationalRisk: 1, trend: 1, confidence: 3 });

    const saved = signals.map(s => {
      const score = this._score(s);
      const level = this._level(score);
      const row = this.r.radarSignal.insert({ company_id: companyId, kind: s.kind,
        title: s.title, detail_json: s.detail || {},
        score_json: { financialImpact: s.financialImpact, urgency: s.urgency,
          operationalRisk: s.operationalRisk, trend: s.trend, confidence: s.confidence },
        score, level, entity: s.entity || null, entity_id: s.entityId || null,
        marketplace: s.marketplace || null, created_at: this.clock.nowIso() });
      /* sinal relevante alimenta o EPE existente — execução INTERNA apenas */
      if (this.mie && level !== 'SILENCE' && this.mie.epe && this.mie.epe.addExternalSignal)
        try { this.mie.epe.addExternalSignal({ id: row.id, source: 'rid-radar',
          type: s.kind, severity: level === 'DIALOGUE' || level === 'PLAN' ? 'high' : 'medium',
          summary: s.title, provenance: { source: 'rid-radar', observedAt: this.clock.nowIso() },
          executionScope: 'INTERNAL_ONLY' }); } catch { /* plano do dia pode não estar aberto */ }
      return row;
    });
    return { signals: saved,
      loud: saved.filter(x => ['ALERT', 'DIALOGUE', 'PLAN'].includes(x.level)),
      silent: saved.filter(x => ['SILENCE', 'MONITOR'].includes(x.level)) };
  }
}

/* ---------------- DIAGNÓSTICO: investigar antes de concluir ---------------- */
class DiagnosisEngine {
  constructor({ clock }) { this.clock = clock; }

  /* evidence: [{dimension, finding, share?}] — causalidade só com evidência */
  investigate({ fact, changedAt = null, where = null, impact = null, evidence = [],
                hypotheses = [] }) {
    const scored = hypotheses.map(h => {
      const support = evidence.filter(e => (h.evidenceDimensions || []).includes(e.dimension));
      const strong = support.some(e => (e.share ?? 0) >= 0.5);
      const confidence = !support.length ? 'VERY_LOW'
        : strong && support.length > 1 ? 'HIGH'
        : strong ? 'MEDIUM' : 'LOW';
      return { ...h, supportingEvidence: support, confidence,
        isFact: false,                     // hipótese NUNCA vira fato aqui
        causalityConfirmed: false };       // nunca afirmar causalidade sem prova
    });
    const best = scored.slice().sort((a, b) =>
      CONFIDENCE.indexOf(b.confidence) - CONFIDENCE.indexOf(a.confidence))[0] || null;
    return {
      fact, changedAt, where, impact,
      evidence, hypotheses: scored,
      confidence: best ? best.confidence : 'VERY_LOW',
      cannotAffirm: 'causalidade definitiva — a hipótese líder precisa de teste controlado',
      recommendedAction: best && ['MEDIUM', 'HIGH', 'VERY_HIGH'].includes(best.confidence)
        ? (best.testAction || 'testar em lote controlado antes de mudar a operação inteira')
        : 'coletar mais evidência antes de agir',
      monitor: ['métrica afetada', 'custo da mudança', 'efeito colateral em outras praças'],
      separation: { FATO: fact, EVIDENCIA: evidence.map(e => e.finding),
        HIPOTESE: scored.map(h => h.text), CONFIANCA: best ? best.confidence : 'VERY_LOW' },
      asOf: this.clock.nowIso(),
    };
  }
}

/* ---------------- DIÁLOGO ESTRATÉGICO: conflito nunca é engolido ---------------- */
class StrategicDialogueService {
  constructor({ repos, memory, plans, clock }) {
    this.r = repos; this.memory = memory; this.plans = plans; this.clock = clock;
  }

  /* recomendação × decisões do dono → conflito? */
  detectConflict({ companyId, recommendation, topic = null }) {
    const decisions = this.memory.recall({ companyId, category: 'STRATEGIC_DIRECTION', topic })
      .concat(this.memory.recall({ companyId, category: 'DECISION', topic }));
    const conflicting = decisions.find(d =>
      recommendation.conflictsWith ? recommendation.conflictsWith(d) : false);
    return conflicting || null;
  }

  open({ companyId, subject, context = null, previousDecision, previousSource = null,
         sourceDecisionId = null, newEvidence = [], conflict, alternatives = [],
         recommendation, impact = null, risks = [], cost = null, confidence = 'MEDIUM' }) {
    if (!previousDecision) throw new Error('diálogo estratégico exige a decisão anterior explícita — ela nunca é ignorada');
    if (!alternatives.length || alternatives.length < 2)
      throw new Error('diálogo estratégico exige alternativas concretas (mínimo 2)');
    const question = this._compose({ subject, previousDecision, newEvidence,
      conflict, alternatives, recommendation });
    const d = this.r.dialogue.insert({ company_id: companyId,
      status: 'AWAITING_OWNER_DIRECTION', subject, context,
      previous_decision: previousDecision, previous_source: previousSource,
      source_decision_id: sourceDecisionId, new_evidence_json: newEvidence,
      conflict, alternatives_json: alternatives, rid_recommendation: recommendation,
      impact_json: impact, risks_json: risks, cost_estimate: cost, confidence,
      owner_question: question, audit_json: [{ event: 'opened', at: this.clock.nowIso() }],
      created_at: this.clock.nowIso() });
    this.r.audit.record('rid-dialogue', 'opened', { companyId,
      entity: 'strategic_dialogue', entityId: d.id, detail: { subject, confidence } });
    return d;
  }

  _compose({ subject, previousDecision, newEvidence, conflict, alternatives, recommendation }) {
    return [
      `Preciso alinhar uma mudança de rota com você — ${subject}.`,
      ``, `Sua direção anterior: ${previousDecision}.`,
      `O que mudou: ${newEvidence.map(e => e.finding || e).join('; ')}.`,
      `O risco de seguir igual: ${conflict}.`,
      ``, `Vejo ${alternatives.length} opções:`,
      ...alternatives.map((a, i) => `${i + 1}. ${a.label}${a.detail ? ` — ${a.detail}` : ''}`),
      ``, `Minha recomendação técnica: ${recommendation}`,
      ``, `Como você quer seguir?`,
    ].join('\n');
  }

  /* interpreta a resposta do dono — e executa SÓ o autorizado */
  ownerRespond(dialogueId, { text, userId = null }) {
    const d = this.r.dialogue.byId(dialogueId);
    if (d.status !== 'AWAITING_OWNER_DIRECTION')
      throw new Error(`diálogo em ${d.status} — não aguarda direção`);
    const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const status =
      /segue (sua|a sua) (ideia|recomendacao)|aprovo sua/.test(t) ? 'OWNER_APPROVED_RID_DIRECTION'
      : /mant(em|enha|er) (minha|a) (estrategia|direcao)|nao mexe/.test(t) ? 'OWNER_KEPT_PREVIOUS_DIRECTION'
      : /teste? (pequeno|controlado|piloto)|faz um teste/.test(t) ? 'OWNER_REQUESTED_TEST'
      : /mais analise|me mostra .*antes|quero mais/.test(t) ? 'OWNER_REQUESTED_MORE_ANALYSIS'
      : /depois|semana que vem|agora nao/.test(t) ? 'OWNER_POSTPONED_DECISION'
      : null;
    if (!status) return { understood: false,
      reply: 'Não tenho certeza da direção. Você quer: seguir minha recomendação, manter sua estratégia, fazer um teste pequeno, mais análise, ou decidir depois?' };

    const alternatives = JSON.parse(d.alternatives_json || '[]');
    let plan = null, finalDecision = null;
    if (status === 'OWNER_APPROVED_RID_DIRECTION') {
      finalDecision = d.rid_recommendation;
      plan = this.plans.create({ companyId: d.company_id, origin: 'STRATEGIC_DIALOGUE',
        title: `Executar: ${d.subject}`, objective: d.rid_recommendation,
        problem: d.conflict, confidence: d.confidence, dialogueId,
        actions: alternatives.map(a => a.label) });
    } else if (status === 'OWNER_REQUESTED_TEST') {
      finalDecision = 'teste pequeno e controlado antes de mudar a linha inteira';
      plan = this.plans.create({ companyId: d.company_id, origin: 'STRATEGIC_DIALOGUE',
        title: `Teste controlado: ${d.subject}`, objective: finalDecision,
        problem: d.conflict, confidence: d.confidence, dialogueId,
        experimental: true,
        actions: ['definir escopo do teste (SKUs/lote)', 'medir linha de base',
                  'executar por período definido', 'comparar e decidir expansão'] });
    } else if (status === 'OWNER_KEPT_PREVIOUS_DIRECTION') {
      finalDecision = d.previous_decision;   // a direção do dono PREVALECE
    }
    /* a decisão vira MEMÓRIA estratégica — influencia recomendações futuras */
    this.memory.absorb({ companyId: d.company_id, category: 'DECISION',
      key: `dialogue.${dialogueId}`, source: `strategic_dialogue:${dialogueId}`,
      discovery: `Sobre "${d.subject}": dono decidiu ${status} — ${finalDecision || text}`,
      confidence: 'HIGH', author: userId || 'dono',
      related: { dialogueId, planId: plan ? plan.id : null } });
    const updated = this.r.dialogue.update(dialogueId, { status,
      owner_response: text, final_decision: finalDecision,
      approved_direction: finalDecision,
      action_plan_id: plan ? plan.id : null,
      answered_at: this.clock.nowIso(),
      closed_at: ['OWNER_REQUESTED_MORE_ANALYSIS'].includes(status) ? null : this.clock.nowIso() });
    this.r.audit.record('rid-dialogue', 'owner_responded', { companyId: d.company_id,
      entity: 'strategic_dialogue', entityId: dialogueId, detail: { status, by: userId } });
    return { understood: true, status, dialogue: updated, plan,
      executesOnly: finalDecision || 'nada — aguardando análise/decisão' };
  }

  pending(companyId) {
    return this.r.dialogue.db.all(
      `SELECT * FROM strategic_dialogue WHERE company_id = ? AND status IN
       ('DETECTED','AWAITING_OWNER_DIRECTION','OWNER_REQUESTED_MORE_ANALYSIS')`, companyId);
  }
}

/* ---------------- PLANO + MICROTAREFAS + MISSÃO (reuso do S02) ---------------- */
class ActionPlanService {
  constructor({ repos, memory, clock }) { this.r = repos; this.memory = memory; this.clock = clock; }

  create({ companyId, title, origin, problem = null, opportunity = null, objective,
           facts = [], hypotheses = [], evidence = [], confidence = 'MEDIUM',
           impact = null, risk = null, priority = 'alta', productIds = [],
           marketplaces = [], responsible = [], actions = [], deadline = null,
           cost = null, successMetric = null, baseline = null,
           observationDays = 14, dialogueId = null, experimental = false }) {
    if (!origin) throw new Error('plano exige origem rastreável');
    /* memória cruzada ANTES de planejar: aprendizados semelhantes entram */
    const prior = this.memory.recall({ companyId, category: 'LEARNING' })
      .filter(m => title.toLowerCase().split(' ').some(w => w.length > 4 && m.discovery.toLowerCase().includes(w)));
    const plan = this.r.actionPlan.insert({ company_id: companyId, title,
      problem, opportunity, objective, facts_json: facts, hypotheses_json: hypotheses,
      evidence_json: evidence, confidence, impact_json: impact, risk, priority,
      product_ids_json: productIds, marketplace_ids_json: marketplaces,
      responsible_json: responsible, actions_json: actions, deadline,
      cost_estimate: cost, success_metric: successMetric, baseline_json: baseline,
      observation_period_days: observationDays,
      status: experimental ? 'RECOMMENDED' : 'DRAFT', origin, dialogue_id: dialogueId,
      audit_json: [{ event: 'created', at: this.clock.nowIso(),
                     priorLearnings: prior.map(p => p.key) }],
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('rid-plan', 'created', { companyId,
      entity: 'intelligence_action_plan', entityId: plan.id,
      detail: { origin, priorLearnings: prior.length } });
    return { ...plan, priorLearnings: prior };
  }

  /* tarefa grande → microtarefas executáveis (apoio de foco) */
  breakdown(planId, tasks) {
    const plan = this.r.actionPlan.byId(planId);
    return tasks.map((t, i) => this.r.microtask.insert({
      plan_id: planId, company_id: plan.company_id, position: i + 1,
      title: typeof t === 'string' ? t : t.title,
      responsible: t.responsible || null, due_at: t.dueAt || null,
      created_at: this.clock.nowIso() }));
  }

  /* aprovar → vira MISSÃO no motor existente (S02) — nada paralelo */
  approve(planId, { userId = null } = {}) {
    const plan = this.r.actionPlan.byId(planId);
    const mission = this.r.mission.insert({ company_id: plan.company_id,
      kind: 'intelligence-plan', title: plan.title, status: 'active',
      origin: `rid:${plan.origin}`, log_json: [{ at: this.clock.nowIso(),
        event: 'criada a partir do IntelligenceActionPlan', planId }] });
    const updated = this.r.actionPlan.update(planId, { status: 'IN_EXECUTION',
      mission_id: mission.id, updated_at: this.clock.nowIso() });
    this.r.audit.record('rid-plan', 'approved', { companyId: plan.company_id,
      entity: 'intelligence_action_plan', entityId: planId,
      detail: { missionId: mission.id, by: userId } });
    return { plan: updated, mission };
  }
}

/* ---------------- INTERVENÇÃO → MONITORAMENTO → APRENDIZADO ---------------- */
class InterventionService {
  constructor({ repos, memory, clock }) { this.r = repos; this.memory = memory; this.clock = clock; }

  register({ companyId, description, kind = 'operacional', planId = null,
             productIds = [], marketplaces = [], responsible = null,
             baseline = {}, metrics = [], monitoringDays = 14, cost = null }) {
    const it = this.r.intervention.insert({ company_id: companyId,
      action_plan_id: planId, product_ids_json: productIds,
      marketplace_ids_json: marketplaces, description, kind,
      before_json: baseline, change_applied: description, responsible,
      started_at: this.clock.nowIso(), monitoring_days: monitoringDays,
      metrics_json: metrics, baseline_json: baseline, cost,
      result: 'NOT_ENOUGH_DATA',
      audit_json: [{ event: 'registered', at: this.clock.nowIso() }],
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    if (planId) this.r.actionPlan.update(planId, { status: 'MONITORING',
      updated_at: this.clock.nowIso() });
    this.r.audit.record('rid-intervention', 'registered', { companyId,
      entity: 'operational_intervention', entityId: it.id,
      detail: { responsible, monitoringDays } });
    return { intervention: it,
      ack: `Registrado como intervenção (${description.slice(0, 80)}…), iniciada às ` +
        `${this.clock.nowIso().slice(11, 16)}. Vou comparar com a linha de base e acompanhar: ` +
        `${metrics.join('; ') || 'as métricas do plano'}. ` +
        `Ainda não vou concluir se funcionou até existir volume suficiente.` };
  }

  /* avalia com dados novos; volume insuficiente → NOT_ENOUGH_DATA sempre */
  evaluate(interventionId, { samples, metric, baselineValue, currentValue,
                             minSamples = 20 }) {
    const it = this.r.intervention.byId(interventionId);
    let result;
    if (samples < minSamples) result = 'NOT_ENOUGH_DATA';
    else {
      const delta = currentValue - baselineValue;
      result = Math.abs(delta) < baselineValue * 0.05 ? 'NO_EFFECT'
        : delta < 0 ? (samples >= minSamples * 2 ? 'SUCCESSFUL' : 'IMPROVING')
        : 'WORSENING';
    }
    const updated = this.r.intervention.update(interventionId, { result,
      evidence_json: { samples, metric, baselineValue, currentValue },
      updated_at: this.clock.nowIso() });
    return { intervention: updated, result,
      honest: result === 'NOT_ENOUGH_DATA'
        ? 'amostra insuficiente — não concluo ainda'
        : result === 'IMPROVING'
          ? `tendência positiva (${metric}: ${baselineValue} → ${currentValue}), amostra ainda limitada`
          : null };
  }

  /* conclusão → APRENDIZADO reutilizável na memória ÚNICA */
  conclude(interventionId, { conclusion, learning, reusable = true, confidence = 'MEDIUM' }) {
    const it = this.r.intervention.update(interventionId, { conclusion, learning,
      reusable: reusable ? 1 : 0, confidence, updated_at: this.clock.nowIso() });
    const mem = this.memory.absorb({ companyId: it.company_id, category: 'LEARNING',
      key: `intervention.${interventionId}`,
      source: `operational_intervention:${interventionId}`,
      discovery: learning, confidence,
      related: { interventionId, planId: it.action_plan_id,
                 productIds: JSON.parse(it.product_ids_json || '[]') } });
    if (it.action_plan_id) this.r.actionPlan.update(it.action_plan_id, {
      status: it.result === 'SUCCESSFUL' || it.result === 'IMPROVING' ? 'SUCCESSFUL'
        : it.result === 'WORSENING' ? 'UNSUCCESSFUL' : 'INCONCLUSIVE',
      final_learning: learning, updated_at: this.clock.nowIso() });
    return { intervention: it, memory: mem };
  }
}

module.exports = { RadarEngine, DiagnosisEngine, StrategicDialogueService,
                   ActionPlanService, InterventionService, CONFIDENCE };

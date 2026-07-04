/* HEAD INTELLIGENCE OS (Sprint 10.C) — composição da EVOLUÇÃO do RID.

   createRID({ mos, clock, growth, mie }) NÃO cria outro cérebro: liga
   radar → diagnóstico → diálogo → plano → intervenção → aprendizado →
   relatório SOBRE a cadeia existente (Intent Router → Context Resolver
   → Query Layer → Composer) e sobre Growth/Catálogo/Jobs/Missões/
   Auditoria do 10.B. O adapter `rid` entra no MESMO HeadChat; o gateway
   de WhatsApp ganha intervenção e resposta de diálogo — nada paralelo. */
'use strict';
const { MemoryPolicy, CATEGORIES, CONTEXT_HIERARCHY } = require('./memory-policy.js');
const { RadarEngine, DiagnosisEngine, StrategicDialogueService,
        ActionPlanService, InterventionService, CONFIDENCE } = require('./strategy.js');
const { ReportEngine, LeadershipProfile } = require('./reports.js');

function createRID({ mos, clock, growth, mie = null, whatsappSend = null }) {
  if (!clock) throw new Error('createRID exige o Clock injetado');
  if (!growth) throw new Error('createRID exige o Growth (10.B) — o RID orquestra, não duplica');
  const { repos } = mos;

  const memory = new MemoryPolicy({ repos, clock });
  const plans = new ActionPlanService({ repos, memory, clock });
  const dialogues = new StrategicDialogueService({ repos, memory, plans, clock });
  const radar = new RadarEngine({ repos, growth, memory, clock, mie });
  const diagnosis = new DiagnosisEngine({ clock });
  const interventions = new InterventionService({ repos, memory, clock });
  const profile = new LeadershipProfile({ repos, clock });
  const reports = new ReportEngine({ repos, growth, memory, dialogues, clock, whatsappSend });

  /* ---------- recomendação com MEMÓRIA CRUZADA (nunca só o dado novo) ---------- */
  function recommend({ companyId, topic, proposal, evidence = [], confidence = 'MEDIUM' }) {
    const ctx = memory.contextFor({ companyId, topic });
    /* decisão válida do dono conflita? → diálogo, nunca atropelo */
    const conflictingDecision = ctx.ownerDecisions.find(d =>
      proposal.conflictTerms && proposal.conflictTerms.some(t =>
        d.discovery.toLowerCase().includes(t.toLowerCase())));
    /* aprendizado anterior semelhante entra na recomendação */
    const priorLearning = ctx.learnings.filter(l =>
      (topic || '').toLowerCase().split(' ').some(w => w.length > 4
        && l.discovery.toLowerCase().includes(w)));
    if (conflictingDecision) {
      const dialogue = dialogues.open({ companyId,
        subject: topic, previousDecision: conflictingDecision.discovery,
        sourceDecisionId: conflictingDecision.id,
        previousSource: conflictingDecision.source,
        newEvidence: evidence, conflict: proposal.riskOfKeepingCourse
          || 'seguir o caminho anterior ignora a evidência nova',
        alternatives: proposal.alternatives
          || [{ label: 'manter a estratégia atual' },
              { label: proposal.text },
              { label: 'teste controlado antes de mudar a linha' }],
        recommendation: proposal.text, confidence });
      return { kind: 'STRATEGIC_DIALOGUE', dialogue,
        blockedByOwnerDecision: true, priorLearning };
    }
    return { kind: 'RECOMMENDATION', text: proposal.text, confidence,
      contextUsed: { ownerDecisions: ctx.ownerDecisions.length,
        learnings: priorLearning.length, hierarchy: CONTEXT_HIERARCHY[0] },
      priorLearning, checkQuestion: ctx.checkQuestion };
  }

  /* ---------- adapter para o HeadChat EXISTENTE (mesma cadeia) ---------- */
  const chatAdapter = {
    registerIntervention(text, { companyId, responsible = null }) {
      const r = interventions.register({ companyId, description: text,
        responsible, metrics: ['devolução por avaria', 'reclamações',
          'custo', 'tempo de expedição', 'margem'] });
      return { kind: 'INTERVENTION_ACK', ack: r.ack,
        interventionId: r.intervention.id,
        dataSource: 'INTERNAL_RECORDS', coverage: ['intervenções'],
        missingPlatforms: [], confidence: 0.9, asOf: clock.nowIso() };
    },
    report(kindWord, { companyId, dataset = null }) {
      const r = /semana/.test(kindWord || '') ? reports.weeklyReview(companyId)
        : reports.dailyBrief(companyId, { dataset });
      return { kind: 'RID_REPORT', text: r.report.text,
        reportId: r.report.id, deduplicated: r.deduplicated,
        dataSource: 'INTERNAL_RECORDS', coverage: [r.report.coverage],
        missingPlatforms: [], confidence: 0.8, asOf: clock.nowIso() };
    },
  };

  /* ---------- WhatsApp (gateway do 10.B ganha 2 capacidades) ---------- */
  const INTERVENTION_RX = /^(fiz|coloquei|apliquei|troquei|mudei|reforcei|ajustei|instalei)\b/;
  async function whatsappHook({ companyId, from, text }) {
    const t = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    /* resposta a diálogo estratégico aguardando o dono */
    const waiting = dialogues.pending(companyId)
      .find(d => d.status === 'AWAITING_OWNER_DIRECTION');
    if (waiting && /segue (sua|a sua)|mantem minha|manter minha|faz um teste|teste pequeno|mais analise|agora nao|depois/.test(t)) {
      const r = dialogues.ownerRespond(waiting.id, { text });
      return { reply: r.understood
        ? `Registrado: ${r.status}. ${r.plan ? `Plano criado (${r.plan.title}) — vou executar SÓ o aprovado.` : `Sigo a direção registrada.`} Nada externo foi executado.`
        : r.reply, dialogueId: waiting.id };
    }
    /* "fiz isso hoje" → intervenção operacional */
    if (INTERVENTION_RX.test(t)) {
      const r = chatAdapter.registerIntervention(text, { companyId, responsible: from });
      return { reply: r.ack, interventionId: r.interventionId };
    }
    if (/relatorio|resumo (do dia|da semana|executivo)/.test(t)) {
      const r = chatAdapter.report(t, { companyId });
      const short = r.text.split('\n').slice(0, 6).join('\n');
      return { reply: `${short}\n\nDetalhes: painel://relatorios/${r.reportId}` };
    }
    return null;
  }

  return { memory, radar, diagnosis, dialogues, plans, interventions,
           profile, reports, recommend, chatAdapter, whatsappHook,
           CATEGORIES, CONFIDENCE, CONTEXT_HIERARCHY };
}

module.exports = { createRID };

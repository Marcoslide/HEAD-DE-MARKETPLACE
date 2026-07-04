/* EXECUTIVE PLANNING ENGINE (Sprint 08) — a camada que transforma
   inteligência em PRIORIDADE EXECUTIVA. É o que faz o Head parecer um
   diretor, não um analista: ele não entrega tudo que encontra — ele filtra.

   Constituição: Art. 13 (prioriza), Art. 19 (só decisões chegam ao dono;
   silêncio inteligente), Art. 3 (vende tranquilidade, não ansiedade),
   Art. 4 (alinhamento com objetivos). O EPE NÃO decide sozinho o destino
   final de execução — ele orquestra e prioriza; a execução continua nos
   motores sob a Constituição.

   Sete níveis de prioridade executiva (do menor ao maior comprometimento):
     IGNORAR · OBSERVAR · INVESTIGAR · CRIAR MISSÃO ·
     PEDIR APROVAÇÃO · EXECUTAR AUTOMATICAMENTE · INTERROMPER IMEDIATAMENTE

   O algoritmo é AUDITÁVEL: classify() devolve a decomposição dos fatores. */
(function (NS) {
'use strict';

const LEVEL = {
  IGNORE: 'IGNORAR', OBSERVE: 'OBSERVAR', INVESTIGATE: 'INVESTIGAR',
  MISSION: 'CRIAR MISSÃO', APPROVE: 'PEDIR APROVAÇÃO',
  AUTO: 'EXECUTAR AUTOMATICAMENTE', INTERRUPT: 'INTERROMPER IMEDIATAMENTE',
};

class ExecutivePlanningEngine {
  constructor(bus, { world, memory, prioritization, investigation, graph, learning } = {}) {
    this.bus = bus; this.world = world; this.memory = memory;
    this.prioritization = prioritization; this.investigation = investigation;
    this.graph = graph; this.learning = learning;

    /* diário do dia: o funil de atenção do Head (Art. 3 — mostrar o trabalho) */
    this.ledger = this._emptyLedger();
    if (bus) {
      bus.on('signal.observed', p => {
        this.ledger.signalsFound++;
        if (Math.abs(p.z || 0) < NS.CONFIG.SOFT_Z) this.ledger.signalsIgnored++;
      });
      bus.on('investigation.opened', () => this.ledger.investigated++);
      bus.on('result.measured', () => this.ledger.resolved++);
      bus.on('execute.authorized', () => this.ledger.resolved++);
    }
  }
  get cfg() { return NS.CONFIG.EPE; }
  _emptyLedger() { return { signalsFound: 0, signalsIgnored: 0, investigated: 0, resolved: 0 }; }

  /* ---------- o coração: classificador executivo AUDITÁVEL ---------- */
  classify(candidate) {
    const f = this._normalize(candidate);
    const s = this._score(f);
    const level = this._level(f, s.score);
    return { level, score: s.score, factors: f, breakdown: s, reason: this._reason(level, f, s) };
  }

  _normalize(c) {
    const C = this.cfg;
    const confidence = c.confidence != null ? c.confidence
      : (C.CONF_BY_LABEL[c.confidenceLabel] ?? 0.5);
    const confidenceLabel = c.confidenceLabel
      || (confidence >= 0.75 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa');
    const urgency = c.urgency
      || (c.severity === 'critical' ? 'alta' : c.severity === 'attention' ? 'média' : 'baixa');
    return {
      id: c.id ?? null, productId: c.productId ?? null, title: c.title ?? '(sem título)',
      impactMonthly: Math.round(c.impactMonthly ?? 0),
      confidence, confidenceLabel,
      urgency, severity: c.severity ?? 'info',
      effort: Math.max(1, c.effort ?? 1),
      reversible: c.reversible !== false,
      class: c.class ?? (c.hasProposal ? 'C' : null),
      proposalType: c.proposalType ?? null,
      hasProposal: !!c.hasProposal,
      window: !!c.window,
      recurrence: c.recurrence ?? 0,
      graphReuse: !!c.graphReuse,
      consensusStrength: c.consensusStrength ?? 0,
      reluctance: c.reluctance ?? 0,
      autoAuthorized: !!c.autoAuthorized,
    };
  }

  /* score executivo — cada fator é rastreável (auditoria) */
  _score(f) {
    const urgencyWeight = { alta: 3, 'média': 2, baixa: 1 }[f.urgency] || 1;
    const base = (f.impactMonthly * f.confidence * urgencyWeight) / f.effort;
    const factors = [];
    let mult = 1;
    if (f.window) { mult *= 1.5; factors.push(['janela expira', 1.5]); }
    if (f.recurrence > 0) { mult *= 1.2; factors.push(['padrão recorrente', 1.2]); }
    if (f.graphReuse) { mult *= 1.15; factors.push(['aprendizado anterior aplicável', 1.15]); }
    const consensus = 0.9 + 0.3 * (f.consensusStrength || 0);
    mult *= consensus; factors.push(['consenso do conselho', Math.round(consensus * 100) / 100]);
    if (!f.reversible) { mult /= 2; factors.push(['irreversível (risco de agir cedo)', 0.5]); }
    if (f.reluctance > 0) { const r = 1 - 0.5 * f.reluctance; mult *= r; factors.push(['recusa anterior do dono', Math.round(r * 100) / 100]); }
    let score = base * mult;
    let capped = false;
    if (f.confidenceLabel === 'baixa' && score > this.cfg.LOW_CONF_CAP) { score = this.cfg.LOW_CONF_CAP; capped = true; }
    return {
      urgencyWeight, base: Math.round(base), mult: Math.round(mult * 100) / 100,
      factors, capped, riskOfWaiting: urgencyWeight * (f.window ? 1.5 : 1),
      riskOfActingEarly: f.reversible ? 'baixo (reversível)' : 'alto (irreversível)',
      score: Math.round(score),
    };
  }

  /* mapeia score + contexto → um dos 7 níveis executivos */
  _level(f, score) {
    const C = this.cfg;
    // incidente: risco imediato — interrompe (Art. 19; Fluxo 008)
    if (f.severity === 'critical') return LEVEL.INTERRUPT;

    if (!f.hasProposal) {
      // sinal cru: vale investigar? observar? ignorar?
      if (score >= C.APPROVE_SCORE) return LEVEL.INVESTIGATE;
      if (score >= C.OBSERVE_SCORE) return LEVEL.OBSERVE;
      return LEVEL.IGNORE;
    }

    // proposta na mão
    if (f.impactMonthly < C.MIN_IMPACT) return LEVEL.IGNORE;              // não incomoda (Art. 19)
    if (f.proposalType === 'watch' || f.proposalType === 'wait') return LEVEL.OBSERVE;

    // impacto alto + urgência alta + janela + score altíssimo → interromper
    if (f.urgency === 'alta' && f.impactMonthly >= C.HIGH_IMPACT
        && score >= C.INTERRUPT_SCORE && f.confidenceLabel !== 'baixa') return LEVEL.INTERRUPT;

    // confiança baixa nunca vira decisão/ação — observa mais uma rodada (Art. 8/9)
    if (f.confidenceLabel === 'baixa') return score >= C.OBSERVE_SCORE ? LEVEL.OBSERVE : LEVEL.IGNORE;

    // dentro de alçada (A, ou B pré-autorizada) e reversível → o Head age sozinho
    const klass = f.class || 'C';
    const authorized = klass === 'A' || (klass === 'B' && f.autoAuthorized);
    if (authorized && f.reversible)
      return f.effort >= 2 ? LEVEL.MISSION : LEVEL.AUTO;

    // Classe C: decisão do dono, se merecer a atenção dele
    if (score >= C.APPROVE_SCORE) return LEVEL.APPROVE;
    if (score >= C.MISSION_SCORE) return LEVEL.MISSION;
    if (score >= C.OBSERVE_SCORE) return LEVEL.OBSERVE;
    return LEVEL.IGNORE;
  }

  _reason(level, f, s) {
    switch (level) {
      case LEVEL.INTERRUPT: return f.severity === 'critical'
        ? 'incidente com risco imediato — agir já, avisando o dono'
        : `impacto alto (R$ ${f.impactMonthly}/mês) e urgência alta com janela curta`;
      case LEVEL.APPROVE: return `decisão importante (score ${s.score}), reversível, confiança ${f.confidenceLabel}`;
      case LEVEL.AUTO: return 'dentro da alçada, reversível e rápida — o Head executa e reporta';
      case LEVEL.MISSION: return 'trabalho autônomo do Head (não exige decisão do dono)';
      case LEVEL.INVESTIGATE: return 'sinal relevante ainda sem causa — investigar antes de concluir';
      case LEVEL.OBSERVE: return f.confidenceLabel === 'baixa'
        ? 'confiança insuficiente — monitorar mais uma rodada'
        : f.impactMonthly < this.cfg.HIGH_IMPACT ? 'impacto moderado — fica em observação' : 'fora da janela de decisão';
      default: return f.impactMonthly < this.cfg.MIN_IMPACT
        ? 'impacto baixo demais para incomodar o dono' : 'ruído dentro do normal';
    }
  }

  /* ---------- candidato a partir de um diagnóstico do MIE ---------- */
  factorsOf(d) {
    const pri = this.prioritization ? this.prioritization.scoreOf(d) : { impactMonthly: 0 };
    const consolidated = d.council && d.council.consolidated;
    return {
      id: d.caseId, productId: d.productId,
      title: (d.proposal && d.proposal.title) || d.causeLabel,
      impactMonthly: pri.impactMonthly,
      confidence: d.confidence, confidenceLabel: d.confidenceLabel,
      urgency: (consolidated && consolidated.urgencia)
        || (d.severity === 'critical' ? 'alta' : d.severity === 'attention' ? 'média' : 'baixa'),
      severity: d.severity,
      effort: (d.proposal && d.proposal.effort) || 1,
      reversible: !(d.proposal && d.proposal.reversible === false),
      class: (d.proposal && d.proposal.class) || (d.proposal ? 'C' : null),
      proposalType: d.proposal && d.proposal.type,
      hasProposal: !!d.proposal,
      window: !!(d.proposal && d.proposal.window),
      recurrence: d.recurrence || 0,
      graphReuse: !!(d.graph && d.graph.reused && d.graph.reused.length),
      consensusStrength: (consolidated && consolidated.consensusStrength) || 0,
      reluctance: this.memory ? this.memory.reluctance((d.proposal && d.proposal.type) || '') : 0,
      autoAuthorized: !!(this.memory && this.memory.profile && this.memory.profile.autoClassB),
    };
  }

  /* ---------- O PLANO DO DIA ---------- */
  planDay({ capacity, day } = {}) {
    const cap = capacity || this.cfg.CAPACITY;
    const today = day != null ? day : (this.world ? this.world.day : 0);

    /* 1. reúne candidatos do estado atual do MIE (dedupe por produto+ação — Art. 13) */
    const seen = new Set();
    const candidates = [];
    const cases = this.investigation ? this.investigation.cases.filter(c => c.diagnosis) : [];
    for (const c of cases) {
      const d = c.diagnosis;
      const key = `${d.productId}|${d.proposal ? d.proposal.type : d.cause}`;
      if (seen.has(key)) continue;      // missões/decisões duplicadas não são criadas
      seen.add(key);
      const verdict = this.classify(this.factorsOf(d));
      candidates.push({ diagnosis: d, ...verdict });
    }

    /* 2. aplica CAPACIDADE OPERACIONAL do dia (as melhores primeiro) */
    const byScore = (a, b) => b.score - a.score;
    const bucket = lvl => candidates.filter(x => x.level === lvl).sort(byScore);

    const interrupts = bucket(LEVEL.INTERRUPT);
    let approvals = bucket(LEVEL.APPROVE);
    let missions = [...bucket(LEVEL.MISSION), ...bucket(LEVEL.AUTO)].sort(byScore);
    const investigations = bucket(LEVEL.INVESTIGATE);
    const silence = [];

    // excedente de decisões → observação (não estoura a mesa do dono)
    if (approvals.length > cap.decisions) {
      for (const over of approvals.slice(cap.decisions))
        silence.push({ title: over.factors.title, reason: `além da capacidade de decisão do dia (${cap.decisions})`, score: over.score });
      approvals = approvals.slice(0, cap.decisions);
    }
    // excedente de missões → observação (capacidade operacional)
    if (missions.length > cap.missions) {
      for (const over of missions.slice(cap.missions))
        silence.push({ title: over.factors.title, reason: `capacidade operacional do dia (${cap.missions} missões)`, score: over.score });
      missions = missions.slice(0, cap.missions);
    }
    // o que o EPE decidiu não mostrar (silêncio inteligente)
    for (const x of candidates)
      if (x.level === LEVEL.IGNORE || x.level === LEVEL.OBSERVE)
        silence.push({ title: x.factors.title, reason: x.reason, score: x.score });

    /* 3. o funil de atenção (contadores do dia) */
    const funnel = {
      signalsFound: this.ledger.signalsFound,
      signalsIgnored: this.ledger.signalsIgnored,
      investigated: this.ledger.investigated || cases.length,
      missionsCreated: missions.length,
      resolved: this.ledger.resolved,
      decisionsForOwner: interrupts.length + approvals.length,
    };

    /* 4. a lista de atenção do dono (o que realmente importa hoje) */
    const attention = [];
    for (const i of interrupts) attention.push({ level: i.level, title: i.factors.title, why: i.reason, urgent: true });
    for (const a of approvals) attention.push({ level: a.level, title: a.factors.title, why: a.reason });
    for (const m of missions.slice(0, Math.max(0, 3 - attention.length)))
      attention.push({ level: m.level, title: m.factors.title, why: m.reason });

    /* 5. breakdown por nível (auditoria) */
    const levelBreakdown = {};
    for (const L of Object.values(LEVEL)) levelBreakdown[L] = candidates.filter(x => x.level === L).length;

    return {
      day: today, capacity: cap,
      greeting: 'Bom dia. Enquanto você descansava, cuidei da sua operação.',
      funnel,
      attention: attention.slice(0, 5),
      decisions: [...interrupts, ...approvals].map(x => this._publicItem(x)),
      missions: missions.map(x => this._publicItem(x)),
      investigations: investigations.map(x => this._publicItem(x)),
      silence: silence.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12),
      levelBreakdown,
      signature: (interrupts.length + approvals.length)
        ? 'O resto eu toco. — Eu cuido do resto.' : 'Sem pendências. Eu cuido do resto.',
    };
  }

  _publicItem(x) {
    const f = x.factors;
    return {
      id: f.id, productId: f.productId, level: x.level, title: f.title,
      impactMonthly: f.impactMonthly, confidence: f.confidenceLabel, urgency: f.urgency,
      effort: f.effort, score: x.score, reason: x.reason,
      proposalType: f.proposalType, class: f.class,
      breakdown: { impact: f.impactMonthly, urgency: f.urgency, confidence: f.confidenceLabel,
        effort: f.effort, riskOfWaiting: x.breakdown.riskOfWaiting, riskOfActingEarly: x.breakdown.riskOfActingEarly,
        base: x.breakdown.base, mult: x.breakdown.mult, factors: x.breakdown.factors, score: x.score },
    };
  }
}

NS.ExecutivePlanningEngine = ExecutivePlanningEngine;
NS.EPE_LEVEL = LEVEL;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

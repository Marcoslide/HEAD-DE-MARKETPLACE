/* INVESTIGATION ENGINE — o cérebro analítico.
   Constituição Art. 5 (fluxo obrigatório) e Art. 12 (investigar antes de
   diagnosticar). NUNCA conclui imediatamente.

   Sequência obrigatória de todo caso (nenhuma etapa pode ser pulada):
     receber_evento → consultar_historico → consultar_memoria →
     consultar_especialistas → comparar_comportamento → cruzar_informacoes
     (passos do playbook) → gerar_hipoteses → eliminar_inconsistentes →
     calcular_confianca → gerar_diagnostico → enviar_priorizacao */
(function (NS) {
'use strict';

const MANDATORY_STEPS = [
  'receber_evento', 'consultar_historico', 'consultar_memoria',
  'consultar_especialistas', 'comparar_comportamento', 'cruzar_informacoes',
  'gerar_hipoteses', 'eliminar_inconsistentes', 'calcular_confianca',
  'gerar_diagnostico', 'enviar_priorizacao',
];

class InvestigationEngine {
  constructor(bus, memory, specialists, world) {
    this.bus = bus; this.memory = memory; this.specialists = specialists; this.world = world;
    this.cases = [];
    this._counter = 0;
    bus.on('anomaly.detected', a => this.open(a));
  }

  open(anomaly) {
    const playbook = NS.Playbooks.forAnomaly(anomaly.kind);
    if (!playbook) {
      this.bus.emit('watch.added', { source: anomaly, reason: 'sem playbook: fica em observação' });
      return null;
    }
    const c = {
      id: 'inv' + (++this._counter),
      day: this.world.day,
      anomaly, playbook: playbook.id,
      steps: [], findings: {}, pareceres: [],
      hypotheses: [], diagnosis: null, status: 'open',
    };
    this.cases.push(c);
    this.bus.emit('investigation.opened', { id: c.id, kind: anomaly.kind, productId: anomaly.productId });
    this.bus.emit('activity.started', { text: `Investigando ${playbook.title.toLowerCase()} — ${this.world.product(anomaly.productId).name}` });
    this.run(c, playbook);
    return c;
  }

  step(c, name, findings) {
    c.steps.push({ name, day: this.world.day, findings });
    if (findings !== undefined) c.findings[name] = findings;
    this.bus.emit('investigation.step', { caseId: c.id, step: name });
  }

  run(c, playbook) {
    const pid = c.anomaly.productId;
    const ctx = {
      world: this.world, memory: this.memory, productId: pid,
      findings: c.findings,
      driftOf: (metric, days = 3) => {
        const rows = this.world.seriesOf(pid, days);
        const avg = rows.reduce((s, r) => s + r[metric], 0) / (rows.length || 1);
        const b = this.memory.normalOf(pid, metric);
        return b && b.mean ? { pct: (avg - b.mean) / b.mean, avg, normal: b.mean } : { pct: 0, avg };
      },
    };

    /* 1. receber o evento */
    this.step(c, 'receber_evento', { kind: c.anomaly.kind, severity: c.anomaly.severity, facts: c.anomaly.facts });

    /* 2. histórico: isso já aconteceu? o que fizemos? */
    const similar = this.memory.similarDecisions(c.anomaly.kind);
    this.step(c, 'consultar_historico', {
      similarCases: similar.length,
      note: similar.length ? 'já enfrentamos algo parecido — considerar o que funcionou' : 'primeira ocorrência deste tipo',
    });

    /* 3. memória: conhecimento e preferências relevantes */
    const knowledge = this.memory.knowledgeAbout({});
    this.step(c, 'consultar_memoria', {
      relevantKnowledge: knowledge.filter(k => k.strength >= 2).map(k => k.key),
      ownerPreferences: this.memory.preferences.map(p => p.proposalType),
    });

    /* 4. conselho de especialistas (Art. 10-11) */
    c.pareceres = this.specialists.consult({ world: this.world, memory: this.memory, productId: pid });
    this.step(c, 'consultar_especialistas', { pareceres: c.pareceres.map(p => ({ domain: p.domain, constatacao: p.constatacao })) });

    /* 5. comparar comportamento (o normal DESTA operação — Art. 17) */
    this.step(c, 'comparar_comportamento', {
      conv: ctx.driftOf('conv'), ctr: ctx.driftOf('ctr'), impressions: ctx.driftOf('impressions'),
    });

    /* 6. cruzar informações = executar os passos do playbook (MIF Parte 2) */
    for (const s of playbook.steps) this.step(c, s.name, s.run(ctx));
    this.step(c, 'cruzar_informacoes', { playbookSteps: playbook.steps.map(s => s.name) });

    /* 7. hipóteses (no mínimo o playbook fornece; nunca uma só — Art. 5.8) */
    c.hypotheses = playbook.hypotheses.map(h => ({ cause: h.cause, label: h.label, proposalType: h.proposalType }));
    this.step(c, 'gerar_hipoteses', { count: c.hypotheses.length, causes: c.hypotheses.map(h => h.cause) });

    /* 8. eliminar inconsistentes (tentar DERRUBAR cada uma — Art. 6.4) */
    for (let i = 0; i < c.hypotheses.length; i++) {
      const verdict = playbook.hypotheses[i].test(c.findings);
      Object.assign(c.hypotheses[i], verdict);
    }
    const survivors = c.hypotheses.filter(h => !h.eliminated);
    this.step(c, 'eliminar_inconsistentes', {
      eliminated: c.hypotheses.filter(h => h.eliminated).map(h => `${h.cause}: ${h.why}`),
      survivors: survivors.map(h => h.cause),
    });

    /* 9. confiança (Art. 9: sempre declarada, nunca fingida) */
    let confidence, cause;
    if (survivors.length === 1) {
      confidence = 0.55 + 0.15 * (survivors[0].support || 0);
      cause = survivors[0];
    } else if (survivors.length > 1) {
      survivors.sort((a, b) => (b.support || 0) - (a.support || 0));
      cause = survivors[0];
      confidence = 0.45 + 0.1 * (cause.support || 0); // causas concorrentes → menos confiança
    } else {
      cause = null;
      confidence = 0.2; // honestidade: "ainda não sei a causa" (Art. 12)
    }
    confidence = Math.min(0.95, confidence);
    const label = confidence >= 0.75 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa';
    this.step(c, 'calcular_confianca', { confidence, label });

    /* 10. diagnóstico */
    const playbookRef = NS.Playbooks.all[c.playbook];
    const proposal = cause ? playbookRef.proposalFor(cause.cause, { ...ctx, findings: c.findings }) : null;
    c.diagnosis = {
      caseId: c.id, productId: pid, anomalyKind: c.anomaly.kind, severity: c.anomaly.severity,
      cause: cause ? cause.cause : 'unknown',
      causeLabel: cause ? cause.label : 'causa ainda não identificada — eliminei ' +
        c.hypotheses.filter(h => h.eliminated).map(h => h.cause).join(', '),
      confidence, confidenceLabel: label,
      evidence: c.steps.filter(s => s.findings && s.findings.note).map(s => s.findings.note),
      pareceres: c.pareceres,
      proposal,
      recurrence: similar.length,
    };
    this.step(c, 'gerar_diagnostico', { cause: c.diagnosis.cause, confidence: label });

    /* 11. enviar ao Motor de Priorização — NUNCA direto ao usuário */
    c.status = 'diagnosed';
    this.step(c, 'enviar_priorizacao', null);
    this.bus.emit('diagnosis.ready', c.diagnosis);
    return c;
  }

  caseById(id) { return this.cases.find(x => x.id === id); }
}

NS.InvestigationEngine = InvestigationEngine;
NS.MANDATORY_STEPS = MANDATORY_STEPS;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

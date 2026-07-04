/* MieBridge — a ponte formal entre a Camada Cognitiva (MIE) e a
   Camada de Execução (plataforma MOS).

   O CTO Review apontou como recomendação nº 1 que a ponte MIE↔plataforma
   era manual (só existia no demo e no teste E2E). Este serviço a formaliza:
   assina o EventBus do MIE e ESPELHA o estado cognitivo nos repositórios
   persistentes — investigações, decisões, missões e planos.

   Princípios preservados:
   - O MIE continua não sabendo que a plataforma existe (Art. 11): a ponte
     só ESCUTA o bus; nenhum motor é modificado.
   - Somente decisões chegam à fila persistida (Art. 19): a ponte espelha
     `decision.created` (que já passou pelo Motor de Priorização) e
     `interrupt.raised`; NUNCA `watch.added` (curiosidades).
   - Idempotência: cada caso/decisão do MIE é espelhado uma única vez
     (dedupe por id), mesmo que o motor re-emita.

   Mapeamento de produto: o MIE usa ids do mundo simulado (p1..p5). A ponte
   recebe um `productMap` (mieProductId → mos product.id); ids não mapeados
   são persistidos com product_id nulo (schema permite) mantendo a
   referência do MIE no contexto — nada se perde. */
'use strict';

class MieBridge {
  constructor({ mieBus, mos, companyId, productMap = {}, logger = null }) {
    this.mieBus = mieBus;
    this.mos = mos;
    this.companyId = companyId;
    this.productMap = productMap;
    this.log = logger;

    /* rastros para idempotência e correlação */
    this.investigationByCase = new Map(); // MIE caseId → MOS investigation.id
    this.decisionByPr = new Map();         // MIE priority id → MOS decision.id
    this.stats = { investigations: 0, decisions: 0, interrupts: 0, missions: 0 };

    this._wire();
  }

  _product(mieProductId) {
    return this.productMap[mieProductId] || null;
  }

  _wire() {
    /* 1. investigação aberta → registro persistido (status open) */
    this.mieBus.on('investigation.opened', ({ id, kind, productId }) => {
      if (this.investigationByCase.has(id)) return;
      const inv = this.mos.repos.investigation.insert({
        company_id: this.companyId, product_id: this._product(productId),
        anomaly_kind: kind, playbook: kind, status: 'open',
        steps_json: [], diagnosis_json: null, confidence: null,
      });
      this.investigationByCase.set(id, inv.id);
      this.stats.investigations++;
    });

    /* 2. diagnóstico pronto → atualiza a investigação (status diagnosed) */
    this.mieBus.on('diagnosis.ready', d => {
      const invId = this.investigationByCase.get(d.caseId);
      if (!invId) return;
      this.mos.repos.investigation.update(invId, {
        status: 'diagnosed',
        diagnosis_json: {
          cause: d.cause, causeLabel: d.causeLabel,
          evidence: d.evidence, pareceres: d.pareceres.map(p => ({ domain: p.domain, constatacao: p.constatacao })),
        },
        confidence: d.confidence,
      });
    });

    /* 3. decisão priorizada → decisão persistida (o pacote completo, Art. 19) */
    this.mieBus.on('decision.created', item => this._mirrorDecision(item));

    /* 4. incidente → decisão crítica + missão de primeira resposta (Fluxo 008) */
    this.mieBus.on('interrupt.raised', item => {
      if (this.decisionByPr.has(item.id)) return;
      const d = item.diagnosis;
      const mos = this.mos;
      const productId = this._product(item.productId);
      // missão de primeira resposta: o MIE já começou a agir
      const mission = mos.repos.mission.insert({
        company_id: this.companyId, product_id: productId, decision_id: null,
        kind: 'executando', title: item.title || d.causeLabel,
        status: 'active', origin: 'incidente detectado pelo MIE — primeira resposta em curso',
        log_json: [{ note: 'espelhado do interrupt.raised do MIE' }],
      });
      this.stats.interrupts++; this.stats.missions++;
      this.decisionByPr.set(item.id, mission.id);
    });
  }

  _mirrorDecision(item) {
    if (this.decisionByPr.has(item.id)) return;
    const d = item.diagnosis;
    if (!d || !d.proposal) return; // sem proposta não é decisão (Art. 19)
    const decision = this.mos.services.decision.create(this.companyId, {
      productId: this._product(item.productId),
      title: item.title,
      discovery: d.causeLabel,
      probableCause: d.cause,
      proposal: {
        type: d.proposal.type,
        text: d.proposal.text,
        steps: d.proposal.steps || [],
        mieProductRef: item.productId, // referência do mundo do MIE preservada
        caseId: item.caseId,
      },
      impactMin: Math.round(item.impactMonthly * 0.85),
      impactMax: Math.round(item.impactMonthly * 1.15),
      confidence: item.confidenceLabel,
      reversibility: d.proposal.reversible === false ? 'baixa' : 'alta',
      class: d.proposal.class || 'C',
      investigationId: this.investigationByCase.get(item.caseId) || null,
    });
    this.decisionByPr.set(item.id, decision.id);
    this.stats.decisions++;
  }

  /* espelha o estado ATUAL do MIE de uma vez (para instâncias já rodando
     antes da ponte ser conectada) — idempotente */
  syncExisting(mie) {
    for (const c of mie.investigation.cases) {
      if (!this.investigationByCase.has(c.id)) {
        const inv = this.mos.repos.investigation.insert({
          company_id: this.companyId, product_id: this._product(c.anomaly.productId),
          anomaly_kind: c.anomaly.kind, playbook: c.playbook,
          status: c.diagnosis ? 'diagnosed' : 'open',
          steps_json: c.steps.map(s => s.name),
          diagnosis_json: c.diagnosis ? { cause: c.diagnosis.cause, causeLabel: c.diagnosis.causeLabel } : null,
          confidence: c.diagnosis ? c.diagnosis.confidence : null,
        });
        this.investigationByCase.set(c.id, inv.id);
        this.stats.investigations++;
      }
    }
    for (const item of mie.prioritization.pendingDecisions()) this._mirrorDecision(item);
    return this.stats;
  }
}

module.exports = { MieBridge };

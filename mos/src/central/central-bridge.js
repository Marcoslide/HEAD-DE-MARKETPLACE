/* CENTRAL BRIDGE (Sprint 09) — dados reais normalizados → cérebro do Head.

   Mesmo padrão do MieBridge (idempotente, só escuta, nenhum motor
   modificado): assina os sinais da Central no bus do MOS e alimenta

     Knowledge Graph  ← nós/arestas com proveniência de mundo real
     EPE              ← sinais executivos (NUNCA payload bruto)
     Plano do Dia     ← via planDay() normal do EPE

   O MIE continua sem saber que a plataforma existe: recebe sinais no
   formato executivo que o EPE já entende. */
'use strict';

class CentralBridge {
  constructor({ mosBus, mie, logger = null }) {
    this.mie = mie;
    this.log = logger;
    this.stats = { signals: 0, graphNodes: 0, duplicates: 0 };
    this._seen = new Set();

    mosBus.on('central.signal', s => this.pushSignal(s));
  }

  pushSignal(s) {
    if (this._seen.has(s.signalKey)) { this.stats.duplicates++; return null; }
    this._seen.add(s.signalKey);

    /* 1. Knowledge Graph: o sinal vira memória contextual com proveniência */
    const g = this.mie.graph;
    if (g) {
      const mkt = g.upsertNode('Marketplace', s.provenance.platform);
      const sig = g.upsertNode('Learning', `signal:${s.signalKey}`, {
        playbook: s.playbook, impactMonthly: s.impactMonthly,
        evidence: s.evidence, eventId: s.provenance.eventId,
      }, s.title);
      g.link('SIGNAL_FROM_MARKETPLACE', sig.id, mkt.id, { evidence: s.provenance.eventId });
      if (s.provenance.entityId) {
        const ent = g.upsertNode(
          s.provenance.entityType === 'MARKETPLACE_ORDER' ? 'Mission' : 'Listing',
          `${s.provenance.platform}:${s.provenance.entityId}`,
          { platform: s.provenance.platform, externalId: s.provenance.entityId });
        g.link('SIGNAL_ABOUT_ENTITY', sig.id, ent.id, { evidence: s.signalKey });
      }
      this.stats.graphNodes++;
    }

    /* 2. EPE: candidato executivo normalizado (o EPE valida que não há bruto).
       executionScope INTERNAL_ONLY (Sprint 09): READ_ONLY é absoluto para
       marketplaces — qualquer "execução" derivada de sinal da Central é
       INTERNA ao Head (alerta, missão interna, priorização de fila,
       registro, notificação). NUNCA chamada de escrita em praça externa. */
    const accepted = this.mie.epe.addExternalSignal({
      signalKey: s.signalKey, playbook: s.playbook,
      id: s.signalKey, productId: s.productId, title: s.title,
      impactMonthly: s.impactMonthly, confidenceLabel: s.confidenceLabel,
      urgency: s.urgency, severity: s.severity, effort: s.effort,
      reversible: s.reversible !== false, class: s.class ?? null,
      proposalType: s.proposalType ?? null, hasProposal: !!s.hasProposal,
      window: !!s.window, autoAuthorized: !!s.autoAuthorized,
      recommendation: s.recommendation ?? null,
      provenance: s.provenance,
      executionScope: 'INTERNAL_ONLY',
    });
    if (accepted) {
      this.stats.signals++;
      /* o funil do dia enxerga o sinal real (Art. 3 — mostrar o trabalho) */
      this.mie.bus.emit('signal.observed', { source: 'central', kind: s.playbook, z: 99 });
    }
    return accepted;
  }
}

module.exports = { CentralBridge };

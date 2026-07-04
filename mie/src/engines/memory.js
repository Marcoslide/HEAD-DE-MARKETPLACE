/* MEMORY ENGINE — a memória permanente da empresa.
   Constituição Arts. 16-17: nada se perde; o "normal" é aprendido por
   operação, nunca por benchmark genérico.
   MIF Parte 8: conhecimento tem forma fixa e força de evidência (1-3).

   Camadas da memória:
     baselines    — o normal de cada métrica de cada produto (média + desvio)
     knowledge    — a biblioteca viva (descoberta/contexto/evidência/força)
     preferences  — o jeito do dono decidir (recusas e motivos)
     decisions    — histórico completo de decisões e resultados
     profile      — o dossiê da empresa (Fluxo 001) */
(function (NS) {
'use strict';

const WARMUP_DAYS = 14;

class MemoryEngine {
  constructor(bus) {
    this.bus = bus;
    this.baselines = new Map();   // `${productId}.${metric}` → {mean, std, n}
    this.knowledge = [];
    this.preferences = [];
    this.decisions = [];
    this.profile = null;
    this.calibration = { predictions: 0, hits: 0 }; // viés das previsões

    bus.on('learning.recorded', k => this.absorb(k));
  }

  /* ---------- o normal da operação (Art. 17) ---------- */
  learnBaseline(productId, metric, value) {
    const key = `${productId}.${metric}`;
    const b = this.baselines.get(key) || { mean: value, m2: 0, n: 0 };
    b.n += 1;
    const d = value - b.mean;
    b.mean += d / b.n;
    b.m2 += d * (value - b.mean);
    b.std = b.n > 1 ? Math.sqrt(b.m2 / (b.n - 1)) : 0;
    this.baselines.set(key, b);
  }
  normalOf(productId, metric) { return this.baselines.get(`${productId}.${metric}`) || null; }
  isWarmedUp(productId) {
    const b = this.normalOf(productId, 'conv');
    return b && b.n >= WARMUP_DAYS;
  }
  /* desvio em nº de desvios-padrão vs. o normal DESTA operação */
  zScore(productId, metric, value) {
    const b = this.normalOf(productId, metric);
    if (!b || !b.std) return 0;
    return (value - b.mean) / b.std;
  }

  /* ---------- a biblioteca viva (MIF 8) ---------- */
  absorb(entry) {
    // dedupe por chave da descoberta: repetição sobe força, contradição rebaixa
    const found = this.knowledge.find(k => k.key === entry.key);
    if (found) {
      if (entry.contradicts) {
        found.strength = Math.max(1, found.strength - 1);
        found.needsRevalidation = true;
      } else {
        found.strength = Math.min(3, found.strength + 1);
        found.evidence.push(entry.evidence);
      }
      this.bus.emit('memory.updated', { kind: 'knowledge', key: found.key, strength: found.strength });
      return found;
    }
    const k = {
      key: entry.key, kind: entry.kind || 'pattern',
      discovery: entry.discovery, context: entry.context || {},
      evidence: [entry.evidence].filter(Boolean),
      strength: 1, day: NS._currentDay || 0,
    };
    this.knowledge.push(k);
    this.bus.emit('memory.updated', { kind: 'knowledge', key: k.key, strength: 1 });
    return k;
  }
  knowledgeAbout(filter) {
    return this.knowledge.filter(k =>
      (!filter.kind || k.kind === filter.kind) &&
      (!filter.key || k.key.includes(filter.key)));
  }

  /* ---------- o jeito do dono (Art. 18: recusas ensinam) ---------- */
  recordPreference(pref) {
    this.preferences.push({ ...pref, day: NS._currentDay || 0 });
    this.absorb({
      key: `pref.${pref.proposalType}.${pref.motive}`,
      kind: 'preference',
      discovery: `O dono tende a recusar propostas de "${pref.proposalType}" por motivo: ${pref.motive}.`,
      evidence: { decisionId: pref.decisionId },
    });
  }
  reluctance(proposalType) {
    // 0 (sem histórico de recusa) a 1 (recusa consistente)
    const n = this.preferences.filter(p => p.proposalType === proposalType).length;
    return Math.min(1, n * 0.4);
  }

  /* ---------- histórico de decisões (Art. 15) ---------- */
  recordDecision(decision) { this.decisions.push(decision); }
  similarDecisions(cause) { return this.decisions.filter(d => d.cause === cause); }

  snapshot() {
    return {
      baselines: this.baselines.size,
      knowledge: this.knowledge.map(k => ({ key: k.key, strength: k.strength, kind: k.kind })),
      preferences: this.preferences.length,
      decisions: this.decisions.length,
    };
  }
}

NS.MemoryEngine = MemoryEngine;
NS.WARMUP_DAYS = WARMUP_DAYS;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

/* MEMORY ENGINE — a memória permanente da empresa.
   Constituição Arts. 16-17: nada se perde; o "normal" é aprendido por
   operação, nunca por benchmark genérico.
   MIF Parte 8: conhecimento tem forma fixa e força de evidência (1-3).

   Camadas da memória:
     baselines    — o normal de cada métrica de cada produto (média + desvio)
     patterns     — comportamento aprendido: dia-da-semana, sazonalidade
     knowledge    — a biblioteca viva (descoberta/contexto/evidência/força)
     preferences  — o jeito do dono decidir (recusas e motivos)
     decisions    — histórico completo de decisões e resultados
     calibration  — o viés das próprias previsões, por tipo de estratégia */
(function (NS) {
'use strict';

class MemoryEngine {
  constructor(bus) {
    this.bus = bus;
    this.baselines = new Map();     // `${productId}.${metric}` → {mean, std, n}
    this.weekday = new Map();       // `${productId}.dow${d}` → índice EWMA (sazonalidade semanal)
    this.seasonality = new Map();   // mês → índice EWMA (sazonalidade anual)
    this.knowledge = [];
    this.preferences = [];
    this.decisions = [];
    this.profile = null;
    this.calibration = { predictions: 0, hits: 0, byType: new Map() }; // viés por estratégia
    this.specialists = new Map(); // domain → { predictions, hits, weight } (Sprint 06)

    bus.on('learning.recorded', k => this.absorb(k));
  }

  get cfg() { return NS.CONFIG; }

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
    return b && b.n >= this.cfg.WARMUP_DAYS;
  }
  zScore(productId, metric, value) {
    const b = this.normalOf(productId, metric);
    if (!b || !b.std) return 0;
    return (value - b.mean) / b.std;
  }

  /* ---------- padrões de comportamento (Bloco 01: a empresa tem um ritmo) ---------- */
  /* dia-da-semana: razão entre o dia e a média móvel — aprende que domingo
     vende menos NESTA operação, sem nenhuma regra fixa */
  learnWeekday(productId, dow, value, trailingMean) {
    if (!trailingMean) return;
    const key = `${productId}.dow${dow}`;
    const ratio = value / trailingMean;
    const prev = this.weekday.get(key);
    const a = this.cfg.PATTERN_ALPHA;
    this.weekday.set(key, prev == null ? ratio : prev * (1 - a) + ratio * a);
  }
  weekdayFactor(productId, dow) {
    const v = this.weekday.get(`${productId}.dow${dow}`);
    return v == null ? 1 : v;
  }
  /* deseasonaliza um valor para comparação justa (mesmo-dia-contra-mesmo-dia, MIF 5.3) */
  deseasonalize(productId, dow, value) {
    const f = this.weekdayFactor(productId, dow);
    return f > 0.2 ? value / f : value;
  }
  learnSeason(month, demandIndex) {
    const prev = this.seasonality.get(month);
    const a = this.cfg.PATTERN_ALPHA;
    this.seasonality.set(month, prev == null ? demandIndex : prev * (1 - a) + demandIndex * a);
  }
  /* chamado pelo Scheduler a cada ciclo: a memória aprende o ritmo da casa */
  learnPatterns(world) {
    for (const p of world.products) {
      const rows = p.series;
      if (rows.length < 8) continue;
      const last = rows[rows.length - 1];
      const trailing = rows.slice(-8, -1).reduce((s, r) => s + r.impressions, 0) / 7;
      this.learnWeekday(p.id, last.day % 7, last.impressions, trailing);
    }
    const d = world.categoryDemand[world.categoryDemand.length - 1];
    if (d) this.learnSeason(Math.floor(d.day / 30.4) % 12, d.index);
  }
  patternsSnapshot() {
    const best = {}, worst = {};
    for (const [key, v] of this.weekday) {
      const [pid, dow] = key.split('.dow');
      if (!best[pid] || v > best[pid].v) best[pid] = { dow: +dow, v };
      if (!worst[pid] || v < worst[pid].v) worst[pid] = { dow: +dow, v };
    }
    return { bestDayByProduct: best, worstDayByProduct: worst,
             seasonality: [...this.seasonality.entries()] };
  }

  /* ---------- a biblioteca viva (MIF 8) ---------- */
  absorb(entry) {
    const found = this.knowledge.find(k => k.key === entry.key);
    if (found) {
      if (entry.contradicts) {
        found.strength = Math.max(1, found.strength - 1);
        found.needsRevalidation = true;
      } else {
        found.strength = Math.min(3, found.strength + 1);
        found.evidence.push(entry.evidence);
        /* força 3 = padrão da casa: passa a valer nas próximas propostas */
        if (found.strength === 3 && !found.promoted) {
          found.promoted = true;
          this.bus.emit('strategy.updated', { key: found.key, discovery: found.discovery });
        }
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
  /* vencedores comprovados (força ≥ 2): palavras, criativos, estratégias */
  winners() {
    const proved = this.knowledge.filter(k => k.strength >= 2);
    return {
      keywords: proved.filter(k => k.kind === 'keyword'),
      creatives: proved.filter(k => k.kind === 'creative'),
      strategies: proved.filter(k => k.kind === 'strategy'),
      patterns: proved.filter(k => k.kind === 'pattern'),
    };
  }

  /* ---------- calibração de previsões (Learning escreve, Prioritization lê) ---------- */
  updateCalibration(type, realizationRatio) {
    const a = this.cfg.CALIBRATION_ALPHA;
    const clamped = Math.max(0, Math.min(2, realizationRatio));
    const prev = this.calibration.byType.get(type);
    this.calibration.byType.set(type, prev == null ? clamped : prev * (1 - a) + clamped * a);
  }
  calibrationFactor(type) {
    const v = this.calibration.byType.get(type);
    return v == null ? 1 : Math.max(0.5, Math.min(1.5, v));
  }

  /* ---------- histórico de acertos dos especialistas (Sprint 06) ----------
     Cada especialista fica mais ou menos confiável com o tempo. O peso é
     uma média móvel entre 0,5 (erra sempre) e 1,5 (acerta sempre), usada
     pelo Conselho na votação ponderada. */
  recordSpecialistOutcome(domain, hit) {
    const s = this.specialists.get(domain) || { predictions: 0, hits: 0, weight: 1 };
    s.predictions += 1;
    if (hit) s.hits += 1;
    const a = this.cfg.CALIBRATION_ALPHA;
    s.weight = s.weight * (1 - a) + (hit ? 1.5 : 0.5) * a;
    this.specialists.set(domain, s);
    return s;
  }
  specialistAccuracy(domain) {
    const s = this.specialists.get(domain);
    if (!s) return 1; // sem histórico: peso neutro
    return Math.max(0.5, Math.min(1.5, s.weight));
  }
  specialistsSnapshot() {
    return [...this.specialists.entries()].map(([domain, s]) => ({
      domain, predictions: s.predictions, hits: s.hits,
      accuracy: s.predictions ? Math.round((s.hits / s.predictions) * 100) / 100 : null,
      weight: Math.round(this.specialistAccuracy(domain) * 100) / 100,
    }));
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
    const n = this.preferences.filter(p => p.proposalType === proposalType).length;
    return Math.min(1, n * 0.4);
  }

  /* ---------- histórico de decisões (Art. 15) ---------- */
  recordDecision(decision) { this.decisions.push(decision); }
  similarDecisions(cause) { return this.decisions.filter(d => d.cause === cause); }

  snapshot() {
    return {
      baselines: this.baselines.size,
      weekdayPatterns: this.weekday.size,
      knowledge: this.knowledge.map(k => ({ key: k.key, strength: k.strength, kind: k.kind })),
      preferences: this.preferences.length,
      decisions: this.decisions.length,
      calibration: [...this.calibration.byType.entries()].map(([t, v]) => ({ type: t, factor: Math.round(v * 100) / 100 })),
    };
  }
}

NS.MemoryEngine = MemoryEngine;
Object.defineProperty(NS, 'WARMUP_DAYS', { get: () => NS.CONFIG.WARMUP_DAYS, configurable: true });
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

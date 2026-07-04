/* OBSERVATION ENGINE — Constituição Art. 14 (vigília permanente).
   Lê o mundo a cada ciclo, aprende o normal (Memory) e detecta desvios.
   NUNCA conclui nada: só emite sinais e anomalias. Interpretar é trabalho
   do Investigation Engine; decidir o que importa, do Prioritization.

   Dois limiares (Art. 19 na prática):
     z ≥ SOFT  → anomalia "info" (investiga, mas raramente vira interrupção)
     z ≥ HARD  → anomalia "attention"
     eventos de plataforma / perda total → "critical" */
(function (NS) {
'use strict';

const SOFT_Z = 2.0;
const HARD_Z = 3.2;
const METRICS = ['impressions', 'ctr', 'conv'];

class ObservationEngine {
  constructor(bus, world, memory) {
    this.bus = bus; this.world = world; this.memory = memory;
    this.seenCompetitors = new Map(); // productId → Set(competitorId)
    this.openAnomalies = new Map();   // dedupe: productId.kind → day
    this._counter = 0;
  }

  /* Um ciclo completo de vigília. Retorna as anomalias emitidas. */
  scan() {
    const out = [];
    for (const p of this.world.products) {
      const row = this.world.latest(p.id);
      if (!row) continue;

      /* 1. eventos de plataforma → incidente direto (crítico) */
      const down = this.world.platformEvents.find(e => e.productId === p.id && e.kind === 'listing_down');
      if (down && !this.dedupe(p.id, 'listing_down')) {
        out.push(this.raise(p.id, 'listing_down', 'critical', { reason: down.reason }));
      }

      /* 2. concorrência: entrantes novos */
      const seen = this.seenCompetitors.get(p.id) || new Set();
      for (const c of p.competitors) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          if (c.entryDay && !this.dedupe(p.id, 'new_competitor'))
            out.push(this.raise(p.id, 'new_competitor', 'attention', { competitor: c.name, price: c.price }));
        }
      }
      this.seenCompetitors.set(p.id, seen);

      /* 3. métricas: aprender o normal ANTES de julgar (Art. 17) */
      if (!this.memory.isWarmedUp(p.id)) {
        for (const m of METRICS) this.memory.learnBaseline(p.id, m, row[m]);
        this.memory.learnBaseline(p.id, 'ranking', row.ranking);
        continue; // em aquecimento: humildade declarada, sem alarme
      }

      /* 4. desvios vs. o normal DESTA operação */
      for (const m of METRICS) {
        const z = this.memory.zScore(p.id, m, row[m]);
        this.bus.emit('signal.observed', { productId: p.id, metric: m, value: row[m], z: round2(z) });
        if (row.impressions === 0) continue; // já tratado como incidente
        if (z <= -SOFT_Z) {
          const kind = m === 'conv' ? 'sales_drop' : (m === 'ctr' ? 'ctr_drop' : 'traffic_drop');
          if (!this.dedupe(p.id, kind))
            out.push(this.raise(p.id, kind, z <= -HARD_Z ? 'attention' : 'info', { metric: m, z: round2(z) }));
        }
        if (m === 'conv' && z >= HARD_Z && !this.dedupe(p.id, 'success_streak')) {
          out.push(this.raise(p.id, 'success_streak', 'info', { z: round2(z) }));
        }
      }

      /* 5. reputação */
      const badToday = p.reviews.filter(r => r.stars <= 2 && this.world.day - r.day <= 2);
      if (badToday.length >= 2 && !this.dedupe(p.id, 'review_wave'))
        out.push(this.raise(p.id, 'review_wave', 'attention', { count: badToday.length, pattern: badToday[0].text }));

      /* 6. o normal continua sendo aprendido (lentamente) fora de anomalias */
      const zc = this.memory.zScore(p.id, 'conv', row.conv);
      if (Math.abs(zc) < SOFT_Z) for (const m of METRICS) this.memory.learnBaseline(p.id, m, row[m]);
    }
    return out;
  }

  raise(productId, kind, severity, facts) {
    const anomaly = { id: 'a' + (++this._counter), day: this.world.day, productId, kind, severity, facts };
    this.bus.emit('anomaly.detected', anomaly);
    return anomaly;
  }
  dedupe(productId, kind) {
    const key = productId + '.' + kind;
    const last = this.openAnomalies.get(key);
    if (last && this.world.day - last < 7) return true; // não reabrir a mesma anomalia toda hora
    this.openAnomalies.set(key, this.world.day);
    return false;
  }
}

function round2(x) { return Math.round(x * 100) / 100; }

NS.ObservationEngine = ObservationEngine;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

/* OBSERVATION ENGINE — Constituição Art. 14 (vigília permanente).
   Lê o mundo a cada ciclo, aprende o normal (Memory) e detecta desvios.
   NUNCA conclui nada: só emite sinais e anomalias.

   O que vigia (Bloco 01): tráfego, CTR, conversão, ranking, devoluções,
   estoque (dias de cobertura), reputação, entrantes, decadência gradual
   e mudanças de plataforma (todos os produtos juntos = assinatura externa).

   Regras de julgamento:
     - impressões são DESEASONALIZADAS pelo padrão semanal aprendido
       (mesmo-dia-contra-mesmo-dia, MIF 5.3) antes do z-score;
     - z ≥ SOFT → anomalia "info"; z ≥ HARD → "attention";
       incidentes (estoque crítico, anúncio fora) → "critical". */
(function (NS) {
'use strict';

const METRICS = ['impressions', 'ctr', 'conv'];

class ObservationEngine {
  constructor(bus, world, memory) {
    this.bus = bus; this.world = world; this.memory = memory;
    this.seenCompetitors = new Map();
    this.openAnomalies = new Map(); // `${pid}.${kind}` → {day, rank}
    this.lastZ = new Map();         // `${pid}.${metric}` → z do ciclo anterior
    this._counter = 0;
  }
  get cfg() { return NS.CONFIG; }

  scan() {
    const out = [];
    const trafficDrops = []; // candidatos a queda de tráfego (avaliados no fim: plataforma?)

    for (const p of this.world.products) {
      const row = this.world.latest(p.id);
      if (!row) continue;

      /* 1. eventos de plataforma → incidente direto */
      const down = this.world.platformEvents.find(e => e.productId === p.id && e.kind === 'listing_down');
      if (down && !this.dedupe(p.id, 'listing_down', 'critical'))
        out.push(this.raise(p.id, 'listing_down', 'critical', { reason: down.reason }));

      /* 2. concorrência: entrantes (1 = entrante; ≥2 em 3 dias = onda) */
      const seen = this.seenCompetitors.get(p.id) || new Set();
      const fresh = [];
      for (const c of p.competitors) {
        if (!seen.has(c.id)) { seen.add(c.id); if (c.entryDay) fresh.push(c); }
      }
      this.seenCompetitors.set(p.id, seen);
      if (fresh.length >= 2 && !this.dedupe(p.id, 'competitor_surge', 'attention'))
        out.push(this.raise(p.id, 'competitor_surge', 'attention', { entrants: fresh.map(c => c.name) }));
      else if (fresh.length === 1 && !this.dedupe(p.id, 'new_competitor', 'attention'))
        out.push(this.raise(p.id, 'new_competitor', 'attention', { competitor: fresh[0].name, price: fresh[0].price }));

      /* 3. aquecimento: aprender o normal ANTES de julgar (Art. 17) */
      const dow = row.day % 7;
      const returnsRate = row.orders > 0 ? row.returns / row.orders : 0;
      if (!this.memory.isWarmedUp(p.id)) {
        this.learnAll(p.id, row, dow, returnsRate);
        continue;
      }

      /* 4. estoque: dias de cobertura, não unidades (MIF 3.3) */
      const stockDays = this.world.stockDaysOf(p.id);
      if (stockDays <= this.cfg.STOCK_CRITICAL_DAYS && !this.dedupe(p.id, 'stockout_critical', 'critical'))
        out.push(this.raise(p.id, 'stockout_critical', 'critical', { stockDays }));
      else if (stockDays <= this.cfg.STOCK_ATTENTION_DAYS && !this.dedupe(p.id, 'stockout_risk', 'attention'))
        out.push(this.raise(p.id, 'stockout_risk', 'attention', { stockDays }));

      /* 5. métricas vs. o normal DESTA operação */
      const deImp = this.memory.deseasonalize(p.id, dow, row.impressions);
      const values = { impressions: deImp, ctr: row.ctr, conv: row.conv };
      for (const m of METRICS) {
        const z = this.memory.zScore(p.id, m, values[m]);
        this.bus.emit('signal.observed', { productId: p.id, metric: m, value: values[m], z: round2(z) });
        const prevZ = this.lastZ.get(p.id + '.' + m) ?? 0;
        this.lastZ.set(p.id + '.' + m, z);
        if (row.impressions === 0) continue; // incidente já tratado
        /* 1 dia forte OU 2 dias leves consecutivos — um mergulho isolado de
           ruído não abre investigação (dimensionar antes de alarmar) */
        const sustained = z <= -this.cfg.HARD_Z || (z <= -this.cfg.SOFT_Z && prevZ <= -this.cfg.SOFT_Z);
        if (sustained) {
          const sev = z <= -this.cfg.HARD_Z ? 'attention' : 'info';
          if (m === 'impressions') trafficDrops.push({ productId: p.id, z, sev });
          else {
            const kind = m === 'conv' ? 'sales_drop' : 'ctr_drop';
            if (!this.dedupe(p.id, kind, sev)) out.push(this.raise(p.id, kind, sev, { metric: m, z: round2(z) }));
          }
        }
      }

      /* 6. explosão de vendas (oportunidade também é anomalia) */
      const zi = this.memory.zScore(p.id, 'impressions', deImp);
      const zc = this.memory.zScore(p.id, 'conv', row.conv);
      if (zi >= this.cfg.HARD_Z && !this.dedupe(p.id, 'sales_explosion', 'attention'))
        out.push(this.raise(p.id, 'sales_explosion', 'attention', { zImpressions: round2(zi), stockDays }));
      else if (zc >= this.cfg.HARD_Z && zi < this.cfg.HARD_Z && !this.dedupe(p.id, 'success_streak', 'info'))
        out.push(this.raise(p.id, 'success_streak', 'info', { z: round2(zc) }));

      /* 7. decadência silenciosa: nenhum dia grita, mas a soma sangra */
      const recent = this.world.seriesOf(p.id, 3);
      const convAvg = recent.reduce((s, r) => s + r.conv, 0) / recent.length;
      const b = this.memory.normalOf(p.id, 'conv');
      if (b && b.mean && (convAvg - b.mean) / b.mean <= this.cfg.DECAY_TRIGGER_PCT &&
          !this.dedupe(p.id, 'silent_decay', 'attention'))
        out.push(this.raise(p.id, 'silent_decay', 'attention',
          { cumulativePct: round2((convAvg - b.mean) / b.mean) }));

      /* 8. ranking */
      const zr = this.memory.zScore(p.id, 'ranking', row.ranking);
      if (zr >= this.cfg.HARD_Z && !this.dedupe(p.id, 'ranking_drop', 'attention'))
        out.push(this.raise(p.id, 'ranking_drop', 'attention', { ranking: row.ranking, z: round2(zr) }));

      /* 9. devoluções (taxa, não valor absoluto) */
      const zret = this.memory.zScore(p.id, 'returnsRate', returnsRate);
      if (zret >= this.cfg.HARD_Z && !this.dedupe(p.id, 'returns_spike', 'attention'))
        out.push(this.raise(p.id, 'returns_spike', 'attention', { rate: round2(returnsRate), z: round2(zret) }));

      /* 10. reputação */
      const badToday = p.reviews.filter(r => r.stars <= 2 && this.world.day - r.day <= 2);
      if (badToday.length >= 2 && !this.dedupe(p.id, 'review_wave', 'attention'))
        out.push(this.raise(p.id, 'review_wave', 'attention', { count: badToday.length, pattern: badToday[0].text }));

      /* 11. o normal continua sendo aprendido fora de anomalias */
      if (Math.abs(zc) < this.cfg.SOFT_Z) this.learnAll(p.id, row, dow, returnsRate);
    }

    /* 12. quedas de tráfego: juntas no mesmo dia = plataforma (MIF 3.6);
           isolada = problema de visibilidade do produto */
    if (trafficDrops.length) {
      const ratio = trafficDrops.length / this.world.products.length;
      if (ratio >= this.cfg.PLATFORM_WIDE_RATIO) {
        if (!this.dedupe('operation', 'algorithm_change', 'attention'))
          out.push(this.raise(trafficDrops[0].productId, 'algorithm_change', 'attention',
            { affected: trafficDrops.map(t => t.productId), ratio: round2(ratio), scope: 'operation' }));
      } else {
        for (const t of trafficDrops)
          if (!this.dedupe(t.productId, 'ranking_drop', t.sev))
            out.push(this.raise(t.productId, 'ranking_drop', t.sev, { via: 'traffic', z: round2(t.z) }));
      }
    }
    return out;
  }

  learnAll(pid, row, dow, returnsRate) {
    const deImp = this.memory.deseasonalize(pid, dow, row.impressions);
    this.memory.learnBaseline(pid, 'impressions', deImp);
    this.memory.learnBaseline(pid, 'ctr', row.ctr);
    this.memory.learnBaseline(pid, 'conv', row.conv);
    this.memory.learnBaseline(pid, 'ranking', row.ranking);
    this.memory.learnBaseline(pid, 'returnsRate', returnsRate);
  }

  raise(productId, kind, severity, facts) {
    const anomaly = { id: 'a' + (++this._counter), day: this.world.day, productId, kind, severity, facts };
    this.bus.emit('anomaly.detected', anomaly);
    return anomaly;
  }
  dedupe(productId, kind, severity = 'attention') {
    const RANK = { info: 0, attention: 1, critical: 2 };
    const key = productId + '.' + kind;
    const last = this.openAnomalies.get(key);
    /* mesma anomalia dentro de 7 dias: suprimir — EXCETO se a severidade
       escalou (um caso info não pode cegar o sistema para o attention real) */
    if (last && this.world.day - last.day < 7 && RANK[severity] <= last.rank) return true;
    this.openAnomalies.set(key, { day: this.world.day, rank: RANK[severity] });
    return false;
  }
}

function round2(x) { return Math.round(x * 100) / 100; }

NS.ObservationEngine = ObservationEngine;
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

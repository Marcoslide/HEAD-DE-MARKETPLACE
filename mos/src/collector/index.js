/* MARKETPLACE COLLECTOR (Bloco 09) — os olhos do sistema.
   Arquitetura completa: Crawler (interface) → Cache → Parser →
   Snapshot → Comparador → eventos de mudança → Histórico.
   Trabalho pesado roda na fila `collector`; cadências no Scheduler.

   REGRA ABSOLUTA: nesta fase o Crawler é 100% simulado. Quando a
   leitura real de páginas públicas chegar, implementa-se OUTRO Crawler
   com a MESMA interface — parser, snapshots, comparador e eventos
   não mudam uma linha. */
'use strict';

/* ---------- Crawler: a interface que o mundo real implementará ---------- */
class Crawler {
  /* fetch(ref) → payload cru { raw, fetchedAt } */
  async fetch() { throw new Error('Crawler.fetch não implementado'); }
}

/* Crawler simulado: gera páginas determinísticas que evoluem com o tempo */
class SimulatedCrawler extends Crawler {
  constructor({ seed = 7 } = {}) {
    super();
    this.seed = seed;
    this.calls = 0;
    this.scenario = new Map(); // ref → mutações injetadas (para testes/demo)
  }
  inject(ref, mutation) { this.scenario.set(ref, { ...(this.scenario.get(ref) || {}), ...mutation }); }
  async fetch(ref, { cycle = 0 } = {}) {
    this.calls++;
    const h = hash(`${this.seed}:${ref}`);
    const drift = Math.sin((cycle + h % 10) / 3) * 0.02;
    const m = this.scenario.get(ref) || {};
    /* "página" crua — como se tivesse sido extraída de HTML público */
    const raw = {
      url: `sim://marketplace/${ref}`,
      titulo: m.title || `Anúncio ${ref}`,
      preco_str: `R$ ${(m.price ?? Math.round((80 + (h % 200)) * (1 + drift))).toFixed(2).replace('.', ',')}`,
      nota_str: `${(m.rating ?? (3.9 + (h % 10) / 10)).toFixed(1)} de 5`,
      posicao: m.ranking ?? 1 + ((h + cycle) % 20),
      criativo: m.creative || (h % 2 ? 'fundo branco' : 'foto ambientada'),
      avaliacoes: m.reviews || [
        { estrelas: 5, texto: 'chegou rápido e bem embalado' },
        { estrelas: 4, texto: 'bonito, igual à foto' },
      ],
      perguntas: m.questions || [{ texto: 'qual o prazo para SP?' }],
    };
    return { raw, fetchedAt: Date.now() };
  }
}

/* ---------- Parser: página crua → registro normalizado ---------- */
function parseListing(payload) {
  const r = payload.raw;
  return {
    title: r.titulo,
    price: Number(String(r.preco_str).replace(/[^\d,]/g, '').replace(',', '.')),
    rating: Number(String(r.nota_str).split(' ')[0]),
    ranking: r.posicao,
    creative: r.criativo,
    reviews: (r.avaliacoes || []).map(a => ({ stars: a.estrelas, text: a.texto })),
    questions: (r.perguntas || []).map(q => ({ text: q.texto })),
  };
}

/* ---------- Cache com TTL (não bater duas vezes na mesma página por ciclo) ---------- */
class TtlCache {
  constructor(ttlMs = 60_000) { this.ttl = ttlMs; this.map = new Map(); this.hits = 0; this.misses = 0; }
  get(key) {
    const e = this.map.get(key);
    if (e && Date.now() - e.at < this.ttl) { this.hits++; return e.value; }
    this.misses++; return null;
  }
  set(key, value) { this.map.set(key, { value, at: Date.now() }); }
}

/* ---------- Comparador: snapshot novo × anterior → mudanças relevantes ---------- */
function compareSnapshots(prev, next) {
  if (!prev) return [];
  const changes = [];
  if (prev.price && next.price && Math.abs(next.price - prev.price) / prev.price >= 0.05)
    changes.push({ kind: next.price < prev.price ? 'price_cut' : 'price_raise',
      from: prev.price, to: next.price,
      pct: Math.round(((next.price - prev.price) / prev.price) * 100) });
  if (prev.creative && next.creative !== prev.creative)
    changes.push({ kind: 'creative_change', from: prev.creative, to: next.creative });
  if (prev.rating && next.rating < prev.rating - 0.15)
    changes.push({ kind: 'rating_drop', from: prev.rating, to: next.rating });
  if (prev.ranking && Math.abs(next.ranking - prev.ranking) >= 3)
    changes.push({ kind: 'ranking_shift', from: prev.ranking, to: next.ranking });
  return changes;
}

/* ---------- Collector: orquestra tudo ---------- */
const CADENCE = [
  { task: 'competitors', every: 1 },  // preços/criativos: todo ciclo
  { task: 'reviews', every: 2 },      // avaliações: ciclo sim, ciclo não
  { task: 'ranking', every: 1 },
  { task: 'trends', every: 7 },       // tendências: semanal
];

class Collector {
  constructor({ repos, bus, queue, crawler = null, cacheTtlMs = 60_000, logger = null }) {
    this.r = repos; this.bus = bus; this.queue = queue;
    this.crawler = crawler || new SimulatedCrawler();
    this.cache = new TtlCache(cacheTtlMs);
    this.log = logger;
    this.cycle = 0;
    this.lastByRef = new Map(); // ref → último snapshot normalizado
    this.queue.process(async job => this._collect(job.data));
  }

  /* Scheduler do collector: um tick = um ciclo de vigília */
  tick(targets) {
    this.cycle++;
    const planned = [];
    for (const c of CADENCE) {
      if (this.cycle % c.every !== 0) continue;
      for (const t of targets) {
        this.queue.enqueue('collect', { ref: t.ref, competitorId: t.competitorId, task: c.task, cycle: this.cycle });
        planned.push(`${c.task}:${t.ref}`);
      }
    }
    this.bus.emit('collector.cycle', { cycle: this.cycle, planned: planned.length });
    return planned;
  }

  async _collect({ ref, competitorId, task, cycle }) {
    /* cache single-flight: a mesma página não é buscada duas vezes no
       mesmo ciclo — nem por jobs CONCORRENTES (cacheia-se a promise) */
    const cacheKey = `${ref}:${cycle}`;
    let payloadPromise = this.cache.get(cacheKey);
    if (!payloadPromise) {
      payloadPromise = this.crawler.fetch(ref, { cycle });
      this.cache.set(cacheKey, payloadPromise);
    }
    const parsed = parseListing(await payloadPromise);

    /* snapshot persistido (histórico completo no banco) */
    if (competitorId) {
      this.r.competitorSnapshot.insert({
        competitor_id: competitorId, day: cycle,
        price: parsed.price, rating: parsed.rating, ranking: parsed.ranking,
        creative: parsed.creative, data_json: { task, reviews: parsed.reviews.length },
      });
    }
    this.bus.emit('collector.snapshot_taken', { ref, task, cycle, price: parsed.price });

    /* comparador: o que mudou desde a última leitura? */
    const changes = compareSnapshots(this.lastByRef.get(ref), parsed);
    this.lastByRef.set(ref, parsed);
    for (const change of changes)
      this.bus.emit('collector.change_detected', { ref, competitorId, cycle, ...change });
    return { parsed, changes };
  }

  historyOf(competitorId) {
    return this.r.competitorSnapshot.db.all(
      'SELECT * FROM competitor_snapshot WHERE competitor_id = ? ORDER BY day', competitorId);
  }
  stats() {
    return { cycle: this.cycle, crawlerCalls: this.crawler.calls ?? null,
             cache: { hits: this.cache.hits, misses: this.cache.misses },
             queue: { processed: this.queue.processed, dead: this.queue.deadLetter.length } };
  }
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

module.exports = { Collector, Crawler, SimulatedCrawler, parseListing, compareSnapshots, TtlCache, CADENCE };

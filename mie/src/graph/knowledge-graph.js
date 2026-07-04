/* KNOWLEDGE GRAPH (Sprint 07) — o cérebro associativo do Head.
   Camada Cognitiva (MIE). NÃO é uma tela: o usuário nunca vê o grafo.
   Ele faz o Head deixar de pensar em eventos isolados e passar a pensar
   em RELAÇÕES, PADRÕES e MEMÓRIA CONTEXTUAL.

   Propriedades:
   - nós e arestas TIPADOS, dirigidos e PONDERADOS;
   - arestas DECAEM com o desuso (relações antigas perdem peso) e são
     REFORÇADAS quando reaproveitadas ou confirmadas (Art. 16-18);
   - consultas internas respondem "o que já funcionou aqui?" antes de o
     Head recomendar qualquer ação nova (reuso de aprendizado).

   Determinístico, zero dependências, roda em Node e no navegador. */
(function (NS) {
'use strict';

/* ---- vocabulário do grafo (nós e relações do MOS) ---- */
const NODE = {
  Product: 'Product', Listing: 'Listing', Marketplace: 'Marketplace',
  Competitor: 'Competitor', Keyword: 'Keyword', Trend: 'Trend',
  Review: 'Review', Question: 'Question', Objection: 'Objection',
  Experiment: 'Experiment', Decision: 'Decision', Mission: 'Mission',
  Learning: 'Learning', Strategy: 'Strategy', Creative: 'Creative',
  PriceChange: 'PriceChange', RankingChange: 'RankingChange', Category: 'Category',
};
const EDGE = {
  PRODUCT_HAS_LISTING: 'PRODUCT_HAS_LISTING',
  PRODUCT_IN_CATEGORY: 'PRODUCT_IN_CATEGORY',
  LISTING_USES_KEYWORD: 'LISTING_USES_KEYWORD',
  KEYWORD_AFFECTED_RANKING: 'KEYWORD_AFFECTED_RANKING',
  COMPETITOR_AFFECTED_PRODUCT: 'COMPETITOR_AFFECTED_PRODUCT',
  REVIEW_REVEALED_OBJECTION: 'REVIEW_REVEALED_OBJECTION',
  OBJECTION_GENERATED_ACTION: 'OBJECTION_GENERATED_ACTION',
  DECISION_CREATED_EXPERIMENT: 'DECISION_CREATED_EXPERIMENT',
  EXPERIMENT_GENERATED_LEARNING: 'EXPERIMENT_GENERATED_LEARNING',
  STRATEGY_WORKED_FOR_CATEGORY: 'STRATEGY_WORKED_FOR_CATEGORY',
  CREATIVE_IMPROVED_CTR: 'CREATIVE_IMPROVED_CTR',
  PRICE_CHANGE_AFFECTED_CONVERSION: 'PRICE_CHANGE_AFFECTED_CONVERSION',
  LEARNING_REUSED_IN_DECISION: 'LEARNING_REUSED_IN_DECISION',
};

const nid = (type, key) => `${type}:${key}`;

class KnowledgeGraph {
  constructor({ decayPerDay = 0.03, floor = 0.12, reinforce = 0.6, cap = 3, clock = null } = {}) {
    this.nodes = new Map();          // id → { id, type, key, label, props, createdDay, lastDay }
    this.edges = new Map();          // `${type}|${from}|${to}` → aresta
    this.decayPerDay = decayPerDay;  // fração perdida por dia de desuso
    this.floor = floor;              // abaixo disso a relação é "esquecida" nas consultas
    this.reinforceStep = reinforce;
    this.cap = cap;
    this.clock = clock || (() => NS._currentDay || 0);
  }

  /* ---------- nós ---------- */
  upsertNode(type, key, props = {}, label = null) {
    const id = nid(type, key);
    const day = this.clock();
    const existing = this.nodes.get(id);
    if (existing) { Object.assign(existing.props, props); existing.lastDay = day; return existing; }
    const node = { id, type, key, label: label || String(key), props, createdDay: day, lastDay: day };
    this.nodes.set(id, node);
    return node;
  }
  node(id) { return this.nodes.get(id) || null; }
  nodesOfType(type) { return [...this.nodes.values()].filter(n => n.type === type); }

  /* ---------- arestas (com reforço) ---------- */
  link(type, fromId, toId, { weight = 1, evidence = null, outcome = null } = {}) {
    const day = this.clock();
    const key = `${type}|${fromId}|${toId}`;
    const e = this.edges.get(key);
    if (e) {
      e.weight = Math.min(this.cap, e.weight + this.reinforceStep);
      e.confirmations += 1; e.lastSeenDay = day;
      if (outcome) e.outcome = outcome;
      if (evidence) e.evidence.push(evidence);
      return e;
    }
    const edge = { id: key, type, from: fromId, to: toId, weight, outcome,
                   evidence: evidence ? [evidence] : [], createdDay: day, lastSeenDay: day, confirmations: 1 };
    this.edges.set(key, edge);
    return edge;
  }
  /* enfraquece uma relação que se mostrou falsa/inútil (aprendizado negativo) */
  weaken(type, fromId, toId, factor = 0.5) {
    const e = this.edges.get(`${type}|${fromId}|${toId}`);
    if (e) e.weight *= factor;
    return e;
  }

  /* peso EFETIVO no dia consultado: decai com o desuso (Art. 18) */
  effectiveWeight(edge, day = this.clock()) {
    const age = Math.max(0, day - edge.lastSeenDay);
    return edge.weight * Math.pow(1 - this.decayPerDay, age);
  }
  /* relação "viva" = peso efetivo acima do piso do esquecimento */
  isLive(edge, day = this.clock()) { return this.effectiveWeight(edge, day) >= this.floor; }

  edgesFrom(fromId, type = null) {
    return [...this.edges.values()].filter(e => e.from === fromId && (!type || e.type === type));
  }
  edgesTo(toId, type = null) {
    return [...this.edges.values()].filter(e => e.to === toId && (!type || e.type === type));
  }

  /* ---------- consultas internas (o cérebro associativo) ---------- */

  /* O que já funcionou para este produto? (aprendizados/estratégias vivos) */
  whatWorkedForProduct(productId, day = this.clock()) {
    const pid = nid(NODE.Product, productId);
    const cat = this._categoryOf(pid);
    const out = [];
    // estratégias que funcionaram na categoria do produto
    if (cat)
      for (const e of this.edgesTo(cat.id, EDGE.STRATEGY_WORKED_FOR_CATEGORY))
        if (e.outcome !== 'negative' && this.isLive(e, day))
          out.push({ node: this.node(e.from), weight: this.effectiveWeight(e, day), via: 'categoria' });
    // aprendizados diretamente ligados a experimentos deste produto
    for (const e of this.edgesFrom(pid))
      if (e.type === EDGE.LEARNING_REUSED_IN_DECISION && this.isLive(e, day))
        out.push({ node: this.node(e.to), weight: this.effectiveWeight(e, day), via: 'reuso anterior' });
    return this._rank(out);
  }

  /* O que já funcionou para esta categoria? */
  whatWorkedForCategory(category, day = this.clock()) {
    const cat = nid(NODE.Category, category);
    return this._rank(this.edgesTo(cat, EDGE.STRATEGY_WORKED_FOR_CATEGORY)
      .filter(e => e.outcome !== 'negative' && this.isLive(e, day))
      .map(e => ({ node: this.node(e.from), weight: this.effectiveWeight(e, day) })));
  }

  /* Quais concorrentes mais impactaram este anúncio/produto? */
  competitorsImpacting(productId, day = this.clock()) {
    const pid = nid(NODE.Product, productId);
    return this._rank(this.edgesTo(pid, EDGE.COMPETITOR_AFFECTED_PRODUCT)
      .filter(e => this.isLive(e, day))
      .map(e => ({ node: this.node(e.from), weight: this.effectiveWeight(e, day), confirmations: e.confirmations }))
      .filter(x => x.node && x.node.type === NODE.Competitor)); // só concorrentes, não mudanças de preço
  }

  /* Quais palavras-chave melhoraram ranking? */
  keywordsImprovedRanking(day = this.clock()) {
    return this._rank([...this.edges.values()]
      .filter(e => e.type === EDGE.KEYWORD_AFFECTED_RANKING && e.outcome === 'positive' && this.isLive(e, day))
      .map(e => ({ node: this.node(e.from), weight: this.effectiveWeight(e, day) })));
  }

  /* Quais ações pioraram conversão? */
  actionsHurtConversion(day = this.clock()) {
    return this._rank([...this.edges.values()]
      .filter(e => e.type === EDGE.PRICE_CHANGE_AFFECTED_CONVERSION && e.outcome === 'negative' && this.isLive(e, day))
      .map(e => ({ node: this.node(e.from), weight: this.effectiveWeight(e, day) })));
  }

  /* Quais objeções mais aparecem nas avaliações (deste produto ou geral)? */
  topObjections(productId = null, day = this.clock()) {
    const objs = new Map();
    for (const e of this.edges.values()) {
      if (e.type !== EDGE.REVIEW_REVEALED_OBJECTION || !this.isLive(e, day)) continue;
      if (productId) {
        const rev = this.node(e.from);
        if (!rev || rev.props.productId !== productId) continue;
      }
      const o = objs.get(e.to) || { node: this.node(e.to), weight: 0, count: 0 };
      o.weight += this.effectiveWeight(e, day); o.count += 1;
      objs.set(e.to, o);
    }
    return this._rank([...objs.values()]);
  }

  /* Quais aprendizados podem ser reaproveitados AGORA para este produto?
     (whatWorkedForProduct já devolve itens achatados com .type/.id/.label) */
  reusableLearnings(productId, day = this.clock()) {
    return this.whatWorkedForProduct(productId, day)
      .filter(w => w.type === NODE.Strategy || w.type === NODE.Learning);
  }

  /* ---------- utilidades ---------- */
  _categoryOf(productNodeId) {
    const e = this.edgesFrom(productNodeId, EDGE.PRODUCT_IN_CATEGORY)[0];
    return e ? this.node(e.to) : null;
  }
  _rank(list) {
    return list.filter(x => x.node).sort((a, b) => b.weight - a.weight)
      .map(x => ({ id: x.node.id, type: x.node.type, label: x.node.label, weight: Math.round(x.weight * 100) / 100, ...('via' in x ? { via: x.via } : {}), ...('count' in x ? { count: x.count } : {}) }));
  }

  stats(day = this.clock()) {
    const live = [...this.edges.values()].filter(e => this.isLive(e, day)).length;
    const byType = {};
    for (const e of this.edges.values()) byType[e.type] = (byType[e.type] || 0) + 1;
    return { nodes: this.nodes.size, edges: this.edges.size, liveEdges: live, byType };
  }
}

NS.KnowledgeGraph = KnowledgeGraph;
NS.GRAPH = { NODE, EDGE, nid };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

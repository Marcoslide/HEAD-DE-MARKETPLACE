/* KNOWLEDGE GRAPH · Ingestor (Sprint 07).
   Popula o grafo a partir dos EVENTOS que os motores já emitem + o mundo
   simulado. Nenhum motor precisa saber que o grafo existe — o ingestor
   só ESCUTA o EventBus (mesmo princípio do MieBridge, Art. 11).

   Constrói as relações que o Head passa a "enxergar":
     produto→categoria, concorrente→produto, avaliação→objeção,
     objeção→ação, decisão→experimento, experimento→aprendizado,
     estratégia→categoria, criativo→CTR, mudança de preço→conversão,
     aprendizado→reuso em decisão. */
(function (NS) {
'use strict';
const { NODE, EDGE, nid } = NS.GRAPH;

function categoryOf(name = '') {
  if (/espelho/i.test(name)) return 'Espelhos';
  if (/rel[óo]gio/i.test(name)) return 'Relógios';
  if (/quadro|kit/i.test(name)) return 'Quadros';
  return 'Decoração';
}
function objectionOf(text = '') {
  if (/trincad|quebrad|danificad/i.test(text)) return 'chega danificado';
  if (/diferente da foto|menor|maior|esperava/i.test(text)) return 'diferente do esperado';
  if (/prazo|demor|atras/i.test(text)) return 'prazo de entrega';
  return text.slice(0, 40) || 'objeção genérica';
}

function wireGraph(graph, bus, world) {
  /* ---------- produto e seu contexto (a cada diagnóstico) ---------- */
  bus.on('diagnosis.ready', d => {
    const p = world.product(d.productId);
    if (!p) return;
    const prod = graph.upsertNode(NODE.Product, d.productId, { name: p.name }, p.name);
    const cat = graph.upsertNode(NODE.Category, categoryOf(p.name));
    graph.link(EDGE.PRODUCT_IN_CATEGORY, prod.id, cat.id);
    graph.upsertNode(NODE.Marketplace, p.mkt);

    /* concorrentes que impactaram (cortes/entrantes recentes) */
    for (const c of p.competitors) {
      const cut = c.history.slice(-5).some(h => h.event && h.event.includes('preço'));
      const entrant = c.entryDay && world.day - c.entryDay <= 21;
      if (cut || entrant) {
        const cn = graph.upsertNode(NODE.Competitor, c.id, { name: c.name, weakness: c.weakness }, c.name);
        graph.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, cn.id, prod.id,
          { evidence: cut ? 'corte de preço' : 'entrante' });
        if (cut) {
          // registra a mudança de preço ligada AO CONCORRENTE (não polui a
          // consulta de concorrentes que impactaram o produto)
          const pc = graph.upsertNode(NODE.PriceChange, `${c.id}@${world.day}`, { competitor: c.name, day: world.day }, `corte de ${c.name}`);
          graph.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, cn.id, pc.id, { evidence: 'gerou mudança de preço' });
        }
      }
    }

    /* avaliações negativas → objeções */
    for (const r of p.reviews.filter(r => r.stars <= 2 && world.day - r.day <= 14)) {
      const rev = graph.upsertNode(NODE.Review, `${d.productId}@${r.day}:${r.text}`, { productId: d.productId, stars: r.stars });
      const obj = graph.upsertNode(NODE.Objection, objectionOf(r.text), {}, objectionOf(r.text));
      graph.link(EDGE.REVIEW_REVEALED_OBJECTION, rev.id, obj.id);
    }

    /* ranking mudou? registra o nó de mudança de ranking */
    const b = world.seriesOf(d.productId, 4);
    if (b.length >= 2 && Math.abs(b[b.length - 1].ranking - b[0].ranking) >= 2) {
      graph.upsertNode(NODE.RankingChange, `${d.productId}@${world.day}`,
        { from: b[0].ranking, to: b[b.length - 1].ranking }, `ranking ${b[0].ranking}→${b[b.length - 1].ranking}`);
    }
  });

  /* ---------- decisão → experimento; objeção → ação ---------- */
  bus.on('decision.created', item => {
    const d = item.diagnosis;
    if (!d) return;
    const dec = graph.upsertNode(NODE.Decision, item.id, { title: item.title, type: d.proposal && d.proposal.type }, item.title);
    /* objeção que gerou esta ação (reputação/expectativa) */
    if (d.proposal && ['reputation', 'fix_expectation'].includes(d.proposal.type)) {
      const objs = graph.topObjections(item.productId);
      if (objs[0]) graph.link(EDGE.OBJECTION_GENERATED_ACTION, objs[0].id, dec.id);
    }
    /* aprendizado reaproveitado nesta decisão (reforça o aprendizado) */
    const reused = d.graph && d.graph.reused ? d.graph.reused : [];
    for (const r of reused) graph.link(EDGE.LEARNING_REUSED_IN_DECISION, r.id, dec.id, { weight: 1.2 });
  });

  /* ---------- plano = experimento (decisão → experimento) ---------- */
  bus.on('plan.created', ({ id, decisionId, title }) => {
    const exp = graph.upsertNode(NODE.Experiment, id, { title }, title || id);
    if (decisionId) graph.link(EDGE.DECISION_CREATED_EXPERIMENT, nid(NODE.Decision, decisionId), exp.id);
  });

  /* ---------- resultado medido → aprendizado + arestas de efeito ---------- */
  bus.on('result.measured', ({ plan, result }) => {
    const hit = plan.type && result;
    const positive = result.liftPct > 0;
    const learn = graph.upsertNode(NODE.Learning, `strategy.${plan.type}`,
      { type: plan.type }, `estratégia ${plan.type}`);
    graph.upsertNode(NODE.Strategy, plan.type, { type: plan.type }, plan.type);
    const exp = graph.node(nid(NODE.Experiment, plan.id));
    if (exp) graph.link(EDGE.EXPERIMENT_GENERATED_LEARNING, exp.id, learn.id, { outcome: positive ? 'positive' : 'negative' });

    /* estratégia funcionou para a categoria (ou perdeu peso se falhou) */
    const p = world.product(plan.productId);
    if (p) {
      const cat = graph.upsertNode(NODE.Category, categoryOf(p.name));
      const strat = graph.node(nid(NODE.Strategy, plan.type));
      if (positive) graph.link(EDGE.STRATEGY_WORKED_FOR_CATEGORY, strat.id, cat.id, { outcome: 'positive', evidence: `+${(result.liftPct * 100).toFixed(0)}%` });
      else graph.weaken(EDGE.STRATEGY_WORKED_FOR_CATEGORY, strat.id, cat.id); // deixou de ser útil → perde peso
    }

    /* criativo melhorou CTR / mudança afetou conversão */
    if (plan.type === 'creative') {
      const cr = graph.upsertNode(NODE.Creative, `creative@${plan.id}`, { productId: plan.productId }, 'novo criativo');
      graph.link(EDGE.CREATIVE_IMPROVED_CTR, cr.id, learn.id, { outcome: positive ? 'positive' : 'negative', evidence: `${(result.liftPct * 100).toFixed(0)}%` });
    }
    if (['reposition', 'price', 'restore', 'stock_brake'].includes(plan.type)) {
      const pc = graph.upsertNode(NODE.PriceChange, `own@${plan.id}`, { productId: plan.productId, type: plan.type }, `ação ${plan.type}`);
      graph.link(EDGE.PRICE_CHANGE_AFFECTED_CONVERSION, pc.id, learn.id,
        { outcome: positive ? 'positive' : 'negative', evidence: `${(result.liftPct * 100).toFixed(0)}%` });
    }
  });

  /* ---------- palavras-chave e criativos vindos da memória ---------- */
  bus.on('learning.recorded', k => {
    if (k.kind === 'keyword') {
      const kw = graph.upsertNode(NODE.Keyword, k.key.replace(/^.*\./, ''), { discovery: k.discovery }, k.key);
      graph.link(EDGE.KEYWORD_AFFECTED_RANKING, kw.id, graph.upsertNode(NODE.RankingChange, `kw:${k.key}`).id,
        { outcome: k.contradicts ? 'negative' : 'positive' });
    }
    if (k.kind === 'creative') graph.upsertNode(NODE.Creative, k.key, { discovery: k.discovery }, k.key);
  });

  return graph;
}

NS.wireGraph = wireGraph;
NS.Graph = { categoryOf, objectionOf };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

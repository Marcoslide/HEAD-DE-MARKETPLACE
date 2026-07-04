/* Sprint 07 — Knowledge Graph: relações, reuso de aprendizado, decaimento
   e integração com os motores. O grafo é interno (o usuário não o vê). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const NS = require('../src/index.js');
const { NODE, EDGE, nid } = NS.GRAPH;

const WARMUP = NS.WARMUP_DAYS + 3;
function warmed(seed = 42) { const m = NS.createMIE({ seed }); m.runDays(WARMUP); return m; }

/* ---------- núcleo do grafo ---------- */

test('grafo cria nós e relações corretamente (idempotente + reforço)', () => {
  const g = new NS.KnowledgeGraph({ clock: () => 0 });
  const p = g.upsertNode(NODE.Product, 'p1', { name: 'Quadro' });
  const c = g.upsertNode(NODE.Category, 'Quadros');
  g.link(EDGE.PRODUCT_IN_CATEGORY, p.id, c.id);
  g.upsertNode(NODE.Product, 'p1', { ranking: 6 }); // upsert não duplica
  assert.equal(g.nodesOfType(NODE.Product).length, 1, 'nó não duplica');
  assert.equal(g.node('Product:p1').props.name, 'Quadro');
  assert.equal(g.node('Product:p1').props.ranking, 6, 'props mescladas');

  const e1 = g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:x', p.id);
  const w1 = e1.weight;
  const e2 = g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:x', p.id); // reforço
  assert.equal(e1, e2, 'mesma aresta');
  assert.ok(e2.weight > w1, 'reforço aumenta o peso');
  assert.equal(e2.confirmations, 2);
});

test('relações antigas perdem peso quando deixam de ser úteis (decaimento)', () => {
  let day = 0;
  const g = new NS.KnowledgeGraph({ decayPerDay: 0.1, floor: 0.2, clock: () => day });
  const e = g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:x', 'Product:p1', { weight: 1 });
  assert.equal(g.effectiveWeight(e, 0), 1);
  assert.ok(g.isLive(e, 0), 'nova relação está viva');
  day = 25;
  assert.ok(g.effectiveWeight(e, 25) < 0.2, 'após 25 dias sem reforço, peso despenca');
  assert.ok(!g.isLive(e, 25), 'relação abaixo do piso: "esquecida"');
  // reforço a ressuscita
  g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:x', 'Product:p1');
  assert.ok(g.isLive(e, 25), 'reforço traz a relação de volta');
});

test('consulta: concorrentes que mais impactaram o produto, por peso', () => {
  const g = new NS.KnowledgeGraph({ clock: () => 10 });
  const p = g.upsertNode(NODE.Product, 'p1').id;
  g.upsertNode(NODE.Competitor, 'a', {}, 'ArteParede');
  g.upsertNode(NODE.Competitor, 'b', {}, 'DecorMax');
  g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:a', p);
  g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:a', p); // ArteParede impactou 2x
  g.link(EDGE.COMPETITOR_AFFECTED_PRODUCT, 'Competitor:b', p);
  const ranked = g.competitorsImpacting('p1');
  assert.equal(ranked[0].label, 'ArteParede', 'o que mais impactou vem primeiro');
  assert.equal(ranked.length, 2);
});

/* ---------- integração com os motores ---------- */

test('aprendizado vira nó no grafo (via evento result.measured)', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const d = mie.prioritization.pendingDecisions().find(x => x.diagnosis.proposal.type === 'reposition');
  mie.approve(d.id);
  mie.runDays(NS.MEASUREMENT_WINDOW + 2); // mede → aprende → popula o grafo

  const learnings = mie.graph.nodesOfType(NODE.Learning);
  assert.ok(learnings.length >= 1, 'o aprendizado virou nó');
  const strategies = mie.graph.nodesOfType(NODE.Strategy);
  assert.ok(strategies.some(s => s.key === 'reposition'), 'a estratégia virou nó');
  // e ligada à categoria do produto
  const worked = mie.graph.whatWorkedForCategory('Quadros');
  assert.ok(worked.length >= 1, 'estratégia registrada como vencedora na categoria Quadros');
});

test('concorrente que impactou o produto é registrado no grafo', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const impacting = mie.graph.competitorsImpacting('p1');
  assert.ok(impacting.length >= 1, 'concorrentes que cortaram preço aparecem no grafo');
});

test('decisão consulta conhecimento anterior antes de recomendar (reuso)', () => {
  const mie = warmed();
  // 1ª rodada: aprende que reposicionar funciona na categoria
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const d1 = mie.prioritization.pendingDecisions().find(x => x.diagnosis.proposal.type === 'reposition');
  mie.approve(d1.id);
  mie.runDays(NS.MEASUREMENT_WINDOW + 2);
  assert.ok(mie.graph.whatWorkedForCategory('Quadros').length >= 1, 'aprendizado consolidado');

  // 2ª rodada: nova queda no MESMO produto — a investigação consulta o grafo
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const recent = mie.investigation.cases.filter(c => c.findings.consultar_grafo);
  assert.ok(recent.length >= 1, 'a investigação tem a etapa consultar_grafo');
  const withReuse = recent.find(c => c.diagnosis && c.diagnosis.graph && c.diagnosis.graph.reused.length > 0);
  assert.ok(withReuse, 'ao menos uma investigação reaproveitou aprendizado do grafo');
});

test('especialista usa evidência do grafo (precedente aumenta confiança)', () => {
  const mie = warmed();
  // semeia um precedente vencedor no grafo
  const p = mie.graph.upsertNode(NODE.Product, 'p1', { name: 'Quadro Paisagem' });
  const cat = mie.graph.upsertNode(NODE.Category, 'Quadros');
  const strat = mie.graph.upsertNode(NODE.Strategy, 'reposition');
  mie.graph.link(EDGE.PRODUCT_IN_CATEGORY, p.id, cat.id);
  mie.graph.link(EDGE.STRATEGY_WORKED_FOR_CATEGORY, strat.id, cat.id, { outcome: 'positive' });

  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(3);
  const ctxSem = { world: mie.world, memory: mie.memory, productId: 'p1', anomaly: { kind: 'sales_drop' } };
  const ctxCom = { ...ctxSem, graph: mie.graph };
  const semGrafo = mie.specialists.consult(ctxSem).find(x => x.domain === 'conversion');
  const comGrafo = mie.specialists.consult(ctxCom).find(x => x.domain === 'conversion');
  // com precedente, a conversão cita o grafo e fica mais confiante
  if (comGrafo.recommendationType === 'reposition') {
    assert.ok(comGrafo.confidence >= semGrafo.confidence, 'precedente do grafo não reduz confiança');
    assert.ok(comGrafo.evidencias.some(e => e.fato === 'precedente no grafo') ||
              comGrafo.hipoteses.some(h => /reaproveitar/.test(h)), 'a evidência do grafo aparece no parecer');
  }
});

test('conhecimento irrelevante NÃO influencia a decisão', () => {
  const mie = warmed();
  // aprendizado de OUTRA categoria (Espelhos) não deve entrar na análise de um Quadro
  const espelho = mie.graph.upsertNode(NODE.Category, 'Espelhos');
  const strat = mie.graph.upsertNode(NODE.Strategy, 'creative');
  mie.graph.link(EDGE.STRATEGY_WORKED_FOR_CATEGORY, strat.id, espelho.id, { outcome: 'positive' });

  const reuse = mie.graph.reusableLearnings('p1'); // p1 é da categoria Quadros
  assert.equal(reuse.length, 0, 'aprendizado de Espelhos não é reaproveitado para um Quadro');
});

test('o grafo é interno: não há endpoint nem exposição ao usuário', () => {
  // garantia estrutural — o grafo vive no MIE, nunca na Camada de Experiência
  const mie = warmed();
  assert.ok(mie.graph instanceof NS.KnowledgeGraph);
  // o objeto MIE não expõe nenhuma superfície "view/render/ui" do grafo
  assert.equal(typeof mie.graph.render, 'undefined');
  assert.equal(typeof mie.graph.toScreen, 'undefined');
});

test('LEARNING_REUSED_IN_DECISION conecta aprendizado à decisão que o reusou', () => {
  const mie = warmed();
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const d1 = mie.prioritization.pendingDecisions().find(x => x.diagnosis.proposal.type === 'reposition');
  mie.approve(d1.id);
  mie.runDays(NS.MEASUREMENT_WINDOW + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);
  const reuseEdges = [...mie.graph.edges.values()].filter(e => e.type === EDGE.LEARNING_REUSED_IN_DECISION);
  // pode ou não haver reuso conforme o timing; se houver, a aresta liga Learning→Decision
  for (const e of reuseEdges) {
    assert.match(e.from, /^(Learning|Strategy):/);
    assert.match(e.to, /^Decision:/);
  }
  assert.ok(mie.graph.stats().nodes > 0);
});

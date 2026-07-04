/* Bloco 09 — Marketplace Collector: crawler simulado, parser, cache,
   snapshots, comparador, cadências e histórico. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { Collector, SimulatedCrawler, parseListing, compareSnapshots } = require('../src/collector/index.js');

function setup() {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'c@d.e', companyName: 'C' });
  const product = mos.services.catalog.createProduct(company.id, { name: 'Quadro' });
  const competitor = mos.repos.competitor.insert({
    product_id: product.id, name: 'ArteParede', external_ref: 'arteparede-60x90', weakness: 'embalagem' });
  const collector = new Collector({
    repos: mos.repos, bus: mos.bus, queue: mos.queues.collector, logger: mos.logger });
  return { mos, competitor, collector,
    targets: [{ ref: 'arteparede-60x90', competitorId: competitor.id }] };
}

test('parser: página crua vira registro normalizado', () => {
  const parsed = parseListing({ raw: {
    titulo: 'Quadro X', preco_str: 'R$ 1.234,56', nota_str: '4.7 de 5',
    posicao: 3, criativo: 'vídeo',
    avaliacoes: [{ estrelas: 1, texto: 'chegou trincado' }],
    perguntas: [{ texto: 'tem 90x60?' }] } });
  assert.equal(parsed.price, 1234.56);
  assert.equal(parsed.rating, 4.7);
  assert.equal(parsed.creative, 'vídeo');
  assert.equal(parsed.reviews[0].stars, 1);
});

test('comparador: detecta corte de preço, troca de criativo e queda de nota', () => {
  const prev = { price: 100, creative: 'fundo branco', rating: 4.8, ranking: 5 };
  const next = { price: 88, creative: 'vídeo', rating: 4.5, ranking: 9 };
  const kinds = compareSnapshots(prev, next).map(c => c.kind);
  assert.deepEqual(kinds, ['price_cut', 'creative_change', 'rating_drop', 'ranking_shift']);
  assert.equal(compareSnapshots(null, next).length, 0, 'primeira leitura não gera mudança');
  assert.equal(compareSnapshots(prev, prev).length, 0, 'sem mudança = sem ruído');
});

test('coleta completa: snapshot persistido + histórico consultável', async () => {
  const { mos, collector, competitor, targets } = setup();
  collector.tick(targets);
  await mos.queues.collector.onIdle();

  const history = collector.historyOf(competitor.id);
  assert.ok(history.length >= 1, 'snapshot no banco');
  assert.ok(history[0].price > 0 && history[0].creative, 'campos normalizados');
  const events = mos.bus.ofType('collector.snapshot_taken');
  assert.ok(events.length >= 1, 'evento de snapshot publicado');
  mos.close();
});

test('cache: a mesma página não é buscada duas vezes no mesmo ciclo', async () => {
  const { mos, collector, targets } = setup();
  // dois alvos com a MESMA ref (ex.: mesmo anúncio vigiado por 2 produtos)
  const doubled = [...targets, { ref: targets[0].ref, competitorId: null }];
  collector.tick(doubled);
  await mos.queues.collector.onIdle();
  assert.equal(collector.crawler.calls, 1, 'crawler chamado 1x; jobs concorrentes usaram o cache (single-flight)');
  assert.ok(collector.cache.hits >= 1, 'demais leituras vieram do cache');
  mos.close();
});

test('comparador ao vivo: corte de preço injetado vira change_detected', async () => {
  const { mos, collector, targets } = setup();
  collector.tick(targets);
  await mos.queues.collector.onIdle();

  const before = collector.lastByRef.get(targets[0].ref).price;
  collector.crawler.inject(targets[0].ref, { price: Math.round(before * 0.85) });
  collector.tick(targets);
  await mos.queues.collector.onIdle();

  const changes = mos.bus.ofType('collector.change_detected').map(e => e.payload);
  const cut = changes.find(c => c.kind === 'price_cut');
  assert.ok(cut, 'corte de preço detectado');
  assert.ok(cut.pct <= -5, `magnitude registrada (${cut.pct}%)`);
  mos.close();
});

test('cadências: tendências rodam semanalmente, concorrentes todo ciclo', async () => {
  const { mos, collector, targets } = setup();
  let trendJobs = 0, competitorJobs = 0;
  for (let i = 1; i <= 7; i++) {
    const planned = collector.tick(targets);
    trendJobs += planned.filter(p => p.startsWith('trends')).length;
    competitorJobs += planned.filter(p => p.startsWith('competitors')).length;
  }
  await mos.queues.collector.onIdle();
  assert.equal(competitorJobs, 7, 'concorrentes: todo ciclo');
  assert.equal(trendJobs, 1, 'tendências: 1x por semana');
  assert.ok(collector.stats().queue.processed > 0);
  mos.close();
});

/* Blocos 02+03 — kernel, banco e casos de uso.
   Rodar: node --test mos/test/ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/kernel/event-bus.js');
const { Queue } = require('../src/kernel/queue.js');
const { createMOS } = require('../src/index.js');

/* ================= KERNEL ================= */

test('event bus: curingas, middleware de veto e histórico', () => {
  const bus = new EventBus();
  const got = [];
  bus.on('listing.*', (p, e) => got.push(e.type));
  bus.on('*', () => got.push('all'));
  bus.use(e => e.type === 'listing.secret' ? null : e);

  bus.emit('listing.created', {});
  bus.emit('listing.secret', {});   // vetado pelo middleware
  bus.emit('other.thing', {});

  assert.deepEqual(got, ['listing.created', 'all', 'all']);
  assert.equal(bus.ofType('listing.*').length, 1);
});

test('queue: concorrência limitada, retry com backoff e dead-letter', async () => {
  const q = new Queue('test', { concurrency: 2, maxAttempts: 3, backoffMs: 1 });
  let peak = 0, active = 0;
  const done = [];
  q.process(async job => {
    active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 2));
    active--;
    if (job.type === 'fail-forever') throw new Error('boom');
    if (job.type === 'flaky' && job.attempts < 2) throw new Error('flake');
    done.push(job.id);
  });
  for (let i = 0; i < 10; i++) q.enqueue('ok', { i });
  q.enqueue('flaky', {});
  q.enqueue('fail-forever', {});
  await q.onIdle();

  assert.ok(peak <= 2, `concorrência respeitada (pico ${peak})`);
  assert.equal(done.length, 11, '10 ok + 1 flaky recuperado');
  assert.equal(q.deadLetter.length, 1, 'falha permanente vai para dead-letter');
  assert.equal(q.deadLetter[0].job.attempts, 3, 'esgotou as tentativas antes');
});

/* ================= BANCO (Bloco 03) ================= */

test('banco: migração completa (23 núcleo + 10 Central S09 + 5 Compliance S10)', () => {
  const mos = createMOS();
  const tables = mos.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .map(r => r.name).sort();
  const expected = ['audit_log', 'company', 'competitor', 'competitor_snapshot', 'decision',
    'execution_plan', 'experiment', 'integration_event', 'investigation', 'keyword',
    'keyword_trend', 'learning', 'listing', 'listing_draft', 'listing_version',
    'marketplace_connection', 'marketplace_credential', 'marketplace_inventory',
    'marketplace_metric_snapshot', 'marketplace_order', 'marketplace_order_item',
    'marketplace_price', 'marketplace_product_profile', 'marketplace_sync_log',
    'marketplace_sync_state', 'memory', 'mission', 'opportunity', 'product',
    'product_asset', 'product_profile', 'public_research_evidence', 'publication_history',
    'question', 'raw_marketplace_payload', 'review', 'user', 'validation_run', 'workspace'];
  assert.deepEqual(tables, expected);
  mos.close();
});

test('banco: FKs com cascade — apagar a company leva o grafo junto', () => {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'a@b.c', companyName: 'C', marketplaces: ['shopee'] });
  const product = mos.services.catalog.createProduct(company.id, { name: 'Quadro' });
  mos.services.catalog.importListings(company.id, connections[0].id,
    [{ productId: product.id, title: 'Quadro Teste', price: 100 }]);

  mos.repos.company.delete(company.id);
  assert.equal(mos.repos.product.count(), 0, 'produtos apagados em cascata');
  assert.equal(mos.repos.listing.count(), 0, 'anúncios apagados em cascata');
  assert.equal(mos.repos.version.count(), 0, 'versões apagadas em cascata');
  mos.close();
});

test('banco: memória com upsert — repetição sobe força, contradição rebaixa (MIF 8.2)', () => {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({ workspaceName: 'W', email: 'x@y.z', companyName: 'C' });
  const e = { key: 'creative.ambientada', kind: 'creative', discovery: 'foto ambientada vence' };
  mos.repos.memory.upsert(company.id, e);
  mos.repos.memory.upsert(company.id, e);
  mos.repos.memory.upsert(company.id, e);
  let row = mos.db.get('SELECT * FROM memory WHERE key = ?', e.key);
  assert.equal(row.strength, 3, 'força máxima com repetição');
  mos.repos.memory.upsert(company.id, { ...e, contradicts: true });
  row = mos.db.get('SELECT * FROM memory WHERE key = ?', e.key);
  assert.equal(row.strength, 2, 'contradição rebaixa');
  assert.equal(row.needs_revalidation, 1, 'e dispara revalidação');
  mos.close();
});

/* ================= USE CASES + ESCALA (Bloco 02) ================= */

test('fluxo: decisão aprovada vira missão + plano com previsão (Fluxo 007, Art. 15)', () => {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({ workspaceName: 'W', email: 'm@a.br', companyName: 'C' });
  const d = mos.services.decision.create(company.id, {
    title: 'Reposicionar Quadro', discovery: 'Detectei queda de 18%…',
    proposal: { type: 'reposition', steps: ['novo título'] },
    impactMin: 800, impactMax: 1200, confidence: 'alta',
  });
  const { mission, plan } = mos.services.decision.approve(d.id);
  assert.equal(mission.status, 'active');
  assert.equal(mission.decision_id, d.id);
  const pred = JSON.parse(plan.prediction_json);
  assert.deepEqual(pred.impact, [800, 1200], 'previsão registrada ANTES no plano');
  // trilha de auditoria completa
  const audit = mos.repos.audit.byEntity('decision', d.id);
  assert.ok(audit.some(a => a.action === 'approve'));
  mos.close();
});

test('fluxo: recusa grava preferência na memória da empresa (Art. 18)', () => {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({ workspaceName: 'W', email: 'm@b.br', companyName: 'C' });
  const d = mos.services.decision.create(company.id, {
    title: 'Baixar preço', discovery: 'Concorrente…',
    proposal: { type: 'price_cut' },
  });
  mos.services.decision.refuse(d.id, 'margem apertada');
  const prefs = mos.repos.memory.byKind(company.id, 'preference');
  assert.equal(prefs.length, 1);
  assert.match(prefs[0].discovery, /margem apertada/);
  mos.close();
});

test('escala: importa 5.000 anúncios em transação e pagina por keyset', () => {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 's@t.u', companyName: 'Escala', marketplaces: ['mercado_livre'] });

  const items = Array.from({ length: 5000 }, (_, i) =>
    ({ title: `Anúncio ${i}`, price: 50 + (i % 200), ranking: (i % 30) + 1 }));
  const t0 = Date.now();
  const r = mos.services.catalog.importListings(company.id, connections[0].id, items);
  const ms = Date.now() - t0;
  assert.equal(r.count, 5000);
  assert.ok(ms < 15000, `importação em massa dentro do orçamento (${ms}ms)`);

  // paginação keyset estável
  let cursor = '', pages = 0, seen = 0;
  while (true) {
    const page = mos.services.catalog.listListings(company.id, { after: cursor, limit: 500 });
    if (!page.items.length) break;
    seen += page.items.length; cursor = page.nextCursor; pages++;
    if (pages > 20) break;
  }
  assert.equal(seen, 5000, 'todas as páginas percorridas sem repetição');
  mos.close();
});

test('versões: nova versão atualiza o anúncio; restauração é sempre possível', () => {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'v@w.x', companyName: 'C', marketplaces: ['shopee'] });
  const r = mos.services.catalog.importListings(company.id, connections[0].id,
    [{ title: 'Original', price: 100 }]);
  const listingId = r.ids[0];

  const v2 = mos.services.catalog.createVersion(listingId, { title: 'Título novo', price: 110, reason: 'teste' });
  assert.equal(v2.number, 2);
  assert.equal(mos.repos.listing.byId(listingId).title, 'Título novo');

  const v1 = mos.repos.version.byListing(listingId).find(v => v.number === 1);
  const restored = mos.services.catalog.restoreVersion(listingId, v1.id);
  assert.equal(restored.number, 3, 'restauração cria versão nova (histórico intacto)');
  assert.equal(mos.repos.listing.byId(listingId).title, 'Original');
  mos.close();
});

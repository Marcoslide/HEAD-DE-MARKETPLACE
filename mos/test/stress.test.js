/* Bloco 13 — stress, concorrência e escalabilidade.
   Complementa as suítes por módulo (sucesso/falha/regressão). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../src/kernel/event-bus.js');
const { Queue } = require('../src/kernel/queue.js');
const { createMOS } = require('../src/index.js');
const MIE = require('../../mie/src/index.js');

test('stress · bus: 10.000 eventos com 3 assinantes e ring buffer respeitado', () => {
  const bus = new EventBus({ historyLimit: 2000 });
  let a = 0, b = 0, c = 0;
  bus.on('*', () => a++);
  bus.on('listing.*', () => b++);
  bus.on('listing.created', () => c++);
  const t0 = Date.now();
  for (let i = 0; i < 10000; i++) bus.emit(i % 2 ? 'listing.created' : 'other.evt', { i });
  const ms = Date.now() - t0;
  assert.equal(a, 10000); assert.equal(b, 5000); assert.equal(c, 5000);
  assert.ok(bus.history.length <= 2000, 'ring buffer não cresce sem teto');
  assert.ok(ms < 2000, `10k eventos em ${ms}ms`);
});

test('concorrência · queue: 500 jobs, pico ≤ concorrência, flakes recuperados', async () => {
  const q = new Queue('stress', { concurrency: 16, maxAttempts: 3, backoffMs: 1 });
  let peak = 0, active = 0, done = 0;
  q.process(async job => {
    active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 1));
    active--;
    if (job.data.i % 50 === 0 && job.attempts < 2) throw new Error('flake');
    done++;
  });
  for (let i = 0; i < 500; i++) q.enqueue('job', { i });
  await q.onIdle();
  assert.equal(done, 500, 'todos os jobs processados (flakes recuperados)');
  assert.ok(peak <= 16, `pico de concorrência ${peak} ≤ 16`);
  assert.equal(q.deadLetter.length, 0);
});

test('escalabilidade · banco: 20.000 anúncios, paginação keyset O(página)', () => {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'x@e.sc', companyName: 'Big', marketplaces: ['shopee'] });
  const items = Array.from({ length: 20000 }, (_, i) => ({ title: `A${i}`, price: 10 + (i % 90) }));
  const t0 = Date.now();
  mos.services.catalog.importListings(company.id, connections[0].id, items);
  const importMs = Date.now() - t0;

  // páginas do início e do fim devem custar o MESMO (keyset, não OFFSET)
  const t1 = Date.now();
  const first = mos.services.catalog.listListings(company.id, { limit: 100 });
  const firstMs = Date.now() - t1;
  let cursor = '';
  for (let i = 0; i < 190; i++) cursor = mos.services.catalog.listListings(company.id, { after: cursor, limit: 100 }).nextCursor;
  const t2 = Date.now();
  mos.services.catalog.listListings(company.id, { after: cursor, limit: 100 });
  const lastMs = Date.now() - t2;

  assert.equal(first.items.length, 100);
  assert.ok(importMs < 60000, `import 20k em ${importMs}ms`);
  assert.ok(lastMs < Math.max(50, firstMs * 20 + 20),
    `página profunda (${lastMs}ms) não degrada vs. primeira (${firstMs}ms)`);
  mos.close();
});

test('stress · MIE: 120 ciclos com cenários sem travar nem vazar memória de auditoria', () => {
  const mie = MIE.createMIE({ seed: 11 });
  const t0 = Date.now();
  mie.runDays(30);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.world.applyScenario('new-competitor', { productId: 'p4' });
  mie.runDays(45);
  mie.world.applyScenario('sales-explosion', { productId: 'p3' });
  mie.runDays(45);
  const ms = Date.now() - t0;
  assert.ok(ms < 20000, `120 ciclos em ${ms}ms`);
  assert.ok(mie.audit.entries.length <= 20000, 'trilha de auditoria com teto (ring)');
  assert.ok(mie.bus.history.length <= 10000, 'histórico de eventos com teto (ring)');
  // invariantes constitucionais seguem valendo sob stress
  for (const c of mie.investigation.cases.filter(x => x.diagnosis))
    assert.ok(['alta', 'média', 'baixa'].includes(c.diagnosis.confidenceLabel));
  for (const d of mie.prioritization.pendingDecisions())
    assert.ok(d.diagnosis.proposal && d.impactMonthly > 0);
});

test('regressão · ponta a ponta: MIE → decisão persistida → aprovação → WhatsApp notifica', async () => {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'e2e@x.br', companyName: 'C' });
  const { SimulatedChannel, ConversationEngine } = require('../src/whatsapp/index.js');
  const channel = new SimulatedChannel();
  new ConversationEngine({ services: mos.services, repos: mos.repos, bus: mos.bus,
    queues: mos.queues, channel, companyId: company.id });

  const mie = MIE.createMIE({ seed: 42 });
  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);

  // ponte MIE → plataforma (o que o demo faz)
  const top = mie.prioritization.pendingDecisions()[0];
  const persisted = mos.services.decision.create(company.id, {
    title: top.title, discovery: top.diagnosis.causeLabel,
    proposal: { type: top.diagnosis.proposal.type },
    impactMin: top.impactMonthly, impactMax: top.impactMonthly, confidence: top.confidenceLabel });
  await mos.queues.notifications.onIdle();
  assert.ok(channel.outbox.some(m => /Preparei uma decisão/.test(m.text)), 'dono avisado no WhatsApp');

  await channel.receive('owner', 'aprovar 1');
  await mos.queues.notifications.onIdle();
  assert.equal(mos.repos.decision.byId(persisted.id).status, 'approved');
  assert.equal(mos.repos.mission.count(), 1);
  assert.equal(mos.repos.plan.count(), 1, 'plano com previsão criado (Art. 15)');
  mos.close();
});

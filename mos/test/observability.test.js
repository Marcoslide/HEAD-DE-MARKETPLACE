/* Bloco 12 — painel de observabilidade (endpoints /__dev). */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { createApi } = require('../src/interfaces/http/api.js');
const MIE = require('../../mie/src/index.js');

let mos, mie, server, base;

before(async () => {
  mos = createMOS({ logLevel: 'info' });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'o@b.s', companyName: 'C' });
  const d = mos.services.decision.create(company.id, {
    title: 'Decisão X', discovery: 'D', proposal: { type: 'reposition' } });
  mos.services.decision.approve(d.id);

  mie = MIE.createMIE({ seed: 42 });
  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(3);

  server = await createApi(mos, { dev: true, mie }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mos.close(); });

const j = p => fetch(base + p).then(r => r.json());

test('painel HTML servido em /__dev (interno, fora do produto)', async () => {
  const res = await fetch(base + '/__dev');
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  const html = await res.text();
  assert.match(html, /Painel de Observabilidade/);
});

test('overview: filas, eventos, logs e contagens do banco', async () => {
  const ov = await j('/__dev/overview');
  assert.ok(ov.queues.collector && ov.queues.publication, 'todas as filas visíveis');
  assert.ok(ov.db.decisions >= 1 && ov.db.missions >= 1 && ov.db.plans >= 1);
  assert.ok(ov.events.total > 0, 'eventos do bus contados');
  assert.ok(ov.mie && ov.mie.day > 0, 'MIE acoplado');
});

test('motores e especialistas visíveis via /__dev/mie', async () => {
  const m = await j('/__dev/mie');
  assert.ok(m.attached);
  assert.ok(m.engines.investigation.cases.length >= 1, 'casos de investigação');
  assert.equal(m.specialists.length, 7, 'os 7 especialistas');
  assert.ok(m.lastPareceres.length >= 7, 'pareceres do último caso');
  assert.ok(m.engines.memory.knowledge, 'memória do MIE exposta');
});

test('missões, memória, planos e aprendizado consultáveis', async () => {
  assert.ok((await j('/__dev/missions')).items.length >= 1);
  assert.ok((await j('/__dev/plans')).items.length >= 1);
  assert.ok(Array.isArray((await j('/__dev/memory')).items));
  assert.ok(Array.isArray((await j('/__dev/learning')).items));
});

test('eventos e logs com limite', async () => {
  const ev = await j('/__dev/events?limit=5');
  assert.ok(ev.items.length <= 5 && ev.items.length > 0);
  const lg = await j('/__dev/logs?limit=5');
  assert.ok(Array.isArray(lg.items));
});

/* Bloco 04 — API REST interna: contratos, validação, erros e OpenAPI. */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { createApi } = require('../src/interfaces/http/api.js');

let mos, server, base;

before(async () => {
  mos = createMOS();
  server = await createApi(mos).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mos.close(); });

const api = async (method, path, body) => {
  const res = await fetch(base + path, {
    method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, requestId: res.headers.get('x-request-id'), body: await res.json() };
};

test('health + request-id em toda resposta', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
  assert.ok(r.body.ok);
  assert.ok(r.requestId, 'x-request-id presente');
});

test('validação global: payload inválido → 400 com detalhes', async () => {
  const r = await api('POST', '/workspaces/bootstrap', { workspaceName: 'W' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'validation_error');
  assert.ok(r.body.details.some(d => d.includes('email')));
});

test('rota inexistente → 404 estruturado (nunca stack trace)', async () => {
  const r = await api('GET', '/nada/aqui');
  assert.equal(r.status, 404);
  assert.equal(r.body.error, 'not_found');
});

test('fluxo completo pela API: bootstrap → import → decisão → aprovação', async () => {
  const boot = await api('POST', '/workspaces/bootstrap', {
    workspaceName: 'Marcos WS', email: 'marcos@ex.com', companyName: 'Quadros & Cia',
    marketplaces: ['mercado_livre', 'shopee'],
  });
  assert.equal(boot.status, 201);
  const { companyId, connectionIds } = boot.body;

  const imp = await api('POST', `/companies/${companyId}/connections/${connectionIds[0]}/listings/import`, {
    items: [{ title: 'Quadro Paisagem 60x90', price: 189 }, { title: 'Kit 3 Quadros', price: 249 }],
  });
  assert.equal(imp.status, 201);
  assert.equal(imp.body.imported, 2);

  const list = await api('GET', `/companies/${companyId}/listings?limit=10`);
  assert.equal(list.body.items.length, 2);
  assert.equal(list.body.items[0].title, 'Quadro Paisagem 60x90');
  assert.ok(list.body.items[0].activeVersionId, 'v1 criada e ativa na importação');

  const dec = await api('POST', `/companies/${companyId}/decisions`, {
    title: 'Reposicionar o Quadro Paisagem',
    discovery: 'Detectei queda de 18% na conversão.',
    proposal: { type: 'reposition', steps: ['novo título'] },
    confidence: 'alta', class: 'C',
  });
  assert.equal(dec.status, 201);

  const approved = await api('POST', `/decisions/${dec.body.id}/approve`);
  assert.equal(approved.status, 200);
  assert.ok(approved.body.missionId, 'aprovação criou missão');
  assert.ok(approved.body.planId, 'aprovação criou plano');

  const missions = await api('GET', `/companies/${companyId}/missions`);
  assert.equal(missions.body.items.length, 1);
  assert.equal(missions.body.items[0].origin, 'decisão aprovada pelo dono');

  // aprovar duas vezes → conflito de estado, não 500
  const again = await api('POST', `/decisions/${dec.body.id}/approve`);
  assert.equal(again.status, 400);
});

test('recusa pela API alimenta a memória (Art. 18)', async () => {
  const boot = await api('POST', '/workspaces/bootstrap', {
    workspaceName: 'W2', email: 'w2@ex.com', companyName: 'C2' });
  const companyId = boot.body.companyId;
  const dec = await api('POST', `/companies/${companyId}/decisions`, {
    title: 'Cortar preço', discovery: 'Guerra…', proposal: { type: 'price_cut' } });
  await api('POST', `/decisions/${dec.body.id}/refuse`, { motive: 'margem apertada' });

  const mem = await api('GET', `/companies/${companyId}/memory?kind=preference`);
  assert.equal(mem.body.items.length, 1);
  assert.match(mem.body.items[0].discovery, /margem apertada/);
});

test('versões pela API: criar e restaurar', async () => {
  const boot = await api('POST', '/workspaces/bootstrap', {
    workspaceName: 'W3', email: 'w3@ex.com', companyName: 'C3', marketplaces: ['shopee'] });
  const { companyId, connectionIds } = boot.body;
  await api('POST', `/companies/${companyId}/connections/${connectionIds[0]}/listings/import`,
    { items: [{ title: 'Original', price: 100 }] });
  const list = await api('GET', `/companies/${companyId}/listings`);
  const listingId = list.body.items[0].id;

  const v2 = await api('POST', `/listings/${listingId}/versions`, { title: 'Novo', price: 120, reason: 'teste' });
  assert.equal(v2.body.number, 2);

  const versions = await api('GET', `/listings/${listingId}/versions`);
  const v1 = versions.body.items.find(v => v.number === 1);
  const restored = await api('POST', `/listings/${listingId}/versions/${v1.id}/restore`);
  assert.equal(restored.body.title, 'Original');
});

test('OpenAPI 3 gerado da tabela de rotas', async () => {
  const r = await api('GET', '/openapi.json');
  assert.equal(r.body.openapi, '3.0.3');
  assert.ok(r.body.paths['/decisions/{decisionId}/approve'], 'rota de aprovação documentada');
  assert.ok(r.body.paths['/workspaces/bootstrap'].post.requestBody, 'schema no requestBody');
});

test('auditoria acessível pela API (caixa-preta)', async () => {
  const r = await api('GET', '/audit?limit=10');
  assert.ok(r.body.items.length > 0, 'mutações anteriores auditadas');
});

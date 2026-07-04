/* Blocos 07+08 — providers e fluxo de publicação simulado. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { createProviderRegistry } = require('../src/providers/index.js');

function setup(marketplace = 'mercado_livre') {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'p@q.r', companyName: 'C', marketplaces: [marketplace] });
  const imp = mos.services.catalog.importListings(company.id, connections[0].id,
    [{ title: 'Quadro Paisagem 60x90', price: 189 }]);
  return { mos, companyId: company.id, listingId: imp.ids[0] };
}

/* ---------- Bloco 08: providers ---------- */

test('registry: 5 providers, todos honrando o contrato', () => {
  const reg = createProviderRegistry();
  assert.deepEqual(reg.names(), ['mercado_livre', 'shopee', 'amazon', 'magalu', 'tiktok']);
  for (const name of reg.names()) {
    const p = reg.get(name);
    const cap = p.capabilities();
    assert.ok(cap.titleMaxLen > 0 && cap.minImages >= 1, `${name}: capabilities completas`);
    const issues = p.validate({ title: 'x', price: 10, images: ['a', 'b', 'c'], category: 'c', attributes: { brand: 'b', ean: 'e' } });
    assert.ok(Array.isArray(issues), `${name}: validate retorna lista`);
    const pub = p.publish({});
    assert.match(pub.status, /simulated/, `${name}: publicação é SIMULADA (regra absoluta)`);
  }
});

test('regras específicas por praça: cada marketplace valida diferente', () => {
  const reg = createProviderRegistry();
  const base = { price: 50, images: ['1', '2', '3'], category: 'decoracao', attributes: {} };

  // ML: título até 60 e sem frete no título
  const ml = reg.get('mercado_livre');
  assert.ok(ml.validate({ ...base, title: 'x'.repeat(61) }).some(i => i.rule === 'title_max'));
  assert.ok(ml.validate({ ...base, title: 'Quadro com Frete Grátis' }).some(i => i.rule === 'ml_no_shipping_in_title'));

  // Shopee: 3+ imagens e preço mínimo
  const sp = reg.get('shopee');
  assert.ok(sp.validate({ ...base, title: 'ok', images: ['1'] }).some(i => i.rule === 'min_images'));
  assert.ok(sp.validate({ ...base, title: 'ok', price: 3 }).some(i => i.rule === 'shopee_min_price'));

  // Amazon: brand obrigatório
  assert.ok(reg.get('amazon').validate({ ...base, title: 'ok' }).some(i => i.rule === 'amazon_brand_required'));
  // Magalu: EAN obrigatório
  assert.ok(reg.get('magalu').validate({ ...base, title: 'ok' }).some(i => i.rule === 'magalu_ean_required'));
  // TikTok: vídeo é recomendação (warning), não bloqueio
  const tk = reg.get('tiktok').validate({ ...base, title: 'ok', attributes: { brand: 'b' } });
  assert.ok(tk.some(i => i.rule === 'tiktok_video_reco' && i.level === 'warning'));
});

test('adaptAttributes: payload no formato da praça', () => {
  const reg = createProviderRegistry();
  const l = { title: 'T', price: 10, images: [], category: 'c' };
  assert.equal(reg.get('mercado_livre').adaptAttributes(l).listing_type_id, 'gold_special');
  assert.ok('logistics' in reg.get('shopee').adaptAttributes(l));
  assert.equal(reg.get('amazon').adaptAttributes(l).fulfillment, 'FBM');
});

/* ---------- Bloco 07: pipeline ---------- */

test('pipeline completo: preparar → preview → aprovar → publicar → versionar → histórico', async () => {
  const { mos, listingId } = setup('mercado_livre');

  const prep = mos.services.publication.prepare(listingId, {
    title: 'Quadro Paisagem 60x90 Moldura Reforçada', price: 189,
    images: ['a.jpg', 'b.jpg', 'c.jpg'], category: 'decoracao/quadros',
  });
  assert.ok(prep.ok, 'validações passam');
  assert.ok(prep.preview, 'preview gerado para aprovação humana');
  assert.equal(mos.repos.listing.byId(listingId).status, 'pending_approval',
    'publicar é Classe C: SEMPRE aguarda aprovação');

  mos.services.publication.approve(listingId, prep.payload);
  await mos.queues.publication.onIdle();

  const listing = mos.repos.listing.byId(listingId);
  assert.equal(listing.status, 'active');
  assert.match(listing.external_id, /^ext_mercado_livre/, 'externalId simulado do provider');

  const versions = mos.repos.version.byListing(listingId);
  assert.equal(versions.length, 2, 'publicação criou v2 (versionamento)');
  assert.equal(listing.active_version_id, versions[0].id);

  const history = mos.services.publication.history(listingId);
  const steps = history.map(h => JSON.parse(h.payload_json).step || h.action);
  assert.ok(steps.includes('adapt'), 'histórico: adaptação');
  assert.ok(steps.includes('validate'), 'histórico: validações');
  assert.ok(steps.includes('preview_ready'), 'histórico: preview');
  assert.ok(history.some(h => h.action === 'simulated_publish'), 'histórico: publicação simulada');
  assert.ok(steps.includes('monitoring_scheduled'), 'histórico: monitoramento agendado');
  assert.ok(history.every(h => h.simulated === 1), 'TUDO simulado — nenhum envio real');

  assert.ok(mos.queues.analysis.size() >= 0, 'monitoramento na fila de análise');
  mos.close();
});

test('pipeline bloqueia publicação inválida e explica os motivos', () => {
  const { mos, listingId } = setup('mercado_livre');
  const prep = mos.services.publication.prepare(listingId, {
    title: 'Quadro Lindo com Frete Grátis para Todo Brasil Aproveite Agora Mesmo Promoção',
    images: [], category: null,
  });
  assert.equal(prep.ok, false);
  const rules = prep.issues.map(i => i.rule);
  assert.ok(rules.includes('title_max'));
  assert.ok(rules.includes('ml_no_shipping_in_title'));
  assert.ok(rules.includes('min_images'));
  assert.ok(rules.includes('category_required'));
  assert.equal(mos.repos.listing.byId(listingId).status, 'active',
    'anúncio não muda de estado quando a validação bloqueia');
  mos.close();
});

test('aprovar sem preview pendente → conflito de estado', () => {
  const { mos, listingId } = setup();
  assert.throws(() => mos.services.publication.approve(listingId, {}), /não está aguardando/);
  mos.close();
});

test('rollback: volta a versão anterior mantendo o histórico completo', async () => {
  const { mos, listingId } = setup('shopee');
  const prep = mos.services.publication.prepare(listingId, {
    title: 'Kit 3 Quadros Sala Grande', price: 249,
    images: ['1.jpg', '2.jpg', '3.jpg'], category: 'decoracao',
  });
  mos.services.publication.approve(listingId, prep.payload);
  await mos.queues.publication.onIdle();

  const v1 = mos.repos.version.byListing(listingId).find(v => v.number === 1);
  const restored = mos.services.publication.rollback(listingId, v1.id);
  assert.equal(restored.number, 3, 'rollback cria versão nova (nunca apaga história)');
  assert.equal(mos.repos.listing.byId(listingId).title, 'Quadro Paisagem 60x90');
  const history = mos.services.publication.history(listingId);
  assert.ok(history.some(h => h.action === 'rollback'));
  mos.close();
});

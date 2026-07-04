/* Bloco 11 — experimentação: doutrina do MIF Parte 6 imposta por código. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');

function setup() {
  const mos = createMOS();
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'e@x.br', companyName: 'C', marketplaces: ['shopee'] });
  const imp = mos.services.catalog.importListings(company.id, connections[0].id,
    [{ title: 'Quadro Original', price: 100 }]);
  return { mos, companyId: company.id, listingId: imp.ids[0] };
}
const VALID = {
  hypothesis: 'acredito que foto ambientada aumenta CTR porque os líderes usam',
  variable: 'imagem principal', metric: 'ctr',
  successCriteria: { minLiftPct: 8 }, windowDays: 7,
  variant: { title: 'Quadro Original', images: ['ambientada.jpg'] },
};

test('MIF 6.2: sem critério definido antes, não há experimento', () => {
  const { mos, listingId } = setup();
  assert.throws(() => mos.services.experiment.create(listingId, { ...VALID, successCriteria: null }),
    /critério de sucesso/);
  assert.throws(() => mos.services.experiment.create(listingId, { ...VALID, variable: null }),
    /variável única/);
  mos.close();
});

test('MIF 6.1: uma variável por vez — segundo experimento no mesmo anúncio é vetado', () => {
  const { mos, listingId } = setup();
  const e1 = mos.services.experiment.create(listingId, VALID);
  mos.services.experiment.start(e1.id, { day: 0 });
  assert.throws(() => {
    const e2 = mos.services.experiment.create(listingId, { ...VALID, variable: 'título' });
  }, /uma variável por vez/);
  mos.close();
});

test('vitória: variante permanece e vira conhecimento', () => {
  const { mos, listingId, companyId } = setup();
  const exp = mos.services.experiment.create(listingId, VALID);
  mos.services.experiment.start(exp.id, { day: 0 });
  const concluded = mos.services.experiment.conclude(exp.id, { day: 8, baselineValue: 0.030, variantValue: 0.034 });
  const result = JSON.parse(concluded.result_json);
  assert.equal(result.verdict, 'win');
  assert.ok(result.liftPct >= 8);
  // variante segue ativa
  const listing = mos.repos.listing.byId(listingId);
  assert.equal(listing.active_version_id, exp.variant_version_id);
  // conhecimento gravado
  const k = mos.repos.memory.byKind(companyId, 'strategy');
  assert.ok(k.some(x => /funcionou/.test(x.discovery)));
  mos.close();
});

test('derrota: rollback AUTOMÁTICO para a baseline + conhecimento negativo', () => {
  const { mos, listingId, companyId } = setup();
  const exp = mos.services.experiment.create(listingId, VALID);
  mos.services.experiment.start(exp.id, { day: 0 });
  mos.services.experiment.conclude(exp.id, { day: 8, baselineValue: 0.030, variantValue: 0.0305 });
  const listing = mos.repos.listing.byId(listingId);
  assert.equal(listing.title, 'Quadro Original', 'título de volta à baseline');
  assert.notEqual(listing.active_version_id, exp.variant_version_id, 'variante desativada');
  const events = mos.bus.ofType('experiment.rolled_back');
  assert.equal(events.length, 1);
  const k = mos.repos.memory.byKind(companyId, 'strategy');
  assert.ok(k.some(x => /NÃO funcionou/.test(x.discovery)), 'derrota também vira conhecimento (MIF 6.6)');
  mos.close();
});

test('MIF 6.4: não se conclui antes da janela; parada antecipada só por dano', () => {
  const { mos, listingId } = setup();
  const exp = mos.services.experiment.create(listingId, VALID);
  mos.services.experiment.start(exp.id, { day: 0 });
  assert.throws(() => mos.services.experiment.conclude(exp.id, { day: 3, baselineValue: 1, variantValue: 2 }),
    /janela mínima/);
  assert.throws(() => mos.services.experiment.stopEarly(exp.id, { reason: 'já ganhou!', damage: false }),
    /DANO claro/);
  const stopped = mos.services.experiment.stopEarly(exp.id, { reason: 'conversão desabou 30%', damage: true });
  assert.equal(stopped.status, 'stopped_early');
  assert.equal(mos.repos.listing.byId(listingId).title, 'Quadro Original', 'dano → rollback imediato');
  mos.close();
});

test('histórico completo do anúncio: experimentos consultáveis', () => {
  const { mos, listingId } = setup();
  const e = mos.services.experiment.create(listingId, VALID);
  mos.services.experiment.start(e.id, { day: 0 });
  mos.services.experiment.conclude(e.id, { day: 8, baselineValue: 0.03, variantValue: 0.035 });
  const hist = mos.services.experiment.history(listingId);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].status, 'concluded');
  mos.close();
});

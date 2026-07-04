/* Ponte MIE↔plataforma — recomendação nº 1 do CTO Review.
   Prova que o estado cognitivo do MIE é espelhado nos repositórios
   persistentes sem violar a Constituição. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { MieBridge } = require('../src/application/mie-bridge.js');
const MIE = require('../../mie/src/index.js');

function setup() {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'bridge@x.br', companyName: 'Quadros & Cia' });
  // produtos reais mapeados aos ids do mundo simulado do MIE
  const p1 = mos.services.catalog.createProduct(company.id, { name: 'Quadro Paisagem 60x90' });
  const p4 = mos.services.catalog.createProduct(company.id, { name: 'Espelho Decorativo' });
  const productMap = { p1: p1.id, p4: p4.id };
  return { mos, companyId: company.id, productMap };
}

test('ponte ao vivo: decisão priorizada no MIE vira decisão persistida (pacote completo)', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  const bridge = new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);

  const persisted = mos.services.decision.pending(companyId);
  assert.ok(persisted.length >= 1, 'decisão do MIE espelhada no banco');
  const reposition = persisted.find(d => JSON.parse(d.proposal_json).type === 'reposition');
  assert.ok(reposition, 'proposta de reposicionamento persistida');
  assert.equal(reposition.product_id, productMap.p1, 'produto mapeado corretamente');
  assert.ok(reposition.impact_min > 0 && reposition.impact_max > 0, 'impacto em R$ (Art. 19)');
  assert.ok(['alta', 'média', 'baixa'].includes(reposition.confidence), 'confiança declarada (Art. 9)');
  assert.match(JSON.parse(reposition.proposal_json).mieProductRef, /p1/, 'ref do MIE preservada');
  mos.close();
});

test('investigação do MIE é espelhada com diário e diagnóstico', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);

  const invs = mos.db.all('SELECT * FROM investigation WHERE company_id = ?', companyId);
  assert.ok(invs.length >= 1, 'investigações persistidas');
  const diagnosed = invs.find(i => i.status === 'diagnosed');
  assert.ok(diagnosed, 'pelo menos uma investigação diagnosticada');
  assert.ok(diagnosed.confidence > 0, 'confiança gravada');
  const dj = JSON.parse(diagnosed.diagnosis_json);
  assert.ok(dj.cause && dj.pareceres.length >= 1, 'causa e pareceres dos especialistas espelhados');
  mos.close();
});

test('curiosidade (watchlist) NUNCA é espelhada como decisão (Art. 19)', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('ctr-noise', { productId: 'p4' });
  mie.runDays(4);

  // ruído gera watchlist no MIE, mas nenhuma decisão persistida
  const persistedP4 = mos.services.decision.pending(companyId)
    .filter(d => d.product_id === productMap.p4);
  assert.equal(persistedP4.length, 0, 'ruído fica em observação, não vira decisão no banco');
  mos.close();
});

test('incidente vira missão de primeira resposta em curso (Fluxo 008)', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('listing-down', { productId: 'p1' });
  mie.runDays(1);

  const missions = mos.db.all(`SELECT * FROM mission WHERE company_id = ? AND kind = 'executando'`, companyId);
  assert.ok(missions.length >= 1, 'incidente espelhado como missão');
  assert.match(missions[0].origin, /incidente detectado pelo MIE/);
  mos.close();
});

test('idempotência: reconectar/re-emitir não duplica decisões', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  const bridge = new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(6); // a anomalia pode reabrir após o dedupe de 7 dias

  const before = mos.services.decision.pending(companyId).length;
  // syncExisting sobre o mesmo estado não deve criar nada novo
  bridge.syncExisting(mie);
  const after = mos.services.decision.pending(companyId).length;
  assert.equal(after, before, 'sync idempotente não duplica');
  mos.close();
});

test('syncExisting: ponte conectada a um MIE que já estava rodando', () => {
  const { mos, companyId, productMap } = setup();
  const mie = MIE.createMIE({ seed: 42 });
  // MIE roda ANTES da ponte existir
  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(4);

  const bridge = new MieBridge({ mieBus: mie.bus, mos, companyId, productMap });
  const stats = bridge.syncExisting(mie);
  assert.ok(stats.investigations >= 1, 'investigações passadas espelhadas');
  assert.ok(stats.decisions >= 1, 'decisões pendentes passadas espelhadas');
  assert.ok(mos.services.decision.pending(companyId).length >= 1);
  mos.close();
});

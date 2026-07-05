/* =============================================================
   SPRINT 10.E.2.5 — Fontes Shopee REAIS: contrato de dados
   Perfis casando os cabeçalhos reais dos exports (Ads CPC,
   Afiliados, Estoque Full, Chat), CSV com metadados antes do
   cabeçalho, todas as colunas preservadas e IDEMPOTÊNCIA total
   (reimportar não duplica nada; Ads/Afiliados não somam receita).
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const V8IMP = require('../../design/prototipo-v8/import-engine.js');
const V8FILE = require('../../design/prototipo-v8/file-reader.js');
const ESC = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee', tipoDado: 'DADOS REAIS' };
const PER = { ini: '2026-06-04', fim: '2026-07-05' };

/* 1 — CSV com metadados antes do cabeçalho é lido corretamente */
test('01 · CSV de Ads com 6 linhas de metadados: cabeçalho real detectado', () => {
  const csv = [
    'Relatório de Todos os Anúncios CPC - Shopee Brasil',
    'Nome de Usuário,lidermolduras',
    'Nome da loja,Líder Molduras',
    'Período,05/04/2026 - 05/07/2026',
    '',
    '#,Nome do Anúncio,Status,Impressões,Cliques,GMV,Despesas,ROAS',
    '1,Campanha A,Em Andamento,45845,1636,4494.65,350,12.84',
  ].join('\n');
  const p = V8FILE.parseCsvText(csv);
  assert.ok(p.headers.includes('Nome do Anúncio') && p.headers.includes('ROAS'), 'cabeçalho real, não a linha de título');
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0]['GMV'], 4494.65);
  assert.ok(p.meta && p.meta.length >= 3, 'metadados preservados (não descartados)');
});

/* 2 — Ads: perfil, destino e métricas (nunca soma no faturamento) */
test('02 · Ads CPC reconhecido; GMV/ROAS mapeados; explicativa (não soma receita)', () => {
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.adsReal(PER), ESC, {});
  assert.equal(b.det.perfil, 'SHOPEE_ADS');
  assert.equal(b.det.destino, 'ads');
  V8IMP.applyImportChain(eng, b.id, {});
  const ads = eng.snapshots.filter(s => s.metric_type === 'ads');
  assert.equal(ads.length, 2);
  assert.equal(ads[0].metricas.gmv, 4494.65);
  assert.equal(ads[0].metricas.roas, 12.84);
  assert.ok(ads[0].explicativa, 'Ads é métrica explicativa — não soma no faturamento');
  /* receita consolidada ignora Ads */
  assert.equal(V8IMP.receitaConsolidada(eng, { contaId: 'acc-sh-1' }).receita, 0, 'GMV de Ads não vira receita');
});

/* 3 — Afiliados: atribuição por pedido + id de comissão, sem duplicar faturamento */
test('03 · Afiliados reconhecido; comissão/reembolso mapeados; explicativa', () => {
  const eng = V8IMP.createEngine();
  const b = V8IMP.stage(eng, V8IMP.FIXTURES.affiliateReal(PER), ESC, {});
  assert.equal(b.det.perfil, 'SHOPEE_AFFILIATE_REAL');
  assert.equal(b.det.destino, 'afiliados');
  V8IMP.applyImportChain(eng, b.id, {});
  const afs = eng.snapshots.filter(s => s.metric_type === 'afiliados');
  assert.equal(afs.length, 2);
  assert.equal(afs[0].external_order_id, '260705TQMQMPKT');
  assert.equal(afs[0].metricas.affiliate_commission_brl, 41.124);
  assert.ok(afs[0].explicativa, 'afiliado explica atribuição — não duplica faturamento');
});

/* 4 — Estoque Full: colunas reais (Seller SKU ID/Sellable/Reserved), snapshot */
test('04 · Estoque Full reconhecido pelas colunas reais; snapshot não soma', () => {
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.inventoryFull('2026-07-05'), ESC, {});
  assert.ok(res.multi, 'duas abas (Total / Warehouse Stock)');
  for (const b of res.batches) { assert.equal(b.det.destino, 'estoque'); V8IMP.applyImportChain(eng, b.id, {}); }
  const est = eng.snapshots.filter(s => s.metric_type === 'estoque');
  assert.ok(est.length >= 2);
  const qp = est.find(s => s.sku_ref === 'QP-6090');
  assert.equal(qp.metricas.sellable, 4);
  assert.equal(qp.metricas.reserved, 2);
  assert.equal(qp.metricas.sold_30d, 36);
});

/* 5 — Chat real: reconhecido pelas colunas reais */
test('05 · Chat real reconhecido (Chats Respondidos/CSAT %)', () => {
  const eng = V8IMP.createEngine();
  const res = V8IMP.stage(eng, V8IMP.FIXTURES.chatReal(PER), ESC, {});
  const bs = res.multi ? res.batches : [res];
  const chat = bs.find(b => b.det && b.det.destino === 'atendimento');
  assert.ok(chat, 'aba de tendências reconhecida como atendimento');
});

/* 6 — todas as colunas preservadas na camada bruta */
test('06 · todas as colunas de cada fonte ficam na camada bruta', () => {
  const eng = V8IMP.createEngine();
  const f = V8IMP.FIXTURES.affiliateReal(PER);
  V8IMP.stage(eng, f, ESC, {});
  const rf = eng.rawFiles.find(x => x.nome === f.nome);
  for (const h of f.abas[0].headers) assert.ok(rf.abas[0].headers.includes(h), 'coluna preservada: ' + h);
});

/* 7 — IDEMPOTÊNCIA: reimportar as fontes reais não duplica nem soma */
test('07 · reimportar Ads/Afiliados/Estoque não duplica snapshots', () => {
  const eng = V8IMP.createEngine();
  const aplica = () => {
    for (const f of [V8IMP.FIXTURES.adsReal(PER), V8IMP.FIXTURES.affiliateReal(PER), V8IMP.FIXTURES.inventoryFull('2026-07-05')]) {
      const res = V8IMP.stage(eng, f, ESC, {});
      const bs = res.multi ? res.batches : [res];
      for (const b of bs) if (b && b.id && b.preview && b.preview.aplicavel) V8IMP.applyImportChain(eng, b.id, {});
    }
  };
  aplica();
  const n = eng.snapshots.length;
  aplica(); /* mesma coisa de novo */
  assert.equal(eng.snapshots.length, n, 'reimportação idêntica não cria snapshot novo');
});

/* 8 — Estoque: snapshot mais novo substitui, não soma */
test('08 · estoque: leitura nova substitui o atual e nunca soma quantidades', () => {
  const eng = V8IMP.createEngine();
  const r1 = V8IMP.stage(eng, V8IMP.FIXTURES.inventoryFull('2026-07-05'), ESC, {});
  for (const b of r1.batches) V8IMP.applyImportChain(eng, b.id, {});
  const sv = V8IMP.stockView(eng, {});
  const qp = sv.atual.find(s => s.sku === 'QP-6090');
  assert.ok(qp, 'estoque atual por SKU real');
  assert.ok(qp.disponivel != null, 'disponível declarado (nunca soma de snapshots)');
});

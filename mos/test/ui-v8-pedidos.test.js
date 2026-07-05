/* =============================================================
   SPRINT 10.F.2 — motor de Pedidos (V8PED). Parser do export REAL de
   Pedidos Shopee (uma linha por item), identidade por prioridade
   (Item ID > Variation ID > SKU > GTIN; nome NUNCA é chave), expectativa
   financeira, rateio sem duplicar taxa e rentabilidade honesta.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const P = require('../../design/prototipo-v8/pedidos-engine.js');

const H = P.SHOPEE_ORDERS_HEADER;
const row = o => H.map(h => o[h] != null ? o[h] : '');

/* planilha real com preâmbulo + 1 pedido de 1 item e 1 pedido de 2 itens */
const sheet = () => [
  ['Relatório de Pedidos'], [''], ['Conta', 'lidermolduras'], ['Detalhes'],
  H.slice(),
  row({ 'ID do pedido': '2606AAA', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-10', 'Nome do Produto': 'Quadro Paisagem 60x90', 'Número de referência SKU': 'QP-6090', 'Quantidade': '1', 'Valor Total': '129.90', 'Cidade': 'BH', 'UF': 'MG' }),
  row({ 'ID do pedido': '2606BBB', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-12', 'Nome do Produto': 'Kit 3 Quadros', 'Número de referência SKU': 'KIT3-SALA', 'Quantidade': '1', 'Valor Total': '250.00', 'Cidade': 'SP', 'UF': 'SP' }),
  row({ 'ID do pedido': '2606BBB', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-12', 'Nome do Produto': 'Porta-Retrato 3D', 'Número de referência SKU': 'POR-3D', 'Quantidade': '2', 'Valor Total': '250.00', 'Cidade': 'SP', 'UF': 'SP' }),
];

test('01-05 · parser localiza cabeçalho com preâmbulo e agrupa itens por pedido', () => {
  const r = P.parseOrders(sheet(), { marketplace: 'shopee', contaId: 'acc', empresaId: 'e1', arquivo: 'pedidos.xlsx' });
  assert.equal(r.headerRow, 4, 'cabeçalho após o preâmbulo');
  assert.equal(r.orders.length, 2, 'dois pedidos');
  const bbb = r.orders.find(o => o.external_order_id === '2606BBB');
  assert.equal(bbb.items.length, 2, 'pedido com múltiplos itens agrupado');
  assert.equal(bbb.qtd_itens, 2);
  assert.equal(bbb.items[0].seller_sku, 'KIT3-SALA');
  assert.equal(bbb.items[1].quantity, 2);
  assert.ok(bbb.items[0].raw, 'linha RAW preservada por item');
  assert.ok(bbb.source_first_row > 4, 'linha de origem registrada');
});

test('06-07 · identidade por prioridade; nome de produto NUNCA é chave', () => {
  assert.equal(P.identidadeItem({ external_listing_id: '111', seller_sku: 'X' }).identity_origin, 'ITEM_ID');
  assert.equal(P.identidadeItem({ external_variation_id: '222', seller_sku: 'X' }).identity_origin, 'VARIATION_ID');
  assert.equal(P.identidadeItem({ seller_sku: 'QP-6090' }).identity_origin, 'SELLER_SKU');
  assert.equal(P.identidadeItem({ gtin_ean: '789' }).identity_origin, 'GTIN');
  const semId = P.identidadeItem({ product_name_original: 'Quadro' });
  assert.equal(semId.needs_review, true, 'sem identificador forte → revisão');
  assert.match(semId.motivo, /nome de produto não é chave/);
});

test('09 · expectativa financeira do pedido; sem comissão declara insuficiência', () => {
  const order = { gross_products_value: 200 };
  const semTaxa = P.expectativaFinanceira(order, {});
  assert.equal(semTaxa.insuficiente, true);
  assert.ok(semTaxa.faltando.includes('comissão prevista'));
  const comTaxa = P.expectativaFinanceira(order, { comissaoPct: 14, impostoPct: 7, taxaFixa: 4 });
  assert.ok(comTaxa.expected_net_value < 200 && comTaxa.expected_net_value > 0, 'líquido esperado < bruto');
  assert.match(comTaxa.formula, /líquido esperado/);
});

test('10 · rateio de taxa única do pedido NÃO duplica por SKU', () => {
  const itens = [{ seller_sku: 'A', gross_item_value: 200, quantity: 1 }, { seller_sku: 'B', gross_item_value: 100, quantity: 1 }];
  const rat = P.ratearPorItem(30, itens, 'Por valor bruto do item');
  const soma = rat.linhas.reduce((a, l) => a + l.valor, 0);
  assert.equal(soma, 30, 'soma do rateio = taxa única');
});

test('14 · rentabilidade honesta: sem custo interno não classifica como lucrativo', () => {
  const semCusto = P.rentabilidadeItem({ unit_price: 129.9, quantity: 1 }, {});
  assert.equal(semCusto.classe, 'SEM_DADOS_SUFICIENTES');
  const comCusto = P.rentabilidadeItem({ unit_price: 200, quantity: 1 }, { custoProduto: 60, comissaoPct: 14, impostoPct: 7, taxaFixa: 26, embalagem: 5, fixoRateado: 10 });
  assert.ok(['ESCALAR', 'MANTER', 'CORRIGIR', 'REPRECIFICAR'].includes(comCusto.classe));
});

test('motor honesto: sem escrita externa; nome não é chave; carteira é a verdade', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../design/prototipo-v8/pedidos-engine.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|publicar/i.test(src), 'zero escrita externa');
  assert.match(src, /NUNCA é chave|nome de produto não é chave|Nome de produto NUNCA/i);
});

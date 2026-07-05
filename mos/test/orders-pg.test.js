/* =============================================================
   SPRINT 10.F.2 — PEDIDOS no POSTGRES real + cruzamento oficial.
   Prova: importa carteira → caso RECEBIDO_SEM_CONFERENCIA; importa o PEDIDO
   correspondente → o caso vira CONCILIADO. Itens agrupados, taxa não duplicada,
   identidade por prioridade, reimport sem duplicar, nova instância vê tudo.
   SÓ roda com Postgres (HEAD_TEST_PG=postgres://...).
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/production/core.js');
const { createReconciliation } = require('../src/production/reconciliation.js');
const { createOrders } = require('../src/production/orders.js');
const V8CONC = require('../../design/prototipo-v8/conciliacao-engine.js');
const V8PED = require('../../design/prototipo-v8/pedidos-engine.js');

const PG = process.env.HEAD_TEST_PG || (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL) ? process.env.DATABASE_URL : null);

if (!PG) {
  test('pedidos (Postgres) — pulado: defina HEAD_TEST_PG=postgres://…', { skip: true }, () => {});
} else {
  const NOW = '2026-07-05T12:00:00.000Z';
  const esc = { company_id: 'e1', marketplace: 'shopee', marketplace_account_id: 'acc-shopee' };
  const HC = V8CONC.SHOPEE_TX_HEADER, HO = V8PED.SHOPEE_ORDERS_HEADER;
  const wrow = o => HC.map(h => o[h] != null ? o[h] : '');
  const orow = o => HO.map(h => o[h] != null ? o[h] : '');

  const wallet = () => V8CONC.normalizeShopeeWallet([
    wrow({ 'Data': '2026-06-20 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 260601FLIP', 'ID do pedido': '260601FLIP', 'Direção do dinheiro': 'Entrada', 'Valor': '176.63', 'Status': 'Transação completa' }),
    wrow({ 'Data': '2026-06-22 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 260601MULT', 'ID do pedido': '260601MULT', 'Direção do dinheiro': 'Entrada', 'Valor': '250.00', 'Status': 'Transação completa' }),
  ], { marketplace: 'shopee', contaId: 'acc-shopee', empresaId: 'e1', arquivo: 'w.xlsx' });

  const ordersSheet = () => [
    ['Relatório de Pedidos'], ['Conta', 'lidermolduras'], ['Detalhes'],
    HO.slice(),
    orow({ 'ID do pedido': '260601FLIP', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-19', 'Nome do Produto': 'Quadro Paisagem', 'Número de referência SKU': 'QP-6090', 'Quantidade': '1', 'Valor Total': '176.63', 'Cidade': 'BH', 'UF': 'MG' }),
    orow({ 'ID do pedido': '260601MULT', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-21', 'Nome do Produto': 'Kit 3 Quadros', 'Número de referência SKU': 'KIT3-SALA', 'Quantidade': '1', 'Valor Total': '250.00', 'Cidade': 'SP', 'UF': 'SP' }),
    orow({ 'ID do pedido': '260601MULT', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-21', 'Nome do Produto': 'Porta-Retrato', 'Número de referência SKU': '', 'Quantidade': '2', 'Valor Total': '250.00', 'Cidade': 'SP', 'UF': 'SP' }),
    orow({ 'ID do pedido': '260601AGUA', 'Status do pedido': 'Enviado', 'Data de criação do pedido': '2026-07-01', 'Nome do Produto': 'Garrafa', 'Número de referência SKU': 'GAR-1L', 'Quantidade': '1', 'Valor Total': '140.00', 'Cidade': 'RJ', 'UF': 'RJ' }),
  ];

  const rule = { marketplace: 'shopee', marketplace_account_id: 'acc-shopee', rule_name: 'Shopee', shipping_mode: 'proprio', expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1 };

  function freshDb() { const db = core.openDb({ env: 'LOCAL', databaseUrl: PG }); core.migrate(db); return db; }
  function limpar(db) {
    db.prepare('DELETE FROM order_event').run();
    db.prepare('DELETE FROM financial_reconciliation_event').run();
    for (const t of ['order_item', 'orders']) db.prepare(`DELETE FROM ${t} WHERE company_id = ? OR company_id IS NULL`).run('e1');
    for (const t of ['financial_transaction', 'financial_reconciliation_case', 'financial_reconciliation_rule']) db.prepare(`DELETE FROM ${t} WHERE company_id = ? OR company_id IS NULL`).run('e1');
  }

  test('pedidos Postgres — cruzamento e o flip RECEBIDO_SEM_CONFERENCIA → CONCILIADO', () => {
    const db = freshDb(); limpar(db);
    const recon = createReconciliation(db), orders = createOrders(db);

    /* 1. só a carteira: caso fica RECEBIDO_SEM_CONFERENCIA */
    recon.importWallet({ escopo: esc, transactions: wallet() });
    recon.addRule(esc, rule);
    recon.run({ escopo: esc, now: NOW });
    const antes = db.prepare('SELECT reconciliation_status FROM financial_reconciliation_case WHERE external_order_id = ?').get('260601FLIP');
    assert.equal(antes.reconciliation_status, 'RECEBIDO_SEM_CONFERENCIA', 'sem pedido importado');

    /* 2. importa PEDIDOS (parser real com preâmbulo) e cruza */
    const parsed = orders.parseOrdersReport(ordersSheet(), { marketplace: 'shopee', contaId: 'acc-shopee', empresaId: 'e1', arquivo: 'pedidos.xlsx' });
    assert.equal(parsed.headerRow, 3, 'cabeçalho de pedidos localizado');
    assert.equal(parsed.orders.length, 3, '3 pedidos');
    const imp = orders.importOrders({ escopo: esc, orders: parsed.orders, rules: [rule], now: NOW, taxas: {} });
    assert.equal(imp.insertedOrders, 3);
    assert.equal(imp.insertedItems, 4, 'itens (1 + 2 + 1) persistidos');

    /* 3. o FLIP: agora o pedido explica o recebido */
    const depois = db.prepare('SELECT reconciliation_status, expected_net_value, received_net_value FROM financial_reconciliation_case WHERE external_order_id = ?').get('260601FLIP');
    assert.equal(depois.reconciliation_status, 'CONCILIADO', 'pedido encontrado → conciliado');
    assert.equal(depois.received_net_value, 176.63);

    /* 4. pedido entregue há pouco, sem movimento → AGUARDANDO_LIBERACAO */
    const agua = db.prepare('SELECT reconciliation_status FROM financial_reconciliation_case WHERE external_order_id = ?').get('260601AGUA');
    assert.equal(agua.reconciliation_status, 'AGUARDANDO_LIBERACAO');

    /* 5. pedido de 2 itens: agrupado; item sem SKU/ID vai para revisão */
    const itens = orders.items('260601MULT');
    assert.equal(itens.length, 2, 'itens agrupados no mesmo pedido');
    assert.ok(itens.some(i => i.needs_review === 1), 'item sem identificador forte → revisão');
    assert.ok(itens.some(i => i.identity_origin === 'SELLER_SKU'), 'item com SKU identificado por SKU');
    assert.ok(imp.needsReview >= 1, 'contagem de revisão');

    /* 6. identidade financeira: esperado (pedido) × recebido (carteira) */
    const fi = orders.financialIdentity('260601FLIP');
    assert.equal(fi.reconciliation_status, 'CONCILIADO');
    assert.equal(fi.received_net_value, 176.63);
    assert.ok(fi.movimentos.length >= 1, 'movimentos da carteira vinculados');

    /* 7. busca por SKU / Item ID */
    assert.ok(orders.list(esc, { sku: 'QP-6090' }).some(o => o.external_order_id === '260601FLIP'), 'busca por SKU');

    /* 8. RAW preservado */
    const rawItem = db.prepare('SELECT raw_payload FROM order_item WHERE seller_sku = ?').get('QP-6090');
    assert.ok(rawItem && rawItem.raw_payload && rawItem.raw_payload.length > 2, 'RAW do item preservado');

    /* 9. reimportação sem duplicar; status novo atualiza sem apagar */
    const imp2 = orders.importOrders({ escopo: esc, orders: parsed.orders, rules: [rule], now: NOW, taxas: {} });
    assert.equal(imp2.insertedOrders, 0, 'nada novo');
    assert.equal(Number(db.prepare('SELECT count(*) c FROM orders').get().c), 3, 'sem duplicar pedidos');
    const mut = parsed.orders.map(o => Object.assign({}, o));
    mut[0] = Object.assign({}, mut[0], { order_status: 'Devolvido' });
    const imp3 = orders.importOrders({ escopo: esc, orders: mut, rules: [rule], now: NOW, taxas: {} });
    assert.equal(imp3.updatedOrders, 3);
    assert.equal(db.prepare('SELECT order_status FROM orders WHERE external_order_id = ?').get('260601FLIP').order_status, 'Devolvido', 'status atualizado');
    assert.equal(Number(db.prepare('SELECT count(*) c FROM orders').get().c), 3, 'ainda sem duplicar');
  });

  test('pedidos Postgres — NOVA instância do backend vê os mesmos pedidos e vínculos', () => {
    const db2 = freshDb();
    const orders = createOrders(db2);
    const s = orders.summary(esc);
    assert.ok(s.qtdPedidos >= 3, 'pedidos persistidos');
    assert.ok(s.qtdItens >= 4, 'itens persistidos');
    const det = orders.byId('260601MULT');
    assert.ok(det && det.items.length === 2, 'detalhe com itens');
    assert.ok(det.events.length >= 1, 'eventos do pedido');
    const prof = orders.profitability(esc, {});
    assert.ok(prof.length >= 4 && prof.every(p => p.classe === 'SEM_DADOS_SUFICIENTES' || /ESCALAR|MANTER|CORRIGIR|REPRECIFICAR|INVESTIGAR/.test(p.classe)), 'rentabilidade honesta (sem custo → sem dados)');
    const naoConc = orders.unreconciled(esc);
    assert.ok(Array.isArray(naoConc), 'consulta de não conciliados');
  });
}

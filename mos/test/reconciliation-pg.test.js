/* =============================================================
   SPRINT 10.F.1 (Increment 2) — CONCILIAÇÃO FINANCEIRA no POSTGRES real.
   Prova a vertical oficial: upload/parse do relatório da carteira Shopee
   (com preâmbulo) → normalização → Postgres → conciliação com pedidos →
   status corretos → reimportação sem duplicar → NOVA instância do backend
   vê os mesmos dados. SÓ roda com Postgres (HEAD_TEST_PG=postgres://...).
   ============================================================= */
'use strict';
process.env.HEAD_TEST_NO_RATELIMIT = '1'; /* isolamento: sem disputa de rate limit entre testes */
const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/production/core.js');
const { createReconciliation } = require('../src/production/reconciliation.js');
const V8CONC = require('../../design/prototipo-v8/conciliacao-engine.js');

const PG = process.env.HEAD_TEST_PG || (process.env.DATABASE_URL && /^postgres/.test(process.env.DATABASE_URL) ? process.env.DATABASE_URL : null);

if (!PG) {
  test('conciliação (Postgres) — pulado: defina HEAD_TEST_PG=postgres://…', { skip: true }, () => {});
} else {
  const NOW = '2026-07-05T12:00:00.000Z';
  const H = V8CONC.SHOPEE_TX_HEADER;
  const rowOf = o => H.map(h => o[h] != null ? o[h] : '');
  const tx = (data, tipo, desc, pedido, dir, valor, saldo) =>
    rowOf({ 'Data': data, 'Tipo de transação': tipo, 'Descrição': desc, 'ID do pedido': pedido, 'Direção do dinheiro': dir, 'Valor': valor, 'Status': 'Transação completa', 'Balança após as transações': saldo, 'Valor a Ser Ajustado': '0.00' });

  /* planilha da carteira COM PREÂMBULO (título, conta, resumo) antes do cabeçalho */
  const walletSheet = () => [
    ['Relatório'], [''], ['Informações da conta'], ['Nome de usuário (vendedor)', 'lidermolduras'],
    ['De', '2026-06-01'], ['Para', '2026-07-05'], ['Resumo'], ['Detalhes da transação'],
    H.slice(),
    tx('2026-06-20 10:00:00', 'Renda do pedido', 'Renda do pedido 260601CONC1', '260601CONC1', 'Entrada', '180.00', '180.00'),
    tx('2026-06-25 09:05:00', 'Shopee Acelera', 'Ajuste do Shopee Acelera ID do pedido 260601CONC1', '260601CONC1', 'Saída', '-3.37', '176.63'),
    tx('2026-06-18 10:00:00', 'Renda do pedido', 'Renda do pedido 260601AJUS1', '260601AJUS1', 'Entrada', '200.00', '376.63'),
    tx('2026-06-28 10:00:00', 'Ajuste', 'Ajuste para 260601AJUS1', '260601AJUS1', 'Entrada', '5.00', '381.63'),
    tx('2026-06-15 10:00:00', 'Renda do pedido', 'Renda do pedido 260601REEM1', '260601REEM1', 'Entrada', '90.00', '471.63'),
    tx('2026-06-26 10:00:00', 'Ajuste', 'Débito referente ao pedido 260601REEM1 devido à solicitação de reembolso', '-', 'Saída', '-90.00', '381.63'),
    tx('2026-06-29 10:00:00', 'Renda do pedido', 'Renda do pedido 260601SEMC1', '260601SEMC1', 'Entrada', '120.00', '501.63'),
    tx('2026-06-30 09:00:00', 'Shopee Acelera', 'Resgate do Shopee Acelera - ID da transação: 2184850840836342797', '-', 'Entrada', '5000.00', '5501.63'),
    tx('2026-06-30 22:00:00', 'Pix', 'PIX Transfer Send', '-', 'Saída', '-4000.00', '1501.63'),
    tx('2026-07-01 08:00:00', 'Ajuste', 'Reembolso por objeto perdido', '-', 'Entrada', '48.90', '1550.53'),
  ];

  const orders = () => [
    { external_order_id: '260601CONC1', marketplace: 'shopee', marketplace_account_id: 'acc_recon', internal_order_id: 'PED-1', gross_order_value: 210, expected_net_value: 176.63, paid_at: '2026-06-19', delivered_at: '2026-06-20' },
    { external_order_id: '260601AJUS1', marketplace: 'shopee', marketplace_account_id: 'acc_recon', internal_order_id: 'PED-2', gross_order_value: 250, expected_net_value: 205, paid_at: '2026-06-17', delivered_at: '2026-06-18' },
    { external_order_id: '260601REEM1', marketplace: 'shopee', marketplace_account_id: 'acc_recon', internal_order_id: 'PED-3', gross_order_value: 110, expected_net_value: 90, paid_at: '2026-06-14', delivered_at: '2026-06-15' },
    { external_order_id: '260601AGUA1', marketplace: 'shopee', marketplace_account_id: 'acc_recon', internal_order_id: 'PED-4', gross_order_value: 140, expected_net_value: 115, paid_at: '2026-07-01', delivered_at: '2026-07-02' },
  ];

  const rule = { marketplace: 'shopee', marketplace_account_id: 'acc_recon', rule_name: 'Shopee estoque próprio', shipping_mode: 'proprio', expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1 };
  const escopo = { company_id: 'co_recon', marketplace: 'shopee', marketplace_account_id: 'acc_recon' };

  function freshDb() { const db = core.openDb({ env: 'LOCAL', databaseUrl: PG }); core.migrate(db); return db; }

  test('conciliação Postgres — jornada oficial completa', () => {
    const db = freshDb();
    /* ISOLAMENTO: limpa SOMENTE os registros da própria empresa (co_recon).
       Eventos não têm company_id → apaga só os dos casos desta empresa. */
    db.prepare('DELETE FROM financial_reconciliation_event WHERE reconciliation_id IN (SELECT reconciliation_id FROM financial_reconciliation_case WHERE company_id = ?)').run('co_recon');
    for (const t of ['financial_transaction', 'financial_reconciliation_case', 'financial_reconciliation_rule'])
      db.prepare(`DELETE FROM ${t} WHERE company_id = ?`).run('co_recon');
    const svc = createReconciliation(db);

    /* 1. parser localiza o cabeçalho apesar do preâmbulo */
    const parsed = svc.parseWalletReport(walletSheet(), { marketplace: 'shopee', contaId: 'acc_recon', empresaId: 'co_recon', arquivo: 'balance.xlsx' });
    assert.equal(parsed.headerRow, 8, 'cabeçalho localizado na linha certa (após o preâmbulo)');
    assert.equal(parsed.transactions.length, 10, 'todas as linhas de dados normalizadas');

    /* 2. importa carteira → transações persistidas, natureza preservada */
    const imp = svc.importWallet({ escopo, transactions: parsed.transactions });
    assert.equal(imp.inserted, 10);
    const acelera = db.prepare(`SELECT transaction_type, transaction_subtype, direction FROM financial_transaction WHERE external_order_id = ? AND transaction_type = 'TAXA_ANTECIPACAO'`).get('260601CONC1');
    assert.equal(acelera.transaction_subtype, 'Shopee Acelera', 'natureza original do Shopee Acelera preservada');
    assert.equal(acelera.transaction_type, 'TAXA_ANTECIPACAO', 'Acelera classificado como antecipação, não "ajuste"');

    /* 3. pedidos + regra + conciliação */
    svc.importOrders({ escopo, orders: orders() });
    svc.addRule(escopo, rule);
    const rr = svc.run({ escopo, now: NOW });
    assert.ok(rr.casos >= 5, 'casos criados/atualizados');

    const byOrder = o => db.prepare('SELECT * FROM financial_reconciliation_case WHERE external_order_id = ?').get(o);
    assert.equal(byOrder('260601CONC1').reconciliation_status, 'CONCILIADO', 'recebido explica o esperado');
    assert.equal(byOrder('260601AJUS1').reconciliation_status, 'COM_AJUSTE_POSTERIOR', 'crédito após conciliação');
    assert.equal(byOrder('260601REEM1').reconciliation_status, 'REEMBOLSADO', 'renda + reembolso = 0');
    assert.equal(byOrder('260601AGUA1').reconciliation_status, 'AGUARDANDO_LIBERACAO', 'entregue há pouco, dentro do ciclo');
    assert.equal(byOrder('260601SEMC1').reconciliation_status, 'RECEBIDO_SEM_CONFERENCIA', 'entrou com pedido, mas sem pedido importado');

    /* 4. tesouraria e movimento sem pedido preservados */
    assert.ok(rr.tesouraria >= 2, 'resgate de antecipação e Pix como tesouraria');
    assert.ok(rr.movimentosSemPedido >= 1, 'indenização sem pedido não some');

    /* 5. eventos de conciliação registrados */
    const nEv = db.prepare('SELECT count(*) c FROM financial_reconciliation_event WHERE reconciliation_id IN (SELECT reconciliation_id FROM financial_reconciliation_case WHERE company_id = ?)').get('co_recon');
    assert.ok(Number(nEv.c) >= 5, 'histórico de eventos gravado');

    /* 6. resumo alimenta três visões distintas */
    const s = svc.summary(escopo);
    assert.ok(s.totalLiberadoCarteira >= 590, 'liberado (Renda do pedido) real');
    assert.ok(s.totalAntecipacaoResgate >= 5000, 'resgate de antecipação separado da venda');
    assert.equal(s.fonte, 'POSTGRES');

    /* 7. REIMPORTAÇÃO do mesmo arquivo não duplica valor recebido */
    const imp2 = svc.importWallet({ escopo, transactions: parsed.transactions });
    assert.equal(imp2.inserted, 0, 'nada novo inserido');
    assert.equal(imp2.unchanged, 10, 'tudo deduplicado');
    const nTx = db.prepare('SELECT count(*) c FROM financial_transaction WHERE company_id = ?').get('co_recon');
    assert.equal(Number(nTx.c), 10, 'sem duplicação de transações');

    /* 8. período sobreposto: reimporta com 1 linha alterada → atualiza SÓ ela */
    const alterado = parsed.transactions.map(t => Object.assign({}, t));
    alterado[0] = Object.assign({}, alterado[0], { amount: 181.00, status: 'Processando' });
    const imp3 = svc.importWallet({ escopo, transactions: alterado });
    assert.equal(imp3.updated, 1, 'só a linha realmente alterada é atualizada');
    assert.equal(Number(db.prepare('SELECT count(*) c FROM financial_transaction WHERE company_id = ?').get('co_recon').c), 10, 'ainda sem duplicar');
  });

  test('conciliação Postgres — NOVA instância do backend vê os mesmos dados', () => {
    const db2 = freshDb();            /* = outro processo / relogin / novo backend */
    const svc2 = createReconciliation(db2);
    const s = svc2.summary(escopo);
    assert.ok(s.qtdCasos >= 5, 'casos persistidos sobrevivem a nova instância');
    const conc = svc2.cases(escopo, { status: 'CONCILIADO' });
    assert.ok(conc.some(c => c.external_order_id === '260601CONC1'), 'conciliado persistido');
    const det = svc2.caseById(conc.find(c => c.external_order_id === '260601CONC1').reconciliation_id);
    assert.ok(det.movimentos.length >= 2, 'movimentos vinculados ao caso');
    assert.ok(det.eventos.length >= 1, 'eventos do caso persistidos');
    const div = svc2.divergences(escopo);
    assert.ok(Array.isArray(div), 'divergências consultáveis');
    const proj = svc2.projection(escopo, NOW);
    assert.match(proj.nota, /CICLO CONFIGURADO/);
  });
}

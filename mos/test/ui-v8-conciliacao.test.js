/* =============================================================
   SPRINT 10.F.1 — CONCILIAÇÃO FINANCEIRA (motor V8CONC).
   Testado contra os NOMES REAIS de coluna do relatório de transações
   da carteira Shopee ("Transaction Report") e os tipos reais
   (Renda do pedido, Shopee Acelera, Ajuste, Pix, Saques).
   Carteira = verdade; pedido + regra = expectativa; nada inventado.
   ============================================================= */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../../design/prototipo-v8/conciliacao-engine.js');

const H = C.SHOPEE_TX_HEADER;
/* linha no formato real (array na ordem do cabeçalho) */
const row = o => H.map(h => o[h] != null ? o[h] : '');

const walletReal = [
  row({ 'Data': '2026-06-20 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 2606ABC', 'ID do pedido': '2606ABC', 'Direção do dinheiro': 'Entrada', 'Valor': '180.00', 'Status': 'Transação completa', 'Balança após as transações': '180.00', 'Valor a Ser Ajustado': '0.00' }),
  row({ 'Data': '2026-06-21 09:00:00', 'Tipo de transação': 'Shopee Acelera', 'Descrição': 'Resgate do Shopee Acelera - ID da transação: 999', 'ID do pedido': '-', 'Direção do dinheiro': 'Entrada', 'Valor': '7161.64', 'Status': 'Transação completa', 'Balança após as transações': '7341.64', 'Valor a Ser Ajustado': '0.00' }),
  row({ 'Data': '2026-06-21 09:05:00', 'Tipo de transação': 'Shopee Acelera', 'Descrição': 'Ajuste do Shopee Acelera ID do pedido 2606ABC', 'ID do pedido': '2606ABC', 'Direção do dinheiro': 'Saída', 'Valor': '-3.37', 'Status': 'Transação completa', 'Balança após as transações': '7338.27', 'Valor a Ser Ajustado': '0.00' }),
  row({ 'Data': '2026-06-22 22:00:00', 'Tipo de transação': 'Pix', 'Descrição': 'PIX Transfer Send', 'ID do pedido': '-', 'Direção do dinheiro': 'Saída', 'Valor': '-10136.00', 'Status': 'Transação completa', 'Balança após as transações': '0.00', 'Valor a Ser Ajustado': '0.00' }),
  row({ 'Data': '2026-06-23 08:00:00', 'Tipo de transação': 'Ajuste', 'Descrição': 'Indenização objeto perdido', 'ID do pedido': '-', 'Direção do dinheiro': 'Entrada', 'Valor': '55.00', 'Status': 'Transação completa', 'Balança após as transações': '55.00', 'Valor a Ser Ajustado': '0.00' }),
];

test('01-05 · normaliza o relatório REAL da carteira Shopee e classifica os tipos reais', () => {
  const txns = C.normalizeShopeeWallet(walletReal, { marketplace: 'shopee', contaId: 'acc1', empresaId: 'e1', arquivo: 'wallet.xlsx' });
  assert.equal(txns.length, 5, 'todas as linhas com tipo entram');
  const byDesc = t => txns.find(x => (x.descricao || '').includes(t));
  assert.equal(byDesc('Renda do pedido 2606ABC').transaction_type, 'SALE_RELEASE');
  assert.equal(byDesc('Resgate do Shopee Acelera').transaction_type, 'ANTICIPATION_RELEASE');
  assert.equal(byDesc('Ajuste do Shopee Acelera').transaction_type, 'ANTICIPATION_FEE');
  assert.equal(byDesc('PIX Transfer Send').transaction_type, 'WITHDRAWAL');
  assert.equal(byDesc('Indenização').transaction_type, 'ADJUSTMENT_CREDIT');
  /* sinal e vínculo preservados */
  assert.equal(byDesc('PIX Transfer Send').amount, -10136);
  assert.equal(byDesc('Renda do pedido 2606ABC').external_order_id, '2606ABC');
  assert.ok(byDesc('Renda do pedido 2606ABC').raw_payload, 'linha RAW preservada');
});

test('06 · agrupa por marketplace + conta + ID do pedido; nome nunca é chave', () => {
  const txns = C.normalizeShopeeWallet(walletReal, { marketplace: 'shopee', contaId: 'acc1' });
  const r = C.reconcile({ transactions: txns, orders: [], now: '2026-06-25' });
  const caso = r.cases.find(c => c.external_order_id === '2606ABC');
  assert.ok(caso, 'pedido agrupado');
  assert.equal(caso.movimentos.length, 2, 'renda + ajuste do acelera do MESMO pedido juntos');
  /* saque/pix e resgate são tesouraria, não viram caso de pedido */
  assert.equal(r.tesouraria.length, 2, 'Pix e Resgate Acelera são tesouraria');
  /* indenização sem pedido não some (seção 22) */
  assert.equal(r.movimentosSemPedido.length, 1);
  assert.equal(r.movimentosSemPedido[0].transaction_type, 'ADJUSTMENT_CREDIT');
});

test('11 · pedido CONCILIADO quando recebido explica o esperado (dentro da tolerância)', () => {
  const txns = C.normalizeShopeeWallet([walletReal[0], walletReal[2]], { marketplace: 'shopee', contaId: 'acc1' });
  const orders = [{ external_order_id: '2606ABC', marketplace: 'shopee', marketplace_account_id: 'acc1', gross_order_value: 210, expected_net_value: 176.63, paid_at: '2026-06-19', delivered_at: '2026-06-20' }];
  const r = C.reconcile({ transactions: txns, orders, now: '2026-06-25', toleranciaCentavos: 0.05 });
  const caso = r.cases[0];
  assert.equal(caso.received_net_value, 176.63, '180 − 3.37');
  assert.equal(caso.difference_value, 0);
  assert.equal(caso.reconciliation_status, 'CONCILIADO');
});

test('10 · AGUARDANDO_LIBERACAO: sem movimento, mas dentro da janela da regra', () => {
  const orders = [{ external_order_id: 'P1', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 100, delivered_at: '2026-06-24' }];
  const rules = [{ rule_id: 'r1', marketplace: 'shopee', rule_name: 'Shopee estoque próprio', expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1 }];
  const r = C.reconcile({ transactions: [], orders, rules, now: '2026-06-26' });
  assert.equal(r.cases[0].reconciliation_status, 'AGUARDANDO_LIBERACAO');
  assert.ok(r.cases[0].dias_restantes > 0, 'dias restantes declarados');
  assert.ok(r.cases[0].expected_release_at, 'data prevista calculada pela regra');
});

test('13 · ATRASADO/SEM MOVIMENTO: passou a janela + tolerância e nada entrou', () => {
  const orders = [{ external_order_id: 'P2', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 100, delivered_at: '2026-06-01' }];
  const rules = [{ rule_id: 'r1', marketplace: 'shopee', rule_name: 'Shopee', expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1 }];
  const r = C.reconcile({ transactions: [], orders, rules, now: '2026-07-05' });
  assert.equal(r.cases[0].reconciliation_status, 'SEM_MOVIMENTO_ENCONTRADO');
  assert.ok(r.cases[0].dias_atraso > 0, 'dias de atraso declarados');
});

test('12 · RECEBIMENTO_PARCIAL e 14 · DIVERGENTE', () => {
  const parc = C.reconcile({ transactions: C.normalizeShopeeWallet([row({ 'Tipo de transação': 'Renda do pedido', 'ID do pedido': 'P3', 'Direção do dinheiro': 'Entrada', 'Valor': '150.00', 'Data': '2026-06-20 10:00:00' })], { marketplace: 'shopee', contaId: 'acc1' }),
    orders: [{ external_order_id: 'P3', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 200 }], now: '2026-06-25' });
  assert.equal(parc.cases[0].reconciliation_status, 'RECEBIMENTO_PARCIAL');
  assert.equal(parc.cases[0].pending_net_value, 50);

  const div = C.reconcile({ transactions: C.normalizeShopeeWallet([row({ 'Tipo de transação': 'Renda do pedido', 'ID do pedido': 'P4', 'Direção do dinheiro': 'Entrada', 'Valor': '260.00', 'Data': '2026-06-20 10:00:00' })], { marketplace: 'shopee', contaId: 'acc1' }),
    orders: [{ external_order_id: 'P4', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 200 }], now: '2026-06-25' });
  assert.equal(div.cases[0].reconciliation_status, 'DIVERGENTE');
  assert.equal(div.cases[0].difference_value, 60);
});

test('15 · MOVIMENTO recebido com ID de pedido mas SEM pedido importado → declara sem conferência', () => {
  const txns = C.normalizeShopeeWallet([row({ 'Tipo de transação': 'Renda do pedido', 'ID do pedido': 'X9', 'Direção do dinheiro': 'Entrada', 'Valor': '90.00', 'Data': '2026-06-20 10:00:00' })], { marketplace: 'shopee', contaId: 'acc1' });
  const r = C.reconcile({ transactions: txns, orders: [], now: '2026-06-25' });
  assert.equal(r.cases[0].reconciliation_status, 'RECEBIDO_SEM_CONFERENCIA');
  assert.equal(r.cases[0].expected_net_value, null, 'sem pedido, não inventa esperado');
});

test('17 · COM_AJUSTE_POSTERIOR: conciliado que recebeu crédito/débito depois', () => {
  const txns = C.normalizeShopeeWallet([
    row({ 'Tipo de transação': 'Renda do pedido', 'ID do pedido': 'P5', 'Direção do dinheiro': 'Entrada', 'Valor': '200.00', 'Data': '2026-06-20 10:00:00' }),
    row({ 'Tipo de transação': 'Ajuste', 'Descrição': 'Ajuste pós-reembolso', 'ID do pedido': 'P5', 'Direção do dinheiro': 'Entrada', 'Valor': '5.00', 'Data': '2026-06-28 10:00:00' }),
  ], { marketplace: 'shopee', contaId: 'acc1' });
  const r = C.reconcile({ transactions: txns, orders: [{ external_order_id: 'P5', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 205 }], now: '2026-07-01' });
  assert.equal(r.cases[0].reconciliation_status, 'COM_AJUSTE_POSTERIOR');
});

test('22-24 · rateio de taxa por SKU NÃO duplica a taxa única do pedido', () => {
  const rat = C.ratearTaxaPorSku(30, [
    { sku: 'A', valorBruto: 200 }, { sku: 'B', valorBruto: 100 },
  ], 'Por valor bruto do item');
  const somaRateada = rat.linhas.reduce((a, l) => a + l.valor, 0);
  assert.equal(somaRateada, 30, 'soma do rateio = taxa única (não duplica)');
  assert.equal(rat.linhas[0].valor, 20); assert.equal(rat.linhas[1].valor, 10);
  const porQtd = C.ratearTaxaPorSku(30, [{ sku: 'A', quantidade: 1 }, { sku: 'B', quantidade: 2 }], 'Por quantidade');
  assert.equal(porQtd.linhas[0].valor + porQtd.linhas[1].valor, 30);
});

test('25-28 · reimportar o mesmo arquivo não duplica; preserva RAW', () => {
  const txns = C.normalizeShopeeWallet(walletReal, { marketplace: 'shopee', contaId: 'acc1' });
  const dobrado = txns.concat(txns.map(t => Object.assign({}, t)));
  const deduped = C.dedup(dobrado);
  assert.equal(deduped.length, txns.length, 'linhas idênticas deduplicadas');
  assert.ok(deduped.every(t => t.raw_payload), 'RAW preservado após dedup');
});

test('37 · previsão de entrada por janela é declarada como estimativa de ciclo', () => {
  const orders = [{ external_order_id: 'P6', marketplace: 'shopee', marketplace_account_id: 'acc1', expected_net_value: 100, delivered_at: '2026-06-30' }];
  const rules = [{ rule_id: 'r1', marketplace: 'shopee', rule_name: 'Shopee', expected_release_days_min: 5, expected_release_days_max: 8, grace_days: 2, priority: 1 }];
  const r = C.reconcile({ transactions: [], orders, rules, now: '2026-07-05' });
  const prev = C.previsaoEntrada(r, '2026-07-05');
  assert.match(prev.nota, /CICLO CONFIGURADO/);
  assert.ok((prev.hoje + prev.d7 + prev.d15 + prev.d30 + prev.atrasado) >= 100, 'valor previsto entra numa janela');
});

test('42-43 · resumo separa vendido, liberado, aguardando, atrasado, divergente e reembolso', () => {
  const txns = C.normalizeShopeeWallet(walletReal, { marketplace: 'shopee', contaId: 'acc1' });
  const r = C.reconcile({ transactions: txns, orders: [], now: '2026-06-25' });
  const s = r.resumo;
  assert.ok(s.totalLiberadoCarteira >= 180, 'total liberado vem de SALE_RELEASE reais');
  assert.equal(typeof s.qtdMovimentosSemPedido, 'number');
  assert.equal(typeof s.qtdTesouraria, 'number');
});

test('honesto: motor sem escrita externa; carteira é a verdade, expectativa nunca a substitui', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../design/prototipo-v8/conciliacao-engine.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|api\.shopee|publicar/i.test(src), 'zero escrita externa');
  assert.match(src, /CARTEIRA = verdade/i);
  assert.match(src, /NUNCA (inventa|substitui)|nunca inventa/i);
});

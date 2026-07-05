/* =============================================================
   V8CONC — CONCILIAÇÃO FINANCEIRA (10.F.1)
   "Vendeu? O Head confere se o dinheiro realmente entrou."

   Normaliza o RELATÓRIO REAL de transações da carteira Shopee
   (aba "Transaction Report": Data · Tipo de transação · Descrição ·
   ID do pedido · Direção do dinheiro · Valor · Status · Balança ·
   Valor a Ser Ajustado), agrupa os movimentos por marketplace +
   conta + ID do pedido, calcula valor recebido, compara com o valor
   esperado (quando há pedido importado) e classifica a conciliação.

   Princípios (não-negociáveis):
   - CARTEIRA = verdade financeira confirmada.
   - PEDIDO + regras = expectativa (NUNCA substitui a carteira).
   - nunca inventa taxa, prazo ou pedido; declara ausência.
   - pedido com vários SKUs: taxa/comissão NÃO é duplicada no rateio.
   - preserva a linha RAW; dedup por chave estável.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8CONC = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* cabeçalho real do relatório da carteira Shopee (linha de "Detalhes da transação") */
  const SHOPEE_TX_HEADER = ['Data', 'Tipo de transação', 'Descrição', 'ID do pedido',
    'Direção do dinheiro', 'Valor', 'Status', 'Balança após as transações', 'Valor a Ser Ajustado'];

  /* tipos canônicos de movimento financeiro (seção 8.2 do contrato) */
  const TX_TYPES = ['SALE_RELEASE', 'COMMISSION', 'SERVICE_FEE', 'ITEM_SOLD_FEE', 'TRANSACTION_FEE',
    'AFFILIATE_FEE', 'SHIPPING_FEE', 'SHIPPING_SUBSIDY', 'BUYER_SHIPPING_PAYMENT', 'COUPON', 'VOUCHER',
    'PIX_DISCOUNT', 'SELLER_DISCOUNT', 'REFUND', 'PARTIAL_REFUND', 'RETURN_SHIPPING_COST',
    'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'LOST_PACKAGE_COMPENSATION', 'DAMAGED_ITEM_COMPENSATION',
    'POST_REFUND_ADJUSTMENT', 'SHIPPING_DISCREPANCY', 'ANTICIPATION_FEE', 'ANTICIPATION_RELEASE',
    'WITHDRAWAL', 'WALLET_PAYMENT', 'TAX', 'UNKNOWN'];

  /* status de conciliação (seção 10) */
  const STATUS = {
    PENDENTE_DE_DADOS: 'PENDENTE_DE_DADOS', AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
    AGUARDANDO_ENVIO: 'AGUARDANDO_ENVIO', AGUARDANDO_ENTREGA: 'AGUARDANDO_ENTREGA',
    AGUARDANDO_LIBERACAO: 'AGUARDANDO_LIBERACAO', PREVISTO_PARA_LIBERACAO: 'PREVISTO_PARA_LIBERACAO',
    RECEBIMENTO_PARCIAL: 'RECEBIMENTO_PARCIAL', CONCILIADO: 'CONCILIADO', DIVERGENTE: 'DIVERGENTE',
    ATRASADO: 'ATRASADO', REEMBOLSADO: 'REEMBOLSADO', COM_AJUSTE_POSTERIOR: 'COM_AJUSTE_POSTERIOR',
    SEM_MOVIMENTO_ENCONTRADO: 'SEM_MOVIMENTO_ENCONTRADO', MOVIMENTO_SEM_PEDIDO: 'MOVIMENTO_SEM_PEDIDO',
    RECEBIDO_SEM_CONFERENCIA: 'RECEBIDO_SEM_CONFERENCIA', EM_REVISAO: 'EM_REVISAO',
    ENCERRADO_MANUALMENTE: 'ENCERRADO_MANUALMENTE',
  };

  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  /* "-173.37" / "1.089,17" / "7161.64" → número. O relatório Shopee já traz sinal. */
  function parseValor(v) {
    if (v == null || v === '' || v === '-') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/\s/g, '').replace(/R\$/i, '');
    /* formato BR "1.234,56" vs US "1234.56" */
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  const tsOf = d => { const t = Date.parse(String(d || '').replace(' ', 'T')); return isNaN(t) ? null : t; };
  const idPedido = v => (v == null || v === '' || v === '-') ? null : String(v).trim();

  /* Shopee "Tipo de transação" (+descrição+direção) → tipo canônico.
     Só mapeia o que é reconhecível; o resto é UNKNOWN e é preservado. */
  function classifyShopee(tipo, descricao, direcao) {
    const t = String(tipo || '').toLowerCase();
    const d = String(descricao || '').toLowerCase();
    const entrada = String(direcao || '').toLowerCase().startsWith('entr');
    if (/renda do pedido/.test(t)) return 'SALE_RELEASE';
    if (/reembolso|refund/.test(t) || /reembolso|estorno/.test(d)) return entrada ? 'ADJUSTMENT_CREDIT' : 'REFUND';
    if (/shopee acelera|acelera/.test(t)) {
      if (/resgate/.test(d)) return 'ANTICIPATION_RELEASE'; /* dinheiro antecipado entra na carteira */
      return 'ANTICIPATION_FEE'; /* ajuste/custo da antecipação (geralmente por pedido) */
    }
    if (/saques?|saque/.test(t) || /pix/.test(t)) return 'WITHDRAWAL'; /* saída de caixa (tesouraria) */
    if (/saldo da carteira/.test(t) || /pagamento/.test(t)) return 'WALLET_PAYMENT';
    if (/ajuste|adjustment/.test(t)) return entrada ? 'ADJUSTMENT_CREDIT' : 'ADJUSTMENT_DEBIT';
    if (/comiss/.test(t)) return 'COMMISSION';
    if (/servi[çc]o|service fee/.test(t)) return 'SERVICE_FEE';
    if (/frete|shipping/.test(t)) return 'SHIPPING_FEE';
    return 'UNKNOWN';
  }

  /* movimento de tesouraria (caixa) — não é conciliação de venda, não vira "sem pedido" */
  const TESOURARIA = new Set(['WITHDRAWAL', 'WALLET_PAYMENT', 'ANTICIPATION_RELEASE']);

  /* ---------- normalização do relatório da carteira Shopee ----------
     linhas: array de arrays (na ordem de SHOPEE_TX_HEADER) OU array de objetos
     já com essas chaves. ctx: { marketplace, contaId, empresaId, arquivo, aba }. */
  function normalizeShopeeWallet(linhas, ctx) {
    ctx = ctx || {};
    const out = [];
    (linhas || []).forEach((raw, i) => {
      const cell = k => Array.isArray(raw) ? raw[SHOPEE_TX_HEADER.indexOf(k)] : raw[k];
      const tipoOriginal = cell('Tipo de transação');
      if (tipoOriginal == null || tipoOriginal === '') return; /* linha vazia/total */
      const direcao = cell('Direção do dinheiro');
      const descricao = cell('Descrição');
      const tt = classifyShopee(tipoOriginal, descricao, direcao);
      out.push({
        source_row: (ctx.baseRow || 0) + i + 1,
        source_file: ctx.arquivo || null, source_sheet: ctx.aba || 'Transaction Report',
        marketplace: ctx.marketplace || 'shopee', marketplace_account_id: ctx.contaId || null,
        company_id: ctx.empresaId || null,
        occurred_at: cell('Data') || null, occurred_ts: tsOf(cell('Data')),
        external_order_id: idPedido(cell('ID do pedido')),
        transaction_type: tt, transaction_subtype: String(tipoOriginal),
        direction: String(direcao || '').toLowerCase().startsWith('entr') ? 'IN' : 'OUT',
        amount: round2(parseValor(cell('Valor'))),
        status: cell('Status') || null,
        saldo_apos: parseValor(cell('Balança após as transações')),
        valor_ajustar: parseValor(cell('Valor a Ser Ajustado')),
        descricao: descricao || null,
        raw_payload: raw,
        confidence: tt === 'UNKNOWN' ? 'baixa' : 'alta',
      });
    });
    return out;
  }

  /* chave de deduplicação estável (seção 26) */
  function txKey(t) {
    return ['conc', t.marketplace || '-', t.marketplace_account_id || '-', t.external_order_id || '-',
      t.transaction_subtype || '-', t.occurred_at || '-', t.amount, t.source_row].join('|');
  }
  function dedup(transactions) {
    const seen = new Set(), out = [];
    for (const t of transactions) { const k = txKey(t); if (seen.has(k)) continue; seen.add(k); out.push(t); }
    return out;
  }

  /* ---------- regra de ciclo de recebimento ----------
     NUNCA assume prazo real sem regra/fonte. Sem regra aplicável → declara. */
  function resolverRegra(regras, ctx) {
    const cand = (regras || []).filter(r =>
      (!r.marketplace || r.marketplace === ctx.marketplace) &&
      (!r.marketplace_account_id || r.marketplace_account_id === ctx.contaId) &&
      (!r.shipping_mode || r.shipping_mode === ctx.shippingMode) &&
      (r.status == null || r.status === 'Ativo'));
    cand.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return cand[0] || null;
  }
  /* data prevista de liberação a partir da entrega (ou pagamento) + regra */
  function previsaoLiberacao(order, regra) {
    if (!regra) return { previstoTs: null, faltaRegra: true };
    const baseTs = tsOf(order.delivered_at) || tsOf(order.paid_at) || tsOf(order.order_created_at);
    if (baseTs == null) return { previstoTs: null, faltaData: true };
    const dias = regra.expected_release_days_max != null ? regra.expected_release_days_max : (regra.expected_release_days_min || 0);
    const prazoTs = baseTs + dias * 86400000;
    const limiteTs = prazoTs + (regra.grace_days || 0) * 86400000;
    return { previstoTs: prazoTs, limiteTs, dias, grace: regra.grace_days || 0 };
  }

  /* ---------- conciliação em massa ----------
     transactions: saída de normalizeShopeeWallet (uma ou várias contas).
     orders: [{ external_order_id, marketplace, marketplace_account_id, order_created_at,
                paid_at, delivered_at, gross_order_value, expected_net_value?, itens? }]
     rules: FINANCIAL_RECONCILIATION_RULE[]; opts: { now, toleranciaCentavos } */
  function reconcile(input) {
    input = input || {};
    const txns = dedup(input.transactions || []);
    const orders = input.orders || [];
    const rules = input.rules || [];
    const now = input.now != null ? (typeof input.now === 'number' ? input.now : tsOf(input.now)) : null;
    const tol = input.toleranciaCentavos != null ? input.toleranciaCentavos : 0.05;

    /* movimentos com pedido × tesouraria × sem pedido */
    const porPedido = new Map();
    const tesouraria = [], semPedido = [];
    for (const t of txns) {
      if (t.external_order_id) {
        const k = t.marketplace + '|' + (t.marketplace_account_id || '-') + '|' + t.external_order_id;
        if (!porPedido.has(k)) porPedido.set(k, []);
        porPedido.get(k).push(t);
      } else if (TESOURARIA.has(t.transaction_type)) {
        tesouraria.push(t);
      } else {
        semPedido.push(t); /* ajuste/indenização/desconhecido sem pedido — nunca some (seção 22) */
      }
    }

    const ordersByKey = new Map();
    for (const o of orders) ordersByKey.set((o.marketplace || 'shopee') + '|' + (o.marketplace_account_id || '-') + '|' + o.external_order_id, o);

    const cases = [];
    const visto = new Set();
    for (const [k, movs] of porPedido) {
      const order = ordersByKey.get(k) || null;
      visto.add(k);
      cases.push(montarCaso(k, movs, order, rules, now, tol));
    }
    /* pedidos SEM nenhum movimento na carteira */
    for (const [k, o] of ordersByKey) {
      if (visto.has(k)) continue;
      cases.push(montarCaso(k, [], o, rules, now, tol));
    }

    return {
      cases,
      movimentosSemPedido: semPedido,
      tesouraria,
      transacoes: txns,
      resumo: resumo(cases, txns, tesouraria, semPedido),
    };
  }

  function montarCaso(chave, movs, order, rules, now, tol) {
    const [marketplace, contaId, orderId] = chave.split('|');
    const soma = tt => round2(movs.filter(m => m.transaction_type === tt).reduce((a, m) => a + m.amount, 0));
    const recebidoVenda = soma('SALE_RELEASE');
    const ajusteCred = soma('ADJUSTMENT_CREDIT') + soma('LOST_PACKAGE_COMPENSATION') + soma('DAMAGED_ITEM_COMPENSATION');
    const ajusteDeb = soma('ADJUSTMENT_DEBIT');
    const reembolso = soma('REFUND') + soma('PARTIAL_REFUND');
    const antecip = soma('ANTICIPATION_FEE');
    const recebidoLiquido = round2(movs.reduce((a, m) => a + m.amount, 0)); /* soma real de tudo do pedido na carteira */
    const temMovimento = movs.length > 0;
    const expected = order && order.expected_net_value != null ? round2(order.expected_net_value) : null;
    const diff = expected != null ? round2(recebidoLiquido - expected) : null;

    /* prazo/regra */
    const regra = order ? resolverRegra(rules, { marketplace, contaId, shippingMode: order.shipping_mode }) : null;
    const prev = order ? previsaoLiberacao(order, regra) : { faltaRegra: true };
    const passouPrazo = prev.limiteTs != null && now != null && now > prev.limiteTs;

    /* classificação honesta */
    let status;
    const ultimoMovTs = temMovimento ? Math.max(...movs.map(m => m.occurred_ts || 0)) : null;
    if (!order && temMovimento) {
      status = STATUS.RECEBIDO_SEM_CONFERENCIA; /* dinheiro do pedido entrou, mas o pedido não foi importado p/ conferir */
    } else if (!temMovimento) {
      status = passouPrazo ? STATUS.SEM_MOVIMENTO_ENCONTRADO : STATUS.AGUARDANDO_LIBERACAO;
    } else if (reembolso < 0 && recebidoLiquido <= tol) {
      status = STATUS.REEMBOLSADO;
    } else if (expected == null) {
      status = STATUS.RECEBIDO_SEM_CONFERENCIA;
    } else if (Math.abs(diff) <= tol) {
      status = (ajusteCred || ajusteDeb) ? STATUS.COM_AJUSTE_POSTERIOR : STATUS.CONCILIADO;
    } else if (recebidoLiquido > tol && recebidoLiquido < expected - tol) {
      status = STATUS.RECEBIMENTO_PARCIAL;
    } else {
      status = STATUS.DIVERGENTE;
    }

    return {
      reconciliation_id: 'rc_' + marketplace + '_' + contaId + '_' + orderId,
      marketplace, marketplace_account_id: contaId, external_order_id: orderId,
      internal_order_id: order ? (order.internal_order_id || null) : null,
      order_created_at: order ? order.order_created_at || null : null,
      paid_at: order ? order.paid_at || null : null,
      delivered_at: order ? order.delivered_at || null : null,
      expected_release_at: prev.previstoTs != null ? new Date(prev.previstoTs).toISOString() : null,
      first_wallet_movement_at: temMovimento ? movs.map(m => m.occurred_at).sort()[0] : null,
      last_wallet_movement_at: ultimoMovTs ? new Date(ultimoMovTs).toISOString() : null,
      reconciliation_status: status,
      gross_order_value: order && order.gross_order_value != null ? round2(order.gross_order_value) : null,
      expected_net_value: expected,
      received_net_value: temMovimento ? recebidoLiquido : 0,
      pending_net_value: expected != null ? round2(Math.max(0, expected - recebidoLiquido)) : null,
      difference_value: diff,
      total_refund_value: reembolso,
      total_adjustment_value: round2(ajusteCred + ajusteDeb),
      total_anticipation_value: antecip,
      dias_restantes: prev.previstoTs != null && now != null && !passouPrazo ? Math.ceil((prev.limiteTs - now) / 86400000) : null,
      dias_atraso: passouPrazo ? Math.ceil((now - prev.limiteTs) / 86400000) : null,
      regra_usada: regra ? (regra.rule_name || regra.rule_id) : null,
      falta_regra: !!prev.faltaRegra,
      qtd_itens: order && order.itens ? order.itens.length : null,
      movimentos: movs,
      confidence: order ? (regra ? 'alta' : 'média') : 'baixa',
      source_coverage: temMovimento ? (order ? 'carteira+pedido' : 'só carteira') : 'só pedido',
    };
  }

  /* ---------- rateio de taxa por SKU (seção 12) ----------
     NÃO duplica comissão/taxa/frete: distribui o valor ÚNICO do pedido entre os itens. */
  const METODOS_RATEIO = ['Por valor bruto do item', 'Por quantidade', 'Por peso', 'Por valor líquido', 'Manual'];
  function ratearTaxaPorSku(valorTotalTaxa, itens, metodo) {
    metodo = metodo || 'Por valor bruto do item';
    const base = itens.map(it => {
      if (metodo === 'Por quantidade') return it.quantidade || 1;
      if (metodo === 'Por peso') return it.peso || 0;
      if (metodo === 'Por valor líquido') return it.valorLiquido || 0;
      return it.valorBruto != null ? it.valorBruto : (it.preco || 0) * (it.quantidade || 1);
    });
    const total = base.reduce((a, b) => a + b, 0);
    if (total <= 0) return { metodo, valorTotal: valorTotalTaxa, linhas: itens.map(it => ({ sku: it.sku, valor: null })), aviso: 'base de rateio zerada — não rateado' };
    let acc = 0;
    const linhas = itens.map((it, i) => {
      const v = i === itens.length - 1 ? round2(valorTotalTaxa - acc) : round2(valorTotalTaxa * base[i] / total);
      acc = round2(acc + v);
      return { sku: it.sku, participacao: round2((base[i] / total) * 100), valor: v };
    });
    return { metodo, valorTotal: round2(valorTotalTaxa), linhas, formula: `taxa única do pedido rateada ${metodo.toLowerCase()} — não duplicada por SKU` };
  }

  /* ---------- resumo / cards (seções 14) ---------- */
  function resumo(cases, txns, tesouraria, semPedido) {
    const soma = pred => round2(cases.filter(pred).reduce((a, c) => a + (c.received_net_value || 0), 0));
    const somaEsp = pred => round2(cases.filter(pred).reduce((a, c) => a + (c.expected_net_value || 0), 0));
    const st = s => cases.filter(c => c.reconciliation_status === s);
    const liberado = round2(txns.filter(t => t.transaction_type === 'SALE_RELEASE').reduce((a, t) => a + t.amount, 0));
    const reembolsos = round2(txns.filter(t => t.transaction_type === 'REFUND' || t.transaction_type === 'PARTIAL_REFUND').reduce((a, t) => a + t.amount, 0));
    const ajustesPos = round2(txns.filter(t => t.amount > 0 && /ADJUSTMENT_CREDIT|COMPENSATION/.test(t.transaction_type)).reduce((a, t) => a + t.amount, 0));
    const ajustesNeg = round2(txns.filter(t => t.amount < 0 && /ADJUSTMENT_DEBIT/.test(t.transaction_type)).reduce((a, t) => a + t.amount, 0));
    const aguardando = st(STATUS.AGUARDANDO_LIBERACAO);
    return {
      totalVendidoBruto: round2(cases.reduce((a, c) => a + (c.gross_order_value || 0), 0)),
      totalLiberadoCarteira: liberado,
      valorAguardandoLiberacao: somaEsp(c => c.reconciliation_status === STATUS.AGUARDANDO_LIBERACAO),
      valorAtrasado: somaEsp(c => c.reconciliation_status === STATUS.SEM_MOVIMENTO_ENCONTRADO || c.reconciliation_status === STATUS.ATRASADO),
      valorDivergente: round2(st(STATUS.DIVERGENTE).reduce((a, c) => a + Math.abs(c.difference_value || 0), 0)),
      valorReembolso: reembolsos,
      ajustesPositivos: ajustesPos,
      ajustesNegativos: ajustesNeg,
      qtdConciliados: st(STATUS.CONCILIADO).length + st(STATUS.COM_AJUSTE_POSTERIOR).length,
      qtdAguardando: aguardando.length,
      qtdAtrasados: st(STATUS.SEM_MOVIMENTO_ENCONTRADO).length + st(STATUS.ATRASADO).length,
      qtdDivergentes: st(STATUS.DIVERGENTE).length,
      qtdParciais: st(STATUS.RECEBIMENTO_PARCIAL).length,
      qtdRecebidoSemConferencia: st(STATUS.RECEBIDO_SEM_CONFERENCIA).length,
      qtdMovimentosSemPedido: semPedido.length,
      qtdTesouraria: tesouraria.length,
      qtdCasos: cases.length,
    };
  }

  /* baldes prontos para as abas da tela (seção 13) */
  function buckets(result) {
    const c = result.cases, is = s => c.filter(x => x.reconciliation_status === s);
    return {
      conciliados: is(STATUS.CONCILIADO).concat(is(STATUS.COM_AJUSTE_POSTERIOR)),
      aguardando: is(STATUS.AGUARDANDO_LIBERACAO).concat(is(STATUS.PREVISTO_PARA_LIBERACAO)),
      atrasados: is(STATUS.SEM_MOVIMENTO_ENCONTRADO).concat(is(STATUS.ATRASADO)),
      parciais: is(STATUS.RECEBIMENTO_PARCIAL),
      divergentes: is(STATUS.DIVERGENTE),
      reembolsados: is(STATUS.REEMBOLSADO),
      semMovimento: is(STATUS.SEM_MOVIMENTO_ENCONTRADO),
      recebidoSemConferencia: is(STATUS.RECEBIDO_SEM_CONFERENCIA),
      movimentosSemPedido: result.movimentosSemPedido,
      tesouraria: result.tesouraria,
      ajustes: result.transacoes.filter(t => /ADJUSTMENT|COMPENSATION|SHIPPING_DISCREPANCY|POST_REFUND/.test(t.transaction_type)),
    };
  }

  /* previsão de entrada por janela (seção 14.2) — sempre "PREVISTO COM BASE EM CICLO CONFIGURADO" */
  function previsaoEntrada(result, now) {
    now = typeof now === 'number' ? now : tsOf(now);
    const janela = { hoje: 0, d7: 0, d15: 0, d30: 0, atrasado: 0 };
    for (const c of result.cases) {
      if (c.reconciliation_status !== STATUS.AGUARDANDO_LIBERACAO && c.reconciliation_status !== STATUS.SEM_MOVIMENTO_ENCONTRADO) continue;
      const val = c.expected_net_value || 0;
      if (!c.expected_release_at) continue;
      const ts = tsOf(c.expected_release_at);
      if (now != null && ts < now) { janela.atrasado = round2(janela.atrasado + val); continue; }
      const dias = now != null ? (ts - now) / 86400000 : 0;
      if (dias <= 0) janela.hoje = round2(janela.hoje + val);
      else if (dias <= 7) janela.d7 = round2(janela.d7 + val);
      else if (dias <= 15) janela.d15 = round2(janela.d15 + val);
      else if (dias <= 30) janela.d30 = round2(janela.d30 + val);
    }
    return Object.assign(janela, { nota: 'PREVISTO COM BASE EM CICLO CONFIGURADO — não é certeza de recebimento.' });
  }

  return {
    SHOPEE_TX_HEADER, TX_TYPES, STATUS, METODOS_RATEIO, TESOURARIA,
    parseValor, classifyShopee, normalizeShopeeWallet, dedup, txKey,
    resolverRegra, previsaoLiberacao, reconcile, ratearTaxaPorSku,
    resumo, buckets, previsaoEntrada,
  };
}));

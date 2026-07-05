/* =============================================================
   V8PED — PEDIDOS (10.F.2): parser + identidade + expectativa + rateio
   + rentabilidade. Camada compartilhada (Node + navegador). Fonte oficial
   é o Postgres; aqui vive só a lógica pura, reaproveitada pelo backend e
   pela tela. Carteira = verdade; pedido + regra = expectativa. Nome de
   produto NUNCA é chave; sem custo cadastrado não se inventa lucro.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    typeof require === 'function' ? require('./conciliacao-engine.js') : null,
    typeof require === 'function' ? require('./lucro-engine.js') : null);
  else root.V8PED = factory(root.V8CONC, root.V8LUCRO);
}(typeof self !== 'undefined' ? self : this, function (V8CONC, V8LUCRO) {
  'use strict';

  /* cabeçalho real do export de Pedidos Shopee (uma linha por item do pedido) */
  const SHOPEE_ORDERS_HEADER = ['ID do pedido', 'Status do pedido', 'Data de criação do pedido',
    'Nome do Produto', 'Número de referência SKU', 'Quantidade', 'Valor Total', 'Cidade', 'UF'];

  /* sinônimos de coluna aceitos (o export varia entre versões) */
  const ALIAS = {
    'ID do pedido': ['Número do pedido', 'Order ID'],
    'Número de referência SKU': ['SKU de referência', 'SKU', 'Seller SKU'],
    'Data de pagamento': ['Hora do pagamento do pedido'],
    'Item ID': ['ID do Item', 'ID do anúncio'],
    'Variation ID': ['ID da variação', 'Variation ID'],
    'GTIN': ['GTIN', 'EAN', 'GTIN/EAN'],
    'Preço unitário': ['Preço acordado', 'Preço', 'Preço unitário'],
    'Subtotal do produto': ['Subtotal do produto', 'Subtotal'],
    'Data de entrega': ['Data de entrega', 'Hora de conclusão do pedido'],
    'Frete pago pelo comprador': ['Taxa de envio paga pelo comprador'],
  };
  const val = (obj, chave) => {
    if (obj[chave] != null && obj[chave] !== '') return obj[chave];
    for (const a of (ALIAS[chave] || [])) if (obj[a] != null && obj[a] !== '') return obj[a];
    return null;
  };
  const num = v => V8CONC ? V8CONC.parseValor(v) : (parseFloat(String(v || '').replace(/[^\d.-]/g, '')) || 0);
  const oid = v => (v == null || v === '' || v === '-') ? null : String(v).trim();

  /* localiza o cabeçalho real mesmo com linhas de preâmbulo */
  function localizarCabecalho(rows2d) {
    for (let i = 0; i < rows2d.length; i++) {
      const r = (rows2d[i] || []).map(c => String(c == null ? '' : c).trim());
      if (['ID do pedido', 'Status do pedido'].every(h => r.includes(h)) || (r.includes('ID do pedido') && r.includes('Número de referência SKU'))) return { headerRow: i, header: r };
    }
    return { headerRow: -1, header: SHOPEE_ORDERS_HEADER };
  }

  /* rows2d → pedidos com itens agrupados por ID do pedido (uma linha = um item) */
  function parseOrders(rows2d, ctx) {
    ctx = ctx || {};
    const { headerRow, header } = localizarCabecalho(rows2d);
    if (headerRow < 0) return { orders: [], headerRow, erro: 'cabeçalho de pedidos não encontrado' };
    const porPedido = new Map();
    rows2d.slice(headerRow + 1).forEach((r, i) => {
      const o = {}; header.forEach((h, j) => { o[h] = r[j]; });
      const ext = oid(val(o, 'ID do pedido'));
      if (!ext) return;
      if (!porPedido.has(ext)) {
        porPedido.set(ext, {
          external_order_id: ext, marketplace: ctx.marketplace || 'shopee', marketplace_account_id: ctx.contaId || null,
          company_id: ctx.empresaId || null, order_status: val(o, 'Status do pedido'),
          order_created_at: val(o, 'Data de criação do pedido'), paid_at: val(o, 'Data de pagamento'),
          delivered_at: val(o, 'Data de entrega'), buyer_city: val(o, 'Cidade'), buyer_state: val(o, 'UF'),
          buyer_shipping_paid: num(val(o, 'Frete pago pelo comprador')),
          valor_total_pedido: num(val(o, 'Valor Total')), currency: 'BRL',
          source_file: ctx.arquivo || null, source_sheet: ctx.aba || 'Pedidos', source_first_row: (ctx.baseRow || headerRow + 1) + i + 1,
          items: [], raw_rows: [],
        });
      }
      const ped = porPedido.get(ext);
      const qtd = num(val(o, 'Quantidade')) || 1;
      const unit = num(val(o, 'Preço unitário'));
      const subtotal = num(val(o, 'Subtotal do produto'));
      const grossItem = subtotal || (unit ? unit * qtd : null);
      ped.items.push({
        seller_sku: oid(val(o, 'Número de referência SKU')), product_name_original: val(o, 'Nome do Produto'),
        external_listing_id: oid(val(o, 'Item ID')), external_variation_id: oid(val(o, 'Variation ID')),
        gtin_ean: oid(val(o, 'GTIN')), quantity: qtd, unit_price: unit || null,
        gross_item_value: grossItem, source_row: (ctx.baseRow || headerRow + 1) + i + 1, raw: r,
      });
      ped.raw_rows.push(r);
    });
    /* valor bruto do pedido: soma dos itens quando houver; senão o "Valor Total" (nível pedido) */
    const orders = [...porPedido.values()].map(p => {
      const somaItens = p.items.reduce((a, it) => a + (it.gross_item_value || 0), 0);
      p.gross_products_value = somaItens > 0 ? Math.round(somaItens * 100) / 100 : (p.valor_total_pedido || null);
      p.qtd_itens = p.items.length;
      return p;
    });
    return { orders, headerRow, headerLen: header.length };
  }

  /* identidade do item: prioridade Item ID > Variation ID > SKU > GTIN > catálogo > revisão.
     Nome do produto NUNCA é chave definitiva. */
  const IDENT_PRIORIDADE = ['external_listing_id', 'external_variation_id', 'seller_sku', 'gtin_ean'];
  const IDENT_ROTULO = { external_listing_id: 'ITEM_ID', external_variation_id: 'VARIATION_ID', seller_sku: 'SELLER_SKU', gtin_ean: 'GTIN' };
  function identidadeItem(item, catalogoIndex) {
    for (const campo of IDENT_PRIORIDADE) {
      if (item[campo]) {
        const conf = catalogoIndex && catalogoIndex[campo] && catalogoIndex[campo][item[campo]];
        return { identity_origin: IDENT_ROTULO[campo], identity_confidence: conf ? 'alta' : (campo === 'seller_sku' ? 'média' : 'alta'),
          needs_review: false, chave: campo + ':' + item[campo], product_master_id: conf ? conf.product_master_id : null };
      }
    }
    /* nenhum identificador forte → NÃO vincula por nome; abre revisão */
    return { identity_origin: 'NENHUM', identity_confidence: 'baixa', needs_review: true, chave: null, product_master_id: null,
      motivo: 'sem Item ID/Variation ID/SKU/GTIN — nome de produto não é chave; enviado para revisão' };
  }

  /* expectativa financeira do pedido (sem substituir a carteira). Sem taxas
     cadastradas, declara o que falta — não inventa. */
  function expectativaFinanceira(order, taxas) {
    taxas = taxas || {};
    const bruto = order.gross_products_value;
    if (bruto == null) return { insuficiente: true, faltando: ['valor bruto dos itens'], expected_net_value: null };
    const faltando = [];
    const comissaoPct = taxas.comissaoPct, servicoPct = taxas.servicoPct, impostoPct = taxas.impostoPct;
    if (comissaoPct == null) faltando.push('comissão prevista');
    const comissao = comissaoPct != null ? bruto * comissaoPct / 100 : 0;
    const servico = servicoPct != null ? bruto * servicoPct / 100 : 0;
    const imposto = impostoPct != null ? bruto * impostoPct / 100 : 0;
    const taxaFixa = taxas.taxaFixa || 0;
    const descontos = (order.seller_discount_value || 0) + (order.coupon_value || 0) + (order.voucher_value || 0) + (order.pix_discount_value || 0);
    const freteVendedor = taxas.freteVendedor || 0;
    const expected = Math.round((bruto - descontos - comissao - servico - imposto - taxaFixa - freteVendedor + (order.buyer_shipping_paid || 0) * 0) * 100) / 100;
    return {
      insuficiente: faltando.length > 0 && comissaoPct == null,
      expected_net_value: expected, bruto, comissao: Math.round(comissao * 100) / 100, servico, imposto, taxaFixa, descontos,
      faltando, confianca: comissaoPct != null ? 'média' : 'baixa',
      formula: 'bruto − descontos − comissão − serviço − imposto − taxa fixa − frete vendedor = líquido esperado',
    };
  }

  /* rateio de uma taxa ÚNICA do pedido entre os itens (não duplica) — reusa V8CONC */
  function ratearPorItem(valorTotalTaxa, items, metodo) {
    if (!V8CONC) return { linhas: items.map(it => ({ sku: it.seller_sku, valor: null })), aviso: 'motor de rateio indisponível' };
    return V8CONC.ratearTaxaPorSku(valorTotalTaxa, items.map(it => ({ sku: it.seller_sku, valorBruto: it.gross_item_value, quantidade: it.quantity })), metodo);
  }

  /* rentabilidade por item usando recebimento líquido rateado + custos internos.
     Sem custo interno → SEM_DADOS_SUFICIENTES (não classifica como lucrativo). */
  function rentabilidadeItem(item, custos) {
    custos = custos || {};
    if (!V8LUCRO) return { classe: 'SEM_DADOS_SUFICIENTES', aviso: 'motor de lucratividade indisponível' };
    const c = V8LUCRO.contribuicaoSku({
      preco: item.unit_price || (item.gross_item_value && item.quantity ? item.gross_item_value / item.quantity : 0),
      custoProduto: custos.custoProduto, comissaoPct: custos.comissaoPct, impostoPct: custos.impostoPct,
      taxaFixa: custos.taxaFixa, embalagem: custos.embalagem, adsRateado: custos.adsRateado, fixoRateado: custos.fixoRateado,
      unidades30d: item.quantity,
    });
    return c;
  }

  return {
    SHOPEE_ORDERS_HEADER, ALIAS, localizarCabecalho, parseOrders,
    identidadeItem, IDENT_PRIORIDADE, expectativaFinanceira, ratearPorItem, rentabilidadeItem,
  };
}));

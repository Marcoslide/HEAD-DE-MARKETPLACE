/* =============================================================
   HEAD MARKETPLACE OS · v8 — IMPORT & SYNC ENGINE (UMD) · 10.I
   Porta de entrada de dados reais. Princípio central:
   IMPORTAÇÃO NÃO SOMA DADOS — CONCILIA, ATUALIZA, VERSIONA E EXPLICA.
   Perfis por assinatura de cabeçalho (nunca hardcode de uma empresa),
   fingerprint de arquivo, staging, chaves naturais, granularidade,
   deduplicação, sobreposição de período, vínculo por SKU, Anúncio
   Master e rollback por lote. Roda em Node (testes) e no navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8IMP = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOJE = '2026-07-04';
  /* hash determinístico (FNV-1a) — sem dado sensível, sem crypto */
  const hash = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return 'h' + h.toString(16); };

  const GRANULARIDADES = ['TRANSACTIONAL', 'STATE_SNAPSHOT', 'DAILY_METRIC', 'PERIOD_METRIC', 'PRODUCT_METRIC',
    'LISTING_METRIC', 'PROMOTION_METRIC', 'CHANNEL_ATTRIBUTION', 'FINANCIAL_SUMMARY', 'SERVICE_METRIC'];
  const FONTES = ['IMPORTACAO_MANUAL', 'PLANILHA_SHOPEE', 'PLANILHA_MERCADO_LIVRE', 'PLANILHA_TIKTOK',
    'PLANILHA_MAGALU', 'CSV_CUSTOMIZADO', 'API_OFICIAL', 'NORMALIZED_INTERNAL_DATA', 'DEMO_FIXTURE'];
  const JOB_ESTADOS = ['ARQUIVO_ENVIADO', 'EM_DETECÇÃO', 'AGUARDANDO_MAPEAMENTO', 'EM_STAGING', 'AGUARDANDO_REVISÃO',
    'CONFLITO_ENCONTRADO', 'PRONTO_PARA_APLICAR', 'APLICANDO', 'APLICADO', 'APLICADO_PARCIALMENTE',
    'BLOQUEADO', 'CANCELADO', 'REVERTIDO', 'FALHOU'];
  const VINCULO = ['VÍNCULO CONFIRMADO POR ID', 'VÍNCULO CONFIRMADO POR SKU', 'VÍNCULO SUGERIDO POR SKU',
    'VÍNCULO SUGERIDO POR NOME', 'CONFLITO DE SKU', 'SKU AUSENTE', 'SEM CORRESPONDÊNCIA', 'REVISÃO HUMANA NECESSÁRIA',
    'VÍNCULO DESATIVADO'];
  const MASTER_ESTADOS = ['MASTER SUGERIDO', 'MASTER CONFIRMADO MANUALMENTE', 'MASTER DEFINIDO POR REGRA',
    'MASTER BLOQUEADO POR CONFLITO', 'SEM MASTER DEFINIDO'];

  /* ---------------- perfis de importação (assinaturas, nunca hardcode) ---------------- */
  const P = (status, marketplace, gran, destino, assinatura, chave) => ({ status, marketplace, gran, destino, assinatura, chave });
  const PROFILES = {
    SHOPEE_PRODUCT_TRAFFIC: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'performance',
      ['ID do Item', 'Impressões de Produto', 'Cliques por Produto', 'Taxa de Conversão de Pedidos'], 'item_period'),
    SHOPEE_PRODUCT_OVERVIEW: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'performance',
      ['ID do Item', 'Visitantes do Produto', 'Pedidos Pagos', 'Vendas de Pedidos Pagos'], 'item_period'),
    SHOPEE_SALES_OVERVIEW: P('SUPPORTED', 'shopee', 'DAILY_METRIC', 'funil',
      ['Data', 'Visitantes', 'Pedidos Feitos', 'Pedidos Pagos', 'Vendas de Pedidos Pagos'], 'day_metric'),
    SHOPEE_SHOP_STATS: P('SUPPORTED', 'shopee', 'DAILY_METRIC', 'trafego',
      ['Visualizações da Página', 'Taxa de Devolução / Rejeição', 'Novos Visitantes'], 'day_metric'),
    SHOPEE_PROMOTION_SUMMARY: P('SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Nome da promoção', 'Tipo de promoção', 'Vendas de Pedidos Pagos'], 'promotion_period'),
    SHOPEE_PROMOTION_DETAIL: P('PARTIALLY_SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Nome da promoção', 'Itens principais', 'Combos'], 'promotion_period'),
    SHOPEE_VOUCHER: P('SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'cupons',
      ['Nome do Cupom', 'Código', 'Resgates', 'Vendas Pagas'], 'voucher_period'),
    SHOPEE_FLASH_SALE: P('PARTIALLY_SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Flash Sale', 'Período', 'Vendas'], 'promotion_period'),
    /* AUXILIAR: "Hot Listing" também aparece como coluna dentro do export de pedidos —
       nunca pode classificar um arquivo sozinha (só vence se NENHUM perfil forte qualificar) */
    SHOPEE_HOT_LISTING: P('REFERENCE_ONLY', 'shopee', 'LISTING_METRIC', 'performance',
      ['Hot Listing'], 'item_period'),
    SHOPEE_PARENT_SKU: P('SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['ID do Item', 'Nome do Produto', 'SKU Pai', 'SKU da variação', 'Preço', 'Estoque'], 'item_state'),
    SHOPEE_PRODUCT_BASIC_INFO: P('PARTIALLY_SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['ID do Item', 'Nome do Produto', 'Descrição'], 'item_state'),
    SHOPEE_PRODUCT_DIAGNOSTICS: P('REFERENCE_ONLY', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['Diagnóstico', 'ID do Item'], 'item_state'),
    /* 10.E.2 — chat vira SUPPORTED com assinatura do export real (nunca conversa privada, só métricas) */
    SHOPEE_CHAT_FAQ: P('SUPPORTED', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Data', 'Perguntas recebidas', 'Perguntas respondidas', 'Taxa de resposta'], 'day_metric'),
    SHOPEE_AI_ASSISTANT: P('REFERENCE_ONLY', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Perguntas transferidas ao vendedor'], 'day_metric'),
    SHOPEE_FINANCIAL_REFERENCE: P('REFERENCE_ONLY', 'shopee', 'FINANCIAL_SUMMARY', 'financeiro',
      ['Comissão', 'Repasse'], 'period_metric'),
    SHOPEE_CHANNEL_CONTRIBUTION: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'atribuicao',
      ['Vendas pelos Cards dos Produtos', 'Vendas pelas Lives', 'Vendas pelo Afiliado', 'Vendas pelos Anúncios'], 'period_metric'),
    CUSTOM_CSV_MAPPING: P('PARTIALLY_SUPPORTED', null, null, 'custom', [], 'custom'),
    /* ---------- 10.E.2 · fontes reais por área ---------- */
    SHOPEE_ORDERS: P('SUPPORTED', 'shopee', 'TRANSACTIONAL', 'pedidos',
      ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Nome do Produto',
        'Número de referência SKU', 'Quantidade', 'Valor Total', 'Cidade', 'UF'], 'order'),
    SHOPEE_RETURN_REFUND: P('SUPPORTED', 'shopee', 'TRANSACTIONAL', 'devolucoes',
      ['ID do pedido', 'Tipo de evento', 'ID do evento', 'Valor reembolsado'], 'order_event'),
    SHOPEE_INVENTORY: P('SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'estoque',
      ['SKU', 'Armazém', 'Disponível', 'Reservado'], 'stock_snapshot'),
    SHOPEE_AFFILIATE_PERFORMANCE: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'afiliados',
      ['Afiliado', 'Cliques', 'Vendas do Afiliado', 'Comissão'], 'period_metric'),
    SHOPEE_TRAFFIC_OVERVIEW: P('SUPPORTED', 'shopee', 'PERIOD_METRIC', 'trafego_visao',
      ['Visitantes', 'Visualizações da Página', 'Taxa de Rejeição', 'Período'], 'period_metric'),
    /* ---------- 10.E.2.3 · Métricas Principais Shopee (multiabas, blocos internos) ---------- */
    /* "Pedido Feito" e "Produto Pago" têm o MESMO cabeçalho — a aba é que separa a base.
       A linha consolidada (04/06/2026-03/07/2026) e as linhas diárias convivem no mesmo bloco;
       a classificação por linha (PERIOD_SUMMARY × DAILY_METRIC) acontece no staging. */
    SHOPEE_METRICAS_DIARIAS: P('SUPPORTED', 'shopee', 'DAILY_METRIC', 'metricas',
      ['Data', 'Vendas (BRL)', 'Pedidos', 'Visitantes', 'Taxa de Conversão de Pedidos', 'Vendas por Pedido'], 'day_metric'),
    /* Fontes de tráfego (Card do Produto, Recomendação, Pesquisar, Afiliado, Anúncios, Lives, Vídeos…) */
    SHOPEE_TRAFFIC_SOURCE: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'fonte_trafego',
      ['Fonte de Tráfego', 'Vendas', 'Impressões', 'Cliques', 'CTR'], 'period_metric'),
    /* Contribuição por produto (ID do Item + Produto + Status + métricas GENÉRICas: Impressões/Cliques,
       nunca "Impressões de Produto"/"Cliques por Produto" — esses são do perfil de performance) */
    SHOPEE_PRODUCT_CONTRIBUTION: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'contrib_produto',
      ['ID do Item', 'Produto', 'Status Atual do Item', 'Vendas', 'Impressões', 'Cliques', 'Pedidos', 'Unidades'], 'item_period'),
    /* ---------- 10.E.2.5 · fontes REAIS Shopee (cabeçalhos exatos dos exports) ---------- */
    /* Ads CPC — o CSV traz metadados antes do cabeçalho (tratado no file-reader) */
    SHOPEE_ADS: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'ads',
      ['Nome do Anúncio', 'Impressões', 'Cliques', 'GMV', 'Despesas', 'ROAS'], 'campaign'),
    /* Afiliados — AFILIADO.csv (atribuição por pedido, comissão, despesa, reembolso) */
    SHOPEE_AFFILIATE_REAL: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'afiliados',
      ['ID do pedido', 'Id de atribuição da comissão', 'Campanha do parceiro', 'Preço(R$)'], 'affiliate_attr'),
    /* Estoque Full — Current Inventory Report (abas Total / Warehouse Stock) */
    SHOPEE_INVENTORY_FULL: P('SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'estoque',
      ['Seller SKU ID', 'Warehouse SKU ID', 'Sellable', 'Reserved'], 'stock_snapshot'),
    /* Chat e Atendimento — export real (Métricas Principais / Tendências) */
    SHOPEE_CHAT_REAL: P('SUPPORTED', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Chats Respondidos', 'Chats Não-Respondidos', 'CSAT %', 'Tempo médio de resposta'], 'day_metric'),
    /* ---------- 10.E.2.5.1 · fontes REAIS com contrato TOTAL de campos ---------- */
    /* Performance de Produtos — export "Análise de Produtos" (por ID do Item + variação):
       tráfego, carrinho, vendas (pedido realizado/pago) por anúncio e variação. */
    SHOPEE_PRODUCT_PERFORMANCE: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'performance_item',
      ['ID do Item', 'SKU Principal', 'Impressão do Produto', 'Visitantes do Produto (Adicionar ao Carrinho)',
        'Vendas (Pedido Realizado) (BRL)', 'Vendas (Pedido Pago) (BRL)'], 'item_period'),
    /* Devoluções e Cancelamentos — export real (por ID da Devolução): reembolso, motivo,
       prazo, retorno ao armazém, produto/variação/SKU afetados. */
    SHOPEE_RETURNS_REAL: P('SUPPORTED', 'shopee', 'TRANSACTIONAL', 'devolucoes',
      ['ID da Devolução', 'ID do Pedido', 'Status da Devolução / Reembolso', 'Motivo da Devolução',
        'Quantia Total de Reembolsos'], 'order_event'),
  };

  /* ---------------- detecção por CONJUNTO de colunas (10.E.3.1) ----------------
     Correção crítica: um arquivo NUNCA é classificado pelo nome de uma única
     coluna secundária ("Hot Listing" é campo auxiliar do pedido, não o tipo do
     arquivo). A classificação usa: conjunto de colunas + peso por campo
     (identificador pesa 3×) + combinação mínima de evidências + prioridade
     entre perfis + pontuação explicável + correção manual pelo usuário. */
  const SINONIMOS = {
    'Número de referência SKU': ['SKU de referência', 'SKU'],
    'Data de pagamento': ['Hora do pagamento do pedido'],
    'Frete pago pelo comprador': ['Taxa de envio paga pelo comprador'],
  };
  /* identificadores (peso 3), evidência mínima e prioridade por perfil */
  const DETECT_RULES = {
    SHOPEE_ORDERS: { ident: ['ID do pedido', 'Status do pedido', 'Data de criação do pedido'], minIdent: 2, minHits: 4, prio: 10 },
    SHOPEE_RETURN_REFUND: { ident: ['Tipo de evento', 'ID do evento'], minIdent: 2, minHits: 3, prio: 9 },
    /* 10.E.2.3 — métricas/fontes/contribuição têm conjuntos de colunas disjuntos e prioridade própria */
    SHOPEE_METRICAS_DIARIAS: { ident: ['Data', 'Vendas (BRL)', 'Pedidos'], minIdent: 3, minHits: 4, prio: 9 },
    SHOPEE_TRAFFIC_SOURCE: { ident: ['Fonte de Tráfego'], minIdent: 1, minHits: 4, prio: 9 },
    SHOPEE_PRODUCT_CONTRIBUTION: { ident: ['ID do Item', 'Produto', 'Status Atual do Item', 'Impressões', 'Cliques'], minIdent: 5, minHits: 6, prio: 8 },
    /* 10.E.2.5 — fontes reais com identificadores próprios */
    SHOPEE_ADS: { ident: ['Nome do Anúncio', 'GMV', 'ROAS'], minIdent: 2, minHits: 4, prio: 9 },
    SHOPEE_AFFILIATE_REAL: { ident: ['Id de atribuição da comissão', 'Campanha do parceiro'], minIdent: 2, minHits: 3, prio: 9 },
    SHOPEE_INVENTORY_FULL: { ident: ['Seller SKU ID', 'Warehouse SKU ID', 'Sellable'], minIdent: 2, minHits: 3, prio: 9 },
    SHOPEE_CHAT_REAL: { ident: ['Chats Respondidos', 'CSAT %'], minIdent: 2, minHits: 3, prio: 9 },
    /* 10.E.2.5.1 — identificadores próprios das fontes reais de performance e devoluções */
    SHOPEE_PRODUCT_PERFORMANCE: { ident: ['ID do Item', 'SKU Principal', 'Impressão do Produto', 'Vendas (Pedido Pago) (BRL)'], minIdent: 3, minHits: 4, prio: 10 },
    SHOPEE_RETURNS_REAL: { ident: ['ID da Devolução', 'ID do Pedido', 'Motivo da Devolução'], minIdent: 2, minHits: 3, prio: 10 },
    SHOPEE_HOT_LISTING: { aux: true, prio: -1 }, /* só vence se NENHUM perfil forte qualificar */
  };
  const NOME_PERFIL = {
    SHOPEE_ORDERS: 'Pedidos Shopee', SHOPEE_RETURN_REFUND: 'Devoluções / Reembolsos / Cancelamentos',
    SHOPEE_PARENT_SKU: 'Cadastro de Produtos', SHOPEE_PRODUCT_BASIC_INFO: 'Cadastro de Produtos (básico)',
    SHOPEE_PRODUCT_TRAFFIC: 'Performance de Produtos', SHOPEE_PRODUCT_OVERVIEW: 'Performance de Produtos (overview)',
    SHOPEE_TRAFFIC_OVERVIEW: 'Tráfego', SHOPEE_SHOP_STATS: 'Métricas da Loja', SHOPEE_SALES_OVERVIEW: 'Vendas e Funil',
    SHOPEE_INVENTORY: 'Estoque Full', SHOPEE_AFFILIATE_PERFORMANCE: 'Afiliados', SHOPEE_CHAT_FAQ: 'Chat e Atendimento',
    SHOPEE_PROMOTION_SUMMARY: 'Promoções', SHOPEE_VOUCHER: 'Cupons', CUSTOM_CSV_MAPPING: 'Outro / Referência',
    SHOPEE_METRICAS_DIARIAS: 'Métricas Principais', SHOPEE_TRAFFIC_SOURCE: 'Fontes de Tráfego',
    SHOPEE_PRODUCT_CONTRIBUTION: 'Contribuição por Produto',
    SHOPEE_ADS: 'Ads (CPC)', SHOPEE_AFFILIATE_REAL: 'Afiliados', SHOPEE_INVENTORY_FULL: 'Estoque Full',
    SHOPEE_CHAT_REAL: 'Chat e Atendimento',
    SHOPEE_PRODUCT_PERFORMANCE: 'Performance de Produtos', SHOPEE_RETURNS_REAL: 'Devoluções e Cancelamentos',
  };
  /* nome amigável da base de métricas por aba */
  const NOME_BASE = { pedido_feito: 'Pedido Feito', produto_pago: 'Produto Pago' };
  const slugAba = nome => {
    const n = String(nome || '').toLowerCase();
    if (/pedido\s*feito|pedido\s*realizado|order\s*created/.test(n)) return 'pedido_feito';
    if (/produto\s*pago|pedido\s*pago|paid/.test(n)) return 'produto_pago';
    return n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'base';
  };
  /* mapeamento canônico das colunas de métricas principais (BR → campo) */
  const MET_COLS = {
    'Vendas (BRL)': 'gross_sales_brl', 'Vendas Sem os Descontos da Shopee': 'sales_before_shopee_discount_brl',
    'Pedidos': 'orders_created', 'Vendas por Pedido': 'revenue_per_order_brl',
    'Cliques Por Produto': 'product_clicks', 'Cliques por Produto': 'product_clicks', 'Visitantes': 'visitors',
    'Taxa de Conversão de Pedidos': 'order_conversion_rate', 'Pedidos Cancelados': 'cancelled_orders',
    'Vendas Canceladas': 'cancelled_sales_brl', 'Pedidos Devolvidos / Reembolsados': 'returned_or_refunded_orders',
    'Vendas Devolvidas / Reembolsadas': 'returned_or_refunded_sales_brl', '# de compradores': 'buyers',
    '# de novos compradores': 'new_buyers', '# de compradores existentes': 'returning_buyers',
    '# de compradores em potencial': 'potential_buyers', 'Repetir Índice de Compras': 'repeat_purchase_rate',
  };
  const FONTE_COLS = {
    'Vendas': 'sales', 'Impressões': 'impressions', 'Cliques': 'clicks', 'Pedidos': 'orders', 'Unidades': 'units',
    'CTR': 'ctr', 'Conversão': 'conversion', 'Taxa de Conversão': 'conversion', 'Vendas por Pedido': 'sales_per_order',
    'Vendas por pedido': 'sales_per_order', 'Compradores': 'buyers', 'Impressões únicas': 'unique_impressions',
    'Cliques únicos': 'unique_clicks',
  };
  const PROD_COLS = Object.assign({ 'Taxa de Vendas': 'sales_rate' }, FONTE_COLS);
  /* 10.E.2.5 — colunas reais dos exports Shopee */
  const ESTOQUE_COLS = {
    'Stock Level': 'stock_level', 'Sellable': 'sellable', 'Reserved': 'reserved', 'Unsellable': 'unsellable',
    'Recommend Replenishment Qty': 'recommend_replenishment', 'Coverage Days': 'coverage_days', 'Selling Speed': 'selling_speed',
    'Excess Qty': 'excess_qty', 'unitsSoldInLast7Days': 'sold_7d', 'unitsSoldInLast15Days': 'sold_15d',
    'unitsSoldInLast30Days': 'sold_30d', 'unitsSoldInLast60Days': 'sold_60d', 'unitsSoldInLast90Days': 'sold_90d',
    'Disponível': 'sellable', 'Reservado': 'reserved', 'Em trânsito': 'in_transit',
    /* 10.E.2.5.1 — colunas do Current Inventory Report completas (IR/ASN/aprovação) */
    'Pending IR Approval': 'pending_ir_approval', 'IR Approval': 'ir_approval', 'Pending ASN Inbound': 'pending_asn_inbound',
  };
  /* 10.E.2.5.1 — Performance de Produtos (Análise de Produtos): tráfego + carrinho + vendas por anúncio/variação */
  const PERF_ITEM_COLS = {
    'Impressão do Produto': 'impressions', 'Impressões de Produto': 'impressions', 'Impressões Únicas de Produto': 'unique_impressions',
    'Cliques Por Produto': 'clicks', 'Cliques por Produto': 'clicks', 'Cliques Únicos no Produto': 'unique_clicks', 'CTR': 'ctr',
    'Visitantes do Produto (Visita)': 'visitors', 'Visualizações da Página do Produto': 'page_views',
    'Visitantes que saíram da página': 'bounced_visitors', 'Taxa de Rejeição do Produto': 'bounce_rate',
    'Cliques em Buscas': 'search_clicks', 'Curtidas': 'likes',
    'Visitantes do Produto (Adicionar ao Carrinho)': 'cart_visitors', 'Unidades (Adicionar ao Carrinho)': 'cart_units',
    'Taxa de Conversão (Adicionar ao Carrinho)': 'cart_conversion',
    'Vendas (Pedido Realizado) (BRL)': 'sales_placed_brl', 'Vendas (Pedido Pago) (BRL)': 'sales_paid_brl',
    'Pedido Feito': 'orders_placed', 'Produto Pago': 'orders_paid',
    'Unidades (Pedido Realizado)': 'units_placed', 'Unidades (Pedido Pago)': 'units_paid',
    'Compradores (Pedido Realizado)': 'buyers_placed', 'Compradores (Pedido Pago)': 'buyers_paid',
    'Taxa de Conversão de Pedido (Pedido Realizado)': 'conv_placed', 'Taxa de Conversão de Pedido (Pedido Pago)': 'conv_paid',
    'Vendas por Pedido (Pedido Realizado) (BRL)': 'sales_per_order_placed_brl', 'Vendas por Pedido (Pedido Pago) (BRL)': 'sales_per_order_paid_brl',
  };
  /* 10.E.2.5.1 — Devoluções e Cancelamentos (export real por ID da Devolução) */
  const DEVOL_COLS = {
    'Preço da Unidade': 'unit_price_brl', 'Quantidade de Devoluções': 'return_qty',
    'Quantia Total de Reembolsos': 'refund_total_brl', 'Tempo Decorrido de Reembolso': 'refund_elapsed',
    'Tempo de Envio de Devolução': 'return_ship_time',
  };
  const ADS_COLS = {
    'Impressões': 'impressions', 'Cliques': 'clicks', 'CTR': 'ctr', 'Conversões': 'conversions',
    'Conversões Diretas': 'direct_conversions', 'Taxa de Conversão': 'conversion_rate', 'Itens Vendidos': 'items_sold',
    'GMV': 'gmv', 'Receita direta': 'direct_revenue', 'Receita Direta': 'direct_revenue', 'Despesas': 'ad_spend',
    'ROAS': 'roas', 'ROAS Direto': 'direct_roas', 'ACOS': 'acos', 'ACOS Direto': 'direct_acos',
    'Add to Cart': 'add_to_cart', 'Custo por Conversão': 'cost_per_conversion', 'Voucher Amount': 'voucher_amount',
  };
  const AFILIADO_COLS = {
    'Preço(R$)': 'price_brl', 'Qtd': 'qty', 'Valor da Compra(R$)': 'purchase_value_brl', 'Valor do reembolso(R$)': 'refund_value_brl',
    'Comissão do pedido da marca para o Afiliado(R$)': 'affiliate_commission_brl', 'Comissão do item da marca para o Afiliado(R$)': 'affiliate_item_commission_brl',
    'Taxa de serviço de Afiliados do Vendedor(R$)': 'affiliate_service_fee_brl', 'despesas(R$)': 'affiliate_expenses_brl',
  };
  /* números brasileiros — engine autossuficiente (mesma regra do V8FILE.parseBrNumber) */
  function brNum(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    if (s === '-' || s === '—' || /^n\/?a$/i.test(s)) return null;
    const pct = /%\s*$/.test(s);
    s = s.replace(/%/g, '').replace(/R\$\s*/i, '').replace(/\s+/g, '');
    if (s === '' || s === '-') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    if (isNaN(n)) return null;
    return pct ? Math.round((n / 100) * 1e6) / 1e6 : n;
  }
  const isoBr = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const rangeBr = s => { const m = String(s || '').match(/(\d{2}\/\d{2}\/\d{4})\s*[-–a]+\s*(\d{2}\/\d{2}\/\d{4})/); return m ? { ini: isoBr(m[1]), fim: isoBr(m[2]) } : null; };
  const normCols = (r, mapa) => { const o = {}; for (const [col, campo] of Object.entries(mapa)) if (r[col] != null && r[col] !== '') o[campo] = brNum(r[col]); return o; };

  function detect(file, opts) {
    opts = opts || {};
    const headers = (file.abas && file.abas[0] && file.abas[0].headers) || [];
    const has = col => headers.includes(col) || (SINONIMOS[col] || []).some(s => headers.includes(s));

    /* correção manual do usuário vence a automática — registrada como tal */
    if (opts.perfilManual && PROFILES[opts.perfilManual]) {
      const p = PROFILES[opts.perfilManual];
      return { perfil: opts.perfilManual, status: p.status, marketplace: p.marketplace, granularidade: p.gran,
        destino: p.destino, confianca: 1, confiancaLabel: 'definida pelo usuário',
        origemClassificacao: 'CORREÇÃO MANUAL DO TIPO', evidencias: p.assinatura.filter(has),
        explicacao: 'tipo de importação escolhido manualmente — a escolha fica na trilha de auditoria',
        periodo: file.periodo || null };
    }

    const candidatos = [];
    for (const [nome, p] of Object.entries(PROFILES)) {
      if (!p.assinatura.length) continue;
      const regra = DETECT_RULES[nome] || {};
      const ident = regra.ident || [];
      const identHits = ident.filter(has);
      const hits = p.assinatura.filter(has);
      const minIdent = regra.minIdent != null ? regra.minIdent : (ident.length ? Math.min(2, ident.length) : 0);
      const minHits = regra.minHits != null ? regra.minHits : Math.ceil(p.assinatura.length * 0.75);
      if (identHits.length < minIdent || hits.length < minHits) continue; /* combinação mínima de evidências */
      const pesoTotal = ident.length * 3 + Math.max(0, p.assinatura.length - ident.length);
      const pontos = identHits.length * 3 + Math.max(0, hits.length - identHits.length);
      candidatos.push({ nome, p, identHits, hits,
        score: Math.round((pontos / Math.max(1, pesoTotal)) * 100) / 100,
        prio: regra.prio || 0, aux: !!regra.aux });
    }
    if (!candidatos.length)
      return { perfil: 'UNKNOWN', status: 'UNSUPPORTED', confianca: 0, confiancaLabel: 'nenhuma',
        origemClassificacao: 'AUTOMÁTICA', evidencias: [],
        motivo: 'assinatura de cabeçalho não reconhecida — mapeie manualmente antes de importar' };

    /* perfil auxiliar (ex.: Hot Listing) nunca compete com assinatura forte */
    const fortes = candidatos.filter(c => !c.aux);
    const pool = (fortes.length ? fortes : candidatos)
      .sort((a, b) => (b.prio - a.prio) || (b.score - a.score) || (b.identHits.length - a.identHits.length) || (b.hits.length - a.hits.length));
    const best = pool[0];
    const identCompleto = best.identHits.length === ((DETECT_RULES[best.nome] || {}).ident || []).length;
    return {
      perfil: best.nome, status: best.p.status, marketplace: best.p.marketplace, granularidade: best.p.gran,
      destino: best.p.destino, confianca: best.score,
      confiancaLabel: identCompleto && best.score >= 0.75 ? 'alta' : best.score >= 0.6 ? 'média' : 'baixa',
      origemClassificacao: 'AUTOMÁTICA', evidencias: best.hits, identificadores: best.identHits,
      pontuacao: pool.slice(0, 3).map(c => ({ perfil: c.nome, score: c.score, evidencias: c.hits.length, prioridade: c.prio })),
      alternativas: pool.slice(1, 5).map(c => c.nome),
      explicacao: `identificadores: ${best.identHits.join(' · ') || 'nenhum exigido'} — campos reconhecidos: ${best.hits.join(' · ')}`,
      periodo: file.periodo || null,
    };
  }

  function fingerprintFile(file) {
    const content = JSON.stringify(file.abas);
    return {
      file_hash: hash(file.nome + '|' + content),
      content_hash: hash(content),
      sheet_signature: hash((file.abas || []).map(a => a.nome + ':' + (a.headers || []).join(',')).join('|')),
    };
  }

  /* ---------------- permissões de importação (sobre os papéis do 10.V) ---------------- */
  const IMPORT_PERMS = {
    OWNER: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY', 'IMPORT_ROLLBACK', 'IMPORT_MAPPING_MANAGE', 'MASTER_LISTING_APPROVE'],
    ADMIN: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY', 'IMPORT_MAPPING_MANAGE'],
    HEAD_MARKETPLACE: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY'],
    GESTOR_COMERCIAL: ['IMPORT_VIEW', 'IMPORT_REVIEW'],
    GESTOR_OPERACIONAL: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW'],
    CATALOGO: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW'],
    FINANCEIRO: ['IMPORT_VIEW'], EXPEDICAO: ['IMPORT_VIEW'], DESIGNER: [], CONSULTOR: ['IMPORT_VIEW'], LEITURA: ['IMPORT_VIEW'],
  };
  const canImp = (papel, perm) => (IMPORT_PERMS[papel] || []).includes(perm);

  /* ---------------- engine ---------------- */
  function createEngine() {
    return { batches: [], staging: [], snapshots: [], observations: [], masterLinks: [], conflicts: [], audit: [],
      fileHashes: new Map(), seq: 0,
      /* 10.E.2 — camada bruta preservada + linhas com erro (nenhuma coluna descartada silenciosamente) */
      rawFiles: [], rawErrors: [],
      /* 10.E.2.2 — base de dados e mapeamento: mapeamentos manuais versionados,
         campos excluídos da análise, impactos por importação e fila de revisão de relações */
      customMappings: [], camposExcluidos: {}, impactos: [], revisoesRelacao: [] };
  }
  const audit = (eng, acao, detalhe, extra) => eng.audit.push(Object.assign({ id: 'ia' + (++eng.seq), acao, detalhe, em: HOJE }, extra || {}));

  /* chaves naturais (contrato do sprint) */
  const KEYS = {
    order: r => ['ord', r.marketplace, r.contaId, r.external_order_id].join('|'),
    listing: r => ['lst', r.marketplace, r.contaId, r.item_id].join('|'),
    product: r => ['prd', r.companyId, r.sku_pai, r.sku_variacao || ''].join('|'),
    daily_item: r => ['dmi', r.marketplace, r.contaId, r.item_id, r.data, r.metric_type].join('|'),
    daily: r => ['dm', r.marketplace, r.contaId, r.data, r.metric_type].join('|'),
    period: r => ['pm', r.marketplace, r.contaId, r.item_id || '-', r.periodo_ini, r.periodo_fim, r.metric_type].join('|'),
    promotion: r => ['pro', r.marketplace, r.contaId, r.promotion_name, r.periodo_ini, r.periodo_fim].join('|'),
    voucher: r => ['vou', r.marketplace, r.contaId, r.voucher_code, r.periodo_ini, r.periodo_fim].join('|'),
    batch: f => ['imp', f.file_hash, f.sheet_signature].join('|'),
    /* 10.E.2 — chaves do contrato: evento de devolução/reembolso/cancelamento e leitura de estoque */
    event: r => ['evt', r.marketplace, r.contaId, r.external_order_id, r.tipo_evento, r.event_id || '-'].join('|'),
    stock: r => ['stk', r.marketplace, r.contaId, r.armazem, r.sku_ref, r.momento].join('|'),
  };
  function naturalKey(gran, r) {
    /* 10.E.2.3 — métricas principais: linha consolidada (período) nunca colide com linha diária */
    if (r.metric_type === 'metricas') {
      if (r.tipoLinha === 'PERIOD_SUMMARY' || gran === 'PERIOD_METRIC') return ['mp', r.marketplace, r.contaId, r.baseMetrica, r.periodo_ini, r.periodo_fim].join('|');
      return ['md', r.marketplace, r.contaId, r.baseMetrica, r.data].join('|');
    }
    if (r.metric_type === 'fonte_trafego') return ['ft', r.marketplace, r.contaId, r.sourceSheet || '', r.fonte, r.periodo_ini, r.periodo_fim].join('|');
    if (r.metric_type === 'contrib_produto') return ['cp', r.marketplace, r.contaId, r.sourceSheet || '', r.item_id, r.periodo_ini, r.periodo_fim].join('|');
    /* 10.E.2.5 — Ads por campanha+período; Afiliados por pedido+id de atribuição (nunca duplica) */
    if (r.metric_type === 'ads') return ['ad', r.marketplace, r.contaId, r.campanha, r.periodo_ini, r.periodo_fim].join('|');
    if (r.metric_type === 'afiliados') return ['af', r.marketplace, r.contaId, r.external_order_id || '-', r.attributionId || '-', r.item_id || '-'].join('|');
    /* PEDIDOS: marketplace + conta + ID do pedido = pedido único (nunca duplica) */
    if (r.metric_type === 'pedidos' && gran === 'TRANSACTIONAL') return KEYS.order(r);
    /* 10.E.2.5.1 — PERFORMANCE por anúncio: marketplace + conta + ID do Item + variação + período (nunca duplica) */
    if (r.metric_type === 'performance_item') return ['pi', r.marketplace, r.contaId, r.item_id, r.variacao_id || '-', r.periodo_ini, r.periodo_fim].join('|');
    /* DEVOLUÇÃO/REEMBOLSO/CANCELAMENTO: por ID da Devolução quando existir; senão + tipo + ID do evento */
    if (r.metric_type === 'devolucoes') return r.return_id ? ['ret', r.marketplace, r.contaId, r.return_id].join('|') : KEYS.event(r);
    /* ESTOQUE: + armazém + SKU + momento da leitura (cada leitura é um snapshot novo) */
    if (r.metric_type === 'estoque') return KEYS.stock(r);
    if (gran === 'DAILY_METRIC') return r.item_id ? KEYS.daily_item(r) : KEYS.daily(r);
    if (gran === 'PROMOTION_METRIC') return r.voucher_code ? KEYS.voucher(r) : KEYS.promotion(r);
    if (gran === 'STATE_SNAPSHOT') return KEYS.listing(r);
    if (gran === 'CHANNEL_ATTRIBUTION' || gran === 'FINANCIAL_SUMMARY') return KEYS.period({ ...r, metric_type: r.metric_type || gran });
    return KEYS.period(r); /* LISTING_METRIC / PERIOD_METRIC / PRODUCT_METRIC / SERVICE_METRIC */
  }

  /* vínculo de listing na ordem obrigatória: ID → SKU variação → SKU pai → nome */
  function linkRow(row, escopo, products, existingObs) {
    const porId = existingObs.find(o => o.marketplace === escopo.marketplace && o.contaId === escopo.contaId && o.item_id === row['ID do Item']);
    if (porId) return { estado: 'VÍNCULO CONFIRMADO POR ID', produtoId: porId.produtoId, confianca: 'alta' };
    const skuVar = row['SKU da variação'], skuPai = row['SKU Pai'] || row['SKU de referência'];
    if (skuVar || skuPai) {
      const matches = products.filter(p => (skuVar && p.sku === skuVar) || (skuPai && p.sku === skuPai));
      if (matches.length === 1)
        return { estado: 'VÍNCULO CONFIRMADO POR SKU', produtoId: matches[0].id, confianca: 'alta', via: skuVar && matches[0].sku === skuVar ? 'variação' : 'pai' };
      if (matches.length > 1)
        return { estado: 'CONFLITO DE SKU', produtoId: null, confianca: 'nula', motivo: `SKU aponta para ${matches.length} produtos — revisão humana necessária` };
    }
    const nome = row['Nome do Produto'] || row['Produto'];
    if (nome) {
      const tok = s => s.toLowerCase().replace(/[^\wà-ü]+/g, ' ').split(/\s+/).filter(w => w.length > 2);
      const t = tok(nome);
      let best = null, bestN = 0;
      for (const p of products) {
        const n = t.filter(x => tok(p.nome).includes(x)).length;
        if (n > bestN) { bestN = n; best = p; }
      }
      if (best && bestN >= 3) return { estado: 'VÍNCULO SUGERIDO POR NOME', produtoId: best.id, confianca: 'baixa', motivo: 'nome similar — nunca vincula automaticamente' };
    }
    return { estado: (skuVar || skuPai) ? 'SEM CORRESPONDÊNCIA' : 'SKU AUSENTE', produtoId: null, confianca: 'nula' };
  }

  /* separação demo × real (contrato do 10.V vale aqui) */
  function assertNoDemoMix(escopo, sourceType) {
    if (sourceType === 'DEMO_FIXTURE' && escopo.tipoDado === 'DADOS REAIS')
      throw new Error('dado demonstrativo não pode ser importado para empresa real — separação demo × real é absoluta');
    if (sourceType !== 'DEMO_FIXTURE' && escopo.tipoDado === 'DEMO')
      throw new Error('planilha real não pode ser importada para a árvore de demonstração');
    return true;
  }

  /* ---------------- staging multiabas / multiblocos (10.E.2.3) ----------------
     Cada aba pode conter vários blocos independentes. Cada bloco reconhecido
     vira um lote próprio, com aba+bloco na proveniência. Blocos vazios ou sem
     cabeçalho são declarados como preservados (referência), nunca importados. */
  function stageMulti(eng, file, escopo, opts) {
    const abasOut = [];
    const resumo = { abas: 0, blocos: 0, ignorados: 0, registros: 0, camposPreservados: 0, porTipo: {} };
    for (const aba of (file.abas || [])) {
      const blocos = (aba.blocos && aba.blocos.length) ? aba.blocos
        : [{ headers: aba.headers || [], rows: aba.rows || [], titulo: aba.titulo || null }];
      const blocosOut = [];
      blocos.forEach((bl, bi) => {
        const rotulo = bl.titulo || ('bloco ' + (bi + 1));
        if (!bl.headers || !bl.headers.length || !bl.rows || !bl.rows.length) {
          resumo.ignorados++;
          blocosOut.push({ ignorado: true, aba: aba.nome, bloco: rotulo,
            motivo: 'bloco vazio ou sem cabeçalho reconhecível — preservado como referência, não importado' });
          return;
        }
        const child = { nome: file.nome, tamanho: file.tamanho || null, formato: file.formato || null,
          sourceType: file.sourceType, periodo: bl.periodo || file.periodo || null, momento: file.momento || null,
          abas: [{ nome: aba.nome, headers: bl.headers.slice(), rows: bl.rows.slice(), titulo: bl.titulo || null }] };
        const b = stage(eng, child, escopo, opts);
        if (b && b.id) { b.abaOrigem = aba.nome; b.blocoOrigem = rotulo; }
        blocosOut.push(b);
        resumo.blocos++;
        const tipo = (b && b.det && b.det.destino) || (b && b.duplicado ? 'duplicado' : 'não reconhecido');
        const linhas = (b && b.linhas) || 0;
        resumo.porTipo[tipo] = (resumo.porTipo[tipo] || 0) + linhas;
        resumo.registros += linhas;
      });
      abasOut.push({ nome: aba.nome, blocos: blocosOut, reconhecidos: blocosOut.filter(b => b && b.id).length });
      resumo.abas++;
    }
    const campos = new Set();
    (file.abas || []).forEach(a => ((a.blocos && a.blocos.length) ? a.blocos : [{ headers: a.headers }])
      .forEach(b => (b.headers || []).forEach(h => h && campos.add(h))));
    resumo.camposPreservados = campos.size;
    const batches = abasOut.flatMap(a => a.blocos.filter(b => b && b.id));
    audit(eng, 'importacao_multiaba', `${file.nome}: ${resumo.abas} aba(s), ${resumo.blocos} bloco(s) reconhecido(s), ${resumo.ignorados} preservado(s)`);
    return { multi: true, arquivo: file.nome, tamanho: file.tamanho || null, periodo: file.periodo || null,
      abas: abasOut, resumo, batches,
      nota: 'arquivo multiabas — cada bloco reconhecido virou um lote próprio com aba e bloco na proveniência.' };
  }

  /* ---------------- staging ---------------- */
  function stage(eng, file, escopo, opts) {
    opts = opts || {};
    for (const k of ['companyId', 'lojaId', 'contaId', 'marketplace'])
      if (!escopo[k]) throw new Error('escopo incompleto: falta ' + k + ' — importação exige Grupo→Empresa→CNPJ→Loja→Conta');
    assertNoDemoMix(escopo, file.sourceType || 'PLANILHA_SHOPEE');

    /* 10.E.2 — ZIP: extração acontece NO STAGING; só entradas reconhecidas viram lote,
       o resto é declarado como ignorado (nunca finge importar) */
    if (file.zip) {
      const batches = [], ignorados = [];
      for (const ent of (file.entries || [])) {
        if (ent.abas && ent.abas.length && ent.abas[0].headers && ent.abas[0].headers.length) {
          const child = { nome: file.nome + '::' + ent.nome, sourceType: file.sourceType, periodo: ent.periodo || file.periodo || null, abas: ent.abas };
          batches.push(stage(eng, child, escopo, opts));
        } else ignorados.push({ nome: ent.nome, motivo: ent.motivo || 'entrada não reconhecida como planilha (XLSX/CSV) — mantida no arquivo original, não importada' });
      }
      audit(eng, 'zip_extraido_no_staging', `${file.nome}: ${batches.length} entrada(s) reconhecida(s), ${ignorados.length} ignorada(s)`);
      return { zip: true, arquivo: file.nome, batches, ignorados,
        nota: 'ZIP extraído em staging — cada planilha reconhecida virou um lote próprio com confirmação humana.' };
    }

    /* 10.E.2.3 — arquivo com várias abas OU aba com vários blocos internos:
       cada bloco reconhecido vira um lote próprio (mesmo princípio do ZIP),
       carregando aba/bloco na proveniência. Nunca é tratado como tabela plana. */
    const temMultiplasAbas = (file.abas || []).length > 1;
    const temMultiplosBlocos = (file.abas || []).some(a => a.blocos && a.blocos.length > 1);
    if (temMultiplasAbas || temMultiplosBlocos) return stageMulti(eng, file, escopo, opts);

    const fp = fingerprintFile(file);
    const det = detect(file, { perfilManual: opts.perfilManual });
    const batchKey = KEYS.batch({ ...fp });
    if (eng.fileHashes.has(batchKey)) {
      const prev = eng.fileHashes.get(batchKey);
      audit(eng, 'arquivo_duplicado_recusado', file.nome + ' já importado no lote ' + prev);
      return { duplicado: true, estado: 'BLOQUEADO', motivo: 'ARQUIVO JÁ IMPORTADO — nenhum dado novo será aplicado. Revise a importação anterior (' + prev + ').', batchAnterior: prev };
    }
    const batch = {
      id: 'imp' + (++eng.seq), arquivo: file.nome, fp, det, escopo: { ...escopo },
      sourceType: file.sourceType || 'PLANILHA_SHOPEE', periodo: file.periodo || null,
      estado: 'EM_DETECÇÃO', enviadoPor: opts.usuario || 'Marcos', em: HOJE,
      mappingVersion: 'v1', linhas: 0, preview: null, aplicado: null,
    };
    eng.batches.push(batch);
    /* camada bruta: TODAS as abas, colunas e linhas do arquivo original ficam preservadas */
    eng.rawFiles.push({ batchId: batch.id, nome: file.nome, tamanho: file.tamanho || null, formato: file.formato || null,
      abas: (file.abas || []).map(a => ({ nome: a.nome, headers: (a.headers || []).slice(), rows: (a.rows || []).slice() })),
      colunas: (file.abas && file.abas[0] && file.abas[0].headers || []).length, em: HOJE });
    audit(eng, 'arquivo_enviado', file.nome, { batchId: batch.id, escopo: batch.escopo });

    if (det.perfil === 'UNKNOWN') {
      batch.estado = 'AGUARDANDO_MAPEAMENTO';
      batch.preview = { perfil: 'UNKNOWN', motivo: det.motivo, aplicavel: false };
      return batch;
    }
    if (PROFILES[det.perfil].status === 'REFERENCE_ONLY' || PROFILES[det.perfil].status === 'UNSUPPORTED') {
      batch.estado = 'BLOQUEADO';
      batch.preview = { perfil: det.perfil, status: PROFILES[det.perfil].status, aplicavel: false,
        motivo: 'perfil ' + PROFILES[det.perfil].status + ' — o sistema não finge importar o que ainda não entende' };
      return batch;
    }

    /* staging linha a linha com proveniência completa */
    const rows = file.abas[0].rows || [];
    const gran = det.granularidade;
    const products = opts.products || [];
    let vincConfirmadoId = 0, vincConfirmadoSku = 0, vincSugerido = 0, conflitos = 0, semMatch = 0, pendentes = 0, linhasComErro = 0;
    const stagingRows = [];
    rows.forEach((r, i) => {
      /* linha sem chave obrigatória NÃO é descartada em silêncio: vai para "linhas com erro" com motivo */
      const skuEstoque = r['SKU'] || r['Seller SKU ID'] || r['Warehouse SKU ID'] || r['Shop SKU ID'];
      const armazemEstoque = r['Armazém'] || r['Warehouse'] || (det.perfil === 'SHOPEE_INVENTORY_FULL' ? 'Full' : null);
      const pedidoDevol = r['ID do pedido'] || r['ID do Pedido'];
      const perfItemId = r['ID do Item'];
      const semChave = det.destino === 'pedidos' && !r['ID do pedido'] ? 'ID do pedido ausente'
        : det.destino === 'devolucoes' && !pedidoDevol ? 'ID do pedido ausente no evento'
        : det.destino === 'performance_item' && !perfItemId ? 'ID do Item ausente na performance'
        : det.destino === 'estoque' && !(skuEstoque && armazemEstoque) ? 'SKU/Armazém ausente' : null;
      if (semChave) {
        linhasComErro++;
        eng.rawErrors.push({ batchId: batch.id, linha: i + 1, motivo: semChave, raw: r, arquivo: file.nome });
        return;
      }
      const base = {
        batchId: batch.id, linha: i + 1, raw: r,
        groupId: escopo.groupId || null, companyId: escopo.companyId, cnpjId: escopo.cnpjId || null,
        lojaId: escopo.lojaId, marketplace: escopo.marketplace, contaId: escopo.contaId,
        sourceType: batch.sourceType, sourceFile: file.nome, sourceSheet: file.abas[0].nome, sourceRow: i + 1,
        reportType: det.perfil, periodo_ini: (file.periodo || {}).ini || r['Data'] || null,
        periodo_fim: (file.periodo || {}).fim || r['Data'] || null,
        importadoEm: HOJE, mappingVersion: batch.mappingVersion,
        rawFingerprint: hash(JSON.stringify(r)), granularidade: gran, confianca: det.confianca,
      };
      /* 10.E.2 — campos por destino */
      if (det.destino === 'pedidos') {
        base.external_order_id = String(r['ID do pedido']);
        base.data = r['Data de criação do pedido'] || null;
      } else if (det.destino === 'devolucoes') {
        base.external_order_id = String(pedidoDevol);
        base.tipo_evento = r['Tipo de evento'] || r['Tipo de Devolução'] || 'DEVOLUÇÃO';
        base.event_id = r['ID do evento'] != null ? String(r['ID do evento']) : null;
        /* 10.E.2.5.1 — export real de devoluções: chave por ID da Devolução + campos completos */
        if (r['ID da Devolução'] != null) {
          base.return_id = String(r['ID da Devolução']);
          base.sku_pai = r['SKU Principal'] || null; base.sku_variacao = r['SKU da Variação'] || null;
          base.produtoNome = r['Nome do Produto'] || null; base.variacaoNome = r['Nome da Variação'] || null;
          base.motivo = r['Motivo da Devolução'] || null; base.statusDevol = r['Status da Devolução / Reembolso'] || null;
          base.retornoArmazem = r['Retorno ao Armazém Shopee'] || null;
          base.metricas = normCols(r, DEVOL_COLS);
        }
      } else if (det.destino === 'performance_item') {
        /* 10.E.2.5.1 — Performance por anúncio/variação: identidade prioritária ID do Item + variação + SKU */
        base.item_id = String(perfItemId);
        base.variacao_id = r['ID da Variação'] != null ? String(r['ID da Variação']) : null;
        base.sku_pai = r['SKU Principal'] || null; base.sku_variacao = r['SKU da Variação'] || null;
        base.produtoNome = r['Produto'] || null; base.variacaoNome = r['Nome da Variação'] || null;
        base.statusItem = r['Status Atual do Item'] || null; base.statusVariacao = r['Status Atual da Variação'] || null;
        base.metricas = normCols(r, PERF_ITEM_COLS);
      } else if (det.destino === 'estoque') {
        base.armazem = armazemEstoque; base.sku_ref = skuEstoque;
        base.momento = r['Momento da leitura'] || file.momento || ((file.periodo || {}).fim) || HOJE;
        base.metricas = normCols(r, ESTOQUE_COLS);
        base.produtoNome = r['Product Name'] || r['Nome do Produto'] || null;
        /* 10.E.2.5.1 — identidade completa do snapshot Full (todos os SKUs, variação, barcode) */
        base.variacaoNome = r['Variations'] || r['Variação'] || null; base.sku_variacao = skuEstoque;
        base.warehouseSkuId = r['Warehouse SKU ID'] || null; base.shopSkuId = r['Shop SKU ID'] || null;
        base.barcode = r['Barcode'] || null; base.fulfillMode = r['Fulfill Mapping Mode'] || null;
      } else if (det.destino === 'ads') {
        /* 10.E.2.5 — Ads: campanha explica atribuição/custo, NUNCA soma no faturamento */
        base.campanha = r['Nome do Anúncio'] || r['Campanha'] || ('campanha ' + (i + 1));
        base.item_id = base.campanha;
        base.metricas = normCols(r, ADS_COLS);
      } else if (det.destino === 'afiliados') {
        /* 10.E.2.5 — Afiliados: atribuição por pedido + id de comissão (nunca duplica faturamento) */
        base.external_order_id = r['ID do pedido'] != null ? String(r['ID do pedido']) : null;
        base.attributionId = r['Id de atribuição da comissão'] != null ? String(r['Id de atribuição da comissão']) : null;
        base.item_id = r['ID do Produto'] != null ? String(r['ID do Produto']) : (r['Afiliado'] || base.external_order_id);
        base.campanha = r['Campanha do parceiro'] || r['Afiliado'] || null;
        base.metricas = normCols(r, AFILIADO_COLS);
      } else if (det.destino === 'fonte_trafego') {
        /* 10.E.2.3 — tabela de fontes de tráfego: cada linha é uma fonte (Card, Afiliado, Ads…) */
        base.fonte = r['Fonte de Tráfego'] || r['Fonte'] || r['Origem'] || ('fonte ' + (i + 1));
        base.item_id = base.fonte;
        base.metricas = normCols(r, FONTE_COLS);
        base.classeFonte = /afiliado/i.test(base.fonte) ? 'afiliados' : /anúncio|anuncio|\bads\b/i.test(base.fonte) ? 'ads' : 'trafego';
      } else if (gran === 'CHANNEL_ATTRIBUTION') {
        base.item_id = r['ID do Item'] || r['Afiliado'] || null;
      }
      /* 10.E.2.3 — contribuição por produto: mapeia métricas BR e mantém vínculo por ID/SKU */
      if (det.destino === 'contrib_produto') {
        base.produtoNome = r['Produto'] || null;
        base.statusItem = r['Status Atual do Item'] || null;
        base.metricas = normCols(r, PROD_COLS);
      }
      if ((gran === 'STATE_SNAPSHOT' || gran === 'LISTING_METRIC') && det.destino !== 'estoque') {
        base.item_id = r['ID do Item'] != null ? String(r['ID do Item']) : null;
        const v = linkRow(r, escopo, products, eng.observations);
        base.vinculo = v;
        if (v.estado === 'VÍNCULO CONFIRMADO POR ID') vincConfirmadoId++;
        else if (v.estado === 'VÍNCULO CONFIRMADO POR SKU') vincConfirmadoSku++;
        else if (v.estado === 'VÍNCULO SUGERIDO POR NOME') { vincSugerido++; pendentes++; }
        else if (v.estado === 'CONFLITO DE SKU') { conflitos++; pendentes++; }
        else { semMatch++; if (det.destino === 'contrib_produto') pendentes++; }
      }
      /* 10.E.2.3 — MÉTRICAS PRINCIPAIS: classificação por linha (nunca por posição).
         A linha consolidada (04/06/2026-03/07/2026) vira PERIOD_SUMMARY e NUNCA entra
         em gráfico diário; datas únicas viram DAILY_METRIC; o resto é RAW_REFERENCE. */
      if (det.destino === 'metricas') {
        base.baseMetrica = slugAba(file.abas[0].nome);
        base.nomeBase = NOME_BASE[base.baseMetrica] || file.abas[0].nome;
        base.metricas = normCols(r, MET_COLS);
        const rng = rangeBr(r['Data']);
        if (rng) {
          base.tipoLinha = 'PERIOD_SUMMARY'; base.granularidade = 'PERIOD_METRIC';
          base.periodo_ini = rng.ini; base.periodo_fim = rng.fim; base.granLabel = 'período (agregada)'; base.data = null;
        } else {
          const iso = isoBr(r['Data']) || (typeof r['Data'] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r['Data']) ? r['Data'] : null);
          if (iso) { base.tipoLinha = 'DAILY_METRIC'; base.granularidade = 'DAILY_METRIC'; base.data = iso; base.periodo_ini = iso; base.periodo_fim = iso; base.granLabel = 'diária'; }
          else { base.tipoLinha = 'RAW_REFERENCE'; base.granularidade = 'PERIOD_METRIC'; base.granLabel = 'referência preservada'; base.data = null; }
        }
      } else if (gran === 'DAILY_METRIC') base.data = r['Data'];
      if (gran === 'PROMOTION_METRIC') { base.promotion_name = r['Nome da promoção']; base.voucher_code = r['Código']; }
      base.metric_type = det.destino;
      base.granularidade = base.granularidade || gran;
      base.normalizedFingerprint = hash(naturalKey(base.granularidade, base) + '|' + JSON.stringify(r));
      stagingRows.push(base);
    });
    eng.staging.push(...stagingRows);
    batch.linhas = stagingRows.length;

    /* conciliação: o que já existe, o que sobrepõe */
    let jaExistem = 0, sobreposicao = null;
    for (const s of stagingRows) {
      const k = naturalKey(s.granularidade, s);
      if (eng.snapshots.some(x => x.key === k)) jaExistem++;
    }
    if (file.periodo && (gran === 'LISTING_METRIC' || gran === 'PERIOD_METRIC' || gran === 'DAILY_METRIC')) {
      const overlaps = eng.snapshots.filter(x => x.escopo && x.escopo.contaId === escopo.contaId && x.granularidade !== gran &&
        x.periodo_ini && x.periodo_fim && !(x.periodo_fim < file.periodo.ini || x.periodo_ini > file.periodo.fim));
      const same = eng.batches.filter(b => b.id !== batch.id && b.aplicado && b.det.perfil !== det.perfil && b.periodo &&
        !(b.periodo.fim < file.periodo.ini || b.periodo.ini > file.periodo.fim));
      const prevSame = eng.batches.filter(b => b.id !== batch.id && b.aplicado && b.det.perfil === det.perfil && b.periodo &&
        !(b.periodo.fim < file.periodo.ini || b.periodo.ini > file.periodo.fim));
      if (prevSame.length || overlaps.length || same.length) {
        const p = prevSame[0] || {};
        sobreposicao = {
          aviso: prevSame.length ? `importação anterior (${p.id}) cobre parte do mesmo período — linhas idênticas serão atualizadas, nunca somadas`
            : 'há métricas de outra granularidade cobrindo o mesmo intervalo — não serão somadas entre si',
          periodoAnterior: p.periodo || null,
          intervaloSobreposto: p.periodo ? { ini: p.periodo.ini > file.periodo.ini ? p.periodo.ini : file.periodo.ini, fim: p.periodo.fim < file.periodo.fim ? p.periodo.fim : file.periodo.fim } : null,
        };
      }
    }

    batch.preview = {
      perfil: det.perfil, tipo: det.destino, marketplace: det.marketplace, granularidade: gran,
      periodo: file.periodo || null, registros: stagingRows.length,
      vinculosPorId: vincConfirmadoId, vinculosPorSku: vincConfirmadoSku, sugeridosPorNome: vincSugerido,
      pendentesRevisao: pendentes, conflitos, semCorrespondencia: semMatch, jaExistem, sobreposicao, linhasComErro,
      aplicavel: true, acoes: ['Importar apenas itens novos', 'Atualizar registros existentes', 'Revisar conflitos', 'Salvar como rascunho', 'Cancelar'],
    };
    batch.preview.perfilNome = NOME_PERFIL[det.perfil] || det.perfil;
    batch.preview.confiancaLabel = det.confiancaLabel;
    batch.preview.evidencias = det.evidencias || [];
    batch.preview.alternativas = det.alternativas || [];
    batch.preview.origemClassificacao = det.origemClassificacao;
    batch.preview.aba = file.abas[0].nome;
    batch.preview.titulo = file.abas[0].titulo || null;
    /* 10.E.2.3 — blocos por tipo de linha (resumo de período × diárias × fontes × produtos) */
    if (det.destino === 'metricas') {
      batch.preview.blocos = {
        resumoPeriodo: stagingRows.filter(s => s.tipoLinha === 'PERIOD_SUMMARY').length,
        metricasDiarias: stagingRows.filter(s => s.tipoLinha === 'DAILY_METRIC').length,
        referencia: stagingRows.filter(s => s.tipoLinha === 'RAW_REFERENCE').length,
      };
      batch.preview.base = NOME_BASE[slugAba(file.abas[0].nome)] || file.abas[0].nome;
    } else if (det.destino === 'fonte_trafego') batch.preview.blocos = { fontes: stagingRows.length };
    else if (det.destino === 'contrib_produto') batch.preview.blocos = { produtos: stagingRows.length };
    batch.estado = conflitos ? 'CONFLITO_ENCONTRADO' : 'AGUARDANDO_REVISÃO';
    eng.fileHashes.set(batchKey, batch.id);
    audit(eng, 'staging_concluido', `${batch.id}: ${stagingRows.length} linha(s), ${conflitos} conflito(s), ${jaExistem} já existente(s)`);
    return batch;
  }

  /* ---------------- correção manual do tipo (reclassificação) ----------------
     O usuário pode trocar o tipo de importação ANTES de aplicar: o lote antigo
     é cancelado (trilha preservada), o fingerprint é liberado e o arquivo é
     re-estagiado com o perfil escolhido — registrado como CORREÇÃO MANUAL. */
  function reclassify(eng, batchId, novoPerfil, opts) {
    opts = opts || {};
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) return { blocked: true, reason: 'lote não encontrado' };
    if (batch.aplicado) return { blocked: true, reason: 'lote já aplicado — reverta (rollback) antes de reclassificar' };
    if (!PROFILES[novoPerfil]) return { blocked: true, reason: 'tipo de importação desconhecido: ' + novoPerfil };
    const rf = eng.rawFiles.find(x => x.batchId === batchId);
    if (!rf) return { blocked: true, reason: 'camada bruta do lote não encontrada' };
    batch.estado = 'CANCELADO';
    batch.reclassificadoPara = novoPerfil;
    eng.fileHashes.delete(KEYS.batch({ ...batch.fp }));
    eng.staging = eng.staging.filter(s => s.batchId !== batchId);
    audit(eng, 'tipo_corrigido_manualmente', `${batchId}: ${batch.det.perfil} → ${novoPerfil} (por ${opts.usuario || 'Marcos'})`, { batchId });
    const novo = stage(eng, { nome: batch.arquivo, sourceType: batch.sourceType, periodo: batch.periodo, abas: rf.abas },
      batch.escopo, Object.assign({}, opts, { perfilManual: novoPerfil }));
    return { ok: true, batch: novo, anterior: batchId };
  }

  /* ---------------- aplicação (idempotente, nunca soma) ---------------- */
  function apply(eng, batchId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'IMPORT_APPLY'))
      return { blocked: true, reason: `papel ${opts.papel} não possui IMPORT_APPLY — peça a um ADMIN/OWNER` };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) throw new Error('lote não encontrado');
    if (!batch.preview || !batch.preview.aplicavel)
      return { blocked: true, reason: 'lote não aplicável: ' + (batch.preview ? batch.preview.motivo : 'sem prévia') };
    batch.estado = 'APLICANDO';
    const rows = eng.staging.filter(s => s.batchId === batchId);
    let criados = 0, atualizados = 0, ignorados = 0, duplicadosEvitados = 0, conflitosPulados = 0;
    for (const s of rows) {
      if (s.vinculo && s.vinculo.estado === 'CONFLITO DE SKU') {
        conflitosPulados++;
        if (!eng.conflicts.some(c => c.item_id === s.item_id && c.batchId === batchId))
          eng.conflicts.push({ id: 'cf' + (++eng.seq), batchId, item_id: s.item_id, motivo: s.vinculo.motivo, estado: 'REVISÃO HUMANA NECESSÁRIA' });
        continue;
      }
      const key = naturalKey(s.granularidade, s);
      const existing = eng.snapshots.find(x => x.key === key);
      if (existing) {
        if (existing.normalizedFingerprint === s.normalizedFingerprint) { duplicadosEvitados++; continue; } /* idêntico → nada */
        existing.versoes.push({ raw: existing.raw, batchId: existing.batchId, em: existing.atualizadoEm }); /* preserva versão */
        existing.raw = s.raw; existing.batchId = batchId; existing.normalizedFingerprint = s.normalizedFingerprint;
        existing.atualizadoEm = HOJE; existing.origem = origemDe(s.sourceType);
        atualizados++; continue; /* ATUALIZA, nunca soma */
      }
      /* granularidade agregada NUNCA cria pedido individual;
         evento de devolução/cancelamento NUNCA cria pedido novo — vira order_event cruzado por ID */
      const snap = {
        id: 'ms' + (++eng.seq), key,
        entidade: s.metric_type === 'devolucoes' ? 'order_event'
          : s.granularidade === 'TRANSACTIONAL' ? 'order' : 'metric_snapshot',
        granularidade: s.granularidade, explicativa: ['CHANNEL_ATTRIBUTION', 'PROMOTION_METRIC', 'FINANCIAL_SUMMARY'].includes(s.granularidade),
        raw: s.raw, item_id: s.item_id || null, data: s.data || null,
        external_order_id: s.external_order_id || null, tipo_evento: s.tipo_evento || null, event_id: s.event_id || null,
        armazem: s.armazem || null, sku_ref: s.sku_ref || null, momento: s.momento || null,
        /* 10.E.2.3 — métricas normalizadas + proveniência de aba/bloco/linha */
        metricas: s.metricas || null, tipoLinha: s.tipoLinha || null, baseMetrica: s.baseMetrica || null,
        nomeBase: s.nomeBase || null, fonte: s.fonte || null, classeFonte: s.classeFonte || null,
        campanha: s.campanha || null, attributionId: s.attributionId || null,
        produtoNome: s.produtoNome || null, statusItem: s.statusItem || null,
        /* 10.E.2.5.1 — identidade completa preservada no snapshot (performance/devoluções/estoque full) */
        variacao_id: s.variacao_id || null, variacaoNome: s.variacaoNome || null, statusVariacao: s.statusVariacao || null,
        sku_pai: s.sku_pai || null, sku_variacao: s.sku_variacao || null,
        return_id: s.return_id || null, statusDevol: s.statusDevol || null, motivo: s.motivo || null, retornoArmazem: s.retornoArmazem || null,
        warehouseSkuId: s.warehouseSkuId || null, shopSkuId: s.shopSkuId || null, barcode: s.barcode || null, fulfillMode: s.fulfillMode || null,
        sourceSheet: s.sourceSheet || null, granLabel: s.granLabel || null, vinculo: s.vinculo || null,
        periodo_ini: s.periodo_ini, periodo_fim: s.periodo_fim, metric_type: s.metric_type,
        escopo: { companyId: s.companyId, cnpjId: s.cnpjId, lojaId: s.lojaId, contaId: s.contaId, marketplace: s.marketplace },
        sourceType: s.sourceType, sourceFile: s.sourceFile, reportType: s.reportType,
        origem: origemDe(s.sourceType), batchId, importadoEm: HOJE, atualizadoEm: HOJE,
        normalizedFingerprint: s.normalizedFingerprint, confianca: s.confianca, versoes: [],
      };
      eng.snapshots.push(snap);
      criados++;
      /* listing observado + candidato a master link */
      if ((s.granularidade === 'STATE_SNAPSHOT' || s.granularidade === 'LISTING_METRIC') && s.item_id) {
        let obs = eng.observations.find(o => o.marketplace === s.marketplace && o.contaId === s.contaId && o.item_id === s.item_id);
        if (!obs) {
          obs = { id: 'lo' + (++eng.seq), item_id: s.item_id, marketplace: s.marketplace, contaId: s.contaId, lojaId: s.lojaId,
            nome: s.raw['Nome do Produto'] || s.raw['Produto'] || 'item ' + s.item_id,
            skuPai: s.raw['SKU Pai'] || null, skuVariacao: s.raw['SKU da variação'] || null,
            status: s.raw['Status Atual do Item'] || null,
            produtoId: s.vinculo ? s.vinculo.produtoId : null, vinculo: s.vinculo ? s.vinculo.estado : 'SKU AUSENTE',
            /* 10.E.2.3 — métricas BR já normalizadas (contribuição por produto) têm prioridade sobre o bruto */
            vendasPagas: (s.metricas && s.metricas.sales) || +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas'] || 0,
            unidadesPagas: (s.metricas && s.metricas.units) || +s.raw['Unidades Pagas'] || +s.raw['Unidades'] || 0,
            pedidos: (s.metricas && s.metricas.orders) || null,
            conversao: (s.metricas && s.metricas.conversion) || +s.raw['Taxa de Conversão de Pedidos'] || null,
            ctr: (s.metricas && s.metricas.ctr) || +s.raw['CTR'] || null,
            contribProduto: s.metric_type === 'contrib_produto' ? s.metricas : null,
            origem: origemDe(s.sourceType), batchId, master: 'SEM MASTER DEFINIDO' };
          eng.observations.push(obs);
        } else {
          if (s.metricas && s.metricas.sales != null) obs.vendasPagas = s.metricas.sales;
          else if (+s.raw['Vendas'] || +s.raw['Vendas de Pedidos Pagos']) obs.vendasPagas = +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas'] || obs.vendasPagas;
          if (s.metric_type === 'contrib_produto' && s.metricas) obs.contribProduto = s.metricas;
          if (s.metricas && s.metricas.ctr != null) obs.ctr = s.metricas.ctr;
          else if (s.raw['CTR']) obs.ctr = +s.raw['CTR'];
          if (s.vinculo && s.vinculo.produtoId && !obs.produtoId) { obs.produtoId = s.vinculo.produtoId; obs.vinculo = s.vinculo.estado; }
        }
      }
    }
    batch.aplicado = { criados, atualizados, ignorados, duplicadosEvitados, conflitos: conflitosPulados,
      aprovadoPor: opts.usuario || 'Marcos', em: HOJE };
    batch.estado = conflitosPulados ? 'APLICADO_PARCIALMENTE' : 'APLICADO';
    audit(eng, 'lote_aplicado', `${batchId}: ${criados} criado(s), ${atualizados} atualizado(s), ${duplicadosEvitados} duplicado(s) evitado(s), ${conflitosPulados} conflito(s) pulado(s)`,
      { batchId, escopo: batch.escopo, perfil: batch.det.perfil, mappingVersion: batch.mappingVersion });
    return { job: batch };
  }
  const origemDe = st => st === 'API_OFICIAL' ? 'DADO REAL VIA API' : st === 'DEMO_FIXTURE' ? 'DADO SIMULADO' : 'DADO IMPORTADO VIA PLANILHA';

  /* ---------------- rollback por lote (preserva o que veio depois) ---------------- */
  function rollback(eng, batchId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'IMPORT_ROLLBACK'))
      return { blocked: true, reason: `papel ${opts.papel} não possui IMPORT_ROLLBACK` };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch || !batch.aplicado) return { blocked: true, reason: 'lote não aplicado — nada a reverter' };
    let removidos = 0, preservados = 0, restaurados = 0;
    eng.snapshots = eng.snapshots.filter(snap => {
      if (snap.batchId === batchId) {
        const anterior = snap.versoes.length ? snap.versoes[snap.versoes.length - 1] : null;
        if (anterior && anterior.batchId !== batchId) {
          snap.raw = anterior.raw; snap.batchId = anterior.batchId; snap.versoes.pop(); restaurados++;
          return true;
        }
        removidos++; return false;
      }
      /* registro atualizado por lote POSTERIOR não pode ser apagado */
      if (snap.versoes.some(v => v.batchId === batchId)) {
        snap.versoes = snap.versoes.filter(v => v.batchId !== batchId);
        preservados++;
      }
      return true;
    });
    eng.observations = eng.observations.filter(o => o.batchId !== batchId);
    batch.estado = 'REVERTIDO';
    audit(eng, 'lote_revertido', `${batchId}: ${removidos} removido(s), ${restaurados} restaurado(s) à versão anterior, ${preservados} posterior(es) preservado(s)`, { batchId });
    return { removidos, restaurados, preservados };
  }

  /* ---------------- receita consolidada: nunca conta duas vezes ---------------- */
  function receitaConsolidada(eng, escopo) {
    /* só o funil de vendas conta como receita; atribuição/promoção/cupom/financeiro EXPLICAM */
    let receita = 0; const explicacoes = [];
    for (const s of eng.snapshots) {
      if (escopo && escopo.contaId && s.escopo.contaId !== escopo.contaId) continue;
      const v = +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas Pagas'] || 0;
      if (s.explicativa) { if (v || s.granularidade === 'CHANNEL_ATTRIBUTION') explicacoes.push({ tipo: s.granularidade, fonte: s.reportType, valor: v || null }); continue; }
      if (s.granularidade === 'DAILY_METRIC' && s.metric_type === 'funil') receita += v;
    }
    return { receita: Math.round(receita * 100) / 100, explicacoes, nota: 'atribuição, promoção, cupom e financeiro explicam a receita — nunca somam de novo' };
  }

  /* ---------------- Anúncio Master ---------------- */
  function suggestMaster(eng, produtoId) {
    const list = eng.observations.filter(o => o.produtoId === produtoId &&
      ['VÍNCULO CONFIRMADO POR SKU', 'VÍNCULO CONFIRMADO POR ID'].includes(o.vinculo));
    if (!list.length) return { estado: 'SEM MASTER DEFINIDO', motivo: 'nenhum anúncio com vínculo confiável de SKU' };
    if (eng.conflicts.some(c => list.some(o => o.item_id === c.item_id) && c.estado !== 'RESOLVIDO'))
      return { estado: 'MASTER BLOQUEADO POR CONFLITO', motivo: 'há conflito de SKU aberto neste produto' };
    /* prioridade: vendas pagas → unidades → conversão → CTR → status saudável */
    const rank = [...list].sort((a, b) =>
      (b.vendasPagas - a.vendasPagas) || (b.unidadesPagas - a.unidadesPagas) ||
      ((b.conversao || 0) - (a.conversao || 0)) || ((b.ctr || 0) - (a.ctr || 0)));
    const top = rank.find(o => !/bloquead|banido|deleted/i.test(o.status || '')) || rank[0];
    let link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link) { link = { id: 'ml' + (++eng.seq), produtoId, itemId: top.item_id, estado: 'MASTER SUGERIDO', criterio: 'vendas pagas validadas no período comparável', em: HOJE }; eng.masterLinks.push(link); }
    else if (link.estado === 'MASTER SUGERIDO') { link.itemId = top.item_id; }
    return { estado: link.estado, itemId: link.itemId, ranking: rank.map(o => ({ item_id: o.item_id, vendasPagas: o.vendasPagas, conversao: o.conversao, ctr: o.ctr })) };
  }
  function approveMaster(eng, produtoId, itemId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'MASTER_LISTING_APPROVE'))
      return { blocked: true, reason: `papel ${opts.papel} não possui MASTER_LISTING_APPROVE` };
    let link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link) { link = { id: 'ml' + (++eng.seq), produtoId, em: HOJE }; eng.masterLinks.push(link); }
    link.itemId = itemId; link.estado = 'MASTER CONFIRMADO MANUALMENTE'; link.aprovadoPor = opts.usuario || 'Marcos';
    audit(eng, 'master_confirmado', `${produtoId} → item ${itemId} (manual)`);
    /* referência estratégica: NÃO existe função de sobrescrever preço/estoque/conteúdo de loja */
    return { link, nota: 'Anúncio Master é referência estratégica — não sobrescreve preço, estoque nem conteúdo de nenhuma loja.' };
  }

  /* cobertura por loja/conta (para Home, Conexões e Crescimento) */
  function coverage(eng) {
    const out = {};
    for (const b of eng.batches.filter(x => x.aplicado)) {
      const k = b.escopo.lojaId + '|' + b.escopo.contaId;
      if (!out[k]) out[k] = { lojaId: b.escopo.lojaId, contaId: b.escopo.contaId, marketplace: b.escopo.marketplace, fontes: [], periodos: [], ultima: null, linhas: 0, conflitos: 0, duplicadosEvitados: 0 };
      const c = out[k];
      if (!c.fontes.includes(b.det.perfil)) c.fontes.push(b.det.perfil);
      if (b.periodo) c.periodos.push(b.periodo);
      c.ultima = b.aplicado.em; c.linhas += b.aplicado.criados + b.aplicado.atualizados;
      c.conflitos += b.aplicado.conflitos; c.duplicadosEvitados += b.aplicado.duplicadosEvitados;
    }
    return Object.values(out);
  }

  /* =============================================================
     10.E.2 — PEDIDOS, ESTOQUE, EVENTOS, CORREÇÕES E MESA DE INTELIGÊNCIA
     Nenhuma análise apresenta número sem fonte. Nenhuma edição sem motivo.
     Nenhuma exclusão apaga a camada bruta.
     ============================================================= */

  /* ---------- permissões de dados (enforcement no motor, nunca só botão) ---------- */
  const DATA_PERMS_ALL = ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'DATA_SOURCE_EDIT_SCOPE', 'DATA_SOURCE_ARCHIVE',
    'DATA_SOURCE_ROLLBACK', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT', 'ORDER_EDIT_CORRECTION', 'ORDER_ARCHIVE',
    'PRODUCT_EDIT', 'MASTER_LINK_EDIT', 'METRIC_CORRECTION', 'INTELLIGENCE_VIEW',
    /* 10.E.2.2 — base de dados e mapeamento */
    'FIELD_MAPPING_EDIT', 'IMPORT_REPROCESS', 'INTELLIGENCE_SOURCE_VIEW', 'INTELLIGENCE_RULE_EDIT',
    'PRODUCT_IMPORT_APPLY', 'CATALOG_RAW_FIELDS_VIEW'];
  const DATA_PERMS = {
    OWNER: DATA_PERMS_ALL.slice(),
    ADMIN: DATA_PERMS_ALL.slice(),
    HEAD_MARKETPLACE: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'DATA_SOURCE_EDIT_SCOPE', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT',
      'ORDER_EDIT_CORRECTION', 'PRODUCT_EDIT', 'MASTER_LINK_EDIT', 'METRIC_CORRECTION', 'INTELLIGENCE_VIEW',
      'FIELD_MAPPING_EDIT', 'IMPORT_REPROCESS', 'INTELLIGENCE_SOURCE_VIEW', 'INTELLIGENCE_RULE_EDIT', 'PRODUCT_IMPORT_APPLY', 'CATALOG_RAW_FIELDS_VIEW'],
    GESTOR_COMERCIAL: ['DATA_SOURCE_VIEW', 'RAW_DATA_VIEW', 'INTELLIGENCE_VIEW', 'INTELLIGENCE_SOURCE_VIEW'],
    GESTOR_OPERACIONAL: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'RAW_DATA_VIEW', 'ORDER_EDIT_CORRECTION', 'INTELLIGENCE_VIEW', 'INTELLIGENCE_SOURCE_VIEW', 'CATALOG_RAW_FIELDS_VIEW'],
    CATALOGO: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'RAW_DATA_VIEW', 'PRODUCT_EDIT', 'INTELLIGENCE_VIEW', 'PRODUCT_IMPORT_APPLY', 'CATALOG_RAW_FIELDS_VIEW'],
    FINANCEIRO: ['DATA_SOURCE_VIEW', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT', 'INTELLIGENCE_VIEW', 'INTELLIGENCE_SOURCE_VIEW'],
    EXPEDICAO: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
    DESIGNER: [],
    CONSULTOR: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
    LEITURA: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
  };
  const canData = (papel, perm) => (DATA_PERMS[papel] || []).includes(perm);
  const negar = (papel, perm) => ({ blocked: true, reason: `papel ${papel} não possui ${perm} — a barreira é no motor, não no botão` });

  /* ---------- pedidos: visão única por marketplace+conta+ID ---------- */
  const orderTab = st => {
    st = String(st || '');
    if (/não pago|nao pago/i.test(st)) return 'Não pagos';
    if (/a enviar|prepara/i.test(st)) return 'A enviar';
    if (/enviado|em rota|trânsito|transporte/i.test(st)) return 'Enviados';
    if (/concluíd|entregue/i.test(st)) return 'Concluídos';
    if (/cancelad/i.test(st)) return 'Cancelados';
    if (/falha/i.test(st)) return 'Falhas de Entrega';
    return 'Outros';
  };
  const cepProtegido = cep => cep == null ? null : (String(cep).replace(/\D/g, '').slice(0, 5) || '—') + '-***';

  function ordersView(eng, filtro) {
    filtro = filtro || {};
    const dentro = s => (!filtro.contaId || s.escopo.contaId === filtro.contaId) &&
      (!filtro.lojaId || s.escopo.lojaId === filtro.lojaId) &&
      (!filtro.marketplace || s.escopo.marketplace === filtro.marketplace);
    const eventos = eng.snapshots.filter(s => s.entidade === 'order_event' && dentro(s));
    const orders = eng.snapshots.filter(s => s.entidade === 'order' && s.metric_type === 'pedidos' && dentro(s)).map(snap => {
      const statusAtual = valorEfetivo(snap, 'Status do pedido');
      const evs = eventos.filter(e => e.escopo.marketplace === snap.escopo.marketplace &&
        e.escopo.contaId === snap.escopo.contaId && e.external_order_id === snap.external_order_id);
      const rw = snap.raw;
      return {
        key: snap.key, id: snap.external_order_id,
        marketplace: snap.escopo.marketplace, contaId: snap.escopo.contaId, lojaId: snap.escopo.lojaId, cnpjId: snap.escopo.cnpjId,
        produto: rw['Nome do Produto'], sku: rw['Número de referência SKU'] || rw['SKU de referência'] || rw['SKU'] || null,
        variacao: rw['Nome da variação'] || null, quantidade: +rw['Quantidade'] || null,
        valorTotal: +rw['Valor Total'] || 0,
        frete: +rw['Frete pago pelo comprador'] || +rw['Taxa de envio paga pelo comprador'] || 0,
        comissao: rw['Taxa de comissão'] != null ? +rw['Taxa de comissão'] : null,
        /* mapeamento obrigatório do export real de pedidos (10.E.3.1) */
        precoOriginal: rw['Preço original'] != null ? +rw['Preço original'] : null,
        precoAcordado: rw['Preço acordado'] != null ? +rw['Preço acordado'] : null,
        subtotal: rw['Subtotal do produto'] != null ? +rw['Subtotal do produto'] : null,
        descontos: rw['Descontos'] != null ? +rw['Descontos'] : null,
        cupom: rw['Cupom'] || null, peso: rw['Peso'] || null,
        taxas: { transacao: rw['Taxa de transação'] != null ? +rw['Taxa de transação'] : null,
          comissao: rw['Taxa de comissão'] != null ? +rw['Taxa de comissão'] : null,
          servico: rw['Taxa de serviço'] != null ? +rw['Taxa de serviço'] : null,
          envioReversa: rw['Taxa de envio reversa'] != null ? +rw['Taxa de envio reversa'] : null },
        totalGlobal: rw['Total global'] != null ? +rw['Total global'] : null,
        freteEstimado: rw['Valor estimado do frete'] != null ? +rw['Valor estimado do frete'] : null,
        rastreamento: rw['Número de rastreamento'] || null,
        envio: { opcao: rw['Opção de envio'] || null, metodo: rw['Método de envio'] || null,
          previsto: rw['Data prevista de envio'] || null },
        cancelamentoMotivo: rw['Cancelar Motivo'] || null,
        devolucaoStatus: rw['Status da Devolução / Reembolso'] || null,
        hotListing: rw['Hot Listing'] || null, /* campo AUXILIAR do pedido — nunca define o tipo do arquivo */
        observacaoComprador: rw['Observação do comprador'] || null, nota: rw['Nota'] || null,
        pais: rw['País'] || null,
        cidade: rw['Cidade'] || null, estado: rw['UF'] || null, cepParcial: cepProtegido(rw['CEP']),
        comprador: rw['Comprador'] || null, /* exibição exige RAW_DATA_VIEW — decisão na view, dado protegido */
        statusAtual, tab: orderTab(statusAtual),
        statusHistory: [...snap.versoes.map(v => ({ status: v.raw['Status do pedido'], em: v.em, batchId: v.batchId })),
          { status: rw['Status do pedido'], em: snap.atualizadoEm, batchId: snap.batchId }],
        datas: { criacao: rw['Data de criação do pedido'] || null,
          pagamento: rw['Data de pagamento'] || rw['Hora do pagamento do pedido'] || null,
          envio: rw['Data de envio'] || null,
          entrega: rw['Data de entrega'] || rw['Domestic Delivered Date'] || null,
          cancelamento: rw['Data da Finalização do Cancelamento'] || null },
        eventos: evs.map(e => ({ tipo: e.tipo_evento, eventId: e.event_id, motivo: e.raw['Motivo'] || null,
          valor: +e.raw['Valor reembolsado'] || 0, situacao: e.raw['Status da solicitação'] || null, em: e.raw['Data'] || e.importadoEm })),
        origem: snap.origem, arquivo: snap.sourceFile, ultimaAtualizacao: snap.atualizadoEm,
        correcoes: snap.correcoes || [], excluido: snap.excluidoDaAnalise || null,
      };
    });
    const idsExistentes = new Set(orders.map(o => [o.marketplace, o.contaId, o.id].join('|')));
    const eventosOrfaos = eventos.filter(e => !idsExistentes.has([e.escopo.marketplace, e.escopo.contaId, e.external_order_id].join('|')))
      .map(e => ({ orderId: e.external_order_id, tipo: e.tipo_evento, eventId: e.event_id, arquivo: e.sourceFile,
        estado: 'SEM PEDIDO CORRESPONDENTE', nota: 'evento nunca cria pedido novo — aguarda a importação do pedido de origem' }));
    return { orders: filtro.incluirExcluidos ? orders : orders.filter(o => !o.excluido), eventosOrfaos,
      todos: orders };
  }

  /* conversão sempre com fórmula e denominador explícitos — nunca um % solto */
  function conversaoExplicita(numerador, denominador, formula) {
    if (numerador == null || denominador == null || denominador === 0)
      return { taxa: null, formula, motivo: 'denominador ausente — conversão não é exibida sem fórmula e base explícitas' };
    return { taxa: Math.round((numerador / denominador) * 10000) / 100, formula, numerador, denominador };
  }

  function orderStats(eng, filtro) {
    const v = ordersView(eng, filtro);
    const os = v.orders;
    const por = tab => os.filter(o => o.tab === tab).length;
    const pagos = os.filter(o => !['Não pagos', 'Cancelados'].includes(o.tab));
    const faturamento = Math.round(pagos.reduce((a, o) => a + o.valorTotal, 0) * 100) / 100;
    const naoPagoValor = Math.round(os.filter(o => o.tab === 'Não pagos').reduce((a, o) => a + o.valorTotal, 0) * 100) / 100;
    const devolucoes = os.filter(o => o.eventos.some(e => /devolu|reembolso/i.test(e.tipo))).length;
    const batches = eng.batches.filter(b => b.aplicado && b.det.destino === 'pedidos' && !b.arquivado);
    const fontes = batches.map(b => ({ arquivo: b.arquivo, perfil: b.det.perfil, periodo: b.periodo,
      linhas: b.linhas, ultima: b.aplicado.em, escopo: b.escopo,
      qualidade: { conflitos: b.aplicado.conflitos, duplicadosEvitados: b.aplicado.duplicadosEvitados,
        linhasComErro: (b.preview && b.preview.linhasComErro) || 0 } }));
    return {
      kpis: {
        pedidos: os.length, naoPagos: por('Não pagos'), aEnviar: por('A enviar'), enviados: por('Enviados'),
        concluidos: por('Concluídos'), cancelados: por('Cancelados'), devolucoes, falhasEntrega: por('Falhas de Entrega'),
        faturamentoAprovado: faturamento, valorNaoPago: naoPagoValor,
        ticketMedio: pagos.length ? Math.round((faturamento / pagos.length) * 100) / 100 : null,
        unidades: os.reduce((a, o) => a + (o.quantidade || 0), 0),
        cidades: new Set(os.map(o => o.cidade).filter(Boolean)).size,
        estados: new Set(os.map(o => o.estado).filter(Boolean)).size,
        taxaCancelamento: conversaoExplicita(por('Cancelados'), os.length, 'cancelados ÷ pedidos importados'),
      },
      fontes, cobertura: { contas: [...new Set(os.map(o => o.contaId))], lojas: [...new Set(os.map(o => o.lojaId))] },
      eventosOrfaos: v.eventosOrfaos,
      semDados: !os.length,
    };
  }

  /* análise geográfica — nunca expõe dado pessoal; prazo só quando as datas existem */
  function geoStats(eng, filtro, dim) {
    const os = ordersView(eng, filtro).orders;
    const grupos = {};
    for (const o of os) {
      const k = dim === 'cidade' ? (o.cidade || '—') + ' · ' + (o.estado || '—') : (o.estado || '—');
      const g = grupos[k] = grupos[k] || { chave: k, pedidos: 0, faturamento: 0, cancelados: 0, devolucoes: 0, prazos: [], porProduto: {} };
      g.pedidos++;
      if (!['Não pagos', 'Cancelados'].includes(o.tab)) g.faturamento += o.valorTotal;
      if (o.tab === 'Cancelados') g.cancelados++;
      if (o.eventos.some(e => /devolu|reembolso/i.test(e.tipo))) g.devolucoes++;
      if (o.datas.envio && o.datas.entrega) g.prazos.push((new Date(o.datas.entrega) - new Date(o.datas.envio)) / 86400000);
      if (o.produto) g.porProduto[o.produto] = (g.porProduto[o.produto] || 0) + 1;
    }
    return Object.values(grupos).map(g => ({
      chave: g.chave, pedidos: g.pedidos, faturamento: Math.round(g.faturamento * 100) / 100,
      ticket: g.pedidos ? Math.round((g.faturamento / g.pedidos) * 100) / 100 : null,
      produtoTop: Object.entries(g.porProduto).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || null,
      taxaCancelamento: conversaoExplicita(g.cancelados, g.pedidos, 'cancelados ÷ pedidos do local'),
      taxaDevolucao: conversaoExplicita(g.devolucoes, g.pedidos, 'pedidos com devolução ÷ pedidos do local'),
      prazoMedioDias: g.prazos.length ? Math.round((g.prazos.reduce((a, x) => a + x, 0) / g.prazos.length) * 10) / 10 : null,
      prazoNota: g.prazos.length ? `base: ${g.prazos.length} entrega(s) com data` : 'SEM DADOS de envio/entrega — prazo não inventado',
    })).sort((a, b) => b.faturamento - a.faturamento);
  }

  /* ---------- estoque: snapshot por armazém+SKU+momento; o mais recente é o atual ---------- */
  function stockView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'estoque' &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId) && !s.excluidoDaAnalise);
    const porChave = {};
    for (const s of snaps) {
      const k = [s.escopo.marketplace, s.escopo.contaId, s.armazem, s.sku_ref].join('|');
      (porChave[k] = porChave[k] || []).push(s);
    }
    /* 10.E.2.5.1 — lê Sellable/Reserved/Unsellable reais (via metricas) e não só 'Disponível' legado */
    const mval = (s, campo, colLegada) => {
      const m = s.metricas || {};
      if (m[campo] != null) return +m[campo] || 0;
      const leg = colLegada ? valorEfetivo(s, colLegada) : null;
      return leg != null ? (+leg || 0) : 0;
    };
    const atual = [], historico = [];
    for (const lista of Object.values(porChave)) {
      lista.sort((a, b) => String(a.momento).localeCompare(String(b.momento)));
      const last = lista[lista.length - 1];
      const m = last.metricas || {};
      atual.push({ sku: last.sku_ref, armazem: last.armazem, momento: last.momento,
        produto: last.produtoNome || last.raw['Nome do Produto'] || last.raw['Product Name'] || null,
        variacao: last.variacaoNome || null, warehouseSkuId: last.warehouseSkuId || null,
        shopSkuId: last.shopSkuId || null, barcode: last.barcode || null,
        disponivel: mval(last, 'sellable', 'Disponível'), reservado: mval(last, 'reserved', 'Reservado'),
        naoVendavel: mval(last, 'unsellable'), emTransito: mval(last, 'in_transit', 'Em trânsito'),
        estoqueTotal: (m.stock_level != null ? +m.stock_level : (mval(last, 'sellable', 'Disponível') + mval(last, 'reserved', 'Reservado') + mval(last, 'unsellable'))),
        velocidade: m.selling_speed != null ? +m.selling_speed : null, cobertura: m.coverage_days != null ? +m.coverage_days : null,
        excesso: m.excess_qty != null ? +m.excess_qty : null, reposicao: m.recommend_replenishment != null ? +m.recommend_replenishment : null,
        inbound: m.pending_asn_inbound != null ? +m.pending_asn_inbound : null,
        aprovIR: m.ir_approval != null ? +m.ir_approval : null, pendIR: m.pending_ir_approval != null ? +m.pending_ir_approval : null,
        vendas7d: m.sold_7d != null ? +m.sold_7d : null, vendas15d: m.sold_15d != null ? +m.sold_15d : null,
        vendas30d: m.sold_30d != null ? +m.sold_30d : null, vendas60d: m.sold_60d != null ? +m.sold_60d : null,
        vendas90d: m.sold_90d != null ? +m.sold_90d : null,
        arquivo: last.sourceFile, key: last.key, leituras: lista.length });
      historico.push(...lista.map(s => ({ sku: s.sku_ref, armazem: s.armazem, momento: s.momento,
        disponivel: mval(s, 'sellable', 'Disponível'), reservado: mval(s, 'reserved', 'Reservado'),
        vendas30d: (s.metricas || {}).sold_30d != null ? +s.metricas.sold_30d : null, arquivo: s.sourceFile })));
    }
    return { atual, historico, nota: 'cada leitura é um snapshot novo — o histórico nunca é sobrescrito' };
  }

  /* ---------- correções e exclusões auditadas (original preservado SEMPRE) ---------- */
  function valorEfetivo(rec, campo) {
    const c = (rec.correcoes || []).filter(x => x.campo === campo);
    return c.length ? c[c.length - 1].depois : rec.raw[campo];
  }
  const permDe = rec => (rec.entidade === 'order' || rec.entidade === 'order_event') ? 'ORDER_EDIT_CORRECTION' : 'METRIC_CORRECTION';
  function findRec(eng, key) { return eng.snapshots.find(s => s.key === key); }

  function correct(eng, key, campo, depois, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec) return { blocked: true, reason: 'registro não encontrado' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    if (!opts.motivo || !String(opts.motivo).trim())
      return { blocked: true, reason: 'correção manual exige motivo — recusada sem justificativa' };
    rec.correcoes = rec.correcoes || [];
    const entrada = { campo, antes: valorEfetivo(rec, campo), depois, motivo: opts.motivo,
      autor: opts.usuario || 'Marcos', em: HOJE, origem: 'MANUAL_CORRECTION' };
    rec.correcoes.push(entrada); /* rec.raw permanece intocado — original preservado */
    audit(eng, 'correcao_manual', `${key} · ${campo}: "${entrada.antes}" → "${depois}" · motivo: ${opts.motivo}`, { key, autor: entrada.autor });
    return { ok: true, correcao: entrada, nota: 'valor original preservado; a correção é uma camada MANUAL_CORRECTION' };
  }

  function excludeFromAnalysis(eng, key, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec) return { blocked: true, reason: 'registro não encontrado' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    if (!opts.motivo || !String(opts.motivo).trim())
      return { blocked: true, reason: 'excluir da análise exige motivo — recusado' };
    rec.excluidoDaAnalise = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE,
      impacto: 'sai das análises e dos KPIs; permanece na camada bruta e no histórico', restauravel: true };
    audit(eng, 'excluido_da_analise', `${key} · motivo: ${opts.motivo}`, { key });
    return { ok: true, exclusao: rec.excluidoDaAnalise };
  }

  function restaurar(eng, key, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec || !rec.excluidoDaAnalise) return { blocked: true, reason: 'nada a restaurar' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    rec.restauracoes = rec.restauracoes || [];
    rec.restauracoes.push({ exclusaoAnterior: rec.excluidoDaAnalise, por: opts.usuario || 'Marcos', em: HOJE });
    rec.excluidoDaAnalise = null;
    audit(eng, 'restaurado_na_analise', key, { key });
    return { ok: true };
  }

  function archiveFile(eng, batchId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'DATA_SOURCE_ARCHIVE')) return negar(opts.papel, 'DATA_SOURCE_ARCHIVE');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'arquivar exige motivo' };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) return { blocked: true, reason: 'lote não encontrado' };
    batch.arquivado = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE,
      impacto: 'fonte sai das listas ativas; dados, camada bruta e trilha permanecem — nada é apagado' };
    audit(eng, 'fonte_arquivada', `${batchId} (${batch.arquivo}) · motivo: ${opts.motivo}`, { batchId });
    return { ok: true, arquivado: batch.arquivado };
  }

  function desativarVinculo(eng, obsId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'MASTER_LINK_EDIT')) return negar(opts.papel, 'MASTER_LINK_EDIT');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'desativar vínculo exige motivo' };
    const obs = eng.observations.find(o => o.id === obsId);
    if (!obs) return { blocked: true, reason: 'listing não encontrado' };
    obs.vinculoAnterior = { vinculo: obs.vinculo, produtoId: obs.produtoId };
    obs.vinculo = 'VÍNCULO DESATIVADO'; obs.produtoId = null;
    audit(eng, 'vinculo_desativado', `${obsId} (item ${obs.item_id}) · motivo: ${opts.motivo}`, { obsId });
    return { ok: true, nota: 'vínculo desativado sem apagar o anúncio nem o histórico' };
  }

  function removerMaster(eng, produtoId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'MASTER_LINK_EDIT')) return negar(opts.papel, 'MASTER_LINK_EDIT');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'remover master exige motivo' };
    const link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link || !link.itemId) return { blocked: true, reason: 'produto sem master definido' };
    link.historico = link.historico || [];
    link.historico.push({ itemId: link.itemId, estado: link.estado, removidoEm: HOJE, motivo: opts.motivo });
    link.itemId = null; link.estado = 'SEM MASTER DEFINIDO';
    audit(eng, 'master_removido', `${produtoId} · motivo: ${opts.motivo} (anúncio permanece intacto)`, { produtoId });
    return { ok: true, nota: 'master removido — o anúncio continua existindo; só a referência estratégica caiu' };
  }

  function historicoDe(eng, key) {
    const rec = findRec(eng, key);
    if (!rec) return null;
    return { versoes: rec.versoes, correcoes: rec.correcoes || [], exclusao: rec.excluidoDaAnalise || null,
      restauracoes: rec.restauracoes || [], atual: rec.raw, atualizadoEm: rec.atualizadoEm };
  }

  /* ---------- fontes e histórico (tabela transversal) ---------- */
  function sourcesTable(eng) {
    return eng.batches.map(b => ({
      batchId: b.id, fonte: b.sourceType, areaDestino: b.det.destino || 'não identificado', arquivo: b.arquivo,
      marketplace: b.escopo.marketplace, lojaId: b.escopo.lojaId, contaId: b.escopo.contaId,
      periodo: b.periodo, granularidade: b.det.granularidade || null, status: b.estado,
      linhas: b.linhas, duplicidadesEvitadas: b.aplicado ? b.aplicado.duplicadosEvitados : 0,
      conflitos: b.aplicado ? b.aplicado.conflitos : (b.preview ? b.preview.conflitos || 0 : 0),
      linhasComErro: (b.preview && b.preview.linhasComErro) || 0,
      ultimaAtualizacao: b.aplicado ? b.aplicado.em : b.em, usuario: b.enviadoPor,
      arquivado: b.arquivado || null,
      acoes: ['Ver arquivo', 'Ver mapeamento', 'Ver dados brutos', 'Ver dados normalizados', 'Ver linhas com erro',
        ...(b.aplicado && b.estado !== 'REVERTIDO' ? ['Reprocessar', 'Rollback'] : []),
        ...(b.arquivado ? ['Restaurar'] : ['Arquivar'])],
    }));
  }
  const areaSources = (eng, destinos) => sourcesTable(eng).filter(r => destinos.includes(r.areaDestino) && !r.arquivado);

  /* ---------- MESA DE INTELIGÊNCIA — agentes honestos sobre fontes reais ---------- */
  const NIVEIS = ['CRÍTICO', 'ATENÇÃO', 'OPORTUNIDADE', 'APRENDIZADO', 'AGUARDANDO DADOS'];
  const AGENT_STATUS = ['ANALISADO', 'AGUARDANDO DADOS', 'DADO INSUFICIENTE', 'DADO CONFLITANTE', 'COBERTURA PARCIAL'];

  function mesaInsights(eng, filtro) {
    filtro = filtro || {};
    const insights = [];
    const fontesDe = destinos => eng.batches.filter(b => b.aplicado && !b.arquivado && destinos.includes(b.det.destino));
    const fonteStr = bs => bs.map(b => b.arquivo).join(' · ');
    const perStr = bs => bs.map(b => b.periodo ? b.periodo.ini + '→' + b.periodo.fim : 'sem período declarado').join(' · ');
    const push = (agente, nivel, titulo, fato, bs, extra) => insights.push(Object.assign({
      id: 'ins' + (insights.length + 1), agente, nivel, titulo, fato,
      fonte: fonteStr(bs) || 'fonte interna', periodo: perStr(bs) || '—',
      cobertura: bs.length + ' fonte(s) aplicada(s)', confianca: 'alta — dado importado, não estimado',
      acoes: ['Abrir análise', 'Ver fontes', 'Criar missão', 'Marcar para acompanhar', 'Silenciar com motivo'],
    }, extra || {}));

    const ov = ordersView(eng, filtro);
    const stats = orderStats(eng, filtro);
    const stock = stockView(eng, filtro);
    const agentes = [];
    const agente = (nome, destinos, analisar) => {
      const bs = fontesDe(destinos);
      if (!bs.length) {
        agentes.push({ nome, status: 'AGUARDANDO DADOS', fontes: [], campos: [], escopo: null, cobertura: 'nenhuma',
          ultimaAnalise: null, dadosFaltantes: 'nenhuma fonte aplicada para ' + destinos.join('/'),
          acao: { tipo: 'Solicitar dado', destino: destinos[0], label: 'Atualizar dados desta área' }, insights: 0,
          confianca: 'n/a — agente declara a limitação, nunca inventa' });
        return;
      }
      const antes = insights.length;
      const st = analisar(bs) || 'ANALISADO';
      /* cada agente declara fontes, CAMPOS usados, período, escopo e cobertura */
      const campos = [...new Set(bs.flatMap(b => (b.preview && b.preview.evidencias) || []))];
      agentes.push({ nome, status: st, fontes: bs.map(b => b.arquivo), campos,
        escopo: bs.map(b => b.escopo.lojaId + '/' + b.escopo.contaId).filter((v, i, a) => a.indexOf(v) === i).join(' · '),
        cobertura: bs.length + ' fonte(s) · ' + perStr(bs),
        ultimaAnalise: bs[bs.length - 1].aplicado.em,
        periodo: perStr(bs), insights: insights.length - antes, dadosFaltantes: null,
        confianca: st === 'ANALISADO' ? 'alta — dado importado' : 'parcial — ver status' });
    };

    /* 1 · Pedidos */
    agente('Analista de Pedidos', ['pedidos'], bs => {
      const k = stats.kpis;
      const txNP = conversaoExplicita(k.naoPagos, k.pedidos, 'não pagos ÷ pedidos importados');
      if (txNP.taxa != null && txNP.taxa > 25)
        push('Analista de Pedidos', 'CRÍTICO', 'Perda de pagamento acima do tolerável',
          `${k.naoPagos} de ${k.pedidos} pedidos sem pagamento (${txNP.taxa}%, fórmula: ${txNP.formula}) — R$ ${k.valorNaoPago} parados`, bs,
          { hipotese: 'frete/cupom/checkout — hipótese, nunca causa afirmada sem evidência do canal' });
      if (k.taxaCancelamento.taxa != null && k.taxaCancelamento.taxa > 15)
        push('Analista de Pedidos', 'ATENÇÃO', 'Cancelamento elevado',
          `${k.cancelados} cancelamento(s) em ${k.pedidos} pedidos (${k.taxaCancelamento.taxa}%)`, bs,
          { hipotese: 'motivos variados no campo "Cancelar Motivo" — hipótese a investigar por pedido; nunca causa confirmada',
            recomendacao: 'revisar os motivos de cancelamento antes de mexer em preço ou anúncio' });
      const geo = geoStats(eng, filtro, 'estado');
      if (geo.length)
        push('Analista de Pedidos', 'APRENDIZADO', 'Concentração geográfica',
          `${geo[0].chave} lidera com ${geo[0].pedidos} pedido(s) e R$ ${geo[0].faturamento}`, bs);
      return 'ANALISADO';
    });

    /* 2 · Performance de produtos */
    agente('Analista de Performance', ['performance'], bs => {
      const perf = eng.snapshots.filter(s => s.granularidade === 'LISTING_METRIC' && !s.excluidoDaAnalise);
      for (const s of perf) {
        const cliques = +s.raw['Cliques por Produto'] || 0, pedidos = +s.raw['Pedidos'] || 0;
        const ctr = +s.raw['CTR'] || null, conv = +s.raw['Taxa de Conversão de Pedidos'] || null;
        if (cliques >= 80 && pedidos <= 2)
          push('Analista de Performance', 'OPORTUNIDADE', 'Clique sem venda',
            `"${s.raw['Produto'] || s.item_id}": ${cliques} cliques e só ${pedidos} pedido(s) — página/preço/frete merecem experimento`, bs,
            { hipotese: 'anúncio atrai mas não converte — hipótese para experimento, não certeza' });
        if (ctr != null && conv != null && ctr < 3 && conv >= 7)
          push('Analista de Performance', 'OPORTUNIDADE', 'CTR baixo com conversão boa',
            `"${s.raw['Produto'] || s.item_id}": CTR ${ctr}% mas conversão ${conv}% — quem clica compra; melhorar capa/título multiplica`, bs);
      }
      return 'ANALISADO';
    });

    /* 3 · Estoque */
    agente('Analista de Estoque', ['estoque'], bs => {
      if (!stats.kpis.pedidos) {
        push('Analista de Estoque', 'AGUARDANDO DADOS', 'Cruzamento venda × estoque incompleto',
          'há leitura de estoque, mas sem pedidos importados não dá para cruzar venda com cobertura — nada será inventado', bs,
          { confianca: 'n/a', acoes: ['Ver fontes', 'Solicitar dado'] });
        return 'COBERTURA PARCIAL';
      }
      for (const st of stock.atual) {
        const vendasSku = ov.orders.filter(o => o.sku === st.sku && !['Cancelados', 'Não pagos'].includes(o.tab)).length;
        if (vendasSku > 0 && st.disponivel <= 5)
          push('Analista de Estoque', 'CRÍTICO', 'Venda ativa com estoque crítico',
            `SKU ${st.sku} (${st.armazem}): ${vendasSku} venda(s) no período e só ${st.disponivel} disponível — ruptura interrompe o giro`, bs);
      }
      return 'ANALISADO';
    });

    /* 4 · Devoluções */
    agente('Analista de Devoluções', ['devolucoes'], bs => {
      const porSku = {};
      for (const o of ov.orders)
        for (const e of o.eventos)
          if (/devolu|reembolso/i.test(e.tipo)) (porSku[o.sku || o.produto] = porSku[o.sku || o.produto] || []).push(o.id);
      for (const [sku, ids] of Object.entries(porSku))
        if (ids.length >= 2)
          push('Analista de Devoluções', 'ATENÇÃO', 'Vende e devolve demais',
            `${sku}: ${ids.length} pedidos com devolução/reembolso (${ids.join(', ')}) — investigar expectativa × produto`, bs);
      if (ov.eventosOrfaos.length) {
        push('Analista de Devoluções', 'ATENÇÃO', 'Evento sem pedido correspondente',
          `${ov.eventosOrfaos.length} evento(s) de devolução citam pedidos ainda não importados — nunca criamos pedido a partir de devolução`, bs,
          { acoes: ['Abrir análise', 'Ver fontes', 'Corrigir dado', 'Solicitar dado'] });
        return 'DADO CONFLITANTE';
      }
      return 'ANALISADO';
    });

    /* 5 · Tráfego */
    agente('Analista de Tráfego', ['trafego_visao', 'trafego'], bs => {
      const periodOnly = bs.every(b => b.det.granularidade === 'PERIOD_METRIC');
      const tv = eng.snapshots.filter(s => s.metric_type === 'trafego_visao');
      if (tv.length) {
        const vis = tv.reduce((a, s) => a + (+s.raw['Visitantes'] || 0), 0);
        push('Analista de Tráfego', 'APRENDIZADO', 'Tráfego agregado do período',
          `${vis} visitante(s) no período declarado — número agregado; não existe abertura diária nesta fonte e ela não será inventada`, bs);
      }
      return periodOnly ? 'COBERTURA PARCIAL' : 'ANALISADO';
    });

    /* 6 · Métricas Principais (10.E.2.3 — base multiabas real) */
    agente('Analista de Métricas Principais', ['metricas'], bs => {
      const mv = metricasView(eng, filtro);
      if (mv.semDados) return 'AGUARDANDO DADOS';
      for (const b of mv.bases) {
        const t = b.totais;
        push('Analista de Métricas Principais', 'APRENDIZADO', `${b.nomeBase}: R$ ${(t.gross_sales_brl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${t.orders_created || 0} pedidos`,
          `${t.visitors || 0} visitante(s) · conversão ${((t.order_conversion_rate || 0) * 100).toFixed(2)}% (pedidos ÷ visitantes) · ${b.dias} dia(s) na série; a linha consolidada de período não entra como um dia`, bs,
          { hipotese: `cancelados ${t.cancelled_orders || 0} · devolvidos ${t.returned_or_refunded_orders || 0} — acompanhar antes de mexer em preço` });
      }
      return 'ANALISADO';
    });

    /* 7 · Afiliados */
    agente('Analista de Afiliados', ['afiliados', 'atribuicao'], bs => {
      const afs = eng.snapshots.filter(s => s.metric_type === 'afiliados' && !s.excluidoDaAnalise);
      for (const s of afs) {
        const vendas = +s.raw['Vendas do Afiliado'] || 0, com = +s.raw['Comissão'] || 0;
        if (vendas && com / vendas > 0.15)
          push('Analista de Afiliados', 'ATENÇÃO', 'Comissão de afiliado pressiona a margem',
            `${s.raw['Afiliado']}: R$ ${com} de comissão sobre R$ ${vendas} (${Math.round((com / vendas) * 100)}%) — checar margem final`, bs,
            { hipotese: 'afiliado explica a origem da venda — o valor nunca soma de novo no faturamento total' });
      }
      return 'ANALISADO';
    });

    /* 8 · Atendimento */
    agente('Analista de Atendimento', ['atendimento'], bs => {
      const ch = eng.snapshots.filter(s => s.metric_type === 'atendimento');
      const taxas = ch.map(s => +s.raw['Taxa de resposta']).filter(v => !isNaN(v));
      if (taxas.length) {
        const media = Math.round(taxas.reduce((a, x) => a + x, 0) / taxas.length);
        if (media < 80)
          push('Analista de Atendimento', 'OPORTUNIDADE', 'Perguntas sem resposta seguram conversão',
            `taxa média de resposta ${media}% — pergunta não respondida costuma virar pedido perdido (hipótese a validar)`, bs);
      }
      return 'ANALISADO';
    });

    /* 9 · Estratégia (meta-agente: só trabalha com ≥2 fontes) */
    (() => {
      const destAplicados = [...new Set(eng.batches.filter(b => b.aplicado && !b.arquivado).map(b => b.det.destino))];
      if (destAplicados.length < 2) {
        agentes.push({ nome: 'Estrategista', status: 'DADO INSUFICIENTE', fontes: [], ultimaAnalise: null,
          dadosFaltantes: 'estratégia exige pelo menos 2 áreas com dados aplicados — hoje: ' + (destAplicados.join(', ') || 'nenhuma'),
          acao: { tipo: 'Solicitar dado', destino: 'pedidos' }, insights: 0 });
      } else {
        const criticos = insights.filter(i => i.nivel === 'CRÍTICO').length;
        push('Estrategista', criticos ? 'ATENÇÃO' : 'APRENDIZADO', 'Prioridade da semana',
          criticos ? `${criticos} ponto(s) crítico(s) na fila — resolver antes de acelerar qualquer alavanca`
            : `${destAplicados.length} área(s) com dado real aplicado e nenhum crítico aberto — janela para experimento controlado`,
          eng.batches.filter(b => b.aplicado && !b.arquivado).slice(-3));
        agentes.push({ nome: 'Estrategista', status: 'ANALISADO', fontes: destAplicados,
          ultimaAnalise: HOJE, insights: 1, dadosFaltantes: null });
      }
    })();

    /* cruzamentos principais — cada card declara o que exige e o que falta */
    const CRUZES = [
      ['clique-sem-venda', 'Produto com clique e sem venda', ['performance']],
      ['vende-e-devolve', 'Produto que vende e devolve demais', ['pedidos', 'devolucoes']],
      ['venda-estoque-critico', 'Venda crescente + estoque crítico', ['pedidos', 'estoque']],
      ['roi-afiliado-margem', 'ROI de afiliado × margem baixa', ['afiliados']],
      ['cidade-volume-prazo', 'Cidade com volume + prazo ruim', ['pedidos']],
      ['perguntas-conversao', 'Perguntas sem resposta × conversão', ['atendimento', 'performance']],
      ['promo-criados-nao-pagos', 'Promoção com pedidos criados e não pagos', ['promocoes', 'pedidos']],
      ['ctr-baixo-conv-boa', 'CTR baixo com conversão boa', ['performance']],
    ];
    const temDest = d => eng.batches.some(b => b.aplicado && !b.arquivado && b.det.destino === d);
    const cruzamentos = CRUZES.map(([key, nome, req]) => {
      const faltam = req.filter(d => !temDest(d));
      if (faltam.length) return { key, nome, estado: 'AGUARDANDO DADOS', faltam,
        nota: 'exige ' + req.join(' + ') + ' — falta: ' + faltam.join(', ') + '. Nada é estimado.' };
      const hit = insights.find(i =>
        (key === 'clique-sem-venda' && i.titulo === 'Clique sem venda') ||
        (key === 'vende-e-devolve' && i.titulo === 'Vende e devolve demais') ||
        (key === 'venda-estoque-critico' && i.titulo === 'Venda ativa com estoque crítico') ||
        (key === 'roi-afiliado-margem' && i.titulo === 'Comissão de afiliado pressiona a margem') ||
        (key === 'cidade-volume-prazo' && i.titulo === 'Concentração geográfica') ||
        (key === 'perguntas-conversao' && i.titulo === 'Perguntas sem resposta seguram conversão') ||
        (key === 'ctr-baixo-conv-boa' && i.titulo === 'CTR baixo com conversão boa'));
      return { key, nome, estado: 'ANALISADO', resultado: hit ? hit.fato : 'nenhum caso encontrado no recorte atual',
        insightId: hit ? hit.id : null,
        nota: 'correlação observada — nunca afirmada como causa sem evidência' };
    });

    /* visão geral — 13 indicadores com fonte e última atualização, SEM DADOS quando faltam */
    const bsPed = fontesDe(['pedidos']), bsTraf = fontesDe(['trafego_visao', 'trafego']);
    const ult = bs => bs.length ? bs[bs.length - 1].aplicado.em : null;
    const kv = (label, valor, bs, notaSem) => ({ label, valor: bs.length ? valor : null,
      fonte: fonteStr(bs) || null, ultima: ult(bs), sem: bs.length ? null : (notaSem || 'SEM DADOS — importe a fonte desta área') });
    const tv = eng.snapshots.filter(s => s.metric_type === 'trafego_visao');
    const visitantes = tv.reduce((a, s) => a + (+s.raw['Visitantes'] || 0), 0);
    const afSnaps = eng.snapshots.filter(s => s.metric_type === 'afiliados');
    const chSnaps = eng.snapshots.filter(s => s.metric_type === 'atendimento');
    const visaoGeral = [
      kv('Faturamento aprovado', 'R$ ' + stats.kpis.faturamentoAprovado, bsPed),
      kv('Pedidos importados', stats.kpis.pedidos, bsPed),
      kv('Não pagos', stats.kpis.naoPagos + ' (R$ ' + stats.kpis.valorNaoPago + ')', bsPed),
      kv('Cancelados', stats.kpis.cancelados, bsPed),
      kv('Devoluções/Reembolsos', stats.kpis.devolucoes, fontesDe(['devolucoes'])),
      kv('Ticket médio', stats.kpis.ticketMedio != null ? 'R$ ' + stats.kpis.ticketMedio : '—', bsPed),
      kv('Unidades vendidas', stats.kpis.unidades, bsPed),
      kv('Visitantes (período)', visitantes, bsTraf),
      { label: 'Conversão', valor: null, fonte: null, ultima: null,
        sem: 'não exibida — exige numerador e denominador da MESMA fonte e período; nunca mostramos % sem fórmula' },
      kv('SKUs em estoque crítico', stock.atual.filter(s => s.disponivel <= 5).length, fontesDe(['estoque'])),
      kv('Vendas via afiliados (explicativa)', 'R$ ' + Math.round(afSnaps.reduce((a, s) => a + (+s.raw['Vendas do Afiliado'] || 0), 0) * 100) / 100, fontesDe(['afiliados'])),
      kv('Taxa de resposta no chat', chSnaps.length ? Math.round(chSnaps.reduce((a, s) => a + (+s.raw['Taxa de resposta'] || 0), 0) / chSnaps.length) + '%' : '—', fontesDe(['atendimento'])),
      { label: 'Fontes ativas', valor: eng.batches.filter(b => b.aplicado && !b.arquivado).length,
        fonte: 'Fontes e Histórico de Dados', ultima: HOJE, sem: null },
    ];

    const ordem = Object.fromEntries(NIVEIS.map((n, i) => [n, i]));
    insights.sort((a, b) => (ordem[a.nivel] ?? 9) - (ordem[b.nivel] ?? 9));
    return { visaoGeral, agentes, insights, cruzamentos, filtro,
      honestidade: 'Os agentes não fingem trabalho: sem dado real aplicado, o status é AGUARDANDO DADOS — nunca análise inventada.' };
  }

  /* =============================================================
     10.E.2.2 — DATA FOUNDATION: três níveis de campo (bruto,
     normalizado, derivado), catálogo de campos visível, mapeamento
     manual versionado, relacionamentos com fila de revisão, cadeia
     explícita pós-importação e ativação da inteligência sobre a
     base real. Nenhuma coluna some; nenhum número sem origem.
     ============================================================= */

  const TIPOS_CAMPO = ['Texto', 'Número', 'Moeda', 'Percentual', 'Data', 'Data e hora', 'Status', 'Identificador', 'SKU',
    'ID externo', 'Código de barras', 'Cidade', 'Estado', 'Produto', 'Variação', 'Marketplace', 'Canal', 'Conta',
    'Categoria', 'Taxa', 'Custo', 'Frete', 'Cupom', 'Desconto', 'Comissão', 'Observação', 'Campo auxiliar', 'Outro'];
  const ENTIDADES_CAMPO = ['Pedido', 'Item do pedido', 'Produto Master', 'Variação', 'Anúncio', 'Estoque', 'Devolução',
    'Reembolso', 'Cancelamento', 'Falha de entrega', 'Métrica diária', 'Métrica agregada', 'Tráfego', 'Afiliado',
    'Chat', 'Promoção', 'Cupom', 'Ads', 'Custo', 'Taxa', 'Conta marketplace', 'Outro'];

  /* dicionário canônico: coluna original → campo normalizado, tipo, entidade e áreas que usam */
  const FM = (campo, tipo, entidade, areas, extra) => Object.assign({ campo, tipo, entidade, areas }, extra || {});
  const FIELD_MAP = {
    'ID do pedido': FM('order_id', 'Identificador', 'Pedido', ['Pedidos', 'Devoluções', 'Central']),
    'Status do pedido': FM('order_status', 'Status', 'Pedido', ['Pedidos', 'Central']),
    'Data de criação do pedido': FM('order_created_at', 'Data e hora', 'Pedido', ['Pedidos', 'Central']),
    'Data de pagamento': FM('order_paid_at', 'Data e hora', 'Pedido', ['Pedidos']),
    'Hora do pagamento do pedido': FM('order_paid_at', 'Data e hora', 'Pedido', ['Pedidos']),
    'Data de envio': FM('order_shipped_at', 'Data', 'Pedido', ['Pedidos']),
    'Data prevista de envio': FM('order_ship_by', 'Data', 'Pedido', ['Pedidos']),
    'Data de entrega': FM('order_delivered_at', 'Data', 'Pedido', ['Pedidos', 'Central']),
    'Domestic Delivered Date': FM('order_delivered_at', 'Data', 'Pedido', ['Pedidos', 'Central']),
    'Data da Finalização do Cancelamento': FM('order_cancelled_at', 'Data', 'Cancelamento', ['Pedidos']),
    'Nome do Produto': FM('product_name', 'Produto', 'Item do pedido', ['Pedidos', 'Catálogo', 'Central']),
    'Número de referência SKU': FM('sku_ref', 'SKU', 'Item do pedido', ['Pedidos', 'Catálogo']),
    'SKU de referência': FM('sku_ref', 'SKU', 'Item do pedido', ['Pedidos', 'Catálogo']),
    'Nome da variação': FM('variation_name', 'Variação', 'Variação', ['Pedidos', 'Catálogo']),
    'Quantidade': FM('qty', 'Número', 'Item do pedido', ['Pedidos', 'Central']),
    'Preço original': FM('price_original', 'Moeda', 'Item do pedido', ['Pedidos', 'Centro de Custos']),
    'Preço acordado': FM('price_deal', 'Moeda', 'Item do pedido', ['Pedidos', 'Centro de Custos']),
    'Subtotal do produto': FM('item_subtotal', 'Moeda', 'Item do pedido', ['Pedidos', 'Centro de Custos']),
    'Descontos': FM('order_discount', 'Desconto', 'Pedido', ['Pedidos', 'Centro de Custos']),
    'Cupom': FM('order_voucher', 'Cupom', 'Pedido', ['Pedidos', 'Centro de Custos']),
    'Peso': FM('item_weight', 'Número', 'Item do pedido', ['Pedidos', 'Catálogo']),
    'Valor Total': FM('order_total', 'Moeda', 'Pedido', ['Pedidos', 'Central', 'Centro de Custos']),
    'Taxa de envio paga pelo comprador': FM('shipping_paid_buyer', 'Frete', 'Pedido', ['Pedidos', 'Centro de Custos']),
    'Frete pago pelo comprador': FM('shipping_paid_buyer', 'Frete', 'Pedido', ['Pedidos', 'Centro de Custos']),
    'Taxa de envio reversa': FM('shipping_reverse_fee', 'Frete', 'Pedido', ['Centro de Custos']),
    'Taxa de transação': FM('fee_transaction', 'Taxa', 'Pedido', ['Centro de Custos']),
    'Taxa de comissão': FM('fee_commission', 'Comissão', 'Pedido', ['Centro de Custos']),
    'Taxa de serviço': FM('fee_service', 'Taxa', 'Pedido', ['Centro de Custos']),
    'Total global': FM('order_total_global', 'Moeda', 'Pedido', ['Centro de Custos']),
    'Valor estimado do frete': FM('shipping_estimated', 'Frete', 'Pedido', ['Centro de Custos']),
    'Cidade': FM('buyer_city', 'Cidade', 'Pedido', ['Pedidos', 'Central']),
    'UF': FM('buyer_state', 'Estado', 'Pedido', ['Pedidos', 'Central']),
    'País': FM('buyer_country', 'Texto', 'Pedido', ['Pedidos']),
    'CEP': FM('buyer_zip_protected', 'Texto', 'Pedido', ['Pedidos'], { sensivel: true }),
    'Comprador': FM('buyer_name', 'Texto', 'Pedido', ['Pedidos'], { sensivel: true }),
    'Observação do comprador': FM('buyer_note', 'Observação', 'Pedido', ['Pedidos'], { sensivel: true }),
    'Nota': FM('order_note', 'Observação', 'Pedido', ['Pedidos']),
    'Hot Listing': FM('order_hot_listing_flag', 'Campo auxiliar', 'Pedido', ['Pedidos', 'Inteligência'], { auxiliar: true }),
    'Cancelar Motivo': FM('order_cancel_reason', 'Texto', 'Cancelamento', ['Pedidos', 'Central']),
    'Status da Devolução / Reembolso': FM('order_return_status', 'Status', 'Devolução', ['Pedidos', 'Devoluções']),
    'Número de rastreamento': FM('order_tracking', 'ID externo', 'Pedido', ['Pedidos']),
    'Opção de envio': FM('shipping_option', 'Texto', 'Pedido', ['Pedidos']),
    'Método de envio': FM('shipping_method', 'Texto', 'Pedido', ['Pedidos']),
    'Tipo de evento': FM('event_type', 'Status', 'Devolução', ['Devoluções', 'Pedidos']),
    'ID do evento': FM('event_id', 'Identificador', 'Devolução', ['Devoluções']),
    'Motivo': FM('event_reason', 'Texto', 'Devolução', ['Devoluções', 'Central']),
    'Valor reembolsado': FM('refund_amount', 'Moeda', 'Reembolso', ['Devoluções', 'Centro de Custos']),
    'Status da solicitação': FM('event_status', 'Status', 'Devolução', ['Devoluções']),
    'Data': FM('metric_date', 'Data', 'Métrica diária', ['Central']),
    'ID do Item': FM('item_external_id', 'ID externo', 'Anúncio', ['Catálogo', 'Central']),
    'SKU Pai': FM('sku_parent', 'SKU', 'Produto Master', ['Catálogo']),
    'SKU da variação': FM('sku_variation', 'SKU', 'Variação', ['Catálogo']),
    'Preço': FM('listing_price', 'Moeda', 'Variação', ['Catálogo']),
    'Estoque': FM('listing_stock', 'Número', 'Variação', ['Catálogo']),
    'Descrição': FM('product_description', 'Texto', 'Produto Master', ['Catálogo']),
    'Status Atual do Item': FM('listing_status', 'Status', 'Anúncio', ['Catálogo']),
    'SKU': FM('stock_sku', 'SKU', 'Estoque', ['Central', 'Catálogo']),
    'Armazém': FM('warehouse', 'Texto', 'Estoque', ['Central']),
    'Disponível': FM('stock_available', 'Número', 'Estoque', ['Central', 'Catálogo']),
    'Reservado': FM('stock_reserved', 'Número', 'Estoque', ['Central']),
    'Em trânsito': FM('stock_in_transit', 'Número', 'Estoque', ['Central']),
    'Momento da leitura': FM('stock_read_at', 'Data e hora', 'Estoque', ['Central']),
    'Impressões de Produto': FM('impressions', 'Número', 'Métrica agregada', ['Central']),
    'Cliques por Produto': FM('clicks', 'Número', 'Métrica agregada', ['Central']),
    'Taxa de Conversão de Pedidos': FM('conversion_rate', 'Percentual', 'Métrica agregada', ['Central']),
    'CTR': FM('ctr', 'Percentual', 'Métrica agregada', ['Central']),
    'Visitantes': FM('visitors', 'Número', 'Tráfego', ['Central']),
    'Visualizações da Página': FM('page_views', 'Número', 'Tráfego', ['Central']),
    'Taxa de Rejeição': FM('bounce_rate', 'Percentual', 'Tráfego', ['Central']),
    'Novos Seguidores': FM('new_followers', 'Número', 'Tráfego', ['Central']),
    'Período': FM('metric_period', 'Texto', 'Métrica agregada', ['Central']),
    'Afiliado': FM('affiliate_id', 'Identificador', 'Afiliado', ['Central', 'Centro de Custos']),
    'Vendas do Afiliado': FM('affiliate_sales', 'Moeda', 'Afiliado', ['Central', 'Centro de Custos']),
    'Comissão': FM('affiliate_commission', 'Comissão', 'Afiliado', ['Centro de Custos']),
    'Cliques': FM('affiliate_clicks', 'Número', 'Afiliado', ['Central']),
    'Pedidos': FM('metric_orders', 'Número', 'Métrica agregada', ['Central']),
    'Pedidos Pagos': FM('paid_orders', 'Número', 'Métrica diária', ['Central']),
    'Pedidos Feitos': FM('created_orders', 'Número', 'Métrica diária', ['Central']),
    'Vendas de Pedidos Pagos': FM('paid_sales', 'Moeda', 'Métrica diária', ['Central']),
    'Perguntas recebidas': FM('chat_received', 'Número', 'Chat', ['Central']),
    'Perguntas respondidas': FM('chat_answered', 'Número', 'Chat', ['Central']),
    'Taxa de resposta': FM('chat_response_rate', 'Percentual', 'Chat', ['Central']),
    'Tempo médio de resposta': FM('chat_avg_time', 'Texto', 'Chat', ['Central']),
    'Nome da promoção': FM('promo_name', 'Texto', 'Promoção', ['Central']),
    'Nome do Cupom': FM('voucher_name', 'Texto', 'Cupom', ['Central', 'Centro de Custos']),
    'Código': FM('voucher_code', 'Identificador', 'Cupom', ['Central']),
    'Produto': FM('product_name', 'Produto', 'Anúncio', ['Catálogo', 'Central']),
    'Unidades': FM('units', 'Número', 'Métrica agregada', ['Central']),
    'Vendas': FM('sales', 'Moeda', 'Métrica agregada', ['Central', 'Catálogo']),
    /* ---------- 10.E.2.3 · Métricas Principais Shopee (Pedido Feito / Produto Pago) ---------- */
    'Vendas (BRL)': FM('gross_sales_brl', 'Moeda', 'Métrica diária', ['Central', 'Métricas Principais', 'Centro de Custos']),
    'Vendas Sem os Descontos da Shopee': FM('sales_before_shopee_discount_brl', 'Moeda', 'Métrica diária', ['Central', 'Centro de Custos']),
    'Vendas por Pedido': FM('revenue_per_order_brl', 'Moeda', 'Métrica diária', ['Central', 'Métricas Principais']),
    'Cliques Por Produto': FM('product_clicks', 'Número', 'Métrica diária', ['Central', 'Tráfego']),
    'Pedidos Cancelados': FM('cancelled_orders', 'Número', 'Cancelamento', ['Central', 'Métricas Principais']),
    'Vendas Canceladas': FM('cancelled_sales_brl', 'Moeda', 'Cancelamento', ['Central', 'Centro de Custos']),
    'Pedidos Devolvidos / Reembolsados': FM('returned_or_refunded_orders', 'Número', 'Devolução', ['Central', 'Métricas Principais']),
    'Vendas Devolvidas / Reembolsadas': FM('returned_or_refunded_sales_brl', 'Moeda', 'Devolução', ['Central', 'Centro de Custos']),
    '# de compradores': FM('buyers', 'Número', 'Métrica diária', ['Central', 'Métricas Principais']),
    '# de novos compradores': FM('new_buyers', 'Número', 'Métrica diária', ['Central']),
    '# de compradores existentes': FM('returning_buyers', 'Número', 'Métrica diária', ['Central']),
    '# de compradores em potencial': FM('potential_buyers', 'Número', 'Métrica diária', ['Central']),
    'Repetir Índice de Compras': FM('repeat_purchase_rate', 'Percentual', 'Métrica diária', ['Central']),
    'Fonte de Tráfego': FM('traffic_source', 'Texto', 'Tráfego', ['Central', 'Tráfego', 'Afiliado', 'Ads']),
    'Impressões': FM('impressions', 'Número', 'Métrica agregada', ['Central', 'Tráfego']),
    'Impressões únicas': FM('unique_impressions', 'Número', 'Métrica agregada', ['Central', 'Tráfego']),
    'Cliques únicos': FM('unique_clicks', 'Número', 'Métrica agregada', ['Central', 'Tráfego']),
    'Conversão': FM('conversion_rate', 'Percentual', 'Métrica agregada', ['Central', 'Tráfego']),
    'Taxa de Conversão': FM('conversion_rate', 'Percentual', 'Métrica agregada', ['Central', 'Tráfego']),
    'Taxa de Vendas': FM('sales_rate', 'Percentual', 'Anúncio', ['Catálogo']),
    'Compradores': FM('buyers', 'Número', 'Métrica agregada', ['Central', 'Tráfego', 'Catálogo']),
    /* ---------- 10.E.2.5.1 · Performance de Produtos (Análise de Produtos, por anúncio/variação) ---------- */
    'ID da Variação': FM('variation_external_id', 'ID externo', 'Variação', ['Performance de Produtos', 'Catálogo', 'Central']),
    'Nome da Variação': FM('variation_name', 'Variação', 'Variação', ['Performance de Produtos', 'Catálogo']),
    'Status Atual da Variação': FM('variation_status', 'Status', 'Variação', ['Performance de Produtos', 'Catálogo']),
    'SKU Principal': FM('sku_parent', 'SKU', 'Anúncio', ['Performance de Produtos', 'Devoluções', 'Catálogo', 'Central']),
    'SKU da Variação': FM('sku_variation', 'SKU', 'Variação', ['Performance de Produtos', 'Devoluções', 'Catálogo']),
    'Impressão do Produto': FM('impressions', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego', 'Central']),
    'Impressões Únicas de Produto': FM('unique_impressions', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Cliques Únicos no Produto': FM('unique_clicks', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Visitantes do Produto (Visita)': FM('visitors', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Visualizações da Página do Produto': FM('page_views', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Visitantes que saíram da página': FM('bounced_visitors', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Taxa de Rejeição do Produto': FM('bounce_rate', 'Percentual', 'Anúncio', ['Performance de Produtos', 'Diagnóstico']),
    'Cliques em Buscas': FM('search_clicks', 'Número', 'Anúncio', ['Performance de Produtos', 'Tráfego']),
    'Curtidas': FM('likes', 'Número', 'Anúncio', ['Performance de Produtos']),
    'Visitantes do Produto (Adicionar ao Carrinho)': FM('cart_visitors', 'Número', 'Anúncio', ['Performance de Produtos', 'Carrinho']),
    'Unidades (Adicionar ao Carrinho)': FM('cart_units', 'Número', 'Anúncio', ['Performance de Produtos', 'Carrinho']),
    'Taxa de Conversão (Adicionar ao Carrinho)': FM('cart_conversion', 'Percentual', 'Anúncio', ['Performance de Produtos', 'Carrinho']),
    'Vendas (Pedido Realizado) (BRL)': FM('sales_placed_brl', 'Moeda', 'Anúncio', ['Performance de Produtos', 'Central', 'Centro de Custos']),
    'Vendas (Pedido Pago) (BRL)': FM('sales_paid_brl', 'Moeda', 'Anúncio', ['Performance de Produtos', 'Central', 'Centro de Custos']),
    'Pedido Feito': FM('orders_placed', 'Número', 'Anúncio', ['Performance de Produtos', 'Central']),
    'Produto Pago': FM('orders_paid', 'Número', 'Anúncio', ['Performance de Produtos', 'Central']),
    'Unidades (Pedido Realizado)': FM('units_placed', 'Número', 'Anúncio', ['Performance de Produtos']),
    'Unidades (Pedido Pago)': FM('units_paid', 'Número', 'Anúncio', ['Performance de Produtos']),
    'Compradores (Pedido Realizado)': FM('buyers_placed', 'Número', 'Anúncio', ['Performance de Produtos']),
    'Compradores (Pedido Pago)': FM('buyers_paid', 'Número', 'Anúncio', ['Performance de Produtos']),
    'Taxa de Conversão de Pedido (Pedido Realizado)': FM('conv_placed', 'Percentual', 'Anúncio', ['Performance de Produtos', 'Diagnóstico']),
    'Taxa de Conversão de Pedido (Pedido Pago)': FM('conv_paid', 'Percentual', 'Anúncio', ['Performance de Produtos', 'Diagnóstico']),
    'Vendas por Pedido (Pedido Realizado) (BRL)': FM('sales_per_order_placed_brl', 'Moeda', 'Anúncio', ['Performance de Produtos']),
    'Vendas por Pedido (Pedido Pago) (BRL)': FM('sales_per_order_paid_brl', 'Moeda', 'Anúncio', ['Performance de Produtos']),
    /* ---------- 10.E.2.5.1 · Devoluções e Cancelamentos (export real por ID da Devolução) ---------- */
    'ID da Devolução': FM('return_id', 'Identificador', 'Devolução', ['Devoluções', 'Central']),
    'ID do Pedido': FM('order_id', 'Identificador', 'Pedido', ['Devoluções', 'Pedidos', 'Central']),
    'Data de Criação do Pedido': FM('order_created_at', 'Data e hora', 'Pedido', ['Devoluções', 'Pedidos']),
    'Nome de Usuário do Comprador': FM('buyer_username', 'Texto', 'Devolução', ['Devoluções'], { sensivel: true }),
    'IMEI': FM('imei', 'Identificador', 'Devolução', ['Devoluções']),
    'Preço da Unidade': FM('unit_price_brl', 'Moeda', 'Devolução', ['Devoluções', 'Centro de Custos']),
    'Tempo de Envio de Devolução': FM('return_ship_time', 'Texto', 'Devolução', ['Devoluções']),
    'Tipo de Devolução': FM('return_type', 'Status', 'Devolução', ['Devoluções']),
    'Quantidade de Devoluções': FM('return_qty', 'Número', 'Devolução', ['Devoluções']),
    'Solução para Retorno e Reembolso': FM('return_solution', 'Texto', 'Devolução', ['Devoluções']),
    'Motivo da Devolução': FM('return_reason', 'Texto', 'Devolução', ['Devoluções', 'Central', 'Diagnóstico']),
    'Observações da Devolução': FM('return_notes', 'Observação', 'Devolução', ['Devoluções']),
    'Quantia Total de Reembolsos': FM('refund_total_brl', 'Moeda', 'Reembolso', ['Devoluções', 'Centro de Custos']),
    'Tempo Decorrido de Reembolso': FM('refund_elapsed', 'Texto', 'Reembolso', ['Devoluções']),
    'Retorno ao Armazém Shopee': FM('return_to_warehouse', 'Texto', 'Devolução', ['Devoluções']),
    /* ---------- 10.E.2.5.1 · Estoque Full (Current Inventory Report — todas as colunas) ---------- */
    'Product Name': FM('product_name', 'Produto', 'Estoque', ['Estoque Full', 'Catálogo', 'Central']),
    'Variations': FM('variation_name', 'Variação', 'Estoque', ['Estoque Full', 'Catálogo']),
    'Warehouse SKU ID': FM('warehouse_sku_id', 'SKU', 'Estoque', ['Estoque Full', 'Central']),
    'Seller SKU ID': FM('seller_sku_id', 'SKU', 'Estoque', ['Estoque Full', 'Catálogo', 'Central']),
    'Shop SKU ID': FM('shop_sku_id', 'SKU', 'Estoque', ['Estoque Full']),
    'Fulfill Mapping Mode': FM('fulfill_mode', 'Texto', 'Estoque', ['Estoque Full']),
    'Barcode': FM('barcode', 'Identificador', 'Estoque', ['Estoque Full', 'Catálogo']),
    'Warehouse': FM('warehouse', 'Texto', 'Estoque', ['Estoque Full', 'Central']),
    'Stock Level': FM('stock_level', 'Número', 'Estoque', ['Estoque Full']),
    'Sellable': FM('sellable', 'Número', 'Estoque', ['Estoque Full', 'Catálogo', 'Central']),
    'Reserved': FM('reserved', 'Número', 'Estoque', ['Estoque Full', 'Central']),
    'Unsellable': FM('unsellable', 'Número', 'Estoque', ['Estoque Full', 'Central']),
    'Recommend Replenishment Qty': FM('recommend_replenishment', 'Número', 'Estoque', ['Estoque Full']),
    'Pending IR Approval': FM('pending_ir_approval', 'Número', 'Estoque', ['Estoque Full']),
    'IR Approval': FM('ir_approval', 'Número', 'Estoque', ['Estoque Full']),
    'Pending ASN Inbound': FM('pending_asn_inbound', 'Número', 'Estoque', ['Estoque Full']),
    'Selling Speed': FM('selling_speed', 'Número', 'Estoque', ['Estoque Full', 'Diagnóstico']),
    'Coverage Days': FM('coverage_days', 'Número', 'Estoque', ['Estoque Full', 'Diagnóstico']),
    'Excess Qty': FM('excess_qty', 'Número', 'Estoque', ['Estoque Full']),
    'unitsSoldInLast7Days': FM('sold_7d', 'Número', 'Estoque', ['Estoque Full', 'Performance de Produtos']),
    'unitsSoldInLast15Days': FM('sold_15d', 'Número', 'Estoque', ['Estoque Full']),
    'unitsSoldInLast30Days': FM('sold_30d', 'Número', 'Estoque', ['Estoque Full', 'Performance de Produtos']),
    'unitsSoldInLast60Days': FM('sold_60d', 'Número', 'Estoque', ['Estoque Full']),
    'unitsSoldInLast90Days': FM('sold_90d', 'Número', 'Estoque', ['Estoque Full']),
  };

  function inferType(valor, coluna) {
    const c = String(coluna || '').toLowerCase();
    if (/id|código|codigo/.test(c)) return 'Identificador';
    if (/data|date|hora/.test(c)) return 'Data';
    if (/taxa|%|percent/.test(c)) return 'Percentual';
    if (/valor|preço|preco|r\$|total|custo/.test(c)) return 'Moeda';
    if (/status/.test(c)) return 'Status';
    if (valor == null || valor === '') return 'Outro';
    if (typeof valor === 'number') return 'Número';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(valor))) return 'Data';
    if (!isNaN(valor)) return 'Número';
    return 'Texto';
  }

  const mappingAtivo = (eng, coluna) => {
    const versoes = eng.customMappings.filter(m => m.coluna === coluna && !m.fimVigencia);
    return versoes[versoes.length - 1] || null;
  };

  /* ---------- CATÁLOGO DE CAMPOS: toda coluna recebida, com destino e status ---------- */
  function fieldCatalog(eng, batchId) {
    const files = batchId ? eng.rawFiles.filter(f => f.batchId === batchId) : eng.rawFiles;
    const porColuna = {};
    for (const rf of files) {
      const batch = eng.batches.find(b => b.id === rf.batchId) || {};
      for (const aba of rf.abas) {
        for (const h of aba.headers) {
          if (!h) continue;
          const row = porColuna[h] = porColuna[h] || { coluna: h, arquivos: [], batchIds: [], exemplo: null };
          if (!row.arquivos.includes(rf.nome)) row.arquivos.push(rf.nome);
          if (!row.batchIds.includes(rf.batchId)) row.batchIds.push(rf.batchId);
          if (row.exemplo == null) { const r0 = aba.rows.find(r => r[h] != null && r[h] !== ''); if (r0) row.exemplo = r0[h]; }
          row.arquivado = row.arquivado && !!batch.arquivado;
        }
      }
    }
    return Object.values(porColuna).map(row => {
      const manual = mappingAtivo(eng, row.coluna);
      const canon = FIELD_MAP[row.coluna];
      const m = manual || canon;
      const excluido = eng.camposExcluidos[row.coluna];
      const status = excluido ? 'excluído da análise'
        : m ? (m.auxiliar ? 'preservado e disponível' : 'utilizado')
        : row.exemplo == null ? 'inválido (sem valor em nenhuma linha)'
        : 'aguardando mapeamento';
      return Object.assign(row, {
        tipo: m ? m.tipo : inferType(row.exemplo, row.coluna),
        campoNormalizado: m ? m.campo : null,
        entidade: m ? m.entidade : null,
        areas: m ? (m.areas || [m.entidade]) : [],
        sensivel: !!(canon && canon.sensivel),
        origemMapeamento: manual ? 'MANUAL (v' + manual.versao + ')' : canon ? 'DICIONÁRIO CANÔNICO' : null,
        status, excluido: excluido || null,
      });
    }).sort((a, b) => a.status === 'aguardando mapeamento' ? -1 : a.coluna.localeCompare(b.coluna));
  }

  /* ---------- MAPEAMENTO MANUAL ASSISTIDO (versionado, auditado) ---------- */
  function mapField(eng, def, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'FIELD_MAPPING_EDIT')) return negar(opts.papel, 'FIELD_MAPPING_EDIT');
    if (!def.coluna || !def.tipo || !def.entidade || !def.campo)
      return { blocked: true, reason: 'mapeamento exige coluna, tipo, entidade e campo interno' };
    if (!TIPOS_CAMPO.includes(def.tipo)) return { blocked: true, reason: 'tipo inválido: ' + def.tipo };
    if (!ENTIDADES_CAMPO.includes(def.entidade)) return { blocked: true, reason: 'entidade inválida: ' + def.entidade };
    const anterior = mappingAtivo(eng, def.coluna);
    if (anterior) anterior.fimVigencia = HOJE; /* nunca sobrescreve sem versão */
    const novo = Object.assign({ escopo: 'global', alimentaAnalise: true, auxiliar: def.tipo === 'Campo auxiliar' }, def,
      { id: 'fm' + (++eng.seq), versao: (anterior ? anterior.versao : 0) + 1, autor: opts.usuario || 'Marcos',
        em: HOJE, fimVigencia: null, anteriorId: anterior ? anterior.id : null, areas: def.areas || [def.entidade] });
    eng.customMappings.push(novo);
    delete eng.camposExcluidos[def.coluna];
    audit(eng, 'campo_mapeado', `"${def.coluna}" → ${def.campo} (${def.tipo} · ${def.entidade}) v${novo.versao}${anterior ? ' — versão anterior preservada' : ''}`, { usuario: opts.usuario });
    return { ok: true, mapeamento: novo, anterior };
  }
  function excluirCampoDaAnalise(eng, coluna, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'FIELD_MAPPING_EDIT')) return negar(opts.papel, 'FIELD_MAPPING_EDIT');
    if (!opts.motivo) return { blocked: true, reason: 'excluir campo da análise exige motivo' };
    eng.camposExcluidos[coluna] = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE,
      nota: 'coluna permanece na camada bruta — sai apenas das análises' };
    audit(eng, 'campo_excluido_analise', coluna + ' · ' + opts.motivo, { usuario: opts.usuario });
    return { ok: true };
  }
  function restaurarCampo(eng, coluna, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'FIELD_MAPPING_EDIT')) return negar(opts.papel, 'FIELD_MAPPING_EDIT');
    delete eng.camposExcluidos[coluna];
    audit(eng, 'campo_restaurado', coluna, { usuario: opts.usuario });
    return { ok: true };
  }

  /* reprocessar importação após novo mapeamento */
  function reprocess(eng, batchId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'IMPORT_REPROCESS')) return negar(opts.papel, 'IMPORT_REPROCESS');
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) return { blocked: true, reason: 'lote não encontrado' };
    const v = 'v' + ((+String(batch.mappingVersion).replace(/\D/g, '') || 1) + 1);
    batch.mappingVersion = v;
    const cat = fieldCatalog(eng, batchId);
    audit(eng, 'importacao_reprocessada', `${batchId} → mapeamento ${v}: ${cat.filter(c => c.status === 'utilizado').length} utilizados, ${cat.filter(c => c.status === 'aguardando mapeamento').length} aguardando`, { batchId, usuario: opts.usuario });
    return { ok: true, mappingVersion: v,
      utilizados: cat.filter(c => c.status === 'utilizado').length,
      aguardando: cat.filter(c => c.status === 'aguardando mapeamento').length };
  }

  /* ---------- RELACIONAMENTOS AUTOMÁTICOS + FILA DE REVISÃO ---------- */
  function relacoesReport(eng, products) {
    products = products || [];
    const ov = ordersView(eng, { incluirExcluidos: true });
    const comEvento = ov.todos.filter(o => o.eventos.length).length;
    const skuProduto = { vinculados: 0, semProduto: [] };
    const skusProdutos = new Set(products.flatMap(p => [p.sku, ...((p.variacoes || []).map(v => v.sku))]).filter(Boolean));
    for (const o of ov.todos) {
      if (!o.sku) continue;
      if (skusProdutos.has(o.sku)) skuProduto.vinculados++;
      else if (!skuProduto.semProduto.includes(o.sku)) skuProduto.semProduto.push(o.sku);
    }
    /* fila de revisão: relação incerta NUNCA vincula sozinha */
    const fila = [];
    for (const o of eng.observations.filter(x => x.vinculo === 'VÍNCULO SUGERIDO POR NOME'))
      fila.push({ id: 'rev-obs-' + o.id, tipo: 'Anúncio ↔ Produto (sugestão por nome)', alvo: o.item_id,
        evidencia: `nome similar a produto interno — confiança baixa; nunca vinculado automaticamente`, acoes: ['confirmar', 'rejeitar', 'ignorar'] });
    for (const e of ov.eventosOrfaos)
      fila.push({ id: 'rev-evt-' + (e.eventId || e.orderId), tipo: 'Devolução sem pedido', alvo: e.orderId,
        evidencia: `evento ${e.tipo} cita pedido ${e.orderId} não importado (${e.arquivo})`, acoes: ['ignorar', 'solicitar dado'] });
    for (const sku of skuProduto.semProduto)
      fila.push({ id: 'rev-sku-' + sku, tipo: 'SKU de pedido sem produto interno', alvo: sku,
        evidencia: `pedidos usam o SKU ${sku}, sem correspondência no catálogo — importar cadastro ou mapear`, acoes: ['confirmar', 'ignorar'] });
    const decididos = new Set(eng.revisoesRelacao.map(r => r.id));
    return {
      pedidosDevolucoes: { vinculados: comEvento, orfaos: ov.eventosOrfaos.length, chave: 'marketplace + conta + ID do pedido' },
      pedidosProdutos: Object.assign(skuProduto, { chave: 'marketplace + conta + SKU' }),
      produtosAnuncios: { confirmados: eng.observations.filter(o => /CONFIRMADO/.test(o.vinculo)).length,
        sugeridos: eng.observations.filter(o => /SUGERIDO/.test(o.vinculo)).length, chave: 'ID externo → SKU → nome (só sugestão)' },
      fila: fila.filter(f => !decididos.has(f.id)),
      decididas: eng.revisoesRelacao.length,
    };
  }
  function decidirRelacao(eng, filaId, decisao, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'DATA_SOURCE_EDIT_SCOPE')) return negar(opts.papel, 'DATA_SOURCE_EDIT_SCOPE');
    if (!['confirmar', 'rejeitar', 'ignorar', 'solicitar dado'].includes(decisao)) return { blocked: true, reason: 'decisão inválida' };
    eng.revisoesRelacao.push({ id: filaId, decisao, por: opts.usuario || 'Marcos', em: HOJE });
    audit(eng, 'relacao_decidida', filaId + ' → ' + decisao, { usuario: opts.usuario });
    return { ok: true };
  }

  /* ---------- COBERTURA REAL: dado importado desativa fixture equivalente ---------- */
  function coberturaReal(eng) {
    const tem = destinos => eng.batches.some(b => b.aplicado && !b.arquivado && destinos.includes(b.det.destino));
    return { pedidos: tem(['pedidos']), devolucoes: tem(['devolucoes']), catalogo: tem(['catalogo']),
      performance: tem(['performance', 'performance_item', 'contrib_produto']), estoque: tem(['estoque']), afiliados: tem(['afiliados', 'atribuicao']),
      atendimento: tem(['atendimento']), trafego: tem(['trafego_visao', 'trafego', 'funil']),
      algum: eng.batches.some(b => b.aplicado && !b.arquivado),
      nota: 'quando o dado real existe, o indicador demo equivalente é desativado e a análise recalculada' };
  }

  /* =============================================================
     10.E.2.3 — LEITORES DA BASE MULTIABAS (métricas, fontes, produtos)
     Todo número vem com fonte, aba, período e granularidade. A linha
     consolidada (PERIOD_SUMMARY) alimenta os totais do período e NUNCA
     entra na série diária.
     ============================================================= */
  const ADITIVOS_MET = ['gross_sales_brl', 'sales_before_shopee_discount_brl', 'orders_created', 'product_clicks',
    'visitors', 'cancelled_orders', 'cancelled_sales_brl', 'returned_or_refunded_orders', 'returned_or_refunded_sales_brl',
    'buyers', 'new_buyers', 'returning_buyers', 'potential_buyers'];
  function aggMetricas(lista) {
    const out = {};
    for (const m of lista) for (const k of ADITIVOS_MET) if (m && m[k] != null) out[k] = Math.round(((out[k] || 0) + m[k]) * 100) / 100;
    if (out.orders_created != null && out.visitors) out.order_conversion_rate = Math.round((out.orders_created / out.visitors) * 1e6) / 1e6;
    if (out.gross_sales_brl != null && out.orders_created) out.revenue_per_order_brl = Math.round((out.gross_sales_brl / out.orders_created) * 100) / 100;
    return out;
  }
  function metricasView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'metricas' && !s.excluidoDaAnalise &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, bases: [] };
    const byBase = {};
    for (const s of snaps) {
      const b = s.baseMetrica || 'base';
      const acc = byBase[b] || (byBase[b] = { base: b, nomeBase: s.nomeBase || NOME_BASE[b] || b, periodo: null, diario: [],
        fonte: s.sourceFile, aba: s.sourceSheet, marketplace: s.escopo.marketplace, origem: s.origem });
      if (s.tipoLinha === 'PERIOD_SUMMARY') acc.periodo = { ini: s.periodo_ini, fim: s.periodo_fim, metricas: s.metricas };
      else if (s.tipoLinha === 'DAILY_METRIC') acc.diario.push({ data: s.data, metricas: s.metricas });
    }
    const bases = Object.values(byBase).map(b => {
      b.diario.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
      const totais = b.periodo ? b.periodo.metricas : aggMetricas(b.diario.map(d => d.metricas));
      const ini = b.periodo ? b.periodo.ini : (b.diario[0] && b.diario[0].data) || null;
      const fim = b.periodo ? b.periodo.fim : (b.diario[b.diario.length - 1] && b.diario[b.diario.length - 1].data) || null;
      return { base: b.base, nomeBase: b.nomeBase, fonte: b.fonte, aba: b.aba, marketplace: b.marketplace, origem: b.origem,
        periodo: { ini, fim, granularidade: b.periodo ? 'agregada de período (linha consolidada)' : 'agregada das diárias' },
        totais, temResumoPeriodo: !!b.periodo, diario: b.diario, dias: b.diario.length };
    });
    return { semDados: false, bases };
  }
  function trafficSourcesView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'fonte_trafego' && !s.excluidoDaAnalise &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, fontes: [] };
    const fontes = snaps.map(s => Object.assign({ fonte: s.fonte, classe: s.classeFonte || 'trafego',
      fonteArquivo: s.sourceFile, aba: s.sourceSheet, periodo: { ini: s.periodo_ini, fim: s.periodo_fim }, origem: s.origem }, s.metricas || {}));
    return { semDados: false, fontes,
      trafego: fontes.filter(f => f.classe === 'trafego'), afiliados: fontes.filter(f => f.classe === 'afiliados'), ads: fontes.filter(f => f.classe === 'ads') };
  }
  /* 10.E.2.5 — Ads (campanhas) e Afiliados: sempre explicativos, nunca somam receita */
  function adsView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'ads' && !s.excluidoDaAnalise && (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, campanhas: [] };
    const campanhas = snaps.map(s => Object.assign({ campanha: s.campanha, fonteArquivo: s.sourceFile,
      periodo: { ini: s.periodo_ini, fim: s.periodo_fim }, origem: s.origem, status: (s.raw && s.raw['Status']) || null }, s.metricas || {}));
    const totalGmv = Math.round(campanhas.reduce((a, c) => a + (c.gmv || 0), 0) * 100) / 100;
    const totalSpend = Math.round(campanhas.reduce((a, c) => a + (c.ad_spend || 0), 0) * 100) / 100;
    return { semDados: false, campanhas, totalGmv, totalSpend,
      nota: 'GMV e receita de Ads são métricas de atribuição/performance — NÃO são somadas ao faturamento total' };
  }
  function afiliadosView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'afiliados' && !s.excluidoDaAnalise && (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, registros: [] };
    const registros = snaps.map(s => Object.assign({ pedido: s.external_order_id, atribuicao: s.attributionId, campanha: s.campanha,
      produto: (s.raw && s.raw['Nome do Produto']) || null, fonteArquivo: s.sourceFile }, s.metricas || {}));
    const comissao = Math.round(registros.reduce((a, r) => a + (r.affiliate_commission_brl || 0), 0) * 100) / 100;
    const reembolso = Math.round(registros.reduce((a, r) => a + (r.refund_value_brl || 0), 0) * 100) / 100;
    return { semDados: false, registros, comissaoTotal: comissao, reembolsoTotal: reembolso,
      nota: 'afiliados explicam atribuição, comissão e reembolso — nunca duplicam o faturamento' };
  }
  function productContribView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'contrib_produto' && !s.excluidoDaAnalise &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, produtos: [] };
    const produtos = snaps.map(s => Object.assign({ item_id: s.item_id, produto: s.produtoNome, status: s.statusItem,
      fonteArquivo: s.sourceFile, aba: s.sourceSheet, periodo: { ini: s.periodo_ini, fim: s.periodo_fim },
      vinculo: s.vinculo ? s.vinculo.estado : 'SEM VÍNCULO', vendido: !!(s.metricas && s.metricas.orders), origem: s.origem }, s.metricas || {}))
      .sort((a, b) => (b.sales || 0) - (a.sales || 0));
    return { semDados: false, produtos,
      revisaoHumana: produtos.filter(p => /SUGERIDO|CONFLITO|SEM CORRESPOND|AUSENTE|SEM VÍNCULO/.test(p.vinculo)) };
  }

  /* ---------- 10.E.2.5.1 · PERFORMANCE DE PRODUTOS (por anúncio/variação, todos os campos) ---------- */
  function performanceItemView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'performance_item' && !s.excluidoDaAnalise &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, itens: [], periodo: null, conta: null };
    const g = (m, k) => m && m[k] != null ? +m[k] : null;
    const itens = snaps.map(s => {
      const m = s.metricas || {};
      /* funil só com etapas presentes — etapa ausente é declarada, nunca inventada */
      const funil = [
        ['Impressões', g(m, 'impressions')], ['Cliques', g(m, 'clicks')], ['Visitantes', g(m, 'visitors')],
        ['Visualizações de página', g(m, 'page_views')], ['Adição ao carrinho', g(m, 'cart_units')],
        ['Pedido Realizado', g(m, 'orders_placed')], ['Produto Pago', g(m, 'orders_paid')],
      ].map(([etapa, valor]) => ({ etapa, valor, disponivel: valor != null }));
      return {
        item_id: s.item_id, variacao_id: s.variacao_id, produto: s.produtoNome, variacao: s.variacaoNome,
        sku_pai: s.sku_pai, sku_variacao: s.sku_variacao, statusItem: s.statusItem, statusVariacao: s.statusVariacao,
        marketplace: s.escopo.marketplace, conta: s.escopo.contaId, metricas: m, funil,
        fonteArquivo: s.sourceFile, aba: s.sourceSheet, periodo: { ini: s.periodo_ini, fim: s.periodo_fim }, key: s.key,
      };
    }).sort((a, b) => (g(b.metricas, 'sales_paid_brl') || 0) - (g(a.metricas, 'sales_paid_brl') || 0));
    const i0 = itens[0];
    const tot = campo => itens.reduce((a, x) => a + (g(x.metricas, campo) || 0), 0);
    return { semDados: false, itens, periodo: i0.periodo, conta: i0.conta, fonteArquivo: i0.fonteArquivo,
      totais: { impressions: tot('impressions'), clicks: tot('clicks'), cart_units: tot('cart_units'),
        orders_placed: tot('orders_placed'), orders_paid: tot('orders_paid'),
        sales_placed_brl: Math.round(tot('sales_placed_brl') * 100) / 100, sales_paid_brl: Math.round(tot('sales_paid_brl') * 100) / 100 } };
  }

  /* ---------- 10.E.2.5.1 · DEVOLUÇÕES E CANCELAMENTOS (export real, todos os campos) ---------- */
  function devolucoesView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'devolucoes' && !s.excluidoDaAnalise &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId));
    if (!snaps.length) return { semDados: true, eventos: [], reembolsoTotal: 0 };
    const eventos = snaps.map(s => {
      const m = s.metricas || {};
      return { return_id: s.return_id || s.event_id || null, pedido: s.external_order_id, tipo: s.tipo_evento,
        status: s.statusDevol || null, motivo: s.motivo || (s.raw['Motivo'] || null),
        produto: s.produtoNome, variacao: s.variacaoNome, sku_pai: s.sku_pai, sku_variacao: s.sku_variacao,
        quantidade: m.return_qty != null ? +m.return_qty : (s.raw['Quantidade de Devoluções'] != null ? +s.raw['Quantidade de Devoluções'] : null),
        precoUnidade: m.unit_price_brl != null ? +m.unit_price_brl : null,
        reembolso: m.refund_total_brl != null ? +m.refund_total_brl : (+s.raw['Valor reembolsado'] || 0),
        tempoEnvio: m.return_ship_time != null ? m.return_ship_time : (s.raw['Tempo de Envio de Devolução'] || null),
        tempoReembolso: m.refund_elapsed != null ? m.refund_elapsed : (s.raw['Tempo Decorrido de Reembolso'] || null),
        retornoArmazem: s.retornoArmazem || null, dataPedido: s.raw['Data de Criação do Pedido'] || s.data || null,
        marketplace: s.escopo.marketplace, conta: s.escopo.contaId, fonteArquivo: s.sourceFile, key: s.key };
    });
    const reembolsoTotal = Math.round(eventos.reduce((a, e) => a + (e.reembolso || 0), 0) * 100) / 100;
    const porMotivo = {}, porStatus = {};
    for (const e of eventos) { if (e.motivo) porMotivo[e.motivo] = (porMotivo[e.motivo] || 0) + 1; if (e.status) porStatus[e.status] = (porStatus[e.status] || 0) + 1; }
    const periodo = eventos.map(e => e.dataPedido).filter(Boolean).sort();
    return { semDados: false, eventos, reembolsoTotal,
      cancelamentos: eventos.filter(e => /cancel/i.test(e.tipo || '') || /cancel/i.test(e.status || '')),
      retornoArmazem: eventos.filter(e => e.retornoArmazem && !/^(não|nao|no|-)/i.test(String(e.retornoArmazem))),
      porMotivo, porStatus, periodo: periodo.length ? { ini: periodo[0], fim: periodo[periodo.length - 1] } : null,
      nota: 'evento de devolução nunca cria pedido novo; cruza por marketplace + conta + ID do pedido' };
  }

  /* ---------- CADEIA EXPLÍCITA PÓS-IMPORTAÇÃO (15 passos com progresso real) ---------- */
  function applyImportChain(eng, batchId, opts) {
    opts = opts || {};
    const antesIns = mesaInsights(eng, {}).insights.map(i => i.titulo);
    const antesOrders = ordersView(eng, {}).orders.length;
    const r = apply(eng, batchId, opts);
    if (r.blocked) return r;
    const batch = r.job;
    const rf = eng.rawFiles.find(x => x.batchId === batchId) || { abas: [{ headers: [], rows: [] }] };
    const cat = fieldCatalog(eng, batchId);
    const depois = mesaInsights(eng, {});
    const novos = depois.insights.filter(i => !antesIns.includes(i.titulo));
    const ov = ordersView(eng, {});
    const rel = relacoesReport(eng, opts.products || []);
    const destino = batch.det.destino;
    const areasAfetadas = ['Fontes e Dados', 'Central de Inteligência', 'Home', 'Silêncio', 'Conhecimento']
      .concat(destino === 'pedidos' || destino === 'devolucoes' ? ['Pedidos', 'Centro de Custos'] : [])
      .concat(['catalogo', 'performance', 'estoque', 'contrib_produto'].includes(destino) ? ['Catálogo'] : [])
      .concat(destino === 'metricas' ? ['Métricas Principais', 'Tráfego', 'Centro de Custos'] : [])
      .concat(destino === 'fonte_trafego' ? ['Tráfego', 'Afiliados', 'Ads', 'Catálogo'] : []);
    const passos = [
      ['Arquivo bruto persistido', `${rf.abas.length} aba(s) · ${rf.abas[0].headers.length} coluna(s) · ${rf.abas.reduce((a, x) => a + x.rows.length, 0)} linha(s) — nada descartado`],
      ['Colunas e linhas preservadas', `${cat.length} coluna(s) no catálogo de campos`],
      ['Mapeamento aplicado', `${cat.filter(c => c.status === 'utilizado').length} utilizadas · ${cat.filter(c => c.status === 'preservado e disponível').length} auxiliares · ${cat.filter(c => c.status === 'aguardando mapeamento').length} aguardando mapeamento`],
      ['Dados normalizados', `${batch.aplicado.criados} criado(s) · ${batch.aplicado.atualizados} atualizado(s)`],
      ['Entidades relacionadas', `pedidos↔devoluções: ${rel.pedidosDevolucoes.vinculados} · pedidos↔produtos: ${rel.pedidosProdutos.vinculados} por SKU`],
      ['Duplicidades reconciliadas', `${batch.aplicado.duplicadosEvitados} duplicado(s) evitado(s) — nunca somados`],
      ['Cobertura atualizada', batch.periodo ? batch.periodo.ini + ' a ' + batch.periodo.fim : 'período do arquivo'],
      ['Dashboards recalculados', areasAfetadas.join(' · ')],
      ['Agentes reprocessados', depois.agentes.filter(a => a.status === 'ANALISADO' || a.status === 'DADO CONFLITANTE' || a.status === 'COBERTURA PARCIAL').map(a => a.nome).join(' · ') || 'nenhum com dado suficiente'],
      ['Home atualizada', coberturaReal(eng).algum ? 'base real ativa no cockpit' : '—'],
      ['Mesa de Inteligência atualizada', novos.length + ' insight(s) novo(s)'],
      ['Silêncio atualizado', sinaisSilencio(eng).length + ' sinal(is) avaliado(s) sem ação necessária'],
      ['Conhecimento atualizado', fatosConhecimento(eng).length + ' fato(s) com fonte registrados'],
      ['Pedidos/Catálogo/Custos', areasAfetadas.filter(a => ['Pedidos', 'Catálogo', 'Centro de Custos'].includes(a)).join(' · ') || 'não aplicável a esta fonte'],
      ['Histórico registrado', 'lote ' + batchId + ' · trilha completa em Fontes e Histórico'],
    ].map(([nome, resultado], i) => ({ n: i + 1, nome, resultado }));
    const impacto = {
      batchId, em: HOJE, fonte: (batch.preview && batch.preview.perfilNome) || batch.det.perfil,
      arquivo: batch.arquivo, periodo: batch.periodo, escopo: batch.escopo,
      entidadesAtualizadas: { criados: batch.aplicado.criados, atualizados: batch.aplicado.atualizados,
        duplicadosEvitados: batch.aplicado.duplicadosEvitados, pedidosTotais: ov.orders.length, antes: antesOrders },
      indicadoresRecalculados: areasAfetadas,
      insightsNovos: novos.map(i => ({ nivel: i.nivel, titulo: i.titulo, fato: i.fato, fonte: i.fonte, confianca: i.confianca })),
      insightsTotais: depois.insights.length,
      conflitos: batch.aplicado.conflitos, filaRevisao: rel.fila.length,
      dadosFaltantes: depois.agentes.filter(a => a.status === 'AGUARDANDO DADOS').map(a => a.dadosFaltantes),
      acoesSugeridas: novos.length ? ['Abrir análise dos insights novos', 'Revisar fila de relacionamentos'] : ['Revisar fila de relacionamentos'],
    };
    eng.impactos.push(impacto);
    audit(eng, 'cadeia_pos_importacao', batchId + ': 15 passos executados · ' + novos.length + ' insight(s) novo(s)', { batchId });
    return { job: r.job, passos, impacto };
  }
  const lastImpact = eng => eng.impactos[eng.impactos.length - 1] || null;

  /* ---------- SILÊNCIO: sinais avaliados que NÃO exigem ação (com motivo e fonte) ---------- */
  function sinaisSilencio(eng) {
    if (!eng.batches.some(b => b.aplicado)) return [];
    const m = mesaInsights(eng, {});
    const out = m.cruzamentos.filter(c => c.estado === 'ANALISADO' && /nenhum caso/.test(c.resultado || ''))
      .map(c => ({ sinal: c.nome, fonte: 'cruzamento sobre dados importados', motivo: 'avaliado — nenhum caso encontrado no recorte; abaixo do limiar de alerta', periodo: 'dados importados', estado: 'ok' }));
    const st = orderStats(eng, {});
    if (!st.semDados) {
      const per = st.fontes[0] && st.fontes[0].periodo ? st.fontes[0].periodo.ini + ' a ' + st.fontes[0].periodo.fim : '—';
      const arqs = st.fontes.map(f => f.arquivo).join(', ');
      if (st.kpis.taxaCancelamento.taxa != null && st.kpis.taxaCancelamento.taxa <= 15)
        out.push({ sinal: 'Taxa de cancelamento ' + st.kpis.taxaCancelamento.taxa + '%', fonte: arqs,
          motivo: 'dentro do limiar (<=15%) — não exige ação', periodo: per, estado: 'ok' });
      if (st.kpis.falhasEntrega === 0)
        out.push({ sinal: 'Falhas de entrega: 0', fonte: arqs, motivo: 'nenhuma falha registrada no período — abaixo do limiar de alerta', periodo: per, estado: 'ok' });
      if (st.kpis.devolucoes === 0)
        out.push({ sinal: 'Devoluções: 0', fonte: arqs, motivo: 'nenhum evento de devolução no período importado — não exige ação', periodo: per, estado: 'ok' });
    }
    return out;
  }

  /* ---------- CONHECIMENTO: fatos com prova (fonte, campos, versão de dados) ---------- */
  function fatosConhecimento(eng) {
    const out = [];
    for (const b of eng.batches.filter(x => x.aplicado && !x.arquivado)) {
      out.push({ fato: `${b.aplicado.criados + b.aplicado.atualizados} registro(s) de ${(b.preview && b.preview.perfilNome) || b.det.destino} incorporados de "${b.arquivo}"`,
        fontes: b.arquivo, campos: (b.preview && b.preview.evidencias || []).slice(0, 6).join(', '),
        periodo: b.periodo ? b.periodo.ini + ' a ' + b.periodo.fim : 'não declarado',
        versaoDados: b.id + ' · mapeamento ' + b.mappingVersion, confianca: 'alta — dado importado', tipo: 'FATO' });
    }
    const m = eng.batches.some(b => b.aplicado) ? mesaInsights(eng, {}) : { insights: [] };
    for (const i of m.insights.filter(x => x.nivel === 'APRENDIZADO'))
      out.push({ fato: i.fato, fontes: i.fonte, campos: '—', periodo: i.periodo, versaoDados: 'insights da Mesa', confianca: i.confianca, tipo: 'FATO' });
    return out;
  }

  /* ---------------- fixtures (referência de schema — rotuladas, nunca dados padrão) ---------------- */
  const FIXTURES = {
    productTraffic: periodo => ({
      nome: 'producttraffic_Product_Card.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Product Card', headers: ['ID do Item', 'Produto', 'Status Atual do Item', 'Taxa de Vendas', 'Vendas', 'Impressões de Produto', 'Cliques por Produto', 'Pedidos', 'Unidades', 'CTR', 'Taxa de Conversão de Pedidos'],
        rows: [
          { 'ID do Item': '9001', 'Produto': 'Quadro Paisagem 60x90 Premium', 'Status Atual do Item': 'Normal', 'Vendas': 4210.5, 'Impressões de Produto': 18400, 'Cliques por Produto': 640, 'Pedidos': 41, 'Unidades': 44, 'CTR': 3.5, 'Taxa de Conversão de Pedidos': 6.4, 'SKU Pai': 'QP-6090' },
          { 'ID do Item': '9002', 'Produto': 'Kit 3 Quadros Sala Moderna', 'Status Atual do Item': 'Normal', 'Vendas': 6120.0, 'Impressões de Produto': 22100, 'Cliques por Produto': 810, 'Pedidos': 25, 'Unidades': 26, 'CTR': 3.7, 'Taxa de Conversão de Pedidos': 3.1, 'SKU Pai': 'KIT3-SALA' },
          { 'ID do Item': '9003', 'Produto': 'Quadro Paisagem 60x90 c/ Maleta', 'Status Atual do Item': 'Normal', 'Vendas': 1890.2, 'Impressões de Produto': 9300, 'Cliques por Produto': 210, 'Pedidos': 15, 'Unidades': 15, 'CTR': 2.3, 'Taxa de Conversão de Pedidos': 7.1, 'SKU Pai': 'QP-6090' },
          { 'ID do Item': '9004', 'Produto': 'Porta Retrato Vidro Duplo 3D', 'Status Atual do Item': 'Normal', 'Vendas': 820.1, 'Impressões de Produto': 5100, 'Cliques por Produto': 140, 'Pedidos': 14, 'Unidades': 16, 'CTR': 2.7, 'Taxa de Conversão de Pedidos': 10.0 },
          { 'ID do Item': '9005', 'Produto': 'Espelho Adnet Orgânico', 'Status Atual do Item': 'Normal', 'Vendas': 610.0, 'Impressões de Produto': 4400, 'Cliques por Produto': 90, 'Pedidos': 2, 'Unidades': 2, 'CTR': 2.0, 'Taxa de Conversão de Pedidos': 2.2, 'SKU Pai': 'DUP-1' },
        ] }],
    }),
    parentSku: () => ({
      nome: 'mass_update_parent_sku.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'Parent SKU Detail', headers: ['ID do Item', 'Nome do Produto', 'Status Atual do Item', 'SKU Pai', 'SKU da variação', 'Nome da variação', 'Preço', 'Estoque'],
        rows: [
          { 'ID do Item': '9001', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'Status Atual do Item': 'Normal', 'SKU Pai': 'QP-6090', 'SKU da variação': 'QP-6090', 'Nome da variação': 'única', 'Preço': 124.9, 'Estoque': 12 },
          { 'ID do Item': '9002', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'Status Atual do Item': 'Normal', 'SKU Pai': 'KIT3-SALA', 'SKU da variação': 'KIT3-SALA', 'Nome da variação': 'única', 'Preço': 244.9, 'Estoque': 3 },
          { 'ID do Item': '9006', 'Nome do Produto': 'Caneca Eco Cerâmica', 'Status Atual do Item': 'Normal', 'SKU Pai': 'DUP-1', 'SKU da variação': 'DUP-1-A', 'Nome da variação': '350ml', 'Preço': 37.9, 'Estoque': 10 },
        ] }],
    }),
    salesOverview: (periodo, dias) => ({
      nome: 'salesoverview_' + periodo.ini + '.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Sales Overview', headers: ['Data', 'Visitantes', 'Compradores de Pedidos Feitos', 'Pedidos Feitos', 'Unidades Pedidas', 'Vendas de Pedidos Feitos', 'Compradores de Pedidos Pagos', 'Pedidos Pagos', 'Unidades Pagas', 'Vendas de Pedidos Pagos'],
        rows: dias.map(d => ({ 'Data': d, 'Visitantes': 900, 'Pedidos Feitos': 30, 'Unidades Pedidas': 33, 'Vendas de Pedidos Feitos': 3400, 'Pedidos Pagos': 22, 'Unidades Pagas': 24, 'Vendas de Pedidos Pagos': 2500 })) }],
    }),
    promotion: periodo => ({
      nome: 'promotionoverview.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Promotion', headers: ['Nome da promoção', 'Tipo de promoção', 'Período da promoção', 'Status', 'Vendas de Pedidos Feitos', 'Vendas de Pedidos Pagos', 'Pedidos Pagos', 'Unidades Vendidas', 'Compradores'],
        rows: [{ 'Nome da promoção': 'Semana da Sala', 'Tipo de promoção': 'Desconto', 'Status': 'Encerrada', 'Vendas de Pedidos Pagos': 4100, 'Pedidos Pagos': 18, 'Unidades Vendidas': 21, 'Compradores': 17 }] }],
    }),
    voucher: periodo => ({
      nome: 'voucherreport.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Voucher', headers: ['Nome do Cupom', 'Código', 'Período de Reivindicação', 'Status', 'Tipo de Cupom', 'Resgates', 'Pedidos Pagos', 'Vendas Pagas', 'Custo'],
        rows: [{ 'Nome do Cupom': 'Frete Julho', 'Código': 'FRETEJUL', 'Status': 'Ativo', 'Resgates': 40, 'Pedidos Pagos': 12, 'Vendas Pagas': 1600, 'Custo': 180 }] }],
    }),
    channelContribution: periodo => ({
      nome: 'channel_contribution.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Canais', headers: ['Vendas pelos Cards dos Produtos', 'Vendas pelas Lives', 'Vendas pelos Vídeos', 'Vendas pelo Afiliado', 'Vendas pelos Anúncios'],
        rows: [{ 'Vendas pelos Cards dos Produtos': 41000, 'Vendas pelas Lives': 3200, 'Vendas pelos Vídeos': 1100, 'Vendas pelo Afiliado': 9200, 'Vendas pelos Anúncios': 14100 }] }],
    }),
    desconhecido: () => ({
      nome: 'relatorio_misterioso.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'Aba1', headers: ['Coluna A', 'Coluna B', 'Métrica X'], rows: [{ 'Coluna A': 1 }] }],
    }),

    /* ---------- 10.E.2 — fontes reais por área (schema dos exports Shopee) ---------- */
    ordersHeaders: ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Data de pagamento', 'Data de envio',
      'Data de entrega', 'Nome do Produto', 'SKU de referência', 'Nome da variação', 'Quantidade', 'Preço acordado',
      'Valor Total', 'Frete pago pelo comprador', 'Taxa de comissão', 'Cidade', 'UF', 'CEP', 'Comprador'],
    orders: periodo => ({
      nome: 'Order.toship.20260601_20260630.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'orders', headers: FIXTURES.ordersHeaders, rows: [
        { 'ID do pedido': '2606001', 'Status do pedido': 'Não pago', 'Data de criação do pedido': '2026-06-20', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Nome da variação': 'única', 'Quantidade': 1, 'Preço acordado': 124.9, 'Valor Total': 124.9, 'Frete pago pelo comprador': 18.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '31270901', 'Comprador': 'M. S.' },
        { 'ID do pedido': '2606002', 'Status do pedido': 'A enviar', 'Data de criação do pedido': '2026-06-21', 'Data de pagamento': '2026-06-21', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'SKU de referência': 'KIT3-SALA', 'Quantidade': 1, 'Valor Total': 244.9, 'Frete pago pelo comprador': 0, 'Taxa de comissão': 34.3, 'Cidade': 'São Paulo', 'UF': 'SP', 'CEP': '04538132', 'Comprador': 'J. P.' },
        { 'ID do pedido': '2606003', 'Status do pedido': 'Em rota', 'Data de criação do pedido': '2026-06-22', 'Data de pagamento': '2026-06-22', 'Data de envio': '2026-06-23', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 2, 'Valor Total': 249.8, 'Cidade': 'Lagoa Santa', 'UF': 'MG', 'CEP': '33230001', 'Comprador': 'A. L.' },
        { 'ID do pedido': '2606004', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-18', 'Data de pagamento': '2026-06-18', 'Data de envio': '2026-06-19', 'Data de entrega': '2026-06-25', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'SKU de referência': 'PR-3D', 'Quantidade': 1, 'Valor Total': 89.9, 'Cidade': 'Curitiba', 'UF': 'PR', 'CEP': '80010010', 'Comprador': 'C. R.' },
        { 'ID do pedido': '2606005', 'Status do pedido': 'Cancelado', 'Data de criação do pedido': '2026-06-19', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 1, 'Valor Total': 124.9, 'Cidade': 'Rio de Janeiro', 'UF': 'RJ', 'CEP': '20040020', 'Comprador': 'F. T.' },
        { 'ID do pedido': '2606006', 'Status do pedido': 'Falha na entrega', 'Data de criação do pedido': '2026-06-15', 'Data de pagamento': '2026-06-15', 'Data de envio': '2026-06-16', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'SKU de referência': 'KIT3-SALA', 'Quantidade': 1, 'Valor Total': 244.9, 'Cidade': 'Manaus', 'UF': 'AM', 'CEP': '69005040', 'Comprador': 'R. B.' },
        { 'Status do pedido': 'Não pago', 'Nome do Produto': 'linha exportada sem ID — vai para "linhas com erro", nunca descartada em silêncio' },
      ] }],
    }),
    /* reimportação dia seguinte: MESMOS pedidos com status novo + 1 pedido novo + 1 linha idêntica */
    ordersV2: periodo => ({
      nome: 'Order.all.20260705.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'orders', headers: FIXTURES.ordersHeaders, rows: [
        { 'ID do pedido': '2606003', 'Status do pedido': 'Entregue', 'Data de criação do pedido': '2026-06-22', 'Data de pagamento': '2026-06-22', 'Data de envio': '2026-06-23', 'Data de entrega': '2026-07-04', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 2, 'Valor Total': 249.8, 'Cidade': 'Lagoa Santa', 'UF': 'MG', 'CEP': '33230001', 'Comprador': 'A. L.' },
        { 'ID do pedido': '2606001', 'Status do pedido': 'Cancelado', 'Data de criação do pedido': '2026-06-20', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 1, 'Valor Total': 124.9, 'Frete pago pelo comprador': 18.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '31270901', 'Comprador': 'M. S.' },
        { 'ID do pedido': '2606004', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-18', 'Data de pagamento': '2026-06-18', 'Data de envio': '2026-06-19', 'Data de entrega': '2026-06-25', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'SKU de referência': 'PR-3D', 'Quantidade': 1, 'Valor Total': 89.9, 'Cidade': 'Curitiba', 'UF': 'PR', 'CEP': '80010010', 'Comprador': 'C. R.' },
        { 'ID do pedido': '2607001', 'Status do pedido': 'A enviar', 'Data de criação do pedido': '2026-07-04', 'Data de pagamento': '2026-07-04', 'Nome do Produto': 'Espelho Adnet Orgânico', 'SKU de referência': 'ESP-ADN', 'Quantidade': 1, 'Valor Total': 159.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '30140071', 'Comprador': 'P. K.' },
      ] }],
    }),
    /* export REAL de pedidos Shopee (Order.all.order_creation_date...) — inclui a coluna
       auxiliar "Hot Listing", que NUNCA pode classificar o arquivo (regressão 10.E.3.1) */
    ordersRealHeaders: ['ID do pedido', 'Status do pedido', 'Hot Listing', 'Cancelar Motivo',
      'Status da Devolução / Reembolso', 'Número de rastreamento', 'Opção de envio', 'Método de envio',
      'Data de criação do pedido', 'Hora do pagamento do pedido', 'Data prevista de envio', 'Domestic Delivered Date',
      'Data da Finalização do Cancelamento', 'Nome do Produto', 'Número de referência SKU', 'Nome da variação',
      'Preço original', 'Preço acordado', 'Quantidade', 'Subtotal do produto', 'Descontos', 'Peso', 'Cupom',
      'Valor Total', 'Taxa de envio paga pelo comprador', 'Taxa de envio reversa', 'Taxa de transação',
      'Taxa de comissão', 'Taxa de serviço', 'Total global', 'Valor estimado do frete', 'Cidade', 'UF', 'País',
      'CEP', 'Observação do comprador', 'Nota'],
    ordersReal: periodo => ({
      nome: 'Order.all.order_creation_date.20260604_20260704.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'orders', headers: FIXTURES.ordersRealHeaders, rows: [
        { 'ID do pedido': '260620ABC001', 'Status do pedido': 'Concluído', 'Hot Listing': 'Sim',
          'Status da Devolução / Reembolso': '—', 'Número de rastreamento': 'BR123456789SP',
          'Opção de envio': 'Entrega padrão', 'Método de envio': 'Shopee Xpress',
          'Data de criação do pedido': '2026-06-20 10:12', 'Hora do pagamento do pedido': '2026-06-20 10:15',
          'Data prevista de envio': '2026-06-22', 'Domestic Delivered Date': '2026-06-27',
          'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'Número de referência SKU': 'QP-6090',
          'Nome da variação': 'única', 'Preço original': 149.9, 'Preço acordado': 124.9, 'Quantidade': 1,
          'Subtotal do produto': 124.9, 'Descontos': 25, 'Peso': '1.2kg', 'Cupom': 'JULHO10',
          'Valor Total': 124.9, 'Taxa de envio paga pelo comprador': 18.9, 'Taxa de transação': 2.8,
          'Taxa de comissão': 17.5, 'Taxa de serviço': 2.5, 'Total global': 143.8, 'Valor estimado do frete': 16.2,
          'Cidade': 'Belo Horizonte', 'UF': 'MG', 'País': 'BR', 'CEP': '31270901',
          'Observação do comprador': 'entregar na portaria', 'Nota': '' },
        { 'ID do pedido': '260625DEF002', 'Status do pedido': 'Não pago', 'Hot Listing': 'Não',
          'Data de criação do pedido': '2026-06-25 22:40', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna',
          'Número de referência SKU': 'KIT3-SALA', 'Nome da variação': 'única', 'Preço original': 249.9,
          'Preço acordado': 244.9, 'Quantidade': 1, 'Subtotal do produto': 244.9, 'Valor Total': 244.9,
          'Cidade': 'São Paulo', 'UF': 'SP', 'País': 'BR', 'CEP': '04538132' },
        { 'ID do pedido': '260628GHI003', 'Status do pedido': 'Cancelado', 'Hot Listing': 'Não',
          'Cancelar Motivo': 'comprador desistiu antes do envio', 'Data de criação do pedido': '2026-06-28 08:03',
          'Data da Finalização do Cancelamento': '2026-06-29', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D',
          'Número de referência SKU': 'PR-3D', 'Quantidade': 2, 'Preço acordado': 89.9,
          'Subtotal do produto': 179.8, 'Valor Total': 179.8, 'Cidade': 'Curitiba', 'UF': 'PR', 'País': 'BR', 'CEP': '80010010' },
      ] }],
    }),
    /* arquivo que é SÓ Hot Listing (sem assinatura de pedidos) — único caso em que o perfil auxiliar vale */
    hotListingOnly: () => ({
      nome: 'hot_listing_ranking.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'hot', headers: ['Hot Listing', 'Posição na categoria'], rows: [{ 'Hot Listing': 'Quadro 60x90', 'Posição na categoria': 3 }] }],
    }),
    returnZip: periodo => ({
      nome: 'Order.return_refund_cancel.zip', sourceType: 'PLANILHA_SHOPEE', periodo, zip: true,
      entries: [
        { nome: 'return_refund.xlsx', abas: [{ nome: 'events',
          headers: ['ID do pedido', 'Tipo de evento', 'ID do evento', 'Motivo', 'Valor reembolsado', 'Status da solicitação', 'Data'],
          rows: [
            { 'ID do pedido': '2606004', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-1', 'Motivo': 'produto diferente do anúncio', 'Valor reembolsado': 89.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-06-28' },
            { 'ID do pedido': '2606002', 'Tipo de evento': 'Reembolso', 'ID do evento': 'RR-2', 'Motivo': 'atraso na postagem', 'Valor reembolsado': 30, 'Status da solicitação': 'Em análise', 'Data': '2026-06-30' },
            { 'ID do pedido': '2606003', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-4', 'Motivo': 'avaria no transporte', 'Valor reembolsado': 124.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-02' },
            { 'ID do pedido': '2606005', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-5', 'Motivo': 'arrependimento', 'Valor reembolsado': 124.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-01' },
            { 'ID do pedido': '9999999', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-9', 'Motivo': 'pedido de outro período', 'Valor reembolsado': 50, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-01' },
          ] }] },
        { nome: 'leiame.txt', motivo: 'não é planilha — permanece no arquivo original, não é importado' },
      ],
    }),
    inventory: momento => ({
      nome: 'Current_Inventory_Report_' + String(momento).replace(/\D/g, '') + '.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null, momento,
      abas: [{ nome: 'inventory', headers: ['SKU', 'Nome do Produto', 'Armazém', 'Disponível', 'Reservado', 'Em trânsito', 'Momento da leitura'],
        rows: [
          { 'SKU': 'QP-6090', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'Armazém': 'Full BR-MG', 'Disponível': 3, 'Reservado': 2, 'Em trânsito': 0, 'Momento da leitura': momento },
          { 'SKU': 'KIT3-SALA', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'Armazém': 'Full BR-MG', 'Disponível': 40, 'Reservado': 1, 'Em trânsito': 12, 'Momento da leitura': momento },
          { 'SKU': 'PR-3D', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'Armazém': 'Full BR-SP', 'Disponível': 0, 'Reservado': 2, 'Em trânsito': 6, 'Momento da leitura': momento },
        ] }],
    }),
    affiliatesCsv: periodo => ({
      nome: 'ProductPerformance_2026-06-05_2026-07-04.csv', sourceType: 'PLANILHA_SHOPEE', periodo, formato: 'csv',
      abas: [{ nome: 'csv', headers: ['Afiliado', 'ID do Item', 'Produto', 'Cliques', 'Pedidos', 'Vendas do Afiliado', 'Comissão'],
        rows: [
          { 'Afiliado': 'creator_ana', 'ID do Item': '9002', 'Produto': 'Kit 3 Quadros Sala Moderna', 'Cliques': 320, 'Pedidos': 4, 'Vendas do Afiliado': 900, 'Comissão': 180 },
          { 'Afiliado': 'blog_decora', 'ID do Item': '9001', 'Produto': 'Quadro Paisagem 60x90 Premium', 'Cliques': 120, 'Pedidos': 3, 'Vendas do Afiliado': 400, 'Comissão': 20 },
        ] }],
    }),
    trafficOverview: periodo => ({
      nome: 'traffic_overview.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'overview', headers: ['Período', 'Visitantes', 'Visualizações da Página', 'Taxa de Rejeição', 'Novos Seguidores'],
        rows: [{ 'Período': periodo.ini + ' a ' + periodo.fim, 'Visitantes': 12400, 'Visualizações da Página': 31800, 'Taxa de Rejeição': 41.2, 'Novos Seguidores': 210 }] }],
    }),
    chat: () => ({
      nome: 'chat_metrics_export.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'chat', headers: ['Data', 'Perguntas recebidas', 'Perguntas respondidas', 'Taxa de resposta', 'Tempo médio de resposta'],
        rows: [
          { 'Data': '2026-07-01', 'Perguntas recebidas': 34, 'Perguntas respondidas': 24, 'Taxa de resposta': 71, 'Tempo médio de resposta': '3h12' },
          { 'Data': '2026-07-02', 'Perguntas recebidas': 28, 'Perguntas respondidas': 21, 'Taxa de resposta': 75, 'Tempo médio de resposta': '2h40' },
          { 'Data': '2026-07-03', 'Perguntas recebidas': 31, 'Perguntas respondidas': 22, 'Taxa de resposta': 71, 'Tempo médio de resposta': '4h05' },
        ] }],
    }),

    /* ---------- 10.E.2.5 — fontes REAIS Shopee (schema exato dos exports) ---------- */
    adsReal: periodo => ({
      nome: 'Dados+Gerais+de+Anúncios+Shopee.csv', sourceType: 'PLANILHA_SHOPEE', formato: 'csv', periodo,
      abas: [{ nome: 'csv', meta: ['Relatório de Todos os Anúncios CPC - Shopee Brasil', 'Nome da loja: Líder Molduras'],
        headers: ['#', 'Nome do Anúncio', 'Status', 'Tipo de Anúncio', 'ID do produto', 'Método de Lance', 'Data de Início',
          'Impressões', 'Cliques', 'CTR', 'Conversões', 'Taxa de Conversão', 'Itens Vendidos', 'GMV', 'Receita direta', 'Despesas', 'ROAS', 'ROAS Direto', 'ACOS'],
        rows: [
          { '#': 1, 'Nome do Anúncio': 'Grupo de Anúncios 24/06/2026 - 1', 'Status': 'Em Andamento', 'ID do produto': '-', 'Impressões': 45845, 'Cliques': 1636, 'CTR': '3.57%', 'Conversões': 24, 'Itens Vendidos': 24, 'GMV': 4494.65, 'Receita direta': 3507.05, 'Despesas': 350, 'ROAS': 12.84, 'ROAS Direto': 10.02, 'ACOS': '7.79%' },
          { '#': 2, 'Nome do Anúncio': 'Novo Grupo - 21/02', 'Status': 'Encerrado', 'Impressões': 225007, 'Cliques': 6586, 'CTR': '2.93%', 'Conversões': 104, 'Itens Vendidos': 105, 'GMV': 15452.20, 'Receita direta': 4439.07, 'Despesas': 2669.84, 'ROAS': 5.79, 'ACOS': '17.28%' },
        ] }],
    }),
    affiliateReal: periodo => ({
      nome: 'AFILIADO.csv', sourceType: 'PLANILHA_SHOPEE', formato: 'csv', periodo,
      abas: [{ nome: 'csv', headers: ['ID do pedido', 'Status do Pedido', 'Horário do pedido', 'ID do Produto', 'Nome do Produto',
        'ID da Promoção', 'Preço(R$)', 'Qtd', 'Id de atribuição da comissão', 'Campanha do parceiro', 'Campaign Type',
        'Valor da Compra(R$)', 'Valor do reembolso(R$)', 'Comissão do pedido da marca para o Afiliado(R$)', 'Taxa de Comissão do item da marca para o Afiliado', 'Canal', 'despesas(R$)'],
        rows: [
          { 'ID do pedido': '260705TQMQMPKT', 'Status do Pedido': 'Pendente', 'ID do Produto': '44411503612', 'Nome do Produto': 'Quadro Decorativo Grande', 'Preço(R$)': 288.61, 'Qtd': 1, 'Id de atribuição da comissão': '87129062', 'Campanha do parceiro': 'Campanha Aberta do Vendedor', 'Valor da Compra(R$)': 274.16, 'Valor do reembolso(R$)': 0, 'Comissão do pedido da marca para o Afiliado(R$)': 41.124, 'Canal': 'Ordem de Descoberta', 'despesas(R$)': 41.124 },
          { 'ID do pedido': '260705TQ4C1NHF', 'Status do Pedido': 'Pendente', 'ID do Produto': '55455415518', 'Nome do Produto': 'Kit 6 Quadros', 'Preço(R$)': 198.37, 'Qtd': 1, 'Id de atribuição da comissão': '87128863', 'Campanha do parceiro': 'Campanha Aberta do Vendedor', 'Valor da Compra(R$)': 198.37, 'Valor do reembolso(R$)': 0, 'Comissão do pedido da marca para o Afiliado(R$)': 8.92665, 'Canal': 'Ordem indireta', 'despesas(R$)': 8.92665 },
        ] }],
    }),
    inventoryFull: momento => ({
      nome: 'Current Inventory Report ' + String(momento).replace(/\D/g, '') + '.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null, momento,
      abas: [
        /* 10.E.2.5.1 — todas as 22 colunas do Current Inventory Report real */
        { nome: 'Total', headers: ['Product Name', 'Variations', 'Warehouse SKU ID', 'Seller SKU ID', 'Fulfill Mapping Mode', 'Shop SKU ID', 'Barcode', 'Recommend Replenishment Qty', 'Pending IR Approval', 'IR Approval', 'Pending ASN Inbound', 'Sellable', 'Reserved', 'Unsellable', 'Selling Speed', 'Coverage Days', 'Excess Qty', 'unitsSoldInLast7Days', 'unitsSoldInLast15Days', 'unitsSoldInLast30Days', 'unitsSoldInLast60Days', 'unitsSoldInLast90Days'],
          rows: [
            { 'Product Name': 'Quadro Paisagem 60x90', 'Variations': '60x90', 'Warehouse SKU ID': 'WH-QP-6090', 'Seller SKU ID': 'QP-6090', 'Fulfill Mapping Mode': 'Null', 'Shop SKU ID': 'SHOP-QP-6090', 'Barcode': '7890001112223', 'Recommend Replenishment Qty': 20, 'Pending IR Approval': 0, 'IR Approval': 0, 'Pending ASN Inbound': 0, 'Sellable': 4, 'Reserved': 2, 'Unsellable': 1, 'Selling Speed': 1.2, 'Coverage Days': 3, 'Excess Qty': 0, 'unitsSoldInLast7Days': 8, 'unitsSoldInLast15Days': 18, 'unitsSoldInLast30Days': 36, 'unitsSoldInLast60Days': 70, 'unitsSoldInLast90Days': 104 },
            { 'Product Name': 'Kit 3 Quadros', 'Variations': 'Sala', 'Warehouse SKU ID': 'WH-KIT3', 'Seller SKU ID': 'KIT3-SALA', 'Fulfill Mapping Mode': 'Null', 'Shop SKU ID': 'SHOP-KIT3', 'Barcode': '7890004445556', 'Recommend Replenishment Qty': 0, 'Pending IR Approval': 0, 'IR Approval': 0, 'Pending ASN Inbound': 0, 'Sellable': 40, 'Reserved': 1, 'Unsellable': 0, 'Selling Speed': 0.4, 'Coverage Days': 100, 'Excess Qty': 25, 'unitsSoldInLast7Days': 3, 'unitsSoldInLast15Days': 6, 'unitsSoldInLast30Days': 12, 'unitsSoldInLast60Days': 22, 'unitsSoldInLast90Days': 30 },
            /* SKU alinhado com o export de Performance (mesmo SKU da Variação) — permite o cruzamento Estoque×Performance por SKU */
            { 'Product Name': 'Kit 3 Quadros Decorativos Folhagem Dourada 40X60', 'Variations': 'Moldura Branca', 'Warehouse SKU ID': '26087246814_260259824996', 'Seller SKU ID': '456102-40X60-MB', 'Fulfill Mapping Mode': 'Null', 'Shop SKU ID': '20597021635_189573432678', 'Barcode': '7908638801613', 'Recommend Replenishment Qty': 30, 'Pending IR Approval': 0, 'IR Approval': 0, 'Pending ASN Inbound': 0, 'Sellable': 4, 'Reserved': 0, 'Unsellable': 1, 'Selling Speed': 0.27, 'Coverage Days': 15, 'Excess Qty': 0, 'unitsSoldInLast7Days': 2, 'unitsSoldInLast15Days': 5, 'unitsSoldInLast30Days': 8, 'unitsSoldInLast60Days': 15, 'unitsSoldInLast90Days': 22 },
          ] },
        { nome: 'Warehouse Stock', headers: ['Product Name', 'Warehouse SKU ID', 'Seller SKU ID', 'Warehouse', 'Stock Level', 'Sellable', 'Reserved'],
          rows: [{ 'Product Name': 'Quadro Paisagem 60x90', 'Warehouse SKU ID': 'WH-QP-6090', 'Seller SKU ID': 'QP-6090', 'Warehouse': 'Full BR-SP', 'Stock Level': 6, 'Sellable': 4, 'Reserved': 2 }] },
      ],
    }),
    /* 10.E.2.5.1 — Performance de Produtos (export "Análise de Produtos", por anúncio/variação) */
    productPerformanceReal: periodo => ({
      nome: 'Análise de Produtos Shopee.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Análise de Produtos',
        headers: ['ID do Item', 'Produto', 'Status Atual do Item', 'ID da Variação', 'Nome da Variação', 'Status Atual da Variação',
          'SKU Principal', 'SKU da Variação', 'Impressão do Produto', 'Impressões Únicas de Produto', 'Cliques Por Produto', 'Cliques Únicos no Produto',
          'CTR', 'Visitantes do Produto (Visita)', 'Visualizações da Página do Produto', 'Visitantes que saíram da página', 'Taxa de Rejeição do Produto',
          'Cliques em Buscas', 'Curtidas', 'Visitantes do Produto (Adicionar ao Carrinho)', 'Unidades (Adicionar ao Carrinho)', 'Taxa de Conversão (Adicionar ao Carrinho)',
          'Vendas (Pedido Realizado) (BRL)', 'Vendas (Pedido Pago) (BRL)', 'Pedido Feito', 'Produto Pago', 'Unidades (Pedido Realizado)', 'Unidades (Pedido Pago)',
          'Compradores (Pedido Realizado)', 'Compradores (Pedido Pago)', 'Taxa de Conversão de Pedido (Pedido Realizado)', 'Taxa de Conversão de Pedido (Pedido Pago)',
          'Vendas por Pedido (Pedido Realizado) (BRL)', 'Vendas por Pedido (Pedido Pago) (BRL)'],
        rows: [
          { 'ID do Item': '20597021635', 'Produto': 'Kit 3 Quadros Decorativos Folhagem Dourada 40X60', 'Status Atual do Item': 'Ativo',
            'ID da Variação': '189573432678', 'Nome da Variação': 'Moldura Branca', 'Status Atual da Variação': 'Ativo',
            'SKU Principal': '456102', 'SKU da Variação': '456102-40X60-MB', 'Impressão do Produto': '5.071.863', 'Impressões Únicas de Produto': '755.913',
            'Cliques Por Produto': '185.395', 'Cliques Únicos no Produto': '83.158', 'CTR': '3,66%', 'Visitantes do Produto (Visita)': '80.150',
            'Visualizações da Página do Produto': '96.500', 'Visitantes que saíram da página': '61.240', 'Taxa de Rejeição do Produto': '76,40%',
            'Cliques em Buscas': '12.400', 'Curtidas': '3.210', 'Visitantes do Produto (Adicionar ao Carrinho)': '9.850', 'Unidades (Adicionar ao Carrinho)': '11.320',
            'Taxa de Conversão (Adicionar ao Carrinho)': '12,29%', 'Vendas (Pedido Realizado) (BRL)': '272.982,45', 'Vendas (Pedido Pago) (BRL)': '242.565,98',
            'Pedido Feito': '1.150', 'Produto Pago': '1.085', 'Unidades (Pedido Realizado)': '1.266', 'Unidades (Pedido Pago)': '1.180',
            'Compradores (Pedido Realizado)': '1.085', 'Compradores (Pedido Pago)': '1.010', 'Taxa de Conversão de Pedido (Pedido Realizado)': '0,62%',
            'Taxa de Conversão de Pedido (Pedido Pago)': '0,56%', 'Vendas por Pedido (Pedido Realizado) (BRL)': '237,27', 'Vendas por Pedido (Pedido Pago) (BRL)': '223,56' },
          { 'ID do Item': '44411503612', 'Produto': 'Quadro Decorativo Grande Abstrato', 'Status Atual do Item': 'Ativo',
            'ID da Variação': '', 'Nome da Variação': '', 'Status Atual da Variação': '', 'SKU Principal': '778211', 'SKU da Variação': '778211-UNICO',
            'Impressão do Produto': '840.220', 'Impressões Únicas de Produto': '210.500', 'Cliques Por Produto': '21.030', 'Cliques Únicos no Produto': '14.900',
            'CTR': '2,50%', 'Visitantes do Produto (Visita)': '13.800', 'Visualizações da Página do Produto': '15.200', 'Visitantes que saíram da página': '11.900',
            'Taxa de Rejeição do Produto': '86,20%', 'Cliques em Buscas': '2.100', 'Curtidas': '540', 'Visitantes do Produto (Adicionar ao Carrinho)': '980',
            'Unidades (Adicionar ao Carrinho)': '1.040', 'Taxa de Conversão (Adicionar ao Carrinho)': '7,10%', 'Vendas (Pedido Realizado) (BRL)': '18.640,00',
            'Vendas (Pedido Pago) (BRL)': '14.320,00', 'Pedido Feito': '64', 'Produto Pago': '49', 'Unidades (Pedido Realizado)': '64', 'Unidades (Pedido Pago)': '49',
            'Compradores (Pedido Realizado)': '61', 'Compradores (Pedido Pago)': '47', 'Taxa de Conversão de Pedido (Pedido Realizado)': '0,44%',
            'Taxa de Conversão de Pedido (Pedido Pago)': '0,34%', 'Vendas por Pedido (Pedido Realizado) (BRL)': '291,25', 'Vendas por Pedido (Pedido Pago) (BRL)': '292,24' },
        ] }],
    }),
    /* 10.E.2.5.1 — Devoluções e Cancelamentos (export real, por ID da Devolução) */
    returnsReal: periodo => ({
      nome: 'Devolucoes_Reembolsos_Shopee.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Devoluções',
        headers: ['ID da Devolução', 'ID do Pedido', 'Data de Criação do Pedido', 'Nome de Usuário do Comprador', 'Nome do Produto', 'SKU Principal',
          'Nome da Variação', 'SKU da Variação', 'IMEI', 'Preço da Unidade', 'Tempo de Envio de Devolução', 'Status da Devolução / Reembolso',
          'Tipo de Devolução', 'Quantidade de Devoluções', 'Solução para Retorno e Reembolso', 'Motivo da Devolução', 'Observações da Devolução',
          'Quantia Total de Reembolsos', 'Tempo Decorrido de Reembolso', 'Retorno ao Armazém Shopee'],
        rows: [
          { 'ID da Devolução': 'RET-260701-001', 'ID do Pedido': '260628ABC123', 'Data de Criação do Pedido': '2026-06-28', 'Nome de Usuário do Comprador': 'j***a',
            'Nome do Produto': 'Kit 3 Quadros Decorativos Folhagem Dourada 40X60', 'SKU Principal': '456102', 'Nome da Variação': 'Moldura Branca',
            'SKU da Variação': '456102-40X60-MB', 'IMEI': '', 'Preço da Unidade': '237,27', 'Tempo de Envio de Devolução': '2 dias',
            'Status da Devolução / Reembolso': 'Reembolso Concluído', 'Tipo de Devolução': 'Devolução com produto', 'Quantidade de Devoluções': '1',
            'Solução para Retorno e Reembolso': 'Reembolso integral', 'Motivo da Devolução': 'Produto danificado no transporte', 'Observações da Devolução': 'Moldura trincada',
            'Quantia Total de Reembolsos': '237,27', 'Tempo Decorrido de Reembolso': '5 dias', 'Retorno ao Armazém Shopee': 'Sim' },
          { 'ID da Devolução': 'RET-260702-002', 'ID do Pedido': '260630XYZ789', 'Data de Criação do Pedido': '2026-06-30', 'Nome de Usuário do Comprador': 'm***s',
            'Nome do Produto': 'Quadro Decorativo Grande Abstrato', 'SKU Principal': '778211', 'Nome da Variação': '', 'SKU da Variação': '778211-UNICO', 'IMEI': '',
            'Preço da Unidade': '292,24', 'Tempo de Envio de Devolução': '—', 'Status da Devolução / Reembolso': 'Reembolso Concluído',
            'Tipo de Devolução': 'Cancelamento', 'Quantidade de Devoluções': '1', 'Solução para Retorno e Reembolso': 'Reembolso sem devolução',
            'Motivo da Devolução': 'Desistência do comprador', 'Observações da Devolução': '', 'Quantia Total de Reembolsos': '292,24',
            'Tempo Decorrido de Reembolso': '2 dias', 'Retorno ao Armazém Shopee': 'Não' },
        ] }],
    }),
    chatReal: periodo => ({
      nome: 'chat_20260604_20260703.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [
        { nome: 'Tendências das Métricas', headers: ['Data', 'Visitantes', 'Chat Consultado', 'Chats Respondidos', 'Chats Não-Respondidos', 'Tempo médio de resposta', 'CSAT %', 'Taxa de Resposta do Chat', 'Compradores', 'Pedidos', 'Vendas (BRL)'],
          rows: [
            { 'Data': '2026-07-01', 'Visitantes': 340, 'Chat Consultado': 34, 'Chats Respondidos': 24, 'Chats Não-Respondidos': 10, 'Tempo médio de resposta': '3h12', 'CSAT %': '92%', 'Taxa de Resposta do Chat': '71%', 'Compradores': 12, 'Pedidos': 14 },
            { 'Data': '2026-07-02', 'Visitantes': 310, 'Chat Consultado': 28, 'Chats Respondidos': 21, 'Chats Não-Respondidos': 7, 'Tempo médio de resposta': '2h40', 'CSAT %': '95%', 'Taxa de Resposta do Chat': '75%', 'Compradores': 10, 'Pedidos': 11 },
          ] }],
    }),

    /* ---------- 10.E.2.3 — MÉTRICAS PRINCIPAIS: arquivo real multiabas (8 abas) ----------
       Valores em formato brasileiro (335.392,51 · 0,63% · 1.375) e linha consolidada
       de período (04/06/2026-03/07/2026) convivendo com linhas diárias. Os totais do
       período batem exatamente com os números de validação do sprint. */
    metricasPrincipais: periodo => {
      periodo = periodo || { ini: '2026-06-04', fim: '2026-07-03' };
      const METCOLS = ['Data', 'Vendas (BRL)', 'Vendas Sem os Descontos da Shopee', 'Pedidos', 'Vendas por Pedido',
        'Cliques Por Produto', 'Visitantes', 'Taxa de Conversão de Pedidos', 'Pedidos Cancelados', 'Vendas Canceladas',
        'Pedidos Devolvidos / Reembolsados', 'Vendas Devolvidas / Reembolsadas', '# de compradores',
        '# de novos compradores', '# de compradores existentes', '# de compradores em potencial', 'Repetir Índice de Compras'];
      const dias = [];
      for (let dd = 4; dd <= 30; dd++) dias.push(('0' + dd).slice(-2) + '/06/2026');
      for (let dd = 1; dd <= 3; dd++) dias.push(('0' + dd).slice(-2) + '/07/2026');
      const fmt = n => n.toFixed(2).replace('.', '#').replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace('#', ',');
      const mil = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const diariasBase = (totVendas, totPedidos, totVisit) => dias.map((d, i) => {
        const f = i === 0 ? 1.18 : i === dias.length - 1 ? 0.82 : 1; /* leve variação, sem aleatoriedade */
        const vend = totVendas / dias.length * f, ped = Math.round(totPedidos / dias.length * f), vis = Math.round(totVisit / dias.length * f);
        const row = { 'Data': d, 'Vendas (BRL)': fmt(vend), 'Vendas Sem os Descontos da Shopee': fmt(vend * 1.07),
          'Pedidos': mil(ped), 'Vendas por Pedido': fmt(ped ? vend / ped : 0), 'Cliques Por Produto': mil(Math.round(vis * 0.42)),
          'Visitantes': mil(vis), 'Taxa de Conversão de Pedidos': (vis ? (ped / vis * 100) : 0).toFixed(2).replace('.', ',') + '%',
          'Pedidos Cancelados': mil(Math.round(ped * 0.04)), 'Vendas Canceladas': fmt(vend * 0.04),
          'Pedidos Devolvidos / Reembolsados': mil(Math.round(ped * 0.02)), 'Vendas Devolvidas / Reembolsadas': fmt(vend * 0.02),
          '# de compradores': mil(Math.round(ped * 0.93)), '# de novos compradores': mil(Math.round(ped * 0.61)),
          '# de compradores existentes': mil(Math.round(ped * 0.32)), '# de compradores em potencial': mil(Math.round(vis * 0.2)),
          'Repetir Índice de Compras': '0,34%' };
        return row;
      });
      const consolidada = (v, p, vis, conv) => ({ 'Data': '04/06/2026-03/07/2026', 'Vendas (BRL)': v,
        'Vendas Sem os Descontos da Shopee': fmt(parseFloat(v.replace(/\./g, '').replace(',', '.')) * 1.07), 'Pedidos': p,
        'Vendas por Pedido': fmt(parseFloat(v.replace(/\./g, '').replace(',', '.')) / parseFloat(p.replace(/\./g, ''))),
        'Cliques Por Produto': '48.319', 'Visitantes': vis, 'Taxa de Conversão de Pedidos': conv,
        'Pedidos Cancelados': '54', 'Vendas Canceladas': '13.415,70', 'Pedidos Devolvidos / Reembolsados': '28',
        'Vendas Devolvidas / Reembolsadas': '6.707,85', '# de compradores': '1.279', '# de novos compradores': '842',
        '# de compradores existentes': '437', '# de compradores em potencial': '23.008', 'Repetir Índice de Compras': '0,34%' });
      const FONTECOLS = ['Fonte de Tráfego', 'Vendas', 'Impressões', 'Cliques', 'Pedidos', 'Unidades', 'CTR', 'Conversão',
        'Vendas por Pedido', 'Compradores', 'Impressões únicas', 'Cliques únicos'];
      const fontes = base => ([
        ['Card do Produto', '148.320,44', '412.900', '38.410', '612', '648', '9,30%', '1,59%', '242,35', '571', '210.400', '31.200'],
        ['Recomendação', '72.140,10', '298.500', '18.220', '284', '301', '6,10%', '1,56%', '253,99', '268', '160.900', '15.400'],
        ['Pesquisar', '58.902,73', '141.700', '12.940', '241', '255', '9,13%', '1,86%', '244,41', '229', '96.300', '11.020'],
        ['Afiliado', '31.204,88', '52.300', '4.910', '128', '134', '9,39%', '2,61%', '243,79', '121', '38.900', '4.310'],
        ['Anúncios', '18.740,52', '88.400', '6.220', '74', '79', '7,04%', '1,19%', '253,25', '70', '61.200', '5.480'],
        ['Lives', '4.980,00', '9.100', '820', '21', '22', '9,01%', '2,56%', '237,14', '20', '7.400', '740'],
        ['Vídeos', '1.103,84', '3.400', '260', '5', '5', '7,65%', '1,92%', '220,77', '5', '2.900', '230'],
      ].map(a => { const o = {}; FONTECOLS.forEach((h, i) => o[h] = a[i]); return o; }));
      const PRODCOLS = ['ID do Item', 'Produto', 'Status Atual do Item', 'Taxa de Vendas', 'Vendas', 'Impressões',
        'Cliques', 'Pedidos', 'Unidades', 'CTR', 'Taxa de Conversão', 'Vendas por Pedido', 'Compradores', 'Impressões únicas', 'Cliques únicos'];
      const produtos = () => ([
        ['9001', 'Quadro Paisagem 60x90 Premium', 'Normal', '0,71%', '92.410,50', '184.200', '18.410', '388', '402', '9,99%', '2,11%', '238,17', '361', '120.400', '15.200'],
        ['9002', 'Kit 3 Quadros Sala Moderna', 'Normal', '0,44%', '74.120,00', '141.900', '12.220', '241', '248', '8,61%', '1,97%', '307,55', '229', '98.700', '10.100'],
        ['9003', 'Quadro Paisagem 60x90 c/ Maleta', 'Normal', '0,52%', '41.208,30', '96.400', '8.910', '198', '205', '9,24%', '2,22%', '208,12', '188', '70.100', '7.410'],
        ['9004', 'Porta Retrato Vidro Duplo 3D', 'Normal', '0,38%', '28.905,11', '71.200', '5.640', '164', '181', '7,92%', '2,91%', '176,25', '150', '52.300', '4.900'],
        ['9005', 'Espelho Adnet Orgânico', 'Ativo', '0,29%', '19.740,60', '44.900', '3.220', '96', '99', '7,17%', '2,98%', '205,63', '92', '33.100', '2.870'],
      ].map(a => { const o = {}; PRODCOLS.forEach((h, i) => o[h] = a[i]); return o; }));
      return {
        nome: 'metricas principais .xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
        abas: [
          { nome: 'Pedido Feito', headers: METCOLS, rows: [consolidada('335.392,51', '1.375', '115.043', '0,63%')].concat(diariasBase(335392.51, 1375, 115043)) },
          { nome: 'Produto Pago', headers: METCOLS, rows: [consolidada('292.591,59', '1.211', '115.043', '0,56%')].concat(diariasBase(292591.59, 1211, 115043)) },
          { nome: '(Pedidos Enviados) Fontes de Tráfego', headers: FONTECOLS, rows: fontes('feito') },
          { nome: '(pedido realizado) Contribuição diária', headers: PRODCOLS, rows: produtos() },
          { nome: 'Product Contribution', headers: PRODCOLS, rows: produtos() },
          { nome: '(Pedidos Pagos) Fontes de Tráfego', headers: FONTECOLS, rows: fontes('pago') },
          { nome: '(pedido pago) Contribuição diária', headers: PRODCOLS, rows: produtos() },
          { nome: 'Product Contribution (paid)', headers: PRODCOLS, rows: produtos() },
        ],
      };
    },
  };

  return { PROFILES, GRANULARIDADES, FONTES, JOB_ESTADOS, VINCULO, MASTER_ESTADOS, IMPORT_PERMS,
    detect, fingerprintFile, hash, createEngine, stage, apply, rollback, receitaConsolidada,
    suggestMaster, approveMaster, coverage, canImp, naturalKey, KEYS, FIXTURES, assertNoDemoMix,
    /* 10.E.3.1 — classificador corrigido */
    reclassify, NOME_PERFIL, DETECT_RULES, SINONIMOS,
    /* 10.E.2.2 — data foundation + intelligence activation */
    FIELD_MAP, TIPOS_CAMPO, ENTIDADES_CAMPO, inferType, fieldCatalog, mapField, excluirCampoDaAnalise,
    restaurarCampo, reprocess, relacoesReport, decidirRelacao, coberturaReal, applyImportChain,
    lastImpact, sinaisSilencio, fatosConhecimento,
    /* 10.E.2.3 — importação multiabas real */
    stageMulti, metricasView, trafficSourcesView, productContribView, adsView, afiliadosView, brNum, isoBr, rangeBr, NOME_BASE,
    /* 10.E.2.5.1 — contrato total de campos: performance por anúncio/variação + devoluções completas */
    performanceItemView, devolucoesView, FIELD_MAP, PERF_ITEM_COLS, DEVOL_COLS, ESTOQUE_COLS,
    /* 10.E.2 */
    DATA_PERMS, DATA_PERMS_ALL, canData, orderTab, cepProtegido, ordersView, orderStats, geoStats, stockView,
    conversaoExplicita, valorEfetivo, correct, excludeFromAnalysis, restaurar, archiveFile, desativarVinculo,
    removerMaster, historicoDe, sourcesTable, areaSources, mesaInsights, NIVEIS, AGENT_STATUS };
}));

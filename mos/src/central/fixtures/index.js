/* FIXTURES da Central (Sprint 09) — dados realistas no formato REAL de
   cada API, encenando o cenário único do sprint:

     Um quadro (SKU KIT3-ABS) vende forte na Shopee.
     O estoque está crítico.
     A margem do mesmo produto é melhor no Mercado Livre.
     Ele ainda não está anunciado no Magalu.
     Um vídeo semelhante começou a crescer no TikTok Shop.
     A fábrica possui capacidade limitada para personalizados.

   O FixtureTransport implementa a MESMA interface do transporte HTTP
   futuro (kind identifica: NUNCA chamar conta real por acidente).
   O MockAuthTransport simula a troca OAuth em dev/teste. */
'use strict';

/* ---------------- MERCADO LIVRE (formato da API oficial) ---------------- */
const MERCADO_LIVRE = {
  listings: [
    { id: 'MLB-7712', title: 'Kit 3 Quadros Sala Abstrato 60x90', price: 149.90,
      status: 'active', available_quantity: 22, sold_quantity: 12,
      category_id: 'MLB1367', permalink: 'https://produto.mercadolivre.com.br/MLB-7712',
      last_updated: '2026-07-02T14:10:00.000Z', date_created: '2026-03-01T10:00:00.000Z' },
    { id: 'MLB-5501', title: 'Quadro Paisagem Serra 60x90 Moldura', price: 189.00,
      status: 'active', available_quantity: 15, sold_quantity: 7,
      category_id: 'MLB1367', permalink: 'https://produto.mercadolivre.com.br/MLB-5501',
      last_updated: '2026-07-02T14:10:00.000Z', date_created: '2026-02-11T10:00:00.000Z' },
  ],
  orders: [
    { id: 9001, status: 'paid', total_amount: 149.90, currency_id: 'BRL',
      buyer: { id: 3311 }, tags: [],
      shipping: { handling_limit: '2026-07-05T18:00:00.000Z' },
      order_items: [{ item: { id: 'MLB-7712', seller_sku: 'KIT3-ABS', title: 'Kit 3 Quadros Sala Abstrato 60x90' },
                      quantity: 1, unit_price: 149.90 }],
      date_created: '2026-07-02T09:12:00.000Z' },
  ],
  inventory: [
    { item_id: 'MLB-7712', seller_sku: 'KIT3-ABS', available_quantity: 22, reserved_quantity: 1,
      last_updated: '2026-07-02T14:10:00.000Z' },
    { item_id: 'MLB-5501', seller_sku: 'QDR-SER', available_quantity: 15, reserved_quantity: 0,
      last_updated: '2026-07-02T14:10:00.000Z' },
  ],
  prices: [
    { item_id: 'MLB-7712', price: 149.90, original_price: 169.90, currency_id: 'BRL',
      margin_pct: 31, last_updated: '2026-07-02T14:10:00.000Z' },
    { item_id: 'MLB-5501', price: 189.00, original_price: null, currency_id: 'BRL',
      margin_pct: 27, last_updated: '2026-07-02T14:10:00.000Z' },
  ],
  metrics: [
    { item_id: 'MLB-7712', metric: 'visits_7d', value: 480, period: '7d', date: '2026-07-02T00:00:00.000Z' },
    { item_id: 'MLB-7712', metric: 'conversion_7d', value: 0.025, period: '7d', date: '2026-07-02T00:00:00.000Z' },
  ],
};

/* ---------------- SHOPEE (formato da Open Platform; epoch em segundos) ---------------- */
const T0 = 1782000000; // base p/ epochs das fixtures (jun/2026)
const SHOPEE = {
  listings: [
    { item_id: 8891, item_name: 'Kit 3 Quadros Sala Abstrato 60x90', item_status: 'NORMAL',
      price_info: { current_price: 129.90, original_price: 159.90 },
      stock_info: { current_stock: 4 }, sale: 46, category_id: 100636, update_time: T0 + 86400 },
    { item_id: 8412, item_name: 'Espelho Decorativo Orgânico 70cm', item_status: 'NORMAL',
      price_info: { current_price: 219.00, original_price: 219.00 },
      stock_info: { current_stock: 18 }, sale: 9, category_id: 100636, update_time: T0 + 86400 },
  ],
  orders: [
    { order_sn: 'SHP-260702A', order_status: 'READY_TO_SHIP', total_amount: 129.90, currency: 'BRL',
      buyer_user_id: 71001, note: '', ship_by_date: T0 + 2 * 86400,
      item_list: [{ item_id: 8891, item_sku: 'KIT3-ABS', item_name: 'Kit 3 Quadros Sala Abstrato 60x90',
                    model_quantity_purchased: 1, model_discounted_price: 129.90 }],
      create_time: T0 + 3600 },
    { order_sn: 'SHP-260702B', order_status: 'READY_TO_SHIP', total_amount: 259.80, currency: 'BRL',
      buyer_user_id: 71002, note: 'Personalizado: nome da família na terceira tela',
      ship_by_date: T0 + 86400,                       // prazo apertado (coleta amanhã)
      item_list: [{ item_id: 8891, item_sku: 'KIT3-ABS', item_name: 'Kit 3 Quadros Sala Abstrato 60x90',
                    model_quantity_purchased: 2, model_discounted_price: 129.90 }],
      create_time: T0 + 7200 },
    { order_sn: 'SHP-260702C', order_status: 'READY_TO_SHIP', total_amount: 129.90, currency: 'BRL',
      buyer_user_id: 71003, note: 'Personalizado: frase no verso',
      ship_by_date: T0 + 86400,
      item_list: [{ item_id: 8891, item_sku: 'KIT3-ABS', item_name: 'Kit 3 Quadros Sala Abstrato 60x90',
                    model_quantity_purchased: 1, model_discounted_price: 129.90 }],
      create_time: T0 + 9800 },
  ],
  inventory: [
    { item_id: 8891, item_sku: 'KIT3-ABS', stock_info: { current_stock: 4 }, reserved_stock: 3,
      update_time: T0 + 86400 },
    { item_id: 8412, item_sku: 'ESP-ORG', stock_info: { current_stock: 18 }, reserved_stock: 0,
      update_time: T0 + 86400 },
  ],
  prices: [
    { item_id: 8891, price_info: { current_price: 129.90, original_price: 159.90 },
      margin_pct: 18, update_time: T0 + 86400 },
    { item_id: 8412, price_info: { current_price: 219.00, original_price: 219.00 },
      margin_pct: 24, update_time: T0 + 86400 },
  ],
  metrics: [
    { item_id: 8891, metric: 'sold_7d', value: 46, period: '7d', time: T0 + 86400 },
    { item_id: 8891, metric: 'conversion_7d', value: 0.041, period: '7d', time: T0 + 86400 },
  ],
};

/* ---------------- TIKTOK SHOP (conector estruturado; fixtures) ---------------- */
const TIKTOK = {
  listings: [
    { product_id: 'TTS-3301', product_name: 'Quadro Decorativo Minimalista 50x70',
      product_status: 'LIVE', price: { sale_price: 99.90 }, stock_num: 30, sold_count: 5,
      category_id: 'home-decor', update_time: '2026-07-01T12:00:00.000Z' },
  ],
  orders: [
    { order_id: 'TTK-8801', order_status: 'AWAITING_SHIPMENT',
      payment: { total_amount: 99.90, currency: 'BRL' }, buyer_uid: 5522,
      rts_sla_time: '2026-07-04T18:00:00.000Z',
      order_line_list: [{ product_id: 'TTS-3301', seller_sku: 'QDR-MIN', product_name: 'Quadro Decorativo Minimalista 50x70',
                          quantity: 1, sale_price: 99.90 }],
      create_time: '2026-07-02T08:30:00.000Z' },
  ],
  inventory: [
    { product_id: 'TTS-3301', seller_sku: 'QDR-MIN', available_stock: 30, committed_stock: 1,
      update_time: '2026-07-01T12:00:00.000Z' },
  ],
  prices: [
    { product_id: 'TTS-3301', sale_price: 99.90, original_price: 119.90, currency: 'BRL',
      margin_pct: 22, update_time: '2026-07-01T12:00:00.000Z' },
  ],
  /* o sinal do canal: vídeo de "quadros abstratos para sala" viralizando,
     visualização alta e conversão baixa — potencial não capturado */
  metrics: [
    { product_id: null, metric: 'video_views_7d', value: 18400, period: '7d', date: '2026-07-02T00:00:00.000Z' },
    { product_id: null, metric: 'video_view_growth_7d', value: 3.4, period: '7d', date: '2026-07-02T00:00:00.000Z' },
    { product_id: 'TTS-3301', metric: 'conversion_7d', value: 0.006, period: '7d', date: '2026-07-02T00:00:00.000Z' },
  ],
};

/* ---------------- MAGALU (conector estruturado; fixtures) ----------------
   Nota do cenário: o KIT3-ABS NÃO está anunciado aqui — o catálogo só tem
   outro produto. É a ausência que vira sinal de expansão de canal. */
const MAGALU = {
  listings: [
    { sku_id: 'MGL-2201', title: 'Quadro Paisagem Serra 60x90 Moldura', status: 'ACTIVE',
      sale_price: 199.00, list_price: 219.00, stock_quantity: 10, sold_quantity: 3,
      category: 'decoracao', updated_at: '2026-07-01T09:00:00.000Z' },
  ],
  orders: [],
  inventory: [
    { sku_id: 'MGL-2201', seller_sku: 'QDR-SER', stock_quantity: 10, reserved_quantity: 0,
      updated_at: '2026-07-01T09:00:00.000Z' },
  ],
  prices: [
    { sku_id: 'MGL-2201', sale_price: 199.00, list_price: 219.00, margin_pct: 29,
      updated_at: '2026-07-01T09:00:00.000Z' },
  ],
};

const FIXTURES = { mercado_livre: MERCADO_LIVRE, shopee: SHOPEE, tiktok: TIKTOK, magalu: MAGALU };

/* contexto operacional da fábrica (o mundo fora das APIs) */
const OPERATION = {
  sku: 'KIT3-ABS',
  customCapacityPerDay: 1,     // capacidade de produção de personalizados/dia
  factoryNote: 'produção própria; personalizados exigem arte + impressão + secagem',
};

/* ---------------- FixtureTransport — mesma interface do HTTP futuro ---------------- */
class FixtureTransport {
  constructor({ data = FIXTURES, failPlatforms = [], rateLimitOnce = [] } = {}) {
    this.kind = 'fixture';           // guarda técnica: mock NUNCA é conta real
    this.data = data;
    this.calls = [];
    this.failPlatforms = new Set(failPlatforms);       // simula praça fora do ar
    this._rateLimitOnce = new Set(rateLimitOnce);      // simula 429 na 1ª chamada
  }
  async fetch(platform, resource, ctx = {}) {
    this.calls.push({ platform, resource, at: ctx.observedAt || null });
    if (this.failPlatforms.has(platform))
      throw new Error(`${platform}: indisponível (simulação de falha)`);
    if (this._rateLimitOnce.has(platform)) {
      this._rateLimitOnce.delete(platform);
      const err = new Error(`${platform}: rate limit excedido (429)`);
      err.rateLimited = true;
      throw err;
    }
    return (this.data[platform] && this.data[platform][resource]) || [];
  }
  /* validação é um ping leve — falha de FETCH (praça fora do ar) é outra
     coisa: a conexão existe, o recurso é que não respondeu */
  async validate(platform) {
    return { ok: true, accountId: `acc-${platform}-1`, storeId: `store-${platform}-1` };
  }
}

/* ---------------- MockAuthTransport — troca OAuth simulada (dev/teste) ---------------- */
class MockAuthTransport {
  constructor() {
    this.kind = 'mock-auth';
    this.exchanges = 0;
    this.refreshes = 0;
  }
  async exchangeCode(platform, code) {
    this.exchanges++;
    return {
      accessToken: `APP_USR-${platform}-access-${code}-a1b2c3d4e5f6`,
      refreshToken: `TG-${platform}-refresh-${code}-f6e5d4c3b2a1`,
      expiresIn: 21600, scope: 'read', tokenType: 'bearer',
      accountId: `acc-${platform}-1`, storeId: `store-${platform}-1`,
    };
  }
  async refresh(platform, _refreshToken) {
    this.refreshes++;
    return {
      accessToken: `APP_USR-${platform}-access-rotated-${this.refreshes}-9z8y7x6w`,
      refreshToken: `TG-${platform}-refresh-rotated-${this.refreshes}-w6x7y8z9`,
      expiresIn: 21600, tokenType: 'bearer',
    };
  }
}

module.exports = { FIXTURES, OPERATION, FixtureTransport, MockAuthTransport };

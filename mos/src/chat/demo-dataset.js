/* HEAD CHAT · DEMO OPERATIONAL DATASET (Sprint 09.A)

   Dados DEMONSTRATIVOS, realistas e coerentes entre si (vendas × pedidos ×
   estoque × Ads × funil × capacidade), gerados de forma DETERMINISTA em
   torno do Clock injetado — sem Math.random, sem Date do sistema.

   A forma é a MESMA que o adaptador da Central produz a partir dos dados
   normalizados (datasetFromCentral): o chat não sabe se está falando com
   fixture ou integração real — só o campo `source` muda. */
(function (NS) {
'use strict';

const DAY = 86400000;

const PRODUCTS = [
  { sku: 'KIT3-ABS', name: 'Kit 3 Quadros Sala Abstrato 60x90', price: 129.90, cost: 74.90 },
  { sku: 'QDR-SER', name: 'Quadro Paisagem Serra 60x90 Moldura', price: 189.00, cost: 121.00 },
  { sku: 'ESP-ORG', name: 'Espelho Decorativo Orgânico 70cm', price: 219.00, cost: 142.00 },
  { sku: 'QDR-MIN', name: 'Quadro Decorativo Minimalista 50x70', price: 99.90, cost: 61.00 },
];

/* âncoras do dia (parcial, "até agora") e de ontem (dia completo) */
const TODAY = {
  shopee: { revenue: 4780, orders: 34, byProduct: { 'KIT3-ABS': [2210, 17], 'ESP-ORG': [1533, 7], 'QDR-MIN': [1037, 10] } },
  mercado_livre: { revenue: 2940, orders: 21, byProduct: { 'QDR-SER': [1701, 9], 'KIT3-ABS': [1239, 12] } },
  magalu: { revenue: 700, orders: 7, byProduct: { 'QDR-SER': [700, 7] } },
};
const YESTERDAY = {
  shopee: { revenue: 5230, orders: 38, sameTime: 3950, ordersSameTime: 28, byProduct: { 'KIT3-ABS': [2470, 19], 'ESP-ORG': [1650, 8], 'QDR-MIN': [1110, 11] } },
  mercado_livre: { revenue: 3480, orders: 25, sameTime: 2660, ordersSameTime: 19, byProduct: { 'QDR-SER': [2079, 11], 'KIT3-ABS': [1401, 14] } },
  magalu: { revenue: 890, orders: 8, sameTime: 520, ordersSameTime: 5, byProduct: { 'QDR-SER': [890, 8] } },
};

function createDemoDataset(clock) {
  const todayKey = clock.dayBounds(clock.now()).dateKey;
  const keyOf = n => clock.dayBounds(new Date(clock.nowMs() - n * DAY)).dateKey;

  /* série diária dos últimos 35 dias — determinista (função do índice) */
  const sales = {};
  sales[todayKey] = shape(TODAY, { partial: true });
  sales[keyOf(1)] = shape(YESTERDAY, { partial: false });
  for (let i = 2; i <= 35; i++) {
    const f = 0.82 + 0.06 * ((i * 7) % 5);        // variação previsível, sem random
    sales[keyOf(i)] = shape({
      shopee: { revenue: r(5230 * f), orders: Math.round(38 * f), byProduct: { 'KIT3-ABS': [r(2470 * f), Math.round(19 * f)], 'ESP-ORG': [r(1650 * f), Math.round(8 * f)] } },
      mercado_livre: { revenue: r(3480 * f), orders: Math.round(25 * f), byProduct: { 'QDR-SER': [r(2079 * f), Math.round(11 * f)], 'KIT3-ABS': [r(1401 * f), Math.round(14 * f)] } },
      magalu: { revenue: r(890 * f), orders: Math.round(8 * f), byProduct: { 'QDR-SER': [r(890 * f), Math.round(8 * f)] } },
    }, { partial: false });
  }

  return {
    source: 'DEMO_FIXTURE',
    isLive: false,
    timezone: clock.timezone,
    connectedPlatforms: ['shopee', 'mercado_livre', 'magalu'],
    missingPlatforms: ['tiktok'],                  // TikTok Shop: sem dados conectados
    products: PRODUCTS,
    sales,                                         // dateKey → platform → {revenue, orders, fees, ...}

    /* margem por (sku × plataforma) — base do financeiro */
    margins: {
      'KIT3-ABS': { shopee: 18, mercado_livre: 31 },
      'QDR-SER': { mercado_livre: 27, magalu: 29 },
      'ESP-ORG': { shopee: 24 },
      'QDR-MIN': { shopee: 21 },
    },

    /* operação de HOJE: produção → embalagem → expedição → coleta */
    fulfillment: {
      toShip: 38,
      stages: { production: 14, packaging: 11, ready: 9, awaiting_pickup: 4 },
      shippedToday: 41,
      lateOrders: [
        { id: 'SHP-260703F', platform: 'shopee', hoursLate: 14, isCustom: false },
        { id: 'MLB-260702K', platform: 'mercado_livre', hoursLate: 3, isCustom: true },
      ],
      criticalToday: Array.from({ length: 7 }, (_, i) => ({
        id: `SHP-2607${40 + i}P`, platform: 'shopee', isCustom: true, dueToday: true })),
      cancelledToday: 3,
      returnedToday: 1,
      capacity: { perDay: 45, remainingToday: 31, customPerDay: 5, customPendingToday: 7 },
    },

    inventory: [
      { sku: 'KIT3-ABS', name: PRODUCTS[0].name, platform: 'shopee', available: 4, reserved: 3, inProduction: 6, dailySales: 6.6 },
      { sku: 'KIT3-ABS', name: PRODUCTS[0].name, platform: 'mercado_livre', available: 22, reserved: 1, inProduction: 0, dailySales: 1.7 },
      { sku: 'QDR-SER', name: PRODUCTS[1].name, platform: 'mercado_livre', available: 15, reserved: 0, inProduction: 2, dailySales: 1.6 },
      { sku: 'QDR-SER', name: PRODUCTS[1].name, platform: 'magalu', available: 10, reserved: 0, inProduction: 0, dailySales: 1.0 },
      { sku: 'ESP-ORG', name: PRODUCTS[2].name, platform: 'shopee', available: 18, reserved: 0, inProduction: 0, dailySales: 1.3 },
      { sku: 'QDR-MIN', name: PRODUCTS[3].name, platform: 'shopee', available: 26, reserved: 2, inProduction: 0, dailySales: 1.4 },
    ],

    /* Ads de hoje — investimento 340, retorno 1.870 (ROAS 5,5x) */
    ads: {
      campaigns: [
        { id: 'ads-1', name: 'Kit 3 Quadros Abstrato — Shopee Ads', platform: 'shopee',
          spend: 214, impressions: 12400, clicks: 168, attributedOrders: 14,
          attributedRevenue: 1870, budget: 300, budgetUsedPct: 71 },
        { id: 'ads-2', name: 'Quadro Paisagem 50x70 — Mercado Livre Ads', platform: 'mercado_livre',
          spend: 126, impressions: 7400, clicks: 89, attributedOrders: 0,
          attributedRevenue: 0, budget: 150, budgetUsedPct: 84 },
      ],
      spendYesterday: 305,
    },

    /* funil de hoje × ontem (denominadores explícitos) */
    funnel: [
      { platform: 'shopee', impressions: 41200, clicks: 494, visits: 1620,
        checkouts: 92, ordersCreated: 51, ordersApproved: 45,
        prev: { ctrPct: 1.9, convVisitPct: 3.1 } },
      { platform: 'mercado_livre', impressions: 18300, clicks: 512, visits: 890,
        checkouts: 54, ordersCreated: 36, ordersApproved: 32,
        prev: { ctrPct: 2.7, convVisitPct: 3.4 } },
    ],
  };
}

function shape(byPlatform, { partial }) {
  const out = {};
  for (const [platform, d] of Object.entries(byPlatform)) {
    out[platform] = {
      revenue: d.revenue, orders: d.orders,
      revenueSameTime: d.sameTime ?? (partial ? d.revenue : null),
      ordersSameTime: d.ordersSameTime ?? (partial ? d.orders : null),
      fees: r(d.revenue * 0.14),                    // taxas conhecidas da praça
      discounts: r(d.revenue * 0.03),
      returnsValue: platform === 'shopee' ? 129.9 : 0,
      byProduct: d.byProduct || {},
    };
  }
  return out;
}
const r = v => Math.round(v * 100) / 100;

/* ---------------- adaptador da CENTRAL: mesmo contrato ----------------
   Quando as integrações reais estiverem ativas, o chat consome os dados
   normalizados por AQUI — nada no chat muda, só a fonte. */
function datasetFromCentral(repos, companyId, clock) {
  const orders = repos.morder.ofCompany(companyId);
  if (!orders.length) return null;                  // sem sync ainda → sem dataset
  const sales = {};
  const platforms = new Set();
  for (const o of orders) {
    if (/cancel/i.test(o.status || '')) continue;
    const key = clock.dateKey(o.occurred_at);
    platforms.add(o.platform);
    sales[key] = sales[key] || {};
    const p = sales[key][o.platform] = sales[key][o.platform]
      || { revenue: 0, orders: 0, revenueSameTime: null, fees: 0, discounts: 0, returnsValue: 0, byProduct: {} };
    p.revenue = r(p.revenue + (o.total || 0));
    p.orders += 1;
  }
  const inventory = repos.minventory.db.all(
    `SELECT * FROM marketplace_inventory WHERE company_id = ? AND id IN (
       SELECT MAX(id) FROM marketplace_inventory WHERE company_id = ? GROUP BY connection_id, external_listing_id)`,
    companyId, companyId)
    .map(i => ({ sku: i.sku, name: i.sku, platform: i.platform,
                 available: i.available, reserved: i.reserved, inProduction: 0, dailySales: null }));
  return {
    source: 'NORMALIZED_INTERNAL_DATA',
    isLive: true,
    timezone: clock.timezone,
    connectedPlatforms: [...platforms],
    missingPlatforms: [],
    products: [], sales, margins: {},
    fulfillment: null,                               // honesto: ainda sem esse recurso
    inventory,
    ads: null,
    funnel: null,
  };
}

NS.createDemoDataset = createDemoDataset;
NS.datasetFromCentral = datasetFromCentral;
NS.PRODUCTS = PRODUCTS;
})(typeof module !== 'undefined' && module.exports ? require('./_ns.js') : (globalThis.HEADCHAT = globalThis.HEADCHAT || {}));

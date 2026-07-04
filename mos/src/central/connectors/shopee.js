/* Conector Oficial Autenticado — SHOPEE (Sprint 09).
   INTEGRATION_READY: Shopee Open Platform (open.shopee.com), autorização
   de loja via partner + shop authorization, com refresh de access token.

   Os mappers traduzem o formato REAL da Open Platform (get_item_list/
   get_item_base_info, get_order_list/get_order_detail) para o canônico.
   Considera a operação real de personalizados: prazo, coleta e capacidade
   de produção entram pelos pedidos (deadline, is_custom). */
'use strict';
const { MarketplaceConnector } = require('../connector-contract.js');
const { DECLARATIONS } = require('../declarations.js');

const epochToIso = s => (s == null ? null : new Date(s * 1000).toISOString());

/* formato da Open Platform da Shopee → canônico */
const mappers = {
  listing: r => ({
    externalId: String(r.item_id),
    title: r.item_name,
    price: r.price_info ? r.price_info.current_price : null,
    status: r.item_status === 'NORMAL' ? 'active' : String(r.item_status || '').toLowerCase(),
    stock: r.stock_info ? r.stock_info.current_stock : null,
    sold: r.sale ?? null,
    categoryId: r.category_id ?? null,
    permalink: null,
    occurredAt: epochToIso(r.update_time),
  }),
  order: r => ({
    externalId: r.order_sn,
    status: String(r.order_status || '').toLowerCase(),  // unpaid|ready_to_ship|shipped...
    total: r.total_amount,
    currency: r.currency || 'BRL',
    buyerRef: r.buyer_user_id ? `shp-buyer-${r.buyer_user_id}` : null,
    isCustom: !!(r.note && /personaliza/i.test(r.note)),
    deadlineAt: epochToIso(r.ship_by_date),              // prazo de expedição/coleta
    items: (r.item_list || []).map(i => ({
      externalListingId: String(i.item_id), sku: i.item_sku || null,
      title: i.item_name, quantity: i.model_quantity_purchased ?? 1,
      unitPrice: i.model_discounted_price ?? i.model_original_price,
    })),
    occurredAt: epochToIso(r.create_time),
  }),
  inventory: r => ({
    externalListingId: String(r.item_id), sku: r.item_sku || null,
    available: r.stock_info ? r.stock_info.current_stock : r.current_stock,
    reserved: r.reserved_stock ?? 0,
    occurredAt: epochToIso(r.update_time),
  }),
  price: r => ({
    externalListingId: String(r.item_id),
    price: r.price_info ? r.price_info.current_price : r.current_price,
    originalPrice: r.price_info ? r.price_info.original_price : null,
    currency: 'BRL',
    marginPct: r.margin_pct ?? null,
    occurredAt: epochToIso(r.update_time),
  }),
  metric: r => ({
    externalListingId: r.item_id != null ? String(r.item_id) : null,
    metric: r.metric, value: r.value, period: r.period || null,
    occurredAt: epochToIso(r.time) || r.date || null,
  }),
};

function createShopeeConnector({ transport, clock }) {
  return new MarketplaceConnector(DECLARATIONS.shopee, { transport, clock, mappers });
}

module.exports = { createShopeeConnector, mappers };

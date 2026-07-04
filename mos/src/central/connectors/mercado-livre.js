/* Conector Oficial Autenticado — MERCADO LIVRE (Sprint 09).
   INTEGRATION_READY: API oficial pública e documentada (developers.
   mercadolivre.com.br). OAuth 2.0 com authorization code + refresh token.

   Os mappers traduzem o formato REAL da API do ML (items/orders do
   /users/{id}/items e /orders/search) para os campos canônicos da Central.
   O transporte é injetado: fixtures agora, HTTP oficial quando as
   credenciais da loja forem conectadas. */
'use strict';
const { MarketplaceConnector } = require('../connector-contract.js');
const { DECLARATIONS } = require('../declarations.js');

/* formato da API oficial do ML → canônico */
const mappers = {
  listing: r => ({
    externalId: r.id,                                  // ex.: MLB123...
    title: r.title,
    price: r.price,
    status: r.status,                                  // active | paused | closed
    stock: r.available_quantity,
    sold: r.sold_quantity,
    categoryId: r.category_id,
    permalink: r.permalink || null,
    occurredAt: r.last_updated || r.date_created,
  }),
  order: r => ({
    externalId: String(r.id),
    status: r.status,                                  // paid | shipped | delivered...
    total: r.total_amount,
    currency: r.currency_id || 'BRL',
    buyerRef: r.buyer ? `ml-buyer-${r.buyer.id}` : null,
    isCustom: !!(r.tags || []).includes('custom'),
    deadlineAt: r.shipping ? r.shipping.handling_limit : null,
    items: (r.order_items || []).map(i => ({
      externalListingId: i.item.id, sku: i.item.seller_sku || null,
      title: i.item.title, quantity: i.quantity, unitPrice: i.unit_price,
    })),
    occurredAt: r.date_created,
  }),
  inventory: r => ({
    externalListingId: r.item_id, sku: r.seller_sku || null,
    available: r.available_quantity, reserved: r.reserved_quantity ?? 0,
    occurredAt: r.last_updated,
  }),
  price: r => ({
    externalListingId: r.item_id, price: r.price,
    originalPrice: r.original_price ?? null, currency: r.currency_id || 'BRL',
    marginPct: r.margin_pct ?? null,                   // enriquecido com custo interno
    occurredAt: r.last_updated,
  }),
  metric: r => ({
    externalListingId: r.item_id || null, metric: r.metric,
    value: r.value, period: r.period || null, occurredAt: r.date,
  }),
};

function createMercadoLivreConnector({ transport, clock }) {
  return new MarketplaceConnector(DECLARATIONS.mercado_livre, { transport, clock, mappers });
}

module.exports = { createMercadoLivreConnector, mappers };

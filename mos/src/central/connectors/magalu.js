/* Conector Estruturado — MAGALU MARKETPLACE (Sprint 09).
   WAITING_CREDENTIALS: exige credenciamento no portal de desenvolvedores
   do Magalu antes de qualquer chamada real. Este conector entra com
   contrato, capabilities declaradas, normalizadores e fixtures —
   NENHUM endpoint real é chamado e nenhuma capability é inventada
   (webhooks e métricas ficam de fora até confirmação oficial).

   Papel estratégico: expansão de canal — comparar catálogo validado na
   Shopee/ML com o que (não) está anunciado aqui. */
'use strict';
const { MarketplaceConnector } = require('../connector-contract.js');
const { DECLARATIONS } = require('../declarations.js');

const mappers = {
  listing: r => ({
    externalId: String(r.sku_id ?? r.id),
    title: r.title,
    price: r.price ? r.price.sale_price ?? r.price : r.sale_price,
    status: String(r.status || '').toLowerCase(),
    stock: r.stock_quantity ?? null,
    sold: r.sold_quantity ?? null,
    categoryId: r.category ?? null,
    permalink: null,
    occurredAt: r.updated_at || null,
  }),
  order: r => ({
    externalId: String(r.order_id ?? r.id),
    status: String(r.status || '').toLowerCase(),
    total: r.total_amount,
    currency: 'BRL',
    buyerRef: r.customer_ref ? `mgl-buyer-${r.customer_ref}` : null,
    isCustom: false,
    deadlineAt: r.handling_limit || null,
    items: (r.items || []).map(i => ({
      externalListingId: String(i.sku_id), sku: i.seller_sku || null,
      title: i.title, quantity: i.quantity ?? 1, unitPrice: i.unit_price,
    })),
    occurredAt: r.created_at || null,
  }),
  inventory: r => ({
    externalListingId: String(r.sku_id), sku: r.seller_sku || null,
    available: r.stock_quantity, reserved: r.reserved_quantity ?? 0,
    occurredAt: r.updated_at || null,
  }),
  price: r => ({
    externalListingId: String(r.sku_id),
    price: r.sale_price, originalPrice: r.list_price ?? null,
    currency: 'BRL', marginPct: r.margin_pct ?? null,
    occurredAt: r.updated_at || null,
  }),
};

function createMagaluConnector({ transport, clock }) {
  return new MarketplaceConnector(DECLARATIONS.magalu, { transport, clock, mappers });
}

module.exports = { createMagaluConnector, mappers };

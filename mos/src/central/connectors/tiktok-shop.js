/* Conector Estruturado — TIKTOK SHOP (Sprint 09).
   WAITING_PARTNER_APPROVAL: a API oficial (partner.tiktokshop.com) exige
   aprovação de parceiro antes de qualquer OAuth real. Este conector entra
   com contrato, capabilities declaradas, normalizadores e fixtures —
   NENHUM endpoint real é chamado e nenhuma capability é inventada.

   Foco declarado: produtos, pedidos, estoque, métricas de vídeo/criativo
   e origem de venda por conteúdo (a alma do canal). */
'use strict';
const { MarketplaceConnector } = require('../connector-contract.js');
const { DECLARATIONS } = require('../declarations.js');

const mappers = {
  listing: r => ({
    externalId: String(r.product_id),
    title: r.product_name,
    price: r.price ? r.price.sale_price : null,
    status: String(r.product_status || '').toLowerCase(),
    stock: r.stock_num ?? null,
    sold: r.sold_count ?? null,
    categoryId: r.category_id ?? null,
    permalink: null,
    occurredAt: r.update_time || null,
  }),
  order: r => ({
    externalId: String(r.order_id),
    status: String(r.order_status || '').toLowerCase(),
    total: r.payment ? r.payment.total_amount : null,
    currency: r.payment ? r.payment.currency : 'BRL',
    buyerRef: r.buyer_uid ? `ttk-buyer-${r.buyer_uid}` : null,
    isCustom: false,
    deadlineAt: r.rts_sla_time || null,
    items: (r.order_line_list || []).map(i => ({
      externalListingId: String(i.product_id), sku: i.seller_sku || null,
      title: i.product_name, quantity: i.quantity ?? 1, unitPrice: i.sale_price,
    })),
    occurredAt: r.create_time || null,
  }),
  inventory: r => ({
    externalListingId: String(r.product_id), sku: r.seller_sku || null,
    available: r.available_stock, reserved: r.committed_stock ?? 0,
    occurredAt: r.update_time || null,
  }),
  price: r => ({
    externalListingId: String(r.product_id),
    price: r.sale_price, originalPrice: r.original_price ?? null,
    currency: r.currency || 'BRL', marginPct: r.margin_pct ?? null,
    occurredAt: r.update_time || null,
  }),
  /* métricas de conteúdo: views, conversão por vídeo, origem da venda */
  metric: r => ({
    externalListingId: r.product_id != null ? String(r.product_id) : null,
    metric: r.metric, value: r.value, period: r.period || null,
    occurredAt: r.date || null,
  }),
};

function createTikTokShopConnector({ transport, clock }) {
  return new MarketplaceConnector(DECLARATIONS.tiktok, { transport, clock, mappers });
}

module.exports = { createTikTokShopConnector, mappers };

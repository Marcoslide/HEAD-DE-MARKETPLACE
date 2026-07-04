/* NORMALIZADORES da Central (Sprint 09) — payload bruto de QUALQUER praça
   → a MESMA entidade canônica. Shopee, Mercado Livre, TikTok Shop e Magalu
   entram diferentes e saem idênticos em forma.

   Toda entidade canônica carrega o envelope de proveniência:
   companyId/platform/accountId/storeId + externalId + occurredAt (quando
   aconteceu na praça) / observedAt (quando a integração percebeu) /
   synchronizedAt (quando o sistema gravou) + rawReference (auditoria).

   Tempo: SEMPRE via Clock injetado. */
'use strict';

const NORMALIZED_VERSION = 1;

/* envelope comum a todas as entidades canônicas */
function envelope(ctx, clock, { externalId, occurredAt = null, rawReference = null, confidence = 1 }) {
  const observedAt = clock.nowIso();
  return {
    companyId: ctx.companyId, platform: ctx.platform,
    accountId: ctx.accountId ?? null, storeId: ctx.storeId ?? null,
    externalId,
    occurredAt: occurredAt || observedAt,   // sem occurredAt da praça, vale a observação
    observedAt,
    synchronizedAt: observedAt,
    rawReference,
    normalizedVersion: NORMALIZED_VERSION,
    confidence,
    metadata: {},
  };
}

/* cada normalizador usa o mapper DA PRAÇA (vive no conector) e devolve
   a entidade canônica — mesma forma para as quatro plataformas */
function normalizeListing(mapper, raw, ctx, clock, rawReference = null) {
  const m = mapper.listing(raw);
  return {
    entityType: 'MARKETPLACE_LISTING',
    ...envelope(ctx, clock, { externalId: m.externalId, occurredAt: m.occurredAt, rawReference }),
    title: m.title, price: m.price, sourceStatus: m.status,
    stock: m.stock ?? null, sold: m.sold ?? null,
    categoryId: m.categoryId ?? null, sourceUrl: m.permalink ?? null,
  };
}

function normalizeOrder(mapper, raw, ctx, clock, rawReference = null) {
  const m = mapper.order(raw);
  return {
    entityType: 'MARKETPLACE_ORDER',
    ...envelope(ctx, clock, { externalId: m.externalId, occurredAt: m.occurredAt, rawReference }),
    sourceStatus: m.status, total: m.total, currency: m.currency || 'BRL',
    buyerRef: m.buyerRef ?? null, isCustom: !!m.isCustom,
    deadlineAt: m.deadlineAt ?? null,
    items: (m.items || []).map(i => ({
      externalListingId: i.externalListingId ?? null, sku: i.sku ?? null,
      title: i.title ?? null, quantity: i.quantity ?? 1, unitPrice: i.unitPrice ?? null,
    })),
  };
}

function normalizeInventory(mapper, raw, ctx, clock, rawReference = null) {
  const m = mapper.inventory(raw);
  return {
    entityType: 'MARKETPLACE_INVENTORY',
    ...envelope(ctx, clock, { externalId: m.externalListingId, occurredAt: m.occurredAt, rawReference }),
    sku: m.sku ?? null, available: m.available ?? null, reserved: m.reserved ?? 0,
  };
}

function normalizePrice(mapper, raw, ctx, clock, rawReference = null) {
  const m = mapper.price(raw);
  return {
    entityType: 'MARKETPLACE_PRICE',
    ...envelope(ctx, clock, { externalId: m.externalListingId, occurredAt: m.occurredAt, rawReference }),
    price: m.price ?? null, originalPrice: m.originalPrice ?? null,
    currency: m.currency || 'BRL', marginPct: m.marginPct ?? null,
  };
}

function normalizeMetric(mapper, raw, ctx, clock, rawReference = null) {
  const m = mapper.metric(raw);
  return {
    entityType: 'MARKETPLACE_METRIC',
    ...envelope(ctx, clock, {
      externalId: m.externalListingId || `${ctx.platform}:${m.metric}`,
      occurredAt: m.occurredAt, rawReference }),
    metric: m.metric, value: m.value ?? null, period: m.period ?? null,
  };
}

const NORMALIZERS = {
  listings: normalizeListing,
  orders: normalizeOrder,
  inventory: normalizeInventory,
  prices: normalizePrice,
  metrics: normalizeMetric,
};

module.exports = { NORMALIZERS, NORMALIZED_VERSION, envelope };

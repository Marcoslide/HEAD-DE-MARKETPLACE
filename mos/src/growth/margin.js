/* MARGEM POR PRAÇA (Sprint 10.B) — nenhuma promoção ou draft sem margem.

   Calcula por marketplace: custo do produto + embalagem + frete
   subsidiado + comissão + taxa fixa + Ads + imposto + desconto
   promocional + comissão de afiliado → margem final, preço mínimo e
   preço recomendado.

   Honestidade: os perfis INTERNAL_DEFAULT são ESTIMATIVAS internas para
   planejamento — nunca tarifa oficial. A fonte fica gravada em cada
   perfil. Sem custo conhecido → NÃO COMPUTÁVEL → revisão obrigatória. */
'use strict';

/* estimativas internas de planejamento (fonte: INTERNAL_DEFAULT, não oficial) */
const INTERNAL_DEFAULTS = {
  mercado_livre: { commission_pct: 16.5, fixed_fee: 6, shipping_subsidy: 0, tax_pct: 8 },
  shopee: { commission_pct: 20, fixed_fee: 4, shipping_subsidy: 0, tax_pct: 8 },
  tiktok: { commission_pct: 14, fixed_fee: 2, shipping_subsidy: 0, tax_pct: 8 },
  magalu: { commission_pct: 16, fixed_fee: 5, shipping_subsidy: 0, tax_pct: 8 },
};

function computeMargin({ price, cost, packaging = 0, shippingSubsidy = 0,
                         commissionPct = 0, fixedFee = 0, adsPct = 0, taxPct = 0,
                         promoDiscountPct = 0, affiliatePct = 0, minMarginPct = null }) {
  if (price == null || cost == null)
    return { computable: false,
             reason: price == null ? 'preço ausente' : 'custo do produto ausente — sem custo não há margem' };
  const finalPrice = Math.round(price * (1 - promoDiscountPct / 100) * 100) / 100;
  const fees = {
    commission: r2(finalPrice * commissionPct / 100),
    fixedFee: r2(fixedFee),
    ads: r2(finalPrice * adsPct / 100),
    tax: r2(finalPrice * taxPct / 100),
    affiliate: r2(finalPrice * affiliatePct / 100),
    shippingSubsidy: r2(shippingSubsidy),
    packaging: r2(packaging),
  };
  const totalFees = r2(Object.values(fees).reduce((a, b) => a + b, 0));
  const marginValue = r2(finalPrice - cost - totalFees);
  const marginPct = finalPrice > 0 ? r2(marginValue / finalPrice * 100) : 0;
  /* preço mínimo: margem zero, resolvendo price*(1-pcts) - fixos - custo = 0 */
  const pctLoad = (commissionPct + adsPct + taxPct + affiliatePct) / 100;
  const fixedLoad = cost + fixedFee + shippingSubsidy + packaging;
  const minPrice = pctLoad < 1 ? r2(fixedLoad / (1 - pctLoad)) : null;
  /* preço recomendado: atinge a margem mínima desejada */
  const target = (minMarginPct || 0) / 100;
  const recommendedPrice = pctLoad + target < 1
    ? r2(fixedLoad / (1 - pctLoad - target)) : null;
  return { computable: true, price, finalPrice, promoDiscountPct, cost,
           fees, totalFees, marginValue, marginPct, minPrice, recommendedPrice,
           belowMinMargin: minMarginPct != null && marginPct < minMarginPct };
}

const r2 = v => Math.round(v * 100) / 100;

class MarginService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  /* garante um perfil de taxas por praça — SEMPRE com fonte identificada */
  ensureFeeProfiles(companyId) {
    for (const [marketplace, d] of Object.entries(INTERNAL_DEFAULTS)) {
      const existing = this.r.feeProfile.db.get(
        'SELECT id FROM marketplace_fee_profile WHERE company_id = ? AND marketplace = ?',
        companyId, marketplace);
      if (!existing) this.r.feeProfile.insert({ company_id: companyId, marketplace,
        ...d, ads_pct_default: 0, source: 'INTERNAL_DEFAULT',
        created_at: this.clock.nowIso() });
    }
  }

  feeProfile(companyId, marketplace) {
    return this.r.feeProfile.db.get(
      'SELECT * FROM marketplace_fee_profile WHERE company_id = ? AND marketplace = ?',
      companyId, marketplace) || null;
  }

  /* margem de um produto numa praça (com desconto/afiliado opcionais) */
  forProduct(productId, marketplace, { promoDiscountPct = 0, affiliatePct = 0,
                                       priceOverride = null } = {}) {
    const profile = this.r.productProfile.db.get(
      'SELECT * FROM product_profile WHERE product_id = ?', productId);
    if (!profile) return { computable: false, reason: 'produto sem ficha (product_profile)' };
    const mp = this.r.marketplaceProfile.db.get(
      `SELECT * FROM marketplace_product_profile WHERE product_id = ? AND platform = ?`,
      productId, marketplace);
    const fees = this.feeProfile(profile.company_id, marketplace);
    if (!fees) return { computable: false, reason: `sem perfil de taxas para ${marketplace}` };
    const price = priceOverride ?? (mp && mp.price != null ? mp.price : profile.base_price);
    const result = computeMargin({
      price, cost: profile.cost,
      commissionPct: fees.commission_pct, fixedFee: fees.fixed_fee,
      shippingSubsidy: fees.shipping_subsidy, taxPct: fees.tax_pct,
      adsPct: fees.ads_pct_default, promoDiscountPct, affiliatePct,
      minMarginPct: profile.min_margin_pct });
    return { ...result, marketplace, productId,
             feeSource: fees.source,
             feeSourceLabel: fees.source === 'INTERNAL_DEFAULT'
               ? 'estimativa interna — não é tarifa oficial da plataforma'
               : fees.source };
  }
}

module.exports = { MarginService, computeMargin, INTERNAL_DEFAULTS };

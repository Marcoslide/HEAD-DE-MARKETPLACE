/* PROMOÇÕES E CAMPANHAS (Sprint 10.B) — entidade COMPARTILHADA.

   Catálogo mostra promoções por produto/anúncio; Crescimento mostra a
   estratégia, resultado e margem — MESMA tabela, nunca duplicada.

   Neste sprint: criar, calcular, simular, organizar, revisar e aprovar
   INTERNAMENTE. Continua proibido: ativar promoção externa, alterar
   preço externo, Ads externo, publicar campanha, escrever em
   marketplace. Sem margem calculada → EM_REVISAO, nunca aprovada. */
'use strict';

const PROMOTION_STATUSES = ['RASCUNHO', 'EM_REVISAO', 'APROVADA_INTERNAMENTE',
  'AGUARDANDO_CONEXAO', 'AGUARDANDO_AUTORIZACAO_DE_ESCRITA', 'ATIVA_EXTERNAMENTE',
  'PAUSADA', 'ENCERRADA', 'CANCELADA'];

class ExternalWriteError extends Error {
  constructor(what) {
    super(`${what} é escrita externa — PROIBIDA neste sprint. A promoção fica ` +
      `AGUARDANDO_AUTORIZACAO_DE_ESCRITA até existir fluxo de aprovação forte de escrita.`);
    this.name = 'ExternalWriteError';
  }
}

class PromotionService {
  constructor({ repos, margin, permissions, approvals, clock, bus }) {
    this.r = repos; this.margin = margin; this.permissions = permissions;
    this.approvals = approvals; this.clock = clock; this.bus = bus;
  }

  create({ companyId, userId = null, origin, name, objective = null, marketplace,
           discountType = 'PCT', discountValue, startsAt = null, endsAt = null,
           targets = [], capUnits = null, affiliateId = null, campaignId = null }) {
    if (userId) this.permissions.assert(userId, companyId, 'promotion.manage');
    if (!origin) throw new Error('promoção exige origem de ação');
    const promo = this.r.promotion.insert({
      company_id: companyId, name, objective, marketplace,
      discount_type: discountType, discount_value: discountValue,
      starts_at: startsAt, ends_at: endsAt, status: 'RASCUNHO',
      affiliate_id: affiliateId, campaign_id: campaignId, origin,
      created_by: userId, created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    for (const t of targets) {
      this.r.promotionTarget.insert({ promotion_id: promo.id, company_id: companyId,
        product_id: t.productId, listing_id: t.listingId || null,
        marketplace, created_at: this.clock.nowIso() });
      if (capUnits != null) this.r.promotionCap.insert({ promotion_id: promo.id,
        product_id: t.productId, cap_units: capUnits, created_at: this.clock.nowIso() });
    }
    this.r.promotionProfile.insert({ promotion_id: promo.id, marketplace,
      params_json: { discountType, discountValue }, created_at: this.clock.nowIso() });
    this.r.audit.record('promotion', 'created', { companyId, entity: 'promotion',
      entityId: promo.id, detail: { origin, marketplace, targets: targets.length, by: userId } });
    this.bus.emit('promotion.created', { promotionId: promo.id, companyId, origin });
    return promo;
  }

  /* simulação: margem + risco de ruptura por alvo; sem margem → EM_REVISAO */
  simulate(promotionId) {
    const promo = this.r.promotion.byId(promotionId);
    const targets = this.r.promotionTarget.db.all(
      'SELECT * FROM promotion_target WHERE promotion_id = ?', promotionId);
    const discountPct = promo.discount_type === 'PCT' ? promo.discount_value : null;
    const affiliate = promo.affiliate_id ? this.r.affiliate.maybeById(promo.affiliate_id) : null;
    const affiliatePct = affiliate && affiliate.commission_pct != null ? affiliate.commission_pct : 0;
    const sims = [];
    let anyNotComputable = false, anyBelowMin = false;

    for (const t of targets) {
      let m;
      if (discountPct != null)
        m = this.margin.forProduct(t.product_id, promo.marketplace,
          { promoDiscountPct: discountPct, affiliatePct });
      else
        m = this.margin.forProduct(t.product_id, promo.marketplace,
          { priceOverride: promo.discount_value, affiliatePct });

      /* risco de ruptura: limite da promoção × estoque disponível */
      const cap = this.r.promotionCap.db.get(
        'SELECT * FROM promotion_inventory_cap WHERE promotion_id = ? AND product_id = ?',
        promotionId, t.product_id);
      const mp = this.r.marketplaceProfile.db.get(
        'SELECT stock FROM marketplace_product_profile WHERE product_id = ? AND platform = ?',
        t.product_id, promo.marketplace);
      const stock = mp ? mp.stock : null;
      const stockRisk = stock == null ? 'DESCONHECIDO'
        : cap && cap.cap_units != null
          ? (cap.cap_units > stock ? 'ALTO — limite maior que o estoque'
            : cap.cap_units > stock * 0.7 ? 'MEDIO — limite compromete boa parte do estoque' : 'BAIXO')
        : 'SEM_LIMITE_DEFINIDO';

      if (!m.computable) anyNotComputable = true;
      if (m.computable && m.belowMinMargin) anyBelowMin = true;
      const sim = this.r.promotionSimulation.insert({
        promotion_id: promotionId, product_id: t.product_id,
        marketplace: promo.marketplace, breakdown_json: m,
        margin_pct: m.computable ? m.marginPct : null,
        min_price: m.computable ? m.minPrice : null,
        stock_risk: stockRisk, computable: m.computable ? 1 : 0,
        reason: m.computable ? null : m.reason, created_at: this.clock.nowIso() });
      this.r.promotionEligibility.insert({ promotion_id: promotionId,
        product_id: t.product_id, eligible: m.computable && !m.belowMinMargin ? 1 : 0,
        reasons_json: m.computable
          ? (m.belowMinMargin ? [`margem ${m.marginPct}% abaixo da mínima do produto`] : [])
          : [m.reason],
        created_at: this.clock.nowIso() });
      sims.push({ productId: t.product_id, ...m, stockRisk, simulationId: sim.id });
    }

    if (anyNotComputable || anyBelowMin) {
      this.r.promotion.update(promotionId, { status: 'EM_REVISAO',
        review_reason: anyNotComputable
          ? 'margem não computável em pelo menos um alvo — revisão obrigatória'
          : 'margem abaixo da mínima em pelo menos um alvo',
        updated_at: this.clock.nowIso() });
    }
    return { promotionId, simulations: sims,
             marginOk: !anyNotComputable && !anyBelowMin,
             status: this.r.promotion.byId(promotionId).status,
             externalWrite: false };
  }

  submitReview(promotionId) {
    return this.r.promotion.update(promotionId, { status: 'EM_REVISAO',
      updated_at: this.clock.nowIso() });
  }

  /* aprovação INTERNA (não é ativação externa) — exige simulação com margem */
  approveInternal(promotionId, { userId }) {
    const promo = this.r.promotion.byId(promotionId);
    this.permissions.assert(userId, promo.company_id, 'promotion.approve');
    const sims = this.r.promotionSimulation.db.all(
      'SELECT * FROM promotion_margin_simulation WHERE promotion_id = ?', promotionId);
    if (!sims.length) throw new Error('promoção sem simulação de margem — simule antes de aprovar');
    if (sims.some(s => !s.computable))
      throw new Error('promoção com margem não computável — permanece em revisão');
    const approval = this.approvals.require({ companyId: promo.company_id,
      kind: 'PROMOTION', entity: 'promotion', entityId: promotionId,
      requestedBy: userId, detail: { name: promo.name } });
    this.approvals.decide(approval.id, { userId, approve: true,
      motive: 'aprovação interna de promoção' });
    return this.r.promotion.update(promotionId, {
      status: 'APROVADA_INTERNAMENTE', approval_id: approval.id,
      updated_at: this.clock.nowIso() });
  }

  /* ativação EXTERNA: PROIBIDA — estado máximo é aguardar autorização */
  activateExternally(promotionId) {
    this.r.promotion.update(promotionId, {
      status: 'AGUARDANDO_AUTORIZACAO_DE_ESCRITA', updated_at: this.clock.nowIso() });
    throw new ExternalWriteError('ativar promoção no marketplace');
  }

  /* ---------- as DUAS visões da MESMA entidade ---------- */
  catalogView(productId) {
    return this.r.promotion.db.all(
      `SELECT p.* FROM promotion p JOIN promotion_target t ON t.promotion_id = p.id
       WHERE t.product_id = ? ORDER BY p.id DESC`, productId);
  }

  growthView(companyId) {
    return this.r.promotion.db.all(
      'SELECT * FROM promotion WHERE company_id = ? ORDER BY id DESC', companyId)
      .map(p => ({ ...p,
        targets: this.r.promotionTarget.count('WHERE promotion_id = ?', p.id),
        simulations: this.r.promotionSimulation.db.all(
          'SELECT margin_pct, stock_risk, computable, reason FROM promotion_margin_simulation WHERE promotion_id = ?', p.id) }));
  }

  /* promoções prejudicando margem (para "quais promoções derrubam minha margem?") */
  marginRiskList(companyId) {
    return this.r.promotion.db.all(
      `SELECT DISTINCT p.id, p.name, p.marketplace, p.status, s.margin_pct, s.reason
       FROM promotion p JOIN promotion_margin_simulation s ON s.promotion_id = p.id
       WHERE p.company_id = ? AND (s.computable = 0 OR s.margin_pct < COALESCE(
         (SELECT pp.min_margin_pct FROM product_profile pp WHERE pp.product_id = s.product_id), 0))`,
      companyId);
  }

  /* campanhas internas */
  createCampaign({ companyId, userId = null, origin, name, objective = null,
                   kind = 'INTERNA', targets = [] }) {
    if (userId) this.permissions.assert(userId, companyId, 'promotion.manage');
    const c = this.r.campaign.insert({ company_id: companyId, name, kind, objective,
      status: 'RASCUNHO', origin, created_by: userId,
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    for (const t of targets)
      this.r.campaignTarget.insert({ campaign_id: c.id, company_id: companyId,
        kind: t.kind, target_id: t.targetId, created_at: this.clock.nowIso() });
    this.r.audit.record('campaign', 'created', { companyId, entity: 'campaign',
      entityId: c.id, detail: { origin, targets: targets.length, by: userId } });
    return c;
  }
}

module.exports = { PromotionService, PROMOTION_STATUSES, ExternalWriteError };

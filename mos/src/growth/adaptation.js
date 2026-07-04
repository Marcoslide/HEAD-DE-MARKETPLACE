/* ADAPTATION ENGINE (Sprint 10.B) — UM único motor de adaptação.

   "Cria drafts Shopee dos produtos com margem acima de 25%" — venha do
   dashboard ou do WhatsApp, o caminho é O MESMO: plano → confirmação
   (quando em massa) → job interno auditável → CatalogService.createDraft
   do Sprint 10 → resultado na tela e no WhatsApp. NUNCA existe uma
   "automação WhatsApp" paralela. Nenhuma escrita externa acontece aqui:
   draft é interno; publicar continua bloqueado por READ_ONLY. */
'use strict';

class AdaptationEngine {
  constructor({ repos, catalog, jobs, permissions, approvals, margin, bus, clock }) {
    this.r = repos; this.catalog = catalog; this.jobs = jobs;
    this.permissions = permissions; this.approvals = approvals;
    this.margin = margin; this.bus = bus; this.clock = clock;
    this.executions = 0;               // prova de motor único nos testes
  }

  /* ---------- 1. PLANO: o que SERIA feito (nunca executa) ---------- */
  plan({ companyId, targetPlatform, filters = {} }) {
    let products = this.r.product.db.all(
      'SELECT * FROM product WHERE company_id = ?', companyId);

    /* "que vendem na Shopee" → precisa ter perfil/anúncio na origem */
    if (filters.sourcePlatform) {
      const withSource = new Set(this.r.marketplaceProfile.db.all(
        `SELECT product_id FROM marketplace_product_profile WHERE company_id = ? AND platform = ?`,
        companyId, filters.sourcePlatform).map(r => r.product_id));
      products = products.filter(p => withSource.has(p.id));
    }
    /* "e ainda não estão no Mercado Livre" → sem draft/perfil no destino */
    if (filters.notOnPlatform) {
      const onTarget = new Set([
        ...this.r.marketplaceProfile.db.all(
          `SELECT product_id FROM marketplace_product_profile WHERE company_id = ? AND platform = ?`,
          companyId, filters.notOnPlatform).map(r => r.product_id),
        ...this.r.listingDraft.db.all(
          `SELECT product_id FROM listing_draft WHERE company_id = ? AND platform = ? AND status != 'ARCHIVED'`,
          companyId, filters.notOnPlatform).map(r => r.product_id)]);
      products = products.filter(p => !onTarget.has(p.id));
    }
    if (filters.skus && filters.skus.length)
      products = products.filter(p => filters.skus.includes(p.sku));
    if (filters.nameContains)
      products = products.filter(p =>
        p.name.toLowerCase().includes(String(filters.nameContains).toLowerCase()));

    const items = [], skipped = [];
    for (const p of products) {
      const m = this.margin.forProduct(p.id, targetPlatform);
      if (filters.marginAbovePct != null) {
        if (!m.computable) {
          skipped.push({ productId: p.id, sku: p.sku, reason: `margem não computável: ${m.reason}` });
          continue;
        }
        if (m.marginPct <= filters.marginAbovePct) {
          skipped.push({ productId: p.id, sku: p.sku,
            reason: `margem ${m.marginPct}% ≤ filtro ${filters.marginAbovePct}%` });
          continue;
        }
      }
      items.push({ productId: p.id, sku: p.sku, name: p.name,
        marginPct: m.computable ? m.marginPct : null,
        marginComputable: m.computable,
        needsReview: !m.computable });     // sem margem → draft ficará em revisão
    }
    return { companyId, targetPlatform, filters, items, skipped,
             summary: { total: items.length, skipped: skipped.length,
                        needsReview: items.filter(i => i.needsReview).length },
             externalWrite: false };
  }

  /* ---------- 2. PEDIDO DE EXECUÇÃO: job + aprovação quando em massa ---------- */
  requestExecution({ companyId, userId, origin, plan, requesterRef = null }) {
    this.permissions.assert(userId, companyId, 'draft.create');
    const mass = plan.items.length > 1;
    let approval = null;
    if (mass) approval = this.approvals.require({
      companyId, kind: 'MASS_EDIT', entity: 'adaptation_plan',
      entityId: `${plan.targetPlatform}:${plan.items.length}`,
      requestedBy: userId, detail: { summary: plan.summary, filters: plan.filters } });
    const job = this.jobs.create({
      companyId, kind: 'adaptation.create_drafts', origin,
      params: { targetPlatform: plan.targetPlatform, filters: plan.filters,
                productIds: plan.items.map(i => i.productId) },
      total: plan.items.length,
      requiresConfirmation: mass,          // ação em massa SEMPRE confirma
      requestedBy: userId, requesterRef,
      approvalId: approval ? approval.id : null,
      summary: plan.summary });
    return { job, approval, requiresConfirmation: mass };
  }

  /* ---------- 3. EXECUÇÃO: o MESMO caminho para toda origem ---------- */
  async execute(jobId, { userId }) {
    const job = this.jobs.start(jobId);
    this.permissions.assert(userId, job.company_id, 'job.execute');
    if (job.approval_id) {
      const ap = this.r.approval.byId(job.approval_id);
      if (ap.status === 'PENDING')
        this.approvals.decide(job.approval_id, { userId, approve: true,
          motive: 'confirmação da execução em massa' });
      else if (ap.status !== 'APPROVED')
        throw new Error(`aprovação ${ap.status} — job não pode executar`);
    }
    this.executions++;
    const params = JSON.parse(job.params_json);
    const created = [], reviewOnly = [];
    for (const productId of params.productIds) {
      try {
        const draft = this.catalog.createDraft(productId, params.targetPlatform);
        const m = this.margin.forProduct(productId, params.targetPlatform);
        if (!m.computable) {
          /* sem margem calculada → draft fica em REVISÃO, nunca segue */
          this.r.listingDraft.db.run(
            `UPDATE listing_draft SET human_review = 1, updated_at = ? WHERE id = ?`,
            this.clock.nowIso(), draft.id);
          reviewOnly.push({ draftId: draft.id, reason: m.reason });
        }
        created.push(draft.id);
        this.jobs.progress(jobId, { succeeded: 1 });
      } catch (err) {
        this.jobs.progress(jobId, { failed: 1,
          reason: `${productId}: ${err.message}` });
      }
    }
    const finished = this.jobs.finish(jobId, {
      report: { draftIds: created, reviewOnly,
                platform: params.targetPlatform, externalWrite: false },
      rollback: { draftIds: created } });
    this.bus.emit('adaptation.executed', { jobId, created: created.length });
    return { jobId, status: finished.status, draftIds: created, reviewOnly,
             succeeded: finished.succeeded, failed: finished.failed,
             externalWrite: false };
  }
}

module.exports = { AdaptationEngine };

/* CATALOG SERVICE (Sprint 10) — Node: persistência e orquestração do
   Compliance Engine sobre o catálogo REAL da empresa.

   - Product Master = tabela `product` existente (auditoria: REUTILIZAR);
   - perfis/assets/projeções/drafts/validation runs = tabelas novas (S10);
   - validação NUNCA sobrescreve histórico (validation_run é append-only);
   - findings relevantes viram sinais `central.signal` → CentralBridge →
     EPE com executionScope INTERNAL_ONLY (mesma trilha do Sprint 09);
   - NADA aqui publica, altera preço/estoque/anúncio ou chama escrita. */
'use strict';
const C = require('../compliance/index.js');

class CatalogService {
  constructor({ repos, bus, providers, clock, logger = null }) {
    this.r = repos; this.bus = bus; this.providers = providers;
    this.clock = clock; this.log = logger;
    /* rule packs entram no MESMO registry dos providers/conectores */
    for (const pack of Object.values(C.RULE_PACKS))
      if (!providers.hasRulePack(pack.platform)) providers.registerRulePack(pack);
  }

  /* ---------- ingestão do Product Master canônico ---------- */
  upsertMaster(companyId, canonical) {
    const existing = this.r.product.db.get(
      'SELECT id FROM product WHERE company_id = ? AND sku = ?', companyId, canonical.master.sku);
    const product = existing
      ? this.r.product.byId(existing.id)
      : this.r.product.insert({ company_id: companyId, name: canonical.master.name,
          sku: canonical.master.sku, cost: canonical.profile.cost ?? null, attributes_json: {} });
    const p = canonical.profile;
    const prof = this.r.productProfile.db.get(
      'SELECT id FROM product_profile WHERE product_id = ?', product.id);
    const row = {
      product_id: product.id, company_id: companyId,
      brand: p.brand, product_type: p.productType, condition: p.condition,
      description: p.description, tech_sheet_json: p.techSheet || {},
      weight_g: p.weightG, packed_weight_g: p.packedWeightG,
      height_cm: p.heightCm, width_cm: p.widthCm, depth_cm: p.depthCm,
      packed_dims_json: p.packedDims || null, fragile: p.fragile ? 1 : 0,
      special_packaging: p.specialPackaging, production_days: p.productionDays,
      personalization_days: p.personalizationDays, made_to_order: p.madeToOrder ? 1 : 0,
      personalization_json: p.personalization || null, daily_capacity: p.dailyCapacity,
      base_price: p.basePrice, cost: p.cost, min_margin_pct: p.minMarginPct,
      ean: p.ean, origin: p.origin, warranty: p.warranty, fiscal_json: p.fiscal || {},
      return_policy: p.returnPolicy, updated_at: this.clock.nowIso(),
    };
    if (prof) this.r.productProfile.update(prof.id, row);
    else this.r.productProfile.insert(row);
    /* assets: recarga substitui o conjunto (metadados, não histórico) */
    this.r.productAsset.db.run('DELETE FROM product_asset WHERE product_id = ?', product.id);
    for (const a of canonical.assets || [])
      this.r.productAsset.insert({ product_id: product.id, company_id: companyId,
        kind: a.kind, role: a.role, url: a.url, width: a.width, height: a.height,
        format: a.format, size_kb: a.sizeKb ?? null, has_watermark: a.hasWatermark ? 1 : 0,
        has_text_overlay: a.hasTextOverlay ? 1 : 0, position: a.position ?? 0,
        created_at: this.clock.nowIso() });
    for (const [platform, mp] of Object.entries(canonical.byPlatform || {})) {
      const row = { product_id: product.id, company_id: companyId,
        platform, title: mp.title, category_id: mp.categoryId ?? null,
        category_status: mp.categoryStatus ?? null, attributes_json: mp.attributes || {},
        price: mp.price ?? null, stock: mp.stock ?? null,
        content_json: mp.content || null, updated_at: this.clock.nowIso() };
      const existing = this.r.marketplaceProfile.db.get(
        'SELECT id FROM marketplace_product_profile WHERE product_id = ? AND platform = ?', product.id, platform);
      if (existing) this.r.marketplaceProfile.update(existing.id, row);
      else this.r.marketplaceProfile.insert(row);
    }
    return product;
  }

  /* rows → produto canônico (o formato que o motor entende) */
  assemble(productId) {
    const master = this.r.product.byId(productId);
    const prof = this.r.productProfile.db.get('SELECT * FROM product_profile WHERE product_id = ?', productId);
    const assets = this.r.productAsset.db.all('SELECT * FROM product_asset WHERE product_id = ? ORDER BY position', productId);
    const mps = this.r.marketplaceProfile.db.all('SELECT * FROM marketplace_product_profile WHERE product_id = ?', productId);
    const j = s => s ? JSON.parse(s) : null;
    const byPlatform = {};
    for (const m of mps) byPlatform[m.platform] = {
      title: m.title, categoryId: m.category_id, categoryStatus: m.category_status,
      attributes: j(m.attributes_json) || {}, price: m.price, stock: m.stock,
      content: j(m.content_json) || {},
    };
    return {
      master: { id: master.id, companyId: master.company_id, name: master.name, sku: master.sku },
      profile: prof ? {
        brand: prof.brand, productType: prof.product_type, condition: prof.condition,
        description: prof.description, techSheet: j(prof.tech_sheet_json) || {},
        weightG: prof.weight_g, packedWeightG: prof.packed_weight_g,
        heightCm: prof.height_cm, widthCm: prof.width_cm, depthCm: prof.depth_cm,
        packedDims: j(prof.packed_dims_json), fragile: prof.fragile,
        specialPackaging: prof.special_packaging, productionDays: prof.production_days,
        personalizationDays: prof.personalization_days, madeToOrder: prof.made_to_order,
        personalization: j(prof.personalization_json), dailyCapacity: prof.daily_capacity,
        basePrice: prof.base_price, cost: prof.cost, minMarginPct: prof.min_margin_pct,
        ean: prof.ean, origin: prof.origin, warranty: prof.warranty,
        fiscal: j(prof.fiscal_json) || {}, returnPolicy: prof.return_policy,
      } : { techSheet: {}, fiscal: {} },
      assets: assets.map(a => ({ kind: a.kind, role: a.role, url: a.url, width: a.width,
        height: a.height, format: a.format, sizeKb: a.size_kb,
        hasWatermark: !!a.has_watermark, hasTextOverlay: !!a.has_text_overlay })),
      byPlatform,
    };
  }

  /* ---------- validação com trilha de auditoria (append-only) ---------- */
  validate(productId, platform) {
    const canonical = this.assemble(productId);
    const result = C.evaluate(canonical, platform, { clock: this.clock });
    const pack = C.RULE_PACKS[platform];
    const run = this.r.validationRun.insert({
      company_id: canonical.master.companyId, product_id: productId, platform,
      category_id: result.category ? (result.category.confirmed || result.category.applied) : null,
      rule_pack_version: result.rulePackVersion || 'n/a',
      data_source: result.dataSource || 'n/a',
      executed_at: result.executedAt, executed_by: 'compliance-engine',
      status: result.status, findings_json: result.findings,
      evidence_json: { checklist: result.checklist, missing: result.missing,
                       disclaimer: result.disclaimer, packVerifiedAt: pack ? pack.verifiedAt : null },
      created_at: this.clock.nowIso(),
    });
    this.r.audit.record('catalog-service', 'validation_run',
      { companyId: canonical.master.companyId, entity: 'product', entityId: productId,
        detail: { platform, status: result.status, run: run.id } });
    return { ...result, runId: run.id };
  }

  history(productId, platform = null) {
    return platform
      ? this.r.validationRun.db.all('SELECT * FROM validation_run WHERE product_id = ? AND platform = ? ORDER BY id', productId, platform)
      : this.r.validationRun.db.all('SELECT * FROM validation_run WHERE product_id = ? ORDER BY id', productId);
  }

  /* ---------- rascunho INTERNO (nunca publica) ---------- */
  createDraft(productId, platform) {
    const canonical = this.assemble(productId);
    const result = this.validate(productId, platform);
    const draft = C.buildDraft(canonical, platform, result);
    const prev = this.r.listingDraft.db.get(
      'SELECT MAX(version) v FROM listing_draft WHERE product_id = ? AND platform = ?', productId, platform);
    const row = this.r.listingDraft.insert({
      product_id: productId, company_id: canonical.master.companyId, platform,
      version: (prev && prev.v || 0) + 1, status: draft.status,
      payload_json: draft.payload, findings_json: draft.findings,
      checklist_json: draft.checklist, suggestions_source: draft.suggestionsSource,
      validation_run_id: result.runId,
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso(),
    });
    this.bus.emit('catalog.draft_created', { draftId: row.id, productId, platform, status: draft.status });
    return { ...draft, id: row.id, version: row.version };
  }

  /* ---------- visão geral: readiness por produto × praça ---------- */
  board(companyId, platforms = null) {
    const products = this.r.product.db.all('SELECT id FROM product WHERE company_id = ?', companyId);
    const out = [];
    for (const { id } of products) {
      const canonical = this.assemble(id);
      const plats = platforms || Object.keys(canonical.byPlatform);
      for (const platform of plats) {
        const result = C.evaluate(canonical, platform, { clock: this.clock });
        const top = result.findings.find(f => f.severity === 'BLOCKER')
          || result.findings.find(f => f.severity === 'HIGH_RISK') || null;
        out.push({ productId: id, sku: canonical.master.sku, name: canonical.master.name,
          platform, status: result.status, topBlocker: top ? top.message : null,
          rulePackVersion: result.rulePackVersion });
      }
    }
    return out;
  }

  /* ---------- findings relevantes → sinais INTERNOS para o EPE ----------
     Só o que tem impacto/risco/oportunidade real vira sinal; pendência
     pequena NÃO vira missão. */
  refreshComplianceSignals(companyId) {
    const board = this.board(companyId);
    const delivered = [];
    const bySku = new Map();
    for (const b of board) {
      if (!bySku.has(b.sku)) bySku.set(b.sku, []);
      bySku.get(b.sku).push(b);
    }
    for (const [sku, rows] of bySku) {
      const readyIn = rows.filter(r => r.status === 'READY' || r.status === 'READY_WITH_WARNINGS');
      const blockedIn = rows.filter(r => r.status === 'BLOCKED');
      /* oportunidade impedida: pronto num canal, bloqueado em outro */
      if (readyIn.length && blockedIn.length)
        delivered.push(this._signal(companyId, {
          playbook: 'compliance-expansao-impedida',
          signalKey: `compliance-expand|${sku}|${blockedIn[0].platform}`,
          productId: sku,
          title: `${rows[0].name}: validado para ${readyIn[0].platform}, mas BLOQUEADO no ${blockedIn[0].platform} (${blockedIn[0].topBlocker})`,
          impactMonthly: 900, confidenceLabel: 'alta', urgency: 'média', severity: 'attention',
          effort: 1, reversible: true, class: 'C', proposalType: 'fix-catalog-blockers',
          hasProposal: true, window: false,
          evidence: { sku, readyIn: readyIn.map(r => r.platform), blockedIn: blockedIn.map(r => r.platform) },
          recommendation: 'completar os dados do catálogo (checklist interno) e revisar o rascunho — nenhuma ação externa',
          provenance: { platform: blockedIn[0].platform, accountId: null, storeId: null,
            entityType: 'PRODUCT', entityId: sku, eventId: null },
        }));
      /* risco operacional de personalizado detectado pela validação */
      const canonical = this.assemble(rows[0].productId);
      const anyHigh = rows.find(r => r.status === 'READY_WITH_WARNINGS');
      if (anyHigh && canonical.profile.madeToOrder) {
        const res = C.evaluate(canonical, anyHigh.platform, { clock: this.clock });
        const risky = res.findings.filter(f => f.category === 'PERSONALIZATION' && f.severity === 'HIGH_RISK');
        if (risky.length)
          delivered.push(this._signal(companyId, {
            playbook: 'compliance-personalizado-prazo',
            signalKey: `compliance-custom|${sku}`,
            productId: sku,
            title: `${rows[0].name}: ${risky[0].message}`,
            impactMonthly: 700, confidenceLabel: 'alta', urgency: 'alta', severity: 'attention',
            effort: 1, reversible: true, class: 'C', proposalType: 'review-lead-time',
            hasProposal: true, window: true,
            evidence: { sku, findings: risky.map(f => f.message) },
            recommendation: 'revisar prazo/capacidade internamente antes de expor o produto a mais demanda',
            provenance: { platform: anyHigh.platform, accountId: null, storeId: null,
              entityType: 'PRODUCT', entityId: sku, eventId: null },
          }));
      }
    }
    return { generated: delivered.length, delivered };
  }
  _signal(companyId, s) {
    this.bus.emit('central.signal', s);   // CentralBridge → EPE (INTERNAL_ONLY)
    this.r.audit.record('catalog-service', 'compliance_signal',
      { companyId, entity: 'product', entityId: s.productId, detail: { playbook: s.playbook } });
    return s;
  }
}

module.exports = { CatalogService };

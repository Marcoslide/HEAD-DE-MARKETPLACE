/* CRIAÇÃO DE ANÚNCIO PELA CONVERSA (Sprint 10.B — complemento).

   Operação é a porta de entrada conversacional; o Catálogo é a mesa
   visual. UM fluxo só: o que nasce na conversa usa os MESMOS serviços
   (Product Master, Assets, Truth Pack, Listing Draft, Compliance,
   Adaptation Engine, jobs, auditoria, permissões).

   Regras duras:
   - produto existente é IDENTIFICADO, nunca duplicado;
   - produto novo vira PRODUCT_INTAKE — nunca Product Master sem revisão;
   - foto de REFERÊNCIA nunca vira asset oficial automaticamente;
   - link é Source Reference — conteúdo de terceiros NUNCA é copiado;
   - sem medida/peso/custo o draft não fica pronto (fica em revisão);
   - multimarketplace = drafts SEPARADOS, cada um com seu rule pack. */
'use strict';
const crypto = require('node:crypto');

const INTAKE_ORIGINS = ['DASHBOARD_OPERATION', 'WHATSAPP_COMMAND',
                        'MANUAL_CATALOG', 'IMPORTED_REFERENCE'];
const MINIMUM_FIELDS = ['medidas', 'material', 'pesoEmbalado', 'custo', 'estoque'];

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);
const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

class IntakeService {
  constructor({ repos, catalog, adaptation, permissions, jobs, bus, clock }) {
    this.r = repos; this.catalog = catalog; this.adaptation = adaptation;
    this.permissions = permissions; this.jobs = jobs; this.bus = bus; this.clock = clock;
  }

  _assertOrigin(origin) {
    if (!INTAKE_ORIGINS.includes(origin))
      throw new Error(`origem de intake inválida: ${origin} — use ${INTAKE_ORIGINS.join(', ')}`);
  }

  /* ---------- identificação: existe Product Master correspondente? ---------- */
  matchProduct(companyId, term) {
    const t = norm(term);
    if (!t) return [];
    const products = this.r.product.db.all(
      'SELECT * FROM product WHERE company_id = ?', companyId);
    return products
      .map(p => {
        const name = norm(p.name), sku = norm(p.sku || '');
        let score = 0;
        if (sku && (t.includes(sku) || sku.includes(t))) score += 3;
        const words = t.split(/\s+/).filter(w => w.length > 3);
        score += words.filter(w => name.includes(w)).length;
        return { product: p, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => ({ id: x.product.id, sku: x.product.sku, name: x.product.name, score: x.score }));
  }

  /* ---------- início do fluxo: conversa → intake OU produto existente ---------- */
  start({ companyId, userId = null, origin, text = '', marketplaces = [],
          messageId = null }) {
    this._assertOrigin(origin);
    if (userId) this.permissions.assert(userId, companyId, 'draft.create');
    const matches = this.matchProduct(companyId, text);
    if (matches.length) {
      return { mode: 'EXISTING_PRODUCT', matches,
               question: matches.length > 1
                 ? `Encontrei ${matches.length} produtos possíveis — qual deles?`
                 : null };
    }
    const intake = this.r.productIntake.insert({
      company_id: companyId, status: 'NEW',
      provisional_name: text.slice(0, 120) || null,
      data_json: {}, marketplaces_json: marketplaces,
      origin, message_id: messageId, created_by: userId,
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('intake', 'started', { companyId, entity: 'product_intake',
      entityId: intake.id, detail: { origin, messageId, by: userId } });
    return { mode: 'NEW_PRODUCT', intake,
             question: 'Você quer anunciar um produto que já existe ou começar um produto novo?' };
  }

  /* ---------- fotos: origem + hash + tipo; referência NUNCA vira oficial ---------- */
  attachAsset({ companyId, intakeId = null, productId = null, kind = 'UNCLASSIFIED',
                url, uploadedBy = null, origin, messageId = null, assetType = 'image' }) {
    this._assertOrigin(origin);
    if (!['OFFICIAL', 'REFERENCE', 'CREATIVE_REF', 'UNCLASSIFIED'].includes(kind))
      throw new Error(`tipo de asset inválido: ${kind}`);
    const asset = this.r.intakeAsset.insert({
      company_id: companyId, intake_id: intakeId, product_id: productId,
      kind, asset_type: assetType, url, hash: sha(url),
      origin, uploaded_by: uploadedBy, message_id: messageId,
      review_status: 'PENDING_REVIEW',
      allowed_use: kind === 'OFFICIAL' ? 'anuncio (após revisão)'
        : kind === 'REFERENCE' ? 'apenas referência — nunca no anúncio'
        : kind === 'CREATIVE_REF' ? 'inspiração de criativo'
        : 'aguardando classificação',
      created_at: this.clock.nowIso() });
    /* foto OFICIAL de produto existente → sugere Product Asset (revisão pendente) */
    let officialSuggestion = null;
    if (kind === 'OFFICIAL' && productId) {
      officialSuggestion = { productId, action: 'sugerir atualização de Product Assets',
        note: 'entra na ficha só após revisão humana' };
    }
    this.r.audit.record('intake', 'asset_attached', { companyId, entity: 'intake_asset',
      entityId: asset.id, detail: { kind, origin, hash: asset.hash, by: uploadedBy } });
    const question = kind === 'UNCLASSIFIED'
      ? 'Essas fotos são do produto real que será vendido ou são apenas referência?' : null;
    if (intakeId) this._advance(intakeId);
    return { asset, question, officialSuggestion,
             becomesOfficialAutomatically: false };
  }

  classifyAsset(assetId, kind, { byUser = null } = {}) {
    if (!['OFFICIAL', 'REFERENCE', 'CREATIVE_REF'].includes(kind))
      throw new Error(`classificação inválida: ${kind}`);
    const updated = this.r.intakeAsset.update(assetId, { kind,
      allowed_use: kind === 'OFFICIAL' ? 'anuncio (após revisão)' : 'apenas referência — nunca no anúncio' });
    this.r.audit.record('intake', 'asset_classified', {
      companyId: updated.company_id, entity: 'intake_asset', entityId: assetId,
      detail: { kind, by: byUser } });
    return updated;
  }

  /* ---------- link: Source Reference — conteúdo de terceiros nunca é copiado ---------- */
  registerLink({ companyId, url, origin, intakeId = null, productId = null,
                 registeredBy = null }) {
    this._assertOrigin(origin);
    let domain = null;
    try { domain = new URL(url).hostname; } catch { domain = null; }
    const kind = !domain ? 'UNKNOWN'
      : /mercadolivre|mercadolibre/.test(domain) ? 'MARKETPLACE'
      : /shopee/.test(domain) ? 'MARKETPLACE'
      : /magalu|magazineluiza/.test(domain) ? 'MARKETPLACE'
      : /tiktok/.test(domain) ? 'MARKETPLACE'
      : 'UNKNOWN';
    const ref = this.r.sourceReference.insert({
      company_id: companyId, url, domain, link_kind: kind, purpose: null,
      intake_id: intakeId, product_id: productId, content_copied: 0,
      registered_by: registeredBy, origin, created_at: this.clock.nowIso() });
    this.r.audit.record('intake', 'link_registered', { companyId,
      entity: 'source_reference', entityId: ref.id, detail: { domain, kind, by: registeredBy } });
    return { reference: ref, contentCopied: false,
      question: 'Como devo usar este link? (produto próprio · referência · importar anúncio próprio · comparar concorrente · só inspiração)',
      purposes: ['OWN_LISTING', 'OWN_PRODUCT', 'SUPPLIER', 'REFERENCE', 'COMPETITOR'] };
  }

  confirmLinkPurpose(referenceId, purpose, { byUser = null } = {}) {
    const ref = this.r.sourceReference.byId(referenceId);
    const updated = this.r.sourceReference.update(referenceId, {
      purpose, link_kind: purpose === 'COMPETITOR' ? 'COMPETITOR'
        : purpose === 'SUPPLIER' ? 'SUPPLIER'
        : purpose === 'OWN_LISTING' ? 'OWN_LISTING' : ref.link_kind });
    this.r.audit.record('intake', 'link_purpose_confirmed', {
      companyId: ref.company_id, entity: 'source_reference', entityId: referenceId,
      detail: { purpose, by: byUser } });
    /* concorrente/fornecedor: só insight estratégico — jamais cópia */
    const rule = purpose === 'COMPETITOR' || purpose === 'SUPPLIER'
      ? 'uso apenas como referência estratégica — descrição, imagens e marca NUNCA são copiadas; o produto real precisa ser confirmado antes de qualquer draft'
      : purpose === 'OWN_LISTING'
        ? 'importação de dados só via integração oficial conectada, com origem preservada e revisão antes de sobrescrever qualquer dado manual'
        : 'registrado como referência';
    return { reference: updated, rule, contentCopied: false };
  }

  /* ---------- intake: dados mínimos e avanço de status ---------- */
  setIntakeData(intakeId, fields, { byUser = null } = {}) {
    const intake = this.r.productIntake.byId(intakeId);
    const data = { ...JSON.parse(intake.data_json || '{}'), ...fields };
    const updated = this.r.productIntake.update(intakeId, {
      data_json: data, updated_at: this.clock.nowIso() });
    this.r.audit.record('intake', 'data_set', { companyId: intake.company_id,
      entity: 'product_intake', entityId: intakeId,
      detail: { fields: Object.keys(fields), by: byUser } });
    return this._advance(intakeId);
  }

  missingFor(intakeId) {
    const intake = this.r.productIntake.byId(intakeId);
    const data = JSON.parse(intake.data_json || '{}');
    const assets = this.r.intakeAsset.count(
      `WHERE intake_id = ? AND kind = 'OFFICIAL'`, intakeId);
    const missing = [];
    if (!assets) missing.push('fotos oficiais do produto real');
    if (!data.medidas) missing.push('medidas');
    if (!data.material) missing.push('material');
    if (!data.pesoEmbalado) missing.push('peso embalado');
    if (data.custo == null) missing.push('custo');
    if (data.estoque == null) missing.push('quantidade disponível');
    return missing;
  }

  _advance(intakeId) {
    const intake = this.r.productIntake.byId(intakeId);
    if (['REJECTED_DUPLICATE', 'ARCHIVED'].includes(intake.status)) return intake;
    const missing = this.missingFor(intakeId);
    const status = !missing.length ? 'READY_TO_CREATE_PRODUCT_MASTER'
      : missing.includes('fotos oficiais do produto real') ? 'AWAITING_IMAGES'
      : missing.includes('medidas') ? 'AWAITING_MEASUREMENTS'
      : missing.includes('custo') ? 'AWAITING_COST'
      : 'AWAITING_PRODUCT_DATA';
    return this.r.productIntake.update(intakeId, { status,
      updated_at: this.clock.nowIso() });
  }

  /* pergunta objetiva: SÓ o que falta */
  nextQuestion(intakeId) {
    const missing = this.missingFor(intakeId);
    if (!missing.length) return null;
    return `Para criar o draft sem inventar informações, preciso de: ${missing.join(', ')}.`;
  }

  /* ---------- intake → Product Master (com revisão + antidup) ---------- */
  promoteToMaster(intakeId, { userId, name, sku }) {
    const intake = this.r.productIntake.byId(intakeId);
    this.permissions.assert(userId, intake.company_id, 'catalog.edit');
    if (intake.status !== 'READY_TO_CREATE_PRODUCT_MASTER')
      throw new Error(`intake em ${intake.status} — complete os dados mínimos antes (${this.missingFor(intakeId).join(', ')})`);
    /* risco de duplicação: nome/SKU parecido → REJECTED_DUPLICATE */
    const dup = this.matchProduct(intake.company_id, `${sku || ''} ${name}`)
      .find(m => m.score >= 3);
    if (dup) {
      this.r.productIntake.update(intakeId, { status: 'REJECTED_DUPLICATE',
        duplicate_of: dup.id, updated_at: this.clock.nowIso() });
      return { created: false, duplicateOf: dup,
               message: `produto muito parecido já existe (${dup.sku} — ${dup.name}) — use o existente ou revise o intake` };
    }
    const data = JSON.parse(intake.data_json || '{}');
    const product = this.catalog.upsertMaster(intake.company_id, {
      master: { id: null, companyId: intake.company_id, name, sku },
      profile: {
        description: data.descricao || null,
        techSheet: { material: data.material || null },
        packedWeightG: data.pesoEmbalado || null,
        heightCm: data.medidas ? data.medidas.h : null,
        widthCm: data.medidas ? data.medidas.w : null,
        depthCm: data.medidas ? data.medidas.d : null,
        cost: data.custo ?? null, basePrice: data.preco ?? null,
        productionDays: data.prazo ?? null,
      },
      assets: [], byPlatform: {},
    });
    this.r.productIntake.update(intakeId, { product_id: product.id,
      status: 'ARCHIVED', updated_at: this.clock.nowIso() });
    /* assets oficiais do intake seguem vinculados ao produto */
    this.r.intakeAsset.db.run(
      `UPDATE intake_asset SET product_id = ? WHERE intake_id = ? AND kind = 'OFFICIAL'`,
      product.id, intakeId);
    this.r.audit.record('intake', 'promoted_to_master', {
      companyId: intake.company_id, entity: 'product_intake', entityId: intakeId,
      detail: { productId: product.id, by: userId } });
    return { created: true, product };
  }

  /* ---------- drafts pela conversa: o MESMO Adaptation Engine ---------- */
  async createDrafts({ companyId, userId, origin, productId, marketplaces,
                       requesterRef = null }) {
    this._assertOrigin(origin);
    const jobOrigin = origin === 'WHATSAPP_COMMAND' ? 'WHATSAPP_COMMAND'
      : origin === 'DASHBOARD_OPERATION' ? 'CHAT_OPERACIONAL' : 'DASHBOARD_MANUAL';
    const product = this.r.product.byId(productId);
    const results = [];
    for (const marketplace of marketplaces) {
      /* plano por praça, rule pack próprio, draft separado */
      const plan = this.adaptation.plan({ companyId,
        targetPlatform: marketplace, filters: { skus: [product.sku] } });
      const { job } = this.adaptation.requestExecution({ companyId, userId,
        origin: jobOrigin, plan, requesterRef });
      const r = await this.adaptation.execute(job.id, { userId });
      const draft = r.draftIds[0] ? this.r.listingDraft.byId(r.draftIds[0]) : null;
      const findings = draft ? JSON.parse(draft.findings_json || '[]') : [];
      results.push({
        marketplace, jobId: job.id, draftId: draft ? draft.id : null,
        status: draft ? draft.status : 'FAILED',
        readiness: !draft ? 'FALHOU'
          : draft.status === 'READY_FOR_REVIEW' ? 'pronto para revisão'
          : findings.some(f => f.severity === 'BLOCKER') ? 'bloqueado'
          : 'em revisão',
        pending: findings.filter(f => ['BLOCKER', 'UNKNOWN', 'HIGH_RISK'].includes(f.severity))
          .map(f => f.message).slice(0, 6),
        openInCatalog: draft ? `catalogo://draft/${draft.id}` : null,   // deep link
      });
    }
    this.r.audit.record('intake', 'drafts_created', { companyId,
      entity: 'product', entityId: productId,
      detail: { origin, marketplaces, drafts: results.map(x => x.draftId), by: userId } });
    return { productId, sku: product.sku, results, externalWrite: false,
             published: false };
  }
}

module.exports = { IntakeService, INTAKE_ORIGINS, MINIMUM_FIELDS };

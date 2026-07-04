/* Application · Use cases (Clean Architecture: depende de portas, não de infra).
   Cada serviço recebe {repos, bus, logger} — trocar SQLite por Postgres ou
   a fila em memória por SQS não toca nesta camada.

   Todo caso de uso: valida → executa em transação quando composto →
   registra auditoria → publica evento de domínio. */
'use strict';
const { ValidationError } = require('../kernel/errors.js');

class WorkspaceService {
  constructor({ repos, bus, logger }) { this.r = repos; this.bus = bus; this.log = logger; }

  /* Fluxo 001 (fundação): nasce o espaço da empresa */
  bootstrap({ workspaceName, userName, email, companyName, marketplaces = [] }) {
    if (!workspaceName || !email || !companyName)
      throw new ValidationError('workspaceName, email e companyName são obrigatórios');
    const ws = this.r.workspace.insert({ name: workspaceName });
    const user = this.r.user.insert({ workspace_id: ws.id, name: userName || email, email });
    const company = this.r.company.insert({ workspace_id: ws.id, name: companyName });
    const connections = marketplaces.map(m =>
      this.r.connection.insert({ company_id: company.id, marketplace: m, status: 'simulated' }));
    this.r.audit.record('workspace-service', 'bootstrap', { companyId: company.id, entity: 'company', entityId: company.id });
    this.bus.emit('workspace.created', { workspaceId: ws.id, companyId: company.id });
    return { workspace: ws, user, company, connections };
  }
}

class CatalogService {
  constructor({ repos, bus, logger }) { this.r = repos; this.bus = bus; this.log = logger; }

  createProduct(companyId, data) {
    if (!data.name) throw new ValidationError('produto precisa de nome');
    const product = this.r.product.insert({ company_id: companyId, ...data });
    this.bus.emit('product.created', { productId: product.id, companyId });
    return product;
  }

  /* importação em massa — preparado para milhares de anúncios (Bloco 02):
     uma transação, keyset pagination na leitura, evento agregado no fim */
  importListings(companyId, connectionId, items) {
    const t0 = Date.now();
    const created = this.r.listing.db.tx(() => items.map(item => {
      const product = item.productId
        ? this.r.product.byId(item.productId)
        : this.r.product.insert({ company_id: companyId, name: item.title, sku: item.sku || null });
      const listing = this.r.listing.insert({
        product_id: product.id, connection_id: connectionId,
        external_id: item.externalId || null, title: item.title,
        price: item.price, status: item.status || 'active',
        health_score: item.healthScore ?? null, ranking: item.ranking ?? null,
      });
      const version = this.r.version.insert({
        listing_id: listing.id, number: 1, title: item.title,
        price: item.price, author: 'user', reason: 'importação inicial',
        images_json: item.images || [],
      });
      this.r.listing.update(listing.id, { active_version_id: version.id });
      return listing.id;
    }));
    this.r.audit.record('catalog-service', 'import_listings',
      { companyId, detail: { count: created.length, ms: Date.now() - t0 } });
    this.bus.emit('listings.imported', { companyId, count: created.length });
    return { count: created.length, ids: created };
  }

  /* nova versão SEMPRE reversível (regulamento das Versões, docs/02) */
  createVersion(listingId, { title, description, price, images, author = 'head', reason }) {
    const listing = this.r.listing.byId(listingId);
    const version = this.r.version.insert({
      listing_id: listingId,
      number: this.r.version.nextNumber(listingId),
      title: title ?? listing.title,
      description: description ?? null,
      price: price ?? listing.price,
      images_json: images || [],
      author, reason: reason || null,
    });
    this.r.listing.update(listingId, {
      active_version_id: version.id,
      title: version.title, price: version.price,
      updated_at: new Date().toISOString(),
    });
    this.bus.emit('listing.version_created', { listingId, versionId: version.id, number: version.number });
    return version;
  }

  restoreVersion(listingId, versionId, { reason = null } = {}) {
    const v = this.r.version.byId(versionId);
    if (v.listing_id !== listingId) throw new ValidationError('versão não pertence ao anúncio');
    const restored = this.createVersion(listingId, {
      title: v.title, description: v.description, price: v.price,
      images: JSON.parse(v.images_json || '[]'),
      author: 'head', reason: reason || `restauração da v${v.number}`,
    });
    this.bus.emit('listing.version_restored', { listingId, from: versionId, to: restored.id });
    return restored;
  }

  listListings(companyId, opts) { return this.r.listing.byCompany(companyId, opts); }
}

class DecisionService {
  constructor({ repos, bus, logger }) { this.r = repos; this.bus = bus; this.log = logger; }

  create(companyId, d) {
    if (!d.title || !d.discovery || !d.proposal)
      throw new ValidationError('decisão exige title, discovery e proposal (o pacote completo, Art. 19)');
    const decision = this.r.decision.insert({
      company_id: companyId, investigation_id: d.investigationId || null,
      product_id: d.productId || null, title: d.title, discovery: d.discovery,
      probable_cause: d.probableCause || null, proposal_json: d.proposal,
      impact_min: d.impactMin ?? null, impact_max: d.impactMax ?? null,
      confidence: d.confidence || 'média', reversibility: d.reversibility || 'alta',
      class: d.class || 'C',
    });
    this.bus.emit('decision.created', { decisionId: decision.id, companyId });
    return decision;
  }

  /* Fluxo 007: nenhuma resposta do dono morre sem consequência */
  approve(decisionId) {
    const d = this.r.decision.byId(decisionId);
    if (d.status !== 'pending') throw new ValidationError('decisão já resolvida');
    const proposal = JSON.parse(d.proposal_json);
    const now = new Date().toISOString();
    return this.r.decision.db.tx(() => {
      this.r.decision.update(decisionId, { status: 'approved', resolved_at: now });
      const mission = this.r.mission.insert({
        company_id: d.company_id, product_id: d.product_id, decision_id: d.id,
        kind: 'executando', title: d.title, status: 'active',
        origin: 'decisão aprovada pelo dono',
        log_json: [{ at: now, note: 'missão criada a partir da aprovação' }],
      });
      const plan = this.r.plan.insert({
        decision_id: d.id, company_id: d.company_id, product_id: d.product_id,
        title: d.title, type: proposal.type || 'generic',
        steps_json: proposal.steps || [],
        prediction_json: { impact: [d.impact_min, d.impact_max], registeredAt: now }, // Art. 15
        status: 'executing',
      });
      this.r.audit.record('decision-service', 'approve',
        { companyId: d.company_id, entity: 'decision', entityId: d.id });
      this.bus.emit('decision.approved', { decisionId: d.id, missionId: mission.id, planId: plan.id });
      return { decision: this.r.decision.byId(decisionId), mission, plan };
    });
  }

  refuse(decisionId, motive) {
    const d = this.r.decision.byId(decisionId);
    if (d.status !== 'pending') throw new ValidationError('decisão já resolvida');
    const proposal = JSON.parse(d.proposal_json);
    this.r.decision.update(decisionId, {
      status: 'refused', refusal_motive: motive || 'não informado',
      resolved_at: new Date().toISOString(),
    });
    /* Art. 18: a recusa vira memória da empresa */
    this.r.memory.upsert(d.company_id, {
      key: `pref.${proposal.type}.${motive || 'nao_informado'}`,
      kind: 'preference',
      discovery: `O dono recusa propostas de "${proposal.type}" por: ${motive || 'não informado'}.`,
      context_json: { decisionId },
      evidence_json: [{ decisionId, motive }],
    });
    this.r.audit.record('decision-service', 'refuse',
      { companyId: d.company_id, entity: 'decision', entityId: d.id, detail: { motive } });
    this.bus.emit('decision.refused', { decisionId, motive });
    return this.r.decision.byId(decisionId);
  }

  pending(companyId) { return this.r.decision.pending(companyId); }
}

function createServices(deps) {
  return {
    workspace: new WorkspaceService(deps),
    catalog: new CatalogService(deps),
    decision: new DecisionService(deps),
  };
}

module.exports = { createServices, WorkspaceService, CatalogService, DecisionService };

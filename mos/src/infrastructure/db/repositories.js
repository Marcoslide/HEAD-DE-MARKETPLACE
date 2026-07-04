/* Infra · Repositórios — a única porta entre a aplicação e o SQL.
   BaseRepository cobre CRUD + paginação keyset (estável com milhares de
   linhas); repositórios específicos adicionam consultas de domínio.
   A aplicação depende da INTERFACE (ports.js), não desta implementação. */
'use strict';
const { newId } = require('../../kernel/id.js');
const { NotFoundError } = require('../../kernel/errors.js');

class BaseRepository {
  constructor(db, table, prefix, columns) {
    this.db = db; this.table = table; this.prefix = prefix;
    this.columns = columns; // colunas graváveis (sem id/created_at)
  }
  insert(data) {
    const id = data.id || newId(this.prefix);
    const cols = ['id', ...this.columns.filter(c => data[c] !== undefined)];
    const vals = cols.map(c => c === 'id' ? id : serialize(data[c]));
    this.db.run(
      `INSERT INTO ${this.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      ...vals);
    return this.byId(id);
  }
  insertMany(rows) {
    return this.db.tx(() => rows.map(r => this.insert(r)));
  }
  byId(id) {
    const row = this.db.get(`SELECT * FROM ${this.table} WHERE id = ?`, id);
    if (!row) throw new NotFoundError(this.table, id);
    return row;
  }
  maybeById(id) {
    return this.db.get(`SELECT * FROM ${this.table} WHERE id = ?`, id) || null;
  }
  update(id, patch) {
    const cols = this.columns.filter(c => patch[c] !== undefined);
    if (!cols.length) return this.byId(id);
    this.db.run(
      `UPDATE ${this.table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      ...cols.map(c => serialize(patch[c])), id);
    return this.byId(id);
  }
  delete(id) { this.db.run(`DELETE FROM ${this.table} WHERE id = ?`, id); }
  count(where = '', ...params) {
    return this.db.get(`SELECT count(*) AS n FROM ${this.table} ${where}`, ...params).n;
  }
  /* paginação keyset: estável e O(página), não O(offset) */
  page({ after = '', limit = 50, where = '', params = [] } = {}) {
    const cond = where ? `${where} AND id > ?` : 'WHERE id > ?';
    const items = this.db.all(
      `SELECT * FROM ${this.table} ${cond} ORDER BY id LIMIT ?`,
      ...params, after, Math.min(limit, 200));
    return { items, nextCursor: items.length ? items[items.length - 1].id : null };
  }
}

function serialize(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

/* ---------- repositórios específicos ---------- */

class ListingRepository extends BaseRepository {
  constructor(db) {
    super(db, 'listing', 'lst',
      ['product_id', 'connection_id', 'external_id', 'title', 'price', 'status',
       'health_score', 'ranking', 'active_version_id', 'updated_at']);
  }
  byProduct(productId) {
    return this.db.all('SELECT * FROM listing WHERE product_id = ? ORDER BY id', productId);
  }
  byCompany(companyId, { status = null, after = '', limit = 50 } = {}) {
    const base = `SELECT l.* FROM listing l
      JOIN product p ON p.id = l.product_id
      WHERE p.company_id = ? ${status ? 'AND l.status = ?' : ''} AND l.id > ?
      ORDER BY l.id LIMIT ?`;
    const params = status ? [companyId, status, after, limit] : [companyId, after, limit];
    const items = this.db.all(base, ...params);
    return { items, nextCursor: items.length ? items[items.length - 1].id : null };
  }
  needsAttention(companyId, limit = 20) {
    return this.db.all(`SELECT l.* FROM listing l
      JOIN product p ON p.id = l.product_id
      WHERE p.company_id = ? AND l.status = 'active'
      ORDER BY COALESCE(l.health_score, 100) ASC LIMIT ?`, companyId, limit);
  }
}

class ListingVersionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'listing_version', 'ver',
      ['listing_id', 'number', 'title', 'description', 'images_json', 'price',
       'author', 'reason', 'result_json']);
  }
  nextNumber(listingId) {
    return (this.db.get('SELECT COALESCE(MAX(number),0) AS n FROM listing_version WHERE listing_id = ?', listingId).n) + 1;
  }
  byListing(listingId) {
    return this.db.all('SELECT * FROM listing_version WHERE listing_id = ? ORDER BY number DESC', listingId);
  }
}

class DecisionRepository extends BaseRepository {
  constructor(db) {
    super(db, 'decision', 'dec',
      ['company_id', 'investigation_id', 'product_id', 'title', 'discovery',
       'probable_cause', 'proposal_json', 'impact_min', 'impact_max',
       'confidence', 'reversibility', 'class', 'status', 'refusal_motive', 'resolved_at']);
  }
  pending(companyId) {
    return this.db.all(`SELECT * FROM decision WHERE company_id = ? AND status = 'pending' ORDER BY id`, companyId);
  }
}

class MemoryRepository extends BaseRepository {
  constructor(db) {
    super(db, 'memory', 'mem',
      ['company_id', 'key', 'kind', 'discovery', 'context_json', 'evidence_json',
       'strength', 'needs_revalidation', 'updated_at']);
  }
  upsert(companyId, entry) {
    const existing = this.db.get('SELECT * FROM memory WHERE company_id = ? AND key = ?', companyId, entry.key);
    if (!existing) return this.insert({ ...entry, company_id: companyId });
    const strength = entry.contradicts
      ? Math.max(1, existing.strength - 1)
      : Math.min(3, existing.strength + 1);
    return this.update(existing.id, {
      strength, needs_revalidation: entry.contradicts ? 1 : 0,
      updated_at: new Date().toISOString(),
    });
  }
  byKind(companyId, kind, minStrength = 1) {
    return this.db.all('SELECT * FROM memory WHERE company_id = ? AND kind = ? AND strength >= ? ORDER BY strength DESC',
      companyId, kind, minStrength);
  }
}

class AuditRepository {
  constructor(db) { this.db = db; }
  record(actor, action, { companyId = null, entity = null, entityId = null, detail = {} } = {}) {
    this.db.run(
      'INSERT INTO audit_log (company_id, actor, action, entity, entity_id, detail_json) VALUES (?,?,?,?,?,?)',
      companyId, actor, action, entity, entityId, JSON.stringify(detail));
  }
  tail(n = 50) { return this.db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', n); }
  byEntity(entity, entityId) {
    return this.db.all('SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id', entity, entityId);
  }
}

/* ---------- Central de Marketplace (Sprint 09) ---------- */

class SyncStateRepository extends BaseRepository {
  constructor(db) {
    super(db, 'marketplace_sync_state', 'mss',
      ['company_id', 'connection_id', 'platform', 'account_id', 'store_id', 'resource',
       'watermark', 'last_attempt_at', 'last_success_at', 'status',
       'records_read', 'records_created', 'records_updated', 'records_ignored', 'error']);
  }
  byConnectionResource(connectionId, resource) {
    return this.db.get('SELECT * FROM marketplace_sync_state WHERE connection_id = ? AND resource = ?',
      connectionId, resource) || null;
  }
  byCompany(companyId) {
    return this.db.all('SELECT * FROM marketplace_sync_state WHERE company_id = ? ORDER BY platform, resource', companyId);
  }
}

class MarketplaceOrderRepository extends BaseRepository {
  constructor(db) {
    super(db, 'marketplace_order', 'mor',
      ['company_id', 'connection_id', 'platform', 'account_id', 'store_id', 'external_id',
       'status', 'total', 'currency', 'buyer_ref', 'is_custom', 'deadline_at',
       'occurred_at', 'observed_at', 'synchronized_at', 'raw_reference']);
  }
  byExternal(connectionId, externalId) {
    return this.db.get('SELECT * FROM marketplace_order WHERE connection_id = ? AND external_id = ?',
      connectionId, externalId) || null;
  }
  /* isolamento por empresa: TODA leitura de pedidos parte do company_id */
  ofCompany(companyId, { platform = null } = {}) {
    return platform
      ? this.db.all('SELECT * FROM marketplace_order WHERE company_id = ? AND platform = ? ORDER BY occurred_at', companyId, platform)
      : this.db.all('SELECT * FROM marketplace_order WHERE company_id = ? ORDER BY occurred_at', companyId);
  }
}

class IntegrationEventRepository extends BaseRepository {
  constructor(db) {
    super(db, 'integration_event', 'iev',
      ['company_id', 'platform', 'account_id', 'store_id', 'event_type', 'entity_type',
       'entity_id', 'occurred_at', 'observed_at', 'synchronized_at', 'severity',
       'confidence', 'payload_json', 'raw_reference', 'metadata_json']);
  }
  /* idempotência: o id É a chave — duplicado não insere e retorna false */
  insertIdempotent(evt) {
    const r = this.db.run(
      `INSERT OR IGNORE INTO integration_event
       (id, company_id, platform, account_id, store_id, event_type, entity_type, entity_id,
        occurred_at, observed_at, synchronized_at, severity, confidence, payload_json, raw_reference, metadata_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      evt.id, evt.company_id, evt.platform, evt.account_id ?? null, evt.store_id ?? null,
      evt.event_type, evt.entity_type, evt.entity_id ?? null,
      evt.occurred_at ?? null, evt.observed_at ?? null, evt.synchronized_at ?? null,
      evt.severity ?? 'INFO', evt.confidence ?? 1,
      JSON.stringify(evt.payload ?? {}), evt.raw_reference ?? null, JSON.stringify(evt.metadata ?? {}));
    return r.changes > 0;
  }
  ofCompany(companyId) {
    return this.db.all('SELECT * FROM integration_event WHERE company_id = ? ORDER BY synchronized_at', companyId);
  }
}

/* fábrica: todos os repositórios sobre uma conexão */
function createRepositories(db) {
  return {
    workspace: new BaseRepository(db, 'workspace', 'ws', ['name']),
    user: new BaseRepository(db, 'user', 'usr', ['workspace_id', 'name', 'email', 'role']),
    company: new BaseRepository(db, 'company', 'cmp', ['workspace_id', 'name', 'objectives_json']),
    connection: new BaseRepository(db, 'marketplace_connection', 'mkc',
      ['company_id', 'marketplace', 'status', 'settings_json',
       'account_id', 'store_id', 'auth_type', 'read_only', 'connected_at', 'revoked_at']),
    product: new BaseRepository(db, 'product', 'prd', ['company_id', 'name', 'sku', 'cost', 'attributes_json']),
    listing: new ListingRepository(db),
    version: new ListingVersionRepository(db),
    investigation: new BaseRepository(db, 'investigation', 'inv',
      ['company_id', 'product_id', 'anomaly_kind', 'playbook', 'status', 'steps_json', 'diagnosis_json', 'confidence']),
    decision: new DecisionRepository(db),
    mission: new BaseRepository(db, 'mission', 'mis',
      ['company_id', 'product_id', 'decision_id', 'kind', 'title', 'status', 'origin', 'log_json', 'result', 'closed_at']),
    opportunity: new BaseRepository(db, 'opportunity', 'opp',
      ['company_id', 'product_id', 'radar', 'description', 'impact_monthly', 'window_expires', 'status']),
    competitor: new BaseRepository(db, 'competitor', 'cpt', ['product_id', 'name', 'external_ref', 'weakness']),
    competitorSnapshot: new BaseRepository(db, 'competitor_snapshot', 'cps',
      ['competitor_id', 'day', 'price', 'rating', 'ranking', 'creative', 'data_json']),
    review: new BaseRepository(db, 'review', 'rev', ['listing_id', 'stars', 'text', 'answered', 'answer']),
    question: new BaseRepository(db, 'question', 'qst', ['listing_id', 'text', 'answered', 'answer']),
    keyword: new BaseRepository(db, 'keyword', 'kw', ['company_id', 'product_id', 'term', 'status', 'effect_json']),
    keywordTrend: new BaseRepository(db, 'keyword_trend', 'kwt', ['keyword_id', 'day', 'volume_index', 'source']),
    experiment: new BaseRepository(db, 'experiment', 'exp',
      ['listing_id', 'hypothesis', 'variable', 'baseline_version_id', 'variant_version_id',
       'metric', 'success_criteria_json', 'window_days', 'status', 'result_json', 'concluded_at']),
    memory: new MemoryRepository(db),
    learning: new BaseRepository(db, 'learning', 'lrn',
      ['company_id', 'plan_id', 'strategy_type', 'predicted_json', 'actual', 'hit', 'autopsy']),
    plan: new BaseRepository(db, 'execution_plan', 'pln',
      ['decision_id', 'company_id', 'product_id', 'title', 'type', 'steps_json', 'prediction_json', 'result_json', 'status']),
    publication: new BaseRepository(db, 'publication_history', 'pub',
      ['listing_id', 'version_id', 'action', 'simulated', 'payload_json', 'outcome']),
    audit: new AuditRepository(db),
    /* Central de Marketplace (Sprint 09) */
    credential: new BaseRepository(db, 'marketplace_credential', 'crd',
      ['connection_id', 'access_token_enc', 'refresh_token_enc', 'token_type',
       'scope', 'expires_at', 'rotated_at', 'created_at', 'updated_at']),
    syncState: new SyncStateRepository(db),
    syncLog: new BaseRepository(db, 'marketplace_sync_log', 'msl',
      ['company_id', 'connection_id', 'platform', 'resource', 'status', 'started_at',
       'finished_at', 'records_read', 'records_created', 'records_updated', 'records_ignored', 'error']),
    rawPayload: new BaseRepository(db, 'raw_marketplace_payload', 'raw',
      ['company_id', 'connection_id', 'platform', 'resource', 'external_id', 'payload_json', 'fetched_at']),
    morder: new MarketplaceOrderRepository(db),
    morderItem: new BaseRepository(db, 'marketplace_order_item', 'moi',
      ['order_id', 'external_listing_id', 'sku', 'title', 'quantity', 'unit_price']),
    minventory: new BaseRepository(db, 'marketplace_inventory', 'min',
      ['company_id', 'connection_id', 'platform', 'external_listing_id', 'sku', 'available',
       'reserved', 'occurred_at', 'observed_at', 'synchronized_at', 'raw_reference']),
    mprice: new BaseRepository(db, 'marketplace_price', 'mpr',
      ['company_id', 'connection_id', 'platform', 'external_listing_id', 'price', 'original_price',
       'currency', 'margin_pct', 'occurred_at', 'observed_at', 'synchronized_at', 'raw_reference']),
    mmetric: new BaseRepository(db, 'marketplace_metric_snapshot', 'mms',
      ['company_id', 'connection_id', 'platform', 'external_listing_id', 'metric', 'value',
       'period', 'occurred_at', 'observed_at', 'synchronized_at', 'raw_reference']),
    integrationEvent: new IntegrationEventRepository(db),
    publicResearch: new BaseRepository(db, 'public_research_evidence', 'pre',
      ['company_id', 'source_type', 'source_url', 'platform', 'subject', 'findings_json',
       'confidence', 'observed_at']),
    /* Catalog & Compliance (Sprint 10) */
    productProfile: new BaseRepository(db, 'product_profile', 'ppf',
      ['product_id', 'company_id', 'brand', 'product_type', 'condition', 'description',
       'tech_sheet_json', 'weight_g', 'packed_weight_g', 'height_cm', 'width_cm', 'depth_cm',
       'packed_dims_json', 'fragile', 'special_packaging', 'production_days',
       'personalization_days', 'made_to_order', 'personalization_json', 'daily_capacity',
       'base_price', 'cost', 'min_margin_pct', 'ean', 'origin', 'warranty', 'fiscal_json',
       'return_policy', 'notes', 'updated_at']),
    productAsset: new BaseRepository(db, 'product_asset', 'ast',
      ['product_id', 'company_id', 'kind', 'role', 'url', 'width', 'height', 'format',
       'size_kb', 'has_watermark', 'has_text_overlay', 'position', 'created_at']),
    marketplaceProfile: new BaseRepository(db, 'marketplace_product_profile', 'mpp',
      ['product_id', 'company_id', 'platform', 'title', 'category_id', 'category_status',
       'attributes_json', 'price', 'stock', 'shipping_json', 'content_json', 'updated_at']),
    listingDraft: new BaseRepository(db, 'listing_draft', 'drf',
      ['product_id', 'company_id', 'platform', 'version', 'status', 'payload_json',
       'findings_json', 'checklist_json', 'suggestions_source', 'human_review',
       'validation_run_id', 'created_at', 'updated_at']),
    /* Conexões reais e piloto (Sprint 10.A) */
    oauthState: new BaseRepository(db, 'oauth_state', 'ost',
      ['company_id', 'user_id', 'platform', 'connection_id', 'created_at', 'expires_at', 'used_at']),
    featureFlag: new BaseRepository(db, 'feature_flag', 'ffl',
      ['flag', 'company_id', 'account_id', 'user_id', 'enabled', 'updated_at']),
    waConnection: new BaseRepository(db, 'whatsapp_connection', 'wac',
      ['company_id', 'phone_number_id', 'waba_id', 'display_number', 'status',
       'webhook_verified_at', 'last_inbound_at', 'error', 'created_at', 'updated_at']),
    waEvent: new BaseRepository(db, 'whatsapp_event', 'wev',
      ['company_id', 'connection_id', 'from_number', 'kind', 'text', 'occurred_at',
       'observed_at', 'replied', 'reply_text', 'payload_reference', 'created_at']),
    categorySnapshot: new BaseRepository(db, 'category_snapshot', 'cst',
      ['company_id', 'connection_id', 'platform', 'category_id', 'category_path',
       'attributes_json', 'restrictions_json', 'source', 'source_url', 'api_version',
       'fetched_at', 'created_at']),
    truthPack: new BaseRepository(db, 'product_truth_pack', 'ptp',
      ['product_id', 'company_id', 'version', 'pack_json', 'assets_hash', 'profile_hash', 'created_at']),
    creativeAsset: new BaseRepository(db, 'creative_asset', 'cra',
      ['product_id', 'company_id', 'platform', 'creative_type', 'truth_pack_id',
       'source_asset_ids', 'briefing_json', 'status', 'provider', 'model', 'generation_job',
       'image_url', 'fidelity_json', 'human_review', 'draft_id', 'created_at', 'updated_at']),
    pilotRun: new BaseRepository(db, 'pilot_run', 'plt',
      ['idempotency_key', 'company_id', 'user_id', 'connection_id', 'marketplace_account_id',
       'listing_draft_id', 'product_id', 'creative_asset_ids', 'truth_pack_id',
       'category_snapshot_id', 'payload_json', 'payload_hash', 'stage', 'confirmation_at',
       'request_at', 'response_at', 'external_listing_id', 'response_json', 'error',
       'rollback_note', 'created_at', 'updated_at']),
    /* Crescimento (Sprint 10.B) */
    userRole: new BaseRepository(db, 'user_role', 'url',
      ['user_id', 'company_id', 'role', 'granted_by', 'created_at']),
    approval: new BaseRepository(db, 'approval_request', 'apr',
      ['company_id', 'kind', 'entity', 'entity_id', 'requested_by', 'status',
       'decided_by', 'decided_at', 'motive', 'detail_json', 'created_at']),
    job: new BaseRepository(db, 'internal_job', 'job',
      ['company_id', 'kind', 'origin', 'status', 'total', 'processed', 'succeeded',
       'blocked', 'failed', 'reasons_json', 'params_json', 'summary_json', 'report_json',
       'rollback_json', 'requires_confirmation', 'confirmed_at', 'requested_by',
       'requester_ref', 'approval_id', 'finished_at', 'created_at', 'updated_at']),
    dataConflict: new BaseRepository(db, 'data_conflict', 'cfl',
      ['company_id', 'entity', 'entity_id', 'field', 'manual_value', 'sync_value',
       'manual_source', 'sync_source', 'status', 'resolution', 'resolved_by',
       'created_at', 'resolved_at']),
    feeProfile: new BaseRepository(db, 'marketplace_fee_profile', 'fee',
      ['company_id', 'marketplace', 'commission_pct', 'fixed_fee', 'shipping_subsidy',
       'tax_pct', 'ads_pct_default', 'source', 'verified_at', 'created_at', 'updated_at']),
    leadSource: new BaseRepository(db, 'lead_source', 'lsr',
      ['company_id', 'kind', 'label', 'created_at']),
    lead: new BaseRepository(db, 'lead', 'led',
      ['company_id', 'name', 'phone', 'email', 'origin', 'source_id', 'status',
       'owner_user_id', 'estimated_value', 'product_id', 'marketplace', 'affiliate_id',
       'campaign_id', 'tags_json', 'priority', 'data_source', 'notes', 'dedup_key',
       'entered_at', 'last_interaction_at', 'next_follow_up_at', 'created_at', 'updated_at']),
    leadInteraction: new BaseRepository(db, 'lead_interaction', 'lin',
      ['lead_id', 'company_id', 'kind', 'note', 'by_user', 'occurred_at', 'created_at']),
    conversation: new BaseRepository(db, 'conversation', 'cnv',
      ['company_id', 'lead_id', 'channel', 'status', 'started_at', 'last_message_at', 'created_at']),
    leadOpportunity: new BaseRepository(db, 'lead_opportunity', 'lop',
      ['company_id', 'lead_id', 'title', 'value', 'stage', 'product_id', 'created_at', 'updated_at']),
    leadAssignment: new BaseRepository(db, 'lead_assignment', 'las',
      ['lead_id', 'company_id', 'user_id', 'assigned_by', 'assigned_at', 'created_at']),
    leadFollowUp: new BaseRepository(db, 'lead_follow_up', 'lfu',
      ['lead_id', 'company_id', 'due_at', 'note', 'done_at', 'created_by', 'created_at']),
    leadStatusHistory: new BaseRepository(db, 'lead_status_history', 'lsh',
      ['lead_id', 'company_id', 'from_status', 'to_status', 'reason', 'by_user', 'at', 'created_at']),
    customerLink: new BaseRepository(db, 'customer_link', 'cul',
      ['company_id', 'lead_id', 'customer_ref', 'marketplace', 'linked_at', 'created_at']),
    affiliate: new BaseRepository(db, 'affiliate_partner', 'afp',
      ['company_id', 'name', 'contact', 'channel', 'commission_pct', 'status', 'notes',
       'created_at', 'updated_at']),
    affiliateCode: new BaseRepository(db, 'affiliate_code', 'afc',
      ['company_id', 'affiliate_id', 'code', 'created_at']),
    affiliateLink: new BaseRepository(db, 'affiliate_link', 'afl',
      ['company_id', 'affiliate_id', 'url', 'campaign_id', 'product_id', 'marketplace', 'created_at']),
    affiliateCampaign: new BaseRepository(db, 'affiliate_campaign', 'afg',
      ['company_id', 'affiliate_id', 'campaign_id', 'name', 'starts_at', 'ends_at', 'created_at']),
    attributionEvent: new BaseRepository(db, 'affiliate_attribution_event', 'ate',
      ['company_id', 'affiliate_id', 'kind', 'order_ref', 'product_id', 'marketplace',
       'rule', 'window_days', 'confidence', 'source', 'occurred_at', 'created_at']),
    affiliateConversion: new BaseRepository(db, 'affiliate_conversion', 'acv',
      ['company_id', 'affiliate_id', 'order_ref', 'amount', 'marketplace', 'product_id',
       'status', 'confidence', 'source', 'occurred_at', 'created_at']),
    affiliateCommission: new BaseRepository(db, 'affiliate_commission', 'acm',
      ['company_id', 'affiliate_id', 'conversion_id', 'amount', 'status',
       'payout_batch_id', 'source', 'created_at', 'updated_at']),
    payoutBatch: new BaseRepository(db, 'affiliate_payout_batch', 'apb',
      ['company_id', 'period', 'total', 'status', 'approval_id', 'created_at', 'updated_at']),
    promotion: new BaseRepository(db, 'promotion', 'pmo',
      ['company_id', 'name', 'objective', 'marketplace', 'discount_type', 'discount_value',
       'starts_at', 'ends_at', 'status', 'review_reason', 'campaign_id', 'affiliate_id',
       'origin', 'created_by', 'approval_id', 'created_at', 'updated_at']),
    promotionTarget: new BaseRepository(db, 'promotion_target', 'pmt',
      ['promotion_id', 'company_id', 'product_id', 'listing_id', 'marketplace', 'created_at']),
    promotionProfile: new BaseRepository(db, 'promotion_marketplace_profile', 'pmp',
      ['promotion_id', 'marketplace', 'params_json', 'created_at']),
    promotionEligibility: new BaseRepository(db, 'promotion_eligibility', 'pme',
      ['promotion_id', 'product_id', 'eligible', 'reasons_json', 'created_at']),
    promotionSimulation: new BaseRepository(db, 'promotion_margin_simulation', 'pms',
      ['promotion_id', 'product_id', 'marketplace', 'breakdown_json', 'margin_pct',
       'min_price', 'stock_risk', 'computable', 'reason', 'created_at']),
    promotionCap: new BaseRepository(db, 'promotion_inventory_cap', 'pmc',
      ['promotion_id', 'product_id', 'cap_units', 'committed', 'created_at']),
    campaign: new BaseRepository(db, 'campaign', 'cpg',
      ['company_id', 'name', 'kind', 'objective', 'starts_at', 'ends_at', 'status',
       'origin', 'created_by', 'created_at', 'updated_at']),
    campaignTarget: new BaseRepository(db, 'campaign_target', 'cgt',
      ['campaign_id', 'company_id', 'kind', 'target_id', 'created_at']),
    campaignSnapshot: new BaseRepository(db, 'campaign_performance_snapshot', 'cpn',
      ['campaign_id', 'company_id', 'period', 'metrics_json', 'source', 'captured_at', 'created_at']),
    /* Criação pela conversa + Data Completion (complementos 10.B) */
    productIntake: new BaseRepository(db, 'product_intake', 'pin',
      ['company_id', 'status', 'provisional_name', 'sku', 'data_json', 'marketplaces_json',
       'origin', 'message_id', 'link_id', 'product_id', 'duplicate_of', 'responsible',
       'notes', 'created_by', 'created_at', 'updated_at']),
    intakeAsset: new BaseRepository(db, 'intake_asset', 'ina',
      ['company_id', 'intake_id', 'product_id', 'kind', 'asset_type', 'url', 'hash',
       'origin', 'uploaded_by', 'message_id', 'review_status', 'allowed_use', 'created_at']),
    sourceReference: new BaseRepository(db, 'source_reference', 'src',
      ['company_id', 'url', 'domain', 'link_kind', 'purpose', 'intake_id', 'product_id',
       'content_copied', 'insights_json', 'registered_by', 'origin', 'created_at']),
    dataRequest: new BaseRepository(db, 'data_request', 'drq',
      ['company_id', 'product_id', 'variation_id', 'listing_draft_id', 'marketplace',
       'field', 'label', 'motive', 'criticality', 'rule_source', 'rule_pack', 'status',
       'responsible_role', 'responsible_user', 'responsible_ref', 'unassigned', 'channel',
       'question_text', 'expected_format', 'answer_raw', 'answer_normalized',
       'previous_value', 'confidence', 'source', 'answered_by', 'audit_json',
       'created_at', 'asked_at', 'answered_at', 'resolved_at']),
    validationRun: new BaseRepository(db, 'validation_run', 'vrn',
      ['company_id', 'product_id', 'listing_id', 'draft_id', 'platform', 'category_id',
       'rule_pack_version', 'data_source', 'executed_at', 'executed_by', 'status',
       'findings_json', 'evidence_json', 'payload_reference', 'created_at']),
  };
}

module.exports = { createRepositories, BaseRepository };

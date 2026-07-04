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

/* fábrica: todos os repositórios sobre uma conexão */
function createRepositories(db) {
  return {
    workspace: new BaseRepository(db, 'workspace', 'ws', ['name']),
    user: new BaseRepository(db, 'user', 'usr', ['workspace_id', 'name', 'email', 'role']),
    company: new BaseRepository(db, 'company', 'cmp', ['workspace_id', 'name', 'objectives_json']),
    connection: new BaseRepository(db, 'marketplace_connection', 'mkc', ['company_id', 'marketplace', 'status', 'settings_json']),
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
  };
}

module.exports = { createRepositories, BaseRepository };

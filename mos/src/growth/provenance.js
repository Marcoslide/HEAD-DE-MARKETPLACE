/* PROVENIÊNCIA DE CAMPO (Sprint 10.B) — conflito manual × sincronização.

   Prioridade de dados: o Product Master é a verdade central; toda
   informação registra a fonte (MANUAL, IA, IMPORTACAO, MARKETPLACE_SYNC,
   WHATSAPP_COMMAND, SISTEMA). A sincronização externa NUNCA apaga uma
   edição manual silenciosamente: divergência vira data_conflict com
   histórico e pede revisão — o valor manual permanece até decisão. */
'use strict';

const FIELD_SOURCES = ['MANUAL', 'IA', 'IMPORTACAO', 'MARKETPLACE_SYNC',
                       'WHATSAPP_COMMAND', 'SISTEMA'];
/* fontes que uma sync automática NÃO pode sobrescrever em silêncio */
const PROTECTED_SOURCES = ['MANUAL', 'WHATSAPP_COMMAND'];

class ProvenanceService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  _profile(productId) {
    const row = this.r.productProfile.db.get(
      'SELECT * FROM product_profile WHERE product_id = ?', productId);
    if (!row) throw new Error(`produto ${productId} sem ficha`);
    return row;
  }

  sourcesOf(productId) {
    return JSON.parse(this._profile(productId).field_sources_json || '{}');
  }

  /* aplica campos na ficha com fonte declarada; sync × manual → conflito */
  setFields(productId, fields, source, { byUser = null } = {}) {
    if (!FIELD_SOURCES.includes(source))
      throw new Error(`fonte de campo inválida: ${source} — use ${FIELD_SOURCES.join(', ')}`);
    const profile = this._profile(productId);
    const sources = JSON.parse(profile.field_sources_json || '{}');
    const applied = [], conflicts = [];

    for (const [field, value] of Object.entries(fields)) {
      const current = profile[field];
      const currentSource = sources[field] || null;
      const changed = String(current ?? '') !== String(value ?? '');
      if (source === 'MARKETPLACE_SYNC' && PROTECTED_SOURCES.includes(currentSource) && changed) {
        /* NÃO sobrescreve: registra conflito para revisão humana */
        const c = this.r.dataConflict.insert({
          company_id: profile.company_id, entity: 'product_profile',
          entity_id: productId, field,
          manual_value: String(current ?? ''), sync_value: String(value ?? ''),
          manual_source: currentSource, sync_source: source,
          status: 'REVIEW_REQUIRED', created_at: this.clock.nowIso() });
        conflicts.push({ field, conflictId: c.id });
        continue;
      }
      this.r.productProfile.db.run(
        `UPDATE product_profile SET ${field} = ?, updated_at = ? WHERE product_id = ?`,
        typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
        this.clock.nowIso(), productId);
      sources[field] = source;
      applied.push(field);
    }

    this.r.productProfile.db.run(
      'UPDATE product_profile SET field_sources_json = ? WHERE product_id = ?',
      JSON.stringify(sources), productId);
    this.r.audit.record('provenance', 'fields_set', {
      companyId: profile.company_id, entity: 'product_profile', entityId: productId,
      detail: { source, applied, conflicts: conflicts.length, byUser } });
    return { applied, conflicts, sources };
  }

  /* resolução humana do conflito: escolher MANUAL ou SYNC */
  resolve(conflictId, { choose, userId = null }) {
    const c = this.r.dataConflict.byId(conflictId);
    if (c.status !== 'REVIEW_REQUIRED') throw new Error('conflito já resolvido');
    if (choose === 'SYNC') {
      this.r.productProfile.db.run(
        `UPDATE product_profile SET ${c.field} = ?, updated_at = ? WHERE product_id = ?`,
        c.sync_value, this.clock.nowIso(), c.entity_id);
      const profile = this._profile(c.entity_id);
      const sources = JSON.parse(profile.field_sources_json || '{}');
      sources[c.field] = c.sync_source;
      this.r.productProfile.db.run(
        'UPDATE product_profile SET field_sources_json = ? WHERE product_id = ?',
        JSON.stringify(sources), c.entity_id);
    }
    const updated = this.r.dataConflict.update(conflictId, {
      status: 'RESOLVED', resolution: choose, resolved_by: userId,
      resolved_at: this.clock.nowIso() });
    this.r.audit.record('provenance', 'conflict_resolved', {
      companyId: c.company_id, entity: 'data_conflict', entityId: conflictId,
      detail: { field: c.field, choose, by: userId } });
    return updated;
  }

  openConflicts(companyId) {
    return this.r.dataConflict.db.all(
      `SELECT * FROM data_conflict WHERE company_id = ? AND status = 'REVIEW_REQUIRED'`,
      companyId);
  }
}

module.exports = { ProvenanceService, FIELD_SOURCES, PROTECTED_SOURCES };

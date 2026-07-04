/* LEADS E OPORTUNIDADES (Sprint 10.B) — CRM interno, nada fingido.

   Nada nasce solto: lead vincula produto, marketplace, afiliado e
   campanha. Deduplicação por telefone/e-mail. Histórico e auditoria em
   toda mudança. Privacidade: telefone/e-mail mascarados para quem não é
   do comercial; acesso à lista é auditado; isolamento por empresa.
   Enquanto não houver integração comercial real: dados demonstrativos
   SEMPRE rotulados (data_source), importação manual permitida, e NUNCA
   fingimos que há CRM conectado. */
'use strict';

const LEAD_STATUSES = ['NOVO', 'EM_ATENDIMENTO', 'QUALIFICANDO', 'OPORTUNIDADE',
  'PROPOSTA_ENVIADA', 'GANHO', 'PERDIDO', 'SEM_RESPOSTA', 'ARQUIVADO'];
const LEAD_ORIGINS = ['WHATSAPP', 'FORMULARIO', 'INSTAGRAM', 'MARKETPLACE_PERGUNTAS',
  'MARKETPLACE_CHAT', 'INDICACAO', 'AFILIADO', 'IMPORTACAO_MANUAL', 'ANUNCIO',
  'CAMPANHA', 'DESCONHECIDA'];

const maskContact = v => {
  if (!v) return null;
  const s = String(v);
  return s.length <= 4 ? '••••' : `${s.slice(0, 2)}••••${s.slice(-2)}`;
};

class LeadService {
  constructor({ repos, permissions, bus, clock }) {
    this.r = repos; this.permissions = permissions; this.bus = bus; this.clock = clock;
  }

  _dedupKey({ phone, email, name }) {
    const base = (phone || email || name || '').toLowerCase().replace(/\D+/g, m => m.trim());
    return (phone ? `p:${String(phone).replace(/\D/g, '')}`
      : email ? `e:${String(email).toLowerCase().trim()}`
      : `n:${String(name).toLowerCase().trim()}`);
  }

  create({ companyId, userId = null, origin = 'DESCONHECIDA', dataSource = 'MANUAL',
           name, phone = null, email = null, estimatedValue = null, productId = null,
           marketplace = null, affiliateId = null, campaignId = null, tags = [],
           priority = 'normal', notes = null }) {
    if (userId) this.permissions.assert(userId, companyId, 'lead.manage');
    if (!LEAD_ORIGINS.includes(origin)) throw new Error(`origem de lead inválida: ${origin}`);
    const dedupKey = this._dedupKey({ phone, email, name });
    const dup = this.r.lead.db.get(
      'SELECT id, name FROM lead WHERE company_id = ? AND dedup_key = ?', companyId, dedupKey);
    if (dup) return { duplicate: true, leadId: dup.id,
      message: `lead já existe (${dup.name}) — deduplicado por ${phone ? 'telefone' : email ? 'e-mail' : 'nome'}` };

    const lead = this.r.lead.insert({
      company_id: companyId, name, phone, email, origin, status: 'NOVO',
      estimated_value: estimatedValue, product_id: productId, marketplace,
      affiliate_id: affiliateId, campaign_id: campaignId, tags_json: tags,
      priority, data_source: dataSource, notes, dedup_key: dedupKey,
      entered_at: this.clock.nowIso(), created_at: this.clock.nowIso(),
      updated_at: this.clock.nowIso() });
    this.r.leadStatusHistory.insert({ lead_id: lead.id, company_id: companyId,
      from_status: null, to_status: 'NOVO', by_user: userId,
      at: this.clock.nowIso(), created_at: this.clock.nowIso() });
    this.r.audit.record('lead', 'created', { companyId, entity: 'lead',
      entityId: lead.id, detail: { origin, dataSource, by: userId } });
    this.bus.emit('lead.created', { leadId: lead.id, companyId, origin });
    return { duplicate: false, lead };
  }

  importRows({ companyId, userId, rows, sourceLabel = 'importação manual' }) {
    this.permissions.assert(userId, companyId, 'lead.manage');
    let imported = 0, duplicates = 0;
    const ids = [];
    for (const row of rows) {
      const r = this.create({ companyId, userId, ...row,
        origin: row.origin || 'IMPORTACAO_MANUAL', dataSource: 'IMPORTACAO' });
      if (r.duplicate) duplicates++;
      else { imported++; ids.push(r.lead.id); }
    }
    this.r.audit.record('lead', 'imported', { companyId, entity: 'lead',
      entityId: `batch:${ids.length}`, detail: { imported, duplicates, sourceLabel, by: userId } });
    return { imported, duplicates, ids, sourceLabel };
  }

  setStatus(leadId, toStatus, { userId = null, reason = null } = {}) {
    if (!LEAD_STATUSES.includes(toStatus)) throw new Error(`status inválido: ${toStatus}`);
    const lead = this.r.lead.byId(leadId);
    if (userId) this.permissions.assert(userId, lead.company_id, 'lead.manage');
    this.r.leadStatusHistory.insert({ lead_id: leadId, company_id: lead.company_id,
      from_status: lead.status, to_status: toStatus, reason, by_user: userId,
      at: this.clock.nowIso(), created_at: this.clock.nowIso() });
    const updated = this.r.lead.update(leadId, { status: toStatus, updated_at: this.clock.nowIso() });
    this.r.audit.record('lead', 'status_changed', { companyId: lead.company_id,
      entity: 'lead', entityId: leadId, detail: { from: lead.status, to: toStatus, by: userId } });
    return updated;
  }

  assign(leadId, ownerUserId, { byUser = null } = {}) {
    const lead = this.r.lead.byId(leadId);
    this.r.leadAssignment.insert({ lead_id: leadId, company_id: lead.company_id,
      user_id: ownerUserId, assigned_by: byUser, assigned_at: this.clock.nowIso(),
      created_at: this.clock.nowIso() });
    return this.r.lead.update(leadId, { owner_user_id: ownerUserId, updated_at: this.clock.nowIso() });
  }

  followUp(leadId, { dueAt, note = null, byUser = null }) {
    const lead = this.r.lead.byId(leadId);
    const fu = this.r.leadFollowUp.insert({ lead_id: leadId, company_id: lead.company_id,
      due_at: dueAt, note, created_by: byUser, created_at: this.clock.nowIso() });
    this.r.lead.update(leadId, { next_follow_up_at: dueAt, updated_at: this.clock.nowIso() });
    return fu;
  }

  interact(leadId, { kind, note = null, byUser = null }) {
    const lead = this.r.lead.byId(leadId);
    const it = this.r.leadInteraction.insert({ lead_id: leadId,
      company_id: lead.company_id, kind, note, by_user: byUser,
      occurred_at: this.clock.nowIso(), created_at: this.clock.nowIso() });
    this.r.lead.update(leadId, { last_interaction_at: this.clock.nowIso(),
      updated_at: this.clock.nowIso() });
    return it;
  }

  link(leadId, { productId = null, marketplace = null, affiliateId = null,
                 campaignId = null, byUser = null } = {}) {
    const lead = this.r.lead.byId(leadId);
    const patch = { updated_at: this.clock.nowIso() };
    if (productId) patch.product_id = productId;
    if (marketplace) patch.marketplace = marketplace;
    if (affiliateId) patch.affiliate_id = affiliateId;
    if (campaignId) patch.campaign_id = campaignId;
    const updated = this.r.lead.update(leadId, patch);
    this.r.audit.record('lead', 'linked', { companyId: lead.company_id,
      entity: 'lead', entityId: leadId,
      detail: { productId, marketplace, affiliateId, campaignId, by: byUser } });
    return updated;
  }

  addNote(leadId, note, { byUser = null } = {}) {
    return this.interact(leadId, { kind: 'observacao', note, byUser });
  }

  markWon(leadId, opts = {}) { return this.setStatus(leadId, 'GANHO', opts); }
  markLost(leadId, opts = {}) { return this.setStatus(leadId, 'PERDIDO', opts); }

  /* lista com PRIVACIDADE: contato mascarado fora do comercial; acesso auditado */
  list({ companyId, userId, filters = {} }) {
    const role = this.permissions.assert(userId, companyId, 'lead.view');
    const canSeeContact = ['ADMIN', 'COMERCIAL'].includes(role);
    let sql = 'SELECT * FROM lead WHERE company_id = ?';
    const params = [companyId];
    if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
    if (filters.origin) { sql += ' AND origin = ?'; params.push(filters.origin); }
    if (filters.ownerUserId) { sql += ' AND owner_user_id = ?'; params.push(filters.ownerUserId); }
    if (filters.search) { sql += ' AND (name LIKE ? OR notes LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`); }
    sql += ' ORDER BY entered_at DESC LIMIT 500';
    const rows = this.r.lead.db.all(sql, ...params).map(l => ({
      ...l,
      phone: canSeeContact ? l.phone : maskContact(l.phone),
      email: canSeeContact ? l.email : maskContact(l.email),
      contactMasked: !canSeeContact,
    }));
    this.r.audit.record('lead', 'list_accessed', { companyId, entity: 'lead',
      entityId: 'list', detail: { by: userId, role, count: rows.length,
        masked: !canSeeContact } });
    return rows;
  }

  history(leadId) {
    return {
      status: this.r.leadStatusHistory.db.all(
        'SELECT * FROM lead_status_history WHERE lead_id = ? ORDER BY id', leadId),
      interactions: this.r.leadInteraction.db.all(
        'SELECT * FROM lead_interaction WHERE lead_id = ? ORDER BY id', leadId),
      followUps: this.r.leadFollowUp.db.all(
        'SELECT * FROM lead_follow_up WHERE lead_id = ? ORDER BY id', leadId),
    };
  }

  /* resumo honesto: demo × real SEMPRE separados e rotulados */
  summary({ companyId, todayIso = null }) {
    const all = this.r.lead.db.all('SELECT * FROM lead WHERE company_id = ?', companyId);
    const today = todayIso || this.clock.nowIso().slice(0, 10);
    const isToday = l => (l.entered_at || '').slice(0, 10) === today;
    const byKind = k => all.filter(l => l.data_source === k);
    const demo = byKind('DEMO');
    const real = all.filter(l => l.data_source !== 'DEMO');
    const block = rows => ({
      total: rows.length,
      today: rows.filter(isToday).length,
      unanswered: rows.filter(l => l.status === 'SEM_RESPOSTA'
        || (l.status === 'NOVO' && !l.last_interaction_at)).length,
      byOrigin: rows.reduce((m, l) => (m[l.origin] = (m[l.origin] || 0) + 1, m), {}),
      byStatus: rows.reduce((m, l) => (m[l.status] = (m[l.status] || 0) + 1, m), {}),
    });
    const dueFollowUps = this.r.leadFollowUp.db.all(
      `SELECT f.*, l.name AS lead_name FROM lead_follow_up f JOIN lead l ON l.id = f.lead_id
       WHERE f.company_id = ? AND f.done_at IS NULL AND substr(f.due_at,1,10) <= ?`,
      companyId, today);
    return {
      real: { ...block(real), label: real.some(l => l.data_source === 'IMPORTACAO')
        ? 'dados manuais/importados — CRM externo não conectado' : 'dados manuais — CRM externo não conectado' },
      demo: { ...block(demo), label: 'dados demonstrativos' },
      dueFollowUps,
      crmConnected: false,      // honesto: nenhuma integração comercial real ainda
      asOf: this.clock.nowIso(),
    };
  }
}

module.exports = { LeadService, LEAD_STATUSES, LEAD_ORIGINS, maskContact };

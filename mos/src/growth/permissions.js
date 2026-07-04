/* PERMISSÕES E APROVAÇÕES (Sprint 10.B) — regras estruturais.

   Papéis: ADMIN, GESTOR_MARKETPLACE, OPERADOR_CATALOGO, COMERCIAL,
   FINANCEIRO, LEITURA. Cada ação respeita o papel; LEITURA nunca edita
   nem executa jobs; escrita externa só poderá ser liberada por ADMIN em
   fluxo futuro (e continua bloqueada por READ_ONLY hoje).

   Approval Flow: edição em massa, promoção, alteração de preço, mudança
   de margem mínima, criação de anúncio, publicação futura e pagamento de
   comissão SEMPRE passam por registro de aprovação auditável. */
'use strict';

const ROLES = ['ADMIN', 'GESTOR_MARKETPLACE', 'OPERADOR_CATALOGO',
               'COMERCIAL', 'FINANCEIRO', 'LEITURA'];

/* papéis legados do S02 mapeiam para os papéis do Crescimento */
const LEGACY_MAP = { owner: 'ADMIN', operator: 'OPERADOR_CATALOGO', viewer: 'LEITURA' };

/* matriz papel → ações permitidas */
const MATRIX = {
  ADMIN: ['*'],
  GESTOR_MARKETPLACE: ['catalog.view', 'catalog.edit', 'draft.create', 'draft.approve',
    'job.execute', 'job.control', 'promotion.view', 'promotion.manage', 'promotion.approve',
    'lead.view', 'approval.decide', 'results.view', 'export'],
  OPERADOR_CATALOGO: ['catalog.view', 'catalog.edit', 'draft.create', 'job.execute',
    'promotion.view', 'results.view'],
  COMERCIAL: ['lead.view', 'lead.manage', 'lead.export', 'affiliate.view',
    'affiliate.manage', 'promotion.view', 'promotion.manage', 'catalog.view',
    'results.view', 'export'],
  FINANCEIRO: ['results.view', 'commission.view', 'commission.approve',
    'lead.view', 'promotion.view', 'catalog.view', 'approval.decide'],
  LEITURA: ['catalog.view', 'promotion.view', 'lead.view', 'affiliate.view', 'results.view'],
};

/* quem pode DECIDIR cada tipo de aprovação */
const APPROVAL_DECIDERS = {
  MASS_EDIT: ['ADMIN', 'GESTOR_MARKETPLACE'],
  PROMOTION: ['ADMIN', 'GESTOR_MARKETPLACE'],
  PRICE_CHANGE: ['ADMIN', 'GESTOR_MARKETPLACE'],
  MIN_MARGIN_CHANGE: ['ADMIN'],
  LISTING_CREATE: ['ADMIN', 'GESTOR_MARKETPLACE'],
  FUTURE_PUBLISH: ['ADMIN'],                       // só admin libera escrita externa
  COMMISSION_PAYOUT: ['ADMIN', 'FINANCEIRO'],
};

class PermissionError extends Error {
  constructor(role, action) {
    super(`permissão negada: papel ${role} não pode executar "${action}"`);
    this.name = 'PermissionError'; this.role = role; this.action = action;
  }
}

function can(role, action) {
  const allowed = MATRIX[role];
  if (!allowed) return false;
  return allowed.includes('*') || allowed.includes(action);
}

class PermissionService {
  constructor({ repos }) { this.r = repos; }

  roleOf(userId, companyId) {
    const row = this.r.userRole.db.get(
      'SELECT role FROM user_role WHERE user_id = ? AND company_id = ?', userId, companyId);
    if (row) return row.role;
    const u = this.r.user.maybeById(userId);
    return u ? (LEGACY_MAP[u.role] || 'LEITURA') : 'LEITURA';
  }

  grant(userId, companyId, role, { grantedBy = null } = {}) {
    if (!ROLES.includes(role)) throw new Error(`papel desconhecido: ${role}`);
    const existing = this.r.userRole.db.get(
      'SELECT id FROM user_role WHERE user_id = ? AND company_id = ?', userId, companyId);
    if (existing) return this.r.userRole.update(existing.id, { role, granted_by: grantedBy });
    return this.r.userRole.insert({ user_id: userId, company_id: companyId,
      role, granted_by: grantedBy });
  }

  can(userId, companyId, action) { return can(this.roleOf(userId, companyId), action); }

  assert(userId, companyId, action) {
    const role = this.roleOf(userId, companyId);
    if (!can(role, action)) throw new PermissionError(role, action);
    return role;
  }
}

class ApprovalService {
  constructor({ repos, permissions, clock }) {
    this.r = repos; this.permissions = permissions; this.clock = clock;
  }

  require({ companyId, kind, entity, entityId, requestedBy = null, detail = {} }) {
    if (!APPROVAL_DECIDERS[kind]) throw new Error(`tipo de aprovação desconhecido: ${kind}`);
    const row = this.r.approval.insert({
      company_id: companyId, kind, entity, entity_id: entityId,
      requested_by: requestedBy, status: 'PENDING', detail_json: detail,
      created_at: this.clock.nowIso() });
    this.r.audit.record('approval', 'requested', { companyId,
      entity: 'approval_request', entityId: row.id, detail: { kind, target: entityId } });
    return row;
  }

  decide(approvalId, { userId, approve, motive = null }) {
    const req = this.r.approval.byId(approvalId);
    if (req.status !== 'PENDING') throw new Error(`aprovação ${approvalId} já decidida (${req.status})`);
    const role = this.permissions.roleOf(userId, req.company_id);
    if (!APPROVAL_DECIDERS[req.kind].includes(role))
      throw new PermissionError(role, `approval.decide:${req.kind}`);
    const updated = this.r.approval.update(approvalId, {
      status: approve ? 'APPROVED' : 'REJECTED', decided_by: userId,
      decided_at: this.clock.nowIso(), motive });
    this.r.audit.record('approval', approve ? 'approved' : 'rejected', {
      companyId: req.company_id, entity: 'approval_request', entityId: approvalId,
      detail: { kind: req.kind, by: userId, motive } });
    return updated;
  }
}

module.exports = { ROLES, MATRIX, APPROVAL_DECIDERS, PermissionError, can,
                   PermissionService, ApprovalService };

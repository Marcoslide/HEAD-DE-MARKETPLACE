/* JOBS INTERNOS (Sprint 10.B) — toda ação em massa é um job auditável.

   Origem OBRIGATÓRIA em toda ação: DASHBOARD_MANUAL, WHATSAPP_COMMAND,
   CHAT_OPERACIONAL, JOB_INTERNO, INTEGRACAO_EXTERNA, IMPORTACAO_MANUAL,
   SISTEMA. Job tem contadores (total/processados/sucesso/bloqueados/
   falhos + motivos), pausa, cancelamento (só antes de executar),
   relatório final e rollback INTERNO quando aplicável. */
'use strict';

const ACTION_ORIGINS = ['DASHBOARD_MANUAL', 'WHATSAPP_COMMAND', 'CHAT_OPERACIONAL',
  'JOB_INTERNO', 'INTEGRACAO_EXTERNA', 'IMPORTACAO_MANUAL', 'SISTEMA'];

function assertOrigin(origin) {
  if (!ACTION_ORIGINS.includes(origin))
    throw new Error(`origem de ação inválida: "${origin}" — use uma de: ${ACTION_ORIGINS.join(', ')}`);
  return origin;
}

class JobService {
  constructor({ repos, bus, clock }) { this.r = repos; this.bus = bus; this.clock = clock; }

  create({ companyId, kind, origin, params = {}, total = 0,
           requiresConfirmation = false, requestedBy = null, requesterRef = null,
           approvalId = null, summary = null }) {
    assertOrigin(origin);
    const job = this.r.job.insert({
      company_id: companyId, kind, origin,
      status: requiresConfirmation ? 'AWAITING_CONFIRMATION' : 'QUEUED',
      total, params_json: params, summary_json: summary,
      requires_confirmation: requiresConfirmation ? 1 : 0,
      requested_by: requestedBy, requester_ref: requesterRef, approval_id: approvalId,
      reasons_json: [], created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('job', 'created', { companyId, entity: 'internal_job',
      entityId: job.id, detail: { kind, origin, total, requiresConfirmation } });
    this.bus.emit('job.created', { jobId: job.id, kind, origin });
    return job;
  }

  confirm(jobId, { userId = null } = {}) {
    const job = this.r.job.byId(jobId);
    if (job.status !== 'AWAITING_CONFIRMATION')
      throw new Error(`job ${jobId} não aguarda confirmação (${job.status})`);
    const updated = this.r.job.update(jobId, { status: 'QUEUED',
      confirmed_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('job', 'confirmed', { companyId: job.company_id,
      entity: 'internal_job', entityId: jobId, detail: { by: userId } });
    return updated;
  }

  start(jobId) {
    const job = this.r.job.byId(jobId);
    if (job.status === 'AWAITING_CONFIRMATION')
      throw new Error('job em massa exige confirmação antes de executar');
    if (!['QUEUED', 'PAUSED'].includes(job.status))
      throw new Error(`job ${jobId} não pode iniciar em ${job.status}`);
    return this.r.job.update(jobId, { status: 'RUNNING', updated_at: this.clock.nowIso() });
  }

  progress(jobId, { succeeded = 0, blocked = 0, failed = 0, reason = null }) {
    const job = this.r.job.byId(jobId);
    const reasons = JSON.parse(job.reasons_json || '[]');
    if (reason) reasons.push(reason);
    return this.r.job.update(jobId, {
      processed: job.processed + succeeded + blocked + failed,
      succeeded: job.succeeded + succeeded,
      blocked: job.blocked + blocked,
      failed: job.failed + failed,
      reasons_json: reasons, updated_at: this.clock.nowIso() });
  }

  pause(jobId) {
    const job = this.r.job.byId(jobId);
    if (job.status !== 'RUNNING') throw new Error(`só job RUNNING pode pausar (${job.status})`);
    return this.r.job.update(jobId, { status: 'PAUSED', updated_at: this.clock.nowIso() });
  }

  /* cancelamento só quando ainda NÃO executou nada */
  cancel(jobId, { userId = null } = {}) {
    const job = this.r.job.byId(jobId);
    if (job.processed > 0)
      throw new Error('job já executou itens — cancele via rollback interno, não via cancel');
    if (['DONE', 'FAILED', 'CANCELLED'].includes(job.status))
      throw new Error(`job ${jobId} já encerrado (${job.status})`);
    const updated = this.r.job.update(jobId, { status: 'CANCELLED',
      finished_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    this.r.audit.record('job', 'cancelled', { companyId: job.company_id,
      entity: 'internal_job', entityId: jobId, detail: { by: userId } });
    return updated;
  }

  finish(jobId, { report = {}, rollback = null, failed = false } = {}) {
    const job = this.r.job.byId(jobId);
    const updated = this.r.job.update(jobId, {
      status: failed ? 'FAILED' : 'DONE', report_json: report,
      rollback_json: rollback, finished_at: this.clock.nowIso(),
      updated_at: this.clock.nowIso() });
    this.r.audit.record('job', failed ? 'failed' : 'done', {
      companyId: job.company_id, entity: 'internal_job', entityId: jobId,
      detail: { processed: updated.processed, succeeded: updated.succeeded,
                blocked: updated.blocked, failed: updated.failed } });
    this.bus.emit('job.finished', { jobId, status: updated.status });
    return updated;
  }

  /* rollback INTERNO: desfaz o que o job criou DENTRO do sistema
     (rascunhos, registros) — nunca toca marketplace externo */
  rollbackInternal(jobId, { userId = null } = {}) {
    const job = this.r.job.byId(jobId);
    const rb = JSON.parse(job.rollback_json || 'null');
    if (!rb) throw new Error('job sem plano de rollback interno');
    let undone = 0;
    if (rb.draftIds) for (const id of rb.draftIds) {
      this.r.listingDraft.db.run(
        `UPDATE listing_draft SET status = 'ARCHIVED', updated_at = ? WHERE id = ?`,
        this.clock.nowIso(), id);
      undone++;
    }
    this.r.audit.record('job', 'rolled_back_internal', { companyId: job.company_id,
      entity: 'internal_job', entityId: jobId, detail: { undone, by: userId } });
    return { jobId, undone, external: false };
  }

  pendingFor(companyId, requesterRef) {
    return this.r.job.db.get(
      `SELECT * FROM internal_job WHERE company_id = ? AND requester_ref = ?
       AND status = 'AWAITING_CONFIRMATION' ORDER BY id DESC LIMIT 1`,
      companyId, requesterRef) || null;
  }
}

module.exports = { JobService, ACTION_ORIGINS, assertOrigin };

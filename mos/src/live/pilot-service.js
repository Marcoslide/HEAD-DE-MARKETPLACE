/* PILOTO DE ESCRITA (Sprint 10.A) — MERCADO_LIVRE_PILOT_CREATE_LISTING.

   READ_ONLY continua o padrão ABSOLUTO. Esta é a exceção única e restrita:
   criar UM anúncio novo no Mercado Livre — nada de editar, pausar,
   excluir, preço, estoque, Ads, lote, automação, Chat ou WhatsApp.

   Estágios: DRY_RUN → READY_FOR_PILOT → EXPLICIT_PILOT_CONFIRMATION →
   CREATED | FAILED. Idempotência por (draft + conta + hash do payload):
   nunca dois anúncios. Falha NUNCA gera retry automático. */
'use strict';
const crypto = require('node:crypto');

const CONFIRMATION_PHRASE = 'CRIAR ANÚNCIO PILOTO REAL';
const ALLOWED_SOURCES = ['connections-ui', 'api-admin'];   // Chat/WhatsApp: PROIBIDOS

class PilotService {
  constructor({ repos, bus, flags, credentials, clock, writer = null, logger = null }) {
    this.r = repos; this.bus = bus; this.flags = flags;
    this.credentials = credentials; this.clock = clock;
    this.writer = writer;             // MLLiveTransport.createItem no deploy; mock nos testes
    this.log = logger;
  }

  /* ---------- 1. DRY RUN: monta e valida o payload — SEM chamada externa ---------- */
  dryRun({ companyId, userId, connectionId, draftId }) {
    const draft = this.r.listingDraft.byId(draftId);
    if (draft.company_id !== companyId) throw new Error('draft de outra empresa — bloqueado');
    if (draft.platform !== 'mercado_livre') throw new Error('piloto é exclusivo do Mercado Livre');
    const payload = JSON.parse(draft.payload_json);
    const findings = JSON.parse(draft.findings_json || '[]');
    const conn = this.r.connection.byId(connectionId);
    const issues = [];

    /* categoria OFICIAL confirmada — PROVISIONAL do rule pack NÃO basta */
    const snapshot = this.r.categorySnapshot.db.get(
      `SELECT * FROM category_snapshot WHERE connection_id = ? AND category_id = ?
       ORDER BY id DESC LIMIT 1`, connectionId, payload.categoryId || '');
    if (!snapshot)
      issues.push('categoria sem confirmação oficial pós-OAuth — os códigos PROVISIONAL do rule pack orientam a preparação, mas não criam anúncio real');
    else {
      const required = JSON.parse(snapshot.attributes_json).required || [];
      const have = Object.keys(payload.attributes || {});
      const missing = required.filter(a => !have.includes(a));
      if (missing.length) issues.push(`atributos oficiais obrigatórios ausentes: ${missing.join(', ')}`);
    }
    if (findings.some(f => f.severity === 'BLOCKER')) issues.push('draft com BLOCKER ativo');
    if (findings.some(f => f.severity === 'UNKNOWN')) issues.push('draft com regra UNKNOWN não resolvida');
    if (draft.status !== 'READY_FOR_REVIEW') issues.push(`draft em ${draft.status} — precisa estar READY_FOR_REVIEW`);
    if (!payload.title) issues.push('título ausente');
    if (!payload.priceSuggested) issues.push('preço ausente');
    if (payload.stockSuggested == null) issues.push('estoque ausente');
    if (!payload.logistics || !payload.logistics.packedWeightG) issues.push('peso embalado ausente');
    if (!payload.logistics || !payload.logistics.packedDims) issues.push('dimensões ausentes');

    /* criativos: revisão humana aprovada é obrigatória */
    const creatives = this.r.creativeAsset.db.all(
      `SELECT * FROM creative_asset WHERE draft_id = ?`, draftId);
    const approved = creatives.filter(c => c.status === 'APPROVED_FOR_DRAFT');
    if (!approved.length) issues.push('nenhum criativo com revisão humana aprovada vinculado ao draft');
    const truthPackId = approved[0] ? approved[0].truth_pack_id : null;

    const externalPayload = {
      title: payload.title, category_id: payload.categoryId,
      price: payload.priceSuggested, currency_id: 'BRL',
      available_quantity: payload.stockSuggested,
      condition: payload.fiscal && payload.fiscal.condition === 'novo' ? 'new' : 'new',
      listing_type_id: 'gold_special',
      pictures: approved.map(c => ({ source: c.image_url })).filter(p => p.source),
      attributes: Object.entries(payload.attributes || {}).map(([id, value_name]) => ({ id, value_name: String(value_name) })),
      shipping: { mode: 'me2', dimensions: payload.logistics && payload.logistics.packedDims
        ? `${payload.logistics.packedDims.h}x${payload.logistics.packedDims.w}x${payload.logistics.packedDims.d},${payload.logistics.packedWeightG}` : null },
    };
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(externalPayload)).digest('hex').slice(0, 24);
    const idempotencyKey = crypto.createHash('sha256')
      .update(`${draftId}|${conn.account_id}|${payloadHash}`).digest('hex').slice(0, 32);

    const run = this.r.pilotRun.insert({
      /* chave provisória única por tentativa; a chave CANÔNICA só é
         gravada quando o anúncio é CRIADO (garante 1 anúncio por payload) */
      idempotency_key: `${idempotencyKey}-dry-${this.r.pilotRun.count() + 1}`,
      company_id: companyId, user_id: userId, connection_id: connectionId,
      marketplace_account_id: conn.account_id, listing_draft_id: draftId,
      product_id: draft.product_id,
      creative_asset_ids: approved.map(c => c.id),
      truth_pack_id: truthPackId,
      category_snapshot_id: snapshot ? snapshot.id : null,
      payload_json: externalPayload, payload_hash: payloadHash,
      stage: issues.length ? 'DRY_RUN' : 'READY_FOR_PILOT',
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso(),
    });
    this._idemKey = idempotencyKey;
    return {
      runId: run.id, stage: run.stage, issues, payload: externalPayload, payloadHash,
      idempotencyKey,
      review: {
        account: `${conn.account_id} (${conn.store_id || 'loja'})`,
        product: draft.product_id, category: payload.categoryId,
        categorySnapshot: snapshot ? { id: snapshot.id, source: snapshot.source, fetchedAt: snapshot.fetched_at } : null,
        title: payload.title, price: payload.priceSuggested, stock: payload.stockSuggested,
        images: externalPayload.pictures.length,
        warnings: findings.filter(f => f.severity === 'WARNING' || f.severity === 'HIGH_RISK').map(f => f.message),
        rulePack: draft.suggestions_source, validatedAt: this.clock.nowIso(),
      },
      externalCall: false,   // DRY RUN nunca chama API externa
    };
  }

  /* ---------- 3. confirmação EXPLÍCITA → a única escrita ---------- */
  async confirm(runId, { userId, userRole, typedPhrase, accountConfirmed = false,
                         source = 'connections-ui' } = {}) {
    const run = this.r.pilotRun.byId(runId);
    const gates = [];

    if (!ALLOWED_SOURCES.includes(source))
      gates.push(`origem "${source}" proibida — o piloto NUNCA dispara por Chat ou WhatsApp`);
    if (!this.flags.isEnabled('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED',
        { companyId: run.company_id, accountId: run.marketplace_account_id, userId }))
      gates.push('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED desligada para empresa/conta/usuário');
    if (userRole !== 'owner' && userRole !== 'admin')
      gates.push('apenas administrador pode confirmar o piloto');
    const conn = this.r.connection.byId(run.connection_id);
    if (conn.status !== 'connected' || !this.credentials.load(run.connection_id))
      gates.push('OAuth real do Mercado Livre não concluído nesta conexão');
    if (run.stage !== 'READY_FOR_PILOT')
      gates.push(`estágio atual é ${run.stage} — exige READY_FOR_PILOT (refaça o Dry Run após resolver pendências)`);
    if (typedPhrase !== CONFIRMATION_PHRASE)
      gates.push(`confirmação textual incorreta — digite exatamente: ${CONFIRMATION_PHRASE}`);
    if (!accountConfirmed) gates.push('conta de destino não confirmada');

    /* IDEMPOTÊNCIA: mesmo draft + mesma conta + mesmo hash → nunca 2 anúncios */
    const idemKey = crypto.createHash('sha256')
      .update(`${run.listing_draft_id}|${run.marketplace_account_id}|${run.payload_hash}`)
      .digest('hex').slice(0, 32);
    const dup = this.r.pilotRun.db.get(
      `SELECT id, external_listing_id FROM pilot_run WHERE idempotency_key = ? AND stage = 'CREATED'`, idemKey);
    if (dup) gates.push(`anúncio já criado por este payload (run ${dup.id} → ${dup.external_listing_id}) — duplicação bloqueada`);

    if (gates.length) {
      this.r.audit.record('pilot', 'confirm_blocked', { companyId: run.company_id,
        entity: 'pilot_run', entityId: runId, detail: { gates } });
      return { created: false, blocked: true, gates };
    }

    this.r.pilotRun.update(runId, {
      stage: 'CONFIRMED',
      confirmation_at: this.clock.nowIso(), request_at: this.clock.nowIso(),
      updated_at: this.clock.nowIso() });

    try {
      if (!this.writer) throw new Error('writer do piloto não configurado');
      const payload = JSON.parse(run.payload_json);
      const res = await this.writer.createItem(run.connection_id, payload);
      this.r.pilotRun.update(runId, {
        idempotency_key: idemKey,          // a chave canônica pertence ao anúncio CRIADO
        stage: 'CREATED', response_at: this.clock.nowIso(),
        external_listing_id: res.id || res.external_id || null,
        response_json: { id: res.id, permalink: res.permalink, status: res.status },
        updated_at: this.clock.nowIso() });
      this.r.audit.record('pilot', 'listing_created', { companyId: run.company_id,
        entity: 'pilot_run', entityId: runId,
        detail: { externalListingId: res.id, payloadHash: run.payload_hash, idempotencyKey: idemKey } });
      this.bus.emit('pilot.listing_created', { runId, externalListingId: res.id });
      return { created: true, runId, externalListingId: res.id, permalink: res.permalink || null };
    } catch (err) {
      /* FALHA: sem retry automático — novo envio só manual, após revisão */
      this.r.pilotRun.update(runId, {
        stage: 'FAILED', response_at: this.clock.nowIso(), error: err.message,
        rollback_note: 'nenhum anúncio criado nesta tentativa; revise o erro e refaça o Dry Run manualmente',
        updated_at: this.clock.nowIso() });
      this.r.audit.record('pilot', 'listing_failed', { companyId: run.company_id,
        entity: 'pilot_run', entityId: runId, detail: { error: err.message } });
      return { created: false, failed: true, error: err.message, retry: 'manual apenas' };
    }
  }
}

module.exports = { PilotService, CONFIRMATION_PHRASE };

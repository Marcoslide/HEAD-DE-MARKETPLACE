/* SYNC ORCHESTRATOR (Sprint 09) — a sincronização oficial da Central.

   Fluxo vertical por (conexão × recurso), rodando na fila `sync` do
   kernel existente (retry + backoff + dead-letter — nenhuma fila nova):

     conexão autenticada → job de sync → resposta BRUTA preservada
     → normalização → upsert canônico (listing via external_id!)
     → evento idempotente → sinais → EPE → Plano do Dia

   Garantias:
   - watermark por (conexão × recurso): re-sync não reprocessa o já visto;
   - isolamento por empresa: TODO dado gravado carrega o company_id da
     conexão de origem; leituras partem sempre do company_id;
   - rate limit: 429 do transporte vira retry com backoff (fila);
   - falha de uma praça NÃO derruba as demais (jobs independentes);
   - tempo SEMPRE pelo Clock injetado. */
'use strict';
const { NORMALIZERS } = require('./normalizers.js');
const { generateSignals } = require('./signals.js');

class SyncOrchestrator {
  constructor({ repos, bus, queue, registry, events, clock, logger = null, operation = {} }) {
    this.r = repos; this.bus = bus; this.queue = queue;
    this.registry = registry; this.events = events; this.clock = clock;
    this.log = logger; this.operation = operation;
    this.stats = { jobs: 0, errors: 0 };
    this.queue.process(async job => this._syncResource(job.data));
  }

  /* agenda a sincronização de todos os recursos suportados da conexão */
  syncConnection(connectionId, resources = null) {
    const conn = this.r.connection.byId(connectionId);
    if (conn.status !== 'connected')
      throw new Error(`conexão ${connectionId} não está conectada (status: ${conn.status})`);
    const connector = this.registry.connector(conn.marketplace);
    const supported = connector.supportedResources()
      .filter(r => NORMALIZERS[r])                      // só o que a Central persiste hoje
      .filter(r => !resources || resources.includes(r));
    for (const resource of supported)
      this.queue.enqueue('sync', { connectionId, resource });
    return { queued: supported };
  }

  /* sincroniza TODAS as conexões conectadas de uma empresa (isolamento) */
  syncCompany(companyId) {
    const conns = this.r.connection.db.all(
      `SELECT id FROM marketplace_connection WHERE company_id = ? AND status = 'connected'`, companyId);
    const queued = {};
    for (const c of conns) queued[c.id] = this.syncConnection(c.id).queued;
    return queued;
  }

  onIdle() { return this.queue.onIdle(); }

  /* ---------- o job: um (conexão × recurso) por vez ---------- */
  async _syncResource({ connectionId, resource }) {
    this.stats.jobs++;
    const conn = this.r.connection.byId(connectionId);
    const connector = this.registry.connector(conn.marketplace);
    const ctx = { companyId: conn.company_id, platform: conn.marketplace,
                  accountId: conn.account_id, storeId: conn.store_id };
    const startedAt = this.clock.nowIso();
    const state = this._state(conn, resource);
    this.r.syncState.update(state.id, { status: 'running', last_attempt_at: startedAt });

    try {
      /* 1. busca oficial autenticada (transporte injetado) */
      const rawRecords = await connector.fetchResource(resource, ctx);

      /* 2. resposta BRUTA preservada para auditoria */
      const rawRow = this.r.rawPayload.insert({
        company_id: conn.company_id, connection_id: conn.id, platform: conn.marketplace,
        resource, external_id: null, payload_json: rawRecords, fetched_at: this.clock.nowIso(),
      });

      /* 3. normaliza e aplica watermark + upsert + evento idempotente */
      const counters = { read: rawRecords.length, created: 0, updated: 0, ignored: 0 };
      let watermark = state.watermark;
      for (const raw of rawRecords) {
        const entity = NORMALIZERS[resource](connector.mappers, raw, ctx, this.clock, rawRow.id);
        if (state.watermark && entity.occurredAt && entity.occurredAt <= state.watermark) {
          counters.ignored++; continue;                 // já visto: não reprocessa
        }
        const action = this._persist(resource, conn, entity);
        counters[action]++;
        if (entity.occurredAt && (!watermark || entity.occurredAt > watermark))
          watermark = entity.occurredAt;
        this.events.publish({
          companyId: conn.company_id, platform: conn.marketplace,
          accountId: conn.account_id, storeId: conn.store_id,
          eventType: this._eventType(resource, action),
          entityType: entity.entityType,
          /* métricas distintas do mesmo item no mesmo instante NÃO colidem */
          entityId: resource === 'metrics' ? `${entity.externalId}:${entity.metric}` : entity.externalId,
          occurredAt: entity.occurredAt, observedAt: entity.observedAt,
          confidence: entity.confidence, rawReference: rawRow.id,
          payload: this._eventPayload(resource, entity),   // normalizado, nunca bruto
        });
      }

      /* 4. estado + log da sincronização */
      const finishedAt = this.clock.nowIso();
      this.r.syncState.update(state.id, {
        status: 'ok', watermark, last_success_at: finishedAt, error: null,
        records_read: counters.read, records_created: counters.created,
        records_updated: counters.updated, records_ignored: counters.ignored,
      });
      this.r.syncLog.insert({
        company_id: conn.company_id, connection_id: conn.id, platform: conn.marketplace,
        resource, status: 'ok', started_at: startedAt, finished_at: finishedAt,
        records_read: counters.read, records_created: counters.created,
        records_updated: counters.updated, records_ignored: counters.ignored,
      });
      this.bus.emit('central.sync.completed', { connectionId: conn.id, platform: conn.marketplace, resource, ...counters });
    } catch (err) {
      this.stats.errors++;
      this.r.syncState.update(state.id, { status: 'error', error: err.message });
      this.r.syncLog.insert({
        company_id: conn.company_id, connection_id: conn.id, platform: conn.marketplace,
        resource, status: 'error', started_at: startedAt, finished_at: this.clock.nowIso(),
        error: err.message,
      });
      if (this.log) this.log.warn('central.sync.failed', { connectionId, resource, error: err.message });
      throw err;                                        // fila cuida do retry/backoff
    }
  }

  _state(conn, resource) {
    const existing = this.r.syncState.byConnectionResource(conn.id, resource);
    if (existing) return existing;
    return this.r.syncState.insert({
      company_id: conn.company_id, connection_id: conn.id, platform: conn.marketplace,
      account_id: conn.account_id, store_id: conn.store_id, resource, status: 'idle',
    });
  }

  /* upsert canônico — SEM tabelas paralelas: anúncio vive em `listing` */
  _persist(resource, conn, e) {
    if (resource === 'listings') {
      const found = this.r.listing.db.get(
        'SELECT * FROM listing WHERE connection_id = ? AND external_id = ?', conn.id, e.externalId);
      if (found) {
        this.r.listing.update(found.id, { title: e.title, price: e.price,
          status: e.sourceStatus === 'active' ? 'active' : found.status, updated_at: e.synchronizedAt });
        return 'updated';
      }
      const product = this.r.product.insert({
        company_id: conn.company_id, name: e.title, sku: null,
        attributes_json: { importedFrom: e.platform, externalId: e.externalId } });
      this.r.listing.insert({
        product_id: product.id, connection_id: conn.id, external_id: e.externalId,
        title: e.title, price: e.price ?? 0,
        status: e.sourceStatus === 'active' ? 'active' : 'draft', updated_at: e.synchronizedAt });
      return 'created';
    }
    if (resource === 'orders') {
      const found = this.r.morder.byExternal(conn.id, e.externalId);
      const row = {
        company_id: e.companyId, connection_id: conn.id, platform: e.platform,
        account_id: e.accountId, store_id: e.storeId, external_id: e.externalId,
        status: e.sourceStatus, total: e.total, currency: e.currency, buyer_ref: e.buyerRef,
        is_custom: e.isCustom ? 1 : 0, deadline_at: e.deadlineAt,
        occurred_at: e.occurredAt, observed_at: e.observedAt, synchronized_at: e.synchronizedAt,
        raw_reference: e.rawReference,
      };
      if (found) { this.r.morder.update(found.id, row); return 'updated'; }
      const order = this.r.morder.insert(row);
      for (const i of e.items) this.r.morderItem.insert({
        order_id: order.id, external_listing_id: i.externalListingId, sku: i.sku,
        title: i.title, quantity: i.quantity, unit_price: i.unitPrice });
      return 'created';
    }
    /* inventory/prices/metrics: snapshots auditáveis (histórico, não upsert) */
    const common = {
      company_id: e.companyId, connection_id: conn.id, platform: e.platform,
      occurred_at: e.occurredAt, observed_at: e.observedAt,
      synchronized_at: e.synchronizedAt, raw_reference: e.rawReference,
    };
    if (resource === 'inventory')
      this.r.minventory.insert({ ...common, external_listing_id: e.externalId,
        sku: e.sku, available: e.available, reserved: e.reserved });
    else if (resource === 'prices')
      this.r.mprice.insert({ ...common, external_listing_id: e.externalId,
        price: e.price, original_price: e.originalPrice, currency: e.currency, margin_pct: e.marginPct });
    else if (resource === 'metrics')
      this.r.mmetric.insert({ ...common, external_listing_id: e.externalId === `${e.platform}:${e.metric}` ? null : e.externalId,
        metric: e.metric, value: e.value, period: e.period });
    return 'created';
  }

  _eventType(resource, action) {
    const base = { listings: 'LISTING', orders: 'ORDER', inventory: 'INVENTORY',
                   prices: 'PRICE', metrics: 'METRIC' }[resource];
    return `${base}_${action === 'created' ? 'OBSERVED' : 'UPDATED'}`;
  }
  /* o payload do evento é a entidade normalizada SEM o items/details pesados */
  _eventPayload(resource, e) {
    const { entityType, companyId, rawReference, items, ...rest } = e;
    return { ...rest, itemCount: items ? items.length : undefined };
  }

  /* ---------- sinais: dados normalizados → prioridade executiva ---------- */
  refreshSignals(companyId) {
    const signals = generateSignals({ repos: this.r, companyId, clock: this.clock, operation: this.operation });
    const delivered = [];
    for (const s of signals) {
      const res = this.events.publish({
        companyId, platform: s.provenance.platform, accountId: s.provenance.accountId,
        storeId: s.provenance.storeId, eventType: 'SIGNAL_RAISED',
        entityType: 'MARKETPLACE_SIGNAL', entityId: s.signalKey,
        occurredAt: this.clock.nowIso(),
        severity: s.severity === 'critical' ? 'CRITICAL' : 'INFO',
        confidence: s.confidenceLabel === 'alta' ? 0.85 : s.confidenceLabel === 'média' ? 0.6 : 0.3,
        payload: { playbook: s.playbook, title: s.title, impactMonthly: s.impactMonthly,
                   evidence: s.evidence, recommendation: s.recommendation },
      });
      if (!res.duplicate) {
        s.provenance.eventId = res.id;
        this.bus.emit('central.signal', s);
        delivered.push(s);
      }
    }
    return { generated: signals.length, delivered };
  }
}

module.exports = { SyncOrchestrator };

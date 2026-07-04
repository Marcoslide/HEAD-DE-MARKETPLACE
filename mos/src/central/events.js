/* EVENTOS DE INTEGRAÇÃO (Sprint 09) — o envelope normalizado e IDEMPOTENTE.

   Chave de idempotência:
     platform + accountId + eventType + externalEntityId + occurredAt
   O id do evento É a chave (hash) — o banco garante que o mesmo fato,
   recebido duas vezes (re-sync, webhook repetido, retry), NÃO gera
   pedido/sinal/nó/alerta duplicado.

   payload é SEMPRE normalizado; o bruto fica em raw_marketplace_payload
   e o evento carrega só a referência (rawReference). */
'use strict';
const crypto = require('node:crypto');

function idempotencyKey({ platform, accountId, eventType, entityId, occurredAt }) {
  return 'iev_' + crypto.createHash('sha256')
    .update(`${platform}|${accountId ?? ''}|${eventType}|${entityId ?? ''}|${occurredAt ?? ''}`)
    .digest('hex').slice(0, 32);
}

class IntegrationEvents {
  constructor({ repos, bus, clock, logger = null }) {
    this.r = repos; this.bus = bus; this.clock = clock; this.log = logger;
    this.published = 0; this.duplicates = 0;
  }

  /* publica um evento normalizado; devolve { duplicate, id }.
     observedAt ausente → carimbado pelo Clock injetado (contrato S08.1). */
  publish(evt) {
    const observedAt = evt.observedAt || this.clock.nowIso();
    const synchronizedAt = this.clock.nowIso();
    const id = evt.id || idempotencyKey(evt);
    const inserted = this.r.integrationEvent.insertIdempotent({
      id, company_id: evt.companyId,
      platform: evt.platform, account_id: evt.accountId ?? null, store_id: evt.storeId ?? null,
      event_type: evt.eventType, entity_type: evt.entityType, entity_id: evt.entityId ?? null,
      occurred_at: evt.occurredAt ?? null, observed_at: observedAt, synchronized_at: synchronizedAt,
      severity: evt.severity ?? 'INFO', confidence: evt.confidence ?? 1,
      payload: evt.payload ?? {}, raw_reference: evt.rawReference ?? null,
      metadata: evt.metadata ?? {},
    });
    if (!inserted) { this.duplicates++; return { duplicate: true, id }; }
    this.published++;
    this.bus.emit('central.event', { id, companyId: evt.companyId, platform: evt.platform,
      eventType: evt.eventType, entityType: evt.entityType, entityId: evt.entityId ?? null,
      occurredAt: evt.occurredAt ?? null, observedAt, synchronizedAt,
      severity: evt.severity ?? 'INFO', confidence: evt.confidence ?? 1,
      payload: evt.payload ?? {}, rawReference: evt.rawReference ?? null });
    return { duplicate: false, id };
  }
}

module.exports = { IntegrationEvents, idempotencyKey };

/* Application · Fluxo de Publicação SIMULADO (Bloco 07).
   Pipeline completo — nenhum envio real:

   criar anúncio → adaptar atributos → validar categoria → validar
   imagens → validar regras → gerar preview → aguardar aprovação →
   publicação simulada → monitoramento simulado → versionamento → histórico

   Cada passo grava publication_history (auditável) e publica evento.
   A aprovação é SEMPRE do dono (publicar é Classe C — MIF 7.2). */
'use strict';
const { ValidationError, ConflictError } = require('../kernel/errors.js');

class PublicationService {
  constructor({ repos, bus, queues, providers, logger }) {
    this.r = repos; this.bus = bus; this.queues = queues;
    this.providers = providers; this.log = logger;

    /* a publicação pesada roda na fila, não no request */
    this.queues.publication.process(async job => this._executePublish(job.data));
  }

  /* etapa 1-6: prepara, valida e gera preview; deixa aguardando aprovação */
  prepare(listingId, draft = {}) {
    const listing = this.r.listing.byId(listingId);
    const connection = this.r.connection.byId(listing.connection_id);
    const provider = this.providers.get(connection.marketplace);

    const candidate = {
      title: draft.title ?? listing.title,
      price: draft.price ?? listing.price,
      images: draft.images ?? ['img-1.jpg', 'img-2.jpg', 'img-3.jpg'],
      // null explícito = "sem categoria" (deve reprovar); só default quando ausente
      category: 'category' in draft ? draft.category : 'decoracao/quadros',
      attributes: draft.attributes ?? { brand: 'própria', ean: '0000000000000' },
      video: draft.video ?? null,
    };

    /* adaptar atributos ao formato da praça */
    const payload = provider.adaptAttributes(candidate);
    this._history(listingId, null, 'create', { step: 'adapt', marketplace: provider.name });

    /* validações: categoria, imagens e regras — tudo do provider */
    const issues = provider.validate(candidate);
    const blockers = issues.filter(i => i.level === 'error');
    this._history(listingId, null, 'create', { step: 'validate', issues });

    if (blockers.length) {
      this.bus.emit('publication.blocked', { listingId, blockers });
      return { ok: false, issues, preview: null };
    }

    /* preview para aprovação humana */
    const preview = {
      marketplace: provider.name,
      title: payload.title, price: payload.price,
      images: payload.images, category: payload.category,
      warnings: issues.filter(i => i.level === 'warning'),
    };
    this.r.listing.update(listingId, { status: 'pending_approval' });
    this._history(listingId, null, 'create', { step: 'preview_ready', preview });
    this.bus.emit('publication.preview_ready', { listingId, preview });
    return { ok: true, issues, preview, payload };
  }

  /* etapa 7-8: aprovação do dono → publicação simulada via fila */
  approve(listingId, payload) {
    const listing = this.r.listing.byId(listingId);
    if (listing.status !== 'pending_approval')
      throw new ConflictError(`anúncio não está aguardando aprovação (status: ${listing.status})`);
    this.bus.emit('publication.approved', { listingId });
    this.queues.publication.enqueue('publish', { listingId, payload });
    return { queued: true };
  }

  async _executePublish({ listingId, payload }) {
    const listing = this.r.listing.byId(listingId);
    const connection = this.r.connection.byId(listing.connection_id);
    const provider = this.providers.get(connection.marketplace);

    /* publicação SIMULADA no provider */
    const result = provider.publish(payload);

    /* versionamento: toda publicação nasce como versão reversível */
    const version = this.r.version.insert({
      listing_id: listingId,
      number: this.r.version.nextNumber(listingId),
      title: payload.title, price: payload.price,
      images_json: payload.images || [],
      author: 'head', reason: 'publicação aprovada pelo dono',
    });
    this.r.listing.update(listingId, {
      status: 'active', external_id: result.externalId,
      active_version_id: version.id, title: payload.title, price: payload.price,
      updated_at: new Date().toISOString(),
    });
    this._history(listingId, version.id, 'simulated_publish',
      { externalId: result.externalId, providerStatus: result.status });

    /* monitoramento simulado: primeira checagem agendada na fila de análise */
    this.queues.analysis.enqueue('monitor_publication', { listingId, versionId: version.id });
    this._history(listingId, version.id, 'update', { step: 'monitoring_scheduled' });

    this.bus.emit('publication.completed', { listingId, versionId: version.id, externalId: result.externalId });
    return result;
  }

  /* rollback: restaurar versão anterior (reversibilidade é lei) */
  rollback(listingId, toVersionId) {
    const v = this.r.version.byId(toVersionId);
    if (v.listing_id !== listingId) throw new ValidationError('versão não pertence ao anúncio');
    const restored = this.r.version.insert({
      listing_id: listingId,
      number: this.r.version.nextNumber(listingId),
      title: v.title, description: v.description, price: v.price,
      images_json: JSON.parse(v.images_json || '[]'),
      author: 'head', reason: `rollback para v${v.number}`,
    });
    this.r.listing.update(listingId, {
      active_version_id: restored.id, title: v.title, price: v.price,
      updated_at: new Date().toISOString(),
    });
    this._history(listingId, restored.id, 'rollback', { from: toVersionId });
    this.bus.emit('publication.rolled_back', { listingId, to: restored.id });
    return restored;
  }

  history(listingId) {
    return this.r.publication.db.all(
      'SELECT * FROM publication_history WHERE listing_id = ? ORDER BY id', listingId);
  }

  _history(listingId, versionId, action, payload) {
    this.r.publication.insert({
      listing_id: listingId, version_id: versionId, action,
      simulated: 1, payload_json: payload, outcome: 'ok',
    });
  }
}

module.exports = { PublicationService };

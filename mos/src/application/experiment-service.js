/* Application · Experimentação (Bloco 11) — o Head como cientista.
   Doutrina do MIF Parte 6, imposta por código:
     6.1  UMA variável por vez, por anúncio
     6.2  critério de sucesso definido ANTES de começar
     6.3  reversibilidade obrigatória (baseline guardada; rollback automático)
     6.4  parada antecipada SÓ por dano claro
     6.6  todo experimento termina em conhecimento — inclusive os que perdem */
'use strict';
const { ValidationError, ConflictError } = require('../kernel/errors.js');

class ExperimentService {
  constructor({ repos, bus, catalog, logger = null }) {
    this.r = repos; this.bus = bus; this.catalog = catalog; this.log = logger;
  }

  create(listingId, { hypothesis, variable, metric, successCriteria, windowDays = 7, variant }) {
    if (!hypothesis) throw new ValidationError('experimento exige hipótese ("acredito que X porque Y")');
    if (!variable) throw new ValidationError('experimento exige a variável única testada (MIF 6.1)');
    if (!successCriteria || successCriteria.minLiftPct === undefined)
      throw new ValidationError('critério de sucesso vem ANTES de começar (MIF 6.2)');
    if (!variant || (!variant.title && variant.price === undefined && !variant.images))
      throw new ValidationError('experimento exige a variante a testar');

    /* 6.1: uma variável por vez POR ANÚNCIO */
    const running = this.r.experiment.db.get(
      `SELECT id FROM experiment WHERE listing_id = ? AND status = 'running'`, listingId);
    if (running) throw new ConflictError(`já existe experimento rodando neste anúncio (${running.id}) — uma variável por vez`);

    const listing = this.r.listing.byId(listingId);
    const baselineVersionId = listing.active_version_id;

    /* a variante nasce como versão NÃO ativa (só ativa no start) */
    const variantVersion = this.r.version.insert({
      listing_id: listingId,
      number: this.r.version.nextNumber(listingId),
      title: variant.title ?? listing.title,
      price: variant.price ?? listing.price,
      images_json: variant.images || [],
      author: 'head', reason: `experimento: ${hypothesis}`,
    });

    const exp = this.r.experiment.insert({
      listing_id: listingId, hypothesis, variable, metric: metric || 'conv',
      baseline_version_id: baselineVersionId,
      variant_version_id: variantVersion.id,
      success_criteria_json: successCriteria,
      window_days: windowDays, status: 'draft',
    });
    this.bus.emit('experiment.created', { experimentId: exp.id, listingId, variable });
    return exp;
  }

  start(experimentId, { day = 0 } = {}) {
    const exp = this.r.experiment.byId(experimentId);
    if (exp.status !== 'draft') throw new ConflictError('experimento já iniciado/concluído');
    const variant = this.r.version.byId(exp.variant_version_id);
    /* ativa a variante no anúncio */
    this.r.listing.update(exp.listing_id, {
      active_version_id: variant.id, title: variant.title, price: variant.price,
      updated_at: new Date().toISOString(),
    });
    const updated = this.r.experiment.update(experimentId, {
      status: 'running', result_json: { startDay: day },
    });
    this.bus.emit('experiment.started', { experimentId, listingId: exp.listing_id, day });
    return updated;
  }

  /* conclusão: só depois da janela (6.5: nunca declarar vitória cedo) */
  conclude(experimentId, { day, baselineValue, variantValue }) {
    const exp = this.r.experiment.byId(experimentId);
    if (exp.status !== 'running') throw new ConflictError('experimento não está rodando');
    const startDay = JSON.parse(exp.result_json || '{}').startDay || 0;
    if (day - startDay < exp.window_days)
      throw new ValidationError(`janela mínima de ${exp.window_days} ciclos não venceu (dia ${day - startDay}) — vitória precoce é a mentira estatística mais comum (MIF 6.4)`);

    const criteria = JSON.parse(exp.success_criteria_json);
    const liftPct = baselineValue ? (variantValue - baselineValue) / baselineValue : 0;
    const won = liftPct * 100 >= criteria.minLiftPct;
    const verdict = won ? 'win' : 'lose';

    const listingId = exp.listing_id;
    if (!won) {
      /* 6.3: derrota → rollback automático para a baseline (via Catalog) */
      this.catalog.restoreVersion(listingId, exp.baseline_version_id,
        { reason: `rollback automático: experimento ${experimentId} perdeu` });
      this.bus.emit('experiment.rolled_back', { experimentId, listingId });
    }

    const result = { startDay, concludedDay: day, baselineValue, variantValue,
                     liftPct: Math.round(liftPct * 1000) / 10, verdict };
    const updated = this.r.experiment.update(experimentId, {
      status: 'concluded', result_json: result, concluded_at: new Date().toISOString(),
    });

    /* 6.6: TODO experimento termina em conhecimento — vitória E derrota */
    const listing = this.r.listing.byId(listingId);
    const product = this.r.product.byId(listing.product_id);
    this.r.memory.upsert(product.company_id, {
      key: `experiment.${exp.variable}`,
      kind: 'strategy',
      discovery: won
        ? `Testar "${exp.variable}" funcionou: ${result.liftPct}% de lift (critério: ${criteria.minLiftPct}%).`
        : `Testar "${exp.variable}" NÃO funcionou aqui (${result.liftPct}% vs. critério ${criteria.minLiftPct}%) — vale tanto quanto o contrário.`,
      contradicts: !won,
      evidence_json: [{ experimentId, result }],
    });
    this.bus.emit('experiment.concluded', { experimentId, verdict, liftPct: result.liftPct });
    return updated;
  }

  /* 6.4: parada antecipada SÓ por dano claro */
  stopEarly(experimentId, { reason, damage = false }) {
    if (!damage)
      throw new ValidationError('parada antecipada só por DANO claro (MIF 6.4) — vitória precoce não encerra experimento');
    const exp = this.r.experiment.byId(experimentId);
    if (exp.status !== 'running') throw new ConflictError('experimento não está rodando');
    this.catalog.restoreVersion(exp.listing_id, exp.baseline_version_id,
      { reason: `parada por dano: ${reason}` });
    const updated = this.r.experiment.update(experimentId, {
      status: 'stopped_early', result_json: { stoppedFor: reason },
      concluded_at: new Date().toISOString(),
    });
    this.bus.emit('experiment.rolled_back', { experimentId, listingId: exp.listing_id, damage: true });
    return updated;
  }

  history(listingId) {
    return this.r.experiment.db.all(
      'SELECT * FROM experiment WHERE listing_id = ? ORDER BY id', listingId);
  }
}

module.exports = { ExperimentService };

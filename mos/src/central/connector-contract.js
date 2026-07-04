/* CENTRAL DE MARKETPLACE (Sprint 09) — o CONTRATO ÚNICO de conector.

   Conector Oficial Autenticado / Account Sync: a leitura dos dados PRIVADOS
   da própria loja (anúncios, pedidos, estoque, preços, logística, devoluções,
   métricas, Ads, financeiro) via API oficial autenticada.

   NÃO confundir com o Collector (mos/src/collector): aquele é pesquisa
   PÚBLICA simples — nunca recebe token, nunca acessa dado privado.

   Regras de lei deste contrato:
   - capability inexistente → CapabilityError (erro claro, nada silencioso);
   - TODA operação de escrita → ReadOnlyViolationError (READ_ONLY é técnico,
     não combinado);
   - tempo SEMPRE via Clock injetado — nunca new Date()/Date.now();
   - transporte injetável: fixtures em dev/teste, HTTP oficial no futuro,
     sem mudar uma linha do pipeline. */
'use strict';

class CapabilityError extends Error {
  constructor(platform, capability) {
    super(`${platform} não suporta "${capability}" — capability não declarada no Registry`);
    this.name = 'CapabilityError';
    this.platform = platform;
    this.capability = capability;
  }
}

class ReadOnlyViolationError extends Error {
  constructor(platform, action) {
    super(`READ_ONLY ativo: "${action}" é uma operação de ESCRITA e está tecnicamente bloqueada neste sprint (${platform})`);
    this.name = 'ReadOnlyViolationError';
    this.platform = platform;
    this.action = action;
  }
}

/* recursos de leitura → capability que os autoriza */
const READ_RESOURCES = {
  listings: 'listingsRead',
  orders: 'ordersRead',
  inventory: 'inventoryRead',
  prices: 'pricesRead',
  logistics: 'logisticsRead',
  returns: 'returnsRead',
  metrics: 'metricsRead',
  ads: 'adsRead',
  finance: 'financeRead',
};

/* toda ação de escrita conhecida — bloqueadas SEM exceção neste sprint */
const WRITE_ACTIONS = [
  'publishListing', 'updateListing', 'updateTitle', 'updateDescription', 'updateImages',
  'updatePrice', 'updateInventory', 'createCampaign', 'updateCampaign',
  'answerCustomer', 'cancelOrder', 'pauseListing', 'deleteListing',
];

class MarketplaceConnector {
  constructor(declaration, { transport, clock, mappers = {} } = {}) {
    if (!declaration || !declaration.id) throw new Error('conector precisa de uma declaração com id');
    if (!clock) throw new Error(`conector ${declaration.id} precisa do Clock injetado`);
    this.declaration = declaration;
    this.platform = declaration.id;
    this.capabilities = declaration.capabilities || {};
    this.transport = transport;
    this.clock = clock;
    this.mappers = mappers;      // raw da praça → campos canônicos, por recurso
    this.readOnly = true;        // lei do Sprint 09

    /* escrita: cada ação existe no objeto e falha ALTO — bloqueio técnico */
    for (const action of WRITE_ACTIONS)
      this[action] = () => { throw new ReadOnlyViolationError(this.platform, action); };
  }

  _requireCapability(cap) {
    if (!this.capabilities[cap]) throw new CapabilityError(this.platform, cap);
  }

  /* leitura genérica: capability → transporte → payload bruto (array) */
  async fetchResource(resource, ctx = {}) {
    const cap = READ_RESOURCES[resource];
    if (!cap) throw new Error(`recurso desconhecido: ${resource}`);
    this._requireCapability(cap);
    return this.transport.fetch(this.platform, resource, ctx);
  }
  fetchListings(ctx) { return this.fetchResource('listings', ctx); }
  fetchOrders(ctx) { return this.fetchResource('orders', ctx); }
  fetchInventory(ctx) { return this.fetchResource('inventory', ctx); }
  fetchPrices(ctx) { return this.fetchResource('prices', ctx); }
  fetchLogistics(ctx) { return this.fetchResource('logistics', ctx); }
  fetchReturns(ctx) { return this.fetchResource('returns', ctx); }
  fetchMetrics(ctx) { return this.fetchResource('metrics', ctx); }
  fetchAds(ctx) { return this.fetchResource('ads', ctx); }
  fetchFinance(ctx) { return this.fetchResource('finance', ctx); }

  /* recursos de leitura que ESTA praça realmente suporta */
  supportedResources() {
    return Object.entries(READ_RESOURCES)
      .filter(([, cap]) => this.capabilities[cap])
      .map(([resource]) => resource);
  }

  /* valida a conexão sem expor segredo (usa o transporte autenticado) */
  async validateConnection(ctx = {}) {
    const r = await this.transport.validate(this.platform, ctx);
    return { ok: !!r.ok, accountId: r.accountId ?? null, storeId: r.storeId ?? null,
             capabilities: this.capabilities, checkedAt: this.clock.nowIso() };
  }
}

module.exports = {
  MarketplaceConnector, CapabilityError, ReadOnlyViolationError,
  READ_RESOURCES, WRITE_ACTIONS,
};

/* CENTRAL DE MARKETPLACE (Sprint 09) — a matriz de capacidades.

   Cada praça declara APENAS o que realmente oferece e o estado real da
   integração. Nunca fingimos que uma API, webhook ou capability existe
   sem confirmação oficial:

   - Mercado Livre e Shopee: INTEGRATION_READY — APIs oficiais públicas e
     documentadas; conector pronto para receber credenciais reais.
   - TikTok Shop: WAITING_PARTNER_APPROVAL — exige aprovação de parceiro
     na TikTok Shop Partner Center antes de qualquer OAuth real.
   - Magalu: WAITING_CREDENTIALS — exige credenciamento no portal de
     desenvolvedores/IntegraCommerce antes de qualquer chamada real.

   Escrita: TUDO false neste sprint (READ_ONLY é lei técnica). */
'use strict';

const STATUS = {
  INTEGRATION_READY: 'INTEGRATION_READY',
  WAITING_CREDENTIALS: 'WAITING_CREDENTIALS',
  WAITING_PARTNER_APPROVAL: 'WAITING_PARTNER_APPROVAL',
  RESTRICTED_API: 'RESTRICTED_API',
  RESEARCH_REQUIRED: 'RESEARCH_REQUIRED',
  DISABLED: 'DISABLED',
};

const NO_WRITE = {
  listingsWrite: false, inventoryWrite: false, pricesWrite: false, adsWrite: false,
};

const DECLARATIONS = {
  mercado_livre: {
    id: 'mercado_livre',
    displayName: 'Mercado Livre',
    countryScope: ['BR'],
    integrationStatus: STATUS.INTEGRATION_READY,
    authType: 'OAUTH2',
    supportsPolling: true,
    supportsWebhooks: true,           // notificações oficiais (topics)
    capabilities: {
      listingsRead: true, ordersRead: true, inventoryRead: true, pricesRead: true,
      logisticsRead: true, returnsRead: true, questionsRead: true,
      metricsRead: true, adsRead: true, financeRead: true,
      ...NO_WRITE,
    },
  },
  shopee: {
    id: 'shopee',
    displayName: 'Shopee',
    countryScope: ['BR'],
    integrationStatus: STATUS.INTEGRATION_READY,
    authType: 'OAUTH2',               // Open Platform: partner + shop authorization
    supportsPolling: true,
    supportsWebhooks: true,           // push mechanism oficial
    capabilities: {
      listingsRead: true, ordersRead: true, inventoryRead: true, pricesRead: true,
      logisticsRead: true, returnsRead: true, questionsRead: false,
      metricsRead: true, adsRead: true, financeRead: true,
      ...NO_WRITE,
    },
  },
  tiktok: {
    id: 'tiktok',
    displayName: 'TikTok Shop',
    countryScope: ['BR'],
    integrationStatus: STATUS.WAITING_PARTNER_APPROVAL,  // exige parceria aprovada
    authType: 'OAUTH2',
    supportsPolling: true,
    supportsWebhooks: true,
    capabilities: {
      listingsRead: true, ordersRead: true, inventoryRead: true, pricesRead: true,
      logisticsRead: true, returnsRead: true, questionsRead: false,
      metricsRead: true,               // performance de vídeo/criativo
      adsRead: false,                  // NÃO confirmado sem parceria — não inventar
      financeRead: true,
      ...NO_WRITE,
    },
  },
  magalu: {
    id: 'magalu',
    displayName: 'Magalu Marketplace',
    countryScope: ['BR'],
    integrationStatus: STATUS.WAITING_CREDENTIALS,       // exige credenciamento
    authType: 'OAUTH2',
    supportsPolling: true,
    supportsWebhooks: false,          // NÃO confirmado — não inventar
    capabilities: {
      listingsRead: true, ordersRead: true, inventoryRead: true, pricesRead: true,
      logisticsRead: true, returnsRead: false,
      questionsRead: false, metricsRead: false, adsRead: false, financeRead: false,
      ...NO_WRITE,
    },
  },
};

module.exports = { DECLARATIONS, STATUS };

/* CONEXÕES REAIS (Sprint 10.A) — composição.

   createLive({ mos, clock, chatFactory, ... }) monta os serviços live
   SOBRE a base existente: vault do S09, SyncOrchestrator do S09 (leitura
   real = mesmo pipeline, transporte HTTP), CatalogService do S10, Query
   Layer do 09.A. Transportes/writers são injetáveis: HTTP real quando
   houver credenciais configuradas; mocks nos testes; NUNCA fingimos. */
'use strict';
const { FeatureFlags, FLAGS } = require('./feature-flags.js');
const { WhatsAppLive } = require('./whatsapp-live.js');
const { MLOAuth, MLLiveTransport, CategoryConfirmService, ML_AUTH_URL } = require('./ml-live.js');
const { CreativeEngine, CREATIVE_TYPES } = require('./creative-engine.js');
const { PilotService, CONFIRMATION_PHRASE } = require('./pilot-service.js');
const { DECLARATIONS } = require('../central/declarations.js');

function createLive({ mos, clock, credentials, orchestrator, catalog,
                      chatFactory = null, config = {}, transports = {} }) {
  if (!clock) throw new Error('createLive exige o Clock injetado');
  const { repos, bus, logger } = mos;

  const flags = new FeatureFlags({ repos, clock });
  const whatsapp = new WhatsAppLive({ repos, bus, clock, flags, chatFactory,
    sender: transports.whatsappSender || null,
    commandGateway: transports.commandGateway || null,   // Sprint 10.B
    config: config.whatsapp || {},
    logger: logger.child({ mod: 'whatsapp-live' }) });
  const mlTransport = transports.mlTransport
    || new MLLiveTransport({ credentials, clock });
  const oauth = new MLOAuth({ repos, credentials, orchestrator, flags, clock,
    config: config.mercadoLivre || {}, authHttp: transports.mlAuthHttp || undefined,
    logger: logger.child({ mod: 'ml-oauth' }) });
  const categoryConfirm = new CategoryConfirmService({ repos, clock,
    transport: transports.categorySource === undefined ? mlTransport : transports.categorySource });
  const creative = new CreativeEngine({ repos, catalog, flags, clock,
    providers: transports.imageProviders || undefined, config: config.creative || {},
    logger: logger.child({ mod: 'creative' }) });
  const pilot = new PilotService({ repos, bus, flags, credentials, clock,
    writer: transports.pilotWriter || mlTransport,
    logger: logger.child({ mod: 'pilot' }) });

  /* ---------- cards da área CONEXÕES (estados honestos) ---------- */
  function connectionsBoard(companyId) {
    const cards = [];
    /* WhatsApp */
    const wa = whatsapp.health(companyId);
    cards.push({
      id: 'whatsapp', name: 'WhatsApp Business', kind: 'channel',
      status: !wa.configured ? 'SETUP_REQUIRED'
        : wa.status === 'WHATSAPP_CONNECTED' ? 'CONNECTED'
        : wa.status === 'WHATSAPP_WEBHOOK_VERIFIED' ? 'CONNECTED_READ_ONLY'
        : 'AWAITING_CREDENTIALS',
      detail: wa, mode: 'consulta operacional (nunca executa ação externa)',
      missing: wa.missingConfig,
    });
    /* marketplaces */
    const conns = repos.connection.db.all(
      'SELECT * FROM marketplace_connection WHERE company_id = ?', companyId);
    for (const [platform, decl] of Object.entries(DECLARATIONS)) {
      const conn = conns.find(c => c.marketplace === platform);
      const cred = conn ? credentials.maskedStatus(conn.id) : { hasCredential: false };
      const syncs = conn ? repos.syncState.db.all(
        'SELECT * FROM marketplace_sync_state WHERE connection_id = ? ORDER BY last_success_at DESC', conn.id) : [];
      const lastSync = syncs.find(s => s.last_success_at);
      const pilotOn = platform === 'mercado_livre'
        && flags.isEnabled('MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED', { companyId });
      const oauthReady = platform === 'mercado_livre' && oauth.configured();
      cards.push({
        id: platform, name: decl.displayName, kind: 'marketplace',
        status: !conn ? 'NOT_CONNECTED'
          : conn.status === 'revoked' ? 'REVOKED'
          : conn.status === 'connected'
            ? (pilotOn ? 'PILOT_WRITE_ENABLED' : 'CONNECTED_READ_ONLY')
          : decl.integrationStatus === 'INTEGRATION_READY'
            ? (oauthReady || platform !== 'mercado_livre' ? 'AWAITING_OAUTH' : 'SETUP_REQUIRED')
            : 'AWAITING_CREDENTIALS',
        account: conn ? conn.account_id : null,
        store: conn ? conn.store_id : null,
        credential: { hasCredential: cred.hasCredential, tokenMasked: cred.tokenMasked || null },
        readOnly: !pilotOn,
        lastSyncAt: lastSync ? lastSync.last_success_at : null,
        lagMs: lastSync && lastSync.last_success_at
          ? clock.nowMs() - new Date(lastSync.last_success_at).getTime() : null,
        dataAvailable: Object.entries(decl.capabilities).filter(([, v]) => v === true).map(([k]) => k),
        dataBlocked: ['listingsWrite', 'pricesWrite', 'inventoryWrite', 'adsWrite']
          .concat(platform === 'mercado_livre' && pilotOn ? [] : ['pilotCreate']),
        health: syncs.some(s => s.status === 'error') ? 'degraded' : 'ok',
        error: (syncs.find(s => s.error) || {}).error || null,
        integrationStatus: decl.integrationStatus,
        missing: platform === 'mercado_livre' ? oauth.missingConfig() : [],
      });
    }
    return { companyId, readOnlyDefault: true, cards,
             flags: FLAGS.map(f => ({ flag: f, enabled: flags.isEnabled(f, { companyId }) })) };
  }

  return { flags, whatsapp, oauth, mlTransport, categoryConfirm, creative, pilot,
           connectionsBoard, CONFIRMATION_PHRASE, CREATIVE_TYPES, ML_AUTH_URL };
}

/* rotas HTTP das conexões reais */
function mountLive(router, mos, live) {
  router.get('/webhooks/whatsapp', { summary: 'Verificação oficial do webhook WhatsApp', tags: ['live'] },
    ({ query }) => {
      const r = live.whatsapp.verifyWebhook(query, query.companyId);
      if (!r.ok) return { _status: 403, error: 'verificação recusada' };
      return { _html: r.challenge };          // a Meta espera o challenge cru
    });
  router.post('/webhooks/whatsapp', { summary: 'Mensagens recebidas (oficial)', tags: ['live'] },
    async ({ body, rawBody, headers, query }) => {
      const r = await live.whatsapp.handleInbound(body || {}, {
        rawBody, signature: headers['x-hub-signature-256'] || null,
        companyId: query.companyId });
      if (!r.ok) return { _status: r.status || 403, error: r.reason };
      return r;
    });
  router.get('/oauth/ml/start', { summary: 'Inicia OAuth do Mercado Livre', tags: ['live'] },
    ({ query }) => live.oauth.start({ companyId: query.companyId, userId: query.userId,
                                      connectionId: query.connectionId }));
  router.get('/oauth/ml/callback', { summary: 'Callback OAuth do Mercado Livre', tags: ['live'] },
    ({ query }) => live.oauth.callback({ code: query.code, state: query.state }));
  router.get('/connections/board', { summary: 'Cards da área Conexões', tags: ['live'] },
    ({ query }) => live.connectionsBoard(query.companyId));
  router.post('/pilot/dry-run', { summary: 'Dry Run do anúncio piloto (sem chamada externa)', tags: ['live'] },
    ({ body }) => live.pilot.dryRun(body));
  router.post('/pilot/:runId/confirm', { summary: 'Confirmação explícita do piloto', tags: ['live'] },
    ({ params, body }) => live.pilot.confirm(params.runId, body));
}

module.exports = { createLive, mountLive, FLAGS };

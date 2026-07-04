/* CENTRAL DE MARKETPLACE (Sprint 09) — composição.

   createCentral({ mos, clock, transport, authTransport }) monta a Central
   SOBRE a plataforma existente: mesmo registry de providers, mesma fila,
   mesmas tabelas de catálogo. Nada paralelo.

   - clock: OBRIGATÓRIO e injetado em toda a cadeia (Sprint 08.1);
   - transport: fixtures em dev/teste (kind 'fixture'); HTTP oficial no
     futuro — o pipeline não muda;
   - authTransport: troca OAuth (mock em dev; oficial no deploy). */
'use strict';
const { Queue } = require('../kernel/queue.js');
const { createMercadoLivreConnector } = require('./connectors/mercado-livre.js');
const { createShopeeConnector } = require('./connectors/shopee.js');
const { createTikTokShopConnector } = require('./connectors/tiktok-shop.js');
const { createMagaluConnector } = require('./connectors/magalu.js');
const { TokenService, CredentialProvider } = require('./credentials.js');
const { IntegrationEvents } = require('./events.js');
const { SyncOrchestrator } = require('./sync-orchestrator.js');
const { ConnectionService } = require('./connection-service.js');
const { PublicResearch } = require('./public-research.js');
const { CentralBridge } = require('./central-bridge.js');
const { DECLARATIONS, STATUS } = require('./declarations.js');
const contract = require('./connector-contract.js');

function createCentral({ mos, clock, transport, authTransport, operation = {}, credentialKey = null }) {
  if (!clock) throw new Error('createCentral exige o Clock injetado (Sprint 08.1)');
  if (!transport) throw new Error('createCentral exige um transporte (fixtures em dev)');
  const { repos, bus, logger, providers } = mos;

  /* os 4 conectores entram no MESMO registry dos providers (um registry só) */
  for (const factory of [createMercadoLivreConnector, createShopeeConnector,
                         createTikTokShopConnector, createMagaluConnector])
    providers.registerConnector(factory({ transport, clock }));

  /* fila `sync` no kernel existente — nenhuma segunda infraestrutura */
  const syncQueue = mos.queues.sync || (mos.queues.sync = new Queue('sync', { concurrency: 4, logger }));

  const tokens = new TokenService({ key: credentialKey });
  const credentials = new CredentialProvider({ repos, tokenService: tokens, clock,
    authTransport, logger: logger.child({ mod: 'central-credentials' }) });
  const events = new IntegrationEvents({ repos, bus, clock });
  const orchestrator = new SyncOrchestrator({ repos, bus, queue: syncQueue,
    registry: providers, events, clock,
    logger: logger.child({ mod: 'central-sync' }), operation });
  const connections = new ConnectionService({ repos, bus, registry: providers,
    credentials, orchestrator, clock, authTransport,
    logger: logger.child({ mod: 'central-connect' }) });
  const research = new PublicResearch({ repos, bus, clock });

  const central = {
    clock, transport, credentials, events, orchestrator, connections, research,
    registry: providers, declarations: DECLARATIONS, STATUS,
    readOnly: true,                                    // lei do Sprint 09
    bridge: null,
    /* liga o cérebro: sinais reais passam a alimentar graph + EPE + plano */
    attachMIE(mie) {
      central.bridge = new CentralBridge({ mosBus: bus, mie,
        logger: logger.child({ mod: 'central-bridge' }) });
      return central.bridge;
    },
  };
  return central;
}

module.exports = { createCentral, ...contract };

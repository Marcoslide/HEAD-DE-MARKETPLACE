/* Composição da plataforma MOS (Bloco 02).
   createMOS() monta kernel + infraestrutura + aplicação. Único lugar
   que conhece implementações concretas (Clean Architecture). */
'use strict';
const { EventBus } = require('./kernel/event-bus.js');
const { Queue } = require('./kernel/queue.js');
const { Logger } = require('./kernel/logger.js');
const { Database } = require('./infrastructure/db/database.js');
const { createRepositories } = require('./infrastructure/db/repositories.js');
const { createServices } = require('./application/services.js');
const { createProviderRegistry } = require('./providers/index.js');
const { PublicationService } = require('./application/publication-service.js');

function createMOS({ dbFile = ':memory:', logLevel = 'warn', logSink = null } = {}) {
  const logger = new Logger({ level: logLevel, sink: logSink });
  const bus = new EventBus({ logger: logger.child({ mod: 'bus' }) });
  const db = new Database(dbFile).migrate();
  const repos = createRepositories(db);

  /* toda mutação relevante vira auditoria via evento (caixa-preta) */
  bus.on('*', (payload, event) => {
    if (/\.(created|approved|refused|imported|version_created)$/.test(event.type))
      repos.audit.record('bus', event.type, { detail: trim(payload) });
  });

  const queues = {
    collector: new Queue('collector', { concurrency: 8, logger }),
    publication: new Queue('publication', { concurrency: 4, logger }),
    analysis: new Queue('analysis', { concurrency: 8, logger }),
    notifications: new Queue('notifications', { concurrency: 4, logger }),
  };

  const services = createServices({ repos, bus, logger });
  const providers = createProviderRegistry();
  services.publication = new PublicationService({ repos, bus, queues, providers, logger });

  return { db, repos, bus, queues, services, providers, logger,
    close: () => db.close() };
}

function trim(p) {
  if (!p || typeof p !== 'object') return p;
  const out = {};
  for (const k of Object.keys(p).slice(0, 6))
    if (typeof p[k] !== 'object') out[k] = p[k];
  return out;
}

module.exports = { createMOS };

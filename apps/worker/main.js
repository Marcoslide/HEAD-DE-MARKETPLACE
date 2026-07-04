/* HEAD MARKETPLACE OS · worker de produção (10.D)
   Processa a fila durável — jobs sobrevivem a restart porque vivem no
   banco, não na memória. Loop com heartbeat; parada limpa via SIGTERM. */
'use strict';
const { envConfig, openDb, migrate, createLogger, createAudit } = require('../../mos/src/production/core.js');
const { createSecurity } = require('../../mos/src/production/security.js');
const { createStorage } = require('../../mos/src/production/storage.js');
const { createQueue, createImportService, createWorker } = require('../../mos/src/production/jobs.js');

function createWorkerApp(opts) {
  const cfg = envConfig(opts && opts.env, opts && opts.baseDir);
  const db = openDb(cfg);
  migrate(db);
  const logger = createLogger(cfg);
  const audit = createAudit(db, cfg);
  createSecurity(db, audit, logger); /* garante enforcement carregado */
  const storage = createStorage(db, cfg, audit);
  const queue = createQueue(db, audit);
  const imports = createImportService(db, audit);
  const worker = createWorker(db, queue, imports, storage, logger);
  return { cfg, db, queue, worker, imports, storage };
}

if (require.main === module) {
  const app = createWorkerApp();
  console.log(`[${app.cfg.env}] worker ativo — fila durável no banco`);
  let vivo = true;
  process.on('SIGTERM', () => { vivo = false; });
  (function loop() {
    if (!vivo) return process.exit(0);
    const r = app.worker.tick();
    setTimeout(loop, r ? 50 : 1000);
  }());
}
module.exports = { createWorkerApp };

#!/usr/bin/env node
/* db:migrate | db:rollback | db:status | backup — sempre no ambiente HEAD_ENV */
'use strict';
const core = require('../../mos/src/production/core.js');
const { createBackup } = require('../../mos/src/production/jobs.js');
const cmd = process.argv[2];
const cfg = core.envConfig();
const db = core.openDb(cfg);
if (cmd === 'migrate') {
  const a = core.migrate(db);
  console.log(`[${cfg.env}] migrations aplicadas:`, a.length ? a.join(', ') : 'nenhuma pendente');
} else if (cmd === 'status') {
  console.table(core.migrationStatus(db));
} else if (cmd === 'rollback') {
  const r = core.rollbackMigration(db);
  console.log(`[${cfg.env}] revertida:`, r || 'nada a reverter');
} else if (cmd === 'backup') {
  const m = createBackup(db, cfg).create();
  console.log(`[${cfg.env}] backup ${m.id} — sha256 ${m.db_sha256.slice(0, 16)}…`);
} else {
  console.error('uso: db.js migrate|rollback|status|backup'); process.exit(1);
}
db.close();

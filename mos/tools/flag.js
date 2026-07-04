#!/usr/bin/env node
/* FEATURE FLAGS — ferramenta de ativação (roda NO SERVIDOR, nunca via HTTP).

   As flags vivem no banco, por empresa/conta/usuário, e nascem DESLIGADAS.
   Não existe rota HTTP para ligá-las de propósito: ligar uma flag é ato
   administrativo consciente, feito por quem tem acesso ao servidor.

   Uso:
     node mos/tools/flag.js list  <companyId>
     node mos/tools/flag.js set   <FLAG> <companyId> on|off [accountId] [userId]

   Exemplo (FASE 2 do runbook):
     node mos/tools/flag.js set MERCADO_LIVRE_OAUTH_ENABLED cmp-1 on */
'use strict';
const { createMOS } = require('../src/index.js');
const { FeatureFlags, FLAGS } = require('../src/live/feature-flags.js');
const MIE = require('../../mie/src/index.js');

const [, , cmd, ...args] = process.argv;
const dbFile = (process.env.MOS_DB_FILE || './data/mos.db').trim();
const mos = createMOS({ dbFile, logLevel: 'warn' });
const flags = new FeatureFlags({ repos: mos.repos, clock: MIE.systemClock });

if (cmd === 'list') {
  const [companyId] = args;
  if (!companyId) { console.error('uso: flag.js list <companyId>'); process.exit(1); }
  for (const f of FLAGS)
    console.log(`  ${flags.isEnabled(f, { companyId }) ? '●' : '○'} ${f}`);
} else if (cmd === 'set') {
  const [flag, companyId, state, accountId, userId] = args;
  if (!FLAGS.includes(flag)) {
    console.error(`flag desconhecida: ${flag}\nflags válidas:\n  ${FLAGS.join('\n  ')}`);
    process.exit(1);
  }
  if (!companyId || !['on', 'off'].includes(state)) {
    console.error('uso: flag.js set <FLAG> <companyId> on|off [accountId] [userId]');
    process.exit(1);
  }
  flags.set(flag, { companyId, accountId: accountId || null, userId: userId || null },
    state === 'on');
  console.log(`${state === 'on' ? '●' : '○'} ${flag} → ${state} ` +
    `(empresa ${companyId}${accountId ? `, conta ${accountId}` : ''}${userId ? `, usuário ${userId}` : ''})`);
} else {
  console.error('comandos: list | set  (ver cabeçalho do arquivo)');
  process.exit(1);
}

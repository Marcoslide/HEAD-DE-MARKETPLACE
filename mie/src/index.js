/* Ponto de entrada Node do MIE. No navegador, carregar os mesmos arquivos
   como <script> na ordem abaixo (ver mie/debug/index.html). */
'use strict';

const NS = require('./_ns.js');
require('./core/config.js');
require('./core/audit-log.js');
require('./core/event-bus.js');
require('./sim/world.js');
require('./engines/memory.js');
require('./specialists/roster.js');
require('./specialists/council.js');
require('./specialists/index.js');
require('./playbooks/index.js');
require('./engines/observation.js');
require('./engines/investigation.js');
require('./engines/prioritization.js');
require('./engines/execution.js');
require('./engines/learning.js');
require('./engines/scheduler.js');
require('./head-reporter.js');
require('./create.js');

module.exports = NS;

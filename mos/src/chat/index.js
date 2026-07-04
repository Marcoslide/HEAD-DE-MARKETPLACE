/* HEAD CHAT (Sprint 09.A) — ponto de entrada Node.
   No navegador, carregar os MESMOS arquivos como <script> nesta ordem
   (ver design/prototipo-v3/index.html) — globalThis.HEADCHAT.
   Uma implementação só: API, testes e protótipo v3 consomem a mesma. */
'use strict';
const NS = require('./_ns.js');
require('./interpreter.js');
require('./period.js');
require('./demo-dataset.js');
require('./query-layer.js');
require('./composer.js');
require('./head-chat.js');

module.exports = {
  createHeadChat: NS.createHeadChat,
  HeadChat: NS.HeadChat,
  QueryLayer: NS.QueryLayer,
  createDemoDataset: NS.createDemoDataset,
  datasetFromCentral: NS.datasetFromCentral,
  interpreter: NS,      // classify/extract/norm/PLATFORMS/METRICS
  NS,
};

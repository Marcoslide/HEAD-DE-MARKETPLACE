/* HEAD CHAT (Sprint 09.A) — composição.

   createHeadChat({ clock, mie, mos, companyId }):
   - com MOS + empresa sincronizada pela Central → dados NORMALIZADOS;
   - sem dados reais → Demo Operational Dataset (fixtures coerentes).
   O chat não muda entre os dois — só a fonte (e o rodapé diz qual é). */
'use strict';
const { HeadChat } = require('./head-chat.js');
const { createDemoDataset, datasetFromCentral } = require('./demo-dataset.js');
const { QueryLayer } = require('./query-layer.js');
const interpreter = require('./interpreter.js');

function createHeadChat({ clock, mie = null, mos = null, companyId = null, dataset = null } = {}) {
  if (!clock) throw new Error('createHeadChat exige o Clock injetado');
  let data = dataset;
  if (!data && mos && companyId)
    data = datasetFromCentral(mos.repos, companyId, clock);   // dados normalizados, se houver
  if (!data)
    data = createDemoDataset(clock);                           // preview: fixtures coerentes
  return new HeadChat({ dataset: data, clock, mie, companyId,
    logger: mos ? mos.logger.child({ mod: 'head-chat' }) : null });
}

module.exports = { createHeadChat, HeadChat, QueryLayer, createDemoDataset, datasetFromCentral, interpreter };

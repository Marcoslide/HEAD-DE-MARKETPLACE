/* Demo do MOS — sobe a plataforma inteira com dados simulados vivos.
   Uso: node mos/demo.js   → imprime a URL do painel /__dev
   (Bloco 12: painel interno de desenvolvimento; nada disso é produto) */
'use strict';
const { createMOS } = require('./src/index.js');
const { createApi } = require('./src/interfaces/http/api.js');
const { Collector } = require('./src/collector/index.js');
const { ConversationEngine, SimulatedChannel } = require('./src/whatsapp/index.js');
const { MieBridge } = require('./src/application/mie-bridge.js');
const MIE = require('../mie/src/index.js');

async function main() {
  const mos = createMOS({ logLevel: 'info' });

  /* empresa semeada */
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'Marcos WS', userName: 'Marcos', email: 'marcos@demo.br',
    companyName: 'Quadros & Cia', marketplaces: ['mercado_livre', 'shopee'],
  });
  mos.services.catalog.importListings(company.id, connections[0].id, [
    { title: 'Quadro Paisagem 60x90', price: 189, ranking: 6, healthScore: 58 },
    { title: 'Quadro Personalizado Nome Família', price: 159, ranking: 1, healthScore: 89 },
  ]);
  mos.services.catalog.importListings(company.id, connections[1].id, [
    { title: 'Kit 3 Quadros Sala Abstrato', price: 249, ranking: 11, healthScore: 71 },
  ]);

  /* MIE acoplado (motores + especialistas visíveis no painel) */
  const mie = MIE.createMIE({ seed: 42 });

  /* MIE → plataforma: a ponte formal espelha investigações, decisões e
     incidentes nos repositórios persistentes (recomendação nº 1 do CTO). */
  const products = mos.repos.product.page({ limit: 10 }).items;
  const productMap = { p1: products[0]?.id, p3: products[1]?.id };
  new MieBridge({ mieBus: mie.bus, mos, companyId: company.id, productMap, logger: mos.logger });

  mie.runDays(MIE.WARMUP_DAYS + 2);
  mie.world.applyScenario('price-war', { productId: 'p1' });
  mie.runDays(3);

  /* collector vigiando um concorrente */
  const product = mos.repos.product.page({ limit: 1 }).items[0];
  const competitor = mos.repos.competitor.insert({
    product_id: product.id, name: 'ArteParede', external_ref: 'arteparede-60x90', weakness: 'embalagem' });
  const collector = new Collector({ repos: mos.repos, bus: mos.bus, queue: mos.queues.collector, logger: mos.logger });

  /* WhatsApp simulado */
  const channel = new SimulatedChannel();
  new ConversationEngine({ services: mos.services, repos: mos.repos, bus: mos.bus,
    queues: mos.queues, channel, companyId: company.id, logger: mos.logger });

  /* vida contínua: um ciclo de vigília a cada 3s */
  setInterval(() => {
    mie.tick();
    collector.tick([{ ref: 'arteparede-60x90', competitorId: competitor.id }]);
  }, 3000);

  const server = await createApi(mos, { dev: true, mie }).listen(process.env.PORT || 0);
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`\nMOS demo no ar:\n  painel dev → ${url}/__dev\n  openapi    → ${url}/openapi.json\n`);
}

main();

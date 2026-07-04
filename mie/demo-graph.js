/* Demo do Knowledge Graph (Sprint 07).
   Uso: node mie/demo-graph.js
   Mostra o Head PENSANDO EM RELAÇÕES: primeiro ele resolve uma queda de
   conversão e aprende; depois, numa queda parecida, ele CONSULTA o grafo e
   reaproveita o aprendizado anterior antes de recomendar — em vez de tratar
   cada evento como isolado (a diferença para um dashboard). */
'use strict';
const NS = require('./src/index.js');
const line = (n = 66) => '─'.repeat(n);

const mie = NS.createMIE({ seed: 42 });
mie.runDays(NS.WARMUP_DAYS + 2);

console.log('\n' + line());
console.log('  KNOWLEDGE GRAPH — o cérebro associativo do Head');
console.log(line());

/* ---- 1ª ocorrência: o Head resolve e APRENDE ---- */
console.log('\n▸ 1ª queda de conversão no Quadro Paisagem 60x90:\n');
mie.world.applyScenario('price-war', { productId: 'p1' });
mie.runDays(4);
const d1 = mie.prioritization.pendingDecisions().find(x => x.diagnosis.proposal.type === 'reposition');
console.log(`   Diagnóstico: ${d1.diagnosis.causeLabel}`);
console.log(`   Recomendação: ${d1.diagnosis.proposal.type} (aprovada)`);
mie.approve(d1.id);
mie.runDays(NS.MEASUREMENT_WINDOW + 2); // mede → aprende → popula o grafo

console.log('\n   → O resultado virou conhecimento no grafo:');
for (const w of mie.graph.whatWorkedForCategory('Quadros'))
  console.log(`     • estratégia "${w.label}" funcionou para a categoria Quadros (peso ${w.weight})`);

/* ---- 2ª ocorrência: o Head CONSULTA o grafo e reutiliza ---- */
console.log('\n▸ 2ª queda parecida no MESMO produto — agora o Head já tem memória:\n');
mie.world.applyScenario('price-war', { productId: 'p1' });
mie.runDays(4);

const caseWithGraph = [...mie.investigation.cases].reverse()
  .find(c => c.findings.consultar_grafo && c.anomaly.productId === 'p1');
const gc = caseWithGraph.findings.consultar_grafo;
console.log('   Antes de recomendar, o Head consultou o cérebro associativo:');
console.log(`     • aprendizados reaproveitáveis: ${gc.aprendizadosReaproveitaveis.join(', ') || '(nenhum)'}`);
console.log(`     • concorrentes que já impactaram: ${gc.concorrentesQueImpactaram.join(', ') || '(nenhum)'}`);

const reused = caseWithGraph.diagnosis.graph && caseWithGraph.diagnosis.graph.reused;
if (reused && reused.length)
  console.log(`\n   → O Head REUTILIZOU "${reused[0].label}" (precedente vencedor) em vez de partir do zero.`);

/* ---- consultas associativas ---- */
console.log('\n' + line());
console.log('  CONSULTAS INTERNAS (o que um dashboard não sabe responder):');
console.log(line());
const g = mie.graph;
const show = (titulo, arr) => console.log(`\n  ${titulo}\n    ${arr.length ? arr.map(x => `${x.label} (${x.weight ?? x.count})`).join(', ') : '(nada relevante)'}`);
show('O que já funcionou para o Quadro Paisagem?', g.whatWorkedForProduct('p1'));
show('Quais concorrentes mais impactaram este produto?', g.competitorsImpacting('p1'));
show('Quais ações pioraram a conversão?', g.actionsHurtConversion());

console.log('\n' + line());
const s = g.stats();
console.log(`  Grafo: ${s.nodes} nós · ${s.edges} relações (${s.liveEdges} vivas). Interno — o usuário nunca vê.`);
console.log(line() + '\n');

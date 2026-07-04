/* Demo do Specialists Engine (Sprint 06).
   Uso: node mie/demo-specialists.js
   Mostra o Conselho deliberando sobre um caso real — os pareceres
   individuais (internos), o consenso ponderado e a posição consolidada
   que o Head assumiria (Art. 11: só a posição única é do Head). */
'use strict';
const NS = require('./src/index.js');

function line(n = 64) { return '─'.repeat(n); }

const mie = NS.createMIE({ seed: 42 });
mie.runDays(NS.WARMUP_DAYS + 2);
mie.world.applyScenario('price-war', { productId: 'p1' });
mie.runDays(4);

const c = [...mie.investigation.cases].reverse()
  .find(x => x.council && x.anomaly.productId === 'p1' && x.council.consolidated.recomendacao !== 'observe');

const produto = mie.world.product('p1').name;
console.log('\n' + line());
console.log(`  CONSELHO DE ESPECIALISTAS — "${produto}"`);
console.log(`  Pergunta: por que mudar este anúncio?`);
console.log(line() + '\n');

console.log('  PARECERES INDEPENDENTES (internos — o dono não vê nomeados):\n');
for (const p of c.pareceres) {
  const pct = Math.round(p.confidence * 100);
  const act = p.recommendationType ? ` → ${p.recommendationType}` : ' → (consultivo)';
  console.log(`  • ${p.label} (${pct}%${act})`);
  console.log(`      ${p.diagnostico}`);
  if (p.stance !== 'neutral' && p.riscos.length) console.log(`      risco: ${p.riscos[0]}`);
}

const co = c.council;
console.log('\n' + line());
console.log('  DELIBERAÇÃO DO CONSELHO:\n');
console.log(`  Concordância (${co.agreements.length}): ${co.agreements.join(', ')}`);
console.log(`  Divergentes: ${co.divergent.map(d => `${d.domain} (${d.recommendationType || 'consultivo'})`).join(', ') || '(nenhum)'}`);
console.log(`  Conflitos: ${co.conflicts.length ? co.conflicts.map(x => x.about).join('; ') : 'nenhum'}`);
console.log(`  Consenso ponderado: "${co.consensus.recommendation}" · confiança ${Math.round(co.consensus.confidence * 100)}% · força ${Math.round(co.consensus.strength * 100)}%`);

console.log('\n' + line());
console.log('  POSIÇÃO CONSOLIDADA (a única que o Head assume — Art. 11):\n');
console.log(`  ${co.consolidated.diagnostico}`);
console.log(`  Recomendação: ${co.consolidated.recomendacao} · urgência ${co.consolidated.urgencia}`);
console.log(`  Especialistas creditados se der certo: ${co.consolidated.contributingDomains.join(', ')}`);
console.log('\n' + line() + '\n');

/* aprendizado: mostra que os pesos evoluem com o resultado */
const before = mie.memory.specialistsSnapshot();
const decision = mie.prioritization.pendingDecisions().find(d => d.productId === 'p1' && d.diagnosis.proposal.type === 'reposition');
if (decision) {
  mie.approve(decision.id);
  mie.runDays(NS.MEASUREMENT_WINDOW + 2);
  console.log('  APRENDIZADO — pesos dos especialistas após o resultado medido:\n');
  for (const s of mie.memory.specialistsSnapshot())
    console.log(`  • ${s.domain}: ${s.hits}/${s.predictions} acertos · peso ${s.weight}`);
  console.log('\n' + line() + '\n');
}

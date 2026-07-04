/* Demo do Executive Planning Engine (Sprint 08).
   Uso: node mie/demo-executive.js
   Mostra o Head PRIORIZANDO como um diretor: encontra muitos sinais,
   filtra a maioria, e traz ao dono só o que merece — com o raciocínio
   auditável de cada escolha. */
'use strict';
const NS = require('./src/index.js');
const line = (n = 68) => '─'.repeat(n);

const mie = NS.createMIE({ seed: 42 });
mie.runDays(NS.WARMUP_DAYS + 2);
// um dia agitado: várias frentes ao mesmo tempo
mie.world.applyScenario('price-war', { productId: 'p1' });
mie.world.applyScenario('returns-spike', { productId: 'p3' });
mie.world.applyScenario('stockout-risk', { productId: 'p2' });
mie.world.applyScenario('ctr-noise', { productId: 'p4' });
mie.runDays(4);

const plan = mie.planDay({ capacity: { missions: 5, decisions: 2 } });

console.log('\n' + line());
console.log('  PLANO DO DIA — Executive Planning Engine');
console.log(line() + '\n');

const f = plan.funnel;
console.log(`  ${plan.greeting}\n`);
console.log(`  Encontrei ${f.signalsFound} sinais.`);
console.log(`  Ignorei ${f.signalsIgnored} por baixo impacto.`);
console.log(`  Investiguei ${f.investigated}.`);
console.log(`  ${f.missionsCreated} viraram missões; resolvi ${f.resolved} sozinho.`);
console.log(`  Trouxe ${f.decisionsForOwner} decisões para você.\n`);

console.log('  HOJE SUA ATENÇÃO DEVE IR PARA:');
plan.attention.forEach((a, i) => console.log(`    ${i + 1}. [${a.level}] ${a.title}\n       ${a.why}`));

console.log('\n' + line());
console.log('  COMO O EPE PRIORIZOU (auditável):\n');
for (const d of plan.decisions) {
  console.log(`  ▸ ${d.title}`);
  console.log(`    nível: ${d.level} · score ${d.score}`);
  console.log(`    impacto R$ ${d.breakdown.impact}/mês · urgência ${d.breakdown.urgency} · confiança ${d.breakdown.confidence} · esforço ${d.breakdown.effort}`);
  console.log(`    risco de esperar: ${d.breakdown.riskOfWaiting} · risco de agir cedo: ${d.breakdown.riskOfActingEarly}`);
  console.log(`    fatores: ${d.breakdown.factors.map(x => `${x[0]} ×${x[1]}`).join(', ')}\n`);
}

console.log(line());
console.log('  O QUE O EPE DECIDIU NÃO MOSTRAR (silêncio inteligente):\n');
for (const s of plan.silence.slice(0, 6)) console.log(`    • ${s.title}\n      → ${s.reason}`);

console.log('\n' + line());
console.log('  DISTRIBUIÇÃO POR NÍVEL EXECUTIVO:');
console.log('    ' + Object.entries(plan.levelBreakdown).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(' · '));
console.log(`\n  ${plan.signature}`);
console.log(line() + '\n');

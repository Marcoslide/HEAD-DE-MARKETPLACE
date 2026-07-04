/* Demo do CATALOG, RULE & COMPLIANCE ENGINE (Sprint 10).
   Uso: node mos/demo-compliance.js
   Determinística (Clock congelado). Mostra os 4 cenários: validação,
   blockers, warnings, requisitos faltantes, rascunho interno e o sinal
   ao EPE — EXECUÇÃO INTERNA APENAS, nenhuma escrita externa. */
'use strict';
const { createMOS } = require('./src/index.js');
const { CatalogService } = require('./src/catalog/catalog-service.js');
const C = require('./src/compliance/index.js');
const MIE = require('../mie/src/index.js');

const line = (n = 72) => '─'.repeat(n);
const clock = MIE.frozenClock('2026-07-04T12:00:00Z');

const mos = createMOS();
const mie = MIE.createMIE({ seed: 42, clock });
const { CentralBridge } = require('./src/central/central-bridge.js');
new CentralBridge({ mosBus: mos.bus, mie });   // sinais → EPE (INTERNAL_ONLY)

const { company } = mos.services.workspace.bootstrap({
  workspaceName: 'Fábrica de Quadros', email: 'dono@quadros.com.br',
  companyName: 'Quadros & Cia', marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'] });

const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
  providers: mos.providers, clock, logger: mos.logger });

console.log('\n' + line());
console.log('  CATALOG, RULE & COMPLIANCE ENGINE — validação e rascunho INTERNO');
console.log('  MODO LEITURA · nenhuma publicação, preço, estoque ou anúncio é alterado');
console.log(line());

/* 1. ingere o Product Master dos 4 cenários */
const ids = {};
for (const p of C.DEMO_PRODUCTS)
  ids[p.master.sku] = catalog.upsertMaster(company.id, p).id;
console.log(`\n  Product Master: ${Object.keys(ids).length} produtos ingeridos (perfil + assets + projeções)`);

/* 2. valida cada cenário na praça-alvo */
const CASES = [
  ['QDR-SER', 'mercado_livre', 'cenário 1 — pronto com pequenos alertas'],
  ['ESP-ORG', 'shopee', 'cenário 2 — bloqueado por ficha incompleta'],
  ['QDR-NOME', 'shopee', 'cenário 3 — personalizado com risco de prazo'],
  ['KIT3-ABS', 'magalu', 'cenário 4 — expansão impedida (sem EAN)'],
];
for (const [sku, platform, label] of CASES) {
  const r = catalog.validate(ids[sku], platform);
  console.log('\n' + line());
  console.log(`  ${label}`);
  console.log(`  ${sku} × ${platform} → ${r.status}`);
  console.log(`  rule pack ${r.rulePackVersion} (${r.dataSource}) · verificado em ${r.verifiedAt} · run ${r.runId}`);
  if (r.category) console.log(`  categoria: ${r.category.confirmed || r.category.applied || '—'}${r.category.confirmed ? ' (confirmada)' : r.category.suggestedCategory ? ` (sugerida: ${r.category.suggestedCategory}, conf. ${r.category.confidence})` : ''}`);
  for (const f of r.findings.filter(f => f.severity === 'BLOCKER'))
    console.log(`    ✗ BLOCKER  ${f.message}`);
  for (const f of r.findings.filter(f => f.severity === 'HIGH_RISK'))
    console.log(`    ! RISCO    ${f.message}${f.internal ? ' [regra interna]' : ''}`);
  for (const f of r.findings.filter(f => f.severity === 'WARNING').slice(0, 3))
    console.log(`    • alerta   ${f.message}${f.internal ? ' [regra interna]' : ''}`);
  for (const f of r.findings.filter(f => f.severity === 'UNKNOWN'))
    console.log(`    ? UNKNOWN  ${f.message}`);
  if (r.missing.length) console.log(`  faltam: ${[...new Set(r.missing)].join('; ')}`);
}

/* 3. rascunho interno do cenário pronto */
const draft = catalog.createDraft(ids['QDR-SER'], 'mercado_livre');
console.log('\n' + line());
console.log(`  RASCUNHO INTERNO gerado: ${draft.id} v${draft.version} → ${draft.status}`);
console.log(`  origem das sugestões: ${draft.suggestionsSource}`);
console.log(`  título: "${draft.payload.title}" · categoria ${draft.payload.categoryId} · preço sugerido R$ ${draft.payload.priceSuggested}`);
console.log(`  checklist: ${draft.checklist.filter(c => c.ok).length}/${draft.checklist.length} itens ok · READ_ONLY=${draft.readOnly}`);

/* 4. sinais de compliance → EPE (execução interna apenas) */
const { delivered } = catalog.refreshComplianceSignals(company.id);
mie.runDays(MIE.WARMUP_DAYS + 2);
const plan = mie.planDay();
console.log('\n' + line());
console.log(`  SINAIS DE COMPLIANCE → EPE: ${delivered.length}`);
for (const s of delivered) console.log(`    • [${s.playbook}] ${s.title}`);
const fromCompliance = [...plan.decisions, ...plan.missions, ...plan.investigations]
  .filter(x => x.playbook && x.playbook.startsWith('compliance-'));
console.log(`\n  No Plano do Dia (todos INTERNAL_ONLY):`);
for (const d of fromCompliance)
  console.log(`    ▸ [${d.level}] ${d.title} · executionScope=${d.executionScope}`);

/* 5. histórico auditável */
const history = catalog.history(ids['ESP-ORG'], 'shopee');
console.log('\n' + line());
console.log(`  TRILHA DE AUDITORIA: ${history.length} validação(ões) preservada(s) para ESP-ORG × shopee`);
console.log(`  "Por que estava bloqueado em 04/07?" → run ${history[0].id}: ${history[0].status}, pack ${history[0].rule_pack_version}, executado ${history[0].executed_at}`);
console.log(line() + '\n');
mos.close();

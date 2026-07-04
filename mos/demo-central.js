/* Demo da CENTRAL DE MARKETPLACE (Sprint 09).
   Uso: node mos/demo-central.js

   O fluxo vertical completo, com dados de FIXTURES realistas:

     conexão autenticada (mock) → sync → bruto preservado → normalização
     → eventos idempotentes → sinais → Knowledge Graph → EPE → Plano do Dia

   Cenário: um quadro vende forte na Shopee; estoque crítico; margem melhor
   no ML; ausente no Magalu; vídeo do nicho crescendo no TikTok Shop;
   fábrica com capacidade limitada para personalizados. */
'use strict';
const { createMOS } = require('./src/index.js');
const { createCentral } = require('./src/central/index.js');
const { FixtureTransport, MockAuthTransport, OPERATION } = require('./src/central/fixtures/index.js');
const MIE = require('../mie/src/index.js');

const line = (n = 70) => '─'.repeat(n);

async function main() {
  /* Clock congelado: a demo é determinista (Sprint 08.1) */
  const clock = MIE.frozenClock('2026-07-04T12:00:00Z');

  const mos = createMOS();
  const mie = MIE.createMIE({ seed: 42, clock });
  const central = createCentral({
    mos, clock,
    transport: new FixtureTransport(),
    authTransport: new MockAuthTransport(),
    operation: OPERATION,
  });
  central.attachMIE(mie);

  /* 1. empresa com as 4 praças */
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'Fábrica de Quadros', email: 'dono@quadros.com.br',
    companyName: 'Quadros & Cia',
    marketplaces: ['mercado_livre', 'shopee', 'tiktok', 'magalu'],
  });

  console.log('\n' + line());
  console.log('  CENTRAL DE MARKETPLACE — conexão → sync → sinais → Plano do Dia');
  console.log('  MODO: FIXTURES/MOCK — integração real pendente de ativação');
  console.log('  (OAuth real + transporte HTTP oficial entram com a 1ª loja real)');
  console.log(line());

  /* 2. conector ativado em modo fixture (mock) — nunca conta real */
  for (const conn of connections) {
    const r = await central.connections.connectMock(conn.id);
    const st = central.connections.status(conn.id);
    console.log(`  ✓ ${r.platform.padEnd(14)} conector ativado (fixture) · conta ${r.accountId} · loja ${r.storeId}` +
      ` · token ${st.credential.tokenMasked} · READ_ONLY=${st.readOnly}`);
  }

  /* 3. sincronização oficial (jobs na fila `sync` do kernel) */
  await central.orchestrator.onIdle();
  console.log('\n  Sincronização inicial concluída:');
  for (const s of mos.repos.syncState.byCompany(company.id))
    console.log(`    ${s.platform.padEnd(14)} ${s.resource.padEnd(10)} ${s.status} · lidos ${s.records_read} · criados ${s.records_created} · ignorados ${s.records_ignored}`);

  console.log(`\n  Payload bruto preservado: ${mos.repos.rawPayload.count()} lotes (auditoria)`);
  console.log(`  Eventos idempotentes: ${mos.repos.integrationEvent.count()} publicados, ${central.events.duplicates} duplicados bloqueados`);

  /* 4. sinais de negócio → grafo + EPE */
  const { delivered } = central.orchestrator.refreshSignals(company.id);
  console.log(`\n  SINAIS GERADOS (${delivered.length}) — playbooks da Central:`);
  for (const s of delivered)
    console.log(`    • [${s.playbook}] ${s.title}\n      prova: ${JSON.stringify(s.evidence)}`);

  /* 5. o Plano do Dia com os dados REAIS das quatro praças */
  mie.runDays(MIE.WARMUP_DAYS + 2);
  const plan = mie.planDay({ capacity: { missions: 5, decisions: 2 } });

  console.log('\n' + line());
  console.log(`  PLANO DO DIA — gerado em ${plan.generatedAtIso} (${plan.timezone}, dia ${plan.dateKey})`);
  console.log(line());
  console.log(`\n  ${plan.greeting}\n`);
  console.log('  HOJE SUA ATENÇÃO DEVE IR PARA:');
  plan.attention.forEach((a, i) => console.log(`    ${i + 1}. [${a.level}] ${a.title}\n       ${a.why}`));

  console.log('\n  DECISÕES (com rastreabilidade até a praça):');
  for (const d of plan.decisions) {
    console.log(`    ▸ ${d.title}`);
    console.log(`      nível ${d.level} · score ${d.score} · impacto R$ ${d.impactMonthly.toLocaleString('pt-BR')}/mês`);
    if (d.provenance)
      console.log(`      origem: ${d.provenance.platform} · conta ${d.provenance.accountId} · entidade ${d.provenance.entityId} · evento ${d.provenance.eventId}`);
  }
  console.log('\n  MISSÕES:');
  for (const m of plan.missions) {
    const label = m.executionScope === 'INTERNAL_ONLY' ? 'EXECUÇÃO INTERNA DO HEAD' : m.level;
    console.log(`    ▸ [${label}] ${m.title}${m.provenance ? ` (via ${m.provenance.platform})` : ''}`);
    if (m.executionScope === 'INTERNAL_ONLY')
      console.log('      → ação interna: priorizar fila/alertar responsável — NADA é alterado no marketplace (READ_ONLY)');
  }
  if (plan.investigations.length) {
    console.log('\n  INVESTIGAÇÕES ABERTAS:');
    for (const i of plan.investigations) console.log(`    ▸ ${i.title}`);
  }

  console.log(`\n  Grafo: ${JSON.stringify(mie.graph.stats())}`);
  console.log(`  Ponte Central→MIE: ${JSON.stringify(central.bridge.stats)}`);
  console.log(`\n  ${plan.signature}`);
  console.log(line() + '\n');
  mos.close();
}

main().catch(e => { console.error(e); process.exit(1); });

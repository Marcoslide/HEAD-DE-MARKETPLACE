/* SPRINT 09.A — HEAD CONVERSATIONAL OPERATING INTELLIGENCE: testes.
   Trava do sprint: zero respostas hardcoded, zero números inventados;
   intenção → consulta tipada → fonte de dados; sem dado = honestidade. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHeadChat, createDemoDataset, datasetFromCentral, interpreter } = require('../src/chat/index.js');
const { createMOS } = require('../src/index.js');
const { createApi } = require('../src/interfaces/http/api.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport, OPERATION } = require('../src/central/fixtures/index.js');
const MIE = require('../../mie/src/index.js');

const CLOCK_ISO = '2026-07-04T14:58:00Z';          // 11:58 em America/Sao_Paulo
const clock = () => MIE.frozenClock(CLOCK_ISO);
const fresh = () => createHeadChat({ clock: clock() });

/* 1 + 2 — classificação de intenção operacional */
test('perguntas factuais são OPERATIONAL_QUERY (vendas e Ads)', () => {
  assert.equal(interpreter.classify('Quanto eu vendi hoje?'), 'OPERATIONAL_QUERY');
  assert.equal(interpreter.classify('Quanto gastei de Ads?'), 'OPERATIONAL_QUERY');
  assert.equal(interpreter.classify('quanto entrou hj'), 'OPERATIONAL_QUERY');
  assert.equal(interpreter.classify('como estao as vendas'), 'OPERATIONAL_QUERY');
});

/* 3 — expedição é expedição, não contagem genérica */
test('"Quantos pedidos faltam enviar?" consulta a expedição', () => {
  const r = fresh().ask('Quantos pedidos faltam enviar?');
  assert.equal(r.facts.kind, 'FULFILLMENT');
  assert.equal(r.facts.toShip, 38);
  assert.match(r.reply, /38 pedidos para enviar/);
  assert.match(r.reply, /produção/);
});

/* 4 + 17 — conversão SEMPRE com denominador explícito */
test('conversão retorna métrica com base de cálculo explícita', () => {
  const r = fresh().ask('Como está minha conversão?');
  assert.equal(r.facts.kind, 'CONVERSION');
  for (const row of r.facts.rows) {
    assert.match(row.convBasis, /pedidos aprovados \/ .*visitas/);
    assert.match(row.ctrBasis, /cliques \/ .*impress/);
  }
  assert.match(r.reply, /pedidos aprovados \/ /, 'a resposta mostra a base, não só o %');
});

/* 5 + 18 — pedidos: sentidos distintos na mesma resposta */
test('"Quantos pedidos eu fiz?" responde recebidos E situação operacional', () => {
  const r = fresh().ask('Quantos pedidos eu fiz hoje?');
  assert.equal(r.facts.kind, 'ORDERS');
  assert.equal(r.facts.received, 62);
  assert.equal(r.facts.operational.shippedToday, 41);
  assert.match(r.reply, /entraram 62 pedidos/);
  assert.match(r.reply, /enviados/);
  /* distinção recebido × enviado × atrasado × pendente */
  const late = fresh().ask('Quantos pedidos estão atrasados?');
  assert.ok(late.facts.statusFilter.includes('late'));
  assert.match(late.reply, /Atrasados agora: 2/);
});

/* 6 — pergunta factual NUNCA cria missão/proposta/sinal */
test('pergunta factual não cria missão, proposta nem sinal', () => {
  const mie = MIE.createMIE({ seed: 42, clock: clock() });
  const chat = createHeadChat({ clock: clock(), mie });
  const before = {
    signals: mie.epe.externalSignals.length,
    pending: mie.prioritization.pendingDecisions().length,
    proposals: chat.proposals.length,
  };
  chat.ask('Quanto eu vendi hoje?');
  chat.ask('Quantos pedidos faltam enviar?');
  assert.equal(mie.epe.externalSignals.length, before.signals);
  assert.equal(mie.prioritization.pendingDecisions().length, before.pending);
  assert.equal(chat.proposals.length, before.proposals);
});

/* 7 — pergunta factual nunca recebe "anotei"/"vou considerar" */
test('resposta factual não é anotação nem promessa', () => {
  const r = fresh().ask('Quanto eu vendi hoje?');
  assert.doesNotMatch(r.reply, /anotei|vou considerar|proxima rodada|próxima rodada|vou analisar depois|levo isso em conta/i);
  assert.match(r.reply, /R\$ 8\.420/, 'responde o número imediatamente');
});

/* 8 — a IA nunca inventa números: tudo vem da camada de dados */
test('números da resposta vêm da Query Layer, não do texto', () => {
  const r = fresh().ask('Quanto eu vendi hoje?');
  assert.equal(r.facts.grossRevenue, 8420);          // 4780 + 2940 + 700 (dataset)
  assert.equal(r.facts.byPlatform.shopee, 4780);
  assert.equal(r.facts.ordersCount, 62);
  /* e quando NÃO há dado, não aparece número nenhum */
  const nd = fresh().ask('Quanto vendi no TikTok?');
  assert.match(nd.reply, /Não vou inventar um número/);
  assert.doesNotMatch(nd.reply, /R\$ \d/);
});

/* 9 + 10 — período, atualização e fonte na resposta */
test('resposta informa período, horário de atualização e DEMO_FIXTURE', () => {
  const r = fresh().ask('Quanto eu vendi hoje?');
  assert.equal(r.facts.dataSource, 'DEMO_FIXTURE');
  assert.equal(r.facts.period.type, 'TODAY');
  assert.match(r.reply, /Até agora/);
  assert.match(r.reply, /Atualizado às 11:58/);
  assert.match(r.reply, /Dados demonstrativos/);
});

/* 11 — cobertura parcial é declarada */
test('cobertura parcial: TikTok aparece como não conectado', () => {
  const r = fresh().ask('Quanto eu vendi hoje?');
  assert.deepEqual(r.facts.missingPlatforms, ['tiktok']);
  assert.match(r.reply, /TikTok Shop.*sem dados conectados/s);
});

/* 12 — companyId impede mistura de empresas (fonte real da Central) */
test('isolamento por empresa no dataset da Central', async () => {
  const c = clock();
  const mos = createMOS();
  const central = createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport(), operation: OPERATION });
  const A = mos.services.workspace.bootstrap({ workspaceName: 'WA', email: 'a@a.a', companyName: 'A', marketplaces: ['shopee'] });
  const B = mos.services.workspace.bootstrap({ workspaceName: 'WB', email: 'b@b.b', companyName: 'B', marketplaces: ['mercado_livre'] });
  for (const conn of [...A.connections, ...B.connections]) await central.connections.connectMock(conn.id);
  await central.orchestrator.onIdle();
  const chatA = createHeadChat({ clock: c, mos, companyId: A.company.id });
  assert.equal(chatA.dataset.source, 'NORMALIZED_INTERNAL_DATA');
  assert.deepEqual(chatA.dataset.connectedPlatforms, ['shopee'], 'empresa A só vê a própria loja');
  const r = chatA.ask('quanto vendi este mês?');
  assert.ok(!('mercado_livre' in (r.facts.byPlatform || {})), 'nada da empresa B vaza');
  mos.close();
});

/* 13 — filtro de marketplace respeitado */
test('"Quanto vendi na Shopee?" filtra só a Shopee', () => {
  const r = fresh().ask('Quanto vendi na Shopee?');
  assert.deepEqual(Object.keys(r.facts.byPlatform), ['shopee']);
  assert.equal(r.facts.grossRevenue, 4780);
});

/* 14 + 15 — contexto conversacional */
test('"E na Shopee?" e "E ontem?" herdam métrica, período e filtros', () => {
  const chat = fresh();
  chat.ask('Quanto eu vendi hoje?');
  const shp = chat.ask('E na Shopee?');
  assert.equal(shp.query.metric, 'GROSS_REVENUE');
  assert.deepEqual(shp.query.platforms, ['shopee']);
  assert.equal(shp.query.period.type, 'TODAY');
  assert.equal(shp.facts.grossRevenue, 4780);
  const ontem = chat.ask('E ontem?');
  assert.deepEqual(ontem.query.platforms, ['shopee'], 'plataforma preservada');
  assert.equal(ontem.query.period.type, 'SAME_TIME_YESTERDAY', 'parcial compara com parcial');
  assert.equal(ontem.facts.grossRevenue, 3950);
  assert.match(ontem.reply, /mesmo horário/);
});

/* 16 — Ads com investimento, retorno e fórmulas corretas */
test('Ads: ROAS/ACOS/CPA calculados sobre os fatos', () => {
  const r = fresh().ask('quanto gastei de ads?');
  assert.equal(r.facts.spend, 340);
  assert.equal(r.facts.attributedRevenue, 1870);
  assert.equal(r.facts.roas, 5.5);                   // 1870 / 340
  assert.equal(r.facts.acosPct, 18.2);               // 340 / 1870
  assert.equal(r.facts.attributedOrders, 14);
  assert.match(r.reply, /ROAS: 5,5x/);
  assert.match(r.reply, /consumiu R\$ 126 e ainda não gerou pedido/);
});

/* 19 — estoque distingue disponível, reservado e produção */
test('estoque distingue disponível/reservado/em produção e cobertura', () => {
  const r = fresh().ask('Quanto tenho do Quadro Paisagem?');
  assert.equal(r.facts.kind, 'INVENTORY');
  assert.ok(r.facts.productScope);
  assert.match(r.reply, /disponíveis/);
  assert.match(r.reply, /reservados/);
  assert.match(r.reply, /em produção/);
  const crit = fresh().ask('O que está acabando?');
  assert.equal(crit.facts.critical.length, 1);
  assert.match(crit.reply, /Kit 3 Quadros.*4 un/s);
});

/* 20 — explicação de decisão consulta o EPE (auditável) */
test('perguntas de decisão consultam EPE com breakdown e proveniência', () => {
  const mie = MIE.createMIE({ seed: 42, clock: clock() });
  mie.epe.addExternalSignal({
    signalKey: 'stockout|shopee|8891', playbook: 'estoque-critico-campeao',
    productId: '8891', title: 'Estoque crítico do campeão na Shopee',
    impactMonthly: 25600, confidenceLabel: 'alta', urgency: 'alta', severity: 'attention',
    effort: 1, reversible: true, class: 'C', proposalType: 'replenish-stock',
    hasProposal: true, window: true, executionScope: 'INTERNAL_ONLY',
    provenance: { platform: 'shopee', accountId: 'acc-1', entityId: '8891', eventId: 'iev_x' },
  });
  mie.planDay();
  const chat = createHeadChat({ clock: clock(), mie });
  const r = chat.ask('Por que você priorizou isso?');
  assert.equal(r.facts.kind, 'DECISION_EXPLANATION');
  assert.match(r.reply, /score executivo/);
  assert.match(r.reply, /risco de esperar/);
  assert.match(r.reply, /origem: Shopee/);
});

/* 21 — comandos respeitam READ_ONLY */
test('pedido de ação vira proposta com aprovação — nunca executa', () => {
  const chat = fresh();
  for (const cmd of ['Baixe o preço do kit', 'Pause a campanha ruim', 'Publique esse produto no Magalu']) {
    const r = chat.ask(cmd);
    assert.equal(r.intent, 'ACTION_REQUEST');
    assert.match(r.reply, /READ_ONLY|modo leitura/);
    assert.match(r.reply, /aprova/i);
  }
  assert.equal(chat.proposals.length, 3);
  assert.ok(chat.proposals.every(p => p.status === 'awaiting_approval' && p.readOnlyBlocked));
});

/* 22 — falta de dados gera resposta honesta */
test('sem dados: resposta honesta, sem improviso', () => {
  const r = fresh().ask('Quanto vendi no TikTok hoje?');
  assert.match(r.reply, /não tenho dados suficientes/i);
  assert.match(r.reply, /Não vou inventar um número/);
  /* fonte real sem seções (ads/funil) também é honesta */
  const ds = { source: 'NORMALIZED_INTERNAL_DATA', isLive: true, timezone: 'America/Sao_Paulo',
    connectedPlatforms: ['shopee'], missingPlatforms: [], products: [],
    sales: { x: {} }, margins: {}, fulfillment: null, inventory: [], ads: null, funnel: null };
  const chat2 = createHeadChat({ clock: clock(), dataset: ds });
  assert.match(chat2.ask('quanto gastei de ads?').reply, /não tenho dados suficientes/i);
  assert.match(chat2.ask('quantos pedidos faltam enviar?').reply, /não tenho dados suficientes/i);
});

/* 23 — simulação é sempre cenário estimado */
test('simulações deixam claro que são estimativas', () => {
  const chat = fresh();
  const preco = chat.ask('E se eu baixar o preço em 8%?');
  assert.equal(preco.intent, 'SIMULATION');
  assert.match(preco.reply, /CENÁRIO ESTIMADO/);
  const ads = chat.ask('E se eu investir R$ 500 em Ads?');
  assert.match(ads.reply, /ESTIMADO/);
  assert.match(ads.reply, /não é garantido|SE a performance/);
});

/* 24 — alerta não substitui a resposta principal */
test('alerta vem DEPOIS da resposta, nunca no lugar dela', () => {
  const r = fresh().ask('Quanto eu vendi hoje?');
  const iResposta = r.reply.indexOf('faturou');
  const iAlerta = r.reply.indexOf('Atenção:');
  assert.ok(iResposta >= 0 && iAlerta > iResposta, 'resposta primeiro, alerta depois');
  const alertas = r.reply.match(/Atenção:/g) || [];
  assert.equal(alertas.length, 1, 'no máximo UM alerta');
});

/* 25 + 26 — briefing e fechamento com fonte e timestamp */
test('briefing da manhã e fechamento do dia carregam fonte e horário', () => {
  const chat = fresh();
  const b = chat.briefing();
  assert.match(b.message, /Vendas: R\$ 8\.420/);
  assert.match(b.message, /Atualizado às 11:58/);
  assert.match(b.message, /Dados demonstrativos/);
  const c = chat.closing();
  assert.match(c.message, /Fechamento do dia/);
  assert.match(c.message, /Fechado às 11:58/);
  assert.match(c.message, /Foco recomendado para amanhã/);
});

/* 27 — o MESMO contrato funciona com fixtures e com a Central */
test('mesmo contrato: DEMO_FIXTURE e NORMALIZED_INTERNAL_DATA', async () => {
  const c = clock();
  const demo = createHeadChat({ clock: c }).ask('quanto vendi este mês?');
  assert.equal(demo.facts.kind, 'SALES');
  assert.equal(demo.facts.dataSource, 'DEMO_FIXTURE');

  const mos = createMOS();
  const central = createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport(), operation: OPERATION });
  const { company, connections } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'c@c.c', companyName: 'C', marketplaces: ['mercado_livre'] });
  await central.connections.connectMock(connections[0].id);
  await central.orchestrator.onIdle();
  const live = createHeadChat({ clock: c, mos, companyId: company.id }).ask('quanto vendi este mês?');
  assert.equal(live.facts.kind, 'SALES', 'mesmo serviço, mesma forma de fatos');
  assert.equal(live.facts.dataSource, 'NORMALIZED_INTERNAL_DATA');
  assert.equal(live.facts.grossRevenue, 149.9, 'número vem do pedido normalizado da Central');
  /* mesmas chaves de fatos nas duas fontes */
  const keys = o => Object.keys(o).sort().join(',');
  assert.equal(keys(demo.facts), keys(live.facts));
  mos.close();
});

/* observabilidade: POST /chat + /__dev/chat */
test('/chat responde e /__dev/chat expõe intenção, consulta e fonte', async () => {
  const c = clock();
  const mos = createMOS();
  const chat = createHeadChat({ clock: c, mos: null });
  const server = await createApi(mos, { dev: true, chat }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(`${base}/chat`, { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Quanto vendi hoje?' }) }).then(x => x.json());
  assert.equal(r.intent, 'OPERATIONAL_QUERY');
  assert.match(r.reply, /R\$ 8\.420/);
  const dev = await fetch(`${base}/__dev/chat`).then(x => x.json());
  assert.equal(dev.readOnly, true);
  assert.equal(dev.lastTrace.intent, 'OPERATIONAL_QUERY');
  assert.equal(dev.lastTrace.dataSource, 'DEMO_FIXTURE');
  assert.ok(dev.lastTrace.structuredQuery.metric, 'consulta estruturada visível');
  assert.equal(dev.dataset.source, 'DEMO_FIXTURE');
  const brief = await fetch(`${base}/chat/briefing`).then(x => x.json());
  assert.match(brief.message, /Bom dia/);
  server.close(); mos.close();
});

/* feedback vira preferência (memória), não missão */
test('feedback do dono é registrado como preferência persistente', () => {
  const mie = MIE.createMIE({ seed: 42, clock: clock() });
  const chat = createHeadChat({ clock: clock(), mie });
  const r = chat.ask('Não quero baixar preço de personalizados');
  assert.equal(r.intent, 'FEEDBACK_OR_MEMORY');
  assert.match(r.reply, /Registrado como preferência/);
  assert.ok(mie.memory.knowledge.some(k => k.kind === 'preference' && /personalizados/.test(k.discovery)));
});

/* tolerância a variações informais e erro de português */
test('variações informais e com erro chegam à mesma consulta tipada', () => {
  const respostas = ['quanto eu vendi hj', 'qto entrou hoje', 'quanto faturou ate agora', 'como foi de venda hoje']
    .map(t => fresh().ask(t));
  for (const r of respostas) {
    assert.equal(r.intent, 'OPERATIONAL_QUERY');
    assert.equal(r.facts.kind, 'SALES');
    assert.equal(r.facts.grossRevenue, 8420, 'mesma consulta, mesmo fato');
  }
});

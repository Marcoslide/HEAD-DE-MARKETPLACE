/* SPRINT 10.C — HEAD INTELLIGENCE OS: as 35 garantias.
   O RID ORQUESTRA o 10.B — nenhum sistema paralelo, nenhuma escrita externa. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMOS } = require('../src/index.js');
const { createCentral } = require('../src/central/index.js');
const { FixtureTransport, MockAuthTransport } = require('../src/central/fixtures/index.js');
const { CatalogService } = require('../src/catalog/catalog-service.js');
const { createGrowth } = require('../src/growth/index.js');
const { createRID } = require('../src/rid/index.js');
const { createHeadChat } = require('../src/chat/index.js');
const C = require('../src/compliance/index.js');
const MIE = require('../../mie/src/index.js');

const clock = () => MIE.frozenClock('2026-07-04T12:00:00Z');
const PHONE = '5511988887777';

function world() {
  const c = clock();
  const mos = createMOS({ logLevel: 'warn' });
  createCentral({ mos, clock: c, transport: new FixtureTransport(),
    authTransport: new MockAuthTransport() });
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'r@x.y', companyName: 'C',
    marketplaces: ['mercado_livre', 'shopee'] });
  const owner = mos.repos.user.db.get('SELECT * FROM user LIMIT 1');
  const catalog = new CatalogService({ repos: mos.repos, bus: mos.bus,
    providers: mos.providers, clock: c, logger: mos.logger });
  const growth = createGrowth({ mos, clock: c, catalog });
  growth.margin.ensureFeeProfiles(company.id);
  for (const dp of C.DEMO_PRODUCTS) catalog.upsertMaster(company.id, dp);
  const rid = createRID({ mos, clock: c, growth });
  growth.gateway.ridHook = rid.whatsappHook;
  return { mos, c, company, owner, catalog, growth, rid };
}

const MIRROR_EVIDENCE = [
  { dimension: 'motivo-devolucao', finding: '62% dos motivos mencionam quebra, trinca ou avaria', share: 0.62 },
  { dimension: 'periodo', finding: 'alta concentrada nos últimos 14 dias', share: 0.9 },
];
const MIRROR_HYPOTHESES = [
  { text: 'proteção lateral insuficiente', evidenceDimensions: ['motivo-devolucao'],
    testAction: 'testar embalagem reforçada em lote controlado antes de mudar toda a operação' },
  { text: 'transportadora nova danifica no manuseio', evidenceDimensions: ['transportadora'] },
];

/* 1 — RID reutiliza a cadeia existente, sem fluxo paralelo */
test('RID entra na MESMA cadeia do chat (intenção → adapter → composer)', () => {
  const w = world();
  const chat = createHeadChat({ clock: w.c, companyId: w.company.id,
    rid: { registerIntervention: (t, o) => w.rid.chatAdapter.registerIntervention(t, { ...o }),
           report: (t, o) => w.rid.chatAdapter.report(t, { ...o }) } });
  const r = chat.ask('Coloquei isopor extra e cantoneira reforçada nos espelhos');
  assert.equal(r.intent, 'INTERVENTION_REPORT');
  assert.match(r.reply, /Registrado como intervenção/);
  assert.match(r.reply, /não vou concluir se funcionou/i);
  assert.equal(w.mos.repos.intervention.count(), 1, 'intervenção REAL persistida pela mesma cadeia');
  const rep = chat.ask('me manda o resumo do dia');
  assert.equal(rep.intent, 'REPORT_REQUEST');
  assert.match(rep.reply, /Resumo do dia/);
  /* sem RID acoplado → honestidade, nunca improviso */
  const bare = createHeadChat({ clock: w.c, companyId: w.company.id });
  assert.match(bare.ask('me manda o resumo do dia').reply, /não tenho dados suficientes/i);
});

/* 2+3+22 — memória cruzada antes de recomendar; decisão passada influencia */
test('recomendação consulta memória: decisão do dono e aprendizado anterior entram', () => {
  const w = world();
  const { rid, company } = w;
  rid.memory.absorb({ companyId: company.id, category: 'STRATEGIC_DIRECTION',
    key: 'dir.shopee', source: 'conversa:2026-06-20', confidence: 'HIGH',
    discovery: 'crescer Shopee com preço agressivo' });
  rid.memory.absorb({ companyId: company.id, category: 'LEARNING',
    key: 'aprend.embalagem', source: 'operational_intervention:itv-x', confidence: 'HIGH',
    discovery: 'embalagem reforçada reduziu avaria de espelhos grandes' });
  const rec = rid.recommend({ companyId: company.id, topic: 'embalagem espelho avaria',
    proposal: { text: 'testar embalagem reforçada nos espelhos grandes' },
    confidence: 'MEDIUM' });
  assert.equal(rec.kind, 'RECOMMENDATION');
  assert.ok(rec.priorLearning.length >= 1, 'aprendizado anterior influencia recomendação semelhante');
  assert.match(rec.checkQuestion, /respeita os objetivos do dono/);
  assert.equal(rec.contextUsed.hierarchy, 'SEGURANCA_E_PERMISSOES', 'hierarquia explícita');
});

/* 4 — memória antiga não prevalece: expirada/superada é filtrada */
test('memória expirada ou superada NUNCA entra no contexto', () => {
  const w = world();
  const { rid, company } = w;
  rid.memory.absorb({ companyId: company.id, category: 'DECISION', key: 'velha',
    source: 'conversa:2025', discovery: 'focar só em Magalu',
    validUntil: '2026-01-01T00:00:00Z' });
  const m = rid.memory.absorb({ companyId: company.id, category: 'DECISION', key: 'superada',
    source: 'conversa:2026-05', discovery: 'nunca fazer promoção' });
  rid.memory.supersede(m.id, { reason: 'dono mudou a direção' });
  const usable = rid.memory.recall({ companyId: company.id, category: 'DECISION' });
  assert.equal(usable.length, 0, 'expirada e superada fora do contexto');
  const all = rid.memory.recall({ companyId: company.id, category: 'DECISION', includeInvalid: true });
  assert.equal(all.length, 2, 'mas permanecem auditáveis');
  assert.match(all.find(x => x.key === 'velha').usable.reason, /expirada/);
});

/* 5+6+7+8 — conflito abre StrategicDialogue com decisão anterior + evidência + alternativas */
test('conflito estratégico: diálogo com direção anterior, evidência nova e alternativas — nunca atropela', () => {
  const w = world();
  const { rid, company } = w;
  rid.memory.absorb({ companyId: company.id, category: 'STRATEGIC_DIRECTION',
    key: 'dir.shopee.preco', source: 'conversa:2026-06-01', confidence: 'HIGH',
    discovery: 'crescer Shopee com preço mais agressivo' });
  const rec = rid.recommend({ companyId: company.id, topic: 'margem Shopee',
    proposal: { text: 'cortar desconto dos SKUs que perderam margem',
      conflictTerms: ['preço mais agressivo'],
      riskOfKeepingCourse: 'faturar mais com lucro menor e mais pressão na operação',
      alternatives: [
        { label: 'manter a estratégia atual', detail: 'aceitar margem menor no curto prazo' },
        { label: 'ajustar a rota', detail: 'preço agressivo só nos SKUs saudáveis' },
        { label: 'teste controlado de 7 dias em 3 SKUs' }] },
    evidence: [{ finding: 'margem caiu 4 pontos em 2 semanas' },
               { finding: 'devoluções subiram nos itens promocionais' }] });
  assert.equal(rec.kind, 'STRATEGIC_DIALOGUE', 'conflito NÃO vira recomendação direta');
  assert.equal(rec.blockedByOwnerDecision, true, 'pede direção ANTES de seguir');
  const d = rec.dialogue;
  assert.equal(d.status, 'AWAITING_OWNER_DIRECTION');
  assert.match(d.previous_decision, /preço mais agressivo/, 'direção anterior nunca ignorada');
  assert.match(d.owner_question, /Sua direção anterior/);
  assert.match(d.owner_question, /O que mudou/);
  assert.match(d.owner_question, /3 opções|3 opç/i);
  assert.match(d.owner_question, /Como você quer seguir/);
  /* diálogo sem decisão anterior ou sem alternativas → recusado */
  assert.throws(() => rid.dialogues.open({ companyId: company.id, subject: 'x',
    previousDecision: null, conflict: 'y', recommendation: 'z',
    alternatives: [{ label: 'a' }, { label: 'b' }] }), /decisão anterior/);
});

/* 9+10+11 — respostas do dono: aprova / mantém / teste pequeno */
test('resposta do dono: "segue sua ideia" cria plano; "mantém" preserva; "teste" cria experimento', () => {
  const w = world();
  const { rid, company } = w;
  const open = () => rid.dialogues.open({ companyId: company.id,
    subject: 'margem Shopee', previousDecision: 'preço agressivo na Shopee',
    conflict: 'margem caindo', recommendation: 'cortar desconto dos SKUs ruins',
    newEvidence: [{ finding: 'margem -4pp' }],
    alternatives: [{ label: 'manter' }, { label: 'ajustar' }, { label: 'testar' }] });

  const d1 = open();
  const r1 = rid.dialogues.ownerRespond(d1.id, { text: 'Segue sua ideia.' });
  assert.equal(r1.status, 'OWNER_APPROVED_RID_DIRECTION');
  assert.ok(r1.plan, 'aprovação cria IntelligenceActionPlan');
  assert.equal(r1.plan.origin, 'STRATEGIC_DIALOGUE');

  const d2 = open();
  const r2 = rid.dialogues.ownerRespond(d2.id, { text: 'Mantém minha estratégia original.' });
  assert.equal(r2.status, 'OWNER_KEPT_PREVIOUS_DIRECTION');
  assert.equal(r2.plan, null, 'nada é executado contra a direção do dono');
  assert.match(r2.executesOnly, /preço agressivo/, 'direção do dono PREVALECE');

  const d3 = open();
  const r3 = rid.dialogues.ownerRespond(d3.id, { text: 'Faz um teste pequeno.' });
  assert.equal(r3.status, 'OWNER_REQUESTED_TEST');
  assert.match(r3.plan.title, /Teste controlado/);
  assert.equal(r3.plan.status, 'RECOMMENDED');
  /* decisões viram memória e influenciam o futuro */
  const mems = rid.memory.recall({ companyId: company.id, category: 'DECISION' });
  assert.equal(mems.length, 3, 'cada decisão registrada como memória estratégica');
});

/* 12+13 — Head não concorda sem base; propõe alternativa com evidência */
test('Head mantém opinião própria: conflito sempre expõe alternativa e recomendação técnica', () => {
  const w = world();
  const { rid, company } = w;
  rid.memory.absorb({ companyId: company.id, category: 'STRATEGIC_DIRECTION',
    key: 'dir.x', source: 'conversa', discovery: 'dobrar Ads em tudo' });
  const rec = rid.recommend({ companyId: company.id, topic: 'ads',
    proposal: { text: 'concentrar Ads apenas nos itens rentáveis',
      conflictTerms: ['dobrar ads'],
      riskOfKeepingCourse: 'Ads caros sem retorno em itens de margem baixa' },
    evidence: [{ finding: 'ACOS acima do teto em 6 campanhas' }] });
  assert.equal(rec.kind, 'STRATEGIC_DIALOGUE', 'não obedece automaticamente');
  assert.match(rec.dialogue.rid_recommendation, /itens rentáveis/,
    'alternativa concreta apresentada');
  assert.match(rec.dialogue.owner_question, /Minha recomendação técnica/);
});

/* 14+15+16+17 — radar detecta; diagnóstico separa fato/hipótese; sem causalidade */
test('radar pontua sem barulho; diagnóstico cruza dimensões e nunca afirma causalidade', () => {
  const w = world();
  const { rid, company } = w;
  const scan = rid.radar.scan({ companyId: company.id, observations: [
    { kind: 'aumento-devolucao', title: 'Devoluções do Espelho 170x70: 4,1% → 9,8% em 14 dias',
      financialImpact: 3, urgency: 3, operationalRisk: 2, trend: 3, confidence: 2,
      entity: 'product', entityId: 'prd-esp-org', marketplace: 'shopee' },
    { kind: 'variacao-minima', title: 'CTR oscilou 0,1% num anúncio',
      financialImpact: 0, urgency: 0, operationalRisk: 0, trend: 0, confidence: 1 }]});
  const loudKinds = scan.loud.map(s => s.kind);
  assert.ok(loudKinds.includes('aumento-devolucao'), 'sinal grande vira alerta+');
  assert.ok(scan.silent.some(s => s.kind === 'variacao-minima'), 'sinal pequeno fica em silêncio');

  const diag = rid.diagnosis.investigate({
    fact: 'Devoluções do Espelho Orgânico 170x70 subiram de 4,1% para 9,8% em 14 dias',
    impact: 'margem e reputação', evidence: MIRROR_EVIDENCE, hypotheses: MIRROR_HYPOTHESES });
  assert.equal(diag.separation.FATO.includes('9,8%'), true);
  assert.ok(diag.separation.HIPOTESE.includes('proteção lateral insuficiente'));
  const lead = diag.hypotheses[0];
  assert.equal(lead.isFact, false, 'hipótese NUNCA vira fato');
  assert.equal(lead.causalityConfirmed, false, 'causalidade não afirmada');
  const semEvidencia = diag.hypotheses.find(h => h.text.includes('transportadora'));
  assert.equal(semEvidencia.confidence, 'VERY_LOW', 'hipótese sem evidência = confiança mínima');
  assert.match(diag.recommendedAction, /lote controlado/);
});

/* 18+19 — plano com objetivo/prazo/responsável/métrica + microtarefas + missão */
test('plano completo vira microtarefas e MISSÃO do motor existente (S02)', () => {
  const w = world();
  const { rid, company, mos } = w;
  const plan = rid.plans.create({ companyId: company.id, origin: 'RADAR',
    title: 'Reduzir avaria dos espelhos grandes',
    objective: 'derrubar devolução por avaria de 9,8% para <5%',
    deadline: '2026-07-18', responsible: ['produção'],
    successMetric: 'devolução por avaria', baseline: { avaria: 9.8 },
    observationDays: 14, confidence: 'MEDIUM' });
  assert.ok(plan.objective && plan.deadline && plan.success_metric);
  const tasks = rid.plans.breakdown(plan.id, [
    'Escolher o modelo de espelho mais crítico',
    'Confirmar como a embalagem atual é feita',
    { title: 'Definir material adicional', responsible: 'produção' },
    'Separar unidades para teste', 'Enviar lote controlado']);
  assert.equal(tasks.length, 5);
  assert.equal(tasks[2].responsible, 'produção');
  const { mission } = rid.plans.approve(plan.id, { userId: w.owner.id });
  assert.equal(mission.kind, 'intelligence-plan', 'missão no repositório EXISTENTE');
  assert.equal(mos.repos.actionPlan.byId(plan.id).status, 'IN_EXECUTION');
});

/* 20+21 — intervenção com antes/depois/período; resultado vira aprendizado */
test('intervenção: linha de base, honestidade sem volume, aprendizado reutilizável', () => {
  const w = world();
  const { rid, company } = w;
  const { intervention, ack } = rid.interventions.register({ companyId: company.id,
    description: 'isopor extra, cantoneira reforçada e caixa dupla nos espelhos',
    responsible: 'gestor', baseline: { avariaPct: 9.8 },
    metrics: ['devolução por avaria', 'custo de embalagem'], monitoringDays: 14 });
  assert.match(ack, /linha de base/);
  assert.match(ack, /não vou concluir/i);
  /* poucos pedidos → NOT_ENOUGH_DATA sempre */
  const e1 = rid.interventions.evaluate(intervention.id, { samples: 5,
    metric: 'avariaPct', baselineValue: 9.8, currentValue: 4.0 });
  assert.equal(e1.result, 'NOT_ENOUGH_DATA');
  const e2 = rid.interventions.evaluate(intervention.id, { samples: 25,
    metric: 'avariaPct', baselineValue: 9.8, currentValue: 5.2 });
  assert.equal(e2.result, 'IMPROVING');
  assert.match(e2.honest, /amostra ainda limitada/);
  const done = rid.interventions.conclude(intervention.id, {
    conclusion: 'avaria caiu de 9,8% para 5,2% no lote observado',
    learning: 'embalagem reforçada com cantoneiras reduz avaria de espelhos grandes',
    reusable: true, confidence: 'HIGH' });
  assert.equal(done.memory.category, 'LEARNING');
  /* aprendizado influencia recomendação semelhante (garantia 22) */
  const rec = rid.recommend({ companyId: company.id, topic: 'avaria espelhos embalagem',
    proposal: { text: 'aplicar protocolo reforçado nos demais espelhos' } });
  assert.ok(rec.priorLearning.length >= 1);
});

/* 23+24+25+32 — relatórios com risco/oportunidade/prioridade; dedup anti-spam */
test('relatório diário e semanal: fontes declaradas, áreas cruzadas, sem spam', () => {
  const w = world();
  const { rid, company } = w;
  rid.radar.scan({ companyId: company.id, observations: [
    { kind: 'aumento-devolucao', title: 'Devoluções do Espelho em alta',
      financialImpact: 3, urgency: 3, operationalRisk: 2, trend: 3, confidence: 2 },
    { kind: 'gap-oportunidade', title: '8 produtos prontos para rascunho no ML',
      financialImpact: 2, urgency: 1, operationalRisk: 0, trend: 1, confidence: 3 }]});
  const d1 = rid.reports.dailyBrief(company.id);
  assert.equal(d1.deduplicated, false);
  assert.match(d1.report.text, /Prioridades recomendadas/);
  assert.match(d1.report.text, /Em risco|Piorou/);
  assert.match(d1.report.text, /nenhum dado demo é apresentado como real/);
  const kinds = JSON.parse(d1.report.data_kinds_json);
  assert.ok(['REAL', 'IMPORTADO', 'DEMONSTRATIVO', 'SEM_DADO'].includes(kinds.vendas),
    'natureza do dado declarada');
  /* anti-spam: segundo pedido no mesmo dia NÃO gera outro relatório */
  const d2 = rid.reports.dailyBrief(company.id);
  assert.equal(d2.deduplicated, true);
  assert.equal(w.mos.repos.intelReport.count(`WHERE kind = 'DAILY_BRIEF'`), 1);
  const wk = rid.reports.weeklyReview(company.id);
  assert.match(wk.report.text, /Vendas:.*Leads:.*Afiliados:/s, 'semanal cruza áreas');
  assert.match(wk.report.text, /Conflitos estratégicos/);
});

/* 26+27 — WhatsApp: relatório + intervenção + diálogo; nunca escrita externa */
test('WhatsApp: recebe relatório, registra intervenção, responde diálogo — zero escrita externa', async () => {
  const w = world();
  const { rid, growth, company, mos } = w;
  const rep = await growth.gateway.handle({ companyId: company.id, from: PHONE,
    text: 'me manda o relatorio do dia' });
  assert.match(rep.reply, /Resumo do dia/);
  assert.match(rep.reply, /painel:\/\/relatorios\//, 'deep link para o painel');
  const itv = await growth.gateway.handle({ companyId: company.id, from: PHONE,
    text: 'Coloquei isopor extra e caixa dupla nos espelhos' });
  assert.match(itv.reply, /Registrado como intervenção/);
  /* diálogo aguardando → "faz um teste pequeno" cria plano interno */
  rid.dialogues.open({ companyId: company.id, subject: 'margem Shopee',
    previousDecision: 'preço agressivo', conflict: 'margem caindo',
    recommendation: 'cortar descontos ruins',
    alternatives: [{ label: 'manter' }, { label: 'ajustar' }] });
  const resp = await growth.gateway.handle({ companyId: company.id, from: PHONE,
    text: 'faz um teste pequeno' });
  assert.match(resp.reply, /OWNER_REQUESTED_TEST/);
  assert.match(resp.reply, /Nada externo foi executado/);
  assert.equal(mos.repos.pilotRun.count(), 0, 'nenhuma escrita externa');
  for (const name of mos.providers.connectorNames())
    assert.throws(() => mos.providers.connector(name).updatePrice({}));
});

/* 28+29+12 — perfil de liderança ajusta voz, nunca a análise */
test('perfil de liderança: onboarding progressivo, voz adaptada, análise intocada', () => {
  const w = world();
  const { rid, company, owner } = w;
  const q1 = rid.profile.nextQuestion(company.id, owner.id);
  assert.match(q1.question, /Como prefere ser chamado/);
  rid.profile.update(company.id, owner.id, { preferred_name: 'Chefe',
    communication_tone: 'direto' });
  const q2 = rid.profile.nextQuestion(company.id, owner.id);
  assert.match(q2.question, /interromper/, 'uma pergunta por vez, sem formulário gigante');
  const voiced = rid.profile.voice(company.id, owner.id, 'A margem da Shopee caiu 4 pontos.');
  assert.match(voiced, /^Chefe, a margem/);
  /* a voz NÃO muda o conteúdo: mesmo fato, mesma análise */
  assert.match(voiced, /caiu 4 pontos/);
  rid.profile.update(company.id, owner.id, { preferred_name: 'Diretor' });
  assert.match(rid.profile.voice(company.id, owner.id, 'Tudo certo.'), /^Diretor/,
    'perfil atualizável');
});

/* 30 — padrões de foco configuráveis; nada sensível inferido */
test('foco e ritmo: janelas configuráveis pelo dono — nunca inferência sensível', () => {
  const w = world();
  const { rid, company, owner } = w;
  rid.profile.update(company.id, owner.id, {
    focus_windows_json: ['fim do dia'], execution_support_style: 'microtarefas' });
  const p = rid.profile.get(company.id, owner.id);
  assert.deepEqual(JSON.parse(p.focus_windows_json), ['fim do dia']);
  /* nenhum campo de saúde/emoção existe no perfil */
  const cols = Object.keys(p).join(',');
  assert.ok(!/saude|emocao|humor_state|psic/.test(cols), 'sem dados sensíveis');
});

/* 31 — ideia ousada exige teste pequeno, métrica e ponto de parada */
test('ousadia com responsabilidade: plano experimental tem métrica, baseline e observação', () => {
  const w = world();
  const plan = w.rid.plans.create({ companyId: w.company.id, origin: 'BOLD_IDEA',
    title: 'Kit de espelhos pequenos para Shopee',
    opportunity: 'menor risco de avaria e margem logística melhor',
    objective: 'testar 20 kits em draft interno',
    successMetric: 'conversão, margem e devolução do kit',
    baseline: { devolucaoEspelhoGrande: 9.8 },
    observationDays: 14, confidence: 'LOW',
    actions: ['criar 20 kits em draft interno', 'medir conversão',
              'PARAR se margem < 18% ou devolução > 6%'] });
  assert.ok(plan.success_metric && plan.baseline_json && plan.observation_period_days);
  assert.match(JSON.parse(plan.actions_json).join(' '), /PARAR se/, 'ponto de parada explícito');
});

/* 33+34 — origem/auditoria/companyId em tudo; empresas isoladas */
test('origem + auditoria + companyId em tudo; empresas nunca se misturam', () => {
  const w = world();
  const { rid, company, mos } = w;
  assert.throws(() => rid.plans.create({ companyId: company.id, title: 'x',
    objective: 'y' }), /origem/);
  assert.throws(() => rid.memory.absorb({ companyId: company.id,
    category: 'LEARNING', key: 'k', discovery: 'd' }), /fonte/);
  rid.memory.absorb({ companyId: company.id, category: 'LEARNING', key: 'k',
    source: 's', discovery: 'aprendizado da empresa A' });
  const { company: b } = mos.services.workspace.bootstrap({
    workspaceName: 'W2', email: 'b3@x.y', companyName: 'B3', marketplaces: ['shopee'] });
  assert.equal(rid.memory.recall({ companyId: b.id, category: 'LEARNING' }).length, 0);
  assert.equal(rid.dialogues.pending(b.id).length, 0);
  const audits = mos.repos.audit.tail(20).filter(a => /^rid-/.test(a.actor));
  assert.ok(audits.length, 'trilha rid-* na auditoria única');
  assert.ok(audits.every(a => a.company_id), 'companyId em toda ação');
});

/* v7 — protótipo principal com os cenários obrigatórios */
test('v7: menu completo, diálogo estratégico, plano, intervenção, relatórios e modo demonstração', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/index.html'), 'utf8');
  for (const v of ['home', 'operacao', 'catalogo', 'crescimento', 'conexoes', 'missoes', 'silencio', 'conhecimento'])
    assert.match(html, new RegExp(`data-v="${v}"`), `área ${v}`);
  assert.match(html, /Modo demonstração — insights, memórias, planos, intervenções, diálogos e relatórios são simulados/);
  const intel = fs.readFileSync(path.join(__dirname, '../../design/prototipo-v7/inteligencia.js'), 'utf8');
  for (const s of ['Seguir recomendação do Head', 'Manter direção anterior', 'Fazer teste pequeno',
                   'Pedir mais análise', 'Registrar intervenção', 'FATO', 'HIPÓTESE',
                   'Resumo do dia', 'Revisão semanal', 'microtarefa'])
    assert.ok(intel.includes(s), `v7 inteligência: ${s}`);
});

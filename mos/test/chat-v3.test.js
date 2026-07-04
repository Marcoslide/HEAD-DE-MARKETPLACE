/* SPRINT 09.A (correção final) — Chat Operacional na experiência principal v3.
   Garantias: o v3 usa a MESMA camada compartilhada (zero lógica própria),
   a área OPERAÇÃO existe na navegação, e o fluxo visual funciona no
   navegador headless sem erros. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { createHeadChat } = require('../src/chat/index.js');
const MIE = require('../../mie/src/index.js');

const V3 = path.join(__dirname, '../../design/prototipo-v3');
const html = fs.readFileSync(path.join(V3, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(V3, 'app.js'), 'utf8');
const glueJs = fs.readFileSync(path.join(V3, 'chat-operacao.js'), 'utf8');
const clock = () => MIE.frozenClock('2026-07-04T14:58:00Z');

/* o plano do v3 (data.js) → adaptador mieLike, como o navegador monta */
function mieLikeFromData() {
  const DATA = new Function(fs.readFileSync(path.join(V3, 'data.js'), 'utf8') + '; return DATA;')();
  const plan = {
    generatedAtIso: '2026-07-04T14:58:00.000Z',
    decisions: DATA.decisions.map(d => ({
      title: d.descoberta, level: d.level, score: d.breakdown.score, reason: d.proposta,
      impactMonthly: d.breakdown.impact, urgency: d.breakdown.urgency, confidence: d.breakdown.confidence,
      breakdown: { base: d.breakdown.base, mult: d.breakdown.mult, factors: d.breakdown.factors,
        riskOfWaiting: d.breakdown.riskWait, riskOfActingEarly: d.breakdown.riskEarly },
      provenance: null })),
    missions: [], silence: DATA.silence,
  };
  return { epe: { lastPlan: plan, externalSignals: [] }, memory: { absorb() {} }, planDay: () => plan };
}

/* 1 — o v3 carrega a MESMA camada (mesmos arquivos, sem cópia) */
test('v3 usa a camada compartilhada do Sprint 09.A (mesmos arquivos)', () => {
  for (const f of ['interpreter', 'period', 'demo-dataset', 'query-layer', 'composer', 'head-chat'])
    assert.match(html, new RegExp(`src="\\.\\./\\.\\./mos/src/chat/${f}\\.js"`), `script ${f}.js da camada compartilhada`);
  assert.match(html, /src="\.\.\/\.\.\/mie\/src\/core\/clock\.js"/, 'Clock injetado (S08.1)');
  assert.match(glueJs, /HEADCHAT\.createHeadChat/, 'o glue instancia a camada, não a recria');
});

/* 2 — nenhuma lógica de resposta hardcoded no v3 */
test('nenhuma resposta hardcoded exclusiva do v3', () => {
  for (const src of [appJs, glueJs]) {
    assert.doesNotMatch(src, /Anotei\. Levo isso em conta/, 'o chatbot antigo foi removido');
    assert.doesNotMatch(src, /Score executivo 6863/, 'sem resposta roteirizada por pergunta');
    assert.doesNotMatch(src, /q\.includes\("prioriz/, 'sem roteamento por frase hardcoded');
  }
  assert.doesNotMatch(glueJs, /R\$ ?8\.?420/, 'nenhum número fixo no glue — números vêm da Query Layer');
});

/* nav: Operação é área principal; A Missão renomeada; IA não existe mais */
test('navegação: Home · Operação · A Missão · Silêncio · Conhecimento', () => {
  assert.match(html, /data-v="operacao"[^>]*>.*Operação/s);
  assert.match(html, /data-v="missoes"[^>]*>.*A Missão/s);
  assert.match(html, /data-v="silencio"/);
  assert.match(html, /data-v="conhecimento"/);
  assert.doesNotMatch(html, /data-v="ia"/, 'a aba IA foi substituída por Operação');
  assert.match(html, /id="v-operacao"/);
  assert.match(html, /id="askHeadInput"/, 'Home mantém a entrada "Pergunte ao Head"');
});

/* 3 + 6 — "Quanto vendi hoje?" funciona com a MESMA camada, marcado v3 */
test('"Quanto vendi hoje?" responde no v3 pela camada compartilhada', () => {
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  const r = chat.ask('Quanto vendi hoje?', { surface: 'v3' });
  assert.equal(r.facts.dataSource, 'DEMO_FIXTURE');
  assert.match(r.reply, /R\$ 8\.420/);
  assert.match(r.reply, /Dados demonstrativos/, 'dado demonstrativo identificado');
  assert.equal(chat.lastTrace.surface, 'v3', 'observabilidade registra a superfície v3');
});

/* 4 — TODOS os chips do v3 disparam consulta tipada válida */
test('chips do v3 disparam a mesma consulta tipada do chat', () => {
  const chips = [...glueJs.matchAll(/"([^"]+\?)"(?:, ")?/g)].map(m => m[1])
    .filter(c => /[A-ZÀ-Ú]/.test(c[0]) && c.endsWith('?'));
  assert.ok(chips.length >= 10, `chips encontrados: ${chips.length}`);
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  for (const c of chips) {
    const r = chat.ask(c);
    assert.notEqual(r.intent, 'UNKNOWN', `chip "${c}" precisa ter intenção conhecida`);
    assert.ok(r.reply && r.reply.length > 20, `chip "${c}" precisa de resposta real`);
  }
});

/* 5 — contexto entre perguntas curtas no fluxo v3 */
test('contexto preservado no fluxo do v3 ("E na Shopee?")', () => {
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  chat.ask('Quanto vendi hoje?', { surface: 'v3' });
  const r = chat.ask('E na Shopee?', { surface: 'v3' });
  assert.equal(r.query.inherited, true);
  assert.equal(r.facts.grossRevenue, 4780);
  assert.match(glueJs, /usei o contexto da pergunta anterior/, 'a UI sinaliza a herança de filtros');
});

/* 7 — falta de dados continua honesta no v3 */
test('sem dados: resposta honesta também no v3', () => {
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  assert.match(chat.ask('Quanto vendi no TikTok?', { surface: 'v3' }).reply, /Não vou inventar um número/);
});

/* 8 — READ_ONLY no v3: proposta, nunca execução (e nenhum botão de executar) */
test('comandos no v3 viram proposta READ_ONLY', () => {
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  const r = chat.ask('Baixe o preço do kit de quadros', { surface: 'v3' });
  assert.equal(r.intent, 'ACTION_REQUEST');
  assert.match(r.reply, /modo leitura|READ_ONLY/);
  assert.match(glueJs, /MODO LEITURA/, 'a UI marca a proposta como modo leitura');
  assert.doesNotMatch(glueJs, /executar agora|aplicar no marketplace/i, 'nenhum botão que pareça executar ação real');
});

/* 9 — decisões conectam ao plano exibido (mesma fonte da Home) */
test('perguntas de decisão consultam o plano do v3 (EPE-adapter)', () => {
  const chat = createHeadChat({ clock: clock(), mie: mieLikeFromData() });
  const pend = chat.ask('Qual decisão precisa de mim?');
  assert.equal(pend.facts.kind, 'PENDING_DECISIONS');
  assert.equal(pend.facts.items.length, 2, 'as 2 decisões da Home');
  const why = chat.ask('Por que você priorizou o Quadro Paisagem 60x90?');
  assert.equal(why.facts.kind, 'DECISION_EXPLANATION');
  assert.match(why.facts.title, /Quadro Paisagem 60x90/);
  assert.equal(why.facts.score, 6863, 'o MESMO score exibido no card da Home');
  assert.match(glueJs, /goPlan|ver no Plano do Dia/, 'ligação opcional com o Plano do Dia');
});

/* 10 + 11 + 12 — navegador headless: sem erro, chat funciona, plano intacto */
test('headless: v3 responde, plano do dia intacto, largura reduzida ok', t => {
  const CH = '/opt/pw-browsers/chromium';
  if (!fs.existsSync(CH)) return t.skip('chromium indisponível neste ambiente');
  const url = `file://${path.join(V3, 'index.html')}?chatself=1`;
  const run = size => spawnSync(CH, ['--headless', '--disable-gpu', '--no-sandbox',
    `--window-size=${size}`, '--virtual-time-budget=7000', '--dump-dom', url],
    { encoding: 'utf8', timeout: 60000 });
  const desk = run('1440,2000');
  assert.match(desk.stdout, /data-chat-ready="ok"/, 'roteiro do chat completou sem erro');
  assert.match(desk.stdout, /R\$ 8\.420/, 'resposta de vendas renderizada');
  assert.match(desk.stdout, /MODO LEITURA/, 'proposta READ_ONLY renderizada');
  assert.match(desk.stdout, /usei o contexto da pergunta anterior/, 'contexto sinalizado');
  assert.match(desk.stdout, /Detectei queda de 18%/, 'o Plano do Dia continua renderizando');
  assert.doesNotMatch(desk.stdout, /Uncaught|ReferenceError|TypeError/, 'sem erro de página');
  const narrow = run('720,2000');
  assert.match(narrow.stdout, /data-chat-ready="ok"/, 'funciona em largura reduzida');
  assert.ok(fs.readFileSync(path.join(V3, 'styles.css'), 'utf8').includes('@media (max-width:760px)'),
    'layout responsivo previsto no CSS');
});

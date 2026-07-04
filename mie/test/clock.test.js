/* Sprint 08.1 — CLOCK INJETADO E CONTEXTO TEMPORAL UNIFICADO.
   Os 12 testes obrigatórios: o tempo vira parte explícita e testável do
   contexto de decisão. O relógio de PAREDE (ISO/timezone) é injetável e
   determinista; nenhum motor chama `new Date()` fora do Clock. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const NS = require('../src/index.js');
const L = NS.EPE_LEVEL;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const WARMUP = NS.WARMUP_DAYS + 3;

/* candidato acionável forte (Classe C, reversível) — vira PEDIR APROVAÇÃO */
const strong = (o = {}) => ({
  id: 'x', productId: 'p1', title: 'ação', impactMonthly: 2000,
  confidenceLabel: 'alta', urgency: 'média', severity: 'attention',
  effort: 1, reversible: true, class: 'C', proposalType: 'reposition',
  hasProposal: true, ...o,
});

/* 1 — o Clock devolve um tempo válido (Date, ISO e ms coerentes) */
test('systemClock devolve tempo válido: Date, ISO e ms coerentes', () => {
  const c = NS.systemClock;
  assert.equal(c.kind, 'system');
  assert.ok(c.now() instanceof Date);
  assert.match(c.nowIso(), ISO_RE);
  assert.equal(typeof c.nowMs(), 'number');
  assert.ok(c.nowMs() > 0);
  assert.equal(new Date(c.nowIso()).getTime(), c.now().getTime());
});

/* 2 — Clock congelado é determinista: chamadas repetidas dão o MESMO instante */
test('frozenClock é determinista — nowIso() estável entre chamadas', () => {
  const c = NS.frozenClock('2026-07-04T12:00:00Z');
  assert.equal(c.kind, 'frozen');
  const a = c.nowIso();
  const b = c.nowIso();
  assert.equal(a, b);
  assert.equal(a, '2026-07-04T12:00:00.000Z');
  assert.equal(c.nowMs(), c.nowMs());
});

/* 3 — today() respeita a timezone America/Sao_Paulo (não o UTC do runtime) */
test('today() respeita America/Sao_Paulo', () => {
  // 01:30Z de 04/07 → 22:30 de 03/07 no horário de Brasília (UTC-3)
  const c = NS.frozenClock('2026-07-04T01:30:00Z');
  assert.equal(c.timezone, 'America/Sao_Paulo');
  assert.equal(c.today(), '2026-07-03');
});

/* 4 — virada de dia em UTC NÃO quebra o dia local brasileiro */
test('virada de dia em UTC não muda o dia local BR', () => {
  // 02:00Z já é dia 11 em UTC, mas ainda é 23:00 do dia 10 em Brasília
  const c = NS.frozenClock('2026-03-11T02:00:00Z');
  assert.equal(c.today(), '2026-03-10');
  assert.notEqual(c.today(), '2026-03-11');
  // dateKey de um Date arbitrário também respeita o fuso local
  assert.equal(c.dateKey(new Date('2026-03-11T02:00:00Z')), '2026-03-10');
});

/* 5 — createMIE() sem Clock usa o systemClock por padrão */
test('createMIE() sem Clock usa systemClock por padrão', () => {
  const mie = NS.createMIE({ seed: 42 });
  assert.ok(mie.clock);
  assert.equal(mie.clock, NS.systemClock);
  assert.equal(mie.clock.kind, 'system');
  assert.equal(mie.epe.clock, mie.clock);
  assert.equal(mie.memory.clock, mie.clock);
});

/* 6 — createMIE({ clock }) usa o Clock injetado em todos os motores */
test('createMIE({ clock }) usa o Clock injetado', () => {
  const clock = NS.frozenClock('2026-07-04T09:00:00Z');
  const mie = NS.createMIE({ seed: 42, clock });
  assert.equal(mie.clock, clock);
  assert.equal(mie.epe.clock, clock);
  assert.equal(mie.memory.clock, clock);
  assert.equal(mie.graph.wallClock, clock);
});

/* 7 — o plano do dia carrega o tempo (injetado) em que foi gerado */
test('EPE: planDay carrega generatedAt/timezone/dateKey do Clock injetado', () => {
  const clock = NS.frozenClock('2026-07-04T11:00:00Z');
  const mie = NS.createMIE({ seed: 42, clock });
  mie.runDays(WARMUP);
  const plan = mie.planDay({ capacity: { missions: 5, decisions: 2 } });
  assert.equal(plan.generatedAtIso, '2026-07-04T11:00:00.000Z');
  assert.equal(plan.generatedAt, clock.nowMs());
  assert.equal(plan.timezone, 'America/Sao_Paulo');
  assert.equal(plan.dateKey, '2026-07-04');   // 08:00 BR, mesmo dia
});

/* 8 — o EPE MUDA a decisão quando a janela de decisão expira (Clock) */
test('EPE: janela expirada rebaixa a decisão para OBSERVAR', () => {
  const clock = NS.frozenClock('2026-07-04T12:00:00Z');
  const e = NS.createMIE({ seed: 42, clock }).epe;
  // mesma proposta, só muda o prazo relativo ao Clock:
  const vivo = e.classify(strong({ expiresAt: '2026-07-04T20:00:00Z' }));
  const morto = e.classify(strong({ expiresAt: '2026-07-04T08:00:00Z' }));
  assert.equal(vivo.level, L.APPROVE);
  assert.equal(vivo.expired, false);
  assert.equal(morto.level, L.OBSERVE);
  assert.equal(morto.expired, true);
  // a fórmula do score NÃO muda — só o nível executivo
  assert.equal(vivo.score, morto.score);
});

/* 9 — sob Clock congelado, planDay é determinista (mesmo generatedAt) */
test('EPE: planDay determinista sob Clock congelado', () => {
  const clock = NS.frozenClock('2026-07-04T10:00:00Z');
  const mie = NS.createMIE({ seed: 42, clock });
  mie.runDays(WARMUP);
  const a = mie.planDay({ capacity: { missions: 5, decisions: 2 } });
  const b = mie.planDay({ capacity: { missions: 5, decisions: 2 } });
  assert.equal(a.generatedAtIso, b.generatedAtIso);
  assert.equal(a.generatedAtIso, clock.nowIso());
  assert.equal(a.dateKey, b.dateKey);
});

/* 10 — recusa/registro na memória e nó no grafo recebem timestamp do Clock */
test('memória e grafo carimbam proveniência com o Clock injetado', () => {
  const clock = NS.frozenClock('2026-07-04T13:45:00Z');
  const mie = NS.createMIE({ seed: 42, clock });
  // recusa do dono → preferência registrada com observedAt do Clock
  mie.memory.recordPreference({ decisionId: 'd1', proposalType: 'reposition', motive: 'preço' });
  const pref = mie.memory.preferences[mie.memory.preferences.length - 1];
  assert.equal(pref.observedAt, '2026-07-04T13:45:00.000Z');
  // nó do grafo recebe createdAtIso do wallClock
  const node = mie.graph.upsertNode(NS.GRAPH.NODE.Product, 'p1');
  assert.equal(node.createdAtIso, '2026-07-04T13:45:00.000Z');
  assert.equal(node.lastAtIso, '2026-07-04T13:45:00.000Z');
});

/* 11 — evento sem observedAt recebe o timestamp do Clock (contrato futuro) */
test('stampEvent: evento sem observedAt ganha o tempo do Clock', () => {
  const clock = NS.frozenClock('2026-07-04T15:00:00Z');
  const semObs = NS.stampEvent(clock, { source: 'shopee', eventType: 'price.changed', payload: {} });
  assert.equal(semObs.observedAt, '2026-07-04T15:00:00.000Z');
  assert.equal(semObs.source, 'shopee');
  // se o evento já traz observedAt (veio da origem), é preservado
  const comObs = NS.stampEvent(clock, { source: 'ml', observedAt: '2026-07-01T00:00:00.000Z' });
  assert.equal(comObs.observedAt, '2026-07-01T00:00:00.000Z');
});

/* 12 — NENHUM arquivo em mie/src usa new Date()/Date.now() fora do Clock */
test('mie/src não usa new Date()/Date.now() fora de core/clock.js', () => {
  const root = path.join(__dirname, '..', 'src');
  const offenders = [];
  const scan = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      if (full.endsWith(path.join('core', 'clock.js'))) continue;   // a ÚNICA exceção
      const src = fs.readFileSync(full, 'utf8');
      if (/new\s+Date\s*\(|Date\.now\s*\(/.test(src)) offenders.push(path.relative(root, full));
    }
  };
  scan(root);
  assert.deepEqual(offenders, [], `arquivos usando Date diretamente: ${offenders.join(', ')}`);
});

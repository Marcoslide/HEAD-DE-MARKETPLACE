/* Bloco 10 — WhatsApp: parser, contexto, memória, fila e notificações. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMOS } = require('../src/index.js');
const { ConversationEngine, SimulatedChannel, parseCommand } = require('../src/whatsapp/index.js');

function setup() {
  const mos = createMOS();
  const { company } = mos.services.workspace.bootstrap({
    workspaceName: 'W', email: 'w@a.br', companyName: 'Quadros & Cia' });
  const channel = new SimulatedChannel();
  const engine = new ConversationEngine({
    services: mos.services, repos: mos.repos, bus: mos.bus,
    queues: mos.queues, channel, companyId: company.id, logger: mos.logger });
  const decide = (title, type = 'reposition') => mos.services.decision.create(company.id, {
    title, discovery: 'Detectei…', proposal: { type }, impactMin: 800, impactMax: 1200, confidence: 'alta' });
  return { mos, channel, engine, companyId: company.id, decide };
}
const lastOut = ch => ch.outbox[ch.outbox.length - 1].text;

test('command parser: o português do dono vira intenção', () => {
  assert.equal(parseCommand('o que eu preciso decidir hoje?').type, 'pending');
  assert.deepEqual(parseCommand('aprova a primeira'), { type: 'approve', ref: 1 });
  assert.equal(parseCommand('pode aprovar a segunda').ref, 2);
  const r = parseCommand('recusa a 1 porque margem apertada');
  assert.equal(r.type, 'refuse'); assert.equal(r.motive, 'margem apertada');
  assert.equal(parseCommand('bom dia, como está a operação?').type, 'briefing');
  assert.equal(parseCommand('estuda a categoria de espelhos').type, 'question');
});

test('fluxo: listar decisões → "aprovar 1" resolve pela referência do contexto', async () => {
  const { mos, channel, decide } = setup();
  decide('Reposicionar o Quadro Paisagem');
  decide('Novo título do Kit 3 Quadros');
  // limpa notificações proativas da criação
  await mos.queues.notifications.onIdle(); channel.outbox.length = 0;

  await channel.receive('owner', 'o que preciso decidir?');
  await mos.queues.notifications.onIdle();
  assert.match(lastOut(channel), /2 decisão/);
  assert.match(lastOut(channel), /1\. Reposicionar/);

  await channel.receive('owner', 'aprova a 1');
  await mos.queues.notifications.onIdle();
  assert.match(lastOut(channel), /virou missão/i);

  const pending = mos.services.decision.pending(mos.repos.decision.db.get('SELECT company_id c FROM decision').c);
  assert.equal(pending.length, 1, 'a aprovada saiu da fila');
  assert.equal(mos.repos.mission.count(), 1, 'missão criada de verdade');
  mos.close();
});

test('recusa sem motivo: o Head pergunta por quê e aprende com a resposta', async () => {
  const { mos, channel, decide, companyId } = setup();
  decide('Cortar preço do Vaso', 'price_cut');
  await mos.queues.notifications.onIdle(); channel.outbox.length = 0;

  await channel.receive('owner', 'decisões');
  await channel.receive('owner', 'recusar 1');
  await mos.queues.notifications.onIdle();
  assert.match(lastOut(channel), /Por quê/);

  await channel.receive('owner', 'a margem não aguenta desconto agora');
  await mos.queues.notifications.onIdle();
  assert.match(lastOut(channel), /Anotei o motivo/);
  const prefs = mos.repos.memory.byKind(companyId, 'preference');
  assert.equal(prefs.length, 1, 'motivo virou preferência na memória (Art. 18)');
  mos.close();
});

test('pergunta livre vira missão rastreável (Fluxo 009: pedido não evapora)', async () => {
  const { mos, channel } = setup();
  await channel.receive('owner', 'estuda a categoria de espelhos redondos');
  await mos.queues.notifications.onIdle();
  assert.match(lastOut(channel), /Anotei. Abri uma missão/);
  const missions = mos.repos.mission.db.all('SELECT * FROM mission');
  assert.equal(missions.length, 1);
  assert.equal(missions[0].origin, 'pedido seu, pelo WhatsApp');
  mos.close();
});

test('notificações proativas: decisão criada e publicação concluída chegam sozinhas', async () => {
  const { mos, channel, decide, companyId } = setup();
  decide('Renovar criativo do Kit');
  await mos.queues.notifications.onIdle();
  assert.ok(channel.outbox.some(m => /Preparei uma decisão/.test(m.text)),
    'decision.created → mensagem proativa');

  mos.bus.emit('publication.completed', { listingId: 'lst_x' });
  await mos.queues.notifications.onIdle();
  assert.ok(channel.outbox.some(m => /publiquei a nova versão/i.test(m.text)),
    'publication.completed → reporte proativo');
  mos.close();
});

test('briefing pelo WhatsApp: trabalho + pendências na voz do Head', async () => {
  const { mos, channel, decide } = setup();
  decide('Decisão A');
  await mos.queues.notifications.onIdle(); channel.outbox.length = 0;
  await channel.receive('owner', 'bom dia');
  await mos.queues.notifications.onIdle();
  const out = lastOut(channel);
  assert.match(out, /Enquanto você descansava/);
  assert.match(out, /1 decisão\(ões\) aguardando/);
  mos.close();
});

test('memória da conversa: turnos registrados nos dois sentidos', async () => {
  const { mos, channel, engine } = setup();
  await channel.receive('owner', 'resumo');
  await mos.queues.notifications.onIdle();
  const hist = engine.memory.historyOf('owner');
  assert.ok(hist.some(t => t.direction === 'in' && t.intent === 'briefing'));
  assert.ok(hist.some(t => t.direction === 'out'));
  mos.close();
});

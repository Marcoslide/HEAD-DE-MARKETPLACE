/* Demo do HEAD CHAT (Sprint 09.A).
   Uso: node mos/demo-chat.js
   O chat operacional respondendo perguntas naturais com fixtures coerentes
   — intenção → consulta tipada → fatos → resposta. Zero hardcode. */
'use strict';
const { createHeadChat } = require('./src/chat/index.js');
const MIE = require('../mie/src/index.js');

const clock = MIE.frozenClock('2026-07-04T14:58:00Z');   // 11:58 em São Paulo
const mie = MIE.createMIE({ seed: 42, clock });
const chat = createHeadChat({ clock, mie });

const line = () => console.log('─'.repeat(70));
const say = q => {
  console.log(`\n👤 ${q}`);
  const r = chat.ask(q);
  console.log(`🧠 [${r.intent}]`);
  console.log(r.reply.split('\n').map(l => '   ' + l).join('\n'));
};

line();
console.log('  HEAD CHAT — Central Operacional Conversacional (fixtures)');
line();

say('Quanto eu vendi hoje?');
say('E na Shopee?');
say('E ontem?');
say('Quantos pedidos faltam enviar?');
say('quanto gastei de ads?');
say('Como está minha conversão?');
say('O que está acabando?');
say('Onde estou perdendo dinheiro?');
say('Qual produto vendeu mais?');
say('Quanto sobrou hoje?');
say('Baixe o preço do kit de quadros');
say('E se eu baixar o preço em 8%?');
say('Não quero baixar preço de personalizados');
say('Quanto vendi no TikTok?');

console.log('\n' + '─'.repeat(70));
console.log('  BRIEFING DA MANHÃ (proativo):\n');
console.log(chat.briefing().message.split('\n').map(l => '   ' + l).join('\n'));
console.log('\n' + '─'.repeat(70));
console.log('  FECHAMENTO DO DIA:\n');
console.log(chat.closing().message.split('\n').map(l => '   ' + l).join('\n'));
line();

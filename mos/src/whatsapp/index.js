/* MÓDULO WHATSAPP (Bloco 10) — a voz do Head onde o empresário vive.
   Tudo por eventos SIMULADOS: o SimulatedChannel implementa a mesma
   interface que o adapter real (Cloud API) implementará — o
   ConversationEngine não saberá a diferença.

   Peças: Channel (transporte) · CommandParser · ConversationContext ·
   ConversationMemory · ExecutionQueue (fila) · PendingDecisions ·
   Notifications (proativas, com a disciplina do Art. 19). */
'use strict';

/* ---------- Channel: o transporte (real no futuro, simulado hoje) ---------- */
class SimulatedChannel {
  constructor() { this.outbox = []; this.handlers = []; }
  onMessage(fn) { this.handlers.push(fn); }
  async send(to, text) { this.outbox.push({ to, text, at: Date.now() }); return { delivered: true }; }
  /* simula uma mensagem chegando do usuário */
  async receive(from, text) {
    for (const h of this.handlers) await h({ from, text });
  }
}

/* ---------- Command Parser: português do dono → intenção ---------- */
function parseCommand(text) {
  const t = text.trim().toLowerCase();
  const ordinal = s => {
    const map = { '1': 1, 'primeira': 1, 'primeiro': 1, '2': 2, 'segunda': 2, 'segundo': 2, '3': 3, 'terceira': 3 };
    for (const [k, v] of Object.entries(map)) if (s.includes(k)) return v;
    return null;
  };
  if (/\b(aprovo|aprova|aprovar|pode fazer|vai fundo|manda ver)\b/.test(t))
    return { type: 'approve', ref: ordinal(t) ?? 1 };
  if (/\b(recuso|recusa|recusar|não faz|nao faz|deixa pra depois)\b/.test(t)) {
    const motive = (t.match(/\b(?:porque|pq|motivo[:\s]+)\s*(.+)$/) || [])[1] || null;
    return { type: 'refuse', ref: ordinal(t) ?? 1, motive };
  }
  if (/\b(decidir|decis[õo]es|pendente|o que (tem|preciso))\b/.test(t))
    return { type: 'pending' };
  if (/\b(resumo|briefing|como est(á|a)|status|bom dia|boa noite)\b/.test(t))
    return { type: 'briefing' };
  if (/\b(ajuda|help|comandos)\b/.test(t))
    return { type: 'help' };
  return { type: 'question', text: text.trim() };
}

/* ---------- Conversation Context: o fio da conversa por usuário ---------- */
class ConversationContext {
  constructor() { this.byUser = new Map(); }
  of(user) {
    if (!this.byUser.has(user))
      this.byUser.set(user, { listedDecisions: [], awaitingMotiveFor: null, lastIntent: null });
    return this.byUser.get(user);
  }
}

/* ---------- Conversation Memory: nada da relação se perde ---------- */
class ConversationMemory {
  constructor(limit = 2000) { this.turns = []; this.limit = limit; }
  record(user, direction, text, intent = null) {
    this.turns.push({ user, direction, text, intent, at: Date.now() });
    if (this.turns.length > this.limit) this.turns.shift();
  }
  historyOf(user, n = 20) { return this.turns.filter(t => t.user === user).slice(-n); }
}

/* ---------- Conversation Engine ---------- */
class ConversationEngine {
  constructor({ services, repos, bus, queues, channel, companyId, logger = null }) {
    this.services = services; this.r = repos; this.bus = bus;
    this.queue = queues.notifications; // execution queue do módulo
    this.channel = channel; this.companyId = companyId; this.log = logger;
    this.context = new ConversationContext();
    this.memory = new ConversationMemory();

    channel.onMessage(msg => this.handle(msg));
    this.queue.process(async job => this._deliver(job.data));

    /* Notifications proativas — com a disciplina do Art. 19:
       decisões prontas e ciclos fechados; nunca curiosidades */
    bus.on('decision.created', ({ decisionId }) => {
      const d = this.r.decision.byId(decisionId);
      this.notify(`Preparei uma decisão para você: ${d.title}. Responda "decisões" para ver, ou "aprovar"/"recusar".`);
    });
    bus.on('publication.completed', ({ listingId }) => {
      const l = this.r.listing.maybeById(listingId);
      this.notify(`Pronto — publiquei a nova versão${l ? ` de ${l.title}` : ''}. Acompanho o efeito e te trago o resultado medido.`);
    });
  }

  owner = 'owner';

  notify(text) { this.queue.enqueue('notify', { to: this.owner, text, proactive: true }); }
  async _deliver({ to, text }) {
    this.memory.record(to, 'out', text);
    await this.channel.send(to, text);
  }

  async handle({ from, text }) {
    const ctx = this.context.of(from);
    const intent = parseCommand(text);
    this.memory.record(from, 'in', text, intent.type);
    ctx.lastIntent = intent.type;

    /* motivo pendente de uma recusa anterior ("por quê?") */
    if (ctx.awaitingMotiveFor && intent.type === 'question') {
      const id = ctx.awaitingMotiveFor; ctx.awaitingMotiveFor = null;
      this.services.decision.refuse(id, text.trim());
      return this.reply(from, 'Anotei o motivo. É assim que eu aprendo o seu jeito de decidir.');
    }

    switch (intent.type) {
      case 'pending': {
        const list = this.services.decision.pending(this.companyId);
        ctx.listedDecisions = list.map(d => d.id);
        if (!list.length) return this.reply(from, 'Sem pendências. Eu cuido do resto — te chamo se algo importante surgir.');
        const lines = list.map((d, i) =>
          `${i + 1}. ${d.title} (impacto ~R$ ${Math.round(d.impact_min || 0)}–${Math.round(d.impact_max || 0)}/mês, confiança ${d.confidence})`);
        return this.reply(from, `Você tem ${list.length} decisão(ões) na mesa:\n${lines.join('\n')}\nResponda "aprovar 1" ou "recusar 1 porque…".`);
      }
      case 'approve': {
        const id = this.resolveRef(ctx, intent.ref);
        if (!id) return this.reply(from, 'Não achei essa decisão. Diga "decisões" para eu listar de novo.');
        const { mission } = this.services.decision.approve(id);
        ctx.listedDecisions = ctx.listedDecisions.filter(x => x !== id);
        return this.reply(from, `Perfeito. Já virou missão (${mission.title}) — executo e volto com o resultado medido no briefing.`);
      }
      case 'refuse': {
        const id = this.resolveRef(ctx, intent.ref);
        if (!id) return this.reply(from, 'Não achei essa decisão. Diga "decisões" para eu listar de novo.');
        if (intent.motive) {
          this.services.decision.refuse(id, intent.motive);
          ctx.listedDecisions = ctx.listedDecisions.filter(x => x !== id);
          return this.reply(from, 'Registrado. Vou levar isso em conta nas próximas propostas.');
        }
        ctx.awaitingMotiveFor = id;
        return this.reply(from, 'Entendido. Por quê? (me ajuda a aprender o seu jeito de decidir)');
      }
      case 'briefing': {
        const pending = this.services.decision.pending(this.companyId);
        const missions = this.r.mission.db.all(
          `SELECT * FROM mission WHERE company_id = ? AND status = 'active'`, this.companyId);
        return this.reply(from,
          `Enquanto você descansava, continuei trabalhando.\n` +
          `• ${missions.length} missão(ões) em andamento\n` +
          `• ${pending.length} decisão(ões) aguardando você\n` +
          (pending.length ? 'Diga "decisões" para resolver agora.' : 'Sem pendências. Eu cuido do resto.'));
      }
      case 'help':
        return this.reply(from, 'Fale comigo normalmente. Atalhos: "decisões" · "aprovar 1" · "recusar 1 porque…" · "resumo". Qualquer outra coisa eu anoto e viro missão.');
      default: {
        /* Fluxo 009: pedido não evapora — vira missão rastreável */
        const mission = this.r.mission.insert({
          company_id: this.companyId, kind: 'investigando',
          title: intent.text.charAt(0).toUpperCase() + intent.text.slice(1),
          status: 'active', origin: 'pedido seu, pelo WhatsApp',
          log_json: [{ at: new Date().toISOString(), note: 'missão aberta a partir da conversa' }],
        });
        this.bus.emit('mission.created', { missionId: mission.id, via: 'whatsapp' });
        return this.reply(from, 'Anotei. Abri uma missão para isso e te trago o que encontrar no próximo briefing — se for urgente, te chamo antes.');
      }
    }
  }

  resolveRef(ctx, ref) {
    if (!ctx.listedDecisions.length) {
      const list = this.services.decision.pending(this.companyId);
      ctx.listedDecisions = list.map(d => d.id);
    }
    return ctx.listedDecisions[(ref || 1) - 1] || null;
  }
  reply(to, text) { this.queue.enqueue('notify', { to, text }); }
}

module.exports = { ConversationEngine, SimulatedChannel, parseCommand, ConversationContext, ConversationMemory };

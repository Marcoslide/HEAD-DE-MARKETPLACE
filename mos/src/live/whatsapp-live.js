/* WHATSAPP BUSINESS — INTEGRAÇÃO OFICIAL (Sprint 10.A).

   SOMENTE a via oficial (Cloud API/Meta): webhook de verificação (GET
   hub.challenge) + webhook de mensagens (POST) com verificação de
   assinatura HMAC-SHA256 e deduplicação pelo id oficial da mensagem.
   PROIBIDO e ausente por construção: WhatsApp Web, QR não oficial,
   automação de navegador, scraping, emulação.

   Credenciais: SÓ backend, por variável de ambiente (nomes em
   docs/live-activation-checklist.md) — nunca em log, fixture ou Git.

   Piloto de resposta: desligado por padrão; só administrador em
   allowlist; a resposta vem da MESMA Operational Query Layer do chat;
   NENHUMA ação externa é executada a partir do WhatsApp. */
'use strict';
const crypto = require('node:crypto');

class WhatsAppLive {
  constructor({ repos, bus, clock, flags, chatFactory = null, sender = null,
                commandGateway = null, config = {}, logger = null }) {
    this.r = repos; this.bus = bus; this.clock = clock; this.flags = flags;
    this.chatFactory = chatFactory;   // companyId → HeadChat (mesma Query Layer)
    this.commandGateway = commandGateway; // Sprint 10.B: MESMO motor da tela
    this.sender = sender;             // transporte de saída oficial (injetável); null = outbox
    this.log = logger;
    this.cfg = {
      verifyToken: config.verifyToken ?? process.env.WHATSAPP_VERIFY_TOKEN ?? null,
      appSecret: config.appSecret ?? process.env.WHATSAPP_APP_SECRET ?? null,
      phoneNumberId: config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      wabaId: config.wabaId ?? process.env.WHATSAPP_WABA_ID ?? null,
      allowlist: (config.allowlist ?? process.env.WHATSAPP_ADMIN_ALLOWLIST ?? '')
        .split(',').map(s => s.trim()).filter(Boolean),
    };
    this.outbox = [];                 // sem sender configurado, a resposta fica aqui (auditável)
  }

  configured() { return !!(this.cfg.verifyToken && this.cfg.phoneNumberId); }
  missingConfig() {
    return [['WHATSAPP_VERIFY_TOKEN', this.cfg.verifyToken], ['WHATSAPP_APP_SECRET', this.cfg.appSecret],
            ['WHATSAPP_PHONE_NUMBER_ID', this.cfg.phoneNumberId], ['WHATSAPP_WABA_ID', this.cfg.wabaId]]
      .filter(([, v]) => !v).map(([k]) => k);
  }

  setup(companyId) {
    const existing = this.r.waConnection.db.get(
      'SELECT id FROM whatsapp_connection WHERE company_id = ?', companyId);
    const status = this.configured() ? 'WHATSAPP_INBOUND_READY' : 'WHATSAPP_INBOUND_DISABLED';
    const row = { company_id: companyId, phone_number_id: this.cfg.phoneNumberId,
      waba_id: this.cfg.wabaId, status, updated_at: this.clock.nowIso(),
      created_at: this.clock.nowIso() };
    return existing ? this.r.waConnection.update(existing.id, row) : this.r.waConnection.insert(row);
  }

  /* GET /webhooks/whatsapp — verificação oficial do webhook */
  verifyWebhook(query, companyId) {
    if (query['hub.mode'] !== 'subscribe' || !this.cfg.verifyToken
        || query['hub.verify_token'] !== this.cfg.verifyToken)
      return { ok: false, status: 403 };
    const conn = this.setup(companyId);
    this.r.waConnection.update(conn.id, {
      status: 'WHATSAPP_WEBHOOK_VERIFIED', webhook_verified_at: this.clock.nowIso(),
      updated_at: this.clock.nowIso() });
    this.bus.emit('whatsapp.webhook_verified', { companyId });
    return { ok: true, challenge: query['hub.challenge'] };
  }

  /* assinatura oficial: X-Hub-Signature-256 = sha256 HMAC do corpo cru */
  verifySignature(rawBody, signatureHeader) {
    if (!this.cfg.appSecret) return true;          // sem segredo configurado: dev local
    if (!signatureHeader) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', this.cfg.appSecret)
      .update(rawBody).digest('hex');
    try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader)); }
    catch { return false; }
  }

  /* POST /webhooks/whatsapp — mensagens recebidas (formato oficial) */
  async handleInbound(body, { rawBody = '', signature = null, companyId } = {}) {
    if (!this.verifySignature(rawBody, signature))
      return { ok: false, status: 403, reason: 'assinatura inválida' };
    const conn = this.setup(companyId);
    const results = [];
    for (const entry of body.entry || [])
      for (const change of entry.changes || [])
        for (const msg of (change.value && change.value.messages) || []) {
          /* DEDUP: o id oficial da mensagem é a chave primária */
          const inserted = this.r.waEvent.db.run(
            `INSERT OR IGNORE INTO whatsapp_event
             (id, company_id, connection_id, from_number, kind, text, occurred_at, observed_at, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            msg.id, companyId, conn.id, msg.from, msg.type || 'text',
            msg.text ? msg.text.body : null,
            msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : null,
            this.clock.nowIso(), this.clock.nowIso()).changes > 0;
          if (!inserted) { results.push({ id: msg.id, duplicate: true }); continue; }
          this.r.waConnection.update(conn.id, {
            status: 'WHATSAPP_CONNECTED', last_inbound_at: this.clock.nowIso(),
            updated_at: this.clock.nowIso() });
          /* evento normalizado interno (mesma disciplina da Central) */
          this.bus.emit('whatsapp.message', {
            id: msg.id, companyId, from: msg.from, kind: msg.type || 'text',
            text: msg.text ? msg.text.body : null, observedAt: this.clock.nowIso() });
          const reply = await this._maybeReply(msg, conn, companyId);
          results.push({ id: msg.id, duplicate: false, replied: !!reply });
        }
    return { ok: true, results };
  }

  /* piloto de resposta — TODAS as portas precisam estar abertas */
  async _maybeReply(msg, conn, companyId) {
    if (!this.flags.isEnabled('WHATSAPP_HEAD_PILOT_REPLY_ENABLED', { companyId })) return null;
    if (!this.cfg.allowlist.includes(msg.from)) return null;      // só administrador
    if (!companyId || !this.chatFactory) return null;
    const text = msg.text ? msg.text.body : '';
    if (!text) return null;

    let reply;
    /* Sprint 10.B: comandos internos (drafts/promoções) passam pelo gateway,
       que usa o MESMO Adaptation Engine da tela — nunca automação paralela */
    const gw = this.commandGateway
      ? await this.commandGateway.handle({ companyId, from: msg.from, text }) : null;
    if (gw) {
      reply = gw.reply;
    } else {
      const chat = this.chatFactory(companyId);
      const r = chat.ask(text, { surface: 'whatsapp' });
      if (r.intent === 'ACTION_REQUEST') {
        /* WhatsApp NUNCA executa nem dispara piloto */
        reply = 'Preparei uma proposta de rascunho. A criação real exige revisão e confirmação na área Conexões.';
      } else {
        reply = r.reply;               // mesma Query Layer: fonte/hora/cobertura já inclusos
      }
    }
    this.r.waEvent.update(msg.id, { replied: 1, reply_text: reply });
    if (this.sender) await this.sender.send(msg.from, reply);
    else this.outbox.push({ to: msg.from, text: reply, at: this.clock.nowIso() });
    this.bus.emit('whatsapp.replied', { to: msg.from, companyId });
    return reply;
  }

  health(companyId) {
    const conn = this.r.waConnection.db.get(
      'SELECT * FROM whatsapp_connection WHERE company_id = ?', companyId);
    const events = conn ? this.r.waEvent.count('WHERE connection_id = ?', conn.id) : 0;
    return {
      channel: 'whatsapp', configured: this.configured(),
      missingConfig: this.missingConfig(),
      status: conn ? conn.status : 'WHATSAPP_INBOUND_DISABLED',
      webhookVerifiedAt: conn ? conn.webhook_verified_at : null,
      lastInboundAt: conn ? conn.last_inbound_at : null,
      inboundEvents: events,
      pilotReplyEnabled: this.flags.isEnabled('WHATSAPP_HEAD_PILOT_REPLY_ENABLED', { companyId }),
      allowlistSize: this.cfg.allowlist.length,
    };
  }
}

module.exports = { WhatsAppLive };

/* CONEXÃO OFICIAL AUTENTICADA (Sprint 09) — o fluxo OAuth, SÓ backend.

     usuário conecta a loja
     → autorização oficial do marketplace (authorizationUrl)
     → marketplace devolve authorization code
     → backend troca code por access + refresh token (authTransport)
     → tokens CIFRADOS (CredentialProvider)
     → conexão vinculada a empresa + conta + loja
     → capabilities validadas
     → sincronização inicial vira job na fila

   Nenhum segredo sai deste módulo: status/painel só veem máscara.
   TikTok Shop e Magalu: startConnect explica o bloqueio real
   (WAITING_PARTNER_APPROVAL / WAITING_CREDENTIALS) — nada é fingido. */
'use strict';
const { STATUS } = require('./declarations.js');

class ConnectionService {
  constructor({ repos, bus, registry, credentials, orchestrator, clock, authTransport, logger = null }) {
    this.r = repos; this.bus = bus; this.registry = registry;
    this.credentials = credentials; this.orchestrator = orchestrator;
    this.clock = clock; this.auth = authTransport; this.log = logger;
  }

  /* passo 1: inicia a conexão — devolve a URL de autorização oficial */
  startConnect(connectionId) {
    const conn = this.r.connection.byId(connectionId);
    const decl = this.registry.describe(conn.marketplace);
    if (!decl) throw new Error(`plataforma sem conector registrado: ${conn.marketplace}`);
    if (decl.integrationStatus !== STATUS.INTEGRATION_READY)
      throw new Error(`${decl.displayName}: integração real bloqueada — status ${decl.integrationStatus}. ` +
        'Validar documentação oficial, credenciais e permissões antes de conectar.');
    /* a URL real vem da configuração oficial da plataforma no deploy;
       aqui devolvemos o contrato do fluxo sem inventar endpoint */
    const state = `st_${connectionId}_${this.clock.nowMs()}`;
    this.bus.emit('central.connect.started', { connectionId, platform: conn.marketplace });
    return { platform: conn.marketplace, authType: decl.authType, state,
             flow: 'authorization_code', next: 'completeConnect({ code })' };
  }

  /* passo 2: callback — troca o code, cifra tokens, vincula conta/loja */
  async completeConnect(connectionId, { code }) {
    const conn = this.r.connection.byId(connectionId);
    const tokens = await this.auth.exchangeCode(conn.marketplace, code);
    this.credentials.store(connectionId, tokens);

    const connector = this.registry.connector(conn.marketplace);
    const validation = await connector.validateConnection({ connectionId });
    if (!validation.ok) throw new Error(`validação da conexão falhou: ${conn.marketplace}`);

    this.r.connection.update(connectionId, {
      status: 'connected', auth_type: 'OAUTH2', read_only: 1,
      account_id: tokens.accountId ?? validation.accountId,
      store_id: tokens.storeId ?? validation.storeId,
      connected_at: this.clock.nowIso(),
    });
    this.bus.emit('central.connected', {
      connectionId, platform: conn.marketplace,
      accountId: tokens.accountId ?? validation.accountId,
      tokenMasked: this.credentials.tokens.mask(tokens.accessToken),  // máscara, nunca o token
    });

    /* sincronização inicial como job (não bloqueia o request) */
    const initialSync = this.orchestrator.syncConnection(connectionId);
    return { connected: true, platform: conn.marketplace,
             accountId: tokens.accountId ?? validation.accountId,
             storeId: tokens.storeId ?? validation.storeId,
             capabilities: connector.capabilities, initialSync };
  }

  /* dev/teste: conecta com credencial MOCK para exercitar o pipeline com
     FIXTURES — inclusive TikTok/Magalu (que não têm OAuth real liberado).
     Guardas técnicas: exige auth mock E transporte de fixtures; jamais
     encosta em conta real. O gate de startConnect segue valendo p/ o real. */
  async connectMock(connectionId) {
    if (!this.auth || this.auth.kind !== 'mock-auth')
      throw new Error('connectMock exige MockAuthTransport — nunca usar com OAuth real');
    const conn = this.r.connection.byId(connectionId);
    const connector = this.registry.connector(conn.marketplace);
    if (!connector.transport || connector.transport.kind !== 'fixture')
      throw new Error('connectMock exige transporte de fixtures — nunca tocar conta real por acidente');
    return this.completeConnect(connectionId, { code: `mock-${connectionId}` });
  }

  revoke(connectionId) {
    this.r.connection.update(connectionId, { status: 'revoked', revoked_at: this.clock.nowIso() });
    this.bus.emit('central.revoked', { connectionId });
    return { revoked: true };
  }

  /* status SEM segredo: só máscara e metadados */
  status(connectionId) {
    const conn = this.r.connection.byId(connectionId);
    const decl = this.registry.describe(conn.marketplace);
    return {
      connectionId, platform: conn.marketplace, status: conn.status,
      accountId: conn.account_id, storeId: conn.store_id,
      readOnly: conn.read_only !== 0, connectedAt: conn.connected_at,
      integrationStatus: decl ? decl.integrationStatus : null,
      credential: this.credentials.maskedStatus(connectionId),
    };
  }
}

module.exports = { ConnectionService };

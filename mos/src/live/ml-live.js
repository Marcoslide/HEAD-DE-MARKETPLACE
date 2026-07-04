/* MERCADO LIVRE REAL (Sprint 10.A) — OAuth oficial, leitura real e
   confirmação OFICIAL de categoria.

   - OAuth: state seguro (nonce de uso ÚNICO com expiração), troca de code
     no backend, tokens no vault cifrado do Sprint 09. Nenhum segredo em
     frontend, logs, fixtures ou Git — config por variável de ambiente
     (nomes na checklist externa).
   - Leitura real: o MESMO SyncOrchestrator do Sprint 09, trocando apenas
     o transporte (fixture → HTTP oficial). READ_ONLY.
   - Categoria: os códigos PROVISIONAL do rule pack ORIENTAM a preparação;
     a VERDADE para o piloto vem da confirmação oficial pós-OAuth
     (snapshot com fonte, horário e versão). */
'use strict';
const crypto = require('node:crypto');

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';
const ML_API = 'https://api.mercadolibre.com';
const STATE_TTL_MS = 10 * 60 * 1000;

/* ---------------- OAuth ---------------- */
class MLOAuth {
  constructor({ repos, credentials, orchestrator, flags, clock, config = {},
                authHttp = null, logger = null }) {
    this.r = repos; this.credentials = credentials; this.orchestrator = orchestrator;
    this.flags = flags; this.clock = clock; this.log = logger;
    this.cfg = {
      clientId: config.clientId ?? process.env.ML_CLIENT_ID ?? null,
      clientSecret: config.clientSecret ?? process.env.ML_CLIENT_SECRET ?? null,
      redirectUri: config.redirectUri ?? process.env.ML_REDIRECT_URI ?? null,
    };
    /* troca real de code/refresh — injetável (mock nos testes, HTTP no deploy) */
    this.authHttp = authHttp || new MLAuthHttp(this.cfg);
  }
  configured() { return !!(this.cfg.clientId && this.cfg.clientSecret && this.cfg.redirectUri); }
  missingConfig() {
    return [['ML_CLIENT_ID', this.cfg.clientId], ['ML_CLIENT_SECRET', this.cfg.clientSecret],
            ['ML_REDIRECT_URI', this.cfg.redirectUri]].filter(([, v]) => !v).map(([k]) => k);
  }

  /* passo 1 — cria o state e devolve a URL de autorização OFICIAL */
  start({ companyId, userId, connectionId }) {
    if (!this.flags.isEnabled('MERCADO_LIVRE_OAUTH_ENABLED', { companyId, userId }))
      throw new Error('MERCADO_LIVRE_OAUTH_ENABLED desligada — ative a flag para esta empresa/usuário');
    if (!this.configured())
      throw new Error(`OAuth do Mercado Livre sem configuração: defina ${this.missingConfig().join(', ')} (ver docs/live-activation-checklist.md)`);
    const state = crypto.randomBytes(24).toString('hex');
    this.r.oauthState.insert({ id: state, company_id: companyId, user_id: userId,
      platform: 'mercado_livre', connection_id: connectionId,
      created_at: this.clock.nowIso(),
      expires_at: new Date(this.clock.nowMs() + STATE_TTL_MS).toISOString() });
    const authorizationUrl = `${ML_AUTH_URL}?response_type=code` +
      `&client_id=${encodeURIComponent(this.cfg.clientId)}` +
      `&redirect_uri=${encodeURIComponent(this.cfg.redirectUri)}` +
      `&state=${state}`;
    return { authorizationUrl, state, expiresInMs: STATE_TTL_MS };
  }

  /* passo 2 — callback: valida state (único/expirável), troca code, cifra tokens */
  async callback({ code, state }) {
    const row = this.r.oauthState.maybeById(state);
    if (!row) throw new Error('OAuth state desconhecido — fluxo bloqueado');
    if (row.used_at) throw new Error('OAuth state já utilizado — reuso bloqueado');
    if (row.expires_at < this.clock.nowIso()) throw new Error('OAuth state expirado — reinicie a conexão');
    this.r.oauthState.update(state, { used_at: this.clock.nowIso() });   // uso ÚNICO

    const tokens = await this.authHttp.exchangeCode(code);               // backend-only
    this.credentials.store(row.connection_id, tokens);                   // vault cifrado (S09)
    const identity = await this.authHttp.identity(tokens.accessToken);   // /users/me

    this.r.connection.update(row.connection_id, {
      status: 'connected', auth_type: 'OAUTH2', read_only: 1,
      account_id: String(identity.sellerId), store_id: identity.nickname || null,
      connected_at: this.clock.nowIso(),
    });
    this.r.audit.record('ml-oauth', 'connected', {
      companyId: row.company_id, entity: 'connection', entityId: row.connection_id,
      detail: { sellerId: String(identity.sellerId), nickname: identity.nickname,
                tokenMasked: this.credentials.tokens.mask(tokens.accessToken) } });

    /* sync inicial em READ_ONLY, se a leitura real estiver habilitada */
    let initialSync = null;
    if (this.flags.isEnabled('MERCADO_LIVRE_LIVE_READ_ENABLED', { companyId: row.company_id }))
      initialSync = this.orchestrator.syncConnection(row.connection_id);
    return { connected: true, connectionId: row.connection_id,
             sellerId: String(identity.sellerId), nickname: identity.nickname,
             readOnly: true, initialSync };
  }

  revoke(connectionId) {
    this.r.connection.update(connectionId, { status: 'revoked', revoked_at: this.clock.nowIso() });
    return { revoked: true };
  }
}

/* troca HTTP real (usada apenas quando há config; mock nos testes) */
class MLAuthHttp {
  constructor(cfg) { this.cfg = cfg; this.kind = 'http'; }
  async exchangeCode(code) {
    const res = await fetch(`${ML_API}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code',
        client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret,
        code, redirect_uri: this.cfg.redirectUri }) });
    if (!res.ok) throw new Error(`troca de code falhou (${res.status})`);   // sem vazar corpo/segredo
    const j = await res.json();
    return { accessToken: j.access_token, refreshToken: j.refresh_token,
             expiresIn: j.expires_in, scope: j.scope, tokenType: j.token_type };
  }
  async refresh(_platform, refreshToken) {
    const res = await fetch(`${ML_API}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token',
        client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret,
        refresh_token: refreshToken }) });
    if (!res.ok) throw new Error(`refresh falhou (${res.status})`);
    const j = await res.json();
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
  }
  async identity(accessToken) {
    const res = await fetch(`${ML_API}/users/me`,
      { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`identidade falhou (${res.status})`);
    const j = await res.json();
    return { sellerId: j.id, nickname: j.nickname };
  }
}

/* ---------------- transporte de LEITURA real (mesmo contrato da Central) ---------------- */
class MLLiveTransport {
  constructor({ credentials, clock, http = null }) {
    this.kind = 'http';
    this.credentials = credentials; this.clock = clock;
    this.http = http || globalThis.fetch;         // injetável nos testes
  }
  async _authed(connectionId, url) {
    const cred = this.credentials.load(connectionId);
    if (!cred) throw new Error('conexão sem credencial — refaça o OAuth');
    let res = await this.http(url, { headers: { authorization: `Bearer ${cred.accessToken}` } });
    if (res.status === 401) {
      await this.credentials.refreshAccess(connectionId, 'mercado_livre');
      const rotated = this.credentials.load(connectionId);
      res = await this.http(url, { headers: { authorization: `Bearer ${rotated.accessToken}` } });
    }
    if (!res.ok) throw new Error(`Mercado Livre respondeu ${res.status} para ${url.replace(ML_API, '')}`);
    return res.json();
  }
  /* recursos de LEITURA — endpoints oficiais documentados */
  async fetch(_platform, resource, ctx = {}) {
    const sellerId = ctx.accountId;
    switch (resource) {
      case 'listings': {
        const ids = await this._authed(ctx.connectionId, `${ML_API}/users/${sellerId}/items/search?limit=50`);
        const out = [];
        for (const id of ids.results || [])
          out.push(await this._authed(ctx.connectionId, `${ML_API}/items/${id}`));
        return out;
      }
      case 'orders': {
        const j = await this._authed(ctx.connectionId,
          `${ML_API}/orders/search?seller=${sellerId}&sort=date_desc&limit=50`);
        return j.results || [];
      }
      default:
        return [];   // demais recursos entram conforme forem confirmados
    }
  }
  async validate(_platform, ctx = {}) {
    const j = await this._authed(ctx.connectionId, `${ML_API}/users/me`);
    return { ok: true, accountId: String(j.id), storeId: j.nickname };
  }
  /* categoria OFICIAL — a trava do piloto */
  async officialCategory(connectionId, categoryId) {
    const cat = await this._authed(connectionId, `${ML_API}/categories/${categoryId}`);
    const attrs = await this._authed(connectionId, `${ML_API}/categories/${categoryId}/attributes`);
    return { category: cat, attributes: attrs, sourceUrl: `${ML_API}/categories/${categoryId}` };
  }
  /* A ÚNICA escrita possível no sistema — usada EXCLUSIVAMENTE pelo
     PilotService, atrás de todos os gates. Não faz parte do contrato de
     conector (que segue READ_ONLY). */
  async createItem(connectionId, payload) {
    const cred = this.credentials.load(connectionId);
    const res = await this.http(`${ML_API}/items`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cred.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(`criação do item falhou (${res.status})`); e.response = j; throw e; }
    return j;
  }
}

/* ---------------- confirmação OFICIAL de categoria ---------------- */
class CategoryConfirmService {
  constructor({ repos, clock, transport = null }) {
    this.r = repos; this.clock = clock; this.transport = transport;
  }
  /* confirma a categoria contra a FONTE OFICIAL e grava o snapshot.
     Sem transporte oficial → não há confirmação → REVIEW_REQUIRED. */
  async confirm({ companyId, connectionId, categoryId, officialSource = null }) {
    const source = officialSource
      || (this.transport && this.transport.kind === 'http'
          ? { kind: 'OFFICIAL_API',
              get: id => this.transport.officialCategory(connectionId, id) }
          : null);
    if (!source)
      return { confirmed: false, status: 'REVIEW_REQUIRED',
               reason: 'sem fonte oficial disponível — conecte o Mercado Livre (OAuth) para confirmar categoria e atributos' };
    const data = await source.get(categoryId);
    const required = (data.attributes || [])
      .filter(a => a.tags && (a.tags.required || (Array.isArray(a.tags) && a.tags.includes('required'))))
      .map(a => a.id);
    const snap = this.r.categorySnapshot.insert({
      company_id: companyId, connection_id: connectionId, platform: 'mercado_livre',
      category_id: categoryId,
      category_path: data.category && data.category.path_from_root
        ? data.category.path_from_root.map(p => p.name).join(' > ') : null,
      attributes_json: { required, all: (data.attributes || []).map(a => a.id) },
      restrictions_json: data.category && data.category.settings ? data.category.settings : {},
      source: source.kind || 'OFFICIAL_API', source_url: data.sourceUrl || null,
      api_version: data.apiVersion || null,
      fetched_at: this.clock.nowIso(), created_at: this.clock.nowIso(),
    });
    return { confirmed: true, status: 'CONFIRMED', snapshotId: snap.id,
             categoryId, requiredAttributes: required, source: snap.source,
             fetchedAt: snap.fetched_at };
  }
}

module.exports = { MLOAuth, MLAuthHttp, MLLiveTransport, CategoryConfirmService, ML_AUTH_URL, ML_API };

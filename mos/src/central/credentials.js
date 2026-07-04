/* CREDENCIAIS DA CENTRAL (Sprint 09) — tokens da loja, SOMENTE backend.

   Leis (Constituição da Central):
   - token NUNCA vai para frontend, logs ou Git;
   - access e refresh cifrados SEPARADAMENTE (AES-256-GCM, node:crypto);
   - qualquer exposição externa usa a MÁSCARA (4 primeiros + 4 últimos);
   - renovação concorrente tem lock single-flight: duas chamadas simultâneas
     geram UMA troca no marketplace;
   - pesquisa pública NUNCA passa por aqui (fonte separada por construção). */
'use strict';
const crypto = require('node:crypto');

class TokenService {
  constructor({ key = null } = {}) {
    /* chave: env MOS_CREDENTIAL_KEY (32 bytes hex) em produção;
       em dev deriva uma chave local — marcada como devKey para o /__dev */
    const envKey = key || process.env.MOS_CREDENTIAL_KEY;
    if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) {
      this.key = Buffer.from(envKey, 'hex');
      this.devKey = false;
    } else {
      this.key = crypto.scryptSync('mos-dev-only-credential-key', 'mos-central-salt', 32);
      this.devKey = true;
    }
  }
  encrypt(plain) {
    if (plain == null) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
  }
  decrypt(blob) {
    if (blob == null) return null;
    const [iv, tag, data] = blob.split('.').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
  mask(token) {
    if (!token) return null;
    const t = String(token);
    return t.length <= 8 ? '••••' : `${t.slice(0, 4)}…${t.slice(-4)}`;
  }
}

class CredentialProvider {
  constructor({ repos, tokenService, clock, authTransport, logger = null }) {
    this.r = repos;
    this.tokens = tokenService;
    this.clock = clock;
    this.auth = authTransport;
    this.log = logger;
    this._refreshing = new Map();   // lock single-flight por conexão
  }

  /* guarda tokens CIFRADOS; nada em claro toca o banco ou o log */
  store(connectionId, { accessToken, refreshToken = null, expiresIn = null, scope = null, tokenType = 'bearer' }) {
    const now = this.clock.nowIso();
    const expiresAt = expiresIn != null
      ? new Date(this.clock.nowMs() + expiresIn * 1000).toISOString() : null;
    const existing = this.r.credential.db.get(
      'SELECT id FROM marketplace_credential WHERE connection_id = ?', connectionId);
    const row = {
      connection_id: connectionId,
      access_token_enc: this.tokens.encrypt(accessToken),
      refresh_token_enc: this.tokens.encrypt(refreshToken),
      token_type: tokenType, scope, expires_at: expiresAt, updated_at: now,
    };
    if (existing) return this.r.credential.update(existing.id, { ...row, rotated_at: now });
    const created = this.r.credential.insert({ ...row, created_at: now });
    if (this.log) this.log.info('credential.stored', {
      connectionId, tokenMasked: this.tokens.mask(accessToken), expiresAt });
    return created;
  }

  /* uso interno do backend (transporte autenticado) — nunca sai daqui */
  load(connectionId) {
    const row = this.r.credential.db.get(
      'SELECT * FROM marketplace_credential WHERE connection_id = ?', connectionId);
    if (!row) return null;
    return {
      accessToken: this.tokens.decrypt(row.access_token_enc),
      refreshToken: this.tokens.decrypt(row.refresh_token_enc),
      tokenType: row.token_type, scope: row.scope, expiresAt: row.expires_at,
    };
  }

  /* o que PODE ser mostrado (status/painel): tudo mascarado */
  maskedStatus(connectionId) {
    const row = this.r.credential.db.get(
      'SELECT * FROM marketplace_credential WHERE connection_id = ?', connectionId);
    if (!row) return { hasCredential: false };
    const access = this.tokens.decrypt(row.access_token_enc);
    return {
      hasCredential: true,
      tokenMasked: this.tokens.mask(access),
      expiresAt: row.expires_at, rotatedAt: row.rotated_at,
      devKey: this.tokens.devKey,
    };
  }

  /* renovação com LOCK single-flight: chamadas concorrentes compartilham
     a MESMA troca — nunca duas renovações simultâneas para a mesma loja */
  refreshAccess(connectionId, platform) {
    if (this._refreshing.has(connectionId)) return this._refreshing.get(connectionId);
    const p = (async () => {
      const current = this.load(connectionId);
      if (!current || !current.refreshToken)
        throw new Error(`conexão ${connectionId} sem refresh token — reconectar a loja`);
      const rotated = await this.auth.refresh(platform, current.refreshToken);
      this.store(connectionId, rotated);
      if (this.log) this.log.info('credential.rotated', {
        connectionId, platform, tokenMasked: this.tokens.mask(rotated.accessToken) });
      return { rotated: true, tokenMasked: this.tokens.mask(rotated.accessToken) };
    })().finally(() => this._refreshing.delete(connectionId));
    this._refreshing.set(connectionId, p);
    return p;
  }
}

module.exports = { TokenService, CredentialProvider };

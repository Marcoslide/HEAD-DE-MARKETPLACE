/* FEATURE FLAGS (Sprint 10.A) — por empresa, conta e usuário.
   TUDO nasce desligado. Nenhuma flag libera escrita geral: a única
   exceção de escrita é o piloto, e mesmo ela só cria UM anúncio novo. */
'use strict';

const FLAGS = [
  'WHATSAPP_INBOUND_ENABLED',
  'WHATSAPP_HEAD_PILOT_REPLY_ENABLED',
  'MERCADO_LIVRE_OAUTH_ENABLED',
  'MERCADO_LIVRE_LIVE_READ_ENABLED',
  'MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED',
  'CREATIVE_IMAGE_GENERATION_ENABLED',
];

class FeatureFlags {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  /* liga/desliga num escopo (empresa, conta e/ou usuário) */
  set(flag, { companyId = null, accountId = null, userId = null } = {}, enabled) {
    if (!FLAGS.includes(flag)) throw new Error(`flag desconhecida: ${flag}`);
    const existing = this.r.featureFlag.db.get(
      `SELECT id FROM feature_flag WHERE flag = ? AND company_id IS ? AND account_id IS ? AND user_id IS ?`,
      flag, companyId, accountId, userId);
    const row = { flag, company_id: companyId, account_id: accountId, user_id: userId,
                  enabled: enabled ? 1 : 0, updated_at: this.clock.nowIso() };
    return existing ? this.r.featureFlag.update(existing.id, row) : this.r.featureFlag.insert(row);
  }

  /* habilitada SÓ se existe um registro ligado cujo escopo casa com o
     contexto (escopo mais específico primeiro). Default: DESLIGADA. */
  isEnabled(flag, { companyId = null, accountId = null, userId = null } = {}) {
    const rows = this.r.featureFlag.db.all('SELECT * FROM feature_flag WHERE flag = ?', flag);
    const matches = rows.filter(r =>
      (r.company_id == null || r.company_id === companyId) &&
      (r.account_id == null || r.account_id === accountId) &&
      (r.user_id == null || r.user_id === userId));
    if (!matches.length) return false;
    const spec = r => (r.company_id ? 4 : 0) + (r.account_id ? 2 : 0) + (r.user_id ? 1 : 0);
    matches.sort((a, b) => spec(b) - spec(a));
    return matches[0].enabled === 1;
  }

  snapshot() {
    return FLAGS.map(f => ({ flag: f,
      scopes: this.r.featureFlag.db.all('SELECT company_id, account_id, user_id, enabled FROM feature_flag WHERE flag = ?', f) }));
  }
}

module.exports = { FeatureFlags, FLAGS };

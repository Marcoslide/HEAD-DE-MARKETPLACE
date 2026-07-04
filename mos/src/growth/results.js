/* RESULTADOS (Sprint 10.B) — números comerciais consolidados, honestos.

   TODO número sai com: período, fonte, atualização, cobertura e a
   natureza do dado (REAL / IMPORTADO / DEMONSTRATIVO / SEM_DADO).
   Demo e real NUNCA se misturam sem rótulo. ROI só quando os dados
   existirem — nunca inventado. */
'use strict';

class ResultsService {
  constructor({ repos, clock }) { this.r = repos; this.clock = clock; }

  _metric(value, { source, period, coverage, note = null }) {
    return { value, period, source, coverage, note, updatedAt: this.clock.nowIso() };
  }

  consolidated({ companyId, period = null }) {
    const p = period || this.clock.nowIso().slice(0, 7);   // mês corrente
    const m = (v, src, cov, note) => this._metric(v, { source: src, period: p, coverage: cov, note });

    /* vendas reais só existem após sincronização da Central */
    const orders = this.r.morder.db.all(
      `SELECT * FROM marketplace_order WHERE company_id = ? AND substr(occurred_at,1,7) = ?`,
      companyId, p);
    const salesByMarketplace = orders.length
      ? m(orders.reduce((acc, o) => {
          acc[o.platform] = Math.round(((acc[o.platform] || 0) + (o.total || 0)) * 100) / 100;
          return acc; }, {}),
          'REAL', 'pedidos sincronizados pela Central', null)
      : m(null, 'SEM_DADO', 'nenhuma praça sincronizada',
          'conecte um marketplace (Conexões) para ver vendas reais');

    /* leads: separação demo × real embutida */
    const leads = this.r.lead.db.all('SELECT * FROM lead WHERE company_id = ?', companyId);
    const realLeads = leads.filter(l => l.data_source !== 'DEMO');
    const demoLeads = leads.filter(l => l.data_source === 'DEMO');
    const byOrigin = rows => rows.reduce((acc, l) =>
      (acc[l.origin] = (acc[l.origin] || 0) + 1, acc), {});
    const won = realLeads.filter(l => l.status === 'GANHO').length;

    /* afiliados */
    const convs = this.r.affiliateConversion.db.all(
      `SELECT * FROM affiliate_conversion WHERE company_id = ? AND status = 'APROVADA'`, companyId);
    const affSources = [...new Set(convs.map(c => c.source))];
    const affKind = !convs.length ? 'SEM_DADO'
      : affSources.every(s => /IMPORTACAO|manual/i.test(s)) ? 'IMPORTADO' : 'REAL';

    /* comissões e promoções */
    const commissions = this.r.affiliateCommission.db.all(
      'SELECT * FROM affiliate_commission WHERE company_id = ?', companyId);
    const promotions = this.r.promotion.db.all(
      'SELECT * FROM promotion WHERE company_id = ?', companyId);
    const caps = this.r.promotionCap.db.all(
      `SELECT c.* FROM promotion_inventory_cap c JOIN promotion pr ON pr.id = c.promotion_id
       WHERE pr.company_id = ?`, companyId);

    return {
      companyId, period: p, asOf: this.clock.nowIso(),
      salesByMarketplace,
      leadsByOrigin: m({ real: byOrigin(realLeads), demo: byOrigin(demoLeads) },
        realLeads.some(l => l.data_source === 'IMPORTACAO') ? 'IMPORTADO'
          : realLeads.length ? 'REAL' : demoLeads.length ? 'DEMONSTRATIVO' : 'SEM_DADO',
        'leads registrados internamente (CRM externo não conectado)',
        demoLeads.length ? `${demoLeads.length} leads demonstrativos rotulados separadamente` : null),
      leadConversion: m(realLeads.length
          ? { won, total: realLeads.length,
              pct: Math.round(won / realLeads.length * 1000) / 10 }
          : null,
        realLeads.length ? 'REAL' : 'SEM_DADO', 'sobre leads reais/importados apenas'),
      affiliateRevenue: m(convs.length
          ? Math.round(convs.reduce((a, c) => a + c.amount, 0) * 100) / 100 : null,
        affKind, 'conversões atribuídas registradas',
        affKind === 'IMPORTADO' ? 'dados importados manualmente' : null),
      commissions: m(commissions.length
          ? { estimadas: Math.round(commissions.filter(c => c.status === 'ESTIMADA')
              .reduce((a, c) => a + c.amount, 0) * 100) / 100,
              total: commissions.length }
          : null,
        commissions.length ? 'IMPORTADO' : 'SEM_DADO',
        'comissões ESTIMADAS — nenhum pagamento real'),
      promotionCost: m(promotions.length
          ? { promocoes: promotions.length,
              emRevisao: promotions.filter(x => x.status === 'EM_REVISAO').length,
              aprovadasInternamente: promotions.filter(x => x.status === 'APROVADA_INTERNAMENTE').length }
          : null,
        promotions.length ? 'REAL' : 'SEM_DADO',
        'promoções internas — nenhuma ativa externamente'),
      stockCommitted: m(caps.length
          ? caps.reduce((a, c) => a + (c.cap_units || 0), 0) : null,
        caps.length ? 'REAL' : 'SEM_DADO', 'limites de estoque definidos em promoções internas'),
      roi: m(null, 'SEM_DADO', 'ROI exige custo e receita reais conectados',
        'não calculado — dados insuficientes; nunca estimado sem base'),
    };
  }
}

module.exports = { ResultsService };

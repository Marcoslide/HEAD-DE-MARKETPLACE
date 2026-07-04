/* AFFILIATE INTELLIGENCE (Sprint 10.B) — atribuição honesta.

   Regras duras: uma venda pertence a UM afiliado (order_ref único);
   clique NUNCA vira comissão automaticamente; toda atribuição registra
   regra, janela e confiança (CONFIRMADA/ESTIMADA/DESCONHECIDA); comissão
   nasce ESTIMADA e jamais vira pagamento real sem fluxo de aprovação
   futuro; dados importados manualmente ficam SEMPRE rotulados como tal.
   Nunca prometemos atribuição que a integração não entregou. */
'use strict';

const AFFILIATE_STATUSES = ['ATIVO', 'PAUSADO', 'EM_REVISAO',
  'PENDENTE_DE_DADOS', 'SEM_ATRIBUICAO_CONFIRMADA'];

class AffiliateService {
  constructor({ repos, permissions, approvals, clock, bus }) {
    this.r = repos; this.permissions = permissions; this.approvals = approvals;
    this.clock = clock; this.bus = bus;
  }

  createPartner({ companyId, userId = null, name, contact = null, channel = null,
                  commissionPct = null, code = null, linkUrl = null, status = 'PENDENTE_DE_DADOS' }) {
    if (userId) this.permissions.assert(userId, companyId, 'affiliate.manage');
    if (!AFFILIATE_STATUSES.includes(status)) throw new Error(`status inválido: ${status}`);
    const partner = this.r.affiliate.insert({ company_id: companyId, name, contact,
      channel, commission_pct: commissionPct, status,
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    if (code) this.r.affiliateCode.insert({ company_id: companyId,
      affiliate_id: partner.id, code, created_at: this.clock.nowIso() });
    if (linkUrl) this.r.affiliateLink.insert({ company_id: companyId,
      affiliate_id: partner.id, url: linkUrl, created_at: this.clock.nowIso() });
    this.r.audit.record('affiliate', 'partner_created', { companyId,
      entity: 'affiliate_partner', entityId: partner.id, detail: { name, by: userId } });
    return partner;
  }

  /* clique/evento — NUNCA gera comissão por si só */
  trackEvent({ companyId, affiliateId, kind, orderRef = null, productId = null,
               marketplace = null, rule = null, windowDays = null,
               confidence = 'DESCONHECIDA', source, occurredAt = null }) {
    if (!source) throw new Error('evento de atribuição exige fonte identificada');
    return this.r.attributionEvent.insert({ company_id: companyId,
      affiliate_id: affiliateId, kind, order_ref: orderRef, product_id: productId,
      marketplace, rule, window_days: windowDays, confidence, source,
      occurred_at: occurredAt || this.clock.nowIso(), created_at: this.clock.nowIso() });
  }

  /* atribuir uma VENDA: order_ref é único — nunca dois afiliados na mesma venda */
  attributeSale({ companyId, affiliateId, orderRef, amount, marketplace = null,
                  productId = null, rule = 'last-click', windowDays = 7,
                  confidence = 'ESTIMADA', source, occurredAt = null }) {
    if (!source) throw new Error('atribuição exige fonte identificada');
    const existing = this.r.affiliateConversion.db.get(
      'SELECT id, affiliate_id FROM affiliate_conversion WHERE company_id = ? AND order_ref = ?',
      companyId, orderRef);
    if (existing) return { attributed: false,
      reason: `venda ${orderRef} já atribuída ao afiliado ${existing.affiliate_id} — dupla atribuição bloqueada`,
      existingConversionId: existing.id };

    const conv = this.r.affiliateConversion.insert({ company_id: companyId,
      affiliate_id: affiliateId, order_ref: orderRef, amount, marketplace,
      product_id: productId, status: 'APROVADA', confidence, source,
      occurred_at: occurredAt || this.clock.nowIso(), created_at: this.clock.nowIso() });
    this.trackEvent({ companyId, affiliateId, kind: 'sale', orderRef, productId,
      marketplace, rule, windowDays, confidence, source, occurredAt });

    /* comissão nasce ESTIMADA — não é pagamento, não é valor final */
    let commission = null;
    const partner = this.r.affiliate.byId(affiliateId);
    if (partner.commission_pct != null) {
      commission = this.r.affiliateCommission.insert({ company_id: companyId,
        affiliate_id: affiliateId, conversion_id: conv.id,
        amount: Math.round(amount * partner.commission_pct) / 100,
        status: 'ESTIMADA', source, created_at: this.clock.nowIso(),
        updated_at: this.clock.nowIso() });
    }
    this.r.audit.record('affiliate', 'sale_attributed', { companyId,
      entity: 'affiliate_conversion', entityId: conv.id,
      detail: { affiliateId, orderRef, rule, windowDays, confidence, source } });
    return { attributed: true, conversion: conv, commission };
  }

  /* importação manual/CSV — fonte gravada, rótulo honesto */
  importPerformance({ companyId, userId, affiliateId, rows,
                      sourceLabel = 'IMPORTACAO_MANUAL' }) {
    this.permissions.assert(userId, companyId, 'affiliate.manage');
    let imported = 0, duplicates = 0;
    for (const row of rows) {
      const r = this.attributeSale({ companyId, affiliateId, source: sourceLabel,
        confidence: 'ESTIMADA', ...row });
      if (r.attributed) imported++; else duplicates++;
    }
    this.r.affiliate.update(affiliateId, {
      status: 'ATIVO', updated_at: this.clock.nowIso() });
    this.r.audit.record('affiliate', 'performance_imported', { companyId,
      entity: 'affiliate_partner', entityId: affiliateId,
      detail: { imported, duplicates, sourceLabel, by: userId } });
    return { imported, duplicates, sourceLabel,
             note: 'dados importados manualmente — não são atribuição confirmada de integração' };
  }

  /* lote de pagamento: RASCUNHO/EM_REVISAO apenas — pagar é fluxo futuro */
  createPayoutBatch({ companyId, userId, period }) {
    this.permissions.assert(userId, companyId, 'commission.view');
    const pending = this.r.affiliateCommission.db.all(
      `SELECT * FROM affiliate_commission WHERE company_id = ? AND payout_batch_id IS NULL
       AND status IN ('ESTIMADA','APROVADA')`, companyId);
    const total = Math.round(pending.reduce((a, c) => a + c.amount, 0) * 100) / 100;
    const approval = this.approvals.require({ companyId, kind: 'COMMISSION_PAYOUT',
      entity: 'affiliate_payout_batch', entityId: period, requestedBy: userId,
      detail: { total, commissions: pending.length } });
    const batch = this.r.payoutBatch.insert({ company_id: companyId, period, total,
      status: 'EM_REVISAO', approval_id: approval.id,
      created_at: this.clock.nowIso(), updated_at: this.clock.nowIso() });
    for (const c of pending)
      this.r.affiliateCommission.update(c.id, { payout_batch_id: batch.id,
        status: 'PENDENTE', updated_at: this.clock.nowIso() });
    return { batch, approval,
             note: 'lote em revisão — pagamento real de comissão é fluxo futuro e exige aprovação' };
  }

  pay() { throw new Error('pagamento real de comissão não habilitado — fluxo futuro com aprovação forte'); }

  /* painel: cada número com fonte, período e cobertura */
  panel({ companyId, period = null, marketplace = null }) {
    const partners = this.r.affiliate.db.all(
      'SELECT * FROM affiliate_partner WHERE company_id = ?', companyId);
    const rows = partners.map(p => {
      let convSql = `SELECT * FROM affiliate_conversion WHERE company_id = ? AND affiliate_id = ?`;
      const params = [companyId, p.id];
      if (marketplace) { convSql += ' AND marketplace = ?'; params.push(marketplace); }
      if (period) { convSql += ` AND substr(occurred_at,1,7) = ?`; params.push(period); }
      const convs = this.r.affiliateConversion.db.all(convSql, ...params);
      const clicks = this.r.attributionEvent.count(
        `WHERE company_id = ? AND affiliate_id = ? AND kind = 'click'`, companyId, p.id);
      const approved = convs.filter(c => c.status === 'APROVADA');
      const cancelled = convs.filter(c => c.status === 'CANCELADA').length;
      const returned = convs.filter(c => c.status === 'DEVOLVIDA').length;
      const revenue = Math.round(approved.reduce((a, c) => a + c.amount, 0) * 100) / 100;
      const comm = this.r.affiliateCommission.db.all(
        'SELECT * FROM affiliate_commission WHERE company_id = ? AND affiliate_id = ?',
        companyId, p.id);
      const sum = st => Math.round(comm.filter(c => c.status === st)
        .reduce((a, c) => a + c.amount, 0) * 100) / 100;
      const sources = [...new Set(convs.map(c => c.source))];
      return {
        affiliateId: p.id, name: p.name, channel: p.channel, status: p.status,
        clicks, orders: approved.length, cancelled, returned, revenue,
        avgTicket: approved.length ? Math.round(revenue / approved.length * 100) / 100 : null,
        conversionRate: clicks ? Math.round(approved.length / clicks * 1000) / 10 : null,
        commission: { estimada: sum('ESTIMADA'), aprovada: sum('APROVADA'), pendente: sum('PENDENTE') },
        byMarketplace: approved.reduce((m, c) => {
          const k = c.marketplace || 'sem praça';
          m[k] = Math.round(((m[k] || 0) + c.amount) * 100) / 100; return m; }, {}),
        attribution: {
          sources,
          confidence: [...new Set(convs.map(c => c.confidence))],
          note: sources.every(s => /IMPORTACAO|manual/i.test(s)) && sources.length
            ? 'dados importados manualmente' : sources.length ? 'atribuição registrada' : 'sem dados',
        },
      };
    }).sort((a, b) => b.revenue - a.revenue)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return { companyId, period, marketplace, partners: rows,
             coverage: 'atribuições registradas internamente (importação manual permitida)',
             integrationConnected: false, asOf: this.clock.nowIso() };
  }
}

module.exports = { AffiliateService, AFFILIATE_STATUSES };

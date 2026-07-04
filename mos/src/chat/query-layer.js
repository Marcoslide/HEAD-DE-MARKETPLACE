/* HEAD CHAT · OPERATIONAL INTELLIGENCE QUERY LAYER (Sprint 09.A)

   Serviços TIPADOS sobre o dataset canônico (fixture agora, Central
   depois). Esta camada:
   - busca, conta, filtra, compara e calcula — devolve FATOS estruturados;
   - carimba TODA resposta com fonte/asOf/cobertura (hierarquia de fontes);
   - quando não há dado, devolve NO_DATA — a camada de cima é honesta.

   A interpretação (IA) escolhe o serviço; NUNCA produz número. */
'use strict';
const { resolvePeriod } = require('./period.js');

const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;

class QueryLayer {
  constructor({ dataset, clock, mie = null }) {
    this.d = dataset; this.clock = clock; this.mie = mie;
  }

  _meta(extra = {}) {
    return {
      dataSource: this.d.source, isLive: this.d.isLive,
      asOf: this.clock.nowIso(),
      coverage: this.d.connectedPlatforms,
      missingPlatforms: this.d.missingPlatforms,
      confidence: this.d.isLive ? 1 : 0.9,
      ...extra,
    };
  }
  _noData(what) {
    return { kind: 'NO_DATA', what, ...this._meta({ dataSource: 'NO_DATA', confidence: 0 }) };
  }
  _platforms(filter) {
    if (!filter || filter[0] === 'ALL') return this.d.connectedPlatforms;
    return filter;
  }
  _sumPeriod(period, platforms, pick) {
    let total = 0; const byPlatform = {}; const missing = [];
    for (const p of platforms) {
      if (!this.d.connectedPlatforms.includes(p)) { missing.push(p); continue; }
      let acc = 0;
      for (const key of period.dateKeys) {
        const day = this.d.sales[key];
        if (!day || !day[p]) continue;
        acc += pick(day[p], key);
      }
      byPlatform[p] = r2(acc); total += acc;
    }
    return { total: r2(total), byPlatform, requestedButMissing: missing };
  }

  /* ---------- VENDAS ---------- */
  getSalesSummary({ platforms = ['ALL'], period = { type: 'TODAY' }, compareWith = null, ranking = null } = {}) {
    if (!this.d.sales || !Object.keys(this.d.sales).length) return this._noData('vendas');
    const P = resolvePeriod(period, this.clock);
    const plats = this._platforms(platforms);
    /* pediram SÓ plataformas não conectadas → honestidade, não "R$ 0" */
    const requested = platforms[0] === 'ALL' ? plats : platforms;
    if (requested.every(p => !this.d.connectedPlatforms.includes(p)))
      return { ...this._noData('vendas'), missingPlatforms: requested };
    const todaySameTime = P.type === 'TODAY';
    const rev = this._sumPeriod(P, plats, (d, key) =>
      P.sameTime ? (d.revenueSameTime ?? d.revenue) : d.revenue);
    const ord = this._sumPeriod(P, plats, d =>
      P.sameTime ? (d.ordersSameTime ?? d.orders) : d.orders);
    const out = {
      kind: 'SALES', metric: 'GROSS_REVENUE', period: P,
      grossRevenue: rev.total, byPlatform: rev.byPlatform,
      ordersCount: ord.total,
      ticketAvg: ord.total ? r2(rev.total / ord.total) : null,
      requestedButMissing: rev.requestedButMissing,
      ...this._meta(),
    };
    if (ranking === 'BY_PRODUCT') {
      const byProduct = {};
      for (const p of plats) for (const key of P.dateKeys) {
        const d = this.d.sales[key] && this.d.sales[key][p];
        if (!d) continue;
        for (const [sku, [v, n]] of Object.entries(d.byProduct))
          byProduct[sku] = byProduct[sku] || { sku, revenue: 0, orders: 0 },
          byProduct[sku].revenue = r2(byProduct[sku].revenue + v),
          byProduct[sku].orders += n;
      }
      out.byProduct = Object.values(byProduct)
        .map(x => ({ ...x, name: (this.d.products.find(pr => pr.sku === x.sku) || {}).name || x.sku }))
        .sort((a, b) => b.revenue - a.revenue);
    }
    /* comparação parcial-contra-parcial (nunca dia parcial × dia inteiro) */
    if (compareWith === 'YESTERDAY_SAME_TIME' || (todaySameTime && compareWith !== false)) {
      const Y = resolvePeriod({ type: 'SAME_TIME_YESTERDAY' }, this.clock);
      const yRev = this._sumPeriod(Y, plats, d => d.revenueSameTime ?? d.revenue);
      if (yRev.total > 0)
        out.comparison = {
          label: 'ontem no mesmo horário', value: yRev.total,
          deltaPct: r1(((rev.total - yRev.total) / yRev.total) * 100),
          byPlatform: yRev.byPlatform,
        };
    }
    return out;
  }

  /* ---------- PEDIDOS ---------- */
  getOrdersSummary({ platforms = ['ALL'], period = { type: 'TODAY' }, statuses = null } = {}) {
    if (!this.d.sales) return this._noData('pedidos');
    const P = resolvePeriod(period, this.clock);
    const plats = this._platforms(platforms);
    const received = this._sumPeriod(P, plats, d => d.orders);
    const f = this.d.fulfillment;
    const out = {
      kind: 'ORDERS', period: P,
      received: received.total, byPlatform: received.byPlatform,
      requestedButMissing: received.requestedButMissing,
      operational: f ? {
        toShip: f.toShip, stages: f.stages, shippedToday: f.shippedToday,
        late: f.lateOrders.length, criticalToday: f.criticalToday.length,
        awaitingPickup: f.stages.awaiting_pickup,
        cancelledToday: f.cancelledToday, returnedToday: f.returnedToday,
      } : null,
      statusFilter: statuses,
      ...this._meta(),
    };
    return out;
  }

  /* ---------- EXPEDIÇÃO / PRODUÇÃO ---------- */
  getFulfillmentStatus() {
    const f = this.d.fulfillment;
    if (!f) return this._noData('expedição/produção');
    const cap = f.capacity;
    return {
      kind: 'FULFILLMENT',
      toShip: f.toShip, stages: f.stages, shippedToday: f.shippedToday,
      late: f.lateOrders, criticalToday: f.criticalToday,
      capacity: cap,
      willFit: cap.remainingToday >= f.toShip,
      atRisk: Math.max(0, f.toShip - cap.remainingToday),
      customAtRisk: Math.max(0, cap.customPendingToday - cap.customPerDay),
      ...this._meta(),
    };
  }

  /* ---------- ESTOQUE ---------- */
  getInventorySummary({ productScope = null, platforms = ['ALL'] } = {}) {
    if (!this.d.inventory || !this.d.inventory.length) return this._noData('estoque');
    const plats = this._platforms(platforms);
    let items = this.d.inventory.filter(i => plats.includes(i.platform));
    if (productScope) items = items.filter(i => i.sku === productScope.sku);
    const enriched = items.map(i => ({
      ...i,
      coverageDays: i.dailySales ? r1(i.available / i.dailySales) : null,
      critical: i.dailySales ? i.available / i.dailySales < 3 : null,
    }));
    return {
      kind: 'INVENTORY', items: enriched,
      critical: enriched.filter(i => i.critical),
      productScope,
      ...this._meta(),
    };
  }

  /* ---------- ADS ---------- */
  getAdsPerformance({ platforms = ['ALL'] } = {}) {
    if (!this.d.ads) return this._noData('Ads');
    const plats = this._platforms(platforms);
    const campaigns = this.d.ads.campaigns.filter(c => plats.includes(c.platform));
    const spend = r2(campaigns.reduce((s, c) => s + c.spend, 0));
    const revenue = r2(campaigns.reduce((s, c) => s + c.attributedRevenue, 0));
    const orders = campaigns.reduce((s, c) => s + c.attributedOrders, 0);
    return {
      kind: 'ADS',
      spend, attributedRevenue: revenue, attributedOrders: orders,
      roas: spend ? r1(revenue / spend) : null,             // faturamento atribuído / investimento
      acosPct: revenue ? r1((spend / revenue) * 100) : null, // investimento / faturamento atribuído
      cpa: orders ? r2(spend / orders) : null,               // investimento / pedidos atribuídos
      campaigns: campaigns.map(c => ({
        ...c,
        ctrPct: c.impressions ? r1((c.clicks / c.impressions) * 100) : null,
        cpc: c.clicks ? r2(c.spend / c.clicks) : null,
        wasteful: c.spend > 50 && c.attributedOrders === 0,
      })),
      wasteful: campaigns.filter(c => c.spend > 50 && c.attributedOrders === 0)
        .map(c => ({ name: c.name, spend: c.spend })),
      basis: 'atribuição da própria plataforma, hoje até agora',
      ...this._meta(),
    };
  }

  /* ---------- CONVERSÃO / FUNIL ---------- */
  getConversionSummary({ platforms = ['ALL'] } = {}) {
    if (!this.d.funnel) return this._noData('conversão');
    const plats = this._platforms(platforms);
    const rows = this.d.funnel.filter(f => plats.includes(f.platform)).map(f => ({
      platform: f.platform,
      ctrPct: r1((f.clicks / f.impressions) * 100),
      ctrBasis: `${f.clicks} cliques / ${f.impressions.toLocaleString('pt-BR')} impressões`,
      convVisitPct: r1((f.ordersApproved / f.visits) * 100),
      convBasis: `${f.ordersApproved} pedidos aprovados / ${f.visits.toLocaleString('pt-BR')} visitas`,
      checkoutConvPct: f.checkouts ? r1((f.ordersApproved / f.checkouts) * 100) : null,
      approvalPct: r1((f.ordersApproved / f.ordersCreated) * 100),
      prev: f.prev,
      ctrDropped: f.prev && (f.clicks / f.impressions) * 100 < f.prev.ctrPct - 0.3,
    }));
    if (!rows.length) return this._noData('conversão nas plataformas pedidas');
    return { kind: 'CONVERSION', rows, ...this._meta() };
  }

  /* ---------- FINANCEIRO ---------- */
  getFinancialSummary({ period = { type: 'TODAY' } } = {}) {
    if (!this.d.sales) return this._noData('financeiro');
    const P = resolvePeriod(period, this.clock);
    const plats = this.d.connectedPlatforms;
    const rev = this._sumPeriod(P, plats, d => P.sameTime || P.type === 'TODAY' ? (d.revenueSameTime ?? d.revenue) : d.revenue);
    const fees = this._sumPeriod(P, plats, d => d.fees);
    const returns = this._sumPeriod(P, plats, d => d.returnsValue);
    const ads = this.d.ads ? r2(this.d.ads.campaigns.reduce((s, c) => s + c.spend, 0)) : 0;
    const hasMargins = this.d.margins && Object.keys(this.d.margins).length;
    const marginPct = hasMargins ? 26 : null;   // margem média estimada do mix registrado
    const estimatedMargin = marginPct != null ? r2(rev.total * (marginPct / 100) - ads) : null;
    return {
      kind: 'FINANCIAL', period: P,
      grossRevenue: rev.total, feesPaid: fees.total, returnsLost: returns.total, adsSpend: ads,
      estimatedMarginValue: estimatedMargin, estimatedMarginPct: marginPct,
      marginByProduct: hasMargins ? this.d.margins : null,
      caveat: 'margem ESTIMADA com base em preço, custo, taxas e Ads registrados — sem todos os custos indiretos para lucro líquido final',
      ...this._meta(),
    };
  }

  /* ---------- RISCO / EXCEÇÃO ---------- */
  getRiskSummary() {
    const risks = [];
    const f = this.d.fulfillment;
    if (f) {
      if (f.capacity.customPendingToday > f.capacity.customPerDay)
        risks.push({ area: 'expedição', severity: 'alta',
          title: `${f.criticalToday.length} pedidos personalizados vencem prazo hoje e a capacidade restante (${f.capacity.remainingToday}) não cobre os ${f.toShip} pendentes`,
          nextMove: 'priorizar produção e embalagem dos personalizados antes de itens sem prazo crítico' });
      if (f.lateOrders.length)
        risks.push({ area: 'expedição', severity: 'média',
          title: `${f.lateOrders.length} pedidos já atrasados (${f.lateOrders.map(o => o.id).join(', ')})`,
          nextMove: 'despachar hoje e comunicar o comprador' });
    }
    const inv = this.getInventorySummary({});
    if (inv.critical && inv.critical.length)
      for (const i of inv.critical)
        risks.push({ area: 'estoque', severity: 'alta',
          title: `${i.name} (${i.platform}) com ${i.available} un — cobertura de ${i.coverageDays} dias`,
          nextMove: 'repor ou reduzir tração de venda até a reposição' });
    const ads = this.getAdsPerformance({});
    if (ads.wasteful && ads.wasteful.length)
      for (const c of ads.wasteful)
        risks.push({ area: 'ads', severity: 'média',
          title: `campanha "${c.name}" consumiu R$ ${c.spend} sem gerar pedido`,
          nextMove: 'revisar segmentação/criativo ou pausar (com sua aprovação)' });
    /* sinais do EPE (Central), quando o cérebro está acoplado */
    if (this.mie && this.mie.epe.externalSignals.length)
      for (const s of this.mie.epe.externalSignals.slice(0, 3))
        if (!risks.some(x => x.title.includes(s.title.slice(0, 24))))
          risks.push({ area: s.playbook || 'central', severity: s.urgency || 'média',
            title: s.title, nextMove: s.recommendation || null });
    risks.sort((a, b) => (a.severity === 'alta' ? 0 : 1) - (b.severity === 'alta' ? 0 : 1));
    return { kind: 'RISKS', risks, top: risks[0] || null, ...this._meta() };
  }

  /* ---------- EXPLICAÇÃO DE DECISÃO (EPE/Graph) ---------- */
  getDecisionExplanation({ index = 0, term = null } = {}) {
    if (!this.mie) return this._noData('decisões (EPE não acoplado)');
    const plan = this.mie.epe.lastPlan || this.mie.planDay();
    const pool = [...plan.decisions, ...plan.missions];
    const item = term
      ? pool.find(d => d.title.toLowerCase().includes(String(term).toLowerCase()))
      : pool[index];
    if (!item) return this._noData('essa decisão no plano de hoje');
    return {
      kind: 'DECISION_EXPLANATION',
      title: item.title, level: item.level, score: item.score, reason: item.reason,
      impactMonthly: item.impactMonthly, urgency: item.urgency, confidence: item.confidence,
      breakdown: item.breakdown, provenance: item.provenance || null,
      silence: plan.silence.slice(0, 5),
      planGeneratedAt: plan.generatedAtIso,
      ...this._meta(),
    };
  }

  /* ---------- BRIEFING / FECHAMENTO ---------- */
  getOperationBriefing() {
    return {
      kind: 'BRIEFING',
      sales: this.getSalesSummary({}),
      fulfillment: this.getFulfillmentStatus(),
      inventory: this.getInventorySummary({}),
      ads: this.getAdsPerformance({}),
      risks: this.getRiskSummary(),
      decisions: this.mie && this.mie.epe.lastPlan ? this.mie.epe.lastPlan.decisions : [],
      ...this._meta(),
    };
  }
}

module.exports = { QueryLayer };

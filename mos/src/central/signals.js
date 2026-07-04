/* SINAIS DE NEGÓCIO da Central (Sprint 09) — os "playbooks da Central":
   regras nomeadas que leem os dados JÁ NORMALIZADOS (nunca payload bruto)
   e produzem sinais executivos rastreáveis para o EPE.

   Cada sinal carrega: playbook (a regra que o gerou), origem completa
   (plataforma/conta/loja/entidade/evento), período, dados de prova,
   risco, impacto estimado e recomendação — o EPE decide o nível.

   Fluxo: Evento normalizado → Playbook (estas regras) → Knowledge Graph
   → EPE → Plano do Dia. */
'use strict';

const WEEKS_PER_MONTH = 4.33;

/* provas e proveniência sempre juntas: o sinal é auditável até a origem */
function provenance(row, eventId = null) {
  return {
    platform: row.platform, accountId: row.account_id ?? null, storeId: row.store_id ?? null,
    entityType: row.entityType || 'MARKETPLACE_LISTING', entityId: row.external_id ?? row.externalId ?? null,
    eventId, rawReference: row.raw_reference ?? null,
  };
}

/* estado consolidado por SKU × plataforma a partir do banco normalizado */
function skuView(repos, companyId) {
  const db = repos.morder.db;
  const listings = db.all(`
    SELECT l.*, mc.marketplace AS platform, mc.account_id, mc.store_id, mc.id AS connection_id
    FROM listing l JOIN marketplace_connection mc ON mc.id = l.connection_id
    JOIN product p ON p.id = l.product_id
    WHERE p.company_id = ?`, companyId);
  const latest = (table, extra = '') => db.all(`
    SELECT t.* FROM ${table} t
    WHERE t.company_id = ? AND t.id IN (
      SELECT MAX(id) FROM ${table} WHERE company_id = ? GROUP BY connection_id, external_listing_id
    ) ${extra}`, companyId, companyId);
  return {
    listings,
    inventory: latest('marketplace_inventory'),
    prices: latest('marketplace_price'),
    metrics: db.all('SELECT * FROM marketplace_metric_snapshot WHERE company_id = ?', companyId),
    orders: repos.morder.ofCompany(companyId),
  };
}

/* ---------- as regras (cada uma é um playbook nomeado) ---------- */

function generateSignals({ repos, companyId, clock, operation = {} }) {
  const v = skuView(repos, companyId);
  const signals = [];
  const bySku = new Map();   // sku → [{listing, inv, price, sold7d}]

  for (const l of v.listings) {
    const inv = v.inventory.find(i => i.connection_id === l.connection_id && i.external_listing_id === l.external_id);
    const price = v.prices.find(p => p.connection_id === l.connection_id && p.external_listing_id === l.external_id);
    const sold7 = v.metrics.find(m => m.platform === l.platform && m.external_listing_id === l.external_id
      && (m.metric === 'sold_7d' || m.metric === 'visits_7d'));
    const sku = inv ? inv.sku : null;
    const entry = { listing: l, inv, price, sold7d: sold7 && sold7.metric === 'sold_7d' ? sold7.value : null };
    if (sku) { if (!bySku.has(sku)) bySku.set(sku, []); bySku.get(sku).push(entry); }

    /* PLAYBOOK estoque-critico-campeao: vende forte e o estoque não cobre 3 dias */
    if (entry.sold7d != null && inv && inv.available != null && entry.sold7d > 0) {
      const dailySales = entry.sold7d / 7;
      const coverDays = inv.available / dailySales;
      if (coverDays < 3) {
        const monthlyRevenue = Math.round(dailySales * 30 * (l.price || 0));
        signals.push({
          playbook: 'estoque-critico-campeao',
          signalKey: `stockout|${l.platform}|${l.external_id}`,
          productId: l.external_id,
          title: `Estoque crítico do campeão "${l.title}" na ${l.platform} (${inv.available} un · ~${coverDays.toFixed(1)} dias)`,
          impactMonthly: monthlyRevenue,
          confidenceLabel: 'alta', urgency: 'alta', severity: 'attention',
          effort: 1, reversible: true, class: 'C', proposalType: 'replenish-stock',
          hasProposal: true, window: true,
          evidence: { sold7d: entry.sold7d, available: inv.available, coverDays: Math.round(coverDays * 10) / 10, period: '7d' },
          recommendation: 'repor estoque imediatamente ou reduzir tração de venda até a reposição',
          provenance: provenance({ ...l, external_id: l.external_id }),
        });
      }
    }
  }

  /* PLAYBOOK margem-melhor-em-outro-canal: mesmo SKU, margens muito diferentes */
  for (const [sku, entries] of bySku) {
    if (entries.length < 2) continue;
    const withMargin = entries.filter(e => e.price && e.price.margin_pct != null);
    if (withMargin.length < 2) continue;
    const best = withMargin.reduce((a, b) => (a.price.margin_pct >= b.price.margin_pct ? a : b));
    const worst = withMargin.reduce((a, b) => (a.price.margin_pct <= b.price.margin_pct ? a : b));
    const gap = best.price.margin_pct - worst.price.margin_pct;
    if (gap >= 8) {
      const sold = worst.sold7d || 0;
      const shiftRevenue = Math.round(sold * WEEKS_PER_MONTH * (best.listing.price || 0) * (gap / 100));
      signals.push({
        playbook: 'margem-melhor-em-outro-canal',
        signalKey: `margin-gap|${sku}`,
        productId: sku,
        title: `"${best.listing.title}": margem ${best.price.margin_pct}% no ${best.listing.platform} vs ${worst.price.margin_pct}% na ${worst.listing.platform}`,
        impactMonthly: Math.max(shiftRevenue, 200),
        confidenceLabel: 'alta', urgency: 'média', severity: 'attention',
        effort: 2, reversible: true, class: 'C', proposalType: 'rebalance-channel',
        hasProposal: true, window: false,
        evidence: { sku, marginBest: best.price.margin_pct, platformBest: best.listing.platform,
                    marginWorst: worst.price.margin_pct, platformWorst: worst.listing.platform, period: 'atual' },
        recommendation: `puxar demanda para ${best.listing.platform} (margem ${gap} p.p. maior) sem abandonar o canal de volume`,
        provenance: provenance({ ...best.listing, external_id: best.listing.external_id }),
      });
    }
  }

  /* PLAYBOOK campeao-ausente-no-canal: SKU forte em um canal e sem anúncio em outro conectado */
  const connectedPlatforms = [...new Set(v.listings.map(l => l.platform))];
  const allConnections = repos.morder.db.all(
    `SELECT marketplace FROM marketplace_connection WHERE company_id = ? AND status = 'connected'`, companyId)
    .map(r => r.marketplace);
  for (const [sku, entries] of bySku) {
    const champion = entries.find(e => (e.sold7d || 0) >= 20);
    if (!champion) continue;
    for (const platform of allConnections) {
      if (connectedPlatforms.includes(platform) && entries.some(e => e.listing.platform === platform)) continue;
      const estRevenue = Math.round((champion.sold7d / 7) * 30 * (champion.listing.price || 0) * 0.3);
      signals.push({
        playbook: 'campeao-ausente-no-canal',
        signalKey: `absent|${sku}|${platform}`,
        productId: sku,
        title: `Campeão "${champion.listing.title}" (${champion.sold7d} vendas/7d) não está anunciado no ${platform}`,
        impactMonthly: estRevenue,
        confidenceLabel: 'média', urgency: 'média', severity: 'info',
        effort: 2, reversible: true, class: 'C', proposalType: 'expand-channel',
        hasProposal: true, window: false,
        evidence: { sku, sold7d: champion.sold7d, championPlatform: champion.listing.platform, missingPlatform: platform },
        recommendation: `preparar anúncio do produto validado para o ${platform} (rascunho para aprovação)`,
        provenance: provenance({ ...champion.listing, external_id: champion.listing.external_id }),
      });
    }
  }

  /* PLAYBOOK potencial-tiktok: vídeo do tema crescendo, conversão não acompanha */
  const views = v.metrics.find(m => m.platform === 'tiktok' && m.metric === 'video_views_7d');
  const growth = v.metrics.find(m => m.platform === 'tiktok' && m.metric === 'video_view_growth_7d');
  if (views && growth && growth.value >= 2) {
    signals.push({
      playbook: 'potencial-tiktok',
      signalKey: `tiktok-potential|${views.period || '7d'}`,
      productId: null,
      title: `Vídeo do nicho crescendo ${growth.value}x no TikTok Shop (${views.value.toLocaleString('pt-BR')} views/7d) — demanda não capturada`,
      impactMonthly: 900,
      confidenceLabel: 'média', urgency: 'média', severity: 'info',
      effort: 1, reversible: true, hasProposal: false, window: true,
      evidence: { views7d: views.value, growth: growth.value, period: '7d' },
      recommendation: 'investigar o conteúdo que está tracionando e avaliar entrada do KIT3-ABS no canal',
      provenance: provenance({ platform: 'tiktok', account_id: views.connection_id, external_id: views.external_listing_id }),
    });
  }

  /* PLAYBOOK capacidade-personalizados: pedidos custom acima da capacidade/dia */
  const customPending = v.orders.filter(o => o.is_custom && /ready|await|paid/i.test(o.status || ''));
  const capacity = operation.customCapacityPerDay ?? Infinity;
  if (customPending.length > capacity) {
    const revenue = Math.round(customPending.reduce((s, o) => s + (o.total || 0), 0));
    signals.push({
      playbook: 'capacidade-personalizados',
      signalKey: `custom-capacity|${customPending.length}`,
      productId: operation.sku ?? null,
      title: `${customPending.length} personalizados na fila para capacidade de ${capacity}/dia — risco de atraso em cascata`,
      impactMonthly: revenue * 2,
      confidenceLabel: 'alta', urgency: 'alta', severity: 'attention',
      effort: 1, reversible: true, class: 'C', proposalType: 'protect-deadline',
      hasProposal: true, window: true,
      evidence: { pendingCustom: customPending.length, capacityPerDay: capacity,
                  orders: customPending.map(o => o.external_id) },
      recommendation: 'priorizar fila por prazo de coleta e pausar promoção de personalizados até normalizar',
      provenance: provenance(customPending[0] ? { ...customPending[0], entityType: 'MARKETPLACE_ORDER' } : { platform: 'shopee' }),
    });
  }

  /* PLAYBOOK pedido-perto-de-atrasar: prazo de expedição a menos de 36h */
  for (const o of v.orders) {
    if (!o.deadline_at || !/ready|await|paid/i.test(o.status || '')) continue;
    const hoursLeft = (new Date(o.deadline_at).getTime() - clock.nowMs()) / 3600000;
    if (hoursLeft > 0 && hoursLeft <= 36) {
      signals.push({
        playbook: 'pedido-perto-de-atrasar',
        signalKey: `deadline|${o.platform}|${o.external_id}`,
        productId: o.external_id,
        title: `Pedido ${o.external_id} (${o.platform}) com coleta em ~${Math.round(hoursLeft)}h`,
        impactMonthly: Math.round((o.total || 0) * 3),
        confidenceLabel: 'alta', urgency: 'alta', severity: 'attention',
        effort: 1, reversible: true, class: 'A', proposalType: 'expedite-order',
        hasProposal: true, window: true, autoAuthorized: true,
        evidence: { deadlineAt: o.deadline_at, hoursLeft: Math.round(hoursLeft), isCustom: !!o.is_custom },
        recommendation: 'antecipar produção/expedição deste pedido na fila de hoje',
        provenance: provenance({ ...o, entityType: 'MARKETPLACE_ORDER' }),
      });
    }
  }

  return signals;
}

module.exports = { generateSignals };

/* CRESCIMENTO · DEMO FIXTURE + ADAPTER (Sprint 10.B) — UMD.

   Dados DEMONSTRATIVOS coerentes para o protótipo v6 e para o preview do
   chat. dataSource: DEMO_GROWTH_FIXTURE — o composer sempre imprime o
   rótulo. Nenhum afiliado ou promoção aqui é real; nenhuma integração está
   conectado; nada parece real: nomes e números são claramente de
   demonstração. No Node, o mesmo contrato pode ser servido pelos
   serviços reais (repos) — o chat não muda. */
(function (NS) {
'use strict';

function createDemoGrowthDataset(clock) {
  const d = clock.today ? clock.today() : clock.nowIso().slice(0, 10);
  return {
    source: 'DEMO_GROWTH_FIXTURE',
    followUpsDueToday: [
      { leadId: 'led-demo-4', leadName: 'Cliente Exemplo D', note: 'enviar proposta do personalizado', dueAt: `${d}T15:00:00Z` },
      { leadId: 'led-demo-3', leadName: 'Cliente Exemplo C', note: 'segunda tentativa de contato', dueAt: `${d}T17:00:00Z` },
    ],
    affiliates: [
      { rank: 1, name: 'Parceiro Demo 1', channel: 'instagram', status: 'ATIVO',
        clicks: 320, orders: 12, revenue: 2140, cancelled: 1, returned: 0,
        avgTicket: 178.33, conversionRate: 3.8,
        commission: { estimada: 214, aprovada: 0, pendente: 0 },
        byMarketplace: { shopee: 1360, mercado_livre: 780 },
        attribution: { sources: ['IMPORTACAO_MANUAL'], confidence: ['ESTIMADA'],
                       note: 'dados importados manualmente' } },
      { rank: 2, name: 'Parceiro Demo 2', channel: 'youtube', status: 'PENDENTE_DE_DADOS',
        clicks: 95, orders: 3, revenue: 510, cancelled: 0, returned: 1,
        avgTicket: 170, conversionRate: 3.2,
        commission: { estimada: 51, aprovada: 0, pendente: 0 },
        byMarketplace: { shopee: 510 },
        attribution: { sources: ['IMPORTACAO_MANUAL'], confidence: ['ESTIMADA'],
                       note: 'dados importados manualmente' } },
    ],
    promotions: [
      { id: 'pmo-demo-1', name: 'Promoção Demo Shopee — Kit Sala', marketplace: 'shopee',
        status: 'RASCUNHO', discountPct: 15, targetSku: 'KIT3-ABS',
        marginPct: 18.4, minPrice: 214.9, stockRisk: 'MEDIO — limite compromete boa parte do estoque',
        capUnits: 30, stock: 50 },
      { id: 'pmo-demo-2', name: 'Promoção Demo ML — Serra', marketplace: 'mercado_livre',
        status: 'EM_REVISAO', discountPct: 25, targetSku: 'QDR-SER',
        marginPct: 9.2, minPrice: 168.3, reason: 'margem 9,2% abaixo da mínima do produto (18%)',
        stockRisk: 'BAIXO', capUnits: 10, stock: 25 },
    ],
    highTurnoverNoPromo: [
      { sku: 'QDR-SER', name: 'Quadro Paisagem Serra 60x90 Moldura', orders: 21, marginPct: 32.5 },
      { sku: 'ESP-ORG', name: 'Espelho Decorativo Orgânico 70cm', orders: 14, marginPct: 27.8 },
    ],
    catalogGap: {
      'shopee>mercado_livre': [
        { sku: 'ESP-ORG', name: 'Espelho Decorativo Orgânico 70cm', marginPct: 26.1 },
        { sku: 'QDR-NOME', name: 'Quadro Personalizado Nome Família', marginPct: 41.3 },
      ],
      'mercado_livre>shopee': [
        { sku: 'QDR-SER', name: 'Quadro Paisagem Serra 60x90 Moldura', marginPct: 24.7 },
      ],
    },
    adaptationCandidates: [
      { sku: 'QDR-SER', name: 'Quadro Paisagem Serra 60x90 Moldura', marginPct: 27.9 },
      { sku: 'QDR-NOME', name: 'Quadro Personalizado Nome Família', marginPct: 38.2 },
      { sku: 'KIT3-ABS', name: 'Kit 3 Quadros Sala Abstrato 60x90', marginPct: 21.4 },
    ],
  };
}

/* adapter DEMO: mesmo contrato que o adapter real (repos) usaria */
function createGrowthAdapter(dataset, clock) {
  const src = dataset.source;
  const base = extra => ({ dataSource: src, coverage: ['crescimento-demo'],
    missingPlatforms: [], confidence: 0.9,
    asOf: clock ? clock.nowIso() : null, ...extra });

  return {
    affiliates(query) {
      return base({ kind: 'AFFILIATE_PANEL', view: query.affiliateView || 'PERFORMANCE',
        partners: dataset.affiliates });
    },
    promotionRisk() {
      return base({ kind: 'PROMOTION_RISK',
        items: dataset.promotions.filter(p => p.reason || p.marginPct < 15)
          .map(p => ({ name: p.name, marketplace: p.marketplace,
                       marginPct: p.marginPct, reason: p.reason || null })) });
    },
    promotionOpportunity() {
      return base({ kind: 'PROMOTION_OPPORTUNITY', items: dataset.highTurnoverNoPromo });
    },
    catalogGap(query) {
      const gap = query.gap;
      const items = gap ? (dataset.catalogGap[`${gap.source}>${gap.target}`] || []) : [];
      return base({ kind: 'CATALOG_GAP', gap, items });
    },
    planAction(query) {
      const a = query.growthAction || {};
      let items = dataset.adaptationCandidates;
      if (a.marginAbovePct != null) items = items.filter(i => i.marginPct > a.marginAbovePct);
      const target = a.targetPlatform || 'shopee';
      const what = a.kind === 'promotion' ? 'uma promoção interna em RASCUNHO'
        : a.kind === 'campaign' ? 'uma campanha interna em RASCUNHO'
        : `${items.length} rascunho(s) interno(s) de anúncio`;
      return base({ kind: 'GROWTH_ACTION_PLAN',
        summaryText: `Plano (demonstração): criar ${what} em ${target}` +
          (a.marginAbovePct != null ? ` para produtos com margem acima de ${String(a.marginAbovePct).replace('.', ',')}%` : '') + '.',
        items: a.kind === 'drafts' || !a.kind ? items : [],
        requiresConfirmation: (a.kind === 'drafts' || !a.kind) && items.length > 1,
        action: { ...a, targetPlatform: target } });
    },
  };
}

NS.createDemoGrowthDataset = createDemoGrowthDataset;
NS.createGrowthAdapter = createGrowthAdapter;
})(typeof module !== 'undefined' && module.exports
  ? module.exports
  : (globalThis.HEADGROWTH = globalThis.HEADGROWTH || {}));

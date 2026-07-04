/* Mundo simulado — a realidade que o MIE observa nesta fase.
   REGRA ABSOLUTA (Sprint 04): nenhum dado real, nenhuma API.
   O gerador é determinístico (semente fixa) para que toda execução seja
   reproduzível — requisito de auditoria do núcleo cognitivo.

   Este módulo é o ÚNICO que será substituído quando o Collector e as APIs
   oficiais chegarem (Camada de Execução). Os motores não sabem que os
   dados são simulados: leem o mundo pela mesma interface que lerão a real. */
(function (NS) {
'use strict';

/* PRNG determinístico (mulberry32) */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG = [
  { id: 'p1', name: 'Quadro Paisagem 60x90', mkt: 'Mercado Livre',
    price: 189, margin: 0.32, impressions: 5200, ctr: 0.038, conv: 0.031, ranking: 4, rating: 4.8 },
  { id: 'p2', name: 'Kit 3 Quadros Sala Abstrato', mkt: 'Shopee',
    price: 249, margin: 0.35, impressions: 3400, ctr: 0.031, conv: 0.024, ranking: 11, rating: 4.7 },
  { id: 'p3', name: 'Quadro Personalizado Nome Família', mkt: 'Mercado Livre',
    price: 159, margin: 0.41, impressions: 6100, ctr: 0.044, conv: 0.038, ranking: 1, rating: 4.9 },
  { id: 'p4', name: 'Espelho Decorativo Orgânico', mkt: 'Shopee',
    price: 219, margin: 0.30, impressions: 2900, ctr: 0.035, conv: 0.027, ranking: 4, rating: 4.8 },
  { id: 'p5', name: 'Quadro Abstrato Dourado 50x70', mkt: 'Mercado Livre',
    price: 139, margin: 0.28, impressions: 2400, ctr: 0.033, conv: 0.029, ranking: 3, rating: 4.6 },
];

const COMPETITORS = {
  p1: [ { id: 'c-arteparede', name: 'ArteParede', price: 195, rating: 4.4, creative: 'fundo branco', weakness: 'embalagem' },
        { id: 'c-decormax', name: 'DecorMax', price: 205, rating: 4.3, creative: 'fundo branco', weakness: 'prazo de entrega' } ],
  p2: [ { id: 'c-casabela', name: 'CasaBela Decor', price: 239, rating: 4.6, creative: 'foto ambientada', weakness: 'variações limitadas' } ],
  p3: [ { id: 'c-nomearte', name: 'NomeArte', price: 149, rating: 4.5, creative: 'fundo branco', weakness: 'demora na personalização' } ],
  p4: [ { id: 'c-espelhar', name: 'Espelhar Design', price: 229, rating: 4.7, creative: 'foto ambientada', weakness: 'frete caro' } ],
  p5: [ { id: 'c-goldframe', name: 'GoldFrame', price: 129, rating: 4.2, creative: 'fundo branco', weakness: 'qualidade da moldura' } ],
};

/* Desvios-padrão do ruído diário (a "respiração" normal do mercado) */
const NOISE = { impressions: 0.05, ctr: 0.03, conv: 0.04 };

function createWorld(options = {}) {
  const seed = options.seed ?? 42;
  const rand = rng(seed);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) / 2; // ~N(0, 0.29)

  const world = {
    day: 0,
    products: CATALOG.map(p => ({
      ...p,
      base: { impressions: p.impressions, ctr: p.ctr, conv: p.conv, ranking: p.ranking, rating: p.rating },
      series: [],
      competitors: (COMPETITORS[p.id] || []).map(c => ({ ...c, history: [] })),
      reviews: [], questions: [], ownChanges: [],
      status: 'active',
    })),
    categoryDemand: [],
    modifiers: [],      // efeitos de cenários ativos
    platformEvents: [], // eventos da plataforma (anúncio derrubado etc.)

    /* ---- leitura (a interface que o Collector real vai implementar) ---- */
    product(id) { return this.products.find(p => p.id === id); },
    latest(id) { const p = this.product(id); return p.series[p.series.length - 1]; },
    seriesOf(id, n) { const p = this.product(id); return p.series.slice(-n); },
    revenueMonthly(id) {
      const p = this.product(id);
      const last = this.latest(id);
      if (!last) return 0;
      return Math.round(last.orders * 30 * p.price);
    },

    /* ---- tempo ---- */
    advanceDay() {
      this.day += 1;
      NS._currentDay = this.day;
      const demand = 1 + 0.04 * gauss();
      this.categoryDemand.push({ day: this.day, index: demand });
      for (const p of this.products) {
        const m = effective(this.modifiers, p.id, this.day);
        const impressions = p.status === 'down' ? 0 :
          Math.round(p.base.impressions * demand * m.impressions * (1 + NOISE.impressions * gauss()));
        const ctr = p.base.ctr * m.ctr * (1 + NOISE.ctr * gauss());
        const conv = p.base.conv * m.conv * (1 + NOISE.conv * gauss());
        const clicks = Math.round(impressions * ctr);
        const orders = Math.round(clicks * conv * 10) / 10;
        const ranking = Math.max(1, Math.round(p.base.ranking + m.rankingShift));
        p.series.push({ day: this.day, impressions, ctr, conv, clicks, orders,
                        price: p.price, ranking, rating: p.base.rating });
        for (const c of p.competitors) c.history.push({ day: this.day, price: c.price, creative: c.creative });
      }
    },

    /* ---- cenários (os "acontecimentos" que os testes injetam) ---- */
    applyScenario(name, opts = {}) {
      const pid = opts.productId || 'p1';
      const day = this.day + 1; // passa a valer no próximo ciclo
      const p = this.product(pid);
      const S = {
        /* Guerra de preço: 2 concorrentes cortam preço → CTR/conversão/ranking sofrem */
        'price-war': () => {
          p.competitors[0].price = Math.round(p.competitors[0].price * 0.88);
          p.competitors[0].history.push({ day, price: p.competitors[0].price, event: 'corte de preço −12%' });
          if (p.competitors[1]) {
            p.competitors[1].price = Math.round(p.competitors[1].price * 0.82);
            p.competitors[1].history.push({ day, price: p.competitors[1].price, event: 'corte de preço −18%' });
          }
          this.modifiers.push({ productId: pid, from: day, ctr: 0.90, conv: 0.82, rankingShift: 2, label: 'guerra de preço' });
        },
        /* Ruído: CTR oscila levemente, conversão estável — NÃO deve virar decisão */
        'ctr-noise': () => {
          this.modifiers.push({ productId: pid, from: day, until: day + 2, ctr: 0.94, label: 'ruído de CTR' });
        },
        /* Novo concorrente agressivo entra na categoria */
        'new-competitor': () => {
          p.competitors.push({ id: 'c-novo', name: 'DecoraJá', price: Math.round(p.price * 0.85),
            rating: 4.1, creative: 'vídeo', weakness: 'reputação recém-criada', entryDay: day, history: [] });
          this.modifiers.push({ productId: pid, from: day, rankingShift: 1, label: 'novo concorrente' });
        },
        /* Incidente: anúncio derrubado pela plataforma */
        'listing-down': () => {
          p.status = 'down';
          this.platformEvents.push({ day, productId: pid, kind: 'listing_down', reason: 'política de imagens' });
        },
        /* Produto campeão: desempenho sustentado acima do normal */
        'success-streak': () => {
          this.modifiers.push({ productId: pid, from: day, conv: 1.28, ctr: 1.10, label: 'sequência campeã' });
        },
        /* Onda de avaliações negativas com padrão */
        'review-wave': () => {
          for (let i = 0; i < 3; i++)
            p.reviews.push({ day, stars: 1, text: 'chegou trincado', carrier: 'TransRápido' });
        },
      };
      if (!S[name]) throw new Error('cenário desconhecido: ' + name);
      S[name]();
      return { scenario: name, productId: pid, day };
    },

    /* Efeito de uma proposta executada (o mundo reage à ação do Head) */
    applyProposalEffect(pid, proposal) {
      const day = this.day + 1;
      if (proposal.type === 'reposition') {
        // reposicionar pelo diferencial recupera boa parte da conversão perdida
        this.modifiers.push({ productId: pid, from: day, conv: 1.15, ctr: 1.06, label: 'reposicionamento aplicado' });
      } else if (proposal.type === 'creative') {
        this.modifiers.push({ productId: pid, from: day, ctr: 1.12, label: 'criativo novo aplicado' });
      } else if (proposal.type === 'restore') {
        const p = this.product(pid);
        p.status = 'active';
      }
      this.product(pid).ownChanges.push({ day, change: proposal.type, source: 'head' });
    },
  };

  function effective(mods, pid, day) {
    const acc = { impressions: 1, ctr: 1, conv: 1, rankingShift: 0 };
    for (const m of mods) {
      if (m.productId !== pid || day < m.from || (m.until && day > m.until)) continue;
      acc.impressions *= m.impressions ?? 1;
      acc.ctr *= m.ctr ?? 1;
      acc.conv *= m.conv ?? 1;
      acc.rankingShift += m.rankingShift ?? 0;
    }
    return acc;
  }

  return world;
}

NS.Sim = { createWorld, NOISE };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

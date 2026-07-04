/* PLAYBOOKS — MIF Parte 2 transformada em código executável.
   Um playbook é um roteiro de investigação: passos ordenados que coletam
   evidência + hipóteses candidatas com testes de eliminação.
   O Investigation Engine executa o playbook; o playbook não decide nada
   sozinho — ele estrutura a coleta e o confronto de evidências.

   REGRA (MIF 2.1): "o timing é a impressão digital" — toda hipótese
   precisa explicar QUANDO o problema começou, não só QUE ele existe. */
(function (NS) {
'use strict';

/* ---------- helpers de evidência ---------- */
function dropStart(world, memory, pid, metric) {
  // primeiro dia recente em que a métrica saiu do normal (z < -2)
  const series = world.seriesOf(pid, 10);
  for (const row of series) {
    if (memory.zScore(pid, metric, row[metric]) < -2) return row.day;
  }
  return null;
}
function competitorCuts(world, pid, sinceDay) {
  const p = world.product(pid);
  const cuts = [];
  for (const c of p.competitors)
    for (const h of c.history)
      if (h.event && h.event.includes('preço') && (!sinceDay || Math.abs(h.day - sinceDay) <= 2))
        cuts.push({ competitor: c.name, day: h.day, event: h.event });
  return cuts;
}

const PLAYBOOKS = {

  /* ============ "AS VENDAS CAÍRAM" — MIF 2.2 ============ */
  sales_drop: {
    id: 'sales_drop',
    title: 'Queda de vendas/conversão',
    steps: [
      { name: 'dimensionar', run(ctx) {
          const { world, memory, productId: pid } = ctx;
          const d = ctx.driftOf('conv');
          return { magnitude: d.pct, since: dropStart(world, memory, pid, 'conv'),
                   concentrated: true, note: `queda de ${(d.pct * 100).toFixed(0)}% na conversão` };
      } },
      { name: 'localizar_fator', run(ctx) {
          const imp = ctx.driftOf('impressions'), ctr = ctx.driftOf('ctr'), conv = ctx.driftOf('conv');
          const factor = Math.abs(imp.pct) > 0.3 ? 'visibilidade' : (conv.pct < -0.08 ? 'conversao' : 'ctr');
          return { factor, impressions: imp.pct, ctr: ctr.pct, conv: conv.pct };
      } },
      { name: 'dentro', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const recent = p.ownChanges.filter(c => ctx.world.day - c.day <= 7);
          return { ownChanges: recent, note: recent.length ? 'houve mudança interna recente' : 'nada mudou do nosso lado' };
      } },
      { name: 'fora', run(ctx) {
          const cuts = competitorCuts(ctx.world, ctx.productId, ctx.findings.dimensionar.since);
          return { competitorCuts: cuts };
      } },
      { name: 'demanda', run(ctx) {
          const recent = ctx.world.categoryDemand.slice(-7);
          const avg = recent.reduce((s, d) => s + d.index, 0) / (recent.length || 1);
          return { demandIndex: avg, marketWide: avg < 0.93 };
      } },
      { name: 'reputacao', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const recentBad = p.reviews.filter(r => r.stars <= 2 && ctx.world.day - r.day <= 7);
          return { recentNegative: recentBad.length, pattern: patternOf(recentBad) };
      } },
    ],
    hypotheses: [
      { cause: 'competitor_price_cut',
        label: 'concorrentes reduziram preço de forma agressiva',
        proposalType: 'reposition',
        test(f) {
          const cuts = f.fora.competitorCuts;
          if (!cuts.length) return { eliminated: true, why: 'nenhum corte de preço concorrente' };
          const since = f.dimensionar.since;
          const timing = since && cuts.some(c => Math.abs(c.day - since) <= 2);
          return { eliminated: !timing, why: timing ? 'timing bate com o início da queda' : 'timing não bate',
                   support: timing ? 2 : 0 };
      } },
      { cause: 'own_change',
        label: 'uma mudança interna causou a queda',
        proposalType: 'restore',
        test(f) {
          const changes = f.dentro.ownChanges;
          if (!changes.length) return { eliminated: true, why: 'nada mudou internamente' };
          /* MIF Parte 6: mudança do próprio Head dentro da janela de medição
             NÃO vira hipótese de reversão — o experimento já tem gatilho
             de reversão armado; parada antecipada só por dano claro. */
          const external = changes.filter(c => c.source !== 'head');
          if (!external.length)
            return { eliminated: true, why: 'única mudança recente é experimento do próprio Head em janela de medição — gatilho de reversão já armado (MIF Parte 6)' };
          return { eliminated: false, why: 'houve mudança interna no período', support: 2 };
      } },
      { cause: 'market_demand_drop',
        label: 'a demanda da categoria inteira caiu',
        proposalType: 'wait',
        test(f) {
          const wide = f.demanda.marketWide;
          return { eliminated: !wide, why: wide ? 'demanda da categoria abaixo do normal' : 'demanda da categoria estável',
                   support: wide ? 2 : 0 };
      } },
      { cause: 'reputation_hit',
        label: 'avaliações negativas recentes derrubaram a confiança',
        proposalType: 'reputation',
        test(f) {
          const hit = f.reputacao.recentNegative >= 2;
          return { eliminated: !hit, why: hit ? 'onda de avaliações negativas no período' : 'reputação estável',
                   support: hit ? 2 : 0 };
      } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const map = {
        competitor_price_cut: {
          type: 'reposition',
          title: `Reposicionar o anúncio de ${p.name} pelo diferencial`,
          text: 'Não cobrir o corte de preço (MIF 3.1): criar nova versão focada no nosso ponto forte, que os concorrentes não copiam em uma semana.',
          impactPct: [0.08, 0.12], effort: 1, reversible: true, class: 'C',
        },
        own_change: {
          type: 'restore',
          title: `Reverter a mudança interna recente em ${p.name}`,
          text: 'Voltar à versão anterior (reversível em 1 clique) e medir.',
          impactPct: [0.1, 0.15], effort: 1, reversible: true, class: 'B',
        },
        market_demand_drop: {
          type: 'wait',
          title: 'Não agir sobre o anúncio: a queda é do mercado',
          text: 'Manter vigília reforçada e não gastar alavanca à toa; reavaliar quando a demanda voltar.',
          impactPct: [0, 0], effort: 0, reversible: true, class: 'A',
        },
        reputation_hit: {
          type: 'reputation',
          title: `Responder a onda de avaliações e tratar a causa raiz em ${p.name}`,
          text: 'Responder publicamente cada avaliação (para o próximo comprador) e investigar o padrão (lote/transportadora).',
          impactPct: [0.04, 0.08], effort: 2, reversible: true, class: 'A',
        },
      };
      return map[cause] || null;
    },
  },

  /* ============ "O CTR CAIU" — MIF 2.2 ============ */
  ctr_drop: {
    id: 'ctr_drop',
    title: 'Queda de CTR',
    steps: [
      { name: 'dimensionar', run(ctx) {
          const d = ctx.driftOf('ctr');
          return { magnitude: d.pct, since: dropStart(ctx.world, ctx.memory, ctx.productId, 'ctr'),
                   note: `CTR ${(d.pct * 100).toFixed(0)}% vs. normal` };
      } },
      { name: 'conversao_estavel', run(ctx) {
          const d = ctx.driftOf('conv');
          return { convDrift: d.pct, stable: d.pct > -0.06 };
      } },
      { name: 'posicao', run(ctx) {
          const last = ctx.world.latest(ctx.productId);
          const b = ctx.memory.normalOf(ctx.productId, 'ranking');
          return { ranking: last.ranking, shifted: b ? last.ranking - b.mean >= 1.5 : false };
      } },
      { name: 'lista', run(ctx) {
          const cuts = competitorCuts(ctx.world, ctx.productId, null);
          return { competitorCuts: cuts, note: cuts.length ? 'vizinhos de página mudaram a oferta' : 'lista sem mudança relevante' };
      } },
    ],
    hypotheses: [
      { cause: 'list_changed',
        label: 'o cartão de busca perdeu em termos relativos (vizinho melhorou)',
        proposalType: 'creative',
        test(f) {
          const changed = f.lista.competitorCuts.length > 0;
          return { eliminated: !changed, why: changed ? 'concorrente mudou preço/criativo na lista' : 'sem mudança na lista',
                   support: changed ? 2 : 0 };
      } },
      { cause: 'noise',
        label: 'flutuação dentro do padrão (ruído)',
        proposalType: null,
        test(f) {
          const small = Math.abs(f.dimensionar.magnitude) < 0.1 && f.conversao_estavel.stable;
          return { eliminated: !small, why: small ? 'variação pequena, conversão estável' : 'variação relevante',
                   support: small ? 1 : 0 };
      } },
    ],
    proposalFor(cause, ctx) {
      if (cause !== 'list_changed') return null;
      const p = ctx.world.product(ctx.productId);
      return { type: 'creative', title: `Testar nova imagem principal em ${p.name}`,
        text: 'Comparar o cartão de busca com o snapshot anterior e testar criativo que vença a lista em miniatura (MIF 5.2).',
        impactPct: [0.05, 0.09], effort: 2, reversible: true, class: 'C' };
    },
  },

  /* ============ "NOVO CONCORRENTE ENTROU" — MIF 3.5 ============ */
  new_competitor: {
    id: 'new_competitor',
    title: 'Entrante na categoria',
    steps: [
      { name: 'identificar', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const e = p.competitors.find(c => c.entryDay && ctx.world.day - c.entryDay <= 21);
          return { entrant: e ? { name: e.name, price: e.price, rating: e.rating, entryDay: e.entryDay } : null };
      } },
      { name: 'mapear_ponto_fraco', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const e = p.competitors.find(c => c.entryDay);
          return { weakness: e ? e.weakness : null };
      } },
      { name: 'medir_ameaca', run(ctx) {
          const d = ctx.driftOf('conv');
          const last = ctx.world.latest(ctx.productId);
          return { convImpact: d.pct, ranking: last.ranking, immediate: d.pct < -0.1 };
      } },
    ],
    hypotheses: [
      { cause: 'entrant_pressure',
        label: 'entrante agressivo pressionando a categoria',
        proposalType: 'watch',
        test(f) {
          const present = !!f.identificar.entrant;
          return { eliminated: !present, why: present ? 'entrante confirmado' : 'nenhum entrante', support: present ? 2 : 0 };
      } },
    ],
    proposalFor(cause, ctx) {
      const f = ctx.findings;
      if (f.medir_ameaca.immediate) {
        const p = ctx.world.product(ctx.productId);
        return { type: 'reposition', title: `Defender share of search de ${p.name}`,
          text: `Responder nas palavras-chave que são nossas; explorar o ponto fraco do entrante (${f.mapear_ponto_fraco.weakness}).`,
          impactPct: [0.05, 0.1], effort: 2, reversible: true, class: 'C' };
      }
      return { type: 'watch', title: 'Vigília reforçada sobre o entrante (2-3 semanas)',
        text: 'MIF 3.5: muitos entrantes morrem quando o subsídio de entrada acaba; monitorar sem pânico, mapear ponto fraco desde o dia 1.',
        impactPct: [0, 0], effort: 0, reversible: true, class: 'A' };
    },
  },

  /* ============ INCIDENTE: ANÚNCIO DERRUBADO — MOS Fluxo 008 ============ */
  listing_down: {
    id: 'listing_down',
    title: 'Anúncio derrubado',
    steps: [
      { name: 'confirmar', run(ctx) {
          const ev = ctx.world.platformEvents.find(e => e.productId === ctx.productId && e.kind === 'listing_down');
          return { confirmed: !!ev, reason: ev ? ev.reason : null };
      } },
      { name: 'dimensionar_perda', run(ctx) {
          const revenue = ctx.world.revenueMonthly(ctx.productId) || estimateFromBase(ctx);
          return { dailyLoss: Math.round(revenue / 30), note: 'perda dupla: venda de hoje + ranking de amanhã (MIF 3.3/3.4)' };
      } },
    ],
    hypotheses: [
      { cause: 'platform_takedown',
        label: 'anúncio suspenso pela plataforma',
        proposalType: 'restore',
        test(f) { return { eliminated: !f.confirmar.confirmed, why: f.confirmar.confirmed ? 'evento da plataforma confirmado' : 'sem evento', support: 2 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      return { type: 'restore', title: `Recuperar o anúncio de ${p.name}`,
        text: 'Recurso imediato + anúncio reserva preparado em paralelo (Fluxo 008: nunca alarme sem ação em curso).',
        impactPct: [1, 1], effort: 1, reversible: true, class: 'A',
        firstResponse: ['abrir recurso na plataforma', 'preparar anúncio reserva', 'auditar imagens vs. política'] };
    },
  },

  /* ============ PRODUTO CAMPEÃO — MOS Fluxo 005 ============ */
  success_streak: {
    id: 'success_streak',
    title: 'Desempenho campeão sustentado',
    steps: [
      { name: 'confirmar_sustentacao', run(ctx) {
          const d = ctx.driftOf('conv', 5);
          return { lift: d.pct, sustained: d.pct > 0.15 };
      } },
      { name: 'isolar_causa', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const recentChange = p.ownChanges.filter(c => ctx.world.day - c.day <= 14);
          return { ownChanges: recentChange, likely: recentChange.length ? recentChange[0].change : 'demanda/posicionamento' };
      } },
    ],
    hypotheses: [
      { cause: 'champion_detected',
        label: 'produto com desempenho campeão sustentado',
        proposalType: 'replicate',
        test(f) { return { eliminated: !f.confirmar_sustentacao.sustained, why: f.confirmar_sustentacao.sustained ? 'lift sustentado por janela mínima' : 'lift não sustentado', support: 2 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      return { type: 'replicate', title: `Multiplicar a vitória de ${p.name}`,
        text: 'Investigar a causa da vitória, replicar nos produtos irmãos, testar elasticidade para cima e reforçar defesa (Fluxo 005).',
        impactPct: [0.05, 0.15], effort: 2, reversible: true, class: 'C' };
    },
  },
};

function patternOf(reviews) {
  if (reviews.length < 2) return null;
  const texts = reviews.map(r => r.text);
  return texts.every(t => t === texts[0]) ? texts[0] : null;
}
function estimateFromBase(ctx) {
  const p = ctx.world.product(ctx.productId);
  return Math.round(p.base.impressions * p.base.ctr * p.base.conv * 30 * p.price);
}

/* anomalia → playbook */
const ROUTE = {
  sales_drop: 'sales_drop', conv_drop: 'sales_drop',
  ctr_drop: 'ctr_drop',
  new_competitor: 'new_competitor',
  listing_down: 'listing_down',
  success_streak: 'success_streak',
  review_wave: 'sales_drop',
};

NS.Playbooks = { all: PLAYBOOKS, forAnomaly: kind => PLAYBOOKS[ROUTE[kind]] || null };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

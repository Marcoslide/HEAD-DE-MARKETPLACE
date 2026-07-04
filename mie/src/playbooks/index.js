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
  /* início da queda SUSTENTADA: o primeiro dia da sequência contínua de
     z < -2 que termina hoje. Um mergulho isolado de ruído dias antes não
     é o início do problema (MIF 2.1: o timing é a impressão digital). */
  const series = world.seriesOf(pid, 10);
  let start = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (memory.zScore(pid, metric, series[i][metric]) < -2) start = series[i].day;
    else break;
  }
  return start;
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

  /* ============ QUEDA SILENCIOSA DE CONVERSÃO — MIF 2.3 (o detetive paciente) ============ */
  silent_decay: {
    id: 'silent_decay',
    title: 'Decadência silenciosa de conversão',
    steps: [
      { name: 'confirmar_tendencia', run(ctx) {
          const rows = ctx.world.seriesOf(ctx.productId, 10);
          const half = Math.floor(rows.length / 2);
          const first = rows.slice(0, half).reduce((s, r) => s + r.conv, 0) / half;
          const second = rows.slice(half).reduce((s, r) => s + r.conv, 0) / (rows.length - half);
          return { slope: (second - first) / first, gradual: second < first,
                   note: 'queda gradual e consistente, sem degrau — descarta evento pontual' };
      } },
      { name: 'criativo_da_categoria', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const advanced = p.competitors.filter(c => c.creative !== 'fundo branco');
          return { leadersEvolved: advanced.length >= 1,
                   theirCreatives: [...new Set(p.competitors.map(c => c.creative))] };
      } },
      { name: 'erosao_de_preco', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const cheaper = p.competitors.filter(c => c.price < p.price * 0.95);
          return { cheaperCount: cheaper.length };
      } },
      { name: 'demanda', run(ctx) {
          const recent = ctx.world.categoryDemand.slice(-14);
          const first = recent.slice(0, 7).reduce((s, d) => s + d.index, 0) / 7;
          const second = recent.slice(7).reduce((s, d) => s + d.index, 0) / 7;
          return { demandSlope: (second - first) / first };
      } },
    ],
    hypotheses: [
      { cause: 'creative_fatigue',
        label: 'o criativo envelheceu em relação ao padrão da categoria',
        proposalType: 'creative',
        test(f) {
          const ok = f.confirmar_tendencia.gradual && f.criativo_da_categoria.leadersEvolved;
          return { eliminated: !ok, why: ok ? 'queda gradual + líderes evoluíram o padrão visual' : 'líderes não mudaram o padrão',
                   support: ok ? 2 : 0 };
      } },
      { cause: 'demand_erosion',
        label: 'a demanda da categoria está encolhendo aos poucos',
        proposalType: 'wait',
        test(f) {
          const ok = f.demanda.demandSlope < -0.05;
          return { eliminated: !ok, why: ok ? 'demanda em declínio gradual' : 'demanda estável', support: ok ? 2 : 0 };
      } },
      { cause: 'price_erosion',
        label: 'concorrentes foram ficando mais baratos aos poucos',
        proposalType: 'reposition',
        test(f) {
          const ok = f.erosao_de_preco.cheaperCount >= 2;
          return { eliminated: !ok, why: ok ? 'maioria dos concorrentes mais barata' : 'preço segue competitivo', support: ok ? 1 : 0 };
      } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const map = {
        creative_fatigue: { type: 'creative', title: `Renovar o criativo de ${p.name} (fadiga vs. categoria)`,
          text: 'A categoria evoluiu o padrão visual e nosso anúncio parou no tempo (MIF 4.4). Testar criativo no padrão vencedor atual, como experimento reversível.',
          impactPct: [0.06, 0.12], effort: 2, reversible: true, class: 'C' },
        demand_erosion: { type: 'wait', title: 'Queda é da categoria — não gastar alavanca',
          text: 'Vigília reforçada; reavaliar posicionamento se a tendência persistir 30 dias.',
          impactPct: [0, 0], effort: 0, reversible: true, class: 'A' },
        price_erosion: { type: 'reposition', title: `Reposicionar ${p.name} pelo diferencial`,
          text: 'Erosão lenta de competitividade: reforçar o diferencial antes de discutir preço (MIF 1.3).',
          impactPct: [0.05, 0.1], effort: 1, reversible: true, class: 'C' },
      };
      return map[cause] || null;
    },
  },

  /* ============ EXPLOSÃO DE VENDAS — oportunidade com prazo (MOS Fluxo 004/005) ============ */
  sales_explosion: {
    id: 'sales_explosion',
    title: 'Explosão de vendas',
    steps: [
      { name: 'confirmar_sustentacao', run(ctx) {
          const d = ctx.driftOf('impressions', 3);
          return { lift: d.pct, sustained: d.pct > 0.3 };
      } },
      { name: 'identificar_origem', run(ctx) {
          const recent = ctx.world.categoryDemand.slice(-3);
          const avg = recent.reduce((s, d) => s + d.index, 0) / recent.length;
          return { categoryWave: avg > 1.15, note: avg > 1.15 ? 'a categoria inteira subiu' : 'o pico é do produto, não da categoria' };
      } },
      { name: 'risco_de_ruptura', run(ctx) {
          const days = ctx.world.stockDaysOf(ctx.productId);
          return { stockDays: days, atRisk: days < 15, note: `cobertura de estoque: ${days} dias na velocidade atual` };
      } },
    ],
    hypotheses: [
      { cause: 'viral_demand',
        label: 'o produto viralizou — demanda excepcional com prazo de validade',
        proposalType: 'capture_demand',
        test(f) {
          const ok = f.confirmar_sustentacao.sustained && !f.identificar_origem.categoryWave;
          return { eliminated: !ok, why: ok ? 'pico do produto com categoria estável' : 'não é viral do produto', support: ok ? 2 : 0 };
      } },
      { cause: 'category_wave',
        label: 'a categoria inteira está em alta (sazonal/tendência)',
        proposalType: 'capture_demand',
        test(f) {
          const ok = f.confirmar_sustentacao.sustained && f.identificar_origem.categoryWave;
          return { eliminated: !ok, why: ok ? 'onda de categoria confirmada' : 'categoria estável', support: ok ? 2 : 0 };
      } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const f = ctx.findings;
      return { type: 'capture_demand', title: `Capturar a onda de ${p.name} antes que feche`,
        text: `Janela aberta: garantir cobertura de estoque${f.risco_de_ruptura.atRisk ? ` (URGENTE: só ${f.risco_de_ruptura.stockDays} dias)` : ''}, testar elasticidade de preço para cima (MIF 4.5) e reforçar palavras da onda.`,
        impactPct: [0.1, 0.2], effort: 2, reversible: true, class: 'C', window: true };
    },
  },

  /* ============ RUPTURA DE ESTOQUE — MIF 3.3 ============ */
  stockout: {
    id: 'stockout',
    title: 'Risco de ruptura de estoque',
    steps: [
      { name: 'dimensionar_cobertura', run(ctx) {
          const days = ctx.world.stockDaysOf(ctx.productId);
          return { stockDays: days, note: `cobertura: ${days} dias — ruptura é perda dupla (venda + ranking)` };
      } },
      { name: 'causa_da_queima', run(ctx) {
          const d = ctx.driftOf('impressions', 5);
          return { velocitySpike: d.pct > 0.25, note: d.pct > 0.25 ? 'a velocidade de venda subiu' : 'velocidade normal — estoque não foi reposto' };
      } },
    ],
    hypotheses: [
      { cause: 'velocity_spike',
        label: 'a demanda acelerou e o estoque não acompanhou',
        proposalType: 'stock_brake',
        test(f) { const ok = f.causa_da_queima.velocitySpike;
          return { eliminated: !ok, why: ok ? 'velocidade acima do normal' : 'velocidade normal', support: ok ? 2 : 0 }; } },
      { cause: 'replenishment_gap',
        label: 'reposição atrasou com venda normal',
        proposalType: 'stock_brake',
        test(f) { const ok = !f.causa_da_queima.velocitySpike;
          return { eliminated: !ok, why: ok ? 'venda normal, estoque baixo = reposição' : 'houve pico de venda', support: ok ? 1 : 0 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const days = ctx.findings.dimensionar_cobertura.stockDays;
      return { type: 'stock_brake', title: `Frear a queima de estoque de ${p.name} (${days} dias)`,
        text: 'MIF 3.3: subir o preço para frear a demanda é melhor que zerar; nunca pausar o anúncio. Em paralelo, alertar reposição urgente.',
        impactPct: [0.03, 0.06], effort: 1, reversible: true, class: 'B', window: true,
        firstResponse: ['subir preço para frear a demanda', 'alertar reposição urgente', 'manter o anúncio ativo (pausa mata o histórico)'] };
    },
  },

  /* ============ PERDA DE RANKING — MIF 2.2 ============ */
  ranking_drop: {
    id: 'ranking_drop',
    title: 'Perda de ranking/visibilidade',
    steps: [
      { name: 'dimensionar', run(ctx) {
          const last = ctx.world.latest(ctx.productId);
          const b = ctx.memory.normalOf(ctx.productId, 'ranking');
          return { ranking: last.ranking, shift: b ? Math.round((last.ranking - b.mean) * 10) / 10 : 0 };
      } },
      { name: 'propria_operacao', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const recent = p.ownChanges.filter(c => ctx.world.day - c.day <= 7 && c.source !== 'head');
          const salesBefore = ctx.driftOf('conv', 7);
          return { ownChanges: recent, salesLedRanking: salesBefore.pct < -0.1,
                   note: recent.length ? 'mudança interna recente' : 'nada mudou do nosso lado' };
      } },
      { name: 'concorrencia', run(ctx) {
          const cuts = competitorCuts(ctx.world, ctx.productId, null);
          const p = ctx.world.product(ctx.productId);
          const entrants = p.competitors.filter(c => c.entryDay && ctx.world.day - c.entryDay <= 14);
          return { cuts: cuts.length, entrants: entrants.length };
      } },
      { name: 'visibilidade', run(ctx) {
          const d = ctx.driftOf('impressions', 3);
          return { impressionsDrift: d.pct, lostVisibility: d.pct < -0.12 };
      } },
    ],
    hypotheses: [
      { cause: 'competitor_acceleration',
        label: 'concorrente acelerou (preço, ads ou entrante)',
        proposalType: 'visibility_push',
        test(f) { const ok = f.concorrencia.cuts > 0 || f.concorrencia.entrants > 0;
          return { eliminated: !ok, why: ok ? 'movimento concorrente confirmado' : 'sem movimento concorrente', support: ok ? 2 : 0 }; } },
      { cause: 'own_performance_loop',
        label: 'vendas caíram antes — o ranking é consequência (círculo vicioso)',
        proposalType: 'reposition',
        test(f) { const ok = f.propria_operacao.salesLedRanking;
          return { eliminated: !ok, why: ok ? 'a conversão caiu antes do ranking' : 'conversão estável antes da queda', support: ok ? 2 : 0 }; } },
      { cause: 'visibility_pressure',
        label: 'perdemos leilão/visibilidade sem causa interna (pressão de ads)',
        proposalType: 'visibility_push',
        test(f) {
          const ok = f.visibilidade.lostVisibility && f.concorrencia.cuts === 0 &&
                     f.propria_operacao.ownChanges.length === 0 && !f.propria_operacao.salesLedRanking;
          return { eliminated: !ok, why: ok ? 'tráfego caiu sem causa interna nem corte concorrente — pressão de visibilidade' : 'não caracteriza pressão externa de visibilidade', support: ok ? 1 : 0 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const map = {
        competitor_acceleration: { type: 'visibility_push', title: `Responder à pressão de ranking em ${p.name}`,
          text: 'Reagir dentro da janela (MIF 2.2): reforçar palavras estratégicas e considerar tração paga antes da posição assentar.',
          impactPct: [0.06, 0.12], effort: 2, reversible: true, class: 'C', window: true },
        own_performance_loop: { type: 'reposition', title: `Quebrar o círculo vicioso de ${p.name}`,
          text: 'O ranking caiu porque a conversão caiu. Atacar a conversão primeiro; o ranking segue.',
          impactPct: [0.08, 0.12], effort: 2, reversible: true, class: 'C' },
        visibility_pressure: { type: 'visibility_push', title: `Recuperar visibilidade de ${p.name}`,
          text: 'Sem causa interna e sem corte de preço: pressão de visibilidade (ads/leilão). Testar tração paga em janela curta e medir.',
          impactPct: [0.05, 0.1], effort: 2, reversible: true, class: 'C', window: true },
      };
      return map[cause] || null;
    },
  },

  /* ============ AUMENTO DE DEVOLUÇÕES — a margem sangrando em silêncio ============ */
  returns_spike: {
    id: 'returns_spike',
    title: 'Pico de devoluções',
    steps: [
      { name: 'padrao_dos_motivos', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const recent = p.returnsLog.filter(r => ctx.world.day - r.day <= 7);
          const reasons = {};
          for (const r of recent) reasons[r.reason] = (reasons[r.reason] || 0) + (r.qty || 1);
          const dominant = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
          return { dominantReason: dominant ? dominant[0] : null, reasons,
                   note: dominant ? `motivo dominante: "${dominant[0]}"` : 'sem motivo dominante' };
      } },
      { name: 'expectativa_do_anuncio', run(ctx) {
          const f = ctx.findings.padrao_dos_motivos;
          const expectationWords = ['diferente da foto', 'menor do que', 'esperava', 'não parece'];
          const gap = f.dominantReason && expectationWords.some(w => f.dominantReason.includes(w));
          return { expectationGap: !!gap };
      } },
    ],
    hypotheses: [
      { cause: 'expectation_gap',
        label: 'o anúncio promete o que o produto não entrega (expectativa descalibrada)',
        proposalType: 'fix_expectation',
        test(f) { const ok = f.expectativa_do_anuncio.expectationGap;
          return { eliminated: !ok, why: ok ? 'motivos apontam expectativa descalibrada' : 'motivos não apontam expectativa', support: ok ? 2 : 0 }; } },
      { cause: 'defective_batch',
        label: 'lote com defeito',
        proposalType: 'reputation',
        test(f) { const ok = f.padrao_dos_motivos.dominantReason && /defeito|quebrad|trincad/.test(f.padrao_dos_motivos.dominantReason);
          return { eliminated: !ok, why: ok ? 'motivos apontam defeito físico' : 'sem padrão de defeito', support: ok ? 2 : 0 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const map = {
        expectation_gap: { type: 'fix_expectation', title: `Recalibrar a expectativa do anúncio de ${p.name}`,
          text: 'Devolução por expectativa é o anúncio vendendo errado (MIF 3.2): foto com escala real, ficha honesta, descrição recalibrada. Corta devolução E melhora avaliação.',
          impactPct: [0.04, 0.08], effort: 2, reversible: true, class: 'C' },
        reputation: { type: 'reputation', title: `Investigar lote e responder devoluções de ${p.name}`,
          text: 'Checar lote com o fornecedor, responder publicamente e reforçar embalagem.',
          impactPct: [0.03, 0.06], effort: 2, reversible: true, class: 'A' },
      };
      return map[cause] || null;
    },
  },

  /* ============ MUDANÇA DE ALGORITMO — MIF 3.6 ============ */
  algorithm_change: {
    id: 'algorithm_change',
    title: 'Mudança de algoritmo/layout da plataforma',
    steps: [
      { name: 'confirmar_assinatura', run(ctx) {
          const affected = (ctx.anomaly && ctx.anomaly.facts.affected) || [];
          return { affected, ratio: ctx.anomaly ? ctx.anomaly.facts.ratio : null,
                   note: `métricas mudaram em bloco (${affected.length} produtos no mesmo dia) — assinatura de causa externa` };
      } },
      { name: 'dimensionar_efeito', run(ctx) {
          const d = ctx.driftOf('impressions', 2);
          return { avgDrop: d.pct };
      } },
    ],
    hypotheses: [
      { cause: 'platform_algorithm',
        label: 'a plataforma mudou algoritmo ou layout',
        proposalType: 'adapt',
        test(f) { const ok = f.confirmar_assinatura.affected.length >= 2;
          return { eliminated: !ok, why: ok ? 'mudança em bloco confirmada' : 'mudança não é em bloco', support: ok ? 2 : 0 }; } },
    ],
    proposalFor(cause, ctx) {
      return { type: 'adapt', title: 'Adaptar a operação à mudança da plataforma',
        text: 'MIF 3.6: NÃO consertar o que não quebrou. Primeiro entender o que o novo padrão privilegia; depois adaptar 1 produto como teste e replicar se funcionar.',
        impactPct: [0.05, 0.1], effort: 2, reversible: true, class: 'C' };
    },
  },

  /* ============ ONDA DE ENTRANTES — MIF 3.5 em escala ============ */
  competitor_surge: {
    id: 'competitor_surge',
    title: 'Crescimento repentino de concorrentes',
    steps: [
      { name: 'mapear_entrantes', run(ctx) {
          const p = ctx.world.product(ctx.productId);
          const entrants = p.competitors.filter(c => c.entryDay && ctx.world.day - c.entryDay <= 7);
          return { count: entrants.length,
                   entrants: entrants.map(e => ({ name: e.name, price: e.price, weakness: e.weakness })) };
      } },
      { name: 'medir_pressao', run(ctx) {
          const dCtr = ctx.driftOf('ctr', 3);
          const last = ctx.world.latest(ctx.productId);
          return { ctrDrift: dCtr.pct, ranking: last.ranking, immediate: dCtr.pct < -0.05 };
      } },
    ],
    hypotheses: [
      { cause: 'entrant_wave',
        label: 'onda de entrantes pressionando a categoria de uma vez',
        proposalType: 'defend_share',
        test(f) { const ok = f.mapear_entrantes.count >= 2;
          return { eliminated: !ok, why: ok ? `${f.mapear_entrantes.count} entrantes na janela` : 'sem onda de entrantes', support: ok ? 2 : 0 }; } },
    ],
    proposalFor(cause, ctx) {
      const p = ctx.world.product(ctx.productId);
      const f = ctx.findings;
      if (!f.medir_pressao.immediate)
        return { type: 'watch', title: 'Vigília reforçada sobre a onda de entrantes',
          text: 'MIF 3.5: muitos morrem quando o subsídio acaba. Monitorar 2-3 semanas, mapear pontos fracos, sem pânico.',
          impactPct: [0, 0], effort: 0, reversible: true, class: 'A' };
      return { type: 'defend_share', title: `Defender o share of search de ${p.name}`,
        text: `Pressão imediata confirmada. Defender as palavras que são nossas e explorar os pontos fracos comuns dos entrantes (${f.mapear_entrantes.entrants.map(e => e.weakness).join('; ')}).`,
        impactPct: [0.05, 0.1], effort: 2, reversible: true, class: 'C', window: true };
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
  competitor_surge: 'competitor_surge',
  listing_down: 'listing_down',
  success_streak: 'success_streak',
  review_wave: 'sales_drop',
  silent_decay: 'silent_decay',
  sales_explosion: 'sales_explosion',
  stockout_risk: 'stockout', stockout_critical: 'stockout',
  ranking_drop: 'ranking_drop',
  returns_spike: 'returns_spike',
  algorithm_change: 'algorithm_change',
};

NS.Playbooks = { all: PLAYBOOKS, forAnomaly: kind => PLAYBOOKS[ROUTE[kind]] || null };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

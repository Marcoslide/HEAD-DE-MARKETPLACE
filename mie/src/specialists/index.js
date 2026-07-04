/* O CONSELHO DE ESPECIALISTAS — Constituição Arts. 10-11.
   Cada especialista opina APENAS dentro do seu domínio e entrega parecer
   em formato fixo: constatação → evidência → confiança → recomendação.
   Nenhum especialista fala com o usuário; nenhum executa nada.
   (Cada classe pode ser extraída para arquivo próprio quando crescer.) */
(function (NS) {
'use strict';

/* Formato fixo do parecer (Art. 11.2) */
function parecer(domain, constatacao, evidencia, confianca, recomendacao) {
  return { domain, constatacao, evidencia, confianca, recomendacao };
}

/* util: variação % entre o valor recente e o normal aprendido */
function drift(memory, world, pid, metric, days = 3) {
  const recent = world.seriesOf(pid, days);
  if (!recent.length) return { pct: 0, z: 0 };
  const avg = recent.reduce((s, r) => s + r[metric], 0) / recent.length;
  const b = memory.normalOf(pid, metric);
  if (!b || !b.mean) return { pct: 0, z: 0 };
  return { pct: (avg - b.mean) / b.mean, z: memory.zScore(pid, metric, avg), avg, normal: b.mean };
}

const SPECIALISTS = {

  conversion: (ctx) => {
    const { memory, world, productId: pid } = ctx;
    const dCtr = drift(memory, world, pid, 'ctr');
    const dConv = drift(memory, world, pid, 'conv');
    const dImp = drift(memory, world, pid, 'impressions');
    let constat, rec;
    if (Math.abs(dImp.pct) > 0.3) {
      constat = 'O problema é de tráfego, não de conversão — as impressões saíram do normal.';
      rec = 'investigar visibilidade (ranking/busca) antes de mexer no anúncio';
    } else if (dConv.pct < -0.1 && dCtr.pct < -0.05) {
      constat = 'Queda composta: o anúncio perdeu atratividade na lista E dentro da página.';
      rec = 'causa provavelmente externa (oferta concorrente melhorou em termos relativos)';
    } else if (dConv.pct < -0.1) {
      constat = 'CTR estável com conversão em queda: o comprador clica e desiste dentro da página.';
      rec = 'revisar preço percebido, avaliações recentes e objeções sem resposta';
    } else if (dCtr.pct < -0.05) {
      constat = 'Conversão estável com CTR em queda: algo piorou na lista de busca.';
      rec = 'comparar cartão de busca com snapshot anterior e vizinhos de página';
    } else {
      constat = 'Funil dentro do normal desta operação.';
      rec = 'nenhuma ação de conversão necessária';
    }
    return parecer('conversion', constat,
      { ctr: dCtr, conv: dConv, impressions: dImp },
      Math.abs(dConv.z) > 3 || Math.abs(dCtr.z) > 3 ? 'alta' : 'média', rec);
  },

  seo: (ctx) => {
    const { memory, world, productId: pid } = ctx;
    const last = world.latest(pid);
    const b = memory.normalOf(pid, 'ranking');
    const shift = b ? last.ranking - b.mean : 0;
    return parecer('seo',
      shift >= 1.5 ? `O ranking caiu ~${Math.round(shift)} posições vs. o normal.`
                   : 'Ranking e posição de busca dentro do normal.',
      { ranking: last.ranking, normal: b ? Math.round(b.mean * 10) / 10 : null },
      b && b.n > 7 ? 'alta' : 'média',
      shift >= 1.5 ? 'ranking em queda costuma ser consequência (vendas) ou concorrente acelerando — cruzar com o parecer de concorrência'
                   : 'nenhuma ação de SEO necessária');
  },

  pricing: (ctx) => {
    const { world, productId: pid } = ctx;
    const p = world.product(pid);
    const cuts = [];
    for (const c of p.competitors) {
      const recent = c.history.slice(-7).filter(h => h.event && h.event.includes('preço'));
      for (const h of recent) cuts.push({ competitor: c.name, day: h.day, event: h.event, price: h.price });
    }
    const cheaper = p.competitors.filter(c => c.price < p.price * 0.95).map(c => c.name);
    return parecer('pricing',
      cuts.length ? `${cuts.length} corte(s) de preço de concorrentes nos últimos dias: ${cuts.map(c => `${c.competitor} (${c.event}, dia ${c.day})`).join('; ')}.`
        : cheaper.length ? `Concorrentes mais baratos que você: ${cheaper.join(', ')} — sem movimento recente.`
        : 'Posição de preço competitiva e estável.',
      { cuts, ourPrice: p.price, margin: p.margin },
      cuts.length ? 'alta' : 'média',
      cuts.length ? 'NÃO cobrir o corte de imediato (MIF 3.1): reposicionar pelo diferencial; preço é a última alavanca'
                  : 'sem ação de preço');
  },

  competitorWatch: (ctx) => { // Marketplace Specialist: o lado de fora
    const { world, productId: pid } = ctx;
    const p = world.product(pid);
    const entrants = p.competitors.filter(c => c.entryDay && world.day - c.entryDay <= 21);
    const weaknesses = p.competitors.map(c => `${c.name}: ${c.weakness}`);
    return parecer('marketplace',
      entrants.length ? `Entrante recente na categoria: ${entrants.map(e => `${e.name} (dia ${e.entryDay}, preço agressivo)`).join(', ')}.`
                      : 'Sem entrantes recentes; concorrência conhecida.',
      { competitors: p.competitors.length, entrants: entrants.map(e => e.id), weaknesses },
      'alta',
      entrants.length ? 'monitorar 2-3 semanas antes de reagir (MIF 3.5); mapear ponto fraco desde o dia 1'
                      : 'manter vigília padrão');
  },

  creative: (ctx) => {
    const { world, productId: pid } = ctx;
    const p = world.product(pid);
    const leaders = p.competitors.filter(c => c.creative !== 'fundo branco');
    return parecer('creative',
      leaders.length ? `Concorrentes usam criativo superior (${[...new Set(leaders.map(l => l.creative))].join(', ')}); nosso padrão atual pode estar defasado.`
                     : 'Nosso criativo está no padrão da categoria.',
      { theirCreatives: p.competitors.map(c => c.creative) },
      'média',
      leaders.length ? 'testar foto ambientada/vídeo (padrão vencedor da casa quando comprovado — consultar memória)' : 'sem ação');
  },

  trend: (ctx) => {
    const { world } = ctx;
    const recent = world.categoryDemand.slice(-7);
    const avg = recent.reduce((s, d) => s + d.index, 0) / (recent.length || 1);
    return parecer('trend',
      avg < 0.93 ? 'A demanda da categoria inteira está abaixo do normal — a causa pode ser mercado, não operação.'
        : avg > 1.07 ? 'Demanda da categoria em alta — janela boa para ganhar posição.'
        : 'Demanda da categoria estável.',
      { demandIndex: Math.round(avg * 100) / 100 },
      'média',
      avg < 0.93 ? 'não atribuir a queda ao anúncio antes de descontar o efeito de mercado' : 'sem ajuste por tendência');
  },

  behavior: (ctx) => {
    const { world, memory, productId: pid } = ctx;
    const dow = world.day % 7;
    const f = memory.weekdayFactor(pid, dow); // padrão APRENDIDO desta operação (Art. 17)
    return parecer('behavior',
      f < 0.9 ? `Hoje é um dia estruturalmente fraco NESTA operação (índice aprendido ${f.toFixed(2)}) — descontar antes de concluir queda.`
        : f > 1.06 ? `Hoje é um dia estruturalmente forte nesta operação (índice ${f.toFixed(2)}).`
        : 'Dia dentro do padrão aprendido da operação.',
      { dayOfWeek: dow, learnedIndex: Math.round(f * 100) / 100 },
      memory.weekday.size >= 7 ? 'alta' : 'média',
      'toda comparação deve ser mesmo-dia-contra-mesmo-dia (MIF 5.3); o índice é aprendido, não fixo');
  },
};

function createRegistry() {
  return {
    domains: Object.keys(SPECIALISTS),
    consult(ctx, domains) {
      const list = domains || Object.keys(SPECIALISTS);
      return list.map(d => SPECIALISTS[d](ctx));
    },
  };
}

NS.Specialists = { createRegistry, parecer };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

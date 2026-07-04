/* SPECIALISTS ENGINE · Roster (Sprint 06) — Constituição Arts. 10-11.
   Sete especialistas independentes. Cada um opina APENAS no seu domínio,
   com conhecimento, critérios e confiança próprios. Nenhum conhece a
   decisão final; nenhum executa (Art. 11.5).

   Parecer no formato RICO (superset do formato fixo do Art. 11.2):
     diagnóstico · evidências · hipóteses · confiança · recomendação ·
     impacto esperado · riscos · urgência
   Mantém os aliases (domain, constatacao, confianca, recomendacao) para
   compatibilidade com o Investigation Engine e o painel de observabilidade. */
(function (NS) {
'use strict';

/* tipos de recomendação acionáveis (o que FAZER) — usados na votação */
const ACTIONABLE = ['reposition', 'creative', 'price', 'stock', 'reputation', 'visibility', 'capture'];

/* Fábrica do parecer rico. `confianca` (label) é derivado de `confidence` (0..1). */
function parecer(domain, label, o) {
  const confidence = o.confidence ?? 0.5;
  const confianca = confidence >= 0.75 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa';
  return {
    domain, label,
    diagnostico: o.diagnostico,
    constatacao: o.diagnostico,                 // alias (Art. 11.2 / retrocompat)
    evidencias: o.evidencias || [],
    evidencia: o.evidencias || [],              // alias
    hipoteses: o.hipoteses || [],
    confidence, confianca,
    recomendacao: o.recomendacao,
    recommendationType: o.recommendationType ?? null,
    impacto: o.impacto ?? null,                 // { metric, estimatePct:[lo,hi] } | string | null
    riscos: o.riscos || [],
    urgencia: o.urgencia || 'baixa',
    stance: o.stance || 'neutral',              // 'alert' | 'opportunity' | 'neutral'
    applicable: o.applicable ?? (o.stance && o.stance !== 'neutral'),
  };
}

/* util: variação % e z-score vs. o normal aprendido desta operação */
function drift(memory, world, pid, metric, days = 3) {
  const recent = world.seriesOf(pid, days);
  if (!recent.length) return { pct: 0, z: 0 };
  const avg = recent.reduce((s, r) => s + r[metric], 0) / recent.length;
  const b = memory.normalOf(pid, metric);
  if (!b || !b.mean) return { pct: 0, z: 0 };
  return { pct: (avg - b.mean) / b.mean, z: memory.zScore(pid, metric, avg), avg, normal: b.mean };
}
const pctLabel = x => `${(x * 100).toFixed(0)}%`;

/* evidência do Knowledge Graph: o que já funcionou para este produto
   (Sprint 07). Especialista que se apoia em precedente ganha confiança. */
function graphReuse(ctx) {
  if (!ctx.graph || !ctx.productId) return { labels: [], boost: 0 };
  const worked = ctx.graph.whatWorkedForProduct(ctx.productId) || [];
  const labels = worked.slice(0, 3).map(w => w.label);
  return { labels, boost: labels.length ? Math.min(0.1, 0.04 * labels.length) : 0 };
}

/* ============================================================
   01 · CONVERSÃO — CTR, conversão, funil, criativos, título, provas
   ============================================================ */
function conversion(ctx) {
  const { memory, world, productId: pid } = ctx;
  const dCtr = drift(memory, world, pid, 'ctr');
  const dConv = drift(memory, world, pid, 'conv');
  const dImp = drift(memory, world, pid, 'impressions');
  const strong = Math.abs(dConv.z) > 3 || Math.abs(dCtr.z) > 3;
  const ev = [
    { fato: 'CTR vs. normal', valor: pctLabel(dCtr.pct) },
    { fato: 'conversão vs. normal', valor: pctLabel(dConv.pct) },
    { fato: 'impressões vs. normal', valor: pctLabel(dImp.pct) },
  ];
  if (Math.abs(dImp.pct) > 0.3)
    return parecer('conversion', 'Especialista em Conversão', {
      diagnostico: 'O problema é de tráfego, não de conversão — as impressões saíram do normal.',
      evidencias: ev, hipoteses: ['visibilidade/ranking caiu', 'sazonalidade de tráfego'],
      confidence: 0.6, recomendacao: 'investigar visibilidade antes de mexer no anúncio',
      recommendationType: null, urgencia: 'média', stance: 'alert',
      riscos: ['trocar o criativo agora não resolve um problema de tráfego'],
    });
  if (dConv.pct < -0.1 && dCtr.pct < -0.05) {
    const g = graphReuse(ctx);
    return parecer('conversion', 'Especialista em Conversão', {
      diagnostico: 'Queda composta: o anúncio perdeu atratividade na lista E dentro da página.'
        + (g.labels.length ? ` Já funcionou aqui antes: ${g.labels.join(', ')}.` : ''),
      evidencias: g.labels.length ? [...ev, { fato: 'precedente no grafo', valor: g.labels }] : ev,
      hipoteses: g.labels.length
        ? ['oferta concorrente melhorou em termos relativos', `reaproveitar o que já funcionou (${g.labels[0]})`]
        : ['oferta concorrente melhorou em termos relativos', 'preço percebido piorou'],
      confidence: Math.min(0.95, (strong ? 0.9 : 0.7) + g.boost),
      recomendacao: 'reposicionar pelo diferencial (a queda é relativa ao mercado)',
      recommendationType: 'reposition', impacto: { metric: 'conv', estimatePct: [0.08, 0.12] },
      urgencia: strong ? 'alta' : 'média', stance: 'alert',
      riscos: ['tráfego novo entra mais frio: medir o funil inteiro, não só o CTR'],
    });
  }
  if (dConv.pct < -0.1)
    return parecer('conversion', 'Especialista em Conversão', {
      diagnostico: 'CTR estável com conversão em queda: o comprador clica e desiste dentro da página.',
      evidencias: ev, hipoteses: ['preço percebido/parcelamento piorou', 'avaliação negativa recente no topo', 'objeção sem resposta'],
      confidence: strong ? 0.85 : 0.65, recomendacao: 'revisar preço percebido, avaliações recentes e objeções sem resposta',
      recommendationType: 'reposition', impacto: { metric: 'conv', estimatePct: [0.06, 0.1] },
      urgencia: 'média', stance: 'alert', riscos: [],
    });
  if (dCtr.pct < -0.05)
    return parecer('conversion', 'Especialista em Conversão', {
      diagnostico: 'Conversão estável com CTR em queda: algo piorou na lista de busca (imagem/preço na miniatura).',
      evidencias: ev, hipoteses: ['vizinho de página trocou imagem/preço', 'perdemos um selo (frete/promo)'],
      confidence: 0.65, recomendacao: 'testar nova imagem principal que vença a miniatura',
      recommendationType: 'creative', impacto: { metric: 'ctr', estimatePct: [0.05, 0.09] },
      urgencia: 'média', stance: 'alert', riscos: ['imagem nova pode alterar a expectativa e afetar devoluções'],
    });
  return parecer('conversion', 'Especialista em Conversão', {
    diagnostico: 'Funil dentro do normal desta operação.', evidencias: ev,
    confidence: 0.55, recomendacao: 'nenhuma ação de conversão necessária', stance: 'neutral',
  });
}

/* ============================================================
   02 · SEO MARKETPLACE — palavras-chave, ranking, título, posição
   ============================================================ */
function seo(ctx) {
  const { memory, world, productId: pid } = ctx;
  const last = world.latest(pid);
  const b = memory.normalOf(pid, 'ranking');
  const shift = b ? last.ranking - b.mean : 0;
  if (shift >= 1.5)
    return parecer('seo', 'Especialista em SEO', {
      diagnostico: `O ranking caiu ~${Math.round(shift)} posições vs. o normal desta operação.`,
      evidencias: [{ fato: 'posição atual', valor: last.ranking }, { fato: 'posição normal', valor: b ? Math.round(b.mean * 10) / 10 : null }],
      hipoteses: ['consequência de queda de vendas (círculo vicioso)', 'concorrente acelerou em ads/vendas'],
      confidence: b && b.n > 7 ? 0.8 : 0.55, recomendacao: 'reforçar palavras estratégicas e recuperar visibilidade',
      recommendationType: 'visibility', impacto: { metric: 'impressions', estimatePct: [0.05, 0.1] },
      urgencia: 'média', stance: 'alert', riscos: ['tração paga tem custo — medir retorno na janela'],
    });
  return parecer('seo', 'Especialista em SEO', {
    diagnostico: 'Ranking e posição de busca dentro do normal.',
    evidencias: [{ fato: 'posição atual', valor: last.ranking }],
    confidence: 0.6, recomendacao: 'nenhuma ação de SEO necessária', stance: 'neutral',
  });
}

/* ============================================================
   03 · COMERCIAL — preço, margem, competitividade, descontos, frete
   ============================================================ */
function commercial(ctx) {
  const { world, productId: pid } = ctx;
  const p = world.product(pid);
  const cuts = [];
  for (const c of p.competitors)
    for (const h of c.history.slice(-7))
      if (h.event && h.event.includes('preço')) cuts.push({ competitor: c.name, day: h.day, event: h.event });
  const cheaper = p.competitors.filter(c => c.price < p.price * 0.95).map(c => c.name);
  if (cuts.length)
    return parecer('commercial', 'Especialista Comercial', {
      diagnostico: `${cuts.length} corte(s) de preço de concorrentes: ${cuts.map(c => `${c.competitor} (${c.event})`).join('; ')}.`,
      evidencias: [{ fato: 'nosso preço', valor: p.price }, { fato: 'margem', valor: pctLabel(p.margin) }, { fato: 'cortes recentes', valor: cuts.length }],
      hipoteses: ['guerra de preço iniciada', 'concorrente com custo estruturalmente menor'],
      confidence: 0.8, recomendacao: 'NÃO cobrir o corte (MIF 3.1: preço é a última alavanca); defender pelo diferencial',
      recommendationType: 'reposition', impacto: { metric: 'conv', estimatePct: [0.05, 0.1] },
      urgencia: 'alta', stance: 'alert',
      riscos: ['seguir o preço para baixo corrói a margem e vira leilão sem vencedor'],
    });
  if (cheaper.length)
    return parecer('commercial', 'Especialista Comercial', {
      diagnostico: `Concorrentes mais baratos que você: ${cheaper.join(', ')} — sem movimento recente.`,
      evidencias: [{ fato: 'nosso preço', valor: p.price }, { fato: 'mais baratos', valor: cheaper.length }],
      hipoteses: ['erosão lenta de competitividade de preço'],
      confidence: 0.55, recomendacao: 'reforçar o pacote (cupom/frete/kit) antes de rebaixar o preço de tabela',
      recommendationType: 'reposition', urgencia: 'baixa', stance: 'alert', riscos: [],
    });
  return parecer('commercial', 'Especialista Comercial', {
    diagnostico: 'Posição de preço competitiva e estável.',
    evidencias: [{ fato: 'nosso preço', valor: p.price }, { fato: 'margem', valor: pctLabel(p.margin) }],
    confidence: 0.6, recomendacao: 'sem ação de preço', stance: 'neutral',
  });
}

/* ============================================================
   04 · CONCORRÊNCIA — entrantes, movimentação, mudança de estratégia
   ============================================================ */
function competition(ctx) {
  const { world, productId: pid } = ctx;
  const p = world.product(pid);
  const entrants = p.competitors.filter(c => c.entryDay && world.day - c.entryDay <= 21);
  const cuts = p.competitors.some(c => c.history.slice(-3).some(h => h.event));
  if (entrants.length)
    return parecer('competition', 'Especialista em Concorrência', {
      diagnostico: `${entrants.length} entrante(s) recente(s): ${entrants.map(e => `${e.name} (dia ${e.entryDay})`).join(', ')}.`,
      evidencias: [{ fato: 'entrantes (21d)', valor: entrants.length }, { fato: 'pontos fracos', valor: entrants.map(e => e.weakness) }],
      hipoteses: ['onda de entrantes subsidiados', 'novo player com tração de lançamento'],
      confidence: 0.75, recomendacao: entrants.length >= 2 ? 'defender share of search nas palavras que são nossas' : 'monitorar 2-3 semanas antes de reagir (MIF 3.5)',
      recommendationType: entrants.length >= 2 ? 'visibility' : null,
      urgencia: entrants.length >= 2 ? 'alta' : 'média', stance: 'alert',
      riscos: ['reagir cedo demais a entrante que pode morrer quando o subsídio acabar'],
    });
  if (cuts)
    return parecer('competition', 'Especialista em Concorrência', {
      diagnostico: 'Concorrente conhecido mudou preço/oferta recentemente.',
      evidencias: [{ fato: 'concorrentes', valor: p.competitors.length }],
      hipoteses: ['reação competitiva pontual'],
      confidence: 0.7, recomendacao: 'reposicionar pelo diferencial; explorar o ponto fraco do atacante',
      recommendationType: 'reposition', urgencia: 'média', stance: 'alert', riscos: [],
    });
  return parecer('competition', 'Especialista em Concorrência', {
    diagnostico: 'Sem entrantes recentes; concorrência conhecida e estável.',
    evidencias: [{ fato: 'concorrentes', valor: p.competitors.length }],
    confidence: 0.65, recomendacao: 'manter vigília padrão', stance: 'neutral',
  });
}

/* ============================================================
   05 · OPERAÇÃO — estoque, ruptura, expedição, avaliações, devoluções, SLA
   ============================================================ */
function operations(ctx) {
  const { world, productId: pid } = ctx;
  const p = world.product(pid);
  const stockDays = world.stockDaysOf(pid);
  const last = world.latest(pid);
  const returnsRate = last.orders > 0 ? last.returns / last.orders : 0;
  const badReviews = p.reviews.filter(r => r.stars <= 2 && world.day - r.day <= 7);
  if (stockDays <= NS.CONFIG.STOCK_CRITICAL_DAYS)
    return parecer('operations', 'Especialista em Operação', {
      diagnostico: `Ruptura iminente: só ${stockDays} dias de cobertura na velocidade atual.`,
      evidencias: [{ fato: 'cobertura (dias)', valor: stockDays }, { fato: 'estoque', valor: p.stock }],
      hipoteses: ['aceleração de demanda', 'reposição atrasada'],
      confidence: 0.9, recomendacao: 'frear a demanda subindo o preço (nunca pausar — pausa mata o histórico, MIF 3.3)',
      recommendationType: 'stock', impacto: { metric: 'availability', estimatePct: [0.9, 1] },
      urgencia: 'alta', stance: 'alert', riscos: ['ruptura = perda dupla: venda de hoje + ranking de amanhã'],
    });
  if (stockDays <= NS.CONFIG.STOCK_ATTENTION_DAYS)
    return parecer('operations', 'Especialista em Operação', {
      diagnostico: `Cobertura de estoque baixa (${stockDays} dias).`,
      evidencias: [{ fato: 'cobertura (dias)', valor: stockDays }],
      hipoteses: ['tendência de ruptura'], confidence: 0.7,
      recomendacao: 'alertar reposição e vigiar velocidade', recommendationType: 'stock',
      urgencia: 'média', stance: 'alert', riscos: [],
    });
  if (returnsRate > (p.base.returnsRate || 0.05) * 1.8)
    return parecer('operations', 'Especialista em Operação', {
      diagnostico: `Devoluções acima do normal (${pctLabel(returnsRate)}).`,
      evidencias: [{ fato: 'taxa de devolução', valor: pctLabel(returnsRate) }, { fato: 'motivos', valor: p.returnsLog.slice(-3).map(r => r.reason) }],
      hipoteses: ['expectativa descalibrada pelo anúncio', 'lote com defeito'],
      confidence: 0.75, recomendacao: 'tratar a causa raiz e recalibrar a expectativa (foto/ficha)',
      recommendationType: 'reputation', impacto: { metric: 'returnsRate', estimatePct: [0.04, 0.08] },
      urgencia: 'média', stance: 'alert', riscos: ['devolução corrói margem silenciosamente'],
    });
  if (badReviews.length >= 2)
    return parecer('operations', 'Especialista em Operação', {
      diagnostico: `Onda de avaliações negativas recentes (${badReviews.length}).`,
      evidencias: [{ fato: 'negativas (7d)', valor: badReviews.length }, { fato: 'padrão', valor: badReviews[0].text }],
      hipoteses: ['problema real de lote/transportadora', 'expectativa mal calibrada'],
      confidence: 0.7, recomendacao: 'responder publicamente cada avaliação e tratar a causa raiz',
      recommendationType: 'reputation', urgencia: 'média', stance: 'alert', riscos: [],
    });
  return parecer('operations', 'Especialista em Operação', {
    diagnostico: 'Operação saudável: estoque, devoluções e avaliações dentro do normal.',
    evidencias: [{ fato: 'cobertura (dias)', valor: stockDays }, { fato: 'devoluções', valor: pctLabel(returnsRate) }],
    confidence: 0.6, recomendacao: 'nenhuma ação operacional necessária', stance: 'neutral',
  });
}

/* ============================================================
   06 · MARKETING — tendências, sazonalidade, datas, oportunidades
   ============================================================ */
function marketing(ctx) {
  const { world, memory, productId: pid } = ctx;
  const recent = world.categoryDemand.slice(-7);
  const avg = recent.reduce((s, d) => s + d.index, 0) / (recent.length || 1);
  const dow = world.day % 7;
  const f = memory.weekdayFactor(pid, dow);
  if (avg > 1.07)
    return parecer('marketing', 'Especialista em Marketing', {
      diagnostico: 'Demanda da categoria em alta — janela boa para ganhar posição.',
      evidencias: [{ fato: 'índice de demanda (7d)', valor: Math.round(avg * 100) / 100 }],
      hipoteses: ['tendência sazonal/externa favorável'],
      confidence: 0.65, recomendacao: 'capturar a onda: reforçar palavras da tendência e garantir estoque',
      recommendationType: 'capture', impacto: { metric: 'impressions', estimatePct: [0.1, 0.2] },
      urgencia: 'média', stance: 'opportunity', riscos: ['janela fecha rápido; onda pode ser efêmera'],
    });
  if (avg < 0.93)
    return parecer('marketing', 'Especialista em Marketing', {
      diagnostico: 'Demanda da categoria abaixo do normal — parte da queda pode ser mercado, não o anúncio.',
      evidencias: [{ fato: 'índice de demanda (7d)', valor: Math.round(avg * 100) / 100 }],
      hipoteses: ['retração sazonal da categoria'],
      confidence: 0.6, recomendacao: 'descontar o efeito de mercado antes de gastar alavanca no anúncio',
      recommendationType: 'wait', urgencia: 'baixa', stance: 'alert',
      riscos: ['agir sobre o anúncio numa queda de mercado desperdiça alavanca'],
    });
  return parecer('marketing', 'Especialista em Marketing', {
    diagnostico: `Demanda estável; hoje é um dia ${f < 0.9 ? 'estruturalmente fraco' : f > 1.06 ? 'forte' : 'típico'} nesta operação (índice ${f.toFixed(2)}).`,
    evidencias: [{ fato: 'índice de demanda', valor: Math.round(avg * 100) / 100 }, { fato: 'índice do dia', valor: Math.round(f * 100) / 100 }],
    confidence: 0.55, recomendacao: 'comparar sempre mesmo-dia-contra-mesmo-dia (MIF 5.3)', stance: 'neutral',
  });
}

/* ============================================================
   07 · FINANCEIRO — ROI, lucro, margem, ticket, impacto financeiro
   Dimensiona o impacto em R$ e o risco de margem. Não vota em QUAL ação
   tomar (recommendationType null) — informa tamanho e urgência.
   ============================================================ */
function financial(ctx) {
  const { world, memory, productId: pid } = ctx;
  const p = world.product(pid);
  const revenue = world.revenueMonthly(pid);
  const dConv = drift(memory, world, pid, 'conv');
  const atRisk = Math.round(revenue * Math.max(0, -dConv.pct));
  const material = atRisk > revenue * 0.05;
  return parecer('financial', 'Especialista Financeiro', {
    diagnostico: material
      ? `Impacto financeiro material: ~R$ ${atRisk.toLocaleString('pt-BR')}/mês em risco (margem ${pctLabel(p.margin)}).`
      : `Impacto financeiro pequeno no momento (faturamento ~R$ ${revenue.toLocaleString('pt-BR')}/mês, margem ${pctLabel(p.margin)}).`,
    evidencias: [{ fato: 'faturamento/mês', valor: revenue }, { fato: 'em risco/mês', valor: atRisk }, { fato: 'margem', valor: pctLabel(p.margin) }],
    hipoteses: material ? ['a queda tem tamanho para justificar ação agora'] : ['abaixo do limiar de ação'],
    confidence: material ? 0.75 : 0.5,
    recomendacao: material ? 'o tamanho justifica agir; priorizar a ação de maior ROI e menor risco de margem' : 'monitorar; ainda não compensa gastar alavanca',
    recommendationType: null,
    impacto: { metric: 'revenue', estimateBRL: atRisk },
    urgencia: material ? 'alta' : 'baixa', stance: material ? 'alert' : 'neutral',
    riscos: ['qualquer corte de preço comprime a margem diretamente'],
  });
}

const ROSTER = { conversion, seo, commercial, competition, operations, marketing, financial };

NS._roster = { ROSTER, parecer, ACTIONABLE };
})(typeof module !== 'undefined' && module.exports ? require('../_ns.js') : (globalThis.MIE = globalThis.MIE || {}));

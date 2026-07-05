/* =============================================================
   V8LUCRO — Centro de Lucratividade (SPRINT 10.P.3)
   Extende (não duplica) o motor de custos: taxa fixa POR FAIXA DE
   PREÇO + hierarquia de regras (global→marketplace→conta→categoria→
   produto→sku→manual) declarando a regra vencedora; contribuição por
   produto/SKU ao ponto de equilíbrio + classificação; projeção do
   ponto de equilíbrio (% atingido, data, cenários, avançando/afastando);
   perdas e vazamentos. Nada de taxa inventada, margem sempre com
   fórmula, estimativa NUNCA vira lucro real.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8LUCRO = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const round2 = v => v == null ? null : Math.round(v * 100) / 100;

  /* faixas de exemplo pedidas no sprint (taxa fixa por faixa de preço) */
  const FAIXAS_EXEMPLO = [
    { de: 0, ate: 99.99, taxa: 5 },
    { de: 100, ate: 199.99, taxa: 15 },
    { de: 200, ate: Infinity, taxa: 26 },
  ];
  /* prioridade de resolução (mais específico vence) */
  const NIVEIS = ['global', 'marketplace', 'conta', 'categoria', 'produto', 'sku', 'manual'];
  const ROTULO = { global: 'REGRA GLOBAL', marketplace: 'REGRA DO MARKETPLACE', conta: 'REGRA DA CONTA',
    categoria: 'REGRA DA CATEGORIA', produto: 'REGRA DO PRODUTO', sku: 'REGRA DO SKU', manual: 'SOBRESCRITA MANUAL' };

  /* aplica a faixa correta a um preço; nunca inventa — se sem faixa, declara ausência */
  function taxaPorFaixa(faixas, preco) {
    if (preco == null || !Array.isArray(faixas) || !faixas.length) return { valor: null, faixa: null, motivo: 'sem tabela de faixas' };
    const f = faixas.find(x => preco >= x.de && preco <= x.ate);
    return f ? { valor: f.taxa, faixa: f, motivo: null }
      : { valor: null, faixa: null, motivo: `preço ${preco} fora das faixas cadastradas` };
  }

  /* RESOLUÇÃO HIERÁRQUICA da taxa fixa: percorre do mais específico ao mais geral,
     e declara QUAL regra venceu. `regras` é uma lista de { nivel, escopo:{...}, faixas } ou
     { nivel, escopo, valor } (taxa fixa direta). ctx = {marketplace,conta,categoria,produto,sku,preco}. */
  function resolverTaxaFixa(regras, ctx) {
    ctx = ctx || {};
    const casa = r => {
      if (r.nivel === 'global') return true;
      const e = r.escopo || {};
      if (r.nivel === 'marketplace') return e.marketplace === ctx.marketplace;
      if (r.nivel === 'conta') return e.conta === ctx.conta;
      if (r.nivel === 'categoria') return e.categoria === ctx.categoria;
      if (r.nivel === 'produto') return e.produto === ctx.produto;
      if (r.nivel === 'sku') return e.sku === ctx.sku;
      if (r.nivel === 'manual') return e.sku === ctx.sku || e.produto === ctx.produto;
      return false;
    };
    /* ordena por especificidade (índice em NIVEIS, maior = mais específico), manual sempre vence */
    const candidatas = (regras || []).filter(casa).sort((a, b) => NIVEIS.indexOf(b.nivel) - NIVEIS.indexOf(a.nivel));
    for (const r of candidatas) {
      const res = r.faixas ? taxaPorFaixa(r.faixas, ctx.preco) : { valor: r.valor, faixa: null, motivo: r.valor == null ? 'regra sem valor' : null };
      if (res.valor != null) return { valor: res.valor, faixa: res.faixa, nivel: r.nivel, regraVencedora: ROTULO[r.nivel] || r.nivel, regra: r };
    }
    return { valor: null, faixa: null, nivel: null, regraVencedora: null, motivo: 'nenhuma regra de taxa aplicável — o sistema declara a ausência, nunca inventa taxa' };
  }

  /* CONTRIBUIÇÃO por produto/SKU ao ponto de equilíbrio + classificação.
     entrada por unidade: { preco, custoProduto, comissaoPct, imposto Pct, taxaFixa, embalagem,
     adsRateado, afiliadoRateado, devolucaoRateada, fixoRateado }. */
  function contribuicaoSku(u) {
    u = u || {};
    const faltas = [];
    if (u.preco == null) faltas.push('preço');
    if (u.custoProduto == null) faltas.push('custo do produto');
    const preco = u.preco || 0;
    const comissao = u.comissaoPct != null ? round2(preco * u.comissaoPct / 100) : null;
    const imposto = u.impostoPct != null ? round2(preco * u.impostoPct / 100) : null;
    if (comissao == null) faltas.push('comissão do marketplace');
    if (u.taxaFixa == null) faltas.push('taxa fixa por venda');
    const variaveis = (u.custoProduto || 0) + (comissao || 0) + (imposto || 0) + (u.taxaFixa || 0) +
      (u.embalagem || 0) + (u.adsRateado || 0) + (u.afiliadoRateado || 0) + (u.devolucaoRateada || 0);
    const margemContribuicao = round2(preco - variaveis); /* antes do custo fixo */
    const margemContribuicaoPct = preco ? round2((margemContribuicao / preco) * 100) : null;
    const margemLiquida = u.fixoRateado != null ? round2(margemContribuicao - u.fixoRateado) : null;
    const margemLiquidaPct = margemLiquida != null && preco ? round2((margemLiquida / preco) * 100) : null;
    /* classificação honesta */
    let classe = 'SEM_DADOS_SUFICIENTES';
    if (!faltas.length) {
      const vendas30 = u.unidades30d != null ? u.unidades30d : null;
      if (margemContribuicao < 0) classe = 'CORRIGIR'; /* vende abaixo do custo variável */
      else if (margemLiquida != null && margemLiquida < 0) classe = vendas30 && vendas30 > 20 ? 'REPRECIFICAR' : 'INVESTIGAR';
      else if (margemContribuicaoPct != null && margemContribuicaoPct >= 30 && vendas30 != null && vendas30 >= 10) classe = 'ESCALAR';
      else if (margemContribuicaoPct != null && margemContribuicaoPct < (u.margemMinimaPct != null ? u.margemMinimaPct : 15)) classe = 'REPRECIFICAR';
      else classe = 'MANTER';
    }
    return {
      preco, variaveis: round2(variaveis), comissao, imposto,
      margemContribuicao, margemContribuicaoPct, margemLiquidaEstimada: margemLiquida, margemLiquidaEstimadaPct: margemLiquidaPct,
      lucroUnidade: margemLiquida, contribuicaoUnidade: margemContribuicao,
      classe, faltas, cobertura: faltas.length ? 'INSUFICIENTE — ' + faltas.join('; ') : 'completa para estimativa',
      formula: 'preço − (custo + comissão + imposto + taxa fixa + embalagem + ads + afiliado + devolução) = contribuição; − custo fixo rateado = margem líquida ESTIMADA',
      aviso: 'estimativa por regras — não é lucro real conciliado',
    };
  }

  /* contribuição de uma LISTA de SKUs (com unidades vendidas) para o ponto de equilíbrio */
  function contribuicaoCarteira(itens) {
    const linhas = (itens || []).map(it => {
      const c = contribuicaoSku(it);
      const unidades = it.unidades30d || it.unidades || 0;
      return { sku: it.sku, produto: it.produto, marketplace: it.marketplace, unidades,
        contribuicaoUnidade: c.contribuicaoUnidade, contribuicaoTotal: c.contribuicaoUnidade != null ? round2(c.contribuicaoUnidade * unidades) : null,
        margemContribuicaoPct: c.margemContribuicaoPct, margemLiquidaEstimada: c.margemLiquidaEstimada, classe: c.classe, cobertura: c.cobertura };
    });
    const validos = linhas.filter(l => l.contribuicaoTotal != null);
    const totalContribuicao = round2(validos.reduce((a, l) => a + l.contribuicaoTotal, 0));
    const ajudam = validos.filter(l => l.contribuicaoTotal > 0).sort((a, b) => b.contribuicaoTotal - a.contribuicaoTotal);
    /* contribuição < 0 realmente consome o resultado; contribuição = 0 é sem giro no período (não é vazamento) */
    const prejudicam = validos.filter(l => l.contribuicaoTotal < 0).sort((a, b) => a.contribuicaoTotal - b.contribuicaoTotal);
    const semGiro = validos.filter(l => l.contribuicaoTotal === 0);
    return { linhas, totalContribuicao, ajudam, prejudicam, semGiro,
      topContribuintes: ajudam.slice(0, 5),
      nota: 'contribuição = margem de contribuição × unidades; contribuição negativa vende mas consome o resultado; contribuição zero é SKU sem giro no período (não é vazamento).' };
  }

  /* PROJEÇÃO do ponto de equilíbrio no mês: % atingido, ritmo, data projetada, cenários. */
  function projecaoEquilibrio(be, ctx) {
    ctx = ctx || {};
    if (!be || be.insuficiente || be.faturamentoBE == null) return { insuficiente: true, mensagem: (be && be.mensagem) || 'sem ponto de equilíbrio calculável' };
    const realizado = (be.realizado && be.realizado.faturamento) || 0;
    const meta = be.faturamentoBE;
    const pct = round2(Math.min(100, meta ? (realizado / meta) * 100 : 0));
    const diaAtual = ctx.diaAtual || null, diasNoMes = ctx.diasNoMes || 30;
    const ritmoDia = diaAtual ? round2(realizado / diaAtual) : null; /* faturamento médio/dia até agora */
    const projFimMes = ritmoDia != null ? round2(ritmoDia * diasNoMes) : null;
    const diasParaBE = ritmoDia && ritmoDia > 0 ? Math.ceil(Math.max(0, meta - realizado) / ritmoDia) : null;
    const diaProjetadoBE = diaAtual && diasParaBE != null ? diaAtual + diasParaBE : null;
    const falta = round2(Math.max(0, meta - realizado));
    /* avançando ou afastando: ritmo atual bate a média necessária? */
    const mediaNecessariaDia = diasNoMes && diaAtual ? round2(meta / diasNoMes) : null;
    const tendencia = (ritmoDia != null && mediaNecessariaDia != null)
      ? (ritmoDia >= mediaNecessariaDia ? 'AVANÇANDO' : 'AFASTANDO') : 'SEM_TENDENCIA';
    return {
      metaFaturamento: meta, realizado, pctAtingido: pct, atingido: realizado >= meta, falta,
      ritmoDia, projecaoFimMes: projFimMes, diasParaBE, diaProjetadoBE, atingeNoMes: diaProjetadoBE != null && diaProjetadoBE <= diasNoMes,
      tendencia, mediaNecessariaDia,
      cenarios: {
        pessimista: ritmoDia != null ? round2(projFimMes * 0.85) : null,
        atual: projFimMes,
        otimista: ritmoDia != null ? round2(projFimMes * 1.15) : null,
      },
      nota: tendencia === 'AFASTANDO' ? 'o ritmo atual não atinge o ponto de equilíbrio no mês — precisa acelerar vendas com margem.'
        : tendencia === 'AVANÇANDO' ? 'no ritmo atual, a operação tende a cobrir a estrutura dentro do mês.' : 'sem dias corridos suficientes para projetar.',
    };
  }

  /* PERDAS E VAZAMENTOS: agrega perdas declaradas (devolução, reembolso, ads sem retorno,
     estoque parado…). Recebe já os números observados — nunca inventa valor. */
  const TIPOS_PERDA = ['Devoluções', 'Reembolsos', 'Frete de retorno', 'Produto perdido/danificado', 'Cancelamentos',
    'Ads sem retorno', 'Afiliado sem margem', 'Estoque parado', 'Ruptura', 'Desconto excessivo', 'Taxa excessiva', 'Custo não previsto'];
  function perdas(itens) {
    const linhas = (itens || []).filter(x => x && x.valor != null && x.valor > 0);
    const total = round2(linhas.reduce((a, l) => a + l.valor, 0));
    const porTipo = {};
    for (const l of linhas) porTipo[l.tipo] = round2((porTipo[l.tipo] || 0) + l.valor);
    const ordenadas = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, valor]) => ({ tipo, valor, pct: total ? round2((valor / total) * 100) : 0 }));
    return { total, porTipo: ordenadas, itens: linhas.sort((a, b) => b.valor - a.valor),
      maiorVazamento: ordenadas[0] || null,
      nota: 'cada perda tem origem, produto/SKU e período — vira diagnóstico, risco ou missão na Inteligência.' };
  }

  return { FAIXAS_EXEMPLO, NIVEIS, ROTULO, TIPOS_PERDA, round2,
    taxaPorFaixa, resolverTaxaFixa, contribuicaoSku, contribuicaoCarteira, projecaoEquilibrio, perdas };
}));

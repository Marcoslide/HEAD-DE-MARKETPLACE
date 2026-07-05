/* =============================================================
   v8 · CENTRO DE CUSTOS (10.E.4)
   Custo, margem, preço e ponto de equilíbrio — separados do
   cadastro de empresa. Nenhuma taxa inventada, nenhuma margem sem
   fórmula, nenhum número sem fonte e regra. Custo fixo só entra
   com regra de rateio explicada. Estimativa NUNCA vira lucro real.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const CC = window.CUSTOS = { sub: 'Visão Financeira', empresaId: 'e1', simProd: 'p1' };
  const SUBS = ['Visão Financeira', 'Ponto de Equilíbrio', 'Rentabilidade por SKU', 'Taxas por Faixa', 'Perdas e Vazamentos',
    'Custos Fixos', 'Custos Variáveis', 'Taxas de Marketplace', 'Ads, Cupons e Afiliados',
    'Regras de Rateio', 'Economia por Produto', 'Margem por Canal', 'Simulador de Preço',
    'Histórico de Regras', 'Fontes e Cobertura'];
  const biz = () => window.bizState();
  const papel = () => (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
  const brl = v => v == null ? '—' : UI.brl(v);

  /* vendas do escopo: pedidos IMPORTADOS têm prioridade; senão, demo rotulado */
  function vendasDoEscopo() {
    if (window.IMPORTAR) {
      const st = V8IMP.orderStats(IMPORTAR.eng, {});
      if (!st.semDados) return { faturamento: st.kpis.faturamentoAprovado, pedidosPagos: st.kpis.pedidos - st.kpis.naoPagos - st.kpis.cancelados,
        unidades: st.kpis.unidades, fonte: 'pedidos importados (' + st.fontes[st.fontes.length - 1].arquivo + ')', periodo: 'período dos arquivos importados', real: true };
    }
    const lojas = (D.scope.lojas || []).filter(l => (D.scope.cnpjs.find(c => c.id === l.cnpjId) || {}).empresaId === CC.empresaId);
    let fat = 0, ped = 0;
    for (const l of lojas) { const p = (D.lojaPerf[l.id] || {})['30d']; if (p) { fat += p.faturamento; ped += p.aprovados; } }
    return { faturamento: Math.round(fat * 100) / 100, pedidosPagos: ped, unidades: null, fonte: D.STATUS.DADO_SIMULADO + ' · rotulado (lojaPerf 30d)', periodo: 'últimos 30 dias', real: false };
  }

  function render(sub) {
    if (sub && SUBS.includes(sub)) CC.sub = sub;
    const B = biz();
    UI.$('#v-custos').innerHTML = `
      <div class="eyebrow">centro de custos · custo real, margem com fórmula e ponto de equilíbrio</div>
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px"><h1 class="h1">Centro de Custos</h1>
        <p class="sub" style="margin-top:6px">Todo número mostra <b>fonte, regra usada, período e cobertura</b>. Estimativa nunca aparece como lucro real — sem conciliação, o nome é <b>margem líquida estimada</b>.</p></div>
        <select class="select" data-act="ccemp" title="Empresa do Centro de Custos">${V8BIZ.empresasVisiveis(B).map(e => `<option value="${e.id}" ${e.id === CC.empresaId ? 'selected' : ''}>${UI.esc(e.nome)}</option>`).join('')}</select>
      </div>
      <div class="tabs" style="margin-top:14px;flex-wrap:wrap">${SUBS.map(s => `<button class="tab ${s === CC.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}</button>`).join('')}</div>
      <div id="ccBody" style="margin-top:14px"></div>`;
    body();
    const v = UI.$('#v-custos');
    v.onclick = onClick;
    v.onchange = e => { const s = e.target.closest('[data-act]'); if (!s) return;
      if (s.dataset.act === 'ccemp') { CC.empresaId = s.value; body(); }
      else if (s.dataset.act === 'ecoprod') { CC.simProd = s.value; body(); } };
  }

  function body() {
    const el = UI.$('#ccBody');
    if (CC.sub === 'Visão Financeira') el.innerHTML = visao();
    else if (CC.sub === 'Custos Fixos') el.innerHTML = fixos();
    else if (CC.sub === 'Custos Variáveis') el.innerHTML = variaveis();
    else if (CC.sub === 'Taxas de Marketplace') el.innerHTML = taxas();
    else if (CC.sub === 'Ads, Cupons e Afiliados') el.innerHTML = ads();
    else if (CC.sub === 'Regras de Rateio') el.innerHTML = rateios();
    else if (CC.sub === 'Economia por Produto') el.innerHTML = economia();
    else if (CC.sub === 'Margem por Canal') el.innerHTML = margemCanal();
    else if (CC.sub === 'Ponto de Equilíbrio') el.innerHTML = pontoEquilibrio() + projecaoBE();
    else if (CC.sub === 'Rentabilidade por SKU') el.innerHTML = rentabilidadeSku();
    else if (CC.sub === 'Taxas por Faixa') el.innerHTML = taxasPorFaixa();
    else if (CC.sub === 'Perdas e Vazamentos') el.innerHTML = perdasVazamentos();
    else if (CC.sub === 'Simulador de Preço') el.innerHTML = simulador();
    else if (CC.sub === 'Histórico de Regras') el.innerHTML = historicoRegras();
    else el.innerHTML = fontesCobertura();
    UI.refreshBadges();
  }

  /* ---------- Visão Financeira ---------- */
  function visao() {
    const v = vendasDoEscopo();
    const vf = V8BIZ.visaoFinanceira(biz(), { empresaId: CC.empresaId, vendas: v, diasRestantes: 10 });
    const be = vf.breakEven;
    const kpi = (k, val, extra) => `<div class="mesa-kpi ${val == null ? 'nodata' : ''}" title="${UI.esc(extra || '')}">
      <span class="k">${k}</span><span class="v">${val == null ? 'SEM DADOS' : val}</span><span class="f">${UI.esc((extra || '').split('·')[0])}</span></div>`;
    return `
      <div class="callout" style="margin-top:0"><b>${UI.esc(vf.aviso)}.</b> Vendas: ${UI.esc(vf.origemDados.vendas)} · custos: ${UI.esc(vf.origemDados.custos)} · ${UI.esc(vf.origemDados.regras)} · período: ${UI.esc(vf.periodo)}.</div>
      <div class="mesa-grid" style="margin-top:12px">
        ${kpi('Faturamento bruto', brl(vf.faturamentoBruto), 'fonte: ' + v.fonte)}
        ${kpi('Pedidos pagos', vf.pedidosPagos, 'fonte: ' + v.fonte)}
        ${kpi('Receita líquida estimada', brl(vf.receitaLiquidaEstimada), 'faturamento − custo variável estimado')}
        ${kpi('Custo variável estimado', brl(vf.custoVariavelEstimado), vf.regrasUsadas.join(' · ') || 'sem regra variável cadastrada')}
        ${kpi('Custo fixo total', brl(vf.custoFixoTotal), 'cadastro manual · mensal normalizado')}
        ${kpi('Custo fixo absorvido', brl(vf.custoFixoAbsorvido), vf.rateio.explicacao || '')}
        ${kpi('Margem de contribuição', vf.margemContribuicao != null ? brl(vf.margemContribuicao) + ' (' + vf.margemContribuicaoPct + '%)' : null, '(faturamento − variáveis) ÷ faturamento')}
        ${kpi('Margem líquida estimada', brl(vf.margemLiquidaEstimada), 'contribuição − custo fixo · ESTIMADA')}
        ${kpi('Lucro operacional estimado', brl(vf.lucroOperacionalEstimado), 'nunca chamado de lucro real sem conciliação')}
        ${be.insuficiente ? kpi('Ponto de equilíbrio', null, be.mensagem + ' · falta: ' + be.faltando.join(', '))
          : kpi('PE em faturamento', brl(be.faturamentoBE), be.formulaFaturamento) +
            kpi('PE em pedidos', be.pedidosBE ?? null, be.formulaPedidos || 'sem margem por pedido') +
            kpi('Falta faturar', brl(be.faltaFaturamento), 'para empatar no período') +
            kpi('Faltam pedidos', be.faltaPedidos ?? null, 'pedidos pagos até o equilíbrio') +
            kpi('Média diária necessária', brl(be.mediaDiariaNecessaria), (be.diasRestantes || '—') + ' dia(s) restante(s)')}
      </div>
      <p class="src" style="margin-top:8px">cobertura: ${UI.esc(vf.cobertura)} · empresa: ${UI.esc((biz().empresas.find(e => e.id === CC.empresaId) || {}).nome)} · canal: ${vf.canalId}</p>`;
  }

  /* ---------- Custos Fixos ---------- */
  function fixos() {
    const list = biz().custosFixos.filter(c => c.empresaId === CC.empresaId);
    return `
      <div class="fbar" style="margin-top:0"><button class="btn sm primary" data-act="addfixo">Adicionar Custo Fixo</button>
        <span class="src">custo fixo NÃO entra sozinho no produto — precisa de regra de rateio</span></div>
      ${list.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Custo</th><th class="nosort">Categoria</th><th class="nosort">Valor</th><th class="nosort">Periodicidade</th>
        <th class="nosort">Mensalizado</th><th class="nosort">Vigência</th><th class="nosort">Rateio</th><th class="nosort">Status</th><th class="nosort"></th></tr></thead><tbody>
      ${list.map(c => `<tr ${c.fimVigencia ? 'style="opacity:.55"' : ''}>
        <td><span class="tmain">${UI.esc(c.nome)}</span><span class="tsub">fonte: ${UI.esc(c.fonte)}</span></td>
        <td><span class="src">${UI.esc(c.categoria)}</span></td><td>${brl(+c.valor)}</td><td>${UI.esc(c.periodicidade)}</td>
        <td>${brl(c.valorMensal)}</td>
        <td><span class="src">${c.inicioVigencia}${c.fimVigencia ? ' → ' + c.fimVigencia : ' → vigente'}</span></td>
        <td><span class="src">${UI.esc(c.criterioRateio || 'regra global da empresa')}</span></td>
        <td>${UI.stBadge(c.status === 'Ativo' ? 'ATIVO' : c.status)}</td>
        <td><span class="rowact">${!c.fimVigencia ? `<button class="btn sm ghost" data-act="editfixo" data-id="${c.id}">nova vigência</button>` : ''}</span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>alterar valor cria NOVA vigência — o passado nunca é reescrito</span></div></div>`
      : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum custo fixo</b>Aluguel, salários, energia, sistemas… cadastre para calcular ponto de equilíbrio.</div></div>'}`;
  }

  /* ---------- Custos Variáveis ---------- */
  function variaveis() {
    const list = biz().custosVariaveis.filter(c => !c.empresaId || c.empresaId === CC.empresaId);
    return `
      <div class="fbar" style="margin-top:0"><button class="btn sm primary" data-act="addvar">Adicionar Custo Variável</button>
        <span class="src">cada custo declara a base de cálculo: por pedido, unidade, faturamento, SKU…</span></div>
      ${list.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Custo</th><th class="nosort">Categoria</th><th class="nosort">Valor</th><th class="nosort">Base</th>
        <th class="nosort">Escopo</th><th class="nosort">Vigência</th><th class="nosort">Status</th></tr></thead><tbody>
      ${list.map(c => `<tr ${c.fimVigencia ? 'style="opacity:.55"' : ''}>
        <td><span class="tmain">${UI.esc(c.nome)}</span><span class="tsub">fonte: ${UI.esc(c.fonte)}</span></td>
        <td><span class="src">${UI.esc(c.categoria)}</span></td>
        <td>${c.percentual != null ? c.percentual + '%' : brl(c.valorFixo)}</td>
        <td><span class="kbd">${UI.esc(c.base)}</span></td>
        <td><span class="src">${UI.esc(c.sku || c.produtoId || c.marketplace || 'empresa toda')}</span></td>
        <td><span class="src">${c.inicioVigencia}${c.fimVigencia ? ' → ' + c.fimVigencia : ''}</span></td>
        <td>${UI.stBadge(c.status === 'Ativo' ? 'ATIVO' : c.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum custo variável</b>Embalagem, frete de entrada, devolução, personalização…</div></div>'}`;
  }

  /* ---------- Taxas ---------- */
  function taxas() {
    const list = biz().taxas.filter(t => t.empresaId === CC.empresaId);
    return `
      <div class="fbar" style="margin-top:0"><button class="btn sm primary" data-act="addtaxa">Adicionar Taxa</button>
        <span class="src">prioridade: SKU → Produto → Categoria → Conta → Canal → Empresa → Marketplace padrão — o cálculo sempre diz qual regra usou</span></div>
      ${list.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Tipo</th><th class="nosort">Marketplace</th><th class="nosort">Valor</th><th class="nosort">Nível</th>
        <th class="nosort">Vigência</th><th class="nosort">Fonte</th><th class="nosort">Status</th></tr></thead><tbody>
      ${list.map(t => `<tr ${t.fimVigencia ? 'style="opacity:.55"' : ''}>
        <td class="tmain">${UI.esc(t.tipo)}</td><td>${UI.esc(t.marketplace)}</td>
        <td>${t.percentual != null ? t.percentual + '%' : brl(t.valorFixo)}</td>
        <td><span class="src">${UI.esc(t.sku ? 'SKU ' + t.sku : t.produtoId ? 'produto' : t.categoria ? 'categoria' : t.contaId ? 'conta' : t.canalId ? 'canal' : 'empresa/padrão')}</span></td>
        <td><span class="src">${t.inicioVigencia}${t.fimVigencia ? ' → ' + t.fimVigencia : ''}</span></td>
        <td><span class="src">${UI.esc(t.fonte)}</span></td>
        <td>${UI.stBadge(t.status === 'Ativo' ? 'ATIVO' : t.status)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhuma taxa cadastrada</b>Sem taxa cadastrada o cálculo declara a ausência — o sistema nunca inventa taxa.</div></div>'}`;
  }

  /* ---------- Ads/Cupons/Afiliados ---------- */
  function ads() {
    const list = biz().adsRegras;
    const temImportado = window.IMPORTAR && IMPORTAR.eng.snapshots.some(s => s.metric_type === 'afiliados');
    return `
      <div class="callout" style="margin-top:0"><b>Dado importado real tem prioridade sobre estimativa manual</b> (período e escopo compatíveis). ${temImportado ? 'Há planilha de afiliados importada — ela vence as regras manuais no cálculo.' : 'Sem planilha importada, valem as estimativas manuais, sempre rotuladas.'}</div>
      <div class="fbar" style="margin-top:10px"><button class="btn sm primary" data-act="addads">Adicionar regra (Ads / cupom / afiliado)</button></div>
      ${list.length ? list.map(r => `<div class="metric-row"><span class="lbl"><b>${UI.esc(r.tipo)}</b> <span class="src">· ${UI.esc(r.marketplace || 'todos')} · ${UI.esc(r.fonte)}</span></span>
        <span class="val">${r.percentual != null ? r.percentual + '%' : brl(r.valor)}</span></div>`).join('') : '<p class="src" style="margin-top:8px">nenhuma regra manual — importe a planilha de afiliados ou cadastre estimativas.</p>'}`;
  }

  /* ---------- Rateio ---------- */
  function rateios() {
    const B = biz();
    const list = B.rateios.filter(r => r.empresaId === CC.empresaId);
    const v = vendasDoEscopo();
    const demo = V8BIZ.calcularRateio(B, { empresaId: CC.empresaId, base: { pedidosPagos: v.pedidosPagos, faturamento: v.faturamento, unidades: v.unidades }, fonteBase: v.fonte, periodo: v.periodo });
    return `
      <div class="fbar" style="margin-top:0"><button class="btn sm primary" data-act="addrateio">Criar Regra de Rateio</button>
        <span class="src">métodos: ${V8BIZ.METODOS_RATEIO.slice(0, 4).join(' · ')}…</span></div>
      ${list.length ? list.map(r => `<div class="metric-row"><span class="lbl"><b>${UI.esc(r.nome)}</b> <span class="src">· ${UI.esc(r.metodo)} · ${r.inicioVigencia}${r.fimVigencia ? ' → ' + r.fimVigencia : ''}</span></span>
        <span class="val">${r.fimVigencia ? '<span class="st plain">ENCERRADA</span>' : '<span class="st pos plain">VIGENTE</span>'}
        ${!r.fimVigencia ? `<button class="linklike" data-act="editrateio" data-id="${r.id}" style="margin-left:8px">nova vigência</button>` : ''}</span></div>`).join('')
      : '<p class="src" style="margin-top:8px">sem regra de rateio — o custo fixo NÃO é jogado automaticamente nos produtos.</p>'}
      <div class="panel" style="margin-top:12px"><div class="sect-h" style="margin-top:0"><span class="h2">Cálculo com a regra vigente</span><span class="src">explicado, nunca mágico</span></div>
        <p class="sub">${UI.esc(demo.explicacao)}</p>
        ${demo.porPedido != null ? `<div class="metric-row"><span class="lbl">Custo fixo por pedido</span><span class="val">${brl(demo.porPedido)}</span></div>` : ''}
        ${demo.percentualSobreFaturamento != null ? `<div class="metric-row"><span class="lbl">Custo fixo sobre faturamento</span><span class="val">${demo.percentualSobreFaturamento}%</span></div>` : ''}
        <p class="src" style="margin-top:6px">base: ${UI.esc(demo.baseUtilizada || '—')} · fonte da base: ${UI.esc(demo.fonteBase || '—')} · período: ${UI.esc(demo.periodo || '—')} · confiança: ${UI.esc(demo.confianca || '—')}</p>
      </div>`;
  }

  /* ---------- Economia por Produto ---------- */
  function economia() {
    const B = biz();
    const prods = UI.state.products;
    const p = prods.find(x => x.id === CC.simProd) || prods[0];
    const v = vendasDoEscopo();
    const eco = V8BIZ.economiaProduto(B, { produtoId: p.id, sku: p.sku, marketplace: 'shopee', empresaId: CC.empresaId,
      categoria: p.categoria, preco: p.mkt.shopee.preco || p.precoBase,
      base: { pedidosPagos: v.pedidosPagos, faturamento: v.faturamento, faturamentoItem: Math.round((v.faturamento || 0) * 0.05), unidadesItem: 40 }, fonteBase: v.fonte, periodo: v.periodo });
    return `
      <div class="fbar" style="margin-top:0">
        <select class="select" data-act="ecoprod">${prods.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${UI.esc(x.nome)} (${x.sku})</option>`).join('')}</select>
        <button class="btn sm primary" data-act="editcusto" data-id="${p.id}">Editar custo do produto</button>
        <span class="src">também disponível no editor do anúncio (Catálogo → Economia do Produto)</span></div>
      ${eco.coberturaInsuficiente ? `<div class="callout" style="margin-top:10px;border-left-color:var(--warn)"><b>Cobertura insuficiente.</b> Falta: ${eco.faltando.map(UI.esc).join(' · ')} — nada é estimado sem base.</div>` : ''}
      <div class="panel" style="margin-top:10px"><div class="sect-h" style="margin-top:0"><span class="h2">Fórmula visível · ${UI.esc(p.nome)}</span></div>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Item</th><th class="nosort">Valor</th><th class="nosort">Fonte</th><th class="nosort">Regra aplicada</th><th class="nosort">Tipo</th></tr></thead><tbody>
        ${eco.linhas.map(l => `<tr><td class="tmain">${UI.esc(l.item)}</td>
          <td>${l.valor != null ? brl(l.valor) : '<span class="src">SEM DADOS</span>'}</td>
          <td><span class="src">${UI.esc(l.fonte)}</span></td>
          <td><span class="src" style="white-space:normal">${UI.esc((l.regra || '—').slice(0, 90))}</span></td>
          <td>${l.estimado ? '<span class="st warn plain">ESTIMADO</span>' : '<span class="st pos plain">CADASTRADO</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:6px">${UI.esc(eco.formula)}</p>
        <div class="mesa-grid" style="margin-top:10px">
          <div class="mesa-kpi"><span class="k">Margem de contribuição</span><span class="v">${eco.margemContribuicao != null ? brl(eco.margemContribuicao) + ' (' + eco.margemContribuicaoPct + '%)' : 'SEM DADOS'}</span><span class="f">preço − variáveis</span></div>
          <div class="mesa-kpi"><span class="k">Margem líquida estimada</span><span class="v">${eco.margemLiquidaEstimada != null ? brl(eco.margemLiquidaEstimada) + ' (' + eco.margemLiquidaEstimadaPct + '%)' : 'SEM DADOS'}</span><span class="f">${UI.esc(eco.aviso)}</span></div>
          <div class="mesa-kpi"><span class="k">Preço mínimo seguro</span><span class="v">${brl(eco.precoMinimoSeguro)}</span><span class="f">custo + taxas + margem mínima</span></div>
          <div class="mesa-kpi"><span class="k">Preço recomendado</span><span class="v">${brl(eco.precoRecomendado)}</span><span class="f">mínimo seguro × 1,25</span></div>
        </div>
        <p class="src" style="margin-top:6px">cobertura: ${UI.esc(eco.cobertura)}</p>
      </div>`;
  }

  /* ---------- Margem por Canal ---------- */
  function margemCanal() {
    const B = biz();
    const canais = B.canais.filter(c => c.empresaId === CC.empresaId && c.status === 'Ativo');
    const fixoTotal = B.custosFixos.filter(c => c.status === 'Ativo' && c.empresaId === CC.empresaId).reduce((a, c) => a + c.valorMensal, 0);
    const fatTotal = canais.reduce((a, c) => a + (((D.lojaPerf[c.scopeLojaId || c.id] || {})['30d'] || {}).faturamento || 0), 0);
    return `
      <div class="callout" style="margin-top:0">Qual canal vende mais, qual deixa margem, qual consome desconto e qual precisa de volume para se pagar. Fonte de vendas: ${fatTotal ? UI.esc(D.STATUS.DADO_SIMULADO) + ' · rotulado (lojaPerf 30d)' : 'SEM DADOS'} · custo fixo rateado por participação no faturamento.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Canal</th><th class="nosort">Faturamento</th><th class="nosort">Pedidos pagos</th><th class="nosort">Comissão est.</th>
        <th class="nosort">Variáveis est.</th><th class="nosort">Fixo rateado</th><th class="nosort">Margem contribuição</th><th class="nosort">Margem líquida est.</th><th class="nosort">PE do canal</th></tr></thead><tbody>
      ${canais.map(c => {
        const perf = (D.lojaPerf[c.scopeLojaId || c.id] || {})['30d'];
        if (!perf) return `<tr><td class="tmain">${UI.esc(c.nome)}</td><td colspan="8"><span class="src">${UI.esc(D.STATUS.SEM_DADOS)} — sem vendas registradas; nada estimado</span></td></tr>`;
        const tx = V8BIZ.taxaAplicavel(B, 'Comissão percentual', { marketplace: c.marketplace, empresaId: CC.empresaId, canalId: c.id });
        const comissao = tx.taxa ? perf.faturamento * tx.taxa.percentual / 100 : null;
        const varsPed = B.custosVariaveis.filter(x => x.status === 'Ativo' && x.base === 'Por pedido' && x.valorFixo != null).reduce((a, x) => a + x.valorFixo, 0) * perf.aprovados;
        const fixoCanal = fatTotal ? fixoTotal * perf.faturamento / fatTotal : null;
        const mc = comissao != null ? perf.faturamento - comissao - varsPed : null;
        const ml = mc != null && fixoCanal != null ? mc - fixoCanal : null;
        const pe = mc != null && mc > 0 && fixoCanal != null ? Math.round(fixoCanal / (mc / perf.faturamento)) : null;
        return `<tr>
          <td><span class="tmain">${UI.esc(c.nome)}</span><span class="tsub">${UI.esc(c.tipo)}</span></td>
          <td>${brl(perf.faturamento)}</td><td>${perf.aprovados}</td>
          <td>${comissao != null ? brl(Math.round(comissao * 100) / 100) + `<span class="tsub">${UI.esc(tx.nivel)}</span>` : '<span class="src">sem taxa cadastrada</span>'}</td>
          <td>${brl(Math.round(varsPed * 100) / 100)}</td>
          <td>${fixoCanal != null ? brl(Math.round(fixoCanal * 100) / 100) : '—'}<span class="tsub">participação no faturamento</span></td>
          <td>${mc != null ? brl(Math.round(mc * 100) / 100) : '<span class="src">SEM DADOS</span>'}</td>
          <td>${ml != null ? brl(Math.round(ml * 100) / 100) : '<span class="src">SEM DADOS</span>'}</td>
          <td>${pe != null ? brl(pe) + '<span class="tsub">faturamento p/ se pagar</span>' : '—'}</td></tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>comissão via regra de taxa (nível declarado) · margem líquida ESTIMADA — nunca lucro real sem conciliação</span></div></div>`;
  }

  /* ---------- Ponto de Equilíbrio ---------- */
  function pontoEquilibrio() {
    const v = vendasDoEscopo();
    const vf = V8BIZ.visaoFinanceira(biz(), { empresaId: CC.empresaId, vendas: v, diasRestantes: 10 });
    const be = vf.breakEven;
    if (be.insuficiente) return `<div class="panel"><div class="empty"><b>Dados insuficientes para calcular ponto de equilíbrio.</b>
      Falta: ${be.faltando.map(UI.esc).join(' · ')}. Cadastre em Custos Fixos e Regras de Rateio — nada será estimado sem base.</div></div>`;
    return `
      <div class="mesa-grid">
        <div class="mesa-kpi"><span class="k">PE em faturamento</span><span class="v">${brl(be.faturamentoBE)}</span><span class="f">${UI.esc(be.formulaFaturamento)}</span></div>
        ${be.pedidosBE != null ? `<div class="mesa-kpi"><span class="k">PE em pedidos pagos</span><span class="v">${be.pedidosBE}</span><span class="f">${UI.esc(be.formulaPedidos)}</span></div>` : ''}
        <div class="mesa-kpi"><span class="k">Realizado</span><span class="v">${brl(be.realizado.faturamento)}</span><span class="f">${be.realizado.pedidosPagos} pedidos · fonte: ${UI.esc(v.fonte)}</span></div>
        <div class="mesa-kpi ${be.atingido ? '' : 'nodata'}"><span class="k">Falta para empatar</span><span class="v">${be.atingido ? 'ATINGIDO ✓' : brl(be.faltaFaturamento)}</span><span class="f">${be.faltaPedidos != null ? be.faltaPedidos + ' pedido(s)' : ''}</span></div>
        ${be.mediaDiariaNecessaria != null ? `<div class="mesa-kpi"><span class="k">Média diária necessária</span><span class="v">${brl(be.mediaDiariaNecessaria)}</span><span class="f">${be.diasRestantes} dia(s) restante(s)</span></div>` : ''}
      </div>
      <p class="src" style="margin-top:8px">custos fixos: ${brl(be.custoFixoTotal)}/mês (cadastro manual) · margem de contribuição: ${vf.margemContribuicaoPct}% (${UI.esc(vf.origemDados.regras)}) · período: ${UI.esc(v.periodo)}</p>`;
  }

  /* ---------- 10.P.3 · projeção do ponto de equilíbrio (V8LUCRO) ---------- */
  function projecaoBE() {
    if (typeof V8LUCRO === 'undefined') return '';
    const v = vendasDoEscopo();
    const vf = V8BIZ.visaoFinanceira(biz(), { empresaId: CC.empresaId, vendas: v, diasRestantes: 10 });
    const be = vf.breakEven;
    if (be.insuficiente) return '';
    const proj = V8LUCRO.projecaoEquilibrio({ custoFixoTotal: be.custoFixoTotal, faturamentoBE: be.faturamentoBE, realizado: be.realizado }, { diaAtual: 20, diasNoMes: 30 });
    if (proj.insuficiente) return '';
    const tbadge = proj.tendencia === 'AVANÇANDO' ? 'ok' : proj.tendencia === 'AFASTANDO' ? 'danger' : 'plain';
    return `<div class="panel" style="margin-top:12px">
      <div class="sect-h" style="margin-top:0"><span class="h2">Projeção do ponto de equilíbrio</span><span class="st ${tbadge} plain">${UI.esc(proj.tendencia)}</span></div>
      <div class="mesa-grid" style="margin-top:8px">
        <div class="mesa-kpi"><span class="k">Atingido</span><span class="v">${proj.pctAtingido}%</span><span class="f">${brl(proj.realizado)} de ${brl(proj.metaFaturamento)}</span></div>
        <div class="mesa-kpi"><span class="k">Ritmo atual</span><span class="v">${brl(proj.ritmoDia)}/dia</span><span class="f">necessário: ${brl(proj.mediaNecessariaDia)}/dia</span></div>
        <div class="mesa-kpi ${proj.atingeNoMes ? '' : 'nodata'}"><span class="k">Projeção de atingir</span><span class="v">${proj.diaProjetadoBE ? 'dia ' + proj.diaProjetadoBE : '—'}</span><span class="f">${proj.atingeNoMes ? 'dentro do mês' : 'fora do mês no ritmo atual'}</span></div>
        <div class="mesa-kpi"><span class="k">Projeção fim do mês</span><span class="v">${brl(proj.projecaoFimMes)}</span><span class="f">pess. ${brl(proj.cenarios.pessimista)} · otim. ${brl(proj.cenarios.otimista)}</span></div>
      </div>
      <p class="src" style="margin-top:8px">${UI.esc(proj.nota)}</p>`
      + contribuicaoCard();
  }
  function skusDoEscopo() {
    if (typeof V8CAT === 'undefined' || !window.CATALOGO) return [];
    const cat = CATALOGO.eng();
    return V8CAT.ativos(cat).slice(0, 40).map(l => {
      const p = cat.products.find(x => x.id === l.produtoId) || {};
      const preco = V8CAT.valorDe(cat, l, 'preco') || p.precoBase || 0;
      const faixa = V8LUCRO.resolverTaxaFixa([{ nivel: 'global', escopo: {}, faixas: V8LUCRO.FAIXAS_EXEMPLO }], { preco });
      return { sku: l.skuPai, produto: p.nome, marketplace: l.mktNome, preco,
        custoProduto: p.custo != null ? p.custo : null, comissaoPct: 14, impostoPct: 7,
        taxaFixa: faixa.valor, embalagem: 4, adsRateado: 0, fixoRateado: 2,
        unidades30d: (l.perf && l.perf.vendidos30d) || 0, margemMinimaPct: 15 };
    });
  }
  function contribuicaoCard() {
    const cart = V8LUCRO.contribuicaoCarteira(skusDoEscopo());
    if (!cart.linhas.length) return '';
    return `<div class="panel" style="margin-top:12px">
      <div class="sect-h" style="margin-top:0"><span class="h2">Quem ajuda a pagar a estrutura × quem consome</span><span class="src">contribuição = margem × unidades</span></div>
      <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">SKU</th><th class="nosort">Contribuição total</th><th class="nosort">Margem contrib.</th><th class="nosort">Classe</th></tr></thead><tbody>
        ${cart.ajudam.slice(0, 5).map(l => `<tr><td class="tmain">${UI.esc(l.sku)}</td><td>${brl(l.contribuicaoTotal)}</td><td>${l.margemContribuicaoPct ?? '—'}%</td><td><span class="st ok plain">${UI.esc(l.classe)}</span></td></tr>`).join('')}
        ${cart.prejudicam.slice(0, 4).map(l => `<tr><td class="tmain">${UI.esc(l.sku)}</td><td><span class="num crit">${brl(l.contribuicaoTotal)}</span></td><td>${l.margemContribuicaoPct ?? '—'}%</td><td><span class="st danger plain">${UI.esc(l.classe)}</span></td></tr>`).join('')}
        ${(cart.semGiro || []).slice(0, 3).map(l => `<tr><td class="tmain">${UI.esc(l.sku)}</td><td><span class="src">R$ 0,00 · sem giro</span></td><td>${l.margemContribuicaoPct ?? '—'}%</td><td><span class="st plain">${UI.esc(l.classe)}</span></td></tr>`).join('')}
      </tbody></table></div>
      <p class="src" style="margin-top:6px">${UI.esc(cart.nota)}</p></div>`;
  }

  /* ---------- 10.P.3 · Rentabilidade por Produto/SKU ---------- */
  function rentabilidadeSku() {
    if (typeof V8LUCRO === 'undefined') return '<div class="panel"><div class="empty"><b>Motor de lucratividade indisponível</b></div></div>';
    const itens = skusDoEscopo();
    if (!itens.length) return '<div class="panel"><div class="empty"><b>Sem SKUs no escopo</b>Importe cadastro/pedidos para calcular rentabilidade.</div></div>';
    const CLS = { ESCALAR: 'ok', MANTER: 'plain', CORRIGIR: 'danger', REPRECIFICAR: 'warn', PAUSAR: 'danger', INVESTIGAR: 'warn', SEM_DADOS_SUFICIENTES: 'plain' };
    return `<div class="callout" style="margin-top:0">Cada linha mostra a fórmula da margem; sem custo cadastrado, a classe é <b>SEM_DADOS_SUFICIENTES</b> — nunca inventamos lucro.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">SKU · produto</th><th class="nosort">Preço</th><th class="nosort">Taxa (faixa)</th><th class="nosort">Contrib./un.</th><th class="nosort">Margem contrib.</th><th class="nosort">Líquida est.</th><th class="nosort">Un. 30d</th><th class="nosort">Classe</th></tr></thead><tbody>
        ${itens.map(it => { const c = V8LUCRO.contribuicaoSku(it); return `<tr>
          <td class="tmain">${UI.esc(it.sku || '—')}<span class="tsub">${UI.esc((it.produto || '').slice(0, 26))}</span></td>
          <td>${brl(it.preco)}</td><td>${it.taxaFixa != null ? brl(it.taxaFixa) : '<span class="src">—</span>'}</td>
          <td>${c.contribuicaoUnidade != null ? brl(c.contribuicaoUnidade) : '<span class="src">—</span>'}</td>
          <td>${c.margemContribuicaoPct != null ? c.margemContribuicaoPct + '%' : '—'}</td>
          <td>${c.margemLiquidaEstimada != null ? brl(c.margemLiquidaEstimada) : '<span class="src">sem rateio</span>'}</td>
          <td>${it.unidades30d || 0}</td><td><span class="st ${CLS[c.classe] || 'plain'} plain">${UI.esc(c.classe)}</span></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="src" style="margin-top:8px">classificação: ESCALAR / MANTER / CORRIGIR / REPRECIFICAR / INVESTIGAR / SEM_DADOS_SUFICIENTES — nunca PAUSAR sem evidência.</p>`;
  }

  /* ---------- 10.P.3 · Taxas por faixa de preço + hierarquia ---------- */
  function taxasPorFaixa() {
    if (typeof V8LUCRO === 'undefined') return '';
    const faixas = V8LUCRO.FAIXAS_EXEMPLO;
    const exemplos = [49.9, 89.9, 150, 250].map(preco => ({ preco, res: V8LUCRO.taxaPorFaixa(faixas, preco) }));
    return `<div class="callout" style="margin-top:0">A taxa fixa por venda muda por <b>faixa de preço</b>. O sistema olha o preço real e aplica a faixa correta — e declara qual regra venceu (global → marketplace → conta → categoria → produto → SKU → manual).</div>
      <div class="panel" style="margin-top:12px"><div class="sect-h" style="margin-top:0"><span class="h2">Tabela de faixas (exemplo)</span><span class="src">configurável por marketplace/conta/categoria/produto/SKU</span></div>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Faixa de preço</th><th class="nosort">Taxa fixa por item</th></tr></thead><tbody>
          ${faixas.map(f => `<tr><td class="tmain">${brl(f.de)} a ${f.ate === Infinity ? 'acima' : brl(f.ate)}</td><td>${brl(f.taxa)}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div class="panel" style="margin-top:12px"><div class="sect-h" style="margin-top:0"><span class="h2">Aplicação automática por preço</span></div>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Preço do produto</th><th class="nosort">Faixa aplicada</th><th class="nosort">Taxa</th></tr></thead><tbody>
          ${exemplos.map(e => `<tr><td class="tmain">${brl(e.preco)}</td><td>${e.res.faixa ? brl(e.res.faixa.de) + ' a ' + (e.res.faixa.ate === Infinity ? 'acima' : brl(e.res.faixa.ate)) : '<span class="src">fora das faixas</span>'}</td><td>${e.res.valor != null ? brl(e.res.valor) : '<span class="src">—</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:6px">a regra mais específica vence e é declarada; sem regra aplicável, o sistema declara a ausência — nunca inventa taxa.</p></div>`;
  }

  /* ---------- 10.P.3 · Perdas e vazamentos ---------- */
  function perdasVazamentos() {
    if (typeof V8LUCRO === 'undefined') return '';
    const itens = [];
    if (window.IMPORTAR && window.V8IMP) {
      try { const dv = V8IMP.devolucoesView(IMPORTAR.eng, {}); if (!dv.semDados && dv.reembolsoTotal > 0) itens.push({ tipo: 'Reembolsos', valor: dv.reembolsoTotal, origem: 'Devoluções importadas' }); } catch (e) {}
      try { const av = V8IMP.adsView(IMPORTAR.eng, {}); if (!av.semDados && av.totalSpend > (av.totalGmv || 0)) itens.push({ tipo: 'Ads sem retorno', valor: Math.round((av.totalSpend - av.totalGmv) * 100) / 100, origem: 'Ads (investimento acima do GMV atribuído)' }); } catch (e) {}
    }
    const p = V8LUCRO.perdas(itens);
    if (!p.itens.length) return `<div class="panel"><div class="empty"><b>Sem perdas mensuráveis no escopo importado</b>Importe Devoluções e Ads reais — o painel só mostra vazamento com valor de fonte, nunca estimado.</div></div>`;
    return `<div class="mesa-grid">
        <div class="mesa-kpi"><span class="k">Perda total</span><span class="v">${brl(p.total)}</span><span class="f">no escopo importado</span></div>
        <div class="mesa-kpi"><span class="k">Maior vazamento</span><span class="v">${UI.esc(p.maiorVazamento.tipo)}</span><span class="f">${brl(p.maiorVazamento.valor)} · ${p.maiorVazamento.pct}%</span></div>
      </div>
      <div class="panel" style="margin-top:12px"><div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Tipo</th><th class="nosort">Valor</th><th class="nosort">Origem</th></tr></thead><tbody>
        ${p.itens.map(l => `<tr><td class="tmain">${UI.esc(l.tipo)}</td><td><span class="num crit">${brl(l.valor)}</span></td><td><span class="src">${UI.esc(l.origem || '—')}</span></td></tr>`).join('')}
      </tbody></table></div><p class="src" style="margin-top:6px">${UI.esc(p.nota)}</p></div>`;
  }

  /* ---------- Simulador ---------- */
  function simulador() {
    return `
      <div class="callout" style="margin-top:0"><b>Simulação interna</b> — o preço real do anúncio NUNCA é alterado por aqui.</div>
      <div class="panel" style="margin-top:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          <label><span class="eyebrow">Produto</span><br><select class="select" id="simProd" style="width:100%;margin-top:3px">${UI.state.products.map(p => `<option value="${p.id}" ${p.id === CC.simProd ? 'selected' : ''}>${UI.esc(p.sku)}</option>`).join('')}</select></label>
          <label><span class="eyebrow">Marketplace</span><br><select class="select" id="simMkt" style="width:100%;margin-top:3px">${['shopee', 'ml', 'tiktok', 'magalu'].map(m => `<option>${m}</option>`).join('')}</select></label>
          <label><span class="eyebrow">Preço atual (R$)</span><br><input class="input" id="simAtual" style="width:100%;margin-top:3px" value="124.90"></label>
          <label><span class="eyebrow">Novo preço simulado (R$)</span><br><input class="input" id="simNovo" style="width:100%;margin-top:3px" value="139.90"></label>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary sm" data-act="simular">Simular</button></div>
        <div id="simOut" style="margin-top:12px"></div>
      </div>`;
  }

  /* ---------- Histórico de Regras / Fontes ---------- */
  function historicoRegras() {
    const B = biz();
    const encerradas = [...B.custosFixos, ...B.custosVariaveis, ...B.taxas, ...B.rateios].filter(x => x.fimVigencia);
    return `<div class="callout" style="margin-top:0">Regra alterada cria <b>nova vigência</b> — o cálculo histórico continua usando a regra da época.</div>
      ${encerradas.length ? encerradas.map(x => `<div class="metric-row"><span class="lbl"><b>${UI.esc(x.nome || x.tipo || x.id)}</b> <span class="src">· vigência ${x.inicioVigencia} → ${x.fimVigencia}</span></span>
        <span class="val"><span class="st plain">ENCERRADA</span></span></div>`).join('') : '<p class="src" style="margin-top:8px">nenhuma vigência encerrada ainda.</p>'}
      <div class="sect-h"><span class="h2">Auditoria financeira</span></div>
      ${B.audit.filter(a => /custo|taxa|rateio|vigencia|simulacao|ads/.test(a.acao)).slice().reverse().slice(0, 25).map(a => `<div class="exec-li"><span class="sig info"></span>
        <div class="t"><b>${UI.esc(a.acao)}</b><span>${UI.esc(a.detalhe)} · ${a.em} · ${UI.esc(a.usuario)}${a.motivo ? ' · ' + UI.esc(a.motivo) : ''}</span></div></div>`).join('') || '<p class="src">sem eventos.</p>'}`;
  }

  function fontesCobertura() {
    const B = biz();
    const v = vendasDoEscopo();
    return `<div class="panel"><div class="sect-h" style="margin-top:0"><span class="h2">De onde vem cada número</span></div>
      <div class="metric-row"><span class="lbl">Vendas do período</span><span class="val"><span class="src">${UI.esc(v.fonte)} ${v.real ? '<span class="st pos plain">DADO REAL IMPORTADO</span>' : '<span class="st warn plain">DADO SIMULADO</span>'}</span></span></div>
      <div class="metric-row"><span class="lbl">Custos fixos</span><span class="val"><span class="src">${B.custosFixos.length} cadastro(s) manual(is)</span></span></div>
      <div class="metric-row"><span class="lbl">Custos variáveis</span><span class="val"><span class="src">${B.custosVariaveis.length} regra(s) manual(is)</span></span></div>
      <div class="metric-row"><span class="lbl">Taxas de marketplace</span><span class="val"><span class="src">${B.taxas.length} regra(s) — nível declarado em cada cálculo</span></span></div>
      <div class="metric-row"><span class="lbl">Ads/cupons/afiliados</span><span class="val"><span class="src">${B.adsRegras.length} estimativa(s) manual(is)${window.IMPORTAR && IMPORTAR.eng.snapshots.some(s => s.metric_type === 'afiliados') ? ' + planilha importada (PRIORIDADE)' : ''}</span></span></div>
      <div class="metric-row"><span class="lbl">Custo por produto</span><span class="val"><span class="src">${Object.keys(B.produtoCustos).filter(k => !k.startsWith('_hist')).length} produto(s) com custo vigente</span></span></div>
      <p class="src" style="margin-top:8px">estimativas nunca aparecem como lucro real; sem base, o sistema declara cobertura insuficiente.</p></div>`;
  }

  /* ---------- eventos ---------- */
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'sub') { CC.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Centro de Custos · ' + CC.sub; render(CC.sub); }
    else if (act === 'addfixo') formGenerico('Custo Fixo', [['nome', 'Nome *'], ['categoria', 'Categoria * (' + V8BIZ.CATS_FIXO.slice(0, 4).join(', ') + '…)'], ['valor', 'Valor (R$) *'], ['periodicidade', 'Periodicidade * (Mensal/Semanal/Quinzenal/Anual/Única)'], ['criterioRateio', 'Critério de rateio (opcional)']],
      g => V8BIZ.addCustoFixo(biz(), { nome: g.nome, categoria: g.categoria || 'Outros', valor: +g.valor, periodicidade: g.periodicidade || 'Mensal', inicio: D.meta.hoje, empresaId: CC.empresaId, criterioRateio: g.criterioRateio || null }, { usuario: D.meta.usuario, papel: papel() }));
    else if (act === 'addvar') formGenerico('Custo Variável', [['nome', 'Nome *'], ['categoria', 'Categoria * (' + V8BIZ.CATS_VARIAVEL.slice(0, 3).join(', ') + '…)'], ['valorFixo', 'Valor fixo (R$)'], ['percentual', 'OU percentual (%)'], ['base', 'Base * (' + V8BIZ.BASES_CALCULO.slice(0, 4).join(', ') + '…)'], ['sku', 'SKU específico (opcional)']],
      g => V8BIZ.addCustoVariavel(biz(), { nome: g.nome, categoria: g.categoria || 'Outros', valorFixo: g.valorFixo ? +g.valorFixo : null, percentual: g.percentual ? +g.percentual : null, base: g.base || 'Por pedido', empresaId: CC.empresaId, sku: g.sku || null }, { usuario: D.meta.usuario, papel: papel() }));
    else if (act === 'addtaxa') formGenerico('Taxa de Marketplace', [['marketplace', 'Marketplace * (shopee/ml/tiktok/magalu)'], ['tipo', 'Tipo * (' + V8BIZ.TIPOS_TAXA.slice(0, 3).join(', ') + '…)'], ['percentual', 'Percentual (%)'], ['valorFixo', 'OU valor fixo (R$)'], ['sku', 'SKU específico (opcional)'], ['categoria', 'Categoria (opcional)']],
      g => V8BIZ.addTaxa(biz(), { marketplace: g.marketplace, empresaId: CC.empresaId, tipo: g.tipo || 'Comissão percentual', percentual: g.percentual ? +g.percentual : null, valorFixo: g.valorFixo ? +g.valorFixo : null, sku: g.sku || null, categoria: g.categoria || null }, { usuario: D.meta.usuario, papel: papel() }));
    else if (act === 'addads') formGenerico('Regra de Ads / Cupom / Afiliado', [['tipo', 'Tipo * (Investimento mensal em Ads, Cupom percentual, Comissão de afiliado…)'], ['percentual', 'Percentual (%)'], ['valor', 'OU valor (R$)'], ['marketplace', 'Marketplace (opcional)']],
      g => V8BIZ.addAdsRegra(biz(), { tipo: g.tipo, percentual: g.percentual ? +g.percentual : null, valor: g.valor ? +g.valor : null, marketplace: g.marketplace || null, empresaId: CC.empresaId }, { usuario: D.meta.usuario, papel: papel() }));
    else if (act === 'addrateio') formGenerico('Regra de Rateio', [['nome', 'Nome da regra *'], ['metodo', 'Método * (' + V8BIZ.METODOS_RATEIO.slice(0, 3).join(' / ') + '…)'], ['motivo', 'Motivo']],
      g => V8BIZ.addRateio(biz(), { nome: g.nome, metodo: g.metodo || 'Por pedidos pagos', empresaId: CC.empresaId, motivo: g.motivo || null, responsavel: D.meta.usuario }, { usuario: D.meta.usuario, papel: papel() }));
    else if (act === 'editfixo' || act === 'editrateio') {
      const lista = act === 'editfixo' ? biz().custosFixos : biz().rateios;
      const alvo = lista.find(x => x.id === b.dataset.id);
      formGenerico('Nova vigência · ' + (alvo.nome || alvo.id), [[act === 'editfixo' ? 'valor' : 'metodo', act === 'editfixo' ? 'Novo valor (R$) *' : 'Novo método *'], ['motivo', 'Motivo *']],
        g => V8BIZ.novaVigencia(biz(), lista, alvo.id, act === 'editfixo' ? { valor: +g.valor, valorMensal: +g.valor } : { metodo: g.metodo },
          { motivo: g.motivo, usuario: D.meta.usuario, papel: papel() }, 'COST_RULE_EDIT'));
    }
    else if (act === 'editcusto') {
      const pid = b.dataset.id;
      const atual = V8BIZ.custoProdutoVigente(biz(), pid) || {};
      formGenerico('Custo do produto · ' + pid, [['custoCompra', 'Custo de compra/produção (R$) *', atual.custoCompra], ['embalagem', 'Embalagem (R$)', atual.embalagem], ['freteSubsidiadoPct', 'Frete subsidiado (% do preço)', atual.freteSubsidiadoPct], ['devolucaoEstimado', 'Devolução estimada (R$)', atual.devolucaoEstimado], ['margemMinimaPct', 'Margem mínima desejada (%)', atual.margemMinimaPct]],
        g => V8BIZ.setProdutoCusto(biz(), pid, { custoCompra: +g.custoCompra || 0, embalagem: +g.embalagem || 0, freteSubsidiadoPct: +g.freteSubsidiadoPct || 0, devolucaoEstimado: +g.devolucaoEstimado || 0, margemMinimaPct: +g.margemMinimaPct || 10 }, { usuario: D.meta.usuario, papel: papel() }));
    }
    else if (act === 'simular') {
      const pid = UI.$('#simProd').value, mkt = UI.$('#simMkt').value;
      const p = UI.state.products.find(x => x.id === pid);
      const v = vendasDoEscopo();
      const r = V8BIZ.simularPreco(biz(), { produtoId: pid, sku: p.sku, marketplace: mkt, empresaId: CC.empresaId, categoria: p.categoria,
        precoAtual: +UI.$('#simAtual').value, precoNovo: +UI.$('#simNovo').value,
        base: { pedidosPagos: v.pedidosPagos, faturamento: v.faturamento, faturamentoItem: Math.round((v.faturamento || 0) * 0.05), unidadesItem: 40 }, fonteBase: v.fonte }, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      const s = r.simulacao;
      UI.$('#simOut').innerHTML = `
        <div class="mesa-grid">
          <div class="mesa-kpi"><span class="k">Margem contribuição</span><span class="v">${brl(s.margemContribuicaoAtual)} → ${brl(s.margemContribuicaoSimulada)}</span><span class="f">atual → simulada</span></div>
          <div class="mesa-kpi"><span class="k">Margem líquida estimada</span><span class="v">${brl(s.margemLiquidaAtual)} → ${brl(s.margemLiquidaSimulada)}</span><span class="f">por venda</span></div>
          <div class="mesa-kpi ${s.riscoMargemNegativa ? 'nodata' : ''}"><span class="k">Risco de margem negativa</span><span class="v">${s.riscoMargemNegativa ? 'SIM ⚠' : 'não'}</span><span class="f">preço mínimo seguro: ${brl(s.precoMinimoSeguro)}</span></div>
          <div class="mesa-kpi"><span class="k">Impacto no equilíbrio</span><span class="v" style="font-size:12px">${UI.esc(String(s.impactoBE))}</span><span class="f">${UI.esc(s.externo)}</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm" data-act="salvarsim">Salvar simulação</button>
          <button class="btn sm ghost" data-act="simmissao">Criar missão de revisão</button>
        </div>`;
      CC._ultimaSim = s;
    }
    else if (act === 'salvarsim') { const r = V8BIZ.salvarSimulacao(biz(), CC._ultimaSim, { usuario: D.meta.usuario, papel: papel() }); r.blocked ? UI.toast(r.reason, 'err') : UI.toast('Simulação salva — interna, auditada.', 'ok'); }
    else if (act === 'simmissao') {
      D.missoes.push({ id: 'm' + (D.missoes.length + 1), titulo: 'Revisar preço ' + CC._ultimaSim.produtoId + ' (R$ ' + CC._ultimaSim.precoAtual + ' → R$ ' + CC._ultimaSim.precoNovo + ')', status: D.STATUS.EM_PROCESSAMENTO, tipo: D.STATUS.ACAO_INTERNA, agora: 'nascida do simulador de preço', origem: 'centro de custos', reversivel: true });
      UI.toast('Missão de revisão criada — veja em A Missão.', 'ok'); UI.refreshBadges();
    }
  }

  /* formulário genérico de cadastro */
  function formGenerico(titulo, campos, aplicar) {
    UI.openModal(`<h3 class="h2">${UI.esc(titulo)}</h3>
      ${campos.map(([id, lbl, val]) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${UI.esc(lbl)}</span><br><input class="input" id="fg_${id}" style="width:100%;margin-top:3px" value="${UI.esc(val ?? '')}"></label>`).join('')}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="fgOk">Salvar</button></div>`);
    UI.$('#fgOk').onclick = () => {
      const g = {};
      for (const [id] of campos) g[id] = UI.$('#fg_' + id).value.trim();
      const r = aplicar(g);
      if (r && r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.toast('Salvo — com fonte, vigência e auditoria.', 'ok'); body();
    };
  }

  UI.renderers.custos = render;

  /* ---------- auto-teste (?cusself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('cusself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('custos');
      need(CC.sub === 'Visão Financeira', 'abre na visão financeira');
      need(UI.$('#ccBody').textContent.includes('ESTIMAD'), 'nunca “lucro real” sem conciliação');
      const B = biz();
      V8BIZ.addCustoFixo(B, { nome: 'Aluguel Self', categoria: 'Aluguel', valor: 10000, periodicidade: 'Mensal', inicio: '2026-07-01', empresaId: 'e1' }, {});
      V8BIZ.addCustoVariavel(B, { nome: 'Embalagem Self', categoria: 'Embalagem por pedido', valorFixo: 2.5, base: 'Por pedido', empresaId: 'e1' }, {});
      V8BIZ.addTaxa(B, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 14 }, {});
      V8BIZ.addTaxa(B, { marketplace: 'shopee', empresaId: 'e1', tipo: 'Comissão percentual', percentual: 11, sku: 'QP-6090' }, {});
      need(V8BIZ.taxaAplicavel(B, 'Comissão percentual', { marketplace: 'shopee', empresaId: 'e1', sku: 'QP-6090' }).nivel === 'SKU específico', 'prioridade SKU');
      V8BIZ.addRateio(B, { nome: 'Rateio Self', metodo: 'Por pedidos pagos', empresaId: 'e1' }, {});
      V8BIZ.setProdutoCusto(B, 'p1', { custoCompra: 48.9, embalagem: 3.5, margemMinimaPct: 15 }, {});
      CC.sub = 'Economia por Produto'; body();
      need(UI.$('#ccBody').textContent.includes('Fórmula visível'), 'fórmula linha a linha');
      need(UI.$('#ccBody').textContent.includes('regra usada: SKU específico') || UI.$('#ccBody').textContent.includes('SKU específico'), 'regra explicada na tela');
      CC.sub = 'Ponto de Equilíbrio'; body();
      need(UI.$('#ccBody').textContent.includes('PE em faturamento'), 'ponto de equilíbrio calculado');
      CC.sub = 'Margem por Canal'; body();
      need(UI.$('#ccBody').textContent.includes('Shopee Líder Molduras MG'), 'margem por canal');
      CC.sub = 'Visão Financeira'; body();
      document.body.dataset.cusselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e2) { document.body.dataset.cusselfReady = 'fail: ' + e2.message; }
  });
}());

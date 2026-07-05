/* =============================================================
   v8 · CATÁLOGO — CATALOG & LISTING OPERATING CENTER (10.E.3)
   A área que a equipe abre todos os dias: Product Master (verdade
   interna) × Listings por marketplace+conta+loja. Editor completo
   na linguagem da Shopee, mídia, variações, ranking com fonte,
   edição em massa com job+rollback, duplicar/adaptar como rascunho
   interno. Busca busca, filtro filtra, edição versiona.
   Escrita externa: bloqueada. READ_ONLY · INTERNAL_ONLY · DRAFT_ONLY.
   ============================================================= */
(function () {
  'use strict';
  const L = V8LOGIC, D = V8DATA;
  const SUBS = ['Visão Geral', 'Produtos Master', 'Anúncios', 'Rascunhos', 'Ativos', 'Pausados', 'Não Publicados',
    'Em Revisão', 'Com Erro ou Bloqueio', 'Variações', 'Fotos e Vídeos', 'Atributos e Especificações',
    'SKU e Vínculos', 'Anúncio Master', 'Importar Cadastro', 'Campos de Cadastro', 'Edição em Massa', 'Duplicar e Adaptar',
    'Saúde e Pendências', 'Comparar Marketplaces', 'Histórico e Versões', 'Fontes e Arquivos'];

  const CAT = window.CATALOGO = {
    sub: 'Visão Geral',
    filters: {},              /* mantidos ao navegar entre subáreas */
    sortKey: 'nome', sortDir: 'asc',
    cols: { categoria: true, custo: true, atualizacao: true },
    anCols: { sku: true, ids: true, precos: true, vendidos: true, perf: true, ranking: true, fonte: true },
    anuncioMkt: 'ml', anuncioTab: 'Todos', anQ: '', anQuick: '',
    lsel: new Set(), /* seleção de anúncios (listings) */
    drafts: [
      { id: 'd1', produtoId: 'p7', mkt: 'tiktok', status: D.STATUS.PRONTO_REVISAO, nota: 'draft interno gerado da oportunidade priorizada' },
      { id: 'd2', produtoId: 'p3', mkt: 'shopee', status: D.STATUS.EM_REVISAO, nota: 'aguardando foto com escala real' },
    ],
  };
  /* motor de catálogo (Product Master × Listings) — criado uma vez por sessão */
  CAT.eng = () => (CAT._cat || (CAT._cat = V8CAT.createCatalog(UI.state.products)));
  const papel = () => (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
  const lst = id => V8CAT.byId(CAT.eng(), id);

  /* contexto global (empresa + marketplace ativos) entra ANTES dos filtros locais */
  const prods = () => UI.ctxProducts();
  const allProds = () => UI.state.products;
  const filtered = () => L.sortProducts(L.filterProducts(prods(), CAT.filters), CAT.sortKey, CAT.sortDir);
  const ctxListings = () => {
    const ids = new Set(prods().map(p => p.id));
    return V8CAT.ativos(CAT.eng()).filter(l => ids.has(l.produtoId) && (!UI.ctx.marketplace || l.marketplace === UI.ctx.marketplace));
  };

  /* ---------------- shell da área ---------------- */
  function render(sub) {
    if (sub === 'Produtos') sub = 'Produtos Master'; /* compat com navegação antiga */
    if (sub && SUBS.includes(sub)) CAT.sub = sub;
    const el = UI.$('#v-catalogo');
    el.innerHTML = `
      <div class="eyebrow">catálogo · central operacional de produtos e anúncios</div>
      <h1 class="h1">Catálogo</h1>
      <p class="sub" style="margin-top:6px">Product Master é a <b>verdade interna</b>; cada anúncio é a projeção em um marketplace — editar um canal nunca sobrescreve outro. ${UI.esc(D.STATUS.DADO_SIMULADO)} · rotulado.</p>
      <div class="tabs" style="margin-top:16px;flex-wrap:wrap">
        ${SUBS.map(s => `<button class="tab ${s === CAT.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}${s === 'Saúde e Pendências' ? `<span class="cnt">${V8CAT.health(CAT.eng()).reduce((a, f) => a + f.itens.length, 0)}</span>` : ''}</button>`).join('')}
      </div>
      <div id="catBody" style="margin-top:16px"></div>`;
    body();
    el.onclick = onClick;
    el.oninput = onInput;
  }

  const STATUS_TABS = { 'Ativos': 'Ativos', 'Pausados': 'Pausados', 'Não Publicados': 'Não publicados', 'Em Revisão': 'Em revisão', 'Com Erro ou Bloqueio': 'Bloqueados' };
  function body() {
    const el = UI.$('#catBody');
    if (CAT.sub === 'Visão Geral') el.innerHTML = visaoGeral();
    else if (CAT.sub === 'Produtos Master') el.innerHTML = produtos();
    else if (CAT.sub === 'Anúncios') el.innerHTML = anuncios();
    else if (STATUS_TABS[CAT.sub]) { CAT.anuncioTab = STATUS_TABS[CAT.sub]; el.innerHTML = anuncios(); }
    else if (CAT.sub === 'Rascunhos') el.innerHTML = rascunhos();
    else if (CAT.sub === 'Variações') el.innerHTML = variacoes();
    else if (CAT.sub === 'Fotos e Vídeos') el.innerHTML = midia();
    else if (CAT.sub === 'Atributos e Especificações') el.innerHTML = atributos();
    else if (CAT.sub === 'SKU e Vínculos') el.innerHTML = skuVinculos();
    else if (CAT.sub === 'Anúncio Master') el.innerHTML = anuncioMaster();
    else if (CAT.sub === 'Importar Cadastro') el.innerHTML = importarCadastro();
    else if (CAT.sub === 'Campos de Cadastro') el.innerHTML = camposCadastro();
    else if (CAT.sub === 'Edição em Massa') el.innerHTML = edicaoMassa();
    else if (CAT.sub === 'Duplicar e Adaptar') el.innerHTML = duplicarAdaptar();
    else if (CAT.sub === 'Saúde e Pendências') el.innerHTML = saude();
    else if (CAT.sub === 'Comparar Marketplaces') el.innerHTML = compararMkts();
    else if (CAT.sub === 'Histórico e Versões') el.innerHTML = historicoVersoes();
    else if (CAT.sub === 'Fontes e Arquivos') el.innerHTML = fontesArquivos();
    else el.innerHTML = visaoGeral();
    UI.refreshBadges();
  }

  /* ---------------- Visão Geral (dashboard executivo do catálogo) ---------------- */
  function visaoGeral() {
    const ov = V8CAT.overview(CAT.eng(), window.IMPORTAR ? IMPORTAR.eng : null);
    return `
      <div class="callout" style="margin-top:0">Cada indicador declara <b>fonte, período, cobertura e qualidade</b> — nenhum número sem origem. Publicação externa: ${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)}.</div>
      <div class="mesa-grid" style="margin-top:12px">
        ${ov.kpis.map(k => `<div class="mesa-kpi ${k.valor === 0 ? '' : ''}" title="fonte: ${UI.esc(k.fonte)} · período: ${UI.esc(k.periodo)} · cobertura: ${UI.esc(k.cobertura)} · ${UI.esc(k.qualidade)}">
          <span class="k">${UI.esc(k.label)}</span><span class="v">${k.valor}</span>
          <span class="f">${UI.esc(k.fonte)} · ${UI.esc(k.periodo)}</span></div>`).join('')}
      </div>
      <div class="ctxcard" style="margin-top:14px"><div class="h"><b>Fontes e cobertura do catálogo</b><button class="linklike" data-act="sub" data-sub="Fontes e Arquivos">Fontes e Arquivos →</button></div>
        ${Object.entries(ov.fontes.ultimaPorMkt).map(([mk, ult]) => `<div class="ctxitem"><span>Última atualização · ${UI.esc(mk)}</span><span class="src">${UI.esc(ult)}</span></div>`).join('')}
        <div class="ctxitem"><span>Última importação de cadastro</span><span class="src">${ov.fontes.ultimaImportacaoCadastro || 'nenhuma — importe pelo botão em Importar Cadastro'}</span></div>
        <div class="ctxitem"><span>Cobertura de fontes</span><span class="src">${UI.esc(ov.fontes.coberturaFontes)}</span></div>
        <div class="ctxitem"><span>Anúncios com dados reais · simulados · sem performance</span><span class="src">${ov.fontes.anunciosDadosReais} · ${ov.fontes.anunciosDadosSimulados} (rotulados) · ${ov.fontes.anunciosSemPerformance} SEM DADOS</span></div>
      </div>`;
  }

  function thSort(key, label) {
    const arr = CAT.sortKey === key ? `<span class="arr">${CAT.sortDir === 'asc' ? '▲' : '▼'}</span>` : '';
    return `<th data-act="sort" data-key="${key}">${label} ${arr}</th>`;
  }

  function produtos() {
    const list = filtered();
    const sel = UI.state.selection;
    const fCount = L.activeFilterCount(CAT.filters);
    const views = L.viewsFor(UI.state, UI.ctx.empresa);
    const lojaCtx = UI.ctx.loja; /* com loja ativa: estoque/preço/margem SÃO da loja */
    const chip = (label, on, act, extra) => `<button class="fchip ${on ? 'on' : ''}" data-act="${act}" ${extra || ''}>${label}</button>`;
    const rows = list.map(p => {
      const sl = lojaCtx ? p.lojas[lojaCtx] : null;
      const estoque = sl ? sl.estoque : p.estoque;
      const preco = sl ? sl.preco : p.precoBase;
      const mg = lojaCtx ? L.margemLoja(p, lojaCtx) : L.margem(p);
      return `<tr class="${sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}">
        <td><input type="checkbox" data-act="selrow" data-id="${p.id}" ${sel.has(p.id) ? 'checked' : ''} aria-label="Selecionar ${UI.esc(p.nome)}"></td>
        <td><span class="thumb">▦</span></td>
        <td><button class="tmain linklike" style="font-size:12.5px" data-act="drawer" data-id="${p.id}">${UI.esc(p.nome)}</button><span class="tsub">${UI.esc(p.sku)}${sl && sl.pendencia ? ' · <span class="st warn plain" style="font-size:9px">' + UI.esc(sl.pendencia) + '</span>' : ''}</span></td>
        ${CAT.cols.categoria ? `<td>${UI.esc(p.categoria)}</td>` : ''}
        <td>${p.tipo.replace(/_/g, ' ').toLowerCase()}</td>
        <td>${estoque ?? '—'}${lojaCtx ? '<span class="tsub">na loja</span>' : ''}</td>
        ${CAT.cols.custo ? `<td>${UI.brl(p.custo)}</td>` : ''}
        <td>${UI.brl(preco)}</td>
        <td>${mg == null ? '—' : mg + '%'}</td>
        <td><span class="mrow">${D.MKTS.map(mk => {
          const st = p.mkt[mk.key].status;
          const c = st === 'ATIVO' ? 'on' : (st === 'PAUSADO' || st === 'EM_REVISAO') ? 'warn' : st === 'BLOQUEADO' ? 'err' : '';
          return `<span class="mdot ${c}" title="${mk.nome}: ${st === 'NAO_PUBLICADO' ? 'não publicado' : st}"></span>`;
        }).join('')}</span></td>
        <td>${L.readiness(p)}%</td>
        <td>${p.pendencias.length ? `<span class="st warn">${p.pendencias.length} pendência${p.pendencias.length > 1 ? 's' : ''}</span>` : '<span class="src">—</span>'}</td>
        ${CAT.cols.atualizacao ? `<td><span class="src">${p.atualizadoEm}</span></td>` : ''}
        <td><span class="rowact"><button class="btn sm ghost" data-act="drawer" data-id="${p.id}">abrir</button></span></td>
      </tr>`;
    }).join('');

    return `
      <div class="fbar" style="margin-top:0">
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input id="catQ" placeholder="Buscar por nome ou SKU…" value="${UI.esc(CAT.filters.q || '')}" aria-label="Buscar produtos"></label>
        ${chip('Com pendência', CAT.filters.comPendencia === true, 'f-pend')}
        ${chip('Estoque ≤ 10', CAT.filters.estoqueMax === 10, 'f-estoque')}
        ${chip('Margem ≥ 60%', CAT.filters.margemMin === 60, 'f-margem')}
        ${chip('Ativos no ML', CAT.filters.marketplace === 'ml' && CAT.filters.statusMkt === 'ATIVO', 'f-ml')}
        <button class="fchip" data-act="adv">Filtros avançados${fCount ? ` · <b>${fCount}</b>` : ''}</button>
        ${fCount ? `<button class="fchip" data-act="f-clear">limpar (${fCount})</button>` : ''}
        <span style="flex:1"></span>
        <button class="btn sm primary" data-act="upcat" title="Upload local real — ref.: Shopee_mass_upload basic_template / parentskudetail. Detecção, staging e confirmação humana.">Carregar cadastro de produtos Shopee</button>
        <button class="fchip" data-act="saveview">salvar visão</button>
        ${views.map(v => chip('▤ ' + v.nome, false, 'loadview', `data-view="${v.id}" title="${UI.esc(v.tipo)} · ${UI.esc((v.escopo && v.escopo.loja) ? 'loja fixa' : 'escopo atual')}"`)).join('')}
        <button class="fchip" data-act="cols">colunas</button>
      </div>
      <div class="fbar" style="margin:2px 0 10px">${UI.scopeLineHtml()}</div>

      ${list.length ? `
      <div class="tblwrap">
        <table class="tbl"><thead><tr>
          <th class="nosort"><input type="checkbox" data-act="selall" ${list.length && list.every(p => sel.has(p.id)) ? 'checked' : ''} aria-label="Selecionar todos os filtrados" title="Seleciona todos os ${list.length} itens filtrados"></th>
          <th class="nosort"></th>
          ${thSort('nome', 'Produto')}
          ${CAT.cols.categoria ? thSort('categoria', 'Categoria') : ''}
          ${thSort('tipo', 'Tipo produção')}
          ${thSort('estoque', lojaCtx ? 'Estoque (loja)' : 'Estoque')}
          ${CAT.cols.custo ? thSort('custo', 'Custo') : ''}
          ${thSort('precoBase', lojaCtx ? 'Preço (loja)' : 'Preço base')}
          ${thSort('margem', lojaCtx ? 'Margem (loja)' : 'Margem')}
          <th class="nosort">ML · Shp · TT · Mgl</th>
          ${thSort('readiness', 'Readiness')}
          <th class="nosort">Pendência</th>
          ${CAT.cols.atualizacao ? thSort('atualizadoEm', 'Atualização') : ''}
          <th class="nosort"></th>
        </tr></thead><tbody>${rows}</tbody></table>
        <div class="tfoot"><span>${list.length} de ${prods().length} produtos · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span><span>${sel.size ? sel.size + ' selecionado(s)' : 'nenhum selecionado'}</span></div>
      </div>` : `
      <div class="panel"><div class="empty"><b>Nenhum produto corresponde aos filtros</b>
        ${fCount} filtro(s) ativo(s). <button class="linklike" data-act="f-clear">Limpar filtros</button> para ver os ${prods().length} produtos.</div></div>`}

      ${sel.size ? (() => {
        const r = L.bulkScopeSummary(UI.state, [...sel], UI.ctx);
        return `
      <div class="massbar" role="toolbar" aria-label="Ações em massa">
        <b>${sel.size} selecionado(s)</b>
        <span class="src" title="Lojas: ${UI.esc(r.lojasAfetadas.join(' · '))} — CNPJs: ${UI.esc(r.cnpjsAfetados.join(' · '))}">${r.lojasAfetadas.length} loja(s) · ${r.cnpjsAfetados.length} CNPJ(s) · ${r.contasAfetadas.length} conta(s) · ${r.elegiveis} elegíveis${r.bloqueados.length ? ' · ' + r.bloqueados.length + ' com pendência' : ''}</span>
        <span class="sep"></span>
        <button class="btn sm" data-act="bulk" data-bulk="marcar_revisao">marcar para revisão</button>
        <button class="btn sm" data-act="bulk" data-bulk="recalcular_margem">recalcular margens</button>
        <button class="btn sm" data-act="bulk" data-bulk="gerar_rascunhos">gerar rascunhos internos</button>
        <button class="btn sm" data-act="bulk" data-bulk="criar_missao">criar missão</button>
        <button class="btn sm" data-act="bulk" data-bulk="solicitar_dado">solicitar dado</button>
        <button class="btn sm" data-act="bulk" data-bulk="exportar_interno">exportar (interno)</button>
        <button class="btn sm" data-act="cmpsel" ${sel.size < 2 ? `disabled title="Selecione 2+ produtos para comparar entre lojas."` : ''}>comparar selecionados</button>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('publicar_externo'))}">publicar nos marketplaces</button>
        <span class="sep"></span>
        <button class="btn sm ghost" data-act="selclear">limpar seleção</button>
      </div>`;
      })() : ''}`;
  }

  /* ---------------- Anúncios: tabela operacional densa ---------------- */
  const QUICK_CHIPS = [['sem_venda', 'Sem venda'], ['mais_vendidos_30d', 'Mais vendidos 30d'], ['crescimento', 'Crescimento'],
    ['estoque_baixo', 'Estoque crítico'], ['sem_foto', 'Sem foto'], ['sem_ean', 'Sem EAN/GTIN'],
    ['pos_1_10', 'Posição 1–10'], ['perdeu_posicao', 'Perdeu posição'], ['ctr_baixo', 'CTR baixo'],
    ['conversao_baixa', 'Conversão baixa'], ['margem_baixa', 'Margem baixa'], ['devolucao_alta', 'Devolução alta']];
  const QUICK_ALL = ['ativos', 'pausados', 'nao_publicados', 'rascunhos', 'em_revisao', 'com_erro', 'mais_recentes', 'mais_antigos',
    'mais_vendidos', 'sem_venda', 'mais_vendidos_7d', 'mais_vendidos_30d', 'mais_vendidos_90d', 'crescimento', 'queda',
    'estoque_baixo', 'sem_estoque', 'sem_foto', 'sem_video', 'sem_peso', 'sem_marca', 'sem_sku', 'sem_ean', 'sem_atributo',
    'sem_ranking', 'pos_1_10', 'pos_11_50', 'perdeu_posicao', 'ganhou_posicao', 'ctr_baixo', 'conversao_baixa',
    'margem_baixa', 'devolucao_alta', 'conflito_sku', 'sem_master'];

  function anuncios() {
    const cat = CAT.eng();
    const mk = UI.ctx.marketplace || CAT.anuncioMkt;
    const mkNome = D.MKTS.find(m => m.key === mk).nome;
    const ids = new Set(prods().map(p => p.id));
    let all = V8CAT.ativos(cat).filter(l => ids.has(l.produtoId) && l.marketplace === mk);
    const TABS = { 'Todos': () => true, 'Ativos': l => l.status === 'ATIVO', 'Pausados': l => l.status === 'PAUSADO',
      'Em revisão': l => l.status === 'EM_REVISAO', 'Bloqueados': l => l.status === 'BLOQUEADO',
      'Não publicados': l => l.status === 'NAO_PUBLICADO', 'Rascunhos': l => l.status === 'RASCUNHO' };
    let list = all.filter(TABS[CAT.anuncioTab] || TABS.Todos);
    if (CAT.anQ) list = V8CAT.searchListings(cat, CAT.anQ).filter(l => list.includes(l));
    if (CAT.anQuick) list = V8CAT.quickFilter(cat, CAT.anQuick, list);
    const sel = CAT.lsel;
    const C = CAT.anCols;
    return `
      <div class="fbar" style="margin-top:0">
        ${D.MKTS.map(m => `<button class="fchip ${m.key === mk ? 'on' : ''}" data-act="anmkt" data-mkt="${m.key}" ${UI.ctx.marketplace ? 'title="marketplace fixado pela barra global"' : ''}>${m.nome}</button>`).join('')}
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input id="anQ" placeholder="Nome, SKU, ID do anúncio, ID externo, EAN, marca…" value="${UI.esc(CAT.anQ)}" aria-label="Buscar anúncios"></label>
        <span style="flex:1"></span>
        <select class="select" data-act="anquick" title="Filtros rápidos completos">
          <option value="">filtro rápido…</option>${QUICK_ALL.map(k => `<option value="${k}" ${CAT.anQuick === k ? 'selected' : ''}>${k.replace(/_/g, ' ')}</option>`).join('')}</select>
        <button class="fchip" data-act="ancols">colunas</button>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('sync'))}">sincronizar anúncios</button>
      </div>
      <div class="fbar" style="margin:6px 0 0">${QUICK_CHIPS.map(([k, lbl]) => `<button class="fchip ${CAT.anQuick === k ? 'on' : ''}" data-act="anchip" data-k="${k}">${lbl}</button>`).join('')}
        ${CAT.anQuick ? `<button class="fchip" data-act="anchip" data-k="">limpar filtro</button>` : ''}</div>
      <div class="tabs" style="margin-top:8px">${Object.keys(TABS).map(t => `<button class="tab ${t === CAT.anuncioTab ? 'on' : ''}" data-act="antab" data-tab="${t}">${t}<span class="cnt">${all.filter(TABS[t]).length}</span></button>`).join('')}</div>

      ${list.length ? `
      <div class="tblwrap" style="margin-top:12px">
        <table class="tbl"><thead><tr>
          <th class="nosort"><input type="checkbox" data-act="lselall" ${list.length && list.every(l => sel.has(l.id)) ? 'checked' : ''} aria-label="Selecionar todos" title="Seleciona os ${list.length} anúncios filtrados"></th>
          <th class="nosort"></th><th class="nosort">Anúncio · tags</th>
          ${C.sku ? '<th class="nosort">SKU pai · variação</th>' : ''}
          ${C.ids ? '<th class="nosort">ID · EAN</th>' : ''}
          <th class="nosort">Conta · loja</th>
          ${C.precos ? '<th class="nosort">Preço · promo</th>' : ''}
          <th class="nosort">Estoque</th>
          ${C.vendidos ? '<th class="nosort">Vendidos 7/30/90d</th>' : ''}
          ${C.perf ? '<th class="nosort">Faturamento · CTR · conv.</th>' : ''}
          <th class="nosort">Margem</th>
          ${C.ranking ? '<th class="nosort">Posição</th>' : ''}
          ${C.fonte ? '<th class="nosort">Fonte</th>' : ''}
          <th class="nosort">Ações</th>
        </tr></thead><tbody>
        ${list.map(l => {
          const p = allProds().find(x => x.id === l.produtoId);
          const tags = V8CAT.listingTags(cat, l);
          const pc = V8CAT.perfComercial(cat, l);
          const si = V8CAT.salesInfo(cat, l);
          const rk = V8CAT.rankingDe(cat, l.id);
          const fotos = V8CAT.fotosDe(cat, l.id);
          return `<tr class="${sel.has(l.id) ? 'sel' : ''}">
            <td><input type="checkbox" data-act="lsel" data-id="${l.id}" ${sel.has(l.id) ? 'checked' : ''} aria-label="Selecionar ${UI.esc(l.titulo)}"></td>
            <td><span class="thumb" title="${fotos.length ? fotos.length + ' foto(s)' : 'SEM FOTO'}">${fotos.length ? '▦' : '∅'}</span></td>
            <td><button class="tmain linklike" style="font-size:12.5px" data-act="editor" data-id="${l.id}">${UI.esc(V8CAT.valorDe(cat, l, 'titulo'))}</button>
              <span class="tsub" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">${tags.slice(0, 4).map(t => `<span class="st ${t.kind} plain" style="font-size:9px">${UI.esc(t.txt)}</span>`).join('')}</span></td>
            ${C.sku ? `<td><span class="src">${UI.esc(l.skuPai || '—')}</span><span class="tsub">${(p.variacoes || []).filter(v => !v.arquivada).length} variação(ões)</span></td>` : ''}
            ${C.ids ? `<td><span class="src">${l.itemIdExterno ? 'ext ' + l.itemIdExterno : 'sem ID externo'}</span><span class="tsub">${l.ean ? 'EAN ' + l.ean : 'SEM EAN'}</span></td>` : ''}
            <td><span class="src">${UI.esc(l.contaId || '—')}</span><span class="tsub">${UI.esc((D.scope.lojas.find(s => s.id === l.lojaId) || {}).nome || '—')}</span></td>
            ${C.precos ? `<td>${UI.brl(V8CAT.valorDe(cat, l, 'preco'))}${l.precoPromo ? `<span class="tsub">promo ${UI.brl(l.precoPromo)}</span>` : ''}</td>` : ''}
            <td>${l.estoque ?? '—'}</td>
            ${C.vendidos ? `<td>${l.perf ? `${l.perf.vendidos7d} / ${l.perf.vendidos30d} / ${l.perf.vendidos90d}<span class="tsub">total ${l.perf.vendidosTotal}</span>` : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span>`}</td>` : ''}
            ${C.perf ? `<td>${pc.semDados ? `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span>` : `${UI.brl(l.perf.faturamento)}<span class="tsub">CTR ${pc.ctr.taxa ?? '—'}% · conv ${pc.conversaoVisitas.taxa ?? '—'}%</span>`}</td>` : ''}
            <td>${si.margemLiquida != null ? si.margemLiquida + '%' : '—'}</td>
            ${C.ranking ? `<td>${rk ? `<span class="tmain">#${rk.posicao}</span><span class="tsub">"${UI.esc(rk.palavra)}" · ${UI.esc(rk.dataHora)} · ${UI.esc(rk.fonte)} · ${UI.esc(rk.confianca.split('—')[0])}</span>` : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)} — sem posição inventada</span>`}</td>` : ''}
            ${C.fonte ? `<td><span class="src">${UI.esc(l.fonte)}</span><span class="tsub">${l.atualizadoEm}</span></td>` : ''}
            <td><span class="rowact">
              <button class="btn sm ghost" data-act="editor" data-id="${l.id}">editar</button>
              <button class="btn sm ghost" data-act="drawer" data-id="${l.produtoId}">produto</button>
            </span></td>
          </tr>`;
        }).join('')}
        </tbody></table>
        <div class="tfoot"><span>${list.length} anúncio(s) · ${mkNome} · ${UI.esc(D.STATUS.DADO_SIMULADO)} rotulado</span>
        <button class="linklike" disabled title="${UI.esc(L.disabledReason('ranking_real'))}" style="opacity:.55;cursor:not-allowed">ver ranking real</button></div>
      </div>` : `
      <div class="panel" style="margin-top:14px"><div class="empty"><b>Nenhum anúncio "${CAT.anuncioTab}" no ${mkNome}${CAT.anQ || CAT.anQuick ? ' com este filtro' : ''}</b>
        ${CAT.anQ || CAT.anQuick ? '<button class="linklike" data-act="anchip" data-k="">limpar filtros</button>' : 'Conta ' + D.STATUS.AGUARDANDO_CONEXAO.toLowerCase() + ' — crie um rascunho interno pela matriz de publicação do produto.'}</div></div>`}

      ${sel.size ? `<div class="massbar" role="toolbar" aria-label="Ações em massa de anúncios">
        <b>${sel.size} anúncio(s) selecionado(s)</b><span class="sep"></span>
        <button class="btn sm" data-act="lbulk">edição em massa</button>
        <button class="btn sm" data-act="ldup">duplicar</button>
        <button class="btn sm" data-act="ladapt">adaptar p/ outro marketplace</button>
        <button class="btn sm" data-act="lcmp" ${sel.size < 2 ? 'disabled title="Selecione 2+ anúncios para comparar."' : ''}>comparar</button>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('publicar_externo'))}">publicar externamente</button>
        <span class="sep"></span><button class="btn sm ghost" data-act="lselclear">limpar seleção</button>
      </div>` : ''}`;
  }

  function rascunhos() {
    const cat = CAT.eng();
    const dynamic = UI.state.jobs.filter(j => j.acao === 'gerar_rascunhos').flatMap(j => j.itens.map(id => ({ id: j.id + ':' + id, produtoId: id, mkt: '—', status: D.STATUS.PRONTO_REVISAO, nota: `gerado pelo job ${j.id}` })));
    const adaptados = cat.listings.filter(l => l.status === 'RASCUNHO' && !l.arquivado);
    const list = [...CAT.drafts, ...dynamic];
    return `
      <div class="callout" style="margin-top:0">Rascunho é <b>${UI.esc(D.STATUS.ACAO_INTERNA)}</b>: validado dentro do sistema. Publicar fora exige conexão oficial + aprovação — nunca será simulado como concluído.</div>
      ${adaptados.length ? `<div class="sect-h"><span class="h2">Rascunhos de anúncio (duplicados/adaptados)</span><span class="src">original sempre preservado</span></div>
      ${adaptados.map(l => `<div class="ctxcard" style="margin-top:8px"><div class="h"><b>${UI.esc(l.titulo)}</b><span class="st info plain">RASCUNHO · ${UI.esc(l.mktNome)}</span></div>
        <div class="ctxitem"><span>Origem</span><span class="src">${UI.esc(l.origem)}</span></div>
        ${l.adaptacao ? `<div class="ctxitem"><span>Pendências da adaptação</span><span class="src">${l.adaptacao.pendente.length ? UI.esc(l.adaptacao.pendente.join(' · ')) : 'nenhuma'}</span></div>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn sm" data-act="editor" data-id="${l.id}">abrir no editor</button>
          <button class="btn sm ghost" data-act="canceldraft" data-id="${l.id}">cancelar rascunho</button></div></div>`).join('')}` : ''}
      ${list.length ? `<div class="sect-h"><span class="h2">Rascunhos de produto</span></div>
      <div class="tblwrap" style="margin-top:8px"><table class="tbl"><thead><tr>
        <th class="nosort">Rascunho</th><th class="nosort">Canal alvo</th><th class="nosort">Status</th><th class="nosort">Nota</th><th class="nosort"></th>
      </tr></thead><tbody>
      ${list.map(d => {
        const p = prods().find(x => x.id === d.produtoId);
        const mk = D.MKTS.find(m => m.key === d.mkt);
        return `<tr><td><span class="tmain">${UI.esc(p ? p.nome : d.produtoId)}</span><span class="tsub">${d.id}</span></td>
          <td>${mk ? mk.nome : '—'}</td><td>${UI.stBadge(d.status)}</td><td><span class="src">${UI.esc(d.nota)}</span></td>
          <td><span class="rowact"><button class="btn sm ghost" data-act="drawer" data-id="${d.produtoId}">abrir produto</button></span></td></tr>`;
      }).join('')}
      </tbody></table></div>` : ''}
      ${!list.length && !adaptados.length ? `<div class="panel" style="margin-top:12px"><div class="empty"><b>Sem rascunhos</b>Rascunhos nascem de Duplicar e Adaptar, da matriz de publicação ou de jobs em massa.</div></div>` : ''}`;
  }

  /* ---------------- Variações ---------------- */
  function variacoes() {
    const cat = CAT.eng();
    const list = prods();
    return `
      <div class="fbar" style="margin-top:0"><span class="src">SKU duplicado no mesmo escopo gera <b>conflito explícito</b> — nunca vínculo silencioso. Arquivar preserva vendas e histórico.</span></div>
      ${list.map(p => `
      <div class="panel" style="margin-top:10px"><div class="sect-h" style="margin-top:0"><span class="h2">${UI.esc(p.nome)} <span class="src">(${p.sku})</span></span>
        <button class="btn sm" data-act="addvar" data-id="${p.id}">adicionar variação</button></div>
      <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Variação</th><th class="nosort">Tipo</th><th class="nosort">SKU</th><th class="nosort">Cód. barras</th>
        <th class="nosort">Preço</th><th class="nosort">Estoque</th><th class="nosort">Vendidos</th><th class="nosort">Status</th><th class="nosort">Ações</th></tr></thead><tbody>
      ${(p.variacoes || []).map(v => `<tr ${v.arquivada ? 'style="opacity:.5"' : ''}>
        <td class="tmain">${UI.esc(v.nome)}</td><td><span class="src">${UI.esc(v.tipo)}</span></td>
        <td><span class="kbd">${UI.esc(v.sku)}</span>${v.conflito ? ' <span class="st neg plain">CONFLITO</span>' : ''}</td>
        <td><span class="src">${v.codigoBarras || 'SEM EAN'}</span></td>
        <td>${UI.brl(v.preco)}</td><td>${v.estoque ?? '—'}</td><td>${v.vendidos}<span class="tsub">${v.pedidosPagos} pagos</span></td>
        <td>${v.arquivada ? '<span class="st plain">ARQUIVADA</span>' : UI.stBadge(v.status === 'ATIVA' ? 'ATIVO' : v.status)}</td>
        <td><span class="rowact">
          <button class="btn sm ghost" data-act="editvar" data-pid="${p.id}" data-vid="${v.id}">editar</button>
          ${v.arquivada ? '' : `<button class="btn sm ghost" data-act="arcvar" data-pid="${p.id}" data-vid="${v.id}">arquivar</button>`}
        </span></td></tr>`).join('')}
      </tbody></table></div></div>`).join('')}`;
  }

  /* ---------------- Fotos e Vídeos (biblioteca de mídia) ---------------- */
  function midia() {
    const cat = CAT.eng();
    const F = CAT.midiaF || (CAT.midiaF = {});
    let list = cat.media;
    if (F.produto) list = list.filter(m => m.produtoId === F.produto);
    if (F.tipo) list = list.filter(m => (F.tipo === 'video' ? m.tipo === 'video' : F.tipo === 'principal' ? m.usos.some(u => u.principal) : F.tipo === 'semuso' ? !m.usos.length : m.tipo === 'foto'));
    return `
      <div class="fbar" style="margin-top:0">
        <select class="select" data-act="mdprod"><option value="">todos os produtos</option>${prods().map(p => `<option value="${p.id}" ${F.produto === p.id ? 'selected' : ''}>${UI.esc(p.sku)}</option>`).join('')}</select>
        ${[['', 'todas'], ['foto', 'fotos'], ['video', 'vídeos'], ['principal', 'principais'], ['semuso', 'sem uso']].map(([k, lbl]) => `<button class="fchip ${((F.tipo || '') === k) ? 'on' : ''}" data-act="mdtipo" data-k="${k}">${lbl}</button>`).join('')}
        <span style="flex:1"></span>
        <button class="btn sm primary" data-act="mdadd">Adicionar fotos do computador</button>
      </div>
      <p class="src" style="margin-top:6px">Cada mídia registra arquivo, origem, data, usuário, uso por anúncio e foto principal. <b>Mídia de um marketplace nunca substitui a de outro automaticamente.</b></p>
      <div class="media-grid" style="margin-top:10px">
        ${list.map(m => `<div class="media-card">
          <div class="media-thumb">${m.dataUrl ? `<img src="${m.dataUrl}" alt="${UI.esc(m.arquivo)}">` : m.tipo === 'video' ? '▶' : '▦'}</div>
          <b>${UI.esc(m.arquivo)}</b>
          <span class="src">${UI.esc(m.subtipo)} · ${UI.esc(m.origem)} · ${m.em} · ${UI.esc(m.usuario)}</span>
          <span class="src">${m.dims || '—'} · ${m.pesoKb ? m.pesoKb + ' KB' : '—'} · ${m.usos.length ? m.usos.length + ' uso(s)' + (m.usos.some(u => u.principal) ? ' · principal' : '') : 'SEM USO'}</span>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <button class="btn sm ghost" data-act="mduso" data-id="${m.id}">onde é usada</button>
          </div>
        </div>`).join('') || '<div class="panel"><div class="empty"><b>Nenhuma mídia neste filtro</b></div></div>'}
      </div>`;
  }

  /* ---------------- Atributos e Especificações ---------------- */
  const ATTR_CAMPOS = [['marca', 'Marca', true], ['material', 'Material', true], ['pesoEmbaladoKg', 'Peso embalado (kg)', true],
    ['ean', 'EAN/GTIN', true], ['ncm', 'NCM', false], ['descricao', 'Descrição', false]];
  function atributos() {
    const cat = CAT.eng();
    return `
      <div class="callout" style="margin-top:0">Estados por campo: <span class="st pos plain">OK</span> <span class="st warn plain">PENDENTE</span> <span class="st neg plain">DIVERGENTE ENTRE MARKETPLACES</span> <span class="st info plain">CORRIGIDO MANUALMENTE</span> — campo obrigatório vazio bloqueia a saúde do anúncio.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Produto</th>${ATTR_CAMPOS.map(([, lbl, ob]) => `<th class="nosort">${lbl}${ob ? ' *' : ''}</th>`).join('')}<th class="nosort"></th></tr></thead><tbody>
      ${prods().map(p => {
        const mvl = V8CAT.masterVsListings(cat, p.id);
        return `<tr><td class="tmain">${UI.esc(p.sku)}</td>
        ${ATTR_CAMPOS.map(([campo, , ob]) => {
          const val = p.master[campo];
          const div = (mvl.find(r => r.campo === campo) || {}).conflito;
          const corrigido = cat.listings.some(l => l.produtoId === p.id && l.correcoes.some(c => c.campo === campo));
          return `<td>${val == null || val === ''
            ? (ob ? '<span class="st warn plain">PENDENTE</span>' : '<span class="src">—</span>')
            : `<span class="src">${UI.esc(String(val).slice(0, 22))}</span>${div ? ' <span class="st neg plain" title="valor diverge entre marketplaces">DIV</span>' : ''}${corrigido ? ' <span class="st info plain">✎</span>' : ''}`}</td>`;
        }).join('')}
        <td><span class="rowact"><button class="btn sm ghost" data-act="drawer" data-id="${p.id}">editar master</button></span></td></tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>* obrigatório · campo importado mostra origem no editor · divergência nunca é resolvida sozinha</span></div></div>`;
  }

  /* ---------------- SKU e Vínculos ---------------- */
  function skuVinculos() {
    const eng = window.IMPORTAR ? IMPORTAR.eng : null;
    const obs = eng ? eng.observations : [];
    return `
      <div class="callout" style="margin-top:0">Vínculo por <b>ID → SKU variação → SKU pai → nome (só sugestão)</b>. Conflito de SKU bloqueia; desativar vínculo não apaga o anúncio.</div>
      ${obs.length ? `<div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Anúncio observado</th><th class="nosort">SKU</th><th class="nosort">Vínculo</th><th class="nosort">Product Master</th><th class="nosort">Ações</th></tr></thead><tbody>
      ${obs.map(o => {
        const p = o.produtoId ? allProds().find(x => x.id === o.produtoId) : null;
        const kind = /CONFIRMADO/.test(o.vinculo) ? 'pos' : /SUGERIDO/.test(o.vinculo) ? 'warn' : /DESATIVADO/.test(o.vinculo) ? '' : 'neg';
        return `<tr><td><span class="tmain">${UI.esc(o.nome)}</span><span class="tsub">item ${o.item_id}</span></td>
          <td><span class="src">${o.skuPai || '—'} · ${o.skuVariacao || '—'}</span></td>
          <td><span class="st ${kind} plain">${UI.esc(o.vinculo)}</span></td>
          <td>${p ? UI.esc(p.sku) : '<span class="src">sem correspondência</span>'}</td>
          <td><span class="rowact">${!/DESATIVADO/.test(o.vinculo) && o.produtoId ? `<button class="btn sm ghost" data-act="desvinc" data-id="${o.id}">desativar vínculo</button>` : ''}</span></td></tr>`;
      }).join('')}
      </tbody></table></div>` : `<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum anúncio importado ainda</b>Importe o cadastro em Importar Cadastro — o vínculo aparece aqui para revisão humana.</div></div>`}`;
  }

  /* ---------------- Anúncio Master ---------------- */
  function anuncioMaster() {
    const eng = window.IMPORTAR ? IMPORTAR.eng : null;
    const porProduto = {};
    if (eng) for (const o of eng.observations.filter(x => x.produtoId && /CONFIRMADO/.test(x.vinculo)))
      (porProduto[o.produtoId] = porProduto[o.produtoId] || []).push(o);
    const ids = Object.keys(porProduto);
    return `
      <div class="callout" style="margin-top:0">O Anúncio Master é <b>referência estratégica</b> (vendas pagas → unidades → conversão → CTR → estabilidade → devolução → margem). A confirmação é <b>sempre humana</b> — nunca automática — e ele <b>não sobrescreve</b> preço, estoque, título, categoria, mídia ou logística de nenhuma loja.</div>
      ${ids.length ? ids.map(pid => {
        const p = allProds().find(x => x.id === pid);
        const sug = V8IMP.suggestMaster(eng, pid);
        const link = eng.masterLinks.find(l => l.produtoId === pid);
        return `<div class="ctxcard" style="margin-top:10px">
          <div class="h"><b>${UI.esc(p ? p.nome : pid)}</b><span class="st ${sug.estado === 'MASTER CONFIRMADO MANUALMENTE' ? 'pos' : sug.estado === 'MASTER BLOQUEADO POR CONFLITO' ? 'neg' : 'info'} plain">${UI.esc(sug.estado)}</span></div>
          ${(sug.ranking || []).map((r, i) => `<div class="ctxitem">
            <span>${i + 1}º · item ${r.item_id} ${link && link.itemId === r.item_id ? '<span class="st pos plain">MASTER</span>' : ''}</span>
            <span>${UI.brl(r.vendasPagas)} · conv ${r.conversao ?? '—'}% · CTR ${r.ctr ?? '—'}%
              <button class="linklike" data-act="aprovarMaster" data-pid="${pid}" data-item="${r.item_id}">definir como master</button></span></div>`).join('')}
          ${link && link.itemId ? `<div style="margin-top:6px"><button class="btn sm ghost" data-act="removerMaster" data-pid="${pid}">remover como Master (anúncio permanece)</button></div>` : ''}
          ${sug.motivo ? `<p class="src" style="margin-top:6px">${UI.esc(sug.motivo)}</p>` : ''}
        </div>`;
      }).join('') : `<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum produto com anúncios vinculados</b>Importe cadastro/performance e confirme vínculos de SKU — o master exige vínculo confiável e revisão humana.</div></div>`}`;
  }

  /* ---------------- Importar Cadastro (dentro do Catálogo) ---------------- */
  function importarCadastro() {
    const eng = window.IMPORTAR ? IMPORTAR.eng : null;
    const fontes = eng ? V8IMP.areaSources(eng, ['catalogo']) : [];
    const OPCOES = [['Carregar cadastro de produtos Shopee', 'Referência: Shopee_mass_upload_2026-07-05_basic_template.xlsx / mass_update_parent_sku'],
      ['Atualizar produtos existentes', 'reimportação atualiza por chave natural — nunca duplica por diferença de nome'],
      ['Importar variações', 'SKU de variação vincula por ID → SKU; conflito bloqueia'],
      ['Importar atributos', 'campos importados mostram origem e nunca são sobrescritos em silêncio'],
      ['Importar preços e estoque', 'valores viram versão; o anterior é preservado'],
      ['Criar rascunhos internos', 'linhas sem correspondência viram candidatos — nada publicado externamente']];
    return `
      <div class="callout" style="margin-top:0">Fluxo: marketplace → escopo (Grupo→Empresa→CNPJ→Loja→Conta) → arquivo do computador → detecção de abas e campos → prévia → vínculos e duplicidades → conflitos → staging → <b>aplicar só após confirmação humana</b>. Camada bruta, arquivo original, mapeamento, hash, usuário e data são preservados.</div>
      <div class="obpick" style="margin-top:12px">
        ${OPCOES.map(([lbl, dica]) => `<button data-act="upcat" data-dica="${UI.esc(dica)}">▤ <b>${lbl}</b><br><span class="src">${UI.esc(dica)}</span></button>`).join('')}
        <button data-act="vertemplate">▤ <b>Revisar campos do template</b><br><span class="src">colunas reconhecidas pelo perfil SHOPEE_PARENT_SKU / SHOPEE_PRODUCT_BASIC_INFO</span></button>
      </div>
      <div class="sect-h"><span class="h2">Importações de cadastro aplicadas</span><span class="src">${fontes.length} fonte(s)</span></div>
      ${fontes.length ? fontes.slice().reverse().map(r => `<div class="metric-row"><span class="lbl">${UI.esc(r.arquivo)}</span>
        <span class="val"><span class="src">${r.ultimaAtualizacao} · ${r.linhas} linha(s) · ${r.duplicidadesEvitadas} dup. evitada(s) · ${UI.esc(r.usuario)}</span>
        <button class="linklike" data-act="verbrutos" data-id="${r.batchId}" style="margin-left:8px">brutos</button>
        <button class="linklike" data-act="vermapa" data-id="${r.batchId}">mapeamento</button></span></div>`).join('')
      : '<p class="src">nenhuma importação de cadastro ainda — o upload nasce aqui dentro, com XLSX, XLS, CSV ou ZIP reais.</p>'}`;
  }

  /* ---------------- Campos de Cadastro Recebidos (10.E.2.2) ----------------
     Todo campo da planilha de cadastro fica acessível AQUI, mesmo que ainda
     não exista na interface padrão — com destino Product Master / Anúncio /
     Variação e status. Exige CATALOG_RAW_FIELDS_VIEW. */
  function camposCadastro() {
    if (!V8IMP.canData(papel(), 'CATALOG_RAW_FIELDS_VIEW'))
      return `<div class="panel"><div class="empty"><b>Sem permissão</b>Ver campos brutos de cadastro exige CATALOG_RAW_FIELDS_VIEW.</div></div>`;
    const eng = window.IMPORTAR ? IMPORTAR.eng : null;
    const batchIds = eng ? eng.batches.filter(b => ['catalogo', 'performance'].includes(b.det.destino)).map(b => b.id) : [];
    const cat = eng ? V8IMP.fieldCatalog(eng).filter(c => c.batchIds.some(id => batchIds.includes(id))) : [];
    const destinoDe = c => c.entidade === 'Produto Master' ? 'Product Master' : c.entidade === 'Variação' ? 'Variação' : c.entidade === 'Anúncio' ? 'Anúncio Shopee' : (c.entidade || '—');
    return `
      <div class="callout" style="margin-top:0">Campos recebidos no cadastro, separados por destino: <b>Product Master</b> (verdade interna) · <b>Anúncio Shopee</b> (específico do canal) · <b>Variação</b> (SKU, preço, estoque). Nada some — campo sem tela padrão fica preservado e mapeável.</div>
      ${cat.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Campo original</th><th class="nosort">Exemplo</th><th class="nosort">Destino</th><th class="nosort">Campo interno</th><th class="nosort">Status</th><th class="nosort">Ação</th></tr></thead><tbody>
      ${cat.map(c => `<tr>
        <td class="tmain">${UI.esc(c.coluna)}</td>
        <td><span class="src">${UI.esc(String(c.exemplo ?? '—').slice(0, 24))}</span></td>
        <td>${c.entidade ? `<span class="kbd">${UI.esc(destinoDe(c))}</span>` : '<span class="src">—</span>'}</td>
        <td><span class="src">${UI.esc(c.campoNormalizado || '—')}</span></td>
        <td>${c.status === 'utilizado' ? '<span class="st pos plain">UTILIZADO</span>' : c.status === 'aguardando mapeamento' ? '<span class="st warn plain">PENDENTE</span>' : `<span class="st info plain">${UI.esc(c.status.toUpperCase().slice(0, 22))}</span>`}</td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="gocampos">gerenciar em Base de Dados →</button></span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhum cadastro importado ainda</b>Importe em Importar Cadastro — todos os campos aparecem aqui com destino.</div></div>'}`;
  }

  /* ---------------- Edição em Massa ---------------- */
  const BULK_CAMPOS = [['titulo', 'Título'], ['preco', 'Preço'], ['precoPromo', 'Preço promocional'], ['estoque', 'Estoque'],
    ['marca', 'Marca'], ['pesoEmbaladoKg', 'Peso (kg)'], ['descricao', 'Descrição'], ['tagsInternas', 'Tags internas']];
  function edicaoMassa() {
    const cat = CAT.eng();
    const jobs = cat.bulkJobs;
    return `
      <div class="callout" style="margin-top:0">Fluxo obrigatório: selecionar → escopo → campo → valor anterior × novo → conflitos → prévia → <b>job interno com confirmação</b> → auditoria → rollback. Nunca dispara escrita externa.</div>
      <div class="fbar" style="margin-top:12px">
        <span class="src">${CAT.lsel.size ? CAT.lsel.size + ' anúncio(s) selecionado(s) na aba Anúncios' : 'selecione anúncios na aba Anúncios (checkbox) e volte aqui'}</span>
        <span style="flex:1"></span>
        <button class="btn sm primary" data-act="lbulk" ${CAT.lsel.size ? '' : 'disabled title="Selecione anúncios primeiro na aba Anúncios."'}>iniciar edição em massa</button>
      </div>
      <div class="sect-h"><span class="h2">Jobs de edição em massa</span><span class="src">${jobs.length} job(s) · todos reversíveis</span></div>
      ${jobs.length ? `<div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Job</th><th class="nosort">Campo</th><th class="nosort">Itens</th><th class="nosort">Status</th><th class="nosort">Autor</th><th class="nosort"></th></tr></thead><tbody>
      ${jobs.slice().reverse().map(j => `<tr>
        <td><span class="tmain">${j.id}</span><span class="tsub">${j.em} · ${UI.esc(j.externo)}</span></td>
        <td><span class="kbd">${j.campo}</span> → ${UI.esc(String(j.valorNovo))}</td>
        <td>${j.itens.length} aplicado(s) · ${j.pulados} pulado(s)</td>
        <td>${UI.stBadge(j.status)}</td><td><span class="src">${UI.esc(j.autor)}</span></td>
        <td><span class="rowact">${j.status === 'APLICADO' ? `<button class="btn sm danger" data-act="bulkroll" data-id="${j.id}">rollback</button>` : ''}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="src">nenhum job ainda.</p>'}`;
  }

  /* ---------------- Duplicar e Adaptar ---------------- */
  function duplicarAdaptar() {
    const cat = CAT.eng();
    const adaptados = cat.listings.filter(l => l.adaptacao && !l.arquivado);
    return `
      <div class="callout" style="margin-top:0"><b>Duplicar ou adaptar cria uma cópia interna (rascunho).</b> O anúncio original nunca é alterado nem apagado. Publicação externa: ${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)} até integração oficial + aprovação humana.</div>
      <div class="fbar" style="margin-top:12px">
        <span class="src">${CAT.lsel.size ? CAT.lsel.size + ' anúncio(s) selecionado(s)' : 'selecione anúncios na aba Anúncios'}</span>
        <span style="flex:1"></span>
        <button class="btn sm" data-act="ldup" ${CAT.lsel.size ? '' : 'disabled title="Selecione anúncios primeiro."'}>Duplicar anúncio</button>
        <button class="btn sm primary" data-act="ladapt" ${CAT.lsel.size ? '' : 'disabled title="Selecione anúncios primeiro."'}>Adaptar para outro marketplace</button>
      </div>
      <div class="sect-h"><span class="h2">Adaptações criadas</span><span class="src">cada uma declara o que foi levado, adaptado, pendente e incompatível</span></div>
      ${adaptados.length ? adaptados.map(l => `<div class="ctxcard" style="margin-top:8px">
        <div class="h"><b>${UI.esc(l.titulo)}</b><span class="st info plain">RASCUNHO · ${UI.esc(l.mktNome)}</span></div>
        <div class="ctxitem"><span>De</span><span class="src">${UI.esc(l.adaptacao.de)} (original intacto)</span></div>
        <div class="ctxitem"><span>Levado</span><span class="src">${UI.esc(l.adaptacao.levado.join(' · '))}</span></div>
        <div class="ctxitem"><span>Adaptado</span><span class="src">${UI.esc(l.adaptacao.adaptado.join(' · '))}</span></div>
        <div class="ctxitem"><span>Pendente (humano)</span><span class="src">${l.adaptacao.pendente.length ? UI.esc(l.adaptacao.pendente.join(' · ')) : 'nada'}</span></div>
        ${l.adaptacao.incompativel.length ? `<div class="ctxitem"><span>Incompatível</span><span class="src">${UI.esc(l.adaptacao.incompativel.join(' · '))}</span></div>` : ''}
        <div class="ctxitem"><span>Regra · fonte · confiança</span><span class="src">${UI.esc(l.adaptacao.regra)} · ${UI.esc(l.adaptacao.fonteRegra)} · ${UI.esc(l.adaptacao.confianca)}</span></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn sm" data-act="editor" data-id="${l.id}">completar no editor</button>
          <button class="btn sm ghost" data-act="canceldraft" data-id="${l.id}">cancelar rascunho</button></div>
      </div>`).join('') : '<p class="src">nenhuma adaptação criada ainda.</p>'}`;
  }

  /* ---------------- Saúde e Pendências ---------------- */
  function saude() {
    const cat = CAT.eng();
    const filas = V8CAT.health(cat);
    const pend = prods().filter(p => p.pendencias.length);
    return `
      <div class="callout" style="margin-top:0">Cada fila abre o anúncio <b>direto no campo certo</b> do editor. Pendência tem dono e destino — nunca morre como alerta.</div>
      <div class="agentes-grid" style="margin-top:12px">
        ${filas.map(f => `<div class="agente"><div class="ag-h"><b>${UI.esc(f.label)}</b><span class="st ${f.itens.length > 5 ? 'warn' : ''} plain">${f.itens.length}</span></div>
          <p class="src" style="margin:6px 0 0">abre em: ${UI.esc(f.aba)}</p>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">
            ${f.itens.slice(0, 3).map(id => `<button class="fchip" data-act="editorAba" data-id="${id}" data-aba="${UI.esc(f.aba)}">${UI.esc(id.replace('L-', ''))}</button>`).join('')}
            ${f.itens.length > 3 ? `<span class="src">+${f.itens.length - 3}</span>` : ''}
          </div></div>`).join('')}
      </div>
      ${pend.length ? `<div class="sect-h"><span class="h2">Pendências de produto</span></div>
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Produto</th><th class="nosort">Pendência</th><th class="nosort"></th></tr></thead><tbody>
        ${pend.flatMap(p => p.pendencias.map(pd => `<tr>
          <td><span class="tmain">${UI.esc(p.nome)}</span><span class="tsub">${p.sku}</span></td>
          <td><span class="st warn plain">${UI.esc(pd)}</span></td>
          <td><span class="rowact"><button class="btn sm" data-act="drawer" data-id="${p.id}">resolver</button></span></td></tr>`)).join('')}
      </tbody></table></div>` : ''}`;
  }

  /* ---------------- Comparar Marketplaces ---------------- */
  function compararMkts() {
    const cat = CAT.eng();
    const pid = CAT.cmpPid || prods()[0].id;
    const cmp = V8CAT.compareMkts(cat, pid);
    return `
      <div class="fbar" style="margin-top:0">
        <select class="select" data-act="cmppid">${prods().map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${UI.esc(p.nome)} (${p.sku})</option>`).join('')}</select>
        <span class="src">o mesmo produto em cada canal — onde vende mais, onde está incompleto, onde diverge</span></div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Campo</th>${cmp.listings.map(l => `<th class="nosort">${UI.esc(l.mktNome)}<span class="tsub" style="text-transform:none">${UI.esc(l.status)}</span></th>`).join('')}<th class="nosort">Divergência</th></tr></thead><tbody>
      ${cmp.rows.map(r => `<tr><td class="tmain">${UI.esc(r.campo)}</td>
        ${r.valores.map(v => `<td>${v.valor != null ? UI.esc(String(v.valor)) : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span>`}</td>`).join('')}
        <td>${r.divergente ? '<span class="st warn plain">DIVERGE</span>' : '<span class="src">—</span>'}</td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>divergências: ${cmp.divergencias.join(', ') || 'nenhuma'} · dados rotulados por fonte</span></div></div>
      ${cmp.oportunidades.length ? `<div class="panel" style="margin-top:12px"><div class="sect-h" style="margin-top:0"><span class="h2">Leitura do Head</span></div>
        ${cmp.oportunidades.map(o => `<div class="exec-li"><span class="sig info"></span><div class="t"><b>${UI.esc(o)}</b></div></div>`).join('')}</div>` : ''}`;
  }

  /* ---------------- Histórico e Versões ---------------- */
  function historicoVersoes() {
    const cat = CAT.eng();
    const evs = cat.timeline.slice().reverse().slice(0, 40);
    const vers = UI.state.versions.slice().reverse().slice(0, 20);
    return `
      <div class="callout" style="margin-top:0">Timeline por produto, variação e anúncio. Comparação entre versões mostra anterior × atual, autor, origem e data. <b>Nunca afirmamos causalidade sem evidência suficiente.</b></div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel"><div class="sect-h" style="margin-top:0"><span class="h2">Timeline do catálogo</span><span class="src">${cat.timeline.length} evento(s)</span></div>
          ${evs.map(e => `<div class="exec-li"><span class="sig"></span><div class="t"><b>${UI.esc(e.tipo)}</b><span>${UI.esc(e.ref)} · ${UI.esc(e.detalhe)} · ${e.em} · ${UI.esc(e.autor)}</span></div></div>`).join('') || '<p class="src">sem eventos ainda.</p>'}
        </div>
        <div class="panel"><div class="sect-h" style="margin-top:0"><span class="h2">Versões do Product Master</span><span class="src">${UI.state.versions.length} versão(ões)</span></div>
          ${vers.map(v => `<div class="exec-li"><span class="sig info"></span><div class="t"><b>${UI.esc(v.campo)}: "${UI.esc(v.antes ?? '—')}" → "${UI.esc(v.depois)}"</b><span>${UI.esc(v.autor)} · ${UI.esc(v.origem)} · ${v.em}</span></div></div>`).join('') || '<p class="src">edite o master ou um anúncio e a trilha aparece aqui.</p>'}
        </div>
      </div>`;
  }

  /* ---------------- Fontes e Arquivos ---------------- */
  function fontesArquivos() {
    const eng = window.IMPORTAR ? IMPORTAR.eng : null;
    const rows = eng ? V8IMP.sourcesTable(eng).filter(r => ['catalogo', 'performance'].includes(r.areaDestino)) : [];
    return `
      <div class="fbar" style="margin-top:0">
        <button class="btn sm primary" data-act="upcat">Atualizar dados do catálogo (upload local)</button>
        <button class="btn sm ghost" data-act="gofontes">Fontes e Histórico completo →</button></div>
      ${rows.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr>
        <th class="nosort">Arquivo</th><th class="nosort">Área</th><th class="nosort">Status</th><th class="nosort">Linhas</th><th class="nosort">Última atualização</th><th class="nosort"></th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr><td class="tmain">${UI.esc(r.arquivo)}</td><td><span class="kbd">${UI.esc(r.areaDestino)}</span></td>
        <td>${UI.stBadge(r.status)}</td><td>${r.linhas}</td><td><span class="src">${r.ultimaAtualizacao}</span></td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="verbrutos" data-id="${r.batchId}">brutos</button></span></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="panel" style="margin-top:12px"><div class="empty"><b>Nenhuma fonte do catálogo</b>Todo arquivo importado aqui preserva camada bruta, aba original, mapeamento, hash, usuário e data/hora.</div></div>'}`;
  }

  /* =============================================================
     EDITOR COMPLETO DE ANÚNCIO — mesma linguagem operacional da
     Shopee: abas de cadastro, mídia, variações, vendas, fiscal,
     logística, performance e comparação. Salvar edita SÓ este
     anúncio; o master e os outros marketplaces ficam intactos.
     ============================================================= */
  const EDITOR_ABAS = ['Informação Básica', 'Especificações', 'Descrição', 'Informações de Vendas', 'Economia do Produto',
    'Variações', 'Lista de Variações', 'Fotos e Vídeos', 'Informações Fiscais', 'Envio e Logística', 'Outros',
    'Performance Comercial', 'Comparar Marketplaces', 'Histórico e Auditoria'];

  CAT.openEditor = function (listingId, aba, campoFoco) {
    const cat = CAT.eng();
    const l = lst(listingId);
    if (!l) return;
    CAT.edId = listingId; CAT.edAba = aba && EDITOR_ABAS.includes(aba) ? aba : (CAT.edAba && EDITOR_ABAS.includes(CAT.edAba) ? CAT.edAba : 'Informação Básica');
    const p = allProds().find(x => x.id === l.produtoId);
    const V = campo => V8CAT.valorDe(cat, l, campo);
    const estadoCampo = campo => {
      const c = l.correcoes.some(x => x.campo === campo);
      const div = (V8CAT.masterVsListings(cat, p.id).find(r => r.campo === campo) || {}).conflito;
      const importado = l.fonte !== 'NORMALIZED_INTERNAL_DATA' && ['titulo', 'preco', 'estoque'].includes(campo);
      return `${c ? '<span class="st info plain">CORRIGIDO MANUALMENTE</span>' : ''}${div ? ' <span class="st neg plain">DIVERGENTE ENTRE MARKETPLACES</span>' : ''}${importado ? ` <span class="st plain" title="origem do valor">${UI.esc(l.fonte)}</span>` : ''}`;
    };
    const einp = (campo, label, val, opts) => {
      opts = opts || {};
      const vazio = val == null || val === '';
      return `<label style="display:block;margin-top:10px" ${campoFoco === campo ? 'data-foco="1"' : ''}>
        <span class="eyebrow">${label}${opts.ob ? ' *' : ''}</span> ${vazio && opts.ob ? '<span class="st warn plain">CAMPO PENDENTE</span>' : ''} ${estadoCampo(campo)}<br>
        <input class="input ${campoFoco === campo ? 'foco' : ''}" style="width:100%;margin-top:4px" type="${opts.tipo || 'text'}" data-efield="${campo}" value="${UI.esc(val ?? '')}" placeholder="${vazio ? (opts.ob ? 'obrigatório — informe para destravar' : 'opcional') : ''}"></label>`;
    };
    const salvarBar = `<div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn primary" data-act="esave">Salvar (só ${UI.esc(l.mktNome)} — versiona)</button>
      <button class="btn ghost" onclick="UI.closeModal()">fechar</button>
      <span class="src" style="align-self:center">editar aqui não toca outros marketplaces nem o Product Master</span></div>`;

    let corpo = '';
    const A = CAT.edAba;
    if (A === 'Informação Básica') corpo = `
      ${einp('titulo', 'Título do anúncio', V('titulo'), { ob: true })}
      ${einp('nomeProduto', 'Nome do produto (master)', p.nome)}
      ${einp('categoria', 'Categoria', V('categoria') ?? p.categoria, { ob: true })}
      ${einp('marca', 'Marca', V('marca') ?? p.master.marca, { ob: true })}
      ${einp('modelo', 'Modelo', V('modelo'))}
      ${einp('tagsInternas', 'Tags internas', V('tagsInternas'))}
      <dl class="kv" style="margin-top:12px">
        <dt>Status de publicação</dt><dd>${UI.stBadge(l.status)}${l.motivo ? ' · ' + UI.esc(l.motivo) : ''}</dd>
        <dt>Status interno</dt><dd>${l.interno ? 'RASCUNHO INTERNO' : 'projeção de anúncio do canal'}</dd>
        <dt>ID externo</dt><dd>${l.itemIdExterno ? UI.esc(l.itemIdExterno) + ' · <span class="src">link externo disponível quando houver integração oficial</span>' : '<span class="src">sem ID externo — anúncio ainda não publicado</span>'}</dd>
      </dl>${salvarBar}`;
    else if (A === 'Especificações') corpo = `
      ${einp('marca', 'Marca', V('marca') ?? p.master.marca, { ob: true })}
      ${einp('material', 'Material', V('material') ?? p.master.material, { ob: true })}
      ${einp('cor', 'Cor', V('cor'))}
      ${einp('dimensoes', 'Dimensões (LxAxC)', V('dimensoes'))}
      ${einp('pesoEmbaladoKg', 'Peso (kg)', V('pesoEmbaladoKg') ?? p.master.pesoEmbaladoKg, { ob: true, tipo: 'number' })}
      ${einp('garantia', 'Garantia', V('garantia'))}
      ${einp('ean', 'Código de barras / EAN / GTIN', V('ean'), { ob: true })}
      ${einp('quantidadeKit', 'Quantidade por kit', V('quantidadeKit'), { tipo: 'number' })}
      <p class="src" style="margin-top:8px">atributos obrigatórios variam por marketplace e categoria — pendências aparecem em Saúde e Pendências.</p>${salvarBar}`;
    else if (A === 'Descrição') corpo = `
      ${einp('descricaoCurta', 'Descrição curta', V('descricaoCurta'))}
      <label style="display:block;margin-top:10px"><span class="eyebrow">Descrição completa</span> ${estadoCampo('descricao')}<br>
        <textarea class="input" style="width:100%;margin-top:4px;min-height:120px" data-efield="descricao">${UI.esc(V('descricao') ?? p.master.descricao ?? '')}</textarea></label>${salvarBar}`;
    else if (A === 'Informações de Vendas') {
      const si = V8CAT.salesInfo(cat, l);
      corpo = `
      ${einp('preco', 'Preço (R$)', V('preco'), { ob: true, tipo: 'number' })}
      ${einp('precoPromo', 'Preço promocional (R$)', l.precoPromo, { tipo: 'number' })}
      ${einp('estoque', 'Estoque', l.estoque, { ob: true, tipo: 'number' })}
      ${einp('qtdMaxPedido', 'Quantidade máxima por pedido', V('qtdMaxPedido'), { tipo: 'number' })}
      <dl class="kv" style="margin-top:12px">
        <dt>Custo estimado</dt><dd>${UI.brl(si.custo)}</dd>
        <dt>Comissão · taxa fixa · imposto</dt><dd>${UI.brl(si.comissao)} · ${UI.brl(si.taxaFixa)} · ${UI.brl(si.imposto)}</dd>
        <dt>Margem bruta · líquida</dt><dd>${si.margemBruta ?? '—'}% · <b>${si.margemLiquida ?? '—'}%</b> <span class="src">(${UI.esc(si.formulaMargem)})</span></dd>
        <dt>Preço mínimo seguro · recomendado</dt><dd>${UI.brl(si.precoMinimoSeguro)} · ${UI.brl(si.precoRecomendado)}</dd>
      </dl>
      ${si.alertas.map(a => `<div class="callout" style="margin-top:8px;border-left-color:var(--warn)">⚠ ${UI.esc(a)}</div>`).join('')}${salvarBar}`;
    }
    else if (A === 'Economia do Produto') {
      /* integração Centro de Custos ↔ Catálogo (10.E.4) */
      if (!window.V8BIZ || !window.bizState) corpo = '<div class="empty"><b>Centro de Custos indisponível</b></div>';
      else {
        const biz = window.bizState();
        const cp = V8BIZ.custoProdutoVigente(biz, p.id);
        const eco = V8BIZ.economiaProduto(biz, { produtoId: p.id, sku: l.skuPai, marketplace: l.marketplace,
          empresaId: p.companyId || 'e1', categoria: p.categoria, preco: V8CAT.valorDe(cat, l, 'preco') || p.precoBase,
          base: { pedidosPagos: 1000, faturamento: 100000, faturamentoItem: 5000, unidadesItem: 40 }, fonteBase: 'base de referência do período' });
        corpo = `
        <p class="sub">Economia deste produto NESTE anúncio (${UI.esc(l.mktNome)}) — cada linha com valor, fonte, regra e tipo. ${cp ? 'Custo vigente desde ' + cp.inicioVigencia + '.' : '<b>Sem custo cadastrado</b> — cadastre para calcular margem.'}</p>
        ${eco.coberturaInsuficiente ? `<div class="callout" style="margin-top:8px;border-left-color:var(--warn)">Cobertura insuficiente: ${eco.faltando.map(UI.esc).join(' · ')}</div>` : ''}
        <div class="tblwrap" style="margin-top:8px"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Item</th><th class="nosort">Valor</th><th class="nosort">Fonte</th><th class="nosort">Regra</th></tr></thead><tbody>
        ${eco.linhas.map(x => `<tr><td class="tmain">${UI.esc(x.item)}</td><td>${x.valor != null ? UI.brl(x.valor) : '<span class="src">SEM DADOS</span>'}</td><td><span class="src">${UI.esc(x.fonte)}</span></td><td><span class="src" style="white-space:normal">${UI.esc((x.regra || '—').slice(0, 70))}</span></td></tr>`).join('')}
        </tbody></table></div>
        <div class="mesa-grid" style="margin-top:10px">
          <div class="mesa-kpi"><span class="k">Margem de contribuição</span><span class="v">${eco.margemContribuicao != null ? eco.margemContribuicaoPct + '%' : 'SEM DADOS'}</span><span class="f">preço − variáveis</span></div>
          <div class="mesa-kpi"><span class="k">Margem líquida estimada</span><span class="v">${eco.margemLiquidaEstimadaPct != null ? eco.margemLiquidaEstimadaPct + '%' : 'SEM DADOS'}</span><span class="f">estimada — não é lucro real</span></div>
          <div class="mesa-kpi"><span class="k">Preço mínimo seguro</span><span class="v">${eco.precoMinimoSeguro != null ? UI.brl(eco.precoMinimoSeguro) : 'SEM DADOS'}</span><span class="f">custo + taxas + margem mínima</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn sm primary" data-act="ecocusto" data-pid="${p.id}">Editar custo do produto</button>
          <button class="btn sm ghost" data-act="gocustos">abrir Centro de Custos →</button>
        </div>`;
      }
    }
    else if (A === 'Variações' || A === 'Lista de Variações') corpo = `
      <p class="sub">Variações do Product Master projetadas neste anúncio. SKU duplicado gera conflito explícito.</p>
      <div class="tblwrap" style="margin-top:8px"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Variação</th><th class="nosort">SKU</th><th class="nosort">Cód. barras</th><th class="nosort">Preço</th><th class="nosort">Estoque</th><th class="nosort">Vendidos</th><th class="nosort">Status</th><th class="nosort"></th></tr></thead><tbody>
      ${(p.variacoes || []).map(v => `<tr ${v.arquivada ? 'style="opacity:.5"' : ''}>
        <td class="tmain">${UI.esc(v.nome)}<span class="tsub">${UI.esc(v.tipo)}</span></td>
        <td><span class="kbd">${UI.esc(v.sku)}</span></td><td><span class="src">${v.codigoBarras || 'SEM EAN'}</span></td>
        <td>${UI.brl(v.preco)}</td><td>${v.estoque ?? '—'}</td><td>${v.vendidos}</td>
        <td>${v.arquivada ? 'ARQUIVADA' : UI.esc(v.status)}</td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="editvar" data-pid="${p.id}" data-vid="${v.id}">editar</button></span></td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn sm" style="margin-top:10px" data-act="addvar" data-id="${p.id}">adicionar variação</button>`;
    else if (A === 'Fotos e Vídeos') {
      const fotos = V8CAT.fotosDe(cat, l.id);
      corpo = `
      <div class="fbar" style="margin-top:0">
        <button class="btn sm primary" data-act="eaddfoto" data-lid="${l.id}">Adicionar fotos do computador</button>
        <span class="src">arraste e solte também funciona · mídia deste anúncio NÃO altera outros marketplaces</span></div>
      <div class="media-grid" style="margin-top:10px">
        ${fotos.map(({ media: m, uso }) => `<div class="media-card">
          <div class="media-thumb">${m.dataUrl ? `<img src="${m.dataUrl}" alt="${UI.esc(m.arquivo)}">` : m.tipo === 'video' ? '▶' : '▦'}</div>
          <b>${UI.esc(m.arquivo)}</b>
          <span class="src">${uso.principal ? 'FOTO PRINCIPAL' : 'posição ' + (uso.posicao + 1)} · ${UI.esc(m.origem)}</span>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            ${uso.principal ? '' : `<button class="btn sm ghost" data-act="eprincipal" data-lid="${l.id}" data-mid="${m.id}">definir principal</button>`}
            <button class="btn sm ghost" data-act="eremfoto" data-lid="${l.id}" data-mid="${m.id}">remover do anúncio</button>
            <button class="btn sm ghost" data-act="mduso" data-id="${m.id}">onde é usada</button>
          </div></div>`).join('') || '<div class="empty" style="grid-column:1/-1"><b>SEM FOTO neste anúncio</b>Adicionar do computador ou reaproveitar da biblioteca — a mídia permanece no Product Master.</div>'}
      </div>`;
    }
    else if (A === 'Informações Fiscais') corpo = `
      ${einp('ncm', 'NCM', V('ncm') ?? p.master.ncm)}
      ${einp('cst', 'CST', V('cst'))}
      ${einp('csosn', 'CSOSN', V('csosn'))}
      ${einp('origemFiscal', 'Origem', V('origemFiscal'))}
      ${einp('ean', 'EAN/GTIN', V('ean'), { ob: true })}
      <p class="src" style="margin-top:8px">dados obrigatórios variam por categoria — o Head marca pendência, nunca inventa valor fiscal.</p>${salvarBar}`;
    else if (A === 'Envio e Logística') corpo = `
      ${einp('pesoEmbaladoKg', 'Peso embalado (kg)', V('pesoEmbaladoKg') ?? p.master.pesoEmbaladoKg, { ob: true, tipo: 'number' })}
      ${einp('alturaCm', 'Altura embalada (cm)', V('alturaCm'), { tipo: 'number' })}
      ${einp('larguraCm', 'Largura embalada (cm)', V('larguraCm'), { tipo: 'number' })}
      ${einp('comprimentoCm', 'Comprimento embalado (cm)', V('comprimentoCm'), { tipo: 'number' })}
      ${einp('prazoProducao', 'Prazo de produção (dias)', V('prazoProducao'), { tipo: 'number' })}
      ${einp('prazoPostagem', 'Prazo de postagem (dias)', V('prazoPostagem'), { tipo: 'number' })}
      <dl class="kv" style="margin-top:12px">
        <dt>Full / fulfillment</dt><dd>${window.IMPORTAR && V8IMP.stockView(IMPORTAR.eng, {}).atual.find(s => s.sku === l.skuPai) ? 'estoque Full observado: ' + V8IMP.stockView(IMPORTAR.eng, {}).atual.filter(s => s.sku === l.skuPai).map(s => s.armazem + ' (' + s.disponivel + ')').join(', ') : '<span class="src">SEM DADOS de armazém — importe o Current Inventory Report</span>'}</dd>
        <dt>Restrições logísticas</dt><dd>${p.tipo === 'SOB_ENCOMENDA' ? '<span class="st warn plain">sob encomenda — validar modalidade por canal</span>' : '<span class="src">nenhuma registrada</span>'}</dd>
      </dl>${salvarBar}`;
    else if (A === 'Outros') corpo = `
      ${einp('statusInterno', 'Status interno', V('statusInterno'))}
      ${einp('observacoes', 'Observações da equipe', V('observacoes'))}
      <dl class="kv" style="margin-top:12px">
        <dt>Criado em · atualizado</dt><dd>${l.criadoEm} · ${l.atualizadoEm}</dd>
        <dt>Fonte</dt><dd>${UI.esc(l.fonte)} · ${UI.esc(l.origem)}</dd>
      </dl>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm" data-act="ecorrigir" data-lid="${l.id}">Corrigir campo importado (com motivo)</button>
        <button class="btn sm ghost" data-act="earquivar" data-lid="${l.id}">Arquivar anúncio</button>
      </div>${salvarBar}`;
    else if (A === 'Performance Comercial') {
      const pc = V8CAT.perfComercial(cat, l);
      const rk = V8CAT.rankingDe(cat, l.id);
      corpo = pc.semDados ? `<div class="empty"><b>${UI.esc(D.STATUS.SEM_DADOS)}</b>${UI.esc(pc.nota)}</div>` : `
      <p class="src">fonte: ${UI.esc(pc.fonte)} · período: ${pc.periodo.ini} a ${pc.periodo.fim} · ${UI.esc(pc.granularidade)} · cobertura: ${UI.esc(pc.cobertura)} · confiança: ${UI.esc(pc.confianca)}</p>
      <div class="mesa-grid" style="margin-top:10px">
        ${[['Vendidos total', pc.vendidosTotal], ['Vendidos 7d', pc.vendidos7d], ['Vendidos 30d', pc.vendidos30d], ['Vendidos 90d', pc.vendidos90d],
          ['Faturamento', 'R$ ' + pc.faturamento], ['Pedidos criados', pc.pedidosCriados], ['Pedidos pagos', pc.pedidosPagos], ['Não pagos', pc.naoPagos],
          ['Cancelamentos', pc.cancelamentos], ['Devoluções', pc.devolucoes], ['Impressões', pc.impressoes], ['Cliques', pc.cliques], ['Visitas', pc.visitas],
          ['Ticket médio', pc.ticketMedio != null ? 'R$ ' + pc.ticketMedio : '—'], ['Estoque', l.estoque ?? '—']]
          .map(([k, v]) => `<div class="mesa-kpi"><span class="k">${k}</span><span class="v">${v}</span><span class="f">${UI.esc(pc.fonte)}</span></div>`).join('')}
      </div>
      <dl class="kv" style="margin-top:12px">
        <dt>CTR</dt><dd>${pc.ctr.taxa ?? '—'}% <span class="src">(${UI.esc(pc.ctr.formula)}: ${pc.ctr.numerador} ÷ ${pc.ctr.denominador})</span></dd>
        <dt>Conversão</dt><dd>${pc.conversaoVisitas.taxa ?? '—'}% <span class="src">(${UI.esc(pc.conversaoVisitas.formula)}: ${pc.conversaoVisitas.numerador} ÷ ${pc.conversaoVisitas.denominador})</span> — nunca um % solto</dd>
        <dt>Conversão por clique</dt><dd>${pc.conversaoCliques.taxa ?? '—'}% <span class="src">(${UI.esc(pc.conversaoCliques.formula)})</span></dd>
        <dt>Taxa de devolução</dt><dd>${pc.taxaDevolucao.taxa ?? '—'}% <span class="src">(${UI.esc(pc.taxaDevolucao.formula)})</span></dd>
        <dt>Posição / ranking</dt><dd>${rk ? `#${rk.posicao} em "${UI.esc(rk.palavra)}" · ${UI.esc(rk.fonte)} · ${UI.esc(rk.dataHora)} · ${UI.esc(rk.escopo)} · confiança ${UI.esc(rk.confianca)}<br><span class="src">histórico: ${rk.leitura}${rk.analise ? ' — ' + UI.esc(rk.analise) : ''}</span>` : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)} — sem posição inventada; registre leitura com fonte</span>`}</dd>
      </dl>`;
    }
    else if (A === 'Comparar Marketplaces') {
      const mvl = V8CAT.masterVsListings(cat, p.id);
      corpo = `
      <p class="sub">Product Master (verdade interna) × cada anúncio. Divergência nunca é resolvida sozinha — a ação é sempre sua.</p>
      <div class="tblwrap" style="margin-top:8px"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Campo</th><th class="nosort">Product Master</th>${mvl[0].porMkt.map(x => `<th class="nosort">${UI.esc(x.marketplace)}</th>`).join('')}<th class="nosort">Status</th><th class="nosort">Ação</th></tr></thead><tbody>
      ${mvl.map(r => `<tr><td class="tmain">${UI.esc(r.campo)}</td><td>${UI.esc(String(r.master ?? '—'))}</td>
        ${r.porMkt.map(x => `<td>${x.valor != null ? UI.esc(String(x.valor)) : '<span class="src">—</span>'}</td>`).join('')}
        <td>${r.conflito ? '<span class="st warn plain">DIVERGÊNCIA DETECTADA</span>' : '<span class="st pos plain">OK</span>'}</td>
        <td>${r.acao ? `<button class="linklike" data-act="editorAba" data-id="${l.id}" data-aba="Especificações">${UI.esc(r.acao)}</button>` : '—'}</td></tr>`).join('')}
      </tbody></table></div>`;
    }
    else corpo = `
      <p class="sub">Toda mudança neste anúncio: campo, antes/depois, autor, origem e data. Impacto só é afirmado quando há dado.</p>
      ${V8CAT.versionsCompare(cat, l.id).slice().reverse().map(v => `<div class="exec-li"><span class="sig info"></span>
        <div class="t"><b>${UI.esc(v.campo)}: "${UI.esc(String(v.anterior ?? '—'))}" → "${UI.esc(String(v.atual))}"</b>
        <span>${UI.esc(v.autor)} · ${UI.esc(v.origem)} · ${v.em}</span></div></div>`).join('') || '<p class="src">nenhuma edição ainda — salve um campo e a trilha nasce aqui.</p>'}
      ${l.correcoes.length ? `<div class="sect-h"><span class="h2">Correções manuais (importado preservado)</span></div>
        ${l.correcoes.map(c => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>${UI.esc(c.campo)}: "${UI.esc(String(c.antes))}" → "${UI.esc(String(c.depois))}"</b><span>${UI.esc(c.motivo)} · ${UI.esc(c.autor)} · ${c.em} · ${c.origem}</span></div></div>`).join('')}` : ''}
      ${V8CAT.timelineDe(cat, l.id).slice(-8).reverse().map(e => `<div class="exec-li"><span class="sig"></span><div class="t"><b>${UI.esc(e.tipo)}</b><span>${UI.esc(e.detalhe)} · ${e.em}</span></div></div>`).join('')}`;

    UI.openModal(`<div class="editor">
      <div class="drawer-h" style="margin-bottom:4px"><div>
        <div class="eyebrow">editor de anúncio · ${UI.esc(l.mktNome)} · conta ${UI.esc(l.contaId || '—')} · ${UI.esc(l.fonte)}</div>
        <h2 class="h1" style="font-size:17px">${UI.esc(V('titulo'))}</h2>
        <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">${V8CAT.listingTags(cat, l).map(t => `<span class="st ${t.kind} plain" style="font-size:9.5px">${UI.esc(t.txt)}</span>`).join('')}</div>
      </div><button class="btn ghost sm" onclick="UI.closeModal()">✕ fechar</button></div>
      <div class="tabs" style="flex-wrap:wrap">${EDITOR_ABAS.map(a => `<button class="tab ${a === CAT.edAba ? 'on' : ''}" data-act="eaba" data-aba="${a}">${a}</button>`).join('')}</div>
      <div class="editor-body" style="margin-top:12px">${corpo}</div>
    </div>`);
    UI.$('#modal').onclick = onEditorClick;
    const foco = UI.$('#modal .input.foco'); if (foco) setTimeout(() => foco.focus(), 40);
  };

  function onEditorClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, cat = CAT.eng(), lid = CAT.edId;
    if (act === 'eaba') CAT.openEditor(lid, b.dataset.aba);
    else if (act === 'editorAba') CAT.openEditor(b.dataset.id || lid, b.dataset.aba);
    else if (act === 'esave') {
      const l = lst(lid);
      const campos = UI.$$('#modal [data-efield]');
      let n = 0;
      for (const i of campos) {
        const v = i.type === 'number' ? (i.value === '' ? null : +i.value) : i.value;
        const antes = V8CAT.valorDe(cat, l, i.dataset.efield);
        if (String(antes ?? '') !== String(v ?? '')) {
          const r = V8CAT.editListing(cat, lid, i.dataset.efield, v, { usuario: D.meta.usuario, papel: papel() });
          if (r.blocked) return UI.toast(r.reason, 'err');
          if (r.changed) n++;
        }
      }
      UI.toast(n ? `${n} campo(s) versionado(s) em ${lst(lid).mktNome} — outros marketplaces e o master intactos.` : 'Nada mudou.', n ? 'ok' : '');
      if (n) { CAT.openEditor(lid, CAT.edAba); body(); }
    }
    else if (act === 'eprincipal') { const r = V8CAT.setPrincipal(cat, b.dataset.lid, b.dataset.mid, { usuario: D.meta.usuario, papel: papel() }); if (r.blocked) return UI.toast(r.reason, 'err'); UI.toast('Foto principal alterada — só neste anúncio.', 'ok'); CAT.openEditor(lid, 'Fotos e Vídeos'); }
    else if (act === 'eremfoto') { const r = V8CAT.removeFromListing(cat, b.dataset.lid, b.dataset.mid, { usuario: D.meta.usuario, papel: papel() }); if (r.blocked) return UI.toast(r.reason, 'err'); UI.toast(r.nota, 'ok'); CAT.openEditor(lid, 'Fotos e Vídeos'); }
    else if (act === 'eaddfoto') uploadFoto(b.dataset.lid);
    else if (act === 'mduso') verUsoMidia(b.dataset.id);
    else if (act === 'ecorrigir') modalCorrigirCampo(b.dataset.lid);
    else if (act === 'earquivar') modalArquivarListing(b.dataset.lid);
    else if (act === 'gocustos') { UI.closeModal(); UI.go('custos', 'Economia por Produto'); }
    else if (act === 'ecocusto') {
      const pid2 = b.dataset.pid;
      if (!V8BIZ.canBiz(papel(), 'PRODUCT_COST_EDIT')) return UI.toast(`papel ${papel()} não possui PRODUCT_COST_EDIT.`, 'err');
      const atual = V8BIZ.custoProdutoVigente(window.bizState(), pid2) || {};
      UI.openModal(`<h3 class="h2">Custo do produto</h3>
        <p class="sub" style="margin-top:4px">Alterar cria nova vigência — o custo antigo fica preservado por período.</p>
        ${[['pcCompra', 'Custo de compra/produção (R$)', atual.custoCompra], ['pcEmb', 'Embalagem (R$)', atual.embalagem], ['pcFrete', 'Frete subsidiado (% do preço)', atual.freteSubsidiadoPct], ['pcDev', 'Devolução estimada (R$)', atual.devolucaoEstimado], ['pcMin', 'Margem mínima desejada (%)', atual.margemMinimaPct]].map(([i, l, v]) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${l}</span><br><input class="input" id="${i}" style="width:100%;margin-top:3px" value="${UI.esc(v ?? '')}"></label>`).join('')}
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end"><button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn primary" id="pcOk">Salvar custo</button></div>`);
      UI.$('#pcOk').onclick = () => {
        const g = i => +UI.$('#' + i).value || 0;
        const r = V8BIZ.setProdutoCusto(window.bizState(), pid2, { custoCompra: g('pcCompra'), embalagem: g('pcEmb'), freteSubsidiadoPct: g('pcFrete'), devolucaoEstimado: g('pcDev'), margemMinimaPct: g('pcMin') || 10 }, { usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.toast('Custo salvo — vigência anterior preservada (' + r.vigenciasAnteriores + ' histórica(s)).', 'ok');
        CAT.openEditor(CAT.edId, 'Economia do Produto');
      };
    }
    else if (act === 'editvar' || act === 'addvar') { UI.closeModal(); onClick(e); }
  }

  /* upload REAL de foto do computador (FileReader → dataURL na biblioteca) */
  function uploadFoto(listingId, produtoId) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.jpg,.jpeg,.png,.webp,.gif,.mp4';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const l = listingId ? lst(listingId) : null;
      const pid = l ? l.produtoId : (produtoId || (CAT.midiaF && CAT.midiaF.produto) || prods()[0].id);
      const fr = new FileReader();
      fr.onload = () => {
        const r = V8CAT.addMedia(CAT.eng(), { arquivo: f.name, produtoId: pid, listingId: listingId || null,
          origem: 'IMPORTAÇÃO_MANUAL', pesoKb: Math.round(f.size / 1024), dataUrl: String(fr.result).slice(0, 200000) },
          { usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.toast(`"${f.name}" adicionada ${listingId ? 'a este anúncio' : 'à biblioteca do produto'} — registrada com origem, data e usuário.`, 'ok');
        if (listingId && CAT.edId === listingId) CAT.openEditor(listingId, 'Fotos e Vídeos');
        else body();
      };
      fr.readAsDataURL(f);
    };
    inp.click();
  }

  function verUsoMidia(mediaId) {
    const usos = V8CAT.mediaUsage(CAT.eng(), mediaId);
    const m = CAT.eng().media.find(x => x.id === mediaId);
    UI.openModal(`<h3 class="h2">Onde a mídia é usada · ${UI.esc(m.arquivo)}</h3>
      <p class="sub" style="margin-top:4px">${UI.esc(m.origem)} · ${m.em} · ${UI.esc(m.usuario)} · ${m.dims || '—'} · ${m.pesoKb ? m.pesoKb + ' KB' : '—'}</p>
      ${usos.length ? usos.map(u => `<div class="metric-row"><span class="lbl">${UI.esc(u.marketplace || u.listingId)}</span><span class="val">${u.principal ? 'FOTO PRINCIPAL' : 'posição ' + (u.posicao + 1)}</span></div>`).join('') : '<p class="src">sem uso em anúncio — vive só na biblioteca do Product Master.</p>'}
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
  }

  function modalCorrigirCampo(listingId) {
    UI.openModal(`<h3 class="h2">Correção manual de campo importado</h3>
      <p class="sub" style="margin-top:4px">O valor importado é preservado; a correção vira camada <span class="kbd">MANUAL_CORRECTION</span> com autor, antes/depois e motivo obrigatório.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Campo</span><br>
        <select class="select" id="ccCampo" style="width:100%;margin-top:3px">${['titulo', 'preco', 'estoque', 'ean', 'marca'].map(c => `<option>${c}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Novo valor</span><br><input class="input" id="ccValor" style="width:100%;margin-top:3px"></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Motivo (obrigatório)</span><br><input class="input" id="ccMotivo" style="width:100%;margin-top:3px"></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="ccOk">Registrar correção</button></div>`);
    UI.$('#ccOk').onclick = () => {
      const r = V8CAT.correctListingField(CAT.eng(), listingId, UI.$('#ccCampo').value, UI.$('#ccValor').value.trim(),
        { motivo: UI.$('#ccMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast('Correção registrada — original preservado.', 'ok');
      CAT.openEditor(listingId, 'Histórico e Auditoria');
    };
  }

  function modalArquivarListing(listingId) {
    UI.openModal(`<h3 class="h2">Arquivar anúncio</h3>
      <p class="sub" style="margin-top:4px">Arquivar remove da operação <b>sem apagar histórico, versões nem vendas</b>. Restauração disponível. Motivo obrigatório.</p>
      <input class="input" id="alMotivo" style="width:100%;margin-top:10px" placeholder="ex.: anúncio substituído pela versão com kit">
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn danger" id="alOk">Arquivar com motivo</button></div>`);
    UI.$('#alOk').onclick = () => {
      const r = V8CAT.archiveListing(CAT.eng(), listingId, { motivo: UI.$('#alMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.toast(r.nota, 'ok'); body();
    };
  }

  /* ---------------- drawer do produto ---------------- */
  CAT.openDrawer = function (id, tab) {
    const p = allProds().find(x => x.id === id);
    if (!p) return;
    CAT.drawerId = id; CAT.drawerTab = tab || CAT.drawerTab || 'master';
    const t = CAT.drawerTab;
    const vers = UI.state.versions.filter(v => v.produtoId === id);
    const tabBtn = (k, lbl) => `<button class="tab ${t === k ? 'on' : ''}" data-act="dtab" data-tab="${k}">${lbl}</button>`;
    const inp = (field, label, val, type) => `
      <label style="display:block;margin-top:10px"><span class="eyebrow">${label}</span><br>
      <input class="input" style="width:100%;margin-top:4px" type="${type || 'text'}" data-field="${field}" value="${UI.esc(val ?? '')}" placeholder="${val == null ? 'SEM DADOS — informe para destravar' : ''}"></label>`;

    let bodyHtml = '';
    if (t === 'master') {
      bodyHtml = `
        <p class="sub">Editar aqui <b>versiona</b> o Product Master e reavalia rascunhos. Perfis específicos por marketplace <b>não são sobrescritos</b> — você será avisado.</p>
        ${inp('titulo', 'Título master', p.master.titulo)}
        ${inp('marca', 'Marca', p.master.marca)}
        ${inp('material', 'Material (ficha técnica)', p.master.material)}
        ${inp('pesoEmbaladoKg', 'Peso embalado (kg)', p.master.pesoEmbaladoKg, 'number')}
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn primary" data-act="dsave">Salvar edições (gera versão)</button>
          <button class="btn ghost" data-act="dclose">cancelar</button>
        </div>`;
    } else if (t === 'perfis') {
      const mk = CAT.profileMkt || 'ml';
      const prof = p.mkt[mk];
      bodyHtml = `
        <p class="sub">Perfil <b>independente</b> por canal: editar ${D.MKTS.find(m => m.key === mk).nome} não altera os demais nem o master.</p>
        <div class="fbar">${D.MKTS.map(m => `<button class="fchip ${m.key === mk ? 'on' : ''}" data-act="dprofmkt" data-mkt="${m.key}">${m.nome}</button>`).join('')}</div>
        <dl class="kv"><dt>Status no canal</dt><dd>${UI.stBadge(prof.status)}</dd>
        <dt>Título efetivo</dt><dd>${UI.esc(prof.profile.titulo || p.master.titulo)} <span class="src">(${prof.profile.titulo ? 'específico do canal' : 'herdado do master'})</span></dd></dl>
        ${inp('titulo', 'Título específico deste canal', prof.profile.titulo)}
        ${inp('preco', 'Preço neste canal (R$)', prof.preco, 'number')}
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn primary" data-act="dsaveprof" data-mkt="${mk}">Salvar perfil ${D.MKTS.find(m => m.key === mk).nome}</button>
        </div>`;
    } else if (t === 'matriz') {
      bodyHtml = `
        <p class="sub">Onde este produto está, em que estado e por quê. Publicação externa permanece <b>${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)}</b>.</p>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
          <th class="nosort">Marketplace</th><th class="nosort">Status</th><th class="nosort">Preço</th><th class="nosort">Margem</th><th class="nosort">Ação</th></tr></thead><tbody>
        ${L.publicationMatrix(p).map(r => `<tr>
          <td class="tmain">${r.marketplace}</td>
          <td>${UI.stBadge(r.status)}${r.motivo ? `<span class="tsub">${UI.esc(r.motivo)}</span>` : ''}</td>
          <td>${UI.brl(r.preco)}</td><td>${r.margem == null ? '—' : r.margem + '%'}</td>
          <td>${r.status === 'NAO_PUBLICADO'
            ? `<button class="btn sm" data-act="ddraft" data-mkt="${r.key}">criar rascunho interno</button>`
            : `<button class="btn sm" disabled title="${UI.esc(L.disabledReason('publicar_externo'))}">publicar alteração</button>`}</td>
        </tr>`).join('')}</tbody></table></div>`;
    } else if (t === 'lojascontas') {
      const entries = Object.entries(p.lojas);
      bodyHtml = `
        <p class="sub">Onde este produto opera: estoque, preço, margem e prazo <b>variam por loja</b>; o Product Master continua único. Editar o master não sobrescreve nada daqui sem confirmação.</p>
        ${entries.length ? `
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
          <th class="nosort">Loja</th><th class="nosort">CNPJ</th><th class="nosort">Mkt</th><th class="nosort">Conta</th>
          <th class="nosort">Estoque</th><th class="nosort">Preço</th><th class="nosort">Margem</th><th class="nosort">Prazo</th>
          <th class="nosort">Status</th><th class="nosort">Pendência</th><th class="nosort">Ação</th></tr></thead><tbody>
        ${entries.map(([lid, sl]) => {
          const s = D.scope.lojas.find(x => x.id === lid) || { nome: lid };
          const c = D.scope.cnpjs.find(x => x.id === s.cnpjId) || {};
          const conta = sl.contaId ? (D.scope.contas.find(a => a.id === sl.contaId) || {}).nome : (s.tipo === 'fisica' ? 'venda presencial' : '—');
          return `<tr>
            <td class="tmain">${UI.esc(s.nome)}<span class="tsub">${UI.esc(s.deposito || '')} · resp. ${UI.esc(s.responsavel || '—')}</span></td>
            <td><span class="src">${UI.esc(c.nome || '—')}</span></td>
            <td>${s.marketplace ? UI.esc((D.MKTS.find(m => m.key === s.marketplace) || {}).nome) : 'física'}</td>
            <td><span class="src">${UI.esc(conta)}</span></td>
            <td>${sl.estoque ?? '—'}</td><td>${UI.brl(sl.preco)}</td>
            <td>${L.margemLoja(p, lid) == null ? '—' : L.margemLoja(p, lid) + '%'}</td>
            <td>${sl.prazoDias != null ? sl.prazoDias + 'd' : '—'}</td>
            <td>${UI.stBadge(sl.status)}</td>
            <td>${sl.pendencia ? `<span class="st warn plain">${UI.esc(sl.pendencia)}</span>` : '<span class="src">—</span>'}</td>
            <td><button class="btn sm ghost" data-act="d-lojactx" data-loja="${lid}">focar loja</button></td>
          </tr>`;
        }).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:8px">${entries.length} loja(s) · ${[...new Set(entries.map(([lid]) => (D.scope.lojas.find(x => x.id === lid) || {}).cnpjId))].length} CNPJ(s) · ${UI.esc(D.STATUS.DADO_SIMULADO)}</p>`
        : `<div class="empty"><b>Produto sem presença em loja</b>Use a Expansão (Crescimento) para gerar um draft interno.</div>`}`;
    } else if (t === 'relacoes') {
      const opps = UI.state.opportunities.filter(o => o.produtoId === id && o.status !== 'IGNORADA');
      const exps = UI.state.experiments.filter(x => x.alvo === id);
      const miss = D.missoes.filter(m => m.titulo.includes(p.nome.split(' ')[0]) || m.titulo.includes(p.nome.split(' ').slice(0, 2).join(' ')));
      bodyHtml = `
        <p class="sub">Este produto no resto da operação: Crescimento, Missões, Compliance e Conhecimento — nada vive isolado.</p>
        <div class="sect-h"><span class="h2">Oportunidades (Crescimento)</span></div>
        ${opps.length ? opps.map(o => `<div class="exec-li"><span class="sig ${o.prioridade >= 85 ? 'neg' : 'warn'}"></span>
          <div class="t"><b>${UI.esc(o.tipo)} · prioridade ${o.prioridade}</b><span>${UI.esc(o.evidencia)}</span></div>
          <button class="linklike" data-act="d-goopp" data-id="${o.id}">abrir →</button></div>`).join('')
          : '<p class="src">nenhuma oportunidade aberta para este produto.</p>'}
        <div class="sect-h"><span class="h2">Experimentos</span></div>
        ${exps.length ? exps.map(x => `<div class="exec-li"><span class="sig info" style="background:var(--info)"></span>
          <div class="t"><b>${UI.esc(x.tipo)} · ${x.id} · ${UI.esc(x.status)}</b><span>${UI.esc(x.hipotese)} · parada: ${UI.esc(x.pontoDeParada)}</span></div></div>`).join('')
          : '<p class="src">nenhum experimento com este alvo.</p>'}
        <div class="sect-h"><span class="h2">Missões</span></div>
        ${miss.length ? miss.map(m => `<div class="exec-li"><span class="sig warn"></span>
          <div class="t"><b>${UI.esc(m.titulo)}</b><span>${UI.esc(m.status)} · ${UI.esc(m.agora)}</span></div></div>`).join('')
          : '<p class="src">nenhuma missão ligada a este produto.</p>'}
        <div class="sect-h"><span class="h2">Anúncios importados (vínculo por SKU)</span></div>
        ${window.IMPORTAR && IMPORTAR.eng.observations.filter(o => o.produtoId === id).length
          ? IMPORTAR.eng.observations.filter(o => o.produtoId === id).map(o => `<div class="exec-li"><span class="sig ${/CONFIRMADO/.test(o.vinculo) ? 'pos' : 'warn'}"></span>
              <div class="t"><b>item ${UI.esc(o.item_id)} · ${UI.esc(o.nome)}</b><span>${UI.esc(o.vinculo)} · ${UI.brl(o.vendasPagas)} pagas · ${UI.esc(o.origem)}</span></div>
              <button class="linklike" data-act="d-goimp">revisar vínculo →</button></div>`).join('')
          : '<p class="src">nenhum anúncio importado vinculado a este produto.</p>'}
        <div class="sect-h"><span class="h2">Compliance e pendências</span></div>
        ${p.pendencias.length ? p.pendencias.map(pd => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>${UI.esc(pd)}</b></div></div>`).join('') : '<p class="src">sem pendências.</p>'}
        ${L.publicationMatrix(p).filter(r => r.motivo).map(r => `<div class="exec-li"><span class="sig neg"></span><div class="t"><b>${r.marketplace}: ${UI.esc(D.STATUS.BLOQUEADO)}</b><span>${UI.esc(r.motivo)}</span></div></div>`).join('')}`;
    } else {
      bodyHtml = vers.length ? `
        <p class="sub">Toda edição vira versão: autor, origem, valor anterior e impacto.</p>
        ${vers.slice().reverse().map(v => `<div class="ctxcard" style="margin-top:10px">
          <div class="h"><b>${v.entidade === 'mkt_profile' ? 'Perfil ' + (D.MKTS.find(m => m.key === v.marketplace) || {}).nome : 'Product Master'} · ${UI.esc(v.campo)}</b><span class="src">${v.id} · ${v.em}</span></div>
          <dl class="kv"><dt>Antes</dt><dd>${UI.esc(v.antes ?? '—')}</dd><dt>Depois</dt><dd>${UI.esc(v.depois)}</dd>
          <dt>Autor · origem</dt><dd>${UI.esc(v.autor)} · ${UI.esc(v.origem)}</dd>
          ${v.impacto ? `<dt>Impacto</dt><dd>${v.impacto.rascunhosReavaliados} rascunho(s) reavaliado(s)${v.impacto.perfisPreservados.length ? ' · perfis preservados: ' + v.impacto.perfisPreservados.join(', ') : ''}</dd>` : ''}</dl>
        </div>`).join('')}` :
        `<div class="empty"><b>Sem versões ainda</b>Edite o master ou um perfil e a trilha aparece aqui.</div>`;
    }

    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">${UI.esc(p.sku)} · ${UI.esc(p.categoria)} · ${UI.esc(p.origem)}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(p.nome)}</h2>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          ${p.pendencias.map(pd => `<span class="st warn plain">${UI.esc(pd)}</span>`).join('')}
          <span class="st info plain">readiness ${L.readiness(p)}%</span>
        </div></div>
        <button class="btn ghost sm" data-act="dclose" aria-label="Fechar">✕ fechar</button></div>
      <div class="tabs">${tabBtn('master', 'Product Master')}${tabBtn('lojascontas', `Lojas e Contas (${Object.keys(p.lojas).length})`)}${tabBtn('perfis', 'Perfis por marketplace')}${tabBtn('matriz', 'Matriz de publicação')}${tabBtn('relacoes', 'Relações')}${tabBtn('versoes', `Versões (${vers.length})`)}</div>
      <div style="margin-top:14px">${bodyHtml}</div>`);
    UI.$('#drawer').onclick = onDrawerClick;
  };

  /* ---------------- eventos ---------------- */
  function onInput(e) {
    if (e.target.id === 'catQ') {
      CAT.filters.q = e.target.value;
      const pos = e.target.selectionStart;
      body();
      const q = UI.$('#catQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    }
    else if (e.target.id === 'anQ') {
      CAT.anQ = e.target.value;
      const pos = e.target.selectionStart;
      body();
      const q = UI.$('#anQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    }
    else if (e.target.dataset && e.target.dataset.act === 'anquick') { CAT.anQuick = e.target.value; body(); }
    else if (e.target.dataset && e.target.dataset.act === 'cmppid') { CAT.cmpPid = e.target.value; body(); }
    else if (e.target.dataset && e.target.dataset.act === 'mdprod') { (CAT.midiaF = CAT.midiaF || {}).produto = e.target.value || null; body(); }
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const F = CAT.filters;
    const tgl = (k, v) => { F[k] === v ? delete F[k] : F[k] = v; };
    if (act === 'sub') { CAT.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Catálogo · ' + CAT.sub; render(CAT.sub); }
    else if (act === 'sort') { const k = b.dataset.key; if (CAT.sortKey === k) CAT.sortDir = CAT.sortDir === 'asc' ? 'desc' : 'asc'; else { CAT.sortKey = k; CAT.sortDir = 'asc'; } body(); }
    else if (act === 'f-pend') { F.comPendencia === true ? delete F.comPendencia : F.comPendencia = true; body(); }
    else if (act === 'f-estoque') { tgl('estoqueMax', 10); body(); }
    else if (act === 'f-margem') { tgl('margemMin', 60); body(); }
    else if (act === 'f-ml') { if (F.marketplace === 'ml') { delete F.marketplace; delete F.statusMkt; } else { F.marketplace = 'ml'; F.statusMkt = 'ATIVO'; } body(); }
    else if (act === 'f-clear') { CAT.filters = {}; body(); }
    else if (act === 'adv') openAdvanced();
    else if (act === 'upcat') IMPORTAR.uploadModal({ titulo: 'Carregar cadastro de produtos Shopee', dica: 'Referência: Shopee_mass_upload basic_template / mass_update_parent_sku (XLSX). Vínculo por ID → SKU variação → SKU pai; conflito de SKU bloqueia; nenhum produto é duplicado automaticamente.', onDone: () => render(CAT.sub) });
    else if (act === 'cols') openCols();
    else if (act === 'saveview') openSaveView();
    else if (act === 'loadview') {
      const v = UI.state.scopedViews.find(x => x.id === b.dataset.view);
      if (!v) return;
      /* a visão restaura escopo (CNPJ/loja/conta/mkt/período) + filtros + colunas */
      Object.assign(UI.ctx, v.escopo); V8LOGIC.normalizeCtx(UI.ctx);
      CAT.filters = JSON.parse(JSON.stringify(v.filtros || {}));
      if (v.colunas) CAT.cols = JSON.parse(JSON.stringify(v.colunas));
      if (v.ordenacao) { CAT.sortKey = v.ordenacao.key; CAT.sortDir = v.ordenacao.dir; }
      UI.renderGbar(); UI.refreshBadges();
      UI.toast(`Visão "${v.nome}" aplicada (${v.tipo}) · ${V8LOGIC.scopeLine(UI.ctx)}`, 'ok');
      body();
    }
    else if (act === 'cmpsel') openCompareProdutos([...UI.state.selection]);
    else if (act === 'selrow') { L.toggleSelect(UI.state, b.dataset.id); body(); }
    else if (act === 'selall') { const f = filtered(); f.every(p => UI.state.selection.has(p.id)) ? L.clearSelection(UI.state) : L.selectAllFiltered(UI.state, f); body(); }
    else if (act === 'selclear') { L.clearSelection(UI.state); body(); }
    else if (act === 'bulk') doBulk(b.dataset.bulk);
    else if (act === 'drawer') CAT.openDrawer(b.dataset.id);
    else if (act === 'anmkt') { CAT.anuncioMkt = b.dataset.mkt; body(); }
    else if (act === 'antab') { CAT.anuncioTab = b.dataset.tab; body(); }
    else if (act === 'gocresc') UI.go('crescimento');
    /* ---------- 10.E.3: listings, editor, mídia, massa, adaptação ---------- */
    else if (act === 'editor') CAT.openEditor(b.dataset.id);
    else if (act === 'editorAba') CAT.openEditor(b.dataset.id, b.dataset.aba);
    else if (act === 'anchip') { CAT.anQuick = CAT.anQuick === b.dataset.k ? '' : b.dataset.k; if (!b.dataset.k) { CAT.anQ = ''; CAT.anQuick = ''; } body(); }
    else if (act === 'ancols') {
      UI.openModal(`<h3 class="h2">Colunas da tabela de anúncios</h3>
        <div style="display:grid;gap:8px;margin-top:12px">
          ${Object.keys(CAT.anCols).map(c => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-ancol="${c}" ${CAT.anCols[c] ? 'checked' : ''}> ${c}</label>`).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" id="ancolApply">Aplicar</button></div>`);
      UI.$('#ancolApply').onclick = () => { UI.$$('#modal [data-ancol]').forEach(i => CAT.anCols[i.dataset.ancol] = i.checked); UI.closeModal(); body(); };
    }
    else if (act === 'lsel') { CAT.lsel.has(b.dataset.id) ? CAT.lsel.delete(b.dataset.id) : CAT.lsel.add(b.dataset.id); body(); }
    else if (act === 'lselall') {
      const cat = CAT.eng(), ids = new Set(prods().map(p => p.id));
      const mk = UI.ctx.marketplace || CAT.anuncioMkt;
      const vis = V8CAT.ativos(cat).filter(l => ids.has(l.produtoId) && l.marketplace === mk);
      vis.every(l => CAT.lsel.has(l.id)) ? CAT.lsel.clear() : vis.forEach(l => CAT.lsel.add(l.id));
      body();
    }
    else if (act === 'lselclear') { CAT.lsel.clear(); body(); }
    else if (act === 'lbulk') modalBulkListings();
    else if (act === 'ldup') {
      let n = 0;
      for (const id of CAT.lsel) { const r = V8CAT.duplicateListing(CAT.eng(), id, { usuario: D.meta.usuario, papel: papel() }); if (r.blocked) return UI.toast(r.reason, 'err'); n++; }
      UI.toast(`${n} cópia(s) interna(s) criada(s) como rascunho — originais intactos. Veja em Rascunhos.`, 'ok');
      CAT.lsel.clear(); body();
    }
    else if (act === 'ladapt') modalAdapt();
    else if (act === 'lcmp') {
      const pids = [...new Set([...CAT.lsel].map(id => (lst(id) || {}).produtoId).filter(Boolean))];
      CAT.cmpPid = pids[0]; CAT.sub = 'Comparar Marketplaces'; render(CAT.sub);
    }
    else if (act === 'canceldraft') {
      const r = V8CAT.cancelDraft(CAT.eng(), b.dataset.id, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast('Rascunho cancelado — trilha preservada.', 'ok'); body();
    }
    else if (act === 'bulkroll') {
      const r = V8CAT.bulkRollback(CAT.eng(), b.dataset.id, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast(`Rollback: ${r.restaurados} anúncio(s) restaurados ao valor anterior — auditado.`, 'ok'); body();
    }
    else if (act === 'addvar') modalAddVar(b.dataset.id);
    else if (act === 'editvar') modalEditVar(b.dataset.pid, b.dataset.vid);
    else if (act === 'arcvar') {
      const pid = b.dataset.pid, vid = b.dataset.vid;
      UI.openModal(`<h3 class="h2">Arquivar variação</h3>
        <p class="sub" style="margin-top:4px">Vendas e histórico permanecem. Motivo obrigatório.</p>
        <input class="input" id="avMotivo" style="width:100%;margin-top:10px" placeholder="ex.: tamanho descontinuado">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn danger" id="avOk">Arquivar</button></div>`);
      UI.$('#avOk').onclick = () => {
        const r = V8CAT.archiveVariation(CAT.eng(), pid, vid, { motivo: UI.$('#avMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast(r.nota, 'ok'); body();
      };
    }
    else if (act === 'mdadd') uploadFoto(null, CAT.midiaF && CAT.midiaF.produto);
    else if (act === 'mdtipo') { (CAT.midiaF = CAT.midiaF || {}).tipo = b.dataset.k || null; body(); }
    else if (act === 'mduso') verUsoMidia(b.dataset.id);
    else if (act === 'desvinc') {
      const oid = b.dataset.id;
      UI.openModal(`<h3 class="h2">Desativar vínculo</h3>
        <p class="sub" style="margin-top:4px">O anúncio e o histórico permanecem — só o vínculo com o Product Master é desativado. Motivo obrigatório.</p>
        <input class="input" id="dvMotivo" style="width:100%;margin-top:10px" placeholder="ex.: SKU apontava para o produto errado">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn danger" id="dvOk">Desativar com motivo</button></div>`);
      UI.$('#dvOk').onclick = () => {
        const r = V8IMP.desativarVinculo(IMPORTAR.eng, oid, { motivo: UI.$('#dvMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast(r.nota, 'ok'); body();
      };
    }
    else if (act === 'aprovarMaster') {
      if (!V8CAT.canCat(papel(), 'CATALOG_MASTER_APPROVE')) return UI.toast(`papel ${papel()} não possui CATALOG_MASTER_APPROVE.`, 'err');
      const r = V8IMP.approveMaster(IMPORTAR.eng, b.dataset.pid, b.dataset.item, { papel: papel() === 'ADMIN' ? 'OWNER' : papel(), usuario: D.meta.usuario });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.toast('Anúncio Master confirmado por revisão humana. ' + r.nota, 'ok'); body();
    }
    else if (act === 'removerMaster') {
      const pid = b.dataset.pid;
      UI.openModal(`<h3 class="h2">Remover como Master</h3>
        <p class="sub" style="margin-top:4px">Só o papel de referência é removido — o anúncio continua existindo. Motivo obrigatório.</p>
        <input class="input" id="rmMotivo" style="width:100%;margin-top:10px" placeholder="ex.: nova revisão de portfólio">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn danger" id="rmOk">Remover</button></div>`);
      UI.$('#rmOk').onclick = () => {
        const r = V8IMP.removerMaster(IMPORTAR.eng, pid, { motivo: UI.$('#rmMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() === 'ADMIN' ? 'OWNER' : papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.toast(r.nota, 'ok'); body();
      };
    }
    else if (act === 'vertemplate') {
      const perfil = V8IMP.PROFILES.SHOPEE_PARENT_SKU;
      UI.openModal(`<h3 class="h2">Campos do template de cadastro</h3>
        <p class="sub" style="margin-top:4px">Referência: Shopee_mass_upload_2026-07-05_basic_template.xlsx · perfil <span class="kbd">SHOPEE_PARENT_SKU</span> (${perfil.status}).</p>
        ${perfil.assinatura.map(c => `<div class="metric-row"><span class="lbl">${UI.esc(c)}</span><span class="val"><span class="st pos plain">chave do perfil</span></span></div>`).join('')}
        <p class="src" style="margin-top:8px">colunas fora da assinatura são preservadas na camada bruta — nenhuma é descartada.</p>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
    }
    else if (act === 'gofontes') UI.go('importar');
    else if (act === 'gocampos') { IMPORTAR.sub = 'Base de Dados e Mapeamento'; IMPORTAR.bd = 'Campos Recebidos'; UI.go('importar', 'Base de Dados e Mapeamento'); }
    else if (act === 'verbrutos') IMPORTAR.verBrutos(b.dataset.id);
    else if (act === 'vermapa') IMPORTAR.verMapeamento(b.dataset.id);
  }

  /* modal de edição em massa de anúncios (prévia → job → rollback) */
  function modalBulkListings() {
    const ids = [...CAT.lsel];
    if (!ids.length) return UI.toast('Selecione anúncios na aba Anúncios primeiro.', 'err');
    const cat = CAT.eng();
    const escopo = { mkts: [...new Set(ids.map(id => (lst(id) || {}).mktNome))], lojas: [...new Set(ids.map(id => (lst(id) || {}).lojaId).filter(Boolean))], contas: [...new Set(ids.map(id => (lst(id) || {}).contaId).filter(Boolean))] };
    UI.openModal(`<h3 class="h2">Edição em massa · ${ids.length} anúncio(s)</h3>
      <p class="sub" style="margin-top:4px">Escopo: ${escopo.mkts.join(', ')} · ${escopo.lojas.length} loja(s) · ${escopo.contas.length} conta(s). Prévia mostra valor anterior × novo; <b>nada será publicado externamente</b>.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Campo</span><br>
        <select class="select" id="bkCampo" style="width:100%;margin-top:3px">${BULK_CAMPOS.map(([k, lbl]) => `<option value="${k}">${lbl}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Novo valor</span><br><input class="input" id="bkValor" style="width:100%;margin-top:3px"></label>
      <div id="bkPrev"></div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn" id="bkPreview">Gerar prévia</button>
        <button class="btn primary" id="bkGo" disabled title="Gere a prévia primeiro — confirmação é obrigatória.">Confirmar e criar job</button></div>`);
    let preview = null;
    UI.$('#bkPreview').onclick = () => {
      const campo = UI.$('#bkCampo').value;
      const raw = UI.$('#bkValor').value.trim();
      const valor = ['preco', 'precoPromo', 'estoque', 'pesoEmbaladoKg'].includes(campo) ? +raw : raw;
      preview = V8CAT.bulkPreview(cat, ids, campo, valor);
      UI.$('#bkPrev').innerHTML = `<div class="tblwrap" style="margin-top:10px;max-height:220px;overflow:auto"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Anúncio</th><th class="nosort">Antes</th><th class="nosort">Depois</th><th class="nosort">Situação</th></tr></thead><tbody>
        ${preview.rows.map(r => `<tr><td class="tmain">${UI.esc(r.listingId)}<span class="tsub">${UI.esc(r.marketplace || '')}</span></td>
          <td>${UI.esc(String(r.antes ?? '—'))}</td><td>${UI.esc(String(r.depois ?? '—'))}</td>
          <td>${r.incompativel ? `<span class="st neg plain">${UI.esc(r.incompativel)}</span>` : r.conflito ? `<span class="st warn plain">${UI.esc(r.conflito)}</span>` : '<span class="st pos plain">OK</span>'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:6px">${preview.elegiveis} elegível(is) · ${preview.conflitos} conflito(s) · ${preview.incompativeis} incompatível(is) — conflitos e incompatíveis são pulados, nunca forçados.</p>`;
      const go = UI.$('#bkGo'); go.disabled = !preview.elegiveis; go.title = preview.elegiveis ? 'cria job interno auditável e reversível' : 'nenhum anúncio elegível';
    };
    UI.$('#bkGo').onclick = () => {
      const r = V8CAT.bulkCommit(cat, preview, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); CAT.lsel.clear();
      UI.toast(`Job ${r.job.id} aplicado em ${r.job.itens.length} anúncio(s) · ${r.job.pulados} pulado(s) · reversível · ${r.job.externo}.`, 'ok');
      CAT.sub = 'Edição em Massa'; render(CAT.sub);
    };
  }

  /* modal de adaptação para outro marketplace */
  function modalAdapt() {
    const ids = [...CAT.lsel];
    if (!ids.length) return UI.toast('Selecione anúncios primeiro.', 'err');
    UI.openModal(`<h3 class="h2">Adaptar para outro marketplace</h3>
      <p class="sub" style="margin-top:4px">Cria <b>rascunho interno</b> no canal alvo com categoria sugerida, atributos mapeados, título adaptado e pendências declaradas. O original nunca é alterado. Publicação externa: bloqueada até revisão humana + integração oficial.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Marketplace alvo</span><br>
        <select class="select" id="adMkt" style="width:100%;margin-top:3px">${D.MKTS.map(m => `<option value="${m.key}">${m.nome}</option>`).join('')}</select></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="adGo">Criar rascunhos adaptados</button></div>`);
    UI.$('#adGo').onclick = () => {
      const alvo = UI.$('#adMkt').value;
      let ok = 0, pend = 0, falhas = [];
      for (const id of ids) {
        const r = V8CAT.adaptListing(CAT.eng(), id, alvo, { usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) { falhas.push(r.reason); continue; }
        ok++; pend += r.draft.adaptacao.pendente.length;
      }
      UI.closeModal(); CAT.lsel.clear();
      if (falhas.length) UI.toast(falhas[0], 'err');
      else UI.toast(`${ok} rascunho(s) adaptado(s) criado(s) · ${pend} pendência(s) para revisão humana — originais intactos.`, 'ok');
      CAT.sub = 'Duplicar e Adaptar'; render(CAT.sub);
    };
  }

  function modalAddVar(produtoId) {
    UI.openModal(`<h3 class="h2">Adicionar variação</h3>
      <p class="sub" style="margin-top:4px">SKU duplicado no mesmo escopo gera conflito explícito — nada é criado em silêncio.</p>
      ${[['vNome', 'Nome da variação'], ['vTipo', 'Tipo (tamanho, cor…)'], ['vSku', 'SKU de variação'], ['vEan', 'Código de barras'], ['vPreco', 'Preço'], ['vEstoque', 'Estoque']].map(([id, lbl]) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${lbl}</span><br><input class="input" id="${id}" style="width:100%;margin-top:3px"></label>`).join('')}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn primary" id="vOk">Criar variação</button></div>`);
    UI.$('#vOk').onclick = () => {
      const g = id => UI.$('#' + id).value.trim();
      const r = V8CAT.addVariation(CAT.eng(), produtoId, { nome: g('vNome'), tipo: g('vTipo'), sku: g('vSku'), codigoBarras: g('vEan') || null, preco: +g('vPreco') || null, estoque: +g('vEstoque') || 0 }, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.toast('Variação criada.', 'ok'); body();
    };
  }

  function modalEditVar(pid, vid) {
    const p = allProds().find(x => x.id === pid);
    const v = (p.variacoes || []).find(x => x.id === vid);
    if (!v) return;
    UI.openModal(`<h3 class="h2">Editar variação · ${UI.esc(v.nome)}</h3>
      ${[['sku', 'SKU'], ['codigoBarras', 'Código de barras'], ['preco', 'Preço'], ['estoque', 'Estoque'], ['pesoKg', 'Peso (kg)']].map(([k, lbl]) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${lbl}</span><br><input class="input" id="ev_${k}" style="width:100%;margin-top:3px" value="${UI.esc(v[k] ?? '')}"></label>`).join('')}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button><button class="btn primary" id="evOk">Salvar</button></div>`);
    UI.$('#evOk').onclick = () => {
      for (const k of ['sku', 'codigoBarras', 'preco', 'estoque', 'pesoKg']) {
        const raw = UI.$('#ev_' + k).value.trim();
        const val = ['preco', 'estoque', 'pesoKg'].includes(k) ? (raw === '' ? null : +raw) : raw;
        if (String(v[k] ?? '') !== String(val ?? '')) {
          const r = V8CAT.editVariation(CAT.eng(), pid, vid, k, val, { usuario: D.meta.usuario, papel: papel() });
          if (r.blocked) return UI.toast(r.reason, 'err');
        }
      }
      UI.closeModal(); UI.toast('Variação atualizada — versionada na timeline.', 'ok'); body();
    };
  }


  function onDrawerClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = CAT.drawerId;
    const p = allProds().find(x => x.id === id);
    if (act === 'dclose') UI.closeDrawer();
    else if (act === 'd-goopp') { UI.closeDrawer(); UI.open('crescimento:' + b.dataset.id); }
    else if (act === 'd-goimp') { UI.closeDrawer(); UI.go('importar', 'Vínculos SKU'); }
    else if (act === 'd-lojactx') {
      UI.closeDrawer();
      const s = D.scope.lojas.find(x => x.id === b.dataset.loja);
      const c = D.scope.cnpjs.find(x => x.id === s.cnpjId);
      UI.ctx.empresa = c.empresaId; UI.ctx.cnpj = c.id; UI.setCtx('loja', s.id);
    }
    else if (act === 'dtab') CAT.openDrawer(id, b.dataset.tab);
    else if (act === 'dprofmkt') { CAT.profileMkt = b.dataset.mkt; CAT.openDrawer(id, 'perfis'); }
    else if (act === 'dsave') {
      const inputs = UI.$$('#drawer [data-field]');
      const changes = inputs.map(i => ({ f: i.dataset.field, v: i.type === 'number' ? (i.value ? +i.value : null) : i.value }))
        .filter(c => String(p.master[c.f] ?? '') !== String(c.v ?? ''));
      if (!changes.length) return UI.toast('Nada mudou — nenhuma versão criada.');
      const conflita = changes.filter(c => Object.values(p.mkt).some(m => m.profile[c.f] !== undefined));
      const apply = () => {
        let n = 0, preservados = new Set();
        for (const c of changes) {
          const r = L.editMaster(UI.state, id, c.f, c.v);
          if (r.changed) { n++; (r.perfisPreservados || []).forEach(x => preservados.add(x)); }
        }
        UI.toast(`${n} versão(ões) criada(s) · rascunhos reavaliados${preservados.size ? ' · perfis preservados: ' + [...preservados].join(', ') : ''}`, 'ok');
        CAT.openDrawer(id, 'versoes'); body(); UI.refreshBadges();
      };
      if (conflita.length) {
        UI.openModal(`<h3 class="h2">Perfis específicos existem</h3>
          <p class="sub" style="margin-top:8px">Os campos <b>${conflita.map(c => c.f).join(', ')}</b> têm valor específico em algum marketplace. A edição do master <b>não vai sobrescrevê-los</b> — os canais continuam com o valor próprio.</p>
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
            <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
            <button class="btn primary" id="mConfirm">Entendi, salvar master</button></div>`);
        UI.$('#mConfirm').onclick = () => { UI.closeModal(); apply(); };
      } else apply();
    }
    else if (act === 'dsaveprof') {
      const mk = b.dataset.mkt;
      const inputs = UI.$$('#drawer [data-field]');
      let n = 0;
      for (const i of inputs) {
        const v = i.type === 'number' ? (i.value ? +i.value : null) : i.value;
        if (i.dataset.field === 'preco') { if (v !== p.mkt[mk].preco && v != null) { p.mkt[mk].preco = v; L.editProfile(UI.state, id, mk, 'preco', v); n++; } }
        else if (v && v !== (p.mkt[mk].profile[i.dataset.field] ?? '')) { L.editProfile(UI.state, id, mk, i.dataset.field, v); n++; }
      }
      UI.toast(n ? `Perfil ${D.MKTS.find(m => m.key === mk).nome} atualizado — demais canais intactos.` : 'Nada mudou no perfil.', n ? 'ok' : '');
      CAT.openDrawer(id, 'perfis'); body();
    }
    else if (act === 'ddraft') {
      const mk = b.dataset.mkt;
      CAT.drafts.push({ id: 'd' + (CAT.drafts.length + 1 + Math.floor(performance.now()) % 97), produtoId: id, mkt: mk, status: D.STATUS.EM_REVISAO, nota: 'rascunho interno criado da matriz' });
      L._audit(UI.state, 'Marcos', 'draft_criado', `${p.sku} → ${mk} (interno)`);
      UI.toast(`Rascunho interno criado para ${D.MKTS.find(m => m.key === mk).nome}. Publicação externa segue bloqueada.`, 'ok');
      CAT.openDrawer(id, 'matriz');
    }
  }

  /* ação em massa multiloja: SEMPRE confirma o escopo antes de executar */
  function doBulk(action) {
    const ids = [...UI.state.selection];
    if (!ids.length) return UI.toast('Nenhum item selecionado.', 'err');
    const r = L.bulkScopeSummary(UI.state, ids, UI.ctx);
    UI.openModal(`<h3 class="h2">Confirmar escopo da ação</h3>
      <p class="sub" style="margin-top:4px">"${UI.esc(action.replace(/_/g, ' '))}" — nada será publicado externamente.</p>
      <dl class="kv" style="margin-top:10px">
        <dt>Itens</dt><dd>${r.itens} selecionado(s) · <b>${r.elegiveis} elegíveis</b></dd>
        <dt>Lojas afetadas</dt><dd>${r.lojasAfetadas.length}: ${UI.esc(r.lojasAfetadas.join(' · '))}</dd>
        <dt>CNPJs afetados</dt><dd>${r.cnpjsAfetados.length}: ${UI.esc(r.cnpjsAfetados.join(' · '))}</dd>
        <dt>Contas afetadas</dt><dd>${r.contasAfetadas.length ? UI.esc(r.contasAfetadas.join(' · ')) : 'nenhuma'}</dd>
        ${r.bloqueados.length ? `<dt>Com pendência</dt><dd>${r.bloqueados.map(x => `${UI.esc(x.sku)} — ${UI.esc(x.motivo)}`).join('<br>')}</dd>` : ''}
      </dl>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="bulkGo">Executar (interno, auditado)</button></div>`);
    UI.$('#bulkGo').onclick = () => {
      UI.closeModal();
      const res = L.bulkAction(UI.state, ids, action, D.meta.usuario, UI.ctx);
      if (res.blocked) return UI.toast(res.reason, 'err');
      if (action === 'criar_missao') {
        D.missoes.push({ id: 'm' + (D.missoes.length + 1), titulo: `Missão em massa · ${ids.length} produtos (${res.job.escopo.lojas.length} lojas)`, status: D.STATUS.EM_PROCESSAMENTO, tipo: D.STATUS.ACAO_INTERNA, agora: 'criada por ação em massa', origem: 'catálogo · bulk', reversivel: true });
      }
      if (action === 'solicitar_dado')
        for (const bqd of r.bloqueados) L._audit(UI.state, 'Head', 'dado_solicitado', `${bqd.sku}: ${bqd.motivo}`);
      UI.toast(`Job ${res.job.id} · "${action}" · ${res.job.total} itens · ${res.job.escopo.lojas.length} loja(s) · ${res.job.escopo.cnpjs.length} CNPJ(s) · ${res.job.status}.`, 'ok');
      L.clearSelection(UI.state);
      UI.refreshBadges(); body();
    };
  }

  /* comparar produtos selecionados entre lojas (preço, estoque, margem) */
  function openCompareProdutos(ids) {
    const ps = ids.map(id => allProds().find(p => p.id === id)).filter(Boolean).slice(0, 6);
    const lojaIds = [...new Set(ps.flatMap(p => Object.keys(p.lojas)))];
    const lojaNome = id => (D.scope.lojas.find(s => s.id === id) || { nome: id }).nome;
    UI.openModal(`<h3 class="h2">Comparar selecionados por loja</h3>
      <p class="sub" style="margin-top:4px">Preço · estoque · margem por loja. ${UI.esc(D.STATUS.DADO_SIMULADO)}. Célula vazia = produto não está na loja.</p>
      <div class="tblwrap" style="margin-top:10px;max-height:50vh"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Produto</th>${lojaIds.map(l => `<th class="nosort">${UI.esc(lojaNome(l))}</th>`).join('')}</tr></thead><tbody>
        ${ps.map(p => `<tr><td class="tmain">${UI.esc(p.sku)}</td>
          ${lojaIds.map(l => {
            const sl = p.lojas[l];
            return `<td>${sl ? `${UI.brl(sl.preco)}<span class="tsub">est. ${sl.estoque ?? '—'} · mg ${L.margemLoja(p, l) ?? '—'}%</span>` : '<span class="src">—</span>'}</td>`;
          }).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
  }

  /* ---------------- modais auxiliares ---------------- */
  function openAdvanced() {
    const F = CAT.filters;
    const cats = [...new Set(prods().map(p => p.categoria))];
    const opt = (v, cur, lbl) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${lbl || v}</option>`;
    UI.openModal(`<h3 class="h2">Filtros avançados</h3>
      <p class="sub" style="margin-top:4px">Combináveis entre si e com a busca. ${L.activeFilterCount(F)} ativo(s).</p>
      <div style="display:grid;gap:10px;margin-top:12px">
        <label><span class="eyebrow">Categoria</span><br><select class="select" id="afCat" style="width:100%">${opt('', F.categoria, 'todas')}${cats.map(c => opt(c, F.categoria)).join('')}</select></label>
        <label><span class="eyebrow">Tipo de produção</span><br><select class="select" id="afTipo" style="width:100%">${opt('', F.tipo, 'todos')}${['PRONTA_ENTREGA', 'SOB_ENCOMENDA', 'PERSONALIZADO'].map(t => opt(t, F.tipo)).join('')}</select></label>
        <label><span class="eyebrow">Situação em marketplace</span><br>
          <select class="select" id="afMkt" style="width:49%">${opt('', F.marketplace, 'qualquer canal')}${D.MKTS.map(m => opt(m.key, F.marketplace, m.nome)).join('')}</select>
          <select class="select" id="afSt" style="width:49%">${opt('', F.statusMkt, 'qualquer status')}${['ATIVO', 'PAUSADO', 'EM_REVISAO', 'BLOQUEADO', 'NAO_PUBLICADO'].map(s => opt(s, F.statusMkt)).join('')}</select></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="afApply">Aplicar filtros</button></div>`);
    UI.$('#afApply').onclick = () => {
      const g = id => UI.$('#' + id).value;
      g('afCat') ? F.categoria = g('afCat') : delete F.categoria;
      g('afTipo') ? F.tipo = g('afTipo') : delete F.tipo;
      g('afMkt') ? F.marketplace = g('afMkt') : delete F.marketplace;
      g('afSt') ? F.statusMkt = g('afSt') : delete F.statusMkt;
      UI.closeModal(); body();
    };
  }

  function openCols() {
    UI.openModal(`<h3 class="h2">Colunas visíveis</h3>
      <div style="display:grid;gap:8px;margin-top:12px">
        ${['categoria', 'custo', 'atualizacao'].map(c => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-col="${c}" ${CAT.cols[c] ? 'checked' : ''}> ${c === 'atualizacao' ? 'atualização' : c}</label>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" id="colApply">Aplicar</button></div>`);
    UI.$('#colApply').onclick = () => {
      UI.$$('#modal [data-col]').forEach(i => CAT.cols[i.dataset.col] = i.checked);
      UI.closeModal(); body();
    };
  }

  function openSaveView() {
    UI.openModal(`<h3 class="h2">Salvar visão</h3>
      <p class="sub" style="margin-top:4px">Guarda escopo (CNPJ, loja, conta, marketplace, período), ${L.activeFilterCount(CAT.filters)} filtro(s), colunas e ordenação. Visões não vazam entre empresas.</p>
      <input class="input" id="svName" style="width:100%;margin-top:10px" placeholder="ex.: Shopee Matriz MG · produtos bloqueados">
      <label style="display:block;margin-top:8px"><span class="eyebrow">Compartilhamento</span><br>
        <select class="select" id="svTipo" style="width:100%;margin-top:3px">
          <option value="privada">Privada (só eu)</option>
          <option value="empresa">Compartilhada com a empresa</option>
          <option value="cnpj">Compartilhada com o CNPJ</option>
          <option value="loja">Compartilhada com a loja</option>
        </select></label>
      <p class="src" style="margin-top:8px">escopo atual: ${UI.esc(V8LOGIC.scopeLine(UI.ctx))}</p>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="svSave">Salvar visão</button></div>`);
    UI.$('#svSave').onclick = () => {
      const n = UI.$('#svName').value.trim();
      if (!n) return UI.toast('Dê um nome à visão.', 'err');
      L.saveScopedView(UI.state, {
        nome: n, empresaId: UI.ctx.empresa, tipo: UI.$('#svTipo').value,
        escopo: { cnpj: UI.ctx.cnpj, loja: UI.ctx.loja, conta: UI.ctx.conta, marketplace: UI.ctx.marketplace, periodo: UI.ctx.periodo },
        filtros: CAT.filters, colunas: CAT.cols, ordenacao: { key: CAT.sortKey, dir: CAT.sortDir },
      });
      UI.closeModal(); UI.toast(`Visão "${n}" salva com escopo — auditada.`, 'ok'); body();
    };
  }

  UI.renderers.catalogo = render;

  /* ---------------- auto-teste headless (?catself=1) ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('catself') !== '1') return;
    try {
      const errs = [];
      const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('catalogo', 'Produtos');
      need(UI.$$('#catBody tbody tr').length === prods().length, 'tabela mostra os produtos da empresa ativa');
      /* busca busca */
      CAT.filters.q = 'quadro'; body();
      need(UI.$$('#catBody tbody tr').length === prods().filter(p => /quadro/i.test(p.nome)).length, 'busca filtra');
      CAT.filters = {}; CAT.filters.comPendencia = true; body();
      need(UI.$$('#catBody tbody tr').length === prods().filter(p => p.pendencias.length).length, 'filtro pendência');
      /* seleção + massbar */
      L.selectAllFiltered(UI.state, filtered()); body();
      need(!!UI.$('.massbar'), 'massbar aparece');
      need(UI.$$('#catBody tr.sel').length > 0, 'linhas marcadas');
      const r = L.bulkAction(UI.state, [...UI.state.selection], 'marcar_revisao');
      need(!!r.job && UI.state.audit.some(a => a.acao === 'bulk_job'), 'bulk vira job auditável');
      const blq = L.bulkAction(UI.state, ['p1'], 'publicar_externo');
      need(blq.blocked && blq.reason.includes('ESCRITA EXTERNA BLOQUEADA'), 'publicação externa recusada');
      L.clearSelection(UI.state); CAT.filters = {}; body();
      /* drawer preserva filtros e seleção da tabela */
      CAT.filters.comPendencia = true; body();
      L.toggleSelect(UI.state, 'p2'); body();
      CAT.openDrawer('p1', 'master');
      need(!UI.$('#drawerWrap').hidden, 'drawer abre');
      UI.closeDrawer(); body();
      need(CAT.filters.comPendencia === true && UI.state.selection.has('p2'), 'filtros e seleção preservados após drawer');
      L.clearSelection(UI.state); CAT.filters = {}; body();
      CAT.openDrawer('p1', 'master');
      const antesML = JSON.stringify(prods().find(p => p.id === 'p1').mkt.ml.profile);
      L.editProfile(UI.state, 'p1', 'shopee', 'titulo', 'Título Shopee auto-teste');
      need(JSON.stringify(prods().find(p => p.id === 'p1').mkt.ml.profile) === antesML, 'editar Shopee não altera ML');
      const ed = L.editMaster(UI.state, 'p1', 'marca', 'Casa Demo Premium');
      need(ed.changed && ed.version.antes === 'Casa Demo', 'edição versiona com valor anterior');
      UI.closeDrawer();
      /* anúncios (respeitando a empresa ativa) */
      CAT.sub = 'Anúncios'; body();
      CAT.anuncioMkt = 'shopee'; CAT.anuncioTab = 'Ativos'; body();
      need(UI.$$('#catBody tbody tr').length === prods().filter(p => p.mkt.shopee.status === 'ATIVO').length, 'aba+seletor filtram anúncios');
      /* relações no drawer */
      CAT.openDrawer('p2', 'relacoes');
      need(UI.$('#drawer').textContent.includes('Oportunidades'), 'drawer relaciona com Crescimento');
      UI.closeDrawer();
      /* ---------- 10.E.3: central de anúncios ---------- */
      UI.go('catalogo', 'Visão Geral');
      need(UI.$('#catBody').textContent.includes('Produtos Master'), 'visão geral executiva abre');
      need(UI.$('#catBody').textContent.includes('NORMALIZED_INTERNAL_DATA') || UI.$('#catBody').textContent.includes('DEMO_FIXTURE'), 'indicadores com fonte');
      const cat = CAT.eng();
      /* busca por SKU, ID externo e EAN */
      need(V8CAT.searchListings(cat, 'QP-6090').length >= 2, 'busca por SKU');
      const comExt = cat.listings.find(l => l.itemIdExterno);
      need(V8CAT.searchListings(cat, comExt.itemIdExterno).length >= 1, 'busca por ID externo');
      need(V8CAT.searchListings(cat, comExt.ean).length >= 1, 'busca por EAN');
      /* editor completo abre e salva só no canal */
      CAT.sub = 'Anúncios'; CAT.anuncioMkt = 'shopee'; CAT.anuncioTab = 'Todos'; body();
      CAT.openEditor('L-p1-shopee', 'Informação Básica');
      need(!UI.$('#modalWrap').hidden && UI.$('#modal').textContent.includes('Informação Básica'), 'editor completo abre');
      need(UI.$('#modal').textContent.includes('Performance Comercial'), 'abas do editor presentes');
      const antesMl2 = JSON.stringify(V8CAT.byId(cat, 'L-p1-ml').overrides);
      V8CAT.editListing(cat, 'L-p1-shopee', 'titulo', 'Título catself', {});
      need(JSON.stringify(V8CAT.byId(cat, 'L-p1-ml').overrides) === antesMl2, 'editar anúncio Shopee não toca ML');
      UI.closeModal();
      /* ranking com fonte; sem fonte não exibe */
      need(V8CAT.rankingDe(cat, 'L-p1-ml').fonte === 'DEMO_FIXTURE', 'ranking com fonte e confiança');
      need(V8CAT.rankingDe(cat, 'L-p6-ml') === null, 'sem leitura → sem posição inventada');
      /* duplicar preserva original; adaptar cria rascunho com pendências */
      const nAntes = cat.listings.length;
      V8CAT.duplicateListing(cat, 'L-p2-shopee', {});
      need(cat.listings.length === nAntes + 1 && V8CAT.byId(cat, 'L-p2-shopee').status === 'ATIVO', 'duplicar cria cópia e preserva original');
      const ad = V8CAT.adaptListing(cat, 'L-p4-ml', 'tiktok', {});
      need(ad.ok && ad.draft.status === 'RASCUNHO' && ad.draft.adaptacao.pendente.length >= 1, 'adaptação vira rascunho com pendências declaradas');
      /* bulk com prévia, job e rollback */
      const pv = V8CAT.bulkPreview(cat, ['L-p6-ml', 'L-p6-shopee'], 'estoque', 99);
      const job = V8CAT.bulkCommit(cat, pv, {});
      need(job.ok && V8CAT.valorDe(cat, V8CAT.byId(cat, 'L-p6-ml'), 'estoque') === 99, 'bulk aplica com job');
      const rb = V8CAT.bulkRollback(cat, job.job.id, {});
      need(rb.ok && V8CAT.valorDe(cat, V8CAT.byId(cat, 'L-p6-ml'), 'estoque') !== 99, 'rollback restaura');
      /* saúde abre no campo certo */
      CAT.sub = 'Saúde e Pendências'; body();
      need(UI.$('#catBody').textContent.includes('abre em:'), 'fila aponta o campo/aba de destino');
      CAT.sub = 'Produtos Master'; CAT.anuncioMkt = 'ml'; CAT.anuncioTab = 'Todos'; CAT.lsel.clear(); body();
      document.body.dataset.catselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.catselfReady = 'fail: ' + e.message; }
  });
}());

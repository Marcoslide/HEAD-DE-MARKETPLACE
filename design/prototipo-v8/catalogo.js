/* =============================================================
   v8 · CATÁLOGO — área operacional central
   Subáreas: Visão Geral · Produtos · Anúncios · Rascunhos e Revisões ·
   Pendências · Promoções Relacionadas.
   Busca busca, filtro filtra, seleção seleciona, edição versiona,
   ação em massa vira job auditável. Escrita externa: bloqueada.
   ============================================================= */
(function () {
  'use strict';
  const L = V8LOGIC, D = V8DATA;
  const SUBS = ['Visão Geral', 'Produtos', 'Anúncios', 'Rascunhos e Revisões', 'Pendências', 'Promoções Relacionadas'];

  const CAT = window.CATALOGO = {
    sub: 'Produtos',
    filters: {},              /* mantidos ao navegar entre subáreas */
    sortKey: 'nome', sortDir: 'asc',
    cols: { categoria: true, custo: true, atualizacao: true },
    anuncioMkt: 'ml', anuncioTab: 'Todos',
    drafts: [
      { id: 'd1', produtoId: 'p7', mkt: 'tiktok', status: D.STATUS.PRONTO_REVISAO, nota: 'draft interno gerado da oportunidade priorizada' },
      { id: 'd2', produtoId: 'p3', mkt: 'shopee', status: D.STATUS.EM_REVISAO, nota: 'aguardando foto com escala real' },
    ],
  };

  /* contexto global (empresa + marketplace ativos) entra ANTES dos filtros locais */
  const prods = () => UI.ctxProducts();
  const allProds = () => UI.state.products;
  const filtered = () => L.sortProducts(L.filterProducts(prods(), CAT.filters), CAT.sortKey, CAT.sortDir);

  /* ---------------- shell da área ---------------- */
  function render(sub) {
    if (sub && SUBS.includes(sub)) CAT.sub = sub;
    const el = UI.$('#v-catalogo');
    el.innerHTML = `
      <div class="eyebrow">catálogo · fonte única do produto</div>
      <h1 class="h1">Catálogo</h1>
      <p class="sub" style="margin-top:6px">Um registro por produto; perfis independentes por marketplace. ${UI.esc(D.STATUS.DADO_SIMULADO)} · rotulado.</p>
      <div class="tabs" style="margin-top:16px">
        ${SUBS.map(s => `<button class="tab ${s === CAT.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}${s === 'Pendências' ? `<span class="cnt">${prods().filter(p => p.pendencias.length).length}</span>` : ''}</button>`).join('')}
      </div>
      <div id="catBody" style="margin-top:16px"></div>`;
    body();
    el.onclick = onClick;
    el.oninput = onInput;
  }

  function body() {
    const el = UI.$('#catBody');
    if (CAT.sub === 'Visão Geral') el.innerHTML = visaoGeral();
    else if (CAT.sub === 'Produtos') el.innerHTML = produtos();
    else if (CAT.sub === 'Anúncios') el.innerHTML = anuncios();
    else if (CAT.sub === 'Rascunhos e Revisões') el.innerHTML = rascunhos();
    else if (CAT.sub === 'Pendências') el.innerHTML = pendencias();
    else el.innerHTML = promocoes();
    UI.refreshBadges();
  }

  /* ---------------- subáreas ---------------- */
  function visaoGeral() {
    const ps = prods();
    const ativos = ps.filter(p => Object.values(p.mkt).some(m => m.status === 'ATIVO')).length;
    return `
      <div class="grid3">
        <div class="panel"><div class="eyebrow">produtos</div><div class="h1">${ps.length}</div><span class="src">${ativos} com anúncio ativo · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div>
        <div class="panel"><div class="eyebrow">pendências abertas</div><div class="h1">${ps.filter(p => p.pendencias.length).length}</div><span class="src">cada uma tem dono e destino</span></div>
        <div class="panel"><div class="eyebrow">rascunhos internos</div><div class="h1">${CAT.drafts.length}</div><span class="src">publicação externa: ${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)}</span></div>
      </div>
      <div class="callout" style="margin-top:14px">Este catálogo é a <b>fonte única</b>: o Product Master alimenta os perfis por marketplace, e cada perfil pode divergir sem sobrescrever os demais. Toda edição gera versão com autor e origem.</div>`;
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

  function anuncios() {
    const mk = UI.ctx.marketplace || CAT.anuncioMkt;
    const mkNome = D.MKTS.find(m => m.key === mk).nome;
    const all = prods().map(p => ({ p, m: p.mkt[mk] }));
    const TABS = { 'Todos': () => true, 'Ativos': x => x.m.status === 'ATIVO', 'Pausados': x => x.m.status === 'PAUSADO', 'Em revisão': x => x.m.status === 'EM_REVISAO', 'Bloqueados': x => x.m.status === 'BLOQUEADO', 'Não publicados': x => x.m.status === 'NAO_PUBLICADO' };
    const list = all.filter(TABS[CAT.anuncioTab] || TABS.Todos);
    const rk = D.ranking;
    return `
      <div class="fbar" style="margin-top:0">
        ${D.MKTS.map(m => `<button class="fchip ${m.key === mk ? 'on' : ''}" data-act="anmkt" data-mkt="${m.key}" ${UI.ctx.marketplace ? 'title="marketplace fixado pela barra global"' : ''}>${m.nome}</button>`).join('')}
        <span style="flex:1"></span>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('sync'))}">sincronizar anúncios</button>
      </div>
      <div class="tabs">${Object.keys(TABS).map(t => `<button class="tab ${t === CAT.anuncioTab ? 'on' : ''}" data-act="antab" data-tab="${t}">${t}<span class="cnt">${all.filter(TABS[t]).length}</span></button>`).join('')}</div>

      ${list.length ? `
      <div class="tblwrap" style="margin-top:14px">
        <table class="tbl"><thead><tr>
          <th class="nosort"></th><th class="nosort">Anúncio</th><th class="nosort">Preço no canal</th><th class="nosort">Margem</th><th class="nosort">Status</th><th class="nosort">Posição (contexto)</th><th class="nosort"></th>
        </tr></thead><tbody>
        ${list.map(({ p, m }) => {
          const pos = rk.find(r => r.marketplace === mkNome && p.id === 'p1');
          return `<tr>
            <td><span class="thumb">▦</span></td>
            <td><button class="tmain linklike" style="font-size:12.5px" data-act="drawer" data-id="${p.id}">${UI.esc(m.profile.titulo || p.nome)}</button><span class="tsub">${UI.esc(p.sku)} · perfil ${m.profile.titulo ? 'específico' : 'herdado do master'}</span></td>
            <td>${UI.brl(m.preco)}</td>
            <td>${L.margem(p, mk) == null ? '—' : L.margem(p, mk) + '%'}</td>
            <td>${UI.stBadge(m.status)}${m.motivo ? `<span class="tsub">${UI.esc(m.motivo)}</span>` : ''}</td>
            <td>${pos ? `<span class="tmain">${pos.posicao}º</span><span class="tsub">"${pos.palavra}" · ${pos.comparacao} · ${pos.data} · ${pos.origem}</span>` : `<span class="src">${D.STATUS.SEM_DADOS} — sem posição inventada</span>`}</td>
            <td><span class="rowact"><button class="btn sm ghost" data-act="drawer" data-id="${p.id}">abrir</button></span></td>
          </tr>`;
        }).join('')}
        </tbody></table>
        <div class="tfoot"><span>${list.length} anúncio(s) · ${mkNome} · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span>
        <button class="linklike" disabled title="${UI.esc(L.disabledReason('ranking_real'))}" style="opacity:.55;cursor:not-allowed">ver ranking real</button></div>
      </div>` : `
      <div class="panel" style="margin-top:14px"><div class="empty"><b>Nenhum anúncio "${CAT.anuncioTab}" no ${mkNome}</b>
        Conta ${D.STATUS.AGUARDANDO_CONEXAO.toLowerCase()} — crie um rascunho interno pela matriz de publicação do produto.</div></div>`}`;
  }

  function rascunhos() {
    const dynamic = UI.state.jobs.filter(j => j.acao === 'gerar_rascunhos').flatMap(j => j.itens.map(id => ({ id: j.id + ':' + id, produtoId: id, mkt: '—', status: D.STATUS.PRONTO_REVISAO, nota: `gerado pelo job ${j.id}` })));
    const list = [...CAT.drafts, ...dynamic];
    if (!list.length) return `<div class="panel"><div class="empty"><b>Sem rascunhos</b>Rascunhos nascem da matriz de publicação, da Operação ou de jobs em massa.</div></div>`;
    return `
      <div class="callout" style="margin-top:0">Rascunho é <b>${UI.esc(D.STATUS.ACAO_INTERNA)}</b>: validado dentro do sistema. Publicar fora exige conexão oficial + aprovação — nunca será simulado como concluído.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Rascunho</th><th class="nosort">Canal alvo</th><th class="nosort">Status</th><th class="nosort">Nota</th><th class="nosort"></th>
      </tr></thead><tbody>
      ${list.map(d => {
        const p = prods().find(x => x.id === d.produtoId);
        const mk = D.MKTS.find(m => m.key === d.mkt);
        return `<tr><td><span class="tmain">${UI.esc(p ? p.nome : d.produtoId)}</span><span class="tsub">${d.id}</span></td>
          <td>${mk ? mk.nome : '—'}</td><td>${UI.stBadge(d.status)}</td><td><span class="src">${UI.esc(d.nota)}</span></td>
          <td><span class="rowact"><button class="btn sm ghost" data-act="drawer" data-id="${d.produtoId}">abrir produto</button></span></td></tr>`;
      }).join('')}
      </tbody></table></div>`;
  }

  function pendencias() {
    const list = prods().filter(p => p.pendencias.length);
    if (!list.length) return `<div class="panel"><div class="empty"><b>Nenhuma pendência aberta</b>Quando um dado obrigatório faltar, ele aparece aqui com dono e destino — nunca morre como alerta.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Produto</th><th class="nosort">Pendência</th><th class="nosort">O que destrava</th><th class="nosort"></th></tr></thead><tbody>
      ${list.flatMap(p => p.pendencias.map(pd => `<tr>
        <td><span class="tmain">${UI.esc(p.nome)}</span><span class="tsub">${p.sku}</span></td>
        <td><span class="st warn plain">${UI.esc(pd)}</span></td>
        <td><span class="src">${pd.includes('peso') ? 'rascunho Shopee do Espelho Orgânico' : pd.includes('INMETRO') ? 'desbloqueio do anúncio no ML' : pd.includes('grade') ? 'revisão do Tênis no ML' : 'readiness do produto'}</span></td>
        <td><span class="rowact"><button class="btn sm" data-act="drawer" data-id="${p.id}">resolver</button></span></td></tr>`)).join('')}
      </tbody></table></div>`;
  }

  function promocoes() {
    return `
      <div class="callout" style="margin-top:0">Promoções vivem em <b>Crescimento · Aceleração</b>; aqui você vê as que tocam itens do catálogo, sempre com impacto em margem declarado.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Promoção</th><th class="nosort">Tipo</th><th class="nosort">Itens</th><th class="nosort">Impacto em margem</th><th class="nosort">Status</th><th class="nosort"></th></tr></thead><tbody>
        ${D.crescimento.aceleracao.promocoes.map(pr => {
          const imp = L.promoImpact(pr);
          return `<tr>
          <td><span class="tmain">${UI.esc(pr.nome)}</span><span class="tsub">${pr.origem}</span></td>
          <td>${pr.tipo}</td><td>${pr.itens}</td>
          <td>${pr.margemAntes}% → ${pr.margemDepois}% ${imp.respeitaMinima ? '<span class="st pos">mínima respeitada</span>' : '<span class="st neg">violaria a mínima</span>'}</td>
          <td>${UI.stBadge(pr.status)}</td>
          <td><span class="rowact"><button class="btn sm ghost" data-act="gocresc">ver em Crescimento</button></span></td></tr>`;
        }).join('')}
        </tbody></table></div>`;
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
      CAT.sub = 'Produtos'; CAT.anuncioMkt = 'ml'; CAT.anuncioTab = 'Todos'; body();
      document.body.dataset.catselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.catselfReady = 'fail: ' + e.message; }
  });
}());

/* =============================================================
   HEAD MARKETPLACE OS · v8 — SHELL (UI global)
   Roteamento real entre áreas, dois temas nativos com preferência
   salva por usuário, drawer/modal/toast, auto-teste headless.

   10.UI.1 — BARRA GLOBAL OPERACIONAL: empresa ativa, marketplace
   ativo, período, ambiente, status da base, busca global,
   notificações, jobs e perfil. A barra MUDA o contexto das telas.
   ============================================================= */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];

  const THEME_KEY = 'v8-theme:' + V8DATA.meta.usuario; /* preferência por usuário */

  const UI = window.UI = {
    $, $$,
    state: V8LOGIC.createState(),
    view: 'home',
    renderers: {}, /* preenchido pelos arquivos de área */

    /* ---------- OPERATIONAL SCOPE CONTEXT (10.UI.2) ----------
       Grupo → Empresa → CNPJ → Loja → Conta, mais marketplace e período.
       Encadeado: trocar o pai revalida os filhos (normalizeCtx). */
    ctx: { grupo: 'g1', empresa: 'e1', cnpj: '', loja: '', marketplace: '', conta: '', periodo: '7d' },
    setCtx(k, v) {
      if (UI.ctx[k] === v) return;
      UI.ctx[k] = v;
      if (k === 'grupo') { UI.ctx.empresa = (V8LOGIC.empresasDe(v)[0] || {}).id || 'e1'; UI.ctx.cnpj = ''; UI.ctx.loja = ''; UI.ctx.conta = ''; }
      if (k === 'empresa') { UI.ctx.cnpj = ''; UI.ctx.loja = ''; UI.ctx.conta = ''; }
      if (k === 'cnpj') { UI.ctx.loja = ''; UI.ctx.conta = ''; }
      if (k === 'loja') { UI.ctx.conta = ''; }
      V8LOGIC.normalizeCtx(UI.ctx);
      UI.renderGbar();
      UI.refreshBadges();
      if (UI.renderers[UI.view]) UI.renderers[UI.view]();
      const nomes = { grupo: 'Grupo', empresa: 'Empresa', cnpj: 'CNPJ', loja: 'Loja', marketplace: 'Marketplace', conta: 'Conta', periodo: 'Período' };
      UI.toast(`${nomes[k] || k} do contexto atualizado · ${V8LOGIC.scopeLine(UI.ctx)}`, 'ok');
    },
    empresa() { return V8DATA.meta.empresas.find(e => e.id === UI.ctx.empresa); },
    ctxProducts() { return V8LOGIC.globalFilter(UI.state.products, UI.ctx); },
    scopeLineHtml() {
      const d = V8LOGIC.scopeDescribe(UI.ctx);
      return `<span class="src" title="Lojas: ${UI.esc(d.lojas.join(' · '))} — CNPJs: ${UI.esc(d.cnpjs.join(' · '))}">recorte: ${d.lojas.length} loja(s) · ${d.cnpjs.length} CNPJ(s) · ${d.contas.length} conta(s) · ${UI.esc(d.origem)}</span>`;
    },

    /* ---------- tema (token-based, nunca inversão) ---------- */
    theme() { return document.documentElement.getAttribute('data-theme'); },
    setTheme(t, persist) {
      document.documentElement.setAttribute('data-theme', t);
      const lbl = $('#themeLabel'); if (lbl) lbl.textContent = t === 'dark' ? 'Escuro' : 'Claro';
      if (persist !== false) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* sem storage */ } }
    },
    toggleTheme() { UI.setTheme(UI.theme() === 'dark' ? 'light' : 'dark'); },

    /* ---------- navegação ---------- */
    NAMES: { home: 'Mesa Estratégica', operacao: 'Histórico Operacional', pedidos: 'Pedidos', catalogo: 'Catálogo', crescimento: 'Central de Inteligência', seo: 'Orgânico e SEO', conciliacao: 'Conciliação Financeira', custos: 'Lucratividade', empresas: 'Empresas e Operações', conexoes: 'Conexões', missao: 'Execução', silencio: 'Radar', conhecimento: 'Conhecimento', importar: 'Fontes e Dados', ativacao: 'Ativação', equipe: 'Equipe', planos: 'Planos', suporte: 'Suporte' },

    /* ---------- 10.P.4 — MENU LATERAL PLANO: 21 áreas em 4 grupos ----------
       Cada área importante fica a UM clique no menu lateral, organizada em
       grupos discretos. Sem submenu horizontal como navegação principal; as
       subabas vivem DENTRO de cada tela. Migra as rotas existentes (view + sub
       opcional) sem perder nenhuma nem esconder o que importa. */
    MENU: [
      { grupo: 'Visão e Estratégia', itens: [
        { label: 'Início', view: 'home', icon: 'M3 10.5 12 3l9 7.5V21H3z' },
        { label: 'Central de Inteligência', view: 'crescimento', sub: 'Mesa de Inteligência', icon: 'M3 3v18h18M7 14l3-4 3 3 5-7' },
        { label: 'Crescimento Orgânico / SEO', view: 'seo', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
        { label: 'Ads', view: 'crescimento', sub: 'Ads', icon: 'M3 11l18-7-7 18-3-7-8-4z' },
        { label: 'Afiliados', view: 'crescimento', sub: 'Afiliados', icon: 'M9 12a4 4 0 0 1 4-4h4a4 4 0 0 1 0 8h-2M15 12a4 4 0 0 1-4 4H7a4 4 0 0 1 0-8h2' },
        { label: 'Radar', view: 'silencio', icon: 'M12 3a9 9 0 1 0 9 9M12 12l6-4M12 12v-6' } ] },
      { grupo: 'Operação e Vendas', itens: [
        { label: 'Catálogo', view: 'catalogo', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
        { label: 'Pedidos', view: 'pedidos', icon: 'M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9A2 2 0 0 1 5.5 19zM8 7a4 4 0 0 1 8 0' },
        { label: 'Conciliação Financeira', view: 'conciliacao', icon: 'M12 2v20M17 6H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6' },
        { label: 'Estoque e Full', view: 'crescimento', sub: 'Estoque Full', icon: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7' },
        { label: 'Devoluções', view: 'crescimento', sub: 'Devoluções e Cancelamentos', icon: 'M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3' },
        { label: 'Atendimento', view: 'crescimento', sub: 'Chat e Atendimento', icon: 'M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z' } ] },
      { grupo: 'Resultado e Gestão', itens: [
        { label: 'Lucratividade', view: 'custos', icon: 'M4 20V9M10 20V4M16 20v-8M22 20H2' },
        { label: 'Decisões', view: 'missao', sub: 'Decisões', icon: 'M4 12l5 5L20 6' },
        { label: 'Missões', view: 'missao', sub: 'Missões', icon: 'M5 3v18l7-4 7 4V3z' },
        { label: 'Conhecimento', view: 'conhecimento', icon: 'M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2zM19 3v18M8 8h7M8 12h7' } ] },
      { grupo: 'Sistema', itens: [
        { label: 'Empresas e Operações', view: 'empresas', icon: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h4a2 2 0 0 1 2 2v10' },
        { label: 'Fontes e Importações', view: 'importar', icon: 'M12 3v12M7 10l5 5 5-5M4 21h16' },
        { label: 'Conexões', view: 'conexoes', icon: 'M9 12a4 4 0 0 1 4-4h4a4 4 0 0 1 0 8h-2M15 12a4 4 0 0 1-4 4H7a4 4 0 0 1 0-8h2' },
        { label: 'Equipe e Permissões', view: 'equipe', icon: 'M9 8a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7' },
        { label: 'Configurações', view: 'planos', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M4 12H2M22 12h-2M5.6 5.6 7 7M17 17l1.4 1.4' } ] },
    ],
    menuItens() { return UI.MENU.reduce((a, g) => a.concat(g.itens), []); },
    _activeSub: null,
    menuMatch(it) { return it.view === UI.view && (it.sub || null) === (UI._activeSub || null); },
    /* desenha o menu lateral (grupos + itens) — nenhuma área importante escondida */
    renderNav() {
      const nav = $('#nav'); if (!nav) return;
      nav.innerHTML = UI.MENU.map(g => `<div class="navgroup"><div class="navgroup-t">${UI.esc(g.grupo)}</div>${g.itens.map(it =>
        `<button data-nav="${it.view}|${it.sub || ''}" title="${UI.esc(it.label)}"><svg viewBox="0 0 24 24"><path d="${it.icon}"/></svg><span>${UI.esc(it.label)}</span><em class="nbadge" data-badge="${it.view}"></em></button>`).join('')}</div>`).join('');
    },

    /* ---------- conta comercial (10.V) ----------
       Sessão demonstrativa: conta semeada; sessão real: criada no gate. */
    account: null,
    seedDemoAccount() {
      const acc = V8COM.createAccount({
        nome: 'Marcos', sobrenome: 'Demo', email: 'marcos@demo.example', telefone: '+55 31 90000-0000',
        senha: 'x', empresa: 'Líder Comércio Digital LTDA', pais: 'Brasil', aceiteTermos: true, aceitePrivacidade: true,
      });
      acc.modo = 'DEMONSTRACAO';
      V8COM.obGrupoEmpresa(acc, { grupo: 'Líder Group', empresa: 'Líder Comércio Digital LTDA', segmento: 'Casa e Decoração', pais: 'Brasil', porte: '10-50', modelo: 'loja física + marketplace' });
      V8COM.obAddCnpj(acc, { nomeFiscal: 'Líder Comércio Digital LTDA', nomeFantasia: 'Matriz MG', estado: 'MG', cidade: 'Lagoa Santa', principal: true });
      V8COM.obAddLoja(acc, { nome: 'Shopee Líder Molduras MG', tipo: 'marketplace', responsavel: 'Ana' });
      V8COM.obSelectMarketplaces(acc, [{ marketplace: 'Shopee', estado: 'usar demonstração' }, { marketplace: 'Mercado Livre', estado: 'conectar depois' }]);
      V8COM.obCatalogo(acc, 'catálogo demonstrativo');
      V8COM.invite(acc, { email: 'ana@demo.example', papel: 'CATALOGO' });
      V8COM.obComplete(acc);
      return acc;
    },
    go(v, sub) {
      UI.view = v;
      UI._activeSub = sub || null;
      $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
      /* destaca o item de menu que casa (view + sub); senão, o primeiro da view */
      const itens = UI.menuItens();
      const hit = itens.find(it => UI.menuMatch(it)) || itens.find(it => it.view === v) || null;
      const hitKey = hit ? hit.view + '|' + (hit.sub || '') : null;
      $$('#nav button[data-nav]').forEach(b => b.classList.toggle('active', hitKey && b.dataset.nav === hitKey));
      $('#crumb').textContent = (hit ? hit.label : (UI.NAMES[v] || v)) + (sub && (!hit || hit.sub !== sub) ? ' · ' + sub : '');
      if (UI.renderers[v]) UI.renderers[v](sub);
      $('#main').scrollTop = 0; window.scrollTo(0, 0);
    },
    /* ação "abrir detalhe": "area:alvo" — toda linha do cockpit leva a algo */
    open(ref) {
      const [v, alvo] = ref.split(':');
      UI.go(v, undefined);
      if (v === 'catalogo' && alvo) setTimeout(() => window.CATALOGO && CATALOGO.openDrawer(alvo), 30);
      if (v === 'missao' && alvo) setTimeout(() => window.MISSAO && MISSAO.focus(alvo), 30);
      if (v === 'crescimento' && alvo) setTimeout(() => window.CRESCIMENTO && CRESCIMENTO.focus(alvo), 30);
      if (v === 'pedidos' && alvo) setTimeout(() => window.PEDIDOS && PEDIDOS.focus(alvo), 30);
    },

    /* ---------- barra global ---------- */
    _gmenu: null,
    renderGbar() {
      const S = V8DATA.scope;
      const emp = UI.empresa();
      const loja = UI.ctx.loja ? S.lojas.find(s => s.id === UI.ctx.loja) : null;
      const conta = UI.ctx.conta ? S.contas.find(a => a.id === UI.ctx.conta) : null;
      const mkt = UI.ctx.marketplace ? V8DATA.MKTS.find(m => m.key === UI.ctx.marketplace).nome : 'Todos';
      const per = V8DATA.PERIODOS.find(p => p[0] === UI.ctx.periodo)[1];
      const menu = (kind, items) => UI._gmenu === kind
        ? `<div class="gmenu">${items.map(i => `<button class="gm-i" data-gact="${kind}" data-val="${i[0]}"><span><b>${UI.esc(i[1])}</b>${i[2] ? `<span class="src">${UI.esc(i[2])}</span>` : ''}</span></button>`).join('')}</div>` : '';
      /* fonte dos dados do recorte: real quando há base importada ativa, senão simulado */
      const temReal = window.IMPORTAR && window.V8IMP && V8IMP.coberturaReal && V8IMP.coberturaReal(IMPORTAR.eng).algum;
      const canal = loja ? (loja.tipo === 'fisica' ? 'Loja física' : 'Marketplace') : 'Marketplace';

      /* 10.P.4 — contexto principal: Empresa → Canal → Marketplace → Conta → Período → Fonte.
         CNPJ, filial e dados fiscais vivem em Empresas e Operações — não poluem a navegação diária. */
      $('#gbarCtx').innerHTML = `
        <span class="gwrap"><button class="gsel" data-gact="menu" data-menu="empresa" title="Empresa ativa"><span class="gk">empresa</span> ${UI.esc(emp.nome.split(' LTDA')[0].split(' ME')[0])} ▾</button>
          ${menu('empresa', V8LOGIC.empresasDe(UI.ctx.grupo).map(e => [e.id, e.nome, '']))}</span>
        <span class="gsel gstatic" title="Canal de venda"><span class="gk">canal</span> ${UI.esc(canal)}</span>
        <span class="gwrap"><button class="gsel ${UI.ctx.marketplace ? 'on' : ''}" data-gact="menu" data-menu="marketplace" title="Marketplace ativo"><span class="gk">marketplace</span> ${UI.esc(mkt)} ▾</button>
          ${menu('marketplace', [['', 'Todos', 'sem filtro de canal'], ...V8DATA.MKTS.map(m => [m.key, m.nome, ''])])}</span>
        <span class="gwrap"><button class="gsel ${conta ? 'on' : ''}" data-gact="menu" data-menu="conta" title="Conta do marketplace — limita anúncios, pedidos e estoque"><span class="gk">conta</span> ${conta ? UI.esc(conta.nome) : 'Todas'} ▾</button>
          ${menu('conta', [['', 'Todas as contas', 'do recorte atual'], ...V8LOGIC.contasDe(UI.ctx).map(a => [a.id, a.nome, (S.lojas.find(s => s.id === a.lojaId) || {}).nome])])}</span>
        <span class="gwrap"><button class="gsel ${UI.ctx.periodo !== '7d' ? 'on' : ''}" data-gact="menu" data-menu="periodo" title="Período global"><span class="gk">período</span> ${per} ▾</button>
          ${menu('periodo', V8DATA.PERIODOS.map(p => [p[0], p[1], '']))}</span>
        <span class="gsel gstatic" title="Origem dos dados do recorte"><span class="gk">fonte</span> ${temReal ? 'Dados Importados' : 'Dados Simulados'}</span>
        <span class="env-pill" title="Ambiente desta instância">${UI.esc(V8DATA.meta.env)}</span>`;

      const notifs = V8LOGIC.notifications(UI.state);
      const jobs = UI.state.jobs;
      $('#gbarTools').innerHTML = `
        <span class="gsearch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input id="gq" placeholder="Busca global…" aria-label="Busca global" autocomplete="off">
          <span class="gwrap" id="gqWrap"></span></span>
        <span class="gwrap"><button class="gicon" data-gact="menu" data-menu="notif" title="Central de notificações">◔ <span class="gbadge">${notifs.length || ''}</span></button>
          ${UI._gmenu === 'notif' ? `<div class="gmenu">${notifs.length ? notifs.map(n => `<button class="gm-i" data-gact="open" data-ref="${n.ref}"><span class="sig ${n.nivel}" style="width:7px;height:7px;border-radius:50%;margin-top:5px;background:var(--${n.nivel === 'info' ? 'info' : n.nivel})"></span><span><b>${UI.esc(n.txt)}</b></span></button>`).join('') : '<div class="empty" style="padding:14px"><b>Sem notificações</b></div>'}</div>` : ''}</span>
        <span class="gwrap"><button class="gicon" data-gact="menu" data-menu="jobs" title="Jobs em andamento e concluídos nesta sessão">⚙ <span class="gbadge">${jobs.length || ''}</span></button>
          ${UI._gmenu === 'jobs' ? `<div class="gmenu">${jobs.length ? jobs.slice().reverse().map(j => `<button class="gm-i" data-gact="open" data-ref="operacao:"><span><b>${j.id} · ${UI.esc(j.acao)} (${j.total} itens)</b><span class="src">${UI.esc(j.status)} · ${UI.esc(j.autor)} · reversível</span>${j.escopo ? `<span class="src">escopo: ${UI.esc(j.escopo.empresa)} · ${j.escopo.cnpjs.length} CNPJ(s) · ${j.escopo.lojas.length} loja(s)</span>` : ''}</span></button>`).join('') : '<div class="empty" style="padding:14px"><b>Nenhum job nesta sessão</b>Ações em massa aparecem aqui com trilha.</div>'}</div>` : ''}</span>
        <button class="gicon" data-gact="open" data-ref="importar:" title="Fontes e Histórico de Dados — toda importação, arquivo, escopo e rollback num lugar só.">⇪ Fontes</button>
        ${UI.account && UI.account.plano === 'TRIAL' ? `<button class="gicon" data-gact="open" data-ref="planos:" title="Trial ativo — dias restantes; clique para ver planos e uso.">TRIAL · ${V8COM.trialDaysLeft(UI.account)}d</button>` : ''}
        <button class="gicon" onclick="UI.toggleTheme()" title="Alternar tema claro/escuro">◐</button>
        <span class="gwrap"><button class="gicon" data-gact="menu" data-menu="perfil" title="Perfil e permissões">${UI.esc(V8DATA.meta.usuario[0])} · ${UI.esc(V8DATA.meta.papel)}</button>
          ${UI._gmenu === 'perfil' ? `<div class="gmenu"><div style="padding:8px 10px;font-size:12px">
            <b>${UI.esc(V8DATA.meta.usuario)}</b> · ${UI.esc(V8DATA.meta.papel)}<br>
            <span class="src">${UI.esc(emp.nome)} · ${UI.esc(emp.conta)}</span><hr class="hair">
            <div class="metric-row"><span class="lbl">Leitura interna</span><span class="st pos">total</span></div>
            <div class="metric-row"><span class="lbl">Escrita interna</span><span class="st info">auditada</span></div>
            <div class="metric-row"><span class="lbl">Escrita externa</span><span class="st neg">${UI.esc(V8DATA.STATUS.ESCRITA_BLOQUEADA)}</span></div>
          </div></div>` : ''}</span>`;

      const gq = $('#gq');
      if (gq) {
        gq.oninput = () => {
          const res = V8LOGIC.globalSearch(gq.value, UI.state, UI.ctx);
          $('#gqWrap').innerHTML = gq.value.trim().length >= 2
            ? `<div class="gmenu" style="left:-160px;right:auto;width:320px">${res.length ? res.map(r => `<button class="gm-i" data-gact="open" data-ref="${r.ref}"><span><b>${UI.esc(r.label)}</b><span class="src">${r.tipo} · ${UI.esc(r.sub)}</span></span></button>`).join('') : `<div class="empty" style="padding:14px"><b>Nada encontrado</b>Busquei em produtos, oportunidades, missões e conhecimento.</div>`}</div>` : '';
        };
      }
    },

    /* ---------- drawer / modal / toast ---------- */
    openDrawer(html) { $('#drawer').innerHTML = html; $('#drawerWrap').hidden = false; },
    closeDrawer() { $('#drawerWrap').hidden = true; },
    openModal(html) { $('#modal').innerHTML = html; $('#modalWrap').hidden = false; },
    closeModal() { $('#modalWrap').hidden = true; },
    toast(msg, kind) {
      const t = $('#toast');
      t.textContent = msg;
      t.className = 'toast show' + (kind ? ' ' + kind : '');
      clearTimeout(UI._tt);
      UI._tt = setTimeout(() => t.classList.remove('show'), 3400);
    },

    /* ---------- helpers ---------- */
    esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    brl(v) { return v == null ? '—' : 'R$ ' + v.toFixed(2).replace('.', ','); },
    stBadge(status) {
      const S = V8DATA.STATUS;
      const kind = { ATIVO: 'pos', [S.EM_PROCESSAMENTO]: 'info', [S.AGUARDANDO_APROVACAO]: 'warn', [S.EM_REVISAO]: 'warn', EM_REVISAO: 'warn', PAUSADO: 'warn', [S.BLOQUEADO]: 'neg', BLOQUEADO: 'neg', [S.PRONTO_REVISAO]: 'info', [S.AGUARDANDO_CONEXAO]: 'warn', [S.SEM_DADOS]: '', NAO_PUBLICADO: '', [S.ESCRITA_BLOQUEADA]: 'neg', [S.DADO_SIMULADO]: 'warn', [S.ACAO_INTERNA]: 'info', 'CONCLUÍDO (interno)': 'pos', ABERTA: 'info', 'EM ANDAMENTO': 'info', IGNORADA: '', ACOMPANHANDO: 'warn' }[status] || '';
      const label = status === 'NAO_PUBLICADO' ? 'NÃO PUBLICADO' : status;
      return `<span class="st ${kind}">${UI.esc(label)}</span>`;
    },
    refreshBadges() {
      const counts = V8LOGIC.badgeCounts(UI.state);
      $$('#nav .nbadge').forEach(b => { const c = counts[b.dataset.badge]; b.textContent = (c && c !== '0') ? c : ''; });
    },
  };

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    /* tema salvo por usuário; sem preferência → segue o sistema */
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* sem storage */ }
    if (!saved && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) saved = 'light';
    UI.setTheme(saved || 'dark', false);

    /* 10.E.2.5.2 — restaura dados importados persistidos (sobrevive ao refresh) */
    if (window.IMPORTAR && IMPORTAR.restaurar) {
      IMPORTAR.restaurar().then(ok => { if (ok && UI.view) UI.go(UI.view); });
      window.addEventListener('beforeunload', () => { try { IMPORTAR.persistir(); } catch (e) {} });
    }

    $('#themeToggle').addEventListener('click', UI.toggleTheme);
    $('#sideFold').addEventListener('click', () => $('.shell').classList.toggle('folded'));
    UI.renderNav();
    $('#nav').addEventListener('click', e => {
      const b = e.target.closest('[data-nav]'); if (!b) return;
      const [v, sub] = b.dataset.nav.split('|');
      UI.go(v, sub || undefined);
    });

    /* barra global: menus e ações */
    $('#gbar').addEventListener('click', e => {
      const b = e.target.closest('[data-gact]');
      if (!b) { if (!e.target.closest('.gmenu') && !e.target.closest('.gsearch')) { UI._gmenu = null; UI.renderGbar(); } return; }
      const act = b.dataset.gact;
      if (act === 'menu') { UI._gmenu = UI._gmenu === b.dataset.menu ? null : b.dataset.menu; UI.renderGbar(); }
      else if (act === 'open') { UI._gmenu = null; UI.renderGbar(); UI.open(b.dataset.ref); }
      else if (act === 'periodo' && b.dataset.val === 'custom') { /* 10.E.2.5.2 — período personalizado */
        UI._gmenu = null; UI.renderGbar();
        const c = UI.ctxCustom || { ini: '2026-06-05', fim: '2026-07-04' };
        UI.openModal(`<h3 class="h2">Período personalizado</h3>
          <p class="sub" style="margin-top:4px">Timezone da operação: America/Sao_Paulo.</p>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
            <label style="flex:1"><span class="eyebrow">Data inicial</span><br><input class="input" type="date" id="perIni" value="${c.ini}" style="width:100%;margin-top:4px"></label>
            <label style="flex:1"><span class="eyebrow">Data final</span><br><input class="input" type="date" id="perFim" value="${c.fim}" style="width:100%;margin-top:4px"></label>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" id="perGo">Aplicar período</button></div>`);
        $('#perGo').onclick = () => { UI.ctxCustom = { ini: $('#perIni').value, fim: $('#perFim').value }; UI.closeModal(); UI.setCtx('periodo', 'custom'); };
      }
      else { /* seleção de contexto: empresa | marketplace | periodo */
        UI._gmenu = null;
        UI.setCtx(act, b.dataset.val);
      }
    });
    document.addEventListener('click', e => {
      if (UI._gmenu && !e.target.closest('#gbar')) { UI._gmenu = null; UI.renderGbar(); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { UI.closeDrawer(); UI.closeModal(); if (UI._gmenu) { UI._gmenu = null; UI.renderGbar(); } }
    });

    if (!UI.account) UI.account = UI.seedDemoAccount();
    UI.renderGbar();
    UI.refreshBadges();
    const params = new URLSearchParams(location.search);
    UI.go(params.get('view') && UI.NAMES[params.get('view')] ? params.get('view') : 'home');

    /* ---------- auto-teste headless (?uiself=1) ---------- */
    if (params.get('uiself') === '1') {
      try {
        const errs = [];
        const need = (ok, msg) => { if (!ok) errs.push(msg); };
        /* temas */
        UI.setTheme('light'); need(UI.theme() === 'light', 'tema light aplica');
        need(getComputedStyle(document.body).backgroundColor !== '', 'tokens light');
        UI.setTheme('dark'); need(UI.theme() === 'dark', 'tema dark aplica');
        need(localStorage.getItem(THEME_KEY) === 'dark', 'preferência persiste');
        /* navegação: toda aba muda contexto real */
        for (const v of Object.keys(UI.NAMES)) {
          UI.go(v);
          const sec = $('#v-' + v);
          need(sec.classList.contains('on'), 'view ativa: ' + v);
          need(sec.innerHTML.trim().length > 80, 'view com conteúdo: ' + v);
        }
        /* nenhum botão sem comportamento */
        UI.go('catalogo');
        const bad = $$('button').filter(b =>
          !b.onclick && !b.dataset.v && !b.closest('.nav') &&
          !b._hasListener && !b.disabled && b.id !== 'themeToggle' && b.id !== 'sideFold' &&
          !b.getAttribute('onclick') && !b.dataset.act && !b.dataset.gact);
        need(bad.length === 0, 'botões sem comportamento: ' + bad.length);
        const disabledSemRazao = $$('button[disabled]').filter(b => !b.title);
        need(disabledSemRazao.length === 0, 'disabled sem razão: ' + disabledSemRazao.length);
        UI.go('home');
        document.body.dataset.uiselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
      } catch (e) { document.body.dataset.uiselfReady = 'fail: ' + e.message; }
    }

    /* ---------- auto-teste da barra global (?gbarself=1) ---------- */
    if (params.get('gbarself') === '1') {
      try {
        const errs = [];
        const need = (ok, msg) => { if (!ok) errs.push(msg); };
        need($('#gbarCtx').textContent.includes(V8DATA.meta.env), 'ambiente visível na barra');
        need($('#gbarRight').textContent.includes('DADO SIMULADO'), 'status da base visível');
        /* marketplace ativo filtra o catálogo */
        UI.go('catalogo', 'Produtos');
        const antes = $$('#catBody tbody tr').length;
        UI.setCtx('marketplace', 'shopee');
        const depois = $$('#catBody tbody tr').length;
        need(depois < antes, `marketplace filtra catálogo (${antes} → ${depois})`);
        need(depois === UI.ctxProducts().length, 'contagem bate com globalFilter');
        /* empresa ativa muda entidades */
        UI.setCtx('marketplace', '');
        const e1 = $$('#catBody tbody tr').length;
        UI.setCtx('empresa', 'e2');
        const e2 = $$('#catBody tbody tr').length;
        need(e1 !== e2 && e2 === V8DATA.products.filter(p => p.companyId === 'e2').length, `empresa muda entidades (${e1} → ${e2})`);
        UI.setCtx('empresa', 'e1');
        /* cadeia CNPJ → loja → conta filtra de verdade */
        UI.setCtx('cnpj', 'c2');
        const nC2 = $$('#catBody tbody tr').length;
        need(nC2 === V8LOGIC.globalFilter(UI.state.products, { empresa: 'e1', cnpj: 'c2' }).length, `CNPJ filtra catálogo (${nC2})`);
        UI.setCtx('cnpj', 'c1'); UI.setCtx('loja', 's1');
        const nS1 = $$('#catBody tbody tr').length;
        need(nS1 === 4, `loja s1 mostra só os produtos da loja (${nS1})`);
        need(UI.ctx.marketplace === '' || UI.ctx.marketplace === 'shopee', 'loja não conflita com marketplace');
        UI.setCtx('loja', ''); UI.setCtx('cnpj', '');
        /* trocar empresa reseta filhos órfãos */
        UI.setCtx('cnpj', 'c1'); UI.setCtx('empresa', 'e2');
        need(UI.ctx.cnpj === '', 'trocar empresa limpa CNPJ órfão');
        UI.setCtx('empresa', 'e1');
        /* período muda indicadores de performance */
        UI.go('crescimento', 'Pedidos e Funil');
        UI.setCtx('periodo', '7d');
        const f7 = $('#crBody').textContent;
        UI.setCtx('periodo', '30d');
        const f30 = $('#crBody').textContent;
        need(f7 !== f30, 'período global altera indicadores');
        UI.setCtx('periodo', '7d');
        /* busca global encontra e navega */
        const res = V8LOGIC.globalSearch('garrafa', UI.state);
        need(res.length >= 1 && res[0].ref.startsWith('catalogo:'), 'busca global encontra produto');
        UI.go('home');
        document.body.dataset.gbarselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
      } catch (e) { document.body.dataset.gbarselfReady = 'fail: ' + e.message; }
    }
  });
}());

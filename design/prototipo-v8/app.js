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
    NAMES: { home: 'Home', operacao: 'Operação', catalogo: 'Catálogo', crescimento: 'Crescimento', conexoes: 'Conexões', missao: 'A Missão', silencio: 'Silêncio', conhecimento: 'Conhecimento', ativacao: 'Ativação', equipe: 'Equipe', planos: 'Planos', suporte: 'Suporte' },

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
      $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
      $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
      $('#crumb').textContent = UI.NAMES[v] + (sub ? ' · ' + sub : '');
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
    },

    /* ---------- barra global ---------- */
    _gmenu: null,
    renderGbar() {
      const S = V8DATA.scope;
      const grupo = S.grupos.find(g => g.id === UI.ctx.grupo) || S.grupos[0];
      const emp = UI.empresa();
      const cnpj = UI.ctx.cnpj ? S.cnpjs.find(c => c.id === UI.ctx.cnpj) : null;
      const loja = UI.ctx.loja ? S.lojas.find(s => s.id === UI.ctx.loja) : null;
      const conta = UI.ctx.conta ? S.contas.find(a => a.id === UI.ctx.conta) : null;
      const mkt = UI.ctx.marketplace ? V8DATA.MKTS.find(m => m.key === UI.ctx.marketplace).nome : 'Todos';
      const per = V8DATA.PERIODOS.find(p => p[0] === UI.ctx.periodo)[1];
      const menu = (kind, items) => UI._gmenu === kind
        ? `<div class="gmenu">${items.map(i => `<button class="gm-i" data-gact="${kind}" data-val="${i[0]}"><span><b>${UI.esc(i[1])}</b>${i[2] ? `<span class="src">${UI.esc(i[2])}</span>` : ''}</span></button>`).join('')}</div>` : '';
      const cnpjNome = c => c.nome; /* rótulo curto do seletor */

      /* seletores encadeados: grupo → empresa → CNPJ → loja → mkt → conta */
      $('#gbarCtx').innerHTML = `
        <span class="gwrap"><button class="gsel" data-gact="menu" data-menu="grupo" title="Grupo/organização — limita as empresas visíveis"><span class="gk">grupo</span> ${UI.esc(grupo.nome.split(' (')[0])} ▾</button>
          ${menu('grupo', S.grupos.filter(g => g.autorizado).map(g => [g.id, g.nome, '']))}</span>
        <span class="gwrap"><button class="gsel" data-gact="menu" data-menu="empresa" title="Empresa ativa — limita CNPJs, lojas e entidades"><span class="gk">empresa</span> ${UI.esc(emp.nome.split(' LTDA')[0].split(' ME')[0])} ▾</button>
          ${menu('empresa', V8LOGIC.empresasDe(UI.ctx.grupo).map(e => [e.id, e.nome, '']))}</span>
        <span class="gwrap"><button class="gsel ${cnpj ? 'on' : ''}" data-gact="menu" data-menu="cnpj" title="CNPJ / entidade fiscal — limita as lojas"><span class="gk">cnpj</span> ${cnpj ? UI.esc(cnpj.nome) : 'Todos'} ▾</button>
          ${menu('cnpj', [['', 'Todos os CNPJs', 'da empresa ativa'], ...V8LOGIC.cnpjsDe(UI.ctx.empresa).map(c => [c.id, cnpjNome(c), c.doc])])}</span>
        <span class="gwrap"><button class="gsel ${loja ? 'on' : ''}" data-gact="menu" data-menu="loja" title="Loja / unidade operacional — limita contas e dados"><span class="gk">loja</span> ${loja ? UI.esc(loja.nome) : 'Todas'} ▾</button>
          ${menu('loja', [['', 'Todas as lojas', 'do recorte atual'], ...V8LOGIC.lojasDe({ empresa: UI.ctx.empresa, cnpj: UI.ctx.cnpj }).map(s => [s.id, s.nome, (S.cnpjs.find(c => c.id === s.cnpjId) || {}).nome + (s.tipo === 'fisica' ? ' · loja física' : '')])])}</span>
        <span class="gwrap"><button class="gsel ${UI.ctx.marketplace ? 'on' : ''}" data-gact="menu" data-menu="marketplace" title="Marketplace ativo"><span class="gk">mkt</span> ${UI.esc(mkt)} ▾</button>
          ${menu('marketplace', [['', 'Todos', 'sem filtro de canal'], ...V8DATA.MKTS.map(m => [m.key, m.nome, ''])])}</span>
        <span class="gwrap"><button class="gsel ${conta ? 'on' : ''}" data-gact="menu" data-menu="conta" title="Conta do marketplace — limita anúncios, pedidos e estoque"><span class="gk">conta</span> ${conta ? UI.esc(conta.nome) : 'Todas'} ▾</button>
          ${menu('conta', [['', 'Todas as contas', 'do recorte atual'], ...V8LOGIC.contasDe(UI.ctx).map(a => [a.id, a.nome, (S.lojas.find(s => s.id === a.lojaId) || {}).nome])])}</span>
        <span class="gwrap"><button class="gsel ${UI.ctx.periodo !== '7d' ? 'on' : ''}" data-gact="menu" data-menu="periodo" title="Período global"><span class="gk">período</span> ${per} ▾</button>
          ${menu('periodo', V8DATA.PERIODOS.map(p => [p[0], p[1], '']))}</span>
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

    $('#themeToggle').addEventListener('click', UI.toggleTheme);
    $('#sideFold').addEventListener('click', () => $('.shell').classList.toggle('folded'));
    $$('#nav button').forEach(b => b.addEventListener('click', () => UI.go(b.dataset.v)));

    /* barra global: menus e ações */
    $('#gbar').addEventListener('click', e => {
      const b = e.target.closest('[data-gact]');
      if (!b) { if (!e.target.closest('.gmenu') && !e.target.closest('.gsearch')) { UI._gmenu = null; UI.renderGbar(); } return; }
      const act = b.dataset.gact;
      if (act === 'menu') { UI._gmenu = UI._gmenu === b.dataset.menu ? null : b.dataset.menu; UI.renderGbar(); }
      else if (act === 'open') { UI._gmenu = null; UI.renderGbar(); UI.open(b.dataset.ref); }
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
        UI.go('crescimento', 'Performance');
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

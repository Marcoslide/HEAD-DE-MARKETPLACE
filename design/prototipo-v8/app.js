/* =============================================================
   HEAD MARKETPLACE OS · v8 — SHELL (UI global)
   Roteamento real entre áreas, dois temas nativos com preferência
   salva por usuário, drawer/modal/toast, auto-teste headless.
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

    /* ---------- tema (token-based, nunca inversão) ---------- */
    theme() { return document.documentElement.getAttribute('data-theme'); },
    setTheme(t, persist) {
      document.documentElement.setAttribute('data-theme', t);
      $('#themeLabel').textContent = t === 'dark' ? 'Escuro' : 'Claro';
      if (persist !== false) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* sem storage */ } }
    },
    toggleTheme() { UI.setTheme(UI.theme() === 'dark' ? 'light' : 'dark'); },

    /* ---------- navegação ---------- */
    NAMES: { home: 'Home', operacao: 'Operação', catalogo: 'Catálogo', crescimento: 'Crescimento', conexoes: 'Conexões', missao: 'A Missão', silencio: 'Silêncio', conhecimento: 'Conhecimento' },
    go(v, sub) {
      UI.view = v;
      $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
      $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
      $('#crumb').textContent = UI.NAMES[v] + (sub ? ' · ' + sub : '');
      if (UI.renderers[v]) UI.renderers[v](sub);
      $('#main').scrollTop = 0; window.scrollTo(0, 0);
    },
    /* ação "abrir detalhe" vinda da Home: "area:alvo" */
    open(ref) {
      const [v, alvo] = ref.split(':');
      UI.go(v, undefined);
      if (v === 'catalogo' && alvo) setTimeout(() => window.CATALOGO && CATALOGO.openDrawer(alvo), 30);
      if (v === 'missao' && alvo) setTimeout(() => window.MISSAO && MISSAO.focus(alvo), 30);
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
      const kind = { ATIVO: 'pos', [S.EM_PROCESSAMENTO]: 'info', [S.AGUARDANDO_APROVACAO]: 'warn', [S.EM_REVISAO]: 'warn', EM_REVISAO: 'warn', PAUSADO: 'warn', [S.BLOQUEADO]: 'neg', BLOQUEADO: 'neg', [S.PRONTO_REVISAO]: 'info', [S.AGUARDANDO_CONEXAO]: 'warn', [S.SEM_DADOS]: '', NAO_PUBLICADO: '', [S.ESCRITA_BLOQUEADA]: 'neg', [S.DADO_SIMULADO]: 'warn', [S.ACAO_INTERNA]: 'info', 'CONCLUÍDO (interno)': 'pos' }[status] || '';
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

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { UI.closeDrawer(); UI.closeModal(); }
    });

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
        /* nenhum botão sem comportamento: todo button tem handler, type ou disabled com razão */
        UI.go('catalogo');
        const bad = $$('button').filter(b =>
          !b.onclick && !b.dataset.v && !b.closest('.nav') &&
          !b._hasListener && !b.disabled && b.id !== 'themeToggle' && b.id !== 'sideFold' &&
          !b.getAttribute('onclick') && !b.dataset.act);
        need(bad.length === 0, 'botões sem comportamento: ' + bad.length);
        const disabledSemRazao = $$('button[disabled]').filter(b => !b.title);
        need(disabledSemRazao.length === 0, 'disabled sem razão: ' + disabledSemRazao.length);
        UI.go('home');
        document.body.dataset.uiselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
      } catch (e) { document.body.dataset.uiselfReady = 'fail: ' + e.message; }
    }
  });
}());

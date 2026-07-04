/* =============================================================
   v8 · A MISSÃO — central de execução
   Missões com estado real, decisão aprovável (interna) e trilha.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC;
  const MI = window.MISSAO = {};

  function card(m, hl) {
    const acts = m.status === D.STATUS.AGUARDANDO_APROVACAO
      ? `<button class="btn sm primary" data-act="aprovar" data-id="${m.id}">aprovar (interno)</button>
         <button class="btn sm ghost" data-act="adiar" data-id="${m.id}">decidir depois</button>`
      : m.status === D.STATUS.PRONTO_REVISAO
        ? `<button class="btn sm" data-act="revisar" data-id="${m.id}">abrir para revisão</button>`
        : `<button class="btn sm ghost" data-act="detalhe" data-id="${m.id}">detalhe</button>`;
    return `<div class="ctxcard" id="mi-${m.id}" style="${hl ? 'border-color:var(--accent);' : ''}margin-top:10px">
      <div class="h"><b>${UI.esc(m.titulo)}</b>${UI.stBadge(m.status)}</div>
      <div class="ctxitem"><span>agora</span><span>${UI.esc(m.agora)}</span></div>
      <div class="ctxitem"><span>origem · tipo</span><span class="src">${UI.esc(m.origem)} · ${UI.esc(m.tipo)}</span></div>
      <div class="ctxitem"><span>reversível</span><span>${m.reversivel ? 'sim' : 'não'}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px">${acts}
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('publicar_externo'))}">executar externamente</button></div>
    </div>`;
  }

  /* missões respeitam o escopo: loja ativa → só missões daquela loja */
  function missoesDoEscopo() {
    const lojaIds = UI.ctx.loja ? [UI.ctx.loja] : V8LOGIC.lojasDe({ empresa: UI.ctx.empresa, cnpj: UI.ctx.cnpj }).map(s => s.id);
    return D.missoes.filter(m => !m.lojaId || lojaIds.includes(m.lojaId));
  }

  function render() {
    const grupos = [
      [D.STATUS.AGUARDANDO_APROVACAO, 'Decisões que pedem você'],
      [D.STATUS.EM_PROCESSAMENTO, 'Em execução'],
      [D.STATUS.PRONTO_REVISAO, 'Prontas para revisão'],
      [D.STATUS.EM_REVISAO, 'Em revisão'],
    ];
    const doEscopo = missoesDoEscopo();
    UI.$('#v-missao').innerHTML = `
      <div class="eyebrow">a missão · central de execução</div>
      <h1 class="h1">A Missão</h1>
      <p class="sub" style="margin-top:6px">${UI.scopeLineHtml()}<br>O que o Head está executando, o que espera sua decisão e o que já foi entregue — tudo ${UI.esc(D.STATUS.ACAO_INTERNA).toLowerCase()} e reversível.</p>
      ${grupos.map(([st, titulo]) => {
        const list = doEscopo.filter(m => m.status === st);
        return list.length ? `<div class="sect"><div class="sect-h"><span class="h2">${titulo}</span><span class="src">${list.length}</span></div>${list.map(m => card(m, MI._focus === m.id)).join('')}</div>` : '';
      }).join('')}
      ${doEscopo.length ? '' : '<div class="panel sect"><div class="empty"><b>Nenhuma missão no escopo atual</b>Missões nascem do radar, das decisões e da mesa de comando — troque a loja na barra global para ver outras.</div></div>'}`;
    UI.$('#v-missao').onclick = onClick;
    MI._focus = null;
  }

  MI.focus = id => { MI._focus = id; render(); const el = UI.$('#mi-' + id); if (el) el.scrollIntoView({ block: 'center' }); };

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const m = D.missoes.find(x => x.id === b.dataset.id);
    if (!m) return;
    if (b.dataset.act === 'aprovar') {
      m.status = D.STATUS.EM_PROCESSAMENTO; m.agora = 'aprovada por você agora — executando internamente';
      L._audit(UI.state, 'Marcos', 'missao_aprovada', m.titulo);
      UI.toast('Missão aprovada — execução interna iniciada e auditada.', 'ok');
      UI.refreshBadges(); render();
    } else if (b.dataset.act === 'adiar') {
      L._audit(UI.state, 'Marcos', 'missao_adiada', m.titulo);
      UI.toast('Registrado: decisão adiada. A missão continua aguardando.', '');
    } else if (b.dataset.act === 'revisar' || b.dataset.act === 'detalhe') {
      UI.openDrawer(`<div class="drawer-h"><div>
          <div class="eyebrow">${UI.esc(m.origem)} · ${UI.esc(m.tipo)}</div>
          <h2 class="h1" style="font-size:18px">${UI.esc(m.titulo)}</h2></div>
          <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
        <dl class="kv"><dt>Status</dt><dd>${UI.stBadge(m.status)}</dd>
        <dt>Agora</dt><dd>${UI.esc(m.agora)}</dd>
        <dt>Reversível</dt><dd>${m.reversivel ? 'sim — cada passo pode ser desfeito' : 'não'}</dd>
        <dt>Execução externa</dt><dd>${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)} — nunca simulada como concluída</dd></dl>
        <div class="callout" style="margin-top:14px">A trilha completa desta missão (quem pediu, o que mudou, quando) fica no histórico auditável.</div>`);
    }
  }

  UI.renderers.missao = render;

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('miself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('missao');
      const pend = D.missoes.find(m => m.status === D.STATUS.AGUARDANDO_APROVACAO);
      need(!!pend, 'existe decisão pendente');
      UI.$(`[data-act="aprovar"][data-id="${pend.id}"]`).click();
      need(pend.status === D.STATUS.EM_PROCESSAMENTO, 'aprovar muda estado');
      need(UI.state.audit.some(a => a.acao === 'missao_aprovada'), 'aprovação auditada');
      const disb = UI.$$('#v-missao button[disabled]');
      need(disb.length > 0 && disb.every(x => x.title.length > 10), 'botão externo desabilitado com razão');
      document.body.dataset.miselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.miselfReady = 'fail: ' + e.message; }
  });
}());

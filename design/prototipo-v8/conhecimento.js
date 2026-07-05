/* =============================================================
   v8 · CONHECIMENTO — cérebro explicável
   O que o Head sabe, de onde veio, quanta confiança tem e quando
   NÃO usar. Nada aqui vira regra universal sem verificação.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const KO = window.CONHECIMENTO = { tipo: '' };
  const TIPOS = [...new Set(D.conhecimento.map(k => k.tipo))];

  function render() {
    const list = D.conhecimento.filter(k => !KO.tipo || k.tipo === KO.tipo);
    UI.$('#v-conhecimento').innerHTML = `
      <div class="eyebrow">conhecimento · cérebro explicável</div>
      <h1 class="h1">Conhecimento</h1>
      <p class="sub" style="margin-top:6px">Playbooks, regras provisórias e princípios — cada um com origem, confiança, quando usar e <b>quando não usar</b>. Conhecimento provisório nunca bloqueia estratégia; só a ação externa.</p>

      <div class="fbar sect">
        <button class="fchip ${!KO.tipo ? 'on' : ''}" data-act="tipo" data-t="">tudo · ${D.conhecimento.length}</button>
        ${TIPOS.map(t => `<button class="fchip ${KO.tipo === t ? 'on' : ''}" data-act="tipo" data-t="${t}">${t.toLowerCase()} · ${D.conhecimento.filter(k => k.tipo === t).length}</button>`).join('')}
      </div>

      ${list.map(k => `<div class="ctxcard" style="margin-top:10px">
        <div class="h"><b>${UI.esc(k.tema)}</b>
          <span>${UI.stBadge(k.confianca === 'PROVISÓRIO' ? 'EM_REVISAO' : 'ATIVO')}<span class="src" style="margin-left:6px">${k.confianca}</span></span></div>
        <p class="voice" style="font-size:14px;margin:6px 0">${UI.esc(k.resumo)}</p>
        <dl class="kv"><dt>Quando usar</dt><dd>${UI.esc(k.quandoUsar)}</dd>
        <dt>Quando NÃO usar</dt><dd>${UI.esc(k.quandoNaoUsar)}</dd>
        <dt>Tipo · origem</dt><dd>${UI.esc(k.tipo)} · ${UI.esc(k.origem)}</dd></dl>
      </div>`).join('')}

      ${fatosImportados()}

      <div class="callout sect">A hierarquia de confiança decide o tom: <b>VERIFICADO</b> orienta com firmeza; <b>PROVISÓRIO</b> orienta com transparência ("regra interna, confirmo na conta conectada"); o que não se sabe é dito como <b>${UI.esc(D.STATUS.SEM_DADOS)}</b>.</div>`;

    UI.$('#v-conhecimento').onclick = e => {
      const b = e.target.closest('[data-act="tipo"]');
      if (b) { KO.tipo = b.dataset.t; render(); }
    };
  }

  /* 10.E.2.2 — fatos com prova vindos das importações (fonte, campos, versão de dados) */
  function fatosImportados() {
    if (!window.IMPORTAR || !window.V8IMP) return '';
    const fatos = V8IMP.fatosConhecimento(IMPORTAR.eng);
    if (!fatos.length) return '';
    return `<div class="panel sect"><div class="sect-h" style="margin-top:0"><span class="h2">Fatos validados das importações</span>
      <span class="src">memória com prova — nunca solta</span></div>
      ${fatos.map(f => `<div class="exec-li"><span class="sig pos"></span>
        <div class="t"><b><span class="st pos plain" style="margin-right:6px">${UI.esc(f.tipo)}</span>${UI.esc(f.fato)}</b>
        <span>fontes: ${UI.esc(f.fontes)} · campos: ${UI.esc(f.campos || '—')} · período: ${UI.esc(f.periodo)} · versão de dados: ${UI.esc(f.versaoDados)} · confiança: ${UI.esc(f.confianca)}</span></div></div>`).join('')}
    </div>`;
  }

  UI.renderers.conhecimento = render;

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('koself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('conhecimento');
      need(UI.$$('#v-conhecimento .ctxcard').length === D.conhecimento.length, 'todo conhecimento listado');
      KO.tipo = 'PLAYBOOK'; render();
      need(UI.$$('#v-conhecimento .ctxcard').length === D.conhecimento.filter(k => k.tipo === 'PLAYBOOK').length, 'filtro por tipo');
      need(UI.$('#v-conhecimento').textContent.includes('Quando NÃO usar'), 'quando não usar sempre visível');
      KO.tipo = ''; render();
      document.body.dataset.koselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.koselfReady = 'fail: ' + e.message; }
  });
}());

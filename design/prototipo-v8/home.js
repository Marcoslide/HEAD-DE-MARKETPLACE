/* =============================================================
   v8 · HOME — mesa de decisão executiva
   Nada decorativo: cada item abre o detalhe correspondente.
   ============================================================= */
(function () {
  'use strict';
  const H = V8DATA.home;

  function li(sig, b, s, ref, label) {
    return `<div class="exec-li"><span class="sig ${sig}"></span>
      <div class="t"><b>${UI.esc(b)}</b><span>${UI.esc(s)}</span></div>
      ${ref ? `<button class="linklike" data-act="open" data-ref="${ref}">${label || 'abrir'} →</button>` : ''}</div>`;
  }

  function render() {
    const st = UI.state;
    const mkts = V8DATA.conexoes.filter(c => c.key !== 'whatsapp');
    UI.$('#v-home').innerHTML = `
      <div class="eyebrow">resumo do dia · ${UI.esc(V8DATA.meta.hoje)} · ${UI.esc(V8DATA.meta.env)}</div>
      <h1 class="h1">Bom dia, ${UI.esc(V8DATA.meta.usuario)}.</h1>
      <p class="voice" style="margin-top:8px;max-width:72ch">${UI.esc(H.resumo)}</p>

      <div class="exec-grid sect">
        <div>
          <div class="panel">
            <div class="sect-h" style="margin-top:0"><span class="h2">O que mudou desde ontem</span><span class="src">${UI.esc(V8DATA.STATUS.DADO_SIMULADO)}</span></div>
            ${H.melhorou.map(m => li('pos', m.txt, 'melhorou · ' + m.fonte, null)).join('')}
            ${H.piorou.map(m => li('neg', m.txt, 'piorou · ' + m.fonte, null)).join('')}
          </div>

          <div class="panel" style="margin-top:14px">
            <div class="sect-h" style="margin-top:0"><span class="h2">Prioridades que pedem você</span></div>
            ${li('neg', H.risco.txt, 'risco prioritário', H.risco.acao, 'ver produto')}
            ${li('pos', H.oportunidade.txt, 'oportunidade prioritária', H.oportunidade.acao, 'ver produto')}
            ${li('warn', H.decisaoPendente.txt, H.decisaoPendente.status, H.decisaoPendente.acao, 'decidir')}
            ${li('warn', H.missaoAndamento.txt, H.missaoAndamento.status, H.missaoAndamento.acao, 'acompanhar')}
            ${li('', H.intervencao.txt, H.intervencao.fonte, H.intervencao.acao, 'ver anúncio')}
          </div>

          <div class="panel" style="margin-top:14px">
            <div class="sect-h" style="margin-top:0"><span class="h2">Próximos passos sugeridos</span></div>
            ${H.proximosPassos.map((p, i) => li('', p, 'passo ' + (i + 1), 'catalogo:', 'ir ao catálogo')).join('')}
          </div>
        </div>

        <div>
          <div class="panel">
            <div class="sect-h" style="margin-top:0"><span class="h2">Status por marketplace</span></div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${mkts.map(c => `
                <div class="mkt-cell"><b>${UI.esc(c.nome)}</b>
                  ${UI.stBadge(c.status)}
                  <span class="src">escrita: ${UI.esc(c.escrita)} · <button class="linklike" data-act="open" data-ref="conexoes:">conectar →</button></span>
                </div>`).join('')}
            </div>
          </div>
          <div class="callout" style="margin-top:14px">
            Sem contas conectadas, tudo aqui é <b>${UI.esc(V8DATA.STATUS.DADO_SIMULADO)}</b> e rotulado.
            Nenhum número real será inventado: quando houver conexão oficial, os cartões passam a <b>DADO REAL</b> com origem e data.
          </div>
          <div class="panel" style="margin-top:14px">
            <div class="sect-h" style="margin-top:0"><span class="h2">Trilha de hoje</span></div>
            ${st.audit.length
              ? st.audit.slice(-5).reverse().map(a => li('', a.detalhe, a.actor + ' · ' + a.origem, null)).join('')
              : `<div class="empty"><b>Sem ações registradas hoje</b>Cada edição, job e decisão aparece aqui com autor e origem.</div>`}
          </div>
        </div>
      </div>`;

    UI.$('#v-home').onclick = e => {
      const b = e.target.closest('[data-act="open"]');
      if (b) UI.open(b.dataset.ref);
    };
  }

  UI.renderers.home = render;
}());

/* =============================================================
   v8 · SILÊNCIO — monitoramento explicado
   Silêncio não é ausência: é vigilância declarada. Cada vigia diz
   o que observa, quando checou e o que dispara alerta.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;

  function render() {
    const atencao = D.silencio.filter(s => s.estado === 'atencao');
    UI.$('#v-silencio').innerHTML = `
      <div class="eyebrow">silêncio · vigilância declarada</div>
      <h1 class="h1">Silêncio</h1>
      <p class="voice" style="margin-top:8px;max-width:70ch">Nada exigiu sua atenção além do que está na Home. Enquanto isso, estas vigias continuam ativas — cada uma com critério explícito de quando te acordar.</p>

      ${atencao.length ? `<div class="callout sect" style="border-left-color:var(--warn)">
        <b>${atencao.length} vigia em atenção:</b> ${atencao.map(s => UI.esc(s.nota || s.txt)).join(' · ')}</div>` : ''}

      <div class="tblwrap sect"><table class="tbl"><thead><tr>
        <th class="nosort">O que estou vigiando</th><th class="nosort">Critério de alerta</th><th class="nosort">Última checagem</th><th class="nosort">Estado</th></tr></thead><tbody>
        ${D.silencio.map(s => `<tr>
          <td><span class="tmain">${UI.esc(s.txt)}</span>${s.nota ? `<span class="tsub">${UI.esc(s.nota)}</span>` : ''}</td>
          <td><span class="src">${UI.esc(s.detalhe)}</span></td>
          <td><span class="src">${s.ultimaChecagem}</span></td>
          <td>${s.estado === 'atencao' ? '<span class="st warn">atenção</span>' : '<span class="st pos">normal</span>'}</td>
        </tr>`).join('')}
      </tbody></table>
      <div class="tfoot"><span>${D.silencio.length} vigias · ${UI.esc(D.STATUS.DADO_SIMULADO)} · checagens internas</span></div></div>

      <div class="callout sect">Quando uma vigia cruza o critério, ela vira <b>missão</b> ou <b>decisão pendente</b> — nunca um alerta que morre na tela.</div>`;
  }

  UI.renderers.silencio = render;
}());

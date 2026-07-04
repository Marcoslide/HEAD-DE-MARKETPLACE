/* =============================================================
   v8 · CONEXÕES — painel corporativo de integrações
   Nenhuma integração desconectada parece ativa. Cada conexão mostra
   status, escopo, saúde e última sincronização — com honestidade.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC;

  function render() {
    UI.$('#v-conexoes').innerHTML = `
      <div class="eyebrow">conexões · integrações oficiais</div>
      <h1 class="h1">Conexões</h1>
      <p class="sub" style="margin-top:6px">O sistema opera em <b>READ_ONLY por padrão</b>: primeiro leitura oficial, depois — com sua aprovação — escrita gate a gate. Nenhuma conta conectada nesta instância.</p>

      <div class="tblwrap sect"><table class="tbl"><thead><tr>
        <th class="nosort">Integração</th><th class="nosort">Status</th><th class="nosort">Escopo</th><th class="nosort">Escrita externa</th><th class="nosort">Saúde</th><th class="nosort">Última sync</th><th class="nosort"></th></tr></thead><tbody>
        ${D.conexoes.map(c => `<tr>
          <td><span class="tmain">${UI.esc(c.nome)}</span></td>
          <td>${UI.stBadge(c.status)}</td>
          <td><span class="src">${UI.esc(c.escopo)}</span></td>
          <td>${UI.stBadge(c.escrita === 'AÇÃO INTERNA apenas' ? D.STATUS.ACAO_INTERNA : D.STATUS.ESCRITA_BLOQUEADA)}</td>
          <td><span class="src">${c.saude ?? '— sem conexão, sem saúde a exibir'}</span></td>
          <td><span class="src">${c.ultimaSync ?? D.STATUS.SEM_DADOS}</span></td>
          <td><span class="rowact"><button class="btn sm" data-act="con" data-id="${c.key}">iniciar conexão</button></span></td>
        </tr>`).join('')}
      </tbody></table>
      <div class="tfoot"><span>0 de ${D.conexoes.length} conectadas · OAuth real fora do escopo deste modo</span></div></div>

      <div class="grid2 sect">
        <div class="panel"><span class="h2">O que a conexão de leitura destrava</span>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Anúncios e preços reais por canal</b><span>os cartões passam de ${D.STATUS.DADO_SIMULADO} para DADO REAL com data e origem</span></div></div>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Ranking legítimo</b><span>posição por palavra com comparação e confiança — nunca inventado</span></div></div>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Regras oficiais da categoria</b><span>substituem os packs internos provisórios</span></div></div>
        </div>
        <div class="panel"><span class="h2">O que continua bloqueado até você aprovar</span>
          <div class="exec-li"><span class="sig neg"></span><div class="t"><b>Publicar ou alterar anúncio externo</b><span>${D.STATUS.ESCRITA_BLOQUEADA} — gate a gate, com trilha</span></div></div>
          <div class="exec-li"><span class="sig neg"></span><div class="t"><b>Responder compradores externamente</b><span>só com canal oficial e sua autorização</span></div></div>
        </div>
      </div>`;

    UI.$('#v-conexoes').onclick = e => {
      const b = e.target.closest('[data-act="con"]');
      if (!b) return;
      const c = D.conexoes.find(x => x.key === b.dataset.id);
      UI.openModal(`<h3 class="h2">Conectar ${UI.esc(c.nome)}</h3>
        <p class="sub" style="margin-top:8px">Neste modo <b>${UI.esc(D.meta.env)}</b> a conexão oficial (OAuth) está fora do escopo — nada será simulado como conectado.</p>
        <dl class="kv" style="margin-top:10px"><dt>Passo real</dt><dd>autorização OAuth na conta oficial</dd>
        <dt>Escopo inicial</dt><dd>somente leitura</dd><dt>Escrita</dt><dd>bloqueada até aprovação explícita</dd></dl>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" onclick="UI.closeModal()">entendi</button></div>`);
      L._audit(UI.state, 'Marcos', 'conexao_consultada', c.nome);
    };
  }

  UI.renderers.conexoes = render;

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('conself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('conexoes');
      need(UI.$$('#v-conexoes tbody tr').length === D.conexoes.length, 'todas as integrações listadas');
      need(UI.$('#v-conexoes').textContent.includes('AGUARDANDO CONEXÃO'), 'status honesto');
      need(!UI.$('#v-conexoes').textContent.includes('CONECTADO'), 'nada parece ativo');
      document.body.dataset.conselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.conselfReady = 'fail: ' + e.message; }
  });
}());

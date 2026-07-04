/* =============================================================
   v8 · CONEXÕES — centro corporativo de integrações (10.UI.1)
   Tabela corporativa (não onboarding): empresa, conta, ambiente,
   OAuth, leitura/escrita separadas, saúde, erro, flags. Drawer com
   permissões, logs, webhooks e auditoria. Nada desconectado parece
   ativo; escrita externa nunca é habilitada aqui.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC;

  function render() {
    const empresa = UI.empresa();
    UI.$('#v-conexoes').innerHTML = `
      <div class="eyebrow">conexões · integrações oficiais</div>
      <h1 class="h1">Conexões</h1>
      <p class="sub" style="margin-top:6px">READ_ONLY por padrão: primeiro leitura oficial, depois — com sua aprovação — escrita gate a gate. Leitura e escrita são permissões <b>separadas</b> e auditadas.</p>

      <div class="tblwrap sect"><table class="tbl"><thead><tr>
        <th class="nosort">Integração</th><th class="nosort">Empresa · conta</th><th class="nosort">Ambiente</th><th class="nosort">Status</th>
        <th class="nosort">OAuth</th><th class="nosort">Leitura</th><th class="nosort">Escrita</th>
        <th class="nosort">Última sync</th><th class="nosort">Saúde</th><th class="nosort">Erro</th><th class="nosort">Flags</th><th class="nosort"></th></tr></thead><tbody>
        ${D.conexoes.map(c => `<tr>
          <td><button class="tmain linklike" style="font-size:12.5px" data-act="drawer" data-id="${c.key}">${UI.esc(c.nome)}</button></td>
          <td><span class="src">${UI.esc(empresa.nome)} · ${UI.esc(c.conta)}</span></td>
          <td><span class="env-pill">${UI.esc(c.ambiente)}</span></td>
          <td>${UI.stBadge(c.status)}</td>
          <td><span class="src">${UI.esc(c.oauth)}</span></td>
          <td>${UI.stBadge(c.leitura === 'comando interno' ? D.STATUS.ACAO_INTERNA : c.leitura)}</td>
          <td>${UI.stBadge(c.escrita === 'AÇÃO INTERNA apenas' ? D.STATUS.ACAO_INTERNA : D.STATUS.ESCRITA_BLOQUEADA)}</td>
          <td><span class="src">${c.ultimaSync ?? D.STATUS.SEM_DADOS}</span></td>
          <td><span class="src">${c.saude ?? '— sem conexão'}</span></td>
          <td>${c.erro ? `<span class="st neg plain">${UI.esc(c.erro)}</span>` : '<span class="src">—</span>'}</td>
          <td><span class="src">${c.flags.length ? c.flags.length + ' planejada(s)' : '—'}</span></td>
          <td><span class="rowact"><button class="btn sm" data-act="con" data-id="${c.key}">iniciar conexão</button></span></td>
        </tr>`).join('')}
      </tbody></table>
      <div class="tfoot"><span>0 de ${D.conexoes.length} conectadas · OAuth real fora do escopo deste modo · nenhuma integração desconectada aparece como ativa</span></div></div>

      <div class="grid2 sect">
        <div class="panel"><span class="h2">O que a leitura oficial destrava</span>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Anúncios, preços e pedidos reais por canal</b><span>os painéis passam de ${D.STATUS.DADO_SIMULADO} para DADO REAL com data e origem</span></div></div>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Funil e pedidos não pagos reais</b><span>hipóteses viram diagnóstico com evidência do canal</span></div></div>
          <div class="exec-li"><span class="sig pos"></span><div class="t"><b>Regras oficiais da categoria</b><span>substituem os packs internos provisórios</span></div></div>
        </div>
        <div class="panel"><span class="h2">O que continua bloqueado até você aprovar</span>
          <div class="exec-li"><span class="sig neg"></span><div class="t"><b>Publicar ou alterar anúncio externo</b><span>${D.STATUS.ESCRITA_BLOQUEADA} — gate a gate, com trilha</span></div></div>
          <div class="exec-li"><span class="sig neg"></span><div class="t"><b>Responder compradores externamente</b><span>só com canal oficial e sua autorização</span></div></div>
        </div>
      </div>`;

    UI.$('#v-conexoes').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'drawer') openDrawer(b.dataset.id);
      else if (b.dataset.act === 'con') {
        const c = D.conexoes.find(x => x.key === b.dataset.id);
        UI.openModal(`<h3 class="h2">Conectar ${UI.esc(c.nome)}</h3>
          <p class="sub" style="margin-top:8px">Neste modo <b>${UI.esc(D.meta.env)}</b> a conexão oficial (OAuth) está fora do escopo — nada será simulado como conectado.</p>
          <dl class="kv" style="margin-top:10px"><dt>Passo real</dt><dd>autorização OAuth na conta oficial</dd>
          <dt>Escopo inicial</dt><dd>somente leitura</dd><dt>Escrita</dt><dd>bloqueada até aprovação explícita, gate a gate</dd></dl>
          <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" onclick="UI.closeModal()">entendi</button></div>`);
        L._audit(UI.state, 'Marcos', 'conexao_consultada', c.nome);
      }
    };
  }

  function openDrawer(key) {
    const c = D.conexoes.find(x => x.key === key);
    const logs = UI.state.audit.filter(a => a.acao === 'conexao_consultada' && a.detalhe === c.nome);
    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">integração · ${UI.esc(c.ambiente)} · ${UI.esc(D.STATUS.DADO_SIMULADO)}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(c.nome)}</h2></div>
        <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>

      <div class="sect-h" style="margin-top:0"><span class="h2">Permissões (leitura ≠ escrita)</span></div>
      <dl class="kv">
        <dt>OAuth</dt><dd>${UI.esc(c.oauth)}</dd>
        <dt>Leitura</dt><dd>${UI.stBadge(c.leitura === 'comando interno' ? D.STATUS.ACAO_INTERNA : c.leitura)} <span class="src">escopo planejado: catálogo e pedidos</span></dd>
        <dt>Escrita</dt><dd>${UI.stBadge(c.escrita === 'AÇÃO INTERNA apenas' ? D.STATUS.ACAO_INTERNA : D.STATUS.ESCRITA_BLOQUEADA)} <span class="src">só é liberada gate a gate, com aprovação sua</span></dd>
        <dt>Feature flags</dt><dd>${c.flags.length ? c.flags.map(f => `<span class="st plain">${UI.esc(f)}</span>`).join(' ') : 'nenhuma'}</dd>
        <dt>Webhooks</dt><dd>${c.webhooks.length ? c.webhooks.join(', ') : 'nenhum registrado — exigem conexão oficial'}</dd>
      </dl>

      <div class="sect-h"><span class="h2">Histórico de sincronização</span></div>
      ${c.ultimaSync ? '' : `<div class="empty" style="padding:16px"><b>${UI.esc(D.STATUS.SEM_DADOS)}</b>Nenhuma sync executada — sem conexão não existe histórico, e nenhum será simulado.</div>`}

      <div class="sect-h"><span class="h2">Erros</span></div>
      ${c.erro ? `<div class="err-state">${UI.esc(c.erro)}</div>` : `<p class="src">Nenhum erro registrado.</p>`}

      <div class="sect-h"><span class="h2">Auditoria desta integração</span></div>
      ${logs.length ? logs.map(a => `<div class="ctxitem"><span>${UI.esc(a.acao)} · ${UI.esc(a.detalhe)}</span><span class="src">${UI.esc(a.actor)} · ${a.em}</span></div>`).join('')
        : `<p class="src">Nenhum evento nesta sessão. Consultas, conexões e mudanças de escopo aparecem aqui com autor.</p>`}

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn primary sm" data-actcon="iniciar" data-id="${c.key}">iniciar conexão (leitura)</button>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('publicar_externo'))}">habilitar escrita</button>
        <button class="btn sm" disabled title="${UI.esc(L.disabledReason('sync'))}">sincronizar agora</button>
      </div>`);
    UI.$('#drawer').onclick = e => {
      const b = e.target.closest('[data-actcon]');
      if (!b) return;
      UI.closeDrawer();
      UI.$(`#v-conexoes [data-act="con"][data-id="${b.dataset.id}"]`).click();
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
      need(!UI.$('#v-conexoes').textContent.includes(' CONECTADO'), 'nada parece ativo');
      /* leitura e escrita separadas + drawer com permissões e logs */
      const head = UI.$('#v-conexoes thead').textContent;
      need(head.includes('Leitura') && head.includes('Escrita') && head.includes('OAuth'), 'colunas leitura/escrita/OAuth separadas');
      openDrawer('ml');
      need(!UI.$('#drawerWrap').hidden, 'drawer de conexão abre');
      const dtxt = UI.$('#drawer').textContent;
      need(dtxt.includes('Permissões') && dtxt.includes('Auditoria'), 'drawer traz permissões e auditoria');
      UI.closeDrawer();
      document.body.dataset.conselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.conselfReady = 'fail: ' + e.message; }
  });
}());

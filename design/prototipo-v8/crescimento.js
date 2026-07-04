/* =============================================================
   v8 · CRESCIMENTO — mesa comercial
   Leads, afiliados, promoções e resultados. Tudo rotulado; ações
   comerciais são internas e auditadas.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC, G = D.crescimento;
  const SUBS = ['Visão Geral', 'Leads e Oportunidades', 'Afiliados', 'Promoções e Campanhas', 'Resultados', 'Pendências Comerciais'];
  const CR = window.CRESCIMENTO = { sub: 'Visão Geral', etapa: '' };
  const ETAPAS = ['NOVO', 'PROPOSTA', 'NEGOCIAÇÃO', 'GANHO', 'PERDIDO'];

  function render(sub) {
    if (sub && SUBS.includes(sub)) CR.sub = sub;
    UI.$('#v-crescimento').innerHTML = `
      <div class="eyebrow">crescimento · mesa comercial</div>
      <h1 class="h1">Crescimento</h1>
      <p class="sub" style="margin-top:6px">Oportunidades fora do anúncio: leads, afiliados e promoções — com margem mínima respeitada e atribuição sem duplicidade. ${UI.esc(D.STATUS.DADO_SIMULADO)}.</p>
      <div class="tabs" style="margin-top:16px">${SUBS.map(s => `<button class="tab ${s === CR.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}</button>`).join('')}</div>
      <div id="crBody" style="margin-top:16px"></div>`;
    body();
    UI.$('#v-crescimento').onclick = onClick;
  }

  function body() {
    const el = UI.$('#crBody');
    if (CR.sub === 'Visão Geral') {
      el.innerHTML = `
        <div class="grid3">
          <div class="panel"><div class="eyebrow">leads abertos</div><div class="h1">${G.leads.filter(l => !['GANHO', 'PERDIDO'].includes(l.etapa)).length}</div><span class="src">follow-up hoje: ${G.leads.filter(l => l.followUp === D.meta.hoje).length}</span></div>
          <div class="panel"><div class="eyebrow">valor em negociação</div><div class="h1">${UI.brl(G.leads.reduce((s, l) => s + l.valorEstimado, 0))}</div><span class="src">${D.STATUS.DADO_SIMULADO}</span></div>
          <div class="panel"><div class="eyebrow">comissões pendentes</div><div class="h1">${UI.brl(G.afiliados.reduce((s, a) => s + a.comissaoPendente, 0))}</div><span class="src">${G.afiliados.length} afiliados ativos</span></div>
        </div>
        <div class="callout" style="margin-top:14px">Cada venda tem <b>uma</b> origem — atribuição não duplica comissão. Promoção nunca fura a margem mínima do item.</div>`;
    } else if (CR.sub === 'Leads e Oportunidades') {
      const list = G.leads.filter(l => !CR.etapa || l.etapa === CR.etapa);
      el.innerHTML = `
        <div class="fbar" style="margin-top:0">
          <button class="fchip ${!CR.etapa ? 'on' : ''}" data-act="etapa" data-e="">todas as etapas</button>
          ${ETAPAS.map(e => `<button class="fchip ${CR.etapa === e ? 'on' : ''}" data-act="etapa" data-e="${e}">${e.toLowerCase()} · ${G.leads.filter(l => l.etapa === e).length}</button>`).join('')}
        </div>
        ${list.length ? `<div class="tblwrap"><table class="tbl"><thead><tr>
          <th class="nosort">Lead</th><th class="nosort">Canal</th><th class="nosort">Etapa</th><th class="nosort">Valor estimado</th><th class="nosort">Follow-up</th><th class="nosort"></th></tr></thead><tbody>
          ${list.map(l => `<tr><td><span class="tmain">${UI.esc(l.nome)}</span><span class="tsub">${l.origem}</span></td>
            <td>${UI.esc(l.canal)}</td><td>${UI.stBadge(l.etapa === 'NOVO' ? 'EM_REVISAO' : l.etapa)}<span class="tsub">${l.etapa}</span></td>
            <td>${UI.brl(l.valorEstimado)}</td>
            <td>${l.followUp === D.meta.hoje ? '<span class="st warn">hoje</span>' : `<span class="src">${l.followUp}</span>`}</td>
            <td><span class="rowact"><button class="btn sm" data-act="fup" data-id="${l.id}">registrar follow-up</button></span></td></tr>`).join('')}
          </tbody></table><div class="tfoot"><span>${list.length} lead(s) · ${D.STATUS.DADO_SIMULADO}</span></div></div>`
        : `<div class="panel"><div class="empty"><b>Nenhum lead nesta etapa</b>Leads chegam por WhatsApp, redes e afiliados — sempre com origem única.</div></div>`}`;
    } else if (CR.sub === 'Afiliados') {
      el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Afiliado</th><th class="nosort">Código</th><th class="nosort">Indicações</th><th class="nosort">Convertidas</th><th class="nosort">Comissão pendente</th></tr></thead><tbody>
        ${G.afiliados.map(a => `<tr><td class="tmain">${UI.esc(a.nome)}</td><td><span class="kbd">${a.codigo}</span></td>
          <td>${a.indicacoes}</td><td>${a.convertidas}</td><td>${UI.brl(a.comissaoPendente)}</td></tr>`).join('')}
        </tbody></table><div class="tfoot"><span>comissão só é devida com venda atribuída — sem dupla contagem</span></div></div>`;
    } else if (CR.sub === 'Promoções e Campanhas') {
      el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Promoção</th><th class="nosort">Tipo</th><th class="nosort">Itens</th><th class="nosort">Margem mínima</th><th class="nosort">Status</th><th class="nosort"></th></tr></thead><tbody>
        ${G.promocoes.map(pr => `<tr><td class="tmain">${UI.esc(pr.nome)}</td><td>${pr.tipo}</td><td>${pr.itens}</td>
          <td>${pr.margemMinimaRespeitada ? '<span class="st pos">respeitada</span>' : '<span class="st neg">violada</span>'}</td>
          <td>${UI.stBadge(pr.status)}</td>
          <td>${pr.status === D.STATUS.AGUARDANDO_APROVACAO ? `<span class="rowact"><button class="btn sm primary" data-act="aprovar" data-id="${pr.id}">aprovar (interno)</button></span>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="callout" style="margin-top:12px">Aprovar aqui é <b>${UI.esc(D.STATUS.ACAO_INTERNA)}</b>: a campanha fica pronta no sistema; aplicar em marketplace exige conexão oficial.</div>`;
    } else if (CR.sub === 'Resultados') {
      el.innerHTML = `<div class="grid3">
        <div class="panel"><div class="eyebrow">receita · ${G.resultados.janela}</div><div class="h1">${UI.brl(G.resultados.receitaSimulada)}</div><span class="src">${G.resultados.origem}</span></div>
        <div class="panel"><div class="eyebrow">pedidos</div><div class="h1">${G.resultados.pedidos}</div><span class="src">${G.resultados.origem}</span></div>
        <div class="panel"><div class="eyebrow">ticket médio</div><div class="h1">${UI.brl(G.resultados.ticketMedio)}</div><span class="src">${G.resultados.origem}</span></div></div>
        <div class="callout" style="margin-top:14px">Com contas conectadas, estes cartões passam a <b>DADO REAL</b> com origem por canal e janela declarada — nunca média sem contexto.</div>`;
    } else {
      el.innerHTML = G.pendenciasComerciais.length ? `<div class="panel">
        ${G.pendenciasComerciais.map(p => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>${UI.esc(p.txt)}</b><span>${p.quando}</span></div></div>`).join('')}
      </div>` : `<div class="panel"><div class="empty"><b>Sem pendências comerciais</b></div></div>`;
    }
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'sub') { CR.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Crescimento · ' + CR.sub; render(CR.sub); }
    else if (b.dataset.act === 'etapa') { CR.etapa = b.dataset.e; body(); }
    else if (b.dataset.act === 'fup') {
      const l = G.leads.find(x => x.id === b.dataset.id);
      L._audit(UI.state, 'Marcos', 'followup_lead', `${l.nome} (${l.etapa})`);
      l.followUp = '2026-07-06';
      UI.toast(`Follow-up de "${l.nome}" registrado — próximo em 2026-07-06.`, 'ok');
      UI.refreshBadges(); body();
    } else if (b.dataset.act === 'aprovar') {
      const pr = G.promocoes.find(x => x.id === b.dataset.id);
      pr.status = D.STATUS.EM_PROCESSAMENTO;
      L._audit(UI.state, 'Marcos', 'promo_aprovada', `${pr.nome} (interno)`);
      UI.toast(`"${pr.nome}" aprovada internamente. Aplicação externa: ${D.STATUS.ESCRITA_BLOQUEADA}.`, 'ok');
      body();
    }
  }

  UI.renderers.crescimento = render;

  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('groself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('crescimento', 'Leads e Oportunidades');
      need(UI.$$('#crBody tbody tr').length === G.leads.length, 'tabela de leads');
      CR.etapa = 'NEGOCIAÇÃO'; body();
      need(UI.$$('#crBody tbody tr').length === 1, 'filtro por etapa');
      CR.etapa = ''; CR.sub = 'Promoções e Campanhas'; body();
      const pend = G.promocoes.find(p => p.status === D.STATUS.AGUARDANDO_APROVACAO);
      if (pend) {
        UI.$(`[data-act="aprovar"][data-id="${pend.id}"]`).click();
        need(pend.status === D.STATUS.EM_PROCESSAMENTO, 'aprovação interna muda status');
        need(UI.state.audit.some(a => a.acao === 'promo_aprovada'), 'aprovação auditada');
      }
      document.body.dataset.groselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.groselfReady = 'fail: ' + e.message; }
  });
}());

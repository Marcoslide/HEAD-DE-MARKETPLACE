/* =============================================================
   v8 · CRESCIMENTO — mesa de crescimento de marketplace (10.UI.1)
   SEM CRM, SEM leads, SEM pipeline comercial. Aqui vive o que
   cresce uma operação de marketplace: performance por canal,
   oportunidades priorizadas, pedidos não pagos, experimentos,
   aceleração com gates e expansão consciente.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA, L = V8LOGIC, G = D.crescimento;
  const SUBS = ['Performance', 'Oportunidades', 'Pedidos Não Pagos', 'Experimentos', 'Aceleração', 'Expansão', 'Resultados e Aprendizados'];
  const CR = window.CRESCIMENTO = { sub: 'Performance', mkt: 'ml' };

  const mktAtivo = () => UI.ctx.marketplace || CR.mkt;
  const perAtivo = () => UI.ctx.periodo === 'hoje' ? 'hoje' : UI.ctx.periodo;
  const prods = () => UI.ctxProducts();
  const pById = id => UI.state.products.find(p => p.id === id);
  const num = v => v == null ? '—' : v.toLocaleString('pt-BR');

  /* ---------------- shell ---------------- */
  function render(sub) {
    if (sub && SUBS.includes(sub)) CR.sub = sub;
    UI.$('#v-crescimento').innerHTML = `
      <div class="eyebrow">crescimento · mesa de marketplace</div>
      <h1 class="h1">Crescimento</h1>
      <p class="sub" style="margin-top:6px">Funil, perda de pagamento, oportunidades priorizadas, experimentos com ponto de parada e expansão com gates. ${UI.esc(D.STATUS.DADO_SIMULADO)} · rotulado.</p>
      <div class="tabs" style="margin-top:14px">${SUBS.map(s => `<button class="tab ${s === CR.sub ? 'on' : ''}" data-act="sub" data-sub="${s}">${s}${s === 'Oportunidades' ? `<span class="cnt">${UI.state.opportunities.filter(o => o.status === 'ABERTA').length}</span>` : s === 'Pedidos Não Pagos' ? `<span class="cnt">${L.unpaidList({ marketplace: UI.ctx.marketplace }).length}</span>` : ''}</button>`).join('')}</div>
      <div id="crBody" style="margin-top:14px"></div>`;
    body();
    UI.$('#v-crescimento').onclick = onClick;
  }

  function body() {
    const el = UI.$('#crBody');
    if (CR.sub === 'Performance') el.innerHTML = performance();
    else if (CR.sub === 'Oportunidades') el.innerHTML = oportunidades();
    else if (CR.sub === 'Pedidos Não Pagos') el.innerHTML = naoPagos();
    else if (CR.sub === 'Experimentos') el.innerHTML = experimentos();
    else if (CR.sub === 'Aceleração') el.innerHTML = aceleracao();
    else if (CR.sub === 'Expansão') el.innerHTML = expansao();
    else el.innerHTML = resultados();
    UI.refreshBadges();
  }

  /* foco vindo da Home / busca global: "o1" (oportunidade) | "naopagos" */
  CR.focus = alvo => {
    if (alvo === 'naopagos') { CR.sub = 'Pedidos Não Pagos'; render(CR.sub); }
    else if (/^o\d+/.test(alvo)) { CR.sub = 'Oportunidades'; render(CR.sub); openOpp(alvo); }
    else render();
  };

  /* ---------------- Performance ---------------- */
  function performance() {
    const mk = mktAtivo(), per = perAtivo();
    const mkNome = D.MKTS.find(m => m.key === mk).nome;
    const fun = L.funnel(mk, per);
    const k = L.perfKpis(mk, per);
    const selector = `<div class="fbar" style="margin-top:0">
      ${D.MKTS.map(m => `<button class="fchip ${m.key === mk ? 'on' : ''}" data-act="mkt" data-mkt="${m.key}" ${UI.ctx.marketplace ? 'title="marketplace fixado pela barra global"' : ''}>${m.nome}</button>`).join('')}
      <span style="flex:1"></span><span class="src">período: ${D.PERIODOS.find(p => p[0] === per)[1]} (barra global)</span></div>`;

    /* visão POR LOJA do recorte atual — quem caiu, quem subiu, onde dói */
    const lojasScope = L.lojasDe({ empresa: UI.ctx.empresa, cnpj: UI.ctx.cnpj }).filter(s => !UI.ctx.loja || s.id === UI.ctx.loja);
    const porLoja = `
      <div class="panel" style="margin-top:14px">
        <div class="sect-h" style="margin-top:0"><span class="h2">Por loja · recorte atual</span>
          <span style="display:flex;gap:8px;align-items:center">${UI.scopeLineHtml()}
          <button class="btn sm" data-act="cmplojas">comparar lojas</button></span></div>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
          <th class="nosort">Loja</th><th class="nosort">CNPJ</th><th class="nosort">Pedidos</th><th class="nosort">Não pagos</th>
          <th class="nosort">Faturamento</th><th class="nosort">Δ vs 7d ant.</th><th class="nosort">Conversão</th><th class="nosort">Devol.</th></tr></thead><tbody>
        ${lojasScope.map(s => {
          const kk = L.lojaKpis(s.id, per === 'hoje' ? '7d' : per);
          const c = D.scope.cnpjs.find(x => x.id === s.cnpjId) || {};
          if (!kk) return `<tr><td class="tmain">${UI.esc(s.nome)}</td><td><span class="src">${UI.esc(c.nome)}</span></td><td colspan="6"><span class="src">${UI.esc(D.STATUS.SEM_DADOS)} — sem integração; nada inventado</span></td></tr>`;
          return `<tr>
            <td><button class="tmain linklike" style="font-size:12.5px" data-act="focoloja" data-loja="${s.id}">${UI.esc(s.nome)}</button><span class="tsub">${s.tipo === 'fisica' ? 'loja física' : UI.esc((D.MKTS.find(m => m.key === s.marketplace) || {}).nome)}</span></td>
            <td><span class="src">${UI.esc(c.nome)}</span></td>
            <td>${kk.pedidos}</td>
            <td>${kk.naoPagos}${kk.taxaNaoPago != null ? ` <span class="delta ${kk.taxaNaoPago > 25 ? 'down' : ''}">${kk.taxaNaoPago}%</span>` : ''}</td>
            <td>${UI.brl(kk.faturamento)}</td>
            <td>${kk.deltaFaturamento != null ? `<span class="delta ${kk.deltaFaturamento >= 0 ? 'up' : 'down'}">${kk.deltaFaturamento >= 0 ? '+' : ''}${kk.deltaFaturamento}%</span>` : '<span class="src">—</span>'}</td>
            <td>${kk.conversao != null ? kk.conversao + '%' : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span>`}</td>
            <td>${kk.devolucoes}</td></tr>`;
        }).join('')}
        </tbody></table></div>
      </div>`;

    if (!fun) return selector + porLoja + `
      <div class="panel" style="margin-top:14px"><div class="empty"><b>${mkNome}: ${UI.esc(D.STATUS.SEM_DADOS)}</b>
      Não há integração nem importação para este canal — nenhuma etapa do funil será inventada.
      <br><button class="linklike" data-act="goconx">conectar leitura oficial →</button></div></div>`;

    const max = fun.find(f => f.valor != null).valor || 1;
    return selector + `
      <div class="grid2">
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Funil · ${mkNome}</span><span class="src">${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div>
          ${fun.map(f => f.valor == null
            ? `<div class="funrow nodata"><span class="fl">${f.etapa}</span><span class="fb"><span></span></span><span class="fv">${UI.esc(D.STATUS.SEM_DADOS)}</span></div>`
            : `<div class="funrow ${f.chave === 'naoPagos' ? 'loss' : ''}"><span class="fl">${f.etapa}</span>
                 <span class="fb"><span style="width:${Math.max(1, Math.round((f.valor / max) * 100))}%"></span></span>
                 <span class="fv">${num(f.valor)}</span></div>`).join('')}
          <p class="src" style="margin-top:8px">Etapas sem origem válida (carrinho, avaliação, recompra) aparecem como ${UI.esc(D.STATUS.SEM_DADOS)} — nunca estimadas.</p>
        </div>
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Indicadores · ${mkNome}</span>
            ${k.deltaFaturamento != null ? `<span class="delta ${k.deltaFaturamento >= 0 ? 'up' : 'down'}">${k.deltaFaturamento >= 0 ? '+' : ''}${k.deltaFaturamento}% vs 7d anteriores</span>` : '<span class="src">sem período anterior comparável</span>'}</div>
          <div class="metric-row"><span class="lbl">Impressões</span><span class="val">${num(k.impressoes)}</span></div>
          <div class="metric-row"><span class="lbl">Cliques · CTR</span><span class="val">${num(k.cliques)} · ${k.ctr}%</span></div>
          <div class="metric-row"><span class="lbl">Conversão (visita→aprovado)</span><span class="val">${k.conversao}%</span></div>
          <div class="metric-row"><span class="lbl">Pedidos criados</span><span class="val">${num(k.pedidos)}</span></div>
          <div class="metric-row"><span class="lbl">Pedidos não pagos</span><span class="val"><span class="num crit" style="font-size:13px">${num(k.naoPagos)}</span> · ${Math.round((k.naoPagos / k.pedidos) * 100)}%</span></div>
          <div class="metric-row"><span class="lbl">Pagamentos aprovados</span><span class="val">${num(k.aprovados)} · ${k.taxaAprovacao}%</span></div>
          <div class="metric-row"><span class="lbl">Faturamento</span><span class="val">${UI.brl(k.faturamento)}</span></div>
          <div class="metric-row"><span class="lbl">Devoluções · cancelamentos</span><span class="val">${k.devolucoes} · ${k.cancelamentos}</span></div>
          <div class="metric-row"><span class="lbl">Reputação</span><span class="val">${k.reputacao}</span></div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn sm" data-act="sub" data-sub="Pedidos Não Pagos">ver perda de pagamento</button>
            <button class="btn sm ghost" data-act="sub" data-sub="Oportunidades">oportunidades deste canal</button>
          </div>
        </div>
      </div>` + porLoja;
  }

  /* modo COMPARAR LOJAS: até 4, com aviso de comparabilidade */
  function openCompareLojas() {
    const lojas = L.lojasDe({ empresa: UI.ctx.empresa, cnpj: UI.ctx.cnpj });
    UI.openModal(`<h3 class="h2">Comparar lojas</h3>
      <p class="sub" style="margin-top:4px">Até 4 lojas/contas por vez · período: ${D.PERIODOS.find(p => p[0] === perAtivo())[1]} · ${UI.esc(D.STATUS.DADO_SIMULADO)}.</p>
      <div style="display:grid;gap:6px;margin-top:10px;max-height:200px;overflow:auto">
        ${lojas.map(s => `<label style="display:flex;gap:8px;align-items:center;font-size:12.5px"><input type="checkbox" data-cmploja="${s.id}"> ${UI.esc(s.nome)} <span class="src">${UI.esc((D.scope.cnpjs.find(c => c.id === s.cnpjId) || {}).nome)}${s.tipo === 'fisica' ? ' · física' : ''}</span></label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="cmpGo">Comparar</button></div>`);
    UI.$('#cmpGo').onclick = () => {
      const ids = UI.$$('#modal [data-cmploja]:checked').map(i => i.dataset.cmploja);
      if (ids.length < 2) return UI.toast('Selecione pelo menos 2 lojas.', 'err');
      if (ids.length > 4) return UI.toast('Comparação limitada a 4 lojas por vez.', 'err');
      const cmp = L.compareLojas(ids, perAtivo() === 'hoje' ? '7d' : perAtivo());
      const METRICAS = [['pedidos', 'Pedidos'], ['naoPagos', 'Não pagos'], ['taxaNaoPago', 'Taxa não pago %'], ['faturamento', 'Faturamento'], ['conversao', 'Conversão %'], ['devolucoes', 'Devoluções'], ['estoqueCritico', 'Itens estoque crítico'], ['deltaFaturamento', 'Δ faturamento %']];
      UI.openModal(`<h3 class="h2">Comparação · ${cmp.periodo} · ${UI.esc(cmp.origem)}</h3>
        ${cmp.avisos.map(a => `<div class="callout" style="margin-top:8px;border-left-color:var(--warn)">⚠ ${UI.esc(a)}</div>`).join('')}
        <div class="tblwrap" style="margin-top:10px"><table class="tbl" style="min-width:0"><thead><tr>
          <th class="nosort">Métrica</th>${cmp.rows.map(r => `<th class="nosort">${UI.esc(r.loja)}<span class="tsub" style="text-transform:none">${UI.esc(r.cnpj)}${cmp.ranking[0] === r.lojaId ? ' · nº 1 em faturamento' : ''}</span></th>`).join('')}</tr></thead><tbody>
          ${METRICAS.map(([k, lbl]) => `<tr><td class="tmain">${lbl}</td>
            ${cmp.rows.map(r => {
              const v = r.kpis ? r.kpis[k] : null;
              if (v == null) return `<td><span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span></td>`;
              return `<td>${k === 'faturamento' ? UI.brl(v) : v}</td>`;
            }).join('')}</tr>`).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:8px">ranking por faturamento: ${cmp.ranking.map((id, i) => `${i + 1}º ${UI.esc((D.scope.lojas.find(s => s.id === id) || {}).nome)}`).join(' · ')}</p>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
    };
  }

  /* ---------------- Oportunidades ---------------- */
  function oportunidades() {
    const mkFilter = UI.ctx.marketplace;
    let list = L.sortOpportunities(UI.state.opportunities).filter(o => o.status !== 'IGNORADA');
    if (mkFilter) list = list.filter(o => o.marketplace === mkFilter);
    if (!list.length) return `<div class="panel"><div class="empty"><b>Nenhuma oportunidade aberta${mkFilter ? ' neste marketplace' : ''}</b>O radar cria oportunidades a partir de margem, tráfego, devolução e funil.</div></div>`;
    return `
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Prior.</th><th class="nosort">Oportunidade</th><th class="nosort">Entidade</th><th class="nosort">Mkt</th>
        <th class="nosort">Impacto</th><th class="nosort">Margem</th><th class="nosort">Confiança</th><th class="nosort">Responsável</th><th class="nosort">Status</th><th class="nosort"></th></tr></thead><tbody>
      ${list.map(o => {
        const p = pById(o.produtoId);
        return `<tr>
          <td><span class="num ${o.prioridade >= 85 ? 'crit' : ''}" style="font-size:13px">${o.prioridade}</span></td>
          <td><button class="tmain linklike" style="font-size:12.5px" data-act="opp" data-id="${o.id}">${UI.esc(o.tipo)}</button><span class="tsub">${UI.esc(o.acao)}</span></td>
          <td><button class="linklike" data-act="ent" data-id="${o.produtoId}">${UI.esc(p ? p.sku : o.produtoId)}</button></td>
          <td>${UI.esc((D.MKTS.find(m => m.key === o.marketplace) || { nome: o.marketplace }).nome)}</td>
          <td>${UI.esc(o.impacto)}</td><td>${o.margem}%</td><td>${UI.esc(o.confianca)}</td><td>${UI.esc(o.responsavel)}</td>
          <td>${UI.stBadge(o.status)}</td>
          <td><span class="rowact"><button class="btn sm ghost" data-act="opp" data-id="${o.id}">abrir</button></span></td></tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>${list.length} oportunidade(s) priorizadas por impacto × risco · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div></div>`;
  }

  function openOpp(id) {
    const o = UI.state.opportunities.find(x => x.id === id);
    if (!o) return;
    const p = pById(o.produtoId);
    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">oportunidade ${o.id} · prioridade ${o.prioridade} · ${UI.esc(D.STATUS.DADO_SIMULADO)}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(o.tipo)}</h2></div>
        <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
      <dl class="kv">
        <dt>Entidade</dt><dd>${UI.esc(p ? p.nome + ' (' + p.sku + ')' : o.produtoId)}</dd>
        <dt>Marketplace</dt><dd>${UI.esc((D.MKTS.find(m => m.key === o.marketplace) || { nome: o.marketplace }).nome)}</dd>
        <dt>Evidência</dt><dd>${UI.esc(o.evidencia)}</dd>
        <dt>Hipótese</dt><dd><span class="st info plain">HIPÓTESE</span> ${UI.esc(o.hipotese)}</dd>
        <dt>Impacto</dt><dd>${UI.esc(o.impacto)}</dd>
        <dt>Risco</dt><dd>${UI.esc(o.risco)}</dd>
        <dt>Margem</dt><dd>${o.margem}%</dd>
        <dt>Confiança</dt><dd>${UI.esc(o.confianca)}</dd>
        <dt>Ação recomendada</dt><dd>${UI.esc(o.acao)}</dd>
        <dt>Responsável · status</dt><dd>${UI.esc(o.responsavel)} · ${UI.stBadge(o.status)}</dd>
      </dl>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn primary sm" data-act="d-ent" data-id="${o.produtoId}">abrir entidade</button>
        <button class="btn sm" data-act="d-missao" data-id="${o.id}">criar missão</button>
        <button class="btn sm" data-act="d-exp" data-id="${o.id}">iniciar experimento</button>
        <button class="btn sm ghost" data-act="d-acomp" data-id="${o.id}">acompanhar</button>
        <button class="btn sm ghost" data-act="d-ign" data-id="${o.id}">ignorar (com motivo)</button>
      </div>`);
    UI.$('#drawer').onclick = onDrawer;
  }

  /* ---------------- Pedidos Não Pagos ---------------- */
  function naoPagos() {
    const mk = UI.ctx.marketplace || null;
    const stat = L.unpaidStats(mk, perAtivo() === 'hoje' ? '7d' : perAtivo());
    const byLoja = L.unpaidByLoja(UI.ctx);
    const list = byLoja.list;
    const lojaNome = id => (D.scope.lojas.find(s => s.id === id) || { nome: id }).nome;
    return `
      ${stat ? `<div class="statusline" style="margin-top:0;grid-template-columns:repeat(5,1fr)">
        <div class="sl"><span class="k">pedidos não pagos</span><span class="v neg">${stat.naoPagos}</span></div>
        <div class="sl"><span class="k">valor potencial perdido</span><span class="v neg">${UI.brl(stat.valorPotencialPerdido)}</span></div>
        <div class="sl"><span class="k">taxa de não pagamento</span><span class="v ${stat.taxaNaoPago > 25 ? 'neg' : 'warn'}">${stat.taxaNaoPago}%</span></div>
        <div class="sl"><span class="k">taxa de aprovação</span><span class="v">${stat.taxaAprovacao}%</span></div>
        <div class="sl"><span class="k">base</span><span class="v">${stat.pedidosCriados} pedidos</span><button data-act="sub" data-sub="Performance" title="ver funil completo">funil →</button></div>
      </div>` : `<div class="panel"><div class="empty"><b>${UI.esc(D.STATUS.SEM_DADOS)}</b>Sem pedidos criados no recorte atual.</div></div>`}

      <div class="callout" style="margin-top:12px"><b>Pedido criado ≠ venda.</b> Esta área isola a perda entre o pedido e o pagamento aprovado.
      O Head levanta hipóteses (frete, cupom, prazo, checkout) mas <b>nunca afirma causa sem evidência</b> do canal. Sem recuperação automática, sem contato com comprador.</div>

      ${Object.keys(byLoja.porLoja).length > 1 ? `
      <div class="panel" style="margin-top:12px">
        <div class="sect-h" style="margin-top:0"><span class="h2">Concentração por loja</span>${UI.scopeLineHtml()}</div>
        ${Object.entries(byLoja.porLoja).sort((a, b) => b[1].valor - a[1].valor).map(([lid, v]) => `
          <div class="metric-row"><span class="lbl"><button class="linklike" data-act="focoloja" data-loja="${lid}">${UI.esc(v.loja)}</button></span>
          <span class="val">${v.qtd} pedido(s) · ${UI.brl(v.valor)}</span></div>`).join('')}
      </div>` : ''}

      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Pedido</th><th class="nosort">Loja</th><th class="nosort">Anúncio</th><th class="nosort">Valor</th><th class="nosort">Frete</th>
        <th class="nosort">Cupom</th><th class="nosort">Pagamento</th><th class="nosort">Motivo conhecido</th><th class="nosort">Data</th><th class="nosort"></th></tr></thead><tbody>
      ${list.map(o => `<tr>
        <td><span class="tmain">${o.id}</span><span class="tsub">${UI.esc(o.confianca)}</span></td>
        <td><span class="src">${UI.esc(lojaNome(o.lojaId))}</span></td>
        <td><button class="linklike" data-act="ent" data-id="${o.produtoId}" style="font-size:12px">${UI.esc(o.anuncio)}</button></td>
        <td>${UI.brl(o.valor)}</td><td>${UI.brl(o.frete)}</td>
        <td>${o.cupom ? UI.esc(o.cupom) : '—'}</td>
        <td>${o.formaPagamento ? UI.esc(o.formaPagamento) : `<span class="src">${UI.esc(D.STATUS.SEM_DADOS)}</span>`}</td>
        <td>${o.motivo ? `<span class="st warn plain">${UI.esc(o.motivo)}</span>` : `<span class="src">não informado pelo canal</span>`}</td>
        <td><span class="src">${o.data}</span></td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="np" data-id="${o.id}">hipóteses</button></span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>${list.length} pedido(s) não pago(s) · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div></div>`;
  }

  function openNp(id) {
    const o = D.crescimento.pedidosNaoPagos.find(x => x.id === id);
    if (!o) return;
    const hyps = L.unpaidHypotheses(o);
    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">pedido não pago ${o.id} · ${UI.esc(o.origem)} · confiança: ${UI.esc(o.confianca)}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(o.anuncio)}</h2></div>
        <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
      <dl class="kv">
        <dt>Valor · frete</dt><dd>${UI.brl(o.valor)} · ${UI.brl(o.frete)}</dd>
        <dt>Desconto · cupom</dt><dd>${o.desconto ? UI.brl(o.desconto) : '—'} · ${o.cupom ? UI.esc(o.cupom) : '—'}</dd>
        <dt>Forma de pagamento</dt><dd>${o.formaPagamento ? UI.esc(o.formaPagamento) : UI.esc(D.STATUS.SEM_DADOS)}</dd>
        <dt>Data</dt><dd>${o.data}</dd></dl>
      <div class="sect-h"><span class="h2">Leitura do Head</span></div>
      ${hyps.map(h => `<div class="exec-li"><span class="sig ${h.tipo === 'FATO' ? 'pos' : h.tipo === 'PONTO DE PARADA' ? 'neg' : 'warn'}"></span>
        <div class="t"><b><span class="st ${h.tipo === 'FATO' ? 'pos' : 'info'} plain" style="margin-right:6px">${h.tipo}</span>${UI.esc(h.txt)}</b>${h.evidencia ? `<span>evidência: ${UI.esc(h.evidencia)}</span>` : ''}</div></div>`).join('')}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn sm" data-act="d-ent" data-id="${o.produtoId}">abrir produto</button>
        <button class="btn sm" data-act="d-exp-np" data-id="${o.id}">experimento de frete/preço</button>
        <button class="btn sm" disabled title="Contato com comprador não existe neste produto — fora de escopo por decisão de privacidade.">contatar comprador</button>
      </div>`);
    UI.$('#drawer').onclick = onDrawer;
  }

  /* ---------------- Experimentos ---------------- */
  function experimentos() {
    const list = UI.state.experiments;
    return `
      <div class="fbar" style="margin-top:0">
        <button class="btn sm primary" data-act="novo-exp">novo experimento</button>
        <span class="src">todo experimento exige hipótese, métrica primária, margem mínima e ponto de parada — execução externa segue ${UI.esc(D.STATUS.ESCRITA_BLOQUEADA)}</span></div>
      <div class="tblwrap"><table class="tbl"><thead><tr>
        <th class="nosort">Experimento</th><th class="nosort">Alvo</th><th class="nosort">Mkt</th><th class="nosort">Métrica primária</th>
        <th class="nosort">Ponto de parada</th><th class="nosort">Responsável</th><th class="nosort">Status</th><th class="nosort">Resultado</th></tr></thead><tbody>
      ${list.map(x => {
        const p = pById(x.alvo);
        return `<tr>
          <td><span class="tmain">${UI.esc(x.tipo)} · ${x.id}</span><span class="tsub" style="max-width:260px;white-space:normal">${UI.esc(x.hipotese)}</span></td>
          <td><button class="linklike" data-act="ent" data-id="${x.alvo}">${UI.esc(p ? p.sku : x.alvo)}</button></td>
          <td>${UI.esc((D.MKTS.find(m => m.key === x.marketplace) || {}).nome || x.marketplace)}</td>
          <td>${UI.esc(x.metricaPrimaria)}<span class="tsub">margem mín. ${x.margemMinima}%</span></td>
          <td><span class="st neg plain" style="white-space:normal">${UI.esc(x.pontoDeParada)}</span></td>
          <td>${UI.esc(x.responsavel)}</td>
          <td>${UI.stBadge(x.status)}</td>
          <td><span class="src" style="white-space:normal">${UI.esc(x.resultadoObservado || 'aguardando')}${x.aprendizado ? ' · aprendizado registrado' : ''}</span></td></tr>`;
      }).join('')}
      </tbody></table><div class="tfoot"><span>${list.length} experimento(s) · ${UI.esc(D.STATUS.DADO_SIMULADO)}</span></div></div>`;
  }

  function novoExp(prefill) {
    prefill = prefill || {};
    const inp = (id, label, val, ph) => `<label style="display:block;margin-top:8px"><span class="eyebrow">${label}</span><br>
      <input class="input" id="${id}" style="width:100%;margin-top:3px" value="${UI.esc(val || '')}" placeholder="${ph || ''}"></label>`;
    UI.openModal(`<h3 class="h2">Novo experimento</h3>
      <p class="sub" style="margin-top:4px">Sem hipótese, métrica e ponto de parada o experimento é recusado.</p>
      ${inp('xTipo', 'Tipo (preço, frete, imagem, título…)', prefill.tipo)}
      ${inp('xHip', 'Hipótese', prefill.hipotese, 'o que você acredita que muda e por quê')}
      ${inp('xAlvo', 'Alvo (SKU)', prefill.alvo)}
      ${inp('xMet', 'Métrica primária', prefill.metricaPrimaria, 'ex.: taxa de pagamento aprovado')}
      ${inp('xStop', 'Ponto de parada', prefill.pontoDeParada, 'ex.: margem < 45% ou queda de 15% em pedidos')}
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="xCriar">Criar experimento</button></div>`);
    UI.$('#xCriar').onclick = () => {
      const v = id => UI.$('#' + id).value.trim();
      const alvoP = UI.state.products.find(p => p.sku === v('xAlvo')) || pById(prefill.alvoId);
      try {
        L.createExperiment(UI.state, {
          tipo: v('xTipo'), hipotese: v('xHip'), alvo: alvoP ? alvoP.id : v('xAlvo'),
          marketplace: prefill.marketplace || mktAtivo(), metricaPrimaria: v('xMet'),
          pontoDeParada: v('xStop'), margemMinima: 45, responsavel: D.meta.usuario,
          periodo: D.meta.hoje + ' → +14d',
        });
        UI.closeModal(); UI.toast('Experimento criado — interno, auditado, com ponto de parada.', 'ok');
        CR.sub = 'Experimentos'; body();
      } catch (e) { UI.toast(e.message, 'err'); }
    };
  }

  /* ---------------- Aceleração ---------------- */
  function aceleracao() {
    const A = G.aceleracao;
    const list = prods();
    return `
      <div class="callout" style="margin-top:0">Acelerar sem base validada queima dinheiro. Cada alavanca cruza margem, estoque, capacidade, readiness e Customer Outcome — <b>Ads nunca é resposta para produto ruim ou margem ruim</b>.</div>
      <div class="grid2" style="margin-top:12px">
        <div class="panel">
          <div class="sect-h" style="margin-top:0"><span class="h2">Ads — quem passa no gate</span></div>
          ${list.map(p => {
            const g = L.accelGate('ads', p);
            return `<div class="exec-li"><span class="sig ${g.allowed ? 'pos' : 'neg'}"></span>
              <div class="t"><b>${UI.esc(p.nome)}</b><span>${UI.esc(g.motivo)}</span></div>
              ${g.allowed
                ? `<button class="linklike" data-act="plan-ads" data-id="${p.id}">planejar →</button>`
                : `<button class="linklike" data-act="ent" data-id="${p.id}">resolver →</button>`}</div>`;
          }).join('')}
        </div>
        <div>
          <div class="panel">
            <div class="sect-h" style="margin-top:0"><span class="h2">Promoções — impacto em margem obrigatório</span></div>
            ${A.promocoes.map(pr => {
              const imp = L.promoImpact(pr);
              return `<div class="exec-li"><span class="sig ${imp.respeitaMinima ? 'warn' : 'neg'}"></span>
                <div class="t"><b>${UI.esc(pr.nome)}</b><span>margem ${pr.margemAntes}% → ${pr.margemDepois}% (${imp.deltaMargem}pp) · mínima ${pr.margemMinima}% ${imp.respeitaMinima ? 'respeitada' : 'VIOLADA'} · ${pr.itens} itens</span></div>
                ${pr.status === D.STATUS.AGUARDANDO_APROVACAO ? `<button class="linklike" data-act="promo-ok" data-id="${pr.id}">aprovar (interno) →</button>` : UI.stBadge(pr.status)}</div>`;
            }).join('')}
          </div>
          <div class="panel" style="margin-top:12px">
            <div class="sect-h" style="margin-top:0"><span class="h2">Afiliados · Creators · Live</span></div>
            ${A.afiliados.map(a => `<div class="exec-li"><span class="sig"></span><div class="t"><b>${UI.esc(a.nome)} <span class="kbd">${a.codigo}</span></b><span>${a.indicacoes} indicações · ${a.convertidas} convertidas · ${UI.brl(a.comissaoPendente)} pendente — atribuição única, sem dupla contagem</span></div></div>`).join('')}
            ${A.creators.map(c => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>${UI.esc(c.nome)}</b><span>${UI.esc(c.proposta)} · ${UI.esc(c.estagio)} · gate: ${UI.esc(c.gate)}</span></div></div>`).join('')}
            <div class="exec-li"><span class="sig"></span><div class="t"><b>Live Commerce</b><span>${UI.esc(A.live.proximaJanela)} · ${UI.esc(A.live.requisito)}</span></div></div>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- Expansão ---------------- */
  function expansao() {
    const cands = L.expansionCandidates(prods());
    const kits = prods().filter(p => L.accelGate('kit', p).allowed && p.estoque > 50);
    return `
      <div class="callout" style="margin-top:0">Expandir é decisão cruzada: schema, compliance, margem, logística, estoque, capacidade e ciclo de vida. Tudo aqui gera <b>draft interno</b> — publicar fora continua exigindo conexão e aprovação.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr>
        <th class="nosort">Movimento</th><th class="nosort">Produto</th><th class="nosort">Canal alvo</th><th class="nosort">Cruzamento</th><th class="nosort">Situação</th><th class="nosort"></th></tr></thead><tbody>
      ${cands.map(c => `<tr>
        <td><span class="tmain">${UI.esc(c.tipo)}</span></td>
        <td><button class="linklike" data-act="ent" data-id="${c.produtoId}">${UI.esc(c.produto)}</button></td>
        <td>${UI.esc(c.marketplace)}</td>
        <td><span class="src">${UI.esc(c.cruzamento)}</span></td>
        <td>${c.apto ? '<span class="st pos">apto</span>' : `<span class="st warn plain">${UI.esc(c.bloqueio)}</span>`}</td>
        <td><span class="rowact">${c.apto
          ? `<button class="btn sm" data-act="draft" data-id="${c.produtoId}" data-mkt="${c.mktKey}">criar rascunho interno</button>`
          : `<button class="btn sm ghost" data-act="ent" data-id="${c.produtoId}">resolver bloqueio</button>`}</span></td></tr>`).join('')}
      ${kits.map(p => `<tr>
        <td><span class="tmain">potencial de kit / bundle</span></td>
        <td><button class="linklike" data-act="ent" data-id="${p.id}">${UI.esc(p.nome)}</button></td>
        <td>canais atuais</td>
        <td><span class="src">margem ${L.margem(p)}% · estoque ${p.estoque} · ${L.accelGate('kit', p).motivo}</span></td>
        <td><span class="st pos">apto</span></td>
        <td><span class="rowact"><button class="btn sm" data-act="kit" data-id="${p.id}">montar kit interno</button></span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>${cands.length + kits.length} movimento(s) de expansão avaliados no contexto ativo</span></div></div>`;
  }

  /* ---------------- Resultados e Aprendizados ---------------- */
  function resultados() {
    const per = perAtivo();
    const r = G.resultados[per] || G.resultados['7d'];
    const perLbl = D.PERIODOS.find(p => p[0] === per)[1];
    return `
      <div class="statusline" style="margin-top:0;grid-template-columns:repeat(3,1fr)">
        <div class="sl"><span class="k">receita · ${perLbl.toLowerCase()}</span><span class="v">${UI.brl(r.receita)}</span></div>
        <div class="sl"><span class="k">pedidos aprovados</span><span class="v">${r.pedidos}</span></div>
        <div class="sl"><span class="k">ticket médio</span><span class="v">${UI.brl(r.ticket)}</span></div>
      </div>
      <p class="src" style="margin-top:8px">${UI.esc(r.origem)} · com contas conectadas estes números passam a DADO REAL com origem por canal e janela declarada.</p>
      <div class="panel" style="margin-top:12px">
        <div class="sect-h" style="margin-top:0"><span class="h2">Aprendizados registrados</span><span class="src">viram conhecimento com confiança declarada</span></div>
        ${G.aprendizados.map(a => `<div class="exec-li"><span class="sig pos"></span>
          <div class="t"><b>${UI.esc(a.txt)}</b><span>${UI.esc(a.fonte)} · confiança: ${UI.esc(a.confianca)}</span></div>
          <button class="linklike" data-act="goknow">conhecimento →</button></div>`).join('')}
      </div>`;
  }

  /* ---------------- eventos ---------------- */
  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'sub') { CR.sub = b.dataset.sub; UI.$('#crumb').textContent = 'Crescimento · ' + CR.sub; render(CR.sub); }
    else if (act === 'mkt') { if (UI.ctx.marketplace) return UI.toast('Marketplace está fixado pela barra global — troque lá.', ''); CR.mkt = b.dataset.mkt; body(); }
    else if (act === 'cmplojas') openCompareLojas();
    else if (act === 'focoloja') {
      const s = D.scope.lojas.find(x => x.id === b.dataset.loja);
      const c = D.scope.cnpjs.find(x => x.id === s.cnpjId);
      UI.ctx.empresa = c.empresaId; UI.ctx.cnpj = c.id; UI.setCtx('loja', s.id);
    }
    else if (act === 'opp') openOpp(b.dataset.id);
    else if (act === 'np') openNp(b.dataset.id);
    else if (act === 'ent') UI.open('catalogo:' + b.dataset.id);
    else if (act === 'novo-exp') novoExp();
    else if (act === 'goconx') UI.go('conexoes');
    else if (act === 'goknow') UI.go('conhecimento');
    else if (act === 'plan-ads') {
      const p = pById(b.dataset.id);
      UI.toast(`Plano de Ads para ${p.sku} entra como missão interna — verba só sai com sua aprovação e conta conectada.`, 'ok');
      L._audit(UI.state, 'Marcos', 'ads_planejado', p.sku + ' (gate ok)');
    }
    else if (act === 'promo-ok') {
      const pr = G.aceleracao.promocoes.find(x => x.id === b.dataset.id);
      const imp = L.promoImpact(pr);
      if (!imp.respeitaMinima) return UI.toast('Recusado: a promoção violaria a margem mínima.', 'err');
      pr.status = D.STATUS.EM_PROCESSAMENTO;
      L._audit(UI.state, 'Marcos', 'promo_aprovada', `${pr.nome} (Δ margem ${imp.deltaMargem}pp, interno)`);
      UI.toast(`"${pr.nome}" aprovada internamente (Δ margem ${imp.deltaMargem}pp). Aplicação externa: ${D.STATUS.ESCRITA_BLOQUEADA}.`, 'ok');
      body();
    }
    else if (act === 'draft') {
      const p = pById(b.dataset.id);
      CATALOGO.drafts.push({ id: 'exp-d' + (CATALOGO.drafts.length + 1), produtoId: p.id, mkt: b.dataset.mkt, status: D.STATUS.EM_REVISAO, nota: 'nasceu da Expansão (gate de margem+logística ok)' });
      L._audit(UI.state, 'Marcos', 'draft_criado', `${p.sku} → ${b.dataset.mkt} (via Expansão)`);
      UI.toast('Rascunho interno criado — veja em Catálogo · Rascunhos e Revisões.', 'ok');
      body();
    }
    else if (act === 'kit') {
      const p = pById(b.dataset.id);
      const g = L.accelGate('kit', p);
      if (!g.allowed) return UI.toast(g.motivo, 'err');
      L._audit(UI.state, 'Marcos', 'kit_proposto', `${p.sku} (kit interno, ${g.motivo})`);
      UI.toast(`Kit interno proposto para ${p.sku} — margem e logística verificadas.`, 'ok');
    }
  }

  function onDrawer(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'd-ent') { UI.closeDrawer(); UI.open('catalogo:' + b.dataset.id); }
    else if (act === 'd-missao') {
      const r = L.opportunityAction(UI.state, b.dataset.id, 'missao');
      D.missoes.push({ id: 'm' + (D.missoes.length + 1), titulo: r.missao, status: D.STATUS.EM_PROCESSAMENTO, tipo: D.STATUS.ACAO_INTERNA, agora: 'criada da oportunidade ' + b.dataset.id, origem: 'crescimento · oportunidades', reversivel: true });
      UI.closeDrawer(); UI.toast('Missão criada a partir da oportunidade — veja em A Missão.', 'ok'); UI.refreshBadges(); body();
    }
    else if (act === 'd-acomp') { L.opportunityAction(UI.state, b.dataset.id, 'acompanhar'); UI.closeDrawer(); UI.toast('Oportunidade em acompanhamento.', 'ok'); body(); }
    else if (act === 'd-ign') {
      const id = b.dataset.id;
      UI.openModal(`<h3 class="h2">Ignorar oportunidade</h3>
        <p class="sub" style="margin-top:4px">O motivo fica registrado na trilha — ignorar sem motivo é recusado.</p>
        <input class="input" id="ignMotivo" style="width:100%;margin-top:10px" placeholder="ex.: fora da estratégia deste trimestre">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
          <button class="btn danger" id="ignOk">Ignorar com motivo</button></div>`);
      UI.$('#ignOk').onclick = () => {
        const r = L.opportunityAction(UI.state, id, 'ignorar', UI.$('#ignMotivo').value.trim());
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.closeDrawer(); UI.toast('Oportunidade ignorada — motivo auditado.', 'ok'); body();
      };
    }
    else if (act === 'd-exp') {
      const o = UI.state.opportunities.find(x => x.id === b.dataset.id);
      UI.closeDrawer();
      novoExp({ tipo: o.tipo.includes('CTR') ? 'imagem' : 'preço/frete', hipotese: o.hipotese, alvoId: o.produtoId, alvo: (pById(o.produtoId) || {}).sku, marketplace: o.marketplace, metricaPrimaria: '', pontoDeParada: '' });
    }
    else if (act === 'd-exp-np') {
      const o = D.crescimento.pedidosNaoPagos.find(x => x.id === b.dataset.id);
      UI.closeDrawer();
      novoExp({ tipo: 'frete', hipotese: 'frete/condição de pagamento pesa na conclusão do pedido ' + o.id, alvoId: o.produtoId, alvo: (pById(o.produtoId) || {}).sku, marketplace: o.marketplace });
    }
  }

  UI.renderers.crescimento = render;

  /* ---------- auto-teste (?groself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('groself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('crescimento', 'Performance');
      need(UI.$('#crBody').textContent.includes('Pedido não pago'), 'funil separa pedido não pago');
      CR.mkt = 'magalu'; body();
      need(UI.$('#crBody').textContent.includes('SEM DADOS'), 'canal sem integração → SEM DADOS, nada inventado');
      CR.mkt = 'ml';
      /* sem CRM */
      need(!/Leads/.test(UI.$('#v-crescimento').textContent), 'sem Leads');
      need(!/Pipeline/.test(UI.$('#v-crescimento').textContent), 'sem Pipeline');
      /* oportunidades priorizadas + ação exige motivo */
      CR.sub = 'Oportunidades'; body();
      const pri = UI.$$('#crBody tbody tr td:first-child .num').map(x => +x.textContent);
      need(pri.length > 2 && pri.every((v, i) => i === 0 || pri[i - 1] >= v), 'fila ordenada por prioridade');
      need(L.opportunityAction(UI.state, 'o4', 'ignorar', '').blocked, 'ignorar sem motivo é recusado');
      /* pedidos não pagos isolados */
      CR.sub = 'Pedidos Não Pagos'; body();
      need(UI.$('#crBody').textContent.includes('taxa de aprovação'), 'não pago separado de aprovado');
      need(UI.$('#crBody').textContent.includes('nunca afirma causa'), 'sem causa inventada');
      /* experimento incompleto falha */
      let falhou = false;
      try { L.createExperiment(UI.state, { tipo: 'preço', alvo: 'p1' }); } catch (e) { falhou = /falta/.test(e.message); }
      need(falhou, 'experimento sem hipótese/métrica/parada é recusado');
      /* gates */
      need(!L.accelGate('ads', UI.state.products.find(p => p.id === 'p3')).allowed, 'Ads bloqueado com pendência');
      need(L.accelGate('ads', UI.state.products.find(p => p.id === 'p6')).allowed, 'Ads liberado com base validada');
      CR.sub = 'Performance'; body();
      document.body.dataset.groselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e) { document.body.dataset.groselfReady = 'fail: ' + e.message; }
  });
}());

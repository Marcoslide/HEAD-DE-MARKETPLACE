/* =============================================================
   v8 · PEDIDOS (10.E.2) — primeira área operacional de verdade
   Identidade: marketplace + conta + ID do pedido = pedido único.
   Reimportar atualiza status (o pedido MUDA de aba), preserva o
   histórico e nunca duplica. Todo número tem Fonte · Período ·
   Cobertura · Última importação · Qualidade. O upload nasce AQUI.
   Dados pessoais de comprador só aparecem com permissão real.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const PD = window.PEDIDOS = { tab: 'Todos' };
  const TABS = ['Todos', 'Não pagos', 'A enviar', 'Enviados', 'Concluídos', 'Cancelados',
    'Devoluções e Reembolsos', 'Falhas de Entrega', 'Cidades e Estados', 'Histórico de Atualizações'];
  const eng = () => IMPORTAR.eng;
  const papel = () => (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
  const podeVerComprador = () => V8IMP.canData(papel(), 'RAW_DATA_VIEW');
  const filtroCtx = () => ({ lojaId: UI.ctx.loja || undefined, contaId: UI.ctx.conta || undefined, marketplace: UI.ctx.marketplace || undefined });
  const lojaNome = id => (D.scope.lojas.find(s => s.id === id) || { nome: id }).nome;

  function render(tab) {
    if (tab && TABS.includes(tab)) PD.tab = tab;
    const st = V8IMP.orderStats(eng(), filtroCtx());
    const view = V8IMP.ordersView(eng(), filtroCtx());
    UI.$('#v-pedidos').innerHTML = `
      <div class="eyebrow">pedidos · operação por marketplace + conta + ID</div>
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px"><h1 class="h1">Pedidos</h1>
        <p class="sub" style="margin-top:6px">Reimportação <b>atualiza</b> o pedido existente e preserva o histórico de status — nunca duplica, nunca soma. ${UI.scopeLineHtml()}</p></div>
        <button class="btn primary" data-act="upload">Atualizar dados desta área</button>
      </div>
      ${fonteLine(st)}
      ${kpis(st)}
      <div class="tabs" style="margin-top:14px">${TABS.map(t => `<button class="tab ${t === PD.tab ? 'on' : ''}" data-act="tab" data-tab="${t}">${t}${contagem(t, st, view)}</button>`).join('')}</div>
      <div id="pedBody" style="margin-top:14px"></div>`;
    body(st, view);
    UI.$('#v-pedidos').onclick = onClick;
  }

  const contagem = (t, st, view) => {
    const n = t === 'Todos' ? st.kpis.pedidos : t === 'Não pagos' ? st.kpis.naoPagos : t === 'A enviar' ? st.kpis.aEnviar
      : t === 'Enviados' ? st.kpis.enviados : t === 'Concluídos' ? st.kpis.concluidos : t === 'Cancelados' ? st.kpis.cancelados
      : t === 'Devoluções e Reembolsos' ? st.kpis.devolucoes + view.eventosOrfaos.length : t === 'Falhas de Entrega' ? st.kpis.falhasEntrega : null;
    return n ? `<span class="cnt">${n}</span>` : '';
  };

  /* fonte de informação: obrigatória em toda análise */
  function fonteLine(st) {
    if (!st.fontes.length) return `<div class="callout" style="margin-top:12px;border-left-color:var(--warn)">
      <b>SEM DADOS — nenhum arquivo de pedidos importado.</b> Nenhum número será inventado. Clique em
      <b>Atualizar dados desta área</b> e selecione o export de pedidos da Shopee (Order.toship / Order.completed…).</div>`;
    const f = st.fontes[st.fontes.length - 1];
    return `<div class="ctxcard" style="margin-top:12px"><div class="h"><b>Fonte desta análise</b>
      <button class="linklike" data-act="gofontes">Fontes e Histórico →</button></div>
      <div class="ctxitem"><span>Arquivo</span><span class="src">${UI.esc(f.arquivo)} · ${f.linhas} linha(s)</span></div>
      <div class="ctxitem"><span>Período coberto</span><span class="src">${f.periodo ? f.periodo.ini + ' a ' + f.periodo.fim : 'não declarado no arquivo'}</span></div>
      <div class="ctxitem"><span>Escopo</span><span class="src">${UI.esc(lojaNome(f.escopo.lojaId))} · conta ${UI.esc(f.escopo.contaId)} · cobertura: ${st.cobertura.contas.length} conta(s)</span></div>
      <div class="ctxitem"><span>Última importação · qualidade</span><span class="src">${f.ultima} · ${f.qualidade.duplicadosEvitados} dup. evitada(s) · ${f.qualidade.linhasComErro} linha(s) com erro · ${f.qualidade.conflitos} conflito(s)</span></div>
    </div>`;
  }

  function kpis(st) {
    if (st.semDados) return '';
    const k = st.kpis;
    const cell = (lbl, v, cls) => `<div class="sl"><span class="k">${lbl}</span><span class="v ${cls || ''}">${v}</span></div>`;
    return `
      <div class="statusline" style="margin-top:12px;grid-template-columns:repeat(5,1fr)">
        ${cell('pedidos importados', k.pedidos)}${cell('faturamento aprovado', UI.brl(k.faturamentoAprovado))}
        ${cell('não pagos', `${k.naoPagos} · ${UI.brl(k.valorNaoPago)}`, k.naoPagos ? 'warn' : '')}
        ${cell('ticket médio', k.ticketMedio != null ? UI.brl(k.ticketMedio) : 'SEM BASE')}${cell('unidades', k.unidades)}
      </div>
      <div class="statusline" style="margin-top:8px;grid-template-columns:repeat(5,1fr)">
        ${cell('a enviar', k.aEnviar)}${cell('enviados', k.enviados)}${cell('concluídos', k.concluidos)}
        ${cell('cancelados', `${k.cancelados}${k.taxaCancelamento.taxa != null ? ' · ' + k.taxaCancelamento.taxa + '%' : ''}`, k.cancelados ? 'neg' : '')}
        ${cell('devoluções/reembolsos', k.devolucoes, k.devolucoes ? 'warn' : '')}
      </div>
      <div class="statusline" style="margin-top:8px;grid-template-columns:repeat(5,1fr)">
        ${cell('falhas de entrega', k.falhasEntrega, k.falhasEntrega ? 'neg' : '')}${cell('cidades atendidas', k.cidades)}
        ${cell('estados', k.estados)}
        ${cell('taxa de cancelamento', k.taxaCancelamento.taxa != null ? k.taxaCancelamento.taxa + '%' : 'SEM BASE')}
        ${cell('fontes ativas', st.fontes.length)}
      </div>
      <p class="src" style="margin-top:6px">taxa de cancelamento = ${UI.esc(k.taxaCancelamento.formula || '—')} — nenhum % aparece sem fórmula e denominador.</p>`;
  }

  function body(st, view) {
    const el = UI.$('#pedBody');
    if (PD.tab === 'Cidades e Estados') { el.innerHTML = geo(); return; }
    if (PD.tab === 'Histórico de Atualizações') { el.innerHTML = historicoTab(); return; }
    if (PD.tab === 'Devoluções e Reembolsos') { el.innerHTML = devolucoes(view); return; }
    const list = PD.tab === 'Todos' ? view.orders : view.orders.filter(o => o.tab === PD.tab);
    if (!list.length) {
      el.innerHTML = `<div class="panel"><div class="empty"><b>${st.semDados ? 'SEM DADOS — importe o export de pedidos' : 'Nenhum pedido nesta aba'}</b>
        ${st.semDados ? 'O upload nasce aqui dentro: <button class="linklike" data-act="upload">Atualizar dados desta área</button>' : 'Quando o status mudar numa reimportação, o pedido muda de aba sozinho — sem duplicar.'}</div></div>`;
      return;
    }
    const verComprador = podeVerComprador();
    el.innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Pedido</th><th class="nosort">Loja · conta</th><th class="nosort">Produto · SKU</th><th class="nosort">Qtd</th>
      <th class="nosort">Valor · frete</th><th class="nosort">Cidade/UF</th>${verComprador ? '<th class="nosort">Comprador</th>' : ''}
      <th class="nosort">Status atual</th><th class="nosort">Atualizado</th><th class="nosort"></th></tr></thead><tbody>
      ${list.map(o => `<tr>
        <td><button class="tmain linklike" style="font-size:12.5px" data-act="abrir" data-key="${UI.esc(o.key)}">${UI.esc(o.id)}</button><span class="tsub">${UI.esc(o.marketplace)} · ${UI.esc(o.origem)}</span></td>
        <td><span class="src">${UI.esc(lojaNome(o.lojaId))} · ${UI.esc(o.contaId)}</span></td>
        <td><span class="tmain" style="font-weight:500">${UI.esc(o.produto || '—')}</span><span class="tsub">${UI.esc(o.sku || 'SKU ausente')}${o.variacao ? ' · ' + UI.esc(o.variacao) : ''}</span></td>
        <td>${o.quantidade ?? '—'}</td>
        <td>${UI.brl(o.valorTotal)}<span class="tsub">frete ${UI.brl(o.frete)}</span></td>
        <td><span class="src">${UI.esc(o.cidade || '—')}/${UI.esc(o.estado || '—')} · ${UI.esc(o.cepParcial || 'CEP protegido')}</span></td>
        ${verComprador ? `<td><span class="src">${UI.esc(o.comprador || '—')}</span></td>` : ''}
        <td>${UI.stBadge(o.statusAtual)}${o.correcoes.length ? `<span class="tsub">✎ ${o.correcoes.length} correção(ões) manual(is)</span>` : ''}</td>
        <td><span class="src">${o.ultimaAtualizacao}</span></td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="abrir" data-key="${UI.esc(o.key)}">abrir</button></span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>${list.length} pedido(s) · chave: marketplace + conta + ID do pedido · ${verComprador ? 'comprador visível (RAW_DATA_VIEW)' : 'dados de comprador ocultos — seu papel não tem RAW_DATA_VIEW'}</span></div></div>`;
  }

  function devolucoes(view) {
    const comEvento = view.orders.filter(o => o.eventos.length);
    if (!comEvento.length && !view.eventosOrfaos.length)
      return `<div class="panel"><div class="empty"><b>Nenhum evento de devolução/reembolso importado</b>
        Importe o ZIP Order.return_refund_cancel — ele é extraído no staging e cruzado por ID do pedido. <button class="linklike" data-act="upload">Atualizar dados desta área</button></div></div>`;
    return `
      <div class="callout" style="margin-top:0"><b>Evento nunca vira pedido novo.</b> Devolução, reembolso e cancelamento são cruzados pelo ID do pedido existente (chave: marketplace + conta + ID + tipo + ID do evento).</div>
      ${comEvento.map(o => `<div class="ctxcard" style="margin-top:10px"><div class="h"><b>${UI.esc(o.id)} · ${UI.esc(o.produto || '')}</b>${UI.stBadge(o.statusAtual)}</div>
        ${o.eventos.map(e => `<div class="ctxitem"><span><span class="st warn plain">${UI.esc(e.tipo)}</span> ${UI.esc(e.eventId || '')} · ${UI.esc(e.motivo || 'motivo não informado pelo canal')}</span>
          <span class="src">${UI.brl(e.valor)} · ${UI.esc(e.situacao || '—')} · ${UI.esc(e.em)}</span></div>`).join('')}
        <div style="margin-top:6px"><button class="linklike" data-act="abrir" data-key="${UI.esc(o.key)}">abrir pedido →</button></div></div>`).join('')}
      ${view.eventosOrfaos.length ? `<div class="err-state" style="margin-top:10px"><b>${view.eventosOrfaos.length} evento(s) sem pedido correspondente</b> —
        ${view.eventosOrfaos.map(e => `${UI.esc(e.tipo)} ${UI.esc(e.eventId || '')} cita o pedido ${UI.esc(e.orderId)} (${UI.esc(e.arquivo)})`).join(' · ')}.
        ${UI.esc(view.eventosOrfaos[0].nota)}.</div>` : ''}`;
  }

  function geo() {
    const porUf = V8IMP.geoStats(eng(), filtroCtx(), 'estado');
    const porCidade = V8IMP.geoStats(eng(), filtroCtx(), 'cidade');
    if (!porUf.length) return `<div class="panel"><div class="empty"><b>SEM DADOS geográficos</b>Importe pedidos para ver estados e cidades — nada é estimado.</div></div>`;
    const tabela = (rows, titulo) => `
      <div class="panel" style="margin-top:12px"><div class="sect-h" style="margin-top:0"><span class="h2">${titulo}</span>
        <span class="src">sem dados pessoais — CEP protegido, comprador só com permissão</span></div>
      <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Local</th><th class="nosort">Pedidos</th><th class="nosort">Faturamento</th><th class="nosort">Ticket</th>
        <th class="nosort">Produto top</th><th class="nosort">Cancelamento</th><th class="nosort">Devolução</th><th class="nosort">Prazo médio</th></tr></thead><tbody>
      ${rows.map(g => `<tr>
        <td class="tmain">${UI.esc(g.chave)}</td><td>${g.pedidos}</td><td>${UI.brl(g.faturamento)}</td>
        <td>${g.ticket != null ? UI.brl(g.ticket) : '—'}</td>
        <td><span class="src">${UI.esc(g.produtoTop || '—')}</span></td>
        <td>${g.taxaCancelamento.taxa != null ? g.taxaCancelamento.taxa + '%' : '0%'}</td>
        <td>${g.taxaDevolucao.taxa != null ? g.taxaDevolucao.taxa + '%' : '0%'}</td>
        <td>${g.prazoMedioDias != null ? g.prazoMedioDias + ' dia(s)' : `<span class="src">SEM DADOS</span>`}<span class="tsub">${UI.esc(g.prazoNota)}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;
    return tabela(porUf, 'Por estado') + tabela(porCidade.slice(0, 12), 'Por cidade (top 12)');
  }

  function historicoTab() {
    const rows = V8IMP.areaSources(eng(), ['pedidos', 'devolucoes']);
    if (!rows.length) return `<div class="panel"><div class="empty"><b>Nenhuma atualização registrada</b>Cada importação de pedidos aparece aqui com arquivo, escopo, contagens e rollback.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Arquivo</th><th class="nosort">Área</th><th class="nosort">Período</th><th class="nosort">Status</th>
      <th class="nosort">Linhas</th><th class="nosort">Dup. evitadas</th><th class="nosort">Erros</th><th class="nosort">Quando · quem</th><th class="nosort"></th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr>
        <td><span class="tmain">${UI.esc(r.arquivo)}</span><span class="tsub">${r.batchId}</span></td>
        <td><span class="kbd">${UI.esc(r.areaDestino)}</span></td>
        <td><span class="src">${r.periodo ? r.periodo.ini + '→' + r.periodo.fim : '—'}</span></td>
        <td>${UI.stBadge(r.status)}</td><td>${r.linhas}</td><td>${r.duplicidadesEvitadas}</td>
        <td>${r.linhasComErro ? `<button class="linklike" data-act="vererros" data-id="${r.batchId}">${r.linhasComErro}</button>` : '0'}</td>
        <td><span class="src">${r.ultimaAtualizacao} · ${UI.esc(r.usuario)}</span></td>
        <td><span class="rowact"><button class="btn sm ghost" data-act="verbrutos" data-id="${r.batchId}">brutos</button></span></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>reimportar o mesmo arquivo é bloqueado por fingerprint; status novo atualiza o pedido existente</span></div></div>`;
  }

  /* drawer do pedido: identidade, histórico de status, eventos, correções auditadas */
  function abrir(key) {
    const o = V8IMP.ordersView(eng(), { incluirExcluidos: true }).todos.find(x => x.key === key);
    if (!o) return;
    const hist = V8IMP.historicoDe(eng(), key);
    UI.openDrawer(`
      <div class="drawer-h"><div>
        <div class="eyebrow">pedido ${UI.esc(o.id)} · ${UI.esc(o.marketplace)} · conta ${UI.esc(o.contaId)} · ${UI.esc(o.origem)}</div>
        <h2 class="h1" style="font-size:18px">${UI.esc(o.produto || 'Pedido ' + o.id)}</h2></div>
        <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
      ${o.excluido ? `<div class="err-state" style="margin-top:8px"><b>EXCLUÍDO DA ANÁLISE</b> — ${UI.esc(o.excluido.motivo)} (${UI.esc(o.excluido.por)}, ${o.excluido.em}). ${UI.esc(o.excluido.impacto)}.</div>` : ''}
      <dl class="kv">
        <dt>Identidade única</dt><dd><span class="kbd">${UI.esc(o.marketplace)} + ${UI.esc(o.contaId)} + ${UI.esc(o.id)}</span></dd>
        <dt>SKU · variação · qtd</dt><dd>${UI.esc(o.sku || '—')} · ${UI.esc(o.variacao || '—')} · ${o.quantidade ?? '—'}</dd>
        <dt>Valores</dt><dd>${UI.brl(o.valorTotal)} · frete ${UI.brl(o.frete)}${o.comissao != null ? ' · comissão ' + UI.brl(o.comissao) : ''}</dd>
        <dt>Local</dt><dd>${UI.esc(o.cidade || '—')}/${UI.esc(o.estado || '—')} · CEP ${UI.esc(o.cepParcial || 'protegido')}</dd>
        <dt>Comprador</dt><dd>${podeVerComprador() ? UI.esc(o.comprador || '—') : '<span class="st plain">OCULTO — exige RAW_DATA_VIEW</span>'}</dd>
        <dt>Datas</dt><dd>criação ${o.datas.criacao || '—'} · pagto ${o.datas.pagamento || '—'} · envio ${o.datas.envio || '—'} · entrega ${o.datas.entrega || '—'}</dd>
        <dt>Fonte</dt><dd>${UI.esc(o.arquivo)} · atualizado em ${o.ultimaAtualizacao}</dd>
      </dl>
      <div class="sect-h"><span class="h2">Histórico de status (preservado a cada reimportação)</span></div>
      ${o.statusHistory.map((h, i) => `<div class="exec-li"><span class="sig ${i === o.statusHistory.length - 1 ? 'pos' : ''}"></span>
        <div class="t"><b>${UI.esc(h.status)}</b><span>${h.em} · lote ${h.batchId}${i === o.statusHistory.length - 1 ? ' · atual' : ''}</span></div></div>`).join('')}
      ${o.eventos.length ? `<div class="sect-h"><span class="h2">Devoluções / reembolsos / cancelamentos</span></div>
        ${o.eventos.map(e => `<div class="exec-li"><span class="sig warn"></span><div class="t"><b>${UI.esc(e.tipo)} ${UI.esc(e.eventId || '')}</b><span>${UI.esc(e.motivo || '—')} · ${UI.brl(e.valor)} · ${UI.esc(e.situacao || '—')}</span></div></div>`).join('')}` : ''}
      ${(hist.correcoes || []).length ? `<div class="sect-h"><span class="h2">Correções manuais (original preservado)</span></div>
        ${hist.correcoes.map(c => `<div class="exec-li"><span class="sig info"></span><div class="t"><b>${UI.esc(c.campo)}: "${UI.esc(c.antes)}" → "${UI.esc(c.depois)}"</b><span>${UI.esc(c.motivo)} · ${UI.esc(c.autor)} · ${c.em} · ${c.origem}</span></div></div>`).join('')}` : ''}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn sm" data-act="d-corrigir" data-key="${UI.esc(o.key)}">Corrigir campo (com motivo)</button>
        ${o.excluido
          ? `<button class="btn sm" data-act="d-restaurar" data-key="${UI.esc(o.key)}">Restaurar na análise</button>`
          : `<button class="btn sm ghost" data-act="d-excluir" data-key="${UI.esc(o.key)}">Excluir da análise (mantém bruto)</button>`}
        <button class="btn sm ghost" data-act="d-historico" data-key="${UI.esc(o.key)}">Ver histórico completo</button>
      </div>`);
    UI.$('#drawer').onclick = onDrawer;
  }

  function modalCorrigir(key) {
    UI.openModal(`<h3 class="h2">Correção manual</h3>
      <p class="sub" style="margin-top:4px">O valor original é preservado; a correção vira camada <span class="kbd">MANUAL_CORRECTION</span> com autor, data, antes/depois e motivo obrigatório.</p>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Campo</span><br>
        <select class="select" id="cxCampo" style="width:100%;margin-top:3px">${['Cidade', 'UF', 'Quantidade', 'Valor Total', 'Status do pedido'].map(c => `<option>${c}</option>`).join('')}</select></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Novo valor</span><br><input class="input" id="cxValor" style="width:100%;margin-top:3px"></label>
      <label style="display:block;margin-top:8px"><span class="eyebrow">Motivo (obrigatório)</span><br><input class="input" id="cxMotivo" style="width:100%;margin-top:3px" placeholder="ex.: CEP confere com cidade vizinha"></label>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
        <button class="btn primary" id="cxOk">Registrar correção</button></div>`);
    UI.$('#cxOk').onclick = () => {
      const r = V8IMP.correct(eng(), key, UI.$('#cxCampo').value, UI.$('#cxValor').value.trim(),
        { motivo: UI.$('#cxMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeModal(); UI.toast('Correção registrada — original preservado, trilha auditada.', 'ok'); abrir(key); render();
    };
  }

  function onDrawer(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, key = b.dataset.key;
    if (act === 'd-corrigir') modalCorrigir(key);
    else if (act === 'd-excluir') {
      UI.openModal(`<h3 class="h2">Excluir da análise</h3>
        <p class="sub" style="margin-top:4px">O pedido sai dos KPIs mas <b>permanece na camada bruta e no histórico</b> — restauração disponível. Motivo obrigatório.</p>
        <input class="input" id="exMotivo" style="width:100%;margin-top:10px" placeholder="ex.: pedido de teste interno">
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
          <button class="btn ghost" onclick="UI.closeModal()">cancelar</button>
          <button class="btn danger" id="exOk">Excluir da análise</button></div>`);
      UI.$('#exOk').onclick = () => {
        const r = V8IMP.excludeFromAnalysis(eng(), key, { motivo: UI.$('#exMotivo').value.trim(), usuario: D.meta.usuario, papel: papel() });
        if (r.blocked) return UI.toast(r.reason, 'err');
        UI.closeModal(); UI.closeDrawer(); UI.toast('Excluído da análise — bruto preservado, reversível.', 'ok'); render();
      };
    }
    else if (act === 'd-restaurar') {
      const r = V8IMP.restaurar(eng(), key, { usuario: D.meta.usuario, papel: papel() });
      if (r.blocked) return UI.toast(r.reason, 'err');
      UI.closeDrawer(); UI.toast('Pedido restaurado na análise.', 'ok'); render();
    }
    else if (act === 'd-historico') {
      const h = V8IMP.historicoDe(eng(), key);
      UI.openModal(`<h3 class="h2">Histórico completo</h3>
        <p class="sub" style="margin-top:4px">${h.versoes.length} versão(ões) anterior(es) · ${h.correcoes.length} correção(ões) · ${h.restauracoes.length} restauração(ões).</p>
        ${h.versoes.map(v => `<div class="exec-li"><span class="sig"></span><div class="t"><b>versão de ${v.em} (lote ${v.batchId})</b><span>${UI.esc(JSON.stringify(v.raw).slice(0, 160))}…</span></div></div>`).join('') || '<p class="src">sem versões anteriores — pedido nunca foi atualizado por reimportação.</p>'}
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn" onclick="UI.closeModal()">fechar</button></div>`);
    }
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'tab') { PD.tab = b.dataset.tab; UI.$('#crumb').textContent = 'Pedidos · ' + PD.tab; render(PD.tab); }
    else if (act === 'upload') IMPORTAR.uploadModal({
      titulo: 'Atualizar dados de Pedidos', dica: 'Exports aceitos: Order.toship / Order.completed / Order.all (XLSX) e Order.return_refund_cancel (ZIP).',
      onDone: () => render(),
    });
    else if (act === 'abrir') abrir(b.dataset.key);
    else if (act === 'gofontes') UI.go('importar');
    else if (act === 'verbrutos') IMPORTAR.verBrutos(b.dataset.id);
    else if (act === 'vererros') IMPORTAR.verErros(b.dataset.id);
  }

  PD.focus = alvo => { if (TABS.includes(alvo)) { PD.tab = alvo; } render(PD.tab); };
  UI.renderers.pedidos = render;

  /* ---------- auto-teste (?pedself=1) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).get('pedself') !== '1') return;
    try {
      const errs = []; const need = (ok, m) => { if (!ok) errs.push(m); };
      UI.go('pedidos');
      need(UI.$('#v-pedidos').textContent.includes('SEM DADOS'), 'estado vazio honesto');
      need(UI.$('#v-pedidos').textContent.includes('Atualizar dados desta área'), 'upload nasce dentro da área');
      /* importa v1 via motor (mesmo caminho do upload) */
      const esc = { groupId: 'g1', companyId: 'e1', cnpjId: 'c1', lojaId: 's1', contaId: 'acc-sh-1', marketplace: 'shopee' };
      const b1 = V8IMP.stage(IMPORTAR.eng, V8IMP.FIXTURES.orders({ ini: '2026-06-01', fim: '2026-06-30' }), esc, { usuario: 'Marcos' });
      V8IMP.apply(IMPORTAR.eng, b1.id, {});
      render();
      need(UI.$('#v-pedidos').textContent.includes('Fonte desta análise'), 'fonte visível no dashboard');
      need(UI.$$('#pedBody tbody tr').length === 6, 'seis pedidos na tela');
      /* reimportação muda status sem duplicar */
      const b2 = V8IMP.stage(IMPORTAR.eng, V8IMP.FIXTURES.ordersV2({ ini: '2026-06-01', fim: '2026-07-05' }), esc, { usuario: 'Marcos' });
      V8IMP.apply(IMPORTAR.eng, b2.id, {});
      render('Concluídos');
      need(UI.$('#pedBody').textContent.includes('2606003'), 'pedido mudou de aba (Em rota → Entregue)');
      render('Todos');
      need(UI.$$('#pedBody tbody tr').length === 7, 'reimportar não duplica (7 únicos)');
      /* devoluções via ZIP cruzam por ID */
      const z = V8IMP.stage(IMPORTAR.eng, V8IMP.FIXTURES.returnZip({ ini: '2026-06-01', fim: '2026-07-05' }), esc, { usuario: 'Marcos' });
      z.batches.forEach(bt => V8IMP.apply(IMPORTAR.eng, bt.id, {}));
      render('Devoluções e Reembolsos');
      need(UI.$('#pedBody').textContent.includes('sem pedido correspondente'), 'órfão declarado, nunca vira pedido');
      render('Cidades e Estados');
      need(UI.$('#pedBody').textContent.includes('Por estado'), 'análise geográfica presente');
      need(!UI.$('#pedBody').textContent.includes('31270901'), 'CEP completo nunca aparece');
      render('Histórico de Atualizações');
      need(UI.$$('#pedBody tbody tr').length >= 3, 'histórico de atualizações lista os lotes');
      render('Todos');
      document.body.dataset.pedselfReady = errs.length ? 'fail: ' + errs.join(' | ') : 'ok';
    } catch (e2) { document.body.dataset.pedselfReady = 'fail: ' + e2.message; }
  });
}());

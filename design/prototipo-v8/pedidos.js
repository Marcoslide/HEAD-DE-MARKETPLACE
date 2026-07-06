/* =============================================================
   v8 · PEDIDOS (10.F.2 · Incremento 2) — tela operacional oficial
   Consome EXCLUSIVAMENTE a API/Postgres quando há backend
   (V8API.orders*): pedido, status, conciliação, valor recebido e lucro
   NUNCA vêm de mock quando o backend responde. Sem backend (Artifact
   estático), mostra um PREVIEW rotulado construído pelos MESMOS motores
   (V8PED + V8CONC), com a mesma forma da API — nunca fingindo backend.

   Identidade do pedido: marketplace + conta + ID do pedido.
   Item ID / Variation ID = AUSENTE_NA_FONTE quando a fonte não traz;
   o vínculo real deste relatório é o SKU (origem SELLER_SKU). Nome de
   produto nunca preenche identificador externo. Carteira = verdade;
   pedido + regra = expectativa. Lucro sem custo confiável = SEM_DADOS.
   ============================================================= */
(function () {
  'use strict';
  const D = V8DATA;
  const PD = window.PEDIDOS = { tab: 'Todos', busca: '', _cache: null, _online: false };
  const TABS = ['Todos', 'Pagos', 'Em Produção', 'Em Embalagem', 'Prontos', 'Enviados',
    'Entregues', 'Atrasados', 'Cancelados', 'Devolvidos', 'Não Pagos', 'Em Revisão'];
  const NOW = '2026-07-05';
  const brl = v => v == null ? '—' : UI.brl(v);
  const papel = () => (UI.account && UI.account.user.papel) || D.meta.papel || 'ADMIN';
  const podeVerComprador = () => window.V8IMP && V8IMP.canData(papel(), 'RAW_DATA_VIEW');
  const REGRAS = [{ marketplace: 'shopee', marketplace_account_id: 'acc-shopee', rule_name: 'Shopee · estoque próprio', shipping_mode: 'proprio', expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1, status: 'Ativo' }];
  const TAXAS = { comissaoPct: 14, impostoPct: 7, taxaFixa: 4 };
  const CUSTOS = {}; /* custo interno por SKU — vazio de propósito: lucro fica SEM_DADOS_SUFICIENTES */

  /* ------------------------------------------------------------------
     FONTE OFICIAL: API/Postgres. Sem backend → PREVIEW rotulado (mesmos motores).
  ------------------------------------------------------------------ */
  const online = () => window.V8API && V8API.online && V8API.online();
  const ctxApi = () => ({ company_id: UI.ctx.empresa, marketplace: UI.ctx.marketplace || undefined, account_id: UI.ctx.conta || undefined });

  /* ---- PREVIEW rotulado: planilha de pedidos + carteira, cruzadas pelos motores ---- */
  function demoSheet() {
    const H = V8PED.SHOPEE_ORDERS_HEADER, r = o => H.map(h => o[h] != null ? o[h] : '');
    const ped = (id, status, data, nome, sku, qtd, valor, cid, uf) => r({ 'ID do pedido': id, 'Status do pedido': status, 'Data de criação do pedido': data, 'Nome do Produto': nome, 'Número de referência SKU': sku, 'Quantidade': qtd, 'Valor Total': valor, 'Cidade': cid, 'UF': uf });
    return [
      ['Relatório de Pedidos'], ['Conta', 'lidermolduras'], ['Detalhes da transação'],
      H.slice(),
      ped('2606PAGO1', 'Pagos', '2026-06-19', 'Quadro Paisagem 60x90', 'QP-6090', '1', '176.63', 'BH', 'MG'),
      ped('2606MULT1', 'Enviados', '2026-06-21', 'Kit 3 Quadros Sala', 'KIT3-SALA', '1', '360.00', 'SP', 'SP'),
      ped('2606MULT1', 'Enviados', '2026-06-21', 'Porta-Retrato 3D', '', '2', '360.00', 'SP', 'SP'),
      ped('2606ENV01', 'Enviados', '2026-07-02', 'Garrafa Térmica 1L', 'GAR-1L', '1', '140.00', 'RJ', 'RJ'),
      ped('2606ATR01', 'Atrasados', '2026-06-01', 'Tênis Runner 37', 'TEN-R37', '1', '300.00', 'POA', 'RS'),
      ped('2606DEV01', 'Devolvidos', '2026-06-15', 'Espelho Decorativo', 'ESP-ORG', '1', '289.90', 'CWB', 'PR'),
      ped('2606PROD1', 'Em Produção', '2026-07-03', 'Cafeteira Italiana', 'CAF-6X', '1', '109.90', 'BSB', 'DF'),
      ped('2606EMB01', 'Em Embalagem', '2026-07-03', 'Luminária LED', 'LUM-LED', '1', '139.90', 'SSA', 'BA'),
      ped('2606PRON1', 'Prontos', '2026-07-04', 'Organizador MDF', 'ORG-MDF', '1', '89.90', 'FOR', 'CE'),
      ped('2606ENT01', 'Entregues', '2026-06-10', 'Quadro Abstrato', 'QAD-ABS', '1', '119.90', 'REC', 'PE'),
      ped('2606CAN01', 'Cancelados', '2026-06-22', 'Quadro Personalizado', 'QPN-FAM', '1', '159.90', 'MAO', 'AM'),
      ped('2606NPG01', 'Não Pagos', '2026-07-04', 'Kit 3 Quadros Sala', 'KIT3-SALA', '1', '250.00', 'GYN', 'GO'),
    ];
  }
  function demoWallet() {
    const H = V8CONC.SHOPEE_TX_HEADER, r = o => H.map(h => o[h] != null ? o[h] : '');
    const w = (data, tipo, desc, ped, dir, val, saldo) => r({ 'Data': data, 'Tipo de transação': tipo, 'Descrição': desc, 'ID do pedido': ped, 'Direção do dinheiro': dir, 'Valor': val, 'Status': 'Transação completa', 'Balança após as transações': saldo, 'Valor a Ser Ajustado': '0.00' });
    return [
      w('2026-06-25 10:00:00', 'Renda do pedido', 'Renda do pedido 2606PAGO1', '2606PAGO1', 'Entrada', '137.94', '137.94'),
      w('2026-06-28 10:00:00', 'Shopee Acelera', 'Ajuste do Shopee Acelera ID do pedido 2606PAGO1', '2606PAGO1', 'Saída', '-2.40', '135.54'),
      w('2026-06-18 10:00:00', 'Renda do pedido', 'Renda do pedido 2606ENT01', '2606ENT01', 'Entrada', '96.00', '270.23'),
      w('2026-06-27 10:00:00', 'Ajuste', 'Débito referente ao pedido 2606DEV01 devido à solicitação de reembolso', '-', 'Saída', '-232.00', '38.23'),
      w('2026-06-26 10:00:00', 'Renda do pedido', 'Renda do pedido 2606DEV01', '2606DEV01', 'Entrada', '232.00', '270.23'),
      w('2026-07-01 08:00:00', 'Ajuste', 'Reembolso por objeto perdido', '-', 'Entrada', '48.90', '319.13'),
    ];
  }
  /* enriquece cada pedido com identidade financeira + conciliação (mesma lógica do backend) */
  function buildPreview() {
    const parsed = V8PED.parseOrders(demoSheet(), { marketplace: 'shopee', contaId: 'acc-shopee', empresaId: 'e1', arquivo: 'pedidos-demo.xlsx' });
    const txns = V8CONC.normalizeShopeeWallet(demoWallet(), { marketplace: 'shopee', contaId: 'acc-shopee', empresaId: 'e1', arquivo: 'carteira-demo.xlsx' });
    const ordersExp = parsed.orders.map(o => ({ external_order_id: o.external_order_id, marketplace: 'shopee', marketplace_account_id: 'acc-shopee',
      gross_order_value: o.gross_products_value, expected_net_value: V8PED.expectativaFinanceira(o, TAXAS).expected_net_value, paid_at: o.paid_at || o.order_created_at, delivered_at: o.delivered_at || o.order_created_at }));
    const rec = V8CONC.reconcile({ transactions: txns, orders: ordersExp, rules: REGRAS, now: NOW, toleranciaCentavos: 0.05 });
    const casoDe = ext => rec.cases.find(c => c.external_order_id === ext);
    return parsed.orders.map(o => {
      const caso = casoDe(o.external_order_id) || {};
      const exp = V8PED.expectativaFinanceira(o, TAXAS);
      return Object.assign({}, o, {
        expected_net_value: exp.expected_net_value, expectativa: exp,
        received_net_value: caso.received_net_value != null ? caso.received_net_value : 0,
        difference_value: caso.difference_value, reconciliation_status: caso.reconciliation_status || 'SEM_CASO',
        payment_status: /não pago/i.test(o.order_status) ? 'NÃO PAGO' : 'PAGO',
        movimentos: caso.movimentos || [], expected_release_at: caso.expected_release_at, dias_restantes: caso.dias_restantes, dias_atraso: caso.dias_atraso,
        regra_usada: caso.regra_usada,
      });
    });
  }

  /* ------------------------------------------------------------------ render ---- */
  function render(tab) {
    if (tab && TABS.includes(tab)) PD.tab = tab;
    const el = UI.$('#v-pedidos'); if (!el) return;
    if (online()) { renderOnline(el); return; }
    PD._online = false;
    PD._cache = buildPreview();
    paint(el, PD._cache, 'PREVIEW · a base oficial é a API/Postgres (sem backend nesta instância)');
  }
  function renderOnline(el) {
    el.innerHTML = `<div class="panel"><div class="empty">Carregando pedidos da API…</div></div>`;
    V8API.ordersList(ctxApi(), {}).then(res => {
      PD._online = true; PD._cache = (res && res.orders) || [];
      paint(el, PD._cache, 'DADO REAL · API/Postgres');
    }).catch(() => { PD._online = false; PD._cache = buildPreview(); paint(el, PD._cache, 'API indisponível — PREVIEW rotulado'); });
  }

  const opStatus = o => o.order_status || '—';
  const tabDe = o => {
    const s = (o.order_status || '').toLowerCase();
    if (o.needs_review || (o.items || []).some(i => i.needs_review)) return ['Todos', 'Em Revisão'];
    const map = { 'pagos': 'Pagos', 'pago': 'Pagos', 'em produção': 'Em Produção', 'em embalagem': 'Em Embalagem', 'prontos': 'Prontos', 'pronto': 'Prontos', 'enviados': 'Enviados', 'enviado': 'Enviados', 'entregues': 'Entregues', 'entregue': 'Entregues', 'atrasados': 'Atrasados', 'cancelados': 'Cancelados', 'cancelado': 'Cancelados', 'devolvidos': 'Devolvidos', 'devolvido': 'Devolvidos', 'não pagos': 'Não Pagos', 'não pago': 'Não Pagos' };
    return ['Todos', map[s] || null].filter(Boolean);
  };
  const stConc = s => {
    const m = { CONCILIADO: 'ok', COM_AJUSTE_POSTERIOR: 'ok', AGUARDANDO_LIBERACAO: 'plain', RECEBIMENTO_PARCIAL: 'warn', DIVERGENTE: 'danger', SEM_MOVIMENTO_ENCONTRADO: 'danger', ATRASADO: 'danger', REEMBOLSADO: 'warn', RECEBIDO_SEM_CONFERENCIA: 'plain', SEM_CASO: 'plain' };
    return `<span class="st ${m[s] || 'plain'} plain">${UI.esc(s || '—')}</span>`;
  };

  function paint(el, orders, fonteLabel) {
    const filtered = orders.filter(o => (PD.tab === 'Todos' || tabDe(o).includes(PD.tab)) &&
      (!PD.busca || (o.external_order_id + ' ' + (o.items || []).map(i => i.seller_sku).join(' ')).toLowerCase().includes(PD.busca.toLowerCase())));
    const cont = t => orders.filter(o => tabDe(o).includes(t)).length;
    el.innerHTML = `
      <div class="sect-h"><div><div class="eyebrow">PEDIDOS · marketplace + conta + ID do pedido</div>
        <h1 class="h1">Pedidos</h1>
        <p class="sub">O que foi vendido e o que precisa operar. Cada pedido cruza com a carteira em Conciliação — carteira é a verdade; pedido + regra é a expectativa.</p></div>
        <div style="display:flex;gap:8px;flex:none;align-items:center">
          <input class="input" placeholder="buscar por pedido ou SKU…" value="${UI.esc(PD.busca)}" data-act="busca" style="width:220px">
          <button class="btn primary" data-act="upload">Atualizar dados desta área</button></div></div>
      <p class="src">fonte: ${UI.esc(fonteLabel)} · período até ${NOW} · America/Sao_Paulo · ${orders.length} pedido(s)</p>
      ${coverageNote()}
      <div class="tabs" style="margin-top:12px;flex-wrap:wrap">${TABS.map(t => `<button class="tab ${t === PD.tab ? 'on' : ''}" data-act="tab" data-tab="${t}">${t}${t !== 'Todos' && cont(t) ? `<span class="cnt">${cont(t)}</span>` : ''}</button>`).join('')}</div>
      <div id="pedBody" style="margin-top:14px">${filtered.length ? tabela(filtered) : `<div class="panel"><div class="empty"><b>${orders.length ? 'Nenhum pedido nesta aba.' : 'SEM DADOS — importe o export de Pedidos.'}</b> O upload nasce aqui: <button class="linklike" data-act="upload">Atualizar dados desta área</button></div></div>`}</div>`;
    el.onclick = onClick;
    const inp = el.querySelector('[data-act="busca"]'); if (inp) inp.oninput = e => { PD.busca = e.target.value; const b = UI.$('#pedBody'); const f = orders.filter(o => (PD.tab === 'Todos' || tabDe(o).includes(PD.tab)) && (!PD.busca || (o.external_order_id + ' ' + (o.items || []).map(i => i.seller_sku).join(' ')).toLowerCase().includes(PD.busca.toLowerCase()))); b.innerHTML = f.length ? tabela(f) : '<div class="panel"><div class="empty">Nada encontrado.</div></div>'; };
  }

  /* cobertura da FONTE importada que alimenta esta área (quando há import real):
     período coberto + campos usados/preservados, lidos do catálogo de campos real. */
  function coverageNote() {
    if (!window.V8IMP || !window.IMPORTAR) return '';
    let st; try { st = V8IMP.orderStats(IMPORTAR.eng, {}); } catch (e) { return ''; }
    if (!st || !st.fontes || !st.fontes.length) return '';
    const f = st.fontes[st.fontes.length - 1];
    const cat = V8IMP.fieldCatalog(IMPORTAR.eng) || [];
    const usados = cat.filter(c => c.status === 'utilizado' && (c.areas || []).includes('Pedidos'));
    return `<div class="ctxcard" style="margin-top:10px"><div class="h"><b>Fonte importada desta área</b><span class="src">cobertura e campos</span></div>
      <div class="ctxitem"><span>Período coberto</span><span class="src">${f.periodo ? f.periodo.ini + ' a ' + f.periodo.fim : 'não declarado no arquivo'}</span></div>
      <div class="ctxitem"><span>Campos usados (${usados.length})</span><span class="src">${UI.esc(usados.slice(0, 8).map(c => c.coluna).join(', ')) || '—'}</span></div></div>`;
  }

  function produtoPrincipal(o) { const it = (o.items || [])[0] || {}; return it.product_name_original || '—'; }
  function skuPrincipal(o) { const it = (o.items || []).find(i => i.seller_sku) || {}; return it.seller_sku || 'sem SKU'; }

  function tabela(list) {
    return `<div class="tblwrap"><table class="tbl"><thead><tr>
      <th class="nosort">Pedido</th><th class="nosort">Conta</th><th class="nosort">Data</th><th class="nosort">Produto · SKU</th><th class="nosort">Itens</th>
      <th class="nosort">Bruto</th><th class="nosort">Status op.</th><th class="nosort">Pagto</th><th class="nosort">Conciliação</th>
      <th class="nosort">Esperado</th><th class="nosort">Recebido</th><th class="nosort">Dif.</th><th class="nosort"></th></tr></thead><tbody>
      ${list.map(o => `<tr>
        <td><button class="tmain linklike" data-act="abrir" data-id="${UI.esc(o.external_order_id)}">${UI.esc(o.external_order_id)}</button><span class="tsub">${UI.esc(o.marketplace || 'shopee')}</span></td>
        <td><span class="src">${UI.esc(o.marketplace_account_id || 'acc-shopee')}</span></td>
        <td><span class="src">${UI.esc((o.order_created_at || '').slice(0, 10) || '—')}</span></td>
        <td><span class="tmain" style="font-weight:500">${UI.esc(produtoPrincipal(o).slice(0, 22))}</span><span class="tsub">${UI.esc(skuPrincipal(o))}</span></td>
        <td>${o.qtd_itens != null ? o.qtd_itens : (o.items || []).length}</td>
        <td>${brl(o.gross_products_value)}</td>
        <td>${UI.stBadge ? UI.stBadge(opStatus(o)) : UI.esc(opStatus(o))}</td>
        <td>${o.payment_status === 'NÃO PAGO' ? '<span class="st danger plain">NÃO PAGO</span>' : '<span class="st ok plain">PAGO</span>'}</td>
        <td>${stConc(o.reconciliation_status)}</td>
        <td>${brl(o.expected_net_value)}</td><td>${brl(o.received_net_value)}</td>
        <td>${o.difference_value == null ? '—' : `<span class="num ${o.difference_value < 0 ? 'crit' : ''}">${brl(o.difference_value)}</span>`}</td>
        <td><button class="btn sm ghost" data-act="abrir" data-id="${UI.esc(o.external_order_id)}">abrir</button></td></tr>`).join('')}
      </tbody></table><div class="tfoot"><span>${list.length} pedido(s) · chave: marketplace + conta + ID do pedido</span></div></div>`;
  }

  /* -------------------------------------------------- detalhe do pedido (8 abas) -- */
  const DTABS = ['Resumo', 'Itens e SKUs', 'Operação e Logística', 'Identidade Financeira', 'Conciliação', 'Devoluções e Reembolsos', 'Histórico', 'Inteligência Relacionada'];
  function abrir(id) {
    const local = (PD._cache || []).find(o => o.external_order_id === id);
    if (online()) {
      V8API.order(id).then(o => desenhaDrawer(mapApi(o))).catch(() => local && desenhaDrawer(local));
    } else { desenhaDrawer(local); }
  }
  function mapApi(o) { /* resposta da API já vem no formato do serviço */
    return Object.assign({}, o, { items: o.items || [], movimentos: (o.financial && o.financial.movimentos) || [] });
  }
  function desenhaDrawer(o) {
    if (!o) return;
    PD._detTab = PD._detTab && DTABS.includes(PD._detTab) ? PD._detTab : 'Resumo';
    UI.openDrawer(`<div class="drawer-h"><div><div class="eyebrow">pedido ${UI.esc(o.marketplace || 'shopee')} · conta ${UI.esc(o.marketplace_account_id || 'acc-shopee')}</div>
      <h2 class="h1" style="font-size:18px">Pedido ${UI.esc(o.external_order_id)}</h2></div>
      <button class="btn ghost sm" onclick="UI.closeDrawer()">✕ fechar</button></div>
      <div class="tabs" style="flex-wrap:wrap">${DTABS.map(t => `<button class="tab sm ${t === PD._detTab ? 'on' : ''}" data-act="dtab" data-dtab="${t}">${t}</button>`).join('')}</div>
      <div id="pedDet" style="margin-top:12px">${detCorpo(o)}</div>`);
    const dr = UI.$('#drawer'); if (dr) dr.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'dtab') { PD._detTab = b.dataset.dtab; UI.$('#pedDet').innerHTML = detCorpo(o); }
      else if (b.dataset.act === 'rawmov') { const m = o.movimentos[+b.dataset.i]; if (m) UI.toast('RAW L' + m.source_row + ' · ' + (m.source_file || '—') + ' · ' + m.transaction_subtype, ''); }
      else if (b.dataset.act === 'intel') { UI.closeDrawer(); UI.go('crescimento', 'Pedidos e Funil'); }
    };
  }
  function detCorpo(o) {
    switch (PD._detTab) {
      case 'Itens e SKUs': return detItens(o);
      case 'Operação e Logística': return detOperacao(o);
      case 'Identidade Financeira': return detFinanceiro(o);
      case 'Conciliação': return detConciliacao(o);
      case 'Devoluções e Reembolsos': return detDevolucoes(o);
      case 'Histórico': return detHistorico(o);
      case 'Inteligência Relacionada': return `<div class="callout">A Central de Inteligência abre este pedido para análise (funil, tráfego, devoluções) <b>sem duplicar</b> o dado operacional. <button class="linklike" data-act="intel">abrir na Central →</button></div>`;
      default: return detResumo(o);
    }
  }
  const kv = (k, v) => `<div class="ctxitem"><span>${k}</span><span>${v}</span></div>`;
  function detResumo(o) {
    return `<div class="ctxcard">
      ${kv('ID do pedido', UI.esc(o.external_order_id))}${kv('Marketplace · conta', UI.esc((o.marketplace || 'shopee') + ' · ' + (o.marketplace_account_id || 'acc-shopee')))}
      ${kv('Status operacional', UI.esc(opStatus(o)))}${kv('Pagamento', o.payment_status || '—')}
      ${kv('Criado em', UI.esc((o.order_created_at || '').slice(0, 10) || '—'))}${kv('Cidade/UF', UI.esc((o.buyer_city || '—') + '/' + (o.buyer_state || '—')))}
      ${kv('Valor bruto', brl(o.gross_products_value))}${kv('Valor esperado', brl(o.expected_net_value))}${kv('Valor recebido', brl(o.received_net_value))}
      ${kv('Conciliação', stConc(o.reconciliation_status))}${kv('Fonte', UI.esc(PD._online ? 'API/Postgres' : 'preview rotulado'))}</div>`;
  }
  function detItens(o) {
    const comissaoTotal = (o.expectativa && o.expectativa.comissao) || 0;
    const rateio = V8PED.ratearPorItem(comissaoTotal, o.items || [], 'Por valor bruto do item');
    return `<div class="callout" style="margin-top:0">Taxa única do pedido (comissão ${brl(comissaoTotal)}) rateada <b>${UI.esc(rateio.metodo || '—')}</b> — <b>não duplicada</b> por SKU. Sem custo interno confiável, o lucro fica <b>SEM_DADOS_SUFICIENTES</b>.</div>
      <div class="tblwrap" style="margin-top:10px"><table class="tbl" style="min-width:0"><thead><tr>
        <th class="nosort">Produto · SKU</th><th class="nosort">Item ID</th><th class="nosort">Variation ID</th><th class="nosort">Qtd</th><th class="nosort">Bruto</th><th class="nosort">Comissão rateada</th><th class="nosort">Identidade</th><th class="nosort">Lucro</th></tr></thead><tbody>
        ${(o.items || []).map((it, i) => {
      const rat = (rateio.linhas || [])[i] || {};
      const rent = V8PED.rentabilidadeItem(it, CUSTOS[it.seller_sku]);
      const idOrig = it.external_listing_id_origem || 'AUSENTE_NA_FONTE';
      const varOrig = it.external_variation_id_origem || 'AUSENTE_NA_FONTE';
      return `<tr><td class="tmain">${UI.esc((it.product_name_original || '—').slice(0, 20))}<span class="tsub">${it.seller_sku ? UI.esc(it.seller_sku) + ' · SELLER_SKU' : '<span class="st warn plain">SEM SKU · NEEDS_REVIEW</span>'}</span></td>
        <td>${it.external_listing_id ? UI.esc(it.external_listing_id) : `<span class="src">${UI.esc(idOrig)}</span>`}</td>
        <td>${it.external_variation_id ? UI.esc(it.external_variation_id) : `<span class="src">${UI.esc(varOrig)}</span>`}</td>
        <td>${it.quantity ?? '—'}</td><td>${brl(it.gross_item_value)}</td>
        <td>${rat.valor != null ? brl(rat.valor) + ` <span class="src">(${rat.participacao ?? '—'}%)</span>` : '—'}</td>
        <td><span class="src">${UI.esc(it.identity_origin || (it.seller_sku ? 'SELLER_SKU' : 'NENHUM'))}</span></td>
        <td><span class="st ${rent.classe === 'SEM_DADOS_SUFICIENTES' ? 'plain' : 'ok'} plain">${UI.esc(rent.classe)}</span></td></tr>`;
    }).join('')}
      </tbody></table></div><p class="src" style="margin-top:6px">regra de rateio: ${UI.esc(rateio.formula || rateio.metodo || '—')} · valor total: ${brl(comissaoTotal)}.</p>`;
  }
  function detOperacao(o) {
    return `<div class="ctxcard">${kv('Status operacional', UI.esc(opStatus(o)))}${kv('Modalidade', UI.esc(o.shipping_mode || 'estoque próprio (regra)'))}
      ${kv('Criado', UI.esc((o.order_created_at || '').slice(0, 10) || '—'))}${kv('Entrega', UI.esc((o.delivered_at || '').slice(0, 10) || '—'))}
      ${kv('Prev. liberação', UI.esc((o.expected_release_at || '').slice(0, 10) || '—'))}${kv('Dias restantes / atraso', (o.dias_restantes != null ? o.dias_restantes + ' restante(s)' : o.dias_atraso != null ? o.dias_atraso + ' de atraso' : '—'))}
      ${kv('Destino', UI.esc((o.buyer_city || '—') + '/' + (o.buyer_state || '—')))}</div>
      <p class="src" style="margin-top:6px">prazos vêm da regra de recebimento (${UI.esc(o.regra_usada || 'Shopee · estoque próprio')}); sem regra, o Head declara — não inventa atraso.</p>`;
  }
  function detFinanceiro(o) {
    const e = o.expectativa || {};
    const linhas = [
      ['Valor bruto dos itens', o.gross_products_value, ''],
      ['− Descontos/cupom/voucher/PIX', -(e.descontos || 0), 'src'],
      ['− Comissão marketplace', -(e.comissao || 0), 'src'],
      ['− Taxa de serviço', -(e.servico || 0), 'src'],
      ['− Imposto', -(e.imposto || 0), 'src'],
      ['− Taxa fixa por venda', -(e.taxaFixa || 0), 'src'],
      ['= Valor líquido ESPERADO', o.expected_net_value, 'strong'],
    ];
    return `<div class="tblwrap"><table class="tbl" style="min-width:0"><tbody>
      ${linhas.map(l => `<tr><td class="${l[2] === 'strong' ? 'tmain' : ''}">${UI.esc(l[0])}</td><td style="text-align:right">${l[1] == null ? '—' : brl(l[1])}</td></tr>`).join('')}
      <tr><td class="tmain">Valor efetivamente RECEBIDO (carteira)</td><td style="text-align:right"><b>${brl(o.received_net_value)}</b></td></tr>
      <tr><td>Diferença</td><td style="text-align:right">${o.difference_value == null ? '—' : brl(o.difference_value)}</td></tr>
    </tbody></table></div>
      <div class="sect-h"><span class="h2">Movimentos da carteira (verdade)</span><span class="src">cada linha abre a origem</span></div>
      ${(o.movimentos || []).length ? `<div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Data</th><th class="nosort">Tipo original</th><th class="nosort">Classificação</th><th class="nosort">Direção</th><th class="nosort">Valor</th><th class="nosort">Origem</th></tr></thead><tbody>
        ${o.movimentos.map((m, i) => `<tr><td>${UI.esc((m.occurred_at || '').slice(0, 16))}</td><td class="tmain">${UI.esc(m.transaction_subtype || '—')}<span class="tsub">${UI.esc(m.descricao || '')}</span></td>
          <td><span class="src">${UI.esc(m.transaction_type || '—')}</span></td><td>${UI.esc(m.direction || '—')}</td>
          <td><span class="num ${m.amount < 0 ? 'crit' : ''}">${brl(m.amount)}</span></td>
          <td><button class="linklike" data-act="rawmov" data-i="${i}">${UI.esc((m.source_file || '—') + ' · L' + m.source_row)} · RAW</button></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="panel"><div class="empty">Sem movimento de carteira vinculado ainda.</div></div>'}
      <p class="src" style="margin-top:6px">${UI.esc(e.formula || '—')} · esperado vem do pedido+regra; recebido vem da carteira (verdade).</p>`;
  }
  function detConciliacao(o) {
    return `<div class="ctxcard">${kv('Status', stConc(o.reconciliation_status))}
      ${kv('Valor esperado', brl(o.expected_net_value))}${kv('Valor recebido', brl(o.received_net_value))}
      ${kv('Diferença', o.difference_value == null ? '—' : brl(o.difference_value))}
      ${kv('Prev. liberação', UI.esc((o.expected_release_at || '').slice(0, 10) || '—'))}
      ${kv('Dias restantes / atraso', (o.dias_restantes != null ? o.dias_restantes : o.dias_atraso != null ? '−' + o.dias_atraso : '—'))}
      ${kv('Regra aplicada', UI.esc(o.regra_usada || '—'))}${kv('Movimentos vinculados', (o.movimentos || []).length)}</div>
      <p class="src" style="margin-top:6px">a conciliação é decidida no backend/Postgres; a tela só a exibe.</p>`;
  }
  function detDevolucoes(o) {
    const reemb = (o.movimentos || []).filter(m => /REFUND|REEMBOLS/i.test(m.transaction_type) || m.amount < 0 && /reembolso|devolu/i.test(m.descricao || ''));
    return reemb.length ? `<div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Data</th><th class="nosort">Descrição</th><th class="nosort">Valor</th></tr></thead><tbody>
      ${reemb.map(m => `<tr><td>${UI.esc((m.occurred_at || '').slice(0, 10))}</td><td>${UI.esc(m.descricao || '')}</td><td><span class="num crit">${brl(m.amount)}</span></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="panel"><div class="empty">Sem devolução ou reembolso neste pedido.</div></div>';
  }
  function detHistorico(o) {
    const ev = o.events || [{ event_type: o._online ? '' : 'ORDER_IMPORTED', new_status: opStatus(o), occurred_at: o.order_created_at }];
    return `<div class="ctxcard">${ev.map(e => `<div class="ctxitem"><span>${UI.esc(e.event_type || 'evento')} → ${UI.esc(e.new_status || '—')}</span><span class="src">${UI.esc((e.occurred_at || '').slice(0, 16))}</span></div>`).join('')}</div>
      <p class="src" style="margin-top:6px">reimportar atualiza status sem duplicar; cada mudança vira um evento auditável.</p>`;
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'tab') render(b.dataset.tab);
    else if (act === 'abrir') abrir(b.dataset.id);
    else if (act === 'upload') { if (window.IMPORTAR && IMPORTAR.uploadModal) IMPORTAR.uploadModal({ area: 'Pedidos' }); else UI.toast('Fluxo de upload de Pedidos', ''); }
  }

  UI.renderers.pedidos = render;
  window.PEDIDOS.focus = id => { UI.go('pedidos'); setTimeout(() => abrir(id), 40); };
})();

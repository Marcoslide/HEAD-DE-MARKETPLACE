/* =============================================================
   v8 · OPERAÇÃO › CONCILIAÇÃO FINANCEIRA (10.F.1)
   Cruza os movimentos da carteira Shopee (V8CONC) com os pedidos e
   mostra o que foi conciliado, o que aguarda liberação, o que está
   atrasado, o que diverge, movimentos sem pedido e ajustes.
   Carteira = verdade; pedido + regra = expectativa. Sem dado inventado:
   o que roda aqui é um conjunto DEMONSTRATIVO rotulado; ao importar o
   relatório real, esta mesma tela passa a consumir a base real.
   ============================================================= */
(function () {
  'use strict';
  const CF = window.CONCILIACAO = { sub: 'Visão Geral' };
  const SUBS = ['Visão Geral', 'Conciliados', 'Aguardando Liberação', 'Previsto para Receber',
    'Atrasados', 'Recebimentos Parciais', 'Divergências', 'Pedidos sem Movimento',
    'Movimentos sem Pedido', 'Ajustes e Compensações', 'Regras e Configurações'];
  const brl = v => v == null ? '—' : UI.brl(v);
  const H = () => V8CONC.SHOPEE_TX_HEADER;
  const NOW = '2026-07-05';

  /* regra de ciclo demonstrativa (Shopee estoque próprio: 10–15 dias após entrega, tolerância 3) */
  const REGRAS = [{ rule_id: 'rg1', marketplace: 'shopee', marketplace_account_id: 'acc-shopee',
    rule_name: 'Shopee · estoque próprio', shipping_mode: 'proprio',
    expected_release_days_min: 10, expected_release_days_max: 15, grace_days: 3, priority: 1, status: 'Ativo' }];

  /* ---- conjunto DEMONSTRATIVO rotulado (linhas no formato REAL do relatório) ---- */
  function demoWallet() {
    const r = o => H().map(h => o[h] != null ? o[h] : '');
    return [
      r({ 'Data': '2026-06-20 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 2606CONC1', 'ID do pedido': '2606CONC1', 'Direção do dinheiro': 'Entrada', 'Valor': '176.63', 'Status': 'Transação completa', 'Balança após as transações': '176.63', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-22 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 2606PARC', 'ID do pedido': '2606PARC', 'Direção do dinheiro': 'Entrada', 'Valor': '120.00', 'Status': 'Transação completa', 'Balança após as transações': '296.63', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-24 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 2606DIV', 'ID do pedido': '2606DIV', 'Direção do dinheiro': 'Entrada', 'Valor': '95.00', 'Status': 'Transação completa', 'Balança após as transações': '391.63', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-25 09:00:00', 'Tipo de transação': 'Shopee Acelera', 'Descrição': 'Resgate do Shopee Acelera - ID da transação: 7788', 'ID do pedido': '-', 'Direção do dinheiro': 'Entrada', 'Valor': '5000.00', 'Status': 'Transação completa', 'Balança após as transações': '5391.63', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-25 22:00:00', 'Tipo de transação': 'Pix', 'Descrição': 'PIX Transfer Send', 'ID do pedido': '-', 'Direção do dinheiro': 'Saída', 'Valor': '-4000.00', 'Status': 'Transação completa', 'Balança após as transações': '1391.63', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-27 08:00:00', 'Tipo de transação': 'Ajuste', 'Descrição': 'Indenização por objeto perdido', 'ID do pedido': '-', 'Direção do dinheiro': 'Entrada', 'Valor': '48.90', 'Status': 'Transação completa', 'Balança após as transações': '1440.53', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-28 08:00:00', 'Tipo de transação': 'Ajuste', 'Descrição': 'Ajuste pós-reembolso 2606CONC1', 'ID do pedido': '2606CONC1', 'Direção do dinheiro': 'Saída', 'Valor': '-2.00', 'Status': 'Transação completa', 'Balança após as transações': '1438.53', 'Valor a Ser Ajustado': '0.00' }),
      r({ 'Data': '2026-06-29 10:00:00', 'Tipo de transação': 'Renda do pedido', 'Descrição': 'Renda do pedido 2606SEMPED', 'ID do pedido': '2606SEMPED', 'Direção do dinheiro': 'Entrada', 'Valor': '210.40', 'Status': 'Transação completa', 'Balança após as transações': '1648.93', 'Valor a Ser Ajustado': '0.00' }),
    ];
  }
  const demoOrders = () => [
    { external_order_id: '2606CONC1', marketplace: 'shopee', marketplace_account_id: 'acc-shopee', internal_order_id: 'PED-1001', gross_order_value: 210, expected_net_value: 174.63, paid_at: '2026-06-19', delivered_at: '2026-06-20', shipping_mode: 'proprio', itens: [{ sku: 'QP-6090', valorBruto: 129.9 }, { sku: 'POR-3D', valorBruto: 80.1 }] },
    { external_order_id: '2606PARC', marketplace: 'shopee', marketplace_account_id: 'acc-shopee', internal_order_id: 'PED-1002', gross_order_value: 250, expected_net_value: 205, paid_at: '2026-06-21', delivered_at: '2026-06-22', shipping_mode: 'proprio', itens: [{ sku: 'KIT3-SALA', valorBruto: 250 }] },
    { external_order_id: '2606DIV', marketplace: 'shopee', marketplace_account_id: 'acc-shopee', internal_order_id: 'PED-1003', gross_order_value: 160, expected_net_value: 132.4, paid_at: '2026-06-23', delivered_at: '2026-06-24', shipping_mode: 'proprio', itens: [{ sku: 'ESP-ORG', valorBruto: 160 }] },
    { external_order_id: '2606ATR', marketplace: 'shopee', marketplace_account_id: 'acc-shopee', internal_order_id: 'PED-1004', gross_order_value: 300, expected_net_value: 246, paid_at: '2026-06-01', delivered_at: '2026-06-02', shipping_mode: 'proprio', itens: [{ sku: 'TEN-R37', valorBruto: 300 }] },
    { external_order_id: '2606AGU', marketplace: 'shopee', marketplace_account_id: 'acc-shopee', internal_order_id: 'PED-1005', gross_order_value: 140, expected_net_value: 115, paid_at: '2026-07-01', delivered_at: '2026-07-02', shipping_mode: 'proprio', itens: [{ sku: 'GAR-1L', valorBruto: 140 }] },
  ];

  /* Fonte OFICIAL = API + Postgres (V8CONC.reconcile roda no backend). Quando há
     backend configurado, a tela consome /financial-reconciliation/*; num Artifact
     estático (sem backend) mostra um conjunto DEMONSTRATIVO rotulado — nunca
     fingindo que o demo é a base oficial. */
  function fonteOficialDisponivel() { return window.V8API && V8API.online && V8API.online(); }
  function fonte() {
    const txns = V8CONC.normalizeShopeeWallet(demoWallet(), { marketplace: 'shopee', contaId: 'acc-shopee', empresaId: 'e1', arquivo: 'demo-carteira.xlsx' });
    return { txns, orders: demoOrders(), origem: 'DADO SIMULADO', rotulo: fonteOficialDisponivel() ? 'preview — a base oficial é a API/Postgres' : 'demonstração rotulada (sem backend: preview)' };
  }
  function resultado() {
    const f = fonte();
    const r = V8CONC.reconcile({ transactions: f.txns, orders: f.orders, rules: REGRAS, now: NOW, toleranciaCentavos: 0.05 });
    r._origem = f.origem; r._rotulo = f.rotulo;
    return r;
  }

  function render(sub) {
    if (sub && SUBS.includes(sub)) CF.sub = sub;
    const el = document.querySelector('#v-conciliacao'); if (!el) return;
    const r = resultado();
    const b = V8CONC.buckets(r);
    const s = r.resumo;
    const tabs = `<div class="tabs" style="margin-top:14px;flex-wrap:wrap">${SUBS.map(x => {
      const cnt = contagem(x, r, b);
      return `<button class="tab ${x === CF.sub ? 'on' : ''}" data-act="cfsub" data-sub="${x}">${x}${cnt != null ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
    }).join('')}</div>`;
    el.innerHTML = `
      <div class="sect-h"><div><div class="eyebrow">OPERAÇÃO · CONCILIAÇÃO FINANCEIRA</div>
        <h1 class="h1">Conciliação Financeira</h1>
        <p class="sub">Vendeu? O Head confere se o dinheiro entrou, explica cada desconto e mostra onde ele está preso, atrasado ou divergente.</p></div>
        <span class="src">fonte: ${UI.esc(r._origem)} · ${UI.esc(r._rotulo)} · período até ${NOW} · America/Sao_Paulo</span></div>
      <div class="callout" style="margin-top:0"><b>Carteira = verdade financeira.</b> Pedido + regra de ciclo = expectativa (nunca substitui a carteira). Prazos vêm de regra configurada; sem regra, o Head declara — não inventa atraso.</div>
      ${tabs}
      <div id="cfBody" style="margin-top:14px">${corpo(r, b, s)}</div>`;
    el.querySelectorAll('[data-act="cfsub"]').forEach(x => x.addEventListener('click', () => { CF.sub = x.dataset.sub; render(); }));
    el.querySelectorAll('[data-act="cfmissao"]').forEach(x => x.addEventListener('click', () => UI.toast('Missão de revisão criada (interna) — pedido ' + x.dataset.ped, 'ok')));
  }

  function contagem(sub, r, b) {
    switch (sub) {
      case 'Conciliados': return b.conciliados.length;
      case 'Aguardando Liberação': return b.aguardando.length;
      case 'Atrasados': return b.atrasados.length;
      case 'Recebimentos Parciais': return b.parciais.length;
      case 'Divergências': return b.divergentes.length;
      case 'Pedidos sem Movimento': return b.semMovimento.length;
      case 'Movimentos sem Pedido': return b.movimentosSemPedido.length;
      case 'Ajustes e Compensações': return b.ajustes.length;
      default: return null;
    }
  }

  /* ---- tabela genérica de casos ---- */
  function tabelaCasos(casos, cols) {
    if (!casos.length) return `<div class="panel"><div class="empty">Nada nesta lista no período — o Head só mostra o que tem evidência de fonte.</div></div>`;
    const head = cols.map(c => `<th class="nosort">${c[0]}</th>`).join('');
    const rows = casos.map(c => `<tr><td class="tmain">${UI.esc(c.external_order_id)}${c.internal_order_id ? `<span class="tsub">${UI.esc(c.internal_order_id)}</span>` : ''}</td>${cols.slice(1).map(col => `<td>${col[1](c)}</td>`).join('')}</tr>`).join('');
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th class="nosort">Pedido</th>${head.replace(/<th class="nosort">Pedido<\/th>/, '')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  const stBadge = st => {
    const map = { CONCILIADO: 'ok', COM_AJUSTE_POSTERIOR: 'ok', AGUARDANDO_LIBERACAO: 'plain', RECEBIMENTO_PARCIAL: 'warn', DIVERGENTE: 'danger', SEM_MOVIMENTO_ENCONTRADO: 'danger', ATRASADO: 'danger', REEMBOLSADO: 'warn', RECEBIDO_SEM_CONFERENCIA: 'plain' };
    return `<span class="st ${map[st] || 'plain'} plain">${st}</span>`;
  };

  function corpo(r, b, s) {
    switch (CF.sub) {
      case 'Visão Geral': return visaoGeral(r, s, b);
      case 'Conciliados': return tabelaCasos(b.conciliados, [['Pedido'], ['Valor esperado', c => brl(c.expected_net_value)], ['Recebido', c => brl(c.received_net_value)], ['Diferença', c => brl(c.difference_value)], ['Liberação', c => UI.esc((c.last_wallet_movement_at || '').slice(0, 10) || '—')], ['Itens', c => c.qtd_itens ?? '—'], ['Status', c => stBadge(c.reconciliation_status)]]);
      case 'Aguardando Liberação': return aguardando(b);
      case 'Previsto para Receber': return previsto(r);
      case 'Atrasados': return atrasados(b);
      case 'Recebimentos Parciais': return tabelaCasos(b.parciais, [['Pedido'], ['Esperado', c => brl(c.expected_net_value)], ['Recebido', c => brl(c.received_net_value)], ['Pendente', c => `<span class="num crit">${brl(c.pending_net_value)}</span>`], ['% conciliado', c => c.expected_net_value ? Math.round((c.received_net_value / c.expected_net_value) * 100) + '%' : '—'], ['Status', c => stBadge(c.reconciliation_status)]]);
      case 'Divergências': return divergencias(b);
      case 'Pedidos sem Movimento': return tabelaCasos(b.semMovimento, [['Pedido'], ['Valor esperado', c => brl(c.expected_net_value)], ['Dias atraso', c => c.dias_atraso ?? '—'], ['Entrega', c => UI.esc((c.delivered_at || '').slice(0, 10) || '—')], ['Regra', c => UI.esc(c.regra_usada || 'sem regra')], ['Status', c => stBadge(c.reconciliation_status)]]);
      case 'Movimentos sem Pedido': return movimentosSemPedido(b);
      case 'Ajustes e Compensações': return ajustes(b);
      case 'Regras e Configurações': return regras();
      default: return '';
    }
  }

  const kpi = (k, v, f, cls) => `<div class="mesa-kpi ${cls || ''}"><span class="k">${k}</span><span class="v">${v}</span><span class="f">${f || ''}</span></div>`;

  function visaoGeral(r, s, b) {
    return `<div class="mesa-grid">
        ${kpi('Vendido bruto', brl(s.totalVendidoBruto), 'pedidos com valor de pedido')}
        ${kpi('Liberado na carteira', brl(s.totalLiberadoCarteira), 'Renda do pedido (real na carteira)')}
        ${kpi('Aguardando liberação', brl(s.valorAguardandoLiberacao), s.qtdAguardando + ' pedido(s) no prazo')}
        ${kpi('Atrasado', brl(s.valorAtrasado), s.qtdAtrasados + ' pedido(s) fora do prazo', s.valorAtrasado ? 'nodata' : '')}
        ${kpi('Divergente', brl(s.valorDivergente), s.qtdDivergentes + ' pedido(s) não explicado(s)')}
        ${kpi('Reembolsos', brl(s.valorReembolso), 'saídas por reembolso')}
        ${kpi('Ajustes +', brl(s.ajustesPositivos), 'créditos/indenizações')}
        ${kpi('Ajustes −', brl(s.ajustesNegativos), 'débitos posteriores')}
      </div>
      <div class="mesa-grid" style="margin-top:10px">
        ${kpi('Conciliados', s.qtdConciliados, 'valor recebido explica o esperado')}
        ${kpi('Recebido sem conferência', s.qtdRecebidoSemConferencia, 'entrou, mas falta pedido p/ conferir')}
        ${kpi('Movimentos sem pedido', s.qtdMovimentosSemPedido, 'linhas financeiras sem vínculo — nunca apagadas')}
        ${kpi('Tesouraria (saques/antecip.)', s.qtdTesouraria, 'caixa: não é conciliação de venda')}
      </div>
      <div class="panel" style="margin-top:12px">
        <div class="sect-h" style="margin-top:0"><span class="h2">Composição dos descontos e movimentos</span><span class="src">soma por tipo canônico · fonte: carteira</span></div>
        <div class="tblwrap"><table class="tbl" style="min-width:0"><thead><tr><th class="nosort">Tipo</th><th class="nosort">Movimentos</th><th class="nosort">Valor</th></tr></thead><tbody>
          ${composicao(r).map(x => `<tr><td class="tmain">${UI.esc(x.tipo)}</td><td>${x.n}</td><td><span class="num ${x.valor < 0 ? 'crit' : ''}">${brl(x.valor)}</span></td></tr>`).join('')}
        </tbody></table></div>
        <p class="src" style="margin-top:6px">três visões alimentam Lucratividade: vendas realizadas × recebimentos liberados × lucro. Faturamento bruto não é dinheiro recebido.</p>
      </div>`;
  }
  function composicao(r) {
    const m = {};
    for (const t of r.transacoes) { m[t.transaction_type] = m[t.transaction_type] || { tipo: t.transaction_type, n: 0, valor: 0 }; m[t.transaction_type].n++; m[t.transaction_type].valor += t.amount; }
    return Object.values(m).map(x => ({ tipo: x.tipo, n: x.n, valor: Math.round(x.valor * 100) / 100 })).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  }

  function aguardando(b) {
    const total = b.aguardando.reduce((a, c) => a + (c.expected_net_value || 0), 0);
    return `<div class="mesa-grid">${kpi('Total aguardando', brl(total), b.aguardando.length + ' pedido(s) no ciclo normal')}</div>
      ${tabelaCasos(b.aguardando, [['Pedido'], ['Valor previsto', c => brl(c.expected_net_value)], ['Pagamento', c => UI.esc((c.paid_at || '').slice(0, 10) || '—')], ['Entrega', c => UI.esc((c.delivered_at || '').slice(0, 10) || '—')], ['Prev. liberação', c => UI.esc((c.expected_release_at || '').slice(0, 10) || '—')], ['Dias restantes', c => c.dias_restantes ?? '—'], ['Regra', c => UI.esc(c.regra_usada || 'sem regra')]])}`;
  }
  function previsto(r) {
    const p = V8CONC.previsaoEntrada(r, NOW);
    return `<div class="mesa-grid">
        ${kpi('Hoje', brl(p.hoje), 'previsto para liberar')}
        ${kpi('Próximos 7 dias', brl(p.d7), '')}
        ${kpi('Próximos 15 dias', brl(p.d15), '')}
        ${kpi('Próximos 30 dias', brl(p.d30), '')}
        ${kpi('Atrasado', brl(p.atrasado), 'deveria ter entrado', p.atrasado ? 'nodata' : '')}
      </div><p class="src" style="margin-top:8px">${UI.esc(p.nota)}</p>`;
  }
  function atrasados(b) {
    if (!b.atrasados.length) return `<div class="panel"><div class="empty">Nenhum pedido fora do prazo configurado. O Head nunca marca atraso dentro da janela da regra.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th class="nosort">Pedido</th><th class="nosort">Valor esperado</th><th class="nosort">Prev. liberação</th><th class="nosort">Dias atraso</th><th class="nosort">Entrega</th><th class="nosort">Possível motivo</th><th class="nosort">Ações</th></tr></thead><tbody>
      ${b.atrasados.map(c => `<tr><td class="tmain">${UI.esc(c.external_order_id)}<span class="tsub">${UI.esc(c.internal_order_id || '')}</span></td>
        <td>${brl(c.expected_net_value)}</td><td>${UI.esc((c.expected_release_at || '').slice(0, 10) || '—')}</td>
        <td><span class="num crit">${c.dias_atraso ?? '—'}</span></td><td>${UI.esc((c.delivered_at || '').slice(0, 10) || '—')}</td>
        <td><span class="src">${UI.esc(motivoAtraso(c))}</span></td>
        <td><button class="btn sm" data-act="cfmissao" data-ped="${UI.esc(c.external_order_id)}">criar revisão</button></td></tr>`).join('')}
    </tbody></table></div><p class="src" style="margin-top:8px">Motivos são hipóteses — o Head nunca acusa o marketplace de erro sem evidência.</p>`;
  }
  const motivoAtraso = c => !c.delivered_at ? 'pedido ainda não entregue' : 'entregue e sem movimento na carteira — revisar carteira/ID ou período importado';

  function divergencias(b) {
    if (!b.divergentes.length) return `<div class="panel"><div class="empty">Sem divergências não explicadas no período.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th class="nosort">Pedido</th><th class="nosort">Bruto</th><th class="nosort">Esperado</th><th class="nosort">Recebido</th><th class="nosort">Diferença</th><th class="nosort">Origem provável</th><th class="nosort">Ações</th></tr></thead><tbody>
      ${b.divergentes.map(c => `<tr><td class="tmain">${UI.esc(c.external_order_id)}</td><td>${brl(c.gross_order_value)}</td><td>${brl(c.expected_net_value)}</td><td>${brl(c.received_net_value)}</td>
        <td><span class="num ${c.difference_value < 0 ? 'crit' : ''}">${brl(c.difference_value)}</span></td>
        <td><span class="src">${UI.esc(origemDiv(c))}</span></td>
        <td><button class="btn sm" data-act="cfmissao" data-ped="${UI.esc(c.external_order_id)}">revisar</button></td></tr>`).join('')}
    </tbody></table></div><p class="src" style="margin-top:8px">Origem é classificação provável, com base nos componentes conhecidos — sem dado suficiente, fica "a revisar".</p>`;
  }
  const origemDiv = c => c.difference_value > 0 ? 'recebeu acima do esperado — crédito/ajuste não mapeado' : 'recebeu abaixo — taxa/frete/desconto maior que o previsto (a revisar)';

  function movimentosSemPedido(b) {
    if (!b.movimentosSemPedido.length) return `<div class="panel"><div class="empty">Nenhum movimento sem pedido no período.</div></div>`;
    return `<div class="callout" style="margin-top:0">Linhas financeiras sem vínculo de pedido — <b>nunca são apagadas</b>. Podem ser indenização, crédito por extravio, débito posterior ou pedido fora do período importado.</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th class="nosort">Data</th><th class="nosort">Tipo</th><th class="nosort">Descrição</th><th class="nosort">Valor</th><th class="nosort">Arquivo · linha</th><th class="nosort">Confiança</th></tr></thead><tbody>
      ${b.movimentosSemPedido.map(t => `<tr><td class="tmain">${UI.esc((t.occurred_at || '').slice(0, 16))}</td><td>${UI.esc(t.transaction_type)}<span class="tsub">${UI.esc(t.transaction_subtype || '')}</span></td>
        <td>${UI.esc(t.descricao || '')}</td><td><span class="num ${t.amount < 0 ? 'crit' : ''}">${brl(t.amount)}</span></td>
        <td><span class="src">${UI.esc((t.source_file || '—') + ' · L' + t.source_row)}</span></td><td>${UI.esc(t.confidence)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function ajustes(b) {
    if (!b.ajustes.length) return `<div class="panel"><div class="empty">Sem ajustes ou compensações no período.</div></div>`;
    return `<div class="tblwrap"><table class="tbl"><thead><tr><th class="nosort">Data</th><th class="nosort">Tipo</th><th class="nosort">Descrição</th><th class="nosort">Pedido</th><th class="nosort">Valor</th><th class="nosort">Fonte</th></tr></thead><tbody>
      ${b.ajustes.map(t => `<tr><td class="tmain">${UI.esc((t.occurred_at || '').slice(0, 16))}</td><td>${UI.esc(t.transaction_type)}</td><td>${UI.esc(t.descricao || '')}</td>
        <td>${UI.esc(t.external_order_id || '—')}</td><td><span class="num ${t.amount < 0 ? 'crit' : ''}">${brl(t.amount)}</span></td>
        <td><span class="src">${UI.esc((t.source_file || '—') + ' · L' + t.source_row)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function regras() {
    return `<div class="callout" style="margin-top:0">Regras de ciclo de recebimento por marketplace/conta/modalidade. Sem regra validada, o Head não marca atraso — declara "sem regra". (Edição completa entra na integração com Configurações › Empresas e Operações.)</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th class="nosort">Regra</th><th class="nosort">Marketplace</th><th class="nosort">Modalidade</th><th class="nosort">Liberação (dias)</th><th class="nosort">Tolerância</th><th class="nosort">Status</th></tr></thead><tbody>
      ${REGRAS.map(g => `<tr><td class="tmain">${UI.esc(g.rule_name)}</td><td>${UI.esc(g.marketplace)}</td><td>${UI.esc(g.shipping_mode || 'todas')}</td>
        <td>${g.expected_release_days_min}–${g.expected_release_days_max} após entrega</td><td>${g.grace_days} dia(s)</td><td><span class="st ok plain">${UI.esc(g.status)}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  }

  UI.renderers.conciliacao = render;
})();

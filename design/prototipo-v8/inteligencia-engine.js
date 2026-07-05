/* =============================================================
   V8INT — Motor de Cruzamento da Inteligência (SPRINT 10.E.2.5.1)
   Cruza as fontes reais (Performance de Produtos, Devoluções,
   Estoque Full, Cadastro) pela CADEIA DE PRIORIDADE:
     marketplace + conta + ID do Item
     → ID da Variação → SKU da Variação → SKU Principal
     → ID do Pedido → ID da Devolução → (nome só sugere, nunca vincula)
   Nada é inventado: onde falta dado, declara "sem dados" / "fila de
   revisão"; correlação nunca é afirmada como causa sem evidência.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8INT = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* onde baixar cada relatório na Shopee + arquivo esperado + contrato de colunas */
  const CONTRATOS = {
    'Performance de Produtos': {
      metricType: 'performance_item',
      caminho: 'Seller Center → Dados → Análise de Produtos → Exportar por produto/variação',
      arquivo: 'Análise de Produtos (XLSX, por ID do Item + variação)',
      colunas: ['ID do Item', 'Produto', 'Status Atual do Item', 'ID da Variação', 'Nome da Variação', 'Status Atual da Variação',
        'SKU Principal', 'SKU da Variação', 'Impressão do Produto', 'Impressões Únicas de Produto', 'Cliques Por Produto', 'Cliques Únicos no Produto',
        'CTR', 'Visitantes do Produto (Visita)', 'Visualizações da Página do Produto', 'Taxa de Rejeição do Produto', 'Cliques em Buscas', 'Curtidas',
        'Visitantes do Produto (Adicionar ao Carrinho)', 'Unidades (Adicionar ao Carrinho)', 'Taxa de Conversão (Adicionar ao Carrinho)',
        'Vendas (Pedido Realizado) (BRL)', 'Vendas (Pedido Pago) (BRL)', 'Pedido Feito', 'Produto Pago', 'Unidades (Pedido Realizado)', 'Unidades (Pedido Pago)',
        'Compradores (Pedido Realizado)', 'Compradores (Pedido Pago)', 'Taxa de Conversão de Pedido (Pedido Realizado)', 'Taxa de Conversão de Pedido (Pedido Pago)',
        'Vendas por Pedido (Pedido Realizado) (BRL)', 'Vendas por Pedido (Pedido Pago) (BRL)'],
    },
    'Devoluções e Cancelamentos': {
      metricType: 'devolucoes',
      caminho: 'Seller Center → Vendas → Devoluções/Reembolsos → Exportar',
      arquivo: 'Devoluções e Reembolsos (XLSX, por ID da Devolução)',
      colunas: ['ID da Devolução', 'ID do Pedido', 'Data de Criação do Pedido', 'Nome de Usuário do Comprador', 'Nome do Produto', 'SKU Principal',
        'Nome da Variação', 'SKU da Variação', 'IMEI', 'Preço da Unidade', 'Tempo de Envio de Devolução', 'Status da Devolução / Reembolso',
        'Tipo de Devolução', 'Quantidade de Devoluções', 'Solução para Retorno e Reembolso', 'Motivo da Devolução', 'Observações da Devolução',
        'Quantia Total de Reembolsos', 'Tempo Decorrido de Reembolso', 'Retorno ao Armazém Shopee'],
    },
    'Estoque Full': {
      metricType: 'estoque',
      caminho: 'Seller Center → Logística → Envios pela Shopee (Full) → Estoque → Exportar Inventário Atual',
      arquivo: 'Current Inventory Report (XLSX)',
      colunas: ['Product Name', 'Variations', 'Warehouse SKU ID', 'Seller SKU ID', 'Fulfill Mapping Mode', 'Shop SKU ID', 'Barcode',
        'Recommend Replenishment Qty', 'Pending IR Approval', 'IR Approval', 'Pending ASN Inbound', 'Sellable', 'Reserved', 'Unsellable',
        'Selling Speed', 'Coverage Days', 'Excess Qty', 'unitsSoldInLast7Days', 'unitsSoldInLast15Days', 'unitsSoldInLast30Days',
        'unitsSoldInLast60Days', 'unitsSoldInLast90Days'],
    },
  };

  /* cobertura declarada de uma fonte no escopo atual */
  function coberturaFonte(eng, metricType, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === metricType && !s.excluidoDaAnalise &&
      (!filtro.contaId || (s.escopo && s.escopo.contaId === filtro.contaId)));
    const erros = eng.rawErrors.filter(e => true).length;
    if (!snaps.length) return { estado: 'Sem dados', registros: 0, periodo: null, conta: filtro.contaId || null };
    const per = snaps.map(s => s.periodo_ini).filter(Boolean).sort();
    const conflitante = eng.conflicts && eng.conflicts.length;
    return { estado: conflitante ? 'Conflitante' : 'Completa', registros: snaps.length,
      periodo: per.length ? { ini: per[0], fim: snaps.map(s => s.periodo_fim).filter(Boolean).sort().slice(-1)[0] } : null,
      conta: (snaps[0].escopo || {}).contaId || null, arquivo: snaps[snaps.length - 1].sourceFile };
  }

  /* chave de cruzamento por prioridade — retorna a chave mais forte disponível */
  function crossKey(rec) {
    const mk = rec.marketplace || (rec.escopo && rec.escopo.marketplace) || '?';
    const ct = rec.conta || (rec.escopo && rec.escopo.contaId) || '?';
    if (rec.item_id && rec.variacao_id) return { nivel: 1, chave: [mk, ct, 'item', rec.item_id, 'var', rec.variacao_id].join('|'), rotulo: 'ID do Item + Variação' };
    if (rec.item_id) return { nivel: 1, chave: [mk, ct, 'item', rec.item_id].join('|'), rotulo: 'ID do Item' };
    if (rec.sku_variacao) return { nivel: 3, chave: [mk, ct, 'skuv', rec.sku_variacao].join('|'), rotulo: 'SKU da Variação' };
    if (rec.sku_pai) return { nivel: 4, chave: [mk, ct, 'skup', rec.sku_pai].join('|'), rotulo: 'SKU Principal' };
    if (rec.pedido) return { nivel: 5, chave: [mk, ct, 'ped', rec.pedido].join('|'), rotulo: 'ID do Pedido' };
    return { nivel: 8, chave: null, rotulo: 'sem chave forte (nome só sugere)' };
  }

  /* índice por SKU (Principal e Variação) para juntar estoque×performance×cadastro */
  function skuIndex(list, getSkus) {
    const idx = {};
    for (const r of list) for (const sku of getSkus(r)) if (sku) (idx[sku] = idx[sku] || []).push(r);
    return idx;
  }

  /* MOTOR DE CRUZAMENTO — junta as fontes reais por SKU (chave real disponível
     entre estoque, performance e cadastro). Item sem vínculo confirmado vai para
     a fila de revisão; nome nunca cria vínculo definitivo. */
  function motorCruzamento(eng, V8IMP, cat, filtro) {
    filtro = filtro || {};
    const perf = V8IMP.performanceItemView(eng, filtro);
    const dev = V8IMP.devolucoesView(eng, filtro);
    const stock = V8IMP.stockView(eng, filtro);
    const listings = (cat && cat.listings) || [];

    const cruz = {}; /* por sku_variacao || sku_pai */
    const chaveDe = r => r.sku_variacao || r.sku_pai || null;
    const put = (sku, campo, val) => { if (!sku) return; const e = cruz[sku] = cruz[sku] || { sku, performance: null, estoque: null, devolucoes: [], cadastro: null, item_id: null }; e[campo] = campo === 'devolucoes' ? e.devolucoes.concat([val]) : val; if (val && val.item_id && !e.item_id) e.item_id = val.item_id; };

    if (!perf.semDados) for (const it of perf.itens) put(chaveDe(it), 'performance', it);
    if (!stock.atual) stock.atual = [];
    for (const st of stock.atual) put(st.sku, 'estoque', st);
    if (!dev.semDados) for (const ev of dev.eventos) { const sku = ev.sku_variacao || ev.sku_pai; if (cruz[sku]) cruz[sku].devolucoes = cruz[sku].devolucoes.concat([ev]); else put(sku, 'devolucoes', ev); }
    for (const l of listings) { const sku = l.skuVariacao || l.sku || l.skuPai; if (sku && cruz[sku]) cruz[sku].cadastro = { item_id: l.item_id || l.itemId || null, nome: l.nome || l.titulo || null, status: l.statusReportado || l.status || null }; }

    const entidades = Object.values(cruz);
    /* fila de revisão: fontes sem chave forte (só nome, ou pedido sem produto) */
    const fila = [];
    if (!dev.semDados) for (const ev of dev.eventos) if (!ev.sku_variacao && !ev.sku_pai) fila.push({ origem: 'Devoluções', ref: ev.return_id || ev.pedido, motivo: 'evento sem SKU — vincular manualmente por ID do pedido' });
    if (!perf.semDados) for (const it of perf.itens) if (!it.sku_variacao && !it.sku_pai && !it.item_id) fila.push({ origem: 'Performance', ref: it.produto, motivo: 'linha sem ID do Item nem SKU — só nome, não vincula' });

    return {
      entidades, fila,
      resumo: { comCruzamento: entidades.filter(e => [e.performance, e.estoque, e.cadastro].filter(Boolean).length + (e.devolucoes.length ? 1 : 0) >= 2).length,
        soUmaFonte: entidades.filter(e => [e.performance, e.estoque, e.cadastro].filter(Boolean).length + (e.devolucoes.length ? 1 : 0) < 2).length,
        total: entidades.length },
      fontes: { performance: !perf.semDados, estoque: !!stock.atual.length, devolucoes: !dev.semDados, cadastro: listings.length > 0 },
      nota: 'cruzamento por SKU da Variação → SKU Principal; ID do Item quando presente. Nome nunca vincula sozinho.',
    };
  }

  /* ANÁLISES CRUZADAS — sempre com fato, fonte, campos, período, cobertura,
     hipótese (quando aplicável), confiança e ação. Nunca afirma causa. */
  function analises(eng, V8IMP, cat, filtro) {
    filtro = filtro || {};
    const mc = motorCruzamento(eng, V8IMP, cat, filtro);
    const out = [];
    const perAnalise = (base) => Object.assign({ hipotese: null, acao: null }, base);

    for (const e of mc.entidades) {
      const p = e.performance, st = e.estoque, devs = e.devolucoes;
      const mp = (p && p.metricas) || {};
      const fontes = [p && 'Performance de Produtos', st && 'Estoque Full', devs.length && 'Devoluções', e.cadastro && 'Cadastro'].filter(Boolean);
      /* alto tráfego + baixa conversão */
      if (p && mp.visitors != null && mp.conv_paid != null && mp.visitors >= 500 && mp.conv_paid < 0.01) {
        out.push(perAnalise({ tipo: 'Alto tráfego + baixa conversão', sku: e.sku,
          fato: `${e.sku}: ${fmt(mp.visitors)} visitantes e conversão paga de ${pctTxt(mp.conv_paid)}.`,
          fonte: 'Performance de Produtos', campos: ['Visitantes do Produto (Visita)', 'Taxa de Conversão de Pedido (Pedido Pago)'],
          periodo: p.periodo, cobertura: 'Parcial (1 fonte)', confianca: 'média',
          hipotese: 'preço, fotos, avaliações ou concorrência podem estar segurando a conversão — precisa de verificação.',
          acao: 'revisar página do anúncio (preço, primeira foto, avaliações) e comparar com concorrentes.' }));
      }
      /* muito carrinho + pouco pagamento */
      if (p && mp.cart_units != null && mp.orders_paid != null && mp.cart_units >= 200 && mp.orders_paid < mp.cart_units * 0.3) {
        out.push(perAnalise({ tipo: 'Muito carrinho + pouco pagamento', sku: e.sku,
          fato: `${e.sku}: ${fmt(mp.cart_units)} adições ao carrinho e apenas ${fmt(mp.orders_paid)} pagamentos.`,
          fonte: 'Performance de Produtos', campos: ['Unidades (Adicionar ao Carrinho)', 'Produto Pago'],
          periodo: p.periodo, cobertura: 'Parcial (1 fonte)', confianca: 'média',
          hipotese: 'frete, prazo, cupom ausente ou desistência no checkout podem explicar — verificar.',
          acao: 'testar cupom/frete e revisar prazo de entrega exibido.' }));
      }
      /* estoque alto + baixa velocidade */
      if (st && st.velocidade != null && st.disponivel != null && st.disponivel >= 20 && st.velocidade < 0.5) {
        out.push(perAnalise({ tipo: 'Estoque alto + baixa velocidade', sku: e.sku,
          fato: `${e.sku}: ${st.disponivel} vendáveis com velocidade ${st.velocidade}/dia (cobertura ${st.cobertura ?? '—'} dias).`,
          fonte: 'Estoque Full', campos: ['Sellable', 'Selling Speed', 'Coverage Days', 'Excess Qty'],
          periodo: null, cobertura: 'Parcial (1 fonte)', confianca: 'alta',
          hipotese: 'capital parado no Full — pode indicar excesso de reposição ou queda de demanda.',
          acao: 'avaliar promoção de giro ou reduzir reposição; comparar com vendas 30/90 dias.' }));
      }
      /* estoque crítico + vendas recentes */
      if (st && st.disponivel != null && st.disponivel <= 5 && st.vendas30d != null && st.vendas30d >= 10) {
        out.push(perAnalise({ tipo: 'Estoque crítico + vendas crescentes', sku: e.sku,
          fato: `${e.sku}: só ${st.disponivel} vendáveis, mas ${st.vendas30d} vendas em 30 dias.`,
          fonte: 'Estoque Full', campos: ['Sellable', 'unitsSoldInLast30Days', 'Recommend Replenishment Qty'],
          periodo: null, cobertura: 'Parcial (1 fonte)', confianca: 'alta',
          hipotese: 'risco de ruptura — a demanda recente supera o disponível.',
          acao: `repor com urgência (sugestão da Shopee: ${st.reposicao ?? '—'} un.).` }));
      }
      /* devolução alta por variação */
      if (devs.length && p && mp.orders_paid != null && mp.orders_paid > 0 && devs.length / mp.orders_paid >= 0.05) {
        out.push(perAnalise({ tipo: 'Devolução alta na variação', sku: e.sku,
          fato: `${e.sku}: ${devs.length} devolução(ões) sobre ${fmt(mp.orders_paid)} pagamentos.`,
          fonte: 'Devoluções + Performance', campos: ['ID da Devolução', 'Motivo da Devolução', 'Produto Pago'],
          periodo: p.periodo, cobertura: 'Cruzada (2 fontes)', confianca: 'alta',
          hipotese: `motivos: ${Array.from(new Set(devs.map(d => d.motivo).filter(Boolean))).join('; ') || '—'}.`,
          acao: 'revisar embalagem/descrição da variação com maior devolução.' }));
      }
    }
    return { itens: out, cruzamento: mc,
      nota: 'toda análise traz fato + fonte + campos + período + cobertura + confiança; correlação nunca é afirmada como causa.' };
  }

  /* INTELIGÊNCIA SOBRE FULL — só levanta hipótese, nunca causa.
     Sem série antes/depois suficiente, declara honestamente a insuficiência. */
  function fullIntelligence(eng, V8IMP, filtro) {
    const stock = V8IMP.stockView(eng, filtro);
    if (!stock.atual.length) return { semDados: true, itens: [], nota: 'sem snapshot de Estoque Full aplicado no escopo.' };
    const itens = stock.atual.map(st => {
      const temTendencia = st.vendas7d != null && st.vendas30d != null;
      /* projeção 7d→30d só como leitura de tendência, jamais como prova de causa */
      const ritmo7 = st.vendas7d != null ? st.vendas7d / 7 : null;
      const ritmo30 = st.vendas30d != null ? st.vendas30d / 30 : null;
      const variacao = (ritmo7 != null && ritmo30 != null && ritmo30 > 0) ? Math.round(((ritmo7 - ritmo30) / ritmo30) * 100) : null;
      return { sku: st.sku, produto: st.produto, vendas7d: st.vendas7d, vendas30d: st.vendas30d, vendas90d: st.vendas90d,
        variacaoRitmo: variacao, cobertura: st.cobertura, velocidade: st.velocidade,
        evidencia: `ritmo 7d ${ritmo7 != null ? ritmo7.toFixed(2) : '—'}/dia vs 30d ${ritmo30 != null ? ritmo30.toFixed(2) : '—'}/dia`,
        temEvidenciaCausal: false,
        leitura: !temTendencia ? 'Dados insuficientes para calcular tendência antes/depois do Full.'
          : variacao > 0 ? `Fato observado: ritmo de vendas recente ${variacao}% acima da média de 30 dias.`
          : `Fato observado: ritmo de vendas recente ${Math.abs(variacao || 0)}% ${variacao < 0 ? 'abaixo' : 'em linha com'} a média de 30 dias.`,
        hipotese: temTendencia ? 'Maior elegibilidade logística, prazo de entrega ou exposição podem contribuir — sem grupo de comparação, não é causa.' : null };
    });
    return { semDados: false, itens,
      nota: 'nunca afirmamos "o Full causou X%": sem experimento ou grupo de controle, isto é tendência observada, não causa.' };
  }

  return { CONTRATOS, coberturaFonte, crossKey, motorCruzamento, analises, fullIntelligence, skuIndex };

  function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('pt-BR'); }
  function pctTxt(v) { return v == null ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }
}));

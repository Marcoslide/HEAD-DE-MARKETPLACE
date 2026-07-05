/* =============================================================
   HEAD MARKETPLACE OS · v8 — IMPORT & SYNC ENGINE (UMD) · 10.I
   Porta de entrada de dados reais. Princípio central:
   IMPORTAÇÃO NÃO SOMA DADOS — CONCILIA, ATUALIZA, VERSIONA E EXPLICA.
   Perfis por assinatura de cabeçalho (nunca hardcode de uma empresa),
   fingerprint de arquivo, staging, chaves naturais, granularidade,
   deduplicação, sobreposição de período, vínculo por SKU, Anúncio
   Master e rollback por lote. Roda em Node (testes) e no navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8IMP = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOJE = '2026-07-04';
  /* hash determinístico (FNV-1a) — sem dado sensível, sem crypto */
  const hash = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return 'h' + h.toString(16); };

  const GRANULARIDADES = ['TRANSACTIONAL', 'STATE_SNAPSHOT', 'DAILY_METRIC', 'PERIOD_METRIC', 'PRODUCT_METRIC',
    'LISTING_METRIC', 'PROMOTION_METRIC', 'CHANNEL_ATTRIBUTION', 'FINANCIAL_SUMMARY', 'SERVICE_METRIC'];
  const FONTES = ['IMPORTACAO_MANUAL', 'PLANILHA_SHOPEE', 'PLANILHA_MERCADO_LIVRE', 'PLANILHA_TIKTOK',
    'PLANILHA_MAGALU', 'CSV_CUSTOMIZADO', 'API_OFICIAL', 'NORMALIZED_INTERNAL_DATA', 'DEMO_FIXTURE'];
  const JOB_ESTADOS = ['ARQUIVO_ENVIADO', 'EM_DETECÇÃO', 'AGUARDANDO_MAPEAMENTO', 'EM_STAGING', 'AGUARDANDO_REVISÃO',
    'CONFLITO_ENCONTRADO', 'PRONTO_PARA_APLICAR', 'APLICANDO', 'APLICADO', 'APLICADO_PARCIALMENTE',
    'BLOQUEADO', 'CANCELADO', 'REVERTIDO', 'FALHOU'];
  const VINCULO = ['VÍNCULO CONFIRMADO POR ID', 'VÍNCULO CONFIRMADO POR SKU', 'VÍNCULO SUGERIDO POR SKU',
    'VÍNCULO SUGERIDO POR NOME', 'CONFLITO DE SKU', 'SKU AUSENTE', 'SEM CORRESPONDÊNCIA', 'REVISÃO HUMANA NECESSÁRIA',
    'VÍNCULO DESATIVADO'];
  const MASTER_ESTADOS = ['MASTER SUGERIDO', 'MASTER CONFIRMADO MANUALMENTE', 'MASTER DEFINIDO POR REGRA',
    'MASTER BLOQUEADO POR CONFLITO', 'SEM MASTER DEFINIDO'];

  /* ---------------- perfis de importação (assinaturas, nunca hardcode) ---------------- */
  const P = (status, marketplace, gran, destino, assinatura, chave) => ({ status, marketplace, gran, destino, assinatura, chave });
  const PROFILES = {
    SHOPEE_PRODUCT_TRAFFIC: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'performance',
      ['ID do Item', 'Impressões de Produto', 'Cliques por Produto', 'Taxa de Conversão de Pedidos'], 'item_period'),
    SHOPEE_PRODUCT_OVERVIEW: P('SUPPORTED', 'shopee', 'LISTING_METRIC', 'performance',
      ['ID do Item', 'Visitantes do Produto', 'Pedidos Pagos', 'Vendas de Pedidos Pagos'], 'item_period'),
    SHOPEE_SALES_OVERVIEW: P('SUPPORTED', 'shopee', 'DAILY_METRIC', 'funil',
      ['Data', 'Visitantes', 'Pedidos Feitos', 'Pedidos Pagos', 'Vendas de Pedidos Pagos'], 'day_metric'),
    SHOPEE_SHOP_STATS: P('SUPPORTED', 'shopee', 'DAILY_METRIC', 'trafego',
      ['Visualizações da Página', 'Taxa de Devolução / Rejeição', 'Novos Visitantes'], 'day_metric'),
    SHOPEE_PROMOTION_SUMMARY: P('SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Nome da promoção', 'Tipo de promoção', 'Vendas de Pedidos Pagos'], 'promotion_period'),
    SHOPEE_PROMOTION_DETAIL: P('PARTIALLY_SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Nome da promoção', 'Itens principais', 'Combos'], 'promotion_period'),
    SHOPEE_VOUCHER: P('SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'cupons',
      ['Nome do Cupom', 'Código', 'Resgates', 'Vendas Pagas'], 'voucher_period'),
    SHOPEE_FLASH_SALE: P('PARTIALLY_SUPPORTED', 'shopee', 'PROMOTION_METRIC', 'promocoes',
      ['Flash Sale', 'Período', 'Vendas'], 'promotion_period'),
    SHOPEE_HOT_LISTING: P('REFERENCE_ONLY', 'shopee', 'LISTING_METRIC', 'performance',
      ['Hot Listing'], 'item_period'),
    SHOPEE_PARENT_SKU: P('SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['ID do Item', 'Nome do Produto', 'SKU Pai', 'SKU da variação', 'Preço', 'Estoque'], 'item_state'),
    SHOPEE_PRODUCT_BASIC_INFO: P('PARTIALLY_SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['ID do Item', 'Nome do Produto', 'Descrição'], 'item_state'),
    SHOPEE_PRODUCT_DIAGNOSTICS: P('REFERENCE_ONLY', 'shopee', 'STATE_SNAPSHOT', 'catalogo',
      ['Diagnóstico', 'ID do Item'], 'item_state'),
    /* 10.E.2 — chat vira SUPPORTED com assinatura do export real (nunca conversa privada, só métricas) */
    SHOPEE_CHAT_FAQ: P('SUPPORTED', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Data', 'Perguntas recebidas', 'Perguntas respondidas', 'Taxa de resposta'], 'day_metric'),
    SHOPEE_AI_ASSISTANT: P('REFERENCE_ONLY', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Perguntas transferidas ao vendedor'], 'day_metric'),
    SHOPEE_FINANCIAL_REFERENCE: P('REFERENCE_ONLY', 'shopee', 'FINANCIAL_SUMMARY', 'financeiro',
      ['Comissão', 'Repasse'], 'period_metric'),
    SHOPEE_CHANNEL_CONTRIBUTION: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'atribuicao',
      ['Vendas pelos Cards dos Produtos', 'Vendas pelas Lives', 'Vendas pelo Afiliado', 'Vendas pelos Anúncios'], 'period_metric'),
    CUSTOM_CSV_MAPPING: P('PARTIALLY_SUPPORTED', null, null, 'custom', [], 'custom'),
    /* ---------- 10.E.2 · fontes reais por área ---------- */
    SHOPEE_ORDERS: P('SUPPORTED', 'shopee', 'TRANSACTIONAL', 'pedidos',
      ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Valor Total'], 'order'),
    SHOPEE_RETURN_REFUND: P('SUPPORTED', 'shopee', 'TRANSACTIONAL', 'devolucoes',
      ['ID do pedido', 'Tipo de evento', 'ID do evento', 'Valor reembolsado'], 'order_event'),
    SHOPEE_INVENTORY: P('SUPPORTED', 'shopee', 'STATE_SNAPSHOT', 'estoque',
      ['SKU', 'Armazém', 'Disponível', 'Reservado'], 'stock_snapshot'),
    SHOPEE_AFFILIATE_PERFORMANCE: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'afiliados',
      ['Afiliado', 'Cliques', 'Vendas do Afiliado', 'Comissão'], 'period_metric'),
    SHOPEE_TRAFFIC_OVERVIEW: P('SUPPORTED', 'shopee', 'PERIOD_METRIC', 'trafego_visao',
      ['Visitantes', 'Visualizações da Página', 'Taxa de Rejeição', 'Período'], 'period_metric'),
  };

  /* ---------------- detecção por assinatura ---------------- */
  function detect(file) {
    let best = null, bestScore = 0;
    const headers = (file.abas && file.abas[0] && file.abas[0].headers) || [];
    for (const [nome, p] of Object.entries(PROFILES)) {
      if (!p.assinatura.length) continue;
      const acertos = p.assinatura.filter(h => headers.includes(h)).length;
      const score = acertos / p.assinatura.length;
      if (score > bestScore) { bestScore = score; best = nome; }
    }
    if (!best || bestScore < 0.75)
      return { perfil: 'UNKNOWN', status: 'UNSUPPORTED', confianca: 0, motivo: 'assinatura de cabeçalho não reconhecida — mapeie manualmente antes de importar' };
    const p = PROFILES[best];
    return { perfil: best, status: p.status, marketplace: p.marketplace, granularidade: p.gran,
      destino: p.destino, confianca: Math.round(bestScore * 100) / 100, periodo: file.periodo || null };
  }

  function fingerprintFile(file) {
    const content = JSON.stringify(file.abas);
    return {
      file_hash: hash(file.nome + '|' + content),
      content_hash: hash(content),
      sheet_signature: hash((file.abas || []).map(a => a.nome + ':' + (a.headers || []).join(',')).join('|')),
    };
  }

  /* ---------------- permissões de importação (sobre os papéis do 10.V) ---------------- */
  const IMPORT_PERMS = {
    OWNER: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY', 'IMPORT_ROLLBACK', 'IMPORT_MAPPING_MANAGE', 'MASTER_LISTING_APPROVE'],
    ADMIN: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY', 'IMPORT_MAPPING_MANAGE'],
    HEAD_MARKETPLACE: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW', 'IMPORT_APPLY'],
    GESTOR_COMERCIAL: ['IMPORT_VIEW', 'IMPORT_REVIEW'],
    GESTOR_OPERACIONAL: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW'],
    CATALOGO: ['IMPORT_VIEW', 'IMPORT_CREATE', 'IMPORT_REVIEW'],
    FINANCEIRO: ['IMPORT_VIEW'], EXPEDICAO: ['IMPORT_VIEW'], DESIGNER: [], CONSULTOR: ['IMPORT_VIEW'], LEITURA: ['IMPORT_VIEW'],
  };
  const canImp = (papel, perm) => (IMPORT_PERMS[papel] || []).includes(perm);

  /* ---------------- engine ---------------- */
  function createEngine() {
    return { batches: [], staging: [], snapshots: [], observations: [], masterLinks: [], conflicts: [], audit: [],
      fileHashes: new Map(), seq: 0,
      /* 10.E.2 — camada bruta preservada + linhas com erro (nenhuma coluna descartada silenciosamente) */
      rawFiles: [], rawErrors: [] };
  }
  const audit = (eng, acao, detalhe, extra) => eng.audit.push(Object.assign({ id: 'ia' + (++eng.seq), acao, detalhe, em: HOJE }, extra || {}));

  /* chaves naturais (contrato do sprint) */
  const KEYS = {
    order: r => ['ord', r.marketplace, r.contaId, r.external_order_id].join('|'),
    listing: r => ['lst', r.marketplace, r.contaId, r.item_id].join('|'),
    product: r => ['prd', r.companyId, r.sku_pai, r.sku_variacao || ''].join('|'),
    daily_item: r => ['dmi', r.marketplace, r.contaId, r.item_id, r.data, r.metric_type].join('|'),
    daily: r => ['dm', r.marketplace, r.contaId, r.data, r.metric_type].join('|'),
    period: r => ['pm', r.marketplace, r.contaId, r.item_id || '-', r.periodo_ini, r.periodo_fim, r.metric_type].join('|'),
    promotion: r => ['pro', r.marketplace, r.contaId, r.promotion_name, r.periodo_ini, r.periodo_fim].join('|'),
    voucher: r => ['vou', r.marketplace, r.contaId, r.voucher_code, r.periodo_ini, r.periodo_fim].join('|'),
    batch: f => ['imp', f.file_hash, f.sheet_signature].join('|'),
    /* 10.E.2 — chaves do contrato: evento de devolução/reembolso/cancelamento e leitura de estoque */
    event: r => ['evt', r.marketplace, r.contaId, r.external_order_id, r.tipo_evento, r.event_id || '-'].join('|'),
    stock: r => ['stk', r.marketplace, r.contaId, r.armazem, r.sku_ref, r.momento].join('|'),
  };
  function naturalKey(gran, r) {
    /* PEDIDOS: marketplace + conta + ID do pedido = pedido único (nunca duplica) */
    if (r.metric_type === 'pedidos' && gran === 'TRANSACTIONAL') return KEYS.order(r);
    /* DEVOLUÇÃO/REEMBOLSO/CANCELAMENTO: + tipo + ID do evento quando existir */
    if (r.metric_type === 'devolucoes') return KEYS.event(r);
    /* ESTOQUE: + armazém + SKU + momento da leitura (cada leitura é um snapshot novo) */
    if (r.metric_type === 'estoque') return KEYS.stock(r);
    if (gran === 'DAILY_METRIC') return r.item_id ? KEYS.daily_item(r) : KEYS.daily(r);
    if (gran === 'PROMOTION_METRIC') return r.voucher_code ? KEYS.voucher(r) : KEYS.promotion(r);
    if (gran === 'STATE_SNAPSHOT') return KEYS.listing(r);
    if (gran === 'CHANNEL_ATTRIBUTION' || gran === 'FINANCIAL_SUMMARY') return KEYS.period({ ...r, metric_type: r.metric_type || gran });
    return KEYS.period(r); /* LISTING_METRIC / PERIOD_METRIC / PRODUCT_METRIC / SERVICE_METRIC */
  }

  /* vínculo de listing na ordem obrigatória: ID → SKU variação → SKU pai → nome */
  function linkRow(row, escopo, products, existingObs) {
    const porId = existingObs.find(o => o.marketplace === escopo.marketplace && o.contaId === escopo.contaId && o.item_id === row['ID do Item']);
    if (porId) return { estado: 'VÍNCULO CONFIRMADO POR ID', produtoId: porId.produtoId, confianca: 'alta' };
    const skuVar = row['SKU da variação'], skuPai = row['SKU Pai'] || row['SKU de referência'];
    if (skuVar || skuPai) {
      const matches = products.filter(p => (skuVar && p.sku === skuVar) || (skuPai && p.sku === skuPai));
      if (matches.length === 1)
        return { estado: 'VÍNCULO CONFIRMADO POR SKU', produtoId: matches[0].id, confianca: 'alta', via: skuVar && matches[0].sku === skuVar ? 'variação' : 'pai' };
      if (matches.length > 1)
        return { estado: 'CONFLITO DE SKU', produtoId: null, confianca: 'nula', motivo: `SKU aponta para ${matches.length} produtos — revisão humana necessária` };
    }
    const nome = row['Nome do Produto'] || row['Produto'];
    if (nome) {
      const tok = s => s.toLowerCase().replace(/[^\wà-ü]+/g, ' ').split(/\s+/).filter(w => w.length > 2);
      const t = tok(nome);
      let best = null, bestN = 0;
      for (const p of products) {
        const n = t.filter(x => tok(p.nome).includes(x)).length;
        if (n > bestN) { bestN = n; best = p; }
      }
      if (best && bestN >= 3) return { estado: 'VÍNCULO SUGERIDO POR NOME', produtoId: best.id, confianca: 'baixa', motivo: 'nome similar — nunca vincula automaticamente' };
    }
    return { estado: (skuVar || skuPai) ? 'SEM CORRESPONDÊNCIA' : 'SKU AUSENTE', produtoId: null, confianca: 'nula' };
  }

  /* separação demo × real (contrato do 10.V vale aqui) */
  function assertNoDemoMix(escopo, sourceType) {
    if (sourceType === 'DEMO_FIXTURE' && escopo.tipoDado === 'DADOS REAIS')
      throw new Error('dado demonstrativo não pode ser importado para empresa real — separação demo × real é absoluta');
    if (sourceType !== 'DEMO_FIXTURE' && escopo.tipoDado === 'DEMO')
      throw new Error('planilha real não pode ser importada para a árvore de demonstração');
    return true;
  }

  /* ---------------- staging ---------------- */
  function stage(eng, file, escopo, opts) {
    opts = opts || {};
    for (const k of ['companyId', 'lojaId', 'contaId', 'marketplace'])
      if (!escopo[k]) throw new Error('escopo incompleto: falta ' + k + ' — importação exige Grupo→Empresa→CNPJ→Loja→Conta');
    assertNoDemoMix(escopo, file.sourceType || 'PLANILHA_SHOPEE');

    /* 10.E.2 — ZIP: extração acontece NO STAGING; só entradas reconhecidas viram lote,
       o resto é declarado como ignorado (nunca finge importar) */
    if (file.zip) {
      const batches = [], ignorados = [];
      for (const ent of (file.entries || [])) {
        if (ent.abas && ent.abas.length && ent.abas[0].headers && ent.abas[0].headers.length) {
          const child = { nome: file.nome + '::' + ent.nome, sourceType: file.sourceType, periodo: ent.periodo || file.periodo || null, abas: ent.abas };
          batches.push(stage(eng, child, escopo, opts));
        } else ignorados.push({ nome: ent.nome, motivo: ent.motivo || 'entrada não reconhecida como planilha (XLSX/CSV) — mantida no arquivo original, não importada' });
      }
      audit(eng, 'zip_extraido_no_staging', `${file.nome}: ${batches.length} entrada(s) reconhecida(s), ${ignorados.length} ignorada(s)`);
      return { zip: true, arquivo: file.nome, batches, ignorados,
        nota: 'ZIP extraído em staging — cada planilha reconhecida virou um lote próprio com confirmação humana.' };
    }
    const fp = fingerprintFile(file);
    const det = detect(file);
    const batchKey = KEYS.batch({ ...fp });
    if (eng.fileHashes.has(batchKey)) {
      const prev = eng.fileHashes.get(batchKey);
      audit(eng, 'arquivo_duplicado_recusado', file.nome + ' já importado no lote ' + prev);
      return { duplicado: true, estado: 'BLOQUEADO', motivo: 'ARQUIVO JÁ IMPORTADO — nenhum dado novo será aplicado. Revise a importação anterior (' + prev + ').', batchAnterior: prev };
    }
    const batch = {
      id: 'imp' + (++eng.seq), arquivo: file.nome, fp, det, escopo: { ...escopo },
      sourceType: file.sourceType || 'PLANILHA_SHOPEE', periodo: file.periodo || null,
      estado: 'EM_DETECÇÃO', enviadoPor: opts.usuario || 'Marcos', em: HOJE,
      mappingVersion: 'v1', linhas: 0, preview: null, aplicado: null,
    };
    eng.batches.push(batch);
    /* camada bruta: TODAS as abas, colunas e linhas do arquivo original ficam preservadas */
    eng.rawFiles.push({ batchId: batch.id, nome: file.nome, tamanho: file.tamanho || null, formato: file.formato || null,
      abas: (file.abas || []).map(a => ({ nome: a.nome, headers: (a.headers || []).slice(), rows: (a.rows || []).slice() })),
      colunas: (file.abas && file.abas[0] && file.abas[0].headers || []).length, em: HOJE });
    audit(eng, 'arquivo_enviado', file.nome, { batchId: batch.id, escopo: batch.escopo });

    if (det.perfil === 'UNKNOWN') {
      batch.estado = 'AGUARDANDO_MAPEAMENTO';
      batch.preview = { perfil: 'UNKNOWN', motivo: det.motivo, aplicavel: false };
      return batch;
    }
    if (PROFILES[det.perfil].status === 'REFERENCE_ONLY' || PROFILES[det.perfil].status === 'UNSUPPORTED') {
      batch.estado = 'BLOQUEADO';
      batch.preview = { perfil: det.perfil, status: PROFILES[det.perfil].status, aplicavel: false,
        motivo: 'perfil ' + PROFILES[det.perfil].status + ' — o sistema não finge importar o que ainda não entende' };
      return batch;
    }

    /* staging linha a linha com proveniência completa */
    const rows = file.abas[0].rows || [];
    const gran = det.granularidade;
    const products = opts.products || [];
    let vincConfirmadoId = 0, vincConfirmadoSku = 0, vincSugerido = 0, conflitos = 0, semMatch = 0, pendentes = 0, linhasComErro = 0;
    const stagingRows = [];
    rows.forEach((r, i) => {
      /* linha sem chave obrigatória NÃO é descartada em silêncio: vai para "linhas com erro" com motivo */
      const semChave = det.destino === 'pedidos' && !r['ID do pedido'] ? 'ID do pedido ausente'
        : det.destino === 'devolucoes' && !r['ID do pedido'] ? 'ID do pedido ausente no evento'
        : det.destino === 'estoque' && !(r['SKU'] && r['Armazém']) ? 'SKU/Armazém ausente' : null;
      if (semChave) {
        linhasComErro++;
        eng.rawErrors.push({ batchId: batch.id, linha: i + 1, motivo: semChave, raw: r, arquivo: file.nome });
        return;
      }
      const base = {
        batchId: batch.id, linha: i + 1, raw: r,
        groupId: escopo.groupId || null, companyId: escopo.companyId, cnpjId: escopo.cnpjId || null,
        lojaId: escopo.lojaId, marketplace: escopo.marketplace, contaId: escopo.contaId,
        sourceType: batch.sourceType, sourceFile: file.nome, sourceSheet: file.abas[0].nome, sourceRow: i + 1,
        reportType: det.perfil, periodo_ini: (file.periodo || {}).ini || r['Data'] || null,
        periodo_fim: (file.periodo || {}).fim || r['Data'] || null,
        importadoEm: HOJE, mappingVersion: batch.mappingVersion,
        rawFingerprint: hash(JSON.stringify(r)), granularidade: gran, confianca: det.confianca,
      };
      /* 10.E.2 — campos por destino */
      if (det.destino === 'pedidos') {
        base.external_order_id = String(r['ID do pedido']);
        base.data = r['Data de criação do pedido'] || null;
      } else if (det.destino === 'devolucoes') {
        base.external_order_id = String(r['ID do pedido']);
        base.tipo_evento = r['Tipo de evento'] || 'DEVOLUÇÃO';
        base.event_id = r['ID do evento'] != null ? String(r['ID do evento']) : null;
      } else if (det.destino === 'estoque') {
        base.armazem = r['Armazém']; base.sku_ref = r['SKU'];
        base.momento = r['Momento da leitura'] || file.momento || ((file.periodo || {}).fim) || HOJE;
      } else if (gran === 'CHANNEL_ATTRIBUTION') {
        base.item_id = r['ID do Item'] || r['Afiliado'] || null;
      }
      if ((gran === 'STATE_SNAPSHOT' || gran === 'LISTING_METRIC') && det.destino !== 'estoque') {
        base.item_id = r['ID do Item'];
        const v = linkRow(r, escopo, products, eng.observations);
        base.vinculo = v;
        if (v.estado === 'VÍNCULO CONFIRMADO POR ID') vincConfirmadoId++;
        else if (v.estado === 'VÍNCULO CONFIRMADO POR SKU') vincConfirmadoSku++;
        else if (v.estado === 'VÍNCULO SUGERIDO POR NOME') { vincSugerido++; pendentes++; }
        else if (v.estado === 'CONFLITO DE SKU') { conflitos++; pendentes++; }
        else { semMatch++; if (gran === 'STATE_SNAPSHOT') pendentes++; }
      }
      if (gran === 'DAILY_METRIC') base.data = r['Data'];
      if (gran === 'PROMOTION_METRIC') { base.promotion_name = r['Nome da promoção']; base.voucher_code = r['Código']; }
      base.metric_type = det.destino;
      base.normalizedFingerprint = hash(naturalKey(gran, base) + '|' + JSON.stringify(r));
      stagingRows.push(base);
    });
    eng.staging.push(...stagingRows);
    batch.linhas = stagingRows.length;

    /* conciliação: o que já existe, o que sobrepõe */
    let jaExistem = 0, sobreposicao = null;
    for (const s of stagingRows) {
      const k = naturalKey(gran, s);
      if (eng.snapshots.some(x => x.key === k)) jaExistem++;
    }
    if (file.periodo && (gran === 'LISTING_METRIC' || gran === 'PERIOD_METRIC' || gran === 'DAILY_METRIC')) {
      const overlaps = eng.snapshots.filter(x => x.escopo && x.escopo.contaId === escopo.contaId && x.granularidade !== gran &&
        x.periodo_ini && x.periodo_fim && !(x.periodo_fim < file.periodo.ini || x.periodo_ini > file.periodo.fim));
      const same = eng.batches.filter(b => b.id !== batch.id && b.aplicado && b.det.perfil !== det.perfil && b.periodo &&
        !(b.periodo.fim < file.periodo.ini || b.periodo.ini > file.periodo.fim));
      const prevSame = eng.batches.filter(b => b.id !== batch.id && b.aplicado && b.det.perfil === det.perfil && b.periodo &&
        !(b.periodo.fim < file.periodo.ini || b.periodo.ini > file.periodo.fim));
      if (prevSame.length || overlaps.length || same.length) {
        const p = prevSame[0] || {};
        sobreposicao = {
          aviso: prevSame.length ? `importação anterior (${p.id}) cobre parte do mesmo período — linhas idênticas serão atualizadas, nunca somadas`
            : 'há métricas de outra granularidade cobrindo o mesmo intervalo — não serão somadas entre si',
          periodoAnterior: p.periodo || null,
          intervaloSobreposto: p.periodo ? { ini: p.periodo.ini > file.periodo.ini ? p.periodo.ini : file.periodo.ini, fim: p.periodo.fim < file.periodo.fim ? p.periodo.fim : file.periodo.fim } : null,
        };
      }
    }

    batch.preview = {
      perfil: det.perfil, tipo: det.destino, marketplace: det.marketplace, granularidade: gran,
      periodo: file.periodo || null, registros: stagingRows.length,
      vinculosPorId: vincConfirmadoId, vinculosPorSku: vincConfirmadoSku, sugeridosPorNome: vincSugerido,
      pendentesRevisao: pendentes, conflitos, semCorrespondencia: semMatch, jaExistem, sobreposicao, linhasComErro,
      aplicavel: true, acoes: ['Importar apenas itens novos', 'Atualizar registros existentes', 'Revisar conflitos', 'Salvar como rascunho', 'Cancelar'],
    };
    batch.estado = conflitos ? 'CONFLITO_ENCONTRADO' : 'AGUARDANDO_REVISÃO';
    eng.fileHashes.set(batchKey, batch.id);
    audit(eng, 'staging_concluido', `${batch.id}: ${stagingRows.length} linha(s), ${conflitos} conflito(s), ${jaExistem} já existente(s)`);
    return batch;
  }

  /* ---------------- aplicação (idempotente, nunca soma) ---------------- */
  function apply(eng, batchId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'IMPORT_APPLY'))
      return { blocked: true, reason: `papel ${opts.papel} não possui IMPORT_APPLY — peça a um ADMIN/OWNER` };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) throw new Error('lote não encontrado');
    if (!batch.preview || !batch.preview.aplicavel)
      return { blocked: true, reason: 'lote não aplicável: ' + (batch.preview ? batch.preview.motivo : 'sem prévia') };
    batch.estado = 'APLICANDO';
    const rows = eng.staging.filter(s => s.batchId === batchId);
    let criados = 0, atualizados = 0, ignorados = 0, duplicadosEvitados = 0, conflitosPulados = 0;
    for (const s of rows) {
      if (s.vinculo && s.vinculo.estado === 'CONFLITO DE SKU') {
        conflitosPulados++;
        if (!eng.conflicts.some(c => c.item_id === s.item_id && c.batchId === batchId))
          eng.conflicts.push({ id: 'cf' + (++eng.seq), batchId, item_id: s.item_id, motivo: s.vinculo.motivo, estado: 'REVISÃO HUMANA NECESSÁRIA' });
        continue;
      }
      const key = naturalKey(s.granularidade, s);
      const existing = eng.snapshots.find(x => x.key === key);
      if (existing) {
        if (existing.normalizedFingerprint === s.normalizedFingerprint) { duplicadosEvitados++; continue; } /* idêntico → nada */
        existing.versoes.push({ raw: existing.raw, batchId: existing.batchId, em: existing.atualizadoEm }); /* preserva versão */
        existing.raw = s.raw; existing.batchId = batchId; existing.normalizedFingerprint = s.normalizedFingerprint;
        existing.atualizadoEm = HOJE; existing.origem = origemDe(s.sourceType);
        atualizados++; continue; /* ATUALIZA, nunca soma */
      }
      /* granularidade agregada NUNCA cria pedido individual;
         evento de devolução/cancelamento NUNCA cria pedido novo — vira order_event cruzado por ID */
      const snap = {
        id: 'ms' + (++eng.seq), key,
        entidade: s.metric_type === 'devolucoes' ? 'order_event'
          : s.granularidade === 'TRANSACTIONAL' ? 'order' : 'metric_snapshot',
        granularidade: s.granularidade, explicativa: ['CHANNEL_ATTRIBUTION', 'PROMOTION_METRIC', 'FINANCIAL_SUMMARY'].includes(s.granularidade),
        raw: s.raw, item_id: s.item_id || null, data: s.data || null,
        external_order_id: s.external_order_id || null, tipo_evento: s.tipo_evento || null, event_id: s.event_id || null,
        armazem: s.armazem || null, sku_ref: s.sku_ref || null, momento: s.momento || null,
        periodo_ini: s.periodo_ini, periodo_fim: s.periodo_fim, metric_type: s.metric_type,
        escopo: { companyId: s.companyId, cnpjId: s.cnpjId, lojaId: s.lojaId, contaId: s.contaId, marketplace: s.marketplace },
        sourceType: s.sourceType, sourceFile: s.sourceFile, reportType: s.reportType,
        origem: origemDe(s.sourceType), batchId, importadoEm: HOJE, atualizadoEm: HOJE,
        normalizedFingerprint: s.normalizedFingerprint, confianca: s.confianca, versoes: [],
      };
      eng.snapshots.push(snap);
      criados++;
      /* listing observado + candidato a master link */
      if ((s.granularidade === 'STATE_SNAPSHOT' || s.granularidade === 'LISTING_METRIC') && s.item_id) {
        let obs = eng.observations.find(o => o.marketplace === s.marketplace && o.contaId === s.contaId && o.item_id === s.item_id);
        if (!obs) {
          obs = { id: 'lo' + (++eng.seq), item_id: s.item_id, marketplace: s.marketplace, contaId: s.contaId, lojaId: s.lojaId,
            nome: s.raw['Nome do Produto'] || s.raw['Produto'] || 'item ' + s.item_id,
            skuPai: s.raw['SKU Pai'] || null, skuVariacao: s.raw['SKU da variação'] || null,
            status: s.raw['Status Atual do Item'] || null,
            produtoId: s.vinculo ? s.vinculo.produtoId : null, vinculo: s.vinculo ? s.vinculo.estado : 'SKU AUSENTE',
            vendasPagas: +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas'] || 0,
            unidadesPagas: +s.raw['Unidades Pagas'] || +s.raw['Unidades'] || 0,
            conversao: +s.raw['Taxa de Conversão de Pedidos'] || null, ctr: +s.raw['CTR'] || null,
            origem: origemDe(s.sourceType), batchId, master: 'SEM MASTER DEFINIDO' };
          eng.observations.push(obs);
        } else {
          if (+s.raw['Vendas'] || +s.raw['Vendas de Pedidos Pagos']) obs.vendasPagas = +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas'] || obs.vendasPagas;
          if (s.raw['CTR']) obs.ctr = +s.raw['CTR'];
          if (s.vinculo && s.vinculo.produtoId && !obs.produtoId) { obs.produtoId = s.vinculo.produtoId; obs.vinculo = s.vinculo.estado; }
        }
      }
    }
    batch.aplicado = { criados, atualizados, ignorados, duplicadosEvitados, conflitos: conflitosPulados,
      aprovadoPor: opts.usuario || 'Marcos', em: HOJE };
    batch.estado = conflitosPulados ? 'APLICADO_PARCIALMENTE' : 'APLICADO';
    audit(eng, 'lote_aplicado', `${batchId}: ${criados} criado(s), ${atualizados} atualizado(s), ${duplicadosEvitados} duplicado(s) evitado(s), ${conflitosPulados} conflito(s) pulado(s)`,
      { batchId, escopo: batch.escopo, perfil: batch.det.perfil, mappingVersion: batch.mappingVersion });
    return { job: batch };
  }
  const origemDe = st => st === 'API_OFICIAL' ? 'DADO REAL VIA API' : st === 'DEMO_FIXTURE' ? 'DADO SIMULADO' : 'DADO IMPORTADO VIA PLANILHA';

  /* ---------------- rollback por lote (preserva o que veio depois) ---------------- */
  function rollback(eng, batchId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'IMPORT_ROLLBACK'))
      return { blocked: true, reason: `papel ${opts.papel} não possui IMPORT_ROLLBACK` };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch || !batch.aplicado) return { blocked: true, reason: 'lote não aplicado — nada a reverter' };
    let removidos = 0, preservados = 0, restaurados = 0;
    eng.snapshots = eng.snapshots.filter(snap => {
      if (snap.batchId === batchId) {
        const anterior = snap.versoes.length ? snap.versoes[snap.versoes.length - 1] : null;
        if (anterior && anterior.batchId !== batchId) {
          snap.raw = anterior.raw; snap.batchId = anterior.batchId; snap.versoes.pop(); restaurados++;
          return true;
        }
        removidos++; return false;
      }
      /* registro atualizado por lote POSTERIOR não pode ser apagado */
      if (snap.versoes.some(v => v.batchId === batchId)) {
        snap.versoes = snap.versoes.filter(v => v.batchId !== batchId);
        preservados++;
      }
      return true;
    });
    eng.observations = eng.observations.filter(o => o.batchId !== batchId);
    batch.estado = 'REVERTIDO';
    audit(eng, 'lote_revertido', `${batchId}: ${removidos} removido(s), ${restaurados} restaurado(s) à versão anterior, ${preservados} posterior(es) preservado(s)`, { batchId });
    return { removidos, restaurados, preservados };
  }

  /* ---------------- receita consolidada: nunca conta duas vezes ---------------- */
  function receitaConsolidada(eng, escopo) {
    /* só o funil de vendas conta como receita; atribuição/promoção/cupom/financeiro EXPLICAM */
    let receita = 0; const explicacoes = [];
    for (const s of eng.snapshots) {
      if (escopo && escopo.contaId && s.escopo.contaId !== escopo.contaId) continue;
      const v = +s.raw['Vendas de Pedidos Pagos'] || +s.raw['Vendas Pagas'] || 0;
      if (s.explicativa) { if (v || s.granularidade === 'CHANNEL_ATTRIBUTION') explicacoes.push({ tipo: s.granularidade, fonte: s.reportType, valor: v || null }); continue; }
      if (s.granularidade === 'DAILY_METRIC' && s.metric_type === 'funil') receita += v;
    }
    return { receita: Math.round(receita * 100) / 100, explicacoes, nota: 'atribuição, promoção, cupom e financeiro explicam a receita — nunca somam de novo' };
  }

  /* ---------------- Anúncio Master ---------------- */
  function suggestMaster(eng, produtoId) {
    const list = eng.observations.filter(o => o.produtoId === produtoId &&
      ['VÍNCULO CONFIRMADO POR SKU', 'VÍNCULO CONFIRMADO POR ID'].includes(o.vinculo));
    if (!list.length) return { estado: 'SEM MASTER DEFINIDO', motivo: 'nenhum anúncio com vínculo confiável de SKU' };
    if (eng.conflicts.some(c => list.some(o => o.item_id === c.item_id) && c.estado !== 'RESOLVIDO'))
      return { estado: 'MASTER BLOQUEADO POR CONFLITO', motivo: 'há conflito de SKU aberto neste produto' };
    /* prioridade: vendas pagas → unidades → conversão → CTR → status saudável */
    const rank = [...list].sort((a, b) =>
      (b.vendasPagas - a.vendasPagas) || (b.unidadesPagas - a.unidadesPagas) ||
      ((b.conversao || 0) - (a.conversao || 0)) || ((b.ctr || 0) - (a.ctr || 0)));
    const top = rank.find(o => !/bloquead|banido|deleted/i.test(o.status || '')) || rank[0];
    let link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link) { link = { id: 'ml' + (++eng.seq), produtoId, itemId: top.item_id, estado: 'MASTER SUGERIDO', criterio: 'vendas pagas validadas no período comparável', em: HOJE }; eng.masterLinks.push(link); }
    else if (link.estado === 'MASTER SUGERIDO') { link.itemId = top.item_id; }
    return { estado: link.estado, itemId: link.itemId, ranking: rank.map(o => ({ item_id: o.item_id, vendasPagas: o.vendasPagas, conversao: o.conversao, ctr: o.ctr })) };
  }
  function approveMaster(eng, produtoId, itemId, opts) {
    opts = opts || {};
    if (!canImp(opts.papel || 'OWNER', 'MASTER_LISTING_APPROVE'))
      return { blocked: true, reason: `papel ${opts.papel} não possui MASTER_LISTING_APPROVE` };
    let link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link) { link = { id: 'ml' + (++eng.seq), produtoId, em: HOJE }; eng.masterLinks.push(link); }
    link.itemId = itemId; link.estado = 'MASTER CONFIRMADO MANUALMENTE'; link.aprovadoPor = opts.usuario || 'Marcos';
    audit(eng, 'master_confirmado', `${produtoId} → item ${itemId} (manual)`);
    /* referência estratégica: NÃO existe função de sobrescrever preço/estoque/conteúdo de loja */
    return { link, nota: 'Anúncio Master é referência estratégica — não sobrescreve preço, estoque nem conteúdo de nenhuma loja.' };
  }

  /* cobertura por loja/conta (para Home, Conexões e Crescimento) */
  function coverage(eng) {
    const out = {};
    for (const b of eng.batches.filter(x => x.aplicado)) {
      const k = b.escopo.lojaId + '|' + b.escopo.contaId;
      if (!out[k]) out[k] = { lojaId: b.escopo.lojaId, contaId: b.escopo.contaId, marketplace: b.escopo.marketplace, fontes: [], periodos: [], ultima: null, linhas: 0, conflitos: 0, duplicadosEvitados: 0 };
      const c = out[k];
      if (!c.fontes.includes(b.det.perfil)) c.fontes.push(b.det.perfil);
      if (b.periodo) c.periodos.push(b.periodo);
      c.ultima = b.aplicado.em; c.linhas += b.aplicado.criados + b.aplicado.atualizados;
      c.conflitos += b.aplicado.conflitos; c.duplicadosEvitados += b.aplicado.duplicadosEvitados;
    }
    return Object.values(out);
  }

  /* =============================================================
     10.E.2 — PEDIDOS, ESTOQUE, EVENTOS, CORREÇÕES E MESA DE INTELIGÊNCIA
     Nenhuma análise apresenta número sem fonte. Nenhuma edição sem motivo.
     Nenhuma exclusão apaga a camada bruta.
     ============================================================= */

  /* ---------- permissões de dados (enforcement no motor, nunca só botão) ---------- */
  const DATA_PERMS_ALL = ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'DATA_SOURCE_EDIT_SCOPE', 'DATA_SOURCE_ARCHIVE',
    'DATA_SOURCE_ROLLBACK', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT', 'ORDER_EDIT_CORRECTION', 'ORDER_ARCHIVE',
    'PRODUCT_EDIT', 'MASTER_LINK_EDIT', 'METRIC_CORRECTION', 'INTELLIGENCE_VIEW'];
  const DATA_PERMS = {
    OWNER: DATA_PERMS_ALL.slice(),
    ADMIN: DATA_PERMS_ALL.slice(),
    HEAD_MARKETPLACE: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'DATA_SOURCE_EDIT_SCOPE', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT',
      'ORDER_EDIT_CORRECTION', 'PRODUCT_EDIT', 'MASTER_LINK_EDIT', 'METRIC_CORRECTION', 'INTELLIGENCE_VIEW'],
    GESTOR_COMERCIAL: ['DATA_SOURCE_VIEW', 'RAW_DATA_VIEW', 'INTELLIGENCE_VIEW'],
    GESTOR_OPERACIONAL: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'RAW_DATA_VIEW', 'ORDER_EDIT_CORRECTION', 'INTELLIGENCE_VIEW'],
    CATALOGO: ['DATA_SOURCE_VIEW', 'DATA_SOURCE_UPLOAD', 'RAW_DATA_VIEW', 'PRODUCT_EDIT', 'INTELLIGENCE_VIEW'],
    FINANCEIRO: ['DATA_SOURCE_VIEW', 'RAW_DATA_VIEW', 'RAW_DATA_EXPORT', 'INTELLIGENCE_VIEW'],
    EXPEDICAO: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
    DESIGNER: [],
    CONSULTOR: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
    LEITURA: ['DATA_SOURCE_VIEW', 'INTELLIGENCE_VIEW'],
  };
  const canData = (papel, perm) => (DATA_PERMS[papel] || []).includes(perm);
  const negar = (papel, perm) => ({ blocked: true, reason: `papel ${papel} não possui ${perm} — a barreira é no motor, não no botão` });

  /* ---------- pedidos: visão única por marketplace+conta+ID ---------- */
  const orderTab = st => {
    st = String(st || '');
    if (/não pago|nao pago/i.test(st)) return 'Não pagos';
    if (/a enviar|prepara/i.test(st)) return 'A enviar';
    if (/enviado|em rota|trânsito|transporte/i.test(st)) return 'Enviados';
    if (/concluíd|entregue/i.test(st)) return 'Concluídos';
    if (/cancelad/i.test(st)) return 'Cancelados';
    if (/falha/i.test(st)) return 'Falhas de Entrega';
    return 'Outros';
  };
  const cepProtegido = cep => cep == null ? null : (String(cep).replace(/\D/g, '').slice(0, 5) || '—') + '-***';

  function ordersView(eng, filtro) {
    filtro = filtro || {};
    const dentro = s => (!filtro.contaId || s.escopo.contaId === filtro.contaId) &&
      (!filtro.lojaId || s.escopo.lojaId === filtro.lojaId) &&
      (!filtro.marketplace || s.escopo.marketplace === filtro.marketplace);
    const eventos = eng.snapshots.filter(s => s.entidade === 'order_event' && dentro(s));
    const orders = eng.snapshots.filter(s => s.entidade === 'order' && s.metric_type === 'pedidos' && dentro(s)).map(snap => {
      const statusAtual = valorEfetivo(snap, 'Status do pedido');
      const evs = eventos.filter(e => e.escopo.marketplace === snap.escopo.marketplace &&
        e.escopo.contaId === snap.escopo.contaId && e.external_order_id === snap.external_order_id);
      return {
        key: snap.key, id: snap.external_order_id,
        marketplace: snap.escopo.marketplace, contaId: snap.escopo.contaId, lojaId: snap.escopo.lojaId, cnpjId: snap.escopo.cnpjId,
        produto: snap.raw['Nome do Produto'], sku: snap.raw['SKU de referência'] || snap.raw['Número de referência SKU'] || null,
        variacao: snap.raw['Nome da variação'] || null, quantidade: +snap.raw['Quantidade'] || null,
        valorTotal: +snap.raw['Valor Total'] || 0, frete: +snap.raw['Frete pago pelo comprador'] || 0,
        comissao: snap.raw['Taxa de comissão'] != null ? +snap.raw['Taxa de comissão'] : null,
        cidade: snap.raw['Cidade'] || null, estado: snap.raw['UF'] || null, cepParcial: cepProtegido(snap.raw['CEP']),
        comprador: snap.raw['Comprador'] || null, /* exibição exige RAW_DATA_VIEW — decisão na view, dado protegido */
        statusAtual, tab: orderTab(statusAtual),
        statusHistory: [...snap.versoes.map(v => ({ status: v.raw['Status do pedido'], em: v.em, batchId: v.batchId })),
          { status: snap.raw['Status do pedido'], em: snap.atualizadoEm, batchId: snap.batchId }],
        datas: { criacao: snap.raw['Data de criação do pedido'] || null, pagamento: snap.raw['Data de pagamento'] || null,
          envio: snap.raw['Data de envio'] || null, entrega: snap.raw['Data de entrega'] || null },
        eventos: evs.map(e => ({ tipo: e.tipo_evento, eventId: e.event_id, motivo: e.raw['Motivo'] || null,
          valor: +e.raw['Valor reembolsado'] || 0, situacao: e.raw['Status da solicitação'] || null, em: e.raw['Data'] || e.importadoEm })),
        origem: snap.origem, arquivo: snap.sourceFile, ultimaAtualizacao: snap.atualizadoEm,
        correcoes: snap.correcoes || [], excluido: snap.excluidoDaAnalise || null,
      };
    });
    const idsExistentes = new Set(orders.map(o => [o.marketplace, o.contaId, o.id].join('|')));
    const eventosOrfaos = eventos.filter(e => !idsExistentes.has([e.escopo.marketplace, e.escopo.contaId, e.external_order_id].join('|')))
      .map(e => ({ orderId: e.external_order_id, tipo: e.tipo_evento, eventId: e.event_id, arquivo: e.sourceFile,
        estado: 'SEM PEDIDO CORRESPONDENTE', nota: 'evento nunca cria pedido novo — aguarda a importação do pedido de origem' }));
    return { orders: filtro.incluirExcluidos ? orders : orders.filter(o => !o.excluido), eventosOrfaos,
      todos: orders };
  }

  /* conversão sempre com fórmula e denominador explícitos — nunca um % solto */
  function conversaoExplicita(numerador, denominador, formula) {
    if (numerador == null || denominador == null || denominador === 0)
      return { taxa: null, formula, motivo: 'denominador ausente — conversão não é exibida sem fórmula e base explícitas' };
    return { taxa: Math.round((numerador / denominador) * 10000) / 100, formula, numerador, denominador };
  }

  function orderStats(eng, filtro) {
    const v = ordersView(eng, filtro);
    const os = v.orders;
    const por = tab => os.filter(o => o.tab === tab).length;
    const pagos = os.filter(o => !['Não pagos', 'Cancelados'].includes(o.tab));
    const faturamento = Math.round(pagos.reduce((a, o) => a + o.valorTotal, 0) * 100) / 100;
    const naoPagoValor = Math.round(os.filter(o => o.tab === 'Não pagos').reduce((a, o) => a + o.valorTotal, 0) * 100) / 100;
    const devolucoes = os.filter(o => o.eventos.some(e => /devolu|reembolso/i.test(e.tipo))).length;
    const batches = eng.batches.filter(b => b.aplicado && b.det.destino === 'pedidos' && !b.arquivado);
    const fontes = batches.map(b => ({ arquivo: b.arquivo, perfil: b.det.perfil, periodo: b.periodo,
      linhas: b.linhas, ultima: b.aplicado.em, escopo: b.escopo,
      qualidade: { conflitos: b.aplicado.conflitos, duplicadosEvitados: b.aplicado.duplicadosEvitados,
        linhasComErro: (b.preview && b.preview.linhasComErro) || 0 } }));
    return {
      kpis: {
        pedidos: os.length, naoPagos: por('Não pagos'), aEnviar: por('A enviar'), enviados: por('Enviados'),
        concluidos: por('Concluídos'), cancelados: por('Cancelados'), devolucoes, falhasEntrega: por('Falhas de Entrega'),
        faturamentoAprovado: faturamento, valorNaoPago: naoPagoValor,
        ticketMedio: pagos.length ? Math.round((faturamento / pagos.length) * 100) / 100 : null,
        unidades: os.reduce((a, o) => a + (o.quantidade || 0), 0),
        cidades: new Set(os.map(o => o.cidade).filter(Boolean)).size,
        estados: new Set(os.map(o => o.estado).filter(Boolean)).size,
        taxaCancelamento: conversaoExplicita(por('Cancelados'), os.length, 'cancelados ÷ pedidos importados'),
      },
      fontes, cobertura: { contas: [...new Set(os.map(o => o.contaId))], lojas: [...new Set(os.map(o => o.lojaId))] },
      eventosOrfaos: v.eventosOrfaos,
      semDados: !os.length,
    };
  }

  /* análise geográfica — nunca expõe dado pessoal; prazo só quando as datas existem */
  function geoStats(eng, filtro, dim) {
    const os = ordersView(eng, filtro).orders;
    const grupos = {};
    for (const o of os) {
      const k = dim === 'cidade' ? (o.cidade || '—') + ' · ' + (o.estado || '—') : (o.estado || '—');
      const g = grupos[k] = grupos[k] || { chave: k, pedidos: 0, faturamento: 0, cancelados: 0, devolucoes: 0, prazos: [], porProduto: {} };
      g.pedidos++;
      if (!['Não pagos', 'Cancelados'].includes(o.tab)) g.faturamento += o.valorTotal;
      if (o.tab === 'Cancelados') g.cancelados++;
      if (o.eventos.some(e => /devolu|reembolso/i.test(e.tipo))) g.devolucoes++;
      if (o.datas.envio && o.datas.entrega) g.prazos.push((new Date(o.datas.entrega) - new Date(o.datas.envio)) / 86400000);
      if (o.produto) g.porProduto[o.produto] = (g.porProduto[o.produto] || 0) + 1;
    }
    return Object.values(grupos).map(g => ({
      chave: g.chave, pedidos: g.pedidos, faturamento: Math.round(g.faturamento * 100) / 100,
      ticket: g.pedidos ? Math.round((g.faturamento / g.pedidos) * 100) / 100 : null,
      produtoTop: Object.entries(g.porProduto).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || null,
      taxaCancelamento: conversaoExplicita(g.cancelados, g.pedidos, 'cancelados ÷ pedidos do local'),
      taxaDevolucao: conversaoExplicita(g.devolucoes, g.pedidos, 'pedidos com devolução ÷ pedidos do local'),
      prazoMedioDias: g.prazos.length ? Math.round((g.prazos.reduce((a, x) => a + x, 0) / g.prazos.length) * 10) / 10 : null,
      prazoNota: g.prazos.length ? `base: ${g.prazos.length} entrega(s) com data` : 'SEM DADOS de envio/entrega — prazo não inventado',
    })).sort((a, b) => b.faturamento - a.faturamento);
  }

  /* ---------- estoque: snapshot por armazém+SKU+momento; o mais recente é o atual ---------- */
  function stockView(eng, filtro) {
    filtro = filtro || {};
    const snaps = eng.snapshots.filter(s => s.metric_type === 'estoque' &&
      (!filtro.contaId || s.escopo.contaId === filtro.contaId) && !s.excluidoDaAnalise);
    const porChave = {};
    for (const s of snaps) {
      const k = [s.escopo.marketplace, s.escopo.contaId, s.armazem, s.sku_ref].join('|');
      (porChave[k] = porChave[k] || []).push(s);
    }
    const atual = [], historico = [];
    for (const lista of Object.values(porChave)) {
      lista.sort((a, b) => String(a.momento).localeCompare(String(b.momento)));
      const last = lista[lista.length - 1];
      atual.push({ sku: last.sku_ref, armazem: last.armazem, momento: last.momento,
        produto: last.raw['Nome do Produto'] || null,
        disponivel: +valorEfetivo(last, 'Disponível') || 0, reservado: +last.raw['Reservado'] || 0,
        emTransito: +last.raw['Em trânsito'] || 0, arquivo: last.sourceFile, leituras: lista.length });
      historico.push(...lista.map(s => ({ sku: s.sku_ref, armazem: s.armazem, momento: s.momento,
        disponivel: +s.raw['Disponível'] || 0, arquivo: s.sourceFile })));
    }
    return { atual, historico, nota: 'cada leitura é um snapshot novo — o histórico nunca é sobrescrito' };
  }

  /* ---------- correções e exclusões auditadas (original preservado SEMPRE) ---------- */
  function valorEfetivo(rec, campo) {
    const c = (rec.correcoes || []).filter(x => x.campo === campo);
    return c.length ? c[c.length - 1].depois : rec.raw[campo];
  }
  const permDe = rec => (rec.entidade === 'order' || rec.entidade === 'order_event') ? 'ORDER_EDIT_CORRECTION' : 'METRIC_CORRECTION';
  function findRec(eng, key) { return eng.snapshots.find(s => s.key === key); }

  function correct(eng, key, campo, depois, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec) return { blocked: true, reason: 'registro não encontrado' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    if (!opts.motivo || !String(opts.motivo).trim())
      return { blocked: true, reason: 'correção manual exige motivo — recusada sem justificativa' };
    rec.correcoes = rec.correcoes || [];
    const entrada = { campo, antes: valorEfetivo(rec, campo), depois, motivo: opts.motivo,
      autor: opts.usuario || 'Marcos', em: HOJE, origem: 'MANUAL_CORRECTION' };
    rec.correcoes.push(entrada); /* rec.raw permanece intocado — original preservado */
    audit(eng, 'correcao_manual', `${key} · ${campo}: "${entrada.antes}" → "${depois}" · motivo: ${opts.motivo}`, { key, autor: entrada.autor });
    return { ok: true, correcao: entrada, nota: 'valor original preservado; a correção é uma camada MANUAL_CORRECTION' };
  }

  function excludeFromAnalysis(eng, key, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec) return { blocked: true, reason: 'registro não encontrado' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    if (!opts.motivo || !String(opts.motivo).trim())
      return { blocked: true, reason: 'excluir da análise exige motivo — recusado' };
    rec.excluidoDaAnalise = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE,
      impacto: 'sai das análises e dos KPIs; permanece na camada bruta e no histórico', restauravel: true };
    audit(eng, 'excluido_da_analise', `${key} · motivo: ${opts.motivo}`, { key });
    return { ok: true, exclusao: rec.excluidoDaAnalise };
  }

  function restaurar(eng, key, opts) {
    opts = opts || {};
    const rec = findRec(eng, key);
    if (!rec || !rec.excluidoDaAnalise) return { blocked: true, reason: 'nada a restaurar' };
    const perm = permDe(rec);
    if (!canData(opts.papel || 'OWNER', perm)) return negar(opts.papel, perm);
    rec.restauracoes = rec.restauracoes || [];
    rec.restauracoes.push({ exclusaoAnterior: rec.excluidoDaAnalise, por: opts.usuario || 'Marcos', em: HOJE });
    rec.excluidoDaAnalise = null;
    audit(eng, 'restaurado_na_analise', key, { key });
    return { ok: true };
  }

  function archiveFile(eng, batchId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'DATA_SOURCE_ARCHIVE')) return negar(opts.papel, 'DATA_SOURCE_ARCHIVE');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'arquivar exige motivo' };
    const batch = eng.batches.find(b => b.id === batchId);
    if (!batch) return { blocked: true, reason: 'lote não encontrado' };
    batch.arquivado = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE,
      impacto: 'fonte sai das listas ativas; dados, camada bruta e trilha permanecem — nada é apagado' };
    audit(eng, 'fonte_arquivada', `${batchId} (${batch.arquivo}) · motivo: ${opts.motivo}`, { batchId });
    return { ok: true, arquivado: batch.arquivado };
  }

  function desativarVinculo(eng, obsId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'MASTER_LINK_EDIT')) return negar(opts.papel, 'MASTER_LINK_EDIT');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'desativar vínculo exige motivo' };
    const obs = eng.observations.find(o => o.id === obsId);
    if (!obs) return { blocked: true, reason: 'listing não encontrado' };
    obs.vinculoAnterior = { vinculo: obs.vinculo, produtoId: obs.produtoId };
    obs.vinculo = 'VÍNCULO DESATIVADO'; obs.produtoId = null;
    audit(eng, 'vinculo_desativado', `${obsId} (item ${obs.item_id}) · motivo: ${opts.motivo}`, { obsId });
    return { ok: true, nota: 'vínculo desativado sem apagar o anúncio nem o histórico' };
  }

  function removerMaster(eng, produtoId, opts) {
    opts = opts || {};
    if (!canData(opts.papel || 'OWNER', 'MASTER_LINK_EDIT')) return negar(opts.papel, 'MASTER_LINK_EDIT');
    if (!opts.motivo || !String(opts.motivo).trim()) return { blocked: true, reason: 'remover master exige motivo' };
    const link = eng.masterLinks.find(l => l.produtoId === produtoId);
    if (!link || !link.itemId) return { blocked: true, reason: 'produto sem master definido' };
    link.historico = link.historico || [];
    link.historico.push({ itemId: link.itemId, estado: link.estado, removidoEm: HOJE, motivo: opts.motivo });
    link.itemId = null; link.estado = 'SEM MASTER DEFINIDO';
    audit(eng, 'master_removido', `${produtoId} · motivo: ${opts.motivo} (anúncio permanece intacto)`, { produtoId });
    return { ok: true, nota: 'master removido — o anúncio continua existindo; só a referência estratégica caiu' };
  }

  function historicoDe(eng, key) {
    const rec = findRec(eng, key);
    if (!rec) return null;
    return { versoes: rec.versoes, correcoes: rec.correcoes || [], exclusao: rec.excluidoDaAnalise || null,
      restauracoes: rec.restauracoes || [], atual: rec.raw, atualizadoEm: rec.atualizadoEm };
  }

  /* ---------- fontes e histórico (tabela transversal) ---------- */
  function sourcesTable(eng) {
    return eng.batches.map(b => ({
      batchId: b.id, fonte: b.sourceType, areaDestino: b.det.destino || 'não identificado', arquivo: b.arquivo,
      marketplace: b.escopo.marketplace, lojaId: b.escopo.lojaId, contaId: b.escopo.contaId,
      periodo: b.periodo, granularidade: b.det.granularidade || null, status: b.estado,
      linhas: b.linhas, duplicidadesEvitadas: b.aplicado ? b.aplicado.duplicadosEvitados : 0,
      conflitos: b.aplicado ? b.aplicado.conflitos : (b.preview ? b.preview.conflitos || 0 : 0),
      linhasComErro: (b.preview && b.preview.linhasComErro) || 0,
      ultimaAtualizacao: b.aplicado ? b.aplicado.em : b.em, usuario: b.enviadoPor,
      arquivado: b.arquivado || null,
      acoes: ['Ver arquivo', 'Ver mapeamento', 'Ver dados brutos', 'Ver dados normalizados', 'Ver linhas com erro',
        ...(b.aplicado && b.estado !== 'REVERTIDO' ? ['Reprocessar', 'Rollback'] : []),
        ...(b.arquivado ? ['Restaurar'] : ['Arquivar'])],
    }));
  }
  const areaSources = (eng, destinos) => sourcesTable(eng).filter(r => destinos.includes(r.areaDestino) && !r.arquivado);

  /* ---------- MESA DE INTELIGÊNCIA — agentes honestos sobre fontes reais ---------- */
  const NIVEIS = ['CRÍTICO', 'ATENÇÃO', 'OPORTUNIDADE', 'APRENDIZADO', 'AGUARDANDO DADOS'];
  const AGENT_STATUS = ['ANALISADO', 'AGUARDANDO DADOS', 'DADO INSUFICIENTE', 'DADO CONFLITANTE', 'COBERTURA PARCIAL'];

  function mesaInsights(eng, filtro) {
    filtro = filtro || {};
    const insights = [];
    const fontesDe = destinos => eng.batches.filter(b => b.aplicado && !b.arquivado && destinos.includes(b.det.destino));
    const fonteStr = bs => bs.map(b => b.arquivo).join(' · ');
    const perStr = bs => bs.map(b => b.periodo ? b.periodo.ini + '→' + b.periodo.fim : 'sem período declarado').join(' · ');
    const push = (agente, nivel, titulo, fato, bs, extra) => insights.push(Object.assign({
      id: 'ins' + (insights.length + 1), agente, nivel, titulo, fato,
      fonte: fonteStr(bs) || 'fonte interna', periodo: perStr(bs) || '—',
      cobertura: bs.length + ' fonte(s) aplicada(s)', confianca: 'alta — dado importado, não estimado',
      acoes: ['Abrir análise', 'Ver fontes', 'Criar missão', 'Marcar para acompanhar', 'Silenciar com motivo'],
    }, extra || {}));

    const ov = ordersView(eng, filtro);
    const stats = orderStats(eng, filtro);
    const stock = stockView(eng, filtro);
    const agentes = [];
    const agente = (nome, destinos, analisar) => {
      const bs = fontesDe(destinos);
      if (!bs.length) {
        agentes.push({ nome, status: 'AGUARDANDO DADOS', fontes: [], ultimaAnalise: null,
          dadosFaltantes: 'nenhuma fonte aplicada para ' + destinos.join('/'),
          acao: { tipo: 'Solicitar dado', destino: destinos[0], label: 'Atualizar dados desta área' }, insights: 0 });
        return;
      }
      const antes = insights.length;
      const st = analisar(bs) || 'ANALISADO';
      agentes.push({ nome, status: st, fontes: bs.map(b => b.arquivo), ultimaAnalise: bs[bs.length - 1].aplicado.em,
        periodo: perStr(bs), insights: insights.length - antes, dadosFaltantes: null });
    };

    /* 1 · Pedidos */
    agente('Analista de Pedidos', ['pedidos'], bs => {
      const k = stats.kpis;
      const txNP = conversaoExplicita(k.naoPagos, k.pedidos, 'não pagos ÷ pedidos importados');
      if (txNP.taxa != null && txNP.taxa > 25)
        push('Analista de Pedidos', 'CRÍTICO', 'Perda de pagamento acima do tolerável',
          `${k.naoPagos} de ${k.pedidos} pedidos sem pagamento (${txNP.taxa}%, fórmula: ${txNP.formula}) — R$ ${k.valorNaoPago} parados`, bs,
          { hipotese: 'frete/cupom/checkout — hipótese, nunca causa afirmada sem evidência do canal' });
      if (k.taxaCancelamento.taxa != null && k.taxaCancelamento.taxa > 15)
        push('Analista de Pedidos', 'ATENÇÃO', 'Cancelamento elevado',
          `${k.cancelados} cancelamento(s) em ${k.pedidos} pedidos (${k.taxaCancelamento.taxa}%)`, bs);
      const geo = geoStats(eng, filtro, 'estado');
      if (geo.length)
        push('Analista de Pedidos', 'APRENDIZADO', 'Concentração geográfica',
          `${geo[0].chave} lidera com ${geo[0].pedidos} pedido(s) e R$ ${geo[0].faturamento}`, bs);
      return 'ANALISADO';
    });

    /* 2 · Performance de produtos */
    agente('Analista de Performance', ['performance'], bs => {
      const perf = eng.snapshots.filter(s => s.granularidade === 'LISTING_METRIC' && !s.excluidoDaAnalise);
      for (const s of perf) {
        const cliques = +s.raw['Cliques por Produto'] || 0, pedidos = +s.raw['Pedidos'] || 0;
        const ctr = +s.raw['CTR'] || null, conv = +s.raw['Taxa de Conversão de Pedidos'] || null;
        if (cliques >= 80 && pedidos <= 2)
          push('Analista de Performance', 'OPORTUNIDADE', 'Clique sem venda',
            `"${s.raw['Produto'] || s.item_id}": ${cliques} cliques e só ${pedidos} pedido(s) — página/preço/frete merecem experimento`, bs,
            { hipotese: 'anúncio atrai mas não converte — hipótese para experimento, não certeza' });
        if (ctr != null && conv != null && ctr < 3 && conv >= 7)
          push('Analista de Performance', 'OPORTUNIDADE', 'CTR baixo com conversão boa',
            `"${s.raw['Produto'] || s.item_id}": CTR ${ctr}% mas conversão ${conv}% — quem clica compra; melhorar capa/título multiplica`, bs);
      }
      return 'ANALISADO';
    });

    /* 3 · Estoque */
    agente('Analista de Estoque', ['estoque'], bs => {
      if (!stats.kpis.pedidos) {
        push('Analista de Estoque', 'AGUARDANDO DADOS', 'Cruzamento venda × estoque incompleto',
          'há leitura de estoque, mas sem pedidos importados não dá para cruzar venda com cobertura — nada será inventado', bs,
          { confianca: 'n/a', acoes: ['Ver fontes', 'Solicitar dado'] });
        return 'COBERTURA PARCIAL';
      }
      for (const st of stock.atual) {
        const vendasSku = ov.orders.filter(o => o.sku === st.sku && !['Cancelados', 'Não pagos'].includes(o.tab)).length;
        if (vendasSku > 0 && st.disponivel <= 5)
          push('Analista de Estoque', 'CRÍTICO', 'Venda ativa com estoque crítico',
            `SKU ${st.sku} (${st.armazem}): ${vendasSku} venda(s) no período e só ${st.disponivel} disponível — ruptura interrompe o giro`, bs);
      }
      return 'ANALISADO';
    });

    /* 4 · Devoluções */
    agente('Analista de Devoluções', ['devolucoes'], bs => {
      const porSku = {};
      for (const o of ov.orders)
        for (const e of o.eventos)
          if (/devolu|reembolso/i.test(e.tipo)) (porSku[o.sku || o.produto] = porSku[o.sku || o.produto] || []).push(o.id);
      for (const [sku, ids] of Object.entries(porSku))
        if (ids.length >= 2)
          push('Analista de Devoluções', 'ATENÇÃO', 'Vende e devolve demais',
            `${sku}: ${ids.length} pedidos com devolução/reembolso (${ids.join(', ')}) — investigar expectativa × produto`, bs);
      if (ov.eventosOrfaos.length) {
        push('Analista de Devoluções', 'ATENÇÃO', 'Evento sem pedido correspondente',
          `${ov.eventosOrfaos.length} evento(s) de devolução citam pedidos ainda não importados — nunca criamos pedido a partir de devolução`, bs,
          { acoes: ['Abrir análise', 'Ver fontes', 'Corrigir dado', 'Solicitar dado'] });
        return 'DADO CONFLITANTE';
      }
      return 'ANALISADO';
    });

    /* 5 · Tráfego */
    agente('Analista de Tráfego', ['trafego_visao', 'trafego'], bs => {
      const periodOnly = bs.every(b => b.det.granularidade === 'PERIOD_METRIC');
      const tv = eng.snapshots.filter(s => s.metric_type === 'trafego_visao');
      if (tv.length) {
        const vis = tv.reduce((a, s) => a + (+s.raw['Visitantes'] || 0), 0);
        push('Analista de Tráfego', 'APRENDIZADO', 'Tráfego agregado do período',
          `${vis} visitante(s) no período declarado — número agregado; não existe abertura diária nesta fonte e ela não será inventada`, bs);
      }
      return periodOnly ? 'COBERTURA PARCIAL' : 'ANALISADO';
    });

    /* 6 · Afiliados */
    agente('Analista de Afiliados', ['afiliados', 'atribuicao'], bs => {
      const afs = eng.snapshots.filter(s => s.metric_type === 'afiliados' && !s.excluidoDaAnalise);
      for (const s of afs) {
        const vendas = +s.raw['Vendas do Afiliado'] || 0, com = +s.raw['Comissão'] || 0;
        if (vendas && com / vendas > 0.15)
          push('Analista de Afiliados', 'ATENÇÃO', 'Comissão de afiliado pressiona a margem',
            `${s.raw['Afiliado']}: R$ ${com} de comissão sobre R$ ${vendas} (${Math.round((com / vendas) * 100)}%) — checar margem final`, bs,
            { hipotese: 'afiliado explica a origem da venda — o valor nunca soma de novo no faturamento total' });
      }
      return 'ANALISADO';
    });

    /* 7 · Atendimento */
    agente('Analista de Atendimento', ['atendimento'], bs => {
      const ch = eng.snapshots.filter(s => s.metric_type === 'atendimento');
      const taxas = ch.map(s => +s.raw['Taxa de resposta']).filter(v => !isNaN(v));
      if (taxas.length) {
        const media = Math.round(taxas.reduce((a, x) => a + x, 0) / taxas.length);
        if (media < 80)
          push('Analista de Atendimento', 'OPORTUNIDADE', 'Perguntas sem resposta seguram conversão',
            `taxa média de resposta ${media}% — pergunta não respondida costuma virar pedido perdido (hipótese a validar)`, bs);
      }
      return 'ANALISADO';
    });

    /* 8 · Estratégia (meta-agente: só trabalha com ≥2 fontes) */
    (() => {
      const destAplicados = [...new Set(eng.batches.filter(b => b.aplicado && !b.arquivado).map(b => b.det.destino))];
      if (destAplicados.length < 2) {
        agentes.push({ nome: 'Estrategista', status: 'DADO INSUFICIENTE', fontes: [], ultimaAnalise: null,
          dadosFaltantes: 'estratégia exige pelo menos 2 áreas com dados aplicados — hoje: ' + (destAplicados.join(', ') || 'nenhuma'),
          acao: { tipo: 'Solicitar dado', destino: 'pedidos' }, insights: 0 });
      } else {
        const criticos = insights.filter(i => i.nivel === 'CRÍTICO').length;
        push('Estrategista', criticos ? 'ATENÇÃO' : 'APRENDIZADO', 'Prioridade da semana',
          criticos ? `${criticos} ponto(s) crítico(s) na fila — resolver antes de acelerar qualquer alavanca`
            : `${destAplicados.length} área(s) com dado real aplicado e nenhum crítico aberto — janela para experimento controlado`,
          eng.batches.filter(b => b.aplicado && !b.arquivado).slice(-3));
        agentes.push({ nome: 'Estrategista', status: 'ANALISADO', fontes: destAplicados,
          ultimaAnalise: HOJE, insights: 1, dadosFaltantes: null });
      }
    })();

    /* cruzamentos principais — cada card declara o que exige e o que falta */
    const CRUZES = [
      ['clique-sem-venda', 'Produto com clique e sem venda', ['performance']],
      ['vende-e-devolve', 'Produto que vende e devolve demais', ['pedidos', 'devolucoes']],
      ['venda-estoque-critico', 'Venda crescente + estoque crítico', ['pedidos', 'estoque']],
      ['roi-afiliado-margem', 'ROI de afiliado × margem baixa', ['afiliados']],
      ['cidade-volume-prazo', 'Cidade com volume + prazo ruim', ['pedidos']],
      ['perguntas-conversao', 'Perguntas sem resposta × conversão', ['atendimento', 'performance']],
      ['promo-criados-nao-pagos', 'Promoção com pedidos criados e não pagos', ['promocoes', 'pedidos']],
      ['ctr-baixo-conv-boa', 'CTR baixo com conversão boa', ['performance']],
    ];
    const temDest = d => eng.batches.some(b => b.aplicado && !b.arquivado && b.det.destino === d);
    const cruzamentos = CRUZES.map(([key, nome, req]) => {
      const faltam = req.filter(d => !temDest(d));
      if (faltam.length) return { key, nome, estado: 'AGUARDANDO DADOS', faltam,
        nota: 'exige ' + req.join(' + ') + ' — falta: ' + faltam.join(', ') + '. Nada é estimado.' };
      const hit = insights.find(i =>
        (key === 'clique-sem-venda' && i.titulo === 'Clique sem venda') ||
        (key === 'vende-e-devolve' && i.titulo === 'Vende e devolve demais') ||
        (key === 'venda-estoque-critico' && i.titulo === 'Venda ativa com estoque crítico') ||
        (key === 'roi-afiliado-margem' && i.titulo === 'Comissão de afiliado pressiona a margem') ||
        (key === 'cidade-volume-prazo' && i.titulo === 'Concentração geográfica') ||
        (key === 'perguntas-conversao' && i.titulo === 'Perguntas sem resposta seguram conversão') ||
        (key === 'ctr-baixo-conv-boa' && i.titulo === 'CTR baixo com conversão boa'));
      return { key, nome, estado: 'ANALISADO', resultado: hit ? hit.fato : 'nenhum caso encontrado no recorte atual',
        insightId: hit ? hit.id : null,
        nota: 'correlação observada — nunca afirmada como causa sem evidência' };
    });

    /* visão geral — 13 indicadores com fonte e última atualização, SEM DADOS quando faltam */
    const bsPed = fontesDe(['pedidos']), bsTraf = fontesDe(['trafego_visao', 'trafego']);
    const ult = bs => bs.length ? bs[bs.length - 1].aplicado.em : null;
    const kv = (label, valor, bs, notaSem) => ({ label, valor: bs.length ? valor : null,
      fonte: fonteStr(bs) || null, ultima: ult(bs), sem: bs.length ? null : (notaSem || 'SEM DADOS — importe a fonte desta área') });
    const tv = eng.snapshots.filter(s => s.metric_type === 'trafego_visao');
    const visitantes = tv.reduce((a, s) => a + (+s.raw['Visitantes'] || 0), 0);
    const afSnaps = eng.snapshots.filter(s => s.metric_type === 'afiliados');
    const chSnaps = eng.snapshots.filter(s => s.metric_type === 'atendimento');
    const visaoGeral = [
      kv('Faturamento aprovado', 'R$ ' + stats.kpis.faturamentoAprovado, bsPed),
      kv('Pedidos importados', stats.kpis.pedidos, bsPed),
      kv('Não pagos', stats.kpis.naoPagos + ' (R$ ' + stats.kpis.valorNaoPago + ')', bsPed),
      kv('Cancelados', stats.kpis.cancelados, bsPed),
      kv('Devoluções/Reembolsos', stats.kpis.devolucoes, fontesDe(['devolucoes'])),
      kv('Ticket médio', stats.kpis.ticketMedio != null ? 'R$ ' + stats.kpis.ticketMedio : '—', bsPed),
      kv('Unidades vendidas', stats.kpis.unidades, bsPed),
      kv('Visitantes (período)', visitantes, bsTraf),
      { label: 'Conversão', valor: null, fonte: null, ultima: null,
        sem: 'não exibida — exige numerador e denominador da MESMA fonte e período; nunca mostramos % sem fórmula' },
      kv('SKUs em estoque crítico', stock.atual.filter(s => s.disponivel <= 5).length, fontesDe(['estoque'])),
      kv('Vendas via afiliados (explicativa)', 'R$ ' + Math.round(afSnaps.reduce((a, s) => a + (+s.raw['Vendas do Afiliado'] || 0), 0) * 100) / 100, fontesDe(['afiliados'])),
      kv('Taxa de resposta no chat', chSnaps.length ? Math.round(chSnaps.reduce((a, s) => a + (+s.raw['Taxa de resposta'] || 0), 0) / chSnaps.length) + '%' : '—', fontesDe(['atendimento'])),
      { label: 'Fontes ativas', valor: eng.batches.filter(b => b.aplicado && !b.arquivado).length,
        fonte: 'Fontes e Histórico de Dados', ultima: HOJE, sem: null },
    ];

    const ordem = Object.fromEntries(NIVEIS.map((n, i) => [n, i]));
    insights.sort((a, b) => (ordem[a.nivel] ?? 9) - (ordem[b.nivel] ?? 9));
    return { visaoGeral, agentes, insights, cruzamentos, filtro,
      honestidade: 'Os agentes não fingem trabalho: sem dado real aplicado, o status é AGUARDANDO DADOS — nunca análise inventada.' };
  }

  /* ---------------- fixtures (referência de schema — rotuladas, nunca dados padrão) ---------------- */
  const FIXTURES = {
    productTraffic: periodo => ({
      nome: 'producttraffic_Product_Card.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Product Card', headers: ['ID do Item', 'Produto', 'Status Atual do Item', 'Taxa de Vendas', 'Vendas', 'Impressões de Produto', 'Cliques por Produto', 'Pedidos', 'Unidades', 'CTR', 'Taxa de Conversão de Pedidos'],
        rows: [
          { 'ID do Item': '9001', 'Produto': 'Quadro Paisagem 60x90 Premium', 'Status Atual do Item': 'Normal', 'Vendas': 4210.5, 'Impressões de Produto': 18400, 'Cliques por Produto': 640, 'Pedidos': 41, 'Unidades': 44, 'CTR': 3.5, 'Taxa de Conversão de Pedidos': 6.4, 'SKU Pai': 'QP-6090' },
          { 'ID do Item': '9002', 'Produto': 'Kit 3 Quadros Sala Moderna', 'Status Atual do Item': 'Normal', 'Vendas': 6120.0, 'Impressões de Produto': 22100, 'Cliques por Produto': 810, 'Pedidos': 25, 'Unidades': 26, 'CTR': 3.7, 'Taxa de Conversão de Pedidos': 3.1, 'SKU Pai': 'KIT3-SALA' },
          { 'ID do Item': '9003', 'Produto': 'Quadro Paisagem 60x90 c/ Maleta', 'Status Atual do Item': 'Normal', 'Vendas': 1890.2, 'Impressões de Produto': 9300, 'Cliques por Produto': 210, 'Pedidos': 15, 'Unidades': 15, 'CTR': 2.3, 'Taxa de Conversão de Pedidos': 7.1, 'SKU Pai': 'QP-6090' },
          { 'ID do Item': '9004', 'Produto': 'Porta Retrato Vidro Duplo 3D', 'Status Atual do Item': 'Normal', 'Vendas': 820.1, 'Impressões de Produto': 5100, 'Cliques por Produto': 140, 'Pedidos': 14, 'Unidades': 16, 'CTR': 2.7, 'Taxa de Conversão de Pedidos': 10.0 },
          { 'ID do Item': '9005', 'Produto': 'Espelho Adnet Orgânico', 'Status Atual do Item': 'Normal', 'Vendas': 610.0, 'Impressões de Produto': 4400, 'Cliques por Produto': 90, 'Pedidos': 2, 'Unidades': 2, 'CTR': 2.0, 'Taxa de Conversão de Pedidos': 2.2, 'SKU Pai': 'DUP-1' },
        ] }],
    }),
    parentSku: () => ({
      nome: 'mass_update_parent_sku.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'Parent SKU Detail', headers: ['ID do Item', 'Nome do Produto', 'Status Atual do Item', 'SKU Pai', 'SKU da variação', 'Nome da variação', 'Preço', 'Estoque'],
        rows: [
          { 'ID do Item': '9001', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'Status Atual do Item': 'Normal', 'SKU Pai': 'QP-6090', 'SKU da variação': 'QP-6090', 'Nome da variação': 'única', 'Preço': 124.9, 'Estoque': 12 },
          { 'ID do Item': '9002', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'Status Atual do Item': 'Normal', 'SKU Pai': 'KIT3-SALA', 'SKU da variação': 'KIT3-SALA', 'Nome da variação': 'única', 'Preço': 244.9, 'Estoque': 3 },
          { 'ID do Item': '9006', 'Nome do Produto': 'Caneca Eco Cerâmica', 'Status Atual do Item': 'Normal', 'SKU Pai': 'DUP-1', 'SKU da variação': 'DUP-1-A', 'Nome da variação': '350ml', 'Preço': 37.9, 'Estoque': 10 },
        ] }],
    }),
    salesOverview: (periodo, dias) => ({
      nome: 'salesoverview_' + periodo.ini + '.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Sales Overview', headers: ['Data', 'Visitantes', 'Compradores de Pedidos Feitos', 'Pedidos Feitos', 'Unidades Pedidas', 'Vendas de Pedidos Feitos', 'Compradores de Pedidos Pagos', 'Pedidos Pagos', 'Unidades Pagas', 'Vendas de Pedidos Pagos'],
        rows: dias.map(d => ({ 'Data': d, 'Visitantes': 900, 'Pedidos Feitos': 30, 'Unidades Pedidas': 33, 'Vendas de Pedidos Feitos': 3400, 'Pedidos Pagos': 22, 'Unidades Pagas': 24, 'Vendas de Pedidos Pagos': 2500 })) }],
    }),
    promotion: periodo => ({
      nome: 'promotionoverview.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Promotion', headers: ['Nome da promoção', 'Tipo de promoção', 'Período da promoção', 'Status', 'Vendas de Pedidos Feitos', 'Vendas de Pedidos Pagos', 'Pedidos Pagos', 'Unidades Vendidas', 'Compradores'],
        rows: [{ 'Nome da promoção': 'Semana da Sala', 'Tipo de promoção': 'Desconto', 'Status': 'Encerrada', 'Vendas de Pedidos Pagos': 4100, 'Pedidos Pagos': 18, 'Unidades Vendidas': 21, 'Compradores': 17 }] }],
    }),
    voucher: periodo => ({
      nome: 'voucherreport.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Voucher', headers: ['Nome do Cupom', 'Código', 'Período de Reivindicação', 'Status', 'Tipo de Cupom', 'Resgates', 'Pedidos Pagos', 'Vendas Pagas', 'Custo'],
        rows: [{ 'Nome do Cupom': 'Frete Julho', 'Código': 'FRETEJUL', 'Status': 'Ativo', 'Resgates': 40, 'Pedidos Pagos': 12, 'Vendas Pagas': 1600, 'Custo': 180 }] }],
    }),
    channelContribution: periodo => ({
      nome: 'channel_contribution.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'Canais', headers: ['Vendas pelos Cards dos Produtos', 'Vendas pelas Lives', 'Vendas pelos Vídeos', 'Vendas pelo Afiliado', 'Vendas pelos Anúncios'],
        rows: [{ 'Vendas pelos Cards dos Produtos': 41000, 'Vendas pelas Lives': 3200, 'Vendas pelos Vídeos': 1100, 'Vendas pelo Afiliado': 9200, 'Vendas pelos Anúncios': 14100 }] }],
    }),
    desconhecido: () => ({
      nome: 'relatorio_misterioso.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'Aba1', headers: ['Coluna A', 'Coluna B', 'Métrica X'], rows: [{ 'Coluna A': 1 }] }],
    }),

    /* ---------- 10.E.2 — fontes reais por área (schema dos exports Shopee) ---------- */
    ordersHeaders: ['ID do pedido', 'Status do pedido', 'Data de criação do pedido', 'Data de pagamento', 'Data de envio',
      'Data de entrega', 'Nome do Produto', 'SKU de referência', 'Nome da variação', 'Quantidade', 'Preço acordado',
      'Valor Total', 'Frete pago pelo comprador', 'Taxa de comissão', 'Cidade', 'UF', 'CEP', 'Comprador'],
    orders: periodo => ({
      nome: 'Order.toship.20260601_20260630.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'orders', headers: FIXTURES.ordersHeaders, rows: [
        { 'ID do pedido': '2606001', 'Status do pedido': 'Não pago', 'Data de criação do pedido': '2026-06-20', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Nome da variação': 'única', 'Quantidade': 1, 'Preço acordado': 124.9, 'Valor Total': 124.9, 'Frete pago pelo comprador': 18.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '31270901', 'Comprador': 'M. S.' },
        { 'ID do pedido': '2606002', 'Status do pedido': 'A enviar', 'Data de criação do pedido': '2026-06-21', 'Data de pagamento': '2026-06-21', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'SKU de referência': 'KIT3-SALA', 'Quantidade': 1, 'Valor Total': 244.9, 'Frete pago pelo comprador': 0, 'Taxa de comissão': 34.3, 'Cidade': 'São Paulo', 'UF': 'SP', 'CEP': '04538132', 'Comprador': 'J. P.' },
        { 'ID do pedido': '2606003', 'Status do pedido': 'Em rota', 'Data de criação do pedido': '2026-06-22', 'Data de pagamento': '2026-06-22', 'Data de envio': '2026-06-23', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 2, 'Valor Total': 249.8, 'Cidade': 'Lagoa Santa', 'UF': 'MG', 'CEP': '33230001', 'Comprador': 'A. L.' },
        { 'ID do pedido': '2606004', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-18', 'Data de pagamento': '2026-06-18', 'Data de envio': '2026-06-19', 'Data de entrega': '2026-06-25', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'SKU de referência': 'PR-3D', 'Quantidade': 1, 'Valor Total': 89.9, 'Cidade': 'Curitiba', 'UF': 'PR', 'CEP': '80010010', 'Comprador': 'C. R.' },
        { 'ID do pedido': '2606005', 'Status do pedido': 'Cancelado', 'Data de criação do pedido': '2026-06-19', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 1, 'Valor Total': 124.9, 'Cidade': 'Rio de Janeiro', 'UF': 'RJ', 'CEP': '20040020', 'Comprador': 'F. T.' },
        { 'ID do pedido': '2606006', 'Status do pedido': 'Falha na entrega', 'Data de criação do pedido': '2026-06-15', 'Data de pagamento': '2026-06-15', 'Data de envio': '2026-06-16', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'SKU de referência': 'KIT3-SALA', 'Quantidade': 1, 'Valor Total': 244.9, 'Cidade': 'Manaus', 'UF': 'AM', 'CEP': '69005040', 'Comprador': 'R. B.' },
        { 'Status do pedido': 'Não pago', 'Nome do Produto': 'linha exportada sem ID — vai para "linhas com erro", nunca descartada em silêncio' },
      ] }],
    }),
    /* reimportação dia seguinte: MESMOS pedidos com status novo + 1 pedido novo + 1 linha idêntica */
    ordersV2: periodo => ({
      nome: 'Order.all.20260705.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'orders', headers: FIXTURES.ordersHeaders, rows: [
        { 'ID do pedido': '2606003', 'Status do pedido': 'Entregue', 'Data de criação do pedido': '2026-06-22', 'Data de pagamento': '2026-06-22', 'Data de envio': '2026-06-23', 'Data de entrega': '2026-07-04', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 2, 'Valor Total': 249.8, 'Cidade': 'Lagoa Santa', 'UF': 'MG', 'CEP': '33230001', 'Comprador': 'A. L.' },
        { 'ID do pedido': '2606001', 'Status do pedido': 'Cancelado', 'Data de criação do pedido': '2026-06-20', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'SKU de referência': 'QP-6090', 'Quantidade': 1, 'Valor Total': 124.9, 'Frete pago pelo comprador': 18.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '31270901', 'Comprador': 'M. S.' },
        { 'ID do pedido': '2606004', 'Status do pedido': 'Concluído', 'Data de criação do pedido': '2026-06-18', 'Data de pagamento': '2026-06-18', 'Data de envio': '2026-06-19', 'Data de entrega': '2026-06-25', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'SKU de referência': 'PR-3D', 'Quantidade': 1, 'Valor Total': 89.9, 'Cidade': 'Curitiba', 'UF': 'PR', 'CEP': '80010010', 'Comprador': 'C. R.' },
        { 'ID do pedido': '2607001', 'Status do pedido': 'A enviar', 'Data de criação do pedido': '2026-07-04', 'Data de pagamento': '2026-07-04', 'Nome do Produto': 'Espelho Adnet Orgânico', 'SKU de referência': 'ESP-ADN', 'Quantidade': 1, 'Valor Total': 159.9, 'Cidade': 'Belo Horizonte', 'UF': 'MG', 'CEP': '30140071', 'Comprador': 'P. K.' },
      ] }],
    }),
    returnZip: periodo => ({
      nome: 'Order.return_refund_cancel.zip', sourceType: 'PLANILHA_SHOPEE', periodo, zip: true,
      entries: [
        { nome: 'return_refund.xlsx', abas: [{ nome: 'events',
          headers: ['ID do pedido', 'Tipo de evento', 'ID do evento', 'Motivo', 'Valor reembolsado', 'Status da solicitação', 'Data'],
          rows: [
            { 'ID do pedido': '2606004', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-1', 'Motivo': 'produto diferente do anúncio', 'Valor reembolsado': 89.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-06-28' },
            { 'ID do pedido': '2606002', 'Tipo de evento': 'Reembolso', 'ID do evento': 'RR-2', 'Motivo': 'atraso na postagem', 'Valor reembolsado': 30, 'Status da solicitação': 'Em análise', 'Data': '2026-06-30' },
            { 'ID do pedido': '2606003', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-4', 'Motivo': 'avaria no transporte', 'Valor reembolsado': 124.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-02' },
            { 'ID do pedido': '2606005', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-5', 'Motivo': 'arrependimento', 'Valor reembolsado': 124.9, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-01' },
            { 'ID do pedido': '9999999', 'Tipo de evento': 'Devolução', 'ID do evento': 'RR-9', 'Motivo': 'pedido de outro período', 'Valor reembolsado': 50, 'Status da solicitação': 'Aprovada', 'Data': '2026-07-01' },
          ] }] },
        { nome: 'leiame.txt', motivo: 'não é planilha — permanece no arquivo original, não é importado' },
      ],
    }),
    inventory: momento => ({
      nome: 'Current_Inventory_Report_' + String(momento).replace(/\D/g, '') + '.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null, momento,
      abas: [{ nome: 'inventory', headers: ['SKU', 'Nome do Produto', 'Armazém', 'Disponível', 'Reservado', 'Em trânsito', 'Momento da leitura'],
        rows: [
          { 'SKU': 'QP-6090', 'Nome do Produto': 'Quadro Paisagem 60x90 Premium', 'Armazém': 'Full BR-MG', 'Disponível': 3, 'Reservado': 2, 'Em trânsito': 0, 'Momento da leitura': momento },
          { 'SKU': 'KIT3-SALA', 'Nome do Produto': 'Kit 3 Quadros Sala Moderna', 'Armazém': 'Full BR-MG', 'Disponível': 40, 'Reservado': 1, 'Em trânsito': 12, 'Momento da leitura': momento },
          { 'SKU': 'PR-3D', 'Nome do Produto': 'Porta Retrato Vidro Duplo 3D', 'Armazém': 'Full BR-SP', 'Disponível': 0, 'Reservado': 2, 'Em trânsito': 6, 'Momento da leitura': momento },
        ] }],
    }),
    affiliatesCsv: periodo => ({
      nome: 'ProductPerformance_2026-06-05_2026-07-04.csv', sourceType: 'PLANILHA_SHOPEE', periodo, formato: 'csv',
      abas: [{ nome: 'csv', headers: ['Afiliado', 'ID do Item', 'Produto', 'Cliques', 'Pedidos', 'Vendas do Afiliado', 'Comissão'],
        rows: [
          { 'Afiliado': 'creator_ana', 'ID do Item': '9002', 'Produto': 'Kit 3 Quadros Sala Moderna', 'Cliques': 320, 'Pedidos': 4, 'Vendas do Afiliado': 900, 'Comissão': 180 },
          { 'Afiliado': 'blog_decora', 'ID do Item': '9001', 'Produto': 'Quadro Paisagem 60x90 Premium', 'Cliques': 120, 'Pedidos': 3, 'Vendas do Afiliado': 400, 'Comissão': 20 },
        ] }],
    }),
    trafficOverview: periodo => ({
      nome: 'traffic_overview.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo,
      abas: [{ nome: 'overview', headers: ['Período', 'Visitantes', 'Visualizações da Página', 'Taxa de Rejeição', 'Novos Seguidores'],
        rows: [{ 'Período': periodo.ini + ' a ' + periodo.fim, 'Visitantes': 12400, 'Visualizações da Página': 31800, 'Taxa de Rejeição': 41.2, 'Novos Seguidores': 210 }] }],
    }),
    chat: () => ({
      nome: 'chat_metrics_export.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'chat', headers: ['Data', 'Perguntas recebidas', 'Perguntas respondidas', 'Taxa de resposta', 'Tempo médio de resposta'],
        rows: [
          { 'Data': '2026-07-01', 'Perguntas recebidas': 34, 'Perguntas respondidas': 24, 'Taxa de resposta': 71, 'Tempo médio de resposta': '3h12' },
          { 'Data': '2026-07-02', 'Perguntas recebidas': 28, 'Perguntas respondidas': 21, 'Taxa de resposta': 75, 'Tempo médio de resposta': '2h40' },
          { 'Data': '2026-07-03', 'Perguntas recebidas': 31, 'Perguntas respondidas': 22, 'Taxa de resposta': 71, 'Tempo médio de resposta': '4h05' },
        ] }],
    }),
  };

  return { PROFILES, GRANULARIDADES, FONTES, JOB_ESTADOS, VINCULO, MASTER_ESTADOS, IMPORT_PERMS,
    detect, fingerprintFile, hash, createEngine, stage, apply, rollback, receitaConsolidada,
    suggestMaster, approveMaster, coverage, canImp, naturalKey, KEYS, FIXTURES, assertNoDemoMix,
    /* 10.E.2 */
    DATA_PERMS, DATA_PERMS_ALL, canData, orderTab, cepProtegido, ordersView, orderStats, geoStats, stockView,
    conversaoExplicita, valorEfetivo, correct, excludeFromAnalysis, restaurar, archiveFile, desativarVinculo,
    removerMaster, historicoDe, sourcesTable, areaSources, mesaInsights, NIVEIS, AGENT_STATUS };
}));

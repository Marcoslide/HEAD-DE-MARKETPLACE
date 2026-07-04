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
    'VÍNCULO SUGERIDO POR NOME', 'CONFLITO DE SKU', 'SKU AUSENTE', 'SEM CORRESPONDÊNCIA', 'REVISÃO HUMANA NECESSÁRIA'];
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
    SHOPEE_CHAT_FAQ: P('REFERENCE_ONLY', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Perguntas respondidas', 'Taxa de resposta'], 'day_metric'),
    SHOPEE_AI_ASSISTANT: P('REFERENCE_ONLY', 'shopee', 'SERVICE_METRIC', 'atendimento',
      ['Perguntas transferidas ao vendedor'], 'day_metric'),
    SHOPEE_FINANCIAL_REFERENCE: P('REFERENCE_ONLY', 'shopee', 'FINANCIAL_SUMMARY', 'financeiro',
      ['Comissão', 'Repasse'], 'period_metric'),
    SHOPEE_CHANNEL_CONTRIBUTION: P('SUPPORTED', 'shopee', 'CHANNEL_ATTRIBUTION', 'atribuicao',
      ['Vendas pelos Cards dos Produtos', 'Vendas pelas Lives', 'Vendas pelo Afiliado', 'Vendas pelos Anúncios'], 'period_metric'),
    CUSTOM_CSV_MAPPING: P('PARTIALLY_SUPPORTED', null, null, 'custom', [], 'custom'),
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
    return { batches: [], staging: [], snapshots: [], observations: [], masterLinks: [], conflicts: [], audit: [], fileHashes: new Map(), seq: 0 };
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
  };
  function naturalKey(gran, r) {
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
    let vincConfirmadoId = 0, vincConfirmadoSku = 0, vincSugerido = 0, conflitos = 0, semMatch = 0, pendentes = 0;
    const stagingRows = rows.map((r, i) => {
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
      if (gran === 'STATE_SNAPSHOT' || gran === 'LISTING_METRIC') {
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
      return base;
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
      pendentesRevisao: pendentes, conflitos, semCorrespondencia: semMatch, jaExistem, sobreposicao,
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
      /* granularidade agregada NUNCA cria pedido individual */
      const snap = {
        id: 'ms' + (++eng.seq), key, entidade: s.granularidade === 'TRANSACTIONAL' ? 'order' : 'metric_snapshot',
        granularidade: s.granularidade, explicativa: ['CHANNEL_ATTRIBUTION', 'PROMOTION_METRIC', 'FINANCIAL_SUMMARY'].includes(s.granularidade),
        raw: s.raw, item_id: s.item_id || null, data: s.data || null,
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
  };

  return { PROFILES, GRANULARIDADES, FONTES, JOB_ESTADOS, VINCULO, MASTER_ESTADOS, IMPORT_PERMS,
    detect, fingerprintFile, hash, createEngine, stage, apply, rollback, receitaConsolidada,
    suggestMaster, approveMaster, coverage, canImp, naturalKey, KEYS, FIXTURES, assertNoDemoMix };
}));

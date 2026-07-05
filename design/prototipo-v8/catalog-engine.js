/* =============================================================
   HEAD MARKETPLACE OS · v8 — CATALOG & LISTING ENGINE (10.E.3)
   Separação central:
     PRODUCT MASTER  → verdade interna (SKU, variações, mídia, custo)
     LISTING/ANÚNCIO → projeção operacional em marketplace+conta+loja
   Editar um anúncio nunca sobrescreve outro marketplace. Editar o
   master nunca apaga customização de canal. Duplicar/adaptar cria
   cópia interna (rascunho) — o original permanece intacto. Ranking
   só existe com fonte, data, escopo e confiança. Toda mutação passa
   por permissão no motor (nunca só botão) e vira trilha/versão.
   Roda em Node (testes) e no navegador.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8CAT = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOJE = '2026-07-05';
  const hash = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return h; };
  const round2 = v => Math.round(v * 100) / 100;

  const FONTES = ['IMPORTAÇÃO_MANUAL', 'PLANILHA_SHOPEE', 'PLANILHA_MERCADO_LIVRE', 'PLANILHA_TIKTOK',
    'PLANILHA_MAGALU', 'API_OFICIAL', 'NORMALIZED_INTERNAL_DATA', 'MANUAL_CORRECTION', 'DEMO_FIXTURE', 'NO_DATA'];
  const MKTS = [['ml', 'Mercado Livre'], ['shopee', 'Shopee'], ['tiktok', 'TikTok Shop'], ['magalu', 'Magalu']];
  const MKT_NOME = Object.fromEntries(MKTS);

  /* ---------- permissões (enforcement no motor, escopo validado) ---------- */
  const CATALOG_PERMS_ALL = ['CATALOG_VIEW', 'CATALOG_EDIT', 'CATALOG_ARCHIVE', 'CATALOG_IMPORT', 'CATALOG_IMPORT_APPLY',
    'CATALOG_BULK_EDIT', 'CATALOG_MEDIA_UPLOAD', 'CATALOG_MEDIA_REMOVE', 'CATALOG_MASTER_APPROVE',
    'CATALOG_ADAPT_CREATE', 'CATALOG_ROLLBACK', 'RAW_CATALOG_DATA_VIEW'];
  const CATALOG_PERMS = {
    OWNER: CATALOG_PERMS_ALL.slice(), ADMIN: CATALOG_PERMS_ALL.slice(),
    HEAD_MARKETPLACE: CATALOG_PERMS_ALL.filter(p => p !== 'CATALOG_ROLLBACK'),
    GESTOR_COMERCIAL: ['CATALOG_VIEW', 'RAW_CATALOG_DATA_VIEW'],
    GESTOR_OPERACIONAL: ['CATALOG_VIEW', 'CATALOG_EDIT', 'CATALOG_IMPORT', 'CATALOG_MEDIA_UPLOAD', 'RAW_CATALOG_DATA_VIEW'],
    CATALOGO: ['CATALOG_VIEW', 'CATALOG_EDIT', 'CATALOG_ARCHIVE', 'CATALOG_IMPORT', 'CATALOG_BULK_EDIT',
      'CATALOG_MEDIA_UPLOAD', 'CATALOG_MEDIA_REMOVE', 'CATALOG_ADAPT_CREATE', 'RAW_CATALOG_DATA_VIEW'],
    FINANCEIRO: ['CATALOG_VIEW', 'RAW_CATALOG_DATA_VIEW'], EXPEDICAO: ['CATALOG_VIEW'],
    DESIGNER: ['CATALOG_VIEW', 'CATALOG_MEDIA_UPLOAD'], CONSULTOR: ['CATALOG_VIEW'], LEITURA: ['CATALOG_VIEW'],
  };
  const canCat = (papel, perm) => (CATALOG_PERMS[papel] || []).includes(perm);
  const negar = (papel, perm) => ({ blocked: true, reason: `papel ${papel || '?'} não possui ${perm} — a barreira é no motor, não na interface` });
  const exigeMotivo = motivo => !motivo || !String(motivo).trim()
    ? { blocked: true, reason: 'ação exige motivo — recusada sem justificativa' } : null;

  /* ---------- criação do catálogo (listings derivados do master) ---------- */
  function createCatalog(products, opts) {
    opts = opts || {};
    const cat = { products, listings: [], media: [], rankings: [], bulkJobs: [], timeline: [], audit: [], seq: 0 };
    const audit = (acao, detalhe, extra) => cat.audit.push(Object.assign({ id: 'ca' + (++cat.seq), acao, detalhe, em: HOJE }, extra || {}));
    cat._audit = audit;
    const ev = (ref, tipo, detalhe, extra) => cat.timeline.push(Object.assign({ id: 'ev' + (++cat.seq), ref, tipo, detalhe, em: HOJE, autor: 'sistema' }, extra || {}));
    cat._ev = ev;

    for (const p of products) {
      /* variações do master (verdade interna) */
      p.variacoes = p.variacoes || defaultVariacoes(p);
      p.master.ean = p.master.ean !== undefined ? p.master.ean
        : (['p3', 'p12'].includes(p.id) ? null : String(7890000000000 + (hash(p.sku) % 999999999)));
      p.master.ncm = p.master.ncm || (p.categoria === 'Decoração' ? '4911.91.00' : null);

      /* mídia oficial do produto (biblioteca) */
      const nFotos = p.id === 'p3' ? 0 : p.id === 'p4' ? 1 : 2 + (hash(p.sku) % 3);
      for (let i = 0; i < nFotos; i++)
        cat.media.push({ id: 'md' + (++cat.seq), arquivo: p.sku.toLowerCase() + '-' + (i + 1) + '.jpg', tipo: 'foto',
          subtipo: i === 0 ? 'oficial' : ['ambiente', 'detalhe', 'medidas'][i % 3], origem: 'DEMO_FIXTURE',
          em: '2026-06-1' + (i % 9), usuario: 'Ana', produtoId: p.id, status: 'EM USO',
          dims: '1200x1200', pesoKb: 180 + (hash(p.sku + i) % 400), usos: [] });
      if (p.id === 'p6')
        cat.media.push({ id: 'md' + (++cat.seq), arquivo: 'por-3d-video.mp4', tipo: 'video', subtipo: 'video',
          origem: 'DEMO_FIXTURE', em: '2026-06-20', usuario: 'Ana', produtoId: p.id, status: 'EM USO',
          dims: '1080p', pesoKb: 8200, usos: [] });

      /* um listing por marketplace declarado no produto */
      for (const [mk] of MKTS) {
        const m = p.mkt[mk];
        if (!m) continue;
        const h = hash(p.sku + '|' + mk);
        const ativoish = ['ATIVO', 'PAUSADO', 'EM_REVISAO'].includes(m.status);
        const lojaEntry = Object.entries(p.lojas || {}).find(([lid, sl]) => {
          return sl.contaId && sl.contaId.includes(mk === 'ml' ? 'ml' : mk === 'shopee' ? 'shp' : mk === 'tiktok' ? 'tt' : 'mg');
        });
        const v90 = ativoish && m.status !== 'EM_REVISAO' ? (h % 240) : 0;
        const v30 = Math.floor(v90 * 0.45), v7 = Math.floor(v30 * 0.3);
        const semPerf = m.status === 'NAO_PUBLICADO' || p.id === 'p5' && mk === 'magalu';
        const cliques = 200 + (h % 2200), visitas = Math.floor(cliques * 0.8);
        const l = {
          id: 'L-' + p.id + '-' + mk, produtoId: p.id, marketplace: mk, mktNome: MKT_NOME[mk],
          lojaId: lojaEntry ? lojaEntry[0] : null, contaId: lojaEntry ? lojaEntry[1].contaId : null,
          itemIdExterno: ativoish || m.status === 'BLOQUEADO' ? String(900000 + (h % 90000)) : null,
          status: m.status, motivo: m.motivo || null, interno: false,
          titulo: (m.profile && m.profile.titulo) || p.nome,
          preco: m.preco, precoPromo: ativoish && (h % 3 === 0) ? round2((m.preco || 0) * 0.9) : null,
          estoque: lojaEntry ? lojaEntry[1].estoque : p.estoque,
          skuPai: p.sku, ean: p.master.ean,
          criadoEm: '2026-0' + (3 + (h % 4)) + '-1' + (h % 9), atualizadoEm: p.atualizadoEm,
          overrides: {}, correcoes: [], versoes: [], arquivado: null, excluidoDaAnalise: null,
          fonte: 'DEMO_FIXTURE', origem: 'DADO SIMULADO',
          perf: semPerf ? null : {
            fonte: 'DEMO_FIXTURE', periodo: { ini: '2026-04-06', fim: '2026-07-04' }, granularidade: 'PERIOD_METRIC',
            cobertura: '90 dias', confianca: 'demonstração — rotulado, nunca misturado com dado real',
            vendidosTotal: v90 + (h % 1400), vendidos7d: v7, vendidos30d: v30, vendidos90d: v90,
            faturamento: round2(v90 * (m.preco || p.precoBase)), pedidosPagos: Math.floor(v90 * 0.92),
            pedidosCriados: Math.floor(v90 * 1.25), naoPagos: Math.floor(v90 * 0.33),
            impressoes: cliques * 24, cliques, visitas,
            devolucoes: h % 7 === 0 ? Math.max(2, Math.floor(v90 * 0.08)) : Math.floor(v90 * 0.01),
            cancelamentos: Math.floor(v90 * 0.05), carrinhos: null,
          },
        };
        /* fotos do anúncio: usam a biblioteca; alguns canais ficam sem foto (fila real) */
        const fotos = cat.media.filter(x => x.produtoId === p.id && x.tipo === 'foto');
        fotos.forEach((f, i) => { if (!(mk === 'magalu' && p.id === 'p1')) f.usos.push({ listingId: l.id, posicao: i, principal: i === 0 }); });
        cat.listings.push(l);
      }
    }

    /* rankings observados — SEMPRE com fonte, data, escopo e confiança (semente demo rotulada) */
    const seedRk = (listingId, palavra, historico, confianca) => {
      const atual = historico[historico.length - 1];
      cat.rankings.push({ listingId, palavra, tipo: 'busca por palavra-chave',
        posicao: atual.pos, historico, marketplace: (cat.listings.find(l => l.id === listingId) || {}).mktNome,
        conta: (cat.listings.find(l => l.id === listingId) || {}).contaId || 'demo',
        escopo: 'Brasil · categoria Decoração', fonte: 'DEMO_FIXTURE', origem: 'DADO SIMULADO',
        dataHora: atual.em + ' · 14:20', periodo: 'leituras semanais', confianca });
    };
    seedRk('L-p1-ml', 'quadro paisagem grande', [{ pos: 4, em: '2026-06-21' }, { pos: 5, em: '2026-06-27' }, { pos: 7, em: '2026-07-03' }], 'média — leitura pontual, não verdade permanente');
    seedRk('L-p2-shopee', 'kit quadros sala', [{ pos: 15, em: '2026-06-25' }, { pos: 12, em: '2026-07-02' }], 'média — leitura pontual, não verdade permanente');
    seedRk('L-p6-shopee', 'porta retrato vidro', [{ pos: 3, em: '2026-07-01' }], 'demonstração');

    audit('catalogo_criado', cat.listings.length + ' listing(s) derivados de ' + products.length + ' produto(s) master');
    return cat;
  }

  function defaultVariacoes(p) {
    const base = { skuPai: p.sku, precoPromo: null, status: 'ATIVA', pesoKg: p.master.pesoEmbaladoKg, foto: null, arquivada: null };
    if (p.id === 'p1') return [
      Object.assign({ id: p.id + '-v1', nome: '60x90', tipo: 'tamanho', sku: p.sku, codigoBarras: p.master.ean || null, preco: p.precoBase, estoque: p.estoque, vendidos: 180, pedidosPagos: 166, ordem: 0 }, base),
      Object.assign({ id: p.id + '-v2', nome: '80x120', tipo: 'tamanho', sku: 'QP-80120', codigoBarras: null, preco: 189.9, estoque: 9, vendidos: 41, pedidosPagos: 38, ordem: 1 }, base)];
    if (p.id === 'p9') return ['36', '37', '38'].map((n, i) =>
      Object.assign({ id: p.id + '-v' + (i + 1), nome: 'nº ' + n, tipo: 'numeração', sku: 'TEN-R' + n, codigoBarras: null, preco: p.precoBase, estoque: i === 1 ? 14 : 0, vendidos: 12 * (i + 1), pedidosPagos: 11 * (i + 1), ordem: i }, base));
    return [Object.assign({ id: p.id + '-v1', nome: 'única', tipo: 'única', sku: p.sku, codigoBarras: p.master.ean || null, preco: p.precoBase, estoque: p.estoque, vendidos: hash(p.sku) % 300, pedidosPagos: hash(p.sku) % 280, ordem: 0 }, base)];
  }

  /* ---------- leitura ---------- */
  const byId = (cat, id) => cat.listings.find(l => l.id === id);
  const prodOf = (cat, l) => cat.products.find(p => p.id === l.produtoId);
  const ativos = cat => cat.listings.filter(l => !l.arquivado);
  const valorDe = (cat, l, campo) => {
    const c = (l.correcoes || []).filter(x => x.campo === campo);
    if (c.length) return c[c.length - 1].depois;
    if (l.overrides[campo] !== undefined) return l.overrides[campo];
    if (l[campo] !== undefined) return l[campo];
    const p = prodOf(cat, l);
    return p ? (p.master[campo] !== undefined ? p.master[campo] : p[campo]) : undefined;
  };

  function fotosDe(cat, listingId) {
    return cat.media
      .filter(m => m.usos.some(u => u.listingId === listingId))
      .map(m => ({ media: m, uso: m.usos.find(u => u.listingId === listingId) }))
      .sort((a, b) => a.uso.posicao - b.uso.posicao);
  }

  /* conversão: NUNCA sem fórmula e denominador */
  const convExp = (num, den, formula) => (num == null || den == null || den === 0)
    ? { taxa: null, formula, motivo: 'denominador ausente — conversão não aparece sem fórmula e base' }
    : { taxa: round2((num / den) * 100), formula, numerador: num, denominador: den };

  function salesInfo(cat, l) {
    const p = prodOf(cat, l);
    const preco = valorDe(cat, l, 'preco') || p.precoBase;
    const comissao = round2(preco * 0.14), taxaFixa = 4, imposto = round2(preco * 0.07);
    const margemBruta = preco ? round2(((preco - p.custo) / preco) * 100) : null;
    const liquida = preco ? round2(((preco - p.custo - comissao - taxaFixa - imposto) / preco) * 100) : null;
    const minimoSeguro = round2((p.custo + taxaFixa) / (1 - 0.14 - 0.07 - 0.10)); /* custo+taxas+10% margem mínima */
    const alertas = [];
    if (liquida != null && liquida < 10) alertas.push('Preço abaixo da margem mínima segura');
    if (l.perf && l.perf.vendidos30d > 5 && liquida != null && liquida < 15) alertas.push('Produto vende, mas a margem é insuficiente');
    if (l.perf && l.perf.vendidos30d > 5 && (l.estoque || 0) <= 3) alertas.push('Produto vende bem e está quase sem estoque');
    if (l.perf && l.perf.devolucoes >= Math.max(2, l.perf.vendidos90d * 0.06)) alertas.push('Produto vende e tem devolução alta');
    if (l.perf && l.perf.impressoes > 20000 && convExp(l.perf.pedidosPagos, l.perf.visitas, '').taxa < 1.5) alertas.push('Alta exposição com baixa conversão');
    return { preco, custo: p.custo, comissao, taxaFixa, imposto, margemBruta, margemLiquida: liquida,
      precoMinimoSeguro: minimoSeguro, precoRecomendado: round2(minimoSeguro * 1.35), alertas,
      fonte: 'NORMALIZED_INTERNAL_DATA', formulaMargem: '(preço − custo − comissão − taxa − imposto) ÷ preço' };
  }

  function perfComercial(cat, l) {
    if (!l.perf) return { semDados: true, fonte: 'NO_DATA', nota: 'SEM DADOS de performance — importe o relatório do marketplace; nada será inventado' };
    const pf = l.perf;
    const base = { fonte: pf.fonte, periodo: pf.periodo, granularidade: pf.granularidade, cobertura: pf.cobertura, confianca: pf.confianca };
    return Object.assign({}, pf, base, {
      conversaoVisitas: convExp(pf.pedidosPagos, pf.visitas, 'pedidos pagos ÷ visitas'),
      conversaoCliques: convExp(pf.pedidosCriados, pf.cliques, 'pedidos criados ÷ cliques'),
      ctr: convExp(pf.cliques, pf.impressoes, 'cliques ÷ impressões'),
      ticketMedio: pf.pedidosPagos ? round2(pf.faturamento / pf.pedidosPagos) : null,
      taxaDevolucao: convExp(pf.devolucoes, pf.pedidosPagos, 'devoluções ÷ pedidos pagos'),
    });
  }

  /* ---------- ranking (nunca sem fonte/data/escopo/confiança) ---------- */
  function assertRanking(r) {
    for (const k of ['fonte', 'dataHora', 'escopo', 'confianca', 'posicao', 'marketplace'])
      if (r[k] == null) throw new Error('ranking sem ' + k + ' não pode ser exibido');
    return true;
  }
  function rankingDe(cat, listingId) {
    const r = cat.rankings.find(x => x.listingId === listingId);
    if (!r) return null;
    assertRanking(r);
    const h = r.historico;
    const delta = h.length > 1 ? h[h.length - 2].pos - h[h.length - 1].pos : 0; /* positivo = subiu */
    return Object.assign({}, r, { delta, tendencia: delta > 0 ? 'ganhou posição' : delta < 0 ? 'perdeu posição' : 'estável',
      leitura: h.map(x => '#' + x.pos).join(' → '),
      analise: delta < 0 ? `O anúncio caiu de #${h[h.length - 2].pos} para #${h[h.length - 1].pos}. Fatores observados são hipóteses, não causa confirmada.` : null });
  }

  /* ---------- tags comerciais ---------- */
  function listingTags(cat, l) {
    const t = [];
    const st = { ATIVO: 'ATIVO', PAUSADO: 'PAUSADO', NAO_PUBLICADO: 'NÃO PUBLICADO', EM_REVISAO: 'EM REVISÃO', BLOQUEADO: 'COM ERRO', RASCUNHO: 'RASCUNHO' }[l.status] || l.status;
    t.push({ txt: st, kind: l.status === 'ATIVO' ? 'pos' : l.status === 'BLOQUEADO' ? 'neg' : l.status === 'RASCUNHO' ? 'info' : 'warn' });
    if (l.perf) {
      t.push({ txt: l.perf.vendidosTotal.toLocaleString('pt-BR') + ' vendidos', kind: '' });
      if (l.perf.vendidos30d) t.push({ txt: l.perf.vendidos30d + ' vendidos · 30d', kind: '' });
      const prev30 = l.perf.vendidos90d - l.perf.vendidos30d;
      if (prev30 > 0) {
        const g = Math.round(((l.perf.vendidos30d - prev30 / 2) / (prev30 / 2)) * 100);
        if (g >= 10) t.push({ txt: '+' + g + '% em 30d', kind: 'pos' });
        else if (g <= -10) t.push({ txt: '↓ ' + Math.abs(g) + '% em 30d', kind: 'neg' });
      }
    } else t.push({ txt: 'SEM DADOS', kind: '' });
    const rk = cat.rankings.find(x => x.listingId === l.id);
    if (rk) {
      t.push({ txt: '#' + rk.posicao, kind: rk.posicao <= 10 ? 'pos' : '' });
      const d = rankingDe(cat, l.id);
      if (d.delta > 0) t.push({ txt: '↑ ganhou posição', kind: 'pos' });
      else if (d.delta < 0) t.push({ txt: '↓ perdeu posição', kind: 'neg' });
    }
    if ((l.estoque || 0) === 0 && l.status === 'ATIVO') t.push({ txt: 'SEM ESTOQUE', kind: 'neg' });
    else if ((l.estoque || 0) > 0 && l.estoque <= 5) t.push({ txt: 'ESTOQUE CRÍTICO', kind: 'warn' });
    const si = salesInfo(cat, l);
    if (si.margemLiquida != null && si.margemLiquida < 12) t.push({ txt: 'MARGEM BAIXA', kind: 'warn' });
    if (l.perf && l.perf.devolucoes >= Math.max(2, l.perf.vendidos90d * 0.06)) t.push({ txt: 'DEVOLUÇÃO ALTA', kind: 'neg' });
    if (!fotosDe(cat, l.id).length) t.push({ txt: 'SEM FOTO', kind: 'warn' });
    const p = prodOf(cat, l);
    if (!p.master.pesoEmbaladoKg) t.push({ txt: 'ATRIBUTO PENDENTE', kind: 'warn' });
    return t;
  }

  /* ---------- busca e filtros ---------- */
  function searchListings(cat, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return ativos(cat);
    return ativos(cat).filter(l => {
      const p = prodOf(cat, l);
      return [p.nome, l.titulo, l.skuPai, l.id, l.itemIdExterno, l.ean, p.master.marca, p.categoria,
        ...(p.variacoes || []).map(v => v.sku), ...(p.variacoes || []).map(v => v.codigoBarras)]
        .some(v => v && String(v).toLowerCase().includes(q));
    });
  }

  const QUICK = {
    ativos: (cat, l) => l.status === 'ATIVO',
    pausados: (cat, l) => l.status === 'PAUSADO',
    nao_publicados: (cat, l) => l.status === 'NAO_PUBLICADO',
    rascunhos: (cat, l) => l.status === 'RASCUNHO',
    em_revisao: (cat, l) => l.status === 'EM_REVISAO',
    com_erro: (cat, l) => l.status === 'BLOQUEADO',
    sem_venda: (cat, l) => !l.perf || l.perf.vendidos90d === 0,
    mais_vendidos: null, mais_vendidos_7d: null, mais_vendidos_30d: null, mais_vendidos_90d: null,
    crescimento: (cat, l) => l.perf && l.perf.vendidos30d > (l.perf.vendidos90d - l.perf.vendidos30d) / 2 * 1.1,
    queda: (cat, l) => l.perf && l.perf.vendidos30d < (l.perf.vendidos90d - l.perf.vendidos30d) / 2 * 0.9 && l.perf.vendidos90d > 0,
    estoque_baixo: (cat, l) => (l.estoque || 0) > 0 && l.estoque <= 5,
    sem_estoque: (cat, l) => (l.estoque || 0) === 0,
    sem_foto: (cat, l) => !fotosDe(cat, l.id).length,
    sem_video: (cat, l) => !cat.media.some(m => m.tipo === 'video' && m.usos.some(u => u.listingId === l.id)),
    sem_peso: (cat, l) => !prodOf(cat, l).master.pesoEmbaladoKg,
    sem_marca: (cat, l) => !prodOf(cat, l).master.marca,
    sem_sku: (cat, l) => !l.skuPai,
    sem_ean: (cat, l) => !l.ean,
    sem_atributo: (cat, l) => !prodOf(cat, l).master.material || !prodOf(cat, l).master.pesoEmbaladoKg,
    sem_ranking: (cat, l) => !cat.rankings.some(r => r.listingId === l.id),
    pos_1_10: (cat, l) => { const r = cat.rankings.find(x => x.listingId === l.id); return r && r.posicao <= 10; },
    pos_11_50: (cat, l) => { const r = cat.rankings.find(x => x.listingId === l.id); return r && r.posicao > 10 && r.posicao <= 50; },
    perdeu_posicao: (cat, l) => { const d = cat.rankings.some(r => r.listingId === l.id) ? rankingDe(cat, l.id) : null; return d && d.delta < 0; },
    ganhou_posicao: (cat, l) => { const d = cat.rankings.some(r => r.listingId === l.id) ? rankingDe(cat, l.id) : null; return d && d.delta > 0; },
    ctr_baixo: (cat, l) => { const c = l.perf && convExp(l.perf.cliques, l.perf.impressoes, '').taxa; return c != null && c < 3.5; },
    conversao_baixa: (cat, l) => { const c = l.perf && convExp(l.perf.pedidosPagos, l.perf.visitas, '').taxa; return c != null && c < 1.6; },
    margem_baixa: (cat, l) => { const s = salesInfo(cat, l); return s.margemLiquida != null && s.margemLiquida < 12; },
    devolucao_alta: (cat, l) => l.perf && l.perf.devolucoes >= Math.max(2, l.perf.vendidos90d * 0.06),
    conflito_sku: (cat, l) => { const p = prodOf(cat, l); return (p.variacoes || []).some(v => v.conflito); },
    sem_master: (cat, l) => !l.anuncioMaster,
  };
  function quickFilter(cat, key, list) {
    list = list || ativos(cat);
    if (key === 'mais_recentes') return [...list].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    if (key === 'mais_antigos') return [...list].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    if (key === 'mais_vendidos') return [...list].sort((a, b) => ((b.perf || {}).vendidosTotal || 0) - ((a.perf || {}).vendidosTotal || 0));
    if (/^mais_vendidos_(7|30|90)d$/.test(key)) { const k = 'vendidos' + key.match(/(\d+)/)[1] + 'd'; return [...list].sort((a, b) => ((b.perf || {})[k] || 0) - ((a.perf || {})[k] || 0)); }
    const fn = QUICK[key];
    return fn ? list.filter(l => fn(cat, l)) : list;
  }

  /* ---------- visão geral ---------- */
  function overview(cat, importEng) {
    const ls = ativos(cat);
    const n = key => quickFilter(cat, key, ls).length;
    const K = (label, valor, extra) => Object.assign({ label, valor, fonte: 'NORMALIZED_INTERNAL_DATA', periodo: 'estado atual',
      marketplace: 'todos', cobertura: ls.length + ' anúncio(s)', qualidade: 'derivado do catálogo interno rotulado' }, extra || {});
    const kpis = [
      K('Produtos Master', cat.products.length), K('Anúncios totais', ls.length),
      K('Ativos', n('ativos')), K('Pausados', n('pausados')), K('Não publicados', n('nao_publicados')),
      K('Rascunhos', n('rascunhos')), K('Em revisão', n('em_revisao')), K('Com bloqueio', n('com_erro')),
      K('Sem venda', n('sem_venda'), { fonte: 'DEMO_FIXTURE', periodo: '90d' }),
      K('Com venda crescente', n('crescimento'), { fonte: 'DEMO_FIXTURE', periodo: '30d vs 30d ant.' }),
      K('Sem estoque', n('sem_estoque')), K('Estoque crítico', n('estoque_baixo')),
      K('Sem foto', n('sem_foto')), K('Sem peso', n('sem_peso')), K('Sem atributo obrigatório', n('sem_atributo')),
      K('Sem SKU', n('sem_sku')), K('SKU conflitante', n('conflito_sku')), K('Sem código de barras', n('sem_ean')),
      K('Margem baixa', n('margem_baixa')), K('Devolução alta', n('devolucao_alta'), { fonte: 'DEMO_FIXTURE', periodo: '90d' }),
      K('CTR baixo', n('ctr_baixo'), { fonte: 'DEMO_FIXTURE', periodo: '90d' }),
      K('Conversão baixa', n('conversao_baixa'), { fonte: 'DEMO_FIXTURE', periodo: '90d' }),
      K('Sem ranking registrado', n('sem_ranking'), { qualidade: 'ranking só existe com fonte, data, escopo e confiança' }),
    ];
    const importadas = importEng ? importEng.batches.filter(b => b.aplicado && b.det.destino === 'catalogo') : [];
    const fontes = {
      ultimaPorMkt: Object.fromEntries(MKTS.map(([k, nome]) => [nome, importadas.filter(b => b.escopo.marketplace === k).map(b => b.aplicado.em).pop() || 'nenhuma importação'])),
      ultimaImportacaoCadastro: importadas.length ? importadas[importadas.length - 1].aplicado.em : null,
      coberturaFontes: importadas.length + ' importação(ões) de cadastro aplicada(s)',
      anunciosDadosReais: importEng ? importEng.observations.length : 0,
      anunciosDadosSimulados: ls.filter(l => l.fonte === 'DEMO_FIXTURE').length,
      anunciosSemPerformance: ls.filter(l => !l.perf).length,
    };
    return { kpis, fontes };
  }

  /* ---------- saúde e pendências (cada fila abre no campo certo) ---------- */
  const FILAS = [
    ['sem_foto', 'Anúncios sem foto principal', 'Fotos e Vídeos'],
    ['sem_video', 'Anúncios sem vídeo', 'Fotos e Vídeos'],
    ['sem_peso', 'Anúncios sem peso', 'Envio e Logística'],
    ['sem_marca', 'Anúncios sem marca', 'Informação Básica'],
    ['sem_sku', 'Anúncios sem SKU', 'Especificações'],
    ['sem_ean', 'Anúncios sem código de barras', 'Especificações'],
    ['sem_atributo', 'Anúncios sem atributo obrigatório', 'Especificações'],
    ['conflito_sku', 'Anúncios com conflito de SKU', 'Lista de Variações'],
    ['sem_estoque', 'Anúncios com estoque zerado', 'Informações de Vendas'],
    ['estoque_baixo', 'Anúncios com estoque crítico', 'Informações de Vendas'],
    ['sem_venda', 'Anúncios sem venda', 'Performance Comercial'],
    ['ctr_baixo', 'Anúncios com CTR baixo', 'Performance Comercial'],
    ['conversao_baixa', 'Anúncios com conversão baixa', 'Performance Comercial'],
    ['devolucao_alta', 'Anúncios com devolução alta', 'Performance Comercial'],
    ['margem_baixa', 'Anúncios com margem baixa', 'Informações de Vendas'],
    ['pausados', 'Anúncios pausados', 'Informação Básica'],
    ['com_erro', 'Anúncios bloqueados', 'Informação Básica'],
    ['sem_ranking', 'Anúncios sem ranking registrado', 'Performance Comercial'],
    ['sem_master', 'Variações sem Anúncio Master', 'Comparar Marketplaces'],
  ];
  const health = cat => FILAS.map(([key, label, aba]) => ({ key, label, aba, itens: quickFilter(cat, key).map(l => l.id) }))
    .filter(f => f.itens.length);

  /* ---------- master × marketplaces ---------- */
  const CAMPOS_CMP = ['titulo', 'preco', 'estoque', 'pesoEmbaladoKg', 'marca', 'material', 'ean'];
  function masterVsListings(cat, produtoId) {
    const p = cat.products.find(x => x.id === produtoId);
    const ls = ativos(cat).filter(l => l.produtoId === produtoId);
    return CAMPOS_CMP.map(campo => {
      const masterVal = campo === 'preco' ? p.precoBase : campo === 'estoque' ? p.estoque : p.master[campo];
      const porMkt = ls.map(l => ({ marketplace: l.mktNome, mk: l.marketplace, valor: valorDe(cat, l, campo), listingId: l.id }));
      const difs = porMkt.filter(x => x.valor != null && masterVal != null && String(x.valor) !== String(masterVal));
      return { campo, master: masterVal, porMkt, conflito: difs.length > 0,
        fonte: 'NORMALIZED_INTERNAL_DATA', ultimaAtualizacao: p.atualizadoEm,
        acao: difs.length ? 'Revisar ' + difs.map(d => d.marketplace).join(', ') : null };
    });
  }

  function compareMkts(cat, produtoId) {
    const p = cat.products.find(x => x.id === produtoId);
    const ls = ativos(cat).filter(l => l.produtoId === produtoId);
    const linhas = [
      ['Título', l => valorDe(cat, l, 'titulo')],
      ['Fotos', l => fotosDe(cat, l.id).length + ' foto(s)'],
      ['Preço', l => valorDe(cat, l, 'preco')],
      ['Estoque', l => l.estoque],
      ['Margem líquida', l => { const s = salesInfo(cat, l); return s.margemLiquida != null ? s.margemLiquida + '%' : null; }],
      ['Status', l => l.status],
      ['Vendidos (90d)', l => l.perf ? l.perf.vendidos90d : null],
      ['CTR', l => { const c = perfComercial(cat, l); return c.semDados ? null : (c.ctr.taxa != null ? c.ctr.taxa + '% (' + c.ctr.formula + ')' : null); }],
      ['Conversão', l => { const c = perfComercial(cat, l); return c.semDados ? null : (c.conversaoVisitas.taxa != null ? c.conversaoVisitas.taxa + '% (' + c.conversaoVisitas.formula + ')' : null); }],
      ['Devoluções', l => l.perf ? l.perf.devolucoes : null],
      ['Ranking', l => { const r = cat.rankings.find(x => x.listingId === l.id); return r ? '#' + r.posicao + ' (' + r.fonte + ')' : null; }],
    ];
    const rows = linhas.map(([campo, fn]) => {
      const vals = ls.map(l => ({ mkt: l.mktNome, valor: fn(l) }));
      const set = new Set(vals.filter(v => v.valor != null).map(v => String(v.valor)));
      return { campo, valores: vals, divergente: set.size > 1 };
    });
    const oportunidades = [];
    const semAnuncio = MKTS.filter(([k]) => !ls.some(l => l.marketplace === k) || ls.find(l => l.marketplace === k && l.status === 'NAO_PUBLICADO'));
    if (p.estoque > 10 && semAnuncio.length)
      oportunidades.push('Estoque disponível sem anúncio em: ' + semAnuncio.map(([, n]) => n).join(', ') + ' — candidato a adaptação (rascunho interno)');
    const melhor = ls.filter(l => l.perf).sort((a, b) => b.perf.faturamento - a.perf.faturamento)[0];
    if (melhor) oportunidades.push('Canal com maior venda: ' + melhor.mktNome + ' (R$ ' + melhor.perf.faturamento + ' · fonte ' + melhor.perf.fonte + ')');
    return { produto: p, listings: ls, rows, divergencias: rows.filter(r => r.divergente).map(r => r.campo), oportunidades };
  }

  /* ---------- edição (por listing, nunca vaza para outro canal) ---------- */
  function editListing(cat, listingId, campo, valor, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    const antes = valorDe(cat, l, campo);
    if (String(antes ?? '') === String(valor ?? '')) return { changed: false };
    l.overrides[campo] = valor;
    l.atualizadoEm = HOJE;
    const v = { id: 'lv' + (++cat.seq), listingId, campo, antes, depois: valor, autor: opts.usuario || 'Marcos', em: HOJE, origem: 'EDIÇÃO INTERNA' };
    l.versoes.push(v);
    cat._ev(listingId, campoEv(campo), `${campo}: "${antes ?? '—'}" → "${valor}"`, { autor: v.autor });
    cat._audit('listing_editado', `${listingId} · ${campo} (${l.mktNome}) — demais canais intactos`, { listingId });
    return { changed: true, version: v, nota: 'edição vale só para ' + l.mktNome + ' — nenhum outro marketplace foi tocado' };
  }
  const campoEv = c => c === 'preco' ? 'Preço alterado' : c === 'estoque' ? 'Estoque atualizado' : c === 'titulo' ? 'Título alterado' : c === 'descricao' ? 'Descrição alterada' : 'Atributo corrigido';

  /* campo importado nunca é sobrescrito em silêncio: vira MANUAL_CORRECTION */
  function correctListingField(cat, listingId, campo, valor, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const m = exigeMotivo(opts.motivo); if (m) return m;
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    const entrada = { campo, antes: valorDe(cat, l, campo), depois: valor, motivo: opts.motivo,
      autor: opts.usuario || 'Marcos', em: HOJE, origem: 'MANUAL_CORRECTION' };
    l.correcoes.push(entrada);
    cat._ev(listingId, 'Correção manual aplicada', `${campo}: "${entrada.antes}" → "${valor}" · ${opts.motivo}`, { autor: entrada.autor });
    cat._audit('correcao_manual', `${listingId} · ${campo} · motivo: ${opts.motivo}`, { listingId });
    return { ok: true, correcao: entrada, nota: 'valor importado preservado — a correção é camada MANUAL_CORRECTION' };
  }

  function editMasterSafe(cat, produtoId, campo, valor, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const p = cat.products.find(x => x.id === produtoId);
    if (!p) return { blocked: true, reason: 'produto não encontrado' };
    const antes = p.master[campo];
    p.master[campo] = valor;
    const preservados = ativos(cat).filter(l => l.produtoId === produtoId &&
      (l.overrides[campo] !== undefined || (l.marketplace && p.mkt[l.marketplace] && p.mkt[l.marketplace].profile[campo] !== undefined)))
      .map(l => l.mktNome);
    cat._ev(produtoId, 'Atributo corrigido', `master.${campo}: "${antes ?? '—'}" → "${valor}"`, { autor: opts.usuario || 'Marcos' });
    cat._audit('master_editado', `${produtoId} · ${campo} · customizações preservadas: ${preservados.join(', ') || 'nenhuma'}`, { produtoId });
    return { changed: true, antes, preservados, nota: 'customizações específicas de marketplace NÃO foram apagadas' };
  }

  /* ---------- variações ---------- */
  function addVariation(cat, produtoId, v, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const p = cat.products.find(x => x.id === produtoId);
    const dup = cat.products.flatMap(x => x.variacoes || []).find(x => x.sku === v.sku && !x.arquivada);
    if (dup) {
      cat._audit('variacao_conflito_sku', `${produtoId}: SKU ${v.sku} já existe em ${dup.id} — conflito explícito, nada criado`);
      return { blocked: true, conflito: true, reason: `SKU ${v.sku} já existe (${dup.id}) — duplicidade de SKU no mesmo escopo exige conflito explícito` };
    }
    const nv = Object.assign({ id: produtoId + '-v' + ((p.variacoes || []).length + 1), status: 'ATIVA', ordem: (p.variacoes || []).length, arquivada: null, vendidos: 0, pedidosPagos: 0 }, v);
    p.variacoes.push(nv);
    cat._ev(produtoId, 'Variação criada', nv.nome + ' (' + nv.sku + ')', { autor: opts.usuario || 'Marcos' });
    return { ok: true, variacao: nv };
  }
  function editVariation(cat, produtoId, varId, campo, valor, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const p = cat.products.find(x => x.id === produtoId);
    const v = (p.variacoes || []).find(x => x.id === varId);
    if (!v) return { blocked: true, reason: 'variação não encontrada' };
    if (campo === 'sku' && cat.products.flatMap(x => x.variacoes || []).some(x => x.id !== varId && x.sku === valor && !x.arquivada))
      return { blocked: true, conflito: true, reason: 'SKU já usado por outra variação — conflito explícito' };
    const antes = v[campo]; v[campo] = valor;
    cat._ev(produtoId, 'Atributo corrigido', `variação ${v.nome}.${campo}: "${antes ?? '—'}" → "${valor}"`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, antes };
  }
  function archiveVariation(cat, produtoId, varId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ARCHIVE')) return negar(opts.papel, 'CATALOG_ARCHIVE');
    const m = exigeMotivo(opts.motivo); if (m) return m;
    const p = cat.products.find(x => x.id === produtoId);
    const v = (p.variacoes || []).find(x => x.id === varId);
    if (!v) return { blocked: true, reason: 'variação não encontrada' };
    v.arquivada = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE };
    cat._ev(produtoId, 'Variação arquivada', v.nome + ' · ' + opts.motivo, { autor: opts.usuario || 'Marcos' });
    return { ok: true, nota: 'variação arquivada — histórico e vendas preservados' };
  }

  /* ---------- mídia (por anúncio; nunca vaza entre marketplaces) ---------- */
  const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov'];
  function addMedia(cat, meta, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_MEDIA_UPLOAD')) return negar(opts.papel, 'CATALOG_MEDIA_UPLOAD');
    const ext = (String(meta.arquivo).match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!IMG_EXT.includes(ext)) return { blocked: true, reason: `formato ${ext || 'desconhecido'} não aceito para mídia (fotos/vídeos)` };
    const md = { id: 'md' + (++cat.seq), arquivo: meta.arquivo, tipo: /mp4|mov/.test(ext) ? 'video' : 'foto',
      subtipo: meta.subtipo || 'oficial', origem: meta.origem || 'IMPORTAÇÃO_MANUAL', em: HOJE,
      usuario: opts.usuario || 'Marcos', produtoId: meta.produtoId, status: meta.listingId ? 'EM USO' : 'SEM USO',
      dims: meta.dims || null, pesoKb: meta.pesoKb || null, dataUrl: meta.dataUrl || null, usos: [] };
    if (meta.listingId) md.usos.push({ listingId: meta.listingId, posicao: fotosDe(cat, meta.listingId).length, principal: fotosDe(cat, meta.listingId).length === 0 });
    cat.media.push(md);
    cat._ev(meta.listingId || meta.produtoId, 'Foto adicionada', md.arquivo + ' (' + md.origem + ')', { autor: md.usuario });
    cat._audit('midia_adicionada', md.arquivo + ' → ' + (meta.listingId || 'biblioteca'), { mediaId: md.id });
    return { ok: true, media: md };
  }
  function setPrincipal(cat, listingId, mediaId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    for (const m of cat.media) for (const u of m.usos) if (u.listingId === listingId) u.principal = m.id === mediaId;
    cat._ev(listingId, 'Foto adicionada', 'foto principal alterada para ' + mediaId, { autor: opts.usuario || 'Marcos' });
    return { ok: true };
  }
  function removeFromListing(cat, listingId, mediaId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_MEDIA_REMOVE')) return negar(opts.papel, 'CATALOG_MEDIA_REMOVE');
    const md = cat.media.find(m => m.id === mediaId);
    if (!md) return { blocked: true, reason: 'mídia não encontrada' };
    md.usos = md.usos.filter(u => u.listingId !== listingId);
    if (!md.usos.length) md.status = 'SEM USO';
    cat._ev(listingId, 'Foto removida', md.arquivo + ' removida deste anúncio — outros marketplaces intactos; arquivo permanece na biblioteca', { autor: opts.usuario || 'Marcos' });
    return { ok: true, nota: 'removida só deste anúncio — a mídia continua na biblioteca e nos demais canais' };
  }
  const mediaUsage = (cat, mediaId) => (cat.media.find(m => m.id === mediaId) || { usos: [] }).usos
    .map(u => ({ listingId: u.listingId, marketplace: (byId(cat, u.listingId) || {}).mktNome, principal: u.principal, posicao: u.posicao }));

  /* ---------- duplicar e adaptar (rascunho interno; original intacto) ---------- */
  const ADAPT_RULES = {
    ml: { nome: 'Mercado Livre', tituloMax: 60, exige: ['ean', 'marca'], video: false,
      regra: 'ML exige EAN/GTIN e marca; título até 60 caracteres', fonteRegra: 'pack interno de regras (provisório — validar na integração oficial)', confianca: 'média' },
    shopee: { nome: 'Shopee', tituloMax: 120, exige: ['pesoEmbaladoKg'], video: false,
      regra: 'Shopee exige peso embalado para cálculo de frete', fonteRegra: 'pack interno de regras (provisório)', confianca: 'média' },
    tiktok: { nome: 'TikTok Shop', tituloMax: 80, exige: ['pesoEmbaladoKg'], video: true,
      regra: 'TikTok Shop performa com vídeo; peso obrigatório', fonteRegra: 'pack interno de regras (provisório)', confianca: 'baixa — canal novo' },
    magalu: { nome: 'Magalu', tituloMax: 100, exige: ['ean', 'marca'], video: false,
      regra: 'Magalu exige EAN e marca cadastrada', fonteRegra: 'pack interno de regras (provisório)', confianca: 'média' },
  };

  function duplicateListing(cat, listingId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ADAPT_CREATE')) return negar(opts.papel, 'CATALOG_ADAPT_CREATE');
    const orig = byId(cat, listingId);
    if (!orig) return { blocked: true, reason: 'anúncio não encontrado' };
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = orig.id + '-copy' + (++cat.seq);
    copy.status = 'RASCUNHO'; copy.interno = true; copy.itemIdExterno = null;
    copy.criadoEm = HOJE; copy.atualizadoEm = HOJE; copy.versoes = []; copy.perf = null;
    copy.origem = 'CÓPIA INTERNA de ' + orig.id; copy.fonte = 'NORMALIZED_INTERNAL_DATA';
    cat.listings.push(copy);
    cat._ev(copy.id, 'Anúncio publicado internamente', 'cópia interna de ' + orig.id + ' — original intacto', { autor: opts.usuario || 'Marcos' });
    cat._audit('anuncio_duplicado', orig.id + ' → ' + copy.id + ' (rascunho interno; original preservado)');
    return { ok: true, copia: copy, original: orig };
  }

  function adaptListing(cat, listingId, targetMkt, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ADAPT_CREATE')) return negar(opts.papel, 'CATALOG_ADAPT_CREATE');
    const orig = byId(cat, listingId);
    const rule = ADAPT_RULES[targetMkt];
    if (!orig || !rule) return { blocked: true, reason: 'anúncio ou marketplace alvo inválido' };
    if (orig.marketplace === targetMkt) return { blocked: true, reason: 'anúncio já é deste marketplace — use duplicar' };
    const p = prodOf(cat, orig);
    const levado = [], adaptado = [], pendente = [], incompativel = [];
    let titulo = valorDe(cat, orig, 'titulo');
    levado.push('descrição', 'variações', 'preço como referência', 'mídia validada');
    if (titulo.length > rule.tituloMax) { titulo = titulo.slice(0, rule.tituloMax - 1) + '…'; adaptado.push(`título encurtado para ${rule.tituloMax} caracteres`); }
    else adaptado.push('título revisado para o padrão do canal');
    for (const campo of rule.exige) {
      const val = campo === 'ean' ? p.master.ean : p.master[campo];
      if (!val) pendente.push(campo + ' obrigatório no ' + rule.nome + ' — preenchimento humano necessário');
    }
    if (rule.video && !cat.media.some(m => m.tipo === 'video' && m.produtoId === p.id))
      pendente.push('vídeo recomendado/obrigatório no ' + rule.nome + ' — nenhum vídeo na biblioteca');
    if (p.tipo === 'SOB_ENCOMENDA' && targetMkt === 'shopee')
      incompativel.push('modalidade sob encomenda incompatível com envio padrão Shopee (regra provisória)');
    const draft = {
      id: 'L-' + p.id + '-' + targetMkt + '-adapt' + (++cat.seq), produtoId: p.id,
      marketplace: targetMkt, mktNome: rule.nome, lojaId: null, contaId: null, itemIdExterno: null,
      status: 'RASCUNHO', interno: true, titulo, preco: valorDe(cat, orig, 'preco'), precoPromo: null,
      estoque: orig.estoque, skuPai: orig.skuPai, ean: p.master.ean,
      criadoEm: HOJE, atualizadoEm: HOJE, overrides: {}, correcoes: [], versoes: [], arquivado: null, excluidoDaAnalise: null,
      fonte: 'NORMALIZED_INTERNAL_DATA', origem: 'ADAPTAÇÃO INTERNA de ' + orig.id, perf: null,
      adaptacao: { de: orig.id, para: rule.nome, levado, adaptado, pendente, incompativel,
        regra: rule.regra, fonteRegra: rule.fonteRegra, confianca: rule.confianca,
        revisao: 'AGUARDANDO REVISÃO HUMANA — nada é publicado externamente' },
    };
    /* mídia validada acompanha, sem tocar o original */
    for (const { media } of fotosDe(cat, orig.id)) media.usos.push({ listingId: draft.id, posicao: media.usos.length, principal: media.usos.some(u => u.listingId === orig.id && u.principal) });
    cat.listings.push(draft);
    cat._ev(draft.id, 'Anúncio adaptado', orig.id + ' → ' + rule.nome + ' (rascunho interno; ' + pendente.length + ' pendência(s))', { autor: opts.usuario || 'Marcos' });
    cat._audit('anuncio_adaptado', orig.id + ' → ' + draft.id + ' · pendentes: ' + (pendente.join('; ') || 'nenhum'));
    return { ok: true, draft, original: orig };
  }

  function cancelDraft(cat, listingId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const l = byId(cat, listingId);
    if (!l || l.status !== 'RASCUNHO') return { blocked: true, reason: 'só rascunhos internos podem ser cancelados' };
    l.arquivado = { motivo: opts.motivo || 'rascunho cancelado', por: opts.usuario || 'Marcos', em: HOJE };
    cat._ev(listingId, 'Anúncio pausado internamente', 'rascunho cancelado — trilha preservada', { autor: opts.usuario || 'Marcos' });
    return { ok: true };
  }

  /* ---------- edição em massa (prévia → job auditável → rollback) ---------- */
  function bulkPreview(cat, listingIds, campo, valorNovo) {
    const rows = listingIds.map(id => {
      const l = byId(cat, id);
      if (!l) return { listingId: id, incompativel: 'anúncio não encontrado' };
      if (campo === 'preco' && (l.status === 'BLOQUEADO'))
        return { listingId: id, marketplace: l.mktNome, incompativel: 'anúncio bloqueado — resolver bloqueio antes de editar preço' };
      const antes = valorDe(cat, l, campo);
      const conflito = campo === 'preco' && valorNovo != null && salesInfo(cat, l).precoMinimoSeguro > +valorNovo
        ? 'preço abaixo do mínimo seguro (' + salesInfo(cat, l).precoMinimoSeguro + ')' : null;
      return { listingId: id, marketplace: l.mktNome, lojaId: l.lojaId, contaId: l.contaId, antes, depois: valorNovo, conflito };
    });
    return { campo, valorNovo, rows,
      elegiveis: rows.filter(r => !r.incompativel && !r.conflito).length,
      conflitos: rows.filter(r => r.conflito).length, incompativeis: rows.filter(r => r.incompativel).length,
      escopo: { marketplaces: [...new Set(rows.map(r => r.marketplace).filter(Boolean))], lojas: [...new Set(rows.map(r => r.lojaId).filter(Boolean))], contas: [...new Set(rows.map(r => r.contaId).filter(Boolean))] },
      nota: 'prévia interna — nada será publicado externamente' };
  }

  function bulkCommit(cat, preview, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_BULK_EDIT')) return negar(opts.papel, 'CATALOG_BULK_EDIT');
    const aplicaveis = preview.rows.filter(r => !r.incompativel && !r.conflito);
    if (!aplicaveis.length) return { blocked: true, reason: 'nenhum anúncio elegível na prévia' };
    const job = { id: 'bj' + (++cat.seq), campo: preview.campo, valorNovo: preview.valorNovo,
      itens: aplicaveis.map(r => ({ listingId: r.listingId, antes: r.antes })),
      pulados: preview.rows.length - aplicaveis.length,
      autor: opts.usuario || 'Marcos', em: HOJE, status: 'APLICADO', reversivel: true, externo: 'ESCRITA EXTERNA BLOQUEADA' };
    for (const r of aplicaveis) {
      const l = byId(cat, r.listingId);
      l.overrides[preview.campo] = preview.valorNovo;
      l.versoes.push({ id: 'lv' + (++cat.seq), listingId: l.id, campo: preview.campo, antes: r.antes, depois: preview.valorNovo, autor: job.autor, em: HOJE, origem: 'EDIÇÃO EM MASSA ' + job.id });
    }
    cat.bulkJobs.push(job);
    cat._audit('bulk_editado', `${job.id}: ${preview.campo} em ${aplicaveis.length} anúncio(s) · ${job.pulados} pulado(s) · interno`, { jobId: job.id });
    return { ok: true, job };
  }

  function bulkRollback(cat, jobId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ROLLBACK')) return negar(opts.papel, 'CATALOG_ROLLBACK');
    const job = cat.bulkJobs.find(j => j.id === jobId);
    if (!job || job.status !== 'APLICADO') return { blocked: true, reason: 'job não encontrado ou já revertido' };
    let restaurados = 0;
    for (const it of job.itens) {
      const l = byId(cat, it.listingId);
      if (!l) continue;
      if (it.antes === undefined || it.antes === null) delete l.overrides[job.campo];
      else l.overrides[job.campo] = it.antes;
      l.versoes.push({ id: 'lv' + (++cat.seq), listingId: l.id, campo: job.campo, antes: job.valorNovo, depois: it.antes, autor: opts.usuario || 'Marcos', em: HOJE, origem: 'ROLLBACK ' + jobId });
      restaurados++;
    }
    job.status = 'REVERTIDO';
    cat._ev(jobId, 'Rollback executado', restaurados + ' anúncio(s) restaurados ao valor anterior', { autor: opts.usuario || 'Marcos' });
    cat._audit('bulk_rollback', `${jobId}: ${restaurados} restaurado(s)`, { jobId });
    return { ok: true, restaurados };
  }

  /* ---------- arquivamento seguro ---------- */
  function archiveListing(cat, listingId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ARCHIVE')) return negar(opts.papel, 'CATALOG_ARCHIVE');
    const m = exigeMotivo(opts.motivo); if (m) return m;
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    l.arquivado = { motivo: opts.motivo, por: opts.usuario || 'Marcos', em: HOJE, restauravel: true };
    cat._ev(listingId, 'Anúncio pausado internamente', 'arquivado: ' + opts.motivo + ' — histórico e versões preservados', { autor: opts.usuario || 'Marcos' });
    cat._audit('listing_arquivado', listingId + ' · ' + opts.motivo, { listingId });
    return { ok: true, nota: 'arquivado sem apagar histórico — restauração disponível' };
  }
  function restoreListing(cat, listingId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ARCHIVE')) return negar(opts.papel, 'CATALOG_ARCHIVE');
    const l = cat.listings.find(x => x.id === listingId);
    if (!l || !l.arquivado) return { blocked: true, reason: 'nada a restaurar' };
    l.arquivado = null;
    cat._audit('listing_restaurado', listingId, { listingId });
    return { ok: true };
  }

  /* ---------- histórico ---------- */
  const timelineDe = (cat, ref) => cat.timeline.filter(e => e.ref === ref || (byId(cat, ref) && e.ref === byId(cat, ref).produtoId));
  function versionsCompare(cat, listingId) {
    const l = byId(cat, listingId);
    if (!l) return [];
    return l.versoes.map(v => ({ campo: v.campo, anterior: v.antes, atual: v.depois, autor: v.autor, origem: v.origem, em: v.em,
      impacto: 'impacto observado só quando houver dado — nunca afirmamos causalidade sem evidência' }));
  }

  return { FONTES, MKTS: MKTS.map(([key, nome]) => ({ key, nome })), CATALOG_PERMS, CATALOG_PERMS_ALL, canCat,
    createCatalog, byId, prodOf, ativos, valorDe, fotosDe, salesInfo, perfComercial, convExp,
    assertRanking, rankingDe, listingTags, searchListings, quickFilter, overview, health, FILAS,
    masterVsListings, compareMkts, editListing, correctListingField, editMasterSafe,
    addVariation, editVariation, archiveVariation, addMedia, setPrincipal, removeFromListing, mediaUsage,
    ADAPT_RULES, duplicateListing, adaptListing, cancelDraft,
    bulkPreview, bulkCommit, bulkRollback, archiveListing, restoreListing, timelineDe, versionsCompare };
}));

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
    /* 10.E.3.1 — sem custo cadastrado (ex.: anúncio importado) não inventa margem */
    const temCusto = p.custo != null;
    const margemBruta = (preco && temCusto) ? round2(((preco - p.custo) / preco) * 100) : null;
    const liquida = (preco && temCusto) ? round2(((preco - p.custo - comissao - taxaFixa - imposto) / preco) * 100) : null;
    const minimoSeguro = temCusto ? round2((p.custo + taxaFixa) / (1 - 0.14 - 0.07 - 0.10)) : null; /* custo+taxas+10% margem mínima */
    const alertas = [];
    if (liquida != null && liquida < 10) alertas.push('Preço abaixo da margem mínima segura');
    if (l.perf && l.perf.vendidos30d > 5 && liquida != null && liquida < 15) alertas.push('Produto vende, mas a margem é insuficiente');
    if (l.perf && l.perf.vendidos30d > 5 && (l.estoque || 0) <= 3) alertas.push('Produto vende bem e está quase sem estoque');
    if (l.perf && l.perf.devolucoes >= Math.max(2, l.perf.vendidos90d * 0.06)) alertas.push('Produto vende e tem devolução alta');
    if (l.perf && l.perf.impressoes > 20000 && convExp(l.perf.pedidosPagos, l.perf.visitas, '').taxa < 1.5) alertas.push('Alta exposição com baixa conversão');
    return { preco, custo: p.custo, comissao, taxaFixa, imposto, margemBruta, margemLiquida: liquida,
      precoMinimoSeguro: minimoSeguro, precoRecomendado: minimoSeguro != null ? round2(minimoSeguro * 1.35) : null, alertas,
      semCusto: !temCusto, fonte: 'NORMALIZED_INTERNAL_DATA', formulaMargem: '(preço − custo − comissão − taxa − imposto) ÷ preço' };
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

  /* =============================================================
     10.E.3.1 (redesign) — STATUS NATIVO × STATUS OPERACIONAL HEAD
     Preserva o status como veio do marketplace/planilha e traduz para
     um estado comum comparável entre canais. Regra explícita, origem,
     confiança e possibilidade de revisão manual. Nunca "ao vivo".
     ============================================================= */
  const STATUS_OPERACIONAL = ['PUBLICADO_E_ATIVO', 'PUBLICADO_COM_ATENÇÃO', 'PAUSADO_PELO_VENDEDOR', 'PAUSADO_PELO_MARKETPLACE',
    'NÃO_PUBLICADO', 'EM_ANÁLISE', 'EM_REVISÃO', 'COM_PENDÊNCIA_DE_CADASTRO', 'COM_VIOLAÇÃO_OU_RESTRIÇÃO',
    'BLOQUEADO_EXTERNAMENTE', 'RASCUNHO_INTERNO', 'ARQUIVADO_INTERNAMENTE', 'STATUS_DESCONHECIDO'];
  /* frases nativas conhecidas (Shopee/Mercado Livre) → estado Head */
  const NATIVO_TO_HEAD = [
    [/viola|banido|infra[cç]/i, 'COM_VIOLAÇÃO_OU_RESTRIÇÃO'],
    [/sob an[aá]lise|under review|an[aá]lise da shopee|pending/i, 'EM_ANÁLISE'],
    [/revisar|para revisar|revis[aã]o|quality|objetivo de qualidade/i, 'EM_REVISÃO'],
    [/padroniza/i, 'PUBLICADO_COM_ATENÇÃO'],
    [/pausado pelo marketplace|pausado pela|deactivated by/i, 'PAUSADO_PELO_MARKETPLACE'],
    [/pausado|paused|inativo|inactive/i, 'PAUSADO_PELO_VENDEDOR'],
    [/n[ãa]o publicado|unlisted|rascunho|draft/i, 'NÃO_PUBLICADO'],
    [/bloquead|blocked|suspenso/i, 'BLOQUEADO_EXTERNAMENTE'],
    [/ativo|active|normal|live|publicad/i, 'PUBLICADO_E_ATIVO'],
    [/desconhecid|unknown/i, 'STATUS_DESCONHECIDO'],
  ];
  const STATUS_INTERNO_TO_HEAD = { ATIVO: 'PUBLICADO_E_ATIVO', PAUSADO: 'PAUSADO_PELO_VENDEDOR', NAO_PUBLICADO: 'NÃO_PUBLICADO',
    EM_REVISAO: 'EM_REVISÃO', BLOQUEADO: 'COM_VIOLAÇÃO_OU_RESTRIÇÃO', RASCUNHO: 'RASCUNHO_INTERNO' };
  function statusOperacional(l) {
    /* texto nativo = SOMENTE string vinda do marketplace/planilha (nunca o enum interno) */
    const nativoTexto = l.statusNativo || l.statusReportado || null;
    const nativo = nativoTexto || l.status || null;
    if (l.arquivado) return { nativo: nativoTexto || 'arquivado', head: 'ARQUIVADO_INTERNAMENTE',
      regra: 'anúncio arquivado internamente pelo time', origem: 'REGRA DE NORMALIZAÇÃO HEAD', confianca: 'alta', revisavel: true, marketplace: l.mktNome, conta: l.contaId };
    let head = null, regra = null, confianca = 'média';
    /* 1º: status interno canônico (demo/converge) tem regra direta */
    if (STATUS_INTERNO_TO_HEAD[l.status]) { head = STATUS_INTERNO_TO_HEAD[l.status]; regra = 'status interno "' + l.status + '" → ' + head; confianca = 'alta'; }
    /* 2º: refina com o texto NATIVO real (violação/análise/revisão pesam mais) */
    if (nativoTexto) for (const [re, h] of NATIVO_TO_HEAD) if (re.test(nativoTexto)) { head = h; regra = 'status nativo "' + nativoTexto + '" casa com regra ' + h; confianca = 'alta'; break; }
    if (l.motivo && /viola|restri|bloque/i.test(l.motivo)) { head = 'COM_VIOLAÇÃO_OU_RESTRIÇÃO'; regra = 'motivo do marketplace: ' + l.motivo; }
    if (!head) { head = 'STATUS_DESCONHECIDO'; regra = 'sem regra aplicável ao status "' + (nativo || '—') + '"'; confianca = 'baixa'; }
    return { nativo: nativo || '—', head, regra, origem: 'REGRA DE NORMALIZAÇÃO HEAD', confianca,
      revisavel: true, marketplace: l.mktNome, conta: l.contaId,
      fonte: l.fonte, situacao: l.situacao || (l.cadastroImportado ? 'STATUS REPORTADO POR PLANILHA' : 'estado interno do catálogo') };
  }

  /* ---------- DIAGNÓSTICO DO PRODUTO (só o que o dado sustenta) ---------- */
  const REF = { ctr: 1.0, conversao: 1.5, devolucao: 6 }; /* referências internas (percentuais) */
  function diagnosticoProduto(cat, l) {
    const p = prodOf(cat, l);
    const out = [];
    const add = (tipo, fato, extra) => out.push(Object.assign({ tipo, fato, fonte: (l.perf && l.perf.fonte) || l.fonte || 'NORMALIZED_INTERNAL_DATA',
      periodo: l.perf ? (l.perf.periodo.ini + ' a ' + l.perf.periodo.fim) : 'estado atual', marketplace: l.mktNome, conta: l.contaId || '—',
      confianca: l.perf ? 'alta — dado importado/observado' : 'média — cadastro interno' }, extra || {}));
    const pf = l.perf;
    if (pf) {
      const conv = pf.visitas ? (pf.pedidosPagos / pf.visitas) * 100 : null;
      const ctr = pf.impressoes ? (pf.cliques / pf.impressoes) * 100 : null;
      if (pf.vendidos90d === 0) add('Produto sem venda', 'nenhuma venda no período com performance vinculada', { campos: ['vendidos90d'], acao: 'revisar preço, foto e posição', impacto: 'faturamento nulo' });
      if (pf.impressoes > 20000 && conv != null && conv < REF.conversao) add('Alto tráfego com baixa conversão', `${pf.impressoes} impressões e conversão ${round2(conv)}% (< ${REF.conversao}%)`, { campos: ['impressoes', 'pedidosPagos', 'visitas'], hipotese: 'preço, imagem, avaliação ou ficha podem influenciar — hipótese, não causa confirmada', confianca: 'média', acao: 'testar imagem/preço e revisar ficha', impacto: 'perda de conversão sobre tráfego pago' });
      if (ctr != null && ctr < REF.ctr) add('CTR abaixo da referência interna', `CTR ${round2(ctr)}% (< ${REF.ctr}%) — cliques ÷ impressões`, { campos: ['cliques', 'impressoes'], hipotese: 'thumbnail/título/preço podem influenciar', acao: 'revisar foto de capa e título' });
      if (conv != null && conv < REF.conversao && pf.impressoes <= 20000) add('Conversão abaixo da referência interna', `conversão ${round2(conv)}% (< ${REF.conversao}%)`, { campos: ['pedidosPagos', 'visitas'], acao: 'revisar ficha e prova social' });
      if (pf.vendidos30d > 5 && (l.estoque || 0) <= 3) add('Muitas vendas e estoque crítico', `${pf.vendidos30d} vendas em 30d com estoque ${l.estoque}`, { campos: ['vendidos30d', 'estoque'], acao: 'repor estoque com prioridade', impacto: 'risco de ruptura e perda de posição', confianca: 'alta' });
      if (pf.devolucoes != null && pf.pedidosPagos && (pf.devolucoes / pf.pedidosPagos) * 100 > REF.devolucao) add('Devolução acima da média', `${pf.devolucoes} devoluções sobre ${pf.pedidosPagos} pagos`, { campos: ['devolucoes', 'pedidosPagos'], acao: 'checar expectativa × produto e embalagem' });
      const si = salesInfo(cat, l);
      if (pf.vendidos30d > 5 && si.margemLiquida != null && si.margemLiquida < 15) add('Muitas vendas e margem baixa', `margem líquida ${si.margemLiquida}% com ${pf.vendidos30d} vendas/30d`, { campos: ['preco', 'custo'], acao: 'revisar preço/custo antes de acelerar', impacto: 'crescimento sem lucro' });
    } else if (l.cadastroImportado || l.itemIdExterno) {
      add('Sem performance vinculada', 'não há correspondência confirmada por item_id, SKU ou vínculo humano', { campos: ['item_id', 'sku'], confianca: 'alta — ausência declarada', acao: 'confirmar vínculo em Comparar Marketplaces / Pedidos' });
    }
    /* cadastro (independe de performance) */
    if (!fotoPrincipal(cat, l)) add('Foto insuficiente', 'sem foto principal validada neste anúncio', { campos: ['fotos'], acao: 'adicionar/validar foto principal', aba: 'Fotos e Vídeos' });
    if (!valorDe(cat, l, 'ean') && !(p && p.master.ean)) add('GTIN inválido ou ausente', 'sem EAN/GTIN registrado', { campos: ['ean'], acao: 'informar código de barras', aba: 'Informações Fiscais' });
    if (!valorDe(cat, l, 'pesoEmbaladoKg') && !(p && p.master.pesoEmbaladoKg)) add('Cadastro incompleto', 'peso embalado ausente', { campos: ['pesoEmbaladoKg'], acao: 'informar peso', aba: 'Envio e Logística' });
    return out;
  }
  const fotoPrincipal = (cat, l) => cat.media.some(m => m.usos.some(u => u.listingId === l.id && u.principal) && m.status !== 'MÍDIA REFERENCIADA');
  const TAG_HEAD = { PUBLICADO_E_ATIVO: 'ATIVO', PUBLICADO_COM_ATENÇÃO: 'ATENÇÃO', PAUSADO_PELO_VENDEDOR: 'PAUSADO POR MIM',
    PAUSADO_PELO_MARKETPLACE: 'PAUSADO PELO MARKETPLACE', 'NÃO_PUBLICADO': 'NÃO PUBLICADO', 'EM_ANÁLISE': 'EM ANÁLISE',
    'EM_REVISÃO': 'EM REVISÃO', 'COM_PENDÊNCIA_DE_CADASTRO': 'REVISAR CADASTRO', 'COM_VIOLAÇÃO_OU_RESTRIÇÃO': 'VIOLAÇÃO',
    BLOQUEADO_EXTERNAMENTE: 'BLOQUEADO', RASCUNHO_INTERNO: 'RASCUNHO', ARQUIVADO_INTERNAMENTE: 'ARQUIVADO', STATUS_DESCONHECIDO: 'STATUS?' };

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

  /* =============================================================
     10.E.3.3 — CATÁLOGO OPERACIONAL COMPLETO
     Matriz da Loja → Rascunho → Mídia real → Validação → Aprovação →
     Publicação controlada → Identidade externa (Item ID + SKU) →
     SKU como chave de inteligência + criativos + experimentos.
     ============================================================= */

  /* ---------- ciclo de vida rastreável do anúncio (16 estados) ---------- */
  const LIFECYCLE = ['MATRIZ_DA_LOJA', 'RASCUNHO_DA_LOJA', 'RASCUNHO_DO_MARKETPLACE', 'AGUARDANDO_COMPLEMENTO',
    'AGUARDANDO_REVISAO', 'PRONTO_PARA_APROVACAO', 'PRONTO_PARA_PUBLICACAO', 'PUBLICACAO_SOLICITADA',
    'EM_ANALISE_NO_MARKETPLACE', 'PUBLICADO_E_ATIVO', 'NAO_PUBLICADO', 'PAUSADO_PELO_VENDEDOR',
    'PAUSADO_PELO_MARKETPLACE', 'COM_VIOLACAO_OU_RESTRICAO', 'COM_ERRO_DE_PUBLICACAO', 'ARQUIVADO_INTERNO'];
  /* transições permitidas — publicação nunca "pula" para ativo sem retorno oficial */
  const TRANSICOES = {
    MATRIZ_DA_LOJA: ['RASCUNHO_DO_MARKETPLACE', 'RASCUNHO_DA_LOJA'],
    RASCUNHO_DA_LOJA: ['RASCUNHO_DO_MARKETPLACE', 'ARQUIVADO_INTERNO'],
    RASCUNHO_DO_MARKETPLACE: ['AGUARDANDO_COMPLEMENTO', 'AGUARDANDO_REVISAO', 'ARQUIVADO_INTERNO'],
    AGUARDANDO_COMPLEMENTO: ['AGUARDANDO_REVISAO', 'RASCUNHO_DO_MARKETPLACE'],
    AGUARDANDO_REVISAO: ['PRONTO_PARA_APROVACAO', 'AGUARDANDO_COMPLEMENTO'],
    PRONTO_PARA_APROVACAO: ['PRONTO_PARA_PUBLICACAO', 'AGUARDANDO_REVISAO'],
    PRONTO_PARA_PUBLICACAO: ['PUBLICACAO_SOLICITADA', 'PRONTO_PARA_APROVACAO'],
    PUBLICACAO_SOLICITADA: ['EM_ANALISE_NO_MARKETPLACE', 'COM_ERRO_DE_PUBLICACAO'],
    EM_ANALISE_NO_MARKETPLACE: ['PUBLICADO_E_ATIVO', 'NAO_PUBLICADO', 'COM_VIOLACAO_OU_RESTRICAO', 'COM_ERRO_DE_PUBLICACAO'],
    PUBLICADO_E_ATIVO: ['PAUSADO_PELO_VENDEDOR', 'PAUSADO_PELO_MARKETPLACE', 'COM_VIOLACAO_OU_RESTRICAO', 'ARQUIVADO_INTERNO'],
  };
  const estadoInicial = l => l.lifecycle || (l.interno ? 'RASCUNHO_DO_MARKETPLACE'
    : ['ATIVO', 'PAUSADO'].includes(l.status) ? 'PUBLICADO_E_ATIVO'
    : l.status === 'NAO_PUBLICADO' ? 'NAO_PUBLICADO' : 'RASCUNHO_DO_MARKETPLACE');
  function transicionar(cat, listingId, novoEstado, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    if (!LIFECYCLE.includes(novoEstado)) return { blocked: true, reason: 'estado inválido: ' + novoEstado };
    const atual = l.lifecycle || estadoInicial(l);
    const permitidas = TRANSICOES[atual] || [];
    if (novoEstado !== atual && !permitidas.includes(novoEstado) && !opts.forcar)
      return { blocked: true, reason: `transição ${atual} → ${novoEstado} não permitida`, permitidas };
    const antes = atual; l.lifecycle = novoEstado;
    cat._audit('ciclo_de_vida', `${listingId}: ${antes} → ${novoEstado}`, { autor: opts.usuario || 'Marcos' });
    cat._ev(listingId, 'Ciclo de vida', `${antes} → ${novoEstado}`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, de: antes, para: novoEstado };
  }

  /* ---------- MATRIZ DA LOJA: verdade interna reutilizável do produto ---------- */
  function matrizDaLoja(cat, produtoId) {
    const p = cat.products.find(x => x.id === produtoId);
    if (!p) return null;
    const m = p.master || {};
    const rascunhos = cat.listings.filter(l => l.produtoId === produtoId && (l.interno || (l.lifecycle && /RASCUNHO|AGUARDANDO|PRONTO/.test(l.lifecycle))));
    const publicados = cat.listings.filter(l => l.produtoId === produtoId && !l.interno && ['ATIVO', 'PAUSADO', 'BLOQUEADO'].includes(l.status));
    return {
      produtoId, nomeInterno: p.nome, produtoMaster: p.nome, skuPai: p.sku, skuInterno: p.sku, codigoInterno: p.codigo || p.sku,
      marca: m.marca || null, modelo: m.modelo || null, material: m.material || null, cor: m.cor || null,
      dimensoes: m.dimensoes || null, peso: m.pesoEmbaladoKg || null, embalagem: m.embalagem || null,
      gtinEan: m.ean || null, ncm: m.ncm || null, descricaoBase: p.descricao || m.descricao || null,
      variacoesInternas: (p.variacoes || []).map(v => ({ id: v.id, nome: v.nome, sku: v.sku, ean: v.codigoBarras || null, preco: v.preco, estoque: v.estoque })),
      custo: p.custo != null ? p.custo : null, precoBase: p.precoBase, fornecedor: p.fornecedor || null,
      fotosOriginais: cat.media.filter(x => x.produtoId === produtoId && x.tipo === 'foto').length,
      videosOriginais: cat.media.filter(x => x.produtoId === produtoId && x.tipo === 'video').length,
      responsavel: p.responsavel || null, fonte: p.fonte || 'MATRIZ INTERNA', criadoEm: p.criadoEm || null, atualizadoEm: p.atualizadoEm || null,
      rascunhos: rascunhos.map(l => ({ id: l.id, marketplace: l.mktNome, lifecycle: l.lifecycle || estadoInicial(l) })),
      anunciosPublicados: publicados.map(l => ({ id: l.id, marketplace: l.mktNome, itemId: l.itemIdExterno, sku: l.skuPai })),
      nota: 'A Matriz é a verdade interna: existe antes, durante e depois da publicação; não é o anúncio do marketplace e não sobrescreve customizações de canal.',
    };
  }

  /* ---------- IDENTIDADE EXTERNA persistente do anúncio ---------- */
  const internalListingId = l => l.internalListingId || ('HEAD-' + ({ shopee: 'SHP', ml: 'MLB', tiktok: 'TT', magalu: 'MGL' }[l.marketplace] || 'GEN') + '-' + String(Math.abs(hash(l.id)) % 1000000).padStart(6, '0'));
  function identidadeExterna(cat, l) {
    const p = prodOf(cat, l);
    return {
      internal_listing_id: internalListingId(l), product_master_id: l.produtoId, draft_id: l.interno ? l.id : null,
      company_id: (p && p.companyId) || null, channel_id: l.lojaId || null, marketplace: l.marketplace,
      marketplace_account_id: l.contaId || null, external_listing_id: l.itemIdExterno || null,
      external_parent_id: l.parentIdExterno || l.itemIdExterno || null, external_variation_id: l.variationIdExterno || null,
      seller_sku: l.sellerSku || l.skuPai || null, variation_sku: l.variationSku || null, master_sku: (p && p.sku) || null, internal_sku: l.skuPai || null,
      gtin_ean: l.ean || null, marketplace_status: l.statusNativo || l.status || null, head_status: l.lifecycle || estadoInicial(l),
      source: l.fonte || null, source_file: l.sourceFile || null, published_at: l.publishedAt || null,
      last_sync_at: l.atualizadoEm || null, last_external_update_at: l.lastExternalUpdateAt || null,
      identity_confidence: l.itemIdExterno ? 'alta (ID externo)' : (l.skuPai ? 'média (SKU)' : 'baixa (só nome)'),
      identity_origin: l.itemIdExterno ? 'ID_EXTERNO' : (l.skuPai ? 'SKU' : 'NOME'), audit_version: (l.versoes || []).length,
    };
  }

  /* ---------- MÍDIA REAL: hash, dedup, reordenação, vínculo por SKU ---------- */
  const mediaHash = s => 'h' + Math.abs(hash(String(s || ''))).toString(16);
  function reorderMedia(cat, listingId, mediaId, novaPos, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const lista = fotosDe(cat, listingId);
    const alvo = lista.find(x => x.media.id === mediaId);
    if (!alvo) return { blocked: true, reason: 'mídia não está neste anúncio' };
    const ordem = lista.map(x => x.media.id).filter(id => id !== mediaId);
    ordem.splice(Math.max(0, Math.min(novaPos, ordem.length)), 0, mediaId);
    ordem.forEach((id, i) => { const m = cat.media.find(x => x.id === id); const u = m.usos.find(u => u.listingId === listingId); if (u) { u.posicao = i; u.principal = i === 0 && cat._capaPrimeira !== false; } });
    cat._audit('midia_reordenada', `${listingId}: ${mediaId} → posição ${novaPos}`, { autor: opts.usuario || 'Marcos' });
    cat._ev(listingId, 'Foto reordenada', `${mediaId} movida para posição ${novaPos + 1}`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, ordem };
  }
  /* dedup por hash: mesma imagem no mesmo anúncio não duplica silenciosamente */
  function addMediaReal(cat, meta, opts) {
    opts = opts || {};
    const h = meta.hash || mediaHash(meta.dataUrl || meta.arquivo);
    const dup = cat.media.find(m => m.hash === h && (!meta.listingId || m.usos.some(u => u.listingId === meta.listingId)));
    if (dup && meta.listingId) return { ok: true, duplicada: true, media: dup, nota: 'imagem idêntica (hash) já existe neste anúncio — não duplicada' };
    const r = addMedia(cat, meta, opts);
    if (r.ok) { r.media.hash = h; if (meta.skuVariacao) r.media.skuVariacao = meta.skuVariacao; if (meta.variacaoId) r.media.variacaoId = meta.variacaoId; if (meta.tipoMidia) r.media.tipoMidia = meta.tipoMidia; }
    return r;
  }
  function vincularMediaSku(cat, mediaId, sku, opts) {
    opts = opts || {};
    const m = cat.media.find(x => x.id === mediaId);
    if (!m) return { blocked: true, reason: 'mídia não encontrada' };
    m.skuVariacao = sku;
    cat._audit('midia_vinculada_sku', `${mediaId} → SKU ${sku}`, { autor: (opts.usuario || 'Marcos') });
    return { ok: true };
  }

  /* ---------- CREATIVE INTELLIGENCE por SKU ---------- */
  function addCreative(cat, def, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    cat.creatives = cat.creatives || [];
    if (!def.sku) return { blocked: true, reason: 'criativo exige SKU (nunca vincula só por nome)' };
    const c = {
      creative_id: 'cr' + (++cat.seq), tipo: def.tipo || 'foto', conteudo: def.conteudo || def.arquivo || null,
      hash: def.hash || (def.mediaId ? (cat.media.find(m => m.id === def.mediaId) || {}).hash : null) || mediaHash(def.conteudo || def.arquivo),
      ordem: def.ordem != null ? def.ordem : (cat.creatives.filter(x => x.sku === def.sku).length),
      imagemPrincipal: !!def.imagemPrincipal, mediaId: def.mediaId || null,
      sku: def.sku, variacao: def.variacao || null, listingId: def.listingId || null,
      marketplace: def.marketplace || null, conta: def.conta || null,
      dataInicio: def.dataInicio || HOJE, dataFim: def.dataFim || null, origem: def.origem || 'DASHBOARD_MANUAL',
      versao: def.versao || 1, hipoteseTeste: def.hipoteseTeste || null, status: def.status || 'ATIVO',
      resultado: def.resultado || null, metricaAvaliacao: def.metricaAvaliacao || null,
      fontePerformance: def.fontePerformance || null, periodo: def.periodo || null, confianca: def.confianca || null,
    };
    cat.creatives.push(c);
    cat._audit('criativo_adicionado', `SKU ${def.sku} · ${c.tipo} · ${c.creative_id}`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, creative: c };
  }
  const criativosDoSku = (cat, sku) => (cat.creatives || []).filter(c => c.sku === sku);
  /* análise honesta: CTR/venda por criativo, sempre com fonte/período; nunca causa sem dados comparáveis */
  function analiseCriativo(cat, sku) {
    const cs = criativosDoSku(cat, sku).filter(c => c.metricaAvaliacao != null);
    if (cs.length < 2) return { comparavel: false, nota: 'menos de 2 criativos com métrica — sem comparação; nada é declarado vencedor' };
    const ord = cs.slice().sort((a, b) => (b.metricaAvaliacao || 0) - (a.metricaAvaliacao || 0));
    return { comparavel: true, criativos: ord, melhor: ord[0], pior: ord[ord.length - 1],
      nota: 'diferença observada não é causa comprovada — validar período, tráfego, amostra, preço, Ads e estoque antes de decidir.' };
  }

  /* ---------- EXPERIMENTOS DE CRIATIVO (nunca vencedor sem evidência) ---------- */
  const EXP_STATUS = ['PLANEJADO', 'EM_EXECUCAO', 'PAUSADO', 'ENCERRADO', 'INCONCLUSIVO', 'VENCEDOR_CONFIRMADO', 'DESCARTADO'];
  function criarExperimento(cat, def, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    if (!def.sku) return { blocked: true, reason: 'experimento exige SKU' };
    if (!def.hipotese) return { blocked: true, reason: 'experimento exige hipótese declarada' };
    if (!def.metricaPrincipal) return { blocked: true, reason: 'experimento exige métrica principal' };
    cat.experiments = cat.experiments || [];
    const e = { experiment_id: 'exp' + (++cat.seq), sku: def.sku, produtoMaster: def.produtoMaster || null,
      marketplace: def.marketplace || null, conta: def.conta || null, anuncio: def.listingId || null, variacao: def.variacao || null,
      criativoControle: def.criativoControle || null, criativoTeste: def.criativoTeste || null,
      hipotese: def.hipotese, metricaPrincipal: def.metricaPrincipal, metricasSecundarias: def.metricasSecundarias || [],
      dataInicio: def.dataInicio || HOJE, dataFim: def.dataFim || null, amostra: def.amostra || null,
      resultado: null, decisao: null, confianca: null, responsavel: opts.usuario || 'Marcos',
      fontesUsadas: def.fontesUsadas || [], status: 'PLANEJADO' };
    cat.experiments.push(e);
    cat._audit('experimento_criado', `SKU ${def.sku} · ${e.experiment_id} · hip: ${def.hipotese}`, { autor: e.responsavel });
    return { ok: true, experimento: e };
  }
  /* avaliar: só declara VENCEDOR_CONFIRMADO quando há amostra + período + cobertura suficientes */
  function avaliarExperimento(cat, expId, dados, opts) {
    opts = opts || {};
    const e = (cat.experiments || []).find(x => x.experiment_id === expId);
    if (!e) return { blocked: true, reason: 'experimento não encontrado' };
    dados = dados || {};
    const faltas = [];
    if (!dados.amostraSuficiente) faltas.push('amostra');
    if (!dados.periodoSuficiente) faltas.push('período');
    if (!dados.coberturaSuficiente) faltas.push('cobertura de dados');
    if (dados.alteracoesParalelas) faltas.push('houve alteração paralela (preço/Ads/promoção/estoque)');
    e.resultado = dados.resultado || null; e.confianca = dados.confianca || (faltas.length ? 'baixa' : 'alta');
    e.fontesUsadas = dados.fontesUsadas || e.fontesUsadas;
    if (faltas.length || !dados.vencedorClaro) { e.status = 'INCONCLUSIVO'; e.decisao = 'não declarar vencedor — faltou: ' + (faltas.join(', ') || 'diferença clara'); }
    else { e.status = 'VENCEDOR_CONFIRMADO'; e.decisao = 'vencedor: ' + (dados.vencedor || e.criativoTeste); }
    cat._audit('experimento_avaliado', `${expId} → ${e.status}`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, experimento: e, faltas };
  }

  /* ---------- PUBLICAÇÃO CONTROLADA: só solicitação interna, nunca escrita externa ---------- */
  function solicitarPublicacao(cat, listingId, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    const faltas = [];
    if (!(opts.empresa && opts.canal && l.marketplace && (l.contaId || opts.conta))) faltas.push('Empresa/Canal/Marketplace/Conta');
    if (!opts.validado) faltas.push('rascunho validado');
    if (opts.pendenciasBloqueantes) faltas.push('sem pendência bloqueante');
    if (!opts.confirmacaoExplicita) faltas.push('confirmação explícita');
    if (!opts.integracaoAutorizada) faltas.push('integração oficial autorizada (ambiente de escrita)');
    if (faltas.length && !opts.somenteInterno) return { blocked: true, reason: 'publicação bloqueada — falta: ' + faltas.join(', '), faltas };
    /* NUNCA escreve externamente: cria SOLICITAÇÃO interna e move o ciclo de vida */
    cat.publicacoes = cat.publicacoes || [];
    const pedido = { id: 'pub' + (++cat.seq), listingId, marketplace: l.marketplace, conta: l.contaId || opts.conta || null,
      empresa: opts.empresa || null, canal: opts.canal || null, solicitadoEm: HOJE, solicitadoPor: opts.usuario || 'Marcos',
      estado: 'PUBLICACAO_SOLICITADA', escritaExterna: false, retornoOficial: null };
    cat.publicacoes.push(pedido);
    l.lifecycle = 'PUBLICACAO_SOLICITADA';
    cat._audit('publicacao_solicitada', `${listingId} · ${l.marketplace} · SEM escrita externa (só solicitação interna)`, { autor: pedido.solicitadoPor });
    cat._ev(listingId, 'Publicação', 'publicação solicitada — aguardando retorno oficial; nenhuma escrita externa disparada', { autor: pedido.solicitadoPor });
    return { ok: true, pedido, nota: 'somente solicitação interna criada — o marketplace não foi tocado. Ativo só após retorno oficial.' };
  }
  /* retorno oficial: só aqui o anúncio vira ativo e ganha IDs externos persistentes */
  function registrarRetornoOficial(cat, listingId, retorno, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const l = byId(cat, listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    const pedido = (cat.publicacoes || []).find(p => p.listingId === listingId && p.estado === 'PUBLICACAO_SOLICITADA');
    retorno = retorno || {};
    if (retorno.aceito === false) { l.lifecycle = retorno.motivo && /viol/i.test(retorno.motivo) ? 'COM_VIOLACAO_OU_RESTRICAO' : 'NAO_PUBLICADO';
      if (pedido) { pedido.estado = l.lifecycle; pedido.retornoOficial = retorno; }
      cat._audit('retorno_oficial', `${listingId} → ${l.lifecycle} (${retorno.motivo || 'recusado'})`);
      return { ok: true, lifecycle: l.lifecycle, ativo: false };
    }
    /* aceito: registra identidade externa e move para ativo */
    if (retorno.externalListingId) l.itemIdExterno = String(retorno.externalListingId);
    if (retorno.externalVariationId) l.variationIdExterno = String(retorno.externalVariationId);
    if (retorno.sellerSku) l.sellerSku = retorno.sellerSku;
    if (retorno.variationSku) l.variationSku = retorno.variationSku;
    l.interno = false; l.status = 'ATIVO'; l.lifecycle = 'PUBLICADO_E_ATIVO'; l.publishedAt = HOJE;
    if (pedido) { pedido.estado = 'PUBLICADO_E_ATIVO'; pedido.retornoOficial = retorno; }
    cat._audit('retorno_oficial', `${listingId} → PUBLICADO_E_ATIVO · Item ${l.itemIdExterno || '—'} · Var ${l.variationIdExterno || '—'} · SKU ${l.sellerSku || l.skuPai}`);
    cat._ev(listingId, 'Publicação', `retorno oficial: ativo · Item ID ${l.itemIdExterno || '—'}`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, lifecycle: 'PUBLICADO_E_ATIVO', ativo: true, identidade: identidadeExterna(cat, l) };
  }

  /* ---------- SKU COMO CHAVE OPERACIONAL: dossiê cruzando todas as fontes ----------
     A caller passa as fontes já lidas (V8IMP/V8INT) — o engine cruza pela HIERARQUIA:
     Item ID → Variation ID → Seller SKU → SKU da Variação → SKU Principal → GTIN → Master → nome (só sugestão).
     Contas diferentes NUNCA são somadas sem informar; mesmo SKU em mkts diferentes = comparação com origem separada. */
  function skuDossie(cat, sku, fontes) {
    fontes = fontes || {};
    const norm = s => String(s || '').trim();
    const bateSku = r => [r.sku_variacao, r.sku_pai, r.seller_sku, r.variation_sku, r.sku].map(norm).includes(norm(sku));
    const listings = cat.listings.filter(l => norm(l.skuPai) === norm(sku) || norm(l.sellerSku) === norm(sku) || norm(l.variationSku) === norm(sku)
      || (cat.products.find(p => p.id === l.produtoId) || { variacoes: [] }).variacoes.some(v => norm(v.sku) === norm(sku)));
    const porMkt = {};
    for (const l of listings) { const k = l.marketplace + '|' + (l.contaId || '—'); (porMkt[k] = porMkt[k] || { marketplace: l.mktNome, conta: l.contaId || '—', listingId: l.id, itemId: l.itemIdExterno, variationId: l.variationIdExterno }); }
    const perf = (fontes.performance || []).filter(bateSku);
    const estoque = (fontes.estoque || []).filter(bateSku);
    const devolucoes = (fontes.devolucoes || []).filter(bateSku);
    const ads = (fontes.ads || []).filter(bateSku);
    const afiliados = (fontes.afiliados || []).filter(bateSku);
    const criativos = criativosDoSku(cat, sku);
    const experimentos = (cat.experiments || []).filter(e => e.sku === sku);
    const contas = Array.from(new Set([].concat(listings.map(l => l.contaId), perf.map(r => r.conta), estoque.map(r => r.conta)).filter(Boolean)));
    return {
      sku, produtoMaster: (prodOf(cat, listings[0]) || {}).nome || null,
      marketplaces: Object.values(porMkt), contas, multiConta: contas.length > 1,
      performance: perf, estoque, devolucoes, ads, afiliados, criativos, experimentos,
      criativosVencedores: criativos.filter(c => c.status === 'VENCEDOR' || c.resultado === 'VENCEDOR'),
      criativosBaixa: criativos.filter(c => c.status === 'BAIXA_PERFORMANCE'),
      chaveUsada: listings.some(l => l.itemIdExterno) ? 'Item ID + SKU' : 'SKU',
      nota: contas.length > 1 ? 'ATENÇÃO: este SKU aparece em mais de uma conta — dados NÃO são somados entre contas; compare com origem separada.' : 'SKU semelhante não é SKU igual; nome nunca substitui Item ID/Variation ID/SKU.',
    };
  }

  /* ---------- 10.E.3.3 P2 · FLUXO CONVERSACIONAL (WhatsApp) ---------- */
  const MKT_ALIAS = { 'shopee': 'shopee', 'mercado livre': 'ml', 'mercado-livre': 'ml', 'mercadolivre': 'ml', 'meli': 'ml', 'ml': 'ml', 'tiktok': 'tiktok', 'tik tok': 'tiktok', 'magalu': 'magalu', 'magazine luiza': 'magalu' };
  function detectarMkt(txt) { const t = String(txt || '').toLowerCase(); for (const k of Object.keys(MKT_ALIAS)) if (t.includes(k)) return MKT_ALIAS[k]; return null; }
  /* "Criar anúncio deste produto na Shopee" → Matriz → Rascunho → SKU → pendências */
  function criarAnuncioComando(cat, texto, ctx) {
    ctx = ctx || {};
    const mk = detectarMkt(texto) || ctx.marketplace;
    if (!mk) return { precisaConfirmar: true, pergunta: 'Para qual marketplace? (Shopee, Mercado Livre, TikTok Shop ou Magalu)' };
    let p = ctx.produtoId ? cat.products.find(x => x.id === ctx.produtoId) : null;
    if (!p) {
      const t = String(texto || '').toLowerCase();
      /* casa se o NOME ou o SKU do produto aparece na mensagem (mais robusto que fatiar a frase) */
      p = cat.products.find(x => t.includes(x.nome.toLowerCase()) || t.includes(x.sku.toLowerCase()));
      if (!p) { const nome = t.replace(/criar (um )?an[uú]ncio( deste produto| do produto| de| do| da)?/i, '').replace(/na shopee|no mercado livre|no meli|no tiktok|no magalu/i, '').trim(); p = nome ? cat.products.find(x => x.nome.toLowerCase().includes(nome)) : null; }
    }
    if (!p) return { precisaConfirmar: true, pergunta: 'Qual produto? Não identifiquei pelo nome — me diga o produto ou o SKU exato.' };
    const matriz = matrizDaLoja(cat, p.id);
    let draft = cat.listings.find(l => l.produtoId === p.id && l.marketplace === mk && l.interno);
    if (!draft) {
      const base = cat.listings.find(l => l.produtoId === p.id);
      if (base && base.marketplace !== mk) { const r = adaptListing(cat, base.id, mk, ctx); draft = r.draft; }
      else if (base) { const r = duplicateListing(cat, base.id, ctx); draft = r.copia; draft.marketplace = mk; draft.mktNome = MKT_NOME[mk]; }
    }
    if (draft) draft.lifecycle = 'RASCUNHO_DO_MARKETPLACE';
    const pend = [];
    if (!matriz.gtinEan) pend.push('GTIN/EAN'); if (!matriz.peso) pend.push('Peso'); if (!matriz.marca) pend.push('Marca');
    if (!matriz.dimensoes) pend.push('Dimensões da embalagem'); if (!matriz.fotosOriginais) pend.push('Foto principal');
    if (draft) draft.lifecycle = pend.length ? 'AGUARDANDO_COMPLEMENTO' : 'AGUARDANDO_REVISAO';
    cat._audit('whats_criar_anuncio', `${p.nome} → ${MKT_NOME[mk]} · rascunho ${draft ? draft.id : '—'} · ${pend.length} pendência(s)`, { origem: 'WHATSAPP_COMMAND' });
    return { ok: true, marketplace: MKT_NOME[mk], produto: p.nome, sku: p.sku, draftId: draft ? draft.id : null,
      lifecycle: draft ? draft.lifecycle : null, status: pend.length ? 'Aguardando complemento' : 'Pronto para revisão', pendencias: pend,
      resposta: `Produto: ${p.nome}\nDestino: ${MKT_NOME[mk]}\nSKU: ${p.sku}\nStatus: ${pend.length ? 'Aguardando complemento' : 'Pronto para revisão'}${pend.length ? '\nPendências:\n- ' + pend.join('\n- ') : ''}` };
  }
  /* "Coloque essa foto no anúncio X" → busca por ID/SKU/nome (prioriza ID e SKU), confirma se ambíguo */
  function anexarFotoComando(cat, texto, media, ctx) {
    ctx = ctx || {}; media = media || {};
    const mk = detectarMkt(texto);
    let cands = cat.listings.filter(l => !mk || l.marketplace === mk);
    const idMatch = (String(texto).match(/\b(\d{6,})\b/) || [])[1];
    const skuMatch = (String(texto).match(/\b([A-Za-z0-9]{2,}-[A-Za-z0-9-]+)\b/) || [])[1];
    let via = null;
    if (idMatch) { const f = cands.filter(l => l.itemIdExterno === idMatch); if (f.length) { cands = f; via = 'Item ID'; } }
    if (!via && skuMatch) { const f = cands.filter(l => (l.skuPai || '').toLowerCase() === skuMatch.toLowerCase()); if (f.length) { cands = f; via = 'SKU'; } }
    if (!via) {
      const nome = String(texto).toLowerCase().replace(/coloque essa foto no an[uú]ncio|adicione a foto (no|ao) an[uú]ncio|no an[uú]ncio/gi, '').replace(/da shopee|do mercado livre|do tiktok|do magalu/gi, '').trim();
      if (nome) { cands = cands.filter(l => (l.titulo || '').toLowerCase().includes(nome)); via = 'nome (sugestão)'; }
    }
    if (!cands.length) return { precisaConfirmar: true, pergunta: 'Não encontrei o anúncio — me diga o Item ID ou o SKU.' };
    if (cands.length > 1) return { precisaConfirmar: true, pergunta: 'Encontrei mais de um anúncio — confirme por Item ID ou SKU:', candidatos: cands.slice(0, 6).map(l => ({ id: l.id, titulo: l.titulo, marketplace: l.mktNome, itemId: l.itemIdExterno, sku: l.skuPai })) };
    const l = cands[0];
    const r = addMediaReal(cat, { produtoId: l.produtoId, listingId: l.id, arquivo: media.arquivo || 'foto-whatsapp.jpg', dataUrl: media.dataUrl || null, pesoKb: media.pesoKb || null, origem: 'WHATSAPP_COMMAND', skuVariacao: l.skuPai }, ctx);
    if (r.blocked) return r;
    const total = fotosDe(cat, l.id).length;
    cat._audit('whats_foto', `${l.id} · via ${via} · origem WHATSAPP_COMMAND`, { origem: 'WHATSAPP_COMMAND' });
    return { ok: true, duplicada: r.duplicada || false, anuncio: l.titulo, marketplace: l.mktNome, sku: l.skuPai, via, posicao: total, origem: 'WhatsApp',
      resposta: `Foto adicionada:\nAnúncio: ${l.titulo}\nMarketplace: ${l.mktNome}\nSKU: ${l.skuPai || '—'}\nPosição: ${total} de ${total}\nOrigem: WhatsApp\nStatus: ${r.duplicada ? 'já existia (hash) — não duplicada' : 'carregada e disponível para revisão'}` };
  }
  /* adaptar o criativo de melhor métrica de um SKU para outro marketplace (proposta, nunca "vencedor" às cegas) */
  function adaptarCriativoVencedor(cat, sku, destinoMkt, opts) {
    opts = opts || {};
    const ac = analiseCriativo(cat, sku);
    if (!ac.comparavel) return { blocked: true, reason: 'sem base comparável entre criativos — não adapta às cegas; rode um teste antes' };
    const melhor = ac.melhor;
    const novo = addCreative(cat, { sku, tipo: melhor.tipo, mediaId: melhor.mediaId, marketplace: destinoMkt, origem: 'ADAPTADO_DE_OUTRO_CANAL',
      hipoteseTeste: 'reaproveitar criativo de melhor métrica observada em outro canal — validar com teste no destino', status: 'PROPOSTO' }, opts);
    if (novo.blocked) return novo;
    cat._audit('criativo_adaptado', `SKU ${sku} · melhor criativo → ${MKT_NOME[destinoMkt] || destinoMkt} (proposta)`, { autor: opts.usuario || 'Marcos' });
    return { ok: true, criativo: novo.creative, base: melhor, nota: 'adaptação é PROPOSTA — o que venceu num canal não vence no outro sem teste.' };
  }

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

  /* =============================================================
     10.E.2.4 — IMPORTAÇÃO REAL DE CADASTRO SHOPEE (dentro do Catálogo)
     Product Master × Anúncio Shopee × Variação, todos os campos, camada
     bruta preservada, identidade por item_id/SKU (nunca só por nome),
     mídia REFERENCIADA (não validada), status REPORTADO por planilha,
     saúde e pendências, relação com pedidos/métricas, edição auditada.
     Nada é publicado ou alterado na Shopee.
     ============================================================= */
  const brNum = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/%/g, '').replace(/R\$\s*/i, '').replace(/\s+/g, '');
    if (s === '' || s === '-' || s === '—') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s); return isNaN(n) ? null : n;
  };
  /* dicionário de campos do template de cadastro (coluna → campo, entidade, tipo) */
  const ENTIDADE_NOME = { MASTER: 'Produto Master', LISTING: 'Anúncio Shopee', VARIACAO: 'Variação',
    LOGISTICA: 'Logística', FISCAL: 'Fiscal', MIDIA: 'Mídia', AUXILIAR: 'Campo auxiliar' };
  const CADASTRO_SCHEMA = {
    'Categoria': { campo: 'listing_category', ent: 'LISTING', tipo: 'Categoria', aba: 'Categoria' },
    'Nome do produto': { campo: 'listing_title', ent: 'LISTING', tipo: 'Texto', aba: 'Informação Básica' },
    'Descrição do produto': { campo: 'listing_description', ent: 'LISTING', tipo: 'Texto', aba: 'Descrição' },
    'Número de referência do SKU pai': { campo: 'sku_parent', ent: 'MASTER', tipo: 'SKU', aba: 'Especificações' },
    'ID do Item': { campo: 'item_external_id', ent: 'LISTING', tipo: 'ID externo', aba: 'Informação Básica' },
    'Marca': { campo: 'brand', ent: 'MASTER', tipo: 'Texto', aba: 'Informação Básica' },
    'Modelo': { campo: 'model', ent: 'MASTER', tipo: 'Texto', aba: 'Especificações' },
    'Material': { campo: 'material', ent: 'MASTER', tipo: 'Texto', aba: 'Especificações' },
    'Nome da variação': { campo: 'variation_attr_name', ent: 'VARIACAO', tipo: 'Texto', aba: 'Lista de Variações' },
    'Opção da variação': { campo: 'variation_attr_value', ent: 'VARIACAO', tipo: 'Texto', aba: 'Lista de Variações' },
    'SKU': { campo: 'variation_sku', ent: 'VARIACAO', tipo: 'SKU', aba: 'Lista de Variações' },
    'Preço': { campo: 'price', ent: 'VARIACAO', tipo: 'Moeda', aba: 'Informações de Vendas' },
    'Preço promocional': { campo: 'price_promo', ent: 'VARIACAO', tipo: 'Moeda', aba: 'Informações de Vendas' },
    'Estoque': { campo: 'stock', ent: 'VARIACAO', tipo: 'Número', aba: 'Informações de Vendas' },
    'Código de barras': { campo: 'ean_gtin', ent: 'VARIACAO', tipo: 'Código de barras', aba: 'Especificações' },
    'Peso': { campo: 'weight_kg', ent: 'VARIACAO', tipo: 'Número', aba: 'Envio e Logística' },
    'Peso embalado': { campo: 'packed_weight_kg', ent: 'LOGISTICA', tipo: 'Número', aba: 'Envio e Logística' },
    'Largura': { campo: 'width_cm', ent: 'LOGISTICA', tipo: 'Número', aba: 'Envio e Logística' },
    'Altura': { campo: 'height_cm', ent: 'LOGISTICA', tipo: 'Número', aba: 'Envio e Logística' },
    'Comprimento': { campo: 'length_cm', ent: 'LOGISTICA', tipo: 'Número', aba: 'Envio e Logística' },
    'Prazo de manuseio': { campo: 'handling_time', ent: 'LOGISTICA', tipo: 'Texto', aba: 'Envio e Logística' },
    'Tipo de envio': { campo: 'shipping_type', ent: 'LOGISTICA', tipo: 'Texto', aba: 'Envio e Logística' },
    'NCM': { campo: 'ncm', ent: 'FISCAL', tipo: 'Identificador', aba: 'Especificações' },
    'Origem fiscal': { campo: 'fiscal_origin', ent: 'FISCAL', tipo: 'Texto', aba: 'Especificações' },
    'CEST': { campo: 'cest', ent: 'FISCAL', tipo: 'Identificador', aba: 'Especificações' },
    'Imagem principal': { campo: 'image_main', ent: 'MIDIA', tipo: 'Mídia', aba: 'Fotos e Vídeos' },
    'Imagem 2': { campo: 'image_2', ent: 'MIDIA', tipo: 'Mídia', aba: 'Fotos e Vídeos' },
    'Imagem 3': { campo: 'image_3', ent: 'MIDIA', tipo: 'Mídia', aba: 'Fotos e Vídeos' },
    'Vídeo': { campo: 'video', ent: 'MIDIA', tipo: 'Mídia', aba: 'Fotos e Vídeos' },
    'Status': { campo: 'listing_status', ent: 'LISTING', tipo: 'Status', aba: 'Informação Básica' },
    'Condição': { campo: 'condition', ent: 'LISTING', tipo: 'Texto', aba: 'Informação Básica' },
  };
  const CAD_IDENT = ['Categoria', 'Nome do produto', 'Número de referência do SKU pai'];
  const STATUS_MAP = {
    'ativo': 'Ativo reportado', 'active': 'Ativo reportado', 'normal': 'Ativo reportado', 'live': 'Ativo reportado',
    'pausado': 'Pausado reportado', 'paused': 'Pausado reportado',
    'não publicado': 'Não publicado reportado', 'nao publicado': 'Não publicado reportado', 'unlisted': 'Não publicado reportado',
    'em revisão': 'Em revisão reportado', 'em revisao': 'Em revisão reportado', 'pending': 'Em revisão reportado',
    'com erro': 'Com erro reportado', 'erro': 'Com erro reportado', 'banned': 'Com erro reportado', 'bloqueado': 'Com erro reportado',
  };
  const statusReportado = s => STATUS_MAP[String(s || '').trim().toLowerCase()] || 'Desconhecido';

  function cadastroDetect(file) {
    const abas = file.abas || [];
    const evid = new Set();
    for (const a of abas) for (const h of (a.headers || [])) if (CADASTRO_SCHEMA[h]) evid.add(h);
    const ident = CAD_IDENT.filter(c => abas.some(a => (a.headers || []).includes(c)));
    const ehCadastro = ident.length >= 2 && evid.size >= 4;
    return { ehCadastro, confianca: ehCadastro ? (ident.length === 3 ? 'alta' : 'média') : 'nenhuma',
      identificadores: ident, evidencias: [...evid], perfil: 'SHOPEE_MASS_UPLOAD_CADASTRO', nomePerfil: 'Cadastro Shopee (mass upload)',
      abas: abas.map(a => a.nome) };
  }

  /* staging: agrupa linhas em Produto Master → Anúncio → Variações, com identidade e vínculo */
  function cadastroStage(cat, file, escopo, opts) {
    opts = opts || {};
    for (const k of ['companyId', 'contaId', 'marketplace'])
      if (!escopo[k]) return { blocked: true, reason: 'escopo incompleto: falta ' + k + ' — cadastro exige Empresa → Canal → Conta Shopee' };
    const det = cadastroDetect(file);
    if (!det.ehCadastro) return { blocked: true, reason: 'arquivo não reconhecido como cadastro Shopee (mass upload) — verifique o template', det };
    /* camada bruta: todas as abas/linhas/colunas + todos os blocos reconhecidos */
    const rawRows = [], colunas = new Set();
    for (const a of file.abas) {
      const blocos = (a.blocos && a.blocos.length) ? a.blocos : [{ headers: a.headers, rows: a.rows }];
      for (const b of blocos) {
        const ehCad = (b.headers || []).some(h => CADASTRO_SCHEMA[h]);
        (b.headers || []).forEach(h => h && colunas.add(h));
        if (!ehCad) continue;
        for (const r of (b.rows || [])) rawRows.push({ aba: a.nome, raw: r });
      }
    }
    const val = (r, col) => { const v = r[col]; return v == null || v === '' ? null : v; };
    const mastersMap = {}, conflitos = [], invalidas = [], pendentes = [];
    const skuSeen = {};
    rawRows.forEach((rr, i) => {
      const r = rr.raw;
      const skuPai = val(r, 'Número de referência do SKU pai');
      const itemId = val(r, 'ID do Item');
      const skuVar = val(r, 'SKU');
      const nome = val(r, 'Nome do produto');
      if (!skuPai && !itemId && !skuVar && !nome) { invalidas.push({ linha: i + 1, motivo: 'linha sem SKU, item_id ou nome — não é cadastro', raw: r }); return; }
      const mkey = skuPai || itemId || ('nome:' + nome);
      const m = mastersMap[mkey] || (mastersMap[mkey] = { chave: mkey, skuPai: skuPai, nome, marca: val(r, 'Marca'),
        modelo: val(r, 'Modelo'), material: val(r, 'Material'), categoria: val(r, 'Categoria'),
        descricao: val(r, 'Descrição do produto'), itemId, statusReportado: statusReportado(val(r, 'Status')),
        statusBruto: val(r, 'Status'), aba: rr.aba, variacoes: [], midias: [], soNome: !skuPai && !itemId });
      /* mídia referenciada (URL/nome) — nunca baixada, nunca validada */
      for (const col of ['Imagem principal', 'Imagem 2', 'Imagem 3', 'Vídeo']) {
        const u = val(r, col);
        if (u && !m.midias.some(x => x.url === u)) m.midias.push({ url: u, tipo: col === 'Vídeo' ? 'video' : 'foto',
          principal: col === 'Imagem principal', origem: 'importação Shopee', status: 'MÍDIA REFERENCIADA', pendenteValidacao: true });
      }
      if (skuVar || val(r, 'Preço') != null || val(r, 'Opção da variação')) {
        const dupKey = escopo.marketplace + '|' + escopo.contaId + '|' + (skuVar || '');
        if (skuVar && skuSeen[dupKey]) conflitos.push({ tipo: 'SKU duplicado', sku: skuVar, linha: i + 1,
          motivo: `SKU ${skuVar} aparece em mais de uma linha no mesmo marketplace/conta — duplicidade exige revisão humana`, estado: 'AGUARDANDO REVISÃO' });
        if (skuVar) skuSeen[dupKey] = true;
        m.variacoes.push({ sku: skuVar, nome: val(r, 'Opção da variação') || val(r, 'Nome da variação') || 'única',
          atributoNome: val(r, 'Nome da variação'), atributoValor: val(r, 'Opção da variação'),
          preco: brNum(val(r, 'Preço')), precoPromo: brNum(val(r, 'Preço promocional')), estoque: brNum(val(r, 'Estoque')),
          ean: val(r, 'Código de barras'), pesoKg: brNum(val(r, 'Peso')),
          logistica: { pesoEmbaladoKg: brNum(val(r, 'Peso embalado')), larguraCm: brNum(val(r, 'Largura')),
            alturaCm: brNum(val(r, 'Altura')), comprimentoCm: brNum(val(r, 'Comprimento')),
            prazoManuseio: val(r, 'Prazo de manuseio'), tipoEnvio: val(r, 'Tipo de envio') },
          fiscal: { ncm: val(r, 'NCM'), origem: val(r, 'Origem fiscal'), cest: val(r, 'CEST') },
          statusReportado: statusReportado(val(r, 'Status')), raw: r, linha: i + 1 });
      }
    });
    /* vínculo com Product Master existente: SKU pai → EAN → (nome nunca vincula sozinho) */
    const masters = Object.values(mastersMap).map(m => {
      let vinculo, produtoId = null;
      const porSku = m.skuPai && cat.products.find(p => p.master && (p.master.sku === m.skuPai || p.sku === m.skuPai));
      const eans = m.variacoes.map(v => v.ean).filter(Boolean);
      const porEan = !porSku && eans.length && cat.products.find(p => p.master && eans.includes(p.master.ean));
      if (porSku) { vinculo = 'VÍNCULO CONFIRMADO POR SKU'; produtoId = porSku.id; }
      else if (porEan) { vinculo = 'VÍNCULO SUGERIDO POR EAN'; produtoId = porEan.id; pendentes.push({ chave: m.chave, motivo: 'EAN coincide, mas SKU pai difere — confirmar vínculo' }); }
      else if (m.skuPai || m.itemId) vinculo = 'NOVO PRODUTO MASTER';
      else { vinculo = 'AGUARDANDO REVISÃO'; pendentes.push({ chave: m.chave, motivo: 'sem SKU pai e sem item_id — só nome não cria vínculo definitivo' }); }
      return Object.assign(m, { vinculo, produtoId });
    });
    const campos = [...colunas].map(col => {
      const sc = CADASTRO_SCHEMA[col];
      return { coluna: col, exemplo: (rawRows.find(rr => rr.raw[col] != null && rr.raw[col] !== '') || { raw: {} }).raw[col] || null,
        tipo: sc ? sc.tipo : 'Texto', campoNormalizado: sc ? sc.campo : null, entidade: sc ? ENTIDADE_NOME[sc.ent] : 'Não mapeado',
        entKey: sc ? sc.ent : null, status: sc ? 'Utilizado' : 'Aguardando mapeamento', aba: sc ? sc.aba : null };
    });
    const variacoesTotal = masters.reduce((a, m) => a + m.variacoes.length, 0);
    return {
      ehCadastro: true, arquivo: file.nome, escopo, det, rawRows, campos, camposPreservados: colunas.size,
      abas: file.abas.map(a => a.nome), blocos: rawRows.length ? ['Cadastro de produtos'] : [],
      masters, conflitos, invalidas, pendentes,
      resumo: { produtosNovos: masters.filter(m => m.vinculo === 'NOVO PRODUTO MASTER').length,
        anunciosExistentes: masters.filter(m => /CONFIRMADO/.test(m.vinculo)).length,
        variacoesNovas: variacoesTotal, duplicidades: conflitos.length, conflitos: conflitos.length,
        camposPendentes: campos.filter(c => c.status === 'Aguardando mapeamento').length, linhasInvalidas: invalidas.length,
        aguardandoRevisao: masters.filter(m => /AGUARDANDO|SUGERIDO/.test(m.vinculo)).length },
    };
  }

  function cadStore(cat) {
    return cat.cadastro || (cat.cadastro = { masters: [], listings: [], variacoes: [], media: [], imports: [], audit: [], seq: 0 });
  }
  const cadAudit = (cat, acao, detalhe, extra) => { const c = cadStore(cat); c.audit.push(Object.assign({ id: 'cad' + (++c.seq), acao, detalhe, em: HOJE }, extra || {})); };

  function cadastroApply(cat, stage, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_IMPORT_APPLY')) return negar(opts.papel, 'CATALOG_IMPORT_APPLY');
    if (!stage || !stage.ehCadastro) return { blocked: true, reason: 'nada a aplicar — prévia inválida' };
    const st = cadStore(cat);
    const esc = stage.escopo;
    let mastersCriados = 0, mastersAtualizados = 0, listingsVinc = 0, variacoesCriadas = 0, variacoesAtualizadas = 0, midiasRef = 0, conflitosPulados = 0;
    for (const m of stage.masters) {
      const mkey = 'M|' + esc.contaId + '|' + (m.skuPai || m.itemId || m.nome);
      let master = st.masters.find(x => x.key === mkey);
      if (!master) {
        master = { key: mkey, id: 'PM' + (++st.seq), skuPai: m.skuPai, nome: m.nome, marca: m.marca, modelo: m.modelo,
          material: m.material, categoria: m.categoria, descricao: m.descricao, vinculo: m.vinculo, produtoId: m.produtoId,
          escopo: { companyId: esc.companyId, contaId: esc.contaId, marketplace: esc.marketplace },
          fonte: 'PLANILHA_SHOPEE', origem: 'DADO IMPORTADO VIA PLANILHA', arquivo: stage.arquivo, aba: m.aba,
          importadoEm: HOJE, atualizadoEm: HOJE, correcoes: [], versoes: [] };
        st.masters.push(master); mastersCriados++;
      } else { mastersAtualizados += mesclaVersionado(master, m, ['nome', 'marca', 'modelo', 'material', 'categoria', 'descricao'], opts) ? 1 : 0; }
      /* anúncio Shopee: chave marketplace + conta + item_id */
      const lkey = 'L|' + esc.marketplace + '|' + esc.contaId + '|' + (m.itemId || m.skuPai || m.nome);
      let listing = st.listings.find(x => x.key === lkey);
      const dados = { titulo: m.nome, categoria: m.categoria, descricao: m.descricao, itemIdExterno: m.itemId,
        statusReportado: m.statusReportado, statusBruto: m.statusBruto };
      if (!listing) {
        listing = Object.assign({ key: lkey, id: 'LS' + (++st.seq), masterKey: mkey, marketplace: esc.marketplace,
          mktNome: MKT_NOME[esc.marketplace] || esc.marketplace, contaId: esc.contaId, companyId: esc.companyId,
          fonte: 'PLANILHA_SHOPEE', origem: 'DADO IMPORTADO VIA PLANILHA', situacao: 'STATUS REPORTADO POR PLANILHA',
          arquivo: stage.arquivo, aba: m.aba, importadoEm: HOJE, atualizadoEm: HOJE, midias: [], correcoes: [], versoes: [], arquivado: null }, dados);
        st.listings.push(listing); listingsVinc++;
      } else { mesclaVersionado(listing, dados, ['titulo', 'categoria', 'descricao', 'itemIdExterno', 'statusReportado'], opts); }
      /* mídia referenciada (nunca baixada/validada) */
      for (const md of m.midias) {
        if (!listing.midias.some(x => x.url === md.url)) { listing.midias.push(Object.assign({ id: 'MDR' + (++st.seq) }, md)); midiasRef++; }
      }
      /* variações: chave marketplace + conta + SKU var */
      for (const v of m.variacoes) {
        const vkey = 'V|' + esc.marketplace + '|' + esc.contaId + '|' + (v.sku || (listing.id + ':' + v.nome));
        const conflito = stage.conflitos.find(c => c.sku && c.sku === v.sku);
        if (conflito) { conflitosPulados++; }
        let variacao = st.variacoes.find(x => x.key === vkey);
        const vdados = { nome: v.nome, atributoNome: v.atributoNome, atributoValor: v.atributoValor, sku: v.sku,
          ean: v.ean, preco: v.preco, precoPromo: v.precoPromo, estoque: v.estoque, pesoKg: v.pesoKg,
          logistica: v.logistica, fiscal: v.fiscal, statusReportado: v.statusReportado };
        if (!variacao) {
          variacao = Object.assign({ key: vkey, id: 'VR' + (++st.seq), listingKey: lkey, masterKey: mkey,
            marketplace: esc.marketplace, contaId: esc.contaId, fonte: 'PLANILHA_SHOPEE', origem: 'DADO IMPORTADO VIA PLANILHA',
            conflitoSku: !!conflito, importadoEm: HOJE, atualizadoEm: HOJE, correcoes: [], versoes: [], arquivada: null }, vdados);
          st.variacoes.push(variacao); variacoesCriadas++;
        } else { mesclaVersionado(variacao, vdados, ['nome', 'sku', 'ean', 'preco', 'precoPromo', 'estoque', 'pesoKg', 'statusReportado'], opts) && variacoesAtualizadas++; }
      }
    }
    const imp = { id: 'IMPCAD' + (++st.seq), arquivo: stage.arquivo, escopo: esc, em: HOJE, batchId: opts.batchId || null,
      rawRows: stage.rawRows, campos: stage.campos, camposPreservados: stage.camposPreservados, abas: stage.abas,
      contagens: { mastersCriados, mastersAtualizados, listingsVinc, variacoesCriadas, variacoesAtualizadas, midiasRef, conflitos: conflitosPulados },
      usuario: opts.usuario || 'Marcos' };
    st.imports.push(imp);
    cadAudit(cat, 'cadastro_shopee_aplicado', `${stage.arquivo}: ${mastersCriados} master(s), ${listingsVinc} anúncio(s), ${variacoesCriadas} variação(ões)`, { escopo: esc });
    return { ok: true, impacto: {
      mastersCriados, mastersAtualizados, listingsVinculados: listingsVinc, variacoesCriadas, variacoesAtualizadas,
      camposPreservados: stage.camposPreservados, camposNormalizados: stage.campos.filter(c => c.campoNormalizado).length,
      conflitos: conflitosPulados, aguardandoRevisao: stage.resumo.aguardandoRevisao, midiasReferenciadas: midiasRef,
      pendencias: saudeCadastro(cat).reduce((a, f) => a + f.itens.length, 0), arquivo: stage.arquivo, escopo: esc } };
  }
  function mesclaVersionado(alvo, novo, campos, opts) {
    let mudou = false;
    for (const c of campos) {
      if (novo[c] === undefined) continue;
      const antes = alvo[c];
      if (String(antes ?? '') !== String(novo[c] ?? '') && novo[c] != null) {
        alvo.versoes.push({ campo: c, antes, depois: novo[c], em: HOJE, origem: 'REIMPORTAÇÃO', usuario: opts.usuario || 'Marcos' });
        alvo[c] = novo[c]; alvo.atualizadoEm = HOJE; mudou = true;
      }
    }
    return mudou;
  }

  /* =============================================================
     10.E.3.1 — CONVERGÊNCIA: o anúncio importado vira listing/produto
     de primeira classe (mesmo modelo do editor de 14 abas). A origem
     muda; o editor não. Idempotente: reimportar atualiza, não duplica.
     ============================================================= */
  const STATUS_INTERNO = { 'Ativo reportado': 'ATIVO', 'Pausado reportado': 'PAUSADO', 'Não publicado reportado': 'NAO_PUBLICADO',
    'Em revisão reportado': 'EM_REVISAO', 'Com erro reportado': 'BLOQUEADO', 'Desconhecido': 'EM_REVISAO' };
  function cadastroConverge(cat, opts) {
    opts = opts || {};
    const st = cadStore(cat);
    const eng = opts.eng || (typeof window !== 'undefined' && window.IMPORTAR ? window.IMPORTAR.eng : null);
    const contrib = (eng && eng.snapshots) ? eng.snapshots.filter(s => s.metric_type === 'contrib_produto') : [];
    const camposExtras = (st.imports.length ? st.imports[st.imports.length - 1].campos : []).filter(c => !c.campoNormalizado)
      .map(c => ({ coluna: c.coluna, exemplo: c.exemplo, tipo: c.tipo, status: c.status, aba: 'Outros' }));
    const criados = { produtos: 0, anuncios: 0, variacoes: 0, atualizados: 0 };
    for (const L of st.listings.filter(l => !l.arquivado)) {
      const master = st.masters.find(m => m.key === L.masterKey) || {};
      const vars = st.variacoes.filter(v => v.listingKey === L.key && !v.arquivada);
      const precos = vars.map(v => v.preco).filter(x => x != null);
      const precoBase = precos.length ? Math.min(...precos) : null;
      const estoque = vars.reduce((a, v) => a + (v.estoque || 0), 0);
      const v0 = vars[0] || {}; const g0 = v0.logistica || {}; const f0 = v0.fiscal || {};
      /* Produto Master interno (verdade interna) — id determinístico por masterKey */
      const pid = 'cadp' + hash(L.masterKey).toString(16);
      let p = cat.products.find(x => x.id === pid);
      if (!p) {
        p = { id: pid, nome: master.nome || L.titulo, sku: master.skuPai || null, categoria: L.categoria || '—',
          precoBase, custo: null, estoque, atualizadoEm: L.atualizadoEm, origem: 'DADO IMPORTADO VIA PLANILHA',
          fonte: 'PLANILHA_SHOPEE', importado: true, companyId: L.companyId, tipo: 'IMPORTADO', pendencias: [], lojas: {},
          mkt: { shopee: { status: STATUS_INTERNO[L.statusReportado] || 'EM_REVISAO', preco: precoBase } },
          master: { marca: master.marca || null, material: master.material || null, modelo: master.modelo || null,
            ncm: f0.ncm || null, ean: v0.ean || null, pesoEmbaladoKg: g0.pesoEmbaladoKg || v0.pesoKg || null,
            descricao: master.descricao || null, cor: null, garantia: null, origemFiscal: f0.origem || null } };
        p.variacoes = vars.map((v, i) => ({ id: p.id + '-v' + (i + 1), nome: v.nome || 'única',
          tipo: v.atributoNome || 'variação', sku: v.sku, codigoBarras: v.ean || null, preco: v.preco, precoPromo: v.precoPromo,
          estoque: v.estoque, vendidos: 0, pedidosPagos: 0, ordem: i, status: /Ativo/.test(v.statusReportado) ? 'ATIVA' : 'PAUSADA',
          arquivada: null, skuPai: master.skuPai, pesoKg: v.pesoKg, logistica: v.logistica, fiscal: v.fiscal, cadVarId: v.id }));
        cat.products.push(p); criados.produtos++;
      } else {
        p.precoBase = precoBase; p.estoque = estoque; p.atualizadoEm = L.atualizadoEm;
        p.variacoes = vars.map((v, i) => ({ id: p.id + '-v' + (i + 1), nome: v.nome || 'única', tipo: v.atributoNome || 'variação',
          sku: v.sku, codigoBarras: v.ean || null, preco: v.preco, precoPromo: v.precoPromo, estoque: v.estoque, vendidos: 0,
          pedidosPagos: 0, ordem: i, status: /Ativo/.test(v.statusReportado) ? 'ATIVA' : 'PAUSADA', arquivada: null,
          skuPai: master.skuPai, pesoKg: v.pesoKg, logistica: v.logistica, fiscal: v.fiscal, cadVarId: v.id }));
      }
      /* performance real só quando item_id casa (nunca inventa) */
      const cp = L.itemIdExterno && contrib.find(s => String(s.item_id) === String(L.itemIdExterno));
      const perf = cp && cp.metricas ? { fonte: 'contribuição por produto (importada)', periodo: { ini: cp.periodo_ini, fim: cp.periodo_fim },
        granularidade: 'PERIOD_METRIC', cobertura: 'período importado', confianca: 'alta — item_id igual',
        vendidosTotal: cp.metricas.orders || 0, vendidos7d: null, vendidos30d: null, vendidos90d: cp.metricas.orders || 0,
        faturamento: round2(cp.metricas.sales || 0), pedidosPagos: cp.metricas.orders || 0, pedidosCriados: cp.metricas.orders || 0,
        naoPagos: 0, cancelamentos: 0, devolucoes: 0, impressoes: cp.metricas.impressions || 0, cliques: cp.metricas.clicks || 0,
        visitas: cp.metricas.clicks || 0, carrinhos: null } : null;
      const overrides = { marca: master.marca, material: master.material, modelo: master.modelo, categoria: L.categoria,
        descricao: master.descricao, ncm: f0.ncm, origemFiscal: f0.origem, ean: v0.ean, pesoEmbaladoKg: g0.pesoEmbaladoKg || v0.pesoKg,
        alturaCm: g0.alturaCm, larguraCm: g0.larguraCm, comprimentoCm: g0.comprimentoCm, prazoPostagem: g0.prazoManuseio,
        preco: precoBase, statusInterno: L.statusReportado };
      Object.keys(overrides).forEach(k => overrides[k] == null && delete overrides[k]);
      let listing = cat.listings.find(x => x.id === L.id);
      if (!listing) {
        listing = { id: L.id, produtoId: p.id, marketplace: 'shopee', mktNome: MKT_NOME.shopee, lojaId: null, contaId: L.contaId,
          itemIdExterno: L.itemIdExterno, status: STATUS_INTERNO[L.statusReportado] || 'EM_REVISAO',
          motivo: L.statusReportado === 'Desconhecido' ? 'status reportado desconhecido na planilha' : null, interno: false,
          titulo: L.titulo, preco: precoBase, precoPromo: (vars.find(v => v.precoPromo != null) || {}).precoPromo || null, estoque,
          skuPai: master.skuPai, ean: v0.ean || null, criadoEm: L.importadoEm, atualizadoEm: L.atualizadoEm,
          overrides, correcoes: L.correcoes || [], versoes: L.versoes || [], arquivado: null, excluidoDaAnalise: null,
          fonte: 'PLANILHA_SHOPEE', origem: 'DADO IMPORTADO VIA PLANILHA', situacao: L.situacao,
          statusReportado: L.statusReportado, statusNativo: L.statusReportado,
          cadastroImportado: true, cadastroKey: L.key,
          cadastroRef: { arquivo: L.arquivo, aba: L.aba, importadoEm: L.importadoEm, statusReportado: L.statusReportado },
          midiasReferenciadas: L.midias || [], camposExtras, perf };
        cat.listings.push(listing); criados.anuncios++; criados.variacoes += vars.length;
        /* mídia referenciada na biblioteca do catálogo (com usos), nunca marcada como baixada */
        (L.midias || []).forEach((md, i) => {
          const id = 'mdref' + hash(L.key + md.url).toString(16);
          if (!cat.media.some(x => x.id === id)) cat.media.push({ id, arquivo: md.url || md.arquivo || ('midia-' + i), tipo: md.tipo,
            origem: md.status === 'MÍDIA REFERENCIADA' ? 'MÍDIA REFERENCIADA (Shopee)' : 'UPLOAD MANUAL', status: md.status,
            referenciada: md.status === 'MÍDIA REFERENCIADA', pendenteValidacao: !!md.pendenteValidacao, dataUrl: null,
            em: L.importadoEm, usuario: 'importação', produtoId: p.id, dims: null, pesoKb: null,
            usos: [{ listingId: L.id, posicao: i, principal: !!md.principal }] });
        });
      } else {
        Object.assign(listing, { titulo: L.titulo, preco: precoBase, estoque, overrides, perf,
          midiasReferenciadas: L.midias || [], camposExtras, atualizadoEm: L.atualizadoEm,
          status: STATUS_INTERNO[L.statusReportado] || 'EM_REVISAO', cadastroRef: { arquivo: L.arquivo, aba: L.aba, importadoEm: L.importadoEm, statusReportado: L.statusReportado } });
        criados.atualizados++;
      }
      L.convergedListingId = L.id; L.convergedProdutoId = p.id;
    }
    return criados;
  }

  /* Saúde e Pendências do cadastro — cada fila abre a aba certa do editor */
  /* cada fila abre a aba certa do EDITOR COMPLETO (10.E.3.1) */
  const CAD_FILAS = [
    ['sem_sku', 'Variações sem SKU', 'Informações de Vendas'],
    ['sem_item_id', 'Anúncios sem item_id', 'Informação Básica'],
    ['sem_peso', 'Variações sem peso', 'Envio e Logística'],
    ['sem_dimensao', 'Anúncios sem dimensão', 'Envio e Logística'],
    ['sem_marca', 'Anúncios sem marca', 'Informação Básica'],
    ['sem_ean', 'Variações sem EAN/GTIN', 'Informações Fiscais'],
    ['sem_categoria', 'Anúncios sem categoria', 'Informação Básica'],
    ['sem_descricao', 'Anúncios sem descrição', 'Descrição'],
    ['sem_atributo', 'Anúncios sem atributo obrigatório', 'Especificações'],
    ['variacao_incompleta', 'Variações incompletas', 'Variações'],
    ['sem_foto', 'Anúncios sem foto principal', 'Fotos e Vídeos'],
    ['midia_referenciada', 'Anúncios com mídia apenas referenciada', 'Fotos e Vídeos'],
    ['sem_estoque', 'Variações sem estoque informado', 'Informações de Vendas'],
    ['status_desconhecido', 'Anúncios sem status reconhecido', 'Informação Básica'],
    ['sku_duplicado', 'SKU duplicado', 'Lista de Variações'],
    ['sem_custo', 'Anúncios sem custo cadastrado', 'Economia do Produto'],
    ['sem_perf_vinculo', 'Anúncios sem vínculo de performance', 'Performance Comercial'],
    ['sem_master', 'Anúncios sem Product Master', 'Comparar Marketplaces'],
    ['variacao_sem_vinculo', 'Variações sem vínculo confirmado', 'Lista de Variações'],
  ];
  function saudeCadastro(cat) {
    const st = cadStore(cat);
    const lst = st.listings.filter(l => !l.arquivado), vr = st.variacoes.filter(v => !v.arquivada);
    const temFoto = l => l.midias.some(m => m.principal);
    const masterConfirmado = l => { const m = st.masters.find(x => x.key === l.masterKey); return m && /CONFIRMADO/.test(m.vinculo || ''); };
    const filaMap = {
      sem_sku: vr.filter(v => !v.sku).map(v => v.id),
      sem_item_id: lst.filter(l => !l.itemIdExterno).map(l => l.id),
      sem_peso: vr.filter(v => v.pesoKg == null).map(v => v.id),
      sem_dimensao: lst.filter(l => vr.filter(v => v.listingKey === l.key).every(v => !v.logistica || v.logistica.larguraCm == null)).map(l => l.id),
      sem_marca: lst.filter(l => { const m = st.masters.find(x => x.key === l.masterKey); return !m || !m.marca; }).map(l => l.id),
      sem_ean: vr.filter(v => !v.ean).map(v => v.id),
      sem_categoria: lst.filter(l => !l.categoria).map(l => l.id),
      sem_descricao: lst.filter(l => !l.descricao).map(l => l.id),
      sem_atributo: lst.filter(l => { const m = st.masters.find(x => x.key === l.masterKey); return !m || !m.material; }).map(l => l.id),
      variacao_incompleta: vr.filter(v => v.preco == null || v.estoque == null).map(v => v.id),
      sem_foto: lst.filter(l => !temFoto(l)).map(l => l.id),
      midia_referenciada: lst.filter(l => l.midias.length && l.midias.every(m => m.status === 'MÍDIA REFERENCIADA')).map(l => l.id),
      sem_estoque: vr.filter(v => v.estoque == null).map(v => v.id),
      status_desconhecido: lst.filter(l => l.statusReportado === 'Desconhecido').map(l => l.id),
      sku_duplicado: vr.filter(v => v.conflitoSku).map(v => v.id),
      sem_custo: lst.map(l => l.id), /* cadastro importado nunca traz custo — Economia declara cobertura insuficiente */
      sem_perf_vinculo: lst.filter(l => !l.itemIdExterno).map(l => l.id),
      sem_master: lst.filter(l => !masterConfirmado(l)).map(l => l.id),
      variacao_sem_vinculo: vr.filter(v => { const l = st.listings.find(x => x.key === v.listingKey); return !l || !masterConfirmado(l); }).map(v => v.id),
    };
    return CAD_FILAS.map(([key, label, aba]) => ({ key, label, aba, itens: filaMap[key] || [] }));
  }

  /* relação com pedidos/métricas: por item_id ou SKU — incerto vai para revisão */
  function cadastroRelacoes(cat, eng) {
    const st = cadStore(cat);
    const contrib = (eng && typeof eng === 'object' && eng.snapshots) ? eng.snapshots.filter(s => s.metric_type === 'contrib_produto') : [];
    const out = [];
    for (const l of st.listings.filter(x => !x.arquivado)) {
      const porItem = l.itemIdExterno && contrib.find(s => String(s.item_id) === String(l.itemIdExterno));
      out.push({ listingId: l.id, titulo: l.titulo, item_id: l.itemIdExterno,
        vinculoPerf: porItem ? 'CONFIRMADO POR ITEM_ID' : 'SEM PERFORMANCE VINCULADA',
        vendas: porItem && porItem.metricas ? porItem.metricas.sales : null,
        pedidos: porItem && porItem.metricas ? porItem.metricas.orders : null,
        confianca: porItem ? 'alta — item_id igual' : 'sem correspondência de item_id/SKU no período importado' });
    }
    return { relacoes: out, comPerformance: out.filter(r => r.vinculoPerf !== 'SEM PERFORMANCE VINCULADA').length, semPerformance: out.filter(r => r.vinculoPerf === 'SEM PERFORMANCE VINCULADA').length };
  }

  function cadastroOverview(cat) {
    const st = cadStore(cat);
    return { masters: st.masters.length, listings: st.listings.filter(l => !l.arquivado).length,
      variacoes: st.variacoes.filter(v => !v.arquivada).length, imports: st.imports.length,
      midiasReferenciadas: st.listings.reduce((a, l) => a + l.midias.filter(m => m.status === 'MÍDIA REFERENCIADA').length, 0),
      aguardandoRevisao: st.masters.filter(m => /AGUARDANDO|SUGERIDO/.test(m.vinculo || '')).length };
  }
  const cadListings = cat => cadStore(cat).listings.filter(l => !l.arquivado);
  const cadVariacoesDe = (cat, listingKey) => cadStore(cat).variacoes.filter(v => v.listingKey === listingKey && !v.arquivada);
  const cadMasterDe = (cat, masterKey) => cadStore(cat).masters.find(m => m.key === masterKey);
  const cadCamposRecebidos = cat => {
    const st = cadStore(cat);
    const campos = st.imports.length ? st.imports[st.imports.length - 1].campos.map(c => Object.assign({}, c)) : [];
    for (const c of campos) {
      const mm = (st.manualMappings || []).filter(m => m.coluna === c.coluna).pop();
      if (mm) { c.campoNormalizado = mm.campo; c.entidade = ENTIDADE_NOME[mm.ent] || mm.ent; c.entKey = mm.ent; c.status = 'Mapeado manualmente'; }
    }
    return campos;
  };
  const cadImports = cat => cadStore(cat).imports;
  function cadMapearCampo(cat, coluna, campoDestino, entidade, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    if (!coluna || !campoDestino) return { blocked: true, reason: 'coluna e campo de destino são obrigatórios' };
    const st = cadStore(cat);
    st.manualMappings = st.manualMappings || [];
    st.manualMappings.push({ coluna, campo: campoDestino, ent: entidade || 'AUXILIAR', usuario: opts.usuario || 'Marcos', em: HOJE });
    cadAudit(cat, 'cadastro_campo_mapeado', `${coluna} → ${campoDestino} (${entidade || 'AUXILIAR'})`);
    return { ok: true, nota: 'mapeamento manual registrado e auditado — a coluna original continua preservada na camada bruta' };
  }

  /* edição auditada — nunca altera a Shopee */
  function cadCorrigirCampo(cat, tipo, id, campo, valor, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const bloq = exigeMotivo(opts.motivo); if (bloq) return bloq;
    const st = cadStore(cat);
    const alvo = (tipo === 'variacao' ? st.variacoes : tipo === 'master' ? st.masters : st.listings).find(x => x.id === id);
    if (!alvo) return { blocked: true, reason: 'registro não encontrado' };
    const antes = alvo[campo];
    alvo.correcoes.push({ campo, importadoOriginal: antes, depois: valor, usuario: opts.usuario || 'Marcos', em: HOJE,
      motivo: opts.motivo, origem: 'MANUAL_CORRECTION', vigencia: 'a partir de ' + HOJE });
    alvo[campo] = valor; alvo.atualizadoEm = HOJE;
    cadAudit(cat, 'cadastro_campo_corrigido', `${tipo} ${id} · ${campo}: "${antes ?? ''}" → "${valor}"`, { motivo: opts.motivo });
    return { ok: true, nota: 'valor importado original preservado — correção é camada MANUAL_CORRECTION; a Shopee não é alterada' };
  }
  function cadDecidirVinculo(cat, masterId, decisao, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_EDIT')) return negar(opts.papel, 'CATALOG_EDIT');
    const st = cadStore(cat);
    const m = st.masters.find(x => x.id === masterId);
    if (!m) return { blocked: true, reason: 'master não encontrado' };
    const D = { confirmar: 'VÍNCULO CONFIRMADO MANUALMENTE', rejeitar: 'VÍNCULO REJEITADO', novo: 'NOVO PRODUTO MASTER (humano)', isolar: 'ANÚNCIO ISOLADO' };
    if (!D[decisao]) return { blocked: true, reason: 'decisão inválida' };
    m.vinculo = D[decisao]; if (decisao === 'rejeitar' || decisao === 'novo' || decisao === 'isolar') m.produtoId = null;
    cadAudit(cat, 'cadastro_vinculo_decidido', `master ${masterId} → ${D[decisao]}`);
    return { ok: true, vinculo: m.vinculo };
  }
  function cadAddMediaManual(cat, listingId, meta, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_MEDIA_UPLOAD')) return negar(opts.papel, 'CATALOG_MEDIA_UPLOAD');
    const st = cadStore(cat);
    const l = st.listings.find(x => x.id === listingId);
    if (!l) return { blocked: true, reason: 'anúncio não encontrado' };
    const ext = String(meta.arquivo || '').split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'].includes(ext)) return { blocked: true, reason: `formato .${ext} não aceito para mídia` };
    const md = { id: 'MDM' + (++st.seq), arquivo: meta.arquivo, tipo: ['mp4', 'mov'].includes(ext) ? 'video' : 'foto',
      principal: !!meta.principal, origem: 'UPLOAD MANUAL', status: 'CARREGADA MANUALMENTE', pendenteValidacao: false,
      pesoKb: meta.pesoKb || null, em: HOJE, usuario: opts.usuario || 'Marcos' };
    l.midias.push(md);
    cadAudit(cat, 'cadastro_midia_manual', `anúncio ${listingId} · ${meta.arquivo}`);
    return { ok: true, media: md };
  }
  function cadArquivar(cat, tipo, id, opts) {
    opts = opts || {};
    if (!canCat(opts.papel || 'OWNER', 'CATALOG_ARCHIVE')) return negar(opts.papel, 'CATALOG_ARCHIVE');
    const bloq = exigeMotivo(opts.motivo); if (bloq) return bloq;
    const st = cadStore(cat);
    const alvo = (tipo === 'variacao' ? st.variacoes : st.listings).find(x => x.id === id);
    if (!alvo) return { blocked: true, reason: 'registro não encontrado' };
    alvo[tipo === 'variacao' ? 'arquivada' : 'arquivado'] = { em: HOJE, motivo: opts.motivo, usuario: opts.usuario || 'Marcos' };
    cadAudit(cat, 'cadastro_arquivado', `${tipo} ${id}`, { motivo: opts.motivo });
    return { ok: true, nota: 'arquivado internamente — histórico preservado; nada alterado na Shopee' };
  }

  /* fixture de cadastro (schema do template Shopee, rotulada) */
  function cadastroFixture() {
    const H = ['Categoria', 'Nome do produto', 'Descrição do produto', 'Número de referência do SKU pai', 'ID do Item',
      'Marca', 'Modelo', 'Material', 'Nome da variação', 'Opção da variação', 'SKU', 'Preço', 'Preço promocional',
      'Estoque', 'Código de barras', 'Peso', 'Peso embalado', 'Largura', 'Altura', 'Comprimento', 'Prazo de manuseio',
      'Tipo de envio', 'NCM', 'Origem fiscal', 'CEST', 'Imagem principal', 'Imagem 2', 'Imagem 3', 'Vídeo', 'Status', 'Condição'];
    const row = a => { const o = {}; H.forEach((h, i) => o[h] = a[i] ?? ''); return o; };
    return {
      nome: 'Shopee_mass_upload_2026-07-05_basic_template.xlsx', sourceType: 'PLANILHA_SHOPEE', periodo: null,
      abas: [{ nome: 'Basic Template', headers: H, rows: [
        row(['Decoração > Quadros', 'Quadro Paisagem 60x90 Premium', 'Quadro decorativo em canvas', 'QP-6090', '900101', 'Líder Molduras', 'QP-PRE', 'Canvas', 'Tamanho', '60x90', 'QP-6090', '124,90', '112,41', '12', '7890001112223', '1,2', '1,5', '10', '65', '95', '2 dias', 'Shopee Xpress', '4911.91.00', '0 - Nacional', '2801100', 'https://cf.shopee.com.br/9001/main.jpg', 'https://cf.shopee.com.br/9001/2.jpg', '', '', 'Ativo', 'Novo']),
        row(['Decoração > Quadros', 'Quadro Paisagem 60x90 Premium', '', 'QP-6090', '900101', 'Líder Molduras', 'QP-PRE', 'Canvas', 'Tamanho', '80x120', 'QP-80120', '189,90', '', '9', '', '1,8', '2,1', '12', '85', '125', '2 dias', 'Shopee Xpress', '4911.91.00', '0 - Nacional', '', '', '', '', '', 'Ativo', 'Novo']),
        row(['Decoração > Kits', 'Kit 3 Quadros Sala Moderna', 'Kit com 3 quadros', 'KIT3-SALA', '900202', 'Líder Molduras', 'K3-SALA', 'MDF', 'Modelo', 'Sala Moderna', 'KIT3-SALA', '244,90', '', '3', '7890004445556', '2,5', '3,0', '50', '40', '8', '3 dias', 'Correios', '4911.91.00', '0 - Nacional', '', 'https://cf.shopee.com.br/9002/main.jpg', '', '', 'https://cf.shopee.com.br/9002/video.mp4', 'Pausado', 'Novo']),
        row(['Decoração', 'Espelho Adnet Orgânico', 'Espelho decorativo', 'ESP-ADN', '', 'Reflexo', '', 'Vidro', 'Tamanho', '50cm', 'ESP-ADN-50', '159,90', '', '', '', '2,0', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Desconhecido', 'Novo']),
        row(['', 'Produto sem SKU nem item_id', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']),
      ] }],
    };
  }

  return { FONTES, MKTS: MKTS.map(([key, nome]) => ({ key, nome })), CATALOG_PERMS, CATALOG_PERMS_ALL, canCat,
    createCatalog, byId, prodOf, ativos, valorDe, fotosDe, salesInfo, perfComercial, convExp,
    assertRanking, rankingDe, listingTags, searchListings, quickFilter, overview, health, FILAS,
    masterVsListings, compareMkts, editListing, correctListingField, editMasterSafe,
    addVariation, editVariation, archiveVariation, addMedia, setPrincipal, removeFromListing, mediaUsage,
    ADAPT_RULES, duplicateListing, adaptListing, cancelDraft,
    bulkPreview, bulkCommit, bulkRollback, archiveListing, restoreListing, timelineDe, versionsCompare,
    /* 10.E.2.4 — importação real de cadastro Shopee */
    CADASTRO_SCHEMA, ENTIDADE_NOME, CAD_FILAS, statusReportado, cadastroDetect, cadastroStage, cadastroApply,
    saudeCadastro, cadastroRelacoes, cadastroOverview, cadListings, cadVariacoesDe, cadMasterDe, cadCamposRecebidos,
    cadImports, cadCorrigirCampo, cadDecidirVinculo, cadAddMediaManual, cadArquivar, cadMapearCampo, cadastroFixture,
    /* 10.E.3.1 — convergência para o editor completo */
    cadastroConverge, STATUS_INTERNO,
    /* 10.E.3.1 (redesign) — status nativo × Head + diagnóstico */
    STATUS_OPERACIONAL, statusOperacional, diagnosticoProduto, TAG_HEAD,
    /* 10.E.3.3 — catálogo operacional: ciclo de vida, matriz, identidade, SKU-chave, criativos, experimentos, publicação */
    LIFECYCLE, TRANSICOES, transicionar, estadoInicial, matrizDaLoja, identidadeExterna,
    mediaHash, reorderMedia, addMediaReal, vincularMediaSku, addCreative, criativosDoSku, analiseCriativo,
    EXP_STATUS, criarExperimento, avaliarExperimento, solicitarPublicacao, registrarRetornoOficial, skuDossie,
    detectarMkt, criarAnuncioComando, anexarFotoComando, adaptarCriativoVencedor };
}));

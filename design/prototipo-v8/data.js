/* =============================================================
   HEAD MARKETPLACE OS · v8 — DADOS + LÓGICA (UMD)
   Todo dado aqui é DADO SIMULADO e rotulado como tal. Nenhuma conta
   externa está conectada; nenhuma escrita externa é possível.
   A lógica (V8LOGIC) é pura e roda em Node (testes) e no navegador.

   10.UI.1: contexto global (empresa · marketplace · período),
   Crescimento sem CRM (performance, oportunidades, pedidos não
   pagos, experimentos, aceleração, expansão) e gates de decisão.
   ============================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { const m = factory(); root.V8DATA = m.V8DATA; root.V8LOGIC = m.V8LOGIC; }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MKTS = [
    { key: 'ml',     nome: 'Mercado Livre' },
    { key: 'shopee', nome: 'Shopee' },
    { key: 'tiktok', nome: 'TikTok Shop' },
    { key: 'magalu', nome: 'Magalu' },
  ];

  /* status canônicos exigidos pelo sprint 10.UI */
  const STATUS = {
    PRODUCAO: 'PRODUÇÃO', STAGING: 'STAGING', DEMONSTRACAO: 'DEMONSTRAÇÃO',
    DADO_REAL: 'DADO REAL', DADO_IMPORTADO: 'DADO IMPORTADO', DADO_SIMULADO: 'DADO SIMULADO',
    SEM_DADOS: 'SEM DADOS', AGUARDANDO_CONEXAO: 'AGUARDANDO CONEXÃO',
    ACAO_INTERNA: 'AÇÃO INTERNA', ESCRITA_BLOQUEADA: 'ESCRITA EXTERNA BLOQUEADA',
    EM_PROCESSAMENTO: 'EM PROCESSAMENTO', AGUARDANDO_APROVACAO: 'AGUARDANDO APROVAÇÃO',
    EM_REVISAO: 'EM REVISÃO', BLOQUEADO: 'BLOQUEADO', PRONTO_REVISAO: 'PRONTO PARA REVISÃO',
  };

  const P = (id, nome, sku, categoria, tipo, estoque, custo, precoBase, mkt, pend, up) => ({
    id, nome, sku, categoria, tipo, estoque, custo, precoBase,
    origem: STATUS.DADO_SIMULADO, atualizadoEm: up, pendencias: pend,
    mkt, master: {
      titulo: nome, marca: 'Casa Demo', descricao: `Descrição base de ${nome}. (dado simulado)`,
      pesoEmbaladoKg: pend.includes('peso embalado ausente') ? null : 1.2,
      material: pend.includes('ficha técnica incompleta: material') ? null : 'MDF / vidro / metal',
    },
    versoes: [],
  });
  const M = (status, preco, extra) => Object.assign({ status, preco, profile: {} }, extra || {});

  const products = [
    P('p1', 'Quadro Paisagem 60x90', 'QP-6090', 'Decoração', 'PRONTA_ENTREGA', 34, 48.9, 129.9,
      { ml: M('ATIVO', 129.9, { profile: { titulo: 'Quadro Paisagem 60x90 c/ Maleta Presente' } }),
        shopee: M('ATIVO', 124.9, { profile: { titulo: 'Quadro Paisagem Grande 60x90 Sala' } }),
        tiktok: M('NAO_PUBLICADO', null), magalu: M('PAUSADO', 132.9) },
      [], '2026-07-03'),
    P('p2', 'Kit 3 Quadros Sala Moderna', 'KIT3-SALA', 'Decoração', 'PRONTA_ENTREGA', 6, 92.0, 249.9,
      { ml: M('ATIVO', 249.9), shopee: M('ATIVO', 244.9), tiktok: M('ATIVO', 239.9), magalu: M('NAO_PUBLICADO', null) },
      ['risco de ruptura de estoque'], '2026-07-04'),
    P('p3', 'Quadro Personalizado Nome Família', 'QPN-FAM', 'Decoração', 'PERSONALIZADO', 0, 39.0, 159.9,
      { ml: M('ATIVO', 159.9), shopee: M('EM_REVISAO', 154.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['foto sem escala real'], '2026-07-02'),
    P('p4', 'Espelho Decorativo Orgânico 70cm', 'ESP-ORG', 'Decoração', 'SOB_ENCOMENDA', 0, 110.0, 289.9,
      { ml: M('PAUSADO', 289.9), shopee: M('BLOQUEADO', null, { motivo: 'sob encomenda: modalidade de envio incompatível (regra provisória interna)' }),
        tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['peso embalado ausente'], '2026-06-30'),
    P('p5', 'Quadro Abstrato Dourado 50x70', 'QAD-ABS', 'Decoração', 'PRONTA_ENTREGA', 21, 41.5, 119.9,
      { ml: M('ATIVO', 119.9), shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('ATIVO', 122.9) },
      ['ficha técnica incompleta: material'], '2026-07-01'),
    P('p6', 'Porta-Retrato 3D Duplo Vidro', 'POR-3D', 'Decoração', 'PRONTA_ENTREGA', 58, 18.4, 59.9,
      { ml: M('ATIVO', 59.9), shopee: M('ATIVO', 57.9), tiktok: M('ATIVO', 55.9), magalu: M('ATIVO', 59.9) },
      [], '2026-07-04'),
    P('p7', 'Garrafa Térmica Inox 1L', 'GAR-1L', 'Casa e Cozinha', 'PRONTA_ENTREGA', 112, 27.0, 89.9,
      { ml: M('ATIVO', 89.9), shopee: M('ATIVO', 84.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('ATIVO', 88.9) },
      [], '2026-07-03'),
    P('p8', 'Cafeteira Italiana 6 Xícaras', 'CAF-6X', 'Casa e Cozinha', 'PRONTA_ENTREGA', 40, 33.2, 109.9,
      { ml: M('ATIVO', 109.9), shopee: M('PAUSADO', 104.9), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      [], '2026-06-28'),
    P('p9', 'Tênis Runner Feminino 37', 'TEN-R37', 'Moda e Calçados', 'PRONTA_ENTREGA', 14, 61.0, 179.9,
      { ml: M('EM_REVISAO', 179.9), shopee: M('ATIVO', 169.9), tiktok: M('ATIVO', 174.9), magalu: M('NAO_PUBLICADO', null) },
      ['grade de numeração incompleta'], '2026-07-02'),
    P('p10', 'Luminária de Mesa LED Touch', 'LUM-LED', 'Iluminação', 'PRONTA_ENTREGA', 27, 44.8, 139.9,
      { ml: M('BLOQUEADO', null, { motivo: 'certificação INMETRO não informada (exigência da categoria — pack interno provisório)' }),
        shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['certificação INMETRO não informada'], '2026-06-25'),
    P('p11', 'Caneca Cerâmica Eco 350ml', 'CAN-ECO', 'Casa e Cozinha', 'PRONTA_ENTREGA', 203, 9.9, 39.9,
      { ml: M('ATIVO', 39.9), shopee: M('ATIVO', 37.9), tiktok: M('ATIVO', 36.9), magalu: M('ATIVO', 39.9) },
      [], '2026-07-04'),
    P('p12', 'Organizador MDF Escritório 4 nichos', 'ORG-MDF', 'Escritório', 'SOB_ENCOMENDA', 0, 52.0, 149.9,
      { ml: M('NAO_PUBLICADO', null), shopee: M('NAO_PUBLICADO', null), tiktok: M('NAO_PUBLICADO', null), magalu: M('NAO_PUBLICADO', null) },
      ['dimensões da embalagem ausentes'], '2026-06-20'),
  ];

  /* multiempresa: e1 = decoração/moda/iluminação, e2 = casa e cozinha */
  const COMPANY_OF = { p7: 'e2', p8: 'e2', p11: 'e2' };
  for (const p of products) p.companyId = COMPANY_OF[p.id] || 'e1';

  /* 10.UI.2 — presença POR LOJA: estoque, preço, prazo, status e pendência
     variam por loja; o Product Master continua único. */
  const SL = (estoque, preco, prazoDias, status, extra) =>
    Object.assign({ estoque, preco, prazoDias, status, pendencia: null, contaId: null }, extra || {});
  const LOJAS_DE = {
    p1: { s1: SL(12, 124.9, 2, 'ATIVO', { contaId: 'acc-shp-1' }), s4: SL(8, 119.9, 3, 'ATIVO', { contaId: 'acc-shp-2' }),
          s2: SL(14, 129.9, 2, 'ATIVO', { contaId: 'acc-ml-1' }), s6: SL(0, 132.9, 5, 'PAUSADO', { contaId: 'acc-mg-1', pendencia: 'sem estoque no CD SP' }) },
    p2: { s1: SL(3, 244.9, 2, 'ATIVO', { contaId: 'acc-shp-1', pendencia: 'risco de ruptura' }), s2: SL(3, 249.9, 2, 'ATIVO', { contaId: 'acc-ml-1' }),
          s5: SL(0, 239.9, 4, 'ATIVO', { contaId: 'acc-tt-1', pendencia: 'estoque zerado no CD SP' }), s3: SL(2, 259.9, 0, 'ATIVO') },
    p3: { s2: SL(0, 159.9, 5, 'ATIVO', { contaId: 'acc-ml-1' }), s1: SL(0, 154.9, 6, 'EM_REVISAO', { contaId: 'acc-shp-1', pendencia: 'foto sem escala real' }) },
    p4: { s2: SL(0, 289.9, 9, 'PAUSADO', { contaId: 'acc-ml-1' }), s3: SL(1, 299.9, 0, 'ATIVO') },
    p5: { s2: SL(11, 119.9, 2, 'ATIVO', { contaId: 'acc-ml-1' }), s4: SL(10, 115.9, 3, 'ATIVO', { contaId: 'acc-shp-2' }), s6: SL(0, 122.9, 5, 'NAO_PUBLICADO') },
    p6: { s1: SL(20, 57.9, 2, 'ATIVO', { contaId: 'acc-shp-1' }), s2: SL(22, 59.9, 2, 'ATIVO', { contaId: 'acc-ml-1' }),
          s4: SL(6, 55.9, 3, 'ATIVO', { contaId: 'acc-shp-2' }), s5: SL(10, 55.9, 4, 'ATIVO', { contaId: 'acc-tt-1' }), s3: SL(12, 62.9, 0, 'ATIVO') },
    p9: { s2: SL(14, 179.9, 3, 'EM_REVISAO', { contaId: 'acc-ml-1', pendencia: 'grade incompleta' }), s5: SL(9, 174.9, 4, 'ATIVO', { contaId: 'acc-tt-1' }) },
    p10: { s2: SL(27, null, 4, 'BLOQUEADO', { contaId: 'acc-ml-1', pendencia: 'certificação INMETRO não informada' }) },
    p12: { s3: SL(0, 149.9, 0, 'NAO_PUBLICADO', { pendencia: 'dimensões da embalagem ausentes' }) },
    p7: { s7: SL(60, 84.9, 2, 'ATIVO', { contaId: 'acc-shp-3' }), s8: SL(52, 89.9, 2, 'ATIVO', { contaId: 'acc-ml-2' }) },
    p8: { s8: SL(40, 109.9, 3, 'ATIVO', { contaId: 'acc-ml-2' }), s7: SL(0, 104.9, 3, 'PAUSADO', { contaId: 'acc-shp-3' }) },
    p11: { s7: SL(101, 37.9, 2, 'ATIVO', { contaId: 'acc-shp-3' }), s8: SL(102, 39.9, 2, 'ATIVO', { contaId: 'acc-ml-2' }) },
  };
  for (const p of products) p.lojas = LOJAS_DE[p.id] || {};

  /* ---------- performance por marketplace × período (funil honesto) ----------
     Etapas sem integração/dado importado ficam null → SEM DADOS (nunca inventadas). */
  const F = (impressoes, cliques, visitas, pedidosCriados, naoPagos, aprovados, enviados, entregues, faturamento, devolucoes, cancelamentos, reputacao) =>
    ({ impressoes, cliques, visitas, carrinho: null, pedidosCriados, naoPagos, aprovados,
       preparacao: aprovados, enviados, entregues, avaliacao: null, recompra: null,
       faturamento, devolucoes, cancelamentos, reputacao, origem: STATUS.DADO_SIMULADO });
  const performance = {
    ml: {
      hoje: F(4100, 152, 118, 11, 3, 8, 7, 5, 1189.2, 0, 0, 4.7),
      '7d': F(30240, 1088, 842, 74, 19, 55, 53, 49, 7822.4, 3, 1, 4.7),
      '30d': F(121800, 4270, 3310, 291, 68, 223, 218, 205, 30411.0, 11, 6, 4.7),
      anterior7d: F(28110, 1124, 869, 71, 14, 57, 55, 51, 8016.9, 2, 1, 4.8),
    },
    shopee: {
      hoje: F(2890, 121, 96, 9, 4, 5, 5, 4, 612.3, 0, 1, 4.5),
      '7d': F(19850, 903, 700, 58, 21, 37, 36, 33, 4310.7, 4, 2, 4.5),
      '30d': F(80110, 3520, 2760, 230, 74, 156, 151, 144, 17240.8, 13, 8, 4.5),
      anterior7d: F(20470, 861, 671, 52, 13, 39, 38, 36, 4488.1, 3, 1, 4.6),
    },
    tiktok: {
      hoje: F(1120, 64, 51, 4, 1, 3, 3, 2, 301.4, 0, 0, 4.3),
      '7d': F(8340, 447, 352, 26, 7, 19, 18, 16, 2044.6, 1, 1, 4.3),
      '30d': F(30190, 1690, 1330, 96, 24, 72, 70, 66, 7591.2, 5, 3, 4.3),
      anterior7d: F(7220, 391, 300, 22, 5, 17, 17, 15, 1837.5, 1, 0, 4.4),
    },
    magalu: null, /* sem integração nem importação → SEM DADOS, nunca inventar */
  };

  /* ---------- pedidos não pagos (perda entre pedido criado e pagamento) ---------- */
  const pedidosNaoPagos = [
    { id: 'np1', lojaId: 's1', contaId: 'acc-shp-1', marketplace: 'shopee', produtoId: 'p2', anuncio: 'Kit 3 Quadros Sala Moderna', valor: 244.9, frete: 22.4, desconto: 0, cupom: null, formaPagamento: 'pix (expirado)', motivo: 'pagamento não concluído no prazo', data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np2', lojaId: 's1', contaId: 'acc-shp-1', marketplace: 'shopee', produtoId: 'p1', anuncio: 'Quadro Paisagem Grande 60x90 Sala', valor: 124.9, frete: 19.9, desconto: 0, cupom: 'removido em 01/07', formaPagamento: null, motivo: null, data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np3', lojaId: 's2', contaId: 'acc-ml-1', marketplace: 'ml', produtoId: 'p2', anuncio: 'Kit 3 Quadros Sala Moderna', valor: 249.9, frete: 0, desconto: 0, cupom: null, formaPagamento: 'boleto (vencido)', motivo: 'boleto não pago', data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np4', lojaId: 's8', contaId: 'acc-ml-2', marketplace: 'ml', produtoId: 'p7', anuncio: 'Garrafa Térmica Inox 1L', valor: 89.9, frete: 14.5, desconto: 5, cupom: null, formaPagamento: null, motivo: null, data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np5', lojaId: 's7', contaId: 'acc-shp-3', marketplace: 'shopee', produtoId: 'p11', anuncio: 'Caneca Cerâmica Eco 350ml', valor: 37.9, frete: 16.9, desconto: 0, cupom: null, formaPagamento: null, motivo: null, data: '2026-07-01', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np6', lojaId: 's5', contaId: 'acc-tt-1', marketplace: 'tiktok', produtoId: 'p6', anuncio: 'Porta-Retrato 3D Duplo Vidro', valor: 55.9, frete: 12.9, desconto: 0, cupom: null, formaPagamento: 'cartão (recusado)', motivo: 'cartão recusado', data: '2026-07-01', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np7', lojaId: 's4', contaId: 'acc-shp-2', marketplace: 'shopee', produtoId: 'p1', anuncio: 'Quadro Paisagem 60x90 (Diamonds)', valor: 119.9, frete: 21.9, desconto: 0, cupom: null, formaPagamento: null, motivo: null, data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np8', lojaId: 's4', contaId: 'acc-shp-2', marketplace: 'shopee', produtoId: 'p6', anuncio: 'Porta-Retrato 3D (Diamonds)', valor: 55.9, frete: 15.9, desconto: 0, cupom: null, formaPagamento: 'pix (expirado)', motivo: 'pagamento não concluído no prazo', data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
  ];

  /* ---------- fila priorizada de oportunidades (sem CRM) ---------- */
  const oportunidades = [
    { id: 'o1', tipo: 'margem saudável e pouco tráfego', produtoId: 'p7', marketplace: 'tiktok',
      evidencia: 'margem 70% no catálogo; sem presença no TikTok Shop; 8,3k impressões/7d nos canais atuais', hipotese: 'público do canal comporta o item; tráfego adicional sem canibalizar', impacto: 'R$ 900–1.400/mês', risco: 'baixo — rascunho interno reversível', margem: 70.0, prioridade: 92, confianca: 'média', acao: 'criar rascunho interno TikTok', responsavel: 'Head', status: 'ABERTA' },
    { id: 'o2', tipo: 'venda alta e margem ruim', produtoId: 'p2', marketplace: 'shopee',
      evidencia: '21 pedidos não pagos/7d; frete R$ 22,40 acima da mediana da categoria', hipotese: 'frete no checkout derruba a conclusão do pagamento', impacto: 'R$ 5.1k em pedidos não pagos/7d', risco: 'médio — mexe em preço/frete', margem: 62.3, prioridade: 88, confianca: 'média', acao: 'experimento de frete/preço', responsavel: 'Marcos', status: 'ABERTA' },
    { id: 'o3', tipo: 'devolução acima do padrão', produtoId: 'p3', marketplace: 'ml',
      evidencia: '“veio diferente da foto” 3× na semana (vigia do Silêncio)', hipotese: 'foto sem escala real descalibra expectativa', impacto: 'reduzir devolução 4–8%', risco: 'baixo', margem: 75.6, prioridade: 85, confianca: 'alta', acao: 'refazer foto com escala real', responsavel: 'Marcos', status: 'EM ANDAMENTO' },
    { id: 'o4', tipo: 'CTR baixo', produtoId: 'p8', marketplace: 'ml',
      evidencia: 'CTR 2,1% vs 3,6% da mediana interna da categoria (7d)', hipotese: 'primeira imagem não comunica capacidade (6 xícaras)', impacto: '+30% cliques estimados', risco: 'baixo — troca de imagem reversível', margem: 69.8, prioridade: 74, confianca: 'média', acao: 'experimento de imagem', responsavel: 'Head', status: 'ABERTA' },
    { id: 'o5', tipo: 'potencial de kit', produtoId: 'p11', marketplace: 'shopee',
      evidencia: 'caneca com 75% de margem e frete alto proporcional (R$ 16,90 sobre R$ 37,90)', hipotese: 'kit 4 unidades dilui frete e sobe ticket', impacto: '+ticket médio 2,4×', risco: 'baixo', margem: 75.2, prioridade: 71, confianca: 'média', acao: 'montar kit interno (gate margem+logística)', responsavel: 'Head', status: 'ABERTA' },
    { id: 'o6', tipo: 'produto pronto para Ads', produtoId: 'p6', marketplace: 'ml',
      evidencia: 'readiness 100%, sem pendências, margem 69,3%, conversão 6,6% (7d)', hipotese: 'base validada suporta tráfego pago com margem', impacto: '+40–60 pedidos/mês', risco: 'médio — orçamento', margem: 69.3, prioridade: 68, confianca: 'média', acao: 'planejar Ads (gate ok)', responsavel: 'Marcos', status: 'ABERTA' },
    { id: 'o7', tipo: 'anúncio pronto para revisão', produtoId: 'p9', marketplace: 'ml',
      evidencia: 'EM REVISÃO no ML por grade incompleta; Shopee ativa vende 9/7d', hipotese: 'completar grade destrava o canal de maior tráfego', impacto: 'canal ML reaberto', risco: 'baixo', margem: 66.1, prioridade: 66, confianca: 'alta', acao: 'completar grade 34–36', responsavel: 'Marcos', status: 'ABERTA' },
    { id: 'o8', tipo: 'produto campeão com risco operacional', produtoId: 'p2', marketplace: 'ml',
      evidencia: 'cobertura de estoque 4,7 dias no ritmo atual', hipotese: 'ruptura interrompe o item de maior receita', impacto: 'proteger R$ 2,5k/semana', risco: 'alto se esperar', margem: 63.2, prioridade: 95, confianca: 'alta', acao: 'frear demanda / repor estoque', responsavel: 'Head', status: 'EM ANDAMENTO' },
  ];

  /* ---------- experimentos (testes reais, com gates) ---------- */
  const experimentos = [
    { id: 'x1', tipo: 'frete', alvo: 'p2', marketplace: 'shopee', hipotese: 'frete alto derruba conclusão de pagamento do kit',
      periodo: '2026-07-01 → 2026-07-14', metricaPrimaria: 'taxa de pagamento aprovado', metricaSecundaria: 'pedidos criados',
      margemMinima: 45, risco: 'médio', pontoDeParada: 'margem < 45% ou queda de 15% em pedidos', responsavel: 'Marcos',
      status: 'EM PROCESSAMENTO', resultadoEsperado: 'aprovação de 64% → 75%', resultadoObservado: 'parcial: 68% em 3 dias', aprendizado: null, origem: STATUS.DADO_SIMULADO },
    { id: 'x2', tipo: 'imagem', alvo: 'p3', marketplace: 'ml', hipotese: 'foto com escala real reduz devolução por expectativa',
      periodo: '2026-06-10 → 2026-06-24', metricaPrimaria: 'taxa de devolução', metricaSecundaria: 'conversão',
      margemMinima: 60, risco: 'baixo', pontoDeParada: 'conversão cair 10%', responsavel: 'Head',
      status: 'CONCLUÍDO (interno)', resultadoEsperado: 'devolução −4pp', resultadoObservado: 'devolução −5,2pp; conversão estável', aprendizado: 'expectativa calibrada corta devolução sem custo de conversão', origem: STATUS.DADO_SIMULADO },
  ];

  const V8DATA = {
    meta: {
      env: STATUS.DEMONSTRACAO,
      empresas: [
        { id: 'e1', nome: 'Líder Comércio Digital LTDA', conta: 'multicanal · 2 CNPJs · 6 lojas' },
        { id: 'e2', nome: 'Cozinha Demo Comércio ME', conta: '1 CNPJ · 2 lojas' },
      ],
      empresa: 'Empresa Demonstração LTDA',
      conta: 'conta-demo · multicanal',
      usuario: 'Marcos', papel: 'ADMIN',
      hoje: '2026-07-04',
      aviso: 'Todos os dados desta instância são simulados e rotulados. Nenhuma conta externa conectada; escrita externa bloqueada.',
    },
    STATUS, MKTS, products,
    /* 10.E.2.5.2 — filtro global de período completo (resolvido por V8TIME) */
    PERIODOS: [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['esta_semana', 'Esta semana'], ['semana_passada', 'Semana passada'],
      ['7d', 'Últimos 7 dias'], ['15d', 'Últimos 15 dias'], ['30d', 'Últimos 30 dias'], ['este_mes', 'Este mês'],
      ['mes_passado', 'Mês passado'], ['3m', 'Últimos 3 meses'], ['este_ano', 'Este ano'], ['ano_passado', 'Último ano'], ['custom', 'Período personalizado']],

    /* ============ 10.UI.2 · ESCOPO OPERACIONAL ============
       Grupo → Empresa → CNPJ → Loja → Conta de marketplace.
       Loja NÃO é sinônimo de marketplace: existe loja física, e uma
       loja pode ter mais de uma conta. g2/e3 existem para provar que
       dado de grupo não autorizado NUNCA vaza. */
    scope: {
      grupos: [
        { id: 'g1', nome: 'Líder Group', autorizado: true },
        { id: 'g2', nome: 'Grupo Externo (sem permissão)', autorizado: false },
      ],
      empresas: [
        { id: 'e1', grupoId: 'g1', nome: 'Líder Comércio Digital LTDA' },
        { id: 'e2', grupoId: 'g1', nome: 'Cozinha Demo Comércio ME' },
        { id: 'e3', grupoId: 'g2', nome: 'Empresa Externa Não Autorizada' },
      ],
      cnpjs: [
        { id: 'c1', empresaId: 'e1', nome: 'Matriz MG', doc: '12.345.678/0001-00 (simulado)' },
        { id: 'c2', empresaId: 'e1', nome: 'Filial SP', doc: '12.345.678/0002-81 (simulado)' },
        { id: 'c3', empresaId: 'e2', nome: 'CNPJ Único', doc: '98.765.432/0001-00 (simulado)' },
        { id: 'c9', empresaId: 'e3', nome: 'CNPJ Externo', doc: '— (simulado)' },
      ],
      lojas: [
        { id: 's1', cnpjId: 'c1', nome: 'Shopee Líder Molduras MG', tipo: 'marketplace', marketplace: 'shopee', deposito: 'CD Lagoa Santa', responsavel: 'Ana' },
        { id: 's2', cnpjId: 'c1', nome: 'Mercado Livre Líder Molduras', tipo: 'marketplace', marketplace: 'ml', deposito: 'CD Lagoa Santa', responsavel: 'Marcos' },
        { id: 's3', cnpjId: 'c1', nome: 'Loja Física Lagoa Santa', tipo: 'fisica', marketplace: null, deposito: 'Loja Lagoa Santa', responsavel: 'Paula' },
        { id: 's4', cnpjId: 'c1', nome: 'Shopee Galeria Diamonds', tipo: 'marketplace', marketplace: 'shopee', deposito: 'CD Lagoa Santa', responsavel: 'Ana' },
        { id: 's5', cnpjId: 'c2', nome: 'TikTok Shop Líder', tipo: 'marketplace', marketplace: 'tiktok', deposito: 'CD São Paulo', responsavel: 'Bruno' },
        { id: 's6', cnpjId: 'c2', nome: 'Magalu Líder SP', tipo: 'marketplace', marketplace: 'magalu', deposito: 'CD São Paulo', responsavel: 'Bruno' },
        { id: 's7', cnpjId: 'c3', nome: 'Shopee Cozinha Demo', tipo: 'marketplace', marketplace: 'shopee', deposito: 'CD Cozinha', responsavel: 'Marcos' },
        { id: 's8', cnpjId: 'c3', nome: 'ML Cozinha Demo', tipo: 'marketplace', marketplace: 'ml', deposito: 'CD Cozinha', responsavel: 'Marcos' },
        { id: 's9', cnpjId: 'c9', nome: 'Loja Externa (invisível)', tipo: 'marketplace', marketplace: 'ml', deposito: '—', responsavel: '—' },
      ],
      contas: [
        { id: 'acc-shp-1', lojaId: 's1', marketplace: 'shopee', nome: 'shopee·lider-molduras-mg' },
        { id: 'acc-ml-1', lojaId: 's2', marketplace: 'ml', nome: 'ml·lider-molduras' },
        { id: 'acc-ml-1b', lojaId: 's2', marketplace: 'ml', nome: 'ml·lider-molduras-outlet' },
        { id: 'acc-shp-2', lojaId: 's4', marketplace: 'shopee', nome: 'shopee·galeria-diamonds' },
        { id: 'acc-tt-1', lojaId: 's5', marketplace: 'tiktok', nome: 'tiktok·lider' },
        { id: 'acc-mg-1', lojaId: 's6', marketplace: 'magalu', nome: 'magalu·lider-sp' },
        { id: 'acc-shp-3', lojaId: 's7', marketplace: 'shopee', nome: 'shopee·cozinha-demo' },
        { id: 'acc-ml-2', lojaId: 's8', marketplace: 'ml', nome: 'ml·cozinha-demo' },
      ],
    },

    /* performance POR LOJA × período (loja física: sem funil digital → SEM DADOS) */
    lojaPerf: {
      s1: { hoje: { pedidos: 6, naoPagos: 2, aprovados: 4, faturamento: 512.3, devolucoes: 0, conversao: 4.9, estoqueCritico: 1 },
            '7d': { pedidos: 38, naoPagos: 14, aprovados: 24, faturamento: 2810.6, devolucoes: 3, conversao: 5.0, estoqueCritico: 1 },
            '30d': { pedidos: 149, naoPagos: 47, aprovados: 102, faturamento: 11205.4, devolucoes: 9, conversao: 5.2, estoqueCritico: 2 },
            anterior7d: { pedidos: 34, naoPagos: 8, aprovados: 26, faturamento: 3021.9, devolucoes: 2, conversao: 5.4 } },
      s2: { hoje: { pedidos: 9, naoPagos: 2, aprovados: 7, faturamento: 1044.8, devolucoes: 0, conversao: 6.4, estoqueCritico: 1 },
            '7d': { pedidos: 61, naoPagos: 15, aprovados: 46, faturamento: 6512.7, devolucoes: 2, conversao: 6.5, estoqueCritico: 1 },
            '30d': { pedidos: 240, naoPagos: 55, aprovados: 185, faturamento: 25107.9, devolucoes: 8, conversao: 6.6, estoqueCritico: 1 },
            anterior7d: { pedidos: 58, naoPagos: 11, aprovados: 47, faturamento: 6690.2, devolucoes: 2, conversao: 6.7 } },
      s3: { hoje: { pedidos: 4, naoPagos: 0, aprovados: 4, faturamento: 389.6, devolucoes: 0, conversao: null, estoqueCritico: 0 },
            '7d': { pedidos: 22, naoPagos: 0, aprovados: 22, faturamento: 2144.0, devolucoes: 1, conversao: null, estoqueCritico: 0 },
            '30d': { pedidos: 88, naoPagos: 0, aprovados: 88, faturamento: 8352.7, devolucoes: 2, conversao: null, estoqueCritico: 0 },
            anterior7d: { pedidos: 20, naoPagos: 0, aprovados: 20, faturamento: 1988.4, devolucoes: 1, conversao: null } },
      s4: { hoje: { pedidos: 3, naoPagos: 2, aprovados: 1, faturamento: 99.9, devolucoes: 1, conversao: 3.1, estoqueCritico: 0 },
            '7d': { pedidos: 20, naoPagos: 7, aprovados: 13, faturamento: 1500.1, devolucoes: 1, conversao: 3.2, estoqueCritico: 0 },
            '30d': { pedidos: 81, naoPagos: 27, aprovados: 54, faturamento: 6035.4, devolucoes: 4, conversao: 3.3, estoqueCritico: 1 },
            anterior7d: { pedidos: 26, naoPagos: 5, aprovados: 21, faturamento: 1897.9, devolucoes: 1, conversao: 3.9 } },
      s5: { hoje: { pedidos: 4, naoPagos: 1, aprovados: 3, faturamento: 301.4, devolucoes: 0, conversao: 5.4, estoqueCritico: 0 },
            '7d': { pedidos: 26, naoPagos: 7, aprovados: 19, faturamento: 2044.6, devolucoes: 1, conversao: 5.4, estoqueCritico: 0 },
            '30d': { pedidos: 96, naoPagos: 24, aprovados: 72, faturamento: 7591.2, devolucoes: 5, conversao: 5.4, estoqueCritico: 0 },
            anterior7d: { pedidos: 22, naoPagos: 5, aprovados: 17, faturamento: 1837.5, devolucoes: 1, conversao: 5.7 } },
      s6: { hoje: null, '7d': null, '30d': null, anterior7d: null }, /* Magalu: SEM DADOS */
      s7: { hoje: { pedidos: 5, naoPagos: 1, aprovados: 4, faturamento: 301.2, devolucoes: 0, conversao: 4.4, estoqueCritico: 0 },
            '7d': { pedidos: 31, naoPagos: 6, aprovados: 25, faturamento: 1854.3, devolucoes: 1, conversao: 4.5, estoqueCritico: 0 },
            '30d': { pedidos: 118, naoPagos: 21, aprovados: 97, faturamento: 7220.8, devolucoes: 3, conversao: 4.6, estoqueCritico: 0 },
            anterior7d: { pedidos: 29, naoPagos: 6, aprovados: 23, faturamento: 1732.5, devolucoes: 1, conversao: 4.4 } },
      s8: { hoje: { pedidos: 6, naoPagos: 1, aprovados: 5, faturamento: 512.9, devolucoes: 0, conversao: 5.9, estoqueCritico: 0 },
            '7d': { pedidos: 40, naoPagos: 7, aprovados: 33, faturamento: 3310.5, devolucoes: 1, conversao: 6.0, estoqueCritico: 0 },
            '30d': { pedidos: 151, naoPagos: 25, aprovados: 126, faturamento: 12480.3, devolucoes: 4, conversao: 6.1, estoqueCritico: 0 },
            anterior7d: { pedidos: 37, naoPagos: 8, aprovados: 29, faturamento: 3105.2, devolucoes: 2, conversao: 5.8 } },
    },

    conexoes: [
      { key: 'ml', nome: 'Mercado Livre', empresa: 'e1', conta: 'conta-demo', ambiente: STATUS.DEMONSTRACAO, status: STATUS.AGUARDANDO_CONEXAO, oauth: 'não iniciado', leitura: STATUS.AGUARDANDO_CONEXAO, escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, erro: null, ultimaSync: null, flags: ['catalog_read (planejada)', 'orders_read (planejada)'], webhooks: [] },
      { key: 'shopee', nome: 'Shopee', empresa: 'e1', conta: 'conta-demo', ambiente: STATUS.DEMONSTRACAO, status: STATUS.AGUARDANDO_CONEXAO, oauth: 'não iniciado', leitura: STATUS.AGUARDANDO_CONEXAO, escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, erro: null, ultimaSync: null, flags: ['catalog_read (planejada)'], webhooks: [] },
      { key: 'tiktok', nome: 'TikTok Shop', empresa: 'e1', conta: 'conta-demo', ambiente: STATUS.DEMONSTRACAO, status: STATUS.AGUARDANDO_CONEXAO, oauth: 'não iniciado', leitura: STATUS.AGUARDANDO_CONEXAO, escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, erro: null, ultimaSync: null, flags: [], webhooks: [] },
      { key: 'magalu', nome: 'Magalu', empresa: 'e1', conta: 'conta-demo', ambiente: STATUS.DEMONSTRACAO, status: STATUS.AGUARDANDO_CONEXAO, oauth: 'não iniciado', leitura: STATUS.AGUARDANDO_CONEXAO, escrita: STATUS.ESCRITA_BLOQUEADA, saude: null, erro: null, ultimaSync: null, flags: [], webhooks: [] },
      { key: 'whatsapp', nome: 'WhatsApp (controle remoto)', empresa: 'e1', conta: 'conta-demo', ambiente: STATUS.DEMONSTRACAO, status: STATUS.AGUARDANDO_CONEXAO, oauth: 'não iniciado', leitura: 'comando interno', escrita: 'AÇÃO INTERNA apenas', saude: null, erro: null, ultimaSync: null, flags: ['data_completion (planejada)'], webhooks: [] },
    ],

    /* ranking: só com contexto legítimo — nunca posição inventada */
    ranking: [
      { marketplace: 'Mercado Livre', palavra: 'quadro paisagem grande', posicao: 7, comparacao: 'era 5 há 7 dias', data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
      { marketplace: 'Shopee', palavra: 'kit quadros sala', posicao: 12, comparacao: 'era 15 há 7 dias', data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    ],

    home: {
      resumo: 'Operação estável em demonstração: 2 riscos ativos, 1 oportunidade priorizada, 1 decisão aguardando você.',
      statusGeral: 'ESTÁVEL · COM ATENÇÃO',
      mktAtencao: { key: 'shopee', nome: 'Shopee', motivo: 'taxa de pedido não pago 36% (7d) — pior canal' },
      prioridadeDoDia: 'Proteger o Kit 3 Quadros (ruptura em ~5 dias) e decidir a foto do Quadro Personalizado',
      melhorou: [
        { txt: 'Conversão do Kit 3 Quadros Sala subiu 6% na Shopee', fonte: 'resultado simulado · 7 dias', acao: 'catalogo:p2' },
        { txt: 'Tempo de resposta a perguntas caiu para 11 min', fonte: 'operação interna', acao: 'operacao:' },
      ],
      piorou: [
        { txt: 'Quadro Paisagem 60x90 caiu de 5º para 7º em "quadro paisagem grande" (ML)', fonte: 'ranking simulado · 2026-07-03', acao: 'catalogo:p1' },
        { txt: 'Cobertura de estoque do Kit 3 Quadros: 4,7 dias', fonte: 'estoque interno', acao: 'catalogo:p2' },
      ],
      risco: { txt: 'Ruptura do Kit 3 Quadros Sala em ~5 dias no ritmo atual', acao: 'catalogo:p2' },
      oportunidade: { txt: 'Garrafa Térmica 1L com margem 70% e sem presença no TikTok Shop', acao: 'crescimento:o1' },
      decisaoPendente: { txt: 'Aprovar recalibragem da foto do Quadro Personalizado (devoluções)', status: STATUS.AGUARDANDO_APROVACAO, acao: 'missao:m2' },
      missaoAndamento: { txt: 'Frear queima de estoque · Kit 3 Quadros Sala', status: STATUS.EM_PROCESSAMENTO, acao: 'missao:m1' },
      intervencao: { txt: 'Ontem 21:14 — você pausou manualmente o anúncio do Espelho Orgânico no ML', fonte: 'intervenção registrada', acao: 'catalogo:p4' },
      operacoesEmRisco: [
        { txt: 'Kit 3 Quadros · estoque 6 un · cobertura 4,7 dias', ref: 'catalogo:p2', nivel: 'neg' },
        { txt: 'Shopee · 21 pedidos não pagos em 7 dias (R$ 5,1k)', ref: 'crescimento:naopagos', nivel: 'neg' },
        { txt: 'Luminária LED · bloqueada no ML por INMETRO', ref: 'catalogo:p10', nivel: 'warn' },
      ],
      respostasPendentes: [
        { txt: '2 perguntas de compradores há 1h40 (Shopee)', ref: 'operacao:' },
        { txt: '1 solicitação de dado aberta: peso do Espelho Orgânico', ref: 'catalogo:p4' },
      ],
      proximosPassos: [
        { txt: 'Completar peso embalado do Espelho Orgânico (destrava rascunho Shopee)', ref: 'catalogo:p4' },
        { txt: 'Revisar grade do Tênis Runner 37 (EM REVISÃO no ML)', ref: 'catalogo:p9' },
        { txt: 'Decidir sobre a foto do Quadro Personalizado', ref: 'missao:m2' },
      ],
    },

    missoes: [
      { id: 'm1', lojaId: 's1', titulo: 'Frear queima de estoque · Kit 3 Quadros Sala', status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, agora: 'monitorando cobertura a cada hora (simulado)', origem: 'radar interno', reversivel: true },
      { id: 'm2', lojaId: 's2', titulo: 'Recalibrar foto · Quadro Personalizado Nome Família', status: STATUS.AGUARDANDO_APROVACAO, tipo: STATUS.ACAO_INTERNA, agora: 'proposta pronta — aguardando sua decisão', origem: 'diagnóstico de devoluções', reversivel: true },
      { id: 'm3', lojaId: 's2', titulo: 'Completar dados · Espelho Orgânico (peso embalado)', status: STATUS.EM_PROCESSAMENTO, tipo: 'SOLICITAÇÃO DE DADO', agora: 'pergunta enviada via WhatsApp (simulado)', origem: 'data completion engine', reversivel: true },
      { id: 'm4', lojaId: 's5', titulo: 'Rascunho TikTok · Garrafa Térmica 1L', status: STATUS.PRONTO_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'draft interno validado — publicação externa permanece bloqueada', origem: 'oportunidade priorizada', reversivel: true },
      { id: 'm5', lojaId: 's2', titulo: 'Revisão de grade · Tênis Runner 37', status: STATUS.EM_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'aguardando numeração 34–36', origem: 'pendência de catálogo', reversivel: true },
    ],

    /* ================= CRESCIMENTO — mesa de crescimento de marketplace =================
       Sem CRM, sem leads, sem pipeline comercial. */
    crescimento: {
      performance,
      pedidosNaoPagos,
      oportunidades,
      experimentos,
      aceleracao: {
        promocoes: [
          { id: 'pr1', nome: 'Semana da Sala (kits)', tipo: 'DESCONTO INTERNO', status: STATUS.EM_PROCESSAMENTO, itens: 3, margemAntes: 63.2, margemDepois: 51.4, margemMinima: 45, origem: STATUS.DADO_SIMULADO },
          { id: 'pr2', nome: 'Frete parceiro julho', tipo: 'CAMPANHA PLANEJADA', status: STATUS.AGUARDANDO_APROVACAO, itens: 6, margemAntes: 68.0, margemDepois: 59.7, margemMinima: 45, origem: STATUS.DADO_SIMULADO },
        ],
        afiliados: [
          { id: 'a1', nome: 'Canal Decora Tudo', codigo: 'DECORA10', indicacoes: 14, convertidas: 5, comissaoPendente: 214.5, origem: STATUS.DADO_SIMULADO },
          { id: 'a2', nome: 'Perfil @casa.minimal', codigo: 'MINIMAL', indicacoes: 8, convertidas: 2, comissaoPendente: 74.0, origem: STATUS.DADO_SIMULADO },
        ],
        creators: [
          { id: 'c1', nome: '@cozinha.pratica (TikTok)', proposta: 'vídeo curto Garrafa 1L', estagio: 'avaliação de fit', gate: 'exige margem ≥ 40% e estoque ≥ 30 un', origem: STATUS.DADO_SIMULADO },
        ],
        live: { proximaJanela: 'sem janela planejada', requisito: 'exige 3 itens readiness 100% + capacidade de expedição no dia', origem: STATUS.DADO_SIMULADO },
      },
      resultados: {
        hoje: { receita: 2102.9, pedidos: 16, ticket: 131.4, origem: STATUS.DADO_SIMULADO },
        '7d': { receita: 14177.7, pedidos: 111, ticket: 127.7, origem: STATUS.DADO_SIMULADO },
        '30d': { receita: 55243.0, pedidos: 391, ticket: 141.3, origem: STATUS.DADO_SIMULADO },
      },
      aprendizados: [
        { txt: 'Expectativa calibrada corta devolução sem custo de conversão', fonte: 'experimento x2 (imagem · Quadro Personalizado)', confianca: 'PROVISÓRIO' },
        { txt: 'Pix expirado domina o não-pagamento na Shopee em itens > R$ 200', fonte: 'pedidos não pagos · 7d', confianca: 'HIPÓTESE' },
      ],
    },

    silencio: [
      { id: 's1', txt: 'Vigiando cobertura de estoque de 12 produtos', detalhe: 'alerta se cobertura < 7 dias', ultimaChecagem: '2026-07-04 09:00', estado: 'normal' },
      { id: 's2', txt: 'Vigiando preço de 2 concorrentes do Quadro Paisagem', detalhe: 'alerta se corte > 10%', ultimaChecagem: '2026-07-04 08:40', estado: 'normal' },
      { id: 's3', txt: 'Vigiando devoluções por motivo dominante', detalhe: 'alerta se motivo repetir 3x na semana', ultimaChecagem: '2026-07-04 07:15', estado: 'atencao', nota: 'Quadro Personalizado: "veio diferente da foto" apareceu 3x — virou missão m2' },
      { id: 's4', txt: 'Vigiando perguntas sem resposta', detalhe: 'alerta se > 2h sem resposta', ultimaChecagem: '2026-07-04 09:05', estado: 'normal' },
    ],

    conhecimento: [
      { id: 'k1', tema: 'Método R.E.A.L.', tipo: 'PLAYBOOK', confianca: 'PROVISÓRIO', resumo: 'Reposicionar pelo diferencial antes de cobrir corte de preço.', quandoUsar: 'guerra de preço com diferencial real', quandoNaoUsar: 'produto commodity sem diferencial', origem: 'experiência interna (fixture)' },
      { id: 'k2', tema: 'Shopee · sob encomenda', tipo: 'REGRA PROVISÓRIA', confianca: 'PROVISÓRIO', resumo: 'Modalidades de envio incompatíveis com produção sob encomenda bloqueiam publicação.', quandoUsar: 'antes de rascunho Shopee de item sob encomenda', quandoNaoUsar: 'como regra oficial — confirmação final vem da conta conectada', origem: 'pack interno S10' },
      { id: 'k3', tema: 'Ads exige base validada', tipo: 'PLAYBOOK', confianca: 'PROVISÓRIO', resumo: 'Tráfego pago só depois de ficha completa, foto calibrada e margem conhecida.', quandoUsar: 'pedido de escalar com Ads', quandoNaoUsar: 'anúncio com pendência de dados', origem: 'estratégia interna 10.K.1' },
      { id: 'k4', tema: 'Ranking nunca é inventado', tipo: 'PRINCÍPIO', confianca: 'VERIFICADO INTERNO', resumo: 'Posição só aparece com marketplace, palavra, data, origem e confiança.', quandoUsar: 'sempre', quandoNaoUsar: '—', origem: 'contrato do produto' },
    ],
  };

  /* ================= LÓGICA PURA (testável em Node) ================= */
  const V8LOGIC = {
    margem(p, mktKey) {
      const preco = mktKey ? (p.mkt[mktKey] && p.mkt[mktKey].preco) : p.precoBase;
      if (!preco || !p.custo) return null;
      return Math.round(((preco - p.custo) / preco) * 1000) / 10;
    },

    readiness(p) {
      let total = 4, ok = 4;
      if (!p.master.pesoEmbaladoKg) ok--;
      if (!p.master.material) ok--;
      if (p.pendencias.length) ok--;
      if (!Object.values(p.mkt).some(m => m.status === 'ATIVO')) ok--;
      return Math.round((ok / total) * 100);
    },

    /* ======== 10.UI.2 · OPERATIONAL SCOPE CONTEXT ========
       ctx: {grupo, empresa, cnpj, loja, marketplace, conta, periodo, tipoDado}
       Encadeado: grupo limita empresas; empresa limita CNPJs; CNPJ limita
       lojas; loja limita contas. Dado de grupo não autorizado nunca entra. */
    scopeAuthorized(empresaId) {
      const e = V8DATA.scope.empresas.find(x => x.id === empresaId);
      if (!e) return false;
      const g = V8DATA.scope.grupos.find(x => x.id === e.grupoId);
      return !!(g && g.autorizado);
    },
    empresasDe(grupoId) {
      return V8DATA.scope.empresas.filter(e =>
        (!grupoId || e.grupoId === grupoId) && V8LOGIC.scopeAuthorized(e.id));
    },
    cnpjsDe(empresaId) { return V8DATA.scope.cnpjs.filter(c => c.empresaId === empresaId && V8LOGIC.scopeAuthorized(empresaId)); },
    lojasDe(ctx) {
      ctx = ctx || {};
      let lojas = V8DATA.scope.lojas.filter(s => {
        const c = V8DATA.scope.cnpjs.find(x => x.id === s.cnpjId);
        return c && V8LOGIC.scopeAuthorized(c.empresaId);
      });
      if (ctx.empresa) lojas = lojas.filter(s => (V8DATA.scope.cnpjs.find(c => c.id === s.cnpjId) || {}).empresaId === ctx.empresa);
      if (ctx.cnpj) lojas = lojas.filter(s => s.cnpjId === ctx.cnpj);
      if (ctx.marketplace) lojas = lojas.filter(s => s.marketplace === ctx.marketplace);
      return lojas;
    },
    contasDe(ctx) {
      const lojas = ctx && ctx.loja ? [ctx.loja] : V8LOGIC.lojasDe(ctx).map(s => s.id);
      let contas = V8DATA.scope.contas.filter(a => lojas.includes(a.lojaId));
      if (ctx && ctx.marketplace) contas = contas.filter(a => a.marketplace === ctx.marketplace);
      return contas;
    },
    /* corrige filhos órfãos após troca de pai (empresa→cnpj→loja→conta) */
    normalizeCtx(ctx) {
      if (ctx.empresa && !V8LOGIC.scopeAuthorized(ctx.empresa)) ctx.empresa = 'e1';
      if (ctx.cnpj && !V8LOGIC.cnpjsDe(ctx.empresa).some(c => c.id === ctx.cnpj)) ctx.cnpj = '';
      if (ctx.loja && !V8LOGIC.lojasDe({ empresa: ctx.empresa, cnpj: ctx.cnpj }).some(s => s.id === ctx.loja)) ctx.loja = '';
      if (ctx.loja) {
        const s = V8DATA.scope.lojas.find(x => x.id === ctx.loja);
        if (s && s.marketplace && ctx.marketplace && s.marketplace !== ctx.marketplace) ctx.marketplace = s.marketplace;
      }
      if (ctx.conta && !V8LOGIC.contasDe(ctx).some(a => a.id === ctx.conta)) ctx.conta = '';
      return ctx;
    },
    /* transparência de agregação: o que exatamente está incluído no recorte */
    scopeDescribe(ctx) {
      ctx = ctx || {};
      const lojas = ctx.loja ? V8DATA.scope.lojas.filter(s => s.id === ctx.loja) : V8LOGIC.lojasDe(ctx);
      const cnpjIds = [...new Set(lojas.map(s => s.cnpjId))];
      const contas = ctx.conta ? V8DATA.scope.contas.filter(a => a.id === ctx.conta) : V8LOGIC.contasDe(ctx);
      return {
        lojas: lojas.map(s => s.nome), lojaIds: lojas.map(s => s.id),
        cnpjs: cnpjIds.map(id => (V8DATA.scope.cnpjs.find(c => c.id === id) || {}).nome),
        contas: contas.map(a => a.nome),
        origem: STATUS.DADO_SIMULADO, periodo: ctx.periodo || '7d',
      };
    },
    scopeLine(ctx) {
      const d = V8LOGIC.scopeDescribe(ctx);
      return `${d.lojas.length} loja(s) · ${d.cnpjs.length} CNPJ(s) · ${d.contas.length} conta(s) · ${d.origem} · ${d.periodo}`;
    },

    /* -------- contexto global aplicado a produtos -------- */
    globalFilter(list, ctx) {
      ctx = ctx || {};
      const lojaIds = ctx.loja ? [ctx.loja]
        : (ctx.cnpj || ctx.conta) ? V8LOGIC.lojasDe(ctx).map(s => s.id) : null;
      return list.filter(p => {
        if (ctx.empresa && p.companyId !== ctx.empresa) return false;
        if (!ctx.empresa && p.companyId && !V8LOGIC.scopeAuthorized(p.companyId)) return false;
        if (lojaIds) {
          if (ctx.conta) {
            if (!lojaIds.some(i => p.lojas[i] && p.lojas[i].contaId === ctx.conta)) return false;
          } else if (!lojaIds.some(i => p.lojas[i])) return false;
        }
        if (ctx.marketplace) {
          const m = p.mkt[ctx.marketplace];
          if (!m || m.status === 'NAO_PUBLICADO') return false;
        }
        return true;
      });
    },

    /* margem por loja (preço da loja × custo do master) */
    margemLoja(p, lojaId) {
      const l = p.lojas[lojaId];
      if (!l || !l.preco || !p.custo) return null;
      return Math.round(((l.preco - p.custo) / l.preco) * 1000) / 10;
    },

    /* -------- KPIs e comparação por loja -------- */
    lojaKpis(lojaId, periodo) {
      const base = V8DATA.lojaPerf[lojaId];
      if (!base || !base[periodo]) return null;
      const d = base[periodo];
      const prev = periodo === '7d' ? base.anterior7d : null;
      const out = {
        pedidos: d.pedidos, naoPagos: d.naoPagos, aprovados: d.aprovados,
        taxaNaoPago: d.pedidos ? Math.round((d.naoPagos / d.pedidos) * 1000) / 10 : null,
        faturamento: d.faturamento, devolucoes: d.devolucoes,
        conversao: d.conversao, estoqueCritico: d.estoqueCritico ?? null,
        origem: STATUS.DADO_SIMULADO, periodo,
      };
      if (prev && prev.faturamento) out.deltaFaturamento = Math.round(((d.faturamento - prev.faturamento) / prev.faturamento) * 1000) / 10;
      return out;
    },
    /* comparação de até 4 lojas, com aviso de comparabilidade honesto */
    compareLojas(lojaIds, periodo) {
      if (lojaIds.length > 4) throw new Error('comparação limitada a 4 lojas por vez');
      const rows = lojaIds.map(id => {
        const s = V8DATA.scope.lojas.find(x => x.id === id);
        const c = s && V8DATA.scope.cnpjs.find(x => x.id === s.cnpjId);
        if (!s || !c || !V8LOGIC.scopeAuthorized(c.empresaId)) return null; /* fora do escopo autorizado */
        return { lojaId: id, loja: s.nome, tipo: s.tipo, cnpj: c.nome, kpis: V8LOGIC.lojaKpis(id, periodo) };
      }).filter(Boolean);
      const avisos = [];
      if (rows.some(r => !r.kpis)) avisos.push('lojas sem dado no período aparecem como SEM DADOS — não entram em soma nem ranking');
      if (rows.some(r => r.tipo === 'fisica') && rows.some(r => r.tipo === 'marketplace'))
        avisos.push('loja física não tem funil digital (conversão SEM DADOS) — compare apenas pedidos, faturamento e devolução');
      const comDado = rows.filter(r => r.kpis);
      const ranking = [...comDado].sort((a, b) => b.kpis.faturamento - a.kpis.faturamento).map(r => r.lojaId);
      return { periodo, origem: STATUS.DADO_SIMULADO, rows, ranking, avisos, comparavel: avisos.length === 0 };
    },

    /* -------- pedidos não pagos por escopo -------- */
    unpaidByLoja(ctx) {
      ctx = ctx || {};
      const lojaIds = ctx.loja ? [ctx.loja] : V8LOGIC.lojasDe(ctx).map(s => s.id);
      const list = V8DATA.crescimento.pedidosNaoPagos.filter(o =>
        lojaIds.includes(o.lojaId) &&
        (!ctx.conta || o.contaId === ctx.conta) &&
        (!ctx.marketplace || o.marketplace === ctx.marketplace));
      const porLoja = {};
      for (const o of list) {
        const s = V8DATA.scope.lojas.find(x => x.id === o.lojaId);
        porLoja[o.lojaId] = porLoja[o.lojaId] || { loja: s ? s.nome : o.lojaId, qtd: 0, valor: 0 };
        porLoja[o.lojaId].qtd++; porLoja[o.lojaId].valor += o.valor;
      }
      return { list, porLoja, escopo: V8LOGIC.scopeDescribe(ctx) };
    },

    /* -------- construtor de filtros avançados (regras reais) -------- */
    ADV_FIELDS: {
      nome: p => p.nome, sku: p => p.sku, categoria: p => p.categoria,
      estoque: (p, ctx) => ctx && ctx.loja ? (p.lojas[ctx.loja] || {}).estoque ?? null : p.estoque,
      preco: (p, ctx) => ctx && ctx.loja ? (p.lojas[ctx.loja] || {}).preco ?? null : p.precoBase,
      margem: (p, ctx) => ctx && ctx.loja ? V8LOGIC.margemLoja(p, ctx.loja) : V8LOGIC.margem(p),
      pendencia: p => p.pendencias.length ? p.pendencias.join('; ') : null,
      readiness: p => V8LOGIC.readiness(p),
      atualizadoEm: p => p.atualizadoEm,
      tipoDado: p => p.origem,
      lojas: p => Object.keys(p.lojas).length,
    },
    ADV_OPERATORS: ['é igual a', 'não é', 'contém', 'não contém', 'maior que', 'menor que', 'entre',
      'preenchido', 'não preenchido', 'nos últimos X dias', 'antes de', 'depois de',
      'em risco', 'com pendência', 'sem dado', 'dado real', 'dado importado', 'dado simulado',
      'aguardando aprovação', 'bloqueado externamente', 'pronto para revisão'],
    _advTest(p, rule, ctx) {
      const get = V8LOGIC.ADV_FIELDS[rule.campo] || (() => null);
      const v = get(p, ctx);
      const alvo = rule.valor;
      switch (rule.operador) {
        case 'é igual a': return String(v) === String(alvo);
        case 'não é': return String(v) !== String(alvo);
        case 'contém': return v != null && String(v).toLowerCase().includes(String(alvo).toLowerCase());
        case 'não contém': return v == null || !String(v).toLowerCase().includes(String(alvo).toLowerCase());
        case 'maior que': return v != null && +v > +alvo;
        case 'menor que': return v != null && +v < +alvo;
        case 'entre': return v != null && +v >= +alvo[0] && +v <= +alvo[1];
        case 'preenchido': return v != null && v !== '';
        case 'não preenchido': return v == null || v === '';
        case 'nos últimos X dias': {
          const dias = Math.round((new Date(V8DATA.meta.hoje) - new Date(p.atualizadoEm)) / 86400000);
          return dias <= +alvo;
        }
        case 'antes de': return p.atualizadoEm < alvo;
        case 'depois de': return p.atualizadoEm > alvo;
        case 'em risco': return p.estoque <= 10 || p.pendencias.some(x => /risco|ruptura/.test(x));
        case 'com pendência': return p.pendencias.length > 0;
        case 'sem dado': return v == null;
        case 'dado real': return p.origem === STATUS.DADO_REAL;
        case 'dado importado': return p.origem === STATUS.DADO_IMPORTADO;
        case 'dado simulado': return p.origem === STATUS.DADO_SIMULADO;
        case 'aguardando aprovação': return Object.values(p.mkt).some(m => m.status === 'AGUARDANDO_APROVACAO');
        case 'bloqueado externamente': return Object.values(p.mkt).some(m => m.status === 'BLOQUEADO');
        case 'pronto para revisão': return Object.values(p.mkt).some(m => m.status === 'EM_REVISAO');
        default: return false;
      }
    },
    /* regras com agrupamento AND/OR: [{campo, operador, valor, join:'AND'|'OR'}] */
    advancedFilter(list, rules, ctx) {
      if (!rules || !rules.length) return list;
      return list.filter(p => {
        let acc = null;
        for (const r of rules) {
          const ok = V8LOGIC._advTest(p, r, ctx);
          acc = acc === null ? ok : (r.join === 'OR' ? (acc || ok) : (acc && ok));
        }
        return acc;
      });
    },

    /* -------- visões salvas COM escopo (isolamento por empresa) -------- */
    saveScopedView(state, view) {
      for (const k of ['nome', 'empresaId', 'tipo'])
        if (!view[k]) throw new Error('visão incompleta: falta ' + k);
      if (!V8LOGIC.scopeAuthorized(view.empresaId)) throw new Error('empresa fora do escopo autorizado');
      const v = Object.assign({ id: 'view' + (++state.seq), criadaEm: V8DATA.meta.hoje, autor: V8DATA.meta.usuario }, JSON.parse(JSON.stringify(view)));
      state.scopedViews.push(v);
      V8LOGIC._audit(state, v.autor, 'view_salva', `${v.nome} (${v.tipo}, empresa ${v.empresaId})`);
      return v;
    },
    /* visão compartilhada por empresa NÃO aparece para outra empresa */
    viewsFor(state, empresaId, userId) {
      return state.scopedViews.filter(v =>
        v.empresaId === empresaId &&
        (v.tipo !== 'privada' || v.autor === (userId || V8DATA.meta.usuario)));
    },

    /* -------- resumo de escopo para ações em massa -------- */
    bulkScopeSummary(state, ids, ctx) {
      const lojasAfetadas = new Set(), cnpjsAfetados = new Set(), contasAfetadas = new Set();
      const bloqueados = [];
      let elegiveis = 0;
      for (const id of ids) {
        const p = state.products.find(x => x.id === id);
        if (!p) continue;
        const lojaIds = ctx && ctx.loja ? [ctx.loja].filter(l => p.lojas[l]) : Object.keys(p.lojas);
        for (const l of lojaIds) {
          const s = V8DATA.scope.lojas.find(x => x.id === l);
          if (!s) continue;
          lojasAfetadas.add(s.nome); cnpjsAfetados.add(s.cnpjId);
          if (p.lojas[l].contaId) contasAfetadas.add(p.lojas[l].contaId);
        }
        if (p.pendencias.length) bloqueados.push({ id, sku: p.sku, motivo: p.pendencias[0] });
        else elegiveis++;
      }
      return {
        itens: ids.length, elegiveis, bloqueados,
        lojasAfetadas: [...lojasAfetadas],
        cnpjsAfetados: [...cnpjsAfetados].map(id => (V8DATA.scope.cnpjs.find(c => c.id === id) || {}).nome),
        contasAfetadas: [...contasAfetadas],
      };
    },

    /* filtros combináveis — cada campo é AND; ausência = não filtra */
    filterProducts(list, f) {
      f = f || {};
      const q = (f.q || '').trim().toLowerCase();
      return list.filter(p => {
        if (q && !(p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) return false;
        if (f.categoria && p.categoria !== f.categoria) return false;
        if (f.tipo && p.tipo !== f.tipo) return false;
        if (f.comPendencia === true && !p.pendencias.length) return false;
        if (f.comPendencia === false && p.pendencias.length) return false;
        if (f.marketplace && f.statusMkt) {
          const m = p.mkt[f.marketplace];
          if (!m || m.status !== f.statusMkt) return false;
        } else if (f.marketplace) {
          const m = p.mkt[f.marketplace];
          if (!m || m.status === 'NAO_PUBLICADO') return false;
        }
        if (f.estoqueMax != null && p.estoque > f.estoqueMax) return false;
        if (f.margemMin != null) {
          const mg = V8LOGIC.margem(p);
          if (mg == null || mg < f.margemMin) return false;
        }
        return true;
      });
    },

    activeFilterCount(f) {
      f = f || {};
      let n = 0;
      for (const k of ['q', 'categoria', 'tipo', 'marketplace', 'statusMkt']) if (f[k]) n++;
      if (f.comPendencia !== undefined) n++;
      if (f.estoqueMax != null) n++;
      if (f.margemMin != null) n++;
      return n;
    },

    sortProducts(list, key, dir) {
      const d = dir === 'desc' ? -1 : 1;
      const val = p => {
        if (key === 'margem') return V8LOGIC.margem(p) ?? -1;
        if (key === 'readiness') return V8LOGIC.readiness(p);
        return p[key];
      };
      return [...list].sort((a, b) => {
        const va = val(a), vb = val(b);
        if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR') * d;
        return ((va ?? -Infinity) - (vb ?? -Infinity)) * d;
      });
    },

    /* estado mutável do protótipo: cópia dos produtos + trilha auditável */
    createState() {
      return {
        products: JSON.parse(JSON.stringify(V8DATA.products)),
        versions: [], jobs: [], audit: [], views: {}, scopedViews: [],
        experiments: JSON.parse(JSON.stringify(V8DATA.crescimento.experimentos)),
        opportunities: JSON.parse(JSON.stringify(V8DATA.crescimento.oportunidades)),
        selection: new Set(), seq: 0,
      };
    },

    _audit(state, actor, acao, detalhe) {
      state.audit.push({ id: 'a' + (++state.seq), actor, acao, detalhe, origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje });
    },

    /* edição do Product Master: versiona, registra autor/origem, guarda valor
       anterior, reavalia rascunhos e NUNCA sobrescreve perfis por marketplace */
    editMaster(state, productId, field, value, author) {
      const p = state.products.find(x => x.id === productId);
      if (!p) throw new Error('produto não encontrado: ' + productId);
      const before = p.master[field];
      if (before === value) return { changed: false };
      p.master[field] = value;
      if (field === 'titulo') p.nome = value;
      const perfisPreservados = [];
      for (const mk of Object.keys(p.mkt))
        if (p.mkt[mk].profile && p.mkt[mk].profile[field] !== undefined) perfisPreservados.push(mk);
      /* reavaliar pendências dependentes do dado editado */
      if (field === 'pesoEmbaladoKg' && value) p.pendencias = p.pendencias.filter(x => x !== 'peso embalado ausente');
      if (field === 'material' && value) p.pendencias = p.pendencias.filter(x => !x.startsWith('ficha técnica incompleta'));
      const v = {
        id: 'v' + (++state.seq), entidade: 'product_master', produtoId: productId,
        campo: field, antes: before ?? null, depois: value,
        autor: author || 'Marcos', origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje,
        impacto: { rascunhosReavaliados: perfisPreservados.length + 1, perfisPreservados },
      };
      state.versions.push(v);
      p.versoes.push(v.id);
      V8LOGIC._audit(state, v.autor, 'edit_master', `${p.sku}.${field}: ${before ?? '—'} → ${value}`);
      return { changed: true, version: v, perfisPreservados };
    },

    /* edição de perfil POR MARKETPLACE: totalmente independente */
    editProfile(state, productId, mktKey, field, value, author) {
      const p = state.products.find(x => x.id === productId);
      if (!p || !p.mkt[mktKey]) throw new Error('perfil não encontrado');
      const before = p.mkt[mktKey].profile[field] ?? null;
      p.mkt[mktKey].profile[field] = value;
      const v = {
        id: 'v' + (++state.seq), entidade: 'mkt_profile', produtoId: productId, marketplace: mktKey,
        campo: field, antes: before, depois: value,
        autor: author || 'Marcos', origem: STATUS.ACAO_INTERNA, em: V8DATA.meta.hoje,
      };
      state.versions.push(v);
      V8LOGIC._audit(state, v.autor, 'edit_profile', `${p.sku}[${mktKey}].${field}`);
      return { version: v };
    },

    /* ações em massa: sempre viram JOB auditável; escrita externa é recusada */
    EXTERNAL_ACTIONS: ['publicar_externo', 'pausar_externo', 'alterar_preco_externo'],
    bulkAction(state, ids, action, author, ctx) {
      if (!ids.length) return { blocked: true, reason: 'nenhum item selecionado' };
      if (V8LOGIC.EXTERNAL_ACTIONS.includes(action)) {
        V8LOGIC._audit(state, author || 'Marcos', 'bulk_blocked', `${action} recusado: ${STATUS.ESCRITA_BLOQUEADA}`);
        return { blocked: true, reason: STATUS.ESCRITA_BLOQUEADA + ' — conecte a conta oficial e aprove para publicar.' };
      }
      /* todo job registra o escopo afetado: empresa, CNPJ, loja e conta */
      const resumo = V8LOGIC.bulkScopeSummary(state, ids, ctx);
      const job = {
        id: 'job' + (++state.seq), acao: action, itens: [...ids], total: ids.length,
        status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, reversivel: true,
        autor: author || 'Marcos', em: V8DATA.meta.hoje,
        escopo: {
          empresa: (V8DATA.scope.empresas.find(e => e.id === ((ctx && ctx.empresa) || 'e1')) || {}).nome,
          cnpjs: resumo.cnpjsAfetados, lojas: resumo.lojasAfetadas, contas: resumo.contasAfetadas,
        },
      };
      state.jobs.push(job);
      V8LOGIC._audit(state, job.autor, 'bulk_job',
        `${action} sobre ${ids.length} itens (${job.id}) · ${resumo.lojasAfetadas.length} loja(s) · ${resumo.cnpjsAfetados.length} CNPJ(s)`);
      if (action === 'marcar_revisao')
        for (const id of ids) {
          const p = state.products.find(x => x.id === id);
          if (p && !p.pendencias.includes('marcado para revisão')) p.pendencias.push('marcado para revisão');
        }
      job.status = 'CONCLUÍDO (interno)';
      return { job };
    },

    /* seleção */
    toggleSelect(state, id) { state.selection.has(id) ? state.selection.delete(id) : state.selection.add(id); return state.selection.size; },
    selectAllFiltered(state, filtered) { for (const p of filtered) state.selection.add(p.id); return state.selection.size; },
    clearSelection(state) { state.selection.clear(); },

    /* visões salvas (filtros persistíveis) */
    saveView(state, nome, filtros) { state.views[nome] = JSON.parse(JSON.stringify(filtros)); return Object.keys(state.views); },
    loadView(state, nome) { return state.views[nome] ? JSON.parse(JSON.stringify(state.views[nome])) : null; },

    /* matriz de publicação por produto — status honesto por canal */
    publicationMatrix(p) {
      return V8DATA.MKTS.map(mk => {
        const m = p.mkt[mk.key];
        const row = { marketplace: mk.nome, key: mk.key, status: m.status, preco: m.preco, margem: V8LOGIC.margem(p, mk.key) };
        if (m.status === 'NAO_PUBLICADO') { row.podeRascunho = true; row.publicacaoExterna = STATUS.ESCRITA_BLOQUEADA; }
        if (m.status === 'BLOQUEADO') row.motivo = m.motivo;
        return row;
      });
    },

    /* ranking legítimo: recusa entrada sem contexto completo */
    assertRankingLegit(entry) {
      for (const k of ['marketplace', 'palavra', 'posicao', 'data', 'origem', 'confianca'])
        if (entry[k] === undefined || entry[k] === null || entry[k] === '')
          throw new Error('ranking sem contexto legítimo: falta ' + k);
      return true;
    },

    /* botão desabilitado sempre tem razão explicável */
    disabledReason(kind) {
      const R = {
        publicar_externo: STATUS.ESCRITA_BLOQUEADA + ' — nenhuma conta oficial conectada. Conecte em Conexões e aprove a publicação.',
        sync: STATUS.AGUARDANDO_CONEXAO + ' — sincronização exige conexão oficial de leitura.',
        ranking_real: STATUS.SEM_DADOS + ' — ranking real exige conta conectada; nada será inventado.',
        ads: 'BLOQUEADO — Ads exige base validada (ficha completa, foto calibrada, margem conhecida).',
      };
      return R[kind] || 'indisponível neste modo';
    },

    /* ============ 10.UI.1 · PERFORMANCE (funil honesto) ============ */
    FUNIL_ETAPAS: [
      ['impressoes', 'Impressão'], ['cliques', 'Clique'], ['visitas', 'Visita'], ['carrinho', 'Carrinho'],
      ['pedidosCriados', 'Pedido criado'], ['naoPagos', 'Pedido não pago'], ['aprovados', 'Pagamento aprovado'],
      ['preparacao', 'Preparação'], ['enviados', 'Envio'], ['entregues', 'Entrega'],
      ['avaliacao', 'Avaliação'], ['recompra', 'Recompra'],
    ],
    funnel(mktKey, periodo) {
      const base = V8DATA.crescimento.performance[mktKey];
      if (!base || !base[periodo]) return null; /* SEM DADOS — nunca inventar */
      const d = base[periodo];
      return V8LOGIC.FUNIL_ETAPAS.map(([k, label]) => ({
        etapa: label, chave: k,
        valor: d[k] ?? null,
        origem: d[k] == null ? STATUS.SEM_DADOS : d.origem,
      }));
    },
    perfKpis(mktKey, periodo) {
      const base = V8DATA.crescimento.performance[mktKey];
      if (!base || !base[periodo]) return null;
      const d = base[periodo];
      const prev = periodo === '7d' ? base.anterior7d : null;
      const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
      const kpis = {
        impressoes: d.impressoes, cliques: d.cliques,
        ctr: pct(d.cliques, d.impressoes),
        conversao: pct(d.aprovados, d.visitas),
        pedidos: d.pedidosCriados, naoPagos: d.naoPagos, aprovados: d.aprovados,
        taxaAprovacao: pct(d.aprovados, d.pedidosCriados),
        faturamento: d.faturamento, devolucoes: d.devolucoes, cancelamentos: d.cancelamentos,
        reputacao: d.reputacao, origem: d.origem,
      };
      if (prev) kpis.deltaFaturamento = Math.round(((d.faturamento - prev.faturamento) / prev.faturamento) * 1000) / 10;
      return kpis;
    },

    /* ============ 10.UI.1 · PEDIDOS NÃO PAGOS ============ */
    unpaidList(ctx) {
      let list = V8DATA.crescimento.pedidosNaoPagos;
      if (ctx && ctx.marketplace) list = list.filter(o => o.marketplace === ctx.marketplace);
      return list;
    },
    unpaidStats(mktKey, periodo) {
      periodo = periodo || '7d';
      const mks = mktKey ? [mktKey] : Object.keys(V8DATA.crescimento.performance);
      let criados = 0, naoPagos = 0;
      for (const mk of mks) {
        const base = V8DATA.crescimento.performance[mk];
        if (!base || !base[periodo]) continue;
        criados += base[periodo].pedidosCriados; naoPagos += base[periodo].naoPagos;
      }
      if (!criados) return null; /* SEM DADOS */
      const valor = V8LOGIC.unpaidList(mktKey ? { marketplace: mktKey } : null)
        .reduce((s, o) => s + o.valor, 0);
      return {
        pedidosCriados: criados, naoPagos,
        taxaNaoPago: Math.round((naoPagos / criados) * 1000) / 10,
        taxaAprovacao: Math.round(((criados - naoPagos) / criados) * 1000) / 10,
        valorPotencialPerdido: Math.round(valor * 100) / 100,
        origem: STATUS.DADO_SIMULADO,
      };
    },
    /* hipóteses SEMPRE rotuladas como hipótese; causa só com evidência (motivo conhecido) */
    unpaidHypotheses(order) {
      const out = [];
      if (order.motivo) out.push({ tipo: 'FATO', txt: `motivo registrado: ${order.motivo}`, evidencia: order.formaPagamento || 'registro do canal' });
      if (order.frete && order.valor && order.frete / order.valor > 0.15)
        out.push({ tipo: 'HIPÓTESE', txt: `frete de R$ ${order.frete.toFixed(2)} representa ${Math.round((order.frete / order.valor) * 100)}% do valor — pode ter pesado no checkout` });
      if (order.cupom) out.push({ tipo: 'HIPÓTESE', txt: `cupom ${order.cupom} — remoção pode ter mudado o preço final esperado` });
      if (!order.motivo) out.push({ tipo: 'HIPÓTESE', txt: 'sem motivo registrado pelo canal — preço, prazo ou concorrência são possibilidades, não conclusões' });
      out.push({ tipo: 'PONTO DE PARADA', txt: 'nenhuma causa será afirmada sem evidência do canal conectado' });
      return out;
    },

    /* ============ 10.UI.1 · OPORTUNIDADES ============ */
    sortOpportunities(list) { return [...list].sort((a, b) => b.prioridade - a.prioridade); },
    opportunityAction(state, oppId, acao, motivo) {
      const o = state.opportunities.find(x => x.id === oppId);
      if (!o) throw new Error('oportunidade não encontrada');
      if (acao === 'ignorar') {
        if (!motivo) return { blocked: true, reason: 'ignorar exige motivo — fica registrado' };
        o.status = 'IGNORADA'; o.motivoIgnorada = motivo;
        V8LOGIC._audit(state, 'Marcos', 'oportunidade_ignorada', `${o.id}: ${motivo}`);
        return { ok: true };
      }
      if (acao === 'acompanhar') { o.status = 'ACOMPANHANDO'; V8LOGIC._audit(state, 'Marcos', 'oportunidade_acompanhar', o.id); return { ok: true }; }
      if (acao === 'missao') { o.status = 'EM ANDAMENTO'; V8LOGIC._audit(state, 'Marcos', 'oportunidade_missao', o.id); return { ok: true, missao: o.acao }; }
      throw new Error('ação desconhecida: ' + acao);
    },

    /* ============ 10.UI.1 · EXPERIMENTOS (validação dura) ============ */
    EXPERIMENT_REQUIRED: ['hipotese', 'alvo', 'marketplace', 'metricaPrimaria', 'pontoDeParada', 'margemMinima', 'responsavel'],
    createExperiment(state, spec) {
      for (const k of V8LOGIC.EXPERIMENT_REQUIRED)
        if (spec[k] === undefined || spec[k] === null || spec[k] === '')
          throw new Error('experimento incompleto: falta ' + k);
      const x = Object.assign({
        id: 'x' + (++state.seq + 10), status: STATUS.EM_PROCESSAMENTO,
        resultadoObservado: null, aprendizado: null, origem: STATUS.DADO_SIMULADO,
        execucaoExterna: STATUS.ESCRITA_BLOQUEADA,
      }, spec);
      state.experiments.push(x);
      V8LOGIC._audit(state, spec.responsavel, 'experimento_criado', `${x.id} · ${spec.tipo || 'teste'} · ${spec.hipotese}`);
      return x;
    },

    /* ============ 10.UI.1 · GATES DE ACELERAÇÃO ============ */
    accelGate(kind, p) {
      const mg = V8LOGIC.margem(p);
      if (kind === 'ads') {
        if (p.pendencias.length) return { allowed: false, motivo: `Ads bloqueado: pendência aberta (${p.pendencias[0]})` };
        if (V8LOGIC.readiness(p) < 100) return { allowed: false, motivo: 'Ads bloqueado: readiness abaixo de 100% — base não validada' };
        if (mg == null || mg < 40) return { allowed: false, motivo: 'Ads bloqueado: margem desconhecida ou < 40% — Ads não conserta margem ruim' };
        return { allowed: true, motivo: `base validada: readiness 100%, margem ${mg}%` };
      }
      if (kind === 'promo') {
        if (mg == null) return { allowed: false, motivo: 'promoção exige margem conhecida para calcular impacto' };
        return { allowed: true, motivo: `impacto em margem obrigatório no plano (margem atual ${mg}%)` };
      }
      if (kind === 'kit') {
        if (mg == null) return { allowed: false, motivo: 'kit exige margem conhecida de cada item' };
        if (!p.master.pesoEmbaladoKg) return { allowed: false, motivo: 'kit exige peso embalado (logística) de cada item' };
        return { allowed: true, motivo: 'margem e logística conhecidas — kit pode ser montado internamente' };
      }
      return { allowed: false, motivo: 'gate desconhecido' };
    },
    promoImpact(pr) {
      return { deltaMargem: Math.round((pr.margemDepois - pr.margemAntes) * 10) / 10,
               respeitaMinima: pr.margemDepois >= pr.margemMinima };
    },

    /* ============ 10.UI.1 · EXPANSÃO ============ */
    expansionCandidates(list) {
      const out = [];
      for (const p of list) {
        for (const mk of V8DATA.MKTS) {
          const m = p.mkt[mk.key];
          if (m.status !== 'NAO_PUBLICADO') continue;
          const gate = V8LOGIC.accelGate('kit', p); /* margem+logística como proxy de aptidão */
          out.push({
            tipo: 'marketplace não explorado', produtoId: p.id, produto: p.nome, marketplace: mk.nome, mktKey: mk.key,
            apto: gate.allowed && !p.pendencias.length,
            cruzamento: `margem ${V8LOGIC.margem(p) ?? '—'}% · peso ${p.master.pesoEmbaladoKg ?? 'SEM DADOS'} kg · estoque ${p.estoque} · readiness ${V8LOGIC.readiness(p)}%`,
            bloqueio: p.pendencias.length ? p.pendencias[0] : (gate.allowed ? null : gate.motivo),
            acao: 'draft interno possível',
          });
        }
      }
      return out;
    },

    badgeCounts(state) {
      const prods = state ? state.products : V8DATA.products;
      const opps = state ? state.opportunities : V8DATA.crescimento.oportunidades;
      return {
        home: '', operacao: '',
        catalogo: String(prods.filter(p => p.pendencias.length).length),
        crescimento: String(opps.filter(o => o.status === 'ABERTA' && o.prioridade >= 80).length),
        conexoes: '0/5',
        missao: String(V8DATA.missoes.filter(m => m.status !== 'CONCLUÍDO (interno)').length),
        silencio: String(V8DATA.silencio.filter(s => s.estado === 'atencao').length),
        conhecimento: '',
      };
    },

    /* busca global (produtos, oportunidades, missões, conhecimento) */
    /* busca global multiloja: respeita a empresa ativa e o escopo autorizado;
       cada resultado carrega empresa/CNPJ/loja para orientação */
    globalSearch(q, state, ctx) {
      q = (q || '').trim().toLowerCase();
      if (q.length < 2) return [];
      ctx = ctx || {};
      const out = [];
      const empresaNome = id => (V8DATA.scope.empresas.find(e => e.id === id) || {}).nome || id;
      const prods = V8LOGIC.globalFilter(state ? state.products : V8DATA.products, { empresa: ctx.empresa });
      for (const p of prods)
        if (p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
          out.push({ tipo: 'produto', id: p.id, label: p.nome, sub: `${p.sku} · ${empresaNome(p.companyId)} · ${Object.keys(p.lojas).length} loja(s)`, ref: 'catalogo:' + p.id });
      for (const s of V8LOGIC.lojasDe({ empresa: ctx.empresa }))
        if (s.nome.toLowerCase().includes(q)) {
          const c = V8DATA.scope.cnpjs.find(x => x.id === s.cnpjId);
          out.push({ tipo: 'loja', id: s.id, label: s.nome, sub: `${c.nome} · ${empresaNome(c.empresaId)}`, ref: 'catalogo:' });
        }
      for (const c of V8DATA.scope.cnpjs.filter(x => V8LOGIC.scopeAuthorized(x.empresaId) && (!ctx.empresa || x.empresaId === ctx.empresa)))
        if (c.nome.toLowerCase().includes(q) || c.doc.includes(q))
          out.push({ tipo: 'cnpj', id: c.id, label: c.nome, sub: `${c.doc} · ${empresaNome(c.empresaId)}`, ref: 'conexoes:' });
      for (const a of V8LOGIC.contasDe({ empresa: ctx.empresa }))
        if (a.nome.toLowerCase().includes(q))
          out.push({ tipo: 'conta', id: a.id, label: a.nome, sub: (V8DATA.scope.lojas.find(s => s.id === a.lojaId) || {}).nome, ref: 'conexoes:' });
      for (const o of V8LOGIC.unpaidByLoja({ empresa: ctx.empresa }).list)
        if (o.id.includes(q) || o.anuncio.toLowerCase().includes(q))
          out.push({ tipo: 'pedido não pago', id: o.id, label: o.id + ' · ' + o.anuncio, sub: (V8DATA.scope.lojas.find(s => s.id === o.lojaId) || {}).nome, ref: 'crescimento:naopagos' });
      for (const o of (state ? state.opportunities : V8DATA.crescimento.oportunidades))
        if (o.tipo.toLowerCase().includes(q) || o.evidencia.toLowerCase().includes(q))
          out.push({ tipo: 'oportunidade', id: o.id, label: o.tipo, sub: o.marketplace, ref: 'crescimento:' + o.id });
      for (const m of V8DATA.missoes)
        if (m.titulo.toLowerCase().includes(q))
          out.push({ tipo: 'missão', id: m.id, label: m.titulo, sub: m.status, ref: 'missao:' + m.id });
      for (const k of V8DATA.conhecimento)
        if (k.tema.toLowerCase().includes(q) || k.resumo.toLowerCase().includes(q))
          out.push({ tipo: 'conhecimento', id: k.id, label: k.tema, sub: k.tipo, ref: 'conhecimento:' });
      for (const x of (state ? state.experiments : V8DATA.crescimento.experimentos))
        if (x.hipotese.toLowerCase().includes(q) || x.tipo.toLowerCase().includes(q))
          out.push({ tipo: 'experimento', id: x.id, label: x.tipo + ' · ' + x.id, sub: x.status, ref: 'crescimento:' });
      return out.slice(0, 10);
    },

    notifications(state) {
      const out = [];
      for (const m of V8DATA.missoes.filter(x => x.status === STATUS.AGUARDANDO_APROVACAO)) {
        const loja = m.lojaId && V8DATA.scope.lojas.find(s => s.id === m.lojaId);
        const cnpj = loja && V8DATA.scope.cnpjs.find(c => c.id === loja.cnpjId);
        out.push({ nivel: 'warn', txt: (loja ? loja.nome + ' · ' + cnpj.nome + ' — ' : '') + 'Decisão pendente: ' + m.titulo, ref: 'missao:' + m.id });
      }
      for (const s of V8DATA.silencio.filter(x => x.estado === 'atencao'))
        out.push({ nivel: 'warn', txt: s.nota || s.txt, ref: 'silencio:' });
      const prods = state ? state.products : V8DATA.products;
      const nPend = prods.filter(p => p.pendencias.length).length;
      if (nPend) out.push({ nivel: 'info', txt: nPend + ' produto(s) com pendência de dado', ref: 'catalogo:' });
      const un = V8LOGIC.unpaidStats(null, '7d');
      if (un && un.taxaNaoPago > 25) out.push({ nivel: 'neg', txt: `Taxa de pedido não pago ${un.taxaNaoPago}% (7d) — acima do aceitável`, ref: 'crescimento:naopagos' });
      return out;
    },
  };

  return { V8DATA, V8LOGIC };
}));

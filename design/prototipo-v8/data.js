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
    { id: 'np1', marketplace: 'shopee', produtoId: 'p2', anuncio: 'Kit 3 Quadros Sala Moderna', valor: 244.9, frete: 22.4, desconto: 0, cupom: null, formaPagamento: 'pix (expirado)', motivo: 'pagamento não concluído no prazo', data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np2', marketplace: 'shopee', produtoId: 'p1', anuncio: 'Quadro Paisagem Grande 60x90 Sala', valor: 124.9, frete: 19.9, desconto: 0, cupom: 'removido em 01/07', formaPagamento: null, motivo: null, data: '2026-07-03', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np3', marketplace: 'ml', produtoId: 'p2', anuncio: 'Kit 3 Quadros Sala Moderna', valor: 249.9, frete: 0, desconto: 0, cupom: null, formaPagamento: 'boleto (vencido)', motivo: 'boleto não pago', data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np4', marketplace: 'ml', produtoId: 'p7', anuncio: 'Garrafa Térmica Inox 1L', valor: 89.9, frete: 14.5, desconto: 5, cupom: null, formaPagamento: null, motivo: null, data: '2026-07-02', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np5', marketplace: 'shopee', produtoId: 'p11', anuncio: 'Caneca Cerâmica Eco 350ml', valor: 37.9, frete: 16.9, desconto: 0, cupom: null, formaPagamento: null, motivo: null, data: '2026-07-01', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
    { id: 'np6', marketplace: 'tiktok', produtoId: 'p6', anuncio: 'Porta-Retrato 3D Duplo Vidro', valor: 55.9, frete: 12.9, desconto: 0, cupom: null, formaPagamento: 'cartão (recusado)', motivo: 'cartão recusado', data: '2026-07-01', origem: STATUS.DADO_SIMULADO, confianca: 'demonstração' },
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
        { id: 'e1', nome: 'Empresa Demonstração LTDA', conta: 'conta-demo · multicanal' },
        { id: 'e2', nome: 'Cozinha Demo Comércio ME', conta: 'conta-cozinha · ml+shopee' },
      ],
      empresa: 'Empresa Demonstração LTDA',
      conta: 'conta-demo · multicanal',
      usuario: 'Marcos', papel: 'ADMIN',
      hoje: '2026-07-04',
      aviso: 'Todos os dados desta instância são simulados e rotulados. Nenhuma conta externa conectada; escrita externa bloqueada.',
    },
    STATUS, MKTS, products,
    PERIODOS: [['hoje', 'Hoje'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias']],

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
      { id: 'm1', titulo: 'Frear queima de estoque · Kit 3 Quadros Sala', status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, agora: 'monitorando cobertura a cada hora (simulado)', origem: 'radar interno', reversivel: true },
      { id: 'm2', titulo: 'Recalibrar foto · Quadro Personalizado Nome Família', status: STATUS.AGUARDANDO_APROVACAO, tipo: STATUS.ACAO_INTERNA, agora: 'proposta pronta — aguardando sua decisão', origem: 'diagnóstico de devoluções', reversivel: true },
      { id: 'm3', titulo: 'Completar dados · Espelho Orgânico (peso embalado)', status: STATUS.EM_PROCESSAMENTO, tipo: 'SOLICITAÇÃO DE DADO', agora: 'pergunta enviada via WhatsApp (simulado)', origem: 'data completion engine', reversivel: true },
      { id: 'm4', titulo: 'Rascunho TikTok · Garrafa Térmica 1L', status: STATUS.PRONTO_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'draft interno validado — publicação externa permanece bloqueada', origem: 'oportunidade priorizada', reversivel: true },
      { id: 'm5', titulo: 'Revisão de grade · Tênis Runner 37', status: STATUS.EM_REVISAO, tipo: STATUS.ACAO_INTERNA, agora: 'aguardando numeração 34–36', origem: 'pendência de catálogo', reversivel: true },
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

    /* -------- contexto global: empresa ativa + marketplace ativo -------- */
    globalFilter(list, ctx) {
      ctx = ctx || {};
      return list.filter(p => {
        if (ctx.empresa && p.companyId !== ctx.empresa) return false;
        if (ctx.marketplace) {
          const m = p.mkt[ctx.marketplace];
          if (!m || m.status === 'NAO_PUBLICADO') return false;
        }
        return true;
      });
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
        versions: [], jobs: [], audit: [], views: {},
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
    bulkAction(state, ids, action, author) {
      if (!ids.length) return { blocked: true, reason: 'nenhum item selecionado' };
      if (V8LOGIC.EXTERNAL_ACTIONS.includes(action)) {
        V8LOGIC._audit(state, author || 'Marcos', 'bulk_blocked', `${action} recusado: ${STATUS.ESCRITA_BLOQUEADA}`);
        return { blocked: true, reason: STATUS.ESCRITA_BLOQUEADA + ' — conecte a conta oficial e aprove para publicar.' };
      }
      const job = {
        id: 'job' + (++state.seq), acao: action, itens: [...ids], total: ids.length,
        status: STATUS.EM_PROCESSAMENTO, tipo: STATUS.ACAO_INTERNA, reversivel: true,
        autor: author || 'Marcos', em: V8DATA.meta.hoje,
      };
      state.jobs.push(job);
      V8LOGIC._audit(state, job.autor, 'bulk_job', `${action} sobre ${ids.length} itens (${job.id})`);
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
    globalSearch(q, state) {
      q = (q || '').trim().toLowerCase();
      if (q.length < 2) return [];
      const out = [];
      const prods = state ? state.products : V8DATA.products;
      for (const p of prods)
        if (p.nome.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
          out.push({ tipo: 'produto', id: p.id, label: p.nome, sub: p.sku, ref: 'catalogo:' + p.id });
      for (const o of (state ? state.opportunities : V8DATA.crescimento.oportunidades))
        if (o.tipo.toLowerCase().includes(q) || o.evidencia.toLowerCase().includes(q))
          out.push({ tipo: 'oportunidade', id: o.id, label: o.tipo, sub: o.marketplace, ref: 'crescimento:' + o.id });
      for (const m of V8DATA.missoes)
        if (m.titulo.toLowerCase().includes(q))
          out.push({ tipo: 'missão', id: m.id, label: m.titulo, sub: m.status, ref: 'missao:' + m.id });
      for (const k of V8DATA.conhecimento)
        if (k.tema.toLowerCase().includes(q) || k.resumo.toLowerCase().includes(q))
          out.push({ tipo: 'conhecimento', id: k.id, label: k.tema, sub: k.tipo, ref: 'conhecimento:' });
      return out.slice(0, 9);
    },

    notifications(state) {
      const out = [];
      for (const m of V8DATA.missoes.filter(x => x.status === STATUS.AGUARDANDO_APROVACAO))
        out.push({ nivel: 'warn', txt: 'Decisão pendente: ' + m.titulo, ref: 'missao:' + m.id });
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

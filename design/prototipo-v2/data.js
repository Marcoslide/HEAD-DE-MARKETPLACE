/* =============================================================
   Head de Marketplace — dados de demonstração (Sprint 02)
   Operação fictícia: loja de quadros e decoração, ML + Shopee.
   Tudo aqui vira estado vivo em app.js.
   ============================================================= */
const DATA = {

  user: "Marcos",

  /* Atividades de vigília — o Pulso alterna entre elas */
  activities: [
    "Lendo avaliações dos concorrentes…",
    "Monitorando ranking dos seus anúncios…",
    "Comparando preços da primeira página…",
    "Criando novas versões de anúncio…",
    "Aprendendo padrões de conversão…",
    "Investigando queda de performance…",
    "Revisando perguntas de compradores sem resposta…",
    "Observando movimentos de preço na categoria Decoração…"
  ],

  /* Trabalho da noite — briefing */
  worklist: [
    ["Analisei", 1284, "anúncios da categoria"],
    ["Monitorei", 436, "concorrentes"],
    ["Li", 3241, "avaliações"],
    ["Detectei", 4, "oportunidades"],
    ["Criei", 3, "novas versões"],
    ["Preparei", 2, "decisões para você"]
  ],

  keyfind: 'A descoberta mais importante: buscas por <b>“quadro grande para sala”</b> cresceram 34% em duas semanas — e o seu Kit 3 Quadros não menciona tamanho nem ambiente no título. Preparei a correção abaixo.',

  /* ---------- Decisões aguardando aprovação ---------- */
  decisions: [
    {
      id: "d1",
      tag: "Resposta competitiva",
      product: "Quadro Paisagem 60x90",
      mkt: "Mercado Livre",
      descoberta: "Detectei queda de 18% na conversão do Quadro Paisagem 60x90.",
      causa: "Dois concorrentes reduziram preço e melhoraram a imagem principal no mesmo dia.",
      proposta: "Criar uma nova versão do anúncio focada em acabamento e embalagem segura — os dois pontos mais elogiados nas suas avaliações. Não sugiro cobrir o preço: sua margem não aguenta e suas avaliações vencem a briga.",
      impacto: "recuperar entre 8% e 12% da conversão",
      reversibilidade: "Alta — voltamos à versão anterior em 1 clique.",
      confianca: "alta",
      missionOnApprove: {
        tag: "Executando",
        product: "Quadro Paisagem 60x90",
        title: "Publicar a nova versão focada em acabamento e embalagem segura.",
        now: "preparando a publicação da versão v4…",
        origin: "origem: decisão aprovada por você, agora há pouco"
      }
    },
    {
      id: "d2",
      tag: "Novo título + foto",
      product: "Kit 3 Quadros Sala",
      mkt: "Shopee",
      descoberta: "Seu Kit 3 Quadros está fora da primeira página justo quando a busca pela categoria mais cresce.",
      causa: "O título atual não menciona tamanho nem ambiente — os três líderes mencionam os dois.",
      proposta: "Trocar o título para incluir “grande” e “sala” e usar como primeira foto a versão ambientada numa parede real. Os dois já estão prontos, é só aprovar.",
      impacto: "+R$ 1.400/mês se subir 4 posições",
      reversibilidade: "Alta — título e foto anteriores ficam guardados como v2.",
      confianca: "alta",
      missionOnApprove: {
        tag: "Executando",
        product: "Kit 3 Quadros Sala",
        title: "Publicar novo título e primeira foto ambientada.",
        now: "publicando na Shopee…",
        origin: "origem: decisão aprovada por você, agora há pouco"
      }
    }
  ],

  /* ---------- Descobertas do dia ---------- */
  discoveries: [
    { type: "Tendência", cls: "info",
      text: "Buscas por “quadro grande para sala” cresceram 34% em 14 dias.",
      proof: "já usada na decisão do Kit 3 Quadros" },
    { type: "Oportunidade", cls: "pos",
      text: "Seu Espelho Decorativo está a 2 posições do topo da busca — falta pouco.",
      proof: "investigando o que os 2 acima fazem melhor" },
    { type: "Alerta", cls: "crit",
      text: "Uma avaliação 1 estrela menciona “chegou trincado” — a 2ª do mês na mesma transportadora.",
      proof: "recomendo revisar a embalagem do 60x90; posso cotar proteção extra" }
  ],

  /* ---------- Produtos (Central de Produtos + Central do Produto) ---------- */
  products: [
    { id: 'p1', emoji: "🖼️", name: "Quadro Paisagem 60x90", mkt: "Mercado Livre", score: 58,
      conv: "↓ conversão −18% (7d)", convCls: "down", rank: "#6 na busca",
      last: "Preparei a resposta à queda — a decisão está na sua Home.",
      opp: "1 oportunidade: nova versão pronta para aprovar",
      resumo: "Este produto pede atenção. Dois concorrentes baixaram preço na terça e a conversão caiu 18%. A resposta está pronta na sua mesa — reposicionar pelo diferencial, sem cobrir o corte.",
      perf: { conv: [3.1, 3.0, 3.1, 2.9, 2.6, 2.5, 2.5], ctr: [3.8, 3.8, 3.7, 3.6, 3.4, 3.4, 3.5] },
      listings: [
        { id: 'l1', mkt: 'Mercado Livre', status: 'ativo', price: 189, ranking: 6, health: 58,
          versions: [
            { n: 3, title: 'Quadro Paisagem 60x90 Moldura Reforçada', author: 'head', reason: 'foco em acabamento', result: 'em medição', active: true },
            { n: 2, title: 'Quadro Paisagem 60x90 Sala', author: 'head', reason: 'palavra "sala" no título', result: '+6% conversão' },
            { n: 1, title: 'Quadro Decorativo Paisagem', author: 'user', reason: 'importação inicial', result: 'baseline' } ],
          publications: [ { at: 'há 2 dias', action: 'publicação simulada v3', outcome: 'ok' }, { at: 'há 9 dias', action: 'publicação simulada v2', outcome: 'ok' } ] } ],
      timeline: [
        { day: 'hoje', text: 'Preparei a resposta competitiva — aguardando sua aprovação', effect: null },
        { day: 'há 1 dia', text: 'Detectei queda de 18% e abri investigação', effect: null },
        { day: 'há 9 dias', text: 'Troquei o título (v2)', effect: '+6% conversão em 7 dias' },
        { day: 'há 21 dias', text: 'Li as 218 avaliações do líder — ponto fraco: embalagem', effect: 'virou estratégia' } ],
      experiments: [ { name: 'Título com "moldura reforçada"', variable: 'título', status: 'medindo (dia 2 de 7)', criteria: 'conversão +8% em 7 dias' } ],
      learnings: [ 'Reposicionar pelo diferencial venceu cobrir preço (mai/2026)', 'Embalagem é a objeção nº 1 desta categoria' ] },

    { id: 'p2', emoji: "🖼️", name: "Kit 3 Quadros Sala Abstrato", mkt: "Shopee", score: 71,
      conv: "conversão estável", convCls: "", rank: "#11 na busca",
      last: "Título e foto novos prontos — aguardando sua aprovação.",
      opp: "1 oportunidade: entrar na primeira página",
      resumo: "Fora da primeira página numa categoria em alta. O título não menciona tamanho nem ambiente — os líderes mencionam os dois. Correção pronta para aprovar.",
      perf: { conv: [2.4, 2.4, 2.5, 2.4, 2.3, 2.4, 2.4], ctr: [3.1, 3.0, 3.1, 3.1, 3.0, 3.1, 3.1] },
      listings: [ { id: 'l2', mkt: 'Shopee', status: 'ativo', price: 249, ranking: 11, health: 71,
        versions: [ { n: 1, title: 'Kit 3 Quadros Abstrato', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [ { at: 'há 30 dias', action: 'importação', outcome: 'ok' } ] } ],
      timeline: [ { day: 'hoje', text: 'Novo título e foto ambientada prontos — na sua mesa', effect: null },
        { day: 'há 3 dias', text: 'Detectei: busca da categoria +34% e você fora da 1ª página', effect: null } ],
      experiments: [],
      learnings: [ 'Foto ambientada vence fundo branco nesta categoria (+19% cliques)' ] },

    { id: 'p3', emoji: "✏️", name: "Quadro Personalizado Nome Família", mkt: "Mercado Livre", score: 89,
      conv: "↑ conversão +7% (7d)", convCls: "up", rank: "#1 na busca",
      last: "Saudável. Os elogios à personalização viraram um padrão no Conhecimento.",
      opp: "",
      resumo: "Seu campeão. Líder da busca, conversão subindo, avaliações elogiando a personalização. Estou estudando replicar a estratégia dele nos produtos irmãos.",
      perf: { conv: [3.6, 3.7, 3.7, 3.8, 3.8, 3.9, 3.8], ctr: [4.4, 4.4, 4.5, 4.4, 4.5, 4.6, 4.5] },
      listings: [ { id: 'l3', mkt: 'Mercado Livre', status: 'ativo', price: 159, ranking: 1, health: 89,
        versions: [ { n: 2, title: 'Quadro Personalizado Nome Família Presente', author: 'head', reason: 'palavra "presente" (busca sazonal)', result: '+11% conversão', active: true },
                    { n: 1, title: 'Quadro Personalizado Família', author: 'user', reason: 'importação inicial', result: 'baseline' } ],
        publications: [ { at: 'há 15 dias', action: 'publicação simulada v2', outcome: 'ok' } ] } ],
      timeline: [ { day: 'há 2 dias', text: 'Confirmei sequência campeã — abri missão de replicação', effect: null },
        { day: 'há 15 dias', text: 'Publiquei v2 com "presente" no título', effect: '+11% conversão' } ],
      experiments: [ { name: 'Elasticidade de preço +6%', variable: 'preço', status: 'proposto (aguarda você)', criteria: 'margem +4% sem perder ranking' } ],
      learnings: [ 'Compradores decidem à noite (62% das vendas 19h-23h)', '"Presente" no título captura busca sazonal' ] },

    { id: 'p4', emoji: "🪞", name: "Espelho Decorativo Orgânico", mkt: "Shopee", score: 76,
      conv: "↑ conversão +3% (7d)", convCls: "up", rank: "#4 na busca",
      last: "A 2 posições do topo — estudando os dois anúncios acima do seu.",
      opp: "1 oportunidade em investigação",
      resumo: "A 2 posições do topo — o quase-lá mais valioso do portfólio (MIF: tráfego é exponencial no topo). Investigando o que os dois acima fazem melhor.",
      perf: { conv: [2.6, 2.7, 2.7, 2.6, 2.7, 2.8, 2.7], ctr: [3.5, 3.5, 3.4, 3.5, 3.6, 3.5, 3.5] },
      listings: [ { id: 'l4', mkt: 'Shopee', status: 'ativo', price: 219, ranking: 4, health: 76,
        versions: [ { n: 1, title: 'Espelho Decorativo Orgânico Grande', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [] } ],
      timeline: [ { day: 'há 1 dia', text: 'Testando palavra-chave "espelho orgânico grande"', effect: 'medindo' } ],
      experiments: [ { name: 'Palavra "espelho orgânico grande"', variable: 'palavra-chave', status: 'medindo (dia 3 de 7)', criteria: 'cliques +10%' } ],
      learnings: [] },

    { id: 'p5', emoji: "🖼️", name: "Quadro Abstrato Dourado 50x70", mkt: "Mercado Livre", score: 82,
      conv: "conversão estável", convCls: "", rank: "#3 na busca",
      last: "Monitorando. Nada exige você agora.", opp: "",
      resumo: "Saudável e estável no pódio da busca. Vigília normal — nada exige você.",
      perf: { conv: [2.9, 2.9, 3.0, 2.9, 2.9, 2.9, 2.9], ctr: [3.3, 3.3, 3.3, 3.4, 3.3, 3.3, 3.3] },
      listings: [ { id: 'l5', mkt: 'Mercado Livre', status: 'ativo', price: 139, ranking: 3, health: 82,
        versions: [ { n: 1, title: 'Quadro Abstrato Dourado 50x70', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [] } ],
      timeline: [ { day: 'há 5 dias', text: 'Completei a ficha técnica (3 atributos vazios)', effect: 'medindo efeito no ranking' } ],
      experiments: [], learnings: [] },

    { id: 'p6', emoji: "🖼️", name: "Kit 2 Quadros Quarto Casal", mkt: "Shopee", score: 64,
      conv: "↓ conversão −6% (14d)", convCls: "down", rank: "#9 na busca",
      last: "Decadência lenta detectada — investigando fadiga do criativo.", opp: "1 oportunidade em investigação",
      resumo: "Queda lenta e silenciosa: nenhum dia grita, mas a soma incomoda. Os líderes da categoria evoluíram para foto ambientada; suspeito de fadiga do criativo.",
      perf: { conv: [2.3, 2.3, 2.2, 2.2, 2.1, 2.1, 2.0], ctr: [3.0, 3.0, 2.9, 2.9, 2.9, 2.8, 2.8] },
      listings: [ { id: 'l6', mkt: 'Shopee', status: 'ativo', price: 179, ranking: 9, health: 64,
        versions: [ { n: 1, title: 'Kit 2 Quadros Quarto', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [] } ],
      timeline: [ { day: 'hoje', text: 'Abri investigação de decadência silenciosa', effect: null } ],
      experiments: [], learnings: [] },

    { id: 'p7', emoji: "🕐", name: "Relógio de Parede Minimalista", mkt: "Mercado Livre", score: 79,
      conv: "conversão estável", convCls: "", rank: "#5 na busca",
      last: "Respondi 4 perguntas de compradores hoje de madrugada.", opp: "",
      resumo: "Estável. Perguntas respondidas em minutos — dúvida virando pedido antes do concorrente acordar.",
      perf: { conv: [2.7, 2.7, 2.8, 2.7, 2.8, 2.7, 2.8], ctr: [3.4, 3.5, 3.4, 3.4, 3.5, 3.4, 3.5] },
      listings: [ { id: 'l7', mkt: 'Mercado Livre', status: 'ativo', price: 99, ranking: 5, health: 79,
        versions: [ { n: 1, title: 'Relógio de Parede Minimalista Silencioso', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [] } ],
      timeline: [ { day: 'hoje', text: 'Respondi 4 perguntas de compradores', effect: 'tempo médio 4 min' } ],
      experiments: [], learnings: [] },

    { id: 'p8', emoji: "🪴", name: "Vaso Cerâmica Escandinavo", mkt: "Shopee", score: 45,
      conv: "↓ sem vendas há 12 dias", convCls: "down", rank: "#23 na busca",
      last: "Proposta em preparação: relançar com kit ou descontinuar.", opp: "1 decisão em preparação",
      resumo: "O problema crônico do portfólio: página 2, sem tração, sem avaliações. Estou preparando a análise relançar-como-kit versus descontinuar — com números, não com achismo.",
      perf: { conv: [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2], ctr: [1.8, 1.7, 1.6, 1.6, 1.5, 1.4, 1.4] },
      listings: [ { id: 'l8', mkt: 'Shopee', status: 'pausado', price: 89, ranking: 23, health: 45,
        versions: [ { n: 1, title: 'Vaso Cerâmica Decorativo', author: 'user', reason: 'importação inicial', result: 'baseline', active: true } ],
        publications: [] } ],
      timeline: [ { day: 'há 2 dias', text: 'Marquei como problema crônico — análise em preparação', effect: null } ],
      experiments: [], learnings: [] },
  ],

  marketplaces: [
    { name: 'Mercado Livre', status: 'conectado (simulado)', products: 4, listings: 4, health: 77,
      note: 'Reputação verde. 2 decisões pendentes envolvem anúncios daqui.' },
    { name: 'Shopee', status: 'conectado (simulado)', products: 4, listings: 4, health: 64,
      note: 'Kit 3 Quadros fora da primeira página — decisão pronta na Home.' },
  ],

  /* ---------- Missões ---------- */
  missions: {
    active: [
      { tag: "Investigando", product: "Quadro Paisagem 60x90",
        title: "Entender a queda de conversão e preparar a resposta competitiva.",
        now: "comparando preços dos 12 concorrentes da primeira página…",
        origin: "origem: iniciada por mim — detectei a queda às 12h55",
        log: [
          ["14:02", "Li as 218 avaliações do concorrente líder — o ponto fraco dele é embalagem"],
          ["13:40", "Identifiquei 2 quedas de preço agressivas (ArteParede −12%, DecorMax −18%)"],
          ["13:18", "Confirmei: o tráfego se manteve, a queda é de conversão"],
          ["12:55", "Detectei a queda de 18% e abri esta investigação"]
        ] },
      { tag: "Monitorando", product: "concorrente ArteParede",
        title: "Acompanhar o concorrente que baixou preço — reação, estoque e avaliações.",
        now: "checando preço e posição a cada hora…",
        origin: "origem: desdobramento da investigação do 60x90" },
      { tag: "Criando", product: "Kit 3 Quadros Sala",
        title: "Produzir a primeira foto ambientada em parede real de sala.",
        now: "gerando a terceira variação de ambiente…",
        origin: "origem: iniciada por mim — os líderes da busca usam foto ambientada" },
      { tag: "Analisando", product: "operação inteira",
        title: "Ler as 64 avaliações novas da semana em busca de padrões.",
        now: "48 de 64 lidas…",
        origin: "origem: rotina contínua de vigília" },
      { tag: "Testando", product: "Espelho Decorativo",
        title: "Testar a palavra-chave “espelho orgânico grande” no título.",
        now: "3º dia de teste — medindo cliques…",
        origin: "origem: padrão descoberto no Conhecimento" }
    ],
    waiting: [
      { tag: "Bloqueada", product: "Quadro Paisagem 60x90",
        title: "A resposta competitiva está pronta — preciso da sua aprovação para publicar." }
    ],
    doneToday: [
      { title: "Respondi 9 perguntas de compradores durante a madrugada",
        res: "tempo médio de resposta: 4 min" },
      { title: "Atualizei a ficha técnica do Quadro Abstrato Dourado (3 atributos vazios)",
        res: "medindo efeito no ranking" }
    ]
  },

  /* ---------- Conhecimento ---------- */
  knowledge: [
    { col: "Palavras-chave", text: "“quadro grande para sala” converte 28% mais que “quadro decorativo”.",
      proof: "comprovada em 2 anúncios · jun/2026", actions: ["Aplicar em outro produto"] },
    { col: "Criativos vencedores", text: "Primeira foto ambientada em parede real venceu fundo branco em todos os testes — +19% de cliques.",
      proof: "3 testes · mai–jun/2026", actions: ["Aplicar em outro produto"] },
    { col: "Objeções recorrentes", text: "Medo de chegar quebrado aparece em 31% das perguntas — anúncios que mostram a embalagem na 3ª foto convertem mais.",
      proof: "análise de 412 perguntas · jun/2026", actions: ["Criar foto de embalagem"] },
    { col: "Estratégias aprovadas", text: "Quando o concorrente corta preço, reposicionar pelo diferencial venceu cobrir o desconto — margem preservada e conversão recuperada em 9 dias.",
      proof: "aplicada 1 vez · Espelho Decorativo, mai/2026 · +14% de margem", actions: ["Reaplicar"] },
    { col: "Padrões descobertos", text: "Seus compradores decidem à noite: 62% das vendas acontecem entre 19h e 23h — o melhor horário para publicar versão nova é de manhã.",
      proof: "90 dias de vendas analisados", actions: [] }
  ],

  knowledgeCols: ["Tudo", "Palavras-chave", "Criativos vencedores", "Objeções recorrentes", "Estratégias aprovadas", "Padrões descobertos"],

  /* ---------- Conversa: sugestões (Sprint 09.A — chat operacional) ---------- */
  suggestions: [
    "Quanto vendi hoje?",
    "Quantos pedidos faltam enviar?",
    "Como está minha operação?",
    "Quanto gastei de Ads?",
    "Como está minha conversão?",
    "O que está acabando?",
    "Onde estou perdendo dinheiro?",
    "Compare Shopee e Mercado Livre",
    "Qual decisão precisa de mim?",
    "Por que você priorizou isso?"
  ]
};

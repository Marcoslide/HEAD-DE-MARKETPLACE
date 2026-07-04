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

  /* ---------- Produtos ---------- */
  products: [
    { emoji: "🖼️", name: "Quadro Paisagem 60x90", mkt: "Mercado Livre", score: 58,
      conv: "↓ conversão −18% (7d)", convCls: "down", rank: "#6 na busca",
      last: "Preparei a resposta à queda — a decisão está na sua Home.",
      opp: "1 oportunidade: nova versão pronta para aprovar" },
    { emoji: "🖼️", name: "Kit 3 Quadros Sala Abstrato", mkt: "Shopee", score: 71,
      conv: "conversão estável", convCls: "", rank: "#11 na busca",
      last: "Título e foto novos prontos — aguardando sua aprovação.",
      opp: "1 oportunidade: entrar na primeira página" },
    { emoji: "✏️", name: "Quadro Personalizado Nome Família", mkt: "Mercado Livre", score: 89,
      conv: "↑ conversão +7% (7d)", convCls: "up", rank: "#1 na busca",
      last: "Saudável. Os elogios à personalização viraram um padrão no Conhecimento.",
      opp: "" },
    { emoji: "🪞", name: "Espelho Decorativo Orgânico", mkt: "Shopee", score: 76,
      conv: "↑ conversão +3% (7d)", convCls: "up", rank: "#4 na busca",
      last: "A 2 posições do topo — estudando os dois anúncios acima do seu.",
      opp: "1 oportunidade em investigação" },
    { emoji: "🖼️", name: "Quadro Abstrato Dourado 50x70", mkt: "Mercado Livre", score: 82,
      conv: "conversão estável", convCls: "", rank: "#3 na busca",
      last: "Monitorando. Nada exige você agora.",
      opp: "" }
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

  /* ---------- Conversa: sugestões e respostas roteirizadas ---------- */
  suggestions: [
    "Por que minhas vendas caíram?",
    "Crie três versões desse anúncio",
    "Faça um anúncio para este produto",
    "Analise este concorrente",
    "O que devo fazer hoje?"
  ]
};

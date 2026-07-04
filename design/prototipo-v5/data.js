/* =============================================================
   Head de Marketplace — Plano do Dia (v3, Sprint 08 · EPE)
   Dados curados a partir da SAÍDA REAL do Executive Planning Engine
   (mie/src/engines/executive-planner.js) sobre o cenário:
     price-war(p1) + returns-spike(p3) + stockout(p2) + ctr-noise(p4).
   O EPE encontrou os sinais, filtrou e priorizou. O usuário vê só o topo.
   ============================================================= */
const DATA = {
  user: "Marcos",

  activities: [
    "Priorizando 90 sinais por impacto executivo…",
    "Descartando ruído de CTR abaixo do limiar…",
    "Cruzando o consenso do conselho com o grafo…",
    "Medindo risco de esperar vs. risco de agir cedo…",
    "Reservando a capacidade operacional do dia…",
    "Monitorando ruptura de estoque no Kit 3 Quadros…",
  ],

  /* o funil de atenção do dia (contadores reais do EPE) */
  funnel: {
    signalsFound: 317, signalsIgnored: 302, investigated: 15,
    missionsCreated: 8, resolved: 5, decisionsForOwner: 2,
  },

  briefing: {
    greeting: "Bom dia, Marcos.",
    lede: "Enquanto você descansava, cuidei da sua operação — e filtrei o que realmente importa.",
    narrative: [
      ["Encontrei", 317, "sinais"],
      ["Ignorei", 302, "por baixo impacto"],
      ["Investiguei", 15, "de perto"],
      ["Transformei", 8, "em missões"],
      ["Resolvi", 5, "sozinho"],
      ["Trouxe", 2, "decisões para você"],
    ],
    signature: "O resto eu toco. — Eu cuido do resto.",
  },

  /* "Hoje sua atenção deve ir para:" (ordenado pelo EPE) */
  attention: [
    { level: "interrupt", txt: "Recuperar a conversão do Quadro Paisagem 60x90", why: "impacto ~R$ 5.900/mês e urgência alta — dois concorrentes cortaram preço" },
    { level: "approve", txt: "Aprovar a nova imagem do Quadro Personalizado (devoluções subindo)", why: "expectativa descalibrada; corta devolução e melhora avaliação" },
    { level: "observe", txt: "Risco de ruptura no Kit 3 Quadros Sala", why: "4,7 dias de cobertura — estou freando a demanda; te aviso se apertar" },
  ],

  /* decisões priorizadas pelo EPE (com breakdown auditável) */
  decisions: [
    {
      id: "d1", level: "interrupt", tag: "Resposta competitiva", product: "Quadro Paisagem 60x90", mkt: "Mercado Livre",
      descoberta: "Detectei queda de 18% na conversão do Quadro Paisagem 60x90.",
      causa: "ArteParede (−12%) e DecorMax (−18%) cortaram preço na terça. O grafo confirma: já foram os que mais impactaram este produto.",
      proposta: "Reposicionar pelo diferencial (a maleta), sem cobrir o corte — foi o que já funcionou nesta categoria antes.",
      impacto: "recuperar entre 8% e 12% da conversão", reversibilidade: "Alta", confianca: "alta",
      breakdown: { impact: 5904, urgency: "alta", confidence: "alta", effort: 1, riskWait: 4.5, riskEarly: "baixo (reversível)", base: 15050, mult: 1.56, score: 6863,
        factors: [["janela expira", 1.5], ["consenso do conselho (73%)", 1.12], ["aprendizado anterior aplicável", 1.15]] },
      missionOnApprove: { tag: "Executando", product: "Quadro Paisagem 60x90", title: "Publicar a versão reposicionada pelo diferencial.", now: "publicando no Mercado Livre…", origin: "origem: decisão aprovada por você, agora há pouco" },
    },
    {
      id: "d2", level: "approve", tag: "Recalibrar expectativa", product: "Quadro Personalizado Nome Família", mkt: "Mercado Livre",
      descoberta: "Devoluções acima do normal — motivo dominante: 'veio diferente da foto'.",
      causa: "A foto não mostra a escala real; o comprador se frustra e devolve. Objeção recorrente nas avaliações.",
      proposta: "Refazer a foto com escala real e recalibrar a ficha — corta devolução E melhora a avaliação exibida.",
      impacto: "reduzir devoluções em 4% a 8%", reversibilidade: "Alta", confianca: "alta",
      breakdown: { impact: 2280, urgency: "média", confidence: "alta", effort: 2, riskWait: 2, riskEarly: "baixo (reversível)", base: 2907, mult: 0.9, score: 2630,
        factors: [["consenso do conselho (61%)", 1.03], ["objeção recorrente no grafo", 1.15]] },
      missionOnApprove: { tag: "Executando", product: "Quadro Personalizado Nome Família", title: "Refazer foto com escala real e recalibrar a ficha.", now: "gerando a nova foto…", origin: "origem: decisão aprovada por você, agora há pouco" },
    },
  ],

  /* missões priorizadas (o Head trabalhando sozinho, sem decisão do dono) */
  missions: [
    { title: "Investigar queda de conversão · Quadro Paisagem 60x90", score: 6863, level: "mission", now: "comparando 12 concorrentes da primeira página…" },
    { title: "Frear a queima de estoque · Kit 3 Quadros Sala", score: 1820, level: "mission", now: "subindo preço para conter a demanda (sem pausar o anúncio)…" },
    { title: "Criar 3 variações de imagem · Suporte Notebook", score: 1240, level: "mission", now: "gerando a terceira variação…" },
    { title: "Responder 9 perguntas de compradores", score: 640, level: "auto", now: "respondidas — tempo médio 4 min" },
    { title: "Testar palavra 'espelho orgânico grande' · Espelho Decorativo", score: 410, level: "mission", now: "3º dia de teste — medindo cliques…" },
    { title: "Monitorar concorrente ArteParede · Quadro Paisagem", score: 380, level: "mission", now: "checando preço e posição a cada hora…" },
    { title: "Ler 64 avaliações novas da semana", score: 260, level: "mission", now: "48 de 64 lidas…" },
    { title: "Completar ficha técnica · Quadro Abstrato Dourado", score: 210, level: "auto", now: "3 atributos preenchidos — medindo efeito no ranking" },
  ],

  /* "O que eu decidi não te mostrar" (silêncio inteligente) */
  silence: [
    { title: "Flutuação de CTR no Espelho Decorativo (ruído)", reason: "variação dentro do padrão — conversão estável" },
    { title: "Oscilação de preço do concorrente GoldFrame (−2%)", reason: "impacto baixo demais para incomodar você" },
    { title: "Tendência 'quadro geométrico' subindo devagar", reason: "confiança insuficiente — monitorando mais uma rodada" },
    { title: "5ª avaliação 4 estrelas elogiando a moldura", reason: "positivo, mas não exige ação" },
    { title: "Micro-queda de ranking do Fone Bluetooth (1 posição)", reason: "dentro da margem normal do dia da semana" },
    { title: "Reposicionar Relógio Minimalista", reason: "boa ideia, mas fora da capacidade operacional de hoje" },
  ],

  suggestions: [
    "Por que você priorizou o Quadro Paisagem?",
    "O que você ignorou hoje?",
    "Mostra o raciocínio da decisão 1",
    "Como está minha operação?",
  ],
};

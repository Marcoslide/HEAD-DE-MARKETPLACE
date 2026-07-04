# 05 · Wireframes de Alto Nível

> Estes wireframes definem **estrutura e hierarquia**, não pixels. A materialização visual está no protótipo navegável: [`design/prototipo/index.html`](../design/prototipo/index.html) — abra no navegador.

Legenda: `◉` atividade viva · `●` estado sólido (aguardando usuário) · `▸` expansível · serifa = voz do Head.

---

## HOME — o escritório

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Head ▾   │                                                      │
│          │   Bom dia, Marcos.                        (serifa)   │
│ ● Home  2│   Enquanto você descansava, continuei trabalhando    │
│   IA     │   na sua operação.                                   │
│   Produt.│                                                      │
│   Missões│   Hoje eu:                                           │
│   Conhec.│   • Analisei 1.284 anúncios                          │
│          │   • Monitorei 436 concorrentes                       │
│          │   • Li 3.241 avaliações                              │
│          │   • Detectei 4 oportunidades                         │
│          │   • Criei 3 novas versões                            │
│          │                                                      │
│          │   A descoberta mais importante: buscas por           │
│          │   "kit ferramentas com maleta" cresceram 47%…        │
│          │   — Eu cuido do resto.                               │
│          │  ────────────────────────────────────────────        │
│          │   AGUARDANDO SUA DECISÃO (2)                         │
│          │   ┌──────────────────────────────────────────┐       │
│          │   │ RESPOSTA COMPETITIVA · Kit Ferramentas   │       │
│          │   │ "Dois concorrentes baixaram preço. Não   │       │
│          │   │  sugiro cobrir — sugiro reposicionar o   │(serifa)│
│          │   │  anúncio pelo diferencial da maleta."    │       │
│          │   │ evidência · evidência · impacto ~R$/mês  │       │
│          │   │ reversível em 1 clique                   │       │
│          │   │ [Aprovar] [Ajustar] [Recusar] [Perguntar]│       │
│          │   └──────────────────────────────────────────┘       │
│          │   ┌ decisão #2 ─────────────────────────────┐        │
│          │  ────────────────────────────────────────────        │
│          │   DESCOBERTAS DE HOJE                                │
│          │   [tendência] [oportunidade] [alerta]                │
│          │  ────────────────────────────────────────────        │
│ ─────────│   TRABALHO EM ANDAMENTO            ver missões →     │
│ ◉ Pulso  │   ◉ investigando…  ◉ criando…  ◉ monitorando…        │
│ "Lendo   │                                                      │
│ avaliaçõ…│                                          [⌘K falar]  │
└──────────┴──────────────────────────────────────────────────────┘
```

Hierarquia: **1** briefing (voz) → **2** decisões (pedem o usuário) → **3** descobertas (informam) → **4** trabalho em andamento (tranquiliza). A Home termina — não há scroll infinito.

---

## IA — a conversa

```
┌──────────┬──────────────────────────────────────────────────────┐
│ sidebar  │  Conversas ▸    │        CONVERSA ATUAL              │
│          │  · Queda kit…   │                                    │
│          │  · Estratégia…  │  [Marcos] Por que minhas vendas    │
│          │                 │  caíram essa semana?               │
│          │                 │                                    │
│          │                 │  [Head] Investiguei agora. A queda │
│          │                 │  está concentrada no Kit Ferrame…  │
│          │                 │  ┌ CARD DE DIAGNÓSTICO ──────────┐ │
│          │                 │  │ causa provável + 3 evidências │ │
│          │                 │  │ ▸ ver detalhe   [criar plano] │ │
│          │                 │  └───────────────────────────────┘ │
│          │                 │  Sugestões: "O que você faria?"    │
│          │                 │             "Crie 3 versões"       │
│ ◉ Pulso  │                 │  ┌─────────────────────────────┐   │
│          │                 │  │ Fale com o Head…        [→] │   │
│          │                 │  └─────────────────────────────┘   │
└──────────┴─────────────────┴────────────────────────────────────┘
```

Respostas compõem **os mesmos cards** das outras telas (decisão, missão, versão). Pedido de trabalho → nasce card de missão inline.

---

## PRODUTOS — lista e detalhe

```
LISTA                                   ordenar: atenção primeiro ▾
┌────────────────────────────────────────────────────────────┐
│ ▦  Kit Ferramentas 129pç   ◔ 61   ↓ conversão −23% (7d)    │
│    #3 na busca · 2 oportunidades                           │
│    "Estou investigando a queda — 2 concorrentes…" (serifa) │
├────────────────────────────────────────────────────────────┤
│ ▦  Suporte Notebook        ◕ 87   ↑ +6% · #1 na busca      │
│    "Testando título novo desde ontem."                     │
└────────────────────────────────────────────────────────────┘

DETALHE
┌────────────────────────────────────────────────────────────┐
│ ▦ Kit Ferramentas 129 peças                    Saúde ◔ 61  │
│ 1 "Este produto pede atenção. A conversão caiu 23%…"(serifa)│
│ 2 OPORTUNIDADES (cards de decisão)                         │
│ 3 LINHA DO TEMPO   12/jun troquei título → +9% em 7d       │
│ 4 VERSÕES          v3 ativa · v2 · v1  [comparar]          │
│ 5 POSIÇÃO COMPETITIVA (narrada, não tabelada)              │
└────────────────────────────────────────────────────────────┘
```

---

## MISSÕES — o trabalho ao vivo

```
┌────────────────────────────────────────────────────────────┐
│ EM ANDAMENTO (3)                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ◉ Investigando queda de conversão · Kit Ferramentas    │ │
│ │   agora: comparando preços de 12 concorrentes…         │ │
│ │   ▸ diário de bordo                                    │ │
│ │     14:02 li 218 avaliações do concorrente líder       │ │
│ │     13:40 identifiquei 2 quedas de preço agressivas    │ │
│ │   origem: iniciada por mim — detectei queda de ranking │ │
│ └────────────────────────────────────────────────────────┘ │
│ ◉ Criando 3 versões · Suporte Notebook                     │
│ AGUARDANDO VOCÊ (1)        ● bloqueada por decisão         │
│ CONCLUÍDAS HOJE (5)        com resultado medido            │
└────────────────────────────────────────────────────────────┘
```

---

## CONHECIMENTO — a memória viva

```
┌────────────────────────────────────────────────────────────┐
│ Coleções: [Aprendizados] [Estratégias] [Palavras] [Criat.] │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ APRENDIZADO · categoria Ferramentas                    │ │
│ │ "Anúncios com vídeo de uso real convertem 31% mais     │ │
│ │  nesta categoria."                             (serifa)│ │
│ │ comprovado em 2 produtos · jun/2026                    │ │
│ │ [Aplicar em outro produto] [Perguntar sobre isso]      │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌ ESTRATÉGIA VENCEDORA · reposicionar vs. cobrir preço ─┐  │
│ ┌ PALAVRA-CHAVE · "com maleta" → +47% de busca ─────────┐  │
└────────────────────────────────────────────────────────────┘
```

---

## Onboarding — a IA trabalha na frente do usuário

```
conectar conta → tela única de missão ao vivo:

┌────────────────────────────────────────────────────────────┐
│              ◉ Conhecendo a sua operação                   │
│                                                            │
│   ✓ Encontrei seus 148 anúncios                            │
│   ✓ Li suas 2.481 avaliações                               │
│   ◉ Analisando seus 30 maiores concorrentes…               │
│   · Procurando oportunidades imediatas                     │
│                                                            │
│   "Já vi algo interessante no seu Kit Ferramentas —        │
│    te conto no meu primeiro briefing."             (serifa)│
└────────────────────────────────────────────────────────────┘

→ primeiro briefing na Home, com a 1ª decisão pronta para aprovar
```

Sem formulários, sem tour. O onboarding **é** o produto acontecendo pela primeira vez.

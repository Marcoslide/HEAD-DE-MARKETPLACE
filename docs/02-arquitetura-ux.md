# 02 · Arquitetura de UX, Navegação e Fluxos

## O modelo mental

O usuário deve pensar no produto como pensa em um funcionário sênior:

```
"O que ele fez?"            → HOME (briefing do dia)
"Preciso falar com ele."    → IA (conversa)
"Como está meu portfólio?"  → PRODUTOS
"No que ele está mexendo?"  → MISSÕES
"O que ele já aprendeu?"    → CONHECIMENTO
```

Cada área responde a **uma pergunta natural sobre um funcionário**. É por isso que são cinco, e por isso que têm esses nomes — nenhuma área tem nome de módulo de sistema ("Analytics", "Relatórios", "Configurações de anúncio").

## Estrutura da aplicação

```
┌──────────────────────────────────────────────────────────────┐
│  APP SHELL                                                   │
│                                                              │
│  ┌────────────┐  ┌─────────────────────────────────────────┐ │
│  │  SIDEBAR   │  │  ÁREA DE CONTEÚDO                       │ │
│  │            │  │  (uma coluna, máx. ~1100px, centrada)   │ │
│  │  Home    3 │  │                                         │ │
│  │  IA        │  │                                         │ │
│  │  Produtos  │  │                                         │ │
│  │  Missões 5 │  │                                         │ │
│  │  Conhec.   │  │                                         │ │
│  │            │  │                                         │ │
│  │ ─────────  │  │                                         │ │
│  │ ● PULSO    │  │                                         │ │
│  │ "Lendo     │  │                                         │ │
│  │ avaliações"│  │                                         │ │
│  └────────────┘  └─────────────────────────────────────────┘ │
│                                    [ ⌘K — falar com o Head ] │
└──────────────────────────────────────────────────────────────┘
```

### Elementos persistentes (presentes em 100% das telas)

1. **Sidebar** com as 5 áreas. Badges numéricos apenas onde há ação pendente do usuário (decisões aguardando na Home) ou trabalho ativo (missões em andamento). Sem submenu.
2. **O Pulso** — rodapé fixo da sidebar com um ponto pulsando e a atividade atual da IA em tempo real (*"Monitorando preços de 436 concorrentes…"*). É o coração da sensação de "nunca parado". Clicar no Pulso leva a Missões. Especificação completa em `03-estados-e-voz-da-ia.md`.
3. **⌘K / barra de conversa global** — de qualquer tela, o usuário invoca o Head e fala. Não precisa navegar até "IA" para pedir algo. A conversa é um **atalho onipresente**, não um destino obrigatório.

**Justificativa da coluna única de conteúdo:** dashboards usam grids de widgets porque não sabem o que é mais importante. Nós sabemos — a IA ordena tudo por impacto. Uma coluna com hierarquia clara comunica "eu já organizei isso pra você" e cria o ritmo de leitura de uma carta, não de um painel de avião.

---

## HOME — o escritório do Head

**Pergunta que responde:** *"O que aconteceu enquanto eu não estava, e o que precisa de mim?"*

**Não é um dashboard.** É o momento diário de conversa com o funcionário. A hierarquia é rígida e ordenada por "o que um Head humano falaria primeiro":

```
┌────────────────────────────────────────────────┐
│ 1. O BRIEFING (a carta do dia)                 │
│    "Bom dia, Marcos. Enquanto você descansava, │
│    continuei trabalhando na sua operação…"     │
│    • trabalho realizado (números narrados)     │
│    • a descoberta mais importante do dia       │
├────────────────────────────────────────────────┤
│ 2. AGUARDANDO SUA DECISÃO  (2)                 │
│    [Decisão pronta #1 — aprovar/ajustar/ver]   │
│    [Decisão pronta #2]                         │
├────────────────────────────────────────────────┤
│ 3. DESCOBERTAS DE HOJE                         │
│    [tendência] [oportunidade] [alerta]         │
├────────────────────────────────────────────────┤
│ 4. TRABALHO EM ANDAMENTO (resumo de missões)   │
│    → link para Missões                         │
└────────────────────────────────────────────────┘
```

**Decisões de UX e justificativas:**

- **O briefing é escrito em primeira pessoa e tem tom de carta.** É a peça de interface que mais carrega a metáfora do funcionário. Tipograficamente é o único elemento em serifa (ver design system) — a "voz humana" do produto.
- **Números do briefing são trabalho, não performance.** "Analisei 1.284 anúncios" e não "CTR médio 2,8%". O briefing presta contas do esforço; performance aparece só quando vira diagnóstico.
- **A seção 2 (decisões) fica acima das descobertas** porque é a única seção que pede algo do usuário. Regra geral do produto: *o que precisa do usuário vem antes do que apenas informa*.
- **A Home tem fim.** Depois da seção 4, acabou. Zerar as decisões pendentes deve ser possível em poucos minutos. O estado "tudo aprovado" é celebrado com uma linha do Head (*"Sem pendências. Eu cuido do resto."*) — a sensação de operação sob controle é o produto funcionando.
- **Saudação sensível a hora e contexto** ("Bom dia" / "Boa noite"; "enquanto você descansava" / "desde a sua última visita há 2 horas"). Detalhe pequeno, efeito enorme na sensação de continuidade.

---

## IA — a conversa

**Pergunta que responde:** *"Preciso falar com ele."*

Tela de conversa em tempo integral, mesma anatomia do ChatGPT/Perplexity — porque esse padrão já foi aprendido pelo mercado e não há ganho em reinventá-lo. O que diferencia é **o que a conversa consegue fazer**:

- *"Faça um anúncio para este produto."* → a IA cria **uma missão** e responde com o card da missão dentro do chat.
- *"Por que minhas vendas caíram?"* → a IA responde com um **card de diagnóstico** (mesmo componente usado na Home), com evidências expansíveis.
- *"Crie três versões."* → devolve **cards de versão** comparáveis lado a lado, aprováveis inline.

**Decisões de UX:**

- **Respostas são compostas de componentes, não só texto.** Cards de decisão, missão, produto e versão são renderizados dentro da conversa — os mesmos componentes das outras telas. Isso mantém o produto coeso: a conversa é feita da mesma matéria que o resto.
- **Sugestões de pergunta contextuais** aparecem vazias de cerimônia acima do composer ("Por que as vendas caíram?", "O que você faria agora?"), alimentadas pelo estado real da operação.
- **Histórico de conversas na própria tela** (lista lateral discreta), porque conversas com um funcionário são memória de trabalho, não sessões descartáveis.
- **Nenhum jargão de IA.** Nada de "prompt", "tokens", "modelo". O usuário fala com o Head, não com uma LLM.

---

## PRODUTOS — o portfólio

**Pergunta que responde:** *"Como estão meus produtos?"*

### Lista

Cada linha é um produto com: imagem, nome, **Saúde** (anel 0–100), tendência de conversão (seta + frase curta), ranking na busca, nº de oportunidades abertas, e a **última frase do Head sobre ele** (*"Estou testando um título novo desde ontem"*).

- **Ordenação padrão: "precisa de atenção primeiro"** — não alfabética, não por receita. A IA ordena; o usuário pode reordenar, mas o padrão carrega opinião.
- **Saúde é um índice composto (0–100)** calculado pela IA (conversão relativa à categoria, qualidade do anúncio, competitividade de preço, ranking, avaliações). É o único "número de dashboard" tolerado no produto — e é tolerado porque **é um julgamento, não um dado**: ele responde "esse produto está bem?" sem exigir interpretação.

### Detalhe do produto

```
┌─────────────────────────────────────────────┐
│ [imagem]  Nome do produto        Saúde ◔ 74 │
│ 1. DIAGNÓSTICO DO HEAD (voz, serifa)        │
│    "Este produto está saudável, mas…"       │
│ 2. OPORTUNIDADES ABERTAS (cards de decisão) │
│ 3. LINHA DO TEMPO                           │
│    tudo que a IA fez neste produto, com     │
│    efeito medido de cada ação               │
│ 4. VERSÕES                                  │
│    v3 (ativa) · v2 · v1 — comparáveis,      │
│    com resultado de cada uma                │
│ 5. POSIÇÃO COMPETITIVA (narrada)            │
│    "Você é o 3º em ranking; o 1º ganha      │
│    por preço, você ganha por avaliação."    │
└─────────────────────────────────────────────┘
```

- **Diagnóstico antes de qualquer número** (princípio 1).
- **Linha do tempo com efeito medido** (*"12/jun — troquei o título → conversão +9% em 7 dias"*) é o que transforma histórico em prestação de contas.
- **Versões são um conceito de primeira classe:** cada mudança significativa no anúncio é uma versão, com autor (Head ou usuário), motivo e resultado. Isso dá segurança para aprovar mudanças — sempre dá para voltar.

---

## MISSÕES — o trabalho ao vivo

**Pergunta que responde:** *"No que ele está trabalhando agora?"*

A tela que materializa o "funcionário trabalhando". Lista viva de missões, agrupadas por estado:

```
EM ANDAMENTO (com atividade ao vivo)
  ◉ Investigando queda de conversão — Kit Ferramentas
     └ agora: comparando preços de 12 concorrentes…
  ◉ Criando 3 versões de anúncio — Suporte de Notebook
AGUARDANDO VOCÊ (bloqueadas por decisão do usuário)
CONCLUÍDAS HOJE (com resultado)
```

Anatomia de uma missão (expandida):

- **Objetivo** em uma frase, sempre amarrado a conversão.
- **Diário de bordo**: passos narrados com hora (*"14:02 — li 218 avaliações do concorrente líder"*). É o "ver o funcionário trabalhar".
- **Origem**: quem pediu (o usuário, via conversa) ou por que a IA iniciou por conta própria (*"iniciei porque detectei queda de ranking"*).
- **Resultado** ao concluir: o que mudou e o efeito esperado/medido.

**Justificativas:**

- **Missões ficam em tela própria, não escondidas em notificações**, porque acompanhar trabalho em andamento é um ritual de confiança — sobretudo nos primeiros 30 dias de uso, quando o usuário ainda está decidindo se confia.
- **O diário de bordo é gerado como narrativa, não como log técnico.** "Li 218 avaliações" e não "fetch_reviews: 218 ok".
- **Missões concluídas migram automaticamente**: o resultado relevante vira item do briefing seguinte, e o aprendizado (se houver) vira entrada no Conhecimento. Nada morre em silêncio.

---

## CONHECIMENTO — a memória viva

**Pergunta que responde:** *"O que ele já aprendeu sobre a minha operação?"*

Biblioteca construída **pela IA**, não pelo usuário. Coleções:

- **Aprendizados** — padrões descobertos (*"Nesta categoria, anúncios com vídeo convertem 31% mais"*).
- **Estratégias vencedoras** — jogadas que funcionaram, com contexto e resultado, prontas para reaplicar.
- **Palavras-chave que funcionaram** — com o efeito medido de cada uma.
- **Criativos vencedores** — imagens e títulos campeões, com o porquê.

Cada entrada tem: a descoberta em uma frase, a evidência, onde foi aplicada, o resultado, e ações (*"aplicar em outro produto"*, *"perguntar sobre isso"*).

**Justificativas:**

- **Conhecimento é o ativo de retenção do produto.** A cada semana a biblioteca cresce e o custo de trocar de ferramenta aumenta — o usuário estaria demitindo um funcionário que conhece o negócio dele profundamente.
- **Entradas nascem de missões e decisões reais**, nunca de conteúdo genérico. Uma dica que serviria para qualquer vendedor não entra; um padrão medido na operação do usuário, sim.

---

## Fluxos principais

### 1. Primeiro acesso (onboarding)

```
conecta a conta do marketplace
→ a IA começa a trabalhar NA HORA, na frente do usuário:
   tela de missão ao vivo ("Conhecendo sua operação…
   analisando seus 148 anúncios… lendo suas avaliações…")
→ em minutos, o PRIMEIRO BRIEFING nasce:
   "Prazer, Marcos. Passei os últimos minutos estudando sua
   operação. Já encontrei 4 oportunidades. A mais valiosa: …"
→ a primeira decisão pronta para aprovar já está na Home
```

**Justificativa:** nenhum formulário, nenhum tour com setinhas. O onboarding **é** o produto acontecendo. A primeira impressão precisa ser "ele já está trabalhando" — o tour clássico comunicaria "você vai ter que operar isso".

### 2. Loop diário (o ritual)

```
notificação/visita → briefing (30s de leitura)
→ decide as pendências (1 clique cada, detalhe opcional)
→ opcional: olha missões / conversa
→ estado "tudo em dia" → sai
```

Meta de tempo: **menos de 5 minutos por dia** para operação sob controle.

### 3. Aprovação de uma decisão

```
card: descoberta → causa provável → proposta → impacto estimado → risco/reversibilidade
ações: [Aprovar] [Ajustar] [Recusar] [Perguntar sobre isso]
→ Aprovar: vira missão de execução, rastreável; efeito medido é
  reportado no briefing dias depois ("aquela mudança rendeu +9%")
→ Ajustar: abre conversa com o card em contexto
→ Recusar: um clique + motivo opcional; a IA registra e aprende
```

**Fechar o ciclo é obrigatório:** toda aprovação recebe, dias depois, o reporte do efeito medido. É o momento que constrói a confiança para as próximas aprovações — e a prova contínua de valor do produto.

### 4. Conversa → missão

```
pedido no chat ("crie 3 versões desse anúncio")
→ resposta imediata com card de missão criada
→ a missão aparece em Missões e no Pulso
→ ao concluir: resultado volta na conversa E no briefing
```

**Justificativa:** pedidos não podem evaporar no histórico do chat. Transformar pedido em missão rastreável é o que diferencia "chatbot" de "funcionário que anota e faz".

## Hierarquia de informação (regra transversal)

Em qualquer superfície do produto, a ordem de leitura é sempre:

```
Nível 1 — a frase do Head        (diagnóstico/decisão, voz humana)
Nível 2 — a evidência resumida   (2–3 fatos que sustentam a frase)
Nível 3 — a proposta e as ações  (aprovar/ajustar/recusar/perguntar)
Nível 4 — o detalhe profundo     (dados, gráficos, histórico — sempre atrás de um clique)
```

Gráficos e tabelas **existem** — no nível 4, para quem quiser auditar. Nunca nos níveis 1–3.

# 01 · Visão e Princípios de Produto

## A metáfora que governa tudo

O produto é um **funcionário**, não uma ferramenta.

Essa não é uma frase de marketing — é a decisão de arquitetura mais importante do produto, porque ela decide **quem carrega a carga cognitiva**. Numa ferramenta, a carga é do usuário: ele precisa saber onde olhar, o que significa cada número, o que fazer a respeito. Num funcionário, a carga é do funcionário: ele olha, interpreta, decide o que é importante e traz pronto.

Toda decisão de UX deste documento deriva dessa metáfora. Quando houver dúvida sobre qualquer decisão futura de interface, a pergunta de desempate é:

> **"Um Head de Marketplace humano excelente faria isso desse jeito?"**

Um Head humano excelente não te manda uma planilha às 7h da manhã. Ele te manda uma mensagem: *"resolvi X, estou investigando Y, preciso que você aprove Z"*. É exatamente isso que a interface faz.

## A inversão

| Software tradicional | Head de Marketplace |
|---|---|
| Usuário entra para **procurar** problemas | A IA **já encontrou** os problemas |
| Mostra gráficos e espera interpretação | Entrega interpretação e esconde os gráficos |
| Menus organizados por **módulos do sistema** | Navegação organizada pelo **trabalho do funcionário** |
| Mede sucesso por tempo de uso | Mede sucesso por **decisões aprovadas e conversão gerada** |
| O usuário executa | A IA executa; o usuário **aprova** |
| Silêncio quando nada acontece | **Nunca há silêncio** — sempre há trabalho em andamento |

Repare no quarto item: este produto é melhor quanto **menos** tempo o usuário precisa passar nele. Essa é uma métrica invertida em relação a quase todo SaaS — e é o que faz o produto parecer um funcionário e não um vício de dashboard.

## Os 7 princípios

### 1. A IA fala primeiro

Em toda tela, em todo estado, a primeira coisa que o usuário lê é a IA falando — nunca um número, nunca um gráfico, nunca um menu. A Home abre com o briefing do dia. Um produto abre com o diagnóstico do Head sobre aquele produto. Uma tela vazia abre com o Head explicando o que ele vai fazer ali.

**Por quê:** a sensação de "contratei alguém" é construída na primeira leitura de cada tela. Se o primeiro contato for um KPI, o produto vira dashboard instantaneamente e a metáfora morre.

### 2. Decisões, não dados

Dados são evidência, nunca manchete. Todo número aparece **dentro** de uma frase de diagnóstico, como prova — no nível 2 ou 3 da hierarquia de informação, nunca no nível 1.

**Errado:** `CTR 2,8% ↓`
**Certo:** *"A conversão do Kit Ferramentas caiu 23% desde terça. Investigei: dois concorrentes baixaram preço agressivamente. Preparei uma resposta — quer ver?"*

**Por quê:** interpretar dado é exatamente o trabalho pelo qual o cliente está pagando. Entregar o dado cru é entregar o trabalho de volta pra ele.

### 3. Nunca parado

Em qualquer momento, em qualquer tela, existe evidência visível de trabalho acontecendo agora ("Analisando concorrentes…", "Lendo avaliações…"). A presença é um elemento permanente da interface (ver `03-estados-e-voz-da-ia.md`).

**Por quê:** um funcionário 24h que parece parado é um funcionário demitido. A percepção de valor do produto entre uma visita e outra depende inteiramente dessa evidência de trabalho contínuo.

### 4. Aprovar é mais fácil que entender

Toda decisão trazida pela IA chega **pronta para aprovação em uma leitura**: o que descobri → por que aconteceu → o que proponho → quanto vale → risco. Aprovar é um clique. Detalhar é opcional. Recusar também ensina a IA (pede o motivo em um clique).

**Por quê:** o gargalo do produto é a confiança do usuário, e confiança se constrói com decisões pequenas, claras e reversíveis aprovadas em sequência — não com relatórios longos.

### 5. Mostrar o trabalho, não só o resultado

A IA sempre quantifica e narra o esforço: *"analisei 1.284 anúncios, li 3.241 avaliações"*. Missões têm diário de bordo. Decisões mostram a trilha de investigação.

**Por quê:** trabalho invisível não gera percepção de valor nem confiança. É o mesmo motivo pelo qual um bom funcionário reporta o que fez — e é o que justifica a mensalidade nos meses em que nada dramático aconteceu.

### 6. Poucos lugares, sempre os mesmos

Cinco áreas, e nunca mais que cinco: **Home, IA, Produtos, Missões, Conhecimento**. Nenhum submenu de segundo nível na navegação. Funcionalidade nova não ganha menu — ganha lugar dentro de uma das cinco áreas ou vira capacidade da conversa.

**Por quê:** cada item de menu adicionado transfere trabalho de organização da IA para o usuário. ERPs têm 40 menus porque não sabem o que é importante; nós sabemos — é o nosso trabalho saber.

### 7. Tudo é conversa (ou vira uma)

Qualquer elemento da interface pode ser "puxado" para a conversa: um produto, uma decisão, uma missão, uma descoberta. "Perguntar sobre isso" existe em todo card. E qualquer pedido na conversa pode virar uma missão rastreável.

**Por quê:** a conversa é a interface natural com um funcionário. As telas existem para dar estrutura e memória à relação — não para substituí-la.

## O teste de conversão

Antes de qualquer funcionalidade entrar no produto, ela responde por escrito:

1. **Isso aumenta conversão dos anúncios ou o resultado da operação?** (se não: não existe)
2. **Isso poderia ser feito pela IA sem pedir nada ao usuário?** (se sim: fazer automaticamente e apenas reportar)
3. **Isso adiciona um lugar novo para o usuário olhar?** (se sim: forte sinal contra)

## Anti-visão — o que este produto se recusa a ser

- **Não é dashboard.** Não existe tela cuja função primária seja exibir gráficos. Gráficos existem apenas como evidência dentro de um diagnóstico.
- **Não é ERP.** Não existe cadastro, formulário longo, árvore de menus, tabela com 30 colunas.
- **Não é copiloto passivo.** A IA não espera pergunta. Ela trabalha, descobre e propõe por iniciativa própria.
- **Não é caixa de ferramentas de IA.** Não existe "gerador de título", "gerador de imagem" como ferramentas soltas. Existem missões com objetivo de conversão que *usam* essas capacidades.
- **Não é feed infinito.** A Home tem fim. O usuário deve conseguir "zerar" o dia em minutos e sair com a sensação de operação sob controle.

## Referências de calibre (e o que tiramos de cada uma)

- **Linear** — velocidade percebida, densidade calma, teclado em primeiro lugar.
- **Superhuman** — a noção de "zerar o dia" e o luxo da escassez de elementos.
- **Stripe** — números tratados com respeito tipográfico; confiança pela precisão.
- **Perplexity / ChatGPT** — conversa como interface primária, com fontes e evidências visíveis.
- **Arc / Raycast** — coragem de quebrar convenções de categoria (a Home-carta é a nossa quebra).
- **Notion** — vazios que ensinam em vez de constranger.

A régua: se uma tela nossa fosse colocada ao lado de uma tela do Linear, ela não pode parecer de uma geração anterior.

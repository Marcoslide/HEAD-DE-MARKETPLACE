# Knowledge Graph — o cérebro associativo do Head

> Sprint 07. Camada Cognitiva (MIE). **Não é uma tela. O usuário nunca vê o grafo.**
> É o que faz o Head deixar de pensar em eventos isolados e passar a pensar em
> **relações, padrões e memória contextual** — a diferença entre um dashboard e um
> diretor de marketplace que lembra do que já funcionou.

## Como rodar

```bash
node --test mie/test/knowledge-graph.test.js   # 10 testes
node mie/demo-graph.js                          # o Head reutilizando aprendizado
```

## O que é

Um grafo **tipado, dirigido, ponderado e com decaimento**, populado a partir dos
eventos que os motores já emitem (não toca nenhum motor — só escuta o EventBus,
como o MieBridge). Determinístico, zero dependências, roda em Node e no navegador.

- **Nós** representam entidades: Product, Listing, Marketplace, Competitor, Keyword,
  Trend, Review, Question, Objection, Experiment, Decision, Mission, Learning,
  Strategy, Creative, PriceChange, RankingChange, Category.
- **Arestas** representam relações com peso e resultado (positivo/negativo).
- **Decaimento**: relações perdem peso com o desuso e são **esquecidas** abaixo de um
  piso; reforçam-se quando confirmadas ou reaproveitadas (Art. 16-18). Uma relação
  velha que deixou de ser útil some das consultas; um reforço a ressuscita.

## As relações que o Head passa a enxergar

```
Product   ──PRODUCT_IN_CATEGORY──▶       Category
Product   ──PRODUCT_HAS_LISTING──▶       Listing ──LISTING_USES_KEYWORD──▶ Keyword
Keyword   ──KEYWORD_AFFECTED_RANKING──▶  RankingChange
Competitor──COMPETITOR_AFFECTED_PRODUCT─▶Product
Review    ──REVIEW_REVEALED_OBJECTION──▶ Objection ──OBJECTION_GENERATED_ACTION──▶ Decision
Decision  ──DECISION_CREATED_EXPERIMENT─▶Experiment ──EXPERIMENT_GENERATED_LEARNING──▶ Learning
Strategy  ──STRATEGY_WORKED_FOR_CATEGORY▶Category
Creative  ──CREATIVE_IMPROVED_CTR──▶      Learning
PriceChange──PRICE_CHANGE_AFFECTED_CONVERSION─▶ Learning
Learning  ──LEARNING_REUSED_IN_DECISION─▶Decision   (reforça o aprendizado)
```

## As consultas internas (o que um dashboard não responde)

| Pergunta | Método |
|---|---|
| O que já funcionou para este produto? | `whatWorkedForProduct(id)` |
| O que já funcionou para esta categoria? | `whatWorkedForCategory(cat)` |
| Quais concorrentes mais impactaram este anúncio? | `competitorsImpacting(id)` |
| Quais palavras-chave melhoraram ranking? | `keywordsImprovedRanking()` |
| Quais ações pioraram conversão? | `actionsHurtConversion()` |
| Quais objeções mais aparecem nas avaliações? | `topObjections(id?)` |
| Quais aprendizados posso reaproveitar agora? | `reusableLearnings(id)` |

Cada consulta devolve nós ordenados por **peso efetivo** (já com decaimento aplicado),
ignorando relações "esquecidas".

## Integração com os motores

O grafo se conecta ao restante do MIE sem acoplar (tudo via eventos + injeção):

- **Memory Engine** — carrega o grafo (`memory.graph`); os aprendizados da memória
  viram nós de Learning/Strategy.
- **Investigation Engine** — nova etapa **`consultar_grafo`**: antes de recomendar,
  o Head pergunta "o que já funcionou aqui?" e anexa os aprendizados reaproveitáveis,
  os concorrentes que já impactaram e as objeções recorrentes ao diagnóstico.
- **Specialists Engine** — os especialistas recebem o grafo no contexto; o de Conversão
  cita precedentes vencedores como evidência e **ganha confiança** quando há prova
  anterior ("já funcionou aqui antes: reposition").
- **Learning Engine** — quando um resultado é medido, o grafo cria o nó de aprendizado
  e as arestas de efeito (estratégia→categoria, criativo→CTR, preço→conversão),
  reforçando no acerto e **enfraquecendo no erro**.
- **MieBridge** — a decisão persistida na plataforma registra os `reusedLearnings`
  que a informaram — a memória contextual atravessa para o banco.

## Fluxo do reuso (o coração do Sprint)

```
1ª queda → investiga → recomenda reposition → mede → APRENDE
          → grafo: Strategy "reposition" ──WORKED_FOR──▶ Category "Quadros"

2ª queda parecida → investiga
          → consultar_grafo: reusableLearnings("p1") = ["reposition"]
          → o Head REUTILIZA o precedente vencedor em vez de partir do zero
          → grafo: Learning ──REUSED_IN──▶ Decision   (reforça o aprendizado)
```

## Fronteira constitucional

O grafo é **interno** (verificado por teste: não há `render`/`toScreen`/endpoint de
usuário). Ele vive na Camada Cognitiva; a Camada de Experiência nunca o expõe. É
visível apenas no painel de dev `/__dev` (ferramenta interna) — nunca no produto.

## Arquivos

```
mie/src/graph/knowledge-graph.js   ← núcleo: nós, arestas, decaimento, consultas
mie/src/graph/ingestor.js          ← popula o grafo a partir dos eventos + mundo
mie/src/engines/investigation.js   ← etapa consultar_grafo (reuso antes de agir)
mie/src/specialists/roster.js      ← especialistas usam evidência do grafo
mie/test/knowledge-graph.test.js   ← 10 testes
mie/demo-graph.js                  ← demo do reuso de aprendizado
```

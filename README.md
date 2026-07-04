# Head de Marketplace — IA

> O primeiro **Head de Marketplace com Inteligência Artificial**.
> Não é um ERP. Não é um HUB. Não é um dashboard. Não é um gerador de anúncios.
> É um funcionário extremamente inteligente que trabalha 24 horas por dia cuidando da sua operação de marketplaces.

---

## A tese do produto

Todo software de marketplace hoje funciona na mesma direção:

```
usuário entra → procura problema → analisa gráficos → decide → executa
```

Este produto inverte a direção:

```
a IA trabalha → descobre → investiga → cria → executa o que pode → entrega decisões prontas
```

O usuário nunca opera um sistema. Ele **conversa com um Head de Marketplace** e **aprova decisões**.

## A missão única

**Maximizar continuamente a conversão dos anúncios e aumentar os resultados da operação.**

Toda funcionalidade precisa passar por um único teste antes de existir:

> "Isso ajuda a aumentar conversão?"

Se a resposta não for sim, a funcionalidade não entra no produto.

## ⚖️ O documento soberano

**[`CONSTITUICAO.md`](CONSTITUICAO.md)** — a Constituição do Head de Marketplace (Sprint 03). Define como o Head pensa, investiga, decide, prioriza, aprende, conversa e cala. **Todo Sprint futuro deve passar pelo Teste de Conformidade do Artigo 24 antes de ser aprovado.** Em conflito entre qualquer decisão técnica e a Constituição, a Constituição vence.

## Estado deste repositório — Sprints 01–03

Este sprint é **exclusivamente de produto e experiência**. Não há backend, banco, APIs nem regras de negócio aqui — por decisão, não por falta. A visão de produto premium nasce no primeiro desenho; engenharia se refatora depois, primeira impressão não.

| Entrega | Onde |
|---|---|
| Visão e princípios de produto | [`docs/01-visao-e-principios.md`](docs/01-visao-e-principios.md) |
| Arquitetura de UX, navegação e fluxos | [`docs/02-arquitetura-ux.md`](docs/02-arquitetura-ux.md) |
| Estados, presença e voz da IA | [`docs/03-estados-e-voz-da-ia.md`](docs/03-estados-e-voz-da-ia.md) |
| Design system (tokens + componentes) | [`docs/04-design-system.md`](docs/04-design-system.md) |
| Wireframes de alto nível (todas as telas) | [`docs/05-wireframes.md`](docs/05-wireframes.md) |
| **Protótipo navegável** (HTML puro, abre no navegador) | [`design/prototipo/index.html`](design/prototipo/index.html) |

Para sentir o produto: abra `design/prototipo/index.html` em qualquer navegador. Não precisa de servidor, build ou dependências.

## O mapa em uma frase por área

- **Home** — o escritório do Head: ele fala primeiro, mostra o trabalho da noite e entrega decisões para aprovar.
- **IA** — a conversa: qualquer pedido em linguagem natural vira trabalho real.
- **Produtos** — o portfólio: cada produto com saúde, conversão, ranking, oportunidades e versões.
- **Missões** — o trabalho ao vivo: tudo que a IA está investigando, criando e executando agora.
- **Conhecimento** — a memória: tudo que a IA aprendeu e que comprovadamente funcionou.

## Princípio inegociável

**O sistema não mostra dados. O sistema mostra decisões.**

Errado: `CTR 2,8%`.
Certo: *"Detectei queda de conversão causada provavelmente por dois concorrentes que baixaram preço. Sugiro executar esta estratégia."*

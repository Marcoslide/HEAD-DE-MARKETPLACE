# Marketplace Operating System

> O que estamos construindo é um **Marketplace Operating System (MOS)** — e o **Head de Marketplace com IA** é a interface humana desse sistema operacional.
> Não é um ERP. Não é um HUB. Não é um dashboard. Não é um gerador de anúncios.
> É um funcionário extremamente inteligente que trabalha 24 horas por dia cuidando da sua operação de marketplaces — sustentado por baixo pelos motores de inteligência, os playbooks, a memória, os especialistas e os fluxos operacionais.

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

## ⚖️ Os documentos soberanos

| Documento | O que governa |
|---|---|
| **[`CONSTITUICAO.md`](CONSTITUICAO.md)** | **Quem o Head é** — como pensa, investiga, decide, prioriza, aprende, conversa e cala. Todo Sprint passa pelo Teste de Conformidade (Art. 24). Em conflito, a Constituição vence tudo. |
| **[`MIF.md`](MIF.md)** | **O que o Head sabe fazer** — o Marketplace Intelligence Framework: a doutrina profissional de operação de marketplaces (patrimônio da empresa, executável por qualquer IA futura). |
| **[`MOS.md`](MOS.md)** | **Como a empresa funciona** — os fluxos operacionais completos (Fluxos 001–010): da loja conectada ao resultado que vira conhecimento. Operacional, não técnico. |
| **[`ROADMAP.md`](ROADMAP.md)** | **Para onde vamos** — a arquitetura em 6 camadas, as trilhas de construção e a estrela-polar (o briefing do funcionário executivo). |

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

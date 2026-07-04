# Head Conversational Operating Intelligence — o chat que responde

> Sprint 09.A. O chat do Head deixa de reagir como chatbot genérico
> ("anotei, levo isso em conta…") e vira uma **Central Operacional
> Conversacional**: pergunta factual recebe resposta imediata, com número,
> período, fonte, atualização e cobertura.

## A trava do sprint (cumprida por construção)

**Nenhuma resposta é hardcoded.** Toda pergunta percorre o MESMO mecanismo:

```
texto → Intent Router → Context Resolver → consulta TIPADA
→ Operational Intelligence Query Layer → Data Provider
→ (Demo Fixtures hoje / dados normalizados da Central depois)
→ Result Validator → Response Composer → resposta
```

- a interpretação **nunca produz número** — só decide o que consultar;
- todo número impresso vem de um campo de fatos da Query Layer (testado:
  `grossRevenue === 8420` vem do dataset, não do texto);
- **sem métrica/filtro/dado disponível → resposta honesta**: *"Eu ainda não
  tenho dados suficientes… Não vou inventar um número."* (testado para
  plataforma não conectada E para fonte real sem a seção de dados);
- variações naturais/informais/com erro ("qto entrou hj") chegam à MESMA
  consulta tipada e ao MESMO fato (testado).

## Como rodar

```bash
node --test mos/test/head-chat.test.js   # 24 testes (as 28 garantias)
node mos/demo-chat.js                    # a conversa completa com fixtures
# via API: POST /chat {text} · GET /chat/briefing · /chat/radar · /chat/closing
```

## Categorias de intenção (Intent Router)

| Intenção | Exemplo | O que acontece |
|---|---|---|
| `OPERATIONAL_QUERY` | "Quanto vendi hoje?" | consulta tipada → resposta imediata |
| `RISK_OR_EXCEPTION_QUERY` | "Qual meu maior risco?" | `getRiskSummary` priorizado por impacto |
| `DECISION_EXPLANATION` | "Por que você priorizou isso?" | EPE (`lastPlan`) com breakdown auditável e proveniência |
| `ACTION_REQUEST` | "Baixe o preço" | READ_ONLY: vira **proposta** com aprovação — nunca executa |
| `SIMULATION` | "E se eu baixar 8%?" | cenário marcado **ESTIMADO**, nunca certeza |
| `STRATEGY_OR_PLANNING` | "Como crescer no TikTok?" | responde o retrato factual primeiro, depois oferece plano |
| `FEEDBACK_OR_MEMORY` | "Não quero baixar preço" | preferência persistente (memória do MIE) |

Pergunta factual **nunca** vira missão, memória, "anotei" ou planejamento
(testado). Alerta é no máximo **um** por resposta e vem **depois** da
resposta (testado pela posição no texto).

## A consulta estruturada

Cada pergunta vira um objeto tipado:

```js
{ intent: 'OPERATIONAL_QUERY', metric: 'GROSS_REVENUE', aggregation: 'SUM',
  companyId, platforms: ['ALL'], stores: ['ALL'], productScope: null,
  statuses: null, period: { type: 'TODAY', timezone: 'America/Sao_Paulo' },
  ranking: null, comparison: null, asOf: <Clock> }
```

Extraídos quando existem: empresa, marketplace, produto/SKU, campanha,
status do pedido, métrica, período, comparação, agregação e ranking.

## Contexto conversacional

O contexto de curto prazo herda métrica/período/filtros; filtro novo
explícito sobrescreve:

- "Quanto vendi hoje?" → R$ 8.420
- "E na Shopee?" → R$ 4.780 (métrica e período herdados)
- "E ontem?" → R$ 3.950 **até o mesmo horário** — vindo de um HOJE parcial,
  a comparação é hora-contra-hora, nunca dia parcial × dia inteiro.

## Catálogo de métricas (com as diferenças que importam)

- **Faturamento bruto**: soma de pedidos aprovados. **Receita líquida**:
  após taxas/descontos/devoluções conhecidas. **Valor liquidado**: repasse
  da plataforma (indicador separado; dito quando não disponível).
  **Ticket médio**: faturamento ÷ pedidos aprovados. **Pedidos**: contagem
  ("quantos" = contagem; "quanto" = dinheiro).
- **Pedidos por estágio**: recebidos · aprovados · em produção · embalagem ·
  prontos · enviados · aguardando coleta · críticos por prazo · atrasados ·
  cancelados · devolvidos (todos distintos na resposta; testado).
- **Ads**: `ROAS = faturamento atribuído ÷ investimento` ·
  `ACOS = investimento ÷ faturamento atribuído` ·
  `CPA = investimento ÷ pedidos atribuídos` — sempre com a base declarada
  ("atribuição da própria plataforma, hoje até agora").
- **Conversão NUNCA sem denominador**: visita→pedido (`45 pedidos / 1.620
  visitas`), CTR (`494 cliques / 41.200 impressões`), checkout, aprovação,
  cancelamento (testado).
- **Estoque**: disponível ≠ reservado ≠ em produção; cobertura em dias;
  crítico < 3 dias. **Capacidade**: por dia, restante, personalizados.
- **Financeiro**: margem sempre com a ressalva honesta — *"margem ESTIMADA…
  sem todos os custos indiretos para lucro líquido final"*.

## Hierarquia de fontes

`LIVE_MARKETPLACE_DATA` → `NORMALIZED_INTERNAL_DATA` → `DEMO_FIXTURE` →
`PUBLIC_RESEARCH` → `NO_DATA`. Todo fato carrega
`{ dataSource, isLive, asOf, coverage, missingPlatforms, confidence }` e o
rodapé diz: *"Dados demonstrativos • Atualizado às 11:58 • TikTok Shop sem
dados conectados"*.

## Fixtures agora, Central depois — o MESMO contrato

`createHeadChat({ clock, mie, mos, companyId })`:

- com `mos + companyId` e dados sincronizados pela Central →
  `datasetFromCentral()` (fonte `NORMALIZED_INTERNAL_DATA`);
- sem dados reais → **Demo Operational Dataset** (fixtures coerentes entre
  vendas × pedidos × estoque × Ads × funil × capacidade, deterministas em
  torno do Clock).

Teste 27 prova que a mesma pergunta produz fatos com as **mesmas chaves**
nas duas fontes — quando ML/Shopee conectarem de verdade, a mesma conversa
responde com dado real sem reconstruir o chat. `companyId` isola empresas
(testado A×B sobre a Central).

## Tempo (Clock injetado, America/Sao_Paulo)

hoje · até agora · ontem · mesma-hora-de-ontem · esta semana (desde
segunda) · semana passada · este mês · mês passado · últimos 7/30 dias.
"Hoje" é o dia operacional LOCAL; comparação parcial é sempre declarada.

## Inteligência proativa

- **Briefing da manhã** (`briefing()` / `GET /chat/briefing`): vendas +
  comparação, expedição/críticos, estoque, Ads, maior risco, decisões.
- **Radar operacional** (`radar()`): riscos priorizados por impacto com
  próximo movimento.
- **Fechamento do dia** (`closing()`): vendas, margem estimada, Ads,
  expedição, pendências e foco recomendado para amanhã.
- **Insight de causa**: conversão caiu → mostra ONDE (ex.: CTR 1,9%→1,2% —
  "o problema começou antes da compra").
- **Simulação**: preço/Ads com base declarada, sempre "CENÁRIO ESTIMADO".
- Missão **não** nasce de pergunta factual — só de decisão, risco
  confirmado, estratégia ou comando (e comando é proposta, READ_ONLY).

## READ_ONLY

"Baixe o preço / pause a campanha / publique" → proposta
`awaiting_approval` com o que será validado (impacto, risco,
reversibilidade) e a garantia explícita: nenhuma mudança em anúncio,
preço, estoque, campanha ou pedido. Nada executa silenciosamente (testado).

## Observabilidade — `/__dev/chat`

Última intenção classificada, consulta estruturada completa, filtros,
fonte, cobertura, timestamp, serviço acionado, alerta gerado, contexto
ativo, propostas pendentes, READ_ONLY e falhas (NO_DATA). Essencial para
depurar resposta errada.

## Relação com o resto do organismo

- **Central de Marketplace (S09)**: fornece o dataset normalizado — o chat
  nunca vê payload bruto;
- **EPE**: explica prioridades com breakdown/proveniência; recebe apenas o
  que já é sinal;
- **Knowledge Graph/Memória**: preferências do dono viram conhecimento
  persistente;
- **Pesquisa pública ≠ dado privado**: hierarquia de fontes separa por
  construção.

## Arquivos

```
mos/src/chat/
  interpreter.js    ← léxico pt-BR + Intent Router + extração + contexto
  period.js         ← períodos via Clock (TZ America/Sao_Paulo)
  demo-dataset.js   ← Demo Operational Dataset + datasetFromCentral (mesmo contrato)
  query-layer.js    ← serviços tipados (fatos com fonte/cobertura/asOf)
  composer.js       ← fatos → resposta (formato: resposta→detalhe→alerta→rodapé)
  head-chat.js      ← orquestrador + briefing/radar/fechamento/simulação/READ_ONLY
  index.js          ← createHeadChat
mos/test/head-chat.test.js   ← 24 testes (28 garantias do sprint)
mos/demo-chat.js             ← a conversa completa
POST /chat · GET /chat/briefing|radar|closing · GET /__dev/chat
```

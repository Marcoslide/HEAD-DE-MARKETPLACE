# Central de Marketplace — pronta para ativação real

> Sprint 09. Camada de Execução (`mos/src/central/`), alimentando a Camada
> Cognitiva (MIE). **Uma Central única**: cada plataforma entra como um
> conector com suas capacidades, mas todos os dados chegam ao Head em um
> padrão comum. Nenhum "sistema Shopee" ou "sistema ML" separado.

## Estado atual — comunicação honesta

**O Sprint 09 entregou a Central de Marketplace: conectores estruturados,
segurança de tokens, normalização e o pipeline completo validado com
fixtures e mocks. A conexão real de loja é a próxima etapa de ativação.**

Nenhum conector está "integrado em produção": não há OAuth real, transporte
HTTP real nem leitura de loja real ainda — por decisão de segurança. Os
conectores são descritos sempre como: **estruturados · validados por
fixture · preparados para ativação · integração real pendente de credencial
e transporte oficial**. Quando a primeira loja real for conectada, troca-se
o transporte; pipeline, normalização, eventos e sinais não mudam.

**READ_ONLY é absoluto para marketplaces** — inclusive depois da ativação
real, neste estágio o Head apenas **lê, entende e organiza**. Toda
"execução automática" derivada da Central é **EXECUÇÃO INTERNA DO HEAD**
(ver seção abaixo): nada é alterado em Shopee, Mercado Livre, TikTok Shop
ou Magalu.

## Como rodar

```bash
node --test mos/test/central.test.js   # 21 testes da Central
node mos/demo-central.js               # fluxo vertical completo (fixtures)
```

## A arquitetura

```
Marketplace
→ Conector Oficial Autenticado (contrato único, capability matrix)
→ Resposta bruta preservada (raw_marketplace_payload — auditoria)
→ Normalização (entidade canônica idêntica p/ as 4 praças)
→ Dados internos (listing via external_id · orders · inventory · prices · metrics)
→ Eventos idempotentes (integration_event)
→ Sinais de negócio (playbooks da Central)
→ Knowledge Graph → EPE → Plano do Dia
```

Construída SOBRE o que existia (auditoria da Fase 1): mesmo Provider
Registry (o registry ganhou `registerConnector`/`connector`/`describe`),
mesma fila do kernel (nasceu apenas a fila `sync`), mesmo catálogo
(anúncio normaliza para `listing` via `external_id` — nenhuma tabela
paralela). A publicação simulada (escrita) segue intocada.

## Conector Oficial Autenticado ≠ Collector

| | Conector Oficial (Account Sync) | Collector / Pesquisa Pública |
|---|---|---|
| O que lê | dados PRIVADOS da própria loja | dados públicos de mercado |
| Autenticação | OAuth oficial, token cifrado | **nunca** recebe token |
| Neste sprint | ML + Shopee prontos; TikTok/Magalu estruturados | entrada simples `PUBLIC_RESEARCH` |
| Módulo | `mos/src/central/` | `mos/src/central/public-research.js` |

A separação é **por construção**: o módulo de pesquisa pública nem recebe o
CredentialProvider. Evidência pública = `{ sourceType: 'PUBLIC_RESEARCH',
sourceUrl, platform, subject, findings, confidence, observedAt }` — sem
Collector complexo, scraping ou automação de navegador neste sprint.

## O Registry e a matriz de capacidades

Cada praça declara o que REALMENTE oferece (`declarations.js`):

| Plataforma | Status | Leitura | Webhooks |
|---|---|---|---|
| Mercado Livre | `INTEGRATION_READY` | listings, orders, inventory, prices, logistics, returns, questions, metrics, ads, finance | sim |
| Shopee | `INTEGRATION_READY` | listings, orders, inventory, prices, logistics, returns, metrics, ads, finance | sim |
| TikTok Shop | `WAITING_PARTNER_APPROVAL` | listings, orders, inventory, prices, logistics, returns, metrics, finance | sim |
| Magalu | `WAITING_CREDENTIALS` | listings, orders, inventory, prices, logistics | não confirmado |

- Capability não declarada → `CapabilityError` (erro claro, nunca silencioso).
- `startConnect` de TikTok/Magalu **recusa** com o motivo real — nada é
  fingido sem documentação oficial, credencial e parceria validadas.
- **Escrita: tudo `false`.** Além da matriz, TODA ação de escrita
  (`publishListing`, `updatePrice`, `updateInventory`, `cancelOrder`…)
  lança `ReadOnlyViolationError` — READ_ONLY é lei técnica, não combinado.

## Conexão autenticada (backend-only)

```
usuário conecta a loja
→ autorização oficial do marketplace (startConnect)
→ authorization code → backend troca por access + refresh (completeConnect)
→ tokens CIFRADOS (AES-256-GCM, node:crypto) em marketplace_credential
→ conexão vinculada a empresa + conta + loja
→ capabilities validadas → sincronização inicial vira job
```

Segurança dos tokens:
- nunca em frontend, logs ou Git (teste varre os logs por fragmentos);
- access e refresh cifrados separadamente; chave via `MOS_CREDENTIAL_KEY`
  (32 bytes hex) — em dev, chave derivada marcada `devKey`;
- exposição externa só pela **máscara** (`APP_…e5f6`);
- renovação concorrente tem **lock single-flight**: duas chamadas → uma troca;
- `connectMock` (dev) exige `MockAuthTransport` + transporte de fixtures —
  impossível tocar conta real por acidente.

## Modelo canônico

Toda entidade normalizada carrega o envelope:

```js
{ companyId, platform, accountId, storeId,
  externalId, occurredAt, observedAt, synchronizedAt,
  rawReference, normalizedVersion, confidence, metadata }
```

- `occurredAt` — quando aconteceu NO marketplace;
- `observedAt` — quando a integração percebeu (Clock injetado se ausente);
- `synchronizedAt` — quando o sistema gravou;
- (`decidedAt`/`executedAt` seguem na memória/decisões — Sprint 08.1).

Os 4 normalizadores (listings/orders/inventory/prices/metrics) produzem
**exatamente as mesmas chaves** para as quatro praças (testado). O payload
bruto NUNCA circula: fica em `raw_marketplace_payload`, referenciado por
`rawReference`.

## Sincronização: jobs, watermarks, idempotência

- fila `sync` no kernel existente (retry + backoff + dead-letter);
- estado por (conexão × recurso) em `marketplace_sync_state`: watermark,
  última tentativa/sucesso, contadores (lidos/criados/atualizados/ignorados), erro;
- **watermark** = maior `occurredAt` processado → re-sync ignora o já visto;
- rate limit (429) → retry com backoff da fila (testado);
- falha de uma praça NÃO derruba as demais (jobs independentes; testado);
- isolamento por empresa: todo dado carrega o `company_id` da conexão e
  toda leitura parte dele (testado A×B);
- cada execução vira linha em `marketplace_sync_log` (histórico auditável).

## Eventos e idempotência

Envelope em `integration_event`; o **id É a chave de idempotência**:

```
sha256(platform + accountId + eventType + externalEntityId + occurredAt)
```

Evento repetido (re-sync, webhook duplicado, retry) → `INSERT OR IGNORE`
→ nenhum pedido/sinal/nó/alerta duplicado (testado de ponta a ponta,
inclusive no Plano do Dia). Métricas distintas do mesmo item no mesmo
instante têm `entityId` composto (`externalId:metric`) — não colidem.

## Sinais de negócio (os playbooks da Central)

`signals.js` lê APENAS dados normalizados e produz sinais executivos com
playbook nomeado, prova, impacto, recomendação e proveniência completa:

- `estoque-critico-campeao` — vende forte e o estoque não cobre 3 dias;
- `margem-melhor-em-outro-canal` — mesmo SKU, margens ≥ 8 p.p. diferentes;
- `campeao-ausente-no-canal` — produto validado sem anúncio em canal conectado;
- `potencial-tiktok` — vídeo do nicho crescendo sem conversão equivalente;
- `capacidade-personalizados` — fila custom acima da capacidade/dia da fábrica;
- `pedido-perto-de-atrasar` — coleta/expedição a menos de 36h (Classe A →
  o Head executa sozinho).

Fluxo: sinal → `CentralBridge` → Knowledge Graph (nós/arestas com
proveniência) → `epe.addExternalSignal()` → Plano do Dia. **O EPE rejeita
tecnicamente qualquer campo `payload`/`raw`** — só sinal normalizado entra.
Cada item do plano carrega `provenance` (plataforma, conta, loja, entidade,
evento) — rastreável até o payload bruto.

### EXECUÇÃO INTERNA DO HEAD (`executionScope: 'INTERNAL_ONLY'`)

Todo sinal da Central chega ao EPE marcado como `INTERNAL_ONLY`, e a marca
segue até o Plano do Dia (testado). Quando o EPE classifica um desses
sinais como "executar", isso significa APENAS ações dentro do próprio
sistema:

- criar alerta interno · destacar pedido crítico · priorizar a fila
  operacional · registrar evento · abrir missão interna · atualizar o
  Plano do Dia · notificar o responsável · marcar risco · recomendar ação.

O que ele **não pode** (e o código impede em três camadas): alterar preço,
estoque ou anúncio; publicar; pausar; criar/alterar campanha; mexer em
pedido; responder cliente; chamar QUALQUER endpoint de escrita. As camadas:
(1) toda ação de escrita do conector lança `ReadOnlyViolationError`;
(2) a capability matrix declara `*Write: false` nas 4 praças;
(3) o transporte não possui superfície de escrita (só `fetch`/`validate` —
testado). **Nunca comunicar que o Head "agiu sozinho dentro da praça".**

## /__dev — Integrações de Marketplace

`GET /__dev/central`: plataformas + status de integração, conexões por
empresa/conta/loja (credencial mascarada), capabilities, sync states com
watermark e **lag**, últimos logs, eventos (total + duplicados bloqueados),
fila, Clock ativo, `readOnly: true` e sinais entregues ao EPE.

`POST /__dev/central/sync-mock`: dispara sincronização usando SOMENTE
fixtures — recusa qualquer transporte que não seja `kind: 'fixture'`.

## Como adicionar um novo marketplace

1. Declaração em `declarations.js` (status + capabilities REAIS — nada inventado);
2. `connectors/<praça>.js`: mappers raw→canônico + factory;
3. fixtures realistas em `fixtures/`;
4. `providers.registerConnector(...)` — o núcleo não muda (testado);
5. quando houver credencial oficial: trocar o transporte de fixtures pelo
   HTTP oficial — pipeline, normalização, eventos e sinais não mudam.

## Como transformar conector estruturado em integração real

TikTok Shop e Magalu já têm contrato, normalizadores, fixtures e testes.
Para ligar de verdade: validar documentação oficial + credencial/parceria
→ mudar `integrationStatus` para `INTEGRATION_READY` → configurar o
transporte HTTP autenticado → `startConnect` passa a funcionar. Nenhuma
outra linha muda.

## Limitações conhecidas (honestas)

- Transporte real HTTP ainda não existe (propositalmente): entra na etapa
  de ativação, quando o usuário conectar a primeira loja real, com as URLs
  oficiais no deploy.
- Webhooks: contrato pronto (`stampEvent` + idempotência), recepção real
  vem com a ativação.
- Ads/campanhas de TikTok: fora da matriz até confirmação de parceria.
- Council/playbooks do MIE: sinais da Central entram no EPE com consenso
  neutro por enquanto. **O Sprint 10 continua sendo o Marketplace Rule,
  Catalog & Compliance Engine** (categoria correta, atributos obrigatórios,
  ficha técnica, códigos MLB e equivalentes, peso/dimensões, regras de
  imagem, frete, prazo, personalizados, estoque, fiscal, risco de bloqueio,
  validação pré-publicação) — a evolução do Conselho para sinais reais se
  integra a ele, sem substituí-lo.

## Arquivos

```
mos/src/central/
  index.js                ← composição (createCentral)
  declarations.js         ← capability matrix + status por praça
  connector-contract.js   ← contrato único (CapabilityError, READ_ONLY técnico)
  connectors/{mercado-livre,shopee,tiktok-shop,magalu}.js
  normalizers.js          ← entidade canônica única
  credentials.js          ← AES-256-GCM + máscara + refresh com lock
  connection-service.js   ← OAuth backend-only + connectMock (dev)
  sync-orchestrator.js    ← jobs, watermarks, upserts, eventos, sinais
  events.js               ← envelope + chave de idempotência
  signals.js              ← playbooks da Central
  central-bridge.js       ← sinais → grafo + EPE
  public-research.js      ← PUBLIC_RESEARCH (fonte separada)
  fixtures/index.js       ← 4 praças + FixtureTransport + MockAuthTransport
mos/src/infrastructure/db/schema-central.sql   ← 10 tabelas aditivas
mos/test/central.test.js  ← 21 testes
mos/demo-central.js       ← o cenário do sprint no Plano do Dia
```

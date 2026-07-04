# Relatório do Overnight — Marketplace Operating System

> Execução autônoma do `loop.md` (15 blocos). Branch `claude/ai-marketplace-head-ux-ic7i0c`.
> Todos os números abaixo foram extraídos do repositório, não estimados de memória.

## Resumo executivo

O overnight partiu do commit `2a3aaf9` (adição do `loop.md`) e concluiu **os 15 blocos**
do plano — do MIE expandido até a auditoria de CTO —, entregando a plataforma
**MOS** completa (backend, banco, APIs, providers, publicação, collector, WhatsApp,
experimentação e observabilidade), tudo simulado por interface e coberto por testes.
Estado final: **80 testes, 80 verdes, 0 falhas**; árvore limpa e sincronizada com o
remoto.

---

## 1. Tarefas do loop.md concluídas

**15 de 15 blocos** (23 de 23 checkboxes marcados `[x]`):

| Bloco | Entrega | Estado |
|---|---|---|
| 01 | Expansão do MIE: revisão de arquitetura, 7 novos cenários, 7 novos playbooks, Memory (padrões/sazonalidade/vencedores), Learning (calibração automática) | ✅ |
| 02 | Backend Foundation (DDD + EDA + Clean): EventBus, filas assíncronas, escala p/ milhares de anúncios | ✅ |
| 03 | Banco de dados: modelagem definitiva (23 tabelas), relacionamentos documentados | ✅ |
| 04 | APIs REST internas: controllers, services, DTOs, validators, OpenAPI, erros globais, logs | ✅ |
| 05 | Camada Operacional: Central de Produtos/Marketplaces/Anúncios com busca, filtros, paginação | ✅ |
| 06 | Central do Produto: resumo, versões, timeline, performance, experimentos, decisões, missões, aprendizados | ✅ |
| 07 | Fluxo de publicação simulado (criar→validar→preview→aprovar→publicar→versionar→histórico) | ✅ |
| 08 | Providers: contratos + adapters + mocks das 5 praças (ML, Shopee, Amazon, Magalu, TikTok) | ✅ |
| 09 | Marketplace Collector: crawler, parser, snapshots, comparador, cache, fila, cadências | ✅ |
| 10 | WhatsApp: Conversation Engine, parser, contexto, memória, fila de execução, notificações | ✅ |
| 11 | Experimentação: versionamento, comparações, rollback, aprendizado (MIF Parte 6 imposta por código) | ✅ |
| 12 | Observabilidade: painel interno `/__dev` (motores, especialistas, filas, eventos, logs, memória) | ✅ |
| 13 | Testes: sucesso, falha, stress, concorrência, escalabilidade, regressão | ✅ |
| 14 | Refatoração: duplicação, acoplamento, gargalos, legibilidade | ✅ |
| 15 | CTO Review: auditoria completa, ADRs, melhorias implementadas | ✅ |

## 2. Tarefas pendentes

**Nenhuma tarefa do `loop.md` ficou pendente** (0 checkboxes `[ ]`).

Itens registrados para decisão humana (não são pendências de execução — a Regra
Adicional do loop.md proíbe implementá-los por conta própria):
- `docs/ideas-for-review.md` contém **3 decisões de produto/UX** aguardando o dono
  (onde mora a "tela Operações"; navegação por abas como padrão; controles diretos
  na Central do Produto).

Ação não relacionada a tarefa que não completou: a **republicação do Artifact**
(protótipo v2 atualizado) falhou duas vezes com "Tool permission stream closed" —
é um problema de canal de permissão, não de código; o app navegável está íntegro
no repositório e reconstruível.

## 3. Commits realizados

**10 commits** no overnight (todos empurrados para o remoto):

```
3bf129b  Bloco 01: MIE expandido
e4c4446  Blocos 02+03: MOS Platform — backend foundation + banco
47cb2bf  Bloco 04: API REST interna
1bb6d8e  Blocos 05+06: Camada Operacional + Central do Produto
864487b  Blocos 07+08: Providers + publicação simulada
cc4a1cc  Bloco 09: Marketplace Collector
01ed4ab  Bloco 10: módulo WhatsApp
b06c7df  Bloco 11: sistema de experimentação
fb50549  Bloco 12: painel de observabilidade interno
038beaf  Blocos 13+14+15: stress, refatoração e CTO Review
```

## 4. Arquivos criados (33)

**Plataforma MOS — kernel (5):** `mos/src/kernel/event-bus.js`, `queue.js`,
`logger.js`, `errors.js`, `id.js`

**Infraestrutura/banco (3):** `mos/src/infrastructure/db/schema.sql`,
`database.js`, `repositories.js`

**Aplicação (3):** `mos/src/application/services.js`, `publication-service.js`,
`experiment-service.js`

**Interfaces HTTP (4):** `mos/src/interfaces/http/router.js`, `api.js`,
`observability.js`, `dev-panel.html`

**Módulos (3):** `mos/src/providers/index.js`, `mos/src/collector/index.js`,
`mos/src/whatsapp/index.js`

**Composição/demo/docs (3):** `mos/src/index.js`, `mos/demo.js`, `mos/README.md`

**Testes MOS (8):** `foundation`, `api`, `publication`, `collector`, `whatsapp`,
`experiment`, `observability`, `stress` (`.test.js`)

**MIE (2):** `mie/src/core/config.js`, `mie/test/scenarios-avancados.test.js`

**Docs (2):** `docs/cto-review.md`, `docs/ideas-for-review.md`

## 5. Arquivos alterados (20)

**MIE — motores e simulação (13):** `sim/world.js`, `engines/observation.js`,
`investigation.js`, `prioritization.js`, `execution.js`, `learning.js`, `memory.js`,
`scheduler.js`, `specialists/index.js`, `playbooks/index.js`, `core/audit-log.js`,
`core/event-bus.js`, `src/index.js`; painel `mie/debug/index.html`; testes
`mie/test/mie.test.js`

**Experiência (4):** `design/prototipo-v2/app.js`, `data.js`, `index.html`,
`styles.css` (Central de Produtos + Central do Produto)

**Documentos soberanos (2):** `ROADMAP.md` (camadas fundadas), `loop.md` (checkboxes)

## 6. Linhas adicionadas

**~4.694 inserções** contra ~149 remoções em 53 arquivos
(saldo líquido ≈ **+4.545 linhas**).

## 7. Testes

- **Total: 80 testes automatizados. 80 passaram. 0 falharam.**
- Distribuição: MIE 27 (17 conformidade + 10 cenários avançados); Plataforma 53
  (foundation 9, api 8, publication 7, whatsapp 7, collector 6, experiment 6,
  observability 5, stress 5).
- Todos os testes são nomeados pela regra da Constituição/MIF que protegem — o Teste
  de Conformidade (Art. 24) é **executável**.

## 8. Maior decisão arquitetural

**Simulação como interface, não como gambiarra (ADR-4).**

Cada fronteira com o mundo externo — `SimulatedCrawler` (Collector),
`SimulatedChannel` (WhatsApp), os 5 `Provider` mocks, e o mundo do MIE — implementa
**exatamente a mesma interface** que a integração real implementará. Consequência
estratégica: a plataforma inteira pode ir para produção **trocando classes, não
refatorando arquitetura**. Isso, combinado com a arquitetura em camadas do ROADMAP
(kernel → infra → aplicação → interfaces, comunicação só por eventos) e com a decisão
de **zero dependências externas** (`node:sqlite`, `node:http`, `node:test`), é o que
permitiu construir 6 camadas testáveis numa noite sem lock-in.

Decisão de segunda maior importância descoberta na própria auditoria: **restauração
de versão deduplicada** — a lógica vivia em 3 lugares e passou a viver só no
`CatalogService`, com publicação e experimentação delegando.

## 9. Estado atual do projeto

- **Camadas do ROADMAP:** todas as 6 fundadas.
  1 Constitucional ✅ · 2 Conhecimento ✅ · 3 Operacional ✅ · 4 Cognitiva ✅ (MIE) ·
  5 Execução ✅ (MOS, simulada por interface) · 6 Experiência ✅ (protótipo navegável).
- **Documentos soberanos:** `CONSTITUICAO.md`, `MIF.md`, `MOS.md`, `ROADMAP.md`
  intactos e vinculantes; implementação obedece à doutrina (verificado por teste).
- **Git:** árvore limpa, branch sincronizada com o remoto no commit `038beaf`.
- **Executável agora:** `node --test mie/test/ mos/test/` (80 verdes) ·
  `node mos/demo.js` sobe a plataforma inteira com dados vivos e painel `/__dev`.
- **Riscos conhecidos (documentados no CTO Review, não bloqueiam a fase):**
  ausência de auth (correto para dev interno); ponte MIE↔plataforma ainda é manual
  (demo/E2E); relógio real vs. ciclos a unificar com um Clock injetado.

## 10. Onde o loop parou exatamente

O loop **concluiu o `loop.md` inteiro** (Bloco 15 — CTO Review) e entrou em **modo
de vigilância** (ScheduleWakeup a cada ~30 min), sem tarefas restantes. Não parou no
meio de nenhum bloco: a última ação de trabalho foi o commit `038beaf`
(Blocos 13+14+15) empurrado com 80 testes verdes. As invocações seguintes apenas
confirmaram árvore limpa e re-armaram o heartbeat.

O único ponto que não fechou foi a **republicação do Artifact do protótipo v2**
(falha de canal de permissão, duas tentativas) — pendência de ferramenta, não de
código nem de tarefa do plano.


---

## Adendo pós-relatório — desenvolvimento continuado

Após o relatório, o desenvolvimento seguiu (fora do loop autônomo, sob direção do dono):

- **MieBridge** (recomendação nº 1 do CTO Review): ponte formal MIE↔plataforma que
  espelha investigações, decisões e incidentes nos repositórios persistentes sem
  tocar os motores. +6 testes.
- **Sprint 06 — Specialists Engine**: 7 especialistas com parecer rico (diagnóstico,
  evidências, hipóteses, confiança, recomendação, impacto, riscos, urgência), o
  Conselho (consenso/conflitos/divergências), votação com pesos dinâmicos (acurácia
  × evidências × confiança × afinidade) e memória de acertos que evolui com os
  resultados medidos. +10 testes. Documentado em `docs/specialists-engine.md`;
  demo em `mie/demo-specialists.js`.
  - Conflito constitucional registrado em `docs/ideas-for-review.md#004`: expor
    especialistas nomeados ao usuário exigiria emendar o Art. 11 (cláusula pétrea 5).

**Suíte total após a continuação: 96 testes, 96 verdes.**

- **Sprint 07 — Knowledge Graph**: o cérebro associativo do Head. Grafo tipado,
  ponderado e com decaimento por desuso, populado pelos eventos dos motores.
  17 tipos de nó e 12 relações (produto→categoria, concorrente→produto,
  avaliação→objeção, decisão→experimento, experimento→aprendizado,
  estratégia→categoria, criativo→CTR, preço→conversão, aprendizado→reuso).
  7 consultas internas ("o que já funcionou aqui?"). Integrado a Memory,
  Specialists, Investigation (etapa consultar_grafo — reuso antes de agir),
  Learning e MieBridge. É interno: o usuário nunca vê o grafo. +10 testes.
  Documentado em `docs/knowledge-graph.md`; demo em `mie/demo-graph.js`.

**Suíte total: 106 testes, 106 verdes.**

- **Sprint 08 — Executive Planning Engine (EPE)**: a camada que transforma
  inteligência em prioridade executiva — o Head vira diretor, não analista.
  Score executivo auditável (impacto × confiança × urgência ÷ esforço, com
  bônus de janela/recorrência/grafo/consenso e penalidade de irreversibilidade/
  recusa), 7 níveis (IGNORAR→INTERROMPER), silêncio inteligente, capacidade
  operacional do dia e o Plano do Dia (funil 317→2, atenção, decisões
  priorizadas, "o que decidi não te mostrar"). Integrado a Specialists,
  Graph, Memory, Prioritization, Learning e Observability. +15 testes.
  Doc em `docs/executive-planning-engine.md`; demo em `mie/demo-executive.js`;
  **HTML funcional em `design/prototipo-v3/index.html`** (abre no navegador,
  sem servidor — mostra o Plano do Dia com painel "Como o EPE priorizou").

- **Sprint 08.1 — Clock Injetado e Contexto Temporal Unificado** — *concluído*:
  o tempo vira parte explícita, injetável e testável do contexto de decisão.
  `mie/src/core/clock.js` é a fonte ÚNICA de tempo de parede (ISO/`America/Sao_Paulo`),
  com `createClock`/`frozenClock`/`systemClock` e helpers temporais puros
  (`NS.time`: diff, isExpired, isRecent, waitingMs, windowsOverlap). Coexiste com
  o "dia" simulado (`NS._currentDay`), que segue sendo a cadência interna dos
  motores. `createMIE({ clock })` injeta o relógio em todos os motores (default
  `systemClock`); `mie.clock` fica exposto. O **Plano do Dia** passa a carregar
  `generatedAt`/`generatedAtIso`/`timezone`/`dateKey`; o EPE **rebaixa para
  OBSERVAR** um item cuja janela de decisão expirou (sem mexer na fórmula do
  score). Memória e Knowledge Graph carimbam proveniência de mundo real
  (`observedAt`/`decidedAt`/`createdAtIso`/`lastAtIso`), de forma retrocompatível;
  contrato de evento futuro (`{ source, eventType, occurredAt, observedAt, payload,
  metadata }`) pronto, sem iniciar integração externa. `/__dev/mie` mostra o Clock
  ativo (fuso, hora, tipo, último plano gerado). +12 testes (inclui varredura que
  garante que nenhum arquivo em `mie/src` usa `Date` fora do Clock). Doc em
  `docs/clock-and-temporal-context.md`.

- **Sprint 09 — Central de Marketplace** — *concluído: "Central de
  Marketplace pronta para ativação real"*. A Central única
  (`mos/src/central/`) para Mercado Livre, Shopee, TikTok Shop e Magalu,
  com conectores **estruturados, validados por fixtures e preparados para
  ativação — integração real pendente de credencial e transporte oficial**
  (nenhuma loja real conectada ainda, por decisão de segurança). Construída
  sobre a base auditada (Fase 1: mapa REUTILIZAR/ADAPTAR/
  COMPLETAR/MIGRAR/CRIAR em `docs/sprint-09-auditoria-central-marketplace.md`).
  O que nasceu: contrato único de conector (capability matrix; capability
  inexistente = erro claro; **toda escrita bloqueada tecnicamente** —
  READ_ONLY é lei), conexão OAuth backend-only com **tokens AES-256-GCM**
  (máscara, refresh com lock single-flight, nada em logs/frontend/Git),
  10 tabelas aditivas (credenciais, sync_state, raw_payload, orders+items,
  inventory, prices, metrics, sync_log, integration_event, public_research),
  Sync Orchestrator na fila `sync` do kernel (watermarks, retry/backoff em
  rate limit, isolamento por empresa/conta/loja, falha de uma praça não
  derruba as demais), payload bruto preservado p/ auditoria + entidade
  canônica idêntica nas 4 praças, eventos com **chave de idempotência**
  (nada duplica — nem no Plano do Dia), 6 playbooks de sinais
  (estoque crítico do campeão, margem melhor em outro canal, campeão
  ausente no canal, potencial TikTok, capacidade de personalizados, pedido
  perto de atrasar) → Knowledge Graph → **EPE (que rejeita payload bruto
  tecnicamente)** → Plano do Dia com proveniência completa (plataforma →
  conta → entidade → evento → raw). Pesquisa pública separada POR
  CONSTRUÇÃO (PUBLIC_RESEARCH, sem token, sem scraping). `/__dev/central`
  mostra conexões, capabilities, watermarks, lag, eventos, Clock e sinais
  ao EPE; `sync-mock` só roda com fixtures. TikTok/Magalu: conector
  estruturado + fixtures + testes, conexão REAL bloqueada até validar
  credenciais oficiais (nada inventado). Demo: `node mos/demo-central.js`
  — o cenário do sprint vira INTERROMPER (estoque do campeão) + 2
  aprovações (margem/expansão) + 2 **EXECUÇÕES INTERNAS DO HEAD**
  (destacar pedido crítico e priorizar a fila interna — `executionScope:
  INTERNAL_ONLY`; nada é alterado no marketplace) + 1 investigação (vídeo
  TikTok). +22 testes. Doc em `docs/marketplace-central.md`.
  **Próximo sprint principal: Sprint 10 — Marketplace Rule, Catalog &
  Compliance Engine** (categoria, atributos, ficha técnica, imagem,
  peso/dimensões, frete, prazo, fiscal, personalizados, risco de bloqueio,
  validação pré-publicação); a evolução do Conselho para sinais reais se
  integra a ele, sem substituí-lo.

- **Sprint 09.A — Head Conversational Operating Intelligence** — *concluído*:
  o chat deixa de ser chatbot genérico e vira **Central Operacional
  Conversacional** (`mos/src/chat/`). Trava do sprint cumprida por
  construção: **zero respostas hardcoded, zero números inventados** — toda
  pergunta percorre Intent Router → Context Resolver → consulta TIPADA →
  Query Layer → fatos → Response Composer; a interpretação nunca produz
  número; sem dado disponível a resposta é honesta ("Não vou inventar um
  número"). 7 intenções (operacional, risco, explicação de decisão via
  EPE com breakdown/proveniência, ação → proposta READ_ONLY, simulação
  sempre "CENÁRIO ESTIMADO", estratégia, preferência→memória). Pergunta
  factual NUNCA vira missão/"anotei"; no máximo UM alerta, sempre DEPOIS
  da resposta. Contexto conversacional ("E na Shopee?", "E ontem?" →
  compara até o MESMO horário). Métricas com as diferenças que importam
  (bruto≠líquido≠liquidado; "quantos"=contagem; ROAS/ACOS/CPA com base
  declarada; conversão NUNCA sem denominador; estoque
  disponível≠reservado≠produção). Demo Operational Dataset coerente +
  `datasetFromCentral` com o MESMO contrato (testado: mesmas chaves de
  fatos nas duas fontes; isolamento por empresa A×B) — quando ML/Shopee
  conectarem, a mesma conversa responde com dado real. Briefing da manhã,
  radar, fechamento do dia e simulações. Rotas `POST /chat`,
  `/chat/briefing|radar|closing` e `/__dev/chat` (intenção, consulta
  estruturada, fonte, cobertura, falhas). Chips do protótipo v2
  atualizados. +24 testes (as 28 garantias). Demo: `node mos/demo-chat.js`.
  Doc em `docs/head-conversational-operating-intelligence.md`.

- **Sprint 09.A (correção final) — Chat na experiência principal v3 + área
  OPERAÇÃO** — *concluído*: o chat operacional saiu do protótipo v2 e virou
  **área principal do produto** no v3 (menu: Home · **Operação** · A Missão ·
  Silêncio · Conhecimento). Home mostra o que merece atenção e mantém só a
  entrada discreta "Pergunte ao Head"; Operação responde qualquer coisa
  agora (conversa + chips + atalhos por tema + briefing/radar/fechamento).
  ZERO reconstrução: a camada de chat virou UMD (padrão do MIE) — os MESMOS
  arquivos de `mos/src/chat` rodam em Node e no navegador; o glue do v3
  (`chat-operacao.js`) é só apresentação (varredura prova: nenhum número
  fixo, nenhuma resposta roteirizada; o chatbot hardcoded antigo foi
  REMOVIDO). Decisões consultam o MESMO plano exibido na Home (adapter
  data.js → shape do EPE) — o score do chat é o score do card; "ver no
  Plano do Dia →" opcional; contexto herdado sinalizado na UI; propostas
  com selo "MODO LEITURA"; nenhum botão simula execução real. Validação
  headless (Chromium): roteiro completo de conversa sem erros, desktop e
  largura reduzida; screenshots gerados. +10 testes.

- **Sprint 10 — Catalog, Rule & Compliance Engine** — *concluído. Foco
  inicial: Mercado Livre, Shopee, TikTok Shop e Magalu. Modo: validação e
  rascunho interno. Publicação externa continua bloqueada.*
  O Head passa a entender se um produto/anúncio está pronto, incompleto,
  arriscado, bloqueado ou apto a virar rascunho — POR marketplace, com
  fonte e versão de regra. Auditoria primeiro (product/listing/providers/
  chat REUTILIZADOS; 5 tabelas aditivas só para lacunas reais). Rule packs
  com proveniência completa (VERIFIED/PROVISIONAL/UNKNOWN — UNKNOWN trava
  READY; PROVISIONAL nunca gera aprovação definitiva; regra interna nunca
  finge ser bloqueio oficial; nada inventado, sem scraping). Categorization
  Engine (só devolve códigos existentes na taxonomia; baixa confiança →
  revisão humana), Requirement Resolver em camadas, 9 categorias de
  validação, readiness de 6 estados, checklist de revisão, Listing Draft
  interno versionado (nada publica — publication_history permanece vazio),
  Validation Runs append-only ("por que estava bloqueado dia 4?" tem
  resposta auditável). Chat ganhou CATALOG_COMPLIANCE_QUERY consultando o
  motor real com fonte/versão. Findings relevantes → sinais INTERNAL_ONLY
  no EPE (pendência pequena não vira missão). supportsExternalPublish=false
  nas 4 praças. **Protótipo v4** é a nova experiência principal: menu Home
  · Operação · Catálogo · A Missão · Silêncio · Conhecimento — a área
  Catálogo mostra visão geral, lista, painel por produto com abas por
  marketplace, checklist, evidências, rascunho e ações internas, tudo
  calculado AO VIVO pelo mesmo motor (UMD), com o banner permanente
  "MODO LEITURA · VALIDAÇÃO INTERNA · NADA FOI PUBLICADO NO MARKETPLACE".
  Validação headless verde (desktop + largura reduzida, zero erros).
  +23 testes (30 garantias). Demo: node mos/demo-compliance.js.
  Doc em docs/catalog-rule-compliance-engine.md.

- **Sprint 10.A — Conexões reais, WhatsApp, Mercado Livre e piloto** —
  *concluído. Pronto para ativação real hoje (checklist externa em
  docs/live-activation-checklist.md).* Área CONEXÕES vira parte principal
  do produto (v5: Home · Operação · Catálogo · Conexões · A Missão ·
  Silêncio · Conhecimento). WhatsApp Business SOMENTE pela via oficial:
  webhook de verificação + inbound com assinatura HMAC do corpo cru,
  deduplicação pelo id oficial, eventos normalizados por companyId;
  piloto de resposta (flag + allowlist de admin) responde pela MESMA
  Operational Query Layer — e comando de ação SEMPRE redireciona para
  Conexões (WhatsApp nunca executa). OAuth REAL do Mercado Livre: state
  de uso único com expiração, troca de code backend-only, tokens no vault
  cifrado do S09, identidade validada, sync inicial READ_ONLY pelo MESMO
  SyncOrchestrator (transporte HTTP no lugar do fixture). TRAVA dos
  PROVISIONAL: categoria/atributos confirmados na fonte OFICIAL pós-OAuth
  (snapshot com fonte/hora/versão) antes do Dry Run — mock rotulado nunca
  se passa por oficial. Creative Intelligence v1 (só ML): 8 tipos,
  Product Truth Pack imutável com hashes (INSUFFICIENT_PRODUCT_TRUTH
  quando faltam dados), provider por env + flag OFF (sem provider →
  briefing + fila pendente, nunca imagem fake), validação de fidelidade
  (divergência bloqueia aprovação) e revisão humana SEMPRE obrigatória.
  PILOTO (exceção única de escrita): DRY_RUN sem chamada externa →
  READY_FOR_PILOT → confirmação explícita (admin + flag por
  empresa/conta/usuário + OAuth real + conta confirmada + digitar
  "CRIAR ANÚNCIO PILOTO REAL") → 1 anúncio; idempotência
  draft+conta+hash (nunca 2); falha sem retry automático; jamais via
  Chat/WhatsApp; Shopee/TikTok/Magalu seguem sem escrita. 6 feature
  flags default false; 8 tabelas aditivas; rotas de webhook/OAuth/board/
  piloto; +18 testes (30 garantias). Demo: node mos/demo-live.js. Docs:
  live-connections-and-pilot.md, product-fidelity-protocol.md,
  live-activation-checklist.md.

**Suíte total: 230 testes, 230 verdes.** (212 + 18 do live)

### Sprint 10.B — Crescimento: WhatsApp controle remoto, leads, afiliados, promoções

  UM motor, nunca automação paralela: comando do WhatsApp passa pelo
  GrowthCommandGateway → MESMO AdaptationEngine da tela → job interno
  auditável (origem WHATSAPP_COMMAND, confirmação obrigatória em massa)
  → drafts do CatalogService (S10) → resultado no WhatsApp e no
  Catálogo. Nova área CRESCIMENTO (v6): Visão Geral · Leads e
  Oportunidades · Afiliados · Promoções e Campanhas · Resultados ·
  Pendências Comerciais. Estruturais: papéis + Approval Flow;
  proveniência por campo (sync nunca apaga edição manual — conflito
  com revisão); margem por praça (sem margem → revisão); atribuição
  com dedup (1 venda = 1 afiliado; clique nunca vira comissão; comissão
  ESTIMADA, pagar = fluxo futuro); jobs com contadores/pausa/cancel/
  rollback interno; privacidade (mascaramento por papel, acesso
  auditado, isolamento). 31 tabelas aditivas; +21 testes. Docs:
  growth-commercial-engine.md. Protótipo v6 = experiência principal.

**Suíte total: 251 testes, 251 verdes.** (230 + 21 do growth)

### Sprint 10.B (complementos) — anúncio nasce na conversa + Data Completion

  Operação vira porta de entrada: texto/foto/link → identifica produto
  (nunca duplica Master) → existente = drafts por praça via o MESMO
  Adaptation Engine; novo = PRODUCT_INTAKE com perguntas objetivas —
  nunca vira Master sem dados mínimos + revisão. Foto registra
  origem/autor/hash; referência nunca vira oficial; link é Source
  Reference com content_copied=0 sempre. Data Completion Engine:
  pendência → DataRequest (produto+draft+praça, criticidade, roteada ao
  papel certo) → pergunta agrupada no WhatsApp → resposta natural
  ("peso 14,2 kg | material vidro 4 mm") normalizada → atualiza só o
  campo certo (fonte WHATSAPP_COMMAND, proveniência, valor anterior) →
  revalida drafts (nova versão) → retorno honesto. Ambíguo → confirmação;
  já preenchido → não pergunta; empresas isoladas; WhatsApp jamais
  publica. +4 tabelas; +17 testes; v6 com "Criar anúncio" na Operação e
  card de Pendências no Catálogo. Docs:
  conversational-intake-and-data-completion.md.

**Suíte total: 268 testes, 268 verdes.** (251 + 17 do intake)

### Sprint 10.C — Head Intelligence OS (evolução do RID)

  O RID (cadeia única do chat) virou diretor estratégico SEM nada
  paralelo: radar pontuado (sinal pequeno fica em silêncio) → diagnóstico
  com FATO ≠ HIPÓTESE e causalidade só com evidência → memória cruzada
  (tabela memory ÚNICA + política: categoria, fonte, confiança, validade;
  expirada/superada sai do contexto) → conflito com direção do dono abre
  StrategicDialogue (decisão anterior + evidência nova + alternativas +
  recomendação técnica; executa SÓ o aprovado; cada resposta vira memória)
  → IntelligenceActionPlan com microtarefas → missão (repo S02) →
  intervenção monitorada (linha de base, NOT_ENOUGH_DATA honesto) →
  aprendizado reutilizável que influencia recomendações futuras →
  relatórios diário/semanal com dedup anti-spam e fontes declaradas.
  WhatsApp: relatório, intervenção e resposta de diálogo no gateway do
  10.B; escrita externa continua impossível. Perfil de liderança ajusta a
  VOZ, nunca a análise. 7 tabelas aditivas; +16 testes; 7 docs; v7 =
  experiência principal (cenários espelho/direção/relatórios).

**Suíte total: 284 testes, 284 verdes.** (268 + 16 do RID)
---

*Relatório gerado sob solicitação do dono. Loop pausado; retomada do desenvolvimento a seguir.*

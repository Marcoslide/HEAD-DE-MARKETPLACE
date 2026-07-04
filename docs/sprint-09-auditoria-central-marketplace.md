# Sprint 09 — Auditoria: o que já existe antes da Central de Marketplace

> **Fase 1 do Sprint 09.** Nenhuma linha de arquitetura foi alterada neste passo.
> Este documento é o mapa do que existe hoje em Mercado Livre, Shopee, TikTok Shop
> e Magalu — código, banco, rotas, jobs, serviços, testes e docs — com a
> classificação **REUTILIZAR / ADAPTAR / COMPLETAR / MIGRAR / CRIAR** de cada item.
> A Central de Marketplace será construída **sobre** esta base, sem duplicar
> tabelas, filas, serviços ou autenticação.

## Sumário executivo

O que existe hoje é **inteiro simulado e voltado à ESCRITA (publicação)**:
um Provider Registry com adapters das 5 praças (regras reais de validação),
uma tabela de conexão sem credenciais, um Collector simulado de páginas
públicas e um pipeline completo de publicação com aprovação e versionamento.

O que **não existe em lugar nenhum** (varredura confirmada): OAuth, tokens,
refresh, pedidos, estoque, preços lidos da praça, watermarks, estado de
sincronização, payload bruto preservado, isolamento por conta/loja. A LEITURA
autenticada — o coração do Sprint 09 — é toda **CRIAR**, mas encaixa em
contratos, filas, eventos e tabelas que já existem e serão reaproveitados.

---

## 1. O que JÁ EXISTE, item por item

### 1.1 Provider Registry — `mos/src/providers/index.js` → **REUTILIZAR + ADAPTAR**

O achado mais importante da auditoria. Já existe um **registry único** com
contrato `MarketplaceProvider` e **5 adapters**: `mercado_livre`, `shopee`,
`amazon`, `magalu`, `tiktok` — exatamente o padrão que a Central precisa.

- **REUTILIZAR**: o padrão registry (`createProviderRegistry().get(name)`),
  as `capabilities()` por praça e as **regras reais de validação** já
  codificadas (ML: título ≤ 60, sem frete no título, 3+ imagens; Shopee:
  preço mínimo R$ 5, 3+ imagens; Magalu: EAN obrigatório; TikTok: vídeo
  recomendado; Amazon: brand obrigatório).
- **ADAPTAR**: o contrato cobre só o lado de **escrita** (publish/update/
  pause/resume, simulados). O contrato único de conector da Central estende
  este mesmo registry com o lado de **leitura**: `fetchListings`,
  `fetchOrders`, `fetchStock`, `fetchPrices` + `capabilities()` declarando o
  que cada praça suporta. **Um registry só** — não nasce um segundo sistema.

### 1.2 Banco — `mos/src/infrastructure/db/schema.sql`

| Tabela | Estado | Classificação |
|---|---|---|
| `marketplace_connection` | existe, com enum das 5 praças e status `simulated/connected/error/revoked`; `settings_json` com regra explícita "nunca credenciais" | **COMPLETAR** — falta conta/loja (isolamento empresa+conta+loja) e vínculo com credencial criptografada em tabela própria |
| `listing` | existe, **já tem `external_id`** reservado para o id na praça | **REUTILIZAR** — a Central normaliza anúncios para cá; nada de tabela paralela |
| `listing_version`, `publication_history` | pipeline de versão/histórico completo | **REUTILIZAR** (intocado neste sprint — READ_ONLY) |
| `product`, `company`, `workspace`, `user` | identidade e catálogo | **REUTILIZAR** |
| `competitor`, `competitor_snapshot` | snapshots históricos por dia | **REUTILIZAR** como destino normalizado de pesquisa de mercado |
| `review`, `question`, `keyword`, `keyword_trend` | mundo externo observado | **REUTILIZAR** como destino normalizado |
| `audit_log` | caixa-preta append-only | **REUTILIZAR** — auditoria da Central grava aqui |
| tokens/credenciais | **não existe** | **CRIAR** — tabela própria, cifrada, só backend, fora de logs |
| pedidos (`order`, `order_item`) | **não existe** | **CRIAR** |
| estoque por anúncio/loja | **não existe** | **CRIAR** |
| `sync_state` / watermarks | **não existe** | **CRIAR** |
| payload bruto (`raw_payload`) | **não existe** | **CRIAR** — dado cru preservado para auditoria |

### 1.3 Collector — `mos/src/collector/index.js` → **REUTILIZAR o padrão + ADAPTAR o papel**

Arquitetura já pronta e testada: **interface → cache TTL single-flight →
parser → snapshot persistido → comparador → eventos de mudança**, rodando
na fila `collector` com cadências.

- **REUTILIZAR**: este é exatamente o esqueleto do **Sync Orchestrator** de
  leitura (busca → normaliza → snapshot → compara → evento). O comparador
  (`compareSnapshots`) e o padrão de eventos (`collector.change_detected`)
  seguem valendo.
- **ADAPTAR**: o `SimulatedCrawler` é orientado a "página pública"; a Central
  lê **API oficial autenticada da própria loja**. A pesquisa pública de
  mercado continua **simples** (busca na internet com evidência rastreável)
  — **sem** crawler complexo, scraping ou automação de navegador agora.

### 1.4 Filas e jobs — `mos/src/kernel/queue.js` + `mos/src/index.js` → **REUTILIZAR + COMPLETAR**

Kernel de fila maduro: concorrência, retry com backoff, dead-letter,
contadores. Filas ativas: `collector`, `publication`, `analysis`,
`notifications`.

- **REUTILIZAR**: o kernel inteiro.
- **COMPLETAR**: nasce a fila `sync` (jobs de sincronização por conexão/
  recurso) e o estado persistido de watermark — hoje nenhum job guarda
  "até onde eu li". Idempotência de jobs vem do dedupe por
  (conexão, recurso, watermark), não de um sistema novo.

### 1.5 Publicação — `mos/src/application/publication-service.js` → **REUTILIZAR (intocado)**

Pipeline completo: preparar → adaptar → validar → preview → **aprovação do
dono** → publicar (simulado) → versionar → monitorar → rollback. É o lado de
ESCRITA — **fora do escopo do Sprint 09** (READ_ONLY tecnicamente bloqueado;
nenhuma ação de escrita). Fica como está; o bloqueio READ_ONLY da Central
deve impedir que qualquer conector novo exponha escrita nesta fase.

### 1.6 Rotas HTTP — `mos/src/interfaces/http/api.js` → **REUTILIZAR + CRIAR**

Existem: bootstrap (cria conexões `simulated`), importação de anúncios,
catálogo, decisões, missões, memória, auditoria, OpenAPI.
**Não existem**: rotas de conexão OAuth (início/callback/status), rotas de
sincronização, rotas da Central.

- **REUTILIZAR**: router + validação + OpenAPI.
- **CRIAR**: `POST /connections/:id/connect` (fluxo OAuth backend),
  status de conexão, disparo/consulta de sync.

### 1.7 Observabilidade — `/__dev` → **COMPLETAR**

Painel e rotas existem (Bloco 12 + Clock no S08.1). **COMPLETAR** com a visão
da Central: conexões e seus status, jobs de sync, watermarks, últimos
snapshots, erros por conector.

### 1.8 MieBridge — `mos/src/application/mie-bridge.js` → **REUTILIZAR o padrão**

A ponte MIE↔MOS já resolve o problema que a Central terá: espelhar eventos
com **idempotência** (dedupe por id) sem os motores saberem da plataforma.
Os dados normalizados da Central alimentam grafo, playbooks, Conselho e EPE
**por eventos no bus** — mesmo padrão, nenhum acoplamento novo.

### 1.9 Clock (Sprint 08.1) → **REUTILIZAR + MIGRAR (gradual)**

O Clock injetável está pronto no MIE (`mie/src/core/clock.js`) e é requisito
da cadeia da Central (`occurredAt`/`observedAt` nos eventos, watermarks,
snapshots). O MOS legado ainda usa `Date` direto em 12 arquivos (kernel,
collector, serviços).

- **REUTILIZAR**: todo módulo novo da Central nasce com Clock injetado.
- **MIGRAR**: kernel/serviços legados do MOS migram gradualmente para o
  Clock — sem bloquear o sprint (não são caminho crítico da leitura).

### 1.10 MIE (mundo simulado) → **REUTILIZAR (nada muda)**

Os produtos simulados já carregam a praça (`mkt: 'Mercado Livre' | 'Shopee'`).
A simulação continua sendo a interface (ADR-4): quando a Central entregar
dados reais normalizados, eles entram pelos mesmos eventos que o mundo
simulado usa hoje.

### 1.11 Testes → **REUTILIZAR o padrão + CRIAR os da Central**

Cobertura existente: providers por praça (validações específicas),
pipeline de publicação, collector (cache/comparador/fila), APIs, stress.
**Zero** testes de OAuth/token/sync (porque nada disso existe).
A Central nasce com fixtures por praça e testes de: contrato do conector,
normalizadores, watermarks/idempotência, READ_ONLY bloqueado, isolamento
por empresa/conta/loja, tokens fora de logs.

### 1.12 Telas e docs

- `design/prototipo-v2` mostra praças nos anúncios (labels ML/Shopee) —
  **REUTILIZAR** como referência de experiência; nenhuma tela de conexão
  existe (**CRIAR** depois, fora deste sprint se não for trivial).
- Docs: não existe doc da Central — **CRIAR** (`docs/central-marketplace.md`)
  na fase de implementação.

---

## 2. O mapa consolidado

| # | Item | Onde | Classificação |
|---|---|---|---|
| 1 | Registry + contrato de provider | `mos/src/providers/index.js` | **REUTILIZAR** (padrão) + **ADAPTAR** (adicionar lado de leitura ao MESMO contrato) |
| 2 | Regras de validação por praça (ML/Shopee/Magalu/TikTok/Amazon) | idem | **REUTILIZAR** |
| 3 | `marketplace_connection` | `schema.sql` | **COMPLETAR** (conta/loja + vínculo com credencial) |
| 4 | `listing.external_id` + catálogo + versões | `schema.sql` | **REUTILIZAR** |
| 5 | Snapshots/reviews/questions/keywords | `schema.sql` | **REUTILIZAR** (destino normalizado) |
| 6 | Kernel de filas (retry/backoff/dead-letter) | `kernel/queue.js` | **REUTILIZAR** + **COMPLETAR** (fila `sync`) |
| 7 | Collector (interface→cache→parse→compare→evento) | `collector/index.js` | **REUTILIZAR** o esqueleto + **ADAPTAR** p/ leitura autenticada |
| 8 | Pipeline de publicação (escrita) | `publication-service.js` | **REUTILIZAR** intocado (READ_ONLY neste sprint) |
| 9 | Router/OpenAPI/rotas | `interfaces/http/` | **REUTILIZAR** + **CRIAR** rotas de conexão/sync |
| 10 | `/__dev` observabilidade | `observability.js` | **COMPLETAR** (visão da Central) |
| 11 | MieBridge (espelhamento idempotente por eventos) | `mie-bridge.js` | **REUTILIZAR** o padrão |
| 12 | Clock injetado | `mie/src/core/clock.js` | **REUTILIZAR** na Central + **MIGRAR** MOS legado gradualmente |
| 13 | OAuth + conexão autenticada por loja | — | **CRIAR** |
| 14 | Tokens cifrados (backend-only, fora de logs) + refresh | — | **CRIAR** |
| 15 | Leitura de anúncios/pedidos/estoque/preços | — | **CRIAR** (contrato único, 4 praças) |
| 16 | Tabelas: orders, stock, credenciais, sync_state, raw_payload | — | **CRIAR** |
| 17 | Sync Orchestrator (jobs + watermarks + idempotência) | — | **CRIAR** (sobre filas existentes) |
| 18 | Normalizadores raw→canônico por praça | — | **CRIAR** |
| 19 | Bloqueio técnico READ_ONLY | — | **CRIAR** |
| 20 | Fixtures ML/Shopee/TikTok/Magalu + testes da Central | — | **CRIAR** (no padrão de testes existente) |

## 3. Decisões que a auditoria fecha

1. **Um registry só.** O `createProviderRegistry` existente vira o Registry da
   Central — o contrato ganha o lado de leitura; nada de "sistema Shopee" ou
   "sistema ML" separados.
2. **Nenhuma tabela duplicada.** Anúncios normalizam para `listing`
   (`external_id` já previsto); snapshots para as tabelas de mundo externo;
   só nascem tabelas para o que não existe (pedidos, estoque, credenciais,
   sync_state, raw_payload).
3. **Credencial nunca em `settings_json`.** A regra já escrita no schema
   ("nunca credenciais") permanece: tokens vivem em tabela própria, cifrados,
   só backend, fora de qualquer log.
4. **O Collector não vira scraper.** O esqueleto (cache→parse→compare→evento)
   é reaproveitado para a leitura oficial autenticada; pesquisa pública de
   mercado fica simples e rastreável, sem browser automation.
5. **TikTok Shop e Magalu**: entram no Registry com contrato + fixtures +
   capabilities declaradas, **sem integração real** até validar documentação
   oficial, credencial e parceria — nenhum endpoint inventado.
6. **READ_ONLY é lei técnica do sprint**: o lado de escrita continua simulado
   e o conector de leitura não expõe métodos de escrita.

## 4. Ordem de implementação proposta (Fase 2, após validação deste mapa)

1. Migrations aditivas: credenciais cifradas, conta/loja em
   `marketplace_connection`, `sync_state`, `raw_payload`, orders, stock.
2. Contrato único de conector (leitura) no Registry existente + READ_ONLY
   tecnicamente bloqueado + Clock injetado.
3. Normalizadores + fixtures (ML e Shopee primeiro; TikTok/Magalu só contrato
   + fixtures + capabilities).
4. Sync Orchestrator sobre a fila (`sync`) com watermarks e idempotência.
5. Eventos → grafo/playbooks/Conselho/EPE (padrão MieBridge).
6. Rotas de conexão/sync + `/__dev` da Central.
7. Testes de conformidade (tokens fora de logs, isolamento, READ_ONLY).

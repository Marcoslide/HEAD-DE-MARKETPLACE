# MOS Platform — Backend Foundation

> Camadas de Execução e Operacional em código: DDD + Clean Architecture + Event-Driven.
> Zero dependências externas: `node:sqlite` como banco, kernel próprio de eventos/filas/logs.
> **Regra do Sprint**: nenhuma API externa, nenhuma credencial, tudo simulado — mas toda
> interface pronta para a integração real sem refatoração.

## Como rodar

```bash
node --test mos/test/            # suíte da plataforma
```

```js
const { createMOS } = require('./mos/src/index.js');
const mos = createMOS();                      // banco em memória
// createMOS({ dbFile: 'mos.db' })            // banco em arquivo
```

## Arquitetura (Bloco 02)

```
┌──────────────────────────────────────────────────────────────┐
│ interfaces/    HTTP REST (Bloco 04)                          │  depende ↓
├──────────────────────────────────────────────────────────────┤
│ application/   use cases (services.js) — regras de aplicação │  depende ↓
├──────────────────────────────────────────────────────────────┤
│ domain/        entidades e eventos (schema como contrato)    │
├──────────────────────────────────────────────────────────────┤
│ infrastructure/ db (node:sqlite), repositórios               │  implementa ↑
├──────────────────────────────────────────────────────────────┤
│ kernel/        EventBus · Queue · Logger · Errors · Id       │  usado por todos
└──────────────────────────────────────────────────────────────┘
```

Princípios aplicados:

- **Event-Driven**: módulos publicam fatos no `EventBus` (curingas, middleware, histórico limitado); ninguém chama ninguém diretamente entre módulos.
- **Filas para trabalho pesado**: `Queue` com concorrência, retry exponencial e dead-letter — mesma interface que uma fila real (SQS/BullMQ) terá; consumidores não mudam quando a implementação trocar.
- **Clean**: `application/` não importa nada de `infrastructure/` — recebe `{repos, bus, logger}` por injeção.
- **Escala**: importação em massa em transação única (teste: 5.000 anúncios), paginação **keyset** (O(página), nunca OFFSET), índices nas rotas de consulta quentes, ring buffers em logs/histórico de eventos.
- **Auditoria**: toda mutação relevante gera linha em `audit_log` (append-only) — a caixa-preta da plataforma.

## Modelo de dados (Bloco 03) — 23 entidades

```
workspace ─1:N─ user
    │
    └─1:N─ company ─1:N─ marketplace_connection
              │                    │
              ├─1:N─ product ─1:N─ listing (N:1 connection)
              │        │             ├─1:N─ listing_version  (versões: sempre reversível)
              │        │             ├─1:N─ review
              │        │             ├─1:N─ question
              │        │             ├─1:N─ publication_history (N:1 version)
              │        │             └─1:N─ experiment (baseline/variant → listing_version)
              │        └─1:N─ competitor ─1:N─ competitor_snapshot
              │
              ├─1:N─ investigation ─0..1→ decision   (diagnóstico vira decisão)
              ├─1:N─ decision ─0..1→ mission          (aprovação vira missão)
              │        └────0..1→ execution_plan      (com prediction_json ANTES — Art. 15)
              ├─1:N─ mission
              ├─1:N─ opportunity                      (radares do MIF Parte 4)
              ├─1:N─ keyword ─1:N─ keyword_trend
              ├─1:N─ memory                           (biblioteca viva, UNIQUE(company,key),
              │                                        strength 1-3, MIF 8.1)
              └─1:N─ learning (N:1 execution_plan)    (previsto vs. medido + autópsia)

audit_log — append-only, referencia (entity, entity_id) de qualquer tabela
```

Relacionamentos e regras de integridade:

| Relação | Cardinalidade | ON DELETE | Regra de negócio |
|---|---|---|---|
| workspace → user, company | 1:N | CASCADE | espaço apaga tudo que contém |
| company → product, decision, mission, investigation, opportunity, keyword, memory, learning | 1:N | CASCADE | a empresa é a raiz do agregado operacional |
| product → listing, competitor | 1:N | CASCADE | anúncio não existe sem produto |
| marketplace_connection → listing | 1:N | CASCADE | anúncio pertence a uma praça |
| listing → listing_version | 1:N | CASCADE | `UNIQUE(listing_id, number)`; `active_version_id` aponta a vigente |
| listing → review, question, publication_history, experiment | 1:N | CASCADE | histórico morre com o anúncio |
| investigation → decision | 1:0..1 | SET NULL | diagnóstico pode virar decisão |
| decision → mission, execution_plan | 1:0..1 | SET NULL | aprovação instancia execução |
| competitor → competitor_snapshot | 1:N | CASCADE | série temporal do inimigo |
| keyword → keyword_trend | 1:N | CASCADE | `UNIQUE(keyword_id, day)` |
| memory | — | — | `UNIQUE(company_id, key)`: upsert sobe/rebaixa `strength` (MIF 8.2) |

Decisões de modelagem que espelham a Constituição:

- `decision` guarda o **pacote completo** (descoberta, causa, proposta, impacto min/máx, confiança, reversibilidade, classe A/B/C) — uma decisão sem esses campos é inválida por schema.
- `execution_plan.prediction_json` existe porque **nenhuma execução acontece sem previsão registrada antes** (Art. 15).
- `decision.refusal_motive` + `memory(kind='preference')` implementam **"recusas ensinam"** (Art. 18).
- `experiment.variable` é singular por definição: **uma variável por vez** (MIF 6.1); `success_criteria_json` é NOT NULL porque o critério vem **antes** (MIF 6.2).
- `publication_history.simulated` default 1 — nesta fase, toda publicação é simulada por schema.

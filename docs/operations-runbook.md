# Head Marketplace OS — Operações, Segurança e Runbook (Sprint 10.D)

## Como subir STAGING (instrução objetiva)

```bash
# 1. secrets fora do código (cofre do provedor / GitHub Environments)
export HEAD_ENV=STAGING
export HEAD_SECRET_STAGING=<gerado no cofre — nunca commitar>

# 2. migrations (idempotentes; rodam em staging ANTES de produção)
npm run db:migrate && npm run db:status

# 3. serviços
npm run api      # ou: docker compose -f infrastructure/docker/docker-compose.yml up api
npm run worker   # ou container worker

# 4. smoke test (jornada crítica completa)
npm run smoke

# 5. health
curl -s localhost:3080/health
```

Local: `docker compose -f infrastructure/docker/docker-compose.yml up` sobe
api + worker + web com volume próprio. Cada ambiente (LOCAL/STAGING/PRODUCTION)
tem **database, storage, logs, backups e secrets próprios** sob
`$HEAD_DATA_DIR/<env>/` — staging fisicamente incapaz de tocar produção.

## Arquitetura de persistência (e o caminho para PostgreSQL)

Toda a fundação fala com o banco por um único adapter (`mos/src/production/core.js
→ openDb`). Hoje o driver é o banco embarcado do Node (node:sqlite, WAL) — real,
persistente e transacional, dimensionado para o piloto. Para PostgreSQL gerenciado,
define-se `DATABASE_URL` e troca-se o driver dentro de `openDb`/`prepare` — os
módulos acima (auth, storage, fila, imports, backup) não mudam, porque só usam
`prepare/run/get/all`. Redis entra da mesma forma como driver alternativo da fila
(`createQueue` é a interface); a fila atual é durável no banco e sobrevive a
restart, o que o piloto exige.

## Segurança

- Senha: scrypt (N=16384) + salt por usuário; **nunca em texto puro** (teste 02).
- Sessões: token aleatório, hash no banco, expiração 24h, refresh, revogação em
  logout/reset/bloqueio. Cookie `HttpOnly; SameSite=Strict; Secure` fora de LOCAL.
- Rate limit persistido (login 8/15min, reset 5/h) — sobrevive a restart.
- Enforcement no backend: toda rota valida usuário→grupo→empresa→loja→papel→
  permissão (`assertScope`); negação é auditada. Botão desabilitado nunca é a
  única barreira.
- Escrita externa: `assertNoExternalWrite` bloqueia e audita qualquer tentativa
  (publicar/preço/estoque/Ads/OAuth de escrita) — também no servidor.
- Upload: whitelist de extensão+MIME, 25MB, rejeição de executável (magic MZ),
  conteúdo endereçado por sha256 (nunca sobrescreve), servido só por URL
  assinada com expiração.
- Logs estruturados (JSONL) com mascaramento de senha/token/authorization/cookie.
- Secrets por ambiente via `HEAD_SECRET_<ENV>` — obrigatórios fora de LOCAL,
  ausentes do código e dos exemplos de env.
- CNPJ armazenado mascarado (`cnpj_mascarado`); dados pessoais de comprador não
  são importados por padrão (contrato do 10.I).

## Backup e restore

- `npm run backup` → checkpoint WAL + cópia do banco + manifest com sha256 +
  registro em `backups` e `system_state.last_backup` (visível no /health).
- **Restore é testado, não só criado**: `backup.restore(id, alvo)` valida o hash,
  abre o banco restaurado e relê dados reais (teste 25). Restore nunca
  sobrescreve produção às cegas — sempre para um caminho alvo explícito.
- Retenção configurável via `HEAD_BACKUP_RETENTION`.

## Rollback de importação (persistente)

Cada aplicação grava em `apply_log`: valor anterior, valor novo, lote, ordem,
autor e timestamp. Rollback do lote A **nunca** apaga alteração posterior do
lote B (teste 22); tudo auditado. A tela administrativa de lotes (Importar ·
Lotes e jobs) mostra arquivo, escopo, período, contagens e exige confirmação.

## Runbook de incidentes

| Sintoma | Diagnóstico | Ação |
|---|---|---|
| API fora | `curl /health` falha | ver logs `$DATA/<env>/logs/app.jsonl`; restart do container; health libera deploy |
| Worker parado | `/health.worker` ≠ ok (heartbeat > 3min) | restart do worker; jobs RUNNING órfãos são re-reivindicados automaticamente (claim de stale) |
| Fila travada | `/health.queue.profundidade` alta | inspecionar `jobs` FAILED (`error_code`); erro permanente não re-tenta — corrigir causa e reenfileirar |
| Import falhou | job FAILED com `error_message` | nada parcial foi aplicado (teste 21); corrigir arquivo e reenviar (dedup impede duplicação) |
| Migration falhou | `npm run db:status` | migrations validam a si mesmas; `npm run db:rollback` reverte a última quando reversível |
| Suspeita de duplicação | `apply_log` + `source_fingerprints` | reimport idêntico é bloqueado; linhas idênticas viram "duplicados evitados" |
| Acesso indevido | `audit_events` action=acesso_negado | trilha tem usuário, escopo e motivo; bloquear conta via `lockAccount` |
| Restaurar backup | manifest em `$DATA/<env>/backups/<id>/` | `backup.restore(id, alvo)` em ambiente de teste; validar; então promover |

## Pipeline

`lint → testes (suíte completa) → migrations verificadas → build imagens →
deploy staging → smoke (jornada signup→login→escopo→upload→fila→apply) →
aprovação manual (GitHub environment) → deploy production`. Domínios entram por
`HEAD_BASE_URL_<ENV>` — trocar domínio não toca código.

## Limpeza definitiva de Leads/CRM (10.D)

`LEADS_QUERY`, `leadsView`, `leadOrigin`, fixtures e o roteamento de lead foram
removidos do interpretador, do chat e do dataset demo. "lead" no chat agora
responde: *"Em marketplace, não trabalhamos com pipeline de leads. Aqui
acompanhamos tráfego, pedidos criados, pedidos não pagos, pagamentos aprovados,
vendas, margem e operação."* Os testes de contrato do 10.B foram atualizados
para o novo contrato (não preservados artificialmente). O funil canônico é:
Impressão → Clique → Visita → Carrinho → Pedido Criado → Pedido Não Pago →
Pedido Pago → Preparação → Envio → Entrega → Avaliação → Recompra.

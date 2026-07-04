# Conexões Reais e Piloto de Anúncio — o sistema toca o mundo

> Sprint 10.A. A área **Conexões** vira parte principal do produto (menu:
> Home · Operação · Catálogo · **Conexões** · A Missão · Silêncio ·
> Conhecimento). WhatsApp oficial, OAuth real do Mercado Livre, leitura
> real em READ_ONLY e **um** anúncio piloto sob confirmação forte.

## Como rodar

```bash
node --test mos/test/live.test.js   # 18 testes (as 30 garantias)
node mos/demo-live.js               # o caminho inteiro com mocks rotulados
design/prototipo-v5/index.html      # a experiência principal (demo declarada)
```

## Mapa de reuso (auditoria executada)

REUTILIZADOS sem duplicação: vault cifrado AES-256-GCM (S09) para TODOS os
tokens; `marketplace_connection`; **SyncOrchestrator** (leitura real = mesmo
pipeline, só troca o transporte fixture→HTTP); eventos idempotentes;
CatalogService/drafts/compliance (S10); Head Chat Query Layer (09.A) para as
respostas do WhatsApp; audit_log; Clock. CRIADOS (8 tabelas aditivas):
oauth_state, feature_flag, whatsapp_connection/event, category_snapshot,
product_truth_pack, creative_asset, pilot_run. COMPLETADO: router ganhou
`rawBody`/`headers` (assinatura de webhook).

## Feature flags (por empresa/conta/usuário — TUDO nasce desligado)

```
WHATSAPP_INBOUND_ENABLED · WHATSAPP_HEAD_PILOT_REPLY_ENABLED
MERCADO_LIVRE_OAUTH_ENABLED · MERCADO_LIVRE_LIVE_READ_ENABLED
MERCADO_LIVRE_PILOT_CREATE_LISTING_ENABLED · CREATIVE_IMAGE_GENERATION_ENABLED
```
Nenhuma flag libera escrita geral.

## WhatsApp Business (somente a via oficial)

Webhook de verificação (GET hub.challenge + verify token) → webhook de
mensagens (POST) com **assinatura HMAC-SHA256** do corpo cru →
**deduplicação** pelo id oficial → evento normalizado com companyId →
visualização em Conexões. Piloto de resposta: flag + **allowlist** de
administrador + resposta vinda da **mesma Operational Query Layer** (fonte,
cobertura e hora inclusos; fixtures dizem "Dados demonstrativos"). Comando
de ação recebe SEMPRE: *"Preparei uma proposta de rascunho. A criação real
exige revisão e confirmação na área Conexões."* — WhatsApp nunca executa.
Proibido por construção: WhatsApp Web, QR não oficial, automação de
navegador, scraping.

## OAuth real do Mercado Livre

start → **state** de uso único com expiração (10 min) → autorização
oficial → callback valida state/empresa/usuário → troca de code no backend
→ tokens **cifrados no vault** → conexão vinculada a empresa+conta(seller
id)+loja+usuário → identidade validada (/users/me) → sync inicial
READ_ONLY. Garantias testadas: state reutilizado/expirado/desconhecido é
bloqueado; refresh concorrente usa lock (1 troca); token jamais em log,
board (só máscara), HTML ou fixture; revogação inutiliza credenciais.

## Leitura real

`MLLiveTransport` (kind http) implementa o MESMO contrato do transporte de
fixtures — o SyncOrchestrator do S09 roda igual: payload bruto preservado,
normalização, eventos idempotentes, Central/Chat/Graph/EPE alimentados. O
card mostra conta, seller id, última sincronização, lidos/criados/
atualizados, erros, lag e "modo leitura ativo". DADOS REAIS CONECTADOS ≠
DADOS DEMONSTRATIVOS, sempre rotulados.

## A trava dos PROVISIONAL (categoria oficial)

Rule pack demo/provisional **prepara e aponta pendências**; a VERDADE do
anúncio real vem da **confirmação oficial pós-OAuth**: categoria +
atributos obrigatórios + restrições → `category_snapshot` (fonte, URL,
horário, versão). Sem snapshot oficial o Dry Run fica em DRY_RUN com a
issue explícita; mocks se rotulam `MOCK_OFFICIAL_FIXTURE` e nunca se
apresentam como `OFFICIAL_API`.

## O piloto — MERCADO_LIVRE_PILOT_CREATE_LISTING

Permite criar **UM anúncio novo**. Não permite: editar/pausar/excluir
anúncio, preço, estoque, Ads, campanhas, lote, execução automática, via
Chat ou WhatsApp, ou qualquer escrita em Shopee/TikTok/Magalu (tudo
testado). Estágios:

1. **DRY_RUN** — monta o payload real e valida tudo (categoria oficial,
   atributos, título, preço, estoque, imagens, dimensões, peso) — **sem
   chamada externa**;
2. **READY_FOR_PILOT** — exibe conta, produto, categoria, snapshot, hash
   do payload, warnings e rule pack;
3. **EXPLICIT_PILOT_CONFIRMATION** — administrador + flag
   (empresa+conta+usuário) + OAuth real + conta confirmada + digitar
   exatamente **`CRIAR ANÚNCIO PILOTO REAL`** + aviso: *"Esta ação criará
   um anúncio real na conta Mercado Livre selecionada. Ela não é uma
   simulação."*

Idempotência: chave = draft+conta+hash — o run CREATED é o dono da chave;
o mesmo payload **nunca** cria dois anúncios. Falha → FAILED com
orientação de rollback manual e **sem retry automático**. Auditoria
completa em `pilot_run` (ids, hashes, timestamps, resposta mascarada).

## Rotas

`GET/POST /webhooks/whatsapp` · `GET /oauth/ml/start` ·
`GET /oauth/ml/callback` · `GET /connections/board` ·
`POST /pilot/dry-run` · `POST /pilot/:runId/confirm`.

## Arquivos

```
mos/src/live/  feature-flags.js · whatsapp-live.js · ml-live.js
               · creative-engine.js · pilot-service.js · index.js
mos/src/infrastructure/db/schema-live.sql   (8 tabelas aditivas)
mos/test/live.test.js · mos/demo-live.js
design/prototipo-v5/  (Conexões + Criativos; demo declarada)
docs/product-fidelity-protocol.md · docs/live-activation-checklist.md
```

# 10.E — Live Pilot Líder Molduras · Runbook

## 0. Publicar o staging (uma vez)
DNS → VPS → `docker compose -f infrastructure/deploy/vps-compose.yml --env-file staging.env up -d`
→ `npm run smoke:staging` → `curl https://staging.SEU-DOMINIO/health` (postgres/redis/worker "ok").
O guard do 10.D.1 impede SQLite/sem-Redis em staging — se subir, é PG+Redis de verdade.

## 1. Entrada controlada — 12 camadas (nunca pule; portão humano por camada)
Ferramenta: `node pilot/pilot.js status|bootstrap|ingest|conferir|aceitar`.
Estrutura real em `pilot/lider.config.json` (edite CNPJs/lojas antes do bootstrap).

| # | Camada | Você fornece | Comando | Aceite (go/no-go) |
|---|---|---|---|---|
| 1 | Estrutura real | conferir lider.config.json | `pilot.js bootstrap` | lojas/apelidos corretos |
| 2 | Catálogo/SKUs/anúncios | Parent SKU Detail (xlsx) por loja | `ingest --camada 2 --arquivo F --loja shopee-mg` | nº de itens = painel Shopee |
| 3 | Vínculos + Anúncio Master | revisão HUMANA | tela Importar · Vínculos/Master | 0 conflito aberto; masters confirmados |
| 4 | Vendas pagas/funil | Sales Overview do período | `ingest --camada 4 … --periodo I:F` + `conferir --esperado R$` | desvio ≤ 0,5% vs painel |
| 5 | Tráfego/performance | Product Traffic / Shop Stats | `ingest --camada 5 …` | CTR/impressões conferem por amostra |
| 6 | Sobreposição/dedup | REIMPORTAR período que cruza o da 4 | `ingest --camada 6 …` + `conferir` | duplicados evitados > 0; receita NÃO soma |
| 7 | Devoluções | relatório de devolução | ingest (perfil parcial — anotar atritos) | contagem confere |
| 8 | Promo/cupom/Ads/afiliados | Promotion/Voucher/Channel | ingest por arquivo | receita total INALTERADA (só explica) |
| 9 | Equipe real | e-mails + papéis | tela Equipe (escopo por loja) | LEITURA não edita; escopo isola |
| 10 | Uso diário 1-2 semanas | fricções no log abaixo | Home/Crescimento/Catálogo/Importar/Missões | decisões tomadas com o Head |
| 11 | Mercado Livre LEITURA | autorizar OAuth de leitura | Conexões | escrita segue BLOQUEADA |
| 12 | WhatsApp administrativo | número admin | canal interno | comandos respondem |

Erro em qualquer camada → `rollback` do lote (preserva lotes posteriores) → corrigir → reimportar (dedup protege).

## 2. Log de atrito (preencher durante o piloto)
`| data | camada | quem | o que travou | gravidade | correção p/ 10.R |`

## 3. Ensaio geral executado (registro)
Bootstrap (3 CNPJs, 6 lojas) + camadas 2/4/5/6 rodadas pelo pipeline real:
XLSX parseado; receita 7.500 → conferência 0,00%; sobreposição criou 1 e evitou 2
(receita 10.000, nunca 17.500); reimportação idêntica bloqueada. Estado limpo para o real.

## 10.E.1 — Ativação: ordem de execução
`pilot.js revisar` → `confirmar --item <cada CNPJ/loja>` → subir VPS (vps-compose) →
`pilot.js preflight` até "STAGING PRONTO PARA PILOTO" (itens do owner saem como
AGUARDANDO AÇÃO DO OWNER) → `bootstrap` → camada 2 (`ingest` fica em STAGING,
imprime revisão de vínculos; master NUNCA automático; `aplicar --lote` só após
revisão; conflito de SKU bloqueia o aceite) → `relatorio --camada 2` (Go/No-Go)
→ `aceitar --camada 2` → só então vendas. Atritos: `pilot.js atrito --tipo SKU
--camada 2 --desc "..."` → pilot/atritos.jsonl (insumo do 10.R).

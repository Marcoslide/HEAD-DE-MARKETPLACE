# Crescimento — a mesa comercial (Sprint 10.B)

> WhatsApp é o controle remoto. Catálogo é a mesa dos produtos e
> anúncios. **Crescimento** é a mesa comercial: leads, afiliados,
> promoções, campanhas e resultados. Conexões liga tudo ao mundo real.
> Menu: Home · Operação · Catálogo · **Crescimento** · Conexões ·
> A Missão · Silêncio · Conhecimento.

## Como rodar

```bash
node --test mos/test/growth.test.js   # 21 testes (os 15 obrigatórios + estruturais)
design/prototipo-v6/index.html        # a experiência principal (demo declarada)
```

## O princípio: UM motor, NUNCA automação paralela

Todo comando via WhatsApp usa os MESMOS serviços, regras, jobs,
permissões, auditoria e estados da interface visual. O fluxo do comando
em massa (testado ponta a ponta):

```
WhatsApp: "Cria drafts Shopee dos produtos com margem acima de 25%"
→ GrowthCommandGateway → AdaptationEngine.plan (filtros + margem por praça)
→ RESUMO no WhatsApp → "Responda SIM" → confirmação
→ internal_job (origem WHATSAPP_COMMAND, aprovação MASS_EDIT)
→ AdaptationEngine.execute → CatalogService.createDraft (S10)
→ resultado no WhatsApp → detalhe no Catálogo
```

O WhatsApp **nunca**: publica, altera preço/estoque externo, ativa
promoção externa ou cria anúncio real — pedido assim recebe recusa
honesta e aponta a tela certa.

## Origem de ação (obrigatória em todo job)

`DASHBOARD_MANUAL · WHATSAPP_COMMAND · CHAT_OPERACIONAL · JOB_INTERNO ·
INTEGRACAO_EXTERNA · IMPORTACAO_MANUAL · SISTEMA` — origem inválida é
recusada; origem válida vai para o job e para a auditoria.

## Papéis e Approval Flow

Papéis (`user_role`, legado owner/operator/viewer mapeado):
`ADMIN · GESTOR_MARKETPLACE · OPERADOR_CATALOGO · COMERCIAL ·
FINANCEIRO · LEITURA`. Operador cria draft e não aprova; gestor aprova;
comercial cuida de lead/promoção interna; LEITURA nunca edita nem
executa job; escrita externa futura só por ADMIN. Aprovações
(`approval_request`): MASS_EDIT, PROMOTION, PRICE_CHANGE,
MIN_MARGIN_CHANGE, LISTING_CREATE, FUTURE_PUBLISH, COMMISSION_PAYOUT —
com decisor certo por tipo (comissão = FINANCEIRO/ADMIN).

## Conflito manual × sync (proveniência por campo)

Toda informação da ficha registra fonte (MANUAL, IA, IMPORTACAO,
MARKETPLACE_SYNC, WHATSAPP_COMMAND, SISTEMA) em
`product_profile.field_sources_json`. Sync que tenta sobrescrever campo
MANUAL **não sobrescreve**: vira `data_conflict` REVIEW_REQUIRED com
histórico; a revisão humana escolhe MANUAL ou SYNC.

## Margem por praça (`marketplace_fee_profile` + MarginService)

custo + embalagem + frete subsidiado + comissão + taxa fixa + Ads +
imposto + desconto promocional + comissão de afiliado → margem final,
preço mínimo e preço recomendado. Perfis default são
`INTERNAL_DEFAULT` — **estimativa interna, nunca tarifa oficial** (fonte
gravada). **Sem margem calculada → draft em revisão e promoção
EM_REVISAO. Nunca avança.**

## Leads (CRM interno honesto)

9 entidades (`lead`, `lead_source`, `lead_interaction`, `conversation`,
`lead_opportunity`, `lead_assignment`, `lead_follow_up`,
`lead_status_history`, `customer_link`). Status NOVO→…→GANHO/PERDIDO com
histórico; dedup por telefone/e-mail; vínculo com produto, marketplace,
afiliado e campanha; importação com fonte; privacidade: contato mascarado
fora de ADMIN/COMERCIAL, acesso auditado, isolamento por empresa.
`data_source` separa DEMO × MANUAL × IMPORTACAO × REAL — **nunca fingimos
CRM conectado**. WhatsApp administrador ≠ WhatsApp cliente (futuro CRM).

## Afiliados (Affiliate Intelligence)

8 entidades. Regras duras testadas: **uma venda = um afiliado**
(order_ref único); **clique nunca vira comissão**; atribuição registra
regra + janela + confiança (CONFIRMADA/ESTIMADA/DESCONHECIDA); comissão
nasce **ESTIMADA**; lote de pagamento para em EM_REVISAO com aprovação
COMMISSION_PAYOUT; `pay()` lança erro — pagamento real é fluxo futuro.
Importação manual sempre rotulada "dados importados manualmente".

## Promoções e campanhas (entidade COMPARTILHADA)

`promotion` é uma tabela só: o Catálogo a vê por produto
(`catalogView`), o Crescimento vê estratégia/margem/risco
(`growthView`). Simulação grava breakdown, margem, preço mínimo e risco
de ruptura (limite × estoque). Estados: RASCUNHO → EM_REVISAO →
APROVADA_INTERNAMENTE → … `activateExternally()` **sempre lança
ExternalWriteError** e o estado máximo é
AGUARDANDO_AUTORIZACAO_DE_ESCRITA. Neste sprint: criar, calcular,
simular, organizar, revisar, aprovar internamente — nada externo.

## Resultados

Todo número sai com **período, fonte, cobertura, atualização** e
natureza (REAL / IMPORTADO / DEMONSTRATIVO / SEM_DADO). Sem praça
sincronizada → vendas SEM_DADO; ROI sem base → `null` (nunca estimado).

## Jobs internos

`internal_job`: total/processados/sucesso/bloqueados/falhos + motivos,
pausa, cancelamento (só antes de executar), relatório final, auditoria e
**rollback interno** (arquiva os drafts criados — o marketplace nunca é
tocado).

## Chat/WhatsApp — comandos naturais novos

"Quantos leads chegaram hoje?" · "Quais leads estão sem resposta?" ·
"Quem são meus melhores afiliados?" · "Quanto cada afiliado vendeu este
mês?" · "Quais promoções estão prejudicando minha margem?" · "Mostra
produtos com alto giro sem promoção" · "Quais produtos vendem na Shopee
e ainda não estão no Mercado Livre?" · "Quais oportunidades precisam de
follow-up hoje?" · "Cria drafts/promoção/campanha…" (com confirmação).
Mesmo pipeline 09.A: intenção → consulta tipada → adapter → composer com
fonte/hora — sem motor acoplado, resposta honesta de ausência.

## Ads (futuro)

Nada de Ads agora; o encadeamento produto → anúncio → promoção →
campanha → criativo → afiliado → lead → venda → margem → resultado já
existe nas entidades para o vínculo futuro.

## Arquivos

```
mos/src/growth/  permissions.js · jobs.js · margin.js · provenance.js
                 · adaptation.js · leads.js · affiliates.js · promotions.js
                 · results.js · intake.js · data-completion.js
                 · command-gateway.js · demo-growth.js (UMD) · index.js
mos/src/infrastructure/db/schema-growth.sql   (31 tabelas aditivas)
mos/test/growth.test.js                       (21 testes)
design/prototipo-v6/                          (área Crescimento; demo declarada)
```

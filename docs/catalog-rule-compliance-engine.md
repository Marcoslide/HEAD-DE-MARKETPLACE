# Catalog, Rule & Compliance Engine — o Head entende o catálogo

> Sprint 10. O Head deixa de apenas entender a operação e passa a entender
> se um produto/anúncio está **pronto, incompleto, arriscado, bloqueado ou
> apto a virar rascunho** — por marketplace, com fonte e versão de regra.
> **Modo: leitura, validação, rascunho e recomendação interna. Nenhuma
> publicação externa.**

## Como rodar

```bash
node --test mos/test/compliance.test.js   # 23 testes (as 30 garantias)
node mos/demo-compliance.js               # os 4 cenários, determinístico
design/prototipo-v4/index.html            # a área CATÁLOGO (experiência principal)
```

## Auditoria e reuso (primeiro passo obrigatório — executado)

| Peça existente | Classificação |
|---|---|
| `product` (tabela) | **REUTILIZAR** — é o Product Master; `upsertMaster` grava nela |
| `listing` / `listing_version` | **REUTILIZAR** — representação por praça + versões |
| `listing.status='draft'` | **COMPLETAR** — nasce `listing_draft` (payload rico + findings + checklist) |
| Provider Registry | **ADAPTAR** — ganhou `registerRulePack`/`rulePack` (um registry só) |
| Validações por praça dos providers (S08) | **REUTILIZAR** — viraram sementes dos rule packs, agora com proveniência |
| Chat/Intent Router/Composer | **ADAPTAR** — nova intenção `CATALOG_COMPLIANCE_QUERY` |
| CentralBridge/EPE INTERNAL_ONLY | **REUTILIZAR** — sinais de compliance usam a MESMA trilha |
| Perfis, assets, projeção por praça, validation_run | **CRIAR** (5 tabelas aditivas) |

## A camada única

```
Product Master (tabela product + product_profile + product_asset)
→ Marketplace Profile (projeção POR PRAÇA — nunca misturada)
→ Rule Pack da praça (fonte + versão + status por regra)
→ Categorization Engine (sugere; nunca inventa código)
→ Requirement Resolver (global → categoria → tipo → logística →
  personalização → fiscal → regra interna)
→ Compliance Engine (9 categorias de validação)
→ Findings (BLOCKER/HIGH_RISK/WARNING/INFO/UNKNOWN)
→ Readiness (READY/READY_WITH_WARNINGS/REVIEW_REQUIRED/BLOCKED/
  INSUFFICIENT_DATA/NOT_SUPPORTED)
→ Checklist de revisão → Listing Draft interno
→ Validation Run (append-only) → Graph/EPE/Chat/Catálogo (v4)
```

## Rule packs: fonte, versão e honestidade

Cada regra carrega `{id, platform, scope, requirementType, field, operator,
expectedValue, severity, sourceType, sourceReference, rulePackVersion,
verifiedAt, status, confidence, notes}`.

**Status** — `VERIFIED` (documentação oficial estável) · `PROVISIONAL`
(plausível, pendente de confirmação — **nunca gera aprovação definitiva**)
· `UNKNOWN` (não confirmada — **trava READY**: se o dado não cobre a
exigência possível, o produto vai para REVIEW_REQUIRED com a frase *"essa
exigência ainda não está confirmada... exige revisão antes de publicação"*)
· `DEPRECATED` · `NOT_APPLICABLE`.

**Fontes** — `OFFICIAL_PLATFORM_POLICY` · `OFFICIAL_SELLER_DOCUMENTATION` ·
`OFFICIAL_API_DOCUMENTATION` · `INTERNAL_OPERATIONAL_RULE` ·
`DEMO_RULE_FIXTURE` · `PUBLIC_RESEARCH_EVIDENCE`.

Regras da empresa (margem mínima, capacidade de personalizados, embalagem
de frágil) são `INTERNAL_OPERATIONAL_RULE`: geram HIGH_RISK/WARNING com a
marca `internal: true` e **nunca são apresentadas como bloqueio oficial**.
Os packs atuais são `DEMO_RULE_FIXTURE` (versões `ml-demo-1.2`,
`shp-demo-1.1`, `ttk-demo-0.9`, `mgl-demo-0.9`) — o chat e a UI sempre os
rotulam como *"Rule Pack Demo — regras demonstrativas, não são política
oficial"*. Sem scraping/automação de navegador: packs estruturados +
referências documentadas; o que não está confirmado fica
PROVISIONAL/UNKNOWN.

**Um produto nunca é "aprovado pela plataforma"** — apenas *"validado
contra as regras conhecidas do rule pack X"*, e com regras provisórias
aplicadas o veredito máximo é READY_WITH_WARNINGS.

## Categorias e taxonomia

Cada praça tem taxonomia própria (`categoryId`, caminho, atributos
exigidos/opcionais, status, fonte, verificação). Códigos (ex.: `MLB1367`)
estão marcados PROVISIONAL até confirmação via API oficial — **nenhum
código é inventado**: a sugestão só devolve entradas existentes na
taxonomia; baixa confiança → `LOW_CONFIDENCE` + revisão humana; sem
correspondência → `NO_MATCH` (bloqueia).

## Validação (9 categorias)

CATEGORY · REQUIRED_ATTRIBUTES · TITLE_AND_DESCRIPTION · IMAGES_AND_ASSETS
(metadados: presença/quantidade/proporção/resolução/formato/marca-d'água —
sem Product Fidelity Protocol nem geração de imagem neste sprint) ·
LOGISTICS_AND_PACKAGING · PRICE_AND_MARGIN · PERSONALIZATION ·
FISCAL_AND_IDENTIFICATION · POLICY_AND_BAN_RISK.

Readiness: BLOCKER → BLOCKED; UNKNOWN não coberto ou categoria em revisão
→ REVIEW_REQUIRED; HIGH_RISK/WARNING ou provisórias aplicadas →
READY_WITH_WARNINGS; sem nada → READY. Dados mínimos ausentes →
INSUFFICIENT_DATA; praça sem pack → NOT_SUPPORTED.

## Trilha de auditoria

Toda validação vira `validation_run` **append-only** (produto, praça,
categoria, versão do pack, fonte, findings, evidência, executedAt pelo
Clock). *"Por que esse produto estava bloqueado no dia 4 de julho?"* →
o run daquele dia responde com regra, versão e finding do momento
(testado: duas validações = dois runs preservados).

## Rascunhos (internos, jamais publicados)

`createDraft(productId, platform)` → `listing_draft` versionado com
payload (título, categoria, atributos, imagens, preço/estoque sugeridos,
prazo, logística, fiscal), findings, checklist, origem das sugestões
(pack + versão) e campo de revisão humana. Status: DRAFT · INCOMPLETE ·
READY_FOR_REVIEW · BLOCKED · APPROVED_FOR_FUTURE_PUBLISH · ARCHIVED —
**nem APPROVED_FOR_FUTURE_PUBLISH publica nada**. Teste garante:
`publication_history` permanece vazio.

## Chat (sem hardcode)

Intenção `CATALOG_COMPLIANCE_QUERY` → adaptador tipado
(`createComplianceAdapter`) → motor real → fatos → Composer. "O que falta
para publicar o espelho na Shopee?" responde com bloqueadores, alertas
(internos separados), categoria sugerida + confiança, faltantes e o rodapé
com **rule pack, versão e data de verificação**. Produto ambíguo → visão
de lista (nunca chute). Linguagem nunca absoluta com PROVISIONAL/UNKNOWN.

## Graph, Playbooks e EPE

Findings **relevantes** (expansão impedida por catálogo; personalizado com
prazo/capacidade em risco) viram sinais `central.signal` → CentralBridge →
EPE com `executionScope: INTERNAL_ONLY` → Plano do Dia. Pendência pequena
(ex.: imagem 480px) **não** vira missão (testado). Ações permitidas:
alerta, checklist, missão interna, sugestão, rascunho, notificação.
Proibidas: publicar/alterar qualquer coisa externa (bloqueio em 3 camadas
do Sprint 09 continua valendo; `supportsExternalPublish=false` nas 4
declarações).

## Multiempresa

`companyId` isola produtos, perfis, validações, rascunhos e sinais
(testado A×B). Regras oficiais são compartilháveis; aplicação/custo/
margem/prazo/resultado pertencem à empresa.

## Como adicionar um marketplace

1. `providers.registerRulePack(pack)` — núcleo não muda (testado);
2. taxonomia + requisitos com fonte/versão/status REAIS (nada inventado);
3. fixtures e testes; 4. o motor avalia a praça nova automaticamente.

## Como revisar/atualizar uma regra

Editar o pack → nova `version` + `verifiedAt` + fonte confirmada → status
VERIFIED. Validações antigas continuam auditáveis com a versão antiga
(runs preservam `rule_pack_version`). Para evitar prometer compliance sem
evidência: manter o status honesto — o motor rebaixa o veredito sozinho.

## Arquivos

```
mos/src/compliance/  _ns.js · rule-packs.js · engine.js · demo-products.js
                     · chat-adapter.js · index.js       (UMD: Node + navegador)
mos/src/catalog/catalog-service.js                      (persistência/sinais)
mos/src/infrastructure/db/schema-compliance.sql         (5 tabelas aditivas)
mos/test/compliance.test.js                             (23 testes / 30 garantias)
mos/demo-compliance.js                                  (4 cenários)
design/prototipo-v4/                                    (área CATÁLOGO)
```

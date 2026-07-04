# Universal Marketplace Listing Schema Engine (complemento 10.C)

> Cadastro NUNCA é formulário fixo. UM motor (`mos/src/listing-schema/`),
> 4 adapters (ML, Shopee, TikTok Shop, Magalu), schema montado em CAMADAS:
> universal → interno → tipo de produto → categoria folha → marketplace →
> conta → logística → variação → regra interna.

## Como rodar
```bash
node --test mos/test/schema-engine.test.js   # 8 blocos (23 garantias)
design/prototipo-v7/index.html               # Catálogo → Formulário inteligente (5 cenários)
```

## Reaproveitamento (mapa)
- Rule packs S10 → `MarketplaceRulePackImporter` → árvore
  `marketplace_category_tree` com source **PROVISIONAL_INTERNAL**
  (versionada, dedup, nunca substitui oficial).
- `category_snapshot` (10.A, pós-OAuth) → `promoteFromSnapshot` →
  **VERIFIED_OFFICIAL/VERIFIED_ACCOUNT** — a fonte oficial VENCE a interna.
- Faltas → **DataRequest** (Data Completion 10.B): pergunta agrupada no
  WhatsApp, resposta atualiza o campo certo e revalida.
- Margem/permissões/auditoria/drafts: os mesmos do 10.B/S10.

## Fonte de verdade (prioridade)
OFFICIAL_API > oficial armazenada válida > regra da conta > interna
confirmada > PROVISIONAL_INTERNAL > sugestão do RID > demo. **Regra
provisória jamais aprova publicação externa** (`canApproveExternalPublish`
só com VERIFIED_*). Sem retorno oficial: "Regra interna/provisória",
rascunho interno permitido, nunca afirmamos que o marketplace aceitará.

## Sob encomenda (regra obrigatória)
`isPersonalized` ou `production_mode ∈ {MADE_TO_ORDER, PERSONALIZED}` →
o schema EXIGE prazo de produção, preparação, despacho, capacidade/dia,
embalagem, peso e dimensões embaladas — e o
`ShippingEligibilityEngine` bloqueia AUTOMATICAMENTE (regra interna):
BLOCKED_BY_PERSONALIZATION, BLOCKED_BY_LEAD_TIME, BLOCKED_BY_DIMENSIONS,
BLOCKED_BY_WEIGHT, BLOCKED_BY_PACKAGING… Sem peso/dimensão →
AWAITING_DATA. Método liberado sem conta conectada →
AWAITING_ACCOUNT_CONFIRMATION — **nunca habilitamos modalidade só porque
existe botão**. Variações têm peso/preço/estoque/prazo/logística PRÓPRIOS
— nada herdado.

## Entidades (7 aditivas)
marketplace_category_tree · marketplace_category_mapping ·
marketplace_listing_schema · marketplace_schema_field ·
marketplace_listing_field_value · product_operational_profile ·
marketplace_shipping_eligibility.

## Descoberta de categoria
`discoverCategory` sugere com confiança; < 0,9 ou fonte provisória →
confirmação humana SEMPRE. O Head nunca assume categoria final nem
inventa atributo técnico — o que falta vira pergunta.

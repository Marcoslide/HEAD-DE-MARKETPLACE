# Marketplace Knowledge & Compliance Foundation (Sprint 10.K)

> Base VIVA de conhecimento (ML, Shopee, TikTok Shop, Magalu) que dá
> CONSCIÊNCIA ao Head — não um policial. Alimenta RID, Compliance,
> Schema Engine, Data Completion, Shipping Eligibility, Chat e WhatsApp
> sem criar outro cérebro.

## Como rodar
```bash
node --test mos/test/knowledge.test.js   # 7 blocos (24 garantias)
design/prototipo-v7 → Conhecimento → Marketplace Intelligence
```

## Reaproveitamento
Fontes/registros ligam-se aos rule packs S10 (`related_rule_pack_id`), às
categorias do Schema Engine (`applies_to_category_id`), à logística do
Shipping Eligibility (domínio logistica-prazo), ao Data Completion
(faltas viram pergunta) e à auditoria única. RID consulta antes de
recomendar; Chat/WhatsApp recebem o texto pronto do advisor.

## Modelo
- `marketplace_knowledge_source` — fonte com versão, data, hash, oficial
  ou não (não-oficial SÓ como PUBLIC_RESEARCH, rotulada).
- `marketplace_knowledge_record` — 8 domínios (API, cadastro, preço,
  logística, operação, políticas, enforcement, estratégia) × 20 tipos ×
  9 status de confiança; escopo por categoria/conta/tipo/operação.
- `marketplace_risk_rule` — action modes INFO → BLOCK_EXTERNAL_ACTION.
- `marketplace_knowledge_conflict` + `marketplace_knowledge_review` —
  conflito e mudança de fonte SEMPRE viram fila de revisão.

## Comportamento (testado)
1. PODE_SEGUIR — sem risco confirmado. 2. PODE_SEGUIR_COM_ALERTA —
risco moderado: explica consequência + alternativa, decisão fica com o
responsável. 3. PRECISA_DE_CONFIRMACAO — depende de conta/regra/dado.
4. BLOQUEAR_ACAO_EXTERNA — só ação externa irreversível, e SÓ com motivo
+ regra + consequência + caminho + fonte + confiança. **Análise, plano,
draft interno, teste e coleta de dado NUNCA são impedidos.**

## Verdade e prioridade
VERIFIED_OFFICIAL > VERIFIED_ACCOUNT > VERIFIED_INTERNAL >
SUPPORTED_BY_EVIDENCE > PROVISIONAL. Interna não sobrescreve oficial
(erro); oficial nova aposenta a interna (RETIRED, rastreável); ingestão
com hash detecta duplicata e mudança → registros ligados viram STALE +
revisão; STALE/RETIRED saem do recall. PROVISIONAL/UNKNOWN jamais
aprovam ação externa.

## Método R.E.A.L.
Classificado REAL_METHOD_PLAYBOOK (estratégia: criativos, conversão,
autoridade, emoção, retenção, ação). Preservado — e proibido de
substituir categoria, atributo, política, logística ou compliance
(testado: nenhum risk rule nasce do playbook).

## Ingestão e atualização
`ingest()` versiona, deduplica por hash, marca obsoleto e enfileira
revisão. Atualização é MANUAL/configurável — nenhuma periodicidade fixa
inventada; revisão por marketplace, domínio, categoria ou regra crítica.
Carga seed atual = PROVISIONAL rotulada (as fontes oficiais reais são
cadastradas na ativação — nunca fingimos tê-las lido).

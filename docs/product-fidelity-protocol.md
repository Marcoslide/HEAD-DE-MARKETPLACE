# Product Fidelity Protocol — o produto real é intocável

> Sprint 10.A. Antes de qualquer geração de criativo nasce um **Product
> Truth Pack imutável** — o retrato factual do produto, com hash. A IA
> cria cena; **nunca** recria o produto.

## O Truth Pack

Construído do Product Master + perfil + assets oficiais:
productId, SKU, variações, **quantidade do kit**, medidas, peso, cor,
material, acabamento, moldura, espessura, vidro, canvas, LED, espelho,
arte aplicada, acessórios, embalagem, itens inclusos, assets oficiais,
**hash dos assets**, **hash do perfil**, versão, timestamp (Clock) e
restrições. Persistido em `product_truth_pack` (append por versão).

Faltando o mínimo (medidas, material, peso, assets) →
**INSUFFICIENT_PRODUCT_TRUTH**: *"Não vou gerar uma imagem porque faltam
dados necessários para preservar fidelidade."* (com a lista do que falta).

## O que a IA pode e não pode

| PODE variar | NÃO PODE mudar |
|---|---|
| cenário · iluminação · ambiente · sombra · enquadramento · composição · fundo · elementos gráficos permitidos | tamanho · proporção · quantidade · kit · formato · cor · moldura · espessura · material · acabamento · vidro · LED · arte · textura · acessórios · embalagem · logotipo · itens inclusos |

## Tipos de criativo (v1, Mercado Livre)

MAIN_CLEAN · AMBIENT · FINISH_DETAIL · SIZE_PROPORTION · KIT_COMPOSITION ·
PACKAGING_PROTECTION · OBJECTION_BREAKER · VISUAL_BENEFIT.

## Geração real

Provider por variável de ambiente (`CREATIVE_IMAGE_PROVIDER`,
`CREATIVE_IMAGE_API_KEY`; chave só no backend) + flag
`CREATIVE_IMAGE_GENERATION_ENABLED` (default OFF). Por job, com status de
fila; retry seguro **só quando não há resultado**; registra provider,
modelo, custo (quando disponível) e timestamp. **Sem provider**: briefing +
prompt interno + fila pendente — **nunca** uma imagem fake apresentada
como gerada (testado).

## Validação de fidelidade

1. origem/metadados; 2. comparação contra o Truth Pack (cor, kit, medida,
moldura, material, arte, embalagem, produto extra, promessa em texto…);
3. revisão visual automatizada quando o provider suportar; 4. **revisão
humana SEMPRE obrigatória** antes do uso em anúncio real. Divergência →
aprovação humana **bloqueada** (testado). Nunca se afirma "100% fiel" — a
frase padrão é: *"Validação automática sem divergência detectada. Revisão
humana ainda obrigatória."*

Status: CREATIVE_DRAFT → FIDELITY_REVIEW_REQUIRED → (FIDELITY_WARNING |
FIDELITY_FAILED) → COMPLIANCE_REVIEW_REQUIRED → APPROVED_FOR_DRAFT |
REJECTED. Só APPROVED_FOR_DRAFT entra no Listing Draft e conta para o
piloto.

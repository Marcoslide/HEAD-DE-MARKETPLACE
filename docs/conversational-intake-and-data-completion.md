# Anúncio nasce na conversa + Data Completion Engine (Sprint 10.B, complementos)

> Operação é a porta de entrada conversacional; o Catálogo é a mesa
> visual de revisão e aprovação. E pendência não morre como alerta: o
> Head caça o dado que falta, com a pessoa certa, via WhatsApp.

## Como rodar

```bash
node --test mos/test/intake.test.js   # 17 testes (30 garantias dos 2 complementos)
design/prototipo-v6/index.html        # Operação: botão "Criar anúncio"; Catálogo: pendências
```

## Criação pela conversa (IntakeService)

```
você escreve / envia foto / cola link
→ Head identifica o produto (matchProduct — nunca duplica Master)
→ existe? cria drafts POR PRAÇA via o MESMO Adaptation Engine (job auditável)
→ não existe? PRODUCT_INTAKE (NEW → AWAITING_* → READY_TO_CREATE_PRODUCT_MASTER)
→ pergunta SÓ o que falta (fotos oficiais, medidas, material, peso embalado, custo, estoque)
→ Catálogo organiza, corrige e aprova
```

Regras testadas: intake **nunca** vira Master sem dados mínimos + revisão;
nome/SKU parecido → `REJECTED_DUPLICATE`; foto registra origem, autor,
data e **hash** — foto de REFERÊNCIA nunca vira oficial; link vira
`source_reference` com finalidade confirmada e `content_copied = 0`
sempre (concorrente/fornecedor: só insight estratégico); multimarketplace
= drafts separados por rule pack (Shopee não toca dados do ML); nada é
publicado. Origens: `DASHBOARD_OPERATION · WHATSAPP_COMMAND ·
MANUAL_CATALOG · IMPORTED_REFERENCE`.

No WhatsApp: foto/legenda inicia intake ("Recebi a foto… produto real ou
referência?"); "Cria anúncio desse espelho para Shopee e Mercado Livre"
→ 2 rascunhos internos + pendências + deep link `catalogo://draft/…`.

## Data Completion Engine (`data_request`)

```
draft bloqueado → identifica O QUE falta e DE QUEM é
→ DataRequest (produto+variação+draft+praça, criticidade, regra, formato)
→ pergunta agrupada e objetiva (nunca "Qual o peso?")
→ resposta natural: "peso 14,2 kg | material vidro 4 mm"
→ normaliza (kg→g, extenso→número), atualiza SÓ o campo certo
  (fonte WHATSAPP_COMMAND, valor anterior guardado, proveniência por campo)
→ revalida TODOS os drafts do produto (nova versão)
→ responde: o que atualizou, o que ainda falta — "Nenhum anúncio foi publicado."
```

Estados: OPEN → ASKED → ANSWERED/NEEDS_CONFIRMATION → RESOLVED
(EXPIRED/CANCELLED/SUPERSEDED). Criticidade BLOCKER/HIGH/MEDIUM/LOW.

**Roteamento** (pessoa certa): peso/medidas/embalagem/material/estoque/
prazo → OPERADOR_CATALOGO (produção/expedição); custo → FINANCEIRO;
preço/EAN/categoria/atributo/aprovação de imagem → GESTOR_MARKETPLACE;
sem responsável → administrador + `unassigned`.

**Regras testadas**: campo já preenchido → pergunta NÃO nasce; pergunta
aberta não se repete; resposta que serviria a 2 produtos → confirmação
explícita ("Você está confirmando 14,2 kg para… certo?"); "não sei /
depois" reabre sem drama; "cancelar" encerra; interpretação cobre
"quatorze quilos", "170 por 70", "18 unidades", "custa 79 reais",
"kit com 3"; isolamento absoluto entre empresas; e o WhatsApp responde
pendência mas **jamais** publica (pilot_run permanece zerado).

## Arquivos

```
mos/src/growth/intake.js · data-completion.js   (+ gateway estendido)
mos/src/infrastructure/db/schema-growth.sql     (+4 tabelas: product_intake,
  intake_asset, source_reference, data_request)
mos/test/intake.test.js                         (17 testes)
design/prototipo-v6/anuncio.js                  (fluxo "Criar anúncio" na Operação)
design/prototipo-v6/catalogo.js                 (card Pendências + Perguntar no WhatsApp)
```

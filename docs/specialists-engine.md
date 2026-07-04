# Specialists Engine — o conselho de especialistas do Head

> Sprint 06. Camada Cognitiva (MIE). Constituição Arts. 10-11.
> O diferencial que nenhum concorrente copia facilmente: o Head não é "uma IA" —
> é um **conselho de sete especialistas independentes** que deliberam e produzem
> uma posição única, com pesos que evoluem conforme quem acerta.

## Como rodar

```bash
node --test mie/test/specialists.test.js   # 10 testes de conformidade
node mie/demo-specialists.js               # o conselho deliberando, legível
```

## Os sete especialistas

Cada um opina **apenas no seu domínio** (Art. 11.2), com conhecimento, critérios e
confiança próprios. Nenhum conhece a decisão final; nenhum executa (Art. 11.5).

| # | Especialista | Domínio |
|---|---|---|
| 01 | **Conversão** | CTR, conversão, funil, criativos, título, descrição, provas, imagens |
| 02 | **SEO** | palavras-chave, ranking, título, categorias, indexação, posição |
| 03 | **Comercial** | preço, margem, competitividade, descontos, parcelamento, frete |
| 04 | **Concorrência** | entrantes, movimentação, mudança de preços/criativos/estratégia |
| 05 | **Operação** | estoque, ruptura, expedição, avaliações, devoluções, SLA |
| 06 | **Marketing** | tendências, sazonalidade, datas comerciais, oportunidades |
| 07 | **Financeiro** | ROI, lucro, margem, ticket, impacto financeiro |

> Nota de conformidade: esta lista refina a tabela ilustrativa do Art. 10 (que a
> Constituição define como princípio, não como cláusula pétrea). Criativos foi
> absorvido por Conversão; Comportamento por Marketing; e entraram Comercial,
> Operação e Financeiro — cobrindo o raciocínio de um diretor de marketplace.

## O parecer rico

Cada parecer carrega (superset do formato fixo do Art. 11.2):

```
diagnóstico · evidências · hipóteses · confiança (0..1 + label) ·
recomendação · impacto esperado · riscos · urgência
```

Mais metadados internos para a deliberação: `stance` (alert/opportunity/neutral),
`recommendationType` (a ação proposta: reposition/creative/price/stock/reputation/
visibility/capture, ou null para pareceres **consultivos** como o Financeiro).

## O Conselho

Recebe **todos** os pareceres e produz **uma posição consolidada** (Art. 11.3 — o
Head nunca tira a média; pesa e decide). O Conselho:

1. **Identifica concordâncias** — especialistas que votaram na recomendação vencedora.
2. **Identifica conflitos** — pares com recomendações que se opõem (ex.: `price` ×
   `reposition`; `stock` × `capture`).
3. **Identifica divergentes** — especialistas aplicáveis fora do grupo vencedor.
4. **Gera o consenso** — voto ponderado sobre a ação; confiança e força agregadas.
5. **Gera o parecer consolidado** — a frase única que o Head assume, com a lista de
   especialistas creditados (para o aprendizado).

Pareceres **consultivos** (Financeiro dimensiona R$, Marketing contextualiza mercado)
entram na confiança e na urgência, mas **não votam em QUAL ação** — evitam enviesar
a decisão do "o quê" com opiniões de "quanto/quando".

### Exemplo real (guerra de preço, `node mie/demo-specialists.js`)

```
Conversão   (90% → reposition)   queda composta na lista E na página
SEO         (80% → visibility)   ranking caiu ~2 posições
Comercial   (80% → reposition)   2 concorrentes cortaram preço (−12%, −18%)
Financeiro  (75% → consultivo)   ~R$ 5.064/mês em risco (margem 32%)
Conselho:  concordância de 2 (conversão, comercial) · "reposition" · confiança 85% · força 73%
Divergentes: SEO (visibility)
```

## Votação com pesos dinâmicos

O peso de cada voto **não é fixo** — combina quatro fatores:

```
peso = acurácia_histórica × qualidade_das_evidências × confiança × afinidade_ao_problema
```

- **Acurácia histórica** (0,5–1,5): quem acerta ganha peso, quem erra perde (Memory).
- **Qualidade das evidências**: mais fatos concretos, mais peso.
- **Confiança**: a confiança declarada pelo próprio especialista.
- **Afinidade**: quem entende mais de cada tipo de problema (ex.: SEO pesa mais em
  `ranking_drop`; Operação em `stockout`; Concorrência em `competitor_surge`).

## Memória de acertos (o conselho aprende)

Quando uma decisão derivada do consenso é executada e **medida** (Learning Engine),
os especialistas creditados sobem ou descem de peso — uma média móvel entre 0,5
(erra sempre) e 1,5 (acerta sempre). Com o tempo, o conselho se auto-organiza:
especialistas confiáveis dominam a votação nos problemas que dominam.

## Onde a decisão continua sendo tomada

**O Conselho opina; ele não decide.** A causa provável continua vindo do playbook
(MIF Parte 2); a proposta, do `proposalFor` do playbook; o destino (executar /
recomendar / observar / interromper), do Motor de Priorização sob a Constituição.
O parecer consolidado é uma **camada consultiva** que enriquece o diagnóstico e
alimenta o aprendizado — nunca sobrepõe os motores (verificado por teste:
"nada regride: Conselho é advisory").

## Fluxo no MIE

```
anomalia → Investigation Engine
   ├─ consulta os 7 especialistas (pareceres ricos)
   ├─ Conselho delibera → consenso + consolidado + contributingDomains
   ├─ playbook determina causa e proposta (MIF)     ← a decisão real
   └─ diagnosis.council anexado ao diagnóstico
→ Prioritization decide o destino
→ Execution registra contributingDomains na previsão
→ Learning credita/debita os especialistas ao medir o resultado
```

## Arquivos

```
mie/src/specialists/roster.js    ← os 7 especialistas + parecer rico
mie/src/specialists/council.js   ← deliberação, votação ponderada, afinidades
mie/src/specialists/index.js     ← montagem (API retrocompatível)
mie/src/engines/memory.js        ← histórico de acertos (recordSpecialistOutcome)
mie/test/specialists.test.js     ← 10 testes
mie/demo-specialists.js          ← demo legível do conselho
```

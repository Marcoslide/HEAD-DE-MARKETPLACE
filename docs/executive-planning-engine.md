# Executive Planning Engine — o Head como diretor, não analista

> Sprint 08. Camada Cognitiva (MIE). A camada que transforma **inteligência em
> prioridade executiva**. É o que faz o Head parecer um diretor de marketplace:
> ele não entrega tudo que encontra — **ele filtra**.

## Como rodar

```bash
node --test mie/test/executive-planner.test.js   # 15 testes (os 12 obrigatórios + extras)
node mie/demo-executive.js                        # o plano do dia, auditável
# HTML funcional (abre direto no navegador, sem servidor):
design/prototipo-v3/index.html
```

## O princípio

O Head não pode entregar tudo que encontra. De **317 sinais**, ele **ignora 302**,
investiga 15, transforma 8 em missões, resolve 5 sozinho e traz **apenas 2 decisões**
para o dono. Essa é a experiência: um diretor que protege a atenção do empresário
(Art. 3 — vende tranquilidade, não ansiedade; Art. 19 — só decisões chegam ao dono).

## Os 7 níveis de prioridade executiva

Cada item é classificado num destes níveis (do menor ao maior comprometimento):

```
IGNORAR · OBSERVAR · INVESTIGAR · CRIAR MISSÃO ·
PEDIR APROVAÇÃO · EXECUTAR AUTOMATICAMENTE · INTERROMPER IMEDIATAMENTE
```

## O score executivo (auditável)

Não é regra simplista. `classify()` devolve a decomposição completa:

```
score = impacto(R$/mês) × confiança × urgência ÷ esforço
        × 1,5  se a janela de decisão expira
        × 1,2  se é padrão recorrente
        × 1,15 se há aprendizado anterior aplicável (Knowledge Graph)
        × (0,9 + 0,3 × força do consenso do conselho)   (Specialists Engine)
        ÷ 2    se a ação é irreversível (risco de agir cedo)
        × (1 − 0,5 × relutância do dono)                (recusa anterior)
        (teto baixo se a confiança é baixa)
```

Cada fator é rastreável no `breakdown` — o painel "Como o EPE priorizou" no HTML e o
`/__dev` mostram impacto, urgência, confiança, esforço, risco de esperar, risco de
agir cedo e o score final. **Zero caixa-preta.**

### Como o nível é decidido

| Situação | Nível |
|---|---|
| Incidente (severidade crítica) | INTERROMPER |
| Impacto alto + urgência alta + janela + score altíssimo | INTERROMPER |
| Proposta Classe C, score ≥ limiar, reversível, confiança ok | PEDIR APROVAÇÃO |
| Proposta Classe A/B (autorizada), reversível, rápida | EXECUTAR AUTOMATICAMENTE |
| Proposta Classe A/B (autorizada), multi-etapa | CRIAR MISSÃO |
| Sinal relevante ainda sem causa | INVESTIGAR |
| Impacto moderado / confiança baixa / fora da janela | OBSERVAR |
| Impacto abaixo do mínimo / ruído | IGNORAR |

## Silêncio inteligente

O EPE prova que sabe **não** falar. Vira OBSERVAR ou IGNORAR (com o motivo registrado)
quando: o sinal é fraco; é ruído de CTR com conversão estável; há tendência sem
confiança suficiente; o evento é relevante mas fora da janela de decisão; ou o impacto
é baixo demais para incomodar o dono. Tudo fica auditável na seção "O que eu decidi
não te mostrar" — mas fora do caminho do empresário.

## Capacidade operacional do dia

A empresa só executa N missões/dia e o dono só decide M coisas/dia (default 5 e 2).
Havendo 30 oportunidades, o EPE **seleciona as melhores** por score executivo e manda
o excedente para OBSERVAR com o motivo "capacidade operacional do dia". A mesa do dono
nunca estoura (Art. 13 — fila curta por princípio).

## O plano do dia

`planDay({ capacity })` produz:

- **funil**: sinais encontrados / ignorados / investigados / missões criadas /
  resolvidos / decisões para o dono;
- **atenção**: a lista curta do que realmente importa hoje (com o porquê);
- **decisões** priorizadas (com breakdown auditável de cada uma);
- **missões** ordenadas por prioridade executiva;
- **silêncio**: o que foi filtrado e por quê;
- **breakdown por nível** (auditoria) e a assinatura do Head.

## Integrações

O EPE usa toda a inteligência já construída:

- **Specialists Engine** — a força do consenso do conselho entra no score.
- **Knowledge Graph** — o reuso de aprendizado anterior aumenta a prioridade.
- **Memory Engine** — a relutância do dono (recusas anteriores) reduz propostas semelhantes.
- **Prioritization** — reusa o cálculo de impacto em R$.
- **Investigation** — os candidatos vêm dos diagnósticos.
- **Learning** — os resultados medidos alimentam o funil (resolvidos).
- **MieBridge / Observability** — o plano é espelhado e auditável no `/__dev`.

## Como ele evita os dois erros clássicos

- **Excesso de notificações**: capacidade + silêncio inteligente + Art. 19 — só o que
  merece chega ao dono; o resto o Head toca ou observa.
- **Agir tarde demais**: o "risco de esperar" (urgência × janela) empurra o que tem
  janela curta para INTERROMPER; o "risco de agir cedo" (irreversibilidade) segura o
  que é arriscado — o EPE equilibra os dois.

## Arquivos

```
mie/src/engines/executive-planner.js   ← o motor (classify + planDay)
mie/src/core/config.js                 ← limiares do EPE (CONFIG.EPE)
mie/test/executive-planner.test.js     ← 15 testes
mie/demo-executive.js                  ← demo do plano do dia
design/prototipo-v3/                    ← HTML funcional (Plano do Dia)
```

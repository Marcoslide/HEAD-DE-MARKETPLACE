# MIE — Marketplace Intelligence Engine

> **A Camada Cognitiva do Marketplace Operating System.**
> Sete motores desacoplados que transformam sinais em decisões executáveis — obedecendo à `CONSTITUICAO.md`, ao `MIF.md` e ao `MOS.md` em cada passo, com trilha de auditoria completa.
>
> Nesta fase (Sprint 04): **zero APIs, zero banco definitivo, zero LLM externo, zero dado real.** O objetivo é provar que o cérebro funciona — confiável, previsível, auditável e evolutivo, como o núcleo de um carro autônomo.

## Como rodar

```bash
# testes (17 cenários de conformidade Constituição × MIF × MOS)
node --test mie/test/mie.test.js

# tela de debug (os motores trabalhando, ao vivo)
# abrir no navegador — sem servidor, sem build, sem dependências:
mie/debug/index.html
```

```js
// uso programático
const NS = require('./mie/src/index.js');
const mie = NS.createMIE({ seed: 42 });
mie.runDays(17);                                  // aquece o "normal" da operação
mie.world.applyScenario('price-war', { productId: 'p1' });
mie.runDays(4);                                   // observa → investiga → prioriza
const d = mie.prioritization.pendingDecisions()[0];
mie.approve(d.id);                                // decisão → plano com previsão
mie.runDays(9);                                   // janela vence → mede → aprende
```

## Arquitetura

```
                          ┌──────────────────────────────────────┐
                          │  MUNDO (sim/world.js)                │
                          │  simulado, determinístico (semente)  │
                          │  ÚNICO módulo substituído quando o   │
                          │  Collector/APIs reais chegarem       │
                          └──────────────┬───────────────────────┘
                                         │ lê
   ┌───────────────┐   tick   ┌──────────▼──────────┐
   │ SCHEDULER     ├─────────▶│ OBSERVATION ENGINE  │  aprende o normal (Memory)
   │ ciclos, nunca │          │ vigília; detecta    │  e emite anomalias
   │ parado        │          │ desvios vs. normal  │
   └──────┬────────┘          └──────────┬──────────┘
          │ mede planos                  │ anomaly.detected
          ▼                              ▼
   ┌──────────────┐          ┌─────────────────────┐    consulta   ┌──────────────┐
   │ EXECUTION    │          │ INVESTIGATION ENGINE│◀──────────────│ ESPECIALISTAS│
   │ planos com   │          │ 11 etapas do Art. 5 │  pareceres    │ (7 domínios) │
   │ previsão     │          │ + playbooks do MIF  │               └──────────────┘
   │ ANTES        │          └──────────┬──────────┘
   └──────┬───────┘                     │ diagnosis.ready
          │ result.measured             ▼
          ▼                  ┌─────────────────────┐
   ┌──────────────┐          │ PRIORITIZATION      │──▶ EXECUTE (alçada A/B)
   │ LEARNING     │          │ score MIF 7.1 +     │──▶ RECOMMEND (fila do dono)
   │ previsto vs. │          │ destinos Art. 13/19 │──▶ INTERRUPT (com ação em curso)
   │ medido →     │          └─────────────────────┘──▶ OBSERVE (silêncio)
   │ conhecimento │                                 ──▶ DISCARD
   └──────┬───────┘
          ▼
   ┌──────────────┐          ┌─────────────────────┐
   │ MEMORY       │          │ HEAD REPORTER       │  a ÚNICA fronteira com o
   │ normal ·     │─────────▶│ briefing na voz do  │  usuário (Art. 11) — é aqui
   │ biblioteca · │          │ Head (Art. 20)      │  que um LLM entrará no futuro
   │ preferências │          └─────────────────────┘
   └──────────────┘
```

### Como os motores conversam entre si

**Exclusivamente pelo EventBus** (`core/event-bus.js`). Nenhum motor importa outro motor; cada um publica e assina eventos com contrato documentado no topo do arquivo. Isso garante as quatro propriedades exigidas:

- **Desacoplado** — trocar a implementação de um motor não toca os demais.
- **Testável** — qualquer motor roda sozinho com um bus e um mundo falso.
- **Substituível** — o Investigation Engine de hoje (playbooks determinísticos) pode ser trocado por um com raciocínio de LLM sem mudar uma linha dos outros seis.
- **Auditável** — todo evento passa pelo `AuditLog` (a caixa-preta): `mie.audit.entries` é a história completa e reproduzível da cognição.

### Como uma decisão percorre o sistema

O caminho da guerra de preço (o cenário canônico), com os eventos reais:

```
1. world: concorrentes cortam preço → conversão de p1 cai
2. Scheduler.tick() → Observation.scan()
     signal.observed (conv, z=-4.2) → anomaly.detected {kind: sales_drop}
3. Investigation.open() → investigation.opened
     percorre as 11 etapas do Art. 5 (investigation.step × 17):
     histórico → memória → 7 pareceres → comportamento → playbook MIF 2.2
     (dimensionar/localizar/dentro/fora/demanda/reputação) → 4 hipóteses →
     eliminação por timing ("a impressão digital") → confiança 0.85 (alta)
     → diagnosis.ready {cause: competitor_price_cut, proposal: reposition}
4. Prioritization.classify() → score = impacto×prob×urgência÷esforço
     proposta Classe C → decision.created (fila do dono)
     [se fosse ruído: watch.added e o dono nunca fica sabendo]
5. dono aprova → decision.approved → Execution.execute()
     plan.created com PREVISÃO REGISTRADA ANTES (Art. 15) + reversibilidade
6. janela de 7 ciclos vence → result.measured {previsto 8-12%, medido 15%}
7. Learning.evaluate() → learning.recorded → Memory.absorb()
     conhecimento "strategy.reposition" força ●○○ → cycle.closed
8. HeadReporter → briefing.ready: "Estimei 8–12%; deu 15%."
```

### Como o aprendizado acontece

Fluxo obrigatório (Art. 15), implementado em `engines/learning.js`:

```
decisão → resultado → avaliação (previsto vs. medido) → aprendizado
        → atualização da memória → atualização da estratégia
```

- **Nenhuma execução sem previsão registrada antes** — o Execution Engine grava `prediction` no plano no momento da criação; o teste `ciclo completo` falha se isso for violado.
- **Acerto** → conhecimento reforçado (`strength` sobe até 3 = padrão da casa).
- **Erro** → autópsia curta (Art. 18): o conhecimento é rebaixado e marcado `needsRevalidation` — nunca apagado; a calibração das previsões (`memory.calibration`) registra o viés.
- **Recusa do dono** → vira preferência (`memory.preferences`) e **reduz o score** de propostas futuras do mesmo tipo (o Head aprende o jeito do dono de decidir).

### Como a memória evolui

`engines/memory.js`, quatro camadas:

| Camada | O que guarda | Como evolui |
|---|---|---|
| `baselines` | o **normal** de cada métrica de cada produto (média + desvio, Welford) | aprende no aquecimento (14 ciclos) e continua ajustando fora de anomalias — nunca aprende durante um incêndio |
| `knowledge` | a biblioteca viva na forma fixa do MIF 8.1 | repetição ↑força · contradição ↓força + revalidação |
| `preferences` | o jeito do dono (recusas e motivos) | cada recusa aumenta a `reluctance` do tipo de proposta |
| `decisions` | histórico completo | consultado na etapa 2 de toda investigação ("isso já aconteceu?") |

O Art. 17 (inteligência adaptativa) está no fato de que **não existe benchmark fixo em lugar nenhum do código**: todo julgamento é z-score contra o normal aprendido *daquela* operação.

### Como o MIE respeita a Constituição, o MIF e o MOS

Cada regra soberana tem endereço no código **e** teste que a protege:

| Regra | Implementação | Teste |
|---|---|---|
| Art. 5 — fluxo de raciocínio obrigatório | `investigation.js` (`MANDATORY_STEPS`, 11 etapas em ordem) | `Art. 5: nenhuma investigação pula etapas` |
| Art. 9 — confiança sempre declarada | `calcular_confianca` em todo diagnóstico | `Art. 9: todo diagnóstico declara nível de confiança` |
| Arts. 10-11 — especialistas invisíveis, parecer fixo | `specialists/index.js` (formato fixo; só o HeadReporter fala) | `Art. 11: especialistas emitem parecer no formato fixo` |
| Art. 12 — investigar antes de diagnosticar | anomalia NUNCA vira decisão sem passar pelo Investigation | arquitetura: só `diagnosis.ready` chega ao Prioritization |
| Art. 13 — fila curta, score MIF 7.1 | `prioritization.js` (score + dedupe de equivalentes) | `Art. 13: fila nunca recebe duplicadas` |
| Art. 14 — nunca parado | `scheduler.js` (rotina emite atividade em todo ciclo) | `Art. 14: atividade em todo ciclo` |
| Art. 15 — previsão antes da execução | `execution.js` (plano nasce com `prediction`) | `ciclo completo` |
| Art. 17 — o normal antes do bom | `memory.js` (baselines por operação; aquecimento sem alarme) | `Art. 17: durante o aquecimento, nada de alarme` |
| Art. 18 — recusas ensinam, erros têm autópsia | `learning.js` + `memory.recordPreference` | `recusa: vira preferência` |
| Art. 19 — só decisões chegam ao dono | destinos OBSERVE/DISCARD em `prioritization.js` | `ruído de CTR: dono não é interrompido` |
| MIF 2.1 — timing é a impressão digital | testes de eliminação dos playbooks | `guerra de preço: acha a causa certa` |
| MIF 3.1 — preço é a última alavanca | proposta de guerra de preço = `reposition`, nunca cobrir | idem |
| MIF Parte 6 — parada antecipada só por dano | hipótese `own_change` ignora experimento do Head em janela | `MIF Parte 6: não reverte o próprio experimento` |
| MIF 8.2 — força sobe/desce com evidência | `memory.absorb` | `MIF 8.2: conhecimento sobe de força` |
| MOS Fluxo 008 — alarme só com ação em curso | `execution.firstResponse` no mesmo ciclo do interrupt | `anúncio derrubado: ação já em curso` |

## Estrutura de arquivos

```
mie/
├── README.md                  ← este documento
├── src/
│   ├── _ns.js                 ← namespace compartilhado (Node + navegador)
│   ├── index.js               ← entrada Node
│   ├── create.js              ← composição dos 7 motores
│   ├── head-reporter.js       ← fronteira com o usuário (voz do Head)
│   ├── core/
│   │   ├── audit-log.js       ← a caixa-preta
│   │   └── event-bus.js       ← o único canal entre motores (contrato)
│   ├── sim/world.js           ← mundo simulado, semente fixa, 6 cenários
│   ├── engines/
│   │   ├── observation.js     ← vigília; detecta desvios vs. o normal
│   │   ├── investigation.js   ← 11 etapas do Art. 5 + playbooks
│   │   ├── prioritization.js  ← score MIF 7.1 → 5 destinos
│   │   ├── execution.js       ← planos simulados com previsão obrigatória
│   │   ├── learning.js        ← previsto vs. medido → conhecimento
│   │   ├── memory.js          ← normal · biblioteca · preferências · histórico
│   │   └── scheduler.js       ← ciclos simulados; nunca parado
│   ├── specialists/index.js   ← o conselho (7 domínios, parecer fixo)
│   └── playbooks/index.js     ← MIF Parte 2/3/5 como dados executáveis
├── test/mie.test.js           ← 17 testes de conformidade
└── debug/index.html           ← Debug Console (abre no navegador)
```

## A pergunta estratégica

> **"Se amanhã eu substituir o modelo de IA (Claude, GPT, Gemini ou outro), o Marketplace Operating System continuará funcionando da mesma forma?"**

**Sim — e este Sprint é a prova executável disso.** O MIE inteiro roda hoje com **zero chamadas a LLM**: a investigação é playbook do MIF, a priorização é o score da Constituição, o aprendizado é comparação previsto-versus-medido, a memória é da empresa. Um LLM entrará no futuro em exatamente dois pontos de borda — como **redator** (HeadReporter: transformar o briefing estruturado em prosa da voz do Head) e como **intérprete** (transformar o pedido do usuário em evento para os motores) — e nesses papéis qualquer modelo é substituível por outro sem alterar uma linha dos motores, das regras, da memória ou da doutrina. A inteligência do produto não está no modelo; está na pilha Constituição + MIF + MOS + Memória, que é nossa.

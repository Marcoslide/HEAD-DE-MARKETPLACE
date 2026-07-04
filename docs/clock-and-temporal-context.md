# Clock Injetado e Contexto Temporal Unificado

> Sprint 08.1. Camada Cognitiva (MIE). O tempo deixa de ser um detalhe
> implícito do runtime e passa a ser **parte explícita, injetável e testável
> do contexto de decisão**. Um diretor de marketplace sabe *que horas são* —
> e o Head também precisa saber, de forma determinista e auditável.

## Por que um Clock

Antes desta camada, "tempo" era o que `new Date()` devolvesse no instante da
execução — impossível de congelar, difícil de testar, e sem fuso definido. Um
Head que decide "agir agora ou esperar?" precisa de um relógio confiável:

- **determinismo** — sob um relógio congelado, o mesmo estado gera o mesmo
  plano, com o mesmo carimbo de tempo (testes reproduzíveis);
- **fuso da operação** — o "dia" do empresário é o dia em `America/Sao_Paulo`,
  não o dia UTC do servidor. 23h em Brasília ainda é *hoje*, mesmo que já seja
  *amanhã* em UTC;
- **proveniência** — quando os eventos reais chegarem (Shopee, ML, Amazon,
  WhatsApp), cada fato terá quando **ocorreu**, quando foi **observado**, quando
  foi **decidido** e quando foi **executado**.

## Dois relógios que coexistem

O MIE tem **dois** conceitos de tempo, e eles não se confundem:

| | O que é | Para que serve |
|---|---|---|
| **Dia simulado** (`NS._currentDay`) | contador de **ciclos** do mundo determinístico | score, decaimento do grafo, janelas de medição |
| **Clock de parede** (`clock`) | tempo real em **ISO/timezone** | proveniência, hora da decisão, geração do plano |

Um é a **cadência interna** do motor; o outro é o **relógio do mundo**. O
Knowledge Graph, por exemplo, decai arestas pelo dia simulado (`clock()` →
contador) **e** carimba `createdAtIso`/`lastAtIso` pelo Clock de parede
(`wallClock.nowIso()`).

## A API do Clock

`mie/src/core/clock.js` — zero dependências, roda em Node e no navegador.

```js
const clock = createClock({ now = () => new Date(), timezone = 'America/Sao_Paulo', kind = 'system' });

clock.timezone      // 'America/Sao_Paulo'
clock.kind          // 'system' | 'frozen'
clock.now()         // Date
clock.nowMs()       // number (epoch ms)
clock.nowIso()      // '2026-07-04T12:00:00.000Z'
clock.today()       // '2026-07-04'  (dia LOCAL na timezone)
clock.dateKey(date) // dia LOCAL de qualquer Date/ISO
clock.dayBounds()   // { dateKey, startIso, endIso } do dia local, em UTC
clock.stampEvent(e) // preenche observedAt se ausente
```

Exports auxiliares:

```js
NS.systemClock                    // singleton do relógio do sistema
NS.frozenClock(iso, tz?)          // relógio congelado (kind: 'frozen') p/ testes
NS.stampEvent(clock, evt)         // carimba observedAt via o Clock dado
NS.time                           // helpers temporais PUROS (sem regra de negócio)
```

### Helpers temporais puros (`NS.time`)

Sem nenhuma regra de marketplace dentro — só aritmética de tempo:

```js
time.diffMinutes(a, b) · time.diffHours(a, b) · time.diffDays(a, b)
time.isExpired(expiresAt, asOf)              // a janela já passou?
time.isRecent(ts, asOf, withinMs = DAY)      // aconteceu há pouco?
time.waitingMs(since, asOf)                  // há quanto tempo espera
time.windowsOverlap(aS, aE, bS, bE)          // duas janelas se cruzam?
```

## Integração

`createMIE({ clock, ... })` aceita um Clock injetado. **Sem Clock informado,
usa o `systemClock`.** O objeto retornado expõe `mie.clock`, e todo motor com
contexto operacional recebe o mesmo relógio:

```js
const mie = createMIE({ clock: frozenClock('2026-07-04T09:00:00Z') });
mie.clock === mie.epe.clock === mie.memory.clock;   // o mesmo relógio
mie.graph.wallClock === mie.clock;                  // proveniência do grafo
```

### O plano do dia carrega o tempo

`epe.planDay()` grava o contexto temporal no plano — de onde veio o briefing:

```js
plan.generatedAt      // epoch ms
plan.generatedAtIso   // '2026-07-04T11:00:00.000Z'
plan.timezone         // 'America/Sao_Paulo'
plan.dateKey          // '2026-07-04'  (dia local)
```

### A janela de decisão que expira

Se um candidato traz `expiresAt` e a janela **já passou** (pelo Clock), o EPE
**rebaixa o item para OBSERVAR** — a chance de agir passou. A **fórmula do
score não muda**; muda apenas o nível executivo. Incidente crítico é a exceção:
risco imediato interrompe de todo jeito.

```js
epe.classify({ ...forte, expiresAt: '2026-07-04T08:00:00Z' }).level  // → OBSERVAR (expirado)
epe.classify({ ...forte, expiresAt: '2026-07-04T20:00:00Z' }).level  // → PEDIR APROVAÇÃO
```

### Proveniência na memória e no grafo

Registros novos ganham carimbo de mundo real, **sem forçar registros antigos**
a terem todos os campos (retrocompatível):

- memória: `knowledge.observedAt`, `preferences.observedAt`, `decisions.decidedAt`;
- grafo: `nodes.createdAtIso`/`lastAtIso`, `edges.createdAtIso`/`lastAtIso`.

### Contrato de evento futuro

Quando as integrações reais chegarem, cada evento seguirá:

```js
{ source, eventType, occurredAt, observedAt, payload, metadata }
```

`observedAt` é preenchido pelo Clock injetado se a origem não informar
(`clock.stampEvent(evt)` / `NS.stampEvent(clock, evt)`). Nada de integração
externa é iniciado nesta camada — só o **contrato** fica pronto.

## No /__dev

`GET /__dev/mie` expõe o relógio ativo:

```json
"clock": {
  "timezone": "America/Sao_Paulo",
  "now": "2026-07-04T12:00:00.000Z",
  "today": "2026-07-04",
  "kind": "system",
  "lastPlanGeneratedAt": "2026-07-04T11:00:00.000Z"
}
```

## A regra de ouro

**Nenhum motor do MIE chama `new Date()` ou `Date.now()` diretamente — só
`mie/src/core/clock.js`.** O teste `mie/test/clock.test.js` (caso 12) varre
`mie/src` inteiro e falha se qualquer arquivo, exceto o Clock, usar `Date`
diretamente. O tempo tem uma única porta de entrada.

## Arquivos

```
mie/src/core/clock.js         ← o Clock (createClock/frozenClock/systemClock/time)
mie/src/create.js             ← injeta o Clock em todos os motores
mie/src/engines/executive-planner.js ← generatedAt no plano + janela que expira
mie/src/engines/memory.js     ← observedAt/decidedAt nos registros
mie/src/graph/knowledge-graph.js ← createdAtIso/lastAtIso (wallClock)
mie/test/clock.test.js        ← 12 testes (inclui a varredura anti-Date)
mos/src/interfaces/http/observability.js ← Clock ativo no /__dev
```

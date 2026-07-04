# ROADMAP — Marketplace Operating System

> **O que estamos construindo é um Marketplace Operating System (MOS).**
> O Head de Marketplace é a interface humana desse sistema operacional. Por baixo dele: os motores de inteligência, os especialistas, os playbooks do MIF, a Constituição, a memória e os fluxos operacionais.
>
> **Nós não desenvolvemos funcionalidades. Nós construímos camadas de inteligência.**
> A pergunta de organização nunca é "em qual sprint isso entra?" — é **"a qual camada isso pertence?"**.

---

## A arquitetura em camadas

Da base ao topo — cada camada se apoia nas de baixo e serve às de cima:

```
┌──────────────────────────────────────────────────────────────────┐
│ 6 · CAMADA DE EXPERIÊNCIA                                        │
│     interface, conversa, briefing, operações, acompanhamento     │
│     → docs/01–05 · design/prototipo-v2 · chat · WhatsApp (face)  │
├──────────────────────────────────────────────────────────────────┤
│ 5 · CAMADA DE EXECUÇÃO                                           │
│     Collector, APIs oficiais, publicação, WhatsApp (canal),      │
│     automações, backend e banco                                  │
├──────────────────────────────────────────────────────────────────┤
│ 4 · CAMADA COGNITIVA                                             │
│     os motores: Observação · Investigação · Priorização ·        │
│     Decisão · Execução · Aprendizado · Memória                   │
│     + os 7 especialistas do conselho                             │
├──────────────────────────────────────────────────────────────────┤
│ 3 · CAMADA OPERACIONAL                                           │
│     os fluxos completos da empresa → MOS.md (Fluxos 001–010)     │
├──────────────────────────────────────────────────────────────────┤
│ 2 · CAMADA DE CONHECIMENTO                                       │
│     doutrinas, playbooks, modelos mentais, Knowledge Base        │
│     → MIF.md + universidade do Head                              │
├──────────────────────────────────────────────────────────────────┤
│ 1 · CAMADA CONSTITUCIONAL                                        │
│     identidade, princípios, limites → CONSTITUICAO.md            │
└──────────────────────────────────────────────────────────────────┘
```

Regras da arquitetura:

1. **Nada furando camadas**: a Experiência não chama APIs diretamente; ela conversa com a Cognição, que opera pelos fluxos da Operacional, que executam pela camada de Execução.
2. **As camadas 1–3 são documentos, não código** — e são as mais valiosas: qualquer motor de IA futuro executa sobre elas.
3. **Conflitos resolvem para baixo**: implementação obedece ao MOS, que obedece ao MIF, que obedece à Constituição.

---

## Estado das camadas

| Camada | Estado | Artefatos |
|---|---|---|
| 1 · Constitucional | ✅ **construída** | `CONSTITUICAO.md` (25 artigos, cláusulas pétreas, Teste de Conformidade) |
| 2 · Conhecimento | ✅ **fundada** · expande sempre | `MIF.md` v1 (8 doutrinas) · Knowledge Base por vir |
| 3 · Operacional | ✅ **fundada** · cresce por acréscimo | `MOS.md` v1 (Fluxos 001–010) · fluxos 001/007/009 já executáveis em `mos/` |
| 4 · Cognitiva | ✅ **fundada** · +Specialists (S06) +Graph (S07) +EPE (S08) +Clock (S08.1) | [`mie/`](mie/README.md) — 7 motores + [Specialists](docs/specialists-engine.md) + [Knowledge Graph](docs/knowledge-graph.md) + [Executive Planning Engine](docs/executive-planning-engine.md) (prioridade executiva, plano do dia, silêncio inteligente, capacidade) + [Clock injetado](docs/clock-and-temporal-context.md) (tempo determinista/testável, proveniência, fuso da operação) + Debug Console |
| 5 · Execução | ✅ **fundada** · +Central de Marketplace (S09) | [`mos/`](mos/README.md) — backend DDD/EDA/Clean, banco (33 entidades), API REST+OpenAPI, Collector, WhatsApp, publicação e experimentação + [**Central de Marketplace**](docs/marketplace-central.md): conector oficial autenticado (ML/Shopee prontos; TikTok/Magalu estruturados), tokens cifrados, sync com watermarks, eventos idempotentes, sinais → EPE, READ_ONLY técnico |
| 6 · Experiência | ✅ **fundada** · evolui com as demais | `docs/01–05` + `design/prototipo-v2` + `design/prototipo-v3` (Plano do Dia do EPE, navegável) |

---

## As trilhas de construção

A ordem de trabalho dentro de cada trilha (uma trilha por vez avança; as outras acompanham):

### 🏛️ Fundação — concluída ✅
```
Constituição → MIF → MOS → Roadmap
```

### 🧠 Inteligência — em curso
```
Motores (MIE) → Especialistas → Memória → Aprendizado
```
1. **Motores (MIE — Marketplace Intelligence Engine)**: Observação, Investigação, Priorização, Decisão, Execução, Aprendizado e Memória funcionando sobre dados simulados. Testes provam obediência: curiosidade nunca interrompe (Art. 19); "vendas caíram" percorre exatamente o playbook MIF 2.2; nenhuma resposta pula o Art. 5.
2. **Especialistas**: o conselho dos 7 (Art. 10) entregando pareceres no formato fixo; o Head sintetiza e assume.
3. **Memória Histórica**: ontem, semana passada, mês passado, seis meses; o "normal" de cada operação; detecção de padrões.
4. **Investigação Inteligente + Conversão + Experimentação + Autonomia**: o detetive, o criador de versões, o cientista e — por fim — a iniciativa própria com alçadas (nasce o funcionário autônomo).

### 🏗️ Plataforma
```
Backend → Banco → Collector → APIs → WhatsApp → Publicação
```
1. **Backend + Banco**: a espinha que persiste memória, missões, decisões e conhecimento.
2. **Collector**: ele começa a enxergar — pesquisar, abrir anúncios, ler avaliações/perguntas, snapshots, ranking, preços, concorrentes.
3. **APIs oficiais**: Shopee, Mercado Livre, Amazon, TikTok Shop — os dados reais da operação do cliente.
4. **WhatsApp**: a voz onde o empresário vive — briefing, aprovações e conversa.
5. **Publicação**: as mãos — publicar, atualizar, criar, duplicar, adaptar (sempre versionado e reversível).

### 🎨 Experiência
```
UX → Produto → Chat → Operações
```
1. **UX**: fundada (docs/01–05 + protótipo navegável). ✅
2. **Produto**: a aplicação real sobre a Camada Cognitiva (o protótipo ganha cérebro).
3. **Chat**: a conversa conectada aos motores — cada resposta percorrendo o Art. 5 de verdade.
4. **Operações**: acompanhamento fino — missões ao vivo, linha do tempo, versões, biblioteca.

### 📚 Conhecimento (trilha permanente)
```
MIF → Knowledge Base → Aprendizado contínuo → Aprendizado Global
```
A universidade do Head: marketplaces (Shopee, ML, Amazon), CRO, SEO, copywriting, psicologia, Método REAL adaptado, precificação, comportamento — e, no horizonte, o **Aprendizado Global**: padrões agregados entre milhares de empresas, sem jamais compartilhar dados sensíveis (MIF 8.2). O efeito de rede que nenhum concorrente copia.

---

## ⭐ A estrela-polar

O critério de sucesso do projeto inteiro é este briefing ser verdadeiro:

> Bom dia.
> Enquanto você descansava, eu:
> investiguei 18 concorrentes; encontrei duas oportunidades; descobri um padrão novo; preparei três anúncios; reorganizei duas campanhas; identifiquei risco em um SKU; aumentei o orçamento de uma campanha porque você autorizou automações até R$ 500; suspendi um experimento que estava piorando a conversão.
> **Você possui apenas uma decisão importante hoje.**

Isso não parece software. Parece uma pessoa. Cada linha desse briefing depende de uma camada: a autorização de R$ 500 é a alçada Classe B (MIF 7.2) rodando na Camada Cognitiva, executada pela Camada de Execução, contada pela Camada de Experiência — sob as leis da Camada Constitucional.

---

## Regras do roadmap

1. **Toda proposta nova responde primeiro: "a qual camada isso pertence?"** Se não pertence a nenhuma, provavelmente não pertence ao produto.
2. **A ordem dentro das trilhas pode mudar; as camadas 1–3, não.** Documentos soberanos evoluem por acréscimo, nunca por conveniência.
3. **Cada entrega torna o funcionário melhor, não o software maior.** Pergunta de aceite: *"o dono sente que contratou alguém mais competente este mês?"*
4. **Trilhas equilibradas**: plataforma bonita sem inteligência é dashboard; IA inteligente sem plataforma não opera; inteligência sem conhecimento é genérica.
5. **O maior ativo não é o código** — é a pilha 1-2-3 (Constituição + MIF + MOS) mais a Memória. Código se copia; um colaborador digital com doutrina própria e memória da operação, não.

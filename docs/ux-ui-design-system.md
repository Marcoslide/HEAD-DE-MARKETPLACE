# Sprint 10.UI — Design System e Experiência de Produto (protótipo v8)

`design/prototipo-v8/` é o protótipo principal do Head Marketplace OS a partir deste sprint.
Objetivo do redesign: sair de "protótipo de IA com muitas funções" para
**software premium de inteligência, operação e crescimento para marketplaces**.

## 1. Diagnóstico do que existia (v5–v7)

| Problema percebido | Como o v8 resolve |
|---|---|
| Estética de "site de IA" (cards demais, pouca densidade) | Tabelas operacionais densas, painéis sóbrios, cor só com significado |
| Um único tema escuro | Dois temas nativos por tokens (nunca inversão), preferência salva por usuário |
| Botões sem comportamento em áreas novas | Regra MODO PRODUÇÃO: todo controle age ou explica por que não pode (`title` em todo `disabled`) |
| Filtros e abas parcialmente decorativos | Busca busca, filtro filtra, aba muda contexto — validado por auto-teste headless por área |
| Estado do dado implícito | Vocabulário canônico de 15 status (DADO SIMULADO, AGUARDANDO CONEXÃO, ESCRITA EXTERNA BLOQUEADA…) |

## 2. Mapa de reuso (nada de motor paralelo)

A UI é só apresentação. Ela compõe a MESMA camada compartilhada dos testes Node:

- `mie/src/core/clock.js` — relógio injetado.
- `mos/src/chat/*` (`HEADCHAT`) — interpretador, período, composer: o chat da Operação.
- `mos/src/compliance/*` (`HEADCOMPLIANCE`) — motor de regras consultado pelo chat.
- `mos/src/growth/demo-growth.js` (`HEADGROWTH`) — dataset comercial rotulado.
- `design/prototipo-v8/data.js` — **único arquivo novo com lógica**, em UMD: os
  testes (`mos/test/ui-v8.test.js`) importam exatamente o objeto `V8LOGIC` que o
  navegador executa (filtros, ordenação, seleção, versão, jobs, matriz, ranking).

## 3. Temas (tokens, nunca inversão)

Definidos em `styles.css` sobre `:root[data-theme="light"]` e `:root[data-theme="dark"]`:

| Token | Light | Dark | Papel |
|---|---|---|---|
| `--bg / --bg-2 / --bg-3` | #F7F6F3 / #FFF / #F0EEE9 | #111210 / #191A17 / #1F201C | superfícies |
| `--ink / --ink-2 / --ink-3` | #191A17 … | #EDECE6 … | texto (3 níveis) |
| `--accent` | #7A5A0E (âmbar profundo) | #D9A441 (âmbar) | ação primária, foco |
| `--pos / --neg / --warn / --info` | tons fechados | tons claros | **cor só com significado** |
| `--line / --scrim / --shadow` | … | … | divisórias e elevação |

- Alternância por `data-theme` no `<html>`; preferência salva em
  `localStorage["v8-theme:<usuário>"]`; sem preferência, segue `prefers-color-scheme`.
- `color-scheme` declarado nos dois temas (inputs nativos corretos).
- `prefers-reduced-motion` desliga toda animação.

## 4. Tipografia e hierarquia

- Interface: system sans (−apple-system/Segoe UI/Roboto), 14px base, números tabulares nas tabelas.
- Voz do Head (respostas, resumo do dia): serifada (`--serif`) — separa "o sistema fala" de "o sistema mostra".
- Eyebrows uppercase 10.5px para rótulos de seção; `h1` 21px/650.

## 5. Componentes (todos com estados)

Botões (`.btn` primary/ghost/danger/sm, `disabled` sempre com `title` explicando),
inputs e selects, busca, tabs com contadores, chips de filtro (`.fchip.on`),
badges de status (`.st pos/neg/warn/info` — ponto colorido + rótulo),
tabela operacional (`.tbl`: cabeçalho fixo ordenável, linha hover, linha selecionada,
ações por linha no hover, rodapé com contagem), barra de ações em massa (`.massbar` sticky),
drawer (720px, tabs internas), modal, toast (ok/erro), `.kv` para pares chave-valor,
estados vazio/erro/skeleton/callout.

## 6. Comportamento — MODO PRODUÇÃO

- **Toda aba muda contexto real**: cada área tem renderer próprio registrado em `UI.renderers`.
- **Busca/filtros/ordenação reais** (`V8LOGIC.filterProducts/sortProducts`), combináveis,
  com contagem de ativos, limpeza e **visões salvas** (cópia independente).
- **Seleção** individual, múltipla e "todos os filtrados" — só os filtrados entram.
- **Ação em massa vira job auditável** (interno, reversível); publicação externa em massa
  é **recusada** com razão (`ESCRITA EXTERNA BLOQUEADA`) e a recusa também é auditada.
- **Edição versionada**: master gera versão (autor, origem, valor anterior, impacto) e
  reavalia pendências; **não sobrescreve perfis por marketplace** (modal avisa).
  Editar o perfil da Shopee não toca Mercado Livre nem o master (teste 17).
- **Matriz de publicação** honesta por canal: bloqueio tem motivo; "não publicado"
  permite rascunho interno; publicação externa nunca é simulada como concluída.
- **Ranking** só com marketplace + palavra + posição + comparação + data + origem +
  confiança; ausência aparece como `SEM DADOS — sem posição inventada`.
- **Conexões**: nada desconectado parece ativo (sem sync fingida, sem saúde fingida).

## 7. Áreas

Home (mesa de decisão executiva — cada item abre o detalhe), Operação (mesa de comando:
conversa HEADCHAT + ações rápidas que criam rascunho/missão/intervenção reais + painel de
contexto/jobs/auditoria), Catálogo (6 subáreas; tabela de produtos com 14+ colunas,
drawer com Product Master / Perfis por marketplace / Matriz / Versões), Crescimento
(leads com etapas, afiliados, promoções com margem mínima, resultados rotulados),
Conexões (painel corporativo honesto), A Missão (execução com decisões apronváveis
internamente), Silêncio (vigilância declarada com critério de alerta), Conhecimento
(playbooks com confiança, quando usar e quando NÃO usar).

## 8. Validação

- `mos/test/ui-v8.test.js`: **28 testes** (suíte total: **335, todos verdes**).
- Headless Chromium (Playwright): auto-testes por área
  (`?uiself/catself/opself/groself/conself/miself/koself=1`), 8 áreas × 2 temas ×
  3 larguras (1440/1180/780) com **zero erros de console**, busca e drawer exercitados,
  screenshots Light+Dark, desktop e largura reduzida.

## 9. Fora do escopo (por contrato do sprint)

Landing/planos/trial/onboarding SaaS, deploy/domínio/infra, OAuth real, escrita externa
em marketplace, publicação externa de anúncios, novo motor de inteligência.

---

# Sprint 10.UI.1 — Cockpit 9.9 (refinamento sobre o v8)

Evolução do v8 existente — mesmo design system, mesmos tokens, nenhum protótipo paralelo.

## Diagnóstico corrigido

| Problema do v8 | Correção no 10.UI.1 |
|---|---|
| Espaço vazio em telas largas | `.statusline` de 6 células, cockpit em 3 colunas (até 1920px+), padding reduzido, tabelas em largura útil |
| Home "relatório inteligente" | Home = mesa executiva: faixa de status (status geral, marketplace em atenção, prioridade do dia, decisões, jobs, faturamento) + 2 colunas de decisão + rail de atividade |
| Sem barra global | Barra global operacional em todas as áreas: empresa ativa, marketplace ativo ("Todos" ou canal), período (hoje/7d/30d), ambiente, status da base, busca global, notificações, jobs, tema e perfil — **a barra muda o contexto**: `UI.setCtx` refaz a tela ativa; `V8LOGIC.globalFilter` corta entidades por empresa+canal |
| Conexões em cards / onboarding | Tabela corporativa (marketplace, empresa·conta, ambiente, status, OAuth, **leitura e escrita separadas**, última sync, saúde, erro, flags) + drawer com permissões, logs, webhooks e auditoria |
| Crescimento com cara de CRM | **Leads/pipeline removidos por completo.** Novas subáreas: Performance (funil de 12 etapas, honesto — etapa sem origem = SEM DADOS), Oportunidades (fila priorizada com evidência/hipótese/impacto/risco/responsável e ações), Pedidos Não Pagos (perda isolada entre pedido criado e pagamento aprovado; hipóteses nunca viram causa), Experimentos (hipótese+métrica+ponto de parada obrigatórios), Aceleração (gates de Ads/promoção/kit — Ads nunca conserta margem ruim), Expansão (cruzamento schema/margem/logística/estoque), Resultados e Aprendizados |
| Contraste baixo | Tokens `--ink-2`/`--ink-3` recalibrados; teste automatizado de razão WCAG (ink ≥ 7:1, ink-2 ≥ 4.5:1, ink-3 ≥ 4.0:1 nos dois temas) |
| Painéis isolados | Drawer do produto ganhou aba **Relações** (oportunidades, experimentos, missões, compliance); oportunidade abre entidade; Home abre Crescimento; pedido não pago abre produto e experimento |

## Multiempresa real

`V8DATA.meta.empresas` (2 empresas demo); todo produto tem `companyId`; trocar a
empresa na barra global troca as entidades de todas as telas.

## Validação

- `mos/test/ui-v8-cockpit.test.js`: **25 testes** novos (suíte total: **360, todos verdes**;
  o teste 24 do 10.UI foi atualizado porque Leads deixou de existir — exigência deste sprint).
- Headless: auto-testes por área + `?gbarself=1` (barra global), 1920/1366/1180/780 × 2 temas,
  zero erros de console, barra global filtrando o catálogo ao vivo, busca global, drawers de
  oportunidade/pedido não pago/conexão.

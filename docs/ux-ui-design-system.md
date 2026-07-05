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

---

# Sprint 10.UI.2 — Operational Workbench multiempresa/multiCNPJ/multiloja

## Modelo de escopo (Operational Scope Context)

```
GRUPO (g1 Líder Group · autorizado | g2 externo · NUNCA visível)
 └─ EMPRESA (e1 Líder Comércio Digital · e2 Cozinha Demo)
     └─ CNPJ (c1 Matriz MG · c2 Filial SP · c3 CNPJ Único)
         └─ LOJA (Shopee Líder Molduras MG, Shopee Galeria Diamonds,
                  ML Líder Molduras, Loja Física Lagoa Santa,
                  TikTok Shop Líder, Magalu Líder SP, …)
             └─ CONTA (a loja ML tem 2: principal + outlet)
                 └─ produto·estoque·preço·prazo·anúncio·pedido POR LOJA
```

Regras implementadas em `V8LOGIC`: `scopeAuthorized`, `empresasDe`, `cnpjsDe`,
`lojasDe`, `contasDe`, `normalizeCtx` (troca de pai limpa filhos órfãos),
`scopeDescribe`/`scopeLine` (transparência de agregação), `globalFilter`
(escopo → produtos), `margemLoja`, `lojaKpis`, `compareLojas` (≤4, com avisos
de comparabilidade), `unpaidByLoja`, `advancedFilter` (20+ operadores, AND/OR,
campo avaliado NO ESCOPO), `saveScopedView`/`viewsFor` (isolamento por
empresa), `bulkScopeSummary` (lojas/CNPJs/contas afetadas, elegíveis ×
bloqueados com motivo). Loja ≠ marketplace: loja física existe e não tem funil
digital (conversão SEM DADOS, avisada na comparação).

## Barra global hierárquica

Grupo → Empresa → CNPJ → Loja → Marketplace → Conta → Período, encadeados
(cada seletor limita o seguinte). Toda troca refaz a tela ativa e o toast
declara o recorte ("N loja(s) · N CNPJ(s) · N conta(s) · origem · período").
Jobs e notificações carregam escopo; a busca global encontra produto, loja,
CNPJ, conta, pedido não pago, missão, oportunidade, experimento e conhecimento
— sempre restrita à empresa ativa.

## Superfícies multiloja

- **Catálogo**: com loja ativa, estoque/preço/margem viram os DA LOJA;
  drawer ganhou aba **Lojas e Contas** (Loja | CNPJ | Mkt | Conta | Estoque |
  Preço | Margem | Prazo | Status | Pendência | ação "focar loja").
- **Ações em massa**: modal **Confirmar escopo** antes de executar (itens,
  elegíveis, bloqueados com motivo, lojas/CNPJs/contas afetadas); job registra
  o escopo; novas ações internas (criar missão, solicitar dado, exportar
  interno, comparar selecionados por loja).
- **Crescimento**: tabela "Por loja" com Δ vs período anterior; modo
  **Comparar Lojas** (até 4, com ranking e aviso de comparabilidade);
  Pedidos Não Pagos com coluna de loja e concentração por loja.
- **Home**: consolidado declara quantas lojas/CNPJs/contas entraram e quais
  ficaram fora por SEM DADOS; ranking de lojas, loja em queda/crescimento.
- **Missões**: filtradas pela loja do escopo.
- **Visões salvas**: guardam escopo + filtros + colunas + ordenação, com tipo
  (privada/empresa/CNPJ/loja) e isolamento testado entre empresas.
- **Limpeza de CRM**: comando de chat com "lead" é interceptado e redirecionado
  (LEADS_QUERY nunca chega à tela); zero telas/dados de lead no produto.
  O motor legado de growth (Sprint 10.B) permanece na camada compartilhada
  com seus próprios testes de contrato.

## Validação

- `mos/test/ui-v8-scope.test.js`: **29 testes** (suíte total: **389, verdes**).
- Headless: 15 cenários obrigatórios (seleção encadeada, catálogo/crescimento
  filtrados, comparação de lojas — inclusive incompatível com aviso —, não
  pagos por loja, bulk multiloja com confirmação de escopo, job auditado,
  visão por loja, isolamento entre empresas), 1920/1366/1180/780 × 2 temas,
  zero erros de console.

---

# Sprint 10.V — Commercial Productization (jornada comercial completa)

## Jornada

`DESCOBRIR → landing → criar conta → confirmar e-mail → onboarding (8 etapas)
→ grupo/empresa → CNPJs (puláveis) → lojas → marketplaces (estados) → catálogo
→ equipe → primeira missão sugerida → Ativação → trial → planos`

Arquivos: `commercial.js` (lógica UMD testável — contas, papéis, planos, trial,
convites, tickets, checklist), `gate.js` (landing + 11 telas de auth/estado +
wizard de onboarding), `admin.js` (áreas Ativação · Equipe · Planos · Suporte).
Menu ganhou o grupo "conta" com as 4 áreas novas; as 8 áreas originais intactas.

## Decisões-chave

- **Landing conectada**: mesmo design system e temas do produto; o "print" do
  hero é o próprio produto renderizado (não mockup). Sem promessa de resultado
  garantido; planos e trial declarados ("sem cartão"; escrita externa bloqueada).
- **Gate de entrada**: primeira visita → landing; qualquer parâmetro de
  validação ou visita anterior → app direto (sessão demonstrativa semeada).
  Telas: login, cadastro, recuperar/redefinir senha, confirmar e-mail, convite,
  primeiro acesso, sessão expirada, acesso negado, conta suspensa, trial expirado.
- **Onboarding cria contexto real**: grupo/empresa (`tipoDado: DADOS REAIS`),
  CNPJs sem validação externa (puláveis, adicionáveis depois), lojas com tipos
  (loja ≠ marketplace), marketplaces com 5 estados — **selecionar/conectar
  nunca habilita escrita** —, catálogo (5 modos), convites com papel+escopo e
  primeira missão derivada do que foi feito ou pulado.
- **Papéis com enforcement**: 11 papéis × 10 permissões em `V8COM.can()`;
  LEITURA não edita nada; só OWNER altera plano; a UI desabilita com a razão.
- **Trial honesto**: 14 dias, contador na barra global, estados
  ATIVO/EXPIRANDO/EXPIRADO; expirar limita o acesso e **preserva todos os
  dados** (não existe função de apagar conta).
- **Planos sem cobrança**: Starter/Pro/Scale/Enterprise com limites, recursos e
  "em breve"; upgrade cria **solicitação interna auditável**; zero Stripe,
  zero cartão.
- **Demo × real**: `guardDemoMix` recusa anexar dado simulado a empresa real;
  troca de modo é explícita e auditada; a conta real começa vazia e a
  demonstração é sempre rotulada.
- **Suporte com estados honestos**: solicitação criada → aguardando resposta →
  respondido → resolvido → indisponível; sem promessa de resposta em tempo real.

## Validação

- `mos/test/ui-v8-commercial.test.js`: 27 itens obrigatórios (suíte total:
  **411, todos verdes**).
- Headless: 10 auto-testes de área (incl. `?gateself=1` percorrendo cadastro →
  onboarding completo → Ativação e `?admself=1`), landing desktop+mobile ×
  2 temas, 8 telas de estado, jornada completa com screenshots, 12 áreas ×
  3 larguras × 2 temas — zero erros de console.

---

# Sprint 10.I — Import & Sync Engine (porta de entrada de dados reais)

**Princípio central: IMPORTAÇÃO NÃO SOMA DADOS — concilia, atualiza, versiona
e explica.** Arquivos: `import-engine.js` (motor UMD testável) e `importar.js`
(área "Importar e Sincronizar" no menu global).

## Arquitetura

- **17 perfis de importação** com status honesto (SUPPORTED /
  PARTIALLY_SUPPORTED / REFERENCE_ONLY / UNSUPPORTED — o sistema nunca finge
  importar o que não entende). Detecção por **assinatura de cabeçalho**
  configurável — as planilhas Shopee reais serviram como referência de schema;
  zero hardcode de empresa ou nicho; fixtures rotuladas.
- **Granularidade obrigatória** (TRANSACTIONAL, STATE_SNAPSHOT, DAILY_METRIC,
  PERIOD_METRIC, LISTING_METRIC, PROMOTION_METRIC, CHANNEL_ATTRIBUTION,
  FINANCIAL_SUMMARY, SERVICE_METRIC): relatório agregado gera METRIC_SNAPSHOT,
  nunca pedido individual; granularidades diferentes não se somam.
- **Chaves naturais do contrato**: pedido (mkt+conta+order), anúncio
  (mkt+conta+item), produto (company+SKU pai+variação), métrica diária
  (…+data+metric_type), promoção/cupom (…+nome/código+período), lote
  (file_hash+sheet_signature).
- **Prevenção de duplicidade em 4 camadas**: fingerprint de arquivo (idêntico →
  "ARQUIVO JÁ IMPORTADO"), fingerprint normalizado por linha (idêntico →
  duplicado evitado), chave natural (existente → **atualiza e versiona**, nunca
  soma), e sobreposição de período detectada na prévia com intervalo declarado.
- **Fontes complementares explicam, não duplicam**: contribuição por canal,
  promoção, cupom e financeiro são `explicativa: true` — `receitaConsolidada()`
  só conta o funil de vendas; testes 24-26 provam que a receita não muda.
- **Vínculo por SKU na ordem obrigatória**: ID externo → SKU variação → SKU
  pai → nome (só sugestão de baixa confiança, nunca vincula sozinho); conflito
  de SKU bloqueia aplicação da linha e o Anúncio Master do produto.
- **Anúncio Master**: sugerido por vendas pagas validadas → unidades →
  conversão → CTR → saúde operacional; estados SUGERIDO / CONFIRMADO
  MANUALMENTE / POR REGRA / BLOQUEADO POR CONFLITO / SEM MASTER; é referência
  estratégica — **não existe código que escreva preço/estoque/conteúdo de
  loja** (verificado por teste estático).
- **Rollback por lote**: remove só os efeitos do lote; registro atualizado por
  lote posterior é preservado; rollback do lote posterior restaura a versão
  anterior. Auditoria completa (quem, hash, perfil, escopo, contagens, mapper).
- **Permissões**: IMPORT_VIEW/CREATE/REVIEW/APPLY/ROLLBACK/MAPPING_MANAGE +
  MASTER_LISTING_APPROVE mapeadas nos 11 papéis do 10.V (rollback e master são
  do OWNER; LEITURA só vê).
- **Escopo e isolamento**: staging exige Grupo→Empresa→CNPJ→Loja→Conta;
  demo × importado real recusado nas duas direções.

## Integrações

Home (última importação, cobertura, conflitos), Catálogo (drawer Relações →
anúncios importados com vínculo), Crescimento (linha de cobertura importada com
origem), Conexões (tabela de origens com período coberto e duplicidades
evitadas), Ativação (checklist de dados: importar catálogo → vincular SKUs →
revisar master → vendas → performance → conflitos → cobertura).

## Validação

- `mos/test/ui-v8-import.test.js`: 39 itens obrigatórios (suíte total:
  **432, todos verdes**).
- Headless: `?impself=1` + fluxo visual completo (detecção → prévia →
  aplicar → duplicado recusado → vínculos → master) + integrações verificadas +
  13 áreas × 4 larguras × 2 temas — zero erros de console.

## Sprint 10.E.2 — Pedidos, Central de Inteligência e fontes reais de dados

**Nova regra de UX**: o usuário não vai a um "Importar" genérico. Ele entra na
área que quer analisar, vê indicadores **com fonte**, e clica em
`[ Atualizar dados desta área ]`. O upload nasce dentro de Pedidos, Catálogo,
das subáreas da Central de Inteligência, de Fontes e Histórico e da Ativação.

- **Menu novo**: Home · Operação · **Pedidos** · Catálogo · **Central de
  Inteligência** (ex-Crescimento) · Conexões · A Missão · Silêncio ·
  Conhecimento · grupo *dados* → **Fontes e Dados** (ex-Importar, também no
  botão global `⇪ Fontes` da barra) · grupo *conta*.
- **Upload local real** (`file-reader.js`): `input type=file` + drag-and-drop;
  XLSX (OpenXML parseado via DecompressionStream), CSV (delimitador e aspas),
  ZIP (extraído no staging; entrada não reconhecida é declarada), XLS binário
  → honestidade: "exporte como XLSX/CSV". Validação de extensão + MIME + 25MB.
  Fluxo: leitura local → detecção por assinatura → escopo obrigatório →
  prévia/conciliação → staging → **aplicação só após confirmação humana**.
- **Pedidos**: identidade `marketplace + conta + ID do pedido`. Reimportar
  atualiza o status (o pedido muda de aba), versiona o anterior (histórico de
  status no drawer) e nunca duplica. 10 abas (incl. Cidades e Estados e
  Histórico de Atualizações), 15 KPIs com Fonte · Período · Cobertura ·
  Qualidade; taxa sempre com fórmula e denominador. CEP protegido
  (`31270-***`); comprador só com `RAW_DATA_VIEW`.
- **Devoluções (ZIP)**: eventos cruzam por ID (`… + tipo + ID do evento`);
  nunca criam pedido; órfão vira "SEM PEDIDO CORRESPONDENTE".
- **Estoque Full**: snapshot por `… + armazém + SKU + momento` — o mais
  recente é o atual, o histórico fica. **Métricas diárias** atualizam por
  `… + data + tipo` (nunca R$10.000 + R$10.500). **Tráfego** é agregado por
  período (nada de dado diário inventado). **Afiliados** são camada
  explicativa (nunca somam na receita). **Chat** só métricas.
- **Central de Inteligência** abre na **Mesa de Inteligência**: visão geral
  (13 indicadores com fonte/última atualização; sem fonte → SEM DADOS),
  8 agentes com status honestos (ANALISADO · AGUARDANDO DADOS · DADO
  INSUFICIENTE · DADO CONFLITANTE · COBERTURA PARCIAL), fila de insights
  CRÍTICO→APRENDIZADO com fato/fonte/período/cobertura/confiança e ações
  (abrir análise, ver fontes, criar missão, acompanhar, silenciar com motivo,
  corrigir dado), e 8 cruzamentos que declaram exatamente a fonte que falta.
  17 subáreas; cada área de dados tem fonte atual, upload próprio, histórico,
  camada bruta (`Ver todas as colunas originais`), mapeamento e linhas com erro.
- **Edição/exclusão auditadas** (enforcement no motor, não no botão):
  correção manual = camada `MANUAL_CORRECTION` (motivo obrigatório, autor,
  antes/depois; original intocado); excluir da análise mantém o bruto e é
  restaurável; arquivar fonte não apaga nada; desativar vínculo e remover
  master preservam o anúncio e o histórico. Permissões novas:
  `DATA_SOURCE_*`, `RAW_DATA_*`, `ORDER_EDIT_CORRECTION`, `ORDER_ARCHIVE`,
  `PRODUCT_EDIT`, `MASTER_LINK_EDIT`, `METRIC_CORRECTION`, `INTELLIGENCE_VIEW`.
- **Testes**: `mos/test/ui-v8-orders.test.js` (29 blocos cobrindo os 40+15
  itens do contrato); suíte completa 491 verdes; validação headless com
  upload real (`setInputFiles` com XLSX construído), 13 auto-testes,
  14 áreas × 2 temas × 4 larguras, zero erros de console.

## Sprint 10.E.3 — Catalog & Listing Operating Center

**Princípio central**: `PRODUCT MASTER` (verdade interna: SKU, variações,
mídia oficial, custo, dados técnicos) × `LISTING` (projeção operacional em
marketplace + conta + loja). Editar anúncio Shopee nunca sobrescreve ML/
TikTok/Magalu; editar o master nunca apaga customização de canal; duplicar/
adaptar cria cópia interna — o original permanece intacto. Tudo
`READ_ONLY · INTERNAL_ONLY · DRAFT_ONLY` até integração oficial + aprovação.

- **Motor** (`catalog-engine.js` · V8CAT): 48 listings derivados dos 12
  produtos master, com perf rotulada (fonte/período/granularidade/cobertura/
  confiança), tags comerciais, filas de saúde, comparações, edição
  versionada, correção `MANUAL_CORRECTION`, variações com conflito de SKU
  explícito, mídia com usos por anúncio, duplicar/adaptar com relatório
  (levado/adaptado/pendente/incompatível/regra/fonte/confiança), edição em
  massa (prévia → job auditável → rollback) e 12 permissões `CATALOG_*`
  com enforcement no motor.
- **Navegação nova (21 subáreas)**: Visão Geral (abre primeiro; 23
  indicadores com fonte/período/cobertura/qualidade + bloco de fontes),
  Produtos Master, Anúncios (tabela densa configurável: SKU, IDs, EAN,
  preços, vendidos 7/30/90d, faturamento, CTR, conversão, margem, posição,
  fonte), status (Ativos/Pausados/Não Publicados/Em Revisão/Com Erro),
  Rascunhos, Variações, Fotos e Vídeos (biblioteca), Atributos, SKU e
  Vínculos, Anúncio Master, Importar Cadastro, Edição em Massa, Duplicar e
  Adaptar, Saúde e Pendências (cada fila abre no campo certo), Comparar
  Marketplaces, Histórico e Versões, Fontes e Arquivos.
- **Busca e filtros**: nome, SKU pai/variação, ID do anúncio, ID externo,
  EAN/GTIN, marca, categoria; ~35 filtros rápidos (sem venda, mais vendidos
  por período, crescimento/queda, estoque, mídia, atributos, posição 1–10/
  11–50, ganhou/perdeu posição, CTR/conversão/margem/devolução, conflito de
  SKU, sem master).
- **Ranking honesto**: leitura observada com posição, palavra-chave,
  marketplace, conta, escopo, fonte, data/hora, período, tipo, confiança e
  histórico (`#4 → #7 → #11`); sem esses campos o motor lança erro e a UI
  mostra "SEM DADOS — sem posição inventada". Queda vira hipótese, nunca
  causa confirmada.
- **Editor completo** (13 abas na linguagem da Shopee): Informação Básica,
  Especificações (estados obrigatório/pendente/importado/corrigido/
  divergente), Descrição, Informações de Vendas (comissão, imposto, margem
  bruta/líquida com fórmula, preço mínimo seguro, alertas), Variações,
  Lista de Variações, Fotos e Vídeos (upload REAL do computador via
  FileReader; principal/reordenar/remover só daquele anúncio), Fiscais,
  Envio e Logística (cruza estoque Full importado), Outros, Performance
  Comercial (métrica com fonte/período/fórmula; conversão sempre com
  denominador), Comparar Marketplaces (master × canais com divergência e
  ação), Histórico e Auditoria.
- **Importar Cadastro** vive dentro do Catálogo (template
  Shopee_mass_upload_2026-07-05_basic_template.xlsx como referência),
  usando o fluxo real de upload com staging e confirmação humana.
- **Testes**: `mos/test/ui-v8-catalog.test.js` (16 blocos cobrindo os 43
  itens do contrato); suíte completa 507 verdes; validação headless com
  upload real de foto (filechooser), 13 auto-testes, 14 áreas × 2 temas ×
  4 larguras, zero erros de console.

### 10.E.3.1 — Correção crítica do classificador de importação

Regressão real: o export `Order.all.order_creation_date.*.xlsx` foi
classificado como `SHOPEE_HOT_LISTING · REFERENCE_ONLY` porque a coluna
auxiliar "Hot Listing" (que existe DENTRO do relatório de pedidos) tinha
assinatura de 1 coluna e empatava com pontuação máxima.

Correção no motor (`detect()`):
- classificação por **conjunto de colunas**, nunca por coluna solta;
- **identificadores com peso 3×** (`ID do pedido`, `Status do pedido`,
  `Data de criação do pedido` para pedidos; `Tipo de evento` + `ID do
  evento` para devoluções) e **combinação mínima de evidências** por perfil;
- **prioridade entre perfis** (pedidos 10 > devoluções 9 > demais) e
  perfil **auxiliar** (`Hot Listing`) que só vence quando NENHUMA
  assinatura forte qualifica;
- **pontuação explicável** (`evidencias`, `identificadores`, `pontuacao`,
  `explicacao`, `confiancaLabel alta/média/baixa`) exibida na prévia como
  "Perfil sugerido · Confiança · Por que foi identificado (✓ …)";
- **correção manual**: `[ Alterar tipo de importação ]` na prévia →
  `V8IMP.reclassify()` cancela o lote antigo (trilha preservada), libera o
  fingerprint e re-estagia com `origemClassificacao: CORREÇÃO MANUAL DO
  TIPO`, auditado;
- **mapeamento obrigatório** do export real de pedidos (37 colunas):
  Hot Listing como campo auxiliar, Cancelar Motivo, Status da Devolução /
  Reembolso, rastreamento, opção/método de envio, Hora do pagamento,
  Domestic Delivered Date, preços/subtotal/descontos/cupom, taxas
  (transação/comissão/serviço/envio reversa), Total global, cidade/UF/
  país/CEP protegido, observação e nota — todo o resto permanece na
  camada bruta;
- sinônimos de coluna (`Número de referência SKU` ≈ `SKU de referência`).

Critério de aceite verificado no navegador com o XLSX real: perfil
sugerido PEDIDOS SHOPEE, destino Pedidos, aplicação liberada — nunca
REFERENCE_ONLY, nunca bloqueado pela coluna "Hot Listing". Testes C1–C4
em `ui-v8-orders.test.js`; suíte completa 511 verdes, zero regressão nas
detecções anteriores.

## Sprint 10.E.4 — Empresas, Canais de Venda e Centro de Custos

Duas áreas conectadas, simples de operar, com motor próprio
(`business-engine.js` · V8BIZ) e 21 permissões com enforcement no motor.

**Empresas e Operações** (8 subáreas): modelo visível é só
`Empresa → Canal de Venda → Conta Marketplace` (Grupo/CNPJ continuam
embaixo, opcionais). Cadastro manual em blocos com apenas nome +
responsável obrigatórios — **CNPJ é opcional**. 12 tipos de canal
(Shopee, ML, TikTok, Magalu, Amazon, Shein, loja física, site, WhatsApp,
Instagram, outros); a mesma empresa pode ter Shopee + ML + loja física.
Tudo cadastrado entra **automaticamente nos filtros globais** (empresa →
scope.empresas; canal → scope.lojas; conta → scope.contas). OAuth exige
empresa e canal definidos, mostra Empresa/Canal/Marketplace/Modo
Leitura/Escrita Bloqueada e fica honesto: "AGUARDANDO AUTORIZAÇÃO DO
PROVEDOR — nada conectado de verdade". Exclusão segura: empresa vazia
exclui com confirmação; com dados só desativa/arquiva (histórico
preservado); arquivada some do filtro padrão; reativar não religa
integrações externas.

**Centro de Custos** (12 subáreas): custos fixos (18 categorias,
periodicidade mensalizada), variáveis (17 categorias × 10 bases de
cálculo), taxas de marketplace com **prioridade explicada** (SKU →
Produto → Categoria → Conta → Canal → Empresa → padrão; "regra usada:
SKU específico" em todo cálculo; taxa sem valor = taxa inventada →
recusada), Ads/cupons/afiliados com **prioridade de dado importado real**
sobre estimativa manual, regras de rateio (11 métodos; custo fixo nunca
entra sem regra; cálculo com método/base/fonte/período/confiança —
R$ 10.000 ÷ 1.000 pedidos = R$ 10/pedido; participação 5% → R$ 500),
Economia por Produto (fórmula visível linha a linha, cada linha com
valor/fonte/regra/estimado; margem de contribuição, **margem líquida
estimada** — nunca "lucro real" —, preço mínimo seguro; cobertura
insuficiente declarada quando falta base), Margem por Canal, Ponto de
Equilíbrio (R$ 10.000 ÷ 25% = R$ 40.000; 250 pedidos; faltam 83; média
diária; "Dados insuficientes" quando não há custo/margem/vendas),
Simulador de Preço (interno — o anúncio externo NUNCA é alterado; salvar
simulação/criar missão), Histórico de Regras (alterar cria **nova
vigência**; o passado não é reescrito; custo de produto preserva vigência
anterior) e Fontes e Cobertura.

**Integrações**: aba "Economia do Produto" no editor do Catálogo
(margens e regra aplicada por anúncio; editar custo cria vigência) e
insights financeiros na Mesa da Central ("Faltam N pedidos para o ponto
de equilíbrio", "vende bem, margem abaixo da meta") com fontes/custos/
regras/período/cobertura/estimado/confiança.

**Testes**: `mos/test/ui-v8-business.test.js` (12 blocos cobrindo os 43
itens); suíte completa 525 verdes; validação headless com 15 auto-testes,
cadastro via formulário real, OAuth com escopo, 16 áreas × 2 temas × 4
larguras, zero erros de console.

## Sprint 10.E.2.2 — Data Foundation + Intelligence Activation

A importação deixou de ser "tela de upload" e virou a **base interna única e
viva**: arquivo original → camada bruta completa → mapeamento de campos →
camada normalizada → relações → indicadores → diagnósticos → inteligência →
decisão/missão/aprendizado.

- **Três níveis de campo**: bruto (toda coluna original, preservada e
  acessível), normalizado (dicionário canônico com ~85 colunas → campo
  interno, ex.: "ID do pedido" → `order_id`), derivado (cálculo com fórmula).
- **Base de Dados e Mapeamento** (dentro de Fontes e Dados, 10 subáreas):
  Campos Recebidos mostra TODA coluna com exemplo, tipo detectado, campo
  normalizado, área que utiliza e status (utilizado · preservado e
  disponível · aguardando mapeamento · inválido · excluído da análise) +
  ações (ver valores, mapear, marcar auxiliar, excluir/restaurar).
  "Hot Listing" → `order_hot_listing_flag`, campo auxiliar preservado.
- **Mapeamento manual assistido**: o owner mapeia coluna nova sem código
  (28 tipos × 22 entidades); cada mudança cria **nova versão** auditada;
  **Reprocessar** atualiza os normalizados (`IMPORT_REPROCESS`).
- **Relacionamentos automáticos por chaves seguras** (pedidos↔devoluções por
  marketplace+conta+ID; pedidos↔produtos por SKU; produtos↔anúncios por
  ID→SKU→nome-sugestão) com **fila de revisão**: relação incerta NUNCA
  vincula sozinha — evidências + confirmar/rejeitar/ignorar, auditado.
- **Cadeia explícita de 15 passos** após [Aplicar importação], com progresso
  real na tela (arquivo preservado → campos mapeados → normalizados →
  relações → dedup → cobertura → dashboards → agentes → Home → Mesa →
  Silêncio → Conhecimento → Pedidos/Catálogo/Custos → histórico) — nunca só
  "importação concluída".
- **Hierarquia de evidência**: dado real importado > normalizado interno >
  regras financeiras > integração > pesquisa > fixture. `coberturaReal()`
  desativa o indicador demo equivalente; Home mostra "BASE REAL ATIVA".
- **Mesa**: seção "O QUE MUDOU COM ESTA IMPORTAÇÃO" (fonte, período, escopo,
  entidades, indicadores, insights novos, conflitos, faltantes, ações).
  **Agentes** declaram fontes, CAMPOS usados, período, escopo, cobertura e
  confiança; sem dado, declaram a limitação. Insights separam FATO ×
  HIPÓTESE × RECOMENDAÇÃO — nunca causa confirmada sem evidência.
- **Silêncio** recebe sinais avaliados que não exigem ação (motivo + fonte +
  período); **Conhecimento** guarda fatos com prova (fontes, campos, versão
  de dados); **Centro de Custos** usa pedidos importados como vendas.
- **Catálogo**: Importar Cadastro Shopee + **Campos de Cadastro** (todo campo
  do template acessível com destino Product Master × Anúncio Shopee ×
  Variação; exige `CATALOG_RAW_FIELDS_VIEW`); nunca sobrescreve outro canal.
- **Permissões novas**: FIELD_MAPPING_EDIT, IMPORT_REPROCESS,
  INTELLIGENCE_SOURCE_VIEW, INTELLIGENCE_RULE_EDIT, PRODUCT_IMPORT_APPLY,
  CATALOG_RAW_FIELDS_VIEW (campo sensível — CEP/comprador — atrás de
  RAW_DATA_VIEW também na tela de campos).
- **Testes**: `ui-v8-datafoundation.test.js` (34 itens em 10 blocos); suíte
  completa 535 verdes; validação headless do critério de aceite completo
  (38 colunas na tela, mapeamento manual, Mesa/Home/Silêncio/Conhecimento
  atualizados), 15 auto-testes, 16 áreas × 2 temas × 4 larguras, zero erros.

## Sprint 10.E.2.3 — Importação MULTIABAS real (Métricas Shopee)

Correção estrutural: o arquivo real `metricas principais .xlsx` tem **8 abas**
com **blocos internos** (linha consolidada de período + linhas diárias +
tabelas por fonte + tabelas por produto). Antes, o sistema lia só a primeira
aba como tabela plana ("linha 1 = cabeçalho"), tratava a linha agregada
`04/06/2026-03/07/2026` como um dia e não convertia números brasileiros —
pedidos vaziam e vendas ficavam R$ 0,00. Agora:

- **Leitura multiabas/multiblocos** (`V8FILE.segmentBlocks`): toda aba é
  segmentada em blocos independentes detectando linhas vazias, linhas de
  título, cabeçalhos reais e cabeçalhos repetidos. `parseXlsxBuffer` devolve
  `abas: [{ nome, headers, rows, blocos, matriz }]` (o primeiro bloco continua
  em headers/rows para compatibilidade). Cada bloco reconhecido vira um lote
  próprio (mesmo princípio do ZIP), com **aba + bloco na proveniência**.
- **Números brasileiros** (`V8FILE.parseBrNumber` / `V8IMP.brNum`):
  `335.392,51 → 335392.51` · `0,63% → 0.0063` · `1.375 → 1375`. O texto bruto
  fica preservado na camada bruta; a normalização acontece na leitura.
- **Classificação por LINHA** (nunca por posição): `DAILY_METRIC` (data única),
  `PERIOD_SUMMARY` (intervalo `dd/mm/aaaa-dd/mm/aaaa` → granularidade período,
  início/fim; **NUNCA** entra na série/gráfico diário — alimenta os totais),
  `TRAFFIC_SOURCE`, `PRODUCT_CONTRIBUTION`, `RAW_REFERENCE` (preservado).
- **Perfis novos**: `SHOPEE_METRICAS_DIARIAS` (Pedido Feito / Produto Pago — a
  aba separa a base, já que o cabeçalho é idêntico), `SHOPEE_TRAFFIC_SOURCE`
  (Card do Produto, Recomendação, Pesquisar, Afiliado, Anúncios, Lives,
  Vídeos), `SHOPEE_PRODUCT_CONTRIBUTION` (ID do Item + Produto + Status +
  métricas genéricas). `FIELD_MAP` ganhou os campos mínimos do contrato
  (`gross_sales_brl`, `orders_created`, `visitors`, `order_conversion_rate`,
  cancelados/devolvidos/compradores etc.).
- **Leitores da base**: `metricasView` (totais do período pela linha
  consolidada + série diária, com fonte/aba/período/granularidade),
  `trafficSourcesView` (classifica trafego × afiliados × ads),
  `productContribView` (contribuição por produto; vínculo incerto por ID do
  Item vai para **revisão humana**, nunca vincula sozinho).
- **Interface multiabas** no modal de upload: "Abas detectadas ✓…", "Blocos
  reconhecidos", "Registros por tipo", "Campos preservados" e ações
  [Importar todas as abas reconhecidas] / [Selecionar abas manualmente]. Cada
  bloco mostra aba/bloco de origem e a quebra de linhas (resumo de período ×
  diárias). A cadeia de 15 passos recalcula Métricas Principais, Tráfego,
  Afiliados, Ads, Catálogo, Mesa, Home, Silêncio e Conhecimento.
- **Áreas alimentadas**: Central de Inteligência → Métricas Principais mostra
  vendas/pedidos/visitantes/conversão/cancelamentos/devoluções como **dados
  importados reais** (fonte, aba, período, granularidade); Tráfego/Afiliados/
  Ads recebem as fontes; Catálogo → Anúncios mostra a contribuição por produto
  com tag de vendido e vínculo para revisão; Mesa ganha o **Analista de
  Métricas Principais** (9º agente).
- **Reimportação concilia, não soma**: fingerprint por bloco (aba + conteúdo)
  → reimportar o arquivo idêntico não cria snapshot novo nem dobra os totais.
- **Números de validação** (04/06/2026 a 03/07/2026): Pedido Feito
  R$ 335.392,51 · 1.375 pedidos · 115.043 visitantes · 0,63%; Produto Pago
  R$ 292.591,59 · 1.211 pedidos · 115.043 visitantes · 0,56%.
- **Testes**: `ui-v8-multiaba.test.js` (13 itens cobrindo os 12 critérios de
  aceite + contrato de UI); suíte completa **548 verdes**; validação headless
  com **XLSX real multiabas** subido pela tela mostrando os valores exatos na
  interface, com console limpo.

## Sprint 10.E.2.4 — Importação real de CADASTRO SHOPEE no Catálogo

Traz o cadastro real da Shopee (`Shopee_mass_upload_2026-07-05_basic_template.xlsx`)
para **dentro do Catálogo** — não numa importação genérica — e organiza
Produto Master × Anúncio Shopee × Variação, com todos os campos, sem alterar
nada externamente. Módulo autossuficiente em `catalog-engine.js` (V8CAT).

- **Identidade separada**: Product Master (verdade interna, chave SKU pai/
  vínculo humano), Anúncio Shopee (chave `marketplace + conta + item_id`),
  Variação (chave `marketplace + conta + SKU`). Nome sozinho **nunca** cria
  vínculo definitivo → `AGUARDANDO REVISÃO` com ações Confirmar/Rejeitar/
  Criar Master/Manter isolado. Conflito de SKU no mesmo escopo abre revisão.
- **Fluxo de 6 etapas** (Arquivo → Leitura → Escopo → Mapeamento → Prévia →
  Aplicação) no subárea *Importar Cadastro*: upload local real (XLSX/CSV/ZIP),
  leitura de todas as abas/blocos (reusa `segmentBlocks`), prévia com
  produtos novos, anúncios, variações, duplicidades, conflitos, pendentes e
  linhas inválidas; aplica só após confirmação humana.
- **Três camadas**: bruta (todas as abas/linhas/colunas preservadas em
  `cat.cadastro.imports`), normalizada (campos do Catálogo por entidade),
  derivada (saúde/pendência/status/vínculo). *Campos de Cadastro* lista toda
  coluna com coluna original, exemplo, tipo, destino normalizado, entidade,
  status e ação; coluna desconhecida fica *Aguardando mapeamento* e pode ser
  **mapeada manualmente** (auditado, bruto preservado).
- **Entidades e campos**: `CADASTRO_SCHEMA` distribui cada coluna entre
  Product Master / Anúncio / Variação / Logística / Fiscal / Mídia. Números
  brasileiros (preço/estoque/peso/dimensão) convertidos; NCM/origem/CEST no
  fiscal; peso embalado + L×A×C + prazo + tipo de envio na logística.
- **Mídia REFERENCIADA**: imagem/vídeo por URL vira `MÍDIA REFERENCIADA`
  (origem: importação Shopee, `pendenteValidacao: true`) — nunca baixada,
  nunca marcada como validada. Upload manual real registra `CARREGADA
  MANUALMENTE`. A aba Fotos e Vídeos separa referenciada × carregada.
- **Status REPORTADO por planilha**: `statusReportado()` mapeia Ativo/Pausado/
  Não publicado/Em revisão/Com erro/Desconhecido para "…reportado"; o anúncio
  carrega `situacao: 'STATUS REPORTADO POR PLANILHA'` — nunca "ao vivo".
- **Anúncios importados** aparecem na lista do Catálogo (foto ref., produto·
  SKU, item_id, variações, preço, estoque, status, vendidos reais, saúde) com
  detalhe por entidade (Informação Básica/Categoria/Descrição/Especificações/
  Vendas/Variações/Logística/Fotos e Vídeos/Histórico). **Saúde e Pendências**
  ganha 15 filas do cadastro (sem SKU/item_id/peso/dimensão/marca/EAN/
  categoria/foto/estoque/status, mídia só referenciada, SKU duplicado, sem
  master, variação sem vínculo) — cada uma aponta a aba certa do editor.
- **Relação com pedidos/métricas** (`cadastroRelacoes`): casa por `item_id`
  com a performance real (10.E.2.3); sem correspondência → *SEM PERFORMANCE
  VINCULADA* (nunca inventa). *Centro de Custos* recebe o preço como base de
  margem quando a cobertura permitir.
- **Reimportação concilia**: mesmas chaves → atualiza e versiona (nunca
  duplica nem soma); valor alterado registra `versoes` com antes/depois.
  Edição manual é `MANUAL_CORRECTION` (motivo obrigatório) e preserva o valor
  importado original. **Nenhuma escrita externa é disparada** — a Shopee não
  é alterada em nenhum ponto.
- **Mesa/Catálogo**: painel *O QUE MUDOU COM O CADASTRO SHOPEE* (masters,
  anúncios, variações, aguardando revisão, mídias referenciadas, pendências).
- **Permissões**: `CATALOG_IMPORT` (importar), `CATALOG_IMPORT_APPLY`
  (aplicar), `CATALOG_EDIT` (corrigir/mapear/decidir vínculo),
  `CATALOG_MEDIA_UPLOAD` (mídia manual), `CATALOG_ARCHIVE` — enforcement no
  motor, não no botão.
- **Testes**: `ui-v8-catalog-import.test.js` (34 itens = 34 testes
  obrigatórios do sprint); suíte completa **578 verdes**; validação headless
  com XLSX real do template mostrando a jornada completa dentro do Catálogo,
  console limpo.

## Sprint 10.E.3.1 — Convergência do cadastro importado para o editor completo

Consolida o cadastro Shopee importado dentro do **editor operacional de 14
abas já existente** — sem tela paralela nem segundo editor. A origem do
anúncio muda; o editor não.

- **Anúncio importado vira 1ª classe** (`cadastroConverge`): cada anúncio do
  cadastro Shopee é registrado como `cat.listings` real (com `produtoId`
  apontando para um Product Master criado em `cat.products`), e as variações
  viram `p.variacoes`. Idempotente: reimportar + reconverter atualiza, nunca
  duplica. Assim `byId`/`prodOf`/`valorDe`/`salesInfo`/`perfComercial`/
  `masterVsListings`/`fotosDe` funcionam — o **mesmo** `CAT.openEditor`.
- **Roteamento**: na lista de anúncios, o cadastro importado tem *Editar
  anúncio* → `CAT.openEditor` (editor completo); o modal antigo vira só
  *resumo* (leitura rápida). `body()` chama `ensureConverged()` antes de
  renderizar, então qualquer entrada por Anúncios/Saúde/Campos abre o editor.
- **Campos importados na aba certa**: Informação Básica (título, marca,
  proveniência: fonte/arquivo/aba/situação reportada), Especificações
  (marca/material/NCM), Descrição, Informações de Vendas (preço/estoque/SKU,
  via overrides + `salesInfo`), Variações e Lista de Variações, Informações
  Fiscais (NCM/EAN), Envio e Logística (peso/dimensões/prazo), Fotos e Vídeos
  (mídia referenciada da biblioteca), Economia do Produto (V8BIZ por SKU),
  Performance Comercial, Comparar Marketplaces, Histórico. Nada se perde:
  colunas sem aba caem em **Outros** com "Campos extras recebidos: N" +
  *mapear campo* (auditado).
- **Honestidade preservada**: mídia por URL fica `MÍDIA REFERENCIADA`
  (`referenciada:true`, `dataUrl:null`) — nunca "baixada/validada"; upload
  manual continua real. Performance só aparece com vínculo por `item_id`
  (constrói `l.perf` a partir da contribuição por produto real); sem
  correspondência, a aba declara "Performance ainda não vinculada" — nenhum
  número demo. Sem custo cadastrado, `salesInfo` retorna `semCusto` e não
  inventa margem; a Economia do Produto declara cobertura insuficiente.
- **Saúde e Pendências** aponta a aba **real** do editor (sem_ean →
  Informações Fiscais, sem_peso → Envio e Logística, sem_custo → Economia do
  Produto, sem_perf_vinculo → Performance Comercial etc.) e o clique abre o
  editor de 14 abas na aba certa — nunca o modal.
- **Edição auditada e permissões**: correção manual preserva o valor
  importado original (`MANUAL_CORRECTION`, motivo obrigatório); leitura não
  edita, designer sobe mídia mas não altera preço/fiscal. Convergência cria
  só o anúncio Shopee — ML/TikTok/Magalu intactos. **Nenhuma escrita externa.**
- **Testes**: `ui-v8-catalog-converge.test.js` (31 testes obrigatórios do
  sprint); suíte completa **599 verdes**; validação headless abrindo o
  editor completo a partir do cadastro importado, percorrendo as 14 abas com
  os dados na aba certa, em light/dark e mobile, console limpo.

## Sprint 10.E.3.1 (redesign) — Catálogo como Central Operacional

Eleva o Catálogo de "lista de produtos" para central operacional de produtos
e anúncios, com a mesma lógica que a equipe já conhece nos marketplaces —
mas melhor, porque cruza status, performance, estoque, margem e pendências
preservando a origem de cada dado. Reaproveita o editor de 14 abas, a
importação Shopee, saúde/pendências, duplicar/adaptar, Anúncio Master e
histórico já existentes; o que é novo é a camada de estado e diagnóstico.

- **Status nativo × Status operacional Head** (`statusOperacional`): todo
  anúncio preserva o **status nativo** exatamente como veio (marketplace,
  planilha ou integração) e ganha um **status operacional Head** normalizado
  em 13 estados (`PUBLICADO_E_ATIVO`, `PAUSADO_PELO_VENDEDOR`,
  `PAUSADO_PELO_MARKETPLACE`, `NÃO_PUBLICADO`, `EM_ANÁLISE`, `EM_REVISÃO`,
  `COM_VIOLAÇÃO_OU_RESTRIÇÃO`, `BLOQUEADO_EXTERNAMENTE`, `RASCUNHO_INTERNO`,
  `ARQUIVADO_INTERNAMENTE`, `STATUS_DESCONHECIDO` …), com **regra**, **origem**,
  **confiança** e revisão manual. A normalização usa o status interno + o
  texto nativo (violação/análise/revisão pesam mais) — nunca "ao vivo" sem
  integração. A tabela ganhou a coluna **Status nativo · Head** (regra e
  confiança no tooltip); o importado mostra "Ativo/Pausado reportado" + Head.
- **Diagnóstico do produto** (`diagnosticoProduto`): só o que o dado sustenta
  — Alto tráfego com baixa conversão, Produto sem venda, Muitas vendas e
  estoque crítico, CTR/Conversão abaixo da referência interna, Devolução
  acima da média, Muitas vendas e margem baixa, Foto insuficiente, GTIN
  ausente, Cadastro incompleto, Sem performance vinculada. Cada diagnóstico
  declara fato, fonte, período, marketplace, conta, campos usados, **hipótese**
  (nunca causa confirmada), confiança, impacto e ação. Coluna **Diagnóstico**
  na tabela + painel na Visão Geral; clicar filtra os anúncios pelo sinal.
- **Visão Geral operacional**: dashboard com os ~23 indicadores (cada um com
  fonte/período/cobertura/qualidade) + distribuição por **Status operacional
  Head** + **Diagnóstico do produto** (top sinais). Primeira tela do Catálogo.
- **Honestidade mantida**: ranking só com fonte/data/escopo/confiança;
  performance só com vínculo real; margem só com custo (senão "sem custo");
  mídia por URL referenciada; edição interna auditada; nenhuma escrita
  externa; **sem CRM/Leads/Pipeline** em nenhuma tela.
- **Testes**: `ui-v8-catalog-redesign.test.js` (os 33 testes obrigatórios);
  suíte completa **620 verdes**; validação headless da Visão Geral, colunas
  de status/diagnóstico, filtro por diagnóstico e importado com status
  nativo+Head, em light/dark e mobile, console limpo.

## Sprint 10.E.2.5 — Fontes Shopee REAIS (contrato de dados + idempotência)

Integra os relatórios reais da Shopee enviados pelo owner como fonte interna,
com os cabeçalhos exatos dos exports, todas as colunas preservadas e
importação idempotente (reimportar nunca duplica pedidos, vendas, estoque,
métricas, comissões ou GMV).

- **CSV com metadados antes do cabeçalho** (`parseCsvText`): o relatório de
  Ads CPC traz título + `Nome da loja` + `Período` antes do cabeçalho real; o
  parser detecta o delimitador varrendo as primeiras linhas e escolhe a
  primeira linha "larga" como cabeçalho, preservando o preâmbulo em `meta`.
- **Perfis reais** (`import-engine.js`): `SHOPEE_ADS` (Ads CPC: Nome do
  Anúncio/GMV/ROAS/ACOS → destino `ads`), `SHOPEE_AFFILIATE_REAL`
  (AFILIADO.csv: ID do pedido/Id de atribuição da comissão/Campanha do
  parceiro → destino `afiliados`), `SHOPEE_INVENTORY_FULL` (Current Inventory:
  Seller SKU ID/Warehouse/Sellable/Reserved/unitsSoldInLast30Days → `estoque`),
  `SHOPEE_CHAT_REAL` (Chats Respondidos/CSAT % → `atendimento`). O arquivo de
  Métricas Principais real (8 abas) já era lido pelo parser multiabas.
- **Chaves naturais novas**: Ads = `campanha + período`; Afiliados = `pedido +
  id de atribuição + item`; Estoque Full lê `Seller SKU ID`/`Warehouse` como
  snapshot (o mais recente vira atual, nunca soma). Ads e Afiliados são
  **explicativos** (CHANNEL_ATTRIBUTION): o GMV de Ads e a comissão de
  afiliado **não somam** no faturamento — `receitaConsolidada` os ignora.
- **Leitores**: `adsView` (campanhas com GMV/investimento/ROAS/ACOS, nota de
  não-soma), `afiliadosView` (comissão/reembolso/despesa por pedido). Central
  → Ads e Central → Afiliados mostram os dados reais com fonte e período.
- **Camada bruta**: toda coluna de cada arquivo fica preservada (Afiliados
  tem 38 colunas, Ads 35+, Estoque 25) — nada some; campos sem mapa ficam
  `PRESERVADO_AGUARDANDO_MAPEAMENTO`.
- **Validado com os arquivos reais**: script Node lê os 5 arquivos enviados,
  reconhece cada perfil, aplica e prova idempotência (snapshots estáveis na
  reimportação); headless sobe os 5 pela tela e confirma Métricas/Estoque/
  Ads/Afiliados na Central, console limpo.
- **Testes**: `ui-v8-realsources.test.js` (8 blocos: CSV com metadados, Ads,
  Afiliados, Estoque Full, Chat, colunas preservadas, idempotência, snapshot
  de estoque); suíte completa **628 verdes**.

Escopo entregue vs. spec completo 10.E.2.5: este incremento cobre o **contrato
de dados e a idempotência** (o núcleo que torna os arquivos reais utilizáveis).
O scaffolding restante do prompt — Import Ledger como página, seletor
Empresa/Loja/Conta em wizard dedicado, cabeçalhos "onde baixar na Shopee" por
aba e o toggle de análise consolidada — fica como continuação, apoiado nesta
base de fontes reais.

## 10.E.3.2 — Navegação do Catálogo: 3 áreas para o dono trabalhar

O Catálogo tinha virado um **menu técnico de banco de dados** (~22 abas:
Produtos Master, Anúncios, Variações, Fotos, Atributos, SKU e Vínculos,
Anúncio Master, Importar, Campos, Edição em Massa, Duplicar, Saúde,
Comparar, Histórico, Fontes…). Isso é arquitetura para desenvolvedor navegar.
O dono e a equipe precisam de uma arquitetura para **trabalhar sem se perder**.

O menu principal do Catálogo passa a ter **exatamente 3 áreas** (`MAIN_SUBS`):

- **Visão Geral** — central de comando. Abre por padrão. Traz o resumo por
  marketplace (ativos, pendências, não publicados) e ações rápidas contextuais
  (Abrir Rascunhos, Abrir Shopee/Mercado Livre, Importar Cadastro, Ver
  Pendências, Comparar Marketplaces).
- **Rascunhos** — tudo que ainda **não é anúncio ativo**, com subabas por
  origem (`RASC_TABS`: Rascunhos da Loja, Shopee, Mercado Livre, TikTok Shop,
  Magalu, Outros). Botões "Importar" e "Criar rascunho da loja". Regra visível:
  rascunho **nunca vira anúncio real automaticamente** — não se mistura com
  ativo.
- **Marketplaces** — hub. Sem marketplace escolhido, mostra o **picker** de
  plataformas (`MKT_LIST`: Shopee, Mercado Livre, TikTok Shop, Magalu). Ao
  escolher um, entra na operação daquele marketplace: breadcrumb "← Marketplaces",
  botão "Importar Cadastro <nome>" e a tabela de anúncios com **status nativo ×
  status Head** e diagnóstico (o contrato do redesign 10.E.3.1 continua).

**Migração é só de navegação — nada foi removido.** As 15 áreas técnicas saem
do menu principal mas continuam no sistema, agora **contextuais** (`CONTEXTUAIS`
+ `PAI_DE` mapeiam cada área ao seu pai). Quando uma área técnica é aberta por
contexto, o topo mostra um breadcrumb com **botão de volta à área principal**
(`← <área pai>`). Todos os renderers (`visaoGeral`, `anuncios`, `produtos`,
`variacoes`, `midia`, `importarCadastro`, `camposCadastro`, `edicaoMassa`,
`duplicarAdaptar`, `saude`, `compararMkts`, `historicoVersoes`,
`fontesArquivos`, `anuncioMaster`, `CAT.openEditor`) e o **editor de 14 abas**
seguem intactos. Dados, masters, listings, variações, histórico, vínculos e
permissões não são apagados; import e editor não quebram; nenhuma escrita
externa é disparada.

- **Testes**: `ui-v8-catalog-nav.test.js` (10 blocos: menu = 3 áreas; abre em
  Visão Geral; técnicas fora do menu mas presentes; subabas de Rascunhos;
  picker/breadcrumb de Marketplaces; status nativo×Head; editor de 14 abas;
  importar/pendências contextuais; renderers preservados; breadcrumb de volta +
  sem escrita externa). Headless (15/15): 3 abas, Visão Geral com resumo,
  Rascunhos por origem, Marketplaces picker→Shopee, editor 14 abas, Saúde
  acessível por contexto, dark + mobile, console limpo. Suíte completa **638
  verdes**.

## 10.E.2.5.1 — Contrato total de campos + visualização completa das fontes

O sistema não pode importar uma planilha e mostrar só meia dúzia de KPIs
escolhidos. Cada coluna recebida é memória da operação. A regra passa a ser:
**arquivo real → todas as abas → todos os blocos → todas as colunas → valor
bruto preservado → campo normalizado quando reconhecido → destino correto →
visualização na área → disponível para cruzamento da Inteligência.** Nenhuma
coluna desaparece; nenhum campo importante fica só na camada técnica.

- **Três fontes prioritárias com contrato TOTAL** (`import-engine.js`):
  - **Performance de Produtos** (`SHOPEE_PRODUCT_PERFORMANCE`, export "Análise de
    Produtos" por anúncio/variação): recebe ID do Item, Produto, Status, ID e
    Nome da Variação, SKU Principal e da Variação, e todos os campos de tráfego
    (impressões/únicas, cliques/únicos, CTR, visitantes, visualizações, rejeição,
    cliques em busca, curtidas), carrinho (visitantes/unidades/conversão) e vendas
    (pedido realizado × pago: vendas BRL, pedidos, unidades, compradores,
    conversão, vendas por pedido). Chave: `marketplace + conta + ID do Item +
    variação + período`.
  - **Devoluções e Cancelamentos** (`SHOPEE_RETURNS_REAL`, por ID da Devolução):
    ID da Devolução/Pedido, data, comprador, produto/variação/SKU, IMEI, preço,
    tempo de envio, status, tipo, quantidade, solução, motivo, observações,
    reembolso total, tempo de reembolso, retorno ao armazém. Chave: `ID da
    Devolução` (idempotente); cruza por `marketplace + conta + ID do pedido`.
    Nunca cria pedido novo (é `order_event`).
  - **Estoque Full** (`SHOPEE_INVENTORY_FULL`, todas as 22 colunas do Current
    Inventory Report): Product Name, Variations, os três SKUs, Fulfill Mode,
    Barcode, reposição, IR/ASN, Sellable/Reserved/Unsellable, Selling Speed,
    Coverage Days, Excess, e vendas 7/15/30/60/90 dias. `stockView` passou a ler
    as colunas reais (Sellable/Reserved/Unsellable), não só o campo legado
    "Disponível". Snapshot: `marketplace + conta + armazém + Seller SKU +
    momento` — a leitura mais recente é o atual, o histórico fica.
- **Campos Recebidos em toda área** (reusa `fieldCatalog`): botão/subaba que
  lista **cada coluna original** com valor de exemplo, tipo, campo normalizado,
  entidade, áreas que usam e status (`utilizado` / `preservado e disponível` /
  `aguardando mapeamento` / `excluído da análise`). Coluna sem uso fica
  preservada e mapeável — nunca some. O `FIELD_MAP` ganhou todas as colunas das
  três fontes (75 colunas reconhecidas nas fixtures, nenhuma órfã).
- **Motor de cruzamento** (`inteligencia-engine.js`, `V8INT`): junta Performance
  × Estoque × Devoluções × Cadastro pela **cadeia de prioridade** (ID do Item →
  Variação → SKU da Variação → SKU Principal → Pedido → Devolução). Nome nunca
  vincula sozinho; entidade sem chave forte vai para **fila de revisão**.
  `analises` gera insights cruzados (alto tráfego + baixa conversão; muito
  carrinho + pouco pagamento; estoque alto + baixa velocidade; estoque crítico +
  vendas crescentes; devolução alta por variação) sempre com **fato · fonte ·
  campos · período · cobertura · confiança · ação**. `fullIntelligence` lê
  tendência de vendas no Full mas **nunca afirma causa** sem grupo de comparação.
- **Estrutura em cada área da Central**: cabeçalho com **Caminho na Shopee**,
  arquivo esperado, escopo (Empresa › Marketplace › Conta), período e
  **Cobertura** (Completa / Parcial / Sem dados / Conflitante) + subabas
  (Visão Geral, Dados Detalhados por dimensão, Campos Recebidos, Cruzamentos,
  Análises/Diagnósticos, Histórico da Fonte). Sem arquivo aplicado, a área
  declara honestamente "SEM DADOS" e lista o contrato de colunas — **nunca demo**.
- **Realidade dos dados**: dos arquivos enviados, só o **Estoque Full** (Current
  Inventory) traz as colunas por SKU. O relatório de Métricas é série diária por
  fonte de tráfego (não tem ID do Item/SKU por produto), e não há arquivo de
  Devoluções ainda. Por isso Performance e Devoluções entram com **contrato +
  parser + estrutura completos**: no instante em que o export real for enviado,
  toda coluna entra, aparece e cruza — sem inventar nada enquanto isso.
- **Testes**: `ui-v8-contrato-total.test.js` (31 blocos obrigatórios: todos os
  campos de Performance/Devoluções/Estoque; ID do Item/variação/SKU como chave;
  funil só com etapas presentes; reembolso e período reais; devolução não vira
  pedido; snapshot não soma; cruzamento por SKU; Campos Recebidos lista tudo;
  campo sem uso preservado; toda análise com metadados; sem causa sem evidência;
  idempotência; sem escrita externa). Suíte completa **669 verdes**. Headless:
  as três fontes injetadas renderizam com subabas, Campos Recebidos, Cruzamentos
  e Análises; console limpo, light/dark/mobile.

## 10.E.3.3 — Catálogo operacional: SKU como chave, Matriz da Loja, foto real, publicação controlada (Parte 1)

O Catálogo vira o núcleo que conecta o ciclo do produto: Matriz da Loja →
Rascunho → mídia → validação → aprovação → publicação controlada → identidade
externa (Item ID + SKU) → inteligência, criativos e aprendizados. O SKU deixa
de ser só dado de estoque/pedido e passa a ser **chave estratégica**.

- **Ciclo de vida rastreável** (`catalog-engine.js`): 16 estados (`LIFECYCLE`,
  de `MATRIZ_DA_LOJA` a `ARQUIVADO_INTERNO`) com transições permitidas
  (`transicionar`). Rascunho nunca é ativo; aprovação interna ≠ publicação
  externa; ativo só após retorno oficial.
- **Matriz da Loja** (`matrizDaLoja`): a verdade interna reutilizável do produto
  (SKU pai, marca/material/dimensões/GTIN/NCM, custo, variações internas, fotos
  originais). Existe antes, durante e depois da publicação; não é o anúncio do
  marketplace e não sobrescreve customizações de canal.
- **Identidade externa persistente** (`identidadeExterna`): internal_listing_id,
  external_listing_id/variation_id, seller_sku/variation_sku/master_sku,
  gtin_ean, head_status, e **confiança + origem do vínculo** (ID externo → SKU →
  nome). Nome nunca substitui Item ID/Variation ID/SKU.
- **SKU como chave operacional** (`skuDossie` + tela "Visão do SKU"): agrega, por
  SKU, marketplaces/contas, performance, estoque, devoluções, Ads, afiliados,
  criativos e testes — cruzando pela **hierarquia** Item ID → Variation ID →
  Seller SKU → SKU da Variação → SKU Principal → GTIN → Master → (nome só
  sugere). Mesmo SKU em contas diferentes **não é somado sem avisar**; entre
  marketplaces é comparável com origem separada.
- **Mídia real** (`addMediaReal`/`reorderMedia`/`vincularMediaSku`): upload de
  uma ou várias fotos com **preview real** (FileReader → dataURL renderizado na
  galeria), **dedup por hash**, **arrastar-e-soltar** e ↑/↓ para reordenar (a 1ª
  posição vira capa), **definir capa** e **vincular ao SKU/variação** (a foto
  vira criativo do SKU). Nunca declara upload concluído sem a imagem aparecer.
- **Creative Intelligence + experimentos** (`addCreative`/`analiseCriativo`/
  `criarExperimento`/`avaliarExperimento`): criativos ligados por SKU (nunca só
  por nome); experimento exige hipótese + métrica; **nunca declara vencedor** sem
  amostra, período e cobertura suficientes (e sem alteração paralela) —
  `INCONCLUSIVO` por padrão.
- **Publicação controlada** (`solicitarPublicacao`/`registrarRetornoOficial`):
  bloqueada por padrão; exige Empresa/Canal/Marketplace/Conta + validação +
  confirmação explícita + integração autorizada. Cria **apenas solicitação
  interna** (`escritaExterna:false`) — o marketplace não é tocado. Só o **retorno
  oficial** salva Item ID/Variation ID/SKU e move o anúncio para ativo.
- **Editor Shopee fiel ao Seller Center** (`SHOPEE_SECOES`): no contexto Shopee o
  editor abre **vertical em 8 seções** (Informações Básicas → Especificações →
  Descrição → Informações de Vendas → Lista de Variações → Informações Fiscais →
  Envio → Outros), com topo mostrando Item ID + status nativo × Head e ações
  (Abrir Matriz / Visão do SKU / Inteligência e Dados Internos / Validar /
  Solicitar publicação). Fora da Shopee, o editor de 14 abas segue igual.
- **Testes**: `ui-v8-catalog-operacional.test.js` (mapeando os testes
  obrigatórios do sprint: Matriz, rascunho ≠ ativo, mídia real/hash/ordem/capa/
  SKU, editor Shopee 8 seções, Item/Variation ID e SKU persistentes, cruzamento
  por Item ID/SKU, contas separadas, criativos por SKU, experimento honesto,
  publicação com confirmação e IDs, ativo só após retorno, sem escrita externa).
  Suíte completa **692 verdes**. Headless: editor Shopee vertical, foto real com
  preview/reordenar/capa, Visão do SKU, publicação controlada + retorno oficial;
  console limpo, light/dark/mobile.
- **Parte 2 (continuação, declarada)**: filtros recolhíveis + chips + seletor de
  colunas na tela de Marketplaces; painel lateral fixo completo no editor; fluxo
  conversacional de criação por WhatsApp ("Criar anúncio deste produto na
  Shopee" / "Coloque essa foto no anúncio X"); adaptação de criativo vencedor
  entre marketplaces. A base de motor (Matriz, identidade, SKU-chave, mídia,
  publicação) já suporta esses passos.

### 10.E.3.3 — Parte 2: filtros recolhíveis, painel lateral, criação por WhatsApp

- **Marketplaces com toolbar compacta**: a tela de operação por marketplace
  passa a mostrar só **Busca + [Filtros] [Colunas] [Ordenar] [Ações]**. Os
  filtros ficam **recolhidos por padrão** (`CAT.filtrosOpen`) e só aparecem
  **chips dos filtros ativos** (busca, filtro rápido, diagnóstico), cada um com
  ✕ para limpar. O seletor de colunas e ordenação continuam acessíveis.
- **Painel lateral do editor Shopee** (`sidePanelShopee`): coluna fixa com
  Resumo do anúncio, identidade externa (Item ID, ID interno, Produto Master,
  SKU, Variation ID, confiança/origem do vínculo), contagem de fotos/capa e
  Pendências, além de atalhos (Abrir Matriz / Visão do SKU / Inteligência).
- **Criação por WhatsApp** (`criarAnuncioComando`/`anexarFotoComando`): o comando
  "Criar anúncio deste produto na Shopee" identifica marketplace + produto (por
  nome ou SKU), busca/cria a Matriz, cria o Rascunho, reusa o SKU e responde com
  status + pendências — **sem publicar fora**. Comando sem marketplace/produto
  **pede confirmação**. "Coloque essa foto no anúncio X" busca por **Item ID →
  SKU → nome** (nome só sugere), pede confirmação se ambíguo, e anexa a foto com
  origem `WHATSAPP_COMMAND`. Um simulador em Rascunhos exercita o fluxo.
- **Adaptar criativo entre marketplaces** (`adaptarCriativoVencedor`): leva o
  criativo de melhor métrica de um SKU para outro canal como **PROPOSTA** (nunca
  "vencedor" às cegas — exige teste no destino).
- **Testes**: `ui-v8-catalog-operacional.test.js` +6 blocos (WhatsApp cria/anexa,
  ambiguidade pede confirmação, adaptação é proposta, toolbar compacta + painel
  lateral). Suíte **698 verdes**. Headless: toolbar compacta, filtros
  expandem/recolhem, painel lateral, criação por WhatsApp; console limpo,
  light/dark/mobile.

## 10.E.2.5.2 — Modelo temporal + persistência + upsert + filtro por período

Todo dado importado ganha **contexto temporal** e sobrevive ao refresh; o filtro
global de período funciona respeitando a **granularidade** (um agregado de 30
dias nunca é fatiado em dias falsos); a reimportação faz **upsert de verdade**.

- **Motor temporal** (`tempo-engine.js`, `V8TIME`): resolve os 13 presets do
  filtro global (Hoje, Ontem, Esta/Semana passada, Últimos 7/15/30 dias, Este/
  Mês passado, Últimos 3 meses, Este/Último ano, Personalizado) em intervalos
  ISO com timezone `America/Sao_Paulo`. `granularidadeDe` classifica cada
  registro (DAILY / SNAPSHOT / RANGE_AGGREGATE / UNKNOWN); `pertenceAoPeriodo`
  filtra por data exata (diário/snapshot) ou só inclui um agregado quando o
  recorte o **contém inteiro**; `coberturaTemporal` devolve status honesto
  (COBERTURA_COMPLETA / PARCIAL / SEM_DADOS_NO_PERIODO / DADO_SEM_DATA_EXATA /
  PERIODO_NAO_IDENTIFICADO) com mensagem; `queryTemporal` responde valor +
  período + timezone + cobertura + granularidade + fonte + confiança.
- **Campos temporais no snapshot** (`import-engine.js`): cada registro recebe
  `occurred_at`, `snapshot_at`, `period_start/period_end`, `imported_at`,
  `processed_at`, `updated_at`, `timezone`, `source_date_raw`, `parser_version`,
  `granularidadeTemporal` e `temporal_confidence` (CONFIRMADA/PARCIAL/AUSENTE).
  **Nada de data inventada**: sem data de linha, guarda só o período e marca
  como agregado.
- **Upsert real + merge por campo**: registro novo insere; idêntico ignora;
  alterado **atualiza versionando** (RAW original preservado nas versões); e a
  atualização faz **merge por campo** — uma planilha nova que não traz uma
  coluna antiga **não apaga** o valor já existente (peso/dimensão permanecem
  enquanto preço/estoque/vendas são atualizados). Estoque continua snapshot: o
  atual é a última leitura, o histórico nunca é somado.
- **Filtro global de período**: `V8DATA.PERIODOS` com os 13 presets + um modal de
  **período personalizado** (data inicial/final). Cada área da Central mostra
  agora **Período selecionado · Timezone · Cobertura temporal · Granularidade** —
  e, quando a fonte é um agregado, declara honestamente que não há quebra diária
  para o recorte pedido (ex.: "Performance dos últimos 7 dias indisponível: a
  fonte é agregado de 30 dias").
- **Persistência (protótipo)**: os dados importados sobrevivem ao refresh via
  **IndexedDB** do navegador (`IM.persistir`/`IM.restaurar`, restaurados no boot
  em `app.js`; toda aplicação de importação persiste automaticamente). Isto é a
  camada honesta possível num **Artifact estático** — não é a "fonte única": em
  produção a persistência é o backend real (`mos/` · Postgres, dos sprints 10.D/
  10.D.1). Prova headless: **104 registros importados permanecem após um reload
  completo**.
- **Testes**: `ui-v8-temporal.test.js` (12 blocos: presets, campos temporais,
  agregado-não-vira-dia, filtro diário por período, snapshot-não-soma, reimport
  não duplica, atualiza versionando, merge sem apagar, queryTemporal com
  metadados, persistência declarada, RAW preservado, sem escrita externa). Suíte
  completa **710 verdes**. Headless: modelo temporal, refresh sem perda
  (IndexedDB), cobertura por período, honestidade do agregado; console limpo,
  light/dark/mobile.
- **Escopo honesto**: entregue o núcleo temporal + persistência de protótipo +
  filtro/cobertura na Central. O redesenho do wizard de importação em 7 etapas
  com preview de 20 linhas e a aplicação do filtro célula-a-célula em todas as
  telas (Home/Pedidos/Ads/Afiliados/Chat) ficam como continuação — o motor
  (`V8TIME` + campos temporais) já está pronto para essas telas consumirem.

## 10.E.3.4 — Fidelidade do editor de anúncio Shopee (Informações Fiscais completas)

Ao editar um anúncio Shopee, o editor deve ser um clone funcional do Seller
Center — não um formulário genérico. O ponto principal era **Informações
Fiscais**, que estava reduzida.

- **Informações Fiscais fiéis (16 campos reais)**: Regime Fiscal, NCM, **Origem**
  (dropdown com a tabela ICMS real — códigos 0 a 8), CFOP Venda Mesmo Estado,
  CFOP Vendas Diferentes Estados, Unidade de Medida, CFOP (Exportar), % total de
  tributos federais/estaduais/municipais, PIS e COFINS CST, Tipo de Operação,
  CEST, EX TIPI (tabela de exceções IPI), Nr. RECOPI, Informações adicionais do
  produto, Nr. de controle da FCI e **Produto é um item agregável?** (Não/Sim).
  Obrigatórios marcados com *, tooltips do fluxo Shopee, e **valor importado da
  planilha preservado** (inclusive selecionado no dropdown; valor fora da lista
  vira opção "(importado)"). Nada de bloco fiscal reduzido nem campos fundidos.
- **Especificações enriquecida**: País de Origem, Duração da Garantia, Tipo de
  Garantia, Estilo, Tipo de armação, Comprimento, Largura — além de marca,
  material, cor, dimensões, EAN, com o contador "Complete X/21" da Shopee.
- **Envio fiel**: Peso, Comprimento/Largura/Altura, prazo de postagem, e **Taxa
  de Frete por transportadora** (Shopee Xpress, Entrega pelo Comprador, Entrega
  Direta, Entrega Turbo) com toggle habilitado/desabilitado, mais **Sob
  encomenda** (Não/Sim). Estoque Full observado quando importado.
- **Helpers fiéis** (`esel`/`erad`): selects e radios do Seller Center; o
  handler de salvar passou a ler corretamente **input, select, radio e
  checkbox** (radio só o selecionado; checkbox como booleano) e versiona.
- **Ações do editor Shopee**: Salvar rascunho interno · Salvar versão Shopee ·
  Validar cadastro · Solicitar publicação · Fechar. Nenhuma escrita externa.
- **Guarda**: `body()` do Catálogo não re-renderiza se o editor for aberto fora
  da view (evita erro de console ao editar a partir de outra tela).
- **Testes**: `ui-v8-editor-shopee.test.js` (11 blocos: 8 seções, 16 campos
  fiscais + labels, tabela ICMS de Origem, obrigatório/tooltip, esel/erad, valor
  importado preservado, Especificações/Envio fiéis, ações do editor, save de
  select/radio/checkbox, sem escrita externa). Suíte completa **721 verdes**.
  Headless: 16 campos fiscais presentes, NCM/Origem importados preservados, save
  de select+radio versiona; console limpo, light/dark/mobile.

## 10.E.2.5.3 — Integração real: Protótipo → API → MOS → Postgres (vertical Performance)

O IndexedDB do protótipo resolve o Artifact estático, mas não a operação real.
A fonte oficial passa a ser **Postgres → API MOS → interface**. Esta sprint
liga a primeira vertical completa — **Performance de Produtos** — ao backend
real, com prova de persistência que sobrevive a uma instância nova do backend
(equivale a outro navegador / relogin / novo frontend).

- **Banco real (Postgres)**: o backend (`apps/api/server.js` + `mos/src/production`)
  já persiste via `node:sqlite` em LOCAL e **exige Postgres** (`DATABASE_URL`)
  fora de LOCAL. Migração nova `004-intelligence-vertical` adiciona colunas
  **consultáveis** a `metric_snapshots` (metric_type, marketplace, company_id,
  account_id, external_listing_id, external_variation_id, seller_sku, master_sku,
  occurred_at, snapshot_at, period_start/end, temporal_confidence,
  granularidade_temporal) + índices por escopo, IDs e período.
- **Apply enriquecido**: ao aplicar, o worker deriva essas colunas do RAW +
  escopo + período do lote (nada de data inventada) e faz **upsert** (insere
  novo, ignora idêntico por fingerprint, atualiza mudado versionando no
  `apply_log`). Fingerprint agora é **por escopo** (empresa + conta): o mesmo
  arquivo em outra empresa é dado legítimo, mas reimport idêntico no mesmo
  escopo é bloqueado.
- **Endpoints de leitura (novos)**: `GET /imports`, `/imports/:id`,
  `/imports/:id/preview`, `/imports/:id/fields`, `/imports/:id/conflicts`, e a
  camada de inteligência `GET /intelligence/{performance,returns,inventory,
  orders,traffic,summary}` — todos com escopo obrigatório (`company_id`,
  `marketplace`, `account_id`), filtro de **período** (que respeita
  granularidade: agregado de 30 dias não vira 7 dias falso → `DADO_SEM_DATA_EXATA`)
  e busca por **Item ID / Variation ID / SKU**.
- **Cliente oficial** (`api-client.js`, `V8API`): a interface consulta a API
  real quando um backend está configurado (`window.HEAD_API_BASE` ou
  localStorage `head_api_base`); o IndexedDB fica só como cache/preview.
  Num Artifact estático (sem backend) o cliente fica **OFFLINE** e a interface
  degrada para a base local **rotulada** — honesto, nunca fingindo backend.
- **Prova real** (`mos/test/backend-vertical.test.js`, roda com
  `HEAD_TEST_PG=postgres://…`, senão é pulado): jornada completa via HTTP na API
  sobre Postgres — signup/login, criar escopo, **upload de PERFORMANCE.PRODUTO.csv**,
  import, apply, e `GET /intelligence/performance` devolvendo as **linhas reais**;
  uma **instância NOVA da API** sobre o mesmo Postgres (= outro navegador /
  relogin / novo frontend) vê os **mesmos dados**; reimportar não duplica; nova
  versão do relatório atualiza só o que mudou; filtro de período consulta o banco;
  busca por Item ID / Variation ID / SKU. **5/5 verdes contra Postgres real.**
- **Correções de banco reais encontradas**: `rateLimit` usava `SET n = n + 1`
  (ambíguo no Postgres) — qualificado para `rate_limits.n + 1`, válido nos dois
  dialetos; e a deduplicação de arquivo passou a ser por escopo.
- **Suíte**: `ui-v8-api-client.test.js` + as migrações atualizadas.
  `npm test` **721 verdes** (o teste de Postgres é pulado sem banco); com
  `HEAD_TEST_PG` setado, **+5 verdes** provando a vertical real.
- **Ordem de entrega (declarada)**: esta é a vertical Performance. As demais
  (Devoluções, Pedidos, Estoque Full, Tráfego, Ads, Afiliados, Promoções, Chat)
  seguem a MESMA estrutura — os endpoints já aceitam o `metric_type` e a base já
  guarda todos os tipos; falta o parser/derivação específica de cada um e o
  rewire de cada tela da Central para consumir `V8API` em vez da engine local.

## SPRINT 10.P.3 (Parte 1) — Centro de Lucratividade e Ponto de Equilíbrio

> "Vender mais, com margem, controle e execução." O Centro de Custos deixa de
> ser só cadastro e vira **centro de lucratividade**: taxa por faixa de preço,
> contribuição por SKU, ponto de equilíbrio com projeção e perdas — sempre com
> **fórmula visível**, **fonte declarada** e **estimativa que nunca vira lucro real**.

- **Motor honesto** (`design/prototipo-v8/lucro-engine.js`, `V8LUCRO`; camada
  compartilhada Node + navegador, provada por `mos/test/ui-v8-lucratividade.test.js`,
  **11/11 verdes**):
  - **Taxa fixa por faixa de preço** (`taxaPorFaixa`): olha o **preço real** e
    aplica a faixa correta; sem tabela, **declara ausência** — nunca inventa taxa.
  - **Hierarquia de regras** (`resolverTaxaFixa`): global → marketplace → conta →
    categoria → produto → SKU → manual; a **mais específica vence** e a interface
    **declara qual regra venceu** ("REGRA DO SKU"). Sem regra aplicável, declara
    a ausência explicitamente.
  - **Contribuição por SKU** (`contribuicaoSku`): margem de contribuição e margem
    líquida ESTIMADA com **fórmula**; classifica em ESCALAR / MANTER / CORRIGIR /
    REPRECIFICAR / INVESTIGAR / **SEM_DADOS_SUFICIENTES**. Sem custo/comissão,
    não estima — declara o que falta. Preço abaixo do custo variável é **CORRIGIR**.
  - **Carteira** (`contribuicaoCarteira`): separa **quem ajuda a pagar a estrutura**
    (contribuição > 0) de **quem consome** (contribuição < 0). Contribuição = 0 é
    **SKU sem giro** no período — mostrado à parte, **não como vazamento**.
  - **Projeção do ponto de equilíbrio** (`projecaoEquilibrio`): % atingido, ritmo/dia,
    dia projetado de atingir, projeção de fim de mês com **cenários** (pessimista /
    atual / otimista) e **tendência** (AVANÇANDO / AFASTANDO). Sem PE calculável,
    declara insuficiência — nada é projetado no vazio.
  - **Perdas e vazamentos** (`perdas`): agrega por tipo e aponta o **maior
    vazamento**; só mostra com **valor de fonte** (Devoluções/Ads reais), nunca estimado.
- **Interface** (`custos.js`): o Centro de Custos ganhou as abas **Ponto de
  Equilíbrio** (com a projeção e o quadro "Quem ajuda a pagar a estrutura ×
  quem consome"), **Rentabilidade por SKU**, **Taxas por Faixa** e **Perdas e
  Vazamentos**, alimentadas pelos SKUs reais do Catálogo (`V8CAT.ativos`).
- **Modelo de custos demonstrativo** (`business-engine.js`, `createBiz(scope,
  { seedCustosDemo:true })`): para que o centro **demonstre** o cálculo, a empresa
  operacional recebe custos fixos, custos variáveis (comissão %, embalagem/pedido),
  taxa e regra de rateio **rotulados como demonstração** — todos marcados `seed`.
  O flag só é ligado pelo app; a **suíte recebe `biz` limpo**, então nenhum teste
  de custo/rateio é contaminado.
- **Honestidade preservada**: sem custo fixo cadastrado, o PE continua dizendo
  "dados insuficientes"; sem Devoluções/Ads importados, Perdas continua vazio e
  honesto; toda margem carrega a fórmula e o rótulo **margem líquida ESTIMADA**.
  Nenhuma escrita externa — `ESCRITA EXTERNA BLOQUEADA`.
- **Suíte**: `ui-v8-lucratividade.test.js` (11) + validação headless
  (`Ponto de Equilíbrio com projeção`, `contribuição`, `Rentabilidade por SKU`,
  `Taxas por Faixa`, `Perdas`, dark, **console limpo**). `npm test` **734 verdes**
  (o teste de Postgres é pulado sem banco).

## SPRINT 10.P.3 (Parte 2) — Navegação de 6 áreas + Mesa Estratégica + Orgânico/SEO

> Rearranjo geral: o menu lateral deixou de ter ~20 itens e passou a **6 áreas**
> — INÍCIO, CATÁLOGO, CRESCIMENTO, OPERAÇÃO, EXECUÇÃO, CONFIGURAÇÕES. Nada foi
> removido nem duplicado: cada área **agrupa as views que já existiam** por uma
> sub-navegação contextual. "Reorganizar, conectar, simplificar, dar hierarquia."

- **Arquitetura de 6 áreas** (`app.js`, `UI.AREAS`): cada área declara suas
  `subs` como `{label, view, sub?}`, apontando para as views/subtabs existentes
  (mesma fonte, sem segunda fonte de verdade). Um mapa reverso `areaOf(view)`
  destaca a área; a mesma view pode ser reaproveitada em duas áreas (ex.: **Estoque**
  em Operação e **Full e Escala** em Crescimento) sem perder o destaque, porque
  `go(view, sub, areaKey)` aceita a área explícita vinda da sub-nav.
- **Sub-navegação** (`#subnav` + `.subtab`): barra secundária, sticky, que mostra
  as subs da área ativa e destaca a sub casada por `(view, sub)`. Some quando a
  área tem uma sub só (INÍCIO).
- **Mapa de migração** (sem duplicar dados): Home→INÍCIO·Mesa Estratégica;
  Catálogo→CATÁLOGO; Central de Inteligência/Ads/Afiliados/Full/Lucratividade/Radar→
  CRESCIMENTO; Pedidos/Estoque/Devoluções/Atendimento/Histórico→OPERAÇÃO;
  Decisões/Missões/Conhecimento→EXECUÇÃO; Empresas/Fontes/Conexões/Equipe/Planos/
  Ativação/Suporte→CONFIGURAÇÕES. **Silêncio virou Radar**.
- **Mesa Estratégica** (`home.js`): a Home responde "o que aconteceu / onde vender
  mais / onde perco dinheiro / o que exige decisão / o que a equipe executa" em
  **5 blocos nomeados** — Resultado da operação (faturamento aprovado, pedidos
  pagos, ticket, não pagos, status, atalho para Lucratividade/PE), Maior
  oportunidade (máx. 3), Maior perda ou risco (máx. 3), Decisões pendentes,
  Missões em execução — cada card com motivo/fonte e ações (abrir · criar missão).
- **Orgânico e SEO** (`seo.js`, view nova `v-seo`): área estratégica que analisa
  os anúncios reais do Catálogo (`V8CAT`) em três visões — **Oportunidades de
  Ranking**, **Problemas de Visibilidade**, **Testes e Melhorias**. Cada card é
  **FATO** (métrica observada: impressões, CTR, conversão, completude de cadastro)
  → **HIPÓTESE** (fator possível) → **TESTE** (ação mensurável), com
  fonte/período/cobertura/confiança. Disclaimer fixo: **o Head não conhece o
  algoritmo do marketplace**; nenhuma causa é afirmada sem evidência; sem métrica
  de fonte, declara ausência.
- **Preservação**: Catálogo (Visão Geral/Rascunhos/Marketplaces), editor Shopee,
  campos fiscais, Item ID/SKU/Variation ID, importação, motor temporal, Central
  de Inteligência e Lucratividade seguem intactos — os auto-testes internos
  (`?uiself=1`, `?gbarself=1`) continuam verdes com a nova navegação.
- **Testes**: assertions de menu/NAMES/cockpit migradas para o contrato de 6 áreas
  (`ui-v8.test.js` valida exatamente 6 `data-area` + views preservadas + `renderSubnav`);
  validação headless de 12 checagens (6 áreas, Mesa Estratégica com 5 blocos,
  sub-nav de Crescimento, SEO honesto, Radar, área estável em Operação, Catálogo
  preservado, console limpo). `npm test` **734 verdes**.

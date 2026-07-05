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

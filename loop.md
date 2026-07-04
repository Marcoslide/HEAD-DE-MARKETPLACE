# MARKETPLACE OPERATING SYSTEM
# Overnight Loop

## Regra Adicional

Se durante a execução surgir uma decisão de produto, UX, comportamento do Head ou funcionalidade que altere a experiência do usuário, NÃO implemente por conta própria. Registre a sugestão em docs/ideas-for-review.md com justificativa técnica e continue para a próxima tarefa.

## Regras Permanentes

- Obedecer integralmente CONSTITUICAO.md, MIF.md, MOS.md e ROADMAP.md.
- Nunca quebrar funcionalidades existentes.
- Sempre executar todos os testes ao final de cada tarefa.
- Atualizar automaticamente a documentação quando necessário.
- Marcar cada tarefa concluída com [x].
- Não criar integrações reais com APIs externas.
- Não utilizar credenciais.
- Não implementar OAuth.
- Não consumir serviços externos.
- Toda implementação deve utilizar abstrações, interfaces e dados simulados.
- Toda arquitetura deve estar preparada para futuras integrações sem necessidade de refatoração.

---

# BLOCO 01 — Marketplace Intelligence Engine

- [x] Revisar completamente o Marketplace Intelligence Engine procurando oportunidades de melhoria de arquitetura, desacoplamento, performance, legibilidade, extensibilidade e testabilidade. Refatorar apenas quando houver ganho objetivo.

- [x] Expandir os sete motores adicionando novos cenários de investigação utilizando dados simulados extremamente próximos da realidade dos marketplaces.

- [x] Criar novos playbooks baseados em situações reais como guerra de preço, queda silenciosa de conversão, explosão de vendas, ruptura de estoque, perda de ranking, aumento de devoluções, mudança de algoritmo e crescimento repentino de concorrentes.

- [x] Evoluir o Memory Engine para aprender padrões utilizando apenas dados simulados, armazenando comportamento da empresa, sazonalidade, horários de venda, criativos, palavras-chave e estratégias vencedoras.

- [x] Evoluir o Learning Engine implementando ciclos completos de previsão, resultado, aprendizado e atualização automática da memória.

---

# BLOCO 02 — Backend Foundation

- [x] Construir toda a arquitetura backend utilizando Domain Driven Design, Event Driven Architecture e Clean Architecture.

- [x] Criar Event Bus interno para comunicação entre módulos.

- [x] Criar sistema de filas preparado para processamento assíncrono.

- [x] Preparar toda a arquitetura para suportar milhares de anúncios simultaneamente.

---

# BLOCO 03 — Banco de Dados

- [x] Projetar e implementar a modelagem definitiva do banco de dados.

Criar entidades como:

Workspace
User
Company
MarketplaceConnection
Product
Listing
ListingVersion
Mission
Decision
Investigation
Opportunity
Competitor
CompetitorSnapshot
Review
Question
Keyword
KeywordTrend
Experiment
Memory
Learning
AuditLog
ExecutionPlan
PublicationHistory

Documentar todos os relacionamentos.

---

# BLOCO 04 — APIs Internas

- [x] Criar toda a estrutura REST da aplicação.

Controllers.
Services.
DTOs.
Schemas.
Validators.
OpenAPI.
Tratamento global de erros.
Logs estruturados.
Nenhuma API externa.

---

# BLOCO 05 — Camada Operacional

- [x] Construir completamente a tela Operações utilizando dados simulados.

Implementar:

Central de Produtos
Central de Marketplaces
Central de Anúncios
Timeline
Histórico
Versões
Publicações simuladas
Saúde
Filtros
Pesquisa
Paginação

---

# BLOCO 06 — Central do Produto

- [x] Implementar a Central do Produto.

Cada produto deverá possuir:

Resumo Executivo
Marketplaces
Anúncios
Versões
Timeline
Performance
Experimentos
Decisões
Missões
Saúde
Aprendizados

Tudo conectado ao MIE utilizando dados simulados.

---

# BLOCO 07 — Fluxo de Publicação (Simulado)

- [ ] Construir todo o fluxo interno de publicação.

Fluxo:

Criar anúncio
↓
Adaptar atributos
↓
Validar categoria
↓
Validar imagens
↓
Validar regras
↓
Gerar Preview
↓
Aguardar aprovação
↓
Publicação Simulada
↓
Monitoramento Simulado
↓
Versionamento
↓
Histórico

Nenhum envio real para marketplaces.

---

# BLOCO 08 — Providers

- [ ] Criar arquitetura desacoplada para futuros Providers.

MarketplaceProvider
ShopeeProvider
MercadoLivreProvider
AmazonProvider
MagaluProvider
TikTokProvider

Todos devem possuir apenas contratos, interfaces, adapters e mocks.

Nenhuma comunicação externa.

---

# BLOCO 09 — Marketplace Collector

- [ ] Construir toda a arquitetura do Marketplace Collector.

Implementar:

Crawler Interface
Parser
Snapshot
Comparador
Scheduler
Cache
Fila
Histórico

Sistema totalmente preparado para futuramente ler anúncios públicos, avaliações, perguntas, rankings e preços.

Nesta etapa utilizar apenas cenários simulados.

---

# BLOCO 10 — WhatsApp

- [ ] Construir a arquitetura completa do módulo WhatsApp.

Conversation Engine
Command Parser
Conversation Context
Conversation Memory
Execution Queue
Pending Decisions
Notifications

Tudo utilizando eventos simulados.

---

# BLOCO 11 — Experimentação

- [ ] Construir arquitetura do sistema de experimentação.

Versionamento
Experimentos
Comparações
Resultados
Aprendizado
Rollback
Histórico

Tudo utilizando ambiente simulado.

---

# BLOCO 12 — Observabilidade

- [ ] Criar um painel interno exclusivo para desenvolvimento.

Visualizar:

Motores
Especialistas
Fila
Eventos
Logs
Missões
Aprendizado
Memória
Execution Plans

Sem alterar a interface do cliente.

---

# BLOCO 13 — Testes

- [ ] Criar testes automatizados cobrindo todos os módulos implementados.

Sucesso.
Falha.
Stress.
Concorrência.
Escalabilidade.
Regressão.

---

# BLOCO 14 — Refatoração

- [ ] Executar revisão completa do projeto procurando código duplicado, acoplamentos, problemas arquiteturais, gargalos de performance, oportunidades de simplificação e melhoria de legibilidade.

Corrigir automaticamente tudo que encontrar.

---

# BLOCO 15 — CTO Review

- [ ] Ao concluir todas as tarefas anteriores, assumir o papel de CTO de uma empresa global de tecnologia.

Realizar uma auditoria completa do Marketplace Operating System.

Avaliar:

Arquitetura.
Escalabilidade.
Organização.
Separação de responsabilidades.
Qualidade do código.
Performance.
Experiência do desenvolvedor.
Testabilidade.
Documentação.

Implementar todas as melhorias relevantes.

Atualizar documentação.

Atualizar testes.

Registrar todas as decisões arquiteturais.

Marcar todas as tarefas concluídas.

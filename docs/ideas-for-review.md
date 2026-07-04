# Ideias e decisões de produto aguardando revisão

> Registro exigido pelo `loop.md` (Regra Adicional): decisões de produto/UX/comportamento
> que surgiram durante a execução autônoma e que NÃO foram inventadas por conta própria.
> Cada item traz o que foi feito provisoriamente (quando algo precisou existir para o
> bloco avançar) e o que precisa da sua decisão.

## 001 · Onde vive a "tela Operações" (Bloco 05)

**Contexto:** o Bloco 05 pede uma "tela Operações" com Central de Produtos, Central de
Marketplaces e Central de Anúncios. Criar um 6º item de menu violaria o Art. 6 da
Constituição e a cláusula pétrea 9 (cinco áreas, nunca mais).

**Implementação provisória:** as três centrais viraram **abas dentro da área Produtos**
(Produtos · Marketplaces · Anúncios), mantendo os 5 menus intactos. A Central do Produto
(Bloco 06) abre ao clicar em um produto, como aprofundamento — padrão já previsto em
`docs/02` (detalhe do produto).

**Decisão pendente:** confirmar se "Operações" deve mesmo morar em Produtos, ou se no
futuro (com WhatsApp/publicação reais) merece reorganização — nesse caso, a Constituição
exigiria emenda consciente, não exceção silenciosa.

## 002 · Navegação secundária por abas (novo padrão de UI)

**Contexto:** os docs/01-05 não previam navegação de segundo nível dentro de uma área.
As centrais do Bloco 05 precisam de alguma segmentação.

**Implementação provisória:** abas horizontais discretas no topo da área (mesmo padrão
visual dos chips de coleção do Conhecimento — componente já existente no design system).

**Decisão pendente:** validar as abas como padrão oficial de segundo nível no design
system (docs/04), ou preferir outra solução (ex.: filtros, sub-rotas).

## 003 · Grau de autonomia visível na Central do Produto (Bloco 06)

**Contexto:** a Central do Produto exibe experimentos, decisões e missões do produto.
Surgiu a dúvida de produto: o dono deve poder **pausar** um experimento direto da
Central, ou toda intervenção passa pela conversa/decisões (mantendo o princípio
"o usuário aprova, o Head opera")?

**Implementação provisória:** a Central exibe tudo em modo leitura + ações já
constitucionais ("Decidir agora" → fila de decisões; "Perguntar sobre isso" → conversa).
Nenhum controle operacional direto foi adicionado.

**Decisão pendente:** definir se algum controle direto (pausar experimento, reverter
versão sem passar pelo Head) deve existir — recomendo que não, mas é decisão de produto.

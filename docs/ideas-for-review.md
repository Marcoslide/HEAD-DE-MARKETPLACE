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

## 004 · Expor especialistas nomeados ao usuário exige emenda constitucional

**Contexto:** o Sprint 06 (Specialists Engine) foi motivado por um exemplo do dono em
que o produto responde mostrando os especialistas nomeados:

> Especialista em Conversão (92%): O CTR caiu 18%…
> Conselho: Concordância de 3 especialistas. Recomendação aprovada com confiança de 91%.

**Conflito constitucional:** o Art. 11.1 e a cláusula pétrea 5 dizem literalmente
*"O dono nunca vê 'o especialista de SEO disse'… os especialistas são invisíveis."*
O Art. 11.3 só permite expor divergência como "opção B", sintetizada e assumida pelo
Head — nunca como especialistas falando diretamente.

**O que foi feito (constitucional):** o Specialists Engine produz os pareceres e o
Conselho os consolida numa **posição única** que o Head assume. Os pareceres
individuais vivem internamente e no painel `/__dev` (ferramenta de dev, não produto).
O motor está **100% pronto** para alimentar a experiência do exemplo.

**Decisão pendente do dono:** expor os especialistas nomeados ao usuário (como no
exemplo) requer **emendar o Art. 11.1 e a cláusula pétrea 5**. Recomendo uma via
intermediária que respeita o espírito da Constituição: o Head fala em primeira pessoa
("cruzei conversão, comercial e SEO; 2 de 3 apontam reposicionar") e um modo
"ver o raciocínio" opcional revela os pareceres — transparência sob demanda, sem
transformar a resposta padrão numa reunião de comitê. Mas a decisão é sua.

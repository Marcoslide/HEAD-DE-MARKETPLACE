# MOS — MARKETPLACE OPERATING SYSTEM

> **Este documento responde à pergunta que nenhum outro responde: como esta empresa funciona.**
> A [`CONSTITUICAO.md`](CONSTITUICAO.md) define quem o Head é. O [`MIF.md`](MIF.md) define o que ele sabe fazer. O MOS define **o que acontece, passo a passo, em cada situação da operação** — do momento em que uma loja é conectada até o momento em que um resultado vira conhecimento.
> Este documento **não é técnico. É operacional.** Ele descreve a empresa em funcionamento — e qualquer pessoa (ou qualquer IA) que entrar no projeto daqui a cinco anos deve conseguir entender toda a lógica do sistema lendo apenas este documento.
>
> **O Head de Marketplace é a interface humana deste sistema operacional.** Por baixo dele: os motores de inteligência, os especialistas, os playbooks do MIF, a Constituição, a memória e estes fluxos.

---

## Como ler um fluxo

Todo fluxo tem a mesma anatomia:

- **Gatilho** — o que dispara o fluxo (evento, detecção, pedido do usuário, rotina).
- **Etapas** — a sequência de trabalho. Cada etapa indica *quem* trabalha (motor ou especialista) e *o que o usuário vê* enquanto isso acontece — porque trabalho invisível não gera confiança (Constituição, Art. 3).
- **Saídas** — em que o fluxo termina. Nenhum fluxo termina em análise (Art. 21): termina em decisão, missão, publicação, conhecimento ou descarte explícito.
- **Registra** — o que entra na Memória da Empresa. Nada se perde (Art. 16).
- **Regras** — os artigos da Constituição e as doutrinas do MIF que governam o fluxo.
- **O fluxo funcionou se…** — o critério de qualidade, sempre na perspectiva do dono.

Convenção de nomes dos motores (Camada Cognitiva): **Observação · Investigação · Priorização · Decisão · Execução · Aprendizado · Memória**.

---

# FLUXO 001 — Nova loja conectada

**Gatilho:** o usuário conecta a conta de um marketplace.
**Objetivo:** em minutos, o Head deixa de ser um estranho e passa a conhecer a operação melhor que qualquer consultor conheceria em uma semana.

**Etapas:**

1. **Importar anúncios** — Execução traz o catálogo completo (títulos, fotos, fichas, preços, variações). *Usuário vê: "Encontrei seus 148 anúncios…"*
2. **Importar histórico** — vendas, visitas, conversão e ranking disponíveis (quanto a plataforma der). *"Carregando seu histórico de vendas…"*
3. **Importar pedidos** — volume, ticket, devoluções, cancelamentos, prazos de despacho.
4. **Importar métricas** — reputação, nota por produto, selos, saúde da conta.
5. **Analisar concorrentes** — Observação identifica, para cada produto relevante, os concorrentes diretos da primeira página e tira o primeiro snapshot (preço, criativo, nota, posição). *"Conhecendo seus concorrentes…"*
6. **Ler avaliações** — todas as do cliente + as dos líderes da categoria. O especialista de Conversão extrai elogios dominantes (futuros argumentos) e objeções dominantes (futuros ataques).
7. **Entender a categoria** — Tendências e Comportamento mapeiam sazonalidade, vocabulário de busca e padrão de decisão do comprador daquela categoria.
8. **Criar o perfil da empresa** — Memória consolida tudo no dossiê inicial: produtos-âncora, faixa de margem aparente, pontos fortes (ex.: reputação), vulnerabilidades (ex.: fotos defasadas), quem são os inimigos. Marca todos os conhecimentos como **nível 1 — em validação** (MIF, Parte 8).
9. **Gerar o primeiro briefing** — Priorização escolhe as 2–3 oportunidades óbvias de maior score. O Head se apresenta: *"Prazer, Marcos. Passei os últimos minutos estudando sua operação. Já encontrei 4 oportunidades — a mais valiosa vale uns R$ 1.900/mês. Está tudo pronto na sua mesa."*

**Saídas:** perfil da empresa criado · vigília permanente ativada (Fluxo 006 passa a rodar) · primeiras decisões na fila.
**Registra:** dossiê completo, snapshot inicial de tudo (o "dia zero" — referência para todo "o que mudou?" futuro).
**Regras:** onboarding sem formulário — a IA trabalha na frente do usuário (docs/02); humildade declarada nos primeiros dias (Art. 17).
**O fluxo funcionou se…** o usuário recebe a primeira proposta de valor real **no mesmo dia** em que conectou, e sente que "ele já está trabalhando".

---

# FLUXO 002 — Produto novo

**Gatilho:** o usuário pede ("quero vender X") ou aprova uma oportunidade de expansão.
**Objetivo:** lançar o produto com o melhor anúncio que a evidência permite — não com um chute bonito.

**Etapas:**

1. **Pesquisar o mercado** — Observação levanta demanda: volume e crescimento de busca, preço médio praticado, faixa de frete. *(MIF 1.1: dimensionar a Demanda antes de tudo.)*
2. **Pesquisar concorrentes** — quem domina a primeira página, com que criativo, que preço, que nota; onde eles falham (avaliações negativas deles = mapa de oportunidade).
3. **Pesquisar tendências** — sazonalidade da categoria, vocabulário emergente, formatos de criativo em ascensão.
4. **Criar o anúncio** — Conversão + SEO + Criativos produzem: título (vocabulário real de busca), ficha completa, descrição que responde as objeções da categoria (MIF 5.2).
5. **Criar imagens** — plano de fotos na hierarquia do MIF 5.1: principal para vencer a lista em miniatura; internas para escala, uso, detalhe e embalagem.
6. **Criar o SEO** — palavras-alvo principais + cauda longa de lançamento (produto novo briga primeiro nas caudas — MIF 2.2).
7. **Preparar por marketplace** — adaptação às regras e ao comprador de cada praça (título, categoria, atributos, política).
8. **Esperar aprovação** — pacote completo vira decisão na mesa do dono: proposta + impacto estimado + investimento + riscos. **Publicação de produto novo é sempre Classe C** (MIF 7.2).
9. **Publicar** — Execução publica; registra a previsão (Art. 15) antes.
10. **Monitorar** — vigília reforçada nos primeiros 14 dias: curva de lançamento vs. curva típica da categoria.
11. **Experimentar** — ajustes de lançamento (título/foto/preço) pela doutrina de experimentação (MIF, Parte 6).
12. **Aprender** — a curva real vs. prevista vira conhecimento: o que funciona para lançar nesta categoria.

**Saídas:** produto no ar com plano de lançamento ativo, ou decisão de não lançar (com o porquê — descarte explícito).
**Registra:** pesquisa completa, anúncio versionado (v1), previsão de lançamento, curva real.
**Regras:** MIF Partes 1, 2.2 (produto novo), 5 e 6; alçada Classe C.
**O fluxo funcionou se…** o produto novo nasce com a qualidade de anúncio que um concorrente maduro levaria meses para montar.

---

# FLUXO 003 — Queda de conversão

**Gatilho:** Observação detecta desvio negativo vs. o normal daquela operação (Art. 17) — nunca vs. benchmark genérico.
**Objetivo:** causa provável + proposta pronta, antes que o dono perceba o problema sozinho.

**Etapas:**

1. **Detectar** — Observação abre anomalia com severidade preliminar. *Usuário ainda não é avisado* (Art. 19 — sem alarme sem investigação).
2. **Investigar** — Investigação abre missão visível (Pulso + tela Missões) e percorre o playbook MIF 2.2: dimensionar → localizar o fator (tráfego × conversão) → dentro → fora → demanda → reputação.
3. **Consultar o MIF** — o playbook correspondente vira o roteiro da investigação; o checklist é obrigatório (Art. 12).
4. **Consultar o histórico** — Memória: isso já aconteceu? O que fizemos? Funcionou? (etapa 3 do raciocínio, Art. 5).
5. **Comparar o mercado** — a queda é só minha ou da categoria inteira? (Se for de todos: demanda; se for só minha: competitiva.)
6. **Gerar hipóteses** — no mínimo duas (Art. 5.8); cada uma testada contra o timing (MIF 2.1: "o timing é a impressão digital").
7. **Criar a estratégia** — a hipótese sobrevivente vira proposta no formato fixo: descoberta → causa → proposta → impacto → reversibilidade → confiança.
8. **Priorizar** — o score (MIF 7.1) decide: interrupção imediata, briefing do dia, ou execução direta se Classe A/B.
9. **Executar** — aprovada (ou dentro de alçada), Execução aplica como nova versão reversível.
10. **Monitorar** — janela de medição definida antes (MIF 5.3); gatilho de reversão armado; resultado reportado ao dono fechando o ciclo (*"aquela mudança rendeu +9%"*).

**Saídas:** decisão na mesa ou ação executada · na pior hipótese honesta: *"ainda não sei a causa; eliminei X, Y, Z; volto em N horas"* (Art. 12).
**Registra:** diário de bordo completo da investigação, hipóteses descartadas (e por quê), previsão vs. resultado.
**Regras:** Arts. 5, 6, 12, 13, 19; MIF Partes 2 e 7.
**O fluxo funcionou se…** o dono soube do problema **pelo Head, com a solução junto** — nunca por outra fonte.

---

# FLUXO 004 — Nova oportunidade

**Gatilho:** um radar do MIF (Parte 4) acende: busca crescendo com oferta fraca, gap de palavra-chave, posição 4–10, criativo defasado, elasticidade não testada, categoria adjacente.
**Objetivo:** transformar assimetria de mercado em dinheiro — ou descartar com critério.

**Etapas:**

1. **Descobrir** — Observação captura o sinal e abre a oportunidade candidata.
2. **Validar** — Investigação confirma que é real: o sinal se sustenta há tempo suficiente? A oferta concorrente é fraca mesmo? Nós temos como atacar?
3. **Calcular impacto** — estimativa em R$/mês com faixa e confiança (MIF, Parte 4: "oportunidade sem número é curiosidade").
4. **Priorizar** — score + janela (oportunidade que expira ganha ×1,5). Se o score não justifica: **observação silenciosa** — o dono nunca fica sabendo (Art. 19), e o radar continua vigiando.
5. **Criar missão** — se aprovada (pelo dono ou por alçada), vira missão com plano, previsão registrada e prazo.
6. **Executar** — pela doutrina correspondente (SEO, criativo, preço, expansão) — sempre como experimento quando a confiança é média (Art. 9).

**Saídas:** missão em execução, decisão na mesa, observação silenciosa ou descarte explícito.
**Registra:** a oportunidade, a validação, o cálculo — inclusive as descartadas (para calibrar os radares).
**Regras:** Arts. 9, 13, 19, 21; MIF Partes 4 e 7.
**O fluxo funcionou se…** as oportunidades que chegam ao dono são poucas, calculadas e boas — e ele aprova a maioria (taxa de aprovação alta = radar bem calibrado).

---

# FLUXO 005 — Produto campeão

**Gatilho:** Observação detecta desempenho consistentemente acima do normal (conversão, crescimento, margem) — o sucesso também é anomalia a investigar.
**Objetivo:** entender **por que** ganhou e multiplicar a vitória. A maioria das empresas só investiga derrota; nós investigamos vitória com o mesmo rigor.

**Etapas:**

1. **Detectar** — o produto é marcado como campeão candidato após sustentar o desempenho por janela mínima (não celebrar ruído — MIF 5.3).
2. **Investigar a causa da vitória** — Investigação isola o que explica: criativo? palavra? preço? avaliações? timing? A causa vira conhecimento nível 2 (MIF, Parte 8).
3. **Replicar a estratégia** — a causa é aplicada aos produtos irmãos (mesma categoria/público) como propostas priorizadas.
4. **Expandir marketplaces** — o campeão é candidato natural a outras praças; passa pelo Fluxo 002 (preparação por marketplace) em versão acelerada.
5. **Criar variações** — kits, tamanhos, cores, bundles — capturar demanda vizinha (MIF 4.6) sobre a força já conquistada.
6. **Aumentar margem** — testar elasticidade para cima (MIF 4.5): campeão com demanda forte costuma aceitar preço melhor; teste pequeno, reversível, com gatilho de volta.
7. **Proteger** — vigília reforçada: campeão atrai ataque (Fluxo 003 e MIF Parte 3 ficam em prontidão sobre ele).

**Saídas:** estratégia replicada + expansões propostas + margem testada + defesa reforçada.
**Registra:** a anatomia da vitória (o conhecimento mais valioso que existe: o que funciona **nesta** operação).
**Regras:** Arts. 15, 21; MIF Partes 4, 5, 6 e 8.
**O fluxo funcionou se…** um sucesso pontual virou padrão replicado — e o dono viu o Head multiplicar uma vitória que ele talvez nem tivesse notado.

---

# FLUXO 006 — O dia do Head (briefing diário)

**Gatilho:** relógio. Todos os dias, sem exceção — é o ritual que sustenta a promessa "alguém trabalhou por você a noite inteira" (Art. 3).
**Objetivo:** o dono zera o dia em menos de 5 minutos.

**Etapas:**

1. **Madrugada — vigília e trabalho** — Observação roda a varredura completa (operação, concorrentes, buscas, avaliações, perguntas, preços); missões em andamento avançam; Classe A executa sozinha.
2. **Fechamento da noite** — Priorização consolida: o que aconteceu, o que foi feito, o que precisa do dono. A fila de decisões é **curta por princípio** (Art. 13).
3. **Composição do briefing** — na estrutura fixa: saudação contextual → trabalho realizado (números narrados) → a descoberta mais importante → decisões aguardando → assinatura. Voz do Art. 20 e docs/03.
4. **Entrega** — Home + notificação (1 programada/dia, máximo). *"Terminei a análise da noite: 2 decisões esperam você."*
5. **O dia — acompanhamento** — decisões aprovadas viram missões na hora (Fluxo 007); o Pulso mostra o trabalho contínuo; interrupções só pelo critério do Art. 19.
6. **Fim do dia — aprendizado** — Aprendizado processa os resultados medidos do dia; o que fechou ciclo entra no briefing seguinte.

**Saídas:** um briefing por dia, decisões encaminhadas, ciclos fechados.
**Registra:** cada briefing (histórico da relação), taxa de aprovação, tempo-até-decisão.
**Regras:** Arts. 3, 13, 19, 20.
**O fluxo funcionou se…** o dono abre o produto todo dia **porque quer** — e sai em minutos com a operação sob controle.

---

# FLUXO 007 — Ciclo de decisão (aprovada · ajustada · recusada)

**Gatilho:** o dono responde a uma decisão da fila.
**Objetivo:** nenhuma resposta do dono morre sem consequência — cada uma move a operação ou ensina o Head.

**Etapas:**

- **Aprovada** → vira missão de execução na hora (visível no Pulso) → executa como versão reversível → mede na janela definida → **reporta o resultado vs. previsão no briefing** (*"estimei 8–12%; deu 9%"*) → vira conhecimento.
- **Ajustada** → abre conversa com o contexto carregado → o Head recalibra a proposta na hora (*"quer que eu mude o foco, a foto ou o texto?"*) → nova versão da proposta volta à fila, marcada como ajustada.
- **Recusada** → um clique + motivo opcional → o motivo vira conhecimento sobre o dono (*"não mexe em preço de produto âncora"*) → Aprendizado recalibra as próximas propostas → a recusa **não** é rediscutida; se a evidência mudar muito, volta como proposta nova, com a mudança explicada.

**Registra:** decisão, motivo, previsão, resultado — a história completa de cada aprovação é auditável (linha do tempo do produto).
**Regras:** Arts. 15 (previsão antes), 18 (recusas ensinam), 23 (alçada cresce com confiança).
**O fluxo funcionou se…** a taxa de aprovação sobe com o tempo (propostas cada vez mais calibradas) e o dono percebe que **recusar também melhora o funcionário**.

---

# FLUXO 008 — Incidente crítico

**Gatilho:** risco imediato a receita ou reputação (Art. 19): anúncio derrubado, estoque zerando no líder, onda de avaliações negativas, erro de preço publicado.
**Objetivo:** o dono fica sabendo **pelo Head, com a reação já em andamento**.

**Etapas:**

1. **Detecção e classificação** — Observação marca como incidente (não anomalia comum); severidade pela regra do Art. 19 (*"se às 18h ele perguntaria 'por que não me avisou?', avise agora"*).
2. **Primeira resposta imediata** — Execução age no que é Classe A antes de qualquer mensagem: abre recurso do anúncio, prepara plano B, responde a avaliação, congela o experimento que piorou.
3. **Aviso com pacote mínimo** — o que aconteceu + o que já estou fazendo + próxima atualização: *"O anúncio X foi derrubado. Já abri recurso e preparei o anúncio reserva. Próxima atualização em 1 hora."* **Nunca alarme sem ação em curso.**
4. **Resolução** — atualizações no ritmo prometido; decisões de Classe C (ex.: ativar plano B com perda de histórico) vão ao dono com opções pesadas.
5. **Autópsia** — fechado o incidente: causa raiz, o que previne a repetição (vira vigília nova ou regra da casa), reporte final curto.

**Registra:** linha do tempo completa do incidente, tempo-até-detecção, tempo-até-primeira-ação.
**Regras:** Arts. 18, 19; MIF Parte 3 (as defesas por tipo de ataque).
**O fluxo funcionou se…** o tempo entre o problema existir e alguém já estar agindo é de minutos — e o dono nunca descobre um incidente por outra fonte.

---

# FLUXO 009 — Pedido pelo chat

**Gatilho:** o usuário pede qualquer coisa na conversa (tela IA, ⌘K ou, no futuro, WhatsApp).
**Objetivo:** a diferença entre chatbot e funcionário — **pedido não evapora: vira trabalho rastreável**.

**Etapas:**

1. **Entender** — o pedido passa pelo fluxo de raciocínio (Art. 5): contexto, histórico, especialistas relevantes. Perguntas simples sobre o que já está investigado respondem na hora — com confiança declarada.
2. **Classificar** — resposta imediata (já sei) · missão (precisa de trabalho) · decisão (precisa do dono depois de trabalhado).
3. **Registrar** — se vira trabalho, o Head confirma **criando a missão na frente do usuário**: card na conversa + entrada em Missões + Pulso. *"Anotei. Abri uma missão — te trago o resultado no próximo briefing."*
4. **Executar e devolver** — o resultado volta **nos dois lugares**: na conversa (respondendo o pedido) e no briefing (fechando o ciclo).

**Registra:** pedido, interpretação, missão, resultado — o histórico de conversas é memória de trabalho, não sessão descartável (docs/02).
**Regras:** Arts. 5, 20, 21.
**O fluxo funcionou se…** o usuário confia tanto no "anotei" do Head quanto confiaria no "anotei" do seu melhor funcionário.

---

# FLUXO 010 — Resultado vira conhecimento

**Gatilho:** qualquer ciclo fecha — experimento termina, janela de medição vence, incidente é resolvido, decisão mostra efeito.
**Objetivo:** a empresa nunca aprende duas vezes a mesma lição, nem esquece uma lição paga.

**Etapas:**

1. **Comparar** — Aprendizado confronta resultado real × previsão registrada (sem previsão não há aprendizado — Art. 15).
2. **Extrair** — o que este resultado prova? Na forma fixa do MIF 8.1: descoberta + contexto + evidência + força + validade.
3. **Classificar força** — nível 1 (visto 1x) → nível 2 (repetiu) → nível 3 (padrão da casa: entra automaticamente nas próximas propostas). Contradição rebaixa e dispara revalidação — não apaga.
4. **Publicar na biblioteca** — entra na tela Conhecimento com evidência e onde foi aplicado; o dono pode ver por que o Head acredita no que acredita.
5. **Recalibrar** — os motores ajustam: previsões que erraram sistematicamente corrigem o viés (Art. 18 — autópsia curta, sem drama, com registro).

**Registra:** tudo. Este fluxo **é** o registro.
**Regras:** Arts. 15, 16, 18; MIF Parte 8.
**O fluxo funcionou se…** a régua do Art. 23 se move: a cada mês o dono decide menos, confia mais — com resultados melhores.

---

## O mapa — como os fluxos se conectam

```
                      ┌─────────────────────────────┐
 conexão da loja ───▶ │ 001 ONBOARDING              │──┐
                      └─────────────────────────────┘  │ ativa a vigília
                                                       ▼
                      ┌─────────────────────────────────────────────┐
                      │ 006 O DIA DO HEAD (rotina permanente)       │
                      │  vigília → trabalho → briefing → decisões   │
                      └──┬──────────┬──────────┬──────────┬─────────┘
            anomalia ────┘          │          │          └──── sucesso
                ▼                   ▼          ▼                  ▼
        ┌──────────────┐   ┌──────────────┐  ┌───────────┐  ┌──────────────┐
        │ 003 QUEDA    │   │ 004 OPORTUN. │  │ 008 INCID.│  │ 005 CAMPEÃO  │
        └──────┬───────┘   └──────┬───────┘  └─────┬─────┘  └──────┬───────┘
               └───────────┬──────┴────────────────┴───────────────┘
                           ▼
                  ┌─────────────────┐     pedidos do usuário
                  │ 007 CICLO DE    │◀─── 009 CHAT · 002 PRODUTO NOVO
                  │     DECISÃO     │
                  └────────┬────────┘
                           ▼
                  ┌─────────────────┐
                  │ 010 RESULTADO   │──▶ Memória · Biblioteca · recalibragem
                  │ VIRA CONHECIM.  │     (e melhora todos os fluxos acima)
                  └─────────────────┘
```

Todo fluxo desagua no 010 — é o que faz o sistema ficar mais inteligente a cada ciclo, e é por isso que o funcionário de seis meses é visivelmente melhor que o de uma semana.

---

*MOS v1 — promulgado no Sprint 3.5. Novos fluxos entram por acréscimo numerado (011, 012…) e nenhum fluxo pode contrariar a Constituição ou o MIF. Em conflito entre implementação e este documento, este documento vence.*

# 04 · Design System — "Escritório Noturno"

## O conceito visual

**Um escritório escuro, silencioso e caro, onde alguém muito competente trabalha a noite inteira — e a presença dele é o único ponto de calor na sala.**

Tradução em decisões:

- **Fundo frio, quase-preto com viés azulado** — o silêncio, o ambiente. Escuro por decisão de produto (o usuário passa pouco tempo, geralmente de manhã cedo ou à noite; o produto é um lugar de calma, não uma planilha de escritório). Tema único escuro neste sprint — é compromisso estético deliberado, não omissão.
- **Um único acento: âmbar-ouro quente** — a presença do Head. Tudo que é "o Head vivo/agindo" (o Pulso, a voz, decisões aguardando) carrega o âmbar. O contraste térmico frio×quente é a assinatura visual do produto: *a sala é fria, o funcionário é caloroso*.
- **Cores semânticas separadas do acento** (verde = resultado positivo, vermelho = alerta, azul = informação) e usadas com extrema parcimônia — quase sempre num ponto, numa borda, nunca em áreas grandes.
- **Luxo = escassez.** Poucos elementos por tela, muito espaço negativo, hairlines em vez de caixas, profundidade por camadas sutis de superfície — nunca por sombras pesadas.

## A decisão tipográfica central

**A voz do Head é serifada. A máquina é sans. Os números são tabulares.**

| Papel | Fonte | Uso |
|---|---|---|
| **Voz do Head** | Serifa humanista do sistema (`"Iowan Old Style", "Palatino", Georgia, serif`) | Briefing, diagnósticos, frases de decisão — todo texto em primeira pessoa |
| **Interface** | Sans do sistema (`-apple-system, "Segoe UI", Inter, system-ui, sans-serif`) | Navegação, labels, botões, corpo estrutural |
| **Dados** | A mesma sans com `font-variant-numeric: tabular-nums`; mono (`ui-monospace`) para séries | Todo número, hora, contagem |

**Justificativa:** essa é a decisão que faz o produto inconfundível. A serifa carrega calor humano e autoridade editorial (a carta, o memorando de um executivo); a sans carrega a precisão da máquina. O usuário aprende inconscientemente: *texto serifado = o Head falando comigo*. Nenhum concorrente de e-commerce tem essa assinatura. (Fontes do sistema neste sprint — zero latência, zero flash de fonte; uma serifa proprietária pode ser licenciada depois sem mudar o sistema.)

### Escala tipográfica

```
--text-xs:   12px / 16px   labels, metadados, eyebrows (caps, +0.08em tracking)
--text-sm:   13.5px / 20px corpo denso, células
--text-base: 15px / 24px   corpo padrão
--text-lg:   18px / 28px   frases de card (voz, serifa)
--text-xl:   23px / 32px   título de seção
--text-2xl:  29px / 38px   a manchete do briefing (voz, serifa)
```

Títulos com `text-wrap: balance`. Texto corrido nunca além de ~68 caracteres por linha.

## Tokens de cor

```css
:root {
  /* Ambiente (frio) */
  --bg:            #0B0C10;  /* a sala */
  --surface:       #12141A;  /* cards */
  --surface-2:     #181B23;  /* camada elevada, hover */
  --hairline:      #23262F;  /* bordas de 1px — nunca mais grossas */

  /* Texto */
  --text:          #EDEEF2;
  --text-2:        #9DA1AC;  /* secundário */
  --text-3:        #5D616C;  /* metadado */

  /* A presença (quente) — o único acento */
  --amber:         #E3A94F;  /* o Head: pulso, voz ativa, foco */
  --amber-soft:    rgba(227,169,79,.13);  /* fundos de destaque */

  /* Semânticas (pontuais, nunca em área) */
  --positive:      #58C48A;
  --critical:      #E06661;
  --info:          #6E9FDB;
}
```

Regras de uso:

1. **O âmbar pertence ao Head.** Botões primários de aprovação, o Pulso, badges de "aguardando você", o cursor da conversa. Nada decorativo recebe âmbar.
2. **Verde só para resultado medido** (nunca para "sucesso de operação de UI"), **vermelho só para risco real à operação**. Escassez preserva significado.
3. **Profundidade por camada** (`bg → surface → surface-2`), com hairline; sombras só em elementos flutuantes (menus, ⌘K), e discretas.

## Espaço, forma e grid

```
--space: base 4px  (4, 8, 12, 16, 24, 32, 48, 64)
--radius-sm: 8px   (chips, inputs)
--radius-md: 12px  (cards)
--radius-lg: 16px  (superfícies maiores, composer)
Conteúdo: coluna única, max-width 1100px, respiro lateral 32–48px
Sidebar: 260px fixa
```

Cards são generosos: padding mínimo 20px. Densidade é inimiga da sensação de luxo — quando precisar mostrar muito (lista de produtos), a densidade vem de tipografia menor e hairlines, não de padding espremido.

## Movimento

Movimento existe para uma única finalidade: **provar que há alguém vivo ali.** Hierarquia de movimento:

1. **O Pulso** (respiração do ponto âmbar, ciclo ~2,4s) — o único movimento perpétuo da interface.
2. **Frases de atividade** — crossfade a cada 6–10s.
3. **Chegada de conteúdo do Head** — entra com fade+rise de 6px, 300ms, easing `cubic-bezier(.2,.7,.2,1)`; em sequências (briefing), itens em cascata de 60ms — o efeito "ele está me contando", sem simular digitação letra a letra (que ficaria lento no uso diário).
4. **Microinterações** — hover/press/focus em 120–180ms. Aprovação de decisão: o card confirma (check âmbar→verde) e recolhe suavemente; a fila sobe — a física de "tirar um papel da mesa".

`prefers-reduced-motion`: pulso vira ponto estático em âmbar, cascatas viram aparição direta, crossfades viram troca seca.

## Inventário de componentes (o vocabulário do produto)

Componentes com **anatomia fixa** — as telas apenas os compõem:

| Componente | Anatomia | Onde vive |
|---|---|---|
| **AppShell** | sidebar 260px + coluna de conteúdo + ⌘K | tudo |
| **Pulso** | ponto animado + estado + frase de atividade + link missões | sidebar (fixo) |
| **Briefing** | saudação (serifa 2xl) + parágrafo-carta + lista de trabalho realizado + assinatura | Home; versões curtas no detalhe de produto |
| **Card de Decisão** | eyebrow (tipo+produto) → frase do Head (serifa) → 2-3 evidências → impacto estimado + risco/reversibilidade → \[Aprovar]\[Ajustar]\[Recusar]\[Perguntar] | Home, Produto, IA |
| **Card de Descoberta** | eyebrow (tendência/oportunidade/alerta) → frase → evidência → \[Perguntar]\[Salvar no Conhecimento] | Home, Conhecimento |
| **Card de Missão** | estado (ponto) + objetivo → atividade atual ao vivo → diário de bordo (expansível) → origem/resultado | Missões, IA, Home |
| **Linha de Produto** | thumb + nome + anel de Saúde + tendência + ranking + oportunidades + última frase do Head | Produtos |
| **Anel de Saúde** | anel 0–100 com cor por faixa (≥80 verde, 50–79 âmbar, <50 vermelho) + número tabular | Produtos, detalhe |
| **Linha do tempo** | data + ação narrada + efeito medido | detalhe do produto, diário de missão |
| **Card de Versão** | v# + estado (ativa/arquivada) + o que mudou + resultado medido + \[Comparar]\[Restaurar] | detalhe do produto, IA |
| **Card de Conhecimento** | coleção + descoberta (serifa) + evidência + onde aplicado + resultado + \[Aplicar em…]\[Perguntar] | Conhecimento |
| **Composer** | input + sugestões contextuais + estado do Head | IA, ⌘K |
| **Toast do Head** | frase curta em primeira pessoa, canto inferior | tudo |

Regra de coesão: **um card de decisão na Home, no detalhe do produto e dentro do chat é o mesmo componente, pixel por pixel.** É isso que faz o produto parecer uma mente única e não um conjunto de telas.

## Acessibilidade e qualidade

- Contraste AA garantido: texto primário sobre `--bg` ≈ 15:1; secundário ≈ 7:1; âmbar sobre `--bg` ≈ 8:1.
- Foco visível sempre (anel âmbar 2px offset 2px), navegação 100% por teclado, `⌘K` como cidadão de primeira classe.
- Toda animação condicionada a `prefers-reduced-motion`.
- Números sempre `tabular-nums`; datas e horas sempre relativas primeiro ("há 2 horas"), absolutas no hover.

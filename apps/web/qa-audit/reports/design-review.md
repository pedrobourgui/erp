# Design Review — ERP (pt-BR)

**Método**: `qa-audit/design-review.spec.ts` capturou 87 PNGs a 2× em
`qa-audit/artifacts/design/` — 22 rotas em claro/escuro a 1440 px, 7 rotas a 390 px,
mais estados ricos (lista cheia, formulário longo, dialog, toast, vazio, carregando,
command palette, hover/foco, telas de detalhe, papel vendedor). Todas as imagens
citadas foram abertas e olhadas. Nomes de arquivo são relativos a
`/Users/mac/work/erp/apps/web/qa-audit/artifacts/design/`.

---

## Veredito

Isto não é um template — mas também ainda não é um produto de 2026. É um shadcn/ui
bem cuidado com **uma** ideia visual própria e boa: a sidebar navy profunda com barra
de acento esmeralda contra um canvas claro. Essa ideia sustenta a primeira impressão
e depois, literalmente, para na borda esquerda da tela. Do meio para a direita o
produto vira cinza-e-navy neutro: a ação primária é navy, o gráfico é navy, o ícone
do KPI é navy sobre navy/10. O verde `160 84% 39%` — a única cor com opinião no
sistema — aparece em três lugares decorativos (o quadrado do logo, a barra do item
ativo, a bolinha "Sistema ativo") e em um sparkline onde nem token é: é `#10b981`
escrito à mão em `kpi-card.tsx:90-104`. A paleta tem ponto de vista; a interface
não o usa.

O que mais denuncia, porém, é tipográfico e é um bug de infraestrutura com
consequência estética total: **Satoshi nunca carrega**. `app/globals.css:1` pede
Satoshi ao Google Fonts, que não serve essa família — verifiquei a resposta do
endpoint e ela contém apenas `@font-face` de Plus Jakarta Sans. Não há `.woff2`
local, não há `next/font/local`, não há Fontshare. Ou seja: o pareamento
display + corpo que o design system declara em `tailwind.config.ts:20-23` não existe
em runtime. Todo `font-heading` cai em Plus Jakarta Sans, a mesma fonte do corpo, e
por isso título e parágrafo têm exatamente a mesma voz em todas as 87 capturas. Some
a isso uma escala em que `text-sm` e `text-xs` respondem por 78% de todo o texto
dimensionado (251 + 224 ocorrências contra 1 de `text-base`), um `CardTitle` padrão
de 24 px que empilha quatro títulos do mesmo peso do H1 na mesma tela
(`1440-light-vendas-pedido-novo.png`), e cinco desenhos diferentes de card de
métrica convivendo em cinco telas — e o resultado é um produto que parece *montado*
com peças boas, não *desenhado*. A boa notícia: quase tudo que separa isto do
próximo patamar é ajuste de token e de default de componente, não redesenho.

### Notas

| Dimensão | Nota | Por quê, em uma frase |
|---|---|---|
| Hierarquia | **5** | H1 30 px e `CardTitle` 24 px são vizinhos demais, então quatro cards e o título da página disputam o mesmo degrau — e o `DialogTitle` (18 px) é *menor* que o título de um card, invertendo a importância. |
| Tipografia | **4** | A fonte de display do design system não carrega, a escala vive em dois degraus (12 e 14 px), `text-base` é usado uma única vez em todo o app e há quatro tamanhos arbitrários fora da escala (`text-[10px]`, `[11px]`, `[13px]`, `[15px]`). |
| Cor | **5** | O par navy + esmeralda é uma escolha legítima e memorável, mas o esmeralda nunca vira ação, o `--primary` inverte para quase-branco no escuro (levando a série do gráfico junto) e cinco sistemas de cor coexistem: tokens, `emerald-*` do badge, `yellow/purple/indigo/cyan-*` do status, `red/amber/blue-*` do toast e hexadecimais no sparkline. |
| Densidade | **4** | Linha de tabela com passo de 57 px medido, cabeçalho que não gruda, e três faixas de toolbar antes do primeiro dado — quem passa 8 h aqui vê 10 linhas onde caberiam 16. |
| Composição | **6** | O shell (sidebar + header + `max-w-[1600px]`) é sólido e a tela de pedido tem estrutura real, mas os formulários não têm largura máxima (textarea de 1060 px ≈ 130ch) e metade das telas é "cards empilhados". |
| Detalhamento | **6** | Transições, hover de linha, skeleton e truncamento estão cuidados; contra isso há quatro raios diferentes na mesma tela, botão de fechar do dialog de 16×16 px, `"20 por…"` cortado no select e a coluna Ações clipada em 1440 px em quase toda lista. |
| Estados | **6** | Skeleton e negação de permissão são bem desenhados; vazio e erro são ícone cinza + duas linhas de texto, sem ação e sem saber que o usuário acabou de buscar algo. |
| Identidade | **4** | O que se lembra amanhã é a sidebar — e só; tire-a e sobra um admin genérico que poderia ser de qualquer SaaS. |

---

## O que já está bom (específico)

- **A sidebar.** `--sidebar-bg: 225 33% 10%` com `grain-texture`, item ativo com
  `bg-white/[0.08]` + barra de 3 px em esmeralda e ícone que muda de cor junto
  (`sidebar.tsx:219`). É a única coisa da interface com assinatura.
  `1440-light-dashboard.png`.
- **A legenda de atalhos do balcão.** `F2 Buscar produto / F4 Selecionar cliente /
  F9 Finalizar venda / Esc Limpar busca` no trilho de resumo
  (`1440-light-vendas-balcao.png`). Isso é ERP de verdade, entende quem opera com as
  duas mãos no teclado, e é o detalhe mais "produto" do sistema inteiro.
- **O estado de sem permissão** (`1440-light-acesso-negado-vendedor.png`): moldura
  tracejada, ícone em círculo `bg-muted`, título, subtítulo explicando o caminho
  ("Fale com o administrador") e botão de saída. É exatamente o padrão que os outros
  estados deveriam copiar.
- **O skeleton da tabela** (`1440-light-estado-carregando.png`): toolbar e cabeçalho
  permanecem, só o `tbody` vira barras — zero layout shift quando os dados chegam.
- **A disciplina de truncamento** (`data-table.tsx:466-472`): o produto de 255
  caracteres trunca com reticências e mantém `title`, sem quebrar as outras colunas.
- **A grade de definição da tela de produto** (`1440-dark-produto-detalhe.png`):
  rótulo 12 px em caixa alta + valor 16 px, travessão para vazio. Bonito, legível,
  e é o único lugar do app onde o rótulo em caixa alta tem tracking correto.
- **Os inputs.** `bg-background` dentro de `bg-card` cria um rebaixo sutil de 2% de
  luminância; anel de foco com `ring-ring/30` + `border-ring` em vez do halo padrão.
  Detalhe fino (`input.tsx:13`).
- **O toast de submit inválido**: "Existem 4 campos obrigatórios não preenchidos ou
  inválidos." (`1440-light-toast-e-erros-de-form.png`) — conta *quantos*, não só
  que falhou.

---

## Os 10 ajustes de maior impacto (por impacto ÷ esforço)

### 1. A fonte de display não existe — carregar Satoshi de verdade

**Problema.** `app/globals.css:1` importa `family=Satoshi:wght@400;500;700;900` do
Google Fonts. O Google não serve Satoshi (é da Fontshare) e responde 200 devolvendo
**apenas** Plus Jakarta Sans — conferi o corpo da resposta. Não existe `.woff2` no
repo nem `next/font/local`. Logo, `font-heading` (`tailwind.config.ts:22`) sempre cai
no segundo item da pilha, que é a fonte do corpo. Título e texto têm a mesma voz em
todas as telas. De quebra, Plus Jakarta Sans é baixada **duas vezes** (via
`next/font/google` em `app/layout.tsx:7` e via `@import` render-blocking), e
`font-feature-settings: "cv02","cv03","cv04","cv11"` em `globals.css:103` são
codinomes de *character variants* do **Inter** — não existem em Plus Jakarta Sans,
são sobra de outro setup.

**Pior em.** `1440-light-dashboard.png` (o H1 "Dashboard" e o parágrafo abaixo têm
o mesmo desenho de letra) e `1440-light-vendas-pedido-novo.png` (H1, quatro títulos
de card e os rótulos, tudo na mesma família).

**Mudança.**

```css
/* app/globals.css — trocar a linha 1 por: */
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
/* Plus Jakarta Sans já vem por next/font em app/layout.tsx — não importar de novo. */

/* e remover o font-feature-settings do Inter (globals.css:103) */
```

Ideal: baixar os `.woff2` e usar `next/font/local` (`--font-heading`), ligando
`fontFamily.heading` a `var(--font-heading)`. Enquanto isso não acontece, uma
alternativa honesta é assumir Plus Jakarta Sans nos dois papéis e diferenciar por
peso/tracking — mas aí o design system deve dizer isso, não fingir um pareamento.

---

### 2. `CardTitle` de 24 px — o degrau que quebra a hierarquia da página inteira

**Problema.** `card.tsx:39` define `text-2xl font-semibold`. O H1 de página é
`text-3xl` (30 px). Seis pixels separam "o título da tela" de "o rótulo de uma
caixa", e como uma tela tem 3-5 cards, o olho encontra cinco elementos de peso
quase idêntico. O dashboard já contorna isso passando `className="text-lg"` em
todos os `CardTitle` (`app/(dashboard)/page.tsx:216, 288, 354`) — ou seja, o default
está errado e cada tela decide se corrige. E o `DialogTitle` é `text-lg` (18 px),
*menor* que um card, invertendo a importância do elemento mais modal do sistema.

**Pior em.** `1440-light-vendas-pedido-novo.png` — "Cliente", "Adicionar Produtos",
"Itens do Pedido" e "Resumo" a 24 px, todos brigando com "Nova Venda" a 30 px.
Comparar com `1440-light-dashboard.png`, onde o override para 18 px resolve.

**Mudança.** Escala de títulos com degraus reais e um passo de display:

```tsx
// components/ui/card.tsx:39
"text-lg font-semibold leading-tight tracking-tight font-heading"
// components/ui/dialog.tsx:92
"text-xl font-semibold leading-tight tracking-tight font-heading"
```

Escala alvo (px / peso / tracking):
`11 uppercase 600 +0.06em` (rótulo micro) · `12 500` (meta) · `14 400/500` (corpo e
tabela) · `16 500` (valor de detalhe — hoje `text-base` é usado **uma vez** no app
inteiro) · `18 600` (título de card) · `20 600` (título de dialog/seção) ·
`30 700 -0.02em` (título de página) · `38 700 -0.03em` (display do dashboard).
Eliminar `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]` (26 ocorrências
fora da escala).

---

### 3. A coluna "Ações" está cortada em 1440 px em quase toda lista

**Problema.** Não é responsividade: é `table-layout`. `data-table.tsx:149` só liga
`table-fixed` se alguma coluna declarar a prop `width` — e as telas escrevem a
largura no `className` (`"text-right w-[120px]"` em
`app/(dashboard)/estoque/produtos/page.tsx:200`), que o `hasDeclaredWidths` não
enxerga. Sem `table-fixed`, o layout é automático e a coluna Produto engorda até
empurrar Status e Ações para fora do container.

**Pior em.** `1440-light-estoque-produtos.png` (o badge "Ativo" sai cortado em
"Ativ", Ações não aparece), `1440-light-financeiro-lancamentos.png` (o lápis fica
metade fora), `1440-light-financeiro-caixa.png` ("Abert"/"Fecha").

**Mudança.** Passar `width` como prop (não como classe) nas colunas de largura fixa,
o que já liga o `table-fixed` existente:

```ts
{ id: "sku",       header: "SKU",       width: "150px", className: "font-mono text-xs" },
{ id: "name",      header: "Produto"                 },   // única sem width: absorve a sobra
{ id: "category",  header: "Categoria", width: "160px" },
{ id: "price",     header: "Preço",     width: "120px", nowrap: true, className: "text-right" },
{ id: "stock",     header: "Estoque",   width: "96px",  className: "text-right" },
{ id: "status",    header: "Status",    width: "120px" },
{ id: "actions",   header: "Ações",     width: "120px", noTruncate: true, className: "text-right" },
```

No mesmo passe, grudar o cabeçalho (uma lista de 100 linhas hoje perde os títulos na
linha 12 — `1440-light-lista-cheia.png`) e apertar a linha:

```tsx
// data-table.tsx:340
<thead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/70">
// data-table.tsx:454 — passo de 57px medido → 44px
"px-4 py-2 align-middle"
```

---

### 4. Cinco desenhos diferentes de card de métrica

**Problema.** O mesmo objeto conceitual ("um número importante") tem cinco formas:

| Tela | Desenho | Arquivo |
|---|---|---|
| Dashboard | rótulo+valor à esquerda, ícone em quadrado `bg-primary/10` à direita, sparkline opcional | `1440-light-dashboard.png` |
| Lançamentos | borda esquerda colorida, valor colorido, ícone em círculo à direita | `1440-light-financeiro-lancamentos.png` |
| Caixas | ícone em quadrado à **esquerda**, rótulo+valor à direita | `1440-light-financeiro-caixa.png` |
| Pedido | borda esquerda colorida, sem ícone, rótulo 12 px | `1440-light-pedido-detalhe.png` |
| Produto | ícone em quadrado tingido à esquerda, em **quatro cores fora da paleta** (verde, verde, azul, âmbar) | `1440-dark-produto-detalhe.png` |

E no dashboard os cinco cards da mesma linha têm **três alturas diferentes** (o
wrapper `animate-slide-up` é o item do grid, mas o `Card` interno não tem `h-full`),
deixando a base da fileira serrilhada — visível em `1440-light-dashboard.png` e
`1440-dark-dashboard.png`.

**Mudança.** Um `<StatCard>` único em `components/charts/stat-card.tsx` com
`variant?: "neutral" | "positive" | "negative" | "warning"`, `icon`, `trend`,
`sparkline`, e o consumo em todas as cinco telas. Anatomia fixa:

```tsx
<Card className="h-full">
  <CardContent className="flex h-full items-start justify-between gap-4 p-5">
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p className="font-heading text-[28px] font-bold leading-none tabular-nums">{value}</p>
      {trend}
    </div>
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">{icon}</div>
  </CardContent>
</Card>
```

Correção pontual junto: `"+100.0%"` e `"vs. mês anterior"` colidem e quebram em duas
linhas no card "Ticket Médio" nos dois temas — `kpi-card.tsx:54-72` precisa de
`flex-wrap` + `whitespace-nowrap` no rótulo, ou o rótulo desce para uma linha própria.

---

### 5. Dark mode é inversão, não tema — a sidebar some no fundo

**Problema.** `--sidebar-bg: 225 33% 6%` e `--background: 225 33% 7%`: **1% de
luminância**. No escuro não há fronteira alguma entre navegação e conteúdo, e a
única ideia visual do produto (a sidebar como plano escuro contra um canvas claro)
evapora. Some a isso: `shadow-soft/elevated/float` são sombras pretas
(`globals.css:276-297`), invisíveis sobre fundo escuro — no escuro a elevação
inteira depende de 3% de diferença entre `--card` (10%) e `--background` (7%), e
`--popover` é **idêntico** a `--card`, então um dropdown sobre um card tem zero
separação (`1440-dark-select-aberto.png`).

**Pior em.** `1440-dark-dashboard.png`, `1440-dark-estoque-produtos.png`.

**Mudança.** Redesenhar a escada de superfícies do escuro (e não só inverter):

```css
.dark {
  --background: 225 30% 9%;    /* era 7% */
  --card:       225 26% 13%;   /* era 10% */
  --popover:    225 24% 16%;   /* era 10% — precisa ficar acima do card */
  --sidebar-bg: 225 35% 6%;    /* mantém, mas agora 3% abaixo do background */
  --border:     225 18% 22%;   /* era 18% */
}
```

E dar à sidebar uma borda explícita, já que sombra não funciona no escuro:

```tsx
// components/layouts/sidebar.tsx:118
"... bg-sidebar-bg border-r border-black/40 dark:border-white/[0.06] ..."
```

Complemento barato: `:root { color-scheme: light }` / `.dark { color-scheme: dark }`
— hoje não existe em `globals.css`, e é o que faz o calendário nativo dos
`<input type="date">` de `/financeiro/lancamentos` e o autofill seguirem o tema.

---

### 6. O verde é decorativo — transformá-lo no idioma da interação

**Problema.** `--accent: 160 84% 39%` é a única cor com opinião no sistema e nunca
toca uma ação. A ação primária é `--primary` navy (`1440-light-estoque-produtos.png`),
que no escuro inverte para quase-branco (`1440-dark-estoque-produtos.png`) — dois
botões primários completamente diferentes entre os temas. O anel de foco muda de
semântica com o tema: navy no claro (`--ring: 222 47% 18%`) e verde no escuro
(`--ring: 160 84% 39%`). E a série do gráfico usa `--primary`, então a linha de
"Vendas do Período" é navy no claro e **branca** no escuro
(`1440-dark-dashboard.png`), enquanto o sparkline logo acima é `#10b981` cravado no
código (`kpi-card.tsx:90-104`). Por fim, `--accent` e `--success` são **o mesmo HSL**:
uma cor que é simultaneamente marca e semântica não pode ser usada livremente em
nenhum dos dois papéis.

**Mudança.** Separar identidade de semântica e dar ao verde os pontos de contato da
interação:

```css
:root {
  --accent:  160 84% 39%;   /* marca / interação */
  --success: 152 58% 34%;   /* semântica — deixa de colidir com a marca */
  --ring:    160 84% 39%;   /* mesmo anel de foco nos dois temas */

  --chart-1: 160 84% 39%;   /* série principal */
  --chart-2: 222 47% 30%;
  --chart-3: 38  92% 50%;
  --chart-4: 199 89% 48%;
  --chart-5: 262 60% 55%;
}
```

Aplicar em: anel de foco (os dois temas), links de tabela
(`text-primary` → `text-accent` em `page.tsx:143`), linha selecionada
(`bg-primary/5` → `bg-accent/8`), sublinhado da aba ativa, e **todas** as séries de
gráfico — `stroke="hsl(var(--chart-1))"` em `app/(dashboard)/page.tsx:261,373` e
`kpi-card.tsx:90-104` no lugar dos hexadecimais. O botão primário pode continuar
navy (contraste e sobriedade num ERP é escolha defensável) — o que não pode é o
verde nunca significar nada clicável.

---

### 7. Quatro raios na mesma tela

**Problema.** `--radius: 0.625rem` (10 px) é o token, mas:
`Card` usa `rounded-xl` = **12 px** (`card.tsx:12`, valor default do Tailwind, não
passa pelo token), `Button`/`Input` usam `rounded-lg` = **10 px**,
o container da `DataTable` usa `rounded-md` = **8 px** (`data-table.tsx:330`),
`Badge` **8 px** (`badge.tsx:7`), `StatusBadge` `rounded-full`, e o `DialogContent`
`sm:rounded-lg` = **10 px** (`dialog.tsx:38`).

**Pior em.** `1440-light-financeiro-caixa.png` — cards de 12 px, tabela de 8 px,
badges de 8 px e pílulas de status, tudo na mesma dobra.

**Mudança.** Uma família só, derivada do token:

```ts
// tailwind.config.ts — borderRadius
xl: "calc(var(--radius) + 4px)",   // 14px — card, dialog, container de tabela
lg: "var(--radius)",               // 10px — botão, input, select, popover
md: "calc(var(--radius) - 3px)",   //  7px — badge, kbd, ícone-botão
sm: "calc(var(--radius) - 5px)",   //  5px — checkbox
```

e trocar `rounded-md` → `rounded-xl` no container da tabela (`data-table.tsx:330`) e
`sm:rounded-lg` → `rounded-xl` no dialog.

---

### 8. O dialog usa a superfície mais baixa do sistema — e o "fechar" tem 16 px

**Problema.** `dialog.tsx:38` pinta o modal com `bg-background`. No tema claro
`--background` é `210 20% 98%` e `--card` é branco puro: o elemento mais elevado da
interface é **mais cinza** que um card comum, e qualquer `Card` dentro do dialog fica
mais claro que o próprio dialog. A sombra é `shadow-lg` (default do Tailwind) e não a
`shadow-float` da casa. O botão de fechar (`dialog.tsx:44`) é o ícone de 16 px sem
padding: alvo de 16×16 px, abaixo dos 24 px que o próprio briefing exige.

**Pior em.** `1440-light-dialog-aberto.png` — o "x" quase invisível no canto e o
corpo do dialog visivelmente acinzentado.

**Mudança.**

```tsx
// dialog.tsx:38
"... bg-popover text-popover-foreground p-6 shadow-float rounded-xl max-h-[85vh] overflow-y-auto ..."
// dialog.tsx:44
"absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground
 opacity-80 transition-colors hover:bg-muted hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
```

---

### 9. Formulário sem largura máxima: campo numérico de 522 px, textarea de 130ch

**Problema.** Os formulários herdam o `max-w-[1600px]` do shell
(`app/(dashboard)/layout.tsx:50`) e nada os contém. Em
`1440-light-estoque-produto-novo.png` a textarea "Descrição" tem 1060 px — cerca de
**130 caracteres por linha**, quase o dobro do limite confortável de leitura — e
"Estoque mínimo", que aceita 1 a 3 dígitos, tem os mesmos 522 px de "Nome". A largura
do campo é uma dica de conteúdo que o formulário está desperdiçando. Em contrapartida
o formulário só usa duas colunas de 1112 px, o que obriga a espalhar o produto por
cinco abas de cinco campos.

**Mudança.** Casca com medida e campos dimensionados pelo conteúdo:

```tsx
<div className="mx-auto w-full max-w-4xl">        {/* 896px */}
  <div className="grid grid-cols-12 gap-x-5 gap-y-6">
    <Field className="col-span-7">Nome</Field>
    <Field className="col-span-5">SKU</Field>
    <Textarea className="col-span-12 max-w-[70ch]" rows={4} />
    <Field className="col-span-6">Categoria</Field>
    <Field className="col-span-6">Marca</Field>
    <Field className="col-span-3">Estoque mínimo</Field>  {/* ~200px */}
  </div>
</div>
```

No mesmo lote, o segmentado "Pessoa Física / Pessoa Jurídica"
(`1440-light-toast-e-erros-de-form.png`) hoje é dois botões `outline` cuja diferença
entre selecionado e não selecionado é só a cor da borda — praticamente ilegível.
Trilho + polegar resolve:

```tsx
<div className="inline-flex rounded-lg bg-muted p-1">
  <button className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all",
    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} />
</div>
```

---

### 10. Vazio e erro são texto no vácuo — e a toolbar come 130 px antes do primeiro dado

**Problema (a).** `1440-light-estado-vazio.png`: o usuário digitou
`zzqqxx-nao-existe` e recebeu "Nenhum registro encontrado / Tente ajustar os filtros
ou criar um novo registro." — genérico, sem citar o termo buscado, sem botão para
limpar a busca, sem botão para criar. O bloco de erro (`data-table.tsx:396-409`) tem
a mesma anatomia pobre. O contraste é gritante com
`1440-light-acesso-negado-vendedor.png`, que é o mesmo tipo de estado bem resolvido.

**Problema (b).** Em toda lista há **três faixas** empilhadas antes da tabela:
breadcrumb + título/ações, depois a linha do botão "Filtros" sozinho, depois a linha
"busca + Exportar CSV". São ~130 px e duas linhas quase vazias
(`1440-light-estoque-produtos.png`, `1440-light-clientes.png`).

**Mudança.**

```tsx
// (a) um <StateBlock> único, no molde do permission-denied-state.tsx
<StateBlock
  icon={<Inbox className="h-6 w-6" />}          // 24px dentro de um círculo bg-muted de 48px
  title={search ? `Nenhum produto para “${search}”` : "Nenhum produto cadastrado"}
  description={search ? "Verifique a grafia ou limpe a busca." : "Cadastre o primeiro para começar a vender."}
  action={search
    ? <Button variant="outline" size="sm" onClick={clearSearch}>Limpar busca</Button>
    : <Button size="sm" onClick={goNew}><Plus className="mr-2 h-4 w-4" />Novo produto</Button>}
/>
```

```tsx
// (b) toolbar em uma faixa só (data-table.tsx:280-299)
<div className="flex flex-wrap items-center gap-2">
  <div className="relative min-w-[240px] flex-1 max-w-sm">{/* busca */}</div>
  {filtersToggle}
  <div className="ml-auto flex items-center gap-2">{exportButton}</div>
</div>
```

Junto: `"20 por…"` está cortado no `SelectTrigger` de 140 px
(`data-table.tsx:504`) — mudar o rótulo para `"20 / página"` e a largura para
`w-[120px]`; e o cabeçalho de página a 390 px derruba o botão primário para fora da
tela (`390-light-estoque-produtos.png`, "Novo P…") — o container do título precisa de
`flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` com os botões em
`w-full sm:w-auto`.

---

## Direção estética

**Não jogue o design system fora — ele já tem a tese certa e a executa em 15% da
tela.** A tese é: *um plano navy profundo que ancora a navegação, um canvas claro e
sóbrio para o dado, e um esmeralda que marca o que está vivo.* É uma direção
credível para ERP brasileiro — sobriedade de sistema financeiro com um sinal vital
verde. O erro atual é que a tese vive só na sidebar. A evolução é **estendê-la ao
conteúdo**, não substituí-la.

Três movimentos, em ordem:

**1. Levar o navy para dentro do conteúdo como estrutura, não como botão.**
Hoje o navy só aparece como preenchimento de CTA. Ele deveria ser o material do
*chrome*: cabeçalho de tabela, faixa de cabeçalho de página, rótulos em caixa alta.
Concretamente, um `--surface-header` que não existe hoje:

```css
:root { --surface-header: 222 30% 96%; }   /* thead, faixa do título, toolbar */
.dark { --surface-header: 225 28% 12%; }
```

Com `thead` em `bg-[hsl(var(--surface-header))]` e rótulo de coluna em
`text-[11px] font-semibold uppercase tracking-[0.06em]`, a tabela — que é onde o
usuário passa as 8 horas — ganha uma personalidade que hoje não tem, sem custar
densidade.

**2. Fazer o esmeralda significar interação, sempre.** Anel de foco, link, linha
selecionada, aba ativa, série principal de gráfico, item ativo do menu. Um verde só,
em todos os lugares onde o sistema responde ao usuário — e um `--success` separado
para semântica (ajuste 6). Quando o verde quer dizer *"aqui o sistema está te
respondendo"*, a interface fica memorável sem ganhar nenhum enfeite.

**3. Tipografia com voz de display e números com voz própria.** Depois de carregar
Satoshi de verdade (ajuste 1), reservá-la para 20 px+ — título de página, valor de
KPI, total. E adotar uma mono do sistema em vez de deixar `font-mono` cair no
Menlo/Consolas do SO (é o que acontece hoje em SKU, CPF e número de pedido —
`produtos/page.tsx:133`):

```ts
// tailwind.config.ts
fontFamily: {
  sans:    ['var(--font-sans)', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
  heading: ['var(--font-heading)', '"Satoshi"', 'var(--font-sans)', 'sans-serif'],
  mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
},
```

```css
/* globals.css — dinheiro, quantidade e data alinham por padrão */
th, td { font-variant-numeric: tabular-nums; }
```

Três famílias com papéis nítidos — Satoshi manda no que é importante, Plus Jakarta
Sans carrega o texto, a mono carrega identificador e código — resolvem sozinhas a
maior parte do "parece template". O resto é o que já está listado acima: um card de
métrica, uma escala de raio, uma escada de superfícies que funciona no escuro, e
estados vazios que se comportam como parte do produto e não como mensagem de erro
de banco de dados.

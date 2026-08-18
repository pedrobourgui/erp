# DS — Auditoria transversal do design system

> **Escopo**: o que é comum a todas as telas — tokens, escala, raio, altura de
> controle, tooltip, toast, responsividade, dark mode, acessibilidade da shell e
> estados de carregamento. Não avalia regra de negócio de módulo.
>
> **Como foi medido**: `qa-audit/design-system.spec.ts`, Chromium real, **28 rotas**
> (23 estáticas de `lib/nav-items.ts` + `app/(dashboard)/**/page.tsx`, mais 5 de
> detalhe resolvidas com ids reais da API), nos temas claro e escuro, em
> 390×900, 768, 1024 e 1440 (mais 390×667 para os diálogos), como `owner` e como `seller`.
> Medições cruas em `qa-audit/artifacts/ds/*.json`, screenshots em
> `qa-audit/artifacts/ds/*.png`.
>
> **Nenhum registro foi criado.** As duas provas de toast respondem à mutação
> dentro do navegador (`page.route`) — a requisição nunca chega à API.
>
> **`captureNoise` limpo**: zero `console.error`, zero `pageerror`, zero HTTP ≥ 400
> nas 28 rotas do owner (`artifacts/ds/inventory-noise.json`). Nenhum 500 escondido
> atrás de spinner neste ciclo.

## Resumo por severidade

| Severidade | Achados |
|---|---|
| Crítico | 3 |
| Alto | 7 |
| Médio | 11 |
| Baixo | 5 |
| **Total** | **26** |

Os 5 mais graves, em ordem: **DS-01** (nenhum botão de ação de linha tem nome
acessível — 60/60 em `/estoque/produtos`), **DS-02** (15 mutações fora do
`getMutationErrorMessage` — AE-10 reaberto e reproduzido no navegador),
**DS-03** (18 de 22 diálogos sem `max-h`; três já estouram a tela em 390×667),
**DS-06** (AE-07 real em 1024 px: valor de KPI cortado, 202px de conteúdo em
121px, sem scroll), **DS-04** (`--muted-foreground` reprova AA por 0,005 em
100 % das telas — uma linha de `globals.css` zera 90 % dos achados de contraste).

**Concentração**: 3 arquivos de primitivo — `components/ui/tooltip.tsx`,
`components/ui/dialog.tsx` e `app/globals.css` — respondem por 3 dos 3 críticos
e por 2 dos 7 altos. Nenhum dos achados desta auditoria é de uma tela só.

---

## 1. Inventário de inconsistência — rota × contagem

1440 px, tema claro, `owner`. Fonte: `artifacts/ds/inventory-table.json` e
`inventory-detail.json`.

| Rota | fora da escala 4px | contraste < AA | cor literal | alvo < 24px | raio divergente | corte sem scroll |
|---|---|---|---|---|---|---|
| `/` | 15 | 3 | 7 | 5 | 1 | 2 |
| `/estoque` | 10 | 3 | 2 | 20 | 0 | 2 |
| `/estoque/produtos` | 10 | 3 | 2 | 20 | 0 | 2 |
| `/estoque/categorias` | 10 | 4 | 0 | 2 | 0 | 2 |
| `/estoque/marcas` | 10 | 3 | 0 | 2 | 0 | 2 |
| `/estoque/movimentacoes` | 10 | 4 | 3 | 2 | 0 | 2 |
| `/estoque/depositos` | 10 | 3 | 1 | 2 | 1 | 2 |
| `/estoque/alertas` | 10 | 4 | 3 | 9 | 0 | 2 |
| `/estoque/produtos/novo` | 10 | 3 | 0 | 3 | 1 | 2 |
| `/vendas` → `/vendas/pedidos` | 10 | 3 | 6 | 22 | 0 | 2 |
| `/vendas/pedidos` | 10 | 3 | 6 | 22 | 0 | 2 |
| `/vendas/pedidos/novo` | 10 | 3 | 0 | 3 | 1 | 2 |
| `/vendas/balcao` | 10 | 4 | 0 | 2 | 1 | 2 |
| `/clientes` | 10 | 3 | 0 | 21 | 0 | 2 |
| `/clientes/novo` | 10 | 3 | 0 | 3 | 1 | 2 |
| `/financeiro` → `/financeiro/lancamentos` | 10 | 7 | 5 | 2 | 1 | 2 |
| `/financeiro/contas` | 10 | 3 | 1 | 2 | 1 | 2 |
| `/financeiro/lancamentos` | 10 | 7 | 5 | 2 | 1 | 2 |
| `/financeiro/caixa` | 10 | 4 | 4 | 2 | 1 | 2 |
| `/configuracoes` | 10 | 3 | 0 | 2 | 1 | 2 |
| `/configuracoes/condicoes-pagamento` | 10 | 3 | 2 | 2 | 1 | 2 |
| `/configuracoes/metodos-pagamento` | 10 | 3 | 2 | 2 | 1 | 2 |
| `/configuracoes/perfil` | 10 | 3 | 0 | 2 | 1 | 2 |
| `/estoque/produtos/[id]` | 13 | 2 | 6 | 3 | 1 | 2 |
| `/estoque/produtos/[id]/edit` | 10 | 3 | 0 | 4 | 1 | 2 |
| `/clientes/[id]` | 10 | 3 | 0 | 2 | 1 | 2 |
| `/clientes/[id]/edit` | 10 | 3 | 0 | 4 | 1 | 2 |
| `/vendas/pedidos/[id]` | 14 | 3 | 1 | 3 | 1 | 2 |
| **total bruto** | **292** | **96** | **56** | **170** | **19** | **56** |

### Agrupado por causa — 689 sintomas, 6 causas (duas delas falso positivo)

| Sintomas | Rotas | Causa raiz (arquivo) |
|---:|---:|---|
| 96 (contraste) | 28 | `--muted-foreground: 215 16% 47%` dá **4,495:1** sobre `--background`. Falha AA por 0,005. `app/globals.css:25` |
| 292 (escala 4px) | 28 | Meios-passos do Tailwind na shell e nas abas: `py-2.5` (10px) em `sidebar.tsx:213,250`, `py-1.5`/`px-1.5`/`gap-1.5` (6px) em `header.tsx:76,82,117`, `py-0.5` (2px) no `kbd`, `py-3.5` (14px) em célula de tabela, `py-2.5` nas 6 barras de abas |
| 19 (raio) | 19 | `Card` usa `rounded-xl` = **12px**; `--radius` = 10px e é o que `Button`, `Input`, `Select` e `Dialog` usam. `components/ui/card.tsx:12` |
| 56 (cor literal) | 15 | 3 primitivos: `status-badge.tsx` (90 literais), `badge.tsx:20-22` (`emerald-500`/`amber-700` com `--success`/`--warning` disponíveis), `toast.tsx:29-41` (32 literais) |
| 170 (alvo < 24px) | 28 | **Falso positivo**: 168 são links de texto *inline* (breadcrumb 20px, nome de produto/pedido na célula 18px) — exceção explícita do WCAG 2.5.8 — e 2 são `input.sr-only` de 1×1. Nenhum controle real do sistema está abaixo de 24px. |
| 56 (corte sem scroll) | 28 | **Falso positivo**: os 56 são `span.sr-only` (`w-1 overflow-hidden`, por design) em `header.tsx:92,107`. O corte real só apareceu em 1024 px — ver DS-06. |

O `--muted-foreground` sozinho responde por **~90 % dos 96 achados de contraste**.
Corrigir uma linha de `globals.css` zera a coluna inteira em 28 telas.

---

## 2. Deriva entre telas equivalentes (números)

1440 px, tema claro. Fonte: `artifacts/ds/drift.json`.

| Rota | h1 | ritmo (`space-y`) | cabeçalho | raio do card | padding do card | alturas de botão | input | select | gap do grid |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 30px/700 | **32px** | **64px** | 12px | 24px | 36 | — | — | **20px** |
| `/estoque/produtos` | 30px/700 | 24px | 60px | — | — | 32,36,40 | **40** | **36** | — |
| `/estoque/marcas` | 30px/700 | 24px | 60px | — | — | 32,36,40 | **40** | **36** | — |
| `/estoque/depositos` | 30px/700 | 24px | 60px | 12px | **24px** | 40 | — | — | 16px |
| `/estoque/produtos/novo` | 30px/700 | 24px | 60px | 12px | 24px | 36,40,**42** | 40 | — | 16px |
| `/vendas/pedidos` | 30px/700 | 24px | 60px | — | — | 32,36,40 | 40 | 36 | — |
| `/vendas/balcao` | 30px/700 | 24px | 60px | 12px | 24px | 36,40 | 40 | — | **24,16,12px** |
| `/clientes` | 30px/700 | 24px | 60px | — | — | 32,36,40 | 40 | 36 | — |
| `/financeiro/lancamentos` | 30px/700 | 24px | 60px | 12px | **16px** | 32,36,40 | 40 | 36 | **16,12px** |
| `/financeiro/contas` | 30px/700 | 24px | 60px | 12px | 0px | 32,36,40 | **36** | — | — |
| `/financeiro/caixa` | 30px/700 | 24px | 60px | 12px | **16px + 24px** | 32,36,40 | — | 36 | 16px |
| `/configuracoes` | 30px/700 | 24px | 60px | 12px | 24px | 36,40,**42** | 40 | 36 | 16px |
| `/configuracoes/condicoes-pagamento` | 30px/700 | 24px | 60px | 12px | 0px | 32,36,40 | **36** | — | — |
| `/configuracoes/metodos-pagamento` | 30px/700 | 24px | 60px | 12px | 0px | 32,36,40 | **36** | — | — |
| `/configuracoes/perfil` | 30px/700 | 24px | 60px | 12px | 24px + 0px | 40 | 40 | — | 16px |
| `/estoque/produtos/[id]` | 30px/700 | 24px | **56px** | 12px | **16px + 24px** | 40 | — | — | **16,24px** |
| `/clientes/[id]` | 30px/700 | 24px | 60px | 12px | **16px + 24px** | 36,40,**42** | — | — | 16px |
| `/vendas/pedidos/[id]` | 30px/700 | 24px | 60px | 12px | **16px + 24px** | 40,**42** | — | — | 16px |

**O que bate:** `h1` mede **30px / peso 700 / Satoshi nas 28 rotas** — as 25 telas
usam literalmente a mesma string `text-3xl font-bold tracking-tight`, e `/vendas`,
`/financeiro` e `/estoque` são `redirect()` para a primeira tela do grupo
(`app/(dashboard)/vendas/page.tsx:9`), então herdam o destino. Raio do card 12px
e borda `1px rgba(229,231,235,0.6)` em 100 % dos cards. O bloco de cabeçalho mede
60px em 25 de 28 rotas.

**O que não bate, medido:**
- ritmo vertical: **32px** em `/` (`space-y-8`, `app/(dashboard)/page.tsx:67`) contra **24px** (`space-y-6`) nas outras 27;
- cabeçalho: 64px em `/` e 56px em `/estoque/produtos/[id]` contra 60px nas demais;
- padding de card: **24px**, **16px** e **0px** convivendo — e 6 telas com dois valores diferentes na mesma página;
- gap de grid: **20px** (`/`), **24px**, **16px** e **12px**;
- altura de input: **40px** em 14 telas, **36px** em 3;
- altura de select: **36px** sempre — 4px abaixo do input, lado a lado no mesmo filtro;
- altura de botão: **32 / 36 / 40 / 42px** convivendo na mesma tela.

Detalhamento e arquivo culpado: DS-11 (select×input), DS-12 (busca), DS-13 (KPI),
DS-14 (raio), DS-18 (abas, o 42px).

---

## Achados

### [CRÍTICO] DS-01: nenhum botão de ação de linha tem nome acessível — o tooltip não é rótulo
- **Tela**: todas as listagens (1440, claro, owner). Medido em `/estoque/produtos`, `/clientes`, `/estoque/categorias`, `/estoque/marcas`, `/vendas/pedidos`
- **Evidência** (`artifacts/ds/tooltip-accessible-name.json`): em `/estoque/produtos`, **60 de 60** botões só-ícone da tabela não têm `aria-label`, `title` nem `.sr-only`. `page.getByRole("button", { name: "Editar" })` → **0**; `"Excluir"` → **0**; `"Ver detalhes"` → **0**. Idem `/clientes` (40/40), `/estoque/categorias` (12/12), `/estoque/marcas` (8/8), `/vendas/pedidos` (20/40). A contagem acompanha o número de linhas na página — o que não muda é a razão: nenhum tem nome.
  Varredura estática: **35 dos 45** controles só-ícone envolvidos em `<Tooltip>` no repositório não têm nenhum rótulo textual.
- **Esperado**: `apps/web/CLAUDE.md` — "todo botão só-ícone precisa de tooltip **ou** `aria-label`". Um tooltip Radix vira `aria-describedby` (descrição), nunca `aria-labelledby` (nome). Para leitor de tela o botão continua sendo "botão". WCAG 4.1.2 (A).
- **Arquivo**: `components/ui/tooltip.tsx:24-49` — o primitivo recebe `content: string` e não o repassa ao trigger. Consumidores: `app/(dashboard)/estoque/produtos/page.tsx:92-105`, `estoque/marcas/page.tsx:40-60`, `estoque/categorias/page.tsx:70-85`, `clientes/page.tsx:66-78`, e mais 31 pontos.
- **Correção**: no `Tooltip`, clonar o filho com `aria-label={content}` quando ele ainda não tiver um:
  ```tsx
  const child = React.Children.only(children) as React.ReactElement;
  const labelled = child.props["aria-label"] || child.props.title
    ? child
    : React.cloneElement(child, { "aria-label": content });
  ```
  Uma linha no primitivo resolve os 35 pontos de uma vez.

### [CRÍTICO] DS-02: 15 mutações não passam por `getMutationErrorMessage` — AE-10 reaberto, provado no navegador
- **Tela**: `/configuracoes/perfil` (prova), mais 14 pontos (1440, claro, owner)
- **Evidência** (`artifacts/ds/toast-ae10.json`, screenshots `toast-ae10-a-marcas.png` / `toast-ae10-b-perfil.png`): com a mutação respondida por um **500 `{"message":"Internal server error"}`**:
  - `/estoque/marcas` (usa `getMutationErrorMessage`) → toast **"Erro ao criar marca."** ✔
  - `/configuracoes/perfil` (usa só `getApiErrorMessage`) → toast **"Internal server error"** ✘ — texto técnico, em inglês, na cara do usuário.
- **Esperado**: `apps/web/CLAUDE.md` — "On error, always go through `getMutationErrorMessage(error, fallback)`… The helper already handles 403 and **5xx (generic fallback — a stack trace helps nobody)**. A error toast without it does not pass code review."
  `getApiErrorMessage` (`lib/api.ts:136`) trata 403 mas **não trata 5xx**: devolve `response.data.message` cru.
- **Arquivo**: os 15 pontos que chamam `getApiErrorMessage(err) ?? "…"` dentro de um `catch` de mutação:
  `app/(dashboard)/configuracoes/perfil/_components/profile-form.tsx:62` ·
  `…/perfil/_components/password-form.tsx:74` ·
  `app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:381,605` ·
  `app/(dashboard)/configuracoes/metodos-pagamento/page.tsx:449` ·
  `app/(dashboard)/estoque/produtos/page.tsx:80` ·
  `app/(dashboard)/financeiro/contas/_components/transfer-dialog.tsx:98` ·
  `app/(dashboard)/financeiro/lancamentos/_components/delete-entry-dialog.tsx:70` ·
  `…/edit-entry-dialog.tsx:99` · `…/reverse-settlement-dialog.tsx:85` · `…/settle-entry-dialog.tsx:91` ·
  `app/(dashboard)/vendas/balcao/page.tsx:527` ·
  `app/(dashboard)/vendas/pedidos/novo/page.tsx:426` ·
  `app/(dashboard)/vendas/pedidos/[id]/_components/exchange-dialog.tsx:92` ·
  `components/orders/status-actions.tsx:105`
- **Correção**: trocar `getApiErrorMessage(err) ?? "fallback"` por `getMutationErrorMessage(err, "fallback")` nos 15 pontos, e adicionar regra de lint/`grep` no CI: `grep -rn "getApiErrorMessage(" app | grep -B2 "catch"` deve dar zero.

### [CRÍTICO] DS-03: 18 de 22 diálogos sem `max-h` — em 390×667 três já estouram a tela sem rolagem
- **Tela**: `/financeiro/contas`, `/financeiro/lancamentos`, `/configuracoes/metodos-pagamento` (390×667, claro, owner)
- **Evidência** (`artifacts/ds/dialog-390.json`, screenshots `dialog390-*.png`):

  | Diálogo | `max-height` | altura | viewport | fora da tela | rola? |
  |---|---|---|---|---|---|
  | `/financeiro/contas` — Nova conta | `none` | **746px** | 667 | **+39,5px** | `overflow-y: visible` |
  | `/financeiro/lancamentos` — Novo lançamento | `none` | **738px** | 667 | **+35,5px** | `overflow-y: visible` |
  | `/configuracoes/metodos-pagamento` — Novo método | `none` | **762px** | 667 | **+47,5px** | `overflow-y: visible` |
  | `/estoque/depositos` — Novo depósito | `566,95px` (=85vh) | 566,9 | 667 | −50px | `hidden` ✔ |
  | `/configuracoes/condicoes-pagamento` | `566,95px` (=85vh) | 561 | 667 | −53px | `hidden` ✔ |

  O diálogo é `position: fixed` centralizado: os 39–47px que sobram **não são alcançáveis por scroll**. É o FN-14/AE-26.
- **Esperado**: `apps/web/CLAUDE.md` — "Dialogs: `max-h-[85vh]`, scrollable body, fixed footer. A dialog that grows without limit puts its own buttons out of reach."
- **Arquivo**: `components/ui/dialog.tsx:38` — o `DialogContent` base não tem `max-h`; a regra ficou por conta de cada chamador e **18 dos 22 esqueceram**:
  `financeiro/caixa/page.tsx:173` · `financeiro/caixa/_components/cash-register-dialogs.tsx:99,195,271,359` ·
  `financeiro/contas/page.tsx:451` · `financeiro/contas/_components/transfer-dialog.tsx:108` ·
  `financeiro/lancamentos/_components/{delete,settle,edit,reverse-settlement,entry-form}-*.tsx` ·
  `vendas/pedidos/[id]/_components/exchange-dialog.tsx:100` ·
  `configuracoes/_components/invite-user-dialog.tsx:105` · `configuracoes/metodos-pagamento/page.tsx:460` ·
  `components/forms/{category,brand}-form-dialog.tsx` · `components/forms/import-csv-dialog.tsx:93`.
  `components/ui/confirm-dialog.tsx:100` também não tem.
- **Correção**: mover a regra para o primitivo —
  `DialogContent`: `"… flex max-h-[85vh] flex-col overflow-hidden …"` e o corpo com `overflow-y-auto`.
  Depois remover o `max-h-[85vh]` duplicado dos 4 que já tinham. O mesmo em `confirm-dialog.tsx:100`.

---

### [ALTO] DS-04: `--muted-foreground` reprova AA por 0,005 em 100 % das telas
- **Tela**: todas as 28 (1440, claro, owner)
- **Evidência** (`artifacts/ds/token-contrast.json`, `inventory-detail.json`): `--muted-foreground` (`215 16% 47%` → `rgb(101,117,139)`) sobre `--background` (`210 20% 98%` → `rgb(249,250,251)`) = **4,495:1**. Mínimo AA para texto normal: 4,5:1.
  Aparece medido em 27 das 28 rotas: subtítulo do cabeçalho (16px), breadcrumb (14px), rótulo de filtro (12px), SKU na célula, texto de estado vazio, `kbd` "Ctrl K" (4,49 com opacidade 0,7). Sobre `--card` (branco puro) sobe para 4,697:1 — passa; sobre o fundo da página, não.
- **Esperado**: `apps/web/CLAUDE.md` — "Acessibilidade: contraste AA (4.5:1 / 3:1 grande)".
- **Arquivo**: `app/globals.css:25`
- **Correção**: `--muted-foreground: 215 16% 43%` → 5,42:1 sobre `--background` e 5,66:1 sobre `--card`. No escuro já está em 5,29:1, sem mudança.

### [ALTO] DS-05: `--accent-foreground` sobre `--accent` = 2,59:1 — branco sobre o verde da marca reprova nos dois temas
- **Tela**: sidebar (item ativo), botões `variant="success"`, `Badge`, ícones de destaque, botão "Entrar" do login (1440, claro **e** escuro)
- **Evidência** (`artifacts/ds/token-contrast.json`): `--accent-foreground` (`0 0% 100%`) sobre `--accent` (`160 84% 39%`) = **2,592:1** no claro e no escuro. Também: `--accent / --background` = 2,48:1 (claro) — texto verde sobre a página reprova; `--success / --background` = 2,48:1; `--warning / --background` = 2,04:1; no escuro `--warning-foreground / --warning` = 2,75:1 e `--destructive / --background` = 2,66:1.
- **Esperado**: AA 4,5:1 para texto normal, 3:1 para texto grande e para componentes de interface (WCAG 1.4.11).
- **Arquivo**: `app/globals.css:27-40` (claro) e `:72-85` (escuro); consumidores em `components/ui/button.tsx:24-27`, `components/layouts/sidebar.tsx:219`, `app/(auth)/login/page.tsx:133`.
- **Correção**: escurecer `--accent` para `160 84% 29%` (≈ 4,9:1 com branco) ou trocar `--accent-foreground` para `160 84% 12%`. `--warning` já tem `--warning-foreground` escuro no tema claro; no escuro ele virou `0 0% 100%` (`globals.css:82`) e quebrou — voltar para `38 92% 14%`.

### [ALTO] DS-06: AE-07 real em 1024 px — os KPIs do dashboard são cortados sem scroll
- **Tela**: `/` (1024×900, claro, owner)
- **Evidência** (`artifacts/ds/responsive-1024.json`): 3 cards com `scrollWidth > clientWidth` e `overflow-x: hidden`, sem `text-overflow: ellipsis`:
  `"Vendas do Dia R$ 4.955,90"` → **202px de conteúdo em 121px**; `"A Receber (aberto)"` → 202 → 121; `"Ticket Médio"` → 184 → 121.
  Não acontece em 390, 768 nem 1440 — só em 1024, que é exatamente onde `lg:` liga as 5 colunas **e** a sidebar de 264px ainda é fixa: (1024 − 264 − 64) / 5 ≈ 139px por coluna, 121px de área útil, contra 24px de padding de cada lado.
- **Esperado**: `apps/web/CLAUDE.md` — "conteúdo cortado sem scroll é AE-07"; "wide content scrolls inside its own container".
- **Arquivo**: `app/(dashboard)/page.tsx:169-178` (`lg:grid-cols-5`) + `components/charts/kpi-card.tsx:44` (`<Card className="overflow-hidden">`)
- **Correção**: subir o breakpoint de 5 colunas — `md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` — e tirar o `overflow-hidden` do `KPICard` (ou trocar por `truncate` no `<p>` do valor, com `title`).

### [ALTO] DS-07: shell sem skip link, sem `aria-current` e sem nome nos landmarks — 13 Tabs até o conteúdo, em todas as telas
- **Tela**: todas as 28 (1440, claro, owner)
- **Evidência** (`artifacts/ds/a11y-shell.json`):
  - `skipLink: false`; `<main>` sem `id`.
  - Ordem de tabulação a partir do topo: 13 paradas seguidas na sidebar (`sidebar:a:EERP System`, `Dashboard`, `Estoque`, `Produtos`, `Categorias`, `Marcas`, `Movimentações`, `Depósitos`, `Alertas`, `Vendas`, `Clientes`, `Financeiro`, `Configurações`) **antes** de qualquer coisa do header ou do conteúdo. Com um grupo aberto, mais 6.
  - `aria-current` no menu: **0 ocorrências**. Em `/estoque/produtos`, "Estoque" e "Produtos" estão visualmente ativos (`bg-white/[0.08]`) e nenhum dos dois tem `aria-current`.
  - `<aside><nav>` sem `aria-label`.
- **Esperado**: `apps/web/CLAUDE.md` — "Acessibilidade: … ordem de tabulação"; WCAG 2.4.1 (Bypass Blocks, A) e 4.1.2.
- **Arquivo**: `app/(dashboard)/layout.tsx:44-49` (o `<main>`), `components/layouts/sidebar.tsx:145` (o `<nav>`), `sidebar.tsx:210-255` (item ativo)
- **Correção**: `id="conteudo"` no `<main>`; um `<a href="#conteudo" className="sr-only focus:not-sr-only …">Pular para o conteúdo</a>` como primeiro filho do layout; `aria-label="Menu principal"` no `<nav>`; `aria-current={isActive ? "page" : undefined}` no `<Link>` e `aria-expanded` no `<button>` de grupo.

### [ALTO] DS-08: `ConfirmDialog` não é um diálogo — sem `role`, sem foco preso, sem devolver o foco
- **Tela**: qualquer exclusão; medido em `/estoque/marcas` (1440, claro, owner)
- **Evidência** (`artifacts/ds/a11y-dialog.json`, screenshot `confirm-dialog-focus.png`): com o diálogo aberto, `role: null`, `aria-modal: null`, `aria-labelledby: null`, `max-height: none`. Oito Tabs seguidos: **7 caem FORA do diálogo** (chegam a "20 por página" da paginação atrás do overlay) e só o 8º volta para dentro. Ao fechar com Esc, `document.activeElement` = `body` — o foco **não** volta ao botão que abriu.
  Para comparação, o `Dialog` do Radix na mesma varredura: `aria-labelledby: "radix-:rr:"`, `aria-describedby: "radix-:rs:"`, `max-height: 765px`, raio 10px — correto.
- **Esperado**: `apps/web/CLAUDE.md` — "`aria-*` em dialogs"; WCAG 2.4.3 e 4.1.2. O sistema tem dois diálogos: um certo (Radix) e um caseiro que não.
- **Arquivo**: `components/ui/confirm-dialog.tsx:92-155`
- **Correção**: reescrever o `ConfirmDialog` sobre `components/ui/dialog.tsx` (Radix já dá foco preso, `aria-modal`, retorno de foco e Esc). Se tiver de continuar caseiro: `role="alertdialog" aria-modal="true" aria-labelledby` no wrapper, foco inicial no botão de cancelar, ciclo de Tab preso e `previouslyFocused.focus()` no unmount.

### [ALTO] DS-09: paleta de comandos — Tab escapa, Esc para de funcionar e a seleção é invisível para leitor de tela
- **Tela**: qualquer (Ctrl+K); medido em `/estoque/produtos` (1440, claro, owner)
- **Evidência** (`artifacts/ds/a11y-palette.json`, screenshot `command-palette.png`): abre com Ctrl+K ✔, foco no `input` ✔, "Digite ao menos 2 caracteres" ✔. Mas:
  - um **Tab** move o foco para `a:Início` na sidebar, **fora** da paleta (`afterTab: "FORA:a:Início"`);
  - com o foco fora, **Esc não fecha mais** — a paleta continuou montada (`closed: false`), porque o handler de Escape está no `onKeyDown` do input. Só clicando no overlay para sair.
  - semântica: `role="listbox"` ausente, `role="option"` = 0, `aria-activedescendant` ausente, `aria-expanded` ausente, sem região `aria-live`. A navegação por setas existe e funciona visualmente, mas nada disso é anunciado.
- **Esperado**: `apps/web/CLAUDE.md` — "a paleta de comandos navegável só pelo teclado"; WAI-ARIA Combobox Pattern.
- **Arquivo**: `components/layouts/command-palette.tsx:71-93` (Escape só no input), `:102-112` (sem foco preso), `:115-123` (input sem `role="combobox"`), `:150-167` (resultados como `<button>` em vez de `role="option"`)
- **Correção**: mover o listener de Escape para `document` enquanto `open`; prender o Tab dentro do container; `role="combobox" aria-expanded aria-controls aria-activedescendant={id do item ativo}` no input, `role="listbox"` na lista e `role="option" aria-selected` em cada resultado.

### [ALTO] DS-10: 304 cores literais no lugar de token — três primitivos concentram 128
- **Tela**: 15 das 28 medidas em tempo de execução; 25 arquivos no código
- **Evidência**: varredura do DOM (`inventory-detail.json`) achou 56 elementos com classe literal em 15 rotas; varredura do código achou **304 ocorrências** de `(text|bg|border|ring)-(gray|slate|red|green|blue|yellow|emerald|amber|orange|indigo|purple|cyan)-\d+` em `app/` + `components/`. Concentração:
  `components/ui/status-badge.tsx` **90** · `app/(dashboard)/vendas/balcao/page.tsx` 46 · `app/(dashboard)/vendas/pedidos/novo/page.tsx` 45 · `components/ui/toast.tsx` **32** · `components/forms/payment-selector.tsx` 17 · `app/(dashboard)/financeiro/lancamentos/page.tsx` 12 · `components/ui/badge.tsx` **6** · `components/charts/kpi-card.tsx` 4 · outros 52.
  Mais 39 usos de `-white`/`-white/xx` (19 só em `components/layouts/sidebar.tsx`, que tem `--sidebar-fg` e `--sidebar-active` disponíveis).
  Os tokens `--success`, `--warning`, `--danger` existem em `globals.css:33-40` e estão registrados no Tailwind (`tailwind.config.ts:58-69`) — e não são usados por nenhum desses.
- **Esperado**: `apps/web/CLAUDE.md` — "Cor só via token (`bg-background`, `text-muted-foreground`, `border-border`, `bg-success`, …). `text-gray-500` ou `bg-[#fff]` é achado."
- **Arquivo**: `components/ui/status-badge.tsx:14-29,57` · `components/ui/badge.tsx:20-22` · `components/ui/toast.tsx:29-41` · `components/layouts/sidebar.tsx:128,131,163,213-234`
- **Correção**: começar pelos três primitivos (128 das 304, e são eles que aparecem em toda tabela do sistema). `badge.tsx` é trivial: `bg-success/15 text-success` e `bg-warning/15 text-warning`. `status-badge.tsx` precisa de uma paleta de estado nos tokens (`--state-pending`, `--state-shipped`, …) — a alternativa é aceitar por escrito que status é a exceção documentada.

---

### [MÉDIO] DS-11: `SelectTrigger` mede 36px e `Input` mede 40px — desalinham em todo painel de filtro
- **Tela**: `/estoque/produtos`, `/estoque/categorias`, `/estoque/marcas`, `/estoque/movimentacoes`, `/estoque/alertas`, `/vendas/pedidos`, `/clientes`, `/financeiro/lancamentos`, `/financeiro/caixa`, `/configuracoes` (1440, claro)
- **Evidência** (`artifacts/ds/drift.json`): em 10 rotas o mesmo `drift` traz `inputH: 40` e `selectH: 36` — 4px de diferença entre dois controles que ficam lado a lado no grid do `FilterPanel`.
- **Esperado**: `apps/web/CLAUDE.md` — "altura de controle têm que bater entre telas equivalentes".
- **Arquivo**: `components/ui/select.tsx:20` (`h-9`) vs `components/ui/input.tsx:13` (`h-10`). Sintoma do mesmo mal-entendido: `components/tables/data-table.tsx:504` e `components/forms/payment-line.tsx:186,225` escrevem `className="h-9"` no `SelectTrigger` **que já é h-9** — o autor achava que o padrão fosse 40.
- **Correção**: `h-10` no `SelectTrigger` (e em `components/forms/searchable-select.tsx:164`, que copia as classes), e remover os `h-9` redundantes.

### [MÉDIO] DS-12: `ListSearch` mede 36px e a busca do `DataTable` mede 40px — a mesma caixa em duas alturas
- **Tela**: `/financeiro/contas`, `/configuracoes/condicoes-pagamento`, `/configuracoes/metodos-pagamento` (36px) contra as 14 telas de `DataTable` (40px), 1440, claro
- **Evidência** (`artifacts/ds/drift.json`): coluna `inputH` — 36 nas três telas de tabela caseira, 40 em todas as demais.
- **Esperado**: mesmo componente lógico, mesma medida.
- **Arquivo**: `components/tables/list-search.tsx:54` (`className="h-9 pl-9"`) vs `components/tables/data-table.tsx:288` (`className="pl-9"`, herda `h-10`)
- **Correção**: tirar o `h-9` do `ListSearch`.

### [MÉDIO] DS-13: quatro implementações de card de KPI — 24px, 16px e 16px de padding, 20px e 16px de gap
- **Tela**: `/` (24px/20px) vs `/financeiro/lancamentos` e `/financeiro` (16px/16px) vs `/financeiro/caixa` (16px) vs `/clientes/[id]`, `/estoque/produtos/[id]`, `/vendas/pedidos/[id]` (16px)
- **Evidência** (`artifacts/ds/drift.json`, screenshots `cmp-header-*.png`): a coluna `cardPad` alterna entre `24px 24px`, `16px 16px` e as duas juntas na mesma tela (`/financeiro/caixa`, `/clientes/[id]`). `gridGap`: 20px em `/`, 16px em quase tudo, 12px e 24px em `/financeiro/lancamentos` e `/vendas/balcao`.
- **Esperado**: "Padding de card, gap de grid e altura de controle têm que bater entre telas equivalentes."
- **Arquivo**: quatro componentes com o mesmo papel —
  `components/charts/kpi-card.tsx:45` (`CardContent p-6`, valor `text-2xl font-bold`, rótulo `text-sm font-medium`) ·
  `app/(dashboard)/financeiro/lancamentos/page.tsx:332-355` (`TotalCard`, `p-4`, valor `text-2xl font-bold`, rótulo `text-sm`) ·
  `app/(dashboard)/clientes/[id]/page.tsx:186-199` (`SummaryCard`, `p-4`, valor **`text-lg`**, rótulo **`text-xs`**) ·
  `app/(dashboard)/financeiro/caixa/page.tsx:130-147` (inline, `p-4`)
- **Correção**: promover `KPICard` a primitivo único com `size="sm" | "md"` e apagar `TotalCard`, `SummaryCard` e os cards inline.

### [MÉDIO] DS-14: `Card` tem raio 12px; `--radius` é 10px e é o que todos os outros primitivos usam
- **Tela**: 19 das 28 (as que renderizam `Card`), 1440, claro e escuro
- **Evidência** (`artifacts/ds/inventory-detail.json`, `drift.json`): `border-radius: 12px` em todo `div.rounded-xl.border.border-border/60.bg-card`; `Button`, `Input`, `SelectTrigger` e `DialogContent` medem 10px. `rounded-xl` não passa pelo `--radius` porque `tailwind.config.ts:76-80` só sobrescreve `lg`, `md` e `sm`.
- **Esperado**: `apps/web/CLAUDE.md` — "`--radius: 0.625rem`. Card, input, botão, badge e dialog precisam concordar."
- **Arquivo**: `components/ui/card.tsx:12`
- **Correção**: `rounded-lg` no `Card` — ou, se 12px for a intenção, declarar `xl: "calc(var(--radius) + 2px)"` em `tailwind.config.ts` e subir os outros junto. O que não pode é o card ter um raio que não vem do token.

### [MÉDIO] DS-15: `Card` usa `border-border/60`, e `--border` já está em 1,19:1 — a borda some, e no escuro a sombra some junto
- **Tela**: todas as 19 com `Card`; pior no escuro
- **Evidência** (`artifacts/ds/token-contrast.json`, `drift.json`): `--border` sobre `--card` = **1,238:1** no claro e **1,257:1** no escuro; sobre `--background`, 1,185 e 1,323. O `Card` ainda aplica 60 % de opacidade — medido `rgba(229,231,235,0.6)` em todas as 19 rotas, ou seja ~1,14:1.
  No escuro a sombra não compensa: `.shadow-soft` é `hsl(225 33% 10% / 0.04)` (`globals.css:276-281`) — praticamente a própria cor do `--card` (`225 33% 10%`) a 4 % de opacidade, invisível sobre `--background` (`225 33% 7%`). Card sem borda perceptível e sem elevação.
- **Esperado**: WCAG 1.4.11 pede 3:1 para limite de componente de interface; `apps/web/CLAUDE.md` — "borda sempre `border-border`".
- **Arquivo**: `components/ui/card.tsx:12` (`border-border/60`), `app/globals.css:42` e `:87` (`--border`), `app/globals.css:276-297` (sombras)
- **Correção**: `border-border` sem opacidade no `Card`; `--border: 220 13% 85%` (claro) e `225 20% 26%` (escuro) para chegar perto de 1,6–2:1 no limite de card e ≥3:1 em `--input`; e uma sombra específica de dark (`hsl(0 0% 0% / 0.5)`).

### [MÉDIO] DS-16: o toast não é anunciado, não pode ser pausado e não tem nome no botão de fechar
- **Tela**: qualquer (medido em `/estoque/marcas`, 1440, claro e escuro)
- **Evidência** (`artifacts/ds/toast-anatomy.json`, screenshots `toast-stack.png`, `toast-dark.png`):
  - contêiner: `role: null`, `aria-live: null` — **um leitor de tela nunca sabe que apareceu um toast**, nem de sucesso nem de erro.
  - botão de fechar: 24×24px, `aria-label: null` (só um `<Tooltip content="Fechar">`, que pelo DS-01 não vira nome).
  - três cliques no submit ⇒ **3 toasts idênticos empilhados**, sem deduplicação e sem teto.
  - some sozinho em 4000ms fixos, **sem pausar no hover ou no foco** e sem histórico. É justamente o toast de erro que carrega o motivo do backend ("Já existe uma marca com este nome") e some no meio da leitura.
  - o que está certo: contraste do texto 9,16:1; sucesso e erro se distinguem por ícone (`CheckCircle2` vs `AlertCircle`), não só por cor; raio 10px bate com o token.
- **Esperado**: WCAG 4.1.3 (Status Messages, AA) e 2.2.1 (Timing Adjustable, A); `apps/web/CLAUDE.md` — "Acessibilidade: `aria-*`".
- **Arquivo**: `components/ui/toast.tsx:119` (contêiner sem `role`/`aria-live`), `:64-69` (timer fixo, sem pausa), `:80-88` (botão sem `aria-label`), `:103-109` (`addToast` sem deduplicação/limite)
- **Correção**: `role="region" aria-label="Notificações"` no contêiner e `role="status" aria-live="polite"` (ou `assertive` para `error`) em cada item; `aria-label="Fechar notificação"` no botão; pausar o timer em `onMouseEnter`/`onFocus`; duração maior para `error` (7s) que para `success` (4s); ignorar um `addToast` com a mesma mensagem+variante ainda visível.

### [MÉDIO] DS-17: para o `seller`, quatro botões somem sem uma palavra — 12 `<Can>` de botão usam `mode="hide"`
- **Tela**: `/estoque/produtos`, `/estoque/categorias`, `/estoque/marcas` (1440, claro, **seller**)
- **Evidência** (`artifacts/ds/permission-disabled.json`, screenshots `seller-*.png`): comparando o mesmo cabeçalho como `owner` e como `seller` (que tem `products:read` mas não `products:create`):
  `/estoque/produtos` → sumiram **"Importar CSV"** e **"Novo Produto"**; `/estoque/categorias` → sumiu **"Nova Categoria"**; `/estoque/marcas` → sumiu **"Nova Marca"**.
  Nas cinco rotas medidas, `[data-testid="permission-disabled"]` = **0** — nenhum `<Can mode="disable">`, nenhum tooltip explicando. Os únicos botões desabilitados na tela são os de paginação (esperado).
- **Esperado**: `apps/web/CLAUDE.md` — "For buttons, prefer `<Can mode="disable">` (disabled + tooltip) over hiding: a control that vanishes with no explanation confuses as much as the 403 did."
- **Arquivo**: 12 `<Can>` sem `mode` envolvendo botão —
  `app/(dashboard)/estoque/marcas/page.tsx:224` · `estoque/categorias/page.tsx:262` · `estoque/produtos/page.tsx:283` ·
  `clientes/page.tsx:74,228` · `clientes/[id]/page.tsx:131` ·
  `financeiro/lancamentos/page.tsx:182,190,204,218`
- **Correção**: `mode="disable"` nesses 12. O `Can` já renderiza o tooltip "Você não tem permissão para esta ação" (`components/auth/can.tsx:61`) — falta só passar o modo.

### [MÉDIO] DS-18: seis barras de abas escritas à mão, nenhuma com `role="tab"` e nenhuma navegável por seta
- **Tela**: `/configuracoes`, `/estoque/produtos/novo`, `/estoque/produtos/[id]/edit`, `/clientes/[id]`, `/vendas/pedidos/[id]`, diálogo de movimentação
- **Evidência**: `grep 'role="tab'` no repositório inteiro → **0**. Não existe `components/ui/tabs.tsx`. As seis cópias repetem o mesmo bloco `flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium` — e é esse `py-2.5` que produz a altura de botão **42px** medida em `/configuracoes`, `/estoque/produtos/novo`, `/clientes/[id]` e `/vendas/pedidos/[id]` (`artifacts/ds/drift.json`), fora da escala de 4px.
- **Esperado**: `apps/web/CLAUDE.md` — componentes em `components/ui/`, sem lógica duplicada; WAI-ARIA Tabs Pattern (setas ←/→, `aria-selected`, `aria-controls`).
- **Arquivo**: `app/(dashboard)/configuracoes/page.tsx:34-51` · `estoque/produtos/novo/page.tsx:351-365` · `estoque/produtos/[id]/edit/page.tsx` · `clientes/[id]/page.tsx:147-160` · `vendas/pedidos/[id]/page.tsx:150-163` · `estoque/movimentacoes/_components/movement-form-dialog.tsx`
- **Correção**: um `components/ui/tabs.tsx` (Radix Tabs já resolve teclado e ARIA) com `py-2` ou `py-3`, e as seis telas passam a consumi-lo. Isso também fecha a ponta solta do AE-11 (`lib/form-tabs.ts` badgear a aba com erro) num lugar só.

### [MÉDIO] DS-19: `DataTable` — tabela sem `role`, sem `aria-label`, sem `scope` e sem `aria-sort`
- **Tela**: as 14 telas de `DataTable` (1440, claro, owner)
- **Evidência** (`artifacts/ds/a11y-shell.json`, `/estoque/produtos`): `role: null`, `aria-label: null`, `caption: false`, `th` com `scope`: **0 de 7**, `aria-sort`: 0, `th` ordenável sem `role="button"` nem `tabindex`: 0 de 7 acessíveis por teclado — a ordenação é `onClick` num `<th>`, inalcançável sem mouse.
- **Esperado**: `apps/web/CLAUDE.md` — "`role`/`aria-label` na tabela"; WCAG 2.1.1 (Keyboard, A) para o cabeçalho ordenável.
- **Arquivo**: `components/tables/data-table.tsx:334-383`
- **Correção**: `aria-label` (nova prop, obrigatória) na `<table>`; `scope="col"` em cada `<th>`; `aria-sort={sort?.column === col.id ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}`; e trocar o `onClick` do `<th>` por um `<button>` interno com o texto do cabeçalho.

### [MÉDIO] DS-25: no tema escuro `text-destructive` cai para 2,53:1 — o vermelho de erro fica ilegível
- **Tela**: `/financeiro/lancamentos`, `/financeiro`, `/financeiro/caixa`, `/vendas/balcao`, `/configuracoes/metodos-pagamento`, `/estoque/movimentacoes` (1440, **escuro**, owner)
- **Evidência** (`artifacts/ds/dark-detail.json`, `token-contrast.json`, screenshot `dark-_financeiro_contas.png`): rodando a mesma varredura com `authenticate(page, "owner", "dark")`:
  - `text-destructive` → `rgb(165,39,39)` sobre `rgb(12,15,24)` = **2,53–2,66:1** (mínimo 4,5). O token: `--destructive` vira `0 62% 40%` no escuro (`globals.css:75`) contra `0 72% 51%` no claro — ficou **mais escuro** num fundo escuro.
  - `text-red-600` (valores monetários) → **3,96:1** — os literais que não têm variante `dark:` (`financeiro/lancamentos/page.tsx:80-81`, `financeiro/caixa/page.tsx:139,223`, `vendas/pedidos/[id]/_components/finance-tab.tsx:16`, `components/charts/kpi-card.tsx:58,63`).
  - `--warning-foreground` sobre `--warning` = **2,75:1** no escuro (era 6,10 no claro): `globals.css:82` trocou o marrom escuro por `0 0% 100%`.
  - bordas: 12 rotas com par borda/fundo abaixo de 1,25:1 — `rgb(37,41,55)` sobre `rgb(29,33,48)` = **1,11:1**, e nos badges de status `rgb(153,27,27)` sobre `rgba(127,29,29,0.3)` = 1,21:1.
  - o que melhora no escuro: `--muted-foreground` sobe para 5,29:1 (passa) — a contagem de contraste cai de 96 para 8 no total.
- **Esperado**: `apps/web/CLAUDE.md` — "Dark mode: always support via `dark:` variants"; "toda tela precisa funcionar nos dois temas".
- **Arquivo**: `app/globals.css:75,81-82,87` (tokens do escuro) e os 6 arquivos com `text-red-600`/`text-green-600` sem `dark:`
- **Correção**: `--destructive: 0 72% 58%` e `--warning-foreground: 38 92% 14%` no bloco `.dark`; trocar os `text-red-600`/`text-green-600` por `text-destructive`/`text-success` (que aí passam a herdar a correção do token).

### [MÉDIO] DS-26: três linguagens de carregamento para o mesmo trabalho — 9 skeleton, 12 spinner, 4 nada
- **Tela**: todas as 25 rotas reais (1440, claro, owner). Fonte: `artifacts/ds/loading-states.json` (amostragem do DOM a cada 120ms desde o `domcontentloaded` até estabilizar) e `loading-*.png`
- **Evidência**:

  | Tipo | Rotas |
  |---|---|
  | **skeleton** (9) | `/`, `/estoque/produtos`, `/estoque/categorias`, `/estoque/marcas`, `/estoque/movimentacoes`, `/estoque/depositos`, `/estoque/alertas`, `/vendas/pedidos`, `/clientes` |
  | **spinner** (12) | `/financeiro/contas`, `/financeiro/lancamentos`, `/financeiro/caixa`, `/configuracoes`, `/configuracoes/condicoes-pagamento`, `/configuracoes/metodos-pagamento`, `/configuracoes/perfil`, `/estoque/produtos/[id]`, `/estoque/produtos/[id]/edit`, `/clientes/[id]`, `/clientes/[id]/edit`, `/vendas/pedidos/[id]` |
  | **nada** (4) | `/estoque/produtos/novo`, `/vendas/pedidos/novo`, `/vendas/balcao`, `/clientes/novo` — telas de formulário sem busca inicial bloqueante; aceitável, mas os selects de categoria/marca/depósito carregam em silêncio |

  A divisão não segue nenhuma intenção de design: segue a implementação. Quem usa
  `DataTable` ganha 80–160 linhas de skeleton de graça (`data-table.tsx:110-120`);
  quem escreveu a própria tabela ou é tela de detalhe cai num `Loader2` de página
  inteira. `/clientes/[id]` fica **5,7s** só com o spinner.
  Não existe **nenhum** `loading.tsx` no `app/` (só `error.tsx` e `not-found.tsx`),
  então não há fallback de Suspense em nenhuma rota.
- **Esperado**: `apps/web/CLAUDE.md` — "Loading: skeleton ou spinner em toda busca"; "Colocate loading.tsx, error.tsx, not-found.tsx with page.tsx". A regra permite os dois, mas a escolha tem que ser do design, não do acaso.
- **Arquivo**: `components/tables/data-table.tsx:110-120` (skeleton) vs `components/auth/require-permission.tsx:35-40` e as 12 telas com `<Loader2 className="animate-spin">` de página inteira (`financeiro/contas/page.tsx`, `configuracoes/perfil/page.tsx`, `clientes/[id]/page.tsx`, …)
- **Correção**: definir a regra — *lista = skeleton de linha; detalhe/formulário = skeleton de bloco; ação pontual = spinner* — extrair um `components/ui/skeleton.tsx` e trocar os 12 spinners de página inteira por skeleton do layout que vai aparecer. `require-permission.tsx` pode continuar spinner (é gate, não conteúdo).

---

### [BAIXO] DS-20: `buttonVariants` — a variante `ghost` base é código morto e o `action="success"` pinta o texto de vermelho
- **Evidência**: `defaultVariants` define `action: "default"` (`components/ui/button.tsx:47`), então o `compoundVariant` `{variant:"ghost", action:"default"}` (`:52-56`) se aplica a **todo** botão ghost e o `twMerge` descarta o `hover:bg-accent/10 hover:text-accent-foreground` da variante base (`:20-21`). Nenhum botão ghost do sistema usa a cor que está escrita na variante.
  No mesmo bloco, `{variant:"ghost", action:"success"}` (`:63-67`) traz `text-destructive` — copiado do caso `delete`. Ainda não morde ninguém: `action="success"` tem **0 usos**. Os dois compounds usam `hover:text-white` literal em vez de `text-*-foreground`.
- **Arquivo**: `components/ui/button.tsx:20-21,52-68`
- **Correção**: apagar o `hover:` da variante `ghost` base (ou o compound `action:"default"`), trocar `text-destructive` por `text-success` no compound de `success` e `hover:text-white` por `hover:text-destructive-foreground` / `hover:text-accent-foreground`.

### [BAIXO] DS-21: sidebar e header dependem do anel de foco padrão do navegador, não do `ring-ring`
- **Evidência** (`artifacts/ds/a11y-focus.json`, foco real aplicado e `getComputedStyle` lido): `aside a[href="/"]` → `outline: auto 1px rgb(0,95,204)`; grupo "Estoque" e filho "Produtos" → `auto 1px rgb(35,117,211)`; `header button[aria-label="Buscar"]` → `auto 1px`. Já `Button`, `Input` e `SelectTrigger` do `components/ui/` entregam `box-shadow` com a cor de `--ring`. Ou seja: o anel existe (não é "foco ausente"), mas é o azul do Chrome, de 1px, sobre a sidebar `225 33% 10%` — e muda de aparência conforme o navegador.
- **Arquivo**: `components/layouts/sidebar.tsx:213,231,250` e `components/layouts/header.tsx:72`
- **Correção**: acrescentar `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg` nos itens de menu e `focus-visible:ring-2 focus-visible:ring-ring` no gatilho de busca.

### [BAIXO] DS-22: o "×" de limpar do `SearchableSelect` é um `<svg onClick>` — não é botão, não recebe foco, tem 14px
- **Evidência**: `components/forms/searchable-select.tsx:175-177` — `<X className="h-3.5 w-3.5 …" onClick={handleClear} />` dentro do `<button>` do trigger. Não é focável, não tem nome acessível, mede 14×14px (abaixo dos 24px do WCAG 2.5.8, e aqui **não** vale a exceção de texto inline), e o clique dispara dentro de outro botão.
- **Arquivo**: `components/forms/searchable-select.tsx:174-178`
- **Correção**: tirar o `X` de dentro do trigger e renderizar um `<button type="button" aria-label="Limpar seleção" className="h-6 w-6 …">` irmão, com `e.stopPropagation()`.

### [BAIXO] DS-23: `Tooltip` desaparece silenciosamente quando `content` é vazio
- **Evidência**: `components/ui/tooltip.tsx:25-27` — `if (!content) return <>{children}</>`. Hoje é risco latente: as 62 chamadas passam literais ou constantes não-vazias (`components/auth/can.tsx:61`, `components/layouts/sidebar.tsx:159`), então nada está silenciado agora. O risco é o dia em que alguém passar `content={item.hint}` — o tooltip some sem erro, sem aviso e sem teste que pegue.
- **Correção**: manter o atalho, mas garantir o rótulo mesmo assim — na correção do DS-01, aplicar `aria-label` **antes** do early return, e adicionar um `console.warn` em dev quando `content` for vazio e o filho não tiver `aria-label`.

### [BAIXO] DS-24: `/login` é outro sistema visual
- **Evidência**: `app/(auth)/login/page.tsx` — `Input` e `Button` com `h-11` (44px) contra os 40px de todo o resto; 17 cores literais (`bg-white/[0.06]`, `border-white/10`, `text-white/30`, `text-red-400`); rótulo `text-sm font-medium leading-none text-white/70` (quinta variante de rótulo do sistema); tagline `text-white/25` sobre o `gradient-mesh`, ~1,6:1.
- **Arquivo**: `app/(auth)/login/page.tsx:95-146,152`
- **Correção**: no mínimo subir a tagline para `text-white/60` e alinhar `h-11` → `h-10`. O tema escuro dedicado do login pode ficar, mas via tokens (`--sidebar-bg`, `--sidebar-fg`).

---

## 3. Responsividade — o que **não** quebrou

390×900, 768 e 1024, nas 28 rotas (`artifacts/ds/responsive-{390,768,1024}.json`):

| Viewport | overflow horizontal | tabela que não rola | botão de menu | sidebar |
|---|---|---|---|---|
| 390 | 0/28 | 0 | visível em 28/28 | fora da tela em 28/28 ✔ |
| 768 | 0/28 | 0 | visível em 28/28 | fora da tela em 28/28 ✔ |
| 1024 | 0/28 | 0 | oculto em 28/28 | fixa em 28/28 ✔ |

`document.scrollWidth === clientWidth` em todas as rotas e viewports. Todas as
tabelas largas rolam dentro do próprio container (`overflow-x: auto`) — a maior,
`/estoque/movimentacoes`, tem 1394px de tabela em 356px de wrapper e rola.
O `min-w-0` de `app/(dashboard)/layout.tsx:43` está fazendo o trabalho.
**A única exceção medida é o DS-06** (KPIs do dashboard em 1024).
Um `<table>` fora de wrapper com rolagem: `components/forms/import-csv-dialog.tsx:162`.

O `clipped = 2` que aparece em toda linha da tabela do §1 é o `span.sr-only` do
header (`header.tsx:92,107`), que é `w-1 overflow-hidden` por definição — não é
conteúdo cortado.

---

## 4. Dark mode — o que muda

Mesma varredura com `authenticate(page, "owner", "dark")`, 28 rotas
(`artifacts/ds/dark-table.json`, `dark-detail.json`; screenshots `light-*.png` /
`dark-*.png`). `documentElement.classList.contains("dark")` = `true` em 28/28.

| Métrica | Claro | Escuro |
|---|---:|---:|
| contraste abaixo de AA | 96 | **8** |
| cor literal | 56 | 55 |
| raio divergente | 19 | 19 |
| pares borda/fundo abaixo de 1,25:1 | — | **15 em 12 rotas** |
| `console.error` / `pageerror` / HTTP ≥ 400 | 0 | 0 |

O escuro é **melhor** em contraste de texto corrido (o `--muted-foreground` do
escuro está em 5,29:1 e passa) e **pior** em tudo que é vermelho e em tudo que é
borda — ver DS-25 e DS-15. Nenhuma tela quebrou no escuro; nenhuma cor literal
sumiu (as `dark:` variantes do `status-badge` e do `toast` existem e funcionam).

---

## 5. Método e limitações

- Cada rota é medida depois de um *render gate* (`settle()`): espera o `<main>`
  ter `h1` ou >120 caracteres e nenhum `.animate-spin`, até 25s. Sem isso, em modo
  dev, 8 rotas ainda estavam em branco aos 2s e teriam entrado no relatório como
  "sem `h1`" e "sem card" — foi exatamente o falso negativo que a primeira
  rodada produziu.
- `measure().missingFocusRing` e `.smallHitTargets` são heurísticas de classe
  CSS. Ambas foram **reverificadas no navegador** (DS-21 e a nota da tabela do
  §1) e as duas se revelaram majoritariamente falso-positivo — estão relatadas
  como tal, não como achado.
- As duas provas de toast usam `page.route()` para responder à mutação no
  navegador. Nenhuma linha foi escrita no banco em nenhum momento desta auditoria.

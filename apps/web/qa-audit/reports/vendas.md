# QA UX/UI — Módulo Vendas (`VND`)

**Escopo**: `/vendas`, `/vendas/pedidos`, `/vendas/pedidos/novo`, `/vendas/pedidos/[id]`, `/vendas/balcao`
**Spec**: `qa-audit/vendas.spec.ts` (22 testes, todos verdes — o spec observa e mede, não afirma)
**Evidências**: `qa-audit/artifacts/vnd/` (37 screenshots)
**Ambiente**: web `localhost:3100`, API `localhost:3001/api/v1`, Chromium 1440×900 / 768 / 390, temas claro e escuro, papéis `owner` e `seller`.

> Como rodar: `npx playwright test -c qa-audit/playwright.qa.config.ts qa-audit/vendas.spec.ts --reporter=list --output=qa-audit/artifacts/vnd-run`
> (o `--output` aponta para `vnd-run` de propósito: o Playwright **limpa** o diretório de output no início da execução, e os screenshots do relatório moram em `vnd/`.)

## Resumo

| Severidade | Qtd |
|---|---|
| Crítico | 2 |
| Alto | 5 |
| Médio | 9 |
| Baixo | 6 |
| **Total** | **22** |

Registros criados neste ciclo (sufixo `qa-vnd-<timestamp>` nas observações): `PED-000116` a `PED-000128`, todos de R$ 89,90 (Capinha iPhone 15 Pro Silicone, 1.376 un. em estoque). Cada execução completa da suíte cria 3 pedidos: 1 pelo teste de duplo submit e 2 pelo teste da janela de corrida — estes últimos são sempre um par duplicado (achado VND-01) e podem ser cancelados. Os testes de erro de mutação cancelam um pedido `PENDING` por execução (`PED-000106` na primeira).

---

### [CRÍTICO] VND-01: duplo clique em "Finalizar Venda" / "Criar Pedido" cria dois pedidos

- **Tela**: `/vendas/balcao` e `/vendas/pedidos/novo` (1440, claro, owner)
- **Evidência**:
  - `/vendas/pedidos/novo`: dois cliques dentro da janela de revalidação de estoque produziram **dois `POST /orders`, ambos `201`**. Confirmado no banco: `PED-000119` e `PED-000120`, mesmo cliente, mesmo total `R$ 89,90`, criados com 1,2 s de diferença (`GET /orders?limit=8`). Dois pedidos, dois consumos de estoque, dois recebíveis.
  - `/vendas/balcao`: dois cliques imediatos → `POST /orders` `201` (`PED-000121`) **+** `POST /orders` `500`. O segundo só não virou um segundo pedido porque o índice único (`tenantId`,`orderNumber`) do Postgres barrou — é sorte, não desenho.
  - Estado do botão medido 800 ms depois do primeiro clique: `{ stillEnabled: true, label: "Criar Pedido", spinner: 0 }` — sem `disabled`, sem spinner, nada indicando que já há um envio em curso.
  - `qa-audit/artifacts/vnd/10-duplo-submit.png`, `qa-audit/artifacts/vnd/11-novo-janela-corrida.png`
- **Esperado**: `apps/web/CLAUDE.md` › Loading: "botão de submit desabilitado e em estado de carregando durante a mutação (duplo clique não pode criar dois)".
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:942-946` e `apps/web/app/(dashboard)/vendas/balcao/page.tsx:1071-1078` — o `disabled` olha só `createOrder.isPending`. Mas `onSubmit` (`novo/page.tsx:364-390`, `balcao/page.tsx:460-490`) faz `await refreshCartStock(...)` — um `GET /products/:id` por item — **antes** de chamar `mutateAsync`. Durante esse round-trip `isPending` ainda é `false` e o botão continua clicável. O zod resolver assíncrono soma mais alguns milissegundos à mesma janela.
- **Correção**: incluir o estado do próprio formulário no `disabled` — `formState.isSubmitting || createOrder.isPending` (o `handleSubmit` do react-hook-form já mantém `isSubmitting` durante todo o `onSubmit` assíncrono) e trocar a condição do spinner pela mesma expressão. Como cinto de segurança para o clique via teclado/F9, guardar um `useRef(false)` no topo de `onSubmit`. No servidor, um `Idempotency-Key` por submissão resolveria a classe inteira.

---

### [CRÍTICO] VND-02: o preço unitário da linha de item é ilegível — "R$ 3.299,00" aparece como "R$"

- **Tela**: `/vendas/pedidos/novo` e `/vendas/balcao` (1440, claro, owner — com a sidebar aberta, que é o estado padrão)
- **Evidência**: medido no `<input>` de preço unitário com um item de R$ 3.299,00 no carrinho:
  `{ value: "3.299,00", clientWidth: 55, scrollWidth: 114, cortado: true, paddingLeft: "40px", paddingRight: "12px" }`.
  São 114 px de texto dentro de 55 px de caixa, sem scroll, sem ellipsis, sem `title`. Na tela o campo mostra `R$ ⋮` e o desconto mostra `R$ 0,`.
  `qa-audit/artifacts/vnd/22-novo-money-input.png`, `qa-audit/artifacts/vnd/22-balcao-money-input.png`, `qa-audit/artifacts/vnd/10-duplo-submit.png` (aí o preço de R$ 89,90 aparece como `R$ 89` — literalmente o VD-13).
- **Esperado**: `CLAUDE.md` › Responsive and tables: "colunas monetárias usam `nowrap` para que 'R$ 89,90' nunca vire 'R$ 89'" (VD-13). Um campo editável de dinheiro que o operador não consegue ler é a versão pior do mesmo bug: ele não confere o que vai cobrar.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:620-625` (`<th className="w-36 ...">`) e `:739-744`; idem `balcao/page.tsx:749-754` e `:861-866`. O `MoneyInput` (`apps/web/components/forms/money-input.tsx:117-129`) reserva `pl-10` (40 px) para o prefixo "R$" e é `w-full`; com a tabela comprimida em 678 px (sidebar aberta) as colunas `w-36` encolhem e sobra ~3 px de área de texto.
- **Correção**: dar largura mínima real às colunas de dinheiro (`min-w-[7.5rem]` no `<th>` **e** no wrapper do input) e deixar a tabela rolar no próprio container em vez de espremer as colunas (`<table className="w-full min-w-[720px]">` dentro do `div.overflow-x-auto` já existente). Alternativa complementar: mover o "R$" para fora do input (prefixo em `<span>` irmão) e reduzir o `pl-10` para `pl-3`.

---

### [ALTO] VND-03: em `/vendas/pedidos/novo` a consulta de caixa que falha vira "Nenhum caixa aberto" — e trava a venda (VD-07)

- **Tela**: `/vendas/pedidos/novo` (1440, claro, owner) com `GET /cash-register-sessions` respondendo 500
- **Evidência**: `{ saysNoRegister: true, saysCouldNotCheck: false, submitDisabled: true }`, com o texto na tela: *"Nenhum caixa aberto. Abra o caixa em Financeiro > Caixa para registrar a venda por pedido."* A mesma interceptação em `/vendas/balcao` devolve `{ saysNoRegister: false, saysCouldNotCheck: true }` — a tela irmã já faz certo.
  `qa-audit/artifacts/vnd/05-novo-caixa-erro.png` vs `qa-audit/artifacts/vnd/05-balcao-caixa-erro.png`
- **Esperado**: `CLAUDE.md` › Permissions and error states: "'Nenhum caixa aberto' tem que significar que a consulta respondeu zero, não que ela falhou (VD-07)". Pior que a mensagem errada: o botão fica desabilitado, então o vendedor com o caixa aberto na sala ao lado não tem como registrar o pedido, e a mensagem manda ele abrir um caixa que já está aberto.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:226-227` — `const { data: openSessions } = useCashRegisterSessions(...)` descarta `isLoading` e `error`; `hasOpenCashRegister = (openSessions?.data?.length ?? 0) > 0` trata "não sei" como "não tem". O aviso está em `:886-896` e o bloqueio em `:942-946`.
- **Correção**: copiar o que `balcao/page.tsx:246-268` já faz — ler `isLoading`/`error`, ter `sessionsUnavailable`, mostrar "Não foi possível consultar a situação do caixa…" nesse caso, **não** bloquear o submit quando a checagem falhou (a API valida a sessão de qualquer forma) e não mostrar aviso nenhum enquanto `isLoading`.

---

### [ALTO] VND-04: o detalhe do pedido mostra "Pedido não encontrado" para 500 e para 403 (AE-28)

- **Tela**: `/vendas/pedidos/[id]` (1440, claro, owner)
- **Evidência**: com `GET /orders/:id` → 500: `{ naoEncontrado: true, falaEmErro: false }`, tela com "Pedido não encontrado / Voltar". Com 403 (`"Permissão insuficiente para esta ação"`): `{ naoEncontrado: true, falaEmPermissao: false }`. Em nenhum dos dois casos a palavra "erro" ou "permissão" aparece.
  `qa-audit/artifacts/vnd/16-detalhe-erro.png`, `qa-audit/artifacts/vnd/16-detalhe-403.png`
- **Esperado**: `CLAUDE.md` › "`isError` nunca é estado vazio (AE-28)" e "`getApiErrorMessage()`/`isPermissionError()` transformam o 403 em 'Você não tem permissão…'". Um pedido que existe e o usuário não pode ver não é um pedido inexistente.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:56` (`const { data: orderResp, isLoading } = useOrder(orderId)` — `error`/`isError` nem são desestruturados) e `:69-78` (`if (!order) return <p>Pedido não encontrado</p>`).
- **Correção**: `const { data, isLoading, error } = useOrder(orderId)` e ramificar: `isPermissionError(error)` → `<PermissionDeniedState subject="este pedido" />`; qualquer outro `error` → "Não foi possível carregar o pedido" com botão de tentar de novo; só `!error && !order` mantém "Pedido não encontrado".

---

### [ALTO] VND-05: o toast de erro despeja o stack trace do Prisma no operador de balcão

- **Tela**: `/vendas/balcao` (1440, claro, owner)
- **Evidência**: no duplo submit, o toast exibido ao operador foi, literalmente:
  `Invalid \`tx.order.create()\` invocation in /Users/mac/work/erp/apps/api/src/modules/orders/orders.service.ts:440:38 … Unique constraint failed on the fields: (\`tenantId\`,\`orderNumber\`)` — resposta `500`, capturada com `page.on("response")` e comparada com o texto do toast (idênticos).
  `qa-audit/artifacts/vnd/10-duplo-submit.png`
- **Esperado**: `CLAUDE.md` › Error Handling: "**No erro, sempre passar por `getMutationErrorMessage(error, fallback)`** … o helper já trata 403 (mensagem de permissão) e 5xx (fallback genérico — stack trace não ajuda ninguém)". As telas de Vendas usam `getApiErrorMessage(err) ?? fallback`, que é justamente a variante **sem** o degrau do 5xx (`apps/web/lib/mutation-error.ts:20-36` vs `apps/web/lib/api.ts:136-158`).
- **Arquivo**: `apps/web/app/(dashboard)/vendas/balcao/page.tsx:525-531`, `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:424-429`, `apps/web/components/orders/status-actions.tsx:101-110`.
- **Correção**: trocar as três ocorrências por `getMutationErrorMessage(err, "Erro ao finalizar venda. Verifique o estoque e tente novamente.")` de `@/lib/mutation-error`. (No lado da API, `orders.service.ts:440` deveria capturar o `P2002` e responder 409 com mensagem de negócio, mas isso é outro escopo.)

---

### [ALTO] VND-06: no 390 px o formulário de venda não cabe e o botão de finalizar sai da tela

- **Tela**: `/vendas/pedidos/novo` e `/vendas/balcao` (390×844, claro, owner, com 1 item no carrinho)
- **Evidência**: cadeia de ancestrais medida a partir da tabela de itens:
  | elemento | clientWidth | scrollWidth | overflowX | minWidth |
  |---|---|---|---|---|
  | `div.overflow-x-auto` (o container que deveria rolar) | 678 | 678 | auto | 0px |
  | `div.space-y-6.lg:col-span-2` | 728 | 728 | visible | **auto** |
  | `div.grid.gap-6.lg:grid-cols-3` | **358** | **728** | visible | 0px |
  | `main.flex-1.overflow-y-auto` | 390 | 744 | auto | auto |

  Ou seja: a coluna do grid nunca encolhe, o `overflow-x-auto` da tabela nunca é acionado, e quem acaba rolando na horizontal é a página inteira (cabeçalho, cards e sidebar de resumo junto). Elementos fora da viewport de 390 px: `Finalizar Venda` em `right: 719`, `Cancelar` em `right: 719`, `Buscar produto…` em `right: 719`, as colunas `Preco Unit.`/`Desconto`/`Total`.
  `qa-audit/artifacts/vnd/15-novo-390-corte.png`, `qa-audit/artifacts/vnd/15-balcao-390-corte.png`, `qa-audit/artifacts/vnd/08-novo-390.png`
- **Esperado**: `CLAUDE.md` › Responsive and tables: "**Um filho de flex/grid que precisa encolher precisa de `min-w-0`**" (AE-07) e "conteúdo largo rola **dentro do próprio container**, nunca esticando a página".
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:452-454` (`<div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">`) e `apps/web/app/(dashboard)/vendas/balcao/page.tsx:562-564`.
- **Correção**: `className="space-y-6 min-w-0 lg:col-span-2"` nas duas colunas principais (e `min-w-0` também na coluna do resumo). Com isso o `div.overflow-x-auto` volta a ser o container que rola, e o botão de finalizar fica dentro da viewport.

---

### [ALTO] VND-07: badges de status usam a paleta literal do Tailwind, não os tokens

- **Tela**: `/vendas/pedidos` e `/vendas/pedidos/[id]` (1440, claro e escuro, owner)
- **Evidência**: `measure(page).hardcodedColors` na lista devolveu 6 grupos, um por status visível:
  `Pendente → [bg-yellow-100, text-yellow-800, border-yellow-200, bg-yellow-900, text-yellow-400, border-yellow-800]`, e o mesmo padrão para `Confirmado` (blue), `Separando` (purple), `Concluído` (emerald), `Cancelado` (red), `Devolvido` (orange). Cores computadas: `Separando` = `rgb(107,33,168)` sobre `rgb(243,232,255)`; no dark, `rgb(192,132,252)` sobre `rgba(88,28,135,.3)`. Nenhum `--success`/`--warning`/`--danger` participa.
  `qa-audit/artifacts/vnd/01-lista-1440-claro.png`, `qa-audit/artifacts/vnd/02-lista-dark.png`, `qa-audit/artifacts/vnd/13-detalhe-dark.png`
- **Esperado**: BRIEFING › "Cor só via token"; `CLAUDE.md` › Styling. O design system tem `success` (160 84% 39%), `warning` (38 92% 50%) e `danger` (0 72% 51%) em `app/globals.css:27-40` e expostos em `tailwind.config.ts` — nenhum deles é usado.
- **Arquivo**: `apps/web/components/ui/status-badge.tsx:14-29` (mapa `statusColors`) e o fallback em `:56-57`.
- **Correção**: mapear os 9 status do pedido para as 4 intenções do sistema — `PENDING/PICKING/PACKED` → `bg-warning/10 text-warning-foreground border-warning/30`; `CONFIRMED/SHIPPED/DELIVERED/COMPLETED` → `success`; `CANCELLED/RETURNED` → `danger`; `DRAFT` → `muted`. Onde faltar granularidade (5 tons de "em andamento"), estender os tokens em `globals.css` em vez de reintroduzir a paleta crua.

---

### [MÉDIO] VND-08: os avisos do carrinho e o indicador de estoque também são cor literal

- **Tela**: `/vendas/pedidos/novo`, `/vendas/balcao` (1440, claro e escuro)
- **Evidência**: `measure(page).hardcodedColors` com o carrinho preenchido: `span "70 un." → [bg-green-100, text-green-700, bg-green-900, text-green-400]`; barra de pagamento `div → [bg-emerald-500]`; `p "Pagamento completo" → [text-emerald-600, text-emerald-400]`. Estilos computados dos avisos: linha em excesso `bg-amber-50 → rgb(255,251,235)` no pedido e `bg-red-50 → rgb(254,242,242)` no balcão; caixa de aviso `border-amber-200 bg-amber-50` com texto `rgb(180,83,9)`.
- **Esperado**: BRIEFING › "Cor só via token (`bg-success`, …). `text-gray-500` ou `bg-[#fff]` é achado."
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:193-216` (`StockIndicator`), `:655`, `:710`, `:733-734`, `:887-935`; `apps/web/app/(dashboard)/vendas/balcao/page.tsx:210-233`, `:781`, `:833`, `:856`, `:985`, `:1023-1065`; `apps/web/components/forms/payment-selector.tsx:147`, `:265-267`, `:272-284`; `apps/web/components/forms/payment-line.tsx:149`, `:205`.
- **Correção**: extrair um `<AlertBox variant="warning|danger">` sobre os tokens (`bg-warning/10 border-warning/30 text-warning-foreground`) — hoje o mesmo bloco de aviso está copiado 7 vezes entre as duas telas — e reescrever `StockIndicator` com `success`/`warning`/`danger`.

---

### [MÉDIO] VND-09: o diálogo de cancelamento não é um diálogo para a tecnologia assistiva

- **Tela**: `/vendas/pedidos/[id]` → "Cancelar Pedido" (1440, claro, owner)
- **Evidência**: `{ role: null, ariaModal: null, ariaLabelledby: null, maxHeight: "none" }`. Ao abrir, `focoDentroDoDialog: false` — o foco continua no botão "Cancelar Pedido" da página. Trilha do `Tab` a partir daí: `dentro → dentro (textarea) → dentro (Cancelar) → dentro (Cancelar Pedido) → **FORA** (aba "Itens") → **FORA** (aba "Cliente")` — na 5ª tabulação o foco atravessa o overlay e vai para a página bloqueada atrás.
  `qa-audit/artifacts/vnd/12-detalhe-dialog.png`, `qa-audit/artifacts/vnd/17-dialog-foco.png`
- **Esperado**: BRIEFING › Acessibilidade: "`aria-*` em dialogs"; `CLAUDE.md` › "Dialogs: `max-h-[85vh]`, corpo rolável, rodapé fixo".
- **Arquivo**: `apps/web/components/ui/confirm-dialog.tsx:88-99` (contêiner sem `role`/`aria-modal`/`aria-labelledby`, sem `max-h`), `:125-127` (o `<h3>` do título não tem `id`).
- **Correção**: `role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"` no card, `id` no `<h3>`, `max-h-[85vh]` com o corpo em `overflow-y-auto`, foco inicial no primeiro campo (ou no botão de confirmar quando não há campo) e um laço de foco simples no `keydown` de `Tab`. Como é o diálogo de todos os cancelamentos/estornos de venda, o custo é uma vez só.

---

### [MÉDIO] VND-10: nenhum campo de pagamento/envio tem `<label>` associado

- **Tela**: `/vendas/pedidos/novo` com uma linha de pagamento de cartão de crédito (1440, claro)
- **Evidência**: varredura de todos os `<label>` da tela — 7 rótulos, todos com `htmlFor: null` e sem controle aninhado: `Forma de Pagamento`, `Condicao`, `Valor`, `Cod. Autorizacao`, `Metodo de Envio`, `Custo do Frete`, `Observações`. Clicar no rótulo não foca o campo e o leitor de tela anuncia "caixa de combinação" sem nome.
  `qa-audit/artifacts/vnd/20-pagamento-credito.png`
- **Esperado**: BRIEFING › Acessibilidade: "`<label>` associado".
- **Arquivo**: `apps/web/components/forms/payment-line.tsx:153-156`, `:213-216`, `:244-247`, `:252-254`; `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:829-836`, `:845-852`; `apps/web/components/forms/money-input.tsx:110-113`; `apps/web/components/forms/searchable-select.tsx:155`.
- **Correção**: gerar um `id` estável (`useId()`) em `MoneyInput`/`PaymentLine`/`SearchableSelectBase`, ligar `htmlFor`/`id` e apontar `aria-describedby` para o `<p>` de erro. No `SelectTrigger` do Radix, `aria-labelledby` no gatilho resolve.

---

### [MÉDIO] VND-11: pedido e balcão discordam sobre o mesmo excesso de estoque

- **Tela**: `/vendas/pedidos/novo` × `/vendas/balcao` (1440, claro, mesmo produto, mesma quantidade)
- **Evidência**: com quantidade acima do disponível, a mesma condição produz telas diferentes:
  | | `/vendas/pedidos/novo` | `/vendas/balcao` |
  |---|---|---|
  | fundo da linha | `bg-amber-50` → `rgb(255,251,235)` | `bg-red-50` → `rgb(254,242,242)` |
  | borda do input | `border-amber-500 text-amber-700` | `border-red-500 text-red-700` |
  | texto sob o campo | `Excede estoque` | `Excede estoque!` |
  | aviso no resumo | "O pedido **sera criado**, mas podera nao ser confirmado…" | "Ajuste as quantidades para finalizar a venda." |
  | botão de submit | habilitado | desabilitado (`hasStockIssues`) |

  E o aviso do pedido é desmentido pelo próprio submit: ao clicar em "Criar Pedido" o toast foi *"Estoque insuficiente de Capinha iPhone 15 Pro Silicone: 1376 un. disponíveis para 999999 solicitadas."* e **nenhum** `POST /orders` saiu (`POSTs disparados: []`). A tela promete criar o pedido e depois se recusa.
  `qa-audit/artifacts/vnd/07-novo-carrinho-excesso.png`, `qa-audit/artifacts/vnd/07-novo-erro-estoque.png`, `qa-audit/artifacts/vnd/09-balcao-1440.png`
- **Esperado**: BRIEFING › "Espaçamento/cor têm que bater entre telas equivalentes" e `CLAUDE.md` › "Antecipe o erro quando a tela já sabe" — se `refreshCartStock` vai recusar, o aviso não pode dizer que o pedido será criado.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:653-656`, `:707-711`, `:733-735`, `:911-925`, `:942-946` vs `apps/web/app/(dashboard)/vendas/balcao/page.tsx:779-782`, `:830-834`, `:856-858`, `:1057-1065`, `:1071-1078`.
- **Correção**: extrair a linha de item (hoje ~150 linhas duplicadas byte a byte entre as duas telas) para `components/orders/order-item-row.tsx` com uma única semântica de cor, e reescrever o aviso do pedido para "Alguns itens excedem o estoque disponível. Ajuste as quantidades para criar o pedido.", já que é isso que o submit faz.

---

### [MÉDIO] VND-12: contraste abaixo de AA no retorno do pagamento e nos atalhos do balcão

- **Tela**: `/vendas/pedidos/novo` (pagamento) e `/vendas/balcao` (rodapé de atalhos), 1440, claro
- **Evidência** (`measure(page).lowContrast`, razão calculada contra o fundo efetivo):
  - `p "Pagamento completo"` — **3,77:1** (mínimo 4,5): `rgb(5,150,105)` (`text-emerald-600`) sobre `rgb(255,255,255)` (card), 12 px. O mesmo par pinta o "Troco: R$ …", que é a informação mais crítica da tela de balcão.
  - `kbd "F2/F4/F9/Esc"` no balcão — **4,18:1**: `rgb(101,117,139)` sobre `rgb(239,242,245)`, 10 px.
  - Sistêmico (aparece em todas as telas do módulo, provavelmente em todos os módulos): `text-muted-foreground` = `rgb(101,117,139)` sobre `rgb(249,250,251)` = **4,49:1**, um centésimo abaixo do mínimo.
- **Esperado**: BRIEFING › "contraste AA (4.5:1 / 3:1 grande)".
- **Arquivo**: `apps/web/components/forms/payment-selector.tsx:272-284`; `apps/web/app/(dashboard)/vendas/balcao/page.tsx:1099-1115`; para o caso sistêmico, `--muted-foreground: 215 16% 47%` em `apps/web/app/globals.css:25`.
- **Correção**: usar `text-success` só a partir de 14 px/600 ou trocar por um tom mais escuro (`hsl(160 84% 30%)`), e escurecer `--muted-foreground` para `215 16% 42%` (≈5,2:1) — resolve o 4,49 de todas as telas de uma vez.

---

### [MÉDIO] VND-13: texto sem acento em toda a jornada de venda (FN-27)

- **Tela**: `/vendas/pedidos/novo`, `/vendas/balcao` (todas as viewports)
- **Evidência**: varredura do `innerText` renderizado — `/vendas/pedidos/novo`: `Preco`, `Preco Unit.`, `Metodo`, `Condicao`, `Autorizacao`; `/vendas/balcao`: `Balcao`, `sera `. Textos completos no DOM: **"Venda no Balcao"** (o `<h1>` da tela), *"Venda direta - o pedido sera finalizado automaticamente"*, *"Alguns itens excedem o estoque disponivel. O pedido sera criado, mas podera nao ser confirmado ate a regularizacao do estoque."*, *"Ha itens sem estoque disponivel no pedido."*, `Cod. Autorizacao`, `Metodo de Envio`.
  `qa-audit/artifacts/vnd/22-novo-money-input.png` (cabeçalho "Preco Unit."), `qa-audit/artifacts/vnd/09-balcao-1440.png`
- **Esperado**: `CLAUDE.md` › Do NOT: "Ship user-facing text without accents: 'Metodos', 'Condicoes', 'obrigatorio' (FN-27)".
- **Arquivo**: `apps/web/app/(dashboard)/vendas/balcao/page.tsx:550-556`, `:636`, `:750`, `:857`, `:1061`; `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:508`, `:621`, `:830`, `:919-921`, `:931-932`; `apps/web/components/forms/payment-line.tsx:215`, `:253`.
- **Correção**: correção textual direta ("Balcão", "será", "Preço Unit.", "Método de Envio", "Condição", "Cód. Autorização", "disponível", "poderá", "não", "até", "regularização", "Há"). O `<h1>` do balcão é o mais visível: é o título da tela mais usada do módulo.

---

### [MÉDIO] VND-14: o card não concorda com input, botão e diálogo em raio e borda

- **Tela**: todas as telas do módulo (1440, claro)
- **Evidência**: `measure(page).inconsistentRadius` apontou `div.rounded-xl.border.border-border/60 → 12px`. Medido: card `borderRadius: 12px`, `borderColor: rgba(229,231,235,0.6)`; input/botão/`SelectTrigger`/`SearchableSelect` `10px` com `border-input`; `ConfirmDialog` `10px`. `--radius: 0.625rem` = **10px** (`app/globals.css:46`).
- **Esperado**: BRIEFING › "Borda e raio: `--radius: 0.625rem`. Card, input, botão, badge e dialog precisam concordar; borda sempre `border-border`."
- **Arquivo**: `apps/web/components/ui/card.tsx:12` — `"rounded-xl border border-border/60 …"` (`rounded-xl` é o literal 12px do Tailwind, e `/60` dilui o token da borda).
- **Correção**: `rounded-lg border border-border` (o `rounded-lg` do projeto já é `var(--radius)`, conforme `tailwind.config.ts` › `borderRadius`). Se a intenção era um card visualmente mais macio, subir `--radius` e deixar todo o sistema acompanhar.

---

### [MÉDIO] VND-15: o operador lê o erro do backend em inglês

- **Tela**: `/vendas/pedidos/[id]` → cancelar um pedido já cancelado (1440, claro, owner)
- **Evidência**: corpo HTTP capturado com `page.on("response")`: `400 {"message":"Cannot cancel order in status CANCELLED"}`; texto do toast: **`Cannot cancel order in status CANCELLED`** (`idem: true`). O repasse literal está certo — é a regra AE-10 —, mas a frase chega em inglês para o usuário pt-BR.
  `qa-audit/artifacts/vnd/14-toast-backend.png`
- **Esperado**: `CLAUDE.md` › Texto: "pt-BR com acento".
- **Arquivo**: `apps/api/src/modules/orders/orders.service.ts:669` (origem da mensagem); superfície em `apps/web/components/orders/status-actions.tsx:101-110`.
- **Correção**: traduzir a exceção na API ("Não é possível cancelar um pedido com status Cancelado"), usando `ORDER_STATUS_LABELS` de `@erp/constants` para o nome do status. Traduzir no front seria manter uma segunda cópia das regras de status — exatamente o AE-23.

---

### [MÉDIO] VND-21: o card "Origem" do detalhe mostra o enum cru — `MANUAL`, `MERCADO_LIVRE`

- **Tela**: `/vendas/pedidos/[id]` (1440, claro, owner)
- **Evidência**: o card de resumo exibe **`MANUAL`** em caixa alta, enquanto a mesma informação na lista aparece como "Manual" com o ícone da origem. O `capitalize` do Tailwind não abaixa as letras já maiúsculas, então o enum passa direto; para um pedido de marketplace o usuário lê `MERCADO_LIVRE`.
  `qa-audit/artifacts/vnd/12-detalhe-1440.png` (card "Origem")
- **Esperado**: `CLAUDE.md` › Do NOT: "Keep a second copy of status labels — they come from `@erp/constants` (AE-23)" — e, antes disso, nenhum enum cru vai para a tela.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:135` — `<p className="text-xl font-bold capitalize">{order.origin}</p>`. O mapa de rótulos existe, mas é local da lista: `apps/web/app/(dashboard)/vendas/pedidos/page.tsx:55-66` (`originLabels`).
- **Correção**: mover `originLabels`/`originIcons` para `@erp/constants` (ou `lib/order-origin.ts`) e usar nos dois lugares: `{ORDER_ORIGIN_LABELS[order.origin] ?? order.origin}`.

---

### [BAIXO] VND-16: o total da linha de item não é `nowrap`

- **Tela**: `/vendas/pedidos/novo`, `/vendas/balcao` (390/768/1440)
- **Evidência**: `td` do total da linha e do rodapé — `{ whiteSpace: "normal", textAlign: "right" }` em todas as viewports. Na lista de pedidos, por comparação, a mesma coluna é `whiteSpace: "nowrap"` (a `ColumnDef` usa `nowrap: true`). Hoje não quebra porque a tabela nunca encolhe (ver VND-06); assim que VND-06 for corrigido e a tabela passar a rolar/encolher, quebra.
- **Esperado**: `CLAUDE.md` › "colunas monetárias usam `nowrap` para que 'R$ 89,90' nunca vire 'R$ 89'" (VD-13).
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:758-760`, `:789-791`; `apps/web/app/(dashboard)/vendas/balcao/page.tsx:878-880`, `:908-910`.
- **Correção**: `className="whitespace-nowrap px-4 py-3 text-right font-semibold"` nas quatro células.

---

### [BAIXO] VND-17: pluralização manual em vez de `pluralize()`

- **Tela**: `/vendas/pedidos/novo`, `/vendas/balcao`
- **Evidência**: renderizado na tela — `Itens do Pedido (1 item)` e `Subtotal (1 item)`; o ternário é escrito à mão em 4 lugares. `pluralize()` existe em `apps/web/lib/utils.ts:121` e é a regra da casa justamente para evitar o "1 itens" do AE-21.
- **Esperado**: `CLAUDE.md` › Do NOT: "Concatenate a number with a fixed noun — use `pluralize()`".
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/novo/page.tsx:590`, `:868-869`; `apps/web/app/(dashboard)/vendas/balcao/page.tsx:719`, `:977-978`.
- **Correção**: `{pluralize(fields.length, "item", "itens")}`.

---

### [BAIXO] VND-18: enquanto a lista carrega, o rodapé já diz "Nenhum registro"

- **Tela**: `/vendas/pedidos` (1440, claro) com `GET /orders` atrasado em 4 s
- **Evidência**: no instante medido havia **20 linhas de skeleton** no corpo da tabela e o rodapé exibia `"Nenhum registro"`.
  `qa-audit/artifacts/vnd/21-lista-carregando.png`
- **Esperado**: BRIEFING › "Loading: skeleton ou spinner em toda busca" — e o mesmo espírito do AE-28: enquanto não se sabe, não se afirma que não há nada. (Nota: o estado de **erro** está correto — com um 500 a tabela mostra "Não foi possível carregar estes dados" e o rodapé fica vazio; verificado.)
- **Arquivo**: `apps/web/components/tables/data-table.tsx:487-497` — o ternário do rodapé considera `error` e `total > 0`, mas não `isLoading`.
- **Correção**: `{isLoading ? "" : error ? "" : pagination.total > 0 ? … : "Nenhum registro"}`. Componente compartilhado — vale confirmar com quem estiver auditando `components/tables`.

---

### [BAIXO] VND-19: o toast não é anunciado por leitor de tela e some em 4 s

- **Tela**: todas as mutações do módulo
- **Evidência**: o contêiner do toast é `div.fixed.bottom-4.right-4` sem `role="status"`/`aria-live`; nada no toast tem papel ARIA. Medido também que o toast de erro dura 4 s: na primeira medição do duplo submit os toasts já haviam sumido antes da leitura (foi preciso amostrar de 400 em 400 ms para capturá-los). Um erro de 3 linhas (VND-05) desaparece antes de ser lido.
- **Esperado**: BRIEFING › Acessibilidade; `CLAUDE.md` › Error Handling ("toda mutação precisa de toast de sucesso e de erro").
- **Arquivo**: `apps/web/components/ui/toast.tsx:119` (contêiner) e `:71-90` (item; `duration ?? 4000` em `:67`).
- **Correção**: `role="region" aria-live="polite" aria-atomic="false"` no contêiner, `role="alert"` no item de variante `error`, e duração maior (ou sem auto-dismiss) para `error`.

---

### [BAIXO] VND-22: `/vendas` mostra o shell vazio até o redirect resolver, sem `loading.tsx`

- **Tela**: `/vendas` (1440, claro, owner)
- **Evidência**: três navegações consecutivas para `/vendas`, medindo até a URL virar `/vendas/pedidos`: **-1 ms (não redirecionou em 20 s)**, **12.919 ms**, **7.227 ms**. Durante todo esse tempo a tela mostra a moldura do dashboard sem conteúdo nenhum (snapshot do Playwright: sidebar + header, `main` vazio). O `redirect()` está num Server Component e é resolvido pelo roteador do cliente, então não há nem 307 no HTTP (`curl -o /dev/null -w %{http_code} http://localhost:3100/vendas` → `200`) nem estado de carregamento.
  `qa-audit/artifacts/vnd/23-vendas-sem-redirect.png` (gerado quando o redirect estoura os 30 s)
- **Esperado**: `CLAUDE.md` › Component Rules: "Colocate loading.tsx, error.tsx, not-found.tsx with page.tsx". Não existe **nenhum** `loading.tsx` em `app/` — o problema é sistêmico, mas em `/vendas` ele é garantido, porque a rota nunca tem conteúdo próprio para mostrar.
- **Arquivo**: `apps/web/app/(dashboard)/vendas/page.tsx:8-10` (o `redirect()`); falta `apps/web/app/(dashboard)/vendas/loading.tsx`.
- **Correção**: **a confirmar em produção** — os 7–13 s medidos incluem a compilação do dev server e devem cair muito num build. O que não depende do ambiente é a ausência de estado de carregamento: adicionar `loading.tsx` no grupo (um skeleton da lista) faz o clique em "Vendas" parecer imediato em qualquer velocidade. Se a intenção é só levar o usuário à primeira tela, `lib/nav-items.ts` pode apontar o grupo direto para `/vendas/pedidos` e a rota `/vendas` vira apenas rede de segurança.

---

### [BAIXO] VND-20: os ícones de origem da lista usam cores literais

- **Tela**: `/vendas/pedidos` (1440, claro e escuro)
- **Evidência**: `text-slate-500` (Manual), `text-emerald-500` (Balcão), `text-blue-500` (Shopify/Nuvemshop/WooCommerce), `text-orange-500` (marketplaces), `text-purple-500` (API) — 10 ícones, nenhum token, e nenhuma variante `dark:` (o cinza `slate-500` fica com 3,1:1 sobre o card escuro).
- **Esperado**: BRIEFING › "Cor só via token".
- **Arquivo**: `apps/web/app/(dashboard)/vendas/pedidos/page.tsx:42-53`.
- **Correção**: `text-muted-foreground` para todos e distinguir a origem pelo ícone + rótulo (que já estão lá), ou tokens semânticos se a cor tiver mesmo significado.

---

## O que foi verificado e está correto

Registrado para não ser reauditado no próximo ciclo:

- **`/vendas` redireciona** para `/vendas/pedidos` (FN-18) — sem 404.
- **Total × soma das linhas**: R$ 89,90 + R$ 149,90 = subtotal R$ 239,80 = total R$ 239,80, e o resumo bate com o rodapé da tabela. Separador pt-BR correto em todos os valores (`R$ 3.299,00`).
- **Coluna Total da lista**: `text-align: right`, `white-space: nowrap` (VD-13 cumprido lá).
- **Estado de erro da lista**: um 500 em `GET /orders` mostra "Não foi possível carregar estes dados", **não** "Nenhum registro" (AE-28 cumprido); o vazio legítimo mostra "Nenhum registro encontrado".
- **VD-07 no balcão**: com a consulta de caixa quebrada a tela diz "Não foi possível consultar a situação do caixa…" e não bloqueia a venda. É a referência que falta ao `/novo`.
- **VD-21 (estoque defasado)**: quantidade acima do disponível é barrada no submit com a contagem real do servidor, sem `POST` inútil.
- **Validação do formulário vazio**: `noValidate` presente; os três erros de raiz aparecem na tela ("Selecione um cliente", "Adicione pelo menos um item", "Adicione pelo menos uma forma de pagamento"), e o "Código de autorização obrigatório" aparece no cartão de crédito.
- **VD-05 (prévia de parcelas)**: "3x de R$ 29,97 (última de R$ 29,96) · vencimentos em 30/60/90 dias" — bate com o `splitInstallments` da API.
- **AE-10 no repasse**: a mensagem do backend chega íntegra ao toast (o problema é o 5xx sem fallback, VND-05, e o idioma, VND-15).
- **Tooltips**: todos os botões só-ícone auditados (Ver detalhes, Voltar, Remover item, Remover pagamento, ações de status) abrem tooltip Radix; as ações de status ainda trazem `aria-label`.
- **Console/rede**: zero `pageerror` e zero erro de console em todas as telas — o único 5xx observado foi o provocado pelo duplo submit (VND-01).
- **Papel `seller`**: lista, novo pedido e balcão carregam sem "Acesso negado" indevido e sem spinner preso.
- **Dark mode**: sem `lowContrast` novo nas três telas; o problema do dark é o mesmo das cores literais (VND-07/VND-08).

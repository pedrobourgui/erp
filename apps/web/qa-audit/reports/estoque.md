# QA UX/UI — Módulo Estoque (`EST`)

**Ambiente**: web `localhost:3100`, API `localhost:3001/api/v1`
**Spec**: `qa-audit/estoque.spec.ts` (32 testes, todos executados e verdes neste ciclo —
`32 passed`, 73 screenshots em `artifacts/est/`)
**Evidências**: `qa-audit/artifacts/est/`
**Telas auditadas**: `/estoque`, `/estoque/produtos`, `/estoque/produtos/novo`,
`/estoque/produtos/[id]`, `/estoque/produtos/[id]/edit`, `/estoque/categorias`,
`/estoque/marcas`, `/estoque/movimentacoes`, `/estoque/depositos`, `/estoque/alertas`
**Viewports**: 1440 / 768 / 390 · **Temas**: claro e escuro · **Papéis**: `owner` e `seller`

## Resumo

| Severidade | Qtd |
|---|---|
| Crítico | 2 |
| Alto | 7 |
| Médio | 10 |
| Baixo | 7 |
| **Total** | **26** |

Os achados abaixo estão ordenados por severidade; os IDs seguem a ordem em que foram
levantados.

### O que passou (verificado, sem achado)

- **AE-28 respeitado em todo o módulo**: 500 e 403 forçados em Produtos, Categorias,
  Alertas e Movimentações renderizam "Não foi possível carregar estes dados" e
  "Você não tem permissão", nunca "Nenhum registro"
  (teste `EST-erro`, blocos `@@erro.<tela>.<status>`).
- **Trava de submit**: com a resposta atrasada em 3 s de propósito, "Criar" (categoria),
  "Publicar Produto" e "Registrar" (movimentação) ficam `disabled`, mostram spinner e o
  segundo clique **não** gera um segundo POST (`lock.*` — 1 POST em cada caso).
- **Truncamento AE-20**: nome de 255 caracteres não estoura a tabela em 1440 nem em 390
  (`1440/1440`, `390/390`, sem `clippedNoScroll`).
- **Responsivo**: nenhum overflow de documento em 390/768/1440 nas seis listas.
- **Mensagem do backend no toast**: SKU duplicado, saída sem saldo e categoria em uso
  chegam ao usuário com a frase real da API.
- **Redirect** `/estoque` → `/estoque/produtos` (FN-18) funciona, e depois de criar um
  produto a tela vai mesmo para a lista (`redirect.novo-produto`: POST 201 →
  `/estoque/produtos`, formulário descarregado).
- **Estados de vazio x erro**: busca sem resultado (`search=zzz-nao-existe`) mostra
  "Nenhum registro encontrado" só depois de um 200 com zero linhas.
- **Filtros de Produtos** já são selects alimentados pela API (FT-01/FT-02):
  `freeTextInputs: 0` no painel; e o `datalist` de CFOP e o filtro de Produto por
  busca no servidor em Movimentações estão corretos.
- **Depósitos** é o contra-exemplo correto do módulo: `<Can mode="disable">`,
  `aria-label` nos botões só-ícone, tooltip explicando por que o padrão não pode ser
  excluído, `pluralize`, skeleton próprio.

---

### [CRÍTICO] EST-01: o campo "URL do Logo" da Marca é impossível de salvar — e o logo nunca aparece na lista

- **Tela**: `/estoque/marcas` → diálogo Nova Marca / Editar Marca (1440, claro, owner)
- **Evidência**:
  - Requisição capturada: `POST /api/v1/products/brands` com
    `{"name":"Marca qa-est-…","logoUrl":"https://exemplo.com/logo.png"}` → **400**
    `{"message":["property logoUrl should not exist"]}`.
  - Toast exibido ao usuário: **`property logoUrl should not exist`** — texto técnico,
    em inglês, dentro de uma UI pt-BR. O diálogo continua aberto sem indicar o campo.
  - Leitura: `GET /api/v1/products/brands` devolve `["id","name","logo","_count"]`.
    A UI lê `brand.logoUrl`, que **nunca existe** → `BrandLogo` cai sempre no
    placeholder, mesmo para uma marca com logo no banco.
  - Screenshot: `qa-audit/artifacts/est/marca-logo-erro.png`
- **Esperado**: "Response types come from `packages/shared-types`. Retyping a response
  inside `app/` is how three columns ended up permanently empty" (AE-13/AE-12b) e
  "toda mutação precisa de toast de erro passando por `getMutationErrorMessage`" —
  aqui a mensagem passa, mas o que o backend diz é uma falha de contrato, não algo
  que o usuário possa corrigir.
- **Arquivo**:
  - `apps/web/app/(dashboard)/estoque/marcas/page.tsx:126-129` (envia `logoUrl`)
  - `apps/web/app/(dashboard)/estoque/marcas/page.tsx:69,78-85` (lê `brand.logoUrl`)
  - `apps/web/hooks/use-products.ts` — `BrandRow.logoUrl` e `BrandFormData.logoUrl`
  - `apps/web/components/forms/brand-form-dialog.tsx:28-34,111-116`
  - Contrato real: `apps/api/src/modules/products/dto/product.dto.ts:265,279` (`logo`)
    e `apps/api/src/modules/products/products.service.ts:653-662` (`select: { logo: true }`)
- **Correção**: renomear o campo para `logo` no formulário, no payload e na leitura
  (`BrandRow.logo`), tipando a resposta a partir de `@erp/shared-types`. A API usa
  `forbidNonWhitelisted`, então qualquer nome divergente vira 400 — vale um teste de
  contrato no hook.

---

### [CRÍTICO] EST-02: na edição de produto o erro mora numa aba oculta, sem badge, sem troca de aba e sem erro de campo

- **Tela**: `/estoque/produtos/[id]/edit` (1440, claro, owner)
- **Evidência**: NCM = `ABCDEFG` na aba Fiscal → volta para "Dados Gerais" → "Salvar
  Alterações":
  - Nenhum `PATCH` sai (`patchSent: []`).
  - `activeTab` continua **"Dados Gerais"** — a aba não troca.
  - Nenhuma aba ganha contador (`tabsWithBadge: ["Dados Gerais","Preços","Fiscal","Dimensões"]`,
    sem número).
  - `document.querySelectorAll(".text-destructive")` → **0 elementos**, e continua 0
    **depois de abrir a aba Fiscal manualmente** (`fiscalTabHasErrorAfterOpening: []`):
    o campo com o valor recusado não mostra erro nenhum.
  - Único retorno: toast "Existe um campo obrigatório não preenchido ou inválido." —
    sem dizer qual.
  - Screenshot: `qa-audit/artifacts/est/edit-ncm-aba-oculta.png`
  - Contraprova: a mesma operação em `/estoque/produtos/novo` marca a aba (`Preços1`,
    `badges: ["","","1","1"]`) e troca de aba — `novo` usa `lib/form-tabs.ts`, `edit` não.
- **Esperado**: `CLAUDE.md` → "In a tabbed form, the error may be on a hidden tab. Use
  `lib/form-tabs.ts` to badge the tab with a count and focus the first tab with an
  error (AE-11)" + "Every registered field renders its own error… the submit button
  looks broken (FN-13)".
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/[id]/edit/page.tsx`
  - `:24,218` — usa só `useInvalidSubmit()`, não importa `countErrorsByTab` /
    `firstTabWithError` (compare com `novo/page.tsx:33-38,159-172,297-321`)
  - `:355-366` — os inputs `ncm`, `cest` e `ean` não renderizam `errors.<campo>`
- **Correção**: replicar em `edit/page.tsx` o mapa `FIELDS_BY_TAB` + `onInvalid` de
  `novo/page.tsx` (badge por aba e foco na primeira aba com erro) e adicionar o bloco
  `{errors.X && <p className="text-xs text-destructive">…}` para NCM, CEST e EAN.

---

### [ALTO] EST-03: as colunas "ordenáveis" de Movimentações não ordenam nada

- **Tela**: `/estoque/movimentacoes` (1440, claro, owner)
- **Evidência**: três cliques em "Quantidade" (asc → desc) produziram três requisições
  **idênticas**: `GET /inventory/movements?page=1&limit=20` — `anyWithSortBy: false`.
  A primeira linha da tabela é a mesma nos três estados
  (`03/08/2026 17:15 …` antes, asc e desc). A seta do cabeçalho muda; a ordem, não.
  Contraprova no mesmo teste: `/estoque/produtos` envia
  `…&sortBy=salePrice&sortOrder=asc` (`sort.produtos.anyWithSortBy: true`).
  Screenshot: `qa-audit/artifacts/est/movimentacoes-sort.png`
- **Esperado**: um controle que muda de estado tem que mudar o resultado. `sortable: true`
  em Data, Produto e Quantidade promete uma ordenação que não existe.
- **Arquivo**:
  - `apps/web/hooks/use-inventory.ts:179-199` — `MovementListParams` declara
    `sortBy`/`sortOrder`, a página os passa (`movimentacoes/page.tsx:231-232`) e o objeto
    `params` do `api.get` **não os inclui**.
  - `apps/api/src/modules/inventory/dto/inventory.dto.ts:314+` — `MovementQueryDto` nem
    aceita `sortBy`/`sortOrder` (e com `forbidNonWhitelisted: true` enviá-los daria 400).
- **Correção**: adicionar `sortBy`/`sortOrder` ao `MovementQueryDto` e ao `orderBy` do
  serviço, e repassá-los no hook. Enquanto o backend não suportar, remover
  `sortable: true` dessas colunas — uma seta que não faz nada é pior do que nenhuma.

---

### [ALTO] EST-04: o vendedor vê Editar e Excluir habilitados em Produtos, Categorias e Marcas e só descobre o 403 depois de clicar

- **Tela**: `/estoque/produtos`, `/estoque/categorias`, `/estoque/marcas`
  (1440, claro, papel `seller`)
- **Evidência** (`403.seller`): com `vendedor@exemplo.com` (só `products:read`):
  | Tela | linhas | botões de ação **habilitados** | `[data-testid="permission-disabled"]` |
  |---|---|---|---|
  | produtos | 16 | **48** | 0 |
  | categorias | 6 | **12** | 0 |
  | marcas | 4 | **8** | 0 |
  Clicando em Excluir na primeira linha de Produtos: `403 DELETE /api/v1/products/…`
  e toast "Você não tem permissão para realizar esta ação…".
  Screenshot: `qa-audit/artifacts/est/seller-excluir-403.png`
  Contraprova: `/estoque/depositos` usa `<Can mode="disable">` e mostra
  `permission-disabled` com tooltip.
- **Esperado**: `CLAUDE.md` → "For buttons, prefer `<Can mode="disable">` (disabled +
  tooltip) over hiding: a control that vanishes with no explanation confuses as much as
  the 403 did" — e uma ação destrutiva oferecida a quem não pode executá-la é pior ainda.
- **Arquivo**:
  - `apps/web/app/(dashboard)/estoque/produtos/page.tsx:90-106` (`ProductActions`)
  - `apps/web/app/(dashboard)/estoque/categorias/page.tsx:65-89` (`CategoryActions`)
  - `apps/web/app/(dashboard)/estoque/marcas/page.tsx:39-63` (`BrandActions`)
  - `apps/web/app/(dashboard)/estoque/produtos/[id]/page.tsx:102-113` (Editar/Excluir do detalhe, também sem `<Can>`)
  - Referência correta: `apps/web/app/(dashboard)/estoque/depositos/page.tsx:92-124`
- **Correção**: envolver cada botão em `<Can permission="products:update" mode="disable">`
  / `products:delete`, como já é feito em Depósitos.

---

### [ALTO] EST-05: no tema escuro o vermelho de "estoque zerado" e o badge "Saída" ficam em 2,66:1

- **Tela**: `/estoque/produtos`, `/estoque/alertas`, `/estoque/movimentacoes`
  (1440, **escuro**, owner)
- **Evidência** (medido com o fundo efetivo):
  - `text-destructive` — `rgb(165, 39, 39)` sobre `rgb(12, 15, 24)` → **2,66:1**
    (mínimo 4,5:1), em 14 px/500. Atinge a quantidade `0` da coluna Estoque, o
    "Estoque Atual" dos alertas e o `−1` das saídas.
  - Mesmo 2,66:1 no badge `variant="destructive"` "Saída" (12 px/600) —
    `scan.dark.movimentacoes.lowContrast`.
  - Screenshots: `qa-audit/artifacts/est/dark-movimentacoes.png`,
    `qa-audit/artifacts/est/dark-produtos.png`
- **Esperado**: BRIEFING → "Acessibilidade: contraste AA (4.5:1 / 3:1 grande)".
- **Arquivo**: `apps/web/app/globals.css:75` — `.dark { --destructive: 0 62% 40%; }`
  (e `--danger` igual, `:84`). Consumido em
  `produtos/page.tsx:176`, `alertas/page.tsx:51`, `movimentacoes/page.tsx:144`,
  `components/ui/badge.tsx:16`.
- **Correção**: clarear `--destructive` no tema escuro (ex.: `0 72% 62%` dá ≈ 5,2:1
  sobre `--background`) ou usar um par dedicado `--destructive-fg-on-dark`, como o
  badge success/warning já faz com `dark:text-emerald-400`/`dark:text-amber-400`.

---

### [ALTO] EST-06: no tema claro o número de "estoque baixo" (amarelo) tem 2,81:1 e o "+qtd" verde 3,61:1

- **Tela**: `/estoque/produtos`, `/estoque/alertas`, `/estoque/movimentacoes`
  (1440, claro, owner)
- **Evidência**:
  - `text-yellow-600` = `rgb(202, 138, 4)` sobre `rgb(249, 250, 251)` → **2,81:1**
    (14 px, peso 500/600; mínimo 4,5:1). É exatamente o número que a tela existe para
    destacar: `1`, `7`, `4` na coluna Estoque e o "Estoque Atual" dos alertas.
  - `text-emerald-600` = `rgb(5, 150, 105)` sobre o mesmo fundo → **3,61:1** nas
    entradas (`+1`, `+7`) de Movimentações.
  - Screenshot: `qa-audit/artifacts/est/light-produtos.png` (números amarelos lavados)
- **Esperado**: contraste AA **e** "Cor só via token" — `text-yellow-600` não é token.
- **Arquivo**:
  - `apps/web/app/(dashboard)/estoque/produtos/page.tsx:177` (`text-yellow-600`)
  - `apps/web/app/(dashboard)/estoque/alertas/page.tsx:51` (`text-yellow-600`)
  - `apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:144` (`text-emerald-600`)
  - `apps/web/app/(dashboard)/estoque/movimentacoes/_components/adjustment-form.tsx:155`
  - `apps/web/app/(dashboard)/estoque/produtos/[id]/_components/product-stock-card.tsx:30`
- **Correção**: trocar por `text-warning` / `text-success` e ajustar os tokens para
  passarem AA nos dois temas (`--warning: 38 92% 50%` também não passa como texto sobre
  fundo claro; o par usado no `Badge` — fundo `/15` + texto escuro — já resolve isso e
  poderia ser reaproveitado).

---

### [ALTO] EST-07: o `ConfirmDialog` de exclusão não é um diálogo para tecnologia assistiva

- **Tela**: todos os "Excluir" do módulo (produto na lista, produto no detalhe,
  categoria, marca, depósito) — medido em `/estoque/categorias` (1440, claro, owner)
- **Evidência** (`a11y.confirmdialog`), com o diálogo aberto e visível:
  - `document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length` → **0**
  - `role` = `null`, `aria-modal` = `null`, `aria-labelledby` = `null`
  - o foco **não** entra no diálogo: `document.activeElement` continua sendo o botão
    da linha que o abriu (`BUTTON/inline-flex items-center justify-center`)
  - o botão de fechar (X) não tem nome acessível (`closeBtnName: ""`) — só um tooltip
  - Screenshot: `qa-audit/artifacts/est/confirm-dialog-categoria.png`
  - Contraste: os diálogos que usam Radix (`Nova Categoria`) trazem
    `aria-labelledby="radix-:rc:"` e `aria-describedby` corretos.
- **Esperado**: BRIEFING → "`aria-*` em dialogs"; o restante do sistema já usa
  `components/ui/dialog.tsx` (Radix), que resolve papel, rótulo, foco e Esc.
- **Arquivo**: `apps/web/components/ui/confirm-dialog.tsx:91-110` — `div` solta com
  `fixed inset-0`, sem `role`/`aria-modal`/`aria-labelledby`, sem foco inicial e sem
  focus trap; o `<button>` de fechar (`:103-109`) só tem ícone.
- **Correção**: reconstruir sobre `Dialog`/`DialogContent` (Radix) ou, no mínimo,
  adicionar `role="alertdialog" aria-modal="true" aria-labelledby={titleId}
  aria-describedby={msgId}`, mover o foco para o botão de confirmação ao abrir e pôr
  `aria-label="Fechar"` no X.

---

### [ALTO] EST-08: os botões só-ícone das listas não têm nome acessível — o tooltip do Radix não conta

- **Tela**: `/estoque/produtos`, `/estoque/categorias`, `/estoque/marcas`
  (1440, claro, owner) — contagem restrita às linhas da tabela (`tbody`), o shell
  fica de fora
- **Evidência** (`a11y.iconbuttons`): botões cujo conteúdo é só um `<svg>` e que não
  têm `aria-label`, `title` nem `.sr-only`:
  | Tela | linhas | botões só-ícone | **sem nome** | com nome |
  |---|---|---|---|---|
  | /estoque/produtos | 19 | 57 | **57** | 0 |
  | /estoque/categorias | 6 | 12 | **12** | 0 |
  | /estoque/marcas | 4 | 8 | **8** | 0 |
  | /estoque/depositos (`main`) | — | 20 | **0** | 20 |
  No botão "Editar" da primeira linha de Produtos: o tooltip aparece
  (`tooltipVisible: true`, texto "Editar") mas `aria-label` é `null` —
  o `Tooltip.Content` do Radix vira `aria-describedby`, não o rótulo.
- **Esperado**: BRIEFING → "todo botão só-ícone precisa de tooltip **ou** `aria-label`";
  a regra está escrita no próprio código de Depósitos:
  `depositos/page.tsx:95-96` — "o tooltip do Radix é `aria-describedby`, não substitui
  o rótulo".
- **Arquivo**:
  - `apps/web/app/(dashboard)/estoque/produtos/page.tsx:92-106`
  - `apps/web/app/(dashboard)/estoque/categorias/page.tsx:66-88`
  - `apps/web/app/(dashboard)/estoque/marcas/page.tsx:40-62`
  - Referência correta: `apps/web/app/(dashboard)/estoque/depositos/page.tsx:96-101`
- **Correção**: `aria-label="Ver detalhes" / "Editar produto" / "Excluir produto"` em
  cada `<Button size="icon">`, mantendo o `<Tooltip>` para quem enxerga.

---

### [ALTO] EST-26: as imagens enviadas no cadastro são descartadas em silêncio

- **Tela**: `/estoque/produtos/novo` → aba Imagens (1440, claro, owner)
- **Evidência** (`imagens.novo-produto`): um PNG selecionado na aba Imagens aparece
  listado com miniatura e tamanho (screenshot
  `qa-audit/artifacts/est/novo-imagens-upload.png`), mas:
  - **`uploadRequests: []`** — nenhuma requisição sai do navegador ao escolher o
    arquivo (o `FileUpload` só marca `status: "done"` quando não recebe `onUpload`);
  - o `POST /api/v1/products` responde **201** e o corpo enviado **não contém**
    campo de imagens;
  - relendo o produto criado pela API: **`images: []`** (`imagesLength: 0`).
  O usuário anexa até 8 imagens, lê "Produto criado com sucesso!" e o catálogo fica
  sem nenhuma delas — sem erro, sem aviso, sem como perceber.
- **Esperado**: "Never let a mutation's Promise rejection go unhandled — silent
  failures are forbidden" e o próprio contrato da tela: um campo que aceita entrada
  e a descarta é pior do que um campo que não existe.
- **Arquivo**:
  - `apps/web/app/(dashboard)/estoque/produtos/novo/page.tsx:181` (`useState<UploadedFile[]>`),
    `:702-709` (`<FileUpload>` **sem** `onUpload`) e `:252-274` (o payload de
    `createProduct.mutateAsync` não tem imagens)
  - `apps/web/components/forms/file-upload.tsx:128-136` — sem `onUpload`, todos os
    arquivos são marcados `done`/100 % sem sair do navegador
  - `apps/web/hooks/use-products.ts` — `ProductFormData` não tem campo de imagens
- **Correção**: ligar o `onUpload` ao endpoint de upload e enviar as URLs no payload
  (ou, enquanto isso não existir, remover a aba Imagens do cadastro — a tela de
  detalhe já tem `ProductImagesCard` para exibir o que a API devolve).

---

### [MÉDIO] EST-09: cores literais em vez de tokens em cinco telas do módulo

- **Tela**: todas as listas + detalhe do produto (1440, claro e escuro, owner)
- **Evidência** (`measure().hardcodedColors`, conferido no código):
  | Tela | classes literais |
  |---|---|
  | `/estoque/produtos` | `text-yellow-600` |
  | `/estoque/alertas` | `text-yellow-600` |
  | `/estoque/movimentacoes` | `text-emerald-600` |
  | `/estoque/produtos/[id]` | `bg-emerald-500/10 text-emerald-600`, `bg-blue-500/10 text-blue-600`, `bg-amber-500/10 text-amber-600`, `text-emerald-600` |
  | `/estoque/marcas` | `bg-white` no quadro do logo |
  | compartilhados | `StatusBadge` (`bg-green-100 text-green-800 …`), `Badge success/warning` (`bg-emerald-500/15`, `bg-amber-500/15`), checkbox `border-gray-300` |
  Três dos quatro KPIs do detalhe usam paleta literal enquanto o primeiro usa
  `bg-primary/10 text-primary` — o próprio card mostra a inconsistência.
- **Esperado**: BRIEFING → "Cor só via token (`bg-background`, `text-muted-foreground`,
  `border-border`, `bg-success`, …). `text-gray-500` ou `bg-[#fff]` é achado."
- **Arquivo**: `produtos/page.tsx:177`; `alertas/page.tsx:51`;
  `movimentacoes/page.tsx:144`; `movimentacoes/_components/adjustment-form.tsx:155`;
  `produtos/[id]/page.tsx:130,141,152`;
  `produtos/[id]/_components/product-stock-card.tsx:30`;
  `marcas/page.tsx:78` (`bg-white`);
  `components/ui/status-badge.tsx:14-29` e `components/ui/badge.tsx:19-22`
  (compartilhados — corrigir fora deste módulo).
- **Correção**: `text-warning` / `text-success` / `text-destructive` e
  `bg-success/10 text-success` nos KPIs; `bg-card` no lugar de `bg-white`.

---

### [MÉDIO] EST-10: nenhum `<label>` do módulo está associado ao seu campo

- **Tela**: `/estoque/produtos/novo`, `/estoque/produtos/[id]/edit`, diálogos de
  Categoria, Marca, Depósito e Movimentação (1440, claro, owner)
- **Evidência** (`labelAssociation`, labels sem `for` e sem envolver o controle):
  - `/estoque/produtos/novo`: **6 de 6** órfãos — "Nome *", "SKU *", "Descrição",
    "Categoria", "Marca", "Estoque mínimo"
  - diálogo Nova Categoria: **3 de 3** — "Nome *", "Slug", "Categoria Pai"
  - diálogo Nova movimentação: **5 de 5** — "Produto", "Depósito de destino",
    "Quantidade", "Motivo", "Observações" (todos com `htmlFor: null`)
  - Nenhum dos inputs fiscais tem `id` (`mask.novo` → `"id": null` em ncm/cest/ean/cfop)
- **Esperado**: BRIEFING → "Acessibilidade: … `<label>` associado".
- **Arquivo**: `produtos/novo/page.tsx:385,396,422,451`;
  `produtos/[id]/edit/page.tsx:281,286,292,307,356,360,364`;
  `components/forms/category-form-dialog.tsx:138,149,161`;
  `components/forms/brand-form-dialog.tsx:100,111`;
  `movimentacoes/_components/movement-fields.tsx:43` (`FieldShell`);
  `depositos/_components/warehouse-form-dialog.tsx:222` (`Field`);
  `components/forms/money-input.tsx:111` (o `<input>` nem tem `name`/`id`)
- **Correção**: dar `id` ao controle e `htmlFor` ao label nos componentes-casca
  (`FieldShell`, `Field`, `MoneyInput`, `SearchableSelect`) — resolve os cinco
  formulários de uma vez.

---

### [MÉDIO] EST-11: campos cujo erro não tem onde aparecer no cadastro de produto

- **Tela**: `/estoque/produtos/novo` (1440, claro, owner)
- **Evidência**: nome, SKU e preços preenchidos; Peso = `-5` na aba Dimensões →
  "Publicar Produto":
  - a aba ganha o contador (`Dimensões1`) e o formulário permanece nela — bom;
  - mas `document.querySelectorAll("p.text-destructive")` → **0**: nenhuma mensagem de
    erro em nenhum dos quatro campos da aba, e o input recusado não recebe borda de
    erro (o realce no screenshot é apenas o anel de foco de `focus-visible:border-ring`);
  - o toast só informa a quantidade ("Existe um campo obrigatório não preenchido ou
    inválido.").
  - Screenshot: `qa-audit/artifacts/est/novo-peso-negativo.png`
  Vale o mesmo para `markup`, `promoPrice` e `description`, todos registrados no
  schema e sem bloco de erro.
- **Esperado**: `CLAUDE.md` → "Every registered field renders its own error… Sweep for
  it with `grep '{...register(' | grep -v 'errors\.'` (FN-13)".
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/novo/page.tsx:651-689`
  (weight/height/width/length), `:488-507` (markup), `:515-521` (promoPrice),
  `:421-430` (description)
- **Correção**: adicionar `{fieldError("weight") && <p className="text-xs
  text-destructive">…}` em cada campo (e passar `error={fieldError("promoPrice")}` ao
  `MoneyInput`).

---

### [MÉDIO] EST-12: NCM, CEST e EAN não têm máscara em lugar nenhum — nem no formulário, nem no detalhe

- **Tela**: `/estoque/produtos/novo` e `/edit` → aba Fiscal; `/estoque/produtos/[id]`
  (1440, claro, owner)
- **Evidência** (`mask.novo` / `mask.edit`): digitando `1234567890…` nos campos, o valor
  resultante é `1234567890` (NCM), `123456789` (CEST), `123456789012345678` (EAN) —
  nenhum ponto, nenhuma barra. Os *placeholders* prometem o formato mascarado
  ("Ex: 8471.30.19", "Ex: 21.063.00"), e o `maxLength` foi dimensionado para a máscara
  (10 para NCM = 8 dígitos + 2 pontos), então **10 dígitos crus cabem no campo** e só
  são recusados depois do submit.
  `formatNCM`/`formatCEST` existem em `@erp/validators` e têm teste
  (`lib/br-fiscal.test.ts:31-37`), mas **não são usados em nenhum lugar do `app/`**
  (`grep formatNCM app components lib` → só o arquivo de teste).
  No detalhe, `ProductFiscalCard` imprime `product.ncm` cru.
  Screenshot: `qa-audit/artifacts/est/novo-fiscal-sem-mascara.png`
- **Esperado**: `CLAUDE.md` → "Apply masks via `onChange` + `setValue`…", "Display
  stored values with masks in tables and detail pages (never show raw digits to users)",
  "Always set `maxLength` on masked inputs to prevent overshoot".
- **Arquivo**: `produtos/novo/page.tsx:596-618`; `produtos/[id]/edit/page.tsx:357-365`;
  `produtos/[id]/_components/product-general-card.tsx:72-74`;
  máscaras ausentes em `apps/web/lib/masks.ts` (só CPF/CNPJ/Phone/CEP)
- **Correção**: `maskNCM`/`maskCEST` em `lib/masks.ts` (ou reusar `formatNCM`/`formatCEST`
  no `onChange` + `setValue(..., { shouldValidate: true })`) e formatar na exibição do
  detalhe.

---

### [MÉDIO] EST-13: o mesmo campo EAN aceita 18 caracteres no cadastro e 14 na edição; CFOP some na edição

- **Tela**: `/estoque/produtos/novo` × `/estoque/produtos/[id]/edit` (aba Fiscal)
- **Evidência** (`mask.novo` × `mask.edit`):
  | campo | novo | edição |
  |---|---|---|
  | ncm | `maxLength=10` | `maxLength=10` |
  | cest | `maxLength=9` | `maxLength=9` |
  | **ean** | **`maxLength=18`** | **`maxLength=14`** |
  | **cfop** | `maxLength=4`, com `datalist` de CFOPs | **AUSENTE** |
  O schema da edição valida `cfop` (`.max(4).refine(isValidCFOP)`) e o `reset()`
  carrega `product.cfop`, mas não existe campo — o valor viaja invisível e é
  reenviado no PATCH.
  Screenshot: `qa-audit/artifacts/est/edit-fiscal.png` (3 campos, contra 4 no cadastro)
- **Esperado**: `CLAUDE.md` → "All text inputs MUST have a `maxLength` prop matching the
  database column limit… EAN=18" e AE-08 ("a edição valida igual ao cadastro").
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/[id]/edit/page.tsx:365`
  (`maxLength={14}`) e `:354-367` (sem CFOP), contra `novo/page.tsx:612-638`
- **Correção**: `maxLength={18}` no EAN da edição e adicionar o campo CFOP com o mesmo
  `datalist` de `COMMON_SALE_CFOPS`.

---

### [MÉDIO] EST-14: nenhum toast é anunciado por leitor de tela

- **Tela**: qualquer mutação do módulo — medido no 403 de exclusão em `/estoque/produtos`
- **Evidência** (`403.delete.produto.toastAccessibility`): com o toast visível,
  `role: null`, `aria-live: null` no item **e** no container
  (`fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none`).
  Como todo o retorno de erro do módulo é um toast (EST-01, EST-02, EST-16),
  um usuário de leitor de tela submete o formulário e não recebe nada.
- **Esperado**: BRIEFING → "toda mutação precisa de toast de sucesso e de erro" só
  cumpre o objetivo se o toast for perceptível; par com o item de acessibilidade.
- **Arquivo**: `apps/web/components/ui/toast.tsx:71-90` (item) e `:119` (região) —
  componente compartilhado, correção fora do módulo mas o impacto foi medido aqui.
- **Correção**: `role="region" aria-live="polite" aria-atomic="false"` na região e
  `role="status"` (ou `role="alert"` para `variant="error"`) em cada item; e
  `aria-label="Fechar"` no X do toast (`:82-88`).

---

### [MÉDIO] EST-15: o raio do Card (12 px) não concorda com `--radius` (10 px) usado por botão, input e dialog

- **Tela**: todas as telas do módulo — flagrado por `measure().inconsistentRadius` em
  `/estoque/depositos` e `/estoque/produtos/[id]`
- **Evidência**: `div.rounded-xl.border.border-border/60.bg-card` → `border-radius: 12px`,
  enquanto na mesma tela o botão primário mede `r=10px`, o input `10px`, o
  `DialogContent` `10px` e o `Badge` `6px` (`consistency.geometry`, `mov.dialogInfo`).
  `--radius: 0.625rem` = 10 px; `rounded-xl` do Tailwind é `0.75rem` = 12 px e **não**
  está mapeado no `tailwind.config.ts` (só `lg`/`md`/`sm` derivam de `--radius`).
- **Esperado**: BRIEFING → "Borda e raio: `--radius: 0.625rem`. Card, input, botão,
  badge e dialog precisam concordar".
- **Arquivo**: `apps/web/components/ui/card.tsx:12` (`rounded-xl`) —
  ou `apps/web/tailwind.config.ts:76-80`, que não define `xl`
- **Correção**: trocar por `rounded-lg` no `Card` ou acrescentar
  `xl: "calc(var(--radius) + 2px)"` ao `borderRadius` do tema e decidir um único valor.

---

### [MÉDIO] EST-16: o diálogo diz que a categoria não pode ser excluída e mesmo assim oferece o botão "Excluir"

- **Tela**: `/estoque/categorias` (1440, claro, owner)
- **Evidência**: categoria "Acessórios" (2 produtos). O diálogo mostra, corretamente e
  antes de confirmar: *"Acessórios está em uso por 2 produto(s) e não pode ser excluída.
  Mova os produtos para outra categoria primeiro."* — mas o botão **Excluir continua
  habilitado** (`confirmEnabledEvenThoughDialogSaysItCannot: true`); ao clicar,
  `409 DELETE /api/v1/products/categories/…` e um toast repetindo a mesma frase.
  Screenshot: `qa-audit/artifacts/est/categoria-em-uso.png`
- **Esperado**: `CLAUDE.md` → "Anticipate the error when the screen already knows" —
  a antecipação está feita pela metade: informa e mesmo assim deixa errar.
  Vale igual para Marcas (mesma mensagem) e para Produtos com saldo.
- **Arquivo**: `apps/web/app/(dashboard)/estoque/categorias/page.tsx:308-325`;
  `marcas/page.tsx:269-285`; `produtos/page.tsx:107-120`;
  `components/ui/confirm-dialog.tsx:143-151` (o `ConfirmDialog` não tem prop
  `confirmDisabled`)
- **Correção**: adicionar `confirmDisabled?: boolean` ao `ConfirmDialog` e passá-lo
  quando `_count.products > 0` / `stockOnHand > 0`, trocando o rótulo para "Entendi".

---

### [MÉDIO] EST-17: Alertas ignora dois filtros que a API aceita e o único filtro que tem não é rotulado

- **Tela**: `/estoque/alertas` (1440, claro, owner)
- **Evidência**:
  - `AlertQueryDto` aceita `status`, **`warehouseId`** e **`productId`**
    (`apps/api/src/modules/inventory/dto/inventory.dto.ts:281-312`); a tela só tem o
    `Select` de status (`load.alertas.filtros.selects: ["Todos os status","20 por página"]`).
  - `labels: []` — o `Select` de status **não tem `<label>`**, ao contrário de todos os
    outros filtros do módulo, que ficam num `FilterPanel` com rótulo.
  - `hasSearch: false` e `hasFilters: false`: Alertas é a única lista do módulo sem
    **nenhum** dos dois — Produtos, Categorias e Marcas têm campo de busca; Produtos e
    Movimentações têm `FilterPanel` (`busca.filtros`).
- **Esperado**: `CLAUDE.md` → "Before adding a screen, diff its `*QueryDto` against the
  panel. Sixteen filters the API already accepted had no field anywhere in the UI" +
  "Use `<EntityFilterSelect>` for low-cardinality entities (… warehouse …)".
- **Arquivo**: `apps/web/app/(dashboard)/estoque/alertas/page.tsx:105-143`
- **Correção**: mover o filtro para `FilterPanel` com `useFilters` e acrescentar
  `<EntityFilterSelect>` de Depósito e `<SearchableSelectBase>` de Produto,
  como já é feito em `movimentacoes/page.tsx:290-311`.

---

### [MÉDIO] EST-25: em 1440 a coluna "Ações" da lista de Produtos fica fora da área visível

- **Tela**: `/estoque/produtos` (1440 × 900, claro, owner) — comparada com
  `/estoque/categorias` na mesma medição
- **Evidência** (`colunas`): o container `overflow-x-auto` mede
  **`scrollWidth/clientWidth = 1307/1110`**; cabeçalhos dentro da área visível:
  `SKU, Produto, Categoria, Preço, Estoque` — **`Status` e `Ações` ficam fora**.
  Larguras: `SKU:205 · Produto:462 · Categoria:156 · Preço:137 · Estoque:110 ·
  Status:101 · Ações:136`. A coluna Produto está no teto de truncamento
  (`max-w-[42ch]` ≈ 462 px), que qualquer nome com 42+ caracteres atinge — e o
  schema permite 255.
  Contraprova na tela equivalente: `/estoque/categorias` mede `1110/1110`,
  `needsScroll: false`, todas as cinco colunas visíveis, inclusive Ações.
  Screenshots: `qa-audit/artifacts/est/produtos-1440-colunas.png`,
  `qa-audit/artifacts/est/light-produtos.png`
  *Ressalva*: parte dos 205 px de SKU vem da massa de QA (`SKU-qa-est-…`, 24
  caracteres); com SKUs do seed (`ACESS-001`) a soma cai para ≈ 1192 px — ainda
  acima dos 1110 px disponíveis, porque a coluna Produto sozinha ocupa 462.
- **Esperado**: rolar no próprio container está correto (AE-07), mas o usuário não
  tem como saber que existem ações à direita; nas telas equivalentes do módulo elas
  estão sempre visíveis.
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/page.tsx:127-204` (7 colunas,
  nenhuma com `width` declarada, então não há `table-fixed`) e
  `apps/web/components/tables/data-table.tsx:466-472` (teto de 42ch)
- **Correção**: declarar `width` nas colunas (ativa `table-fixed`, já suportado no
  `DataTable`) reduzindo Produto para ~28ch e SKU para ~14ch, ou fixar a coluna de
  ações (`sticky right-0 bg-card`) para que ela nunca saia da tela.

---

### [BAIXO] EST-18: o rodapé diz "Nenhum registro" enquanto o skeleton ainda está carregando

- **Tela**: `/estoque/produtos` com a resposta atrasada 4 s (1440, claro, owner)
- **Evidência**: com 140 blocos `animate-pulse` na tabela (20 linhas de skeleton),
  o texto da paginação já diz "Nenhum registro" (`saysEmpty: true` durante o loading).
  Screenshot: `qa-audit/artifacts/est/loading-produtos.png`
- **Esperado**: primo de AE-28 — "nenhum registro" só depois de uma requisição que
  respondeu 200 com zero linhas; enquanto carrega não se sabe.
- **Arquivo**: `apps/web/components/tables/data-table.tsx:486-498` — o ternário trata
  `error` e `total > 0`, mas não `isLoading`.
- **Correção**: `isLoading ? "" : error ? "" : total > 0 ? … : "Nenhum registro"`.

---

### [BAIXO] EST-19: a linha do skeleton tem padding diferente da linha real e a tabela "pula" ao carregar

- **Tela**: `/estoque/produtos` (1440, claro, owner)
- **Evidência**: `td` do skeleton → `padding: 16px`; `td` com dado → `padding: 12px 16px`
  (`load.skeleton.padding-shift`). Cada linha encolhe 8 px quando os dados chegam.
- **Esperado**: BRIEFING → "Espaçamento na escala de 4px. Padding de card, gap de grid e
  altura de controle têm que bater entre telas equivalentes" — vale também entre os dois
  estados da mesma tela.
- **Arquivo**: `apps/web/components/tables/data-table.tsx:114` (`className="p-4"`)
  contra `:454` (`"px-4 py-3"`)
- **Correção**: usar `px-4 py-3` também no `SkeletonRow`.

---

### [BAIXO] EST-20: o nome truncado do produto não tem `title` — o texto completo não é alcançável

- **Tela**: `/estoque/produtos` (1440, claro, owner)
- **Evidência**: produto com nome de 255 caracteres. A célula trunca corretamente
  (`span.block.max-w-[42ch].truncate`, `scrollWidth/clientWidth = 2364/430`,
  `text-overflow: ellipsis`), mas o `<td>` tem **`title: null`** — porque a coluna
  "Produto" usa `cell:` (um `<Link>`) e o `DataTable` só põe `title` quando o valor é
  texto puro. Não há tooltip, nem `title`, nem expansão: o nome completo não existe em
  lugar nenhum da lista.
  Screenshot: `qa-audit/artifacts/est/trunc-nome-longo-1440.png`
- **Esperado**: `CLAUDE.md` → "Every table cell truncates by default (`max-w-[42ch]` on
  an inner wrapper, **`title` on the `<td>`**)".
- **Arquivo**: `apps/web/components/tables/data-table.tsx:447-458` — `isPlainText` é
  falso para células com JSX; `produtos/page.tsx:137-148` é justamente uma dessas.
- **Correção**: aceitar um `titleAccessor?: (row) => string` no `ColumnDef` (ou usar
  `col.accessor` para o `title` mesmo quando há `cell`) e preenchê-lo na coluna Produto.

---

### [BAIXO] EST-21: a exclusão de produto na lista não passa por `getMutationErrorMessage`

- **Tela**: `/estoque/produtos` (ação Excluir da linha)
- **Evidência**: o toast do 403 saiu correto ("Você não tem permissão…") porque
  `getApiErrorMessage` também trata 403, mas o caminho de 5xx não está coberto: sem o
  helper, um `500` com `message: "Internal server error"` iria cru para o toast em vez do
  fallback. Todos os outros pontos do módulo usam `getMutationErrorMessage`.
- **Esperado**: `CLAUDE.md` → "On error, always go through `getMutationErrorMessage(error,
  fallback)`… **A error toast without it does not pass code review.**"
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/page.tsx:45,79-82`
- **Correção**: trocar por
  `getMutationErrorMessage(err, "Erro ao excluir produto.")`.

---

### [BAIXO] EST-22: "Nova movimentação" não é gated, ao contrário de todos os outros botões de criação do módulo

- **Tela**: `/estoque/movimentacoes` (1440, claro, owner)
- **Evidência**: o botão é renderizado sem `<Can>`. Hoje o dano é contido porque
  `RequirePermission permission="inventory:read"` barra o vendedor na porta (o papel
  `seller` cai em "Você não tem permissão" antes de ver a tela). Mas um papel com
  `inventory:read` e **sem** `inventory:create`/`transfer`/`adjust` abre um diálogo com
  a faixa de abas **vazia** e mesmo assim com o formulário de Entrada renderizado:
  `availableModes` fica `[]`, o `useEffect` de correção retorna cedo
  (`movement-form-dialog.tsx:76-81`) e `mode` continua `"ENTRY"`, então
  `<EntryExitForm>` é montado e só falha com 403 no submit.
- **Esperado**: `CLAUDE.md` → "Gate UI with `usePermissions()` / `<Can>`"; Produtos,
  Categorias, Marcas e Depósitos já fazem isso no botão de criar.
- **Arquivo**: `apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:245-248`
- **Correção**: envolver em
  `<Can anyOf={["inventory:create","inventory:transfer","inventory:adjust"]} mode="disable">`.

---

### [BAIXO] EST-23: `text-muted-foreground` fica em 4,49:1 no tema claro — reprova AA por 0,01

- **Tela**: todas as telas do módulo (1440, claro)
- **Evidência**: `rgb(101, 117, 139)` sobre `rgb(249, 250, 251)` → **4,49:1** (mínimo
  4,5:1), em 16 px (subtítulo de cada página) e em 12 px (SKU sob o nome do produto nas
  Movimentações e nos Alertas). No tema escuro o mesmo token dá 5,29:1 e passa.
- **Esperado**: contraste AA 4,5:1 para texto normal.
- **Arquivo**: `apps/web/app/globals.css:25` — `--muted-foreground: 215 16% 47%`
  (token compartilhado; correção fora do módulo)
- **Correção**: escurecer para `215 16% 45%` (≈ 4,75:1) — muda pouco visualmente e
  resolve em todas as telas.

---

### [BAIXO] EST-24: pequenas divergências entre o cadastro e a edição de produto

- **Tela**: `/estoque/produtos/novo` × `/estoque/produtos/[id]/edit`
- **Evidência** (leitura de código, confirmada nos screenshots
  `novo-fiscal-sem-mascara.png` e `edit-ncm-aba-oculta.png`):
  | elemento | novo | edição |
  |---|---|---|
  | botão Cancelar | `variant="cancel"` | `variant="outline"` |
  | botão Calcular | `variant="secondary"` + `title` | `variant="outline"`, sem tooltip |
  | abas | 5 (com "Imagens") | 4 |
  | preview de margem / confirmação de margem negativa (AE-05) | sim | **não** |
  | `salePrice` mínimo | "Preço de venda deve ser maior que zero" | "Preço de venda é obrigatório" (AE-24 corrigido só no cadastro) |
- **Esperado**: BRIEFING → consistência entre telas equivalentes; AE-05 e AE-24 valem
  para a edição pelo mesmo motivo que valem para o cadastro (editar o preço para baixo
  do custo é o caminho mais comum, não o cadastro inicial).
- **Arquivo**: `apps/web/app/(dashboard)/estoque/produtos/[id]/edit/page.tsx:50,338,399`
  contra `novo/page.tsx:74,127-138,498-505,718-722`
- **Correção**: extrair o formulário para um componente único parametrizado por modo,
  ou no mínimo alinhar variantes, mensagem do `min` e o `superRefine` da margem negativa.

---

## Apêndice — como reproduzir

```bash
cd /Users/mac/work/erp/apps/web
npx playwright test -c qa-audit/playwright.qa.config.ts qa-audit/estoque.spec.ts \
  --reporter=list --output=qa-audit/artifacts/est
```

Cada teste imprime um bloco `@@<id> {...}` com as medições citadas acima
(`@@err.brand.logoUrl`, `@@sort.movimentacoes`, `@@403.seller`, `@@cor.dark…`, …).
O último teste (`EST-cleanup`) remove a massa criada com sufixo `qa-est-<timestamp>`.

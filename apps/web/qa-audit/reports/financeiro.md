# QA UX/UI — Financeiro + Dashboard (`FIN`)

**Escopo**: `/` (Dashboard), `/financeiro`, `/financeiro/contas`, `/financeiro/lancamentos`,
`/financeiro/caixa`.
**Spec**: `qa-audit/financeiro.spec.ts` — 22 testes, todos verdes (Chromium, pt-BR,
America/Sao_Paulo, 1440×900 por padrão). **Screenshots**: 29 arquivos em
`qa-audit/artifacts/fin/`.
**Papéis**: `owner` (admin@admin.com) e `seller` (vendedor@exemplo.com, sem `financial:read`).

Nenhum caixa foi aberto ou fechado. As únicas mutações disparadas foram as que o backend
**recusa** (transferência sem saldo, sangria maior que o caixa), para comparar o toast com o
corpo HTTP real. O caixa `QA Caixa Financeiro` continua `OPEN` com abertura de R$ 200,00,
conferido pela API ao final.

| Severidade | Qtd |
|---|---|
| Crítico | 3 |
| Alto | 5 |
| Médio | 11 |
| Baixo | 5 |
| **Total** | **24** |

### O que passou (para não virar retrabalho)

- `RequirePermission` funciona nas três rotas com o papel `seller`: "Você não tem permissão
  para ver as contas financeiras / os lançamentos financeiros / os caixas", sem tabela vazia e
  sem 403 no console (`seller-*.png`). O AE-28 **não** reaparece pela via do 403 — reaparece
  pela via do 5xx (FIN-02, FIN-03).
- Toast de erro = corpo da resposta, caractere por caractere, na transferência e na sangria
  (AE-10 não reaparece nesses fluxos). Ver FIN-05 e FIN-11 para o que ainda falta.
- Datas civis corretas: `formatDate` na coluna Data e nos eixos do gráfico, `formatDateTime`
  em "Aberto em"/"Fechado em". Nenhum dia a menos (FN-02 não reaparece).
- Eixos do gráfico em pt-BR (`21/07`, `R$ 1.500,00`) e contraste 4,7:1 claro / 5,03:1 escuro —
  o ponto fraco clássico está OK aqui.
- A tabela de lançamentos rola no próprio container a 390 e 768 px
  (`scrollWidth 1179 > clientWidth 356`, `overflow-x: auto`) — AE-07 não reaparece.
- `isInvertedRange` está ligado no filtro de período (mas veja FIN-06).

---

### [CRÍTICO] FIN-01: a 390 px, "Transferência" e "Nova Conta" ficam fora da tela e não há scroll

- **Tela**: `/financeiro/contas` (390×844, dark e claro, owner)
- **Evidência**: o cabeçalho é um único `flex items-center justify-between` com
  `flex-wrap: nowrap` e `scrollWidth 780` contra `clientWidth 358`. Medido botão a botão:

  | controle | left→right | fora da tela | clicável |
  |---|---|---|---|
  | Buscar por nome ou banco | 174→224 | não | **não** |
  | Filtros | 224→313 | não | sim |
  | Importar Despesas | 313→498 | **sim** | sim (metade) |
  | Transferência | 506→654 | **sim** | **não** |
  | Nova Conta | 662→796 | **sim** | **não** |

  `document.documentElement.scrollWidth === 390` — a página **não** rola, então os controles
  simplesmente não existem para quem está no celular. `boundingBox` de "Nova Conta":
  `x=661.7, width=134.5` num viewport de 390.
  Screenshot: `qa-audit/artifacts/fin/contas-390-dark.png`.
- **Esperado**: "Responsivo: 390px, 768px e 1440px. Conteúdo largo rola no próprio container"
  (`CLAUDE.md` › Responsive and tables). A causa é estrutural: `ListSearch` e `FilterPanel`
  foram colocados **dentro** do flex row do título, em vez de abaixo dele — o mesmo defeito
  espreme a busca a 1440 px (placeholder cortado em "Buscar por nome ou ba…",
  `contas-1440-light.png`).
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:129` (abertura do row) —
  `ListSearch` em `:139`, `FilterPanel` em `:146`, botões em `:186-203`, fechamento em `:204`.
- **Correção**: fechar o row do cabeçalho logo depois do bloco de título + ações
  (`flex-col gap-4 sm:flex-row sm:items-center sm:justify-between` com
  `flex-wrap` nas ações) e mover `ListSearch` + `FilterPanel` para irmãos abaixo, como em
  `/financeiro/caixa` (`SessionHistory`) e nas telas de estoque.

---

### [CRÍTICO] FIN-02: o Dashboard responde a um 500 com skeleton eterno e dois estados vazios falsos

- **Tela**: `/` (1440×900, claro, owner) com `/api/v1/reports/dashboard` forçado a 500
- **Evidência**: 5 skeletons `animate-pulse` continuam pulsando indefinidamente,
  "Vendas do Período" mostra **"Sem vendas no período"** e "Pedidos por Status" mostra
  **"Sem dados disponíveis"**. Regex de erro sobre todo o `innerText` da página:
  `/erro|não foi possível|tente novamente|falha/i` → **false**. Nada na tela diz que a
  requisição falhou. Screenshot: `qa-audit/artifacts/fin/dashboard-error-500.png`.
- **Esperado**: "`isError` **must never** be rendered as an empty state" e "permissions/erro:
  render a loading state" só enquanto está carregando (`CLAUDE.md` › Permissions and error
  states). Um skeleton que nunca termina é pior que o AE-28 original: o usuário fica esperando.
- **Arquivo**: `app/(dashboard)/page.tsx:58` — `const { data: dashResp, isLoading } =
  useDashboardData()` descarta `error`; `:181` `if (isLoading || !kpis) return <skeleton>`;
  `:222-225` "Sem vendas no período"; `:360-363` "Sem dados disponíveis".
- **Correção**: extrair `error` do hook e, em cada seção, ramificar
  `isLoading → skeleton | error → estado de erro com retry | vazio → mensagem`. O
  `PermissionDeniedState`/`isPermissionError()` já existem para o caso 403.

---

### [CRÍTICO] FIN-03: "Nenhuma conta financeira cadastrada" e "Nenhum caixa cadastrado" em cima de um 500 (AE-28 de volta)

- **Tela**: `/financeiro/contas` e `/financeiro/caixa` (1440×900, claro, owner), GET forçado a 500
- **Evidência**: `/financeiro/contas` → texto "Nenhuma conta financeira cadastrada" presente,
  nenhuma menção de erro (`saysError: false`). `/financeiro/caixa` → "Nenhum caixa cadastrado",
  `saysError: false`, e o resumo ainda afirma "Total de Caixas 0".
  Screenshots: `contas-error-500.png`, `caixa-error-500.png`.
- **Esperado**: é textualmente a regra que o time escreveu depois do incidente:
  "`/financeiro/contas` reported 'Nenhuma conta cadastrada' on top of a 403 with six accounts in
  the bank (AE-28)" e "'Nenhum caixa aberto' must mean the query answered zero, not that it
  failed (VD-07)" (`CLAUDE.md` › Permissions and error states). O `DataTable` já implementa o
  estado de erro certo (`data-table.tsx:390-409`) — estas duas telas não o usam.
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:107` (`const { data, isLoading } =
  useFinancialAccounts(...)`, sem `error`) e `:256-264` (estado vazio);
  `app/(dashboard)/financeiro/caixa/page.tsx:37` (`const { data, isLoading } =
  useCashRegisters()`) e `:71-80`.
- **Correção**: pegar `error` das duas queries e passar por `isPermissionError()` /
  estado de erro antes de considerar `length === 0`. Em contas, o caminho mais curto é trocar a
  `<table>` manual pelo `<DataTable error={error}>`, que já resolve isso, a truncagem (AE-20) e a
  paginação de uma vez.

---

### [ALTO] FIN-04: dinheiro colorido com paleta literal em todo o módulo, e o vermelho reprova AA no dark

- **Tela**: `/`, `/financeiro/lancamentos`, `/financeiro/caixa` (1440, claro e escuro, owner)
- **Evidência**: `measure(page).hardcodedColors` e cor computada contra o token resolvido:

  | onde | classe | pintado | token que deveria pintar |
  |---|---|---|---|
  | Card Receitas / Saldo | `text-green-600` | `rgb(22,163,74)` | `--success` = `rgb(16,183,127)` |
  | Card Despesas / Vencidos | `text-red-600` | `rgb(220,38,38)` | `--danger` = `rgb(220,40,40)` |
  | Coluna Valor (8/8 linhas) | `text-red-600` | `rgb(220,38,38)` | `--danger` |
  | Linha vencida | `bg-red-50/60 dark:bg-red-950/20` | `rgba(254,242,242,.6)` | `bg-danger/10` |
  | KPI tendência | `text-emerald-600` | `rgb(5,150,105)` | `--success` |
  | Sparkline (SVG) | `stroke="#10b981"` | literal | `hsl(var(--success))` |
  | Caixa "Abertos" | `text-green-600` / `bg-green-500/10` | `rgb(22,163,74)` | `--success` |
  | Diferença de sessão | `text-red-600`/`text-green-600` | só no código¹ | `--danger`/`--success` |

  ¹ Todas as sessões da base estão sem `difference` (célula "—"), então este ponto foi
  confirmado no código, não medido na tela.

  No dark mode o mesmo `text-red-600` sobre `rgb(12,15,24)` mede **3,96:1** (mínimo 4,5) — o
  valor "R$ 89,90" da coluna Valor e "-R$ 149,90" no caixa. E a tendência do KPI mede
  **3,77:1** já no tema claro (`rgb(5,150,105)` sobre branco, 12 px).
  Screenshots: `lancamentos-1440-dark.png`, `caixa-1440-dark.png`, `dashboard-1440-light.png`.
- **Esperado**: "Cor só via token… `text-gray-500` ou `bg-[#fff]` é achado" (BRIEFING) e
  contraste AA 4,5:1 (`CLAUDE.md` › Acessibilidade).
- **Arquivo**: `app/(dashboard)/financeiro/lancamentos/page.tsx:79-83, 257, 263, 269, 271,
  279-280, 293`; `app/(dashboard)/financeiro/caixa/page.tsx:134-139, 217, 223`;
  `app/(dashboard)/financeiro/caixa/_components/session-history.tsx:68`;
  `components/charts/kpi-card.tsx:56, 58, 63, 90, 95, 103`.
- **Correção**: `text-success` / `text-danger` / `bg-danger/10`, e no SVG
  `stroke="hsl(var(--success))"`. Ajustar `--success` no dark (hoje `160 84% 35%`) e usar
  `--danger` do dark (`0 62% 40%`) só como fundo, com o texto em uma variante clara — hoje o
  literal `red-600` ignora completamente o tema.

---

### [ALTO] FIN-05: transferência que deixa a conta negativa é um beco sem saída

- **Tela**: `/financeiro/contas` › diálogo Transferência (1440, claro, owner)
- **Evidência**: origem "Santander" (saldo 0), destino "Conta Digital", R$ 100,00 →
  HTTP `400 {"message":"Esta transferência deixa \"Santander\" com saldo negativo (-R$ 100,00).
  Confirme para continuar."}`. O toast repete a frase (bom), mas a varredura do diálogo por
  qualquer controle de confirmação (`/confirmar|autorizo|permitir saldo negativo/i` ou
  `input[type=checkbox]`) devolve **false**: não há o que confirmar. O usuário só pode desistir.
  Screenshot: `contas-transfer-confirme-para-continuar.png`.
  A API aceita o campo: `TransferBetweenAccountsDto.allowNegativeBalance`
  (`apps/api/src/modules/financial/dto/transfer.dto.ts`), consumido em
  `financial-accounts.service.ts:319`.
- **Esperado**: "Before adding a screen, diff its `*QueryDto` against the panel" e "Anticipate
  the error when the screen already knows" (`CLAUDE.md` › Filters / Error Handling). O diálogo
  recebe `accounts` com `balance` — ele sabe o saldo antes de submeter e mostra `false` para
  qualquer valor monetário na tela (medido).
- **Arquivo**: `app/(dashboard)/financeiro/contas/_components/transfer-dialog.tsx:35-46`
  (schema sem o campo), `:85-102` (submit), `:134-138` (select de origem).
- **Correção**: exibir o saldo da conta de origem ao lado do select; quando
  `valor > saldo` e o tipo não é `CASH`, mostrar o aviso antes do submit e um checkbox
  "Autorizo deixar a conta negativa" que envia `allowNegativeBalance: true`. Para `CASH`,
  bloquear o submit com a mensagem específica (a API nunca aceita).

---

### [ALTO] FIN-06: período invertido — a tela avisa, mas mostra 236 registros de um período trocado

- **Tela**: `/financeiro/lancamentos` (1440, claro, owner), De = 31/12/2026, Até = 01/01/2026
- **Evidência**: o aviso "A data final deve ser posterior à inicial." aparece e o input ganha
  `aria-invalid="true"` + `border-destructive` (`rgb(220,40,40)`) — FN-23 cumprido. **Mas** a
  consulta é disparada assim mesmo: `GET /financial-entries?page=1&limit=20&startDate=2026-12-31
  &endDate=2026-01-01` → `200 total=235`, 20 linhas na tela, rodapé "Mostrando 1-20 de 235
  registros" e os cards recalculados para **R$ 18.438,10 / R$ 17.351,35 / R$ 1.086,75**. A API
  **inverte o intervalo em silêncio** (`apps/api/src/common/utils/date-range.util.ts:120-122`
  faz `[start, end] = [end, start]`), então o usuário lê os números de 01/01→31/12 achando que
  são de um filtro que a própria tela acabou de declarar inválido. Confirmado por curl:
  `startDate=2026-12-31&endDate=2026-01-01` → 236 registros; `endDate=2026-01-01` sozinho → 0.
  Screenshot: `lancamentos-periodo-invertido.png`.
- **Esperado**: "Period filters must flag an inverted range with `isInvertedRange` (FN-23)" — e
  sinalizar sem impedir a leitura errada é meio caminho. Uma tela não pode exibir um erro de
  filtro e um total ao mesmo tempo.
- **Arquivo**: `app/(dashboard)/financeiro/lancamentos/_components/entries-filters.tsx:32`
  (calcula, mas não informa a página) e `app/(dashboard)/financeiro/lancamentos/page.tsx:128-135`
  (`useFinancialEntries(filters)` sem guarda).
- **Correção**: levantar `isInvertedRange` para a página e usar `enabled: !invertido` na query,
  substituindo tabela e cards por um estado "Corrija o período para ver os lançamentos". (Vale
  abrir um item para a API também: reordenar o intervalo em silêncio é a fonte do dado errado.)

---

### [ALTO] FIN-07: saldo negativo de conta é exibido igual a um saldo positivo

- **Tela**: `/financeiro/contas` (1440, claro e escuro, owner)
- **Evidência**: a linha "Banco do Brasil" tem saldo `-R$ 290,00` e a célula é pintada com
  `color: rgb(15,23,41)` — exatamente `--foreground`, o mesmo cinza-escuro de `R$ 8.098,00`.
  `--danger` resolve para `rgb(220,40,40)`. A célula também não tem `nowrap`
  (`white-space: normal`) e o valor é formatado com `Number(...).toLocaleString` em vez de
  `formatCurrency`. Screenshot: `contas-1440-light.png` (1ª linha).
- **Esperado**: pedido explícito do ciclo — "valor negativo/positivo tem que usar
  `danger`/`success`" — e "monetary columns use `nowrap` so 'R$ 89,90' never becomes 'R$ 89'
  (VD-13)" (`CLAUDE.md` › Responsive and tables).
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:310-315`.
- **Correção**: `<td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">` com
  `<span className={Number(a.balance) < 0 ? "text-danger" : undefined}>{formatCurrency(...)}</span>`.

---

### [ALTO] FIN-08: badge `destructive` reprova AA no dark (2,66:1) — é o badge de "Vencido" e "Despesa"

- **Tela**: `/financeiro/lancamentos` (1440, **dark**, owner)
- **Evidência**: `measure(page).lowContrast` →
  `{el: 'div.inline-flex…"Despesa"', ratio: 2.66, required: 4.5, color: 'rgb(165,39,39)',
  bg: 'rgb(12,15,24)', fontSize: '12px'}`. O mesmo variante pinta o status "Vencido", que é a
  informação mais crítica da tela. Screenshot: `lancamentos-1440-dark.png`.
- **Esperado**: contraste AA 4,5:1 (`CLAUDE.md` › Acessibilidade); "Dark mode: toda tela precisa
  funcionar nos dois temas".
- **Arquivo**: `components/ui/badge.tsx:16` — `destructive: "bg-destructive/15
  text-destructive …"`, sem variante dark, enquanto `success` (`:20`) e `warning` (`:22`) têm
  `dark:text-emerald-400` / `dark:text-amber-400`.
- **Correção**: `dark:text-red-400` no padrão dos outros variantes, ou melhor, um token
  `--danger-fg-on-surface` claro no dark. Componente compartilhado — combinar com os outros
  agentes antes de mexer.

---

### [MÉDIO] FIN-09: botão só-ícone de editar conta sem tooltip e sem `aria-label`

- **Tela**: `/financeiro/contas`, coluna Ações (1440, claro, owner)
- **Evidência**: `{ariaLabel: null, title: null, innerText: "", hasSrOnly: false}` e, ao passar
  o mouse por 700 ms, `[role=tooltip], [data-radix-popper-content-wrapper]` → **0 elementos**.
  O botão é um lápis sem nome acessível nenhum.
- **Esperado**: "todo botão só-ícone precisa de tooltip ou `aria-label`" (BRIEFING / `CLAUDE.md`
  › Tooltip com retorno de requisição). A própria casa já faz certo em
  `data-table.tsx:516-527` (Tooltip **+** `aria-label`) e em
  `lancamentos/page.tsx:191-229` (Tooltip nos ícones de estornar/editar/excluir).
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:329-336`.
- **Correção**: envolver em `<Tooltip content="Editar conta">` e adicionar
  `aria-label="Editar conta"`.

---

### [MÉDIO] FIN-10: colunas de dinheiro do histórico de sessões sem `nowrap` e alinhadas à esquerda

- **Tela**: `/financeiro/caixa` › Histórico de sessões (1440, claro, owner)
- **Evidência**: primeira linha, célula "Saldo abertura" = `R$ 200,00` com
  `white-space: normal`, `text-align: start` e o wrapper `span.truncate` ativo. O mesmo para
  "Saldo fechamento" e "Diferença". Nenhuma das três colunas declara `nowrap` nem
  `className: "text-right"`.
- **Esperado**: "monetary columns use `nowrap` so 'R$ 89,90' never becomes 'R$ 89' (VD-13)" e
  alinhamento à direita, como já é feito em `lancamentos/page.tsx:154-163` (coluna Valor:
  `className: "text-right font-mono"`, `nowrap: true` — medido `white-space: nowrap`,
  `text-align: right`, correto).
- **Arquivo**: `app/(dashboard)/financeiro/caixa/_components/session-history.tsx:48-71`.
- **Correção**: `nowrap: true, className: "text-right tabular-nums",
  headerClassName: "text-right"` nas três colunas.

---

### [MÉDIO] FIN-11: fechamento e sangria não mostram o saldo que a tela já tem na mão

- **Tela**: `/financeiro/caixa` › diálogos "Fechar Caixa" e "Sangria" (1440, claro, owner)
- **Evidência**: o diálogo de fechamento contém apenas
  `"Fechar Caixa - QA Caixa Financeiro / Informe o saldo contado e observações. / Saldo Contado
  R$ / Observações / Cancelar / Fechar Caixa"` — `mostraValorMonetario: false`. Não há saldo
  esperado, não há diferença calculada: o operador digita o valor contado no escuro e só
  descobre a divergência depois, na coluna "Diferença" do histórico.
  No diálogo de Sangria, idem (`mostraSaldoDisponivel: false`); o saldo aparece só quando o
  backend recusa: toast `"Saldo insuficiente no caixa (disponível: R$ 2.428,90)"` — o número
  varia entre execuções porque outros agentes estão vendendo, o que é exatamente o motivo pelo
  qual o operador precisa vê-lo antes de digitar.
  Screenshots: `caixa-fechamento-sem-conferencia.png`, `caixa-sangria-sem-saldo.png`.
- **Esperado**: "Anticipate the error when the screen already knows… making the user discover it
  through a 409 is a choice, not a limitation" (`CLAUDE.md` › Error Handling). O dado existe:
  `useCashRegisterSession` devolve `totals.currentBalance` e é usado no
  `SessionDetailDialog` (`caixa/page.tsx:214-233`).
- **Arquivo**: `app/(dashboard)/financeiro/caixa/_components/cash-register-dialogs.tsx:226-301`
  (fechar) e `:312-388` (sangria/suprimento).
- **Correção**: carregar a sessão nos dois diálogos e exibir "Saldo do sistema: R$ X"; no
  fechamento, calcular e mostrar a diferença em tempo real (`success` quando 0, `danger` quando
  negativa, `warning` quando positiva), como pede a conferência de caixa.

---

### [MÉDIO] FIN-12: selects de conta ambíguos — duas opções "Banco do Brasil" e duas "Santander"

- **Tela**: `/financeiro/contas` › Transferência; também na baixa e no filtro de lançamentos
- **Evidência**: opções do select de origem, lidas do DOM:
  `["Banco do Brasil", "Banco do Brasil", "Caixa Principal", "Conta Digital", "Santander",
  "Santander", "Santanderr"]` — duplicadas: `["Banco do Brasil", "Santander"]`. São contas
  distintas (saldos −R$ 290,00 e R$ 0,00; R$ 0,00 e −R$ 250,00) e nada na opção permite
  distingui-las. A tabela ao lado mostra o código (`(BB)`, `(STD)`) que o select omite.
  Screenshot: `contas-transfer-select.png`.
- **Esperado**: um filtro/seletor "sobre algo registrado no sistema" tem que ser identificável
  (`CLAUDE.md` › Filters). Escolher a conta errada aqui move dinheiro.
- **Arquivo**: `app/(dashboard)/financeiro/contas/_components/transfer-dialog.tsx:134-138` e
  `:156-160`; `lancamentos/_components/settle-entry-dialog.tsx:133-137`;
  `lancamentos/_components/entries-filters.tsx:92-96`.
- **Correção**: rotular como `{a.code ? `${a.code} · ` : ""}${a.name}` e, na transferência,
  acrescentar o saldo (`— R$ 997,50`), que é o dado que o usuário precisa nesse instante.

---

### [MÉDIO] FIN-13: rótulos não associados aos campos em todos os diálogos do módulo

- **Tela**: diálogos de `/financeiro/contas`, `/financeiro/lancamentos` e `/financeiro/caixa`
- **Evidência**: no diálogo "Nova Conta", 8 `<label>` e 8 controles; **6 labels sem `for`** e
  **8 controles sem `id`, sem `aria-label` e sem `aria-labelledby`** (os 2 restantes são labels
  que envolvem o checkbox, aceitável). No diálogo de baixa, 2 labels soltos; no de fechamento,
  2. O `MoneyInput` — usado em transferência, baixa, abertura, fechamento, sangria e suprimento
  — renderiza `<label>` sem `for` e `<input>` sem `id`, então "Valor" nunca é anunciado.
- **Esperado**: "`<label>` associado" (`CLAUDE.md` › Acessibilidade).
- **Arquivo**: `components/forms/money-input.tsx:111-113` (e o `<input>` em `:118-136`);
  `app/(dashboard)/financeiro/contas/page.tsx:465, 474, 497, 508, 517, 526`;
  `caixa/_components/cash-register-dialogs.tsx:108, 113, 281, 373`;
  `lancamentos/_components/settle-entry-dialog.tsx:121`.
- **Correção**: `useId()` no `MoneyInput` (label `htmlFor` + input `id`) e o mesmo padrão nos
  diálogos, ou um componente `<Field label=…>` que faça o pareamento uma vez só.

---

### [MÉDIO] FIN-14: `DialogContent` sem `max-h`/scroll e sem raio abaixo de 640 px

- **Tela**: `/financeiro/contas` › "Nova Conta" (390×844, claro, owner)
- **Evidência**: `max-height: none`, `overflow-y: visible`, altura medida 746 px num viewport de
  844 (88 %) — ou seja, sem margem: basta abrir os três campos bancários com um erro de
  validação em cada para o rodapé sair da tela. E `border-radius: 0px`, porque o raio é
  `sm:rounded-lg` (≥ 640 px): a 390 px o diálogo é um retângulo reto enquanto os cards (12 px),
  inputs e botões (10 px) dentro dele são arredondados.
  Screenshot: `contas-dialog-390.png`.
- **Esperado**: "Dialogs: `max-h-[85vh]`, scrollable body, fixed footer. A dialog that grows
  without limit puts its own buttons out of reach (FN-14, AE-26)" (`CLAUDE.md`).
- **Arquivo**: `components/ui/dialog.tsx:38`.
- **Correção**: acrescentar `max-h-[85vh] overflow-y-auto rounded-lg` (raio incondicional) na
  base do `DialogContent`. Componente compartilhado — alinhar com os outros agentes.

---

### [MÉDIO] FIN-15: cards do dashboard e do financeiro não concordam (padding, gap e raio)

- **Tela**: `/` vs `/financeiro/lancamentos` (1440, claro, owner)
- **Evidência**: medido do DOM:

  | | Dashboard (KPICard) | Financeiro (TotalCard) |
  |---|---|---|
  | padding interno | **24 px** | **16 px** |
  | gap do grid | **20 px** | **16 px** |
  | colunas a 1440 | `lg:grid-cols-5` | `lg:grid-cols-4` |

  E o raio: `Card` = **12 px** (`rounded-xl`) enquanto `--radius` = 0,625rem = **10 px**, que é
  o que `Button`, `Input` e `SelectTrigger` (`rounded-lg`) usam e o `Badge` reduz para 8 px
  (`rounded-md`). `measure().inconsistentRadius` acusa o card nas duas telas medidas
  (`div.rounded-xl…"Vendas do DiaR$ 4.156,80"` e `…"ReceitasR$ 19.938,10"`, radius `12px`). A
  borda do card também é `border-border/60` (`rgba(229,231,235,0.6)`), não `border-border`.
- **Esperado**: "Padding de card, gap de grid e altura de controle têm que bater entre telas
  equivalentes"; "Card, input, botão, badge e dialog precisam concordar; borda sempre
  `border-border`" (BRIEFING / `CLAUDE.md`).
- **Arquivo**: `components/ui/card.tsx:12`; `components/charts/kpi-card.tsx:47` (`p-6`);
  `app/(dashboard)/financeiro/lancamentos/page.tsx:253` (`gap-4`) e `:345` (`p-4`);
  `app/(dashboard)/page.tsx:177` (`gap-5`).
- **Correção**: escolher um par (sugiro `p-5`/`gap-5`, ambos na escala de 4 px) e aplicar nos
  dois lados; `rounded-lg` no `Card` para casar com `--radius`, ou subir `--radius` para 12 px
  e ajustar os demais — o que não pode é a divergência.

---

### [MÉDIO] FIN-16: `StatusBadge` inteiro fora do design system (medido no Dashboard)

- **Tela**: `/` › "Pedidos Recentes" e "Pedidos por Status" (1440, claro e escuro)
- **Evidência**: `measure().hardcodedColors` lista 6 badges, cada um com 6 classes literais —
  ex.: "Concluído" → `bg-emerald-100 text-emerald-800 border-emerald-200 bg-emerald-900
  text-emerald-400 border-emerald-800`; idem purple, blue, red, orange, yellow.
- **Esperado**: "Cor só via token" (BRIEFING). Os **rótulos** já vêm de `@erp/constants`
  (AE-23 resolvido); as cores ficaram para trás.
- **Arquivo**: `components/ui/status-badge.tsx:14-29`.
- **Correção**: mapear os status para os variantes do `Badge` (`success`/`warning`/
  `destructive`/`secondary`) ou criar tokens de status em `globals.css`. Componente
  compartilhado com Vendas/Pedidos — coordenar.

---

### [MÉDIO] FIN-17: toast não é anunciado por leitor de tela

- **Tela**: todas as mutações do módulo (verificado nos toasts de erro de transferência e sangria)
- **Evidência**: o container é `<div class="fixed bottom-4 right-4 z-[100] …">` e cada item um
  `<div class="pointer-events-auto flex …">` — sem `role="status"`, `role="alert"` ou
  `aria-live`. O toast some sozinho em 4 s. Para quem usa leitor de tela, "Saldo insuficiente
  em 'Caixa Principal'…" nunca é anunciado, e o único feedback da ação some.
- **Esperado**: `aria-*` correto no feedback de requisição (`CLAUDE.md` › Acessibilidade +
  Tooltip com retorno de requisição).
- **Arquivo**: `components/ui/toast.tsx:71-91` (item) e `:119` (container).
- **Correção**: `aria-live="polite"` (ou `assertive` para `variant="error"`) e `role="status"`
  no container; considerar não expirar toasts de erro.

---

### [MÉDIO] FIN-18: dois diálogos não passam pelo `getMutationErrorMessage`

- **Tela**: `/financeiro/contas` › Transferência e `/financeiro/lancamentos` › baixa
- **Evidência**: ambos chamam `getApiErrorMessage(error) ?? "fallback"`. A diferença é o 5xx:
  `getMutationErrorMessage` troca `>= 500` pelo fallback amigável
  (`lib/mutation-error.ts:30-32`), o `getApiErrorMessage` cru devolve o que o backend disser —
  "Internal server error" ou pior. Os outros sete diálogos do módulo já usam o helper certo
  (contas `:438`, entry-form, cash-register-dialogs ×4, delete/edit/reverse).
- **Esperado**: "On error, **always** go through `getMutationErrorMessage`… A error toast without
  it does not pass code review" (`CLAUDE.md` › Error Handling).
- **Arquivo**: `app/(dashboard)/financeiro/contas/_components/transfer-dialog.tsx:98`;
  `app/(dashboard)/financeiro/lancamentos/_components/settle-entry-dialog.tsx:91`.
- **Correção**: trocar pelas chamadas a `getMutationErrorMessage(err, "…")`.

---

### [MÉDIO] FIN-19: texto sem acento na tela de contas (FN-27)

- **Tela**: `/financeiro/contas` (1440, claro, owner)
- **Evidência**: varredura do `innerText` renderizado encontrou **"bancarias"** (subtítulo
  "Gerencie suas contas bancarias e caixas") e **"Nao"** (coluna Venda Direta, 8 linhas). No
  diálogo: **"Codigo interno"** e **"Agencia"**. Screenshot: `contas-1440-light.png`.
- **Esperado**: "Ship user-facing text without accents: 'Metodos', 'Condicoes', 'obrigatorio'
  (FN-27)" está na lista de **Do NOT** do `CLAUDE.md`.
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:135` ("bancarias"), `:320` ("Nao"),
  `:497` ("Codigo interno"), `:517` ("Agencia").
- **Correção**: "bancárias", "Não", "Código interno", "Agência".

---

### [BAIXO] FIN-20: `--muted-foreground` fica 0,01 abaixo do mínimo AA sobre `--background`

- **Tela**: todas (medido em `/` e `/financeiro/*`, 1440, claro)
- **Evidência**: `measure().lowContrast` →
  `p.text-muted-foreground "Visão geral do seu negócio"`, `ratio: 4.49`, `required: 4.5`,
  `rgb(101,117,139)` sobre `rgb(249,250,251)`. Sobre `--card` (branco) o mesmo texto passa.
  Vale para todo subtítulo de página do módulo.
- **Esperado**: contraste AA 4,5:1.
- **Arquivo**: `app/globals.css:26` (`--muted-foreground: 215 16% 47%`).
- **Correção**: escurecer para `215 16% 44%` (≈ 5,1:1) — muda pouco visualmente e resolve
  o sistema inteiro. Token global: coordenar com os outros agentes.

---

### [BAIXO] FIN-21: tooltip do gráfico com espaço antes dos dois-pontos

- **Tela**: `/` › "Vendas do Período" (1440, claro, owner)
- **Evidência**: hover no gráfico → `"30/07/2026 Vendas : R$ 0,00"` (separador padrão do
  recharts, `" : "`). Fora isso o tooltip está correto: data completa em pt-BR, valor via
  `formatCurrency`, fundo `rgb(255,255,255)` = `--card`, borda `rgb(229,231,235)` = `--border`,
  raio 10 px = `--radius`.
- **Esperado**: pontuação pt-BR ("Vendas: R$ 0,00").
- **Arquivo**: `app/(dashboard)/page.tsx:253-257` (o `<Tooltip>` do `AreaChart`).
- **Correção**: `separator=": "` no `<Tooltip>` (idem no `BarChart`, `:372`).

---

### [BAIXO] FIN-22: "Novo Lançamento" usa `<input type="number">` para o valor, o resto do módulo usa `MoneyInput`

- **Tela**: `/financeiro/lancamentos` › Novo Lançamento
- **Evidência**: `<Input type="number" step="0.01" min="0" {...register("amount")} />`, sem
  máscara e sem o prefixo "R$", enquanto transferência, baixa, abertura, fechamento, sangria e
  suprimento usam `MoneyInput` (digitação em centavos, alinhado à direita, prefixo R$).
- **Esperado**: consistência de controle entre telas equivalentes (BRIEFING › espaçamento e
  altura de controle; `CLAUDE.md` › Input Masks).
- **Arquivo**: `app/(dashboard)/financeiro/lancamentos/_components/entry-form-dialog.tsx:148-157`.
- **Correção**: trocar por `<MoneyInput name="amount" control={control}
  label="Valor *" error={errors.amount?.message} />`.

---

### [BAIXO] FIN-23: coluna Saldo em `font-mono` enquanto o resto do sistema usa `tabular-nums`

- **Tela**: `/financeiro/contas` (1440)
- **Evidência**: célula de saldo com `class="px-4 py-3 text-right font-mono"`; a coluna Valor
  dos lançamentos usa `font-mono` também, mas o dashboard usa `tabular-nums`
  (`page.tsx:330, 383`). Visualmente são duas famílias diferentes para a mesma informação —
  compare `contas-1440-light.png` com `dashboard-1440-light.png`.
- **Esperado**: consistência tipográfica entre telas equivalentes.
- **Arquivo**: `app/(dashboard)/financeiro/contas/page.tsx:310`;
  `app/(dashboard)/financeiro/lancamentos/page.tsx:155`.
- **Correção**: padronizar em `tabular-nums` (mantém a fonte do produto e alinha os dígitos).

---

### [BAIXO] FIN-24: nenhum dos 9 formulários do módulo passa `onInvalid` ao `handleSubmit`

- **Tela**: todos os diálogos de `/financeiro/*`
- **Evidência**: `grep 'handleSubmit(' app/(dashboard)/financeiro` → 9 ocorrências, todas
  `handleSubmit(onSubmit)`. O hook `hooks/use-invalid-submit.ts` existe e é usado em
  `app/convite/[token]/page.tsx:76`, `clientes/[id]/_components/address-form-dialog.tsx:98`,
  `estoque/movimentacoes/_components/entry-exit-form.tsx:84` — o módulo financeiro ficou de
  fora. Na prática hoje não há campo órfão (verifiquei: valor zero na baixa mostra
  "Valor deve ser maior que zero" e "Conta obrigatória"), então é rede de segurança, não bug
  aberto.
- **Esperado**: "Pass `onInvalid` to `handleSubmit` as a safety net" (`CLAUDE.md` › Form
  validation).
- **Arquivo**: `contas/page.tsx:460`; `contas/_components/transfer-dialog.tsx:119`;
  `caixa/_components/cash-register-dialogs.tsx:104, 200, 276, 368`;
  `lancamentos/_components/entry-form-dialog.tsx:126`, `settle-entry-dialog.tsx:110`,
  `edit-entry-dialog.tsx:118`.
- **Correção**: `const onInvalid = useInvalidSubmit();` e `handleSubmit(onSubmit, onInvalid)`.

---

## Como reproduzir

```bash
cd /Users/mac/work/erp/apps/web
npx playwright test -c qa-audit/playwright.qa.config.ts qa-audit/financeiro.spec.ts \
  --reporter=list --output=qa-audit/artifacts/fin
```

Cada medição citada acima sai no log com o prefixo `[FIN-…]`, com o mesmo número do achado.
Os testes de estado de erro (`FIN-02`, `FIN-03`) têm `expect` que **falha** quando o bug for
corrigido — são a regressão pronta.

Duas observações sobre a execução: o servidor é o mesmo para os seis agentes deste ciclo, então
a suíte varia de ~5 a ~12 min e a primeira visita a uma rota pode levar mais de 30 s (compilação
do Next em dev) — por isso cada teste espera o título da página antes de medir. E o estado do
caixa foi conferido pela API antes e depois: `QA Caixa Financeiro` permanece `OPEN`, com o mesmo
saldo de abertura.

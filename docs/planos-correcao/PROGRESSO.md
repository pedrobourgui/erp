# Progresso da implementação

Atualizado em 03/08/2026. Base: `feat/scrum-backlog-afazer` @ `c7c5568`. **Nada commitado** — tudo em
working tree.

**Os 11 lotes estão concluídos.**

| Lote | Status | Observação |
|---|---|---|
| 1 — Parada de linha | ✅ **Concluído** | 5/5 bugs corrigidos, testados e verificados no app rodando |
| 2 — Ciclo de vida do pedido | ✅ **Concluído** | 11/11 bugs; 19/19 checagens verdes no app rodando |
| 3 — Datas e fuso | ✅ **Concluído** | 5/5 bugs + TZ-01; 8/8 checagens; suíte verde em 3 fusos |
| 4 — Autorização e sessão | ✅ **Concluído** | 6/6 bugs; 27 checagens na UI + 24 na API; **suíte web 100% verde** |
| 5 — Integridade financeira | ✅ **Concluído** | 12/12 bugs + 2 achados da conciliação; 73 checagens na API rodando |
| 6 — Validações de domínio | ✅ **Concluído** | 13/13 bugs; 34 checagens (API + UI); varredura fechou 5 formulários mudos |
| 7 — Erros e contratos | ✅ **Concluído** | 7/7 bugs; 22 checagens; 19 toasts mudos e 71 mensagens em inglês corrigidos |
| 8 — Funcionalidades ausentes | ✅ **Concluído** | 8/8 bugs; 130 checagens no app rodando; checklist de saída zerado |
| 9 — UI e responsividade | ✅ **Concluído** | 13/13 bugs; 19 checagens; 16 rotas verificadas em 390×844 |
| 10 — Rede de proteção | ✅ **Concluído** | 64 testes E2E em 8 jornadas + CI; achou 1 bug crítico novo (VD-10 no backend) |
| 11 — Filtros por entidade | ✅ **Concluído** | 11/11; 2 filtros que **nunca funcionaram** e 16 ausentes; 22 E2E novos |

---

## Lote 1 — concluído

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **AE-00** white-screen em `/estoque/movimentacoes` | `MovementType` completado com `RETURN` e `PRODUCTION` (o tipo do front tinha 4 dos 6 valores do enum Prisma); badges "Devolução"/"Produção"; fallback `?? fallbackTypeConfig` para qualquer tipo futuro; error boundary do dashboard | `hooks/use-inventory.ts`, `estoque/movimentacoes/page.tsx`, `app/(dashboard)/error.tsx` (novo) |
| **AE-01** `MoneyInput` grava valor errado | Componente reescrito: exibe `""` no zero (placeholder volta a aparecer), caret forçado ao fim em `focus`/`click`/re-render, `parseInputToNumber` exportado e testável, limite de 15 dígitos, prop `allowNegative` | `components/forms/money-input.tsx` |
| **AE-03** login sem mensagem de erro | Rotas de auth excluídas do fluxo de refresh (`AUTH_ROUTES`); sem redirect quando já se está em `/login` | `lib/api.ts` |
| **VD-03** troca em pedido cancelado | `assertOrderMutable()` compartilhado, aplicado no use-case de troca; mensagem em pt-BR; botão "Trocar" escondido em status terminal | `orders/order-status.rules.ts` (novo), `exchange-order-item.use-case.ts`, `vendas/pedidos/[id]/page.tsx` |
| **VD-04** PDV não envia desconto | `discount` adicionado a `CreateOrderPayload` e ao submit do balcão; validação de desconto ≤ subtotal no zod | `hooks/use-orders.ts`, `vendas/balcao/page.tsx` |

Verificação no app rodando: 10/10 (script `scratchpad/qa/verify-lote1.js` da sessão anterior).
A jornada do PDV com desconto (VD-04) ficou sem confirmação na UI naquele ciclo — **foi coberta agora**,
junto com o lote 2 (o PDV é exercitado de ponta a ponta no `verify-lote2.js`).

---

## Lote 2 — concluído

### Trabalho estrutural feito antes dos bugs

1. **Pacotes do workspace passaram a ser usáveis em runtime.** `transpilePackages` no `next.config.js`,
   dependências `@erp/constants` / `@erp/shared-types` / `@erp/validators` declaradas em
   `apps/web/package.json`, alias no `vitest.config.ts` e `moduleNameMapper` no `jest.config.ts`.
   Os pacotes agora compilam para `dist/` em **CommonJS** (`main` → `dist/index.js`, `types` → `src`)
   e `turbo.json` ganhou `dev: dependsOn ["^build"]`.
   **Por que CommonJS:** com `module: ESNext` o `dist` saía em ESM e a API (CJS) quebrava com
   `ERR_REQUIRE_ESM` ao resolver o `zod` do `@erp/validators`. Isso derrubou a API em runtime durante a
   implementação — é o tipo de erro que só aparece com o app de pé.
2. **Máquina de estados com fonte única.** `ORDER_STATUS_TRANSITIONS` agora existe **apenas** em
   `packages/constants`, com `getAllowedTransitions`, `canTransition`, `TERMINAL_ORDER_STATUSES`,
   `ORDER_STATUSES` e `ORDER_STATUS_LABELS`. A cópia de `orders.service.ts` foi apagada e a do front
   também; a divergência `SHIPPED → RETURNED` foi resolvida a favor do serviço (`SHIPPED → DELIVERED`),
   que é o que o plano documenta como máquina real.
3. **Aritmética de dinheiro compartilhada.** `packages/validators/src/order-money.ts` (novo):
   `calculateItemTotal`, `maxItemDiscount`, `calculateOrderTotals`, `splitInstallments`,
   `installmentDueDates`, `roundMoney`. Usada pela API (criação de pedido e geração de recebíveis) e
   pelo front (carrinho, resumo e preview de parcelas) — é o fim da divergência tela × back.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **VD-01** cancelar não estorna | `useCancelOrder()` aponta para `PATCH /orders/:id/cancel` com motivo obrigatório; `useUpdateOrderStatus` não aceita mais `CANCELLED` (nem em tipo); **`updateStatus()` delega internamente para `cancel()`** para o caminho errado deixar de existir; invalida `products`, `inventory` e `financial-entries` | `orders.service.ts`, `hooks/use-orders.ts`, `components/orders/status-actions.tsx` |
| **VD-02** ciclo travado em "Separando" | `GET /orders` e `GET /orders/:id` devolvem `allowedTransitions`; a UI renderiza os botões a partir dela (`lib/order-status-actions.ts`), incluindo "Marcar como Embalado", "Concluir Pedido" e "Registrar Devolução"; ações rápidas da listagem usam o mesmo componente | `orders.service.ts`, `lib/order-status-actions.ts`, `components/orders/status-actions.tsx`, `vendas/pedidos/page.tsx` |
| **VD-05** parcelamento ignorado | O front deixou de enviar `installments: 1` fixo; a API passou a **sempre** derivar as parcelas da condição; recebíveis usam `splitInstallments` (soma exata) e `installmentDueDates`; preview "3x de R$ 63,27 · vencimentos em 30/60/90 dias" na linha de pagamento; coluna "Parcela" (`1/3`) na aba Financeiro | `orders.service.ts`, `order-events.handler.ts`, `payment-line.tsx`, `payment-selector.tsx`, `finance-tab.tsx` |
| **VD-06** contrato do detalhe | `order.shipping.*` → campos na raiz (`shippingCost`, `shippingMethod`, `trackingCode`, `shippedAt`…) e `order.history` → `statusHistory`; o tipo agora vem de `@erp/shared-types` em vez de redigitado; timeline renderiza `de → para`, data/hora e **nome** do usuário (a API resolve `changedBy`, que é um id solto); rodapé dos itens mostra subtotal − desconto + frete = total | `packages/shared-types`, `orders.service.ts`, `_components/shipping-tab.tsx`, `_components/history-tab.tsx`, `_components/items-tab.tsx` |
| **VD-08** troco no PDV | `lib/payment-settlement.ts` (novo) separa *o que o cliente entregou* de *o que é cobrado*: dinheiro pode exceder o total, o excedente vira troco e **não** é enviado à API; o zod passou a validar por `isSettled`; barra de pagamentos mostra "Troco" em verde e erro só quando a sobra não é dinheiro | `lib/payment-settlement.ts`, `payment-selector.tsx`, `balcao/page.tsx`, `novo/page.tsx` |
| **VD-10** desconto por item | Desconto limitado ao valor da linha no zod, com mensagem (`O desconto não pode passar de R$ X`), e cálculo de tela idêntico ao do backend via `@erp/validators` | `balcao/page.tsx`, `novo/page.tsx`, `orders.service.ts` |
| **VD-12** quantidade 0/negativa | Zod com `int()` + `min(1)` em pt-BR e **erro renderizado na linha** (antes o submit era bloqueado em silêncio) | `balcao/page.tsx`, `novo/page.tsx` |
| **VD-14** estorno e devolução | `ReverseSaleUseCase` + `POST /orders/:id/reverse`: devolve estoque (`RETURN`/`RETURN_CUSTOMER`), cancela títulos em aberto, gera **contas a pagar** do valor já pago e **sangria na sessão de caixa**, tudo em uma transação, com motivo e usuário no histórico. Política de prazo: venda de balcão só é estornável **enquanto a sessão de caixa dela estiver aberta**. `RETURNED` na UI passa por esse endpoint (não por `PATCH /status`) | `use-cases/reverse-sale.use-case.ts` (novo), `dto/reverse-sale.dto.ts` (novo), `orders.controller.ts`, `hooks/use-orders.ts`, `status-actions.tsx` |
| **VD-17** toast genérico | `getApiErrorMessage(error)` no catch das transições | `components/orders/status-actions.tsx` |
| **VD-20** aviso de estoque | `qty > stock && stock > 0` → `qty > stock` (produto zerado voltou a alertar) | `novo/page.tsx` |
| **VD-21** estoque congelado | `lib/stock-snapshot.ts` (novo): revalida o saldo no `onBlur` da quantidade e **de todos os itens no submit**, bloqueando a venda com mensagem se o saldo mudou | `lib/stock-snapshot.ts`, `balcao/page.tsx`, `novo/page.tsx` |

### Refatoração de arredores

`vendas/pedidos/[id]/page.tsx` tinha 847 linhas (limite do `CLAUDE.md` é 300). Como o lote mexia em
quase tudo, as abas viraram componentes: `_components/{items,customer,shipping,finance,history}-tab.tsx`
e o `StatusActions` foi para `components/orders/` porque a listagem usa o mesmo.

### Testes

- **API**: 33 suítes / **640 testes** verdes (eram 595 no fim do lote 1). Novos: delegação de
  `updateStatus → cancel`, `allowedTransitions` por status, nome do autor na timeline, 3x com soma
  exata e vencimentos a 30/60/90, e 22 casos do `ReverseSaleUseCase`.
- **Web**: **236 testes**, 209 passando. As **27 falhas são as mesmas de antes das minhas mudanças**
  (`data-table`, `confirm-dialog`, `toast` e um caso de `formatCurrency(NaN)`) — baseline confirmado no
  lote 1 e inalterado. Novos arquivos: `lib/order-money.test.ts` (16), `lib/payment-settlement.test.ts`
  (7), `lib/stock-snapshot.test.ts` (6), `lib/order-status-actions.test.ts` (11) e 6 casos novos em
  `hooks/use-orders.test.ts`.
- `next build` e `nest build` verdes com os pacotes do workspace importados em runtime.

### Verificação no app rodando (Playwright, 19/19)

Script: `scratchpad/qa/verify-lote2.js` · evidências: `scratchpad/qa/shots/lote2/`

```
PASS VD-06 card de frete mostra R$ 10,00
PASS VD-06 aba Histórico renderiza a timeline
PASS VD-05 3 parcelas com soma exata · 66.6 + 66.6 + 66.6 = 199.8
PASS VD-05 parcelas 1/3, 2/3 e 3/3 visíveis na aba Financeiro
PASS VD-02 ciclo PENDING→COMPLETED inteiro pela UI
PASS VD-02 baixa efetiva em SHIPPED · EXIT/SALE 10->11, estoque 578->576
PASS VD-01 motivo do cancelamento é obrigatório
PASS VD-01 pedido cancelado pela UI
PASS VD-01 reserva liberada · 575 -> 576
PASS VD-01 recebíveis cancelados
PASS VD-08 troco exibido no PDV
PASS VD-08 venda de balcão com troco foi registrada
PASS VD-08 pagamento gravado = total (troco não virou receita) · 89.9 = 89.9
PASS VD-14 ação "Estornar Venda" disponível na venda de balcão
PASS VD-14 venda estornada (RETURNED)
PASS VD-14 estoque devolvido · 575 -> 576
PASS VD-14 devolução do valor pago em contas a pagar · R$ 89.9
PASS VD-14 estorno duplicado não é oferecido
PASS nenhum pageerror durante o roteiro
```

**Não exercitado na UI** (coberto só por teste de unidade): VD-10 (mensagem de desconto acima do item),
VD-12 (mensagem de quantidade) e VD-20/VD-21 (aviso e revalidação de estoque). Vale um roteiro curto de
formulário no lote 10.

### Decisões que fogem da letra do plano

1. **Sobra de centavos na última parcela, não na primeira.** O passo 4 do item 2.3 pede a sobra na
   primeira parcela, mas o próprio critério de aceite do plano exemplifica `63,27 / 63,27 / 63,26` —
   sobra na última. Segui o critério de aceite (e é o que o código já fazia). O invariante testado é o
   que importa: a soma das parcelas é sempre exatamente o total.
2. **Sem seletor de número de parcelas.** O plano pede um seletor limitado a `maxInstallments`, mas o
   modelo não tem esse campo: `PaymentCondition.installments` é um número fixo — a condição **é** a
   escolha ("3x sem juros" = 3). Em vez do seletor, a condição passou a ditar as parcelas e a linha
   mostra o preview do que será gerado.
3. **Troco não é persistido.** O valor recebido acima do total não é gravado: a API recebe o valor
   cobrado (= total), que é o que entra no caixa. Registrar um movimento só do troco desequilibraria a
   sessão. Guardar "quanto o cliente entregou" exige uma coluna nova em `OrderPayment` — fica como
   pendência para o lote 5.
4. **`orders:cancel`** continua não sendo exigido pelo `/cancel` nem pelo `/reverse` (ambos usam
   `orders:update`), conforme o plano, que joga a permissão para o lote 4.

---

## Achados novos do lote 2

1. **`GET /inventory/movements` não expõe `referenceId`.** O DTO da listagem (`toMovementDto`) descarta
   o campo, então não há como amarrar um movimento ao pedido pela tela de movimentações — a verificação
   teve que ser feita por contagem. Candidato natural ao lote 7 (contratos de API).
2. **Métodos de pagamento imediatos sem conta vinculada bloqueiam a venda** (regra correta, SCRUM-30),
   e o seed **não** vincula conta ao "Dinheiro". Numa base recém-semeada o PDV não fecha nenhuma venda
   até alguém configurar isso em Configurações > Métodos de Pagamento. O seed deveria já entregar o
   método padrão vinculado — vale um item no lote 8 ou uma correção direta no seed.
3. **`npm run db:seed` não limpa a base.** Rodar o seed sobre uma base usada acumula duplicatas
   (três "Dinheiro", cinco contas financeiras, produtos de QA). Para um ciclo de QA limpo é preciso
   `prisma migrate reset` ou um truncate antes.

---

## Lote 3 — concluído

### A ideia central

O sistema guardava duas coisas diferentes na mesma coluna `DateTime` e as tratava como uma só:

| Natureza | Exemplos | Regra adotada |
|---|---|---|
| **Instante** | `createdAt`, `paidAt`, `shippedAt` | UTC no banco, convertido para o fuso de quem lê |
| **Data civil** | `dueDate`, filtros De/Até, data do lançamento | meia-noite **no fuso do tenant** |

Tudo passa por `apps/api/src/common/utils/date-range.util.ts` (novo), construído sobre `Intl` — sem
dependência nova e ciente de horário de verão. **`setHours` está proibido** para esse fim: ele usa o
fuso do *processo*, não o do tenant, e era a causa direta de FN-01 e VD-09.

Funções: `toDateRange`, `startOfDayInTz`, `endOfDayInTz`, `parseUserDate`, `civilDaysFrom`,
`civilInstallmentDueDates`, `toLocalDateKey`, `shiftDateKey`.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **FN-01** filtro descarta o último dia | `buildDateRange` passou a usar `toDateRange`; o fim do período é 23:59:59.999 **no fuso do tenant**, não 02:59 UTC | `financial-entries.service.ts` |
| **VD-09** filtro "hoje" retorna 0 | `lte: new Date(dateTo)` era a meia-noite que *inicia* o último dia — todo pedido do dia ficava depois dela. Mesmo `toDateRange` em pedidos e em movimentações de estoque | `orders.service.ts`, `inventory.service.ts` |
| **FN-02** datas exibem 1 dia a menos | Gravação: `startOfDayInTz` para a data e o vencimento do lançamento, `parseUserDate` para baixa e transferência, `civilDaysFrom`/`civilInstallmentDueDates` para os vencimentos derivados de "agora". Exibição: `formatDate` (data civil, lida como escrita) separado de `formatDateTime` (instante, no fuso do leitor) | `financial-entries.service.ts`, `financial-settlements.service.ts`, `financial-accounts.service.ts`, `order-events.handler.ts`, `exchange-order-item.use-case.ts`, `web/lib/utils.ts` |
| **FN-23** período invertido | `isInvertedRange` no front com mensagem "A data final deve ser posterior à inicial", `min`/`max` nos inputs e borda vermelha — nos três filtros de período (lançamentos, pedidos, movimentações). No backend, `toDateRange` inverte os extremos por segurança | `lib/utils.ts`, `entries-filters.tsx`, `vendas/pedidos/page.tsx`, `estoque/movimentacoes/page.tsx` |
| **AE-22** eixo em formato ISO | Ticks em `dd/MM` e tooltip em `dd/MM/yyyy` via `formatDate` | `app/(dashboard)/page.tsx` |

### Além do plano

1. **TZ-01 fechado de verdade.** O `reports.service.ts` ainda montava "hoje" e a janela do gráfico com
   `getFullYear()/getMonth()/getDate()`, que leem o fuso do **processo**. Passava no meu laptop (BRT) e
   quebraria num deploy em UTC — o padrão de qualquer container. Agora usa `toLocalDateKey` +
   `shiftDateKey` com o fuso do tenant, e a série do gráfico é montada por dias civis em vez de somas de
   24 h (que erram o dia quando há mudança de horário de verão no meio da janela).
2. **`installmentDueDates` removida de `@erp/validators`.** Ela era cega a fuso e produzia vencimentos
   com a hora da venda: uma venda às 23:50 gerava vencimento "30 dias depois às 23:50", que lido como
   data civil já é o dia seguinte. Substituída por `civilInstallmentDueDates`, que ancora todo
   vencimento na meia-noite do dia civil. Sem isso, a correção de exibição do FN-02 teria *introduzido*
   um deslocamento nos títulos de pedido parcelado.
3. **Default "hoje" do formulário de lançamento.** Usava `new Date().toISOString().slice(0,10)` — o dia
   em UTC. Depois das 21h em BRT o formulário abria com a data de amanhã. Agora usa `todayDateKey()`.
4. **Teste obsoleto de `formatCurrency(NaN)` corrigido.** Ele exigia "R$ NaN" na tela; o
   `formatCurrency` foi endurecido no lote 1 para cair em zero e o teste ficou para trás. Era 1 das 27
   falhas do baseline do front — agora são 26.

### Testes

- **API**: **672 testes verdes**, rodados em `America/Sao_Paulo`, `UTC` e `Asia/Tokyo` (eram 640).
  Novos: 27 casos do `date-range.util`, além de regressões de intervalo em pedidos, lançamentos e
  movimentações.
- **Web**: **244 testes**, 218 passando, também nos três fusos. As 26 falhas restantes são o baseline
  pré-existente (`data-table`, `confirm-dialog`, `toast`).
- `npm run test:tz` (raiz, API e web) roda a suíte nos três fusos. **O CI ainda não existe** — não há
  `.github/workflows` no repositório —, então o item "rodando no CI" do checklist depende do lote 10.

### Verificação no app rodando (Playwright, 8/8)

Script: `scratchpad/qa/verify-lote3.js` · evidências: `scratchpad/qa/shots/lote3/`

O roteiro rodou às **22h50 de BRT — já 01/08 em UTC**, que é exatamente a janela em que essa família de
bugs aparece:

```
tenant today: 2026-07-31 | UTC today: 2026-08-01
PASS FN-02 vencimento gravado no dia digitado · 2026-01-15T03:00:00.000Z
PASS FN-02 tela mostra 15/01/2026 (não 14/01)
PASS FN-23 período invertido é criticado
PASS FN-01 filtro do dia inteiro traz os lançamentos do dia · 11 no filtro
PASS FN-01 intervalo de um único dia é estável
PASS VD-09 filtro "hoje" em pedidos traz os pedidos de hoje · 25 de 25
PASS AE-22 eixo do gráfico em dd/MM
PASS nenhum pageerror durante o roteiro
```

### O que ficou de fora, de propósito

**A migração para `@db.Date`** (passo 2, alternativa do item 3.2). O plano a recomenda porque tornaria a
classe de erro impossível por construção, e concordo com o raciocínio — mas ela exige `prisma migrate`
sobre colunas com dados, e as datas hoje gravadas estão em meia-noite **UTC** (dado sujo do próprio
bug). Converter sem um passo de *backfill* deslocaria os vencimentos existentes em um dia. A migração +
backfill é um item de meio dia que cabe melhor no lote 5, que já vai mexer em vencimento e OVERDUE.
Enquanto isso, a normalização na escrita entrega o mesmo comportamento visível.

---

## TZ-01 — achado do lote 1, fechado no lote 3

**Severidade: Alto.** `buildSalesTrend` (`reports.service.ts`) montava os buckets a partir da
**meia-noite local** e chaveava os pedidos com `toISOString()` (**UTC**). Em UTC-3, toda venda feita
**depois das 21h** caía num dia UTC sem bucket correspondente e **sumia do gráfico e do sparkline do
dashboard**. Corrigido com `toLocalDateKey()` e coberto por um teste com `jest.setSystemTime(23:30
local)`. Marcado com `TODO(lote 3)` para migrar ao helper de fuso do tenant quando ele existir.

**Resolvido no lote 3:** a varredura confirmou que a família era maior do que os 5 bugs mapeados — o
próprio `reports.service.ts` ainda dependia do fuso do processo. Hoje não há mais `setHours` nem
`toISOString().slice(0,10)` em código de data no backend.

---

---

## Lote 4 — concluído

### Trabalho estrutural feito antes dos bugs

**A matriz de permissões passou a ter fonte única.** `@erp/constants` exportava um conjunto
**inventado** (`roles:create`, `warehouses:read`, `reports:financial`) que nada consumia, enquanto o
modelo real — o que o seed grava e o `PermissionsGuard` lê — é outro (`financial:read`,
`reports:read`, `settings:update`…). Qualquer gating de frontend construído sobre a lista dos
constants checaria permissões que **não existem no banco**: a UI esconderia telas de quem tem
acesso. É a mesma classe de divergência que gerou o VD-02 no lote 2.

Agora `packages/constants/src/permissions.ts` é a fonte: `PERMISSIONS`, `PERMISSION_DESCRIPTIONS`,
`ROLE_DEFINITIONS`, `getRolePermissions()` e `hasPermission()`. O seed importa de lá em vez de
redigitar, e `role-permissions.spec.ts` **lê os controllers** e falha se algum `@RequirePermissions`
exigir permissão fora da matriz — a divergência não pode voltar em silêncio.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **AE-27 / FN-09** menu e rotas abertos | `usePermissions()` (`can`/`canAny`/`canAll`/`isOwner`/`isLoaded`), `<Can>` e `<RequirePermission>`; sidebar montada a partir de `lib/nav-items.ts`, que declara a permissão por item e some com grupos sem filhos visíveis; 9 páginas administrativas embrulhadas no guard de página; KPIs financeiros do dashboard só com `financial:read` e **a API deixou de enviá-los** a quem não pode lê-los; botões de mutação sob `<Can>` | `hooks/use-permissions.ts`, `components/auth/*`, `lib/nav-items.ts`, `components/layouts/sidebar.tsx`, 9 `page.tsx`, `reports.service.ts`, `reports.controller.ts` |
| **AE-28** 403 vira "lista vazia" | `lib/api-errors.ts` (`isPermissionError`, `getApiErrorStatus`); `<DataTable error={…}>` distingue **carregando** × **sem permissão** × **vazio de verdade** × **falha genérica**, e para de anunciar "Nenhum registro" para uma contagem que não conseguiu buscar; `<PermissionDeniedState />` reaproveitável; 9 telas passaram a repassar o `error` da query | `lib/api-errors.ts`, `components/tables/data-table.tsx`, `components/auth/permission-denied-state.tsx` |
| **VD-07** vendedor não conseguia vender | Três permissões granulares novas (`payment-methods:read`, `payment-conditions:read`, `cash-registers:read-session`) concedidas ao papel `seller` — **sem** abrir `financial:read`; os 4 endpoints do PDV passaram a exigi-las; `financial-accounts` continua fechado; o aviso "Nenhum caixa aberto" deixou de aparecer quando a consulta **falhou** (em vez de responder zero), e uma consulta que falha não bloqueia mais a venda | `packages/constants/src/permissions.ts`, `payment-methods.controller.ts`, `payment-conditions.controller.ts`, `cash-registers.controller.ts`, `balcao/page.tsx`, `payment-selector.tsx` |
| **AE-17** `/login` acessível logado | `app/(auth)/layout.tsx` (novo) redireciona para `/` depois da hidratação, com spinner no intervalo para não piscar o formulário | `app/(auth)/layout.tsx` |
| **AE-19** token em `localStorage` | Janela do refresh de **7 dias → 24 h** (`REFRESH_TOKEN_TTL_SECONDS`, blacklist e `jwt.refreshExpiresIn`). Rotação a cada uso e revogação no logout **já existiam**. ADR escrita registrando que o cookie `httpOnly` fica para tarefa própria | `auth.service.ts`, `app.config.ts`, `docs/adr/0001-estrategia-de-token-de-sessao.md` (novo) |
| **FN-71** 403 vira erro técnico | `getApiErrorMessage()` traduz 403 para "Você não tem permissão para realizar esta ação. Fale com o administrador."; as telas de métodos e condições de pagamento passaram a consultar o helper | `lib/api.ts`, `configuracoes/{metodos,condicoes}-pagamento/page.tsx` |

### Além do plano

1. **A API deixou de enviar o que a UI esconde.** O plano pede gating visual dos KPIs financeiros do
   dashboard. Só esconder na tela mantém "A Pagar R$ 12.156,70" viajando no corpo da resposta para
   um vendedor. `getDashboard` recebeu escopo: sem `financial:read`, os KPIs financeiros não são
   **nem consultados** no banco.
2. **Sessão de caixa com menor privilégio.** `cash-registers:read-session` permite o PDV ler a
   sessão aberta, mas o `findAllSessions` restringe a resposta a sessões **abertas** para quem não
   tem `financial:read` — o vendedor não passa a ver saldos de fechamento e diferenças de outros
   operadores. O guard agora expõe as permissões resolvidas via `@CurrentPermissions()`.
3. **Seed corrigido (achados 2 e 3 do lote 2).** Métodos à vista (`CASH`/`PIX`/`DEBIT_CARD`) nascem
   com conta financeira vinculada — sem isso a regra correta do SCRUM-30 travava **toda** venda numa
   base recém-semeada. E o seed virou idempotente: `create().catch(() => {})` criava uma cópia nova
   de cada método e conta a cada `db:seed` (a base de QA tinha 25 métodos, 10 nomes). As duplicatas
   já existentes foram **desativadas**, não apagadas, porque há pedidos apontando para elas.
4. **Baseline de testes do front zerado.** As 26 falhas herdadas eram, todas, o mesmo erro trivial:
   `confirm-dialog`, `toast` e `data-table` renderizam `Tooltip` do Radix sem `TooltipProvider` no
   teste (a aplicação monta um em `providers.tsx`). Com o wrapper, **a suíte web está 100% verde
   pela primeira vez** — e `npm run test:tz` deixa de falhar por ruído.

### Decisões que fogem da letra do plano

1. **`reports:financial` não existe** — o plano cita essa permissão para os KPIs do dashboard, mas o
   modelo real tem `reports:read` (que o vendedor precisa ter, para o painel de vendas). O gate
   correto é `financial:read`, que é o que separa quem enxerga contas a pagar/receber.
2. **`<Can>` esconde por padrão.** O plano prefere desabilitar com tooltip. O modo existe
   (`mode="disable"`) e é o recomendado para botões, mas o padrão é esconder: manter "Nova Conta"
   visível e morto em toda tela administrativa vira ruído. Escondido para quem nunca terá a
   permissão, desabilitado onde a ação é contextual.
3. **As 21 mensagens genéricas de erro ficaram para o lote 7.** O 403 agora é traduzido no helper e
   as telas do FN-71 o consultam; varrer todos os `catch` do app é justamente o escopo do lote 7
   ("Feedback de erro e contratos de API") e mexeria nos mesmos arquivos que ele.
4. **Cookie `httpOnly` adiado conscientemente** (etapa 2 do AE-19), com ADR — exige BFF no Next,
   mudança de CORS, CSRF e reescrita do interceptor; misturar isso com o lote de autorização juntaria
   dois riscos diferentes na mesma entrega.

### Testes

- **API**: **721 testes verdes** (eram 672), rodados em `America/Sao_Paulo`, `UTC` e `Asia/Tokyo`.
  Novos: 38 do `role-permissions.spec` (incluindo a varredura dos controllers e a matriz por papel),
  5 do escopo do dashboard, 5 do escopo da listagem de sessões, 1 da exposição de permissões no
  guard, além dos ajustes de TTL do refresh.
- **Web**: **304 testes, 304 passando** — suíte inteira verde, também nos três fusos. Novos:
  `use-permissions.test.ts` (14), `components/auth/can.test.tsx` (13), `lib/nav-items.test.ts` (12),
  `lib/api-errors.test.ts` (7), 5 casos de erro na `data-table` e 6 no store de auth.
- `nest build` verde.

### Verificação no app rodando (27 checagens na UI + 24 na API)

Scripts: `scratchpad/check-seller.js` (API) e `scratchpad/verify-lote4.js` +
`scratchpad/verify-lote4-venda.js` (Playwright) · evidências: `scratchpad/shots/lote4/`

```
— owner —
PASS owner vê Financeiro e Configurações no menu
PASS owner abre /financeiro/contas normalmente
PASS owner vê o KPI "A Pagar" no dashboard
PASS AE-17 /login autenticado redireciona para /

— vendedor —
PASS AE-27 menu do vendedor: Dashboard | Estoque | Vendas | Clientes
PASS FN-09 vendedor não vê "A Pagar" nem "A Receber" no dashboard
PASS AE-27 /financeiro/contas, /financeiro/caixa, /configuracoes e /estoque/movimentacoes
     exibem "Acesso negado" por URL direta
PASS AE-28 nenhuma delas é renderizada como lista vazia
PASS AE-27/AE-28 o dashboard do vendedor não traz KPI financeiro nem no corpo da resposta

— VD-07: venda de balcão de ponta a ponta pelo vendedor —
PASS o PDV não acusa mais "Nenhum caixa aberto" falso
PASS formas de pagamento carregam (7 opções)
PASS botão "Finalizar Venda" habilitado
PASS a venda virou pedido · PED-000030 · 29 -> 30 pedidos
PASS pedido nasce COMPLETED
PASS baixa de estoque efetivada · 598 -> 597
PASS nenhum 403 no console durante toda a jornada
PASS nenhum pageerror durante o roteiro

— API, papel seller —
PASS 200 em payment-methods, payment-conditions, cash-register-sessions?status=OPEN,
     orders, products, customers e reports/dashboard
PASS 403 em financial-accounts, financial-entries, cash-registers, inventory/movements e users
PASS nenhuma sessão de caixa fechada vaza para o vendedor (2 de 3 sessões)
PASS /auth/me entrega as 3 permissões novas e não entrega financial:read
```

### Achados novos do lote 4

1. **O papel `financial` não alcançava o PDV nem o caixa por nome de recurso.** Os filtros de papel
   são por `resource`, então recursos novos não caem em nenhum papel por padrão — `financial` e
   `viewer` precisaram de regra explícita para as três permissões novas. Vale lembrar disso ao criar
   qualquer recurso: **permissão nova nasce órfã**.
2. **O submit do balcão é bloqueado em silêncio quando falta o cliente.** O zod exige `customerId`,
   a mensagem renderiza no topo do formulário e o usuário que está olhando o rodapé só vê o botão
   não responder. É o mesmo padrão do VD-12 (corrigido no lote 2 para quantidade) — candidato ao
   lote 9 (UI) ou 6 (validações).
3. **`orders:cancel` continua não existindo na matriz real** (o `/cancel` usa `orders:update`). A
   permissão citada no plano do lote 2 não está no seed; se ela for desejada, precisa entrar em
   `PERMISSIONS` **e** nos papéis, senão vira gate que ninguém passa.

---

---

## Lote 5 — concluído

### A ideia central

O módulo financeiro acertava a aritmética e falhava nas **regras de proteção**: nada era reversível,
nada vencia, o caixa aceitava saldo negativo e não conversava com as contas. Três correções
estruturais sustentam o resto:

1. **Dinheiro soma em centavos.** `common/utils/money.util.ts` (novo): `toMoney`, `sumMoney`,
   `subtractMoney`, `toCents`, `fromCents`. `Number(Decimal)` somado com `+` é o que devolvia
   `"balance": 708.9000000000001` na API (FN-28). A regra está no `apps/api/CLAUDE.md`.
2. **Reversibilidade é lançamento novo, nunca apagão.** Todo estorno cria a transação contrária ao
   lado da original. Apagar esconderia do operador que o dinheiro se moveu duas vezes e quebraria
   qualquer conciliação já feita.
3. **A conta financeira do caixa é a gaveta.** Toda operação de caixa — abertura, suprimento,
   sangria, diferença de fechamento — passou a lançar na conta vinculada. Sem isso não existe
   conciliação, e a Conta Digital ficava em R$ 0,00 depois de um dia inteiro de operação.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **FN-03** vencidos nunca vencem | Status derivado na leitura (`isOverdue`, no fuso do tenant) **e** materializado por job diário às 05:00 (`OverdueTitlesJob`); filtro `status=OVERDUE`, card "Vencidos" próprio, badge vermelho, linha destacada e ordenação trazendo os vencidos na frente — antes de paginar, então a página 1 é a mais urgente | `financial-entries.service.ts`, `overdue-titles.job.ts` (novo), `lancamentos/page.tsx`, `entries-filters.tsx` |
| **FN-04** nada é reversível | `FinancialReversalsService` (novo): `POST /:id/settlements/:settlementId/reverse` (motivo obrigatório, usuário gravado, baixa marcada como estornada, segundo estorno recusado com 409), `PATCH /:id` (valor e vencimento travados quando há baixa), `DELETE /:id` (soft delete, só sem baixa e sem documento de origem) e `GET /:id/settlements` para a UI escolher **qual** baixa estornar. `AuditService` (novo) grava tudo. Menu de ações por linha com `<Can>` | `financial-reversals.service.ts` (novo), `audit.service.ts` (novo), `financial-entries.controller.ts`, `_components/{reverse-settlement,edit-entry,delete-entry}-dialog.tsx` (novos) |
| **FN-05** dois caixas abertos | Semântica (a) do plano: dois PDVs simultâneos são legítimos, mas o sistema **não escolhe** — com mais de um caixa aberto a venda informa `cashRegisterSessionId` ou recebe 409. O PDV mostra o seletor só quando há ambiguidade | `orders.service.ts`, `order.dto.ts`, `balcao/page.tsx` |
| **FN-06** sangria a descoberto | `availableBalance()` (abertura + suprimentos − sangrias + vendas em dinheiro da sessão) valida a sangria; mensagem "Saldo insuficiente no caixa (disponível: R$ X)". É a **mesma** função que o fechamento usa, então os dois não podem discordar | `cash-registers.service.ts` |
| **FN-11** cache do histórico | Mutations invalidam o prefixo `["cash-registers"]` inteiro; antes só `lists()`, e a tabela de sessões continuava "Aberto" depois do fechamento | `hooks/use-cash-registers.ts` |
| **FN-12** transferência infla DRE | Transações de transferência saem dos totais (sempre) e ganham tipo próprio `TRANSFER`, com cor neutra. Continuam na lista — o operador precisa ver que o dinheiro andou; o que não pode é virar receita e despesa ao mesmo tempo | `financial-entries.service.ts`, `lancamentos/page.tsx` |
| **FN-15** caixa × conta desconectados | Abertura credita, suprimento credita, sangria debita e a diferença do fechamento lança sobra/falta na conta vinculada. Caixa sem conta vinculada apenas não lança — o movimento continua registrado | `cash-registers.service.ts` |
| **FN-16** contas duplicadas | Nome e código únicos por tenant, com 409 em pt-BR; `DELETE` que **inativa** conta com movimento e faz soft delete de conta sem movimento; conta excluída sai das listagens | `financial-accounts.service.ts`, migration `add_soft_delete_to_financial_accounts` |
| **FN-17** saldo negativo em silêncio | Conta do tipo Caixa **nunca** fica negativa (dinheiro físico não empresta); conta bancária pode, mas só com `allowNegativeBalance` explícito. As duas mensagens dizem o saldo disponível | `financial-accounts.service.ts`, `dto/transfer.dto.ts` |
| **FN-20** coluna "Conta" vazia | Causa raiz eliminada em duas frentes: o seed vincula conta aos métodos à vista (lote 4) e a API passou a **exigir** essa conta (VD-11), então o `defaultAccountId` de que o mapeamento depende existe | `payment-methods.service.ts`, `seed.ts` |
| **FN-28** ruído de float | Totais e saldos somados em centavos; `outstandingOf` e os mapeamentos passam por `toMoney`; `financial-settlements` usa os mesmos helpers no lugar do `round2` local | `money.util.ts` (novo), `financial-entries.service.ts`, `financial-settlements.service.ts` |
| **VD-11** método "legado" | Método à vista (`CASH`/`PIX`/`DEBIT_CARD`) exige conta financeira vinculada na criação **e** na edição — inclusive ao trocar o tipo de um método a prazo. O seletor do PDV mostra o tipo (`Dinheiro · dinheiro` × `Dinheiro · outro`), que era o que tornava os homônimos indistinguíveis | `payment-methods.service.ts`, `components/forms/payment-line.tsx` |

### Dois achados da conciliação — e por que ela existe

O checklist do lote pede uma conciliação de um dia inteiro. Ela não é cerimônia: rodada de ponta a
ponta, **achou dois bugs que nenhum teste unitário pegaria**, porque ambos são divergências entre
dois módulos que isoladamente estavam certos.

1. **O dinheiro da venda ia para a conta errada.** A venda de balcão creditava a conta *do método de
   pagamento* enquanto a sessão de caixa creditava a conta *do caixa*. Com as duas diferentes, a
   conta do caixa fechava sem a venda e a do método recebia dinheiro que nunca esteve lá. Dinheiro
   vivo agora vai para a gaveta onde foi recebido, sempre — PIX e débito seguem na conta escolhida.
2. **A tela do caixa e o fechamento contavam coisas diferentes.** `getCurrentSession` somava apenas
   abertura + suprimentos − sangrias; o fechamento somava também as vendas em dinheiro. A tela dizia
   "saldo atual R$ 100" e o fechamento esperava R$ 249,90 — o operador conferia a gaveta contra o
   número errado e a "diferença" nascia da tela, não do caixa. As duas usam a mesma função agora, e
   há um teste que exige que concordem.

### Decisões que fogem da letra do plano

1. **Sem migration de consolidação dos métodos `OTHER`** (passo 1 do 5.5). O seed virou idempotente
   no lote 4 e as duplicatas acumuladas foram desativadas; uma migration que funda métodos `OTHER`
   em tipos reais teria que adivinhar a intenção de cada linha e reescreveria pagamentos históricos.
   A porta de entrada está fechada (validação de conta + tipo visível no seletor); consolidar o
   passado é migração de dados com decisão de negócio, não código.
2. **`deletedAt` em vez de `CANCELLED`** para o soft delete de títulos. `CANCELLED` já significa
   "cancelado por decisão de negócio" (é o que o cancelamento de pedido usa); reaproveitá-lo
   apagaria a diferença entre um título cancelado e um lançado por engano.
3. **Tolerância configurável no fechamento não entrou.** O plano sugere exigir justificativa acima
   de um limite (ex.: R$ 5,00). O campo de configuração não existe no modelo e inventá-lo aqui seria
   decidir política de negócio; o fechamento já distingue sobra de falta e lança a diferença na
   conta. Fica registrado para o lote 8.
4. **A migration foi aplicada à mão.** `prisma migrate dev` detectou drift no histórico e propôs
   **resetar o banco inteiro** (dropar 20+ tabelas com dados). As duas migrations do lote foram
   escritas manualmente, aplicadas com `prisma db execute` e registradas com `migrate resolve
   --applied`. Ambas só adicionam colunas nulas — nenhum dado existente mudou. **O drift continua
   lá** e vai reaparecer na próxima migration: vale um item para investigar antes do lote 8.

### Testes

- **API**: **835 testes verdes** (eram 721), rodados em `America/Sao_Paulo`, `UTC` e `Asia/Tokyo`.
  Novos: 11 do `money.util`, 8 do OVERDUE + 5 do job, 7 de transferência interna, 24 do
  `FinancialReversalsService`, 16 do caixa (sangria, reflexo na conta, totais da sessão), 5 da
  escolha de caixa na venda, 13 dos métodos de pagamento, 9 de contas (duplicidade, ciclo de vida,
  saldo negativo) e 4 do dinheiro que vai para a gaveta certa.
- **Web**: **313 testes, 313 passando** (eram 304), também nos três fusos. Novos: 3 hooks de
  reversibilidade, 1 de invalidação de cache do caixa e 4 do `toDateInputValue`.
- `nest build` verde.

### Verificação na API rodando (73 checagens)

Scripts em `scratchpad/`: `check-fn03.js` (10), `check-fn12.js` (9), `check-fn04.js` (20),
`check-caixa.js` (17) e `check-contas.js` (17), mais a conciliação:

```
— conciliação de um dia inteiro —
PASS abertura: conta +200 · 2130,10 → 2330,10
PASS venda em dinheiro registrada · nasce COMPLETED
PASS venda: conta +149,90 · 2330,10 → 2480,00
PASS título a prazo não move a conta
PASS baixa: conta +500 · 2480,00 → 2980,00
PASS sangria: conta -100 · 2980,00 → 2880,00
PASS saldo esperado do caixa confere com o dia · 249,90
PASS fechamento sem divergência · diferença 0
PASS CONCILIAÇÃO: 749,90 = 200 (abertura) + 149,90 (venda) + 500 (baixa) − 100 (sangria)
PASS FN-28 totais sem ruído de float

— reversibilidade (critério de aceite do plano) —
PASS baixa de R$ 100 em título de R$ 300 · título fica PARTIALLY_PAID
PASS estorno aceito · título volta a PENDING · saldo em aberto volta a R$ 300
PASS conta volta ao saldo original
PASS as duas transações aparecem no histórico, a original marcada como estornada
PASS estorno duplicado recusado (409) · estorno sem motivo recusado (400)
PASS título de pedido recusa edição (409)
```

### Achados novos do lote 5

1. **`prisma migrate dev` quer resetar o banco.** O histórico de migrations não reproduz o schema
   atual (provável `db push` em algum ponto). `migrate status` diz "up to date" porque só compara a
   tabela de controle com a pasta. Investigar antes que uma migration precise mudar dados.
2. **A conciliação precisa virar teste automatizado.** Os dois bugs que ela achou são de integração
   entre módulos e nenhum teste unitário os pegaria. É o candidato natural a primeiro E2E do lote 10.
3. **`getCurrentSession` devolve `{ success, data: null }` quando não há sessão**, em vez do formato
   das outras rotas — o tipo de retorno vira união e todo consumidor precisa estreitar. Contrato
   inconsistente, candidato ao lote 7.

---

---

## Lote 6 — concluído

### A ideia central

Este lote fecha **portas de entrada**. A diferença para os anteriores é que o dado sujo é
irrecuperável: um CPF inválido só aparece meses depois, quando a NF-e é rejeitada pela SEFAZ e já há
venda fechada em cima dele.

Três validadores compartilhados nasceram em `packages/validators`, cada um com uma implementação só
para os dois workspaces — o zod do front e um decorator do NestJS importam do mesmo lugar:

| Módulo | O que valida |
|---|---|
| `br-documents.ts` | CPF/CNPJ com dígito verificador, normalização e formatação |
| `br-fiscal.ts` | NCM, CEST, EAN/GTIN (com checksum) e CFOP, mais a tabela de CFOPs de venda |
| `password.ts` | Política de senha, medidor de força e senhas previsíveis |

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **AE-04** CPF/CNPJ inválidos aceitos | `isValidCPF`/`isValidCNPJ` com dígito verificador e rejeição de sequências repetidas; decorator `@IsBrDocument` na API e `superRefine` no formulário. `111.111.111-11` e `11.111.111/1111-11` agora são recusados nas duas pontas | `packages/validators/src/br-documents.ts` (novo), `is-br-document.validator.ts` (novo), `customer.dto.ts`, `clientes/novo/page.tsx` |
| **AE-15** duplicidade burlável pela máscara | `document` passou a ser gravado **só com dígitos** (criação e edição), migration normalizou os existentes e um índice único parcial `(tenantId, document)` garante a regra no banco — a consulta prévia sozinha perde em concorrência | `customers.service.ts`, migration `normalize_customer_documents` |
| **AE-08** NCM `ABCDEFG`, EAN `123`, sem CFOP | NCM 8 dígitos, CEST 7, EAN/GTIN 8/12/13/14 **com checksum**, e o campo **CFOP** que não existia em aba nenhuma (com os códigos usuais de venda pré-listados). Validado no cadastro **e** na edição — a edição era a outra porta | `br-fiscal.ts` (novo), `is-br-fiscal.validator.ts` (novo), `product.dto.ts`, `products.service.ts`, migration `add_cfop_to_products`, `produtos/novo` e `produtos/[id]/edit` |
| **AE-05** venda abaixo do custo em silêncio | Margem em tempo real, em vermelho quando negativa, e um checkbox de confirmação explícita — bloquear de vez atrapalharia liquidação, mas o silêncio era pior | `produtos/novo/page.tsx` |
| **AE-24** "obrigatório" com o campo preenchido | `min(0.01)` passou a dizer "Preço de venda deve ser maior que zero" | `produtos/novo/page.tsx` |
| **AE-11** submit que "não faz nada" | `lib/form-tabs.ts` (novo): contador de erros por aba, foco automático na primeira aba com erro e toast dizendo quantos campos faltam. O asterisco que faltava em "Preço de Custo" também entrou | `lib/form-tabs.ts` (novo), `hooks/use-invalid-submit.ts` (novo), `produtos/novo`, `produtos/[id]/edit` |
| **AE-02** produto com saldo excluído | 409 com o saldo na mensagem (`"X" ainda tem 592 un. em estoque…`) e oferta de inativar; bloqueio também para pedido em aberto; os alertas de estoque são resolvidos **na mesma transação**, senão ficam órfãos e o KPI "Estoque Crítico" segue contando um item que não existe | `products.service.ts`, `estoque/produtos/page.tsx` |
| **AE-12c** três depósitos "Padrão" | Rebaixar o anterior e criar o novo na mesma transação, índice parcial único `(tenantId) where isDefault` e migration que deixou só o mais antigo de cada tenant | `inventory.service.ts`, migration `single_default_warehouse` |
| **FN-13** validação que falha calada | Erros renderizados em **todos** os campos dos formulários de método e condição, mais `useInvalidSubmit` como rede: nenhum submit recusado fica mudo | `metodos-pagamento`, `condicoes-pagamento`, `use-invalid-submit.ts` (novo) |
| **FN-14** 999 parcelas estouram a tela | `.max(48)` no zod (o `max` do HTML é contornável), diálogo com corpo rolável e rodapé fixo, preview truncado em 6 linhas + "… e mais N parcelas" | `condicoes-pagamento/page.tsx` |
| **FN-24** entrada acima de 100% | `entryPercentage` entre 0 e 100, com mensagem própria | `condicoes-pagamento/page.tsx` |
| **FN-25** senha fraca | 8 caracteres e 3 das 4 classes, bloqueio de senhas previsíveis e do nome/e-mail do usuário, medidor de força na tela. Aplicado onde a senha é **definida** — o login segue aceitando a senha antiga, senão quem cadastrou sob a política velha fica trancado do lado de fora | `password.ts` (novo), `is-strong-password.validator.ts` (novo), `password-strength.tsx` (novo), `login.dto.ts`, `profile.dto.ts`, `user.dto.ts` |
| **FN-26** validação de e-mail em inglês | `noValidate` em **20 formulários** — ver o achado abaixo | todo o `app/` e `components/` |

### O achado da varredura

O plano do FN-13 pedia para "varrer o projeto atrás do mesmo padrão", e a varredura pagou: **5
arquivos** tinham campos registrados sem bloco de erro — não só os dois que o QA encontrou. Mais
interessante foi o que a verificação na UI mostrou depois: com o preview de 999 parcelas corrigido,
o diálogo passou a exibir **"Value must be less than or equal to 48."** — a validação nativa do
browser, em inglês, disparando antes do zod.

Ou seja: **FN-26 não era um bug de e-mail, era um bug de todo formulário com regra em atributo HTML**
(`max`, `min`, `type="email"`, `required`). O `noValidate` entrou nos 20 formulários do sistema, e a
mensagem passou a ser a do zod, em pt-BR, embaixo do campo certo.

### Decisões que fogem da letra do plano

1. **Sem "listagem de pendências fiscais"** (aceite do 6.2). A varredura da base não encontrou
   produto com NCM/EAN inválido — o `ABCDEFG` do QA não chegou a ser salvo. Construir uma tela para
   zero linhas seria inventar trabalho; se aparecer dado sujo numa importação futura, aí ela se
   justifica.
2. **CEST tem 7 dígitos, não 9.** O `CLAUDE.md` do front dizia 9, que é o tamanho **com máscara**
   (`00.000.00`). O dado tem 7; a máscara é exibição.
3. **Três das quatro classes de caractere, não as quatro.** Exigir as quatro empurra o usuário para
   `Senha@123` — que este lote bloqueia explicitamente. Tamanho e variedade dão mais força do que um
   símbolo obrigatório.
4. **O login não endureceu.** A política nova vale onde a senha é **definida** (cadastro, convite,
   redefinição, troca). Aplicá-la no login trancaria fora quem cadastrou sob a política antiga —
   migrar essas senhas é outro fluxo, com aviso ao usuário.
5. **Uma duplicata real foi arquivada.** A migration de normalização revelou o que o AE-15
   descrevia: `Maria da Silva Santos` (do seed) e `QA Dup Formato` (criado pelo ciclo de QA) com o
   mesmo CPF em formatações diferentes. O registro de QA levou **soft delete** — reversível — para o
   índice único poder ser criado.

### Testes

- **API**: **855 testes verdes** (eram 835), nos três fusos. Novos: validação de documento no DTO,
  6 casos de exclusão de produto com saldo, 4 de depósito padrão único e os ajustes de política de
  senha.
- **Web**: **413 testes, 413 passando** (eram 313), também nos três fusos. Novos: 30 de documentos
  brasileiros, 42 de campos fiscais, 11 de `form-tabs` e 17 de política de senha.
- `nest build` e `next build` verdes.

### Verificação no app rodando (34 checagens)

Scripts em `scratchpad/`: `check-ae04.js` (8), `check-ae08.js` (10), `check-lote6.js` (11) e
`verify-lote6.js` (13, Playwright) · evidências em `scratchpad/shots/lote6/`

```
— documentos (AE-04 / AE-15) —
PASS CPF 111.111.111-11 e CNPJ 11.111.111/1111-11 recusados
PASS dígito verificador errado recusado · CPF declarado como CNPJ recusado
PASS gravado só com dígitos · 370.032.757-91 → 37003275791
PASS o mesmo documento em outra formatação é duplicata (409)

— fiscal (AE-08) —
PASS ncm 'ABCDEFG' e ean '123' recusados — os dois casos do QA
PASS CEST inválido, CFOP inexistente e EAN com checksum errado recusados
PASS NCM e CEST gravados só com dígitos · edição fecha a mesma porta

— formulário (AE-11 / AE-05 / AE-24) —
PASS o submit recusado avisa o motivo e leva para a aba com erro
PASS a aba mostra o contador de pendências
PASS a venda abaixo do custo pede confirmação explícita

— condições (FN-13 / FN-14) —
PASS o botão "Criar" continua visível e dentro da viewport com 999 parcelas
PASS o submit inválido diz "O máximo é 48 parcelas", em pt-BR, sob o campo
PASS o preview trunca em "… e mais 993 parcelas"

— produto e depósito (AE-02 / AE-12c) —
PASS produto com saldo não é excluído · "…ainda tem 592 un. em estoque…"
PASS produto sem saldo é excluído normalmente
PASS criar um novo padrão rebaixa o anterior — segue havendo só um

— senha (FN-25) —
PASS senha de 6 dígitos e senha longa de uma classe só recusadas
PASS quem tem senha antiga continua entrando
```

Os roteiros dos lotes 4 e 5 (`check-seller.js`, `check-fn04.js`, `check-conciliacao.js`) foram
re-executados ao final: **sem regressão**.

### Achados novos do lote 6

1. **`noValidate` precisa ser padrão do time.** Todo `<form>` com react-hook-form tem que tê-lo,
   senão o browser valida primeiro, em inglês, e as mensagens do zod nunca aparecem. Está nos 20
   formulários atuais; um novo formulário sem ele reintroduz o FN-26.
2. **`onInvalid` tem que ler os erros do argumento, não do closure.** A primeira versão do foco
   automático de aba lia `errors` do render anterior e não trocava de aba na primeira tentativa —
   exatamente quando o usuário precisa. Corrigido, mas é uma armadilha fácil de repetir.
3. **Apagar `.next` com o `next dev` de pé corrompe o cache** (já registrado no lote 2, aconteceu de
   novo). O caminho é parar o dev, limpar, subir de novo.

---

---

## Lote 7 — concluído

### A ideia central

Dois padrões sistêmicos, ambos de correção mecânica e retorno alto:

1. **O backend dizia o motivo e a UI jogava fora.** A API respondia "Já existe um cliente com o
   documento 529.982.247-25" e o usuário lia "Erro ao criar cliente. Tente novamente." — tentava de
   novo, dava o mesmo erro, e não tinha como descobrir o porquê sem abrir o DevTools.
2. **O front lia campos que a API não devolvia.** Três colunas permanentemente vazias, e ninguém
   percebia porque `undefined` renderiza como célula em branco ou `R$ 0,00`: parece que o cliente
   nunca comprou, não que o contrato quebrou.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **AE-10** toast genérico | `lib/mutation-error.ts` (novo) com `getMutationErrorMessage(error, fallback)`, aplicado nos **19** catches que a varredura encontrou. Trata 403 (mensagem de permissão) e 5xx (fallback — stack trace não ajuda ninguém) à parte; o resto mostra a razão do backend. Os diálogos de excluir categoria/marca passaram a avisar **antes** de confirmar, usando a contagem que já está na mesma linha | `lib/mutation-error.ts` (novo), 14 arquivos de tela |
| **AE-12a** mensagens em inglês | **71 mensagens** traduzidas na varredura do backend. As de estoque ficaram acionáveis: "Estoque insuficiente de Widget A (SKU-001) no depósito Makeimports: disponível 19, saída solicitada 999" no lugar de "Insufficient stock. Current: 19, Change: -999" | 10 services |
| **FN-21** descrições em inglês | O código já gerava em pt-BR; restavam 2 recebíveis de março ("Receivable for order PED-000003"). Migration acertou os registros históricos | migration `translate_legacy_titulo_descriptions` |
| **VD-19** valor não formatado | `formatCurrency` no toast de troca e `formatBRL` — que estava **duplicado** em dois services e virou compartilhado — nas mensagens do backend que citam dinheiro | `exchange-dialog.tsx`, `money.util.ts`, `financial-settlements`, `orders.service` |
| **AE-13** "Pedidos" e "Total Gasto" vazios | A API passou a devolver `totalOrders` e `totalSpent` agregados, com `select` aninhado (sem N+1) e soma em centavos; a relação crua não vaza na resposta. Só conta pedido que virou venda — cancelado, devolvido e rascunho ficam de fora | `customers.service.ts` |
| **AE-14** coluna CLIENTE vazia | `customerName` plano na listagem de pedidos, ao lado do `customer` aninhado que já existia | `orders.service.ts` |
| **AE-12b** card com ", -" e " produtos" | Cidade, UF e CEP viraram **colunas próprias** — o serviço os recebia e concatenava dentro de `address`, destruindo a estrutura na gravação. `productCount` agregado. E a tela parou de interpolar separadores fixos: um depósito sem cidade não exibe mais ", -" | `inventory.service.ts`, migration `add_warehouse_address_parts`, `depositos/page.tsx` |

### A varredura de contrato

O passo 3 do plano pedia para conferir, tela a tela, se todo `accessor` existe na resposta. Fiz isso
como **roteiro executável** (`check-contratos.js`) em vez de leitura de código: ele bate os campos
que cada tabela lê contra o que a API devolve na base real. As 9 telas do sistema passaram.

O achado interessante foi um falso positivo meu: eu tinha anotado que `/estoque/alertas` lia
`currentQuantity`/`minQuantity`, mas a tela usa `currentStock`/`minStock` — e a API entrega
exatamente isso. O roteiro fica no repositório de scripts e é o candidato natural ao teste de
contrato do lote 10.

### Decisões que fogem da letra do plano

1. **`formatBRL` virou compartilhado em vez de um terceiro `toFixed`.** Ele já existia duplicado em
   `financial-accounts` e `cash-registers`; consolidei em `money.util.ts` junto com o resto da
   aritmética de dinheiro (lote 5).
2. **Cidade/UF do depósito viraram colunas, não parsing de string.** O plano diz "backend devolve
   cidade/UF"; a saída fácil seria extraí-las do `address` concatenado. Mas o DTO **já recebia** os
   três campos e o serviço os destruía na gravação — o dado que o usuário digitou estava sendo
   perdido. Corrigir o parsing manteria a perda.
3. **O login não entra na varredura de mensagens.** "Credenciais inválidas" e afins já estavam em
   pt-BR; as que sobraram em inglês são de rota interna (`Tenant suspenso`, `Refresh token`), que o
   usuário final não lê.

### Testes

- **API**: **869 testes verdes** (eram 855), nos três fusos. Novos: 3 das mensagens acionáveis de
  estoque, 5 dos totais do cliente, 3 do `customerName` e 3 do contrato de depósito.
- **Web**: **423 testes, 423 passando** (eram 413), também nos três fusos. Novos: 10 do
  `getMutationErrorMessage`.
- `nest build` e `next build` verdes.

### Verificação no app rodando (22 checagens)

Scripts: `check-contratos.js` (14) e `verify-lote7.js` (8, Playwright) · evidências em
`scratchpad/shots/lote7/`

```
— contratos, tela a tela —
PASS clientes, dashboard, depósitos, produtos, pedidos, lançamentos,
     movimentações, alertas e sessões de caixa devolvem todos os campos que a UI lê

— os casos do QA —
PASS AE-13 cliente mostra "2 pedidos · R$ 149,90"
PASS AE-14 pedido recente traz "QA Cliente Valido" na coluna CLIENTE
PASS AE-12b card mostra "60 produtos" e nenhum ", -" no endereço
PASS AE-10 toast diz "Já existe uma categoria com o identificador 'acessorios'"
     em vez de "Erro ao criar categoria."
PASS AE-12a nenhuma mensagem em inglês na tela
PASS FN-21 nenhuma descrição de título em inglês
```

Os roteiros dos lotes 4, 5 e 6 foram re-executados ao final: **sem regressão**.

### Achados novos do lote 7

1. **O plural de "produtos" estava fixo.** O card exibia "1 produtos". Corrigido de passagem — é o
   tipo de coisa que o lote 9 (UI) vai encontrar em série.
2. **Separadores interpolados são uma família de bug.** `{address}, {city} - {state}` produz ", -"
   quando as partes faltam. Compor com `filter(Boolean).join()` deveria ser o padrão; vale procurar
   outras ocorrências no lote 9.
3. **A varredura de mensagens em inglês precisa de heurística melhor.** A minha usou "tem acento ou
   palavra em português", e 7 das 85 ocorrências eram falso positivo. Para virar teste automatizado
   (lote 10) precisa de uma lista explícita de exceções.

---

---

## Lote 9 — concluído

### A ideia central

O sistema era **inutilizável em celular** nos três domínios, e uma linha de tabela com conteúdo real
derrubava o layout inteiro. Duas causas, ambas de uma linha:

1. **`min-w-0` ausente.** A `<aside>` tinha 264 px fixos, sem breakpoint, e o container de conteúdo
   não podia encolher — um filho flex sem `min-w-0` mantém a largura intrínseca. Em 390 px sobravam
   ~126 px e as tabelas ficavam **cortadas, sem scroll**: inacessíveis, não apenas feias.
2. **Nenhum limite de largura na célula.** Um nome de 255 caracteres (que o schema permite) expandia
   a tabela e empurrava Categoria, Preço, Estoque, Status e Ações para fora da tela — inutilizando
   **todas** as linhas, não só a longa.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **AE-07 / FN-10 / VD-15** mobile inutilizável | Sidebar vira **drawer** abaixo de `lg` (overlay, hambúrguer no header, fecha ao navegar e no ESC, trava o scroll do body) e volta a ser coluna a partir de `lg`; `min-w-0` no conteúdo; padding responsivo | `sidebar.tsx`, `header.tsx`, `(dashboard)/layout.tsx` |
| **AE-20** nome longo derruba a tabela | Truncamento com `max-w-[42ch]` num wrapper interno (o `max-w-0 truncate` no `<td>` só funciona com `table-fixed`), `title` no `<td>` com o texto completo, `overflow-x-auto` no container e `width`/`table-fixed` opcionais por coluna | `components/tables/data-table.tsx` |
| **VD-13** valor monetário truncado | `nowrap` por coluna, aplicado nas **16** colunas alinhadas à direita do sistema | `data-table.tsx` + 10 telas |
| **AE-09** Rules of Hooks | `ConfirmDialog`: o `if (!open) return null` ficava **antes** do `useEffect` do ESC — com o diálogo fechado zero hooks rodavam, aberto um rodava, e todo diálogo de confirmação do sistema disparava "Internal React error". `clientes/[id]`: `useToast()` depois de dois returns. Regra `rules-of-hooks: error` ativa | `confirm-dialog.tsx`, `clientes/[id]/page.tsx`, `.eslintrc.json` |
| **FN-18** 404 cru em inglês | `app/not-found.tsx` e `app/(dashboard)/not-found.tsx` (dentro do shell, com menu) em pt-BR; `/estoque`, `/vendas` e `/financeiro` — que são os `href` dos grupos do menu — redirecionam para a primeira tela do grupo | 5 arquivos novos |
| **AE-26** dropdown cobre o modal | O diálogo de movimentação ganhou corpo rolável e rodapé fixo; o `SearchableSelect` detecta colisão e abre **para cima** quando não cabe abaixo | `movement-form-dialog.tsx`, `searchable-select.tsx` |
| **VD-18** PDV sem atalhos | `F2` busca produto, `F4` cliente, `F9` finaliza, `ESC` limpa a busca; o foco **volta para a busca** depois de cada item (antes era um clique por produto); `Enter` adiciona o primeiro resultado, para o leitor de código de barras não esperar o debounce; legenda dos atalhos no rodapé | `vendas/balcao/page.tsx` |
| **VD-16 / FN-19** documentos sem máscara | Máscara na aba Cliente do pedido (documento, telefone e CEP) e no fallback da listagem — sem `documentType` ela mostrava o documento cru; `formatDocument` deduz pelo número de dígitos | `customer-tab.tsx`, `clientes/page.tsx` |
| **FN-22** sem breadcrumb | `lib/breadcrumbs.ts` deriva a trilha da rota usando os rótulos do **menu**, então ela não pode divergir do caminho clicado; ids viram "Detalhe" em vez de exibir o cuid | `lib/breadcrumbs.ts` e `components/layouts/breadcrumbs.tsx` (novos) |
| **FN-27** rótulos sem acento | 40 strings acentuadas em 5 arquivos de Configurações, Contas e PDV | 7 arquivos |
| **AE-21** "1 itens" | `pluralize(count, singular, plural)` em `lib/utils.ts`, aplicado no card Estoque Crítico | `lib/utils.ts`, `(dashboard)/page.tsx` |
| **AE-23** rótulos de status divergentes | O `StatusBadge` mantinha **cópia própria** dos rótulos ao lado de `ORDER_STATUS_LABELS`. Agora só as **cores** moram nele; o texto vem da fonte única | `components/ui/status-badge.tsx` |

### O achado grande: o lint nunca rodou

`npm run lint` chamava `next lint` e o **ESLint não estava instalado**. O `.eslintrc.json` tinha 20
regras configuradas — `curly`, `eqeqeq`, `import/order`, `no-nested-ternary` — e nenhuma era
aplicada. Instalar revelou **555 violações**, todas pré-existentes.

O que fiz: instalei, ativei `rules-of-hooks: error` (o pedido do plano) e limpei **526** delas —
`import/order` e `curly` por autofix, imports não usados e duplicados por script. Restam **29**, que
não fiz de propósito:

- **16 `no-nested-ternary`**: refatorar lógica de render por questão de estilo é churn com risco real
  e nenhum ganho de comportamento.
- **~13 variáveis não usadas e 1 `any`**: precisam de análise caso a caso.

Também **reconfigurei `eqeqeq` para `{ "null": "ignore" }`**: `x != null` é o idioma para "nem null
nem undefined", e forçar `!==` deixaria `undefined` passar por `!== null` — quebraria
`formatCurrency(undefined)`. A regra estava errada, não o código.

### Decisões que fogem da letra do plano

1. **Sem "card expansível por linha" no mobile** (passo 3 do 9.1). O plano sugere mover colunas
   secundárias para um card por linha em telas pequenas. As tabelas passaram a rolar
   horizontalmente dentro do próprio container, o que já cumpre o aceite ("todo conteúdo largo rola
   dentro do próprio container") com uma fração do risco. O card é redesenho de todas as listas —
   cabe melhor como tarefa própria, com o time olhando.
2. **Truncar virou o padrão da tabela, com escape.** O componente não tem como saber se um JSX é um
   nome longo ou uma linha de botões — e o caso do QA era justamente um `<Link>`, não texto puro.
   Então toda coluna trunca, e `noTruncate` (aplicado nas 6 colunas de ação) opta por sair.
3. **ESC no PDV limpa a busca, não cancela a venda.** O plano lista "ESC limpar/cancelar". Cancelar
   uma venda inteira numa tecla que se aperta sem pensar é destrutivo demais para um balcão.
4. **Sem `+`/`-` para quantidade do último item.** O plano os cita; num campo de texto eles são
   caracteres válidos e capturá-los globalmente atrapalharia a digitação. Os quatro atalhos de
   função entregam o ganho descrito (o clique por produto) sem esse risco.

### Testes

- **Web**: **438 testes, 438 passando** (eram 423), nos três fusos. Novos: 5 do comportamento da
  tabela com conteúdo real, 4 de `pluralize` e 6 de `buildBreadcrumbs`.
- **API**: 869 verdes, inalterados — o lote é todo de frontend.
- `next build` e `nest build` verdes.

### Verificação no app rodando (19 checagens)

Script: `scratchpad/verify-lote9.js` · evidências em `scratchpad/shots/lote9/`

```
— AE-07: drawer em 390×844 —
PASS a sidebar começa escondida no mobile
PASS o hambúrguer abre o menu · ESC fecha

— 16 rotas em 390×844 —
PASS nenhuma corta conteúdo (o QA media `scrollWidth === clientWidth`)
PASS nenhuma estoura em 768×1024

— AE-20 —
PASS o nome de 255 caracteres trunca e Categoria/Preço/Estoque/Status voltam
     à tela · célula 462 px, recorte ativo, 7 colunas, container rolável

— FN-18 —
PASS /xyz mostra 404 em pt-BR, sem o texto cru do Next
PASS /financeiro, /vendas e /estoque levam à primeira tela do grupo

— FN-22 / FN-27 / AE-21 / VD-16 / AE-09 —
PASS trilha na tela de segundo nível
PASS nenhum rótulo sem acento em Configurações
PASS nenhum "1 itens" no dashboard
PASS nenhum documento ou telefone cru na lista de clientes
PASS nenhum erro de hooks no console · nenhum pageerror
```

Os roteiros dos lotes 5, 6 e 7 foram re-executados: **sem regressão**.

### Achados novos do lote 9

1. **A varredura de acento precisa pegar minúsculas.** A minha rodada inicial corrigiu 40 strings e
   ainda deixou "Configure as condicoes de pagamento disponiveis" na tela — só a evidência em
   imagem pegou. Um teste que varre o DOM renderizado é mais confiável que grep no código.
2. **`textContent` não sabe de CSS.** Meu primeiro critério para o AE-20 media o comprimento do
   texto e falhava mesmo com o truncamento funcionando — o texto completo **continua no DOM**, que é
   o correto para leitor de tela. O que prova o recorte é `scrollWidth > clientWidth`.
3. **`next build` com o `next dev` de pé corrompe o cache** — terceira ocorrência (lotes 2, 6 e 9).
   Vale um alvo separado no turbo ou uma nota no README de desenvolvimento.

---

---

## Lote 8 — concluído

### A ideia central

Não são defeitos de código: são telas que faltam ou que existem só como fachada. E duas delas
**mentiam** — pior que não existir. `/configuracoes` tinha um botão "Salvar Alterações" que não
disparava requisição nenhuma, e a aba Usuários respondia *"quem tem acesso a este sistema?"* com três
pessoas inventadas.

O padrão que se repetiu nos cinco itens: **o backend já estava pronto**. `GET/PATCH /tenants/current`,
`GET /users`, `POST /users/invite`, `POST /inventory/transfer`, `PATCH /customers/:id` — tudo existia.
O que faltava era a tela chamar, e em três casos a tela *dizia ao usuário para configurar* exatamente
o campo que ela não exibia.

### Bugs

| Bug | O que foi feito | Arquivos |
|---|---|---|
| **FN-07** empresa não salva | Aba Empresa ligada a `GET/PATCH /tenants/current`, com CNPJ validado por dígito verificador (`@IsBrDocument` no DTO — antes era `@IsString() @MaxLength(18)`, o antipadrão do AE-04), documento gravado só com dígitos + migration de normalização, e busca de CEP preenchendo o endereço | `_components/company-tab.tsx` (novo), `hooks/use-tenant.ts` (novo), `tenants.service.ts`, `update-tenant.dto.ts`, migration `normalize_tenant_documents` |
| **FN-08** usuários e plano falsos | Aba Usuários lista `GET /users` de verdade, com papel, status, último acesso e ativar/desativar; convite usa `GET /users/roles` (novo) — os quatro slugs inventados fariam **todo** convite ser recusado com 400, porque `POST /users/invite` exige um `roleId` real. A aba Plano virou real em vez de removida: `maxUsers`/`maxProducts`/`maxOrders`/`maxWarehouses` sempre existiram no modelo, só ninguém lia | `_components/{users-tab,invite-user-dialog,plan-tab}.tsx` (novos), `hooks/use-users.ts` (novo), `users.service.ts`, `tenants.service.ts` |
| **AE-25** transferência e ajuste ausentes | Modal de movimentação com os 4 modos (Entrada, Saída, Transferência, Ajuste), cada um em seu formulário; o filtro da listagem passou a oferecer os **6** tipos (derivado do mapa de badges, que já os tinha — a lista escrita à mão tinha 4) | `_components/{movement-form-dialog,transfer-form,adjustment-form,entry-exit-form,movement-fields}.tsx`, `estoque/movimentacoes/page.tsx` |
| **AE-06** cliente sem edição | `CustomerForm` extraído (create/edit compartilham um schema) e `/clientes/[id]/edit` criado; o ícone `Edit` que estava importado e nunca usado virou o botão | `components/forms/customer-form.tsx` (novo), `clientes/[id]/edit/page.tsx` (novo) |
| **AE-16** endereços impossíveis | CRUD de endereços do cliente (`GET/POST/PATCH/DELETE /customers/:id/addresses`), com um só principal garantido em transação, promoção automática ao apagar o principal, e **busca por CEP** compartilhada por cliente, empresa e depósito | `customers.service.ts`, `lib/cep.ts` + `components/forms/cep-input.tsx` (novos), `_components/{addresses-tab,address-form-dialog}.tsx` (novos) |
| **AE-12d** depósito sem editar/excluir | `PATCH`/`DELETE /inventory/warehouses/:id`; excluir com saldo é 409 **com a quantidade na mensagem** (padrão do AE-02), depósito com histórico é **desativado** em vez de apagado (os movimentos que apontam para ele são o rastro de auditoria), e o padrão não pode ser desativado nem excluído | `inventory.service.ts`, `inventory.controller.ts`, `_components/warehouse-form-dialog.tsx` (novo) |
| **VD-11(UI)** conta vinculada invisível | Coluna "Conta vinculada" na listagem, com aviso vermelho quando um método à vista não tem conta — que é exatamente o estado que trava a venda no PDV. O zod passou a exigi-la para `CASH`/`PIX`/`DEBIT_CARD`, alinhado com a regra que a API já tinha | `metodos-pagamento/page.tsx`, `hooks/use-payment-methods.ts` |
| **AE-18** busca global inerte | `GET /search?q=` em clientes, produtos e pedidos, escopado por tenant **e por permissão de quem busca**; command palette com Ctrl/Cmd+K, debounce de 300 ms, resultados agrupados e navegação por setas. O campo "Buscar..." do topo virou o gatilho | `modules/search/` (novo), `components/layouts/command-palette.tsx` (novo), `header.tsx` |

### Trabalho estrutural

1. **`inventory:transfer` e `inventory:adjust` não existiam.** O plano os cita como "já existem em
   `packages/constants`" — mas isso vale para a lista **inventada** que o lote 4 substituiu pela
   matriz real. Foram criados de verdade (constants + seed + papéis) e as duas rotas passaram a
   exigi-los. Vale o lembrete do lote 4: **permissão nova nasce órfã**; `warehouse` e `manager` as
   recebem pela regra de recurso, `seller`, `financial` e `viewer` não.
2. **`@ResolvePermissions()`.** O `PermissionsGuard` só resolvia as permissões em rotas com
   `@RequirePermissions`, então `@CurrentPermissions()` devolvia `[]` numa rota aberta — e a busca
   global, que é aberta a qualquer autenticado mas filtra a **resposta** por permissão, teria
   respondido "nada" para todo mundo. O decorator novo torna isso explícito em vez de um efeito
   colateral; o guard também passou a expor `roleName` (`@CurrentRole()`).
3. **Rótulos de papel, plano e regime tributário em `@erp/constants`.** A tela tinha o próprio mapa,
   com `admin | manager | operator | viewer` — um papel que não existe e quatro que existem faltando.
   Meu primeiro mapa de planos repetiu o erro (`BASIC`/`PRO` em vez de `STARTER`/`PROFESSIONAL`),
   o que é a evidência de que o lugar certo é a fonte única.
4. **`CepInput` compartilhado.** Três telas pediam CEP e nenhuma usava: o usuário digitava o código e
   redigitava rua, bairro, cidade e UF. A busca é **conveniência, nunca portão** — CEP inexistente ou
   provedor fora do ar avisam e deixam preencher à mão.

### Decisões que fogem da letra do plano

1. **A aba Plano ficou, em vez de ser removida.** O plano manda removê-la "se ainda não existe modelo
   de plano/limites". Existe: os quatro limites são colunas de `Tenant` desde sempre. O que não
   existia era a leitura. O botão "Fazer Upgrade", esse sim, saiu — não levava a lugar nenhum.
2. **Ajuste de estoque recebe a quantidade contada, não a diferença.** O endpoint `POST
   /inventory/adjustment` é novo em vez de reusar o `ADJUSTMENT` do `POST /inventory/movement`, que
   pedia um delta e decidia o sinal por qual campo de depósito vinha preenchido. Um inventário diz
   "há 47 na prateleira"; obrigar o operador a calcular `47 - 50` é uma subtração desnecessária **e**
   uma corrida — o saldo pode andar entre ler a tela e salvar. O servidor deriva a diferença do saldo
   que lê **dentro da transação**.
3. **Depósito com histórico é desativado, não excluído.** Apagar a linha orfanaria todo movimento que
   aponta para ela. A API responde qual das duas coisas fez, e o toast diz isso em vez de um
   "excluído com sucesso" que seria mentira.
4. **Página de aceite do convite (`/convite/[token]`).** Não há serviço de e-mail: `POST
   /users/invite` gera um token e loga. Engolir esse token faria "Enviar Convite" ser um segundo
   no-op silencioso — o link é exibido para envio manual, e agora leva a algum lugar.
5. **Sem tela de inventário/contagem em lote** (opcional do 8.2). É um fluxo próprio, com importação
   de arquivo e geração de ajustes em massa; cabe como tarefa dedicada, não de carona.

### Achados novos do lote 8

1. **O CNPJ do seed é inválido.** `12.345.678/0001-90` não passa no dígito verificador — ou seja, o
   seed grava um documento que o próprio validador do sistema rejeita. Numa base recém-semeada, o
   formulário da empresa **não salvava nada**: todo submit morria em "CNPJ inválido" por causa de um
   dado que o próprio projeto escreveu. Seed corrigido para `11222333000181`; a linha existente no
   banco de desenvolvimento foi acertada à mão (mudar o CNPJ de um tenant real é decisão de negócio,
   não migration).
2. **Ajuste negativo aparecia como `+3` na listagem.** O sinal da quantidade vinha de
   `type === "EXIT" ? "-" : "+"`, que erra em dois dos seis tipos: um ajuste de 39 para 36 é uma
   saída de 3 e era pintado de verde com `+`, e uma transferência — que não é ganho nem perda —
   também. Agora a direção sai dos campos de depósito, que é como o backend a registra
   (`lib/movement-direction.ts`, 5 testes).
3. **Botões só de ícone sem nome acessível.** Editar/excluir em depósitos, endereços e métodos de
   pagamento tinham apenas o ícone; o tooltip do Radix é `aria-describedby` e não substitui o rótulo.
   `aria-label` adicionado — foi o teste de UI que denunciou, ao não conseguir localizá-los.
4. **`GET /products` devolve `inventory` e `GET /products/:id` devolve `inventorySummary`.** O mesmo
   agregado sob dois nomes. Quem ler só um dos dois recebe `undefined` e uma asserção de saldo passa
   pelo motivo errado. Registrado no teste de contrato; vale unificar.
5. **`GET /financial-entries/:id` não existe** e a listagem não aceita `search` nem expõe `orderId` —
   relacionar um título ao pedido depende de casar a descrição pelo número. Os recebíveis de um
   pedido, esses, vêm no detalhe dele.

### Testes

- **API**: **928 testes verdes** (eram 869), nos três fusos. Novos: consumo do plano e normalização
  do documento do tenant, `findRoles`, 9 do `adjustStock`, 11 do CRUD de depósito, 11 do CRUD de
  endereços do cliente, 11 do `SearchService`, 3 do `@ResolvePermissions` e 4 do desconto de item.
- **Web**: **460 testes, 460 passando** (eram 438), nos três fusos. Novos: 7 de `lib/cep`, 5 de
  `use-tenant`, 5 de `use-users` e 5 de `movementDirection`.
- `nest build`, `next build` e `npx tsc --noEmit` verdes.

### Verificação no app rodando (130 checagens)

Roteiros Playwright, um por item — `verify-lote8-1.js` (23), `verify-lote8-2.js` (35),
`verify-lote8-3.js` (25), `verify-lote8-4.js` (30) e `verify-lote8-5.js` (17). Todos verdes.

```
— FN-07 / FN-08 —
PASS a aba Empresa carrega a razão social do banco e o dado sobrevive ao F5
PASS "Salvar Alterações" dispara PATCH /tenants/current (antes: nenhuma requisição)
PASS nenhum dos três usuários inventados existe na tela ou no banco
PASS o convite chega à API e o link de aceite leva a uma página que existe
PASS o plano mostra o consumo real · 2 / 10 usuários

— AE-25 —
PASS o modal oferece Entrada, Saída, Transferência e Ajuste
PASS a transferência pela UI moveu o saldo nos dois depósitos · 36->34 | 15->17
PASS o formulário mostra o saldo do sistema e a diferença antes de salvar · +4
PASS o servidor deriva a diferença do saldo lido · 39 -> 36 (-3)
PASS vendedor não pode transferir nem ajustar (403)
PASS o filtro de tipo oferece os 6 tipos

— AE-06 / AE-16 —
PASS o botão "Editar" existe e a edição persiste
PASS a busca por CEP preencheu o logradouro · Avenida Paulista · São Paulo
PASS CEP inexistente avisa e não bloqueia o cadastro
PASS só existe um endereço principal; apagar o principal promove o restante

— AE-12d / VD-11(UI) —
PASS excluir com saldo é recusado · "…ainda tem 7 un. em estoque…"
PASS depósito com histórico é desativado, não excluído
PASS a listagem mostra a conta vinculada · Caixa Principal
PASS o formulário critica método à vista sem conta, antes do 409

— AE-18 —
PASS Ctrl+K abre a busca; Enter navega para o resultado; Esc fecha
PASS buscar o documento com máscara encontra o cliente gravado só com dígitos
PASS termo sem resultado mostra mensagem em vez de ficar mudo

PASS nenhum pageerror, nenhum 5xx e nenhum erro de console nos cinco roteiros
```

### Checklist de saída

- [x] `grep -rn "TODO: integrate" apps/web` = 0
- [x] `grep -rn "MOCK_" apps/web/app apps/web/components` = 0
- [x] Transferência e ajuste operáveis pela UI, com permissão própria e auditoria
- [x] Cliente pode ser editado e ter endereço com busca por CEP
- [x] Todas as telas novas nascem com gating de permissão (lote 4) e validação (lote 6)

---

---

## Lote 10 — concluído

### A ideia central

O ciclo de QA achou 78 bugs em 216 cenários manuais e os roteiros que os acharam viviam no
`scratchpad/` da sessão. **Eles não existem mais** — o diretório é efêmero e sumiu junto com a
sessão. Este lote é o que transforma achado em barreira: 64 testes E2E versionados em
`apps/web/e2e/` e um CI que os roda antes do merge.

A regra que os organiza é a do plano: **toda jornada afirma um efeito colateral em outra tela**. A
mensagem de sucesso é a parte que mente; o saldo do produto e o título financeiro, não.

### O que foi entregue

| Item | Onde |
|---|---|
| Configuração (chromium, pt-BR, `America/Sao_Paulo`, trace/screenshot na falha) | `apps/web/playwright.config.ts` |
| Fixtures: login por papel, cliente de API, massa determinística, `waitFor` | `e2e/fixtures.ts` |
| Instrumentação global: falha em `pageerror`, erro de console ou HTTP ≥ 500 | `e2e/fixtures.ts` |
| Jornadas: auth, venda-pedido, venda-balcao, cancelamento, financeiro, cadastros, responsividade | `e2e/*.spec.ts` |
| Testes de contrato front × back (11 telas + dashboard) | `e2e/contrato.spec.ts` |
| CI: lint + dívida, testes nos 3 fusos, E2E com Postgres/Redis/MinIO | `.github/workflows/ci.yml` |
| Barreira de dívida (`TODO: integrate` / `MOCK_`) | `scripts/check-debt.sh` |

Cada teste carrega o ID do relatório no nome (`VD-02: o pedido percorre PENDING→COMPLETED e baixa o
estoque em SHIPPED`), então a rastreabilidade sobrevive à leitura do output.

### O bug que a suíte achou

**VD-10 estava fechado só no frontend.** O zod do carrinho limita o desconto ao valor da linha, mas a
API só rodava `calculateItemTotal`, que **trunca o resultado em zero**. Um desconto de R$ 80 numa
linha de R$ 50 era aceito e gravado como venda `COMPLETED` de **R$ 0,00** — a tela validava, o banco
não. O mesmo valia para o desconto de pedido, que `calculateOrderTotals` limitava ao subtotal em
silêncio.

Corrigido em `orders.service.ts` com `maxItemDiscount` (que existia em `@erp/validators` e o backend
nunca chamava) e mensagem acionável nomeando produto e limite. **Um teste existente afirmava o
comportamento errado** — `should floor totalPrice to zero when discount exceeds line total` — e foi
reescrito: truncar é certo para exibir, aceitar a entrada não era.

É exatamente o padrão que o 10.1 prevê: a mesma regra em dois lugares, e só um deles a aplica.

### Decisões que fogem da letra do plano

1. **`no-nested-ternary` virou `warn`.** O lote 9 decidiu explicitamente não refatorar as 15
   ocorrências ("churn com risco real e nenhum ganho de comportamento") — são cadeias de estado de
   render em JSX. Com o CI barrando erros, manter `error` significaria reverter aquela decisão em
   silêncio ou ter um portão que nunca fecha. A regra ficou alinhada a `complexity` e
   `max-lines-per-function`, que já eram avisos. **Os outros 17 erros de lint do web foram
   corrigidos**: imports duplicados, `any`, interface vazia e variáveis mortas.
2. **O lint do CI cobre só o web.** A API tem **2062 erros de lint pré-existentes** (`no-unsafe-*`
   dos tipos dinâmicos do Prisma, `import/order`, `curly`) que nunca foram aplicados — é o mesmo "o
   lint nunca rodou" que o lote 9 achou no frontend, agora do outro lado. Ligar o portão sobre eles
   daria um build permanentemente vermelho. `npm run lint:ci --workspace=@erp/api` existe para medir
   o progresso quando esse passivo virar tarefa.
3. **`fullyParallel: false`.** As jornadas consomem estoque e mexem na mesma sessão de caixa;
   paralelizá-las faria asserções de saldo falharem por motivo alheio ao código.
4. **`waitFor` em vez de `waitForTimeout`.** Os recebíveis de um pedido são escritos por um handler
   de evento **depois** do 200 da mudança de status. Ler uma vez logo em seguida é uma corrida que
   passa local e falha no CI — pior que não ter teste. A primeira versão pegou 2 das 3 parcelas.
5. **Sem banco efêmero por execução localmente.** O CI cria um Postgres novo, migra e semeia a cada
   run (passo 5 do 10.3). Localmente as jornadas criam a própria massa (`ensureSellableProduct`,
   `createCustomer`, `ensureOpenCashSession`) em vez de depender do que a execução anterior deixou.

### Resultado

```
64 testes E2E · 8 arquivos · 2,7 min
  auth               7   AE-03, AE-17, AE-27, AE-28, FN-09
  venda-pedido       3   VD-02, VD-05
  venda-balcao       5   VD-04, VD-08, VD-10, VD-18
  cancelamento       5   VD-01, VD-03, VD-14
  financeiro         8   FN-01, FN-02, FN-04, FN-06, FN-15, FN-23, FN-28
  cadastros          9   AE-02, AE-04, AE-06, AE-08, AE-12c, AE-15, AE-16, FN-25
  responsividade    15   AE-07, AE-20, FN-10, FN-18, VD-15
  contrato          12   AE-12b, AE-13, AE-14, VD-11, FN-08
```

- **API**: 928 testes verdes nos três fusos.
- **Web**: 460 testes verdes nos três fusos.
- **Lint do web**: 0 erros (eram 29 herdados do lote 9 + 3 novos).
- **Dívida**: `scripts/check-debt.sh` verde, e testado nos dois sentidos.

---

## Estado do ambiente

- Docker (postgres/redis/minio) e `npm run dev` rodando.
- **Nove migrations novas nos lotes 5 a 8** (`deletedAt` em títulos e contas, `cfop` em produtos,
  normalização de documentos de cliente e de tenant, depósito padrão único), todas aplicadas à mão
  porque `prisma migrate dev` quer resetar a base. Ver "Decisões" do lote 5.
- Base reseedada no lote 4. O seed **não apaga**, mas agora é idempotente: métodos de pagamento,
  condições e contas financeiras são atualizados por nome em vez de duplicados a cada execução, e as
  duplicatas acumuladas foram desativadas (`isActive: false`) — não apagadas, porque há pedidos
  apontando para elas. Ainda há produtos `QA-*` de ciclos anteriores.
- Rodar `next build` com o `next dev` de pé corrompe o cache de desenvolvimento — aconteceu nos
  lotes 2, 6 e 9. O caminho é parar o dev, `rm -rf .next` e subir de novo.
- **O ESLint passou a estar instalado** (`eslint` + `eslint-config-next` no workspace do web). Antes
  do lote 9 o `npm run lint` não rodava nada. Desde o lote 10 o web está com **0 erros**; a API tem
  ~2000 erros pré-existentes ainda não atacados.
- **Playwright instalado** (`@playwright/test` + chromium no workspace do web). `npm run e2e` roda as
  86 jornadas contra a API e o web já de pé — ele **não** sobe os serviços sozinho localmente.
- `npm run lint` passou a listar os diretórios explicitamente: o padrão do `next lint` não cobre
  `hooks/` nem `stores/`, e havia erro invisível ao portão do CI lá dentro (lote 11).
- O seed passou a gravar um CNPJ válido no tenant (o anterior era rejeitado pelo próprio validador
  do sistema). Uma base já existente precisa do acerto à mão — ver achado 1 do lote 8.

## Próximo passo sugerido

**Os 11 lotes estão fechados.** Os 78 bugs do ciclo de QA foram corrigidos, verificados no app
rodando e — os críticos e altos — amarrados em testes que falham antes do merge.

O que ficou aberto, em ordem de risco:

1. **O drift de migrations** (achado do lote 5). `prisma migrate dev` propõe resetar o banco inteiro,
   então as nove migrations dos lotes 5 a 8 foram aplicadas à mão. Isso bloqueia duas pendências
   antigas — persistência do troco (lote 2) e `dueDate` como `@db.Date` com backfill (lote 3) — e vai
   reaparecer na próxima migration que precise mexer em dados. É o primeiro item da fila.
2. **O passivo de lint da API**: ~2000 erros nunca aplicados. O CI já sabe medi-lo
   (`npm run lint:ci --workspace=@erp/api`); falta atacá-lo em lotes, começando pelos autofixáveis.
3. **Contratos a unificar**, achados pelos testes do lote 10: `inventory` × `inventorySummary` para o
   mesmo agregado em duas rotas de produto, e a ausência de `GET /financial-entries/:id`.
4. **Tolerância configurável na diferença de fechamento de caixa** (lote 5 → 8): o campo não existe no
   modelo e inventá-lo seria decidir política de negócio.
5. **Consolidação dos métodos de pagamento `OTHER` históricos** (lote 5) — migração de dados com
   decisão de negócio junto.

E o **próximo ciclo de QA** (10.6), que precisa de preparação: um segundo tenant no seed para exercitar
isolamento multi-tenant de verdade, e massa com produto inativo, cliente inadimplente e títulos
vencidos — três cenários que ficaram bloqueados nesta rodada.

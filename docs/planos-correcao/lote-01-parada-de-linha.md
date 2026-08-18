# Lote 1 — Parada de linha

> **Prioridade máxima.** Enquanto este lote não subir, qualquer teste manual gera dado sujo e há dois
> caminhos que corrompem estoque silenciosamente. Estimativa: **1,5 dia**. Sem dependências.

| Bug | Severidade | Resumo |
|---|---|---|
| AE-00 | 🔴 Crítico | `/estoque/movimentacoes` faz white-screen com movimentação `RETURN`/`PRODUCTION` |
| AE-01 | 🔴 Crítico | `MoneyInput` grava valores errados por ordem de grandeza |
| VD-03 | 🔴 Crítico | Troca de item permitida em pedido `CANCELLED` → estoque fantasma |
| VD-04 | 🔴 Crítico | PDV não envia o desconto geral → toda venda com desconto falha |
| AE-03 | 🟠 Alto | Login com senha errada não exibe erro (interceptor 401 engole a mensagem) |

---

## 1.1 — AE-00: completar o mapa de tipos de movimentação

**Arquivo:** `apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:29-35` e `:81-83`

O enum `MovementType` do Prisma (`schema.prisma:47-54`) tem 6 valores; `typeConfig` mapeia 4. Uma
movimentação `RETURN` — que o próprio backend gera ao estornar/trocar item de pedido — derruba a
página inteira em `config.variant`.

**Passos**
1. Adicionar as duas chaves faltantes ao `typeConfig`:
   - `RETURN`: label "Devolução", variant `warning`, ícone `Undo2`;
   - `PRODUCTION`: label "Produção", variant `secondary`, ícone `Factory`.
2. Blindar o acesso mesmo assim — um enum novo no banco não pode derrubar a tela:
   ```ts
   const FALLBACK_TYPE = { label: "Outro", variant: "secondary", icon: null } as const;
   const config = typeConfig[row.type] ?? FALLBACK_TYPE;
   ```
3. Fazer a mesma varredura nos outros mapas `Record<Enum, …>` do front — `grep -rn "Record<.*Status\|Record<.*Type" apps/web` — e aplicar fallback onde faltar. Alvos conhecidos: badges de status de pedido e de título financeiro.
4. Adicionar `app/(dashboard)/estoque/movimentacoes/error.tsx` (error boundary) para que uma falha de render nessa rota não apague o shell inteiro.

**Aceite:** com pelo menos uma movimentação `RETURN` e uma `PRODUCTION` na base, `/estoque/movimentacoes`
lista as duas com badge próprio; filtros e "Nova movimentação" continuam operáveis; console sem `pageerror`.

**Teste:** `movimentacoes/page.test.tsx` — renderizar a tabela com um item de cada um dos 6 tipos do
enum + um tipo desconhecido (`"FOO" as MovementType`) e afirmar que nada lança.

---

## 1.2 — AE-01: reescrever o `MoneyInput`

**Arquivo:** `apps/web/components/forms/money-input.tsx`

Três defeitos compostos: (a) `displayValue` renderiza `"0,00"` quando o valor é `0`, então o campo
nunca está vazio; (b) o input é `text-right` e controlado, e o caret cai na posição 0 a cada clique;
(c) `formatInputValue` reinterpreta a string inteira como centavos, então digitar no início
multiplica o número. Resultado medido: `1234` → **R$ 12.300,04**; `199990` → **R$ 1.990.009,90**, e o
valor errado é gravado sem aviso.

**Passos**
1. Manter o modelo "dígitos = centavos" (correto), mas garantir que a digitação sempre ocorra no fim:
   - renderizar `""` quando `field.value` for `0`/`null`/`""` (deixa o `placeholder="0,00"` aparecer);
   - `ref` no input + `useEffect` que, após cada mudança de `displayValue`, chama
     `input.setSelectionRange(len, len)`;
   - `onFocus`/`onClick` também posicionam o caret no fim.
2. Tratar `Backspace` explicitamente: remover o último dígito do valor cru (`Math.floor(cents / 10)`),
   em vez de depender da posição do caret.
3. Aceitar colagem (`onPaste`) de `"1.234,56"`, `"1234.56"` e `"1234,56"` — normalizar via
   `parseBRLToNumber` antes de aplicar.
4. Suportar valor negativo apenas onde fizer sentido (prop `allowNegative`, default `false`);
   hoje o sinal `-` é descartado em silêncio.
5. Expor `data-testid` no input para os testes de formulário que hoje dependem de posição.

**Aceite (tabela de verdade, vira teste):**

| Digitação (campo vazio) | Exibido | `field.value` |
|---|---|---|
| `1` | `0,01` | `0.01` |
| `12` | `0,12` | `0.12` |
| `1234` | `12,34` | `12.34` |
| `199990` | `1.999,90` | `1999.9` |
| `1234` + `Backspace` | `1,23` | `1.23` |
| clicar no meio do texto e digitar `5` | dígito vai para o fim | idem |

**Teste:** `money-input.test.tsx` com `@testing-library/user-event` cobrindo a tabela acima, o paste e o
clique no meio. **Este teste é a rede de segurança de todo o resto do ERP** — o componente é usado em
preço de custo/venda/promocional, pedidos, PDV e financeiro.

**Pós-fix obrigatório:** rodar uma query de auditoria nos preços já gravados
(`SELECT sku, "costPrice", "salePrice" FROM "Product" WHERE "salePrice" > 100000`) — os produtos criados
durante o QA têm valores 1000× inflados.

---

## 1.3 — VD-03: bloquear alteração de pedido em status terminal

**Arquivos:** `apps/api/src/modules/orders/use-cases/exchange-order-item.use-case.ts`,
`apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:370-379`

A troca de item não valida `order.status`. Executada em pedido cancelado, gerou movimento
`RETURN/RETURN_CUSTOMER` de 3 un. que nunca saíram (estoque fantasma: 50 → 53), consumiu 3 un. reais do
produto substituto e criou obrigação de devolução de R$ 11.730,00.

**Passos**
1. No use-case, logo após carregar o pedido, rejeitar status terminais:
   ```ts
   const IMMUTABLE = ['CANCELLED', 'RETURNED', 'COMPLETED'];
   if (IMMUTABLE.includes(order.status)) {
     throw new BadRequestException(
       `Não é possível trocar itens de um pedido com status ${translateStatus(order.status)}.`,
     );
   }
   ```
2. Auditar **todas** as mutações de pedido pelo mesmo critério: `grep -rn "orderId" apps/api/src/modules/orders/use-cases`.
   Toda operação que mexe em item, pagamento ou frete precisa do mesmo guard. Extrair para
   `assertOrderMutable(order)` em `orders.guards.ts` e reusar.
3. No front, esconder os botões "Trocar"/"Editar" quando `order.status` for terminal (não confiar só no backend).
4. Corrigir os dados corrompidos deixados pelo QA: conferir `ELET-001` (3 un. fantasma) e `ACESS-001`
   (3 un. baixadas indevidamente) — ou reseedar.

**Aceite:** `PATCH`/`POST` de troca em pedido `CANCELLED` retorna 400 com mensagem em pt-BR; o botão
não aparece na UI; estoque e devoluções ficam inalterados.

**Teste:** `exchange-order-item.use-case.spec.ts` — um caso por status terminal + um caso feliz em `CONFIRMED`.

---

## 1.4 — VD-04: enviar o desconto geral do PDV

**Arquivos:** `apps/web/app/(dashboard)/vendas/balcao/page.tsx:303-322`, `apps/web/hooks/use-orders.ts`

O resumo do PDV aplica o "Desconto Geral" só na tela. O payload não tem `discount`, então a API recebe
pagamentos de R$ 289,80 para um total de R$ 299,80 e responde
`400 – Soma dos pagamentos difere do total do pedido`. **Nenhuma venda de balcão com desconto é possível.**

**Passos**
1. Adicionar `discount?: number` a `CreateOrderPayload` em `use-orders.ts` (a API já aceita — `orders.service.ts:211`).
2. Incluir o campo no payload do submit do balcão e do formulário de pedido (`vendas/pedidos/novo`), com o mesmo valor exibido no resumo.
3. Garantir que o cálculo do total exibido use exatamente a mesma fórmula do backend
   (`subtotal − descontoItens − descontoGeral + frete`), para o valor da tela nunca divergir do validado.
4. Validar no zod do formulário: `discount ≥ 0` e `discount ≤ subtotal`.

**Aceite:** venda de balcão de R$ 299,80 com desconto de R$ 10,00 finaliza com total R$ 289,80; o pedido
gravado tem `discount = 10`; o estoque baixa; o recebível nasce com o valor descontado.

**Teste:** teste de hook (`use-orders.test.ts`) afirmando que `discount` chega no corpo da requisição +
teste de página do balcão com MSW verificando o payload.

---

## 1.5 — AE-03: não tratar o 401 do próprio login como sessão expirada

**Arquivo:** `apps/web/lib/api.ts:49` e `:88`

O interceptor trata **qualquer** 401 como token expirado: dispara `POST /auth/refresh` (que responde 400
sem refresh token), cai no catch e executa `window.location.href = "/login"`. O reload descarta o estado
React onde a mensagem "Email ou senha inválidos" tinha sido setada — o usuário só vê o formulário limpo.

**Passos**
1. Excluir as rotas de autenticação do fluxo de refresh:
   ```ts
   const AUTH_ROUTES = ["/auth/login", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password"];
   const isAuthRoute = AUTH_ROUTES.some((r) => originalRequest.url?.includes(r));
   if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) { … }
   ```
2. Não redirecionar quando já se está em `/login` (evita o reload que apaga o erro).
3. Trocar o `window.location.href` por `router.replace` onde houver acesso ao router, preservando o
   estado da aplicação; manter o `location.href` apenas como fallback fora de componente.
4. Confirmar que a página de login renderiza o banner de erro que ela já implementa.

**Aceite:** senha errada → banner vermelho "Email ou senha inválidos", campos preservados, **sem** chamada a
`/auth/refresh` e **sem** reload. E-mail inexistente → mesma mensagem (não revelar se o e-mail existe).

**Teste:** `api.test.ts` — 401 em `/auth/login` não dispara refresh; 401 em `/products` dispara.

---

## Checklist de saída do lote

- [x] Correções implementadas (detalhe do que foi feito em [PROGRESSO.md](PROGRESSO.md))
- [x] Testes: API 595/595; `money-input` 22/22; `api.test.ts` 13/13. As 27 falhas restantes do web são pré-existentes (baseline conferido com `git stash`) e pertencem ao lote 9
- [x] Reteste no app rodando com Playwright: **10/10** (`scratchpad/qa/verify-lote1.js`)
- [ ] **VD-04 pendente de verificação na UI** — código e teste prontos, mas a jornada completa do PDV com desconto não foi confirmada no navegador
- [ ] Banco reseedado (`npm run db:seed`) — a massa do ciclo de QA tem preços 1000× inflados, estoque fantasma e um produto com nome de 255 chars que quebra a tabela
- [ ] Deploy prioritário: os 4 críticos corrompem dado em produção

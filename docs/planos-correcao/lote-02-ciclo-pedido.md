# Lote 2 — Ciclo de vida do pedido (estoque × financeiro)

> O coração transacional do ERP. Hoje **nenhuma venda por pedido consegue dar baixa de estoque pela
> interface** e **cancelar um pedido não estorna nada**. Estimativa: **4 dias**. Depende do lote 1.

| Bug | Sev. | Resumo |
|---|---|---|
| VD-01 | 🔴 Crítico | Cancelar pedido confirmado não estorna estoque nem cancela o recebível |
| VD-02 | 🔴 Crítico | Ciclo de vida trava em "Separando"; baixa real de estoque nunca ocorre |
| VD-05 | 🟠 Alto | Parcelamento ignorado: "3x sem juros" gera 1 recebível de valor cheio |
| VD-06 | 🟠 Alto | Frete zerado no detalhe; abas Envio e Histórico sempre vazias |
| VD-08 | 🟠 Alto | PDV sem troco; pagamento maior que o total é bloqueado em silêncio |
| VD-10 | 🟠 Alto | Desconto por item: total do front diverge do back e a gravação falha |
| VD-12 | 🟡 Médio | Quantidade 0 ou negativa aceita no formulário, sem mensagem |
| VD-14 | 🟡 Médio | Sem cancelamento/estorno de venda de balcão e sem devolução de entregue |
| VD-17 | 🟡 Médio | Toast genérico esconde o motivo da falha de transição |
| VD-20 | 🔵 Baixo | Aviso de estoque insuficiente inconsistente entre as duas telas |
| VD-21 | 🔵 Baixo | Estoque exibido na linha do item é snapshot da busca |

---

## 2.1 — VD-01: cancelamento tem que usar o endpoint de cancelamento

**Arquivos:** `apps/web/hooks/use-orders.ts`, `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:161-174`,
`apps/web/app/(dashboard)/vendas/pedidos/page.tsx:232-244`

A UI cancela com `PATCH /orders/:id/status {status:'CANCELLED'}`. Em `orders.service.ts:423-529`,
`updateStatus()` emite evento só para `CONFIRMED`, `SHIPPED` e `DELIVERED` — **nunca `order.cancelled`**.
O endpoint correto `PATCH /orders/:id/cancel` (`orders.service.ts:534-591`) existe e funciona: o QA
comprovou que por ele a reserva volta (47 → 50) e o recebível vira `CANCELLED`.

**Passos**
1. Criar `useCancelOrder()` em `use-orders.ts` apontando para `PATCH /orders/:id/cancel`, com o motivo do
   cancelamento no corpo.
2. Trocar as duas chamadas da UI (detalhe e listagem) para o novo hook. `useUpdateOrderStatus` deixa de
   aceitar `CANCELLED` como destino.
3. Invalidar, no `onSuccess`, além das chaves de pedido: `["products"]`, `["inventory"]` e
   `["financial-entries"]` — o cancelamento mexe nos três.
4. **Blindar o backend** para que o caminho errado deixe de existir: em `updateStatus()`, se
   `status === 'CANCELLED'`, delegar internamente para `cancel()` em vez de só trocar a coluna.
   Enquanto ambos os caminhos existirem, o bug volta na próxima tela que esquecer.
5. Higienizar os pedidos já cancelados sem estorno (o QA deixou PED-000006 com 2 un. presas e um
   recebível de R$ 899,80 em aberto): script pontual ou reseed.

**Aceite:** cancelar um `CONFIRMED` libera a reserva (visível em `/estoque/produtos`), muda o recebível para
`Cancelado` em `/financeiro/lancamentos` e registra a movimentação de estorno. Cancelar via
`updateStatus` produz o mesmo efeito.

**Teste:** `orders.service.spec.ts` — cancelar por ambos os caminhos e afirmar reserva liberada + recebível
cancelado + evento `order.cancelled` emitido uma única vez.

---

## 2.2 — VD-02: máquina de estados completa e derivada da API

**Arquivos:** `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:90-116`,
`apps/web/app/(dashboard)/vendas/pedidos/page.tsx:176`, `apps/api/src/modules/orders/orders.service.ts:35-46`

O front oferece `PICKING → SHIPPED`; a API só aceita `PICKING → PACKED`. Não existe botão para "Embalado"
nem para `DELIVERED → COMPLETED/RETURNED`. Como `fulfillReservedStock` roda no evento `order.shipped`,
**o estoque fica eternamente reservado** — PED-000002 e PED-000003 do próprio seed estão presos em
"Separando".

Máquina real (fonte da verdade, `orders.service.ts:35-46`):

```
DRAFT     → PENDING, CANCELLED
PENDING   → CONFIRMED, CANCELLED
CONFIRMED → PICKING, CANCELLED
PICKING   → PACKED, CANCELLED
PACKED    → SHIPPED, CANCELLED
SHIPPED   → DELIVERED
DELIVERED → COMPLETED, RETURNED
COMPLETED / CANCELLED / RETURNED → (terminal)
```

**Passos**
1. **Parar de duplicar a máquina no front.** Expor as transições permitidas na resposta de
   `GET /orders/:id` (campo `allowedTransitions: OrderStatus[]`) e renderizar os botões a partir dela.
   Assim front e back não podem mais divergir.
2. Enquanto o campo não existir, mover o mapa para `packages/constants` e importá-lo nos dois lados —
   nunca mais reescrever à mão.
3. Criar rótulo e ícone para os estados que faltam na UI: "Marcar como Embalado" (`PACKED`),
   "Concluir" (`COMPLETED`), "Registrar Devolução" (`RETURNED`).
4. Exibir "Cancelar" em **todos** os estados que a máquina permite (hoje some em `PICKING`, deixando o
   pedido sem saída).
5. Alinhar as ações rápidas da listagem (`page.tsx:176`) com o mesmo mapa — hoje "Enviar" aparece para
   `CONFIRMED` e `PICKING`, ambos inválidos.

**Aceite:** um pedido percorre `PENDING → CONFIRMED → PICKING → PACKED → SHIPPED → DELIVERED → COMPLETED`
inteiramente pela UI, sem 400; em `SHIPPED` a reserva vira baixa efetiva (visível em
`/estoque/movimentacoes` como `EXIT/SALE`); nenhum estado fica sem ação disponível.

**Teste:** teste de página percorrendo o ciclo completo com MSW + `orders.service.spec.ts` para as transições.

---

## 2.3 — VD-05: respeitar o parcelamento da condição de pagamento

**Arquivos:** `apps/web/components/forms/payment-selector.tsx` (`handleAdd`), `apps/api/src/modules/orders/orders.service.ts:322-325`

`handleAdd` injeta `installments: 1` fixo, e o submit envia esse `1`. Como a API só aplica as parcelas da
condição quando o campo **não** vem, o fallback nunca dispara: "3x sem juros" gera **um** recebível de
R$ 189,80 com vencimento em 30 dias.

**Passos**
1. Não enviar `installments` quando o usuário não escolheu explicitamente — deixar `undefined` e permitir
   que a API derive da condição.
2. Adicionar seletor de parcelas no `PaymentSelector`, limitado ao `maxInstallments` da condição
   selecionada, com preview das datas e valores (a tela de condições já tem esse componente de preview —
   reusar).
3. Exibir na aba Financeiro do pedido as N parcelas com número (`1/3`, `2/3`, …) e vencimentos.
4. Arredondamento: distribuir a sobra de centavos na **primeira** parcela (padrão do mercado) e cobrir com teste.

**Aceite:** pedido de R$ 189,80 com condição 3x gera 3 recebíveis (R$ 63,27 / R$ 63,27 / R$ 63,26) com
vencimentos a 30/60/90 dias; a coluna "Parcelas" mostra `3x`.

---

## 2.4 — VD-06: alinhar o contrato do detalhe do pedido

**Arquivo:** `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:243-249, 279, 487-497`

A página lê `order.shipping?.cost`, `order.shipping` e `order.history`. A API devolve `shippingCost`,
`shippingMethod`, `trackingCode`, `shippedAt` na raiz e `statusHistory`. Efeito: card "Frete R$ 0,00" num
pedido com frete de R$ 10,00 (e subtotal + frete ≠ total na tela), aba Envio "não disponível" e aba
Histórico sempre vazia — mesmo com 3 mudanças de status registradas.

**Passos**
1. Corrigir os acessores no componente e tipar a resposta a partir de `@erp/shared-types` (não de um
   `type` local escrito à mão) — a divergência nasceu de tipos redigitados.
2. Renderizar a timeline de `statusHistory` (status, data/hora, usuário).
3. Conferir se o total exibido = subtotal − descontos + frete; adicionar teste de soma.
4. Varrer o restante do front atrás do mesmo padrão: `grep -rn "order\.\(shipping\|history\)" apps/web`.

**Aceite:** card Frete R$ 10,00; aba Envio com método/custo/rastreio; aba Histórico com as transições.

---

## 2.5 — VD-08 + VD-10 + VD-12: matemática e validação do carrinho

Três bugs da mesma origem: o cálculo do front não é o mesmo do back e os erros de item não são renderizados.

**VD-08 — troco no PDV** (`payment-selector.tsx:73-81`)
- O auto-sync força o valor recebido de volta ao total; com duas linhas somando mais, a tela mostra
  "Troco: R$ 50,20" e o submit não faz nada.
- Corrigir: em forma de pagamento **dinheiro**, permitir `valorRecebido > total`, calcular
  `troco = recebido − total`, enviar à API o valor do pagamento igual ao total (o troco não é receita) e
  registrar o troco na sessão de caixa.
- Para as demais formas, manter a soma exata — mas **exibindo** a mensagem de erro do schema, que hoje
  nunca é renderizada.

**VD-10 — desconto por item** (`orders.service.ts:206`)
- O front permite desconto maior que o item e chega a exibir subtotal negativo (−R$ 320,20); a API aplica
  `Math.max(totalPrice, 0)` e recusa a gravação por divergência.
- Corrigir no front: limitar o desconto ao valor do item (`min(desconto, qtd × preço)`), com aviso, e usar
  **a mesma fórmula do backend** no cálculo do resumo. Ideal: extrair a fórmula para
  `packages/validators` e importar nos dois lados.

**VD-12 — quantidade** (`novo/page.tsx`)
- `0` bloqueia o submit sem mensagem; `-5` exibe subtotal −R$ 449,50.
- Corrigir: `min={1}` efetivo (bloquear digitação e colagem de valor ≤ 0), renderizar o erro de
  `items.N.quantity` na linha, e validar no zod com mensagem em pt-BR.

**Aceite:** nenhuma combinação de quantidade/desconto produz total negativo na tela; todo bloqueio de
submit vem acompanhado de mensagem visível; o total exibido é sempre idêntico ao calculado pela API
(teste comparando os dois).

---

## 2.6 — VD-14: reversão de venda de balcão e devolução

Pedido de balcão nasce `COMPLETED` e o detalhe **não oferece nenhuma ação** — uma venda errada no PDV não
tem como ser desfeita pela aplicação. A transição `DELIVERED → RETURNED` existe na API e não tem botão.

**Passos**
1. Criar a ação "Estornar venda" para pedidos de origem `BALCAO` com status `COMPLETED`: devolve o estoque,
   estorna o recebível pago, registra saída no caixa e grava motivo + usuário.
2. Expor "Registrar Devolução" em `DELIVERED` (transição já suportada).
3. Restringir por permissão (`orders:cancel`) — ver lote 4.
4. Definir política de prazo (ex.: estorno de balcão só no mesmo dia/sessão de caixa) e implementar como
   regra de negócio explícita, não como ausência de botão.

**Aceite:** estorno de venda de balcão devolve estoque, cancela/estorna o recebível e é visível no
histórico do pedido; nenhuma tela permite estorno duplicado.

---

## 2.7 — VD-17 + VD-20 + VD-21: itens menores do mesmo fluxo

- **VD-17** — em `[id]/page.tsx:170-172` o `catch` descarta o erro. Usar `getApiErrorMessage(error)`, que já
  existe em `lib/api.ts` e é usado corretamente no formulário de criação. (O tratamento sistêmico das
  demais telas está no lote 7.)
- **VD-20** — `novo/page.tsx:545` usa `qty > stock && stock > 0`, então produto com estoque **zero** não
  dispara o alerta âmbar. Alinhar com a regra do PDV (`qty > stock`).
- **VD-21** — `availableStock` é congelado no momento da busca (`novo/page.tsx:281-289`). Revalidar o saldo
  no submit (a API já valida) e refazer o fetch do item ao mudar a quantidade, para o aviso não mentir em
  operação concorrente.

---

## Checklist de saída do lote

- [x] Ciclo completo do pedido percorrido pela UI, com baixa de estoque em `SHIPPED`
- [x] Cancelamento estorna estoque **e** financeiro pelos dois caminhos de código
      (`updateStatus` delega para `cancel()`)
- [x] Parcelamento gera N títulos com soma exata do total (`splitInstallments`, com teste do invariante)
- [x] Nenhum total negativo ou divergente entre tela e API — a fórmula passou a ser a mesma
      (`@erp/validators/order-money`), com testes de tabela cobrindo desconto acima do item
- [x] Testes de serviço e de página verdes; base reseedada

**Concluído em 01/08/2026** — 19/19 checagens no app rodando. Ver
[PROGRESSO.md](PROGRESSO.md) para o detalhamento, as três decisões que fogem da letra deste plano
(sobra de centavos, seletor de parcelas, persistência do troco) e o que ficou coberto só por teste de
unidade.

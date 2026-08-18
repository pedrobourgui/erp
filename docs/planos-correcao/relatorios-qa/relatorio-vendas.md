# Relatório de QA — Domínio VENDAS / PEDIDOS / PDV BALCÃO

- **Data:** 31/07/2026
- **Ambiente:** Web http://localhost:3000 · API http://localhost:3001/api/v1 · tenant `seed-tenant-001`
- **Ferramenta:** Playwright 1.62.1 (chromium headless, 1440x900 e 390x844), login real via UI
- **Usuários:** `admin@admin.com` (owner) e `vendedor@exemplo.com` (vendedor)
- **Evidências:** `/private/tmp/claude-502/-Users-mac-work-erp/e36bf272-20da-4da1-8c84-9d256825cf51/scratchpad/qa/shots/vendas/`
- **Scripts:** `/private/tmp/claude-502/-Users-mac-work-erp/e36bf272-20da-4da1-8c84-9d256825cf51/scratchpad/qa/0*.js, 1*.js`

> Observação: durante a execução outro agente de QA operava o módulo Financeiro (caixas/contas criados por terceiros aparecem em alguns screenshots). Isso não afetou os cenários de vendas, exceto onde indicado.

---

## 1. Resumo executivo

### O que funciona
- Listagem `/vendas/pedidos`: colunas, busca por número e cliente, filtros de status e origem, ordenação por Pedido/Cliente/Data/Total (asc/desc), estado vazio, contagem de registros, ações rápidas por status, rota protegida (deslogado → `/login`).
- Criação de pedido manual (`/vendas/pedidos/novo`): busca de cliente e de produto (debounce), badge de estoque, cálculo de subtotal/frete/total **na tela** (179,80 + 10,00 = 189,80 ✔), validações de obrigatórios, exigência de código de autorização em cartão, bloqueio quando não há caixa aberto, bloqueio quando a forma à vista não tem conta vinculada.
- Confirmação de pedido: reserva de estoque correta e visível em `/estoque/produtos` (ELET-002: disponível 100 → 98; ACESS-001: 397 → 395) e geração de conta a receber visível em `/financeiro/lancamentos`.
- Venda no balcão (`/vendas/balcao`) sem desconto: baixa direta de estoque (ROUP-001 200 → 198), pedido nasce `COMPLETED`, recebível PAGO e conta financeira creditada quando a forma de pagamento tem conta vinculada (Caixa Principal 48,50 → 247,50 numa venda de R$ 199,00).
- Bloqueios do PDV: venda sem itens, quantidade acima do estoque, venda sem cliente.
- Diálogo de troca de item renderiza corretamente; pedido inexistente exibe "Pedido não encontrado".

### O que está quebrado (destaques)
- **Cancelar pedido confirmado NÃO estorna estoque nem cancela o recebível** — a UI chama o endpoint errado.
- **O ciclo de vida do pedido trava em "Separando"**: a UI oferece uma transição que a API recusa e não existe ação para "Embalado" → nenhum pedido chega a Enviado/Entregue, e portanto **a baixa real de estoque nunca acontece** em venda por pedido.
- **Troca de item é permitida em pedido CANCELADO**, criando estoque fantasma e uma devolução de R$ 11.730,00.
- **PDV: "Desconto Geral" nunca é enviado à API** → toda venda de balcão com desconto falha.
- **Parcelamento é ignorado** (condição 3x gera 1 recebível de valor cheio).
- **Vendedor não consegue vender** (403 em formas de pagamento / caixa).

### Placar
| Resultado | Qtd |
|---|---|
| PASS | 27 |
| FAIL | 22 |
| BLOQUEADO / não testado | 4 |

---

## 2. Cenários executados

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| 1 | Rota protegida deslogado → redireciona para /login | PASS | `00-anon-redirect.png` |
| 2 | Listagem de pedidos carrega com dados e paginação | PASS | `01-lista-pedidos.png` |
| 3 | Filtro por status (CANCELLED / PENDING) | PASS | `81-filtro-cancelado.png` |
| 4 | Filtro por origem (BALCAO) | PASS | `82-filtro-balcao.png` |
| 5 | Filtro por período contendo o dia atual (01/07–01/08) | PASS | — |
| 6 | Filtro "hoje" (31/07 a 31/07) retorna os pedidos do dia | **FAIL** (0 de 5) | `88-filtro-data-hoje.png` |
| 7 | Datas invertidas (de 01/12 até 01/01) | PASS (lista vazia, sem erro) | `83-datas-invertidas.png` |
| 8 | Busca por número (`PED-000005`) e por cliente (`Pedro`) | PASS | — |
| 9 | Busca com payload SQL (`' OR 1=1 --`) | PASS (0 resultados, sem erro) | `85-busca-sqli.png` |
| 10 | Ordenação por Total asc/desc | PASS | `86-ordenado-total-asc.png` |
| 11 | Alterar itens por página (10) | PASS (controle é combobox custom) | `87-paginacao-10.png` |
| 12 | Novo pedido: submit vazio mostra os 3 erros | PASS | `11-novo-submit-vazio.png` |
| 13 | Busca de cliente e seleção | PASS | `12-dropdown-cliente.png` |
| 14 | Busca de produto + adicionar item | PASS | `13-busca-produto.png`, `14-item-adicionado.png` |
| 15 | Recálculo ao mudar quantidade (3 × 89,90 = 269,70) | PASS | — |
| 16 | Quantidade 0 → bloqueia submit **sem mensagem** | **FAIL** | `15-qty-zero.png`, `16-submit-qty-zero.png` |
| 17 | Quantidade negativa (-5) → total −R$ 449,50 exibido | **FAIL** | `17-qty-negativa.png` |
| 18 | Quantidade acima do estoque (99.999 / 397) → aviso âmbar, permite criar | PASS (comportamento documentado) | `18-qty-acima-estoque.png` |
| 19 | Desconto por item maior que o item → total negativo na tela | **FAIL** | `19-desconto-maior-que-total.png` |
| 20 | Desconto por item maior que o item → salvar | **FAIL** (400: 188,90 × 199,00) | `96/97-desconto-item-maior-*.png` |
| 21 | Frete soma ao total (179,80 + 10,00 = 189,80) | PASS | `21-dinheiro-sem-conta.png` |
| 22 | Forma à vista sem conta vinculada bloqueia submit com aviso | PASS | `21-dinheiro-sem-conta.png` |
| 23 | Cartão de crédito sem código de autorização → erro no campo | PASS | `23-sem-cod-autorizacao.png` |
| 24 | Criar pedido manual completo (PED-000005) | PASS | `24/25-*.png` |
| 25 | Detalhe: card "Frete" mostra R$ 0,00 com frete de R$ 10,00 | **FAIL** | `30-detalhe-itens.png` |
| 26 | Detalhe → aba Envio | **FAIL** ("Dados de envio não disponíveis") | `32-detalhe-envio.png` |
| 27 | Detalhe → aba Histórico | **FAIL** (sempre vazia) | `34-detalhe-historico.png` |
| 28 | Detalhe → aba Cliente (CPF/telefone sem máscara) | **FAIL** (visual) | `31-detalhe-cliente.png` |
| 29 | Detalhe → aba Financeiro mostra pagamento | PASS | `33-detalhe-financeiro.png` |
| 30 | Condição "3x sem juros" gera 3 parcelas | **FAIL** (1 parcela de R$ 189,80) | `42-financeiro-apos-confirmar.png` |
| 31 | Pedido inexistente → "Pedido não encontrado" | PASS | `35-detalhe-inexistente.png` |
| 32 | PENDING → CONFIRMED reserva estoque (visível em /estoque/produtos) | PASS | `41`, `43-estoque-produtos.png` |
| 33 | CONFIRMED → PICKING | PASS | `45-picking.png` |
| 34 | PICKING → SHIPPED (botão "Marcar como Enviado") | **FAIL** (400 na API) | `46-picking-para-enviado-erro.png` |
| 35 | Existe ação para PACKED / DELIVERED na UI | **FAIL** (não existe) | `45-picking.png` |
| 36 | Cancelar pedido CONFIRMADO estorna estoque | **FAIL** (98 permanece 98) | `53`, `55-estoque-fone-apos-cancelamento.png` |
| 37 | Cancelar pedido CONFIRMADO cancela contas a receber | **FAIL** (R$ 899,80 "Em aberto") | `54`, `56-financeiro-lancamentos.png` |
| 38 | Cancelar pedido PENDENTE pela listagem | PASS | `95`, `98-cancelado-pela-lista.png` |
| 39 | Estorno/devolução de venda balcão (COMPLETED) | **FAIL** (nenhuma ação disponível) | `99-balcao-completed-sem-acoes.png` |
| 40 | Troca de item em pedido CANCELADO é recusada | **FAIL** (executa e corrompe estoque) | `A0`, `A1-troca-cancelado-resultado.png` |
| 41 | PDV: finalizar sem itens (botão desabilitado) | PASS | `60-balcao-inicial.png` |
| 42 | PDV: busca sem resultado | PASS | `61-balcao-busca-vazia.png` |
| 43 | PDV: quantidade acima do estoque bloqueia | PASS | `63-balcao-excede-estoque.png` |
| 44 | PDV: venda sem cliente é recusada | PASS (mas PDV exigir cliente é discutível) | `67-balcao-sem-cliente.png` |
| 45 | PDV: desconto geral aplicado na venda | **FAIL** (400 – valor não enviado) | `65`, `66-balcao-apos-finalizar-com-desconto.png` |
| 46 | PDV: dinheiro com troco (valor recebido > total) | **FAIL** (campo volta ao total) | `68-balcao-troco-uma-linha.png` |
| 47 | PDV: pagamento múltiplo excedente → mensagem de erro | **FAIL** (falha silenciosa) | `69`, `70-balcao-submit-excedente.png` |
| 48 | PDV: pagamento múltiplo exato (149,90 + 149,90) finaliza | PASS | `71`, `72-balcao-finalizada.png` |
| 49 | PDV: baixa direta de estoque (200 → 198) | PASS | `72-balcao-finalizada.png` |
| 50 | PDV: venda em dinheiro com conta vinculada gera recebível PAGO e credita conta | PASS | `74/75/76-*.png` |
| 51 | PDV: venda em dinheiro "legado" (type OTHER) gera recebível PENDENTE | **FAIL** (contabilidade errada, silencioso) | `72-balcao-finalizada.png` |
| 52 | PDV: atalhos de teclado (F2/F4/F9/Esc) | **FAIL** (não existem) | `60-balcao-inicial.png` |
| 53 | Remover item do carrinho (ícone lixeira) | PASS | `65-balcao-pronto-com-desconto.png` |
| 54 | Vendedor: vê listagem de pedidos, sem ações de confirmar/cancelar | PASS | `91-vendedor-vendas-pedidos.png` |
| 55 | Vendedor: consegue registrar venda no balcão / pedido | **FAIL** (403 → bloqueado) | `91-vendedor-vendas-balcao.png` |
| 56 | Vendedor: telas administrativas por URL direta | **FAIL** (parcial: telas abrem vazias) | `92-vendedor-*.png` |
| 57 | Responsivo 390x844 nas 3 telas de vendas | **FAIL** (conteúdo ~126px de largura) | `93-mobile-*.png` |
| 58 | Persistência após F5 (detalhe/estoque) | PASS | `42-financeiro-apos-confirmar.png` |
| 59 | Pedido sem caixa aberto | BLOQUEADO (havia sessões abertas de outro agente durante todo o teste; apenas o aviso do vendedor, causado por 403, foi observado) | `91-vendedor-vendas-balcao.png` |
| 60 | Produto inativo no pedido | BLOQUEADO (base seed não possui produto INACTIVE; a busca já filtra `status=ACTIVE`) | — |
| 61 | Cliente inadimplente/bloqueado | BLOQUEADO (não existe o conceito de bloqueio de cliente no modelo/UI) | — |
| 62 | Exportar CSV da listagem | NÃO TESTADO | — |

---

## 3. Bugs

### 🔴 CRÍTICO

#### BUG-01 — Cancelar pedido confirmado não estorna estoque nem cancela o contas a receber
**Passos**
1. `/vendas/pedidos/novo` → cliente Pedro Bourguignon → 2× "Fone Bluetooth Galaxy Buds FE" → pagamento Boleto R$ 899,80 → Criar Pedido (PED-000006).
2. No detalhe, "Confirmar Pedido". Em `/estoque/produtos`, ELET-002 fica **reservado 2 / disponível 98** (antes 0/100).
3. No detalhe, "Cancelar" → Confirmar. Status vira "Cancelado".
4. Voltar em `/estoque/produtos` e `/financeiro/lancamentos`.

**Esperado:** reserva liberada (disponível volta a 100) e recebível do pedido cancelado com status Cancelado.
**Obtido:** disponível continua **98** (reservado 2 preso para sempre) e o lançamento **"PED-000006 - Boleto R$ 899,80 – Em aberto"** continua ativo no financeiro.
**Evidência:** `53-apos-cancelar.png`, `55-estoque-fone-apos-cancelamento.png`, `54-cancelado-financeiro.png`, `56-financeiro-lancamentos.png`.

**Causa raiz identificada:** a UI cancela chamando `PATCH /orders/:id/status {status:'CANCELLED'}` (`apps/web/hooks/use-orders.ts` → `useUpdateOrderStatus`, usado em `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:161-174` e `apps/web/app/(dashboard)/vendas/pedidos/page.tsx:232-244`). Em `apps/api/src/modules/orders/orders.service.ts`, `updateStatus()` (l. 423-529) emite eventos apenas para `CONFIRMED`, `SHIPPED` e `DELIVERED` — **nunca `order.cancelled`**. O endpoint correto `PATCH /orders/:id/cancel` (`orders.service.ts:534-591`) existe e funciona, mas o frontend nunca o chama.
**Confirmação por API:** criado PED-000010, confirmado (reservado 3 / disponível 47) e cancelado por `PATCH /orders/:id/cancel` → disponível volta a **50** e o recebível vira **CANCELLED**. Ou seja, apenas o caminho usado pela UI está quebrado.

---

#### BUG-02 — Ciclo de vida do pedido trava em "Separando"; venda por pedido nunca baixa estoque
**Passos**
1. Pedido PED-000005 confirmado → "Iniciar Separação" (status Separando).
2. Clicar em "Marcar como Enviado" → Confirmar.

**Esperado:** transição para Enviado (e, na sequência, Entregue), com baixa efetiva de estoque.
**Obtido:** `HTTP 400 — "Cannot transition from PICKING to SHIPPED. Allowed: PACKED, CANCELLED"` e toast genérico "Erro ao atualizar status do pedido". A UI **não possui nenhuma ação para "Embalado" (PACKED)** nem "Cancelar" nesse estado → o pedido fica permanentemente preso em Separando.
**Impacto:** como a baixa real de estoque (`fulfillReservedStock`) só ocorre no evento `order.shipped`, **nenhuma venda por pedido consegue dar saída no estoque pela UI**; o estoque fica eternamente "reservado". Confirmado: PED-000002 e PED-000003 (seed) também estão presos em "Separando".
**Evidência:** `45-picking.png`, `46-picking-para-enviado-erro.png`.
**Arquivos:** `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:99-114` (mapa PICKING→SHIPPED, sem PACKED e sem DELIVERED→RETURNED); `apps/web/app/(dashboard)/vendas/pedidos/page.tsx:176` (ação "Enviar" exibida para CONFIRMED/PICKING); `apps/api/src/modules/orders/orders.service.ts:35-46` (máquina de estados real).

---

#### BUG-03 — Troca de item permitida em pedido CANCELADO: cria estoque fantasma e devolução indevida
**Passos**
1. Abrir um pedido com status **Cancelado** (PED-000010, 3× Galaxy S24, R$ 11.999,70).
2. Aba Itens → botão "Trocar" (visível mesmo em pedido cancelado) → escolher "Capinha iPhone 15 Pro Silicone" → Confirmar troca.

**Esperado:** ação bloqueada (pedido cancelado não pode ser alterado).
**Obtido:** troca executada com sucesso — toast *"Troca realizada com sucesso! Diferença a devolver: R$ 11730.00"*. O pedido cancelado passou a valer R$ 269,70 e o estoque foi corrompido:
- ELET-001 (Galaxy S24): **50 → 53 unidades** (movimento `RETURN / RETURN_CUSTOMER` de 3 un. de mercadoria que nunca saiu — estoque fantasma);
- ACESS-001 (Capinha): **399 → 396** (movimento `EXIT / SALE` de 3 un. reais para um pedido cancelado);
- gerada obrigação de devolução de **R$ 11.730,00**.

**Evidência:** `A0-troca-em-pedido-cancelado.png`, `A1-troca-cancelado-resultado.png`.
**Arquivo:** `apps/api/src/modules/orders/use-cases/exchange-order-item.use-case.ts` — não há validação de `order.status` (só existem checagens de pedido/item/produto/depósito). No front, `apps/web/app/(dashboard)/vendas/pedidos/[id]/page.tsx:370-379` renderiza "Trocar" para todo item, em qualquer status.

---

#### BUG-04 — PDV: "Desconto Geral" nunca é enviado à API; toda venda com desconto falha
**Passos**
1. `/vendas/balcao` → cliente → 2× "Camiseta Nike Dri-FIT" (subtotal R$ 299,80).
2. "Desconto Geral" = R$ 10,00 → Resumo mostra Total **R$ 289,80** e a barra de pagamento fica verde ("Pagamento completo", R$ 289,80/R$ 289,80).
3. Finalizar Venda.

**Esperado:** venda criada com desconto de R$ 10,00 e total R$ 289,80.
**Obtido:** `HTTP 400 POST /orders — "Soma dos pagamentos (289.80) difere do total do pedido (299.80)"`. A venda **não pode ser concluída com nenhum desconto geral**; o estoque não é baixado.
**Evidência:** `65-balcao-pronto-com-desconto.png`, `66-balcao-apos-finalizar-com-desconto.png`.
**Arquivos:** `apps/web/app/(dashboard)/vendas/balcao/page.tsx:303-322` (payload do submit não inclui `discount`); `apps/web/hooks/use-orders.ts` → `CreateOrderPayload` não possui o campo `discount`, embora a API o aceite (`orders.service.ts:211`).

---

### 🟠 ALTO

#### BUG-05 — Parcelamento ignorado: condição "3x sem juros" gera 1 recebível de valor cheio
**Passos:** criar pedido de R$ 189,80 com Cartão de Crédito + condição "3x sem juros" (código AUTH123) → confirmar → aba Financeiro.
**Esperado:** 3 parcelas de R$ 63,27 (30/60/90 dias).
**Obtido:** coluna "Parcelas" exibe **1x** e é criada **uma única conta a receber de R$ 189,80 com vencimento em 30/08/2026**, embora a condição exibida seja "3x sem juros".
**Evidência:** `33-detalhe-financeiro.png`, `42-financeiro-apos-confirmar.png`.
**Causa:** `apps/web/components/forms/payment-selector.tsx` (`handleAdd`) sempre injeta `installments: 1`; o submit envia `installments: p.installments || undefined` → chega `1` na API, e o fallback da API (`orders.service.ts:322-325`, "usar as parcelas da condição se não vier nada") nunca é acionado. Não há campo de parcelas na UI.

#### BUG-06 — Detalhe do pedido: frete zerado, aba Envio e aba Histórico sempre vazias
**Passos:** abrir PED-000005 (criado com frete R$ 10,00 e 3 mudanças de status).
**Esperado:** card "Frete" = R$ 10,00; aba Envio com método/custo; aba Histórico com a timeline.
**Obtido:** card **"Frete R$ 0,00"** (enquanto o total R$ 189,80 já embute o frete → subtotal 179,80 + frete 0,00 ≠ total 189,80 na tela), aba Envio: *"Dados de envio não disponíveis"*, aba Histórico: *"Nenhum histórico disponível"*.
**Evidência:** `30-detalhe-itens.png`, `32-detalhe-envio.png`, `34-detalhe-historico.png`.
**Causa:** contrato de campos divergente — a API retorna `shippingCost`, `shippingMethod`, `trackingCode`, `shippedAt` na raiz e `statusHistory`; a página lê `order.shipping?.cost` / `order.shipping` / `order.history` (`[id]/page.tsx:243-249, 279, 487-497`), que não existem na resposta (confirmado no JSON de `GET /orders/:id`).

#### BUG-07 — Vendedor não consegue registrar vendas (403 nas dependências da tela)
**Passos:** login `vendedor@exemplo.com` → `/vendas/balcao` ou `/vendas/pedidos/novo`.
**Esperado:** perfil de vendedor consegue vender.
**Obtido:** 403 em `GET /payment-methods`, `GET /payment-conditions`, `GET /cash-register-sessions`, `GET /financial-accounts` → nenhuma forma de pagamento no seletor e aviso **falso** "Nenhum caixa aberto" (havia caixas abertos); botão "Finalizar Venda"/"Criar Pedido" permanece desabilitado. O vendedor consegue ver a lista de pedidos (sem ações de confirmar/cancelar — correto), mas **não consegue vender**.
**Evidência:** `91-vendedor-vendas-balcao.png`, `91-vendedor-vendas-pedidos-novo.png`.

#### BUG-08 — PDV sem troco e sem feedback: pagamento maior que o total é bloqueado silenciosamente
**Passos**
1. `/vendas/balcao` com total R$ 299,80, uma linha "Dinheiro" (o rótulo do campo é **"Valor Recebido"**): digitar R$ 350,00 → o campo **volta sozinho para 299,80** (auto-sync de `payment-selector.tsx:73-81`).
2. Com duas linhas (R$ 200,00 + R$ 150,00 = R$ 350,00): a UI mostra **"Troco: R$ 50,20"** e, ao clicar "Finalizar Venda", **nada acontece** — nenhum toast, nenhuma mensagem de validação na tela.

**Esperado:** aceitar valor recebido maior que o total calculando troco (regra básica de PDV) ou, no mínimo, exibir a mensagem de erro.
**Obtido:** impossível registrar venda em dinheiro com troco; bloqueio silencioso (a mensagem "A soma dos pagamentos deve ser igual ao total do pedido" do schema nunca é renderizada).
**Evidência:** `68-balcao-troco-uma-linha.png`, `69-balcao-pagamento-multiplo-excedente.png`, `70-balcao-submit-excedente.png`.

#### BUG-09 — Filtro de período exclui o dia final (não é possível filtrar "hoje")
**Passos:** `/vendas/pedidos` → Filtros → Data Início 31/07/2026 e Data Fim 31/07/2026 (existem 5 pedidos criados nesse dia).
**Esperado:** os 5 pedidos do dia.
**Obtido:** **"Nenhum registro encontrado"**. Também 01/07→31/07 = 0 registros; só 01/07→01/08 retorna os 5.
**Evidência:** `88-filtro-data-hoje.png`, `84-periodo-julho.png`.
**Arquivo:** `apps/api/src/modules/orders/orders.service.ts:88-92` — `lte: new Date(dateTo)` usa 00:00:00 do dia final (falta somar 23:59:59 ou usar `lt` do dia seguinte).

#### BUG-10 — Desconto por item maior que o valor do item: total do front diverge do back e a gravação falha
**Passos:** novo pedido com 1× Capinha (R$ 89,90) + 1× Carregador (R$ 199,00); desconto de R$ 100,00 no primeiro item.
**Esperado:** desconto limitado ao valor do item (ou validação impedindo), com o mesmo total nos dois lados.
**Obtido:** a tela calcula **Subtotal R$ 188,90** (item 1 = −R$ 10,10, negativo) e o pagamento é auto-preenchido com R$ 188,90; a API calcula **R$ 199,00** (`Math.max(totalPrice, 0)` por item, `orders.service.ts:206`) e recusa: `400 — "Soma dos pagamentos (188.90) difere do total do pedido (199.00)"`. Com um item só, o total exibido chega a ficar negativo (−R$ 320,20).
**Evidência:** `19-desconto-maior-que-total.png`, `96-desconto-item-maior-front.png`, `97-desconto-item-maior-erro.png`.

---

### 🟡 MÉDIO

#### BUG-11 — Formas de pagamento duplicadas e indistinguíveis; a "errada" produz contabilidade silenciosamente incorreta
No seletor aparecem duas vezes "Dinheiro", "PIX" e "Cartão de Crédito" (tipos `CASH`/`OTHER`, `PIX`/`OTHER`, `CREDIT_CARD`/`OTHER`), sem nenhuma diferenciação visual. Como no seed nenhum método à vista tem conta vinculada, o operador é empurrado para a opção "legado" (`OTHER`), que **passa na validação e gera lançamento errado**: venda de balcão PED-000007 (R$ 299,80 em Dinheiro + PIX) criou **dois recebíveis PENDENTES com vencimento em 30 dias** e **não creditou nenhuma conta**. Com o método `CASH` corretamente vinculado a uma conta (ajuste feito via API durante o teste), a mesma venda gera recebível **PAGO** e credita a conta (validado: Caixa Principal 48,50 → 247,50). **Evidência:** `64-balcao-dinheiro-bloqueado.png`, `72-balcao-finalizada.png`, `74/75/76-*.png`.
Agravante: a tela `Configurações > Métodos de Pagamento` **não exibe nem permite editar a conta financeira vinculada** (`73-config-pagamentos.png`), justamente o campo que as telas de venda mandam configurar.

#### BUG-12 — Quantidade 0 ou negativa aceita no formulário, sem mensagem
Digitando `0` o subtotal vai a R$ 0,00 e o submit é bloqueado **sem nenhuma mensagem** (só aparece o erro de pagamento). Digitando `-5`, a tela exibe **Subtotal −R$ 449,50** e o item mostra total negativo, sem aviso. O `<input type=number min=1>` não impede a digitação e o erro de `items.N.quantity` não é renderizado em lugar nenhum. **Evidência:** `15-qty-zero.png`, `16-submit-qty-zero.png`, `17-qty-negativa.png`.

#### BUG-13 — Campos de moeda da tabela de itens truncam o valor
Nas colunas "Preço Unit." e "Desconto" o texto é cortado: aparece "R$ 89" (valor real 89,90), "R$ 0,0", "R$ 1₄" — o usuário não consegue ler o preço praticado. Ocorre em `/vendas/pedidos/novo` e `/vendas/balcao` já em 1440px. **Evidência:** `21-dinheiro-sem-conta.png`, `19-desconto-maior-que-total.png`, `66-balcao-apos-finalizar-com-desconto.png`.

#### BUG-14 — Sem cancelamento/estorno de venda de balcão e sem devolução de pedido entregue
Pedido de balcão nasce `COMPLETED` e o detalhe **não oferece nenhuma ação** (nem cancelar, nem estornar, nem devolver) — uma venda errada no PDV não tem como ser revertida pela UI. Do mesmo modo, a transição `DELIVERED → RETURNED`, que existe na API, não tem botão na tela. **Evidência:** `99-balcao-completed-sem-acoes.png`.

#### BUG-15 — Telas de vendas inutilizáveis em 390x844
Em viewport mobile a sidebar continua fixa em 264px e o conteúdo fica com ~126px úteis (medido: `main.clientWidth = 126`, `scrollWidth = 440`). A listagem de pedidos vira uma coluna ilegível e o PDV fica cortado ao meio. Não há menu hambúrguer/off-canvas. **Evidência:** `93-mobile-pedidos.png`, `93-mobile-balcao.png`, `93-mobile-novo.png`.

#### BUG-16 — CPF e telefone exibidos sem máscara no pedido
Aba Cliente mostra `11185874640` e `31999643603` em vez de `111.858.746-40` e `(31) 99964-3603` (contraria a regra de máscaras do próprio `apps/web/CLAUDE.md`). **Evidência:** `31-detalhe-cliente.png`.

#### BUG-17 — Toast genérico esconde o motivo do erro na mudança de status
Ao falhar a transição, a UI mostra apenas "Erro ao atualizar status do pedido. Tente novamente.", enquanto a API devolve a razão exata ("Cannot transition from PICKING to SHIPPED..."). Em `[id]/page.tsx:170-172` o `catch` descarta o erro (o formulário de criação, por contraste, usa `getApiErrorMessage`). **Evidência:** `46-picking-para-enviado-erro.png`.

#### BUG-18 — PDV sem recursos de ponto de venda: nenhum atalho de teclado
Testadas F2, F4, F9 e Esc — nenhuma ação. Não há atalho para buscar produto, alterar quantidade, remover item, ir ao pagamento ou finalizar; o campo de busca só tem `autoFocus` inicial e perde o foco após adicionar um item (é preciso clicar de novo a cada produto). Não há leitura dedicada de código de barras (a busca genérica tem debounce de 300ms). **Evidência:** `60-balcao-inicial.png`.

#### BUG-19 — Mensagem de troca com valor não formatado
Toast exibe "Diferença a devolver: R$ 11730.00" (padrão americano) em vez de "R$ 11.730,00". **Evidência:** `A1-troca-cancelado-resultado.png`.

### 🔵 BAIXO

#### BUG-20 — Aviso de estoque insuficiente inconsistente entre as duas telas
Em `/vendas/pedidos/novo` a condição de "excede estoque" é `qty > stock && stock > 0` (`novo/page.tsx:545`), ou seja, um produto com estoque **zero** e quantidade 10 **não** dispara o destaque âmbar na linha (só o box vermelho no resumo). No PDV a regra é `qty > stock`, correta. **Evidência:** `18-qty-acima-estoque.png`.

#### BUG-21 — Estoque exibido na linha do item é um snapshot da busca
O `availableStock` é congelado no momento em que o produto é adicionado; se outro operador vender no meio, a tela continua mostrando o valor antigo e o aviso de excesso não aparece. (Observado no código, `novo/page.tsx:281-289`; não reproduzido com concorrência real.)

---

## 4. Não testado / fora do escopo desta rodada
- **Exportar CSV** da listagem de pedidos (botão presente, não exercitado).
- **Pedido com caixa fechado**: durante toda a execução havia sessões de caixa abertas (inclusive criadas por outro agente de QA); só foi possível observar o aviso quando o vendedor recebe 403.
- **Produto inativo em pedido**: não há produto `INACTIVE` na base e a busca filtra `status=ACTIVE` — o cenário exigiria criar massa de dados nova.
- **Cliente inadimplente/bloqueado**: o modelo de clientes não possui bloqueio/limite de crédito, portanto não existe regra a testar.
- **Multi-tenant real** (dois tenants distintos): não havia segundo tenant com dados.

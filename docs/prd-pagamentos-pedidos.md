# PRD: Formas de Pagamento nos Pedidos

**Data:** 2026-03-28
**Status:** Rascunho
**Modulo:** Vendas + Financeiro

---

## 1. Contexto

Hoje o sistema cria pedidos sem registrar como o cliente pagou. O `AccountsReceivable` e gerado automaticamente na confirmacao do pedido, mas sem vinculo com forma de pagamento, condicao, parcelas ou conta financeira de destino. Na venda balcao, o caixa nao sabe se recebeu em dinheiro, cartao ou PIX.

Os ERPs de referencia (Bling, Omie, TOTVS Protheus, Sankhya, Odoo) separam dois conceitos fundamentais:

- **Forma de Pagamento**: COMO o cliente paga (Dinheiro, Cartao Credito, PIX, Boleto)
- **Condicao de Pagamento**: QUANDO o cliente paga (A vista, 30/60/90, Entrada + parcelas)

Alem disso, utilizam o conceito de **conta financeira de destino** para rotear o dinheiro recebido ao local correto (caixa fisico, conta bancaria, adquirente de cartao).

---

## 2. Objetivos

1. Registrar a forma de pagamento em todo pedido (obrigatorio)
2. Suportar pagamento dividido (split) — ex: parte dinheiro, parte cartao
3. Rotear cada pagamento para a conta financeira correta
4. Gerar parcelas automaticamente com base na condicao de pagamento
5. Criar contas a receber vinculadas a cada parcela
6. Implementar abertura e fechamento de caixa para operacoes de balcao

---

## 3. Conceitos e Entidades

### 3.1 Forma de Pagamento (PaymentMethod) — ja existe

Representa o meio utilizado pelo cliente. O modelo `PaymentMethod` ja existe no schema com `id`, `name`, `tenantId`, `isActive`.

**Campos a adicionar:**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `type` | Enum `PaymentMethodType` | Categoria: `CASH`, `CREDIT_CARD`, `DEBIT_CARD`, `PIX`, `BOLETO`, `BANK_TRANSFER`, `CHECK`, `STORE_CREDIT`, `OTHER` |
| `defaultAccountId` | FK `FinancialAccount?` | Conta financeira padrao para onde o dinheiro vai |
| `feePercentage` | Decimal? | Taxa do meio (ex: 3.19% cartao credito) |
| `settlementDays` | Int? | Dias para liquidacao (ex: D+30 credito, D+1 debito) |
| `requiresAuthorization` | Boolean | Se exige codigo de autorizacao (cartoes) |
| `fiscalCode` | String? | Codigo fiscal NF-e (01=Dinheiro, 03=Cartao Credito, 04=Cartao Debito, 17=PIX) |

### 3.2 Condicao de Pagamento (PaymentCondition) — novo

Define como o valor e dividido no tempo.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | String (cuid) | |
| `tenantId` | FK Tenant | |
| `name` | String | Ex: "A vista", "30/60/90", "Entrada 30% + 2x" |
| `code` | String | Codigo curto. Ex: "AV", "30-60-90" |
| `type` | Enum | `CASH` (a vista), `INSTALLMENT` (parcelado), `ENTRY_PLUS_INSTALLMENT` |
| `installments` | Int | Numero de parcelas. 1 = a vista |
| `daysBetweenInstallments` | Int | Dias entre parcelas. Ex: 30 |
| `entryPercentage` | Decimal | % de entrada. Ex: 30% para "Entrada + 2x" |
| `isActive` | Boolean | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Exemplos:**

| Nome | type | installments | days | entry% |
|------|------|-------------|------|--------|
| A vista | CASH | 1 | 0 | 100% |
| 30 dias | INSTALLMENT | 1 | 30 | 0% |
| 30/60/90 | INSTALLMENT | 3 | 30 | 0% |
| Entrada 30% + 2x | ENTRY_PLUS_INSTALLMENT | 2 | 30 | 30% |

### 3.3 Pagamento do Pedido (OrderPayment) — novo

Cada registro representa uma "linha de pagamento" do pedido. Suporta split (multiplos pagamentos por pedido).

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | String (cuid) | |
| `tenantId` | FK Tenant | |
| `orderId` | FK Order | |
| `paymentMethodId` | FK PaymentMethod | Forma (Dinheiro, Cartao, PIX) |
| `paymentConditionId` | FK PaymentCondition | Condicao (A vista, 30/60/90) |
| `financialAccountId` | FK FinancialAccount | Conta de destino |
| `amount` | Decimal | Valor deste pagamento |
| `installments` | Int | Qtd parcelas para esta linha |
| `authorizationCode` | String? | Codigo autorizacao cartao |
| `notes` | String? | |
| `createdAt` | DateTime | |

**Regra:** A soma de `amount` de todos os `OrderPayment` de um pedido deve ser igual ao `totalAmount` do pedido.

**Relacao:** `Order 1 → N OrderPayment`

### 3.4 Conta Financeira (FinancialAccount) — ja existe

Ja existe com: `id`, `name`, `type` (CHECKING, SAVINGS, CASH, DIGITAL), `bankName`, `balance`.

**Campos a adicionar:**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `code` | String? | Codigo interno (ex: "CX01", "BB-001") |
| `acceptsDirectSales` | Boolean | Se pode receber vendas diretas (caixas sim, contas de fornecedor nao) |

### 3.5 Caixa / Centro de Caixa (CashRegister) — novo

Representa um ponto de caixa fisico ou virtual. Diferente de `FinancialAccount` — o caixa e operacional (quem operou, quando abriu/fechou). A conta financeira e onde o dinheiro "contabilmente" esta.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | String (cuid) | |
| `tenantId` | FK Tenant | |
| `name` | String | Ex: "Caixa 01", "Caixa Loja Centro" |
| `financialAccountId` | FK FinancialAccount | Conta financeira do tipo CASH vinculada |
| `isActive` | Boolean | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### 3.6 Sessao de Caixa (CashRegisterSession) — novo

Cada abertura/fechamento gera uma sessao.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | String (cuid) | |
| `tenantId` | FK Tenant | |
| `cashRegisterId` | FK CashRegister | |
| `operatorId` | FK User | Quem abriu |
| `closedById` | FK User? | Quem fechou |
| `status` | Enum | `OPEN`, `CLOSED` |
| `openedAt` | DateTime | |
| `closedAt` | DateTime? | |
| `openingBalance` | Decimal | Fundo de troco |
| `closingBalance` | Decimal? | Valor contado no fechamento |
| `expectedBalance` | Decimal? | Valor calculado pelo sistema |
| `difference` | Decimal? | Diferenca (closingBalance - expectedBalance) |
| `notes` | String? | Observacoes do fechamento |

### 3.7 Movimentacao de Caixa (CashRegisterMovement) — novo

Registra suprimentos (entrada) e sangrias (retirada) durante a sessao.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `id` | String (cuid) | |
| `tenantId` | FK Tenant | |
| `sessionId` | FK CashRegisterSession | |
| `type` | Enum | `SUPPLY` (suprimento), `WITHDRAW` (sangria) |
| `amount` | Decimal | |
| `reason` | String | Motivo |
| `performedById` | FK User | |
| `createdAt` | DateTime | |

---

## 4. Fluxos

### 4.1 Venda no Balcao (fluxo principal)

```
1. Operador abre sessao de caixa (se nao houver aberta)
   → Informa fundo de troco
   → Sessao vinculada ao caixa fisico

2. Operador cria venda no balcao
   → Seleciona cliente (obrigatorio)
   → Adiciona produtos
   → Informa forma(s) de pagamento:
      Ex: R$ 100 em Dinheiro + R$ 200 em Cartao Credito (2x)

3. Sistema valida:
   → Soma dos pagamentos = total do pedido
   → Estoque disponivel para todos os itens
   → Sessao de caixa aberta (se pagamento em dinheiro)

4. Sistema cria:
   → Order (status: COMPLETED, origin: BALCAO)
   → OrderPayment[] (uma por forma de pagamento)
   → AccountsReceivable[] (uma por parcela):
      - Dinheiro: 1 parcela, status PAID, dueDate = hoje
      - Cartao 2x: 2 parcelas, status PENDING, dueDates = D+30, D+60
   → FinancialTransaction[] (para pagamentos a vista):
      - Credito na conta do caixa (dinheiro)
   → InventoryMovement[] (saida de estoque)

5. No fechamento do caixa:
   → Sistema calcula totais esperados por forma de pagamento
   → Operador informa valores contados
   → Registra diferenca
```

### 4.2 Pedido Manual (venda a prazo / B2B)

```
1. Vendedor cria pedido
   → Seleciona cliente
   → Adiciona produtos
   → Seleciona condicao de pagamento (ex: 30/60/90 Boleto)
   → Forma de pagamento pode ser definida agora ou no faturamento

2. Pedido confirmado:
   → Estoque reservado
   → AccountsReceivable[] gerados por parcela:
      - 3 parcelas de R$ 333,33, vencimentos D+30, D+60, D+90
      - Status: PENDING
      - PaymentMethod: Boleto

3. Conforme cliente paga cada parcela:
   → Baixa individual no contas a receber
   → FinancialTransaction criada na conta bancaria
```

### 4.3 Abertura e Fechamento de Caixa

```
Abertura:
1. Operador seleciona o caixa (ex: "Caixa 01")
2. Informa fundo de troco (ex: R$ 200,00)
3. Sistema cria CashRegisterSession com status OPEN

Durante operacao:
- Vendas com pagamento em dinheiro/PIX/cartao sao registradas
- Suprimento: gerente deposita mais dinheiro no caixa
- Sangria: retira dinheiro excedente para o cofre

Fechamento:
1. Sistema calcula totais esperados por forma:
   - Dinheiro: fundo + vendas_dinheiro + suprimentos - sangrias
   - Cartao: total vendas_cartao (conferencia)
   - PIX: total vendas_pix (conferencia)
2. Operador informa valores contados por forma
3. Sistema registra diferencas
4. Sessao fechada, nao aceita mais vendas
```

---

## 5. Mudancas na API

### 5.1 Novos Endpoints

**Condicoes de Pagamento:**
- `GET /payment-conditions` — listar
- `POST /payment-conditions` — criar
- `PATCH /payment-conditions/:id` — editar
- `DELETE /payment-conditions/:id` — desativar

**Caixa:**
- `GET /cash-registers` — listar caixas
- `POST /cash-registers` — criar caixa
- `POST /cash-registers/:id/open` — abrir sessao
- `POST /cash-registers/:id/close` — fechar sessao
- `POST /cash-registers/:id/supply` — suprimento
- `POST /cash-registers/:id/withdraw` — sangria
- `GET /cash-registers/:id/session` — sessao atual (aberta)
- `GET /cash-register-sessions` — listar sessoes (historico)
- `GET /cash-register-sessions/:id` — detalhe com totais

**Pagamentos do Pedido (ja incluido no fluxo de criacao):**
- Campo `payments[]` adicionado ao `CreateOrderDto`

### 5.2 Mudancas no CreateOrderDto

```typescript
// Novo campo no CreateOrderDto
payments: CreateOrderPaymentDto[];

// Novo DTO
class CreateOrderPaymentDto {
  paymentMethodId: string;       // obrigatorio
  paymentConditionId?: string;   // opcional (default: a vista)
  financialAccountId?: string;   // opcional (resolve via rota padrao)
  amount: number;                // obrigatorio
  installments?: number;         // opcional (default: da condicao)
  authorizationCode?: string;    // obrigatorio se cartao
}
```

**Validacoes:**
- `payments` obrigatorio e nao vazio
- Soma dos `amount` = `totalAmount` do pedido
- Se `paymentMethod.requiresAuthorization`, `authorizationCode` obrigatorio
- Se pagamento em dinheiro em venda balcao, sessao de caixa deve estar aberta

### 5.3 Mudancas no Event Handler

**OrderCounterSaleEvent:**
- Atual: cria 1 AccountsReceivable generico
- Novo: cria N AccountsReceivable (1 por parcela de cada OrderPayment)
  - Pagamentos a vista (dinheiro, PIX, debito): status `PAID`, cria `FinancialTransaction` imediata
  - Pagamentos a prazo (credito parcelado, boleto): status `PENDING`, com datas de vencimento calculadas

**OrderConfirmedEvent:**
- Mesma logica para pedidos manuais confirmados

---

## 6. Mudancas no Frontend

### 6.1 Venda Balcao — Secao de Pagamento

Adicionar um novo Card **"Pagamento"** entre "Itens da Venda" e "Desconto e Observacoes":

- Botao para adicionar linha de pagamento
- Cada linha: Forma de Pagamento (select) + Condicao (select) + Valor (money input)
- Botao "Valor total restante" para preencher automaticamente
- Validacao visual: barra de progresso mostrando quanto falta pagar
- Se forma = Cartao, exibir campo "Codigo de Autorizacao"
- Se forma = Dinheiro, exibir campo "Valor recebido" e calcular troco

### 6.2 Novo Pedido — Secao de Pagamento

Mesma mecanica do balcao, porem:
- Condicao de pagamento com mais opcoes (30/60/90)
- Preview das parcelas geradas antes de confirmar

### 6.3 Sidebar Resumo — Detalhamento

Adicionar no resumo:
- Lista das formas de pagamento selecionadas com valores
- Alerta se soma != total
- Para balcao com dinheiro: exibir troco

### 6.4 Gestao de Caixa (nova pagina)

**`/financeiro/caixa`**
- Lista de caixas com status (aberto/fechado)
- Botao abrir/fechar sessao
- Historico de sessoes com totais
- Detalhes da sessao: vendas, suprimentos, sangrias, totais por forma

### 6.5 Cadastro de Condicoes de Pagamento (nova pagina)

**`/configuracoes/condicoes-pagamento`**
- CRUD de condicoes com preview de parcelas

### 6.6 Edicao de Formas de Pagamento (ajuste na pagina existente)

- Adicionar campos: tipo, conta padrao, taxa, dias liquidacao, codigo fiscal

---

## 7. Diagrama de Relacionamentos

```
PaymentMethod ──→ FinancialAccount (defaultAccount)
     │
     ↓
OrderPayment ──→ PaymentCondition
     │  │
     │  └──→ FinancialAccount (destino)
     │
     ↓
   Order ──→ AccountsReceivable[] (1 por parcela)
                    │
                    └──→ FinancialTransaction (na baixa)
                              │
                              └──→ FinancialAccount

CashRegister ──→ FinancialAccount (conta do caixa)
     │
     └──→ CashRegisterSession[]
              │
              ├──→ CashRegisterMovement[] (suprimento/sangria)
              └──→ OrderPayment[] (vendas da sessao, quando dinheiro)
```

---

## 8. Fases de Implementacao

### Fase 1 — Fundacao (MVP)
1. Migrar schema: novos campos em PaymentMethod, novos modelos PaymentCondition, OrderPayment
2. Seed com formas e condicoes padrao
3. Endpoint CRUD de condicoes de pagamento
4. Campo `payments[]` no CreateOrderDto com validacoes
5. Gerar AccountsReceivable por parcela (substituir logica atual)
6. UI de pagamento na venda balcao e novo pedido
7. Exibir pagamentos no detalhe do pedido

### Fase 2 — Centro de Caixa
1. Modelos CashRegister, CashRegisterSession, CashRegisterMovement
2. Endpoints de abertura/fechamento/suprimento/sangria
3. Vincular venda balcao a sessao de caixa aberta
4. Pagina de gestao de caixa no frontend
5. Relatorio de fechamento

### Fase 3 — Baixa e Conciliacao
1. Endpoint de baixa (pagamento) de contas a receber
2. Geracao automatica de FinancialTransaction na baixa
3. Pagina de contas a receber com filtros
4. Conciliacao basica com extrato bancario

---

## 9. Fora de Escopo (futuro)

- Integracao com gateways de pagamento (Stone, PagSeguro)
- Importacao de arquivos OFX/CNAB
- Conciliacao automatica com adquirentes de cartao
- Boleto registrado (emissao via banco)
- Nota fiscal (NF-e) vinculada ao pagamento
- Comissao de vendedor por forma de pagamento

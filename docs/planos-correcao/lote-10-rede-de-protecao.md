# Lote 10 — Rede de proteção

> Este ciclo de QA encontrou 78 bugs em 216 cenários manuais. Sem automação, o próximo ciclo encontra os
> mesmos. Este lote transforma os achados em testes que falham antes do merge.
> Estimativa: **3 dias** de infraestrutura + os testes que cada lote entrega junto com sua correção.

---

## 10.1 — Por que este lote existe

Três padrões explicam a maior parte dos 78 bugs, e todos são detectáveis por automação:

| Padrão | Bugs que gerou | Como pegar automaticamente |
|---|---|---|
| Front e back mantêm a **mesma regra em dois lugares** (máquina de estados, fórmula do total, tipos de resposta, mapa de enums) | VD-02, VD-04, VD-06, VD-10, AE-00, AE-13, AE-14, AE-12b | Teste de contrato + fonte única em `packages/*` |
| **Erro tratado como estado vazio ou silêncio** (403 vira lista vazia, submit sem mensagem, toast genérico) | AE-10, AE-28, FN-09, FN-13, VD-08, VD-12, AE-11 | Testes de componente para os estados de erro; lint proibindo `catch` vazio |
| **Data civil convertida como instante** | FN-01, FN-02, VD-09 | Suíte rodando em 3 fusos no CI |

O objetivo não é "cobertura": é ter um teste para cada bug crítico e uma barreira para cada padrão.

---

## 10.2 — Testes de regressão dos críticos (obrigatório junto com cada lote)

Cada bug 🔴/🟠 vira um teste nomeado com o ID do relatório, para rastreabilidade:

```ts
it("AE-01: digitar 1234 no MoneyInput resulta em 12,34", …)
it("VD-01: cancelar pedido confirmado libera a reserva e cancela o recebível", …)
it("VD-02: pedido percorre PENDING→…→COMPLETED e baixa estoque em SHIPPED", …)
it("FN-01: filtro de 31/07 a 31/07 retorna os lançamentos de 31/07", …)
```

Prioridade mínima (não fechar o lote correspondente sem eles): AE-00, AE-01, AE-03, VD-01, VD-02, VD-03,
VD-04, VD-05, FN-01, FN-02, FN-03, FN-04, FN-05, FN-06, AE-04, AE-27.

---

## 10.3 — E2E com Playwright no CI

O ciclo de QA já produziu os scripts (`t01-auth.js` … `s15-filtros.js`) e eles funcionam contra o ambiente
local. Promovê-los a suíte oficial:

**Passos**
1. Adicionar `@playwright/test` em `apps/web` com `playwright.config.ts` (chromium, pt-BR,
   `TZ=America/Sao_Paulo`, base URL configurável, trace/screenshot on failure).
2. Estruturar em `apps/web/e2e/` por jornada, não por tela:
   - `auth.spec.ts` — login válido/inválido, redirect, logout, permissões por papel;
   - `venda-pedido.spec.ts` — pedido do zero até `COMPLETED`, conferindo estoque e financeiro;
   - `venda-balcao.spec.ts` — PDV com desconto, troco e múltiplos pagamentos;
   - `cancelamento.spec.ts` — cancelamento com estorno de estoque e recebível;
   - `financeiro.spec.ts` — lançamento, baixa parcial, estorno, fechamento de caixa;
   - `cadastros.spec.ts` — cliente e produto com validações brasileiras.
3. **Asserção obrigatória em toda jornada**: efeito colateral em outra tela. Foi assim que o QA achou os
   críticos — a mensagem de sucesso mente; o saldo do produto e o título financeiro, não.
4. Instrumentação global: falhar o teste se houver `pageerror`, erro de console ou resposta HTTP ≥ 500
   durante a jornada. Sozinho, isso teria pego AE-00 e AE-09.
5. Massa determinística: banco efêmero por execução (`docker compose` + `prisma migrate deploy` + seed
   dedicado de teste). Nada de depender do estado deixado pela execução anterior.

**CI (GitHub Actions):** job `e2e` rodando em PR contra `main`/`develop`, com serviços Postgres/Redis/MinIO,
build do web e da API, upload de trace nos falhos. Bloqueia merge.

---

## 10.4 — Testes de contrato front × back

A causa de AE-13, AE-14, AE-12b e VD-06 é a mesma: o front redigita o tipo da resposta.

**Passos**
1. Toda resposta de API tipada em `packages/shared-types`, derivada dos DTOs do backend (ou geração a partir
   do Swagger, que já está no projeto via `@nestjs/swagger`).
2. Teste que valida a resposta real contra o schema (zod) de cada endpoint principal — falha quando um campo
   some ou muda de nome.
3. Regra de lint/review: `type XResponse` declarado dentro de `apps/web/app/**` é proibido.

---

## 10.5 — Barreiras de lint e CI

- `eslint-plugin-react-hooks` com `rules-of-hooks: error` (pega AE-09).
- Regra proibindo `catch {}` vazio e `catch` que não usa o erro (pega a família de falhas silenciosas).
- Suíte de testes rodando com `TZ=UTC`, `TZ=America/Sao_Paulo` e `TZ=Asia/Tokyo` (pega a família de fuso).
- `npm run build` + `lint` + `test` + `e2e` obrigatórios no PR.
- Verificação simples de dívida: falhar o build se aparecer `TODO: integrate with API` ou `MOCK_` em
  `apps/web/app`.

---

## 10.6 — Próximo ciclo de QA

Depois dos lotes 1–9, repetir o ciclo com a mesma metodologia (3 QAs especialistas + Playwright + evidência
em tela), cobrindo o que ficou de fora desta rodada:

expiração real do JWT com refresh em background · upload de imagem de produto · importação CSV (clientes,
produtos, despesas) · variações de produto · exportação CSV de pedidos · isolamento multi-tenant real (exige
um segundo tenant no seed) · concorrência (duas baixas simultâneas do mesmo título; dois operadores vendendo
o mesmo saldo) · módulos `purchases`, `fiscal`, `reports`, `notifications` e `imports`, hoje sem tela no menu.

**Preparação necessária:** criar um segundo tenant no seed e um seed específico de QA com produto inativo,
cliente inadimplente e títulos vencidos — três cenários que ficaram **bloqueados** nesta rodada por falta de
massa de dados.

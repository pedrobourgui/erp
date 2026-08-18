# Lote 5 — Integridade financeira

> O módulo financeiro acerta a aritmética (todos os somatórios conferidos batem com a soma das linhas),
> mas falha nas **regras de proteção**: nada é reversível, nada vence, o caixa aceita saldo negativo e
> não conversa com as contas. Estimativa: **5 dias**. Depende do lote 3 (helper de datas).

| Bug | Sev. | Resumo |
|---|---|---|
| FN-03 | 🟠 Alto | Títulos vencidos nunca ficam `OVERDUE` |
| FN-04 | 🟠 Alto | Não existe estorno de baixa nem edição/exclusão de lançamento |
| FN-05 | 🟠 Alto | Dois caixas abertos simultaneamente |
| FN-06 | 🟠 Alto | Sangria maior que o saldo aceita → caixa em −R$ 4.999.300,00 |
| FN-11 | 🟡 Médio | Histórico de sessões não invalida cache após fechar o caixa |
| FN-12 | 🟡 Médio | Transferência entre contas próprias infla Receitas **e** Despesas |
| FN-15 | 🟡 Médio | Caixa físico e conta financeira totalmente desconectados |
| FN-16 | 🟡 Médio | Contas com nome/código duplicados; sem exclusão/inativação |
| FN-17 | 🟡 Médio | Transferência e baixa deixam conta negativa sem aviso |
| FN-20 | 🟡 Médio | Coluna "Conta" fica "-" em todo título originado de pedido |
| FN-28 | 🔵 Baixo | Ruído de ponto flutuante vazando na API (`708.9000000000001`) |
| VD-11 | 🟡 Médio | Métodos de pagamento duplicados; o "legado" gera contabilidade errada em silêncio |

---

## 5.1 — FN-03: status `OVERDUE`

`grep -rn "OVERDUE" apps/api/src` só encontra o enum em listas de status permitidos. **Nenhum código
promove um título a vencido** — os recebíveis do seed vencem em março/abril e continuam "Em aberto".

**Decisão de projeto:** derivar em tempo de leitura **e** materializar por job. Só derivar na leitura
deixa relatórios e filtros inconsistentes; só o job deixa uma janela de até 24 h.

**Passos**
1. Em `mapReceivable`/`mapPayable` (`financial-entries.service.ts:453-501`), derivar:
   `status === 'PENDING' && dueDate < hoje(fuso do tenant) → 'OVERDUE'`. Usar o helper do lote 3.
2. Criar `@Cron('0 5 * * *')` (05:00 no fuso do tenant) que materializa `status = OVERDUE` para os títulos
   vencidos — usando `@nestjs/schedule`, já instalado.
3. Aceitar `status=OVERDUE` no filtro da listagem e no cálculo dos totalizadores ("Vencidos" como card próprio).
4. No front, badge vermelho + linha destacada, e ordenação default trazendo os vencidos primeiro.

**Aceite:** título com vencimento de ontem aparece como **Vencido** imediatamente após a virada do dia, na
lista, no filtro e no card de totais.

---

## 5.2 — FN-04: reversibilidade (o mais importante do lote)

`financial-entries.controller.ts` só expõe `GET /`, `POST /` e `POST /:id/settle`. Uma baixa com valor ou
conta errada **só se corrige no banco**. Inaceitável em ERP financeiro.

**Passos**
1. `POST /financial-entries/:id/settlements/:settlementId/reverse` — estorna uma baixa:
   - devolve o saldo em aberto do título e reverte o status (`PAID`/`PARTIAL` → `PENDING`/`PARTIAL`);
   - cria a `FinancialTransaction` **contrária** (nunca apaga a original — estorno é lançamento novo);
   - exige motivo e grava usuário + timestamp.
2. `PATCH /financial-entries/:id` — edição restrita a título **sem baixa** (descrição, vencimento, valor,
   categoria). Com baixa: só descrição/categoria.
3. `DELETE /financial-entries/:id` — **soft delete**, e apenas para título sem baixa e sem origem em pedido.
4. Nunca permitir alterar título gerado por pedido sem passar pelo fluxo do pedido (evita divergência com o lote 2).
5. Registrar tudo no módulo `audit` (já existe em `apps/api/src/modules/audit`).
6. Front: menu de ações por linha — "Estornar baixa", "Editar", "Excluir" — respeitando `isSettleable()`
   (`lancamentos/page.tsx:100-111`) e as permissões do lote 4.

**Aceite:** baixa de R$ 100 em título de R$ 300 pode ser estornada; saldo volta a R$ 300; a conta é
creditada de volta; as duas transações (baixa e estorno) aparecem no histórico; o total da tela fecha.

**Teste:** `financial-entries.service.spec.ts` — estorno de baixa parcial, de baixa total, tentativa de
estorno duplicado (deve falhar) e conferência de saldo da conta.

---

## 5.3 — FN-05 + FN-06 + FN-15 + FN-11: caixa

**FN-05 — sessão única por tenant** (`cash-registers.service.ts:184-192`)
A checagem é por `cashRegisterId`, mas `closeSession` (l. 253-259) documenta a premissa oposta: *"one open
session per tenant, so counter sales are stamped with this session id at creation"*. Com dois caixas
abertos, as vendas em dinheiro são carimbadas na sessão errada.
→ Escolher **uma** semântica e implementá-la inteira:
- **(a) recomendada** — múltiplos caixas simultâneos são legítimos (loja com 2 PDVs); então a venda precisa
  informar **qual** sessão (`cashRegisterSessionId` no payload do PDV, selecionado no login do operador).
- (b) sessão única por tenant — bloquear a segunda abertura com 409.
A opção (a) é mais realista para varejo; exige campo no PDV e migração dos pedidos existentes.

**FN-06 — sangria maior que o saldo** (`withdraw`, l. 328-355)
Nenhuma checagem contra `openingBalance + suprimentos − sangrias`. O caixa foi a −R$ 4.999.300,00 e o
fechamento apurou "diferença" de R$ 5.000.300,00 exibida **em verde**, como sobra.
→ Validar saldo suficiente antes de registrar; mensagem "Saldo insuficiente no caixa (disponível: R$ X)".
→ No fechamento, colorir por natureza: sobra = verde, **falta = vermelho**, e nunca pintar de verde uma
divergência absurda. Definir tolerância configurável (ex.: R$ 5,00) e exigir justificativa acima dela.

**FN-15 — caixa × conta financeira**
`openSession`, `supply`, `withdraw` e `closeSession` não tocam em `FinancialAccount` nem criam
`FinancialTransaction` — a Conta Digital vinculada ficou em R$ 0,00 depois de todo o ciclo.
→ Cada operação de caixa gera lançamento na conta vinculada: abertura (transferência da conta para o
caixa), suprimento (débito na conta / crédito no caixa), sangria (crédito na conta / débito no caixa),
fechamento (consolidação). Sem isso não existe conciliação.

**FN-11 — cache** (`apps/web/hooks/use-cash-registers.ts:120/145/172/199/226`)
Todas as mutations invalidam só `cashRegisterKeys.lists()`; a tabela de sessões usa
`cashRegisterKeys.sessionList(params)`, que nunca é invalidada — o operador fecha o caixa e a tela continua
"Aberto".
→ Invalidar o prefixo `["cash-registers"]` inteiro nas mutations, ou listar explicitamente as chaves de
sessão. Adicionar teste de invalidação (o padrão do `apps/web/CLAUDE.md` já pede teste de cache em hooks).

---

## 5.4 — FN-12 + FN-17 + FN-16 + FN-20 + FN-28: contas e classificação

**FN-12 — transferência não é receita nem despesa**
(`financial-entries.service.ts:320-337` e `mapTransaction:434-451` — todo `CREDIT` vira REVENUE, todo
`DEBIT` vira EXPENSE.) Uma transferência de R$ 250 entre contas próprias subiu Receitas **e** Despesas.
→ Marcar as transações de transferência (`referenceType`) e excluí-las de `computeTotals`; exibi-las na
lista com tipo próprio "Transferência" e cor neutra. Isso corrige a DRE/faturamento inflado.

**FN-17 — saldo negativo sem aviso**
Transferência de conta zerada deixou Santander em −R$ 250,00; baixa deixou BB em −R$ 300,00.
→ Para conta do tipo **Caixa** (dinheiro físico), bloquear saldo negativo — é fisicamente impossível.
→ Para conta bancária, permitir (existe limite/cheque especial), mas exigir confirmação explícita e exibir
o saldo em vermelho. Se houver campo de limite, validar contra ele.

**FN-16 — duplicidade e ciclo de vida da conta**
Nome + código repetidos são aceitos ("Banco do Brasil | BB" duas vezes), deixando os combos ambíguos; e não
existe DELETE.
→ Índice único `(tenantId, code)` e validação de nome duplicado com 409 em pt-BR; ação de **inativar**
(conta com movimento nunca deve ser excluída) e soft delete para conta sem movimento.

**FN-20 — coluna "Conta" vazia**
`mapReceivable:460-463` depende de `orderPayment.financialAccountId` ou `paymentMethod.defaultAccountId`, e
nenhum método do seed tem conta default → "-" em todos os títulos de pedido e campo "Conta creditada"
vazio a cada baixa.
→ Tornar `defaultAccountId` **obrigatório** para métodos à vista (validação na criação/edição do método —
a tela vem no lote 8); corrigir o seed; e, na ausência, exibir a conta do pedido em vez de "-".

**FN-28 — arredondamento**
`computeTotals` (l. 419-423) soma em `Number` e a API devolveu `"balance": 708.9000000000001`.
→ Padronizar dinheiro no backend: somar em centavos (inteiros) ou usar `Prisma.Decimal` de ponta a ponta, e
aplicar `round2` na fronteira da API. Documentar a regra no `apps/api/CLAUDE.md`.

---

## 5.5 — VD-11: métodos de pagamento duplicados e "legado"

O seletor mostra duas vezes "Dinheiro", "PIX" e "Cartão de Crédito" (tipos corretos e tipo `OTHER`), sem
diferenciação. Como nenhum método à vista tem conta vinculada, o operador é empurrado para o `OTHER`, que
**passa na validação** e gera contabilidade errada: PED-000007 (R$ 299,80 em dinheiro + PIX) criou dois
recebíveis **pendentes** com vencimento em 30 dias e não creditou conta nenhuma. Com o método `CASH`
corretamente vinculado, a mesma venda gera recebível **pago** e credita a conta.

**Passos**
1. Limpar a duplicidade no seed e criar migration que consolide métodos `OTHER` que espelham um tipo real.
2. Validar na criação/edição: método com `type` à vista exige `defaultAccountId` (ligado a FN-20).
3. Exibir o tipo do método no seletor, para dois itens homônimos nunca ficarem indistinguíveis.
4. Bloquear a venda quando o método escolhido não permitir a liquidação correta, com mensagem explícita
   (hoje o erro é silencioso — vira contabilidade errada, não erro).

---

## Checklist de saída do lote

- [ ] Um título vencido aparece como Vencido em lista, filtro e totalizador
- [ ] Toda baixa pode ser estornada e o estorno aparece como lançamento próprio
- [ ] Caixa não fica negativo; fechamento distingue sobra de falta; movimentos refletem na conta vinculada
- [ ] Transferência interna não altera Receitas/Despesas
- [ ] `GET /financial-entries` não devolve mais floats com ruído
- [ ] Conciliação manual de um dia inteiro (venda → recebível → baixa → conta → caixa) fecha sem divergência

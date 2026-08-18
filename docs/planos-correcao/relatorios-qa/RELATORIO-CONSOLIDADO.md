# Relatório Consolidado de QA — ERP

Data: 31/07/2026 · Branch: `feat/scrum-backlog-afazer` · Commit base: `c7c5568`
Ambiente: Next.js 14 (:3000) + NestJS (:3001) + Postgres/Redis/MinIO em Docker, banco migrado e seedado.
Método: 3 QAs especialistas em ERP, navegador real (Playwright/Chromium), com captura de console errors,
`pageerror` e respostas HTTP ≥ 400. Nenhum arquivo do projeto foi alterado.

| Domínio | Cenários | PASS | FAIL | Bloq./Parcial | Screenshots | Relatório |
|---|---|---|---|---|---|---|
| Auth + Cadastros + Estoque | 107 | 57 | 47 | 3 | 140 | `relatorio-auth-estoque.md` |
| Vendas + Pedidos + PDV | 62 | 27 | 22 | 4 | 81 | `relatorio-vendas.md` |
| Financeiro + Config + Navegação | 47 | 28 | 18 | 1 | 117 | `relatorio-financeiro.md` |
| **Total** | **216** | **112** | **87** | **8** | **338** | — |

Bugs abertos: **6 Críticos · 27 Altos · ~21 Médios · ~8 Baixos**

---

## 1. Críticos (bloqueiam uso do ERP)

| # | Bug | Domínio | Onde |
|---|---|---|---|
| C1 | `/estoque/movimentacoes` dá white-screen: `typeConfig` cobre 4 dos 6 tipos do enum Prisma; uma movimentação `RETURN` (gerada pelo próprio sistema) quebra a página | Estoque | `apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:29,81-83` |
| C2 | `MoneyInput` grava valores errados por ordem de grandeza: digitar `1234` grava R$ 12.300,04; `199990` vira R$ 1.990.009,90. Afeta custo/venda/promocional em todo o sistema | Transversal | `apps/web/components/forms/money-input.tsx:32-38,66-70` |
| C3 | Cancelar pedido confirmado não estorna estoque nem cancela o recebível — UI chama `PATCH /orders/:id/status` (não emite `order.cancelled`) em vez de `PATCH /orders/:id/cancel` | Vendas | front do detalhe de pedido |
| C4 | Ciclo de vida trava em "Separando": UI oferece PICKING→SHIPPED, API só aceita PACKED e não há botão "Embalado". Como a baixa de estoque depende de `order.shipped`, nenhum pedido dá saída de estoque pela interface | Vendas | fluxo de status |
| C5 | Pedido **cancelado** aceita troca de item: total foi de R$ 11.999,70 → R$ 269,70, criou 3 un. de estoque fantasma e gerou devolução de R$ 11.730,00 | Vendas | `orders` (falta guard de status) |
| C6 | PDV nunca envia o "Desconto Geral" à API: toda venda de balcão com desconto falha com `400 – Soma dos pagamentos difere do total do pedido` | PDV | `/vendas/balcao` |

## 2. Altos

**Integridade de dados / regra de negócio**
- CPF `111.111.111-11` e CNPJ `11.111.111/1111-11` são aceitos (front e back só contam dígitos).
- Produto **com saldo** é excluído sem bloqueio; alerta de estoque fica órfão.
- Preço de venda menor que o custo aceito sem aviso.
- NCM `ABCDEFG` e EAN `123` aceitos; não existe campo CFOP.
- Condição "3x sem juros" gera **1 único recebível** (`installments` fixo em 1 no `PaymentSelector`).
- Desconto por item maior que o item: front calcula negativo (R$ 188,90), back R$ 199,00 → 400 ao salvar.
- Sangria maior que o saldo do caixa é aceita — caixa foi a −R$ 4.999.300,00 e o fechamento pintou a divergência de verde.
- Dois caixas abertos simultaneamente são permitidos, contrariando a premissa do próprio `closeSession`.
- Título vencido nunca é promovido a `OVERDUE` — não há código que faça isso; sem visão de inadimplência.
- Não existe estorno de baixa nem edição/exclusão de lançamento: baixa errada é irreversível.

**Datas / fuso (padrão sistêmico)**
- Filtro de período do financeiro descarta quase todo o último dia (`financial-entries.service.ts:309-318`: parse UTC + `setHours` local).
- Filtro "hoje" em pedidos retorna 0 de 5 (`orders.service.ts:88-92`, `lte` com 00:00).
- Todas as datas do financeiro exibem **1 dia a menos** (meia-noite UTC renderizada em horário local).

**Autenticação / permissão**
- Senha errada e e-mail inexistente não exibem erro: o interceptor 401 do axios trata o 401 do próprio `/auth/login` como token expirado e redireciona, apagando a mensagem (`apps/web/lib/api.ts:49,88`).
- Frontend sem gating de permissão: o vendedor vê o menu completo, o **dashboard financeiro inteiro** e abre todas as rotas administrativas por URL direta. O backend barra (403 em todos os endpoints financeiros — nenhum dado vazou), o que produz estados vazios enganosos ("Nenhum caixa cadastrado" com 2 caixas) e botões habilitados que sempre falham.
- Vendedor **não consegue vender**: 403 em payment-methods/conditions/cash-register-sessions → seletor vazio e aviso falso de "nenhum caixa aberto".

**Funcionalidade ausente apresentada como pronta**
- `/configuracoes` → "Dados da Empresa": `onSubmit` é `// TODO: integrate with API`; nada carrega, nada salva.
- Abas Usuários e Plano exibem mock hardcoded (João Silva/Maria Santos, "245/500 produtos").
- Transferência entre depósitos e Ajuste não existem na UI (o backend tem `POST /inventory/transfer`).
- Não existe edição de cliente (`/clientes/[id]/edit` = 404).
- Detalhe do pedido: card Frete R$ 0,00 com frete de R$ 10,00; abas Envio e Histórico sempre vazias (front lê `shipping`/`history`, API devolve `shippingCost`/`statusHistory`).
- PDV sem troco funcional: valor recebido volta sozinho ao total; com múltiplas linhas mostra "Troco: R$ 50,20" e o botão não responde nem exibe erro.

**UI / código**
- Mobile 390×844 inutilizável nos três domínios: sidebar fixa de 264px sem drawer, conteúdo cortado sem scroll.
- Nome de produto de 255 chars (permitido) estoura a tabela e joga Preço/Estoque/Status/Ações para fora da tela.
- Violações das Rules of Hooks em `clientes/[id]/page.tsx:72` e `ui/confirm-dialog.tsx:40 vs 59` (afeta todo diálogo de confirmação).

## 3. Médios e baixos (resumo)

Histórico de sessões de caixa não invalida cache (fechamento parece não ter ocorrido até F5); transferência
entre contas próprias infla Receitas **e** Despesas; caixa físico desconectado da conta financeira; métodos de
pagamento duplicados geram contabilidade errada em silêncio; validações numéricas de métodos/condições falham
sem feedback; modal de condição com 999 parcelas estoura a viewport e deixa os botões inacessíveis; contas com
nome/código duplicados aceitas; 404 cru do Next em inglês nas rotas-pai do menu (`/financeiro`, `/vendas`,
`/estoque`); quantidade negativa sem validação visível no PDV; inputs de moeda truncados; venda de balcão sem
estorno; CPF/telefone sem máscara em algumas telas; toast que esconde o erro real da API; PDV sem atalhos de teclado.

## 4. O que funcionou bem

- Guard de saldo negativo no estoque: saída maior que o saldo é bloqueada e o saldo permanece intacto.
- Entrada/saída de estoque refletem corretamente no card do produto e nos KPIs; alertas de mínimo funcionam.
- Bloqueio de exclusão de categoria/marca em uso; unicidade de SKU, documento e e-mail.
- Paginação, ordenação e busca server-side; máscaras de CPF/CNPJ/telefone/CEP; dark mode.
- Financeiro: baixa parcial e total com bloqueio de valor acima do saldo em aberto; somatórios da tela batendo
  exatamente com a soma das linhas; transferência atômica entre contas; filtros de tipo/conta/status; troca de senha.
- Segurança de backend: todos os endpoints financeiros retornam 403 para o vendedor — nenhum dado vazou.
- Redirect para `/login` em rota protegida sem sessão.

## 5. Temas transversais (atacar a causa, não o sintoma)

1. **Fuso horário**: pelo menos 3 bugs distintos vêm do mesmo padrão de misturar parse UTC com `setHours`/render local. Vale uma camada única de normalização de data.
2. **Autorização no frontend**: o backend está correto; falta o espelho no front (menu, botões e rotas por permissão).
3. **Eventos de domínio**: cancelamento/estorno dependem de eventos (`order.cancelled`, `order.shipped`) que a UI não dispara — o ciclo de vida do pedido precisa ser reconciliado entre front e API.
4. **Máquina de estados do pedido**: falta guard de status (pedido cancelado aceita edição) e faltam transições na UI.
5. **Responsividade**: o layout do dashboard nunca foi adaptado para mobile.

## 6. Pendências de teste

Não cobertos: expiração real do JWT, upload de imagens, importação CSV, variações de produto, filtros de
movimentações (bloqueados pelo C1), módulos `purchases`, `fiscal`, `reports`, `notifications` e `imports`
(sem tela correspondente no menu atual).

## 7. Estado do ambiente após os testes

- Massa de teste criada no banco: pedidos PED-000005 a PED-000010, clientes/produtos de teste, sessões de caixa
  com valores extremos (caixa negativo em −R$ 4.999.300,00), títulos e lançamentos.
- Alteração de configuração via API: método de pagamento CASH recebeu `defaultAccountId` = "Caixa Principal"
  (vinha `null` no seed). Reversível.
- Para zerar tudo: `npm run db:seed` (ou recriar o volume do Postgres).

# Relatório de QA — Domínio FINANCEIRO + CONFIGURAÇÕES + NAVEGAÇÃO GERAL

**Data:** 31/07/2026 · **Ambiente:** localhost:3000 (web) / localhost:3001/api/v1 (API), tenant `seed-tenant-001`
**Ferramenta:** Playwright 1.62.1 (Chromium headless, 1440x900 e 390x844, locale pt-BR, TZ do host = **America/Sao_Paulo (-03)**)
**Evidências:** `/private/tmp/claude-502/-Users-mac-work-erp/e36bf272-20da-4da1-8c84-9d256825cf51/scratchpad/qa/shots/financeiro/` (117 PNGs, todos abertos e avaliados visualmente)
**Scripts:** `s01-nav.js`, `s02b-lanc.js`, `s03-baixa.js`, `s04..s07` (caixa), `s08-transf.js`, `s09-config.js`, `s10-cond-perfil.js`, `s11-perfil.js`, `s12-geral.js`, `s13-vendedor.js`, `s14-mini.js`, `s15-filtros.js` na mesma pasta.

> **Nota sobre massa de dados:** outros agentes de QA estavam operando o mesmo tenant em paralelo (pedidos PED-000005..PED-000010 surgiram durante a execução). Isso não invalida nenhum achado — todos os bugs abaixo foram reproduzidos com dados criados por mim ou confirmados via API.

---

## 1. Resumo

### O que funciona bem
- **Baixa (liquidação) de títulos** — parcial e total: recalcula saldo em aberto, muda o status para `Parcial`/`Pago`, gera a `FinancialTransaction` correspondente e debita/credita a conta financeira corretamente. Bloqueia baixa maior que o saldo em aberto com mensagem clara e específica.
- **Somatórios da tela de Despesas e Receitas batem exatamente** com a soma das linhas exibidas (conferido em 4 combinações de filtro; ver §4-W/Z). Títulos em aberto entram pelo saldo residual, não pelo valor de face — não há dupla contagem após baixa parcial.
- **Transferência entre contas**: atômica, valida origem ≠ destino e valor > 0, gera os dois lançamentos espelhados.
- **Filtros** de tipo, conta e status funcionam e recalculam totalizadores coerentemente.
- **Troca de senha** (/configuracoes/perfil): senha atual errada, confirmação divergente e senha curta todas tratadas com mensagem correta em português.
- **Permissões no backend**: o vendedor recebe `403 Permissão insuficiente` em **todos** os endpoints financeiros e de configuração (leitura e escrita). Não houve vazamento de dado.
- **Sessão**: rota protegida deslogado redireciona para `/login`.
- **Tema claro/escuro** funciona e o dark mode está visualmente consistente.
- Persistência confirmada com F5 em: criação/edição de conta financeira, lançamentos, baixas, sessões de caixa.

### O que está quebrado
- **Datas erradas em 1 dia** em toda a tela financeira (vencimentos e datas de lançamento) por mistura de UTC/local.
- **Filtro de período perde o último dia** — o mesmo bug de fuso, no backend. Relatório financeiro por período é inconfiável.
- **Títulos vencidos nunca aparecem como "Vencido"** — não existe nenhum código que promova um título a `OVERDUE`.
- **Não há estorno de baixa nem exclusão/edição de lançamento** — erro de digitação em uma baixa é irreversível pela aplicação.
- **Caixa aceita sangria maior que o saldo** (caixa ficou em -R$ 4.999.300,00) e **permite dois caixas abertos ao mesmo tempo**, quebrando a premissa que o próprio backend documenta.
- **Histórico de sessões de caixa não atualiza** após abrir/fechar (cache não invalidado) — o operador fecha o caixa e a tela continua mostrando "Aberto", sem a diferença apurada.
- **/configuracoes é uma tela de fachada**: Dados da Empresa não carrega nem salva (`// TODO: integrate with API`), abas Usuários e Plano exibem dados MOCK hardcoded.
- **Frontend não faz gating de permissão**: o vendedor navega por todas as telas administrativas, com menu completo e botões habilitados, vendo estados vazios enganosos ("Nenhuma conta financeira cadastrada").
- **Mobile (390x844) inutilizável**: sidebar fixa de 264px sem drawer, conteúdo cortado.
- **Transferência entre contas próprias infla Receitas e Despesas** nos totalizadores.
- Validações numéricas de métodos/condições de pagamento **falham em silêncio**.

**Contagem:** 47 cenários executados — **28 PASS / 18 FAIL / 1 BLOQUEADO**.
**Bugs:** 0 Críticos · 10 Altos · 10 Médios · 8 Baixos.

---

## 2. Cenários executados

| # | Cenário | Resultado | Evidência (PNG) |
|---|---|---|---|
| **NAVEGAÇÃO** ||||
| 1 | Percorrer todos os 21 itens/rotas do menu lateral logado como admin | **PASS** (nenhum erro de runtime; todas as folhas 200) | `01`..`21-*.png` |
| 2 | Rota inexistente `/xyz` → 404 amigável | **FAIL** | `22-rota-inexistente.png` |
| 3 | Rotas-pai `/financeiro`, `/vendas`, `/estoque` (nós do menu) | **FAIL** (404 cru do Next) | `14-financeiro-index.png`, `09-vendas-index.png` |
| 4 | `/clientes/999999` → 404 amigável | **PASS** ("Cliente não encontrado" + Voltar, dentro do shell) | `23-cliente-id-invalido.png` |
| 5 | `/vendas/pedidos/abc` → 404 amigável | **PASS** | `24-pedido-id-invalido.png` |
| 6 | `/estoque/produtos/999999` → 404 amigável | **PASS** | `25-produto-id-invalido.png` |
| 7 | Rota protegida deslogado → /login | **PASS** | `109-deslogado-redirect.png` |
| 8 | Toggle de tema claro/escuro | **PASS** | `107-tema-escuro.png` |
| 9 | Estado ativo do menu (pai + filho) | **PASS** | `107-tema-escuro.png` |
| 10 | Breadcrumbs | **FAIL** (não existem em nenhuma tela) | `15-fin-contas.png` |
| 11 | Responsividade 390x844 (menu + tabelas) | **FAIL** | `M1-contas.png`, `M2-lancamentos.png`, `M3-caixa.png` |
| **FINANCEIRO / CONTAS** ||||
| 12 | Listar contas financeiras + saldos | **PASS** | `15-fin-contas.png` |
| 13 | Criar conta — validação de nome obrigatório | **PASS** | `78-nova-conta-validacao.png` |
| 14 | Criar conta com nome + código já existentes | **FAIL** (duplicata aceita) | `79-conta-duplicada.png` |
| 15 | Editar conta e confirmar persistência com F5 | **PASS** | `76`,`77-conta-editada-f5.png` |
| 16 | Excluir/inativar conta | **BLOQUEADO** (não existe DELETE nem ação de inativar na tabela) | `15-fin-contas.png` |
| 17 | Transferência — origem = destino e valor zero | **PASS** (dois erros corretos) | `72-transfer-mesma-conta-valor-zero.png` |
| 18 | Transferência válida R$ 250,00 (atômica, 2 lançamentos) | **PASS** | `73`,`74`,`75-*.png` |
| 19 | Transferência com saldo insuficiente | **FAIL** (conta foi a -R$ 250,00 sem aviso) | `74-transfer-resultado.png` |
| 20 | Transferência não deve contar como receita/despesa | **FAIL** | `75-lancamentos-apos-transfer.png` |
| 21 | Diálogo "Importar Despesas" (CSV) abre e descreve colunas | **PASS** | `114-importar-despesas.png` |
| **FINANCEIRO / LANÇAMENTOS** ||||
| 22 | Novo lançamento — form vazio (obrigatórios) | **PASS** ("Valor deve ser maior que zero", "Conta obrigatória") | `31-novo-lanc-validacao-vazio.png` |
| 23 | Valor negativo (-100) | **PASS** (rejeitado) | `32-novo-lanc-valor-negativo.png` |
| 24 | Criar despesa à vista com categoria (plano de contas) | **PASS** | `33`,`34-*.png` |
| 25 | Saldo da conta atualizado após lançamento à vista | **PASS** (Caixa Principal -R$ 150,50) | `35-contas-apos-despesa.png` |
| 26 | Lançamento a prazo sem vencimento | **PASS** (exige vencimento) | `37-lanc-aprazo-validacao-vencimento.png` |
| 27 | Data exibida = data informada | **FAIL** (informado 31/07 → exibe 30/07; 15/01 → 14/01) | `34`,`38-*.png` |
| 28 | Título com vencimento no passado marcado como Vencido | **FAIL** (fica "Em aberto") | `38-apos-criar-payable-vencido.png` |
| 29 | Destaque visual de títulos vencidos | **FAIL** (inexistente) | `16-fin-lancamentos.png` |
| 30 | Baixa com valor > saldo em aberto | **PASS** (400 com mensagem específica) | `41-baixa-valor-maior-que-saldo.png` |
| 31 | Baixa parcial (R$ 100 de R$ 300) → status Parcial, resta R$ 200 | **PASS** | `42`,`43-*.png` |
| 32 | Saldo da conta debitado na baixa parcial | **PASS** | `44-contas-apos-baixa-parcial.png` |
| 33 | Baixa total do restante → status Pago, some da lista de abertos | **PASS** | `45`,`46-*.png` |
| 34 | Estornar uma baixa | **FAIL** (não existe endpoint nem UI) | `46-apos-baixa-total.png` |
| 35 | Excluir/editar um lançamento | **FAIL** (não existe) | `46-apos-baixa-total.png` |
| 36 | Somatórios da tela = soma das linhas | **PASS** (15 linhas: R$ 3.007,00 / R$ 12.430,50 conferidos manualmente) | `110-somatorios.png` |
| 37 | Filtro por status (Pago / Em aberto) | **PASS** | `47-filtro-status-pago.png` |
| 38 | Filtro por conta | **PASS** (só linhas da conta; totais coerentes) | `113-filtro-conta.png` |
| 39 | Filtro por período De/Até | **FAIL** (perde o último dia — ver Bug #1) | `111-filtro-periodo-hoje.png` |
| 40 | Período invertido (De > Até) | **FAIL parcial** (retorna vazio sem avisar) | `112-periodo-invertido.png` |
| **FINANCEIRO / CAIXA** ||||
| 41 | Criar caixa — validação de nome e conta | **PASS** | `51-novo-caixa-validacao.png` |
| 42 | Abrir caixa com valor inicial | **PASS** | `53`,`54-*.png` |
| 43 | Abrir 2º caixa com o 1º ainda aberto | **FAIL** (permitido; "Abertos: 2") | `54-apos-abrir-2o-caixa.png` |
| 44 | Sangria/suprimento — validação de valor e motivo | **PASS** | `55-sangria-validacao.png` |
| 45 | Sangria maior que o saldo do caixa | **FAIL** (caixa ficou negativo) | `57`,`59-detalhe-sessao.png` |
| 46 | Suprimento e detalhe da sessão (entradas/saídas/saldo) | **PASS** (cálculo correto) | `58`,`59-*.png` |
| 47 | Fechamento com conferência e divergência | **FAIL parcial** (backend calcula certo; UI não mostra o esperado e o histórico não atualiza) | `61`,`62`,`63`,`66-*.png` |
| 48 | Reabertura (nova sessão após fechamento) | **PASS** | `65-apos-reabrir.png` |
| 49 | Operar com caixa fechado | **PASS** (card só oferece "Abrir Caixa"; API rejeita) | `64-card-caixa-fechado.png` |
| 50 | Movimentações de caixa refletem na conta financeira vinculada | **FAIL** (Conta Digital continuou R$ 0,00) | `67-contas-apos-caixa.png` |
| **CONFIGURAÇÕES** ||||
| 51 | /configuracoes — carregar dados da empresa | **FAIL** (campos sempre vazios) | `101-config-geral-empresa.png` |
| 52 | /configuracoes — salvar dados da empresa | **FAIL** (nada acontece, nada persiste) | `108`,`108b-empresa-apos-f5.png` |
| 53 | Máscaras CNPJ/CEP na tela da empresa | **FAIL** (sem máscara) | `108-empresa-mascaras.png` |
| 54 | Aba Usuários | **FAIL** (mock hardcoded) | `105-config-usuarios.png` |
| 55 | Aba Plano | **FAIL** (mock hardcoded) | `106-config-plano.png` |
| 56 | Métodos de pagamento — validação de nome | **PASS** | `81-metodo-validacao.png` |
| 57 | Método com taxa -5% e liquidação -10 dias | **FAIL** (falha silenciosa) | `82`,`83-*.png` |
| 58 | Método com taxa 150% | **FAIL** (falha silenciosa) | `84-metodo-taxa-150.png` |
| 59 | Método válido (2,5% / 30 dias) | **PASS** | `85-metodos-apos-criar.png` |
| 60 | Condições — validação nome/código | **PASS** | `87-condicao-validacao.png` |
| 61 | Condição com 0 parcelas, -1 dias, 200% entrada | **FAIL** (falha silenciosa) | `90`,`91-*.png` |
| 62 | Preview de parcelamento com entrada 200% | **FAIL** (mostra entrada de R$ 2.000 numa venda de R$ 1.000) | `90-condicao-invalida-preview.png` |
| 63 | Condição com 999 parcelas | **FAIL** (modal estoura a viewport, botões inacessíveis) | `92-condicao-999-parcelas.png` |
| 64 | Perfil — senha atual errada | **PASS** (toast "A senha atual está incorreta") | `96-senha-atual-errada.png` |
| 65 | Perfil — confirmação divergente | **PASS** ("As senhas não conferem") | `97-senha-confirmacao-divergente.png` |
| 66 | Perfil — senha fraca | **PASS parcial** (mínimo 6, sem exigência de complexidade) | `98-senha-fraca.png` |
| 67 | Perfil — e-mail inválido | **PASS parcial** (validação nativa do browser, em inglês) | `99-perfil-email-invalido.png` |
| **PERMISSÕES (vendedor@exemplo.com)** ||||
| 68 | Login como vendedor + menu lateral | **FAIL** (menu Financeiro e Configurações visíveis por inteiro) | `110-vendedor-dashboard.png` |
| 69 | /configuracoes, /configuracoes/metodos-pagamento, /condicoes-pagamento por URL | **FAIL** (renderizam; API 403; UI mostra vazio) | `V01`,`V02`,`V03-*.png` |
| 70 | /financeiro/contas, /lancamentos, /caixa por URL | **FAIL** (renderizam; totais R$ 0,00; "Nenhum caixa cadastrado") | `V05`,`V06`,`V07-*.png` |
| 71 | Vendedor tentando **criar** método de pagamento | **PASS (backend) / FAIL (UX)** — 403 correto, mas mensagem genérica "Erro ao criar metodo. Tente novamente." | `V08-vendedor-tenta-criar-metodo.png` |
| 72 | Vazamento de dados de outro tenant / dados financeiros ao vendedor | **PASS** (nenhum dado vazou) | `V05-contas.png` |

---

## 3. Bugs

### 🔴 ALTO

---
**#1 — Filtro de período descarta quase todo o último dia (bug de fuso no backend)**

- **Severidade:** Alto
- **Passos:** /financeiro/lancamentos → preencher **De = 31/07/2026** e **Até = 31/07/2026** (existem 8 lançamentos nesse dia).
- **Esperado:** todos os lançamentos de 31/07 aparecem.
- **Obtido:** apenas 1 lançamento (o que tem hora 00:00Z). Confirmado direto na API:
  - `GET /financial-entries?endDate=2026-07-31` → **4** registros
  - `GET /financial-entries?endDate=2026-07-31T23:59:59` → **11** registros
  - `GET /financial-entries?endDate=2026-08-01` → **11** registros
- **Causa (arquivo/linha):** `apps/api/src/modules/financial/financial-entries.service.ts:309-318`
  ```ts
  const end = new Date(endDate);      // '2026-07-31' → 2026-07-31T00:00:00Z  (= 30/07 21:00 local -03)
  end.setHours(23, 59, 59, 999);      // setHours é LOCAL → 30/07 23:59:59 local = 2026-07-31T02:59:59Z
  ```
  Parse em UTC + `setHours` local: em UTC-3 o fim do período fica ~21 h antes do esperado. `startDate` sofre o desvio simétrico (inclui 3 h do dia anterior local).
- **Impacto:** qualquer relatório/conferência por período no financeiro é inconfiável. Fechamento do mês perde o último dia.
- **Evidência:** `111-filtro-periodo-hoje.png`

---
**#2 — Todas as datas do financeiro aparecem com 1 dia a menos**

- **Severidade:** Alto
- **Passos:** /financeiro/lancamentos → Novo Lançamento → desmarcar "À vista" → **Vencimento = 15/01/2026** → Criar.
- **Esperado:** linha com data **15/01/2026**.
- **Obtido:** linha com **14/01/2026**. Idem para a data de lançamento (informei 31/07/2026, exibiu 30/07/2026). Confirmado na API: `dueDate = "2026-01-15T00:00:00.000Z"` — o dado está certo, a exibição está errada.
- **Causa:** datas "date-only" são gravadas como meia-noite **UTC** (`new Date(dto.dueDate)` em `financial-entries.service.ts:106`) e renderizadas em horário **local** por `formatDate` (`apps/web/lib/utils.ts:18-24`, `parseISO` + `date-fns/format`). Em BRT (-03) a meia-noite UTC cai às 21 h do dia anterior.
- **Impacto:** vencimentos de contas a pagar/receber exibidos com um dia de erro — cálculo de juros/multa, conferência com boleto e cobrança ficam errados.
- **Evidência:** `38-apos-criar-payable-vencido.png`, `34-apos-criar-despesa.png`

---
**#3 — Títulos vencidos nunca ficam com status "Vencido"**

- **Severidade:** Alto
- **Passos:** criar um a pagar com vencimento 15/01/2026 (hoje = 31/07/2026). Os recebíveis do seed vencem em 29/03, 24/04 e 25/04/2026.
- **Esperado:** status `Vencido` (badge vermelho) e destaque na lista.
- **Obtido:** todos ficam `Em aberto` (amarelo). Nenhum destaque de inadimplência em lugar nenhum.
- **Causa:** `grep -rn "OVERDUE" apps/api/src --include=*.ts` só encontra o enum em listas de status permitidos. **Não existe** job (`@Cron`) nem cálculo em tempo de leitura que promova um título a `OVERDUE`. `apps/api/src/modules/financial/financial-entries.service.ts:19-23` e `mapReceivable/mapPayable` (l. 453-501) apenas repassam `row.status`.
- **Impacto:** funcionalidade central de contas a pagar/receber ausente. Não há como saber o que está atrasado.
- **Evidência:** `16-fin-lancamentos.png`, `38-apos-criar-payable-vencido.png`

---
**#4 — Não existe estorno de baixa nem exclusão/edição de lançamento**

- **Severidade:** Alto
- **Passos:** baixar um título (baixa total) → tentar desfazer.
- **Esperado:** ação "Estornar baixa" / "Excluir lançamento".
- **Obtido:** a linha paga não tem nenhuma ação (`isSettleable()` retorna `false` → célula vazia, `apps/web/app/(dashboard)/financeiro/lancamentos/page.tsx:100-111`). No backend, `financial-entries.controller.ts` só expõe `GET /`, `POST /` e `POST /:id/settle` — sem DELETE, sem PATCH, sem `/reverse`.
- **Impacto:** uma baixa com valor ou conta errada é irreversível pela aplicação; a correção exige acesso ao banco. Inaceitável em ERP financeiro.
- **Evidência:** `46-apos-baixa-total.png`

---
**#5 — Dois caixas podem ficar abertos ao mesmo tempo, quebrando a atribuição de vendas em dinheiro**

- **Severidade:** Alto
- **Passos:** com o caixa "Principal" aberto, criar "QA Caixa Financeiro" e abri-lo.
- **Esperado:** bloqueio (ou, no mínimo, atribuição de sessão explícita nas vendas).
- **Obtido:** abre normalmente — card "Abertos: **2**".
- **Causa:** `apps/api/src/modules/cash-registers/cash-registers.service.ts:184-192` só checa sessão aberta **do mesmo `cashRegisterId`**. Mas `closeSession` (l. 253-259) soma as vendas em dinheiro assumindo explicitamente o contrário: *"assumption: one open session per tenant, so counter sales are stamped with this session id at creation"*.
- **Impacto:** com dois caixas abertos, as vendas em dinheiro são carimbadas na sessão errada e o saldo esperado no fechamento fica incorreto → divergência fantasma na conferência.
- **Evidência:** `54-apos-abrir-2o-caixa.png`, `66-historico-apos-f5.png`

---
**#6 — Sangria maior que o saldo do caixa é aceita → caixa negativo**

- **Severidade:** Alto
- **Passos:** abrir caixa com R$ 500,00 → Sangria de R$ 5.000.000,00 com motivo → Confirmar.
- **Esperado:** "Saldo insuficiente no caixa".
- **Obtido:** "Sangria realizado com sucesso!". Detalhe da sessão: Saídas −R$ 5.000.000,00, **Saldo atual −R$ 4.999.300,00**. O fechamento seguinte apurou diferença de R$ 5.000.300,00 (exibida em **verde**, como se fosse sobra).
- **Causa:** `cash-registers.service.ts:328-355` (`withdraw`) só busca a sessão aberta e cria o movimento — nenhuma checagem contra `openingBalance + supplies − withdrawals`.
- **Evidência:** `57-apos-sangria.png`, `59-detalhe-sessao.png`, `66-historico-apos-f5.png`

---
**#7 — /configuracoes "Dados da Empresa" é uma tela de fachada: não carrega e não salva**

- **Severidade:** Alto
- **Passos:** /configuracoes → aba Empresa → preencher Razão Social, CNPJ, Endereço, Cidade, UF → "Salvar Alterações" → F5.
- **Esperado:** dados do tenant "Loja Exemplo Ltda" pré-carregados; salvamento com toast e persistência.
- **Obtido:** campos vêm **sempre vazios**; ao salvar **nada acontece** (sem toast de sucesso, sem requisição HTTP — log de rede limpo); após F5 tudo em branco.
- **Causa:** `apps/web/app/(dashboard)/configuracoes/page.tsx:116-118`
  ```ts
  const onSubmit = async (_data: CompanyFormValues) => {
    // TODO: integrate with API
  };
  ```
  e `defaultValues` fixos em `""` (l. 104-113), sem nenhum `useQuery` do tenant.
- **Impacto:** o usuário acredita ter cadastrado os dados fiscais da empresa. Viola também a regra "toda mutation deve dar toast" do CLAUDE.md.
- **Evidência:** `101-config-geral-empresa.png`, `108-empresa-mascaras.png`, `108b-empresa-apos-f5.png`

---
**#8 — Abas "Usuários" e "Plano" de /configuracoes exibem dados MOCK hardcoded**

- **Severidade:** Alto
- **Passos:** /configuracoes → aba Usuários / aba Plano.
- **Esperado:** os usuários reais do tenant (Administrador, Ana Vendedora) e limites reais.
- **Obtido:** "João Silva / joao@empresa.com", "Maria Santos", "Pedro Oliveira" (`MOCK_USERS`) e "Profissional — Usuários 3/5, Produtos 245/500, Pedidos/mês 1247/5000, Depósitos 2/3". O botão "Convidar" também não faz nada (`// TODO: integrate with API`, `page.tsx:240`).
- **Impacto:** tela administrativa mostrando informação falsa sobre quem tem acesso ao sistema.
- **Evidência:** `105-config-usuarios.png`, `106-config-plano.png`

---
**#9 — Frontend não faz nenhum gating de permissão: vendedor navega por todo o módulo administrativo**

- **Severidade:** Alto (o backend segura, mas a UI mente para o usuário)
- **Passos:** login `vendedor@exemplo.com` / `Vendedor@123` → menu lateral e URLs diretas.
- **Esperado:** itens "Financeiro" e "Configurações" ocultos; acesso direto → tela de "sem permissão".
- **Obtido:**
  - Sidebar idêntica à do admin (Financeiro com 3 subitens, Configurações com 3 subitens).
  - `/financeiro/contas` → "Nenhuma conta financeira cadastrada" (existem 6).
  - `/financeiro/caixa` → "Total de Caixas 0 / Nenhum caixa cadastrado" (existem 2).
  - `/financeiro/lancamentos` → Receitas R$ 0,00 / Despesas R$ 0,00 / Saldo R$ 0,00.
  - `/configuracoes/condicoes-pagamento` → "Nenhuma condicao de pagamento cadastrada" (existem 6).
  - Botões "Nova Conta", "Novo Caixa", "Nova Condicao", "Novo Metodo", "Importar Despesas" **todos habilitados**.
  - Ao submeter a criação de um método: `403` no backend, mas o usuário vê "Erro ao criar metodo. Tente novamente." (sugere falha técnica, não falta de permissão).
- **Impacto:** estados vazios enganosos — um vendedor pode reportar que "o sistema perdeu as contas". Além disso, todas as telas disparam rajadas de 403 no console.
- **Evidência:** `110-vendedor-dashboard.png`, `V01`..`V08-*.png`

---
**#10 — Layout mobile (390x844) inutilizável: sidebar fixa ocupa 68% da tela**

- **Severidade:** Alto
- **Passos:** abrir /financeiro/lancamentos, /financeiro/contas, /financeiro/caixa em 390x844.
- **Esperado:** sidebar vira drawer/hamburger; conteúdo ocupa a largura.
- **Obtido:** a `<aside>` mantém `w-[264px]` fixos (264 de 390 px). Sobram ~126 px de conteúdo: o título vira "Despesas e Receit…", os cards mostram "R$ 3.0…", "R$ 12.4…", e as tabelas ficam fora da tela. Não há `scrollWidth > clientWidth` porque o conteúdo é **cortado**, não rolável.
- **Causa:** `apps/web/components/layouts/sidebar.tsx:126-131` — largura fixa sem nenhum breakpoint `md:`/`lg:` e sem estado de drawer.
- **Evidência:** `M1-contas.png`, `M2-lancamentos.png`, `M3-caixa.png`, `M4-condicoes.png`, `M5-perfil.png`

---

### 🟠 MÉDIO

---
**#11 — Histórico de sessões de caixa não atualiza após abrir/fechar (cache não invalidado)**

- **Passos:** fechar o caixa "QA Caixa Financeiro" informando R$ 1.000,00 → observar a tabela "Histórico de sessões".
- **Esperado:** linha vira "Fechado" com saldo de fechamento e diferença.
- **Obtido:** continua "Aberto", Fechado em "—", Saldo fechamento "—", Diferença "—". Só corrige com F5 (aí aparece tudo corretamente — o backend gravou `closingBalance: 1000, expectedBalance: -4999300, difference: 5000300`).
- **Causa:** `apps/web/hooks/use-cash-registers.ts` — todas as mutations invalidam apenas `cashRegisterKeys.lists()` (`["cash-registers","list"]`, l. 120/145/172/199/226). A lista de sessões usa `cashRegisterKeys.sessionList(params)` = `["cash-registers","sessions",params]`, que nunca é invalidada.
- **Impacto:** o operador fecha o caixa e a tela sugere que o fechamento não ocorreu — risco de fechar duas vezes / não ver a divergência apurada.
- **Evidência:** `63-apos-fechar-caixa.png` (stale) vs `66-historico-apos-f5.png` (correto)

---
**#12 — Transferência entre contas próprias é contada como Receita E Despesa nos totalizadores**

- **Passos:** transferir R$ 250,00 de Santander → Conta Digital → voltar a /financeiro/lancamentos.
- **Esperado:** movimentação neutra (ou linha do tipo "Transferência" fora dos totais de receita/despesa).
- **Obtido:** duas linhas — uma "Receita R$ 250,00" e outra "Despesa R$ 250,00". Receitas subiu de R$ 2.757,00 para R$ 3.007,00 e Despesas de R$ 450,50 para R$ 700,50.
- **Causa:** `financial-entries.service.ts:320-337` (`buildTransactionWhere`) não exclui `referenceType` de transferência; `mapTransaction` (l. 434-451) classifica todo `CREDIT` como REVENUE e todo `DEBIT` como EXPENSE.
- **Impacto:** DRE/faturamento inflado por movimentação interna de caixa.
- **Evidência:** `75-lancamentos-apos-transfer.png`

---
**#13 — Validações numéricas de Métodos e Condições de Pagamento falham em silêncio**

- **Passos:** /configuracoes/metodos-pagamento → Novo Metodo → Nome preenchido, **Taxa = -5**, **Liquidação = -10** → Criar. Repetir com Taxa = 150. Idem em Condições: **Parcelas = 0**, **Dias = -1**, **Entrada = 200**.
- **Esperado:** mensagem de erro sob cada campo.
- **Obtido:** clicar em "Criar" **não faz absolutamente nada** — o modal permanece aberto, sem mensagem, sem toast, sem requisição HTTP. O usuário não sabe o que está errado.
- **Causa:** os schemas zod têm `.min(0)/.max(100)/.min(1)` mas os campos **não renderizam `errors`**:
  - `configuracoes/metodos-pagamento/page.tsx:380-406` — `feePercentage` e `settlementDays` sem `{errors.X && <p>…}`.
  - `configuracoes/condicoes-pagamento/page.tsx:350-385` — `installments`, `daysBetweenInstallments` e `entryPercentage` idem.
- **Evidência:** `82`,`83`,`84-*.png`, `90`,`91-*.png`

---
**#14 — Modal de Condição de Pagamento estoura a viewport com muitas parcelas; botões ficam inacessíveis**

- **Passos:** Nova Condicao → tipo "Entrada + Parcelas" → **Parcelas = 999** → observar o preview.
- **Esperado:** preview limitado (ex.: primeiras 6 + "…") e modal com scroll interno.
- **Obtido:** o preview renderiza as **999** linhas ("Parcela 510/999 — 15300 dias — R$ 0,90"), o `DialogContent` cresce indefinidamente, o `<body>` rola atrás do overlay e os botões **Cancelar/Criar ficam permanentemente fora da viewport** — o Playwright falhou com "element is outside of the viewport" após 30 s de tentativas. O único jeito de sair é ESC.
- **Causa:** `configuracoes/condicoes-pagamento/page.tsx` — `InstallmentPreview` sem limite de linhas e `DialogContent` sem `max-h`/`overflow-y-auto`. O zod aceita `installments` sem `.max()` (só o `max={48}` do HTML, que é contornável).
- **Evidência:** `92-condicao-999-parcelas.png`

---
**#15 — Caixa físico e conta financeira estão desconectados**

- **Passos:** criar caixa vinculado a "Conta Digital", abrir com R$ 500,00, suprimento R$ 200,00, sangria, fechar → conferir /financeiro/contas e /financeiro/lancamentos.
- **Esperado:** o dinheiro do caixa reflete na conta financeira vinculada (ou ao menos gera lançamento no fechamento).
- **Obtido:** Conta Digital permaneceu em R$ 0,00 e nenhuma linha de abertura/sangria/suprimento/fechamento apareceu em Despesas e Receitas.
- **Causa:** `cash-registers.service.ts` — `openSession`, `supply`, `withdraw` e `closeSession` não tocam em `FinancialAccount` nem criam `FinancialTransaction`.
- **Impacto:** impossível conciliar o caixa com o financeiro; sangria não vira depósito em conta.
- **Evidência:** `67-contas-apos-caixa.png`, `68-lancamentos-apos-caixa.png`

---
**#16 — Contas financeiras: nome e código internos duplicados são aceitos; não há exclusão**

- **Passos:** Nova Conta → Nome "Banco do Brasil", Código "BB" (já existentes) → Criar.
- **Esperado:** 409 "Já existe uma conta com esse nome/código".
- **Obtido:** "Conta criada com sucesso!". A API agora lista **duas** contas `Banco do Brasil | BB` (saldos 0 e -300).
- **Consequência prática:** os combos de conta (lançamento, baixa, transferência, criação de caixa) passam a mostrar dois itens idênticos e indistinguíveis. Também não existe DELETE de conta financeira no controller.
- **Evidência:** `79-conta-duplicada.png`

---
**#17 — Transferência e baixa deixam a conta negativa sem qualquer aviso**

- **Passos:** transferir R$ 250,00 de "Santander" (saldo R$ 0,00) → conta fica em **−R$ 250,00**. Idem para baixa de a pagar em conta zerada (Banco do Brasil ficou −R$ 300,00) e lançamento à vista (Caixa Principal ficou −R$ 150,50).
- **Esperado:** ao menos um aviso/confirmação; para conta do tipo **Caixa** (dinheiro físico), saldo negativo é impossível na vida real.
- **Obtido:** aceito silenciosamente; o saldo negativo é exibido normalmente na tabela.
- **Evidência:** `74-transfer-resultado.png`, `44-contas-apos-baixa-parcial.png`

---
**#18 — Nós-pai do menu e rotas inexistentes caem no 404 cru do Next (em inglês, sem navegação)**

- **Passos:** acessar `/xyz`, `/financeiro`, `/vendas`, `/estoque`.
- **Esperado:** 404 amigável em português, dentro do shell, com link para voltar (como já ocorre corretamente em `/clientes/999999`).
- **Obtido:** página branca com "404 — This page could not be found." Sem sidebar, sem header, sem link de retorno, em inglês. `/financeiro`, `/vendas` e `/estoque` são exatamente os `href` dos grupos do menu (`sidebar.tsx:53/64/78`) — basta um clique diferente para o usuário cair nisso.
- **Causa:** não existe `app/not-found.tsx` nem `app/(dashboard)/not-found.tsx`; não existem `page.tsx` para as rotas-pai.
- **Evidência:** `22-rota-inexistente.png`, `14-financeiro-index.png`, `09-vendas-index.png`

---
**#19 — CNPJ e CEP sem máscara em /configuracoes**

- **Passos:** /configuracoes → digitar `11222333000181` no CNPJ e `01001000` no CEP.
- **Esperado:** `11.222.333/0001-81` e `01001-000` (CLAUDE.md do frontend torna `maskCNPJ`/`maskCEP` obrigatórias).
- **Obtido:** os dígitos crus permanecem. O CEP só é criticado no submit ("CEP inválido" quando com máscara ausente/formato errado), sem formatar.
- **Evidência:** `108-empresa-mascaras.png`

---
**#20 — Coluna "Conta" fica "-" para todos os títulos originados de pedidos**

- **Passos:** /financeiro/lancamentos → observar a coluna "Conta" dos recebíveis PED-000002..PED-000007.
- **Esperado:** a conta em que o título será liquidado.
- **Obtido:** "-" em todos. A API devolve `accountName: null` — o `mapReceivable` (`financial-entries.service.ts:460-463`) depende de `orderPayment.financialAccountId` / `paymentMethod.defaultAccountId`, e os métodos de pagamento do seed não têm `defaultAccountId`. Consequência: ao abrir a baixa, o campo "Conta creditada" vem vazio e o operador precisa escolher manualmente toda vez.
- **Evidência:** `16-fin-lancamentos.png`, `40-dialog-baixa-payable.png`

---

### 🟡 BAIXO

**#21 — Descrições de títulos em inglês.** Os recebíveis de pedido são criados como "Receivable for order PED-000003" e aparecem assim para o usuário final, ao lado de outros em português ("Venda balcão PED-000004"). Evidência: `16-fin-lancamentos.png`.

**#22 — Nenhuma tela tem breadcrumb.** Em telas de 2º nível (`/financeiro/lancamentos`, `/configuracoes/metodos-pagamento`) não há trilha de navegação; só o estado ativo do menu. Evidência: `15-fin-contas.png`.

**#23 — Período invertido (De > Até) não é criticado.** Com De = 31/12/2026 e Até = 01/01/2026 a lista fica vazia com a mensagem genérica "Nenhum lançamento encontrado / Ajuste os filtros", sem indicar que as datas estão invertidas. Evidência: `112-periodo-invertido.png`.

**#24 — Preview de condição aceita entrada > 100%.** Com Entrada = 200% o preview mostra "Entrada — Hoje — R$ 2.000,00" para o exemplo de R$ 1.000,00. Evidência: `90-condicao-invalida-preview.png`.

**#25 — Política de senha fraca.** `A nova senha deve ter no mínimo 6 caracteres` e nada mais — "123456" é aceito para um usuário owner de ERP. Evidência: `98-senha-fraca.png`.

**#26 — Validação de e-mail delegada ao browser, em inglês.** No perfil, e-mail inválido produz o balão nativo "Please include an '@' in the email address…" em vez de mensagem própria em pt-BR. Evidência: `99-perfil-email-invalido.png`.

**#27 — Rótulos sem acentuação em todo o módulo de Configurações e Contas.** "Metodos de Pagamento", "Condicoes de Pagamento", "Acoes", "Poupanca", "Codigo", "Nao", "Liquidacao", "Nome obrigatorio", "contas bancarias" — inconsistente com o resto do sistema, que é acentuado. Evidência: `20-config-metodos.png`, `21-config-condicoes.png`, `15-fin-contas.png`.

**#28 — Ruído de ponto flutuante vazando na API.** `GET /financial-entries` devolveu `"balance": 708.9000000000001`. A UI mascara com `formatCurrency`, mas o contrato da API expõe o erro de arredondamento (`computeTotals`, `financial-entries.service.ts:419-423`, faz soma em `Number` sem `round2`).

---

## 4. Verificações de somatório (conferidas manualmente)

| Filtro | Linhas | Soma Receitas (linhas) | Soma Despesas (linhas) | Totalizador exibido | OK? |
|---|---|---|---|---|---|
| Sem filtro (15 registros) | 15 | R$ 3.007,00 | R$ 12.430,50 | R$ 3.007,00 / R$ 12.430,50 / −R$ 9.423,50 | ✅ |
| Status = Pago | 3 | R$ 0,00 | R$ 450,50 | R$ 0,00 / R$ 450,50 / −R$ 450,50 | ✅ |
| Conta = Caixa Principal | 3 | R$ 398,00 | R$ 150,50 | R$ 398,00 / R$ 150,50 / R$ 247,50 | ✅ |
| Após baixa parcial de R$ 100 em título de R$ 300 | — | — | 100 (transação) + 200 (saldo do título) | R$ 450,50 (sem dupla contagem) | ✅ |

Sessão de caixa (detalhe): abertura R$ 500,00 + suprimento R$ 200,00 − sangria R$ 5.000.000,00 = **−R$ 4.999.300,00** exibido — cálculo aritmeticamente correto (o problema é a sangria ter sido permitida, Bug #6). Diferença no fechamento: 1.000,00 − (−4.999.300,00) = **5.000.300,00** — correto.

---

## 5. O que ficou de fora

- **Contas a pagar/receber com parcelamento** (gerar N parcelas a partir de uma condição de pagamento): a tela `/financeiro/lancamentos` não oferece campo de parcelas — o parcelamento só existe dentro do fluxo de venda, que pertence a outro domínio. Não testado aqui.
- **Importação de despesas via CSV**: apenas o diálogo foi aberto e inspecionado (`114-importar-despesas.png`). Não subi arquivo — o processamento é assíncrono (BullMQ) e o resultado não é observável na tela testada.
- **Upload de avatar** em /configuracoes/perfil (não faz parte do escopo financeiro/segurança pedido).
- **Multi-tenant real**: só existe um tenant no seed, então isolamento entre tenants não pôde ser exercitado pela UI.
- **Reabertura de uma sessão já fechada** (reopen da mesma sessão): não existe endpoint; o que testei foi abrir uma **nova** sessão no mesmo caixa, o que funciona.
- **Concorrência**: outros agentes de QA operavam o mesmo tenant simultaneamente, então não isolei um cenário de corrida (ex.: duas baixas simultâneas do mesmo título).

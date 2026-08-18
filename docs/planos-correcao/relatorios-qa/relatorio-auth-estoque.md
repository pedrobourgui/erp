# Relatório de QA — Domínio AUTENTICAÇÃO + CADASTROS + ESTOQUE

**Domínio:** `auth-estoque`
**Data:** 31/07/2026
**Ambiente:** Web http://localhost:3000 · API http://localhost:3001/api/v1 · tenant `seed-tenant-001`
**Ferramenta:** Playwright 1.62.1 (Chromium headless, 1440x900 e 390x844), com instrumentação de `console`, `pageerror` e `response >= 400`
**Evidências:** `/private/tmp/claude-502/-Users-mac-work-erp/e36bf272-20da-4da1-8c84-9d256825cf51/scratchpad/qa/shots/auth-estoque/`
**Scripts:** `t01-auth.js` … `t16-mov-filtros.js` na mesma pasta

> Observação importante: o ambiente é compartilhado com outros ciclos de teste rodando em paralelo (foram observados pedidos/movimentações criados por outros agentes durante a execução). Isso está sinalizado onde influenciou a análise.

---

## 1. Resumo executivo

### O que funciona bem
- **Fluxo de autenticação feliz**: login válido (admin e vendedor), redirect de rota protegida quando deslogado, logout limpando `localStorage` e bloqueando o retorno à rota protegida.
- **Validações client-side de formulário** (zod + react-hook-form): campos obrigatórios, e-mail, telefone, tamanho de nome, `maxLength` alinhado ao banco (255).
- **Máscaras BR** de CPF/CNPJ, telefone e CEP funcionam corretamente (a única máscara quebrada é a de moeda — ver BUG-01).
- **Regra de saldo negativo no estoque**: saída maior que o saldo é bloqueada pelo backend; o saldo não é alterado. Entrada e saída refletem corretamente no card "Estoque" do produto, na lista de produtos e no KPI de estoque crítico.
- **Alertas de estoque mínimo** funcionam: produto com 4 un e mínimo 5 aparece em `/estoque/alertas` e no card "Estoque Crítico" do dashboard.
- **Exclusão de categoria/marca em uso é bloqueada** pelo backend (409).
- **Unicidade** de SKU de produto, documento e e-mail de cliente, slug de categoria e nome de marca é validada no backend.
- **Paginação, ordenação, busca server-side e estados vazios** das listas funcionam.
- **Dark mode** renderiza corretamente (verificado em `/estoque/produtos`).

### O que está quebrado (destaques)
- **`/estoque/movimentações` faz white-screen** (crash total) quando existe uma movimentação do tipo `RETURN` ou `PRODUCTION` — que o próprio backend gera. Página inteiramente inutilizável. **(Crítico)**
- **O campo de moeda (`MoneyInput`) grava valores errados por ordem de grandeza**: digitar `1234` esperando R$ 12,34 grava **R$ 12.300,04**. Afeta preço de custo, venda, promocional — em todo o ERP. **(Crítico)**
- **Senha errada / e-mail inexistente no login não mostram nenhum erro**: a página recarrega, limpa o formulário e o usuário fica sem feedback. **(Alto)**
- **CPF e CNPJ inválidos são aceitos** (111.111.111-11 e 11.111.111/1111-11 foram cadastrados). Não há validação de dígito verificador nem no front nem no back. **(Alto)**
- **Vendedor enxerga todo o menu administrativo e todo o painel financeiro** (A Pagar, A Receber, faturamento). Não há guarda de rota no front. **(Alto)**
- **Produto com saldo em estoque é excluído sem bloqueio nem aviso**, e o **alerta de estoque fica órfão** apontando para um produto que não existe mais. **(Alto)**
- **Nome de produto longo (255 chars, permitido pelo schema) estoura a tabela** e empurra Preço/Estoque/Status/Ações para fora da tela. **(Alto)**
- **Layout mobile totalmente quebrado**: a sidebar fixa de 264px não colapsa em 390x844; o conteúdo é cortado e inacessível em todas as telas. **(Alto)**
- **Transferência entre depósitos e ajuste de estoque não existem na UI** (só ENTRY/EXIT), embora o backend suporte (`POST /inventory/transfer`). **(Alto)**
- **Não existe edição de cliente** em lugar nenhum (CRUD sem "U").
- **Mensagens de erro do backend em inglês vazando para o usuário** ("Cannot create inventory item with negative quantity") e, na maioria dos casos, substituídas por toasts genéricos que escondem o motivo real.

### Contagem
| | |
|---|---|
| Cenários executados | **107** |
| PASS | **57** |
| FAIL | **47** |
| PARCIAL | **2** |
| BLOQUEADO | **1** |
| Bugs abertos | **29** |
| — Críticos | 2 |
| — Altos | 11 |
| — Médios | 11 |
| — Baixos | 5 |

---

## 2. Tabela de cenários executados

### 2.1 Autenticação (`/login`)

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| A01 | Rota protegida (`/estoque/produtos`) deslogado → redireciona para `/login` | PASS | `01-rota-protegida-deslogado.png` |
| A02 | Tela de login renderiza (glass/dark, sem erro de console) | PASS | `02-login-inicial.png` |
| A03 | Submit com campos vazios → "E-mail é obrigatório" / "Senha é obrigatória" | PASS | `03-login-campos-vazios.png` |
| A04 | E-mail malformado (`nao-eh-email`) → "E-mail inválido" | PASS | `04-login-email-malformado.png` |
| A05 | Senha < 6 caracteres → "Senha deve ter pelo menos 6 caracteres" | PASS | `04b-login-senha-curta.png` |
| A06 | **Senha errada → nenhuma mensagem; formulário é limpo** | **FAIL** (BUG-03) | `05-login-senha-errada.png` |
| A07 | **E-mail inexistente → nenhuma mensagem; formulário é limpo** | **FAIL** (BUG-03) | `06-login-email-inexistente.png` |
| A08 | Login válido admin → redireciona para `/` | PASS | `07-dashboard-admin.png` |
| A09 | Login válido vendedor → redireciona para `/` | PASS | `110-vendedor-dashboard.png` |
| A10 | `/login` estando logado → **não redireciona** para o dashboard | FAIL (BUG-17) | `08-login-estando-logado.png` |
| A11 | Tokens JWT guardados em `localStorage` (não httpOnly) | FAIL (BUG-19) | log do `t01-auth.js` |
| A12 | Logout limpa `localStorage` e volta para `/login` | PASS | `116-apos-logout.png` |
| A13 | Após logout, rota protegida redireciona para `/login` | PASS | `117-rota-protegida-apos-logout.png` |

### 2.2 Dashboard (`/`)

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| D01 | Cards de KPI renderizam com moeda BR (`R$ 1.234,56`) | PASS | `120-dashboard-admin-atual.png` |
| D02 | Gráfico "Vendas do Período" e "Pedidos por Status" renderizam | PASS | `120`, `121-dashboard-rodape.png` |
| D03 | KPI "Estoque Crítico" reflete os alertas reais (1 item após o teste de estoque) | PASS | `84-dashboard-estoque-critico.png` |
| D04 | **Coluna CLIENTE de "Pedidos Recentes" totalmente vazia** | FAIL (BUG-14) | `120-dashboard-admin-atual.png` |
| D05 | **"1 itens"** (concordância) e eixo do gráfico em `07-31` em vez de `31/07` | FAIL (BUG-21, BUG-22) | `120` |
| D06 | Rótulos do gráfico de status inconsistentes ("Separação" vs "Separando") | FAIL (BUG-23) | `121-dashboard-rodape.png` |
| D07 | **Dashboard mobile 390x844 cortado pela sidebar** | FAIL (BUG-07) | `09-dashboard-mobile.png` |

### 2.3 Clientes

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| C01 | Lista `/clientes` carrega, pagina e mostra máscaras | PASS | `10-clientes-lista.png` |
| C02 | Busca por nome ("Maria") filtra server-side | PASS | `23-clientes-busca-maria.png` |
| C03 | Busca sem resultado → estado vazio correto | PASS | `24-clientes-busca-sem-resultado.png` |
| C04 | Busca por documento mascarado retorna o cliente | PASS | `25-clientes-busca-documento.png` |
| C05 | Ordenação por Nome | PASS | `26-clientes-ordenado-nome.png` |
| C06 | Painel de Filtros (segmento) abre | PASS | `27-clientes-filtros.png` |
| C07 | **Colunas "Pedidos" vazia e "Total Gasto" sempre R$ 0,00** | FAIL (BUG-13) | `10-clientes-lista.png` |
| C08 | Novo cliente: submit vazio mostra os 4 erros | PASS | `13-cliente-novo-vazio.png` |
| C09 | **CPF 111.111.111-11 é ACEITO e cadastrado** | **FAIL** (BUG-04) | `15-cliente-cpf-invalido-resultado.png` |
| C10 | **CNPJ 11.111.111/1111-11 é ACEITO e cadastrado** | **FAIL** (BUG-04) | `16-cliente-cnpj-invalido-resultado.png` |
| C11 | E-mail inválido bloqueia o submit | PASS | `17-cliente-email-invalido.png` |
| C12 | Telefone com 3 dígitos → "Telefone inválido" | PASS | `18-cliente-telefone-curto.png` |
| C13 | CPF válido 529.982.247-25 → cliente criado e persistido (F5) | PASS | `20`, `21-cliente-busca-criado.png` |
| C14 | Duplicidade de documento bloqueada (409) | PASS | `22-cliente-duplicidade.png` |
| C15 | **Toast de duplicidade genérico** ("Erro ao criar cliente"), esconde o motivo | FAIL (BUG-10) | `22-cliente-duplicidade.png` |
| C16 | **Duplicidade burlável mudando a formatação** (`12345678909` vs `123.456.789-09`) | FAIL (BUG-15) | confirmado via API, ver §4 |
| C17 | Detalhe do cliente carrega com abas Informações/Endereços/Pedidos | PASS | `28-cliente-detalhe.png` |
| C18 | **Erro React "change in the order of Hooks" na página de detalhe** | FAIL (BUG-09) | log de `t03-clientes2.js` |
| C19 | **Não existe edição de cliente** (sem botão, `/clientes/[id]/edit` = 404) | FAIL (BUG-06) | `30-cliente-edit-404.png` |
| C20 | ID inexistente → "Cliente não encontrado" | PASS | `31-cliente-id-inexistente.png` |
| C21 | Exclusão de cliente funciona e persiste | PASS | `136`, `137-clientes-apos-delete.png` |
| C22 | **Não há campos de endereço/CEP no cadastro** → busca automática de CEP inexistente | FAIL (BUG-16) | `12-cliente-novo-form.png` |
| C23 | Busca global do topbar não faz nada | FAIL (BUG-18) | `32-busca-global.png` |
| C24 | **Lista de clientes em 390x844 cortada** | FAIL (BUG-07) | `33-clientes-mobile.png` |

### 2.4 Produtos

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| P01 | Lista `/estoque/produtos` carrega com SKU, preço, estoque, status | PASS | `40-produtos-lista.png` |
| P02 | Busca por nome/SKU filtra | PASS | `41-produtos-busca.png`, `63-produto-busca-sku.png` |
| P03 | Paginação 10/20/50/100 e navegação de páginas | PASS | `124`, `125-produtos-pagina2.png` |
| P04 | Novo produto: submit vazio mostra erros de Nome e SKU | PASS | `43-produto-novo-vazio.png` |
| P05 | **Erros das abas ocultas (Preços) não são sinalizados** → submit "não faz nada" | FAIL (BUG-11) | `46`, `47-produto-erros-aba-precos.png` |
| P06 | **MoneyInput grava valor errado (1234 → R$ 12.300,04)** | **FAIL** (BUG-01) | `61-money-click-1234.png`, `58`, `59` |
| P07 | Preço negativo não é digitável (sinal `-` é descartado silenciosamente) | PARCIAL | `48-produto-preco-negativo.png` |
| P08 | Preço de venda zero é bloqueado (mensagem imprecisa: "é obrigatório") | PASS/obs | `50-produto-venda-zero.png` |
| P09 | **Preço de venda MENOR que o custo é aceito sem aviso** (venda 100.000 / custo 500.000) | **FAIL** (BUG-05) | `51`, `52-produto-margem-negativa-result.png` |
| P10 | Produto válido criado, aparece na lista e no detalhe | PASS | `53`, `54-produto-criado.png`, `64-produto-detalhe.png` |
| P11 | SKU duplicado bloqueado (409) | PASS | `55-produto-sku-duplicado.png` |
| P12 | **Toast do SKU duplicado genérico** (backend responde em inglês) | FAIL (BUG-10/12) | `55-produto-sku-duplicado.png` |
| P13 | **NCM `ABCDEFG` e EAN `123` são aceitos** (sem validação de formato) | FAIL (BUG-08) | `56-produto-ncm-invalido.png` |
| P14 | Estoque mínimo negativo é bloqueado (mas erro fica em aba oculta) | PASS/obs | `57-produto-min-negativo.png` |
| P15 | Detalhe do produto mostra custo, venda, margem, fiscal, estoque | PASS | `64-produto-detalhe.png` |
| P16 | `/estoque/produtos/[id]/edit` carrega valores e salva; persiste após F5 | PASS | `65`, `66`, `68-produto-apos-edit-f5.png` |
| P17 | Produto inexistente → "Produto não encontrado" | PASS | `130-produto-inexistente.png` |
| P18 | **Produto COM saldo (4 un) é excluído sem bloqueio/aviso** | **FAIL** (BUG-02) | `131`, `132`, `133-produtos-apos-delete.png` |
| P19 | **Alerta de estoque do produto excluído continua na tela** (órfão) | **FAIL** (BUG-02) | `134-alertas-apos-delete-produto.png` |
| P20 | Nome com 255 caracteres é aceito e **destrói o layout da tabela** | **FAIL** (BUG-20) | `127-produtos-com-nome-longo.png` |
| P21 | Nome com `<script>`/aspas — React escapa, sem XSS | PASS | `127-produtos-com-nome-longo.png` |
| P22 | Dark mode na lista de produtos | PASS | `123-produtos-dark.png` |
| P23 | **Produtos em 390x844 cortado** | FAIL (BUG-07) | `122-produtos-mobile.png` |

### 2.5 Categorias / Marcas / Depósitos

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| K01 | Lista de categorias com contagem de produtos | PASS | `85-categorias-lista.png` |
| K02 | Criar categoria (slug automático) | PASS | `88`, `89-categorias-criado.png` |
| K03 | Categoria com nome vazio → "Nome é obrigatório" | PASS | `87-categorias-vazio.png` |
| K04 | Slug duplicado bloqueado (409) — **toast genérico** | FAIL (BUG-10) | `90-categorias-duplicado.png` |
| K05 | **Excluir categoria EM USO (4 produtos): backend bloqueia, mas a UI não avisa antes e o toast é genérico** | FAIL (BUG-10) | `97`, `98-categoria-delete-result.png`, `99` |
| K06 | Lista de marcas com contagem | PASS | `85-marcas-lista.png` |
| K07 | Criar marca | PASS | `89-marcas-criado.png` |
| K08 | Nome de marca duplicado bloqueado (409) — toast genérico | FAIL (BUG-10) | `90-marcas-duplicado.png` |
| K09 | Excluir marca EM USO bloqueada pelo backend, toast genérico | FAIL (BUG-10) | `100`, `101-marca-delete-result.png` |
| K10 | **Erro React "Expected static flag was missing" em TODO ConfirmDialog** | FAIL (BUG-09b) | log de `t12-delete-inuse.js` |
| K11 | Depósitos: criar com nome/endereço/cidade/UF/CEP + máscara de CEP | PASS | `94`, `95-deposito-criado.png` |
| K12 | Validações do depósito (nome, endereço min 5, cidade, UF 2 letras, CEP) | PASS | `87-depositos-vazio.png`, `96-deposito-uf-invalida.png` |
| K13 | **Cidade/UF e contagem de produtos não são retornados pela API** → card mostra ", -" e " produtos" | FAIL (BUG-12b) | `70-depositos.png` |
| K14 | **Vários depósitos marcados como "Padrão" simultaneamente** | FAIL (BUG-12) | `95-deposito-criado.png` |
| K15 | **Depósito não tem editar nem excluir** (só criar) | FAIL (BUG-24) | `70-depositos.png` |
| K16 | CEP não busca endereço automaticamente (não há integração ViaCEP em lugar nenhum) | FAIL (BUG-16) | `94-deposito-preenchido.png` |

### 2.6 Movimentações e Alertas

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| M01 | Lista de movimentações carrega com tipo/motivo/usuário/depósito | PASS (antes do RETURN) | `71-movimentacoes-lista.png` |
| M02 | **`/estoque/movimentacoes` faz white-screen com movimentação `RETURN`** | **FAIL** (BUG-00) | `139-movimentacoes-lista-final.png` |
| M03 | Entrada de 20 un (Compra) registrada | PASS | `72-entrada20-form.png` |
| M04 | **Saldo do produto sobe para 20 na tela do produto** | PASS | `73-saldo-apos-entrada.png` |
| M05 | Saída de 1 un registrada; saldo cai para 19 | PASS | `78-saida-outro-deposito-resultado.png` |
| M06 | Saída de 15 un; saldo cai para 4 | PASS | `81-saida15.png`, `82-produto-saldo-baixo.png` |
| M07 | **Saída de 999 (> saldo de 19) BLOQUEADA; saldo intacto** | PASS | `80-saida999-makeimports.png` |
| M08 | Saída em depósito sem registro de estoque bloqueada | PASS | `74-saida5-resultado.png` |
| M09 | **Mensagem de erro em inglês e incompreensível** ("Cannot create inventory item with negative quantity") | FAIL (BUG-12a) | `74-saida5-resultado.png` |
| M10 | **Transferência entre depósitos: não existe na UI** | FAIL (BUG-25) | `72-entrada20-form.png` |
| M11 | **Ajuste (ADJUSTMENT): não existe na UI** | FAIL (BUG-25) | `72-entrada20-form.png` |
| M12 | Dropdown de produto cobre os demais campos do modal | FAIL (BUG-26) | `mov-produto-dropdown-Entrada-20.png` |
| M13 | Filtros de movimentações (tipo/motivo) | BLOQUEADO por BUG-00 (página quebrada) | `139-movimentacoes-lista-final.png` |
| M14 | `/estoque/alertas` lista produto abaixo do mínimo (4 de 5) | PASS | `83-alertas.png` |
| M15 | KPI "Estoque Crítico" do dashboard bate com os alertas | PASS | `84-dashboard-estoque-critico.png` |

### 2.7 Permissões (vendedor@exemplo.com)

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| V01 | Login do vendedor funciona | PASS | `110-vendedor-dashboard.png` |
| V02 | **Vendedor vê o menu completo** (Estoque, Vendas, Financeiro, Configurações) | FAIL (BUG-27) | `111-vendedor-_estoque_movimentacoes.png` |
| V03 | **Vendedor vê no dashboard "A Pagar R$ 11.730,00", "A Receber", faturamento** | **FAIL** (BUG-27) | `110-vendedor-dashboard.png` |
| V04 | Vendedor acessa `/estoque/*` por URL direta — todas as telas abrem | FAIL (BUG-27) | `111-vendedor-*.png` |
| V05 | Backend bloqueia inventory (403) — **mas a UI mostra "Nenhuma movimentação encontrada"** | FAIL (BUG-28) | `111-vendedor-_estoque_movimentacoes.png` |
| V06 | Vendedor vê e clica "Nova Categoria"; só descobre o bloqueio depois do 403 | FAIL (BUG-27) | `112-vendedor-cria-categoria.png` |
| V07 | Vendedor vê botão de excluir cliente; só descobre o bloqueio depois do 403 | FAIL (BUG-27) | `113`, `114-vendedor-excluir-cliente-result.png` |
| V08 | Vendedor consegue LER produtos, categorias e marcas (sem 403) | obs. — verificar se é intencional | `111-vendedor-_estoque_produtos.png` |
| V09 | Logout do vendedor | PASS | `116-apos-logout.png` |

**Ficou fora do escopo testado:** expiração real do JWT (~15 min) com refresh bem-sucedido em segundo plano; upload de imagem de produto (aba Imagens); importação CSV de clientes/produtos; variações de produto; filtros de `/estoque/movimentacoes` (bloqueados pelo BUG-00); atributos CFOP (não existem no cadastro de produto).

---

## 3. Bugs (ordenados por severidade)

---

### BUG-00 — [CRÍTICO] `/estoque/movimentacoes` faz white-screen com movimentação do tipo RETURN/PRODUCTION

**Passos**
1. Fazer login como admin.
2. Garantir que exista pelo menos uma movimentação com `type = RETURN` (o próprio sistema gera ao estornar/trocar um item de pedido — foi criada por outro fluxo durante o teste).
3. Acessar `http://localhost:3000/estoque/movimentacoes`.

**Esperado:** a lista renderiza com um badge "Devolução" (ou equivalente) na linha.
**Obtido:** a página inteira quebra com `Unhandled Runtime Error: TypeError: Cannot read properties of undefined (reading 'variant')`. Nada da tela é utilizável (nem filtros, nem "Nova movimentação", nem histórico).

**Causa raiz**
`apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:29-35` declara `typeConfig` com apenas 4 chaves (`ENTRY`, `EXIT`, `ADJUSTMENT`, `TRANSFER`), e `:81-83` faz `const config = typeConfig[row.type]` seguido de `config.variant` sem guarda.
O enum do banco (`apps/api/src/database/prisma/schema.prisma:47-54`) tem **6** valores: `ENTRY, EXIT, TRANSFER, ADJUSTMENT, RETURN, PRODUCTION`.
Confirmado via API: `GET /api/v1/inventory/movements` retorna `{"type": "RETURN", "reason": "RETURN_CUSTOMER", ...}`.
O mesmo problema existe em `reasonLabels` (`:38-50`), mas ali há fallback (`?? row.reason`).

**Arquivo/linha:** `apps/web/app/(dashboard)/estoque/movimentacoes/page.tsx:29` e `:81-83`
**Evidência:** `shots/auth-estoque/139-movimentacoes-lista-final.png`

---

### BUG-01 — [CRÍTICO] Campo de moeda grava valores errados por ordem de grandeza

**Passos**
1. Ir em `/estoque/produtos/novo` → aba **Preços**.
2. Clicar no campo "Preço de Custo" (ele já contém `0,00`, alinhado à direita).
3. Digitar `1234` esperando **R$ 12,34**.

**Esperado:** R$ 12,34.
**Obtido:** **R$ 12.300,04** (1000x maior). Outras medições:
| Digitado | Esperado | Obtido |
|---|---|---|
| `1` | R$ 0,01 | R$ 10,00 |
| `12` | R$ 0,12 | R$ 120,00 |
| `1234` | R$ 12,34 | R$ 12.300,04 |
| `199990` | R$ 1.999,90 | R$ 1.990.009,90 |

O valor errado é **salvo no banco sem nenhum aviso** (confirmado via API: produto `QA-OK-34862` ficou com `costPrice: 100000` / `salePrice: 200000` quando eu digitei `10000`/`20000`).

**Causa raiz**
`apps/web/components/forms/money-input.tsx`:
- `displayValue` (linha ~68) renderiza `formatNumberToBRL(0)` = `"0,00"` mesmo quando o campo está "vazio", então o placeholder nunca aparece e o input sempre tem conteúdo;
- o input é `text-right` e controlado — ao clicar, o cursor cai na **posição 0** (à esquerda do texto), e nenhum `setSelectionRange` é feito após o re-render;
- `formatInputValue` (linha ~32) apenas remove todos os não-dígitos do valor cru, então cada tecla digitada no início da string multiplica o número em vez de acrescentar centavos.

**Arquivo/linha:** `apps/web/components/forms/money-input.tsx:32-38` e `:66-70`
**Impacto:** todos os campos monetários do ERP que usam `MoneyInput` (preço de custo, venda, promocional; provavelmente também pedidos e financeiro).
**Evidência:** `shots/auth-estoque/61-money-click-1234.png`, `58-money-input-digitacao.png`, `59-money-input-199990.png`

---

### BUG-02 — [ALTO] Produto com saldo em estoque é excluído sem bloqueio, deixando alerta órfão

**Passos**
1. Criar um produto, dar entrada de 20 un, deixar saldo em 4 un com estoque mínimo 5 (produto aparece em `/estoque/alertas`).
2. Em `/estoque/produtos`, clicar no ícone de lixeira da linha → "Excluir".
3. F5 na lista; depois abrir `/estoque/alertas`.

**Esperado:** o ERP deve **bloquear** (ou ao menos avisar) a exclusão de produto com saldo/movimentações, e, se permitir, resolver os alertas associados.
**Obtido:** exclusão concluída com sucesso (o produto some da lista após F5), mas **o alerta de estoque continua listado em `/estoque/alertas`** ("QA Produto EDITADO / QA-OK-34862 / 4 / 5 / Makeimports / Ativo") e o KPI "Estoque Crítico" do dashboard continua contando esse item. O diálogo de confirmação também não menciona que há saldo.

**Evidência:** `shots/auth-estoque/131-produto-confirm-delete.png`, `132-produto-delete-result.png`, `133-produtos-apos-delete.png`, `134-alertas-apos-delete-produto.png`

---

### BUG-03 — [ALTO] Login com senha errada / e-mail inexistente não mostra erro nenhum e limpa o formulário

**Passos**
1. Ir em `/login`, preencher `admin@admin.com` / `senhaerrada123`, clicar em Entrar.

**Esperado:** banner vermelho "Email ou senha inválidos" (a página tem esse banner implementado), com os campos preservados.
**Obtido:** a página **recarrega**, os campos ficam vazios e **nenhuma mensagem é exibida**. O usuário não tem ideia do que aconteceu. Idem para e-mail inexistente.

**Causa raiz**
O interceptor de resposta do axios em `apps/web/lib/api.ts:49` trata **qualquer** 401 como "token expirado" — inclusive o 401 legítimo do próprio `POST /auth/login`. Ele então chama `POST /auth/refresh` (que responde 400, pois não há refresh token), cai no `catch` e executa `window.location.href = "/login"` (linha 88), forçando um reload que descarta o estado React onde a mensagem de erro tinha sido setada.
Evidência no log de rede: `HTTP 401 POST /auth/login` seguido imediatamente de `HTTP 400 POST /auth/refresh`.

**Arquivo/linha:** `apps/web/lib/api.ts:49` e `:88` (falta excluir as rotas `/auth/login` e `/auth/refresh` do fluxo de refresh)
**Evidência:** `shots/auth-estoque/05-login-senha-errada.png`, `06-login-email-inexistente.png`

---

### BUG-04 — [ALTO] CPF e CNPJ inválidos são aceitos (sem validação de dígito verificador)

**Passos**
1. `/clientes/novo` → Pessoa Física → CPF `111.111.111-11`, nome/e-mail/telefone válidos → Salvar.
2. Repetir com Pessoa Jurídica e CNPJ `11.111.111/1111-11`.

**Esperado:** rejeitar com "CPF inválido" / "CNPJ inválido" (DV inválido e sequência repetida).
**Obtido:** ambos são **criados com sucesso** e aparecem na listagem com máscara.

**Causa raiz**
- Front: `apps/web/app/(dashboard)/clientes/novo/page.tsx:23-29` valida apenas **quantidade de dígitos** (`11 || 14`), não o DV.
- Back: `apps/api/src/modules/crm/dto/customer.dto.ts` valida `document` apenas com `@IsString() @MaxLength(18)`.

**Evidência:** `shots/auth-estoque/15-cliente-cpf-invalido-resultado.png`, `16-cliente-cnpj-invalido-resultado.png`, `21-cliente-busca-criado.png` (as duas linhas inválidas estão na lista)

---

### BUG-05 — [ALTO] Preço de venda menor que o custo é aceito sem nenhum aviso

**Passos**
1. `/estoque/produtos/novo`, Nome + SKU, aba Preços: custo R$ 500.000,00, venda R$ 100.000,00 → Publicar.

**Esperado:** bloquear ou, no mínimo, exibir um aviso de margem negativa (comportamento padrão em Totvs/SAP B1/Omie).
**Obtido:** produto criado normalmente. Confirmado via API: `QA-MARG-34862 | custo 500000 | venda 100000`. A tela de detalhe do produto calcula e exibe "Margem", mas nunca alerta quando ela é negativa. Não há `superRefine` cruzando `costPrice`/`salePrice` no schema.

**Arquivo/linha:** `apps/web/app/(dashboard)/estoque/produtos/novo/page.tsx:34-72` (schema sem validação cruzada)
**Evidência:** `shots/auth-estoque/51-produto-margem-negativa-form.png`, `52-produto-margem-negativa-result.png`

---

### BUG-06 — [ALTO] Não existe edição de cliente (CRUD sem "U")

**Passos**
1. Abrir o detalhe de qualquer cliente.
2. Procurar o botão "Editar". Tentar `/clientes/<id>/edit`.

**Esperado:** poder corrigir nome/e-mail/telefone/documento de um cliente.
**Obtido:** o detalhe só tem "Excluir". A rota `/clientes/[id]/edit` retorna **404**. O ícone `Edit` está importado em `apps/web/app/(dashboard)/clientes/[id]/page.tsx:26` mas nunca é usado, e não existe diretório `clientes/[id]/edit`. O backend expõe `PATCH /customers/:id`, ou seja, a capacidade existe e só falta a tela.

**Evidência:** `shots/auth-estoque/28-cliente-detalhe.png`, `30-cliente-edit-404.png`

---

### BUG-07 — [ALTO] Layout mobile quebrado: sidebar fixa corta todo o conteúdo em 390x844

**Passos**
1. Logar e definir o viewport em 390x844.
2. Acessar `/`, `/clientes`, `/estoque/produtos`, `/estoque/alertas`.

**Esperado:** sidebar colapsada em drawer/hambúrguer; conteúdo ocupando a largura disponível.
**Obtido:** a sidebar continua expandida com ~264px fixos; o conteúdo é empurrado para fora da viewport e **fica cortado sem scroll horizontal** (`document.scrollWidth === clientWidth === 390`), portanto inacessível. Em `/clientes` só se vê a coluna "Nome" pela metade; no dashboard só se vê metade dos cards.

**Evidência:** `shots/auth-estoque/09-dashboard-mobile.png`, `33-clientes-mobile.png`, `122-produtos-mobile.png`, `142-alertas-mobile.png`

---

### BUG-08 — [ALTO] NCM e EAN aceitam qualquer texto (sem validação fiscal)

**Passos**
1. `/estoque/produtos/novo` → aba Fiscal → NCM `ABCDEFG`, EAN `123` → Publicar.

**Esperado:** NCM deve ter 8 dígitos (aceitando pontuação `0000.00.00`); EAN/GTIN deve ter 8, 12, 13 ou 14 dígitos com dígito verificador.
**Obtido:** produto criado. Confirmado via API: `QA-NCM-34862 | ncm 'ABCDEFG' | ean '123'`. O schema só limita tamanho (`ncm.max(10)`, `ean.max(14)`) e o backend não valida formato. Num ERP brasileiro isso gera rejeição de NF-e em produção. **Também não existe campo CFOP** em nenhuma aba do cadastro de produto.

**Arquivo/linha:** `apps/web/app/(dashboard)/estoque/produtos/novo/page.tsx:64-67`
**Evidência:** `shots/auth-estoque/56-produto-ncm-invalido.png`, `64-produto-detalhe.png`

---

### BUG-09 — [ALTO] Violações das Rules of Hooks geram erros de React em produção-dev

**9a — `CustomerDetailPage`**
`apps/web/app/(dashboard)/clientes/[id]/page.tsx`: há dois `return` condicionais nas linhas **55** (`if (isLoading)`) e **63** (`if (!customer)`), e só na linha **72** vem `const { addToast } = useToast();`. Resultado no console ao abrir qualquer cliente:
`Warning: React has detected a change in the order of Hooks called by CustomerDetailPage. This will lead to bugs and errors if not fixed.`

**9b — `ConfirmDialog` (afeta o app inteiro)**
`apps/web/components/ui/confirm-dialog.tsx`: `if (!open) return null;` na linha **40**, e `React.useEffect` (handler de Escape) na linha **59**. Resultado ao abrir qualquer diálogo de confirmação (excluir categoria, marca, produto, cliente):
`Warning: Internal React error: Expected static flag was missing. Please notify the React team.`
Consequência prática: o listener de Escape é montado/desmontado de forma inconsistente e a montagem/desmontagem do componente fica imprevisível.

**Evidência:** logs de `t03-clientes2.js`, `t12-delete-inuse.js`, `t15-final.js`

---

### BUG-10 — [MÉDIO] Toasts genéricos escondem o motivo real do erro do backend

O backend devolve mensagens específicas e úteis, mas a UI as descarta e mostra um texto genérico. Casos comprovados:

| Ação | Resposta do backend | Toast exibido |
|---|---|---|
| Cliente com documento duplicado | 409 `Já existe um cliente com o documento "529.982.247-25"` | "Erro ao criar cliente. Tente novamente." |
| Produto com SKU duplicado | 409 `Product with SKU "QA-OK-34862" already exists` | "Erro ao criar produto..." |
| Categoria com slug duplicado | 409 `Category with slug "..." already exists` | "Erro ao criar categoria." |
| Marca duplicada | 409 `Brand "..." already exists` | "Erro ao criar marca." |
| Excluir categoria em uso | 409 `Cannot delete category: 4 product(s) are still using it` | "Erro ao excluir categoria." |
| Excluir marca em uso | 409 `Cannot delete brand: 4 product(s) are still using it` | "Erro ao excluir marca." |

O helper `getApiErrorMessage` já existe em `apps/web/lib/api.ts` e é usado corretamente no diálogo de movimentação — só não foi aplicado nas demais telas. O `apps/web/CLAUDE.md` do projeto inclusive exige "mensagem de erro clara e amigável".

Agravante: nas telas de categoria/marca, o **diálogo de confirmação nem avisa** que o item está em uso, mesmo com a coluna "Produtos" mostrando 4 na própria linha.

**Evidência:** `22-cliente-duplicidade.png`, `55-produto-sku-duplicado.png`, `90-categorias-duplicado.png`, `98-categoria-delete-result.png`, `101-marca-delete-result.png`

---

### BUG-11 — [MÉDIO] Erros de validação em abas ocultas: o formulário de produto "não faz nada" ao salvar

**Passos**
1. `/estoque/produtos/novo`, preencher só Nome e SKU (aba Dados Gerais), clicar em "Publicar Produto".

**Esperado:** indicação visual de que a aba "Preços" tem pendências (badge/asterisco na aba) ou troca automática para a primeira aba com erro.
**Obtido:** nada acontece — nenhum toast, nenhum erro visível, a URL não muda. Só ao clicar manualmente na aba "Preços" é que aparece "Preço de venda é obrigatório". Mesmo comportamento com estoque mínimo negativo (erro fica escondido na aba Dados Gerais).

Detalhe adicional: o label "Preço de Custo" **não tem o asterisco** de obrigatório, embora o zod o exija.

**Evidência:** `shots/auth-estoque/46-produto-erros-aba-oculta.png`, `47-produto-erros-aba-precos.png`, `57-produto-min-negativo.png`

---

### BUG-12 — [MÉDIO] Depósitos: múltiplos "Padrão", cidade/UF/contagem quebradas, sem editar/excluir

**12a — Mensagem de erro em inglês vazando para o usuário**
Ao tentar dar saída num depósito sem registro de estoque, o toast exibe literalmente **"Cannot create inventory item with negative quantity"**. Num ERP brasileiro isso é inaceitável; deveria ser "Estoque insuficiente no depósito X (disponível: N)".
Origem: `apps/api/src/modules/inventory/inventory.service.ts:803` (e `:788-790` `Insufficient stock. Current: 19, Change: -999`).
Evidência: `shots/auth-estoque/74-saida5-resultado.png`

**12b — Card do depósito com dados inexistentes**
`apps/web/app/(dashboard)/estoque/depositos/page.tsx:59-60` renderiza `{warehouse.address}, {warehouse.city} - {warehouse.state}` e `:68` renderiza `{warehouse.productCount}`. **A API `GET /inventory/warehouses` não retorna `city`, `state` nem `productCount`** (retorna apenas id, name, code, address, isDefault). Resultado na tela: endereço terminando em `", -"` e um badge que diz apenas `" produtos"` sem número.
Evidência: `shots/auth-estoque/70-depositos.png`

**12c — Vários depósitos "Padrão" ao mesmo tempo**
Após criar um depósito com a caixa "Padrão" marcada, a tela passou a exibir **3 depósitos com o badge "Padrão"**. `createWarehouse` (`apps/api/src/modules/inventory/inventory.service.ts:70-89`) grava `isDefault` sem rebaixar o default anterior. Isso torna ambíguo o depósito usado por vendas/balcão.
Evidência: `shots/auth-estoque/95-deposito-criado.png`

**12d — Depósito não pode ser editado nem excluído** (só criado). Não há ícones de ação nos cards.

---

### BUG-13 — [MÉDIO] Colunas "Pedidos" e "Total Gasto" da lista de clientes nunca são preenchidas

`apps/web/app/(dashboard)/clientes/page.tsx:139-150` usa os acessores `totalOrders` e `totalSpent`, mas `GET /api/v1/customers` devolve `_count: { orders: N }` e **não devolve** `totalOrders`/`totalSpent`. Resultado: a coluna "Pedidos" fica em branco em todas as linhas e "Total Gasto" mostra `R$ 0,00` mesmo para clientes com pedidos (verificado: o cliente `cms9jrg2a...` tem o pedido `PED-000010`). O mesmo vale para os cards do detalhe do cliente ("Total de Pedidos 0", "Total Gasto R$ 0,00").
**Evidência:** `shots/auth-estoque/10-clientes-lista.png`, `28-cliente-detalhe.png`

---

### BUG-14 — [MÉDIO] Coluna CLIENTE vazia em "Pedidos Recentes" no dashboard

Todos os 5 pedidos recentes aparecem sem nome de cliente. Confirmado na API: `GET /orders` retorna `customerId` preenchido mas `customerName: null` e `total: null`.
**Evidência:** `shots/auth-estoque/120-dashboard-admin-atual.png`

---

### BUG-15 — [MÉDIO] Duplicidade de documento é burlável mudando a formatação

`apps/api/src/modules/crm/customers.service.ts:134-142` compara `document` como **string literal**. Assim, `12345678909` e `123.456.789-09` são tratados como documentos diferentes.

Reprodução (confirmada via API — caminho real na UI é o botão "Importar CSV", que não passa pela máscara):
```
Existente: Maria da Silva Santos — 123.456.789-09
POST /customers {"name":"QA Dup Formato","document":"12345678909","documentType":"CPF"} → 201 Created
```
O banco (seed) já contém um caso assim: "Test Customer E2E" com `12345678901` sem máscara, exibido cru na listagem. A comparação (e o armazenamento) deveriam ser feitos sobre os dígitos normalizados.

---

### BUG-16 — [MÉDIO] Nenhuma busca automática de endereço por CEP; cadastro de cliente sem endereço

- `/clientes/novo` tem **apenas 4 campos** (nome, documento, e-mail, telefone). Não há CEP nem endereço, embora o detalhe do cliente tenha uma aba "Endereços" que nunca pode ser preenchida pela UI.
- No formulário de depósito existe CEP (com máscara correta `01310-100`), mas ele **não busca o endereço**. Não há nenhuma integração ViaCEP/BrasilAPI no código do front (`grep -r "viacep|brasilapi" apps/web` = 0 ocorrências).

**Evidência:** `shots/auth-estoque/12-cliente-novo-form.png`, `29-cliente-tab-Endereos.png`, `94-deposito-preenchido.png`

---

### BUG-17 — [MÉDIO] `/login` acessível estando logado

Estando autenticado, navegar para `/login` mostra o formulário de login em vez de redirecionar para `/`.
**Evidência:** `shots/auth-estoque/08-login-estando-logado.png`

---

### BUG-18 — [MÉDIO] Busca global do topbar não faz nada

O campo "Buscar..." do cabeçalho aceita digitação mas não dispara busca, não abre resultados e não muda a rota.
**Evidência:** `shots/auth-estoque/32-busca-global.png`

---

### BUG-19 — [MÉDIO] Tokens JWT em `localStorage` (sem cookie httpOnly)

`erp_token` e `erp_refresh_token` ficam em `localStorage` (nenhum cookie é setado). Qualquer XSS refletido no ERP entrega a sessão inteira, inclusive o refresh token de 7 dias.
**Evidência:** log do `t01-auth.js`

---

### BUG-20 — [ALTO] Nome de produto longo destrói o layout da tabela de produtos

**Passos**
1. Criar um produto com nome de 255 caracteres sem espaços (o `maxLength` do próprio campo permite).
2. Abrir `/estoque/produtos`.

**Esperado:** truncamento com reticências (`truncate`/`max-w`) ou scroll horizontal no container.
**Obtido:** a célula expande a tabela indefinidamente e **empurra Categoria, Preço, Estoque, Status e Ações para fora da tela**, sem scroll horizontal utilizável. Todas as demais linhas ficam inutilizáveis até o produto ser removido.

**Evidência:** `shots/auth-estoque/127-produtos-com-nome-longo.png`

---

### BUG-21 — [BAIXO] Concordância: "1 itens" no card Estoque Crítico

Deve ser "1 item".
**Evidência:** `shots/auth-estoque/84-dashboard-estoque-critico.png`

---

### BUG-22 — [BAIXO] Datas do gráfico do dashboard em formato ISO/US (`07-31`)

O eixo X do gráfico "Vendas do Período" e o tooltip usam `2026-07-22` / `07-31`. Padrão BR exigido: `22/07` e `22/07/2026`.
**Evidência:** `shots/auth-estoque/120-dashboard-admin-atual.png`, `110-vendedor-dashboard.png`

---

### BUG-23 — [BAIXO] Rótulos inconsistentes no gráfico "Pedidos por Status"

O eixo mostra "Separação" e a legenda mostra "Separando" para o mesmo status.
**Evidência:** `shots/auth-estoque/121-dashboard-rodape.png`

---

### BUG-24 — [BAIXO] Mensagem imprecisa para preço de venda zero

Preencher venda `0,00` exibe "Preço de venda é obrigatório" (o campo está preenchido). Deveria ser "Preço de venda deve ser maior que zero".
**Arquivo/linha:** `apps/web/app/(dashboard)/estoque/produtos/novo/page.tsx:48-51`
**Evidência:** `shots/auth-estoque/50-produto-venda-zero.png`

---

### BUG-25 — [ALTO] Transferência entre depósitos e Ajuste de estoque não existem na UI

O modal "Nova movimentação" oferece **apenas** "Entrada (adicionar)" e "Saída (remover)". O comentário no código diz *"transfers/adjustments have their own flows"* (`apps/web/app/(dashboard)/estoque/movimentacoes/_components/movement-form-dialog.tsx:36`), mas **esses fluxos não existem em lugar nenhum do front** (`grep` por TRANSFER/ADJUSTMENT em `apps/web/app/(dashboard)/estoque` só retorna definições de tipo).

O backend suporta: `POST /api/v1/inventory/transfer` (com validação de depósito de origem ≠ destino e de saldo suficiente — `inventory.service.ts:435` e `:459`) e `ADJUSTMENT` em `POST /inventory/movement`. Ou seja, a capacidade existe e simplesmente não foi exposta. Movimentação entre depósitos e ajuste de inventário são funções básicas de qualquer ERP.

**Não foi possível testar** transferência e ajuste pela UI (cenário BLOQUEADO).
**Evidência:** `shots/auth-estoque/72-entrada20-form.png`

---

### BUG-26 — [BAIXO] Dropdown de produto cobre o restante do modal de movimentação

Ao abrir o seletor de produto no modal "Nova movimentação", a lista de resultados se sobrepõe aos campos Depósito, Quantidade, Motivo e Observações, e o modal não cresce/rola. Torna a navegação por mouse desconfortável (foi necessário `force: true` no automated test).
**Evidência:** `shots/auth-estoque/mov-produto-dropdown-Entrada-20.png`

---

### BUG-27 — [ALTO] Vendedor enxerga menu e dados administrativos; não há guarda de rota no front

**Passos**
1. Logar como `vendedor@exemplo.com` / `Vendedor@123`.
2. Observar a sidebar e o dashboard; depois navegar por URL direta em `/estoque/produtos`, `/estoque/categorias`, `/estoque/depositos`, `/estoque/movimentacoes`, `/estoque/alertas`.

**Esperado:** menu filtrado por permissão e rotas administrativas bloqueadas (redirect ou "Acesso negado").
**Obtido:**
- A sidebar exibe **Estoque, Vendas, Financeiro e Configurações** completos.
- O **dashboard mostra os mesmos KPIs financeiros do admin**: "A Pagar (aberto) R$ 11.730,00", "A Receber (aberto) R$ 2.359,00", "Vendas do Dia R$ 887,60", "Ticket Médio R$ 221,90" e o gráfico de faturamento. Contas a pagar não deveriam ser visíveis a um vendedor.
- Todas as 11 rotas testadas abrem normalmente (nenhuma bloqueada no front).
- Botões de ação administrativa (Nova Categoria, Novo Produto, excluir cliente) ficam **habilitados**; o vendedor só descobre a restrição depois de submeter e receber 403.

O backend está correto (403 "Permissão insuficiente para esta ação" nos endpoints de inventory e nas mutações), mas a camada de apresentação não respeita nada disso.
**Evidência:** `shots/auth-estoque/110-vendedor-dashboard.png`, `111-vendedor-*.png`, `112-vendedor-cria-categoria.png`, `114-vendedor-excluir-cliente-result.png`

---

### BUG-28 — [MÉDIO] Erro 403 é renderizado como "lista vazia", enganando o usuário

Quando o vendedor abre `/estoque/movimentacoes`, `/estoque/alertas` ou `/estoque/depositos`, a API responde **403** mas a tela mostra o estado vazio normal: *"Nenhuma movimentação encontrada — As movimentações de estoque aparecerão aqui"* e *"Nenhum registro"*. O usuário conclui que não existem dados, quando na verdade não tem permissão. Nenhum tratamento de erro é feito nos hooks de listagem.
**Evidência:** `shots/auth-estoque/111-vendedor-_estoque_movimentacoes.png`, `111-vendedor-_estoque_alertas.png`, `111-vendedor-_estoque_depositos.png`

---

## 4. Confirmações via API (usadas apenas para validar bugs vistos na UI)

```
# BUG-04 — CPF/CNPJ inválidos persistidos
GET /api/v1/customers → "Cliente Teste CPF Invalido" document "111.111.111-11"
                        "Empresa CNPJ Invalido LTDA" document "11.111.111/1111-11"

# BUG-01/BUG-05 — preços gravados
GET /api/v1/products?search=QA-
  QA-MARG-34862 | custo 500000 | venda 100000     (margem negativa aceita)
  QA-NEG-34862  | custo 1      | venda 0.5
  QA-NCM-34862  | ncm 'ABCDEFG' | ean '123'        (BUG-08)

# BUG-00 — tipo não mapeado no front
GET /api/v1/inventory/movements → {"type":"RETURN","reason":"RETURN_CUSTOMER"}
enum MovementType (schema.prisma:47) = ENTRY, EXIT, TRANSFER, ADJUSTMENT, RETURN, PRODUCTION
typeConfig (movimentacoes/page.tsx:29) = ENTRY, EXIT, ADJUSTMENT, TRANSFER   ← faltam 2

# BUG-12b — campos que a UI espera e a API não devolve
GET /api/v1/inventory/warehouses → {id,name,code,address,isDefault}   (sem city/state/productCount)
                                    2 registros com isDefault:true    (BUG-12c)

# BUG-13 — totais do cliente
GET /api/v1/customers → "_count":{"orders":0}   (sem totalOrders/totalSpent)

# BUG-15 — duplicidade burlável por formatação
POST /api/v1/customers {"document":"12345678909"} → 201  (já existia "123.456.789-09")
```

## 5. Dados de teste deixados no ambiente

Criados durante o ciclo e **não** removidos (podem ser limpos):
`QA Cliente Valido 63558`, `Cliente Teste CPF Invalido`(excluído), `Empresa CNPJ Invalido LTDA`, `QA Dup Formato`;
produtos `QA-NEG-34862`, `QA-MARG-34862`, `QA-NCM-34862`, `QA-LONG-1785540441366` (nome de 255 chars — este quebra a tela de produtos, ver BUG-20; recomendo excluir);
categoria `QA categorias 4902`, marca `QA marcas 4902`, depósito `QA Deposito ...` (marcado como Padrão);
movimentações de estoque no depósito `Makeimports`.

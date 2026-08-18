# Lote 11 — Filtros por entidade cadastrada ✅

> **Concluído em 03/08/2026.** 11/11 itens; 22 testes E2E novos e 35 de unidade.
> Resultado e decisões no fim do arquivo.

> Todo filtro que aponta para algo **cadastrado no sistema** — categoria, marca, depósito, cliente,
> conta, caixa — tem de ser um select alimentado pela API. Hoje **2** deles são campo de texto livre
> enviado como id, o que os torna impossíveis de acertar, e **16** filtros que a API já aceita não
> existem em tela nenhuma — sendo 4 deles também por entidade.
> Estimativa: **3 dias**. Depende do lote 4 (permissões) e do lote 8 (busca por entidade).

| Bug | Sev. | Resumo |
|---|---|---|
| FT-01 | 🔴 Crítico | Produtos: filtro "Categoria" é texto livre enviado como `categoryId` (cuid) — sempre zero resultados |
| FT-02 | 🔴 Crítico | Produtos: filtro "Marca", o mesmo com `brandId` |
| FT-03 | 🟠 Alto | Movimentações: `productId` e `warehouseId` aceitos pela API, sem campo na tela |
| FT-04 | 🟠 Alto | Pedidos: `customerId` aceito pela API, sem campo na tela |
| FT-05 | 🟠 Alto | Contas financeiras, métodos e condições de pagamento: sem busca e sem filtro nenhum |
| FT-06 | 🟠 Alto | Sessões de caixa: sem filtro por caixa e por status |
| FT-07 | 🟡 Médio | Clientes: `tag` e `documentType` aceitos pela API, sem campo na tela |
| FT-08 | 🟢 Baixo | Filtrar por categoria-pai não traria os produtos das subcategorias (latente: ainda não há nenhuma) |
| FT-09 | 🟡 Médio | Pedidos e Clientes usam `<select>` nativo em vez do `Select` do design system |
| FT-10 | 🟡 Médio | Alertas de estoque: sem filtro por depósito (a API também não aceita) |
| FT-11 | 🟢 Baixo | Cada tela reimplementa o painel de filtros (toggle, contador, "Limpar filtros") |

---

## 11.0 — O mapa: o que a API aceita × o que a tela oferece

A varredura comparou cada `*QueryDto` do backend com o painel de filtros da tela correspondente.

| Tela | A API aceita | A tela oferece | Lacuna |
|---|---|---|---|
| **Produtos** | `search`, `status`, `categoryId`, `brandId` | busca, status ✔, **categoria (texto)**, **marca (texto)** | FT-01, FT-02 |
| **Pedidos** | `search`, `status`, `origin`, `customerId`, `dateFrom/To` | busca, status ✔, origem ✔, datas ✔ | FT-04, FT-09 |
| **Clientes** | `search`, `segment`, `tag`, `documentType` | busca, segmento ✔ | FT-07, FT-09 |
| **Movimentações** | `productId`, `warehouseId`, `type`, `reason`, `dateFrom/To` | tipo ✔, motivo ✔, datas ✔ | FT-03 |
| **Lançamentos** | `startDate/endDate`, `type`, `accountId`, `status` | todos ✔ — **Conta é select da API** | — (é a referência) |
| **Alertas** | `status` | status ✔ | FT-10 (falta no backend também) |
| **Contas financeiras** | `search`, `type`, `isActive` | nada | FT-05 |
| **Métodos de pagamento** | `search`, `type`, `isActive` | nada | FT-05 |
| **Condições de pagamento** | `search`, `type`, `isActive` | nada | FT-05 |
| **Sessões de caixa** | `cashRegisterId`, `status` | nada | FT-06 |
| **Categorias / Marcas** | `search` | busca ✔ | — |

**A conta é 2 + 16.** Dois filtros por entidade estão quebrados (categoria e marca) e dezesseis
existem na API sem campo em tela — desses, 4 são por entidade (cliente, produto, depósito, caixa) e
12 são enums ou busca (`search`, `type`, `isActive`, `status`, `tag`, `documentType`).

**`/financeiro/lancamentos` já faz certo** e é o padrão a copiar: o campo "Conta" é um `Select`
alimentado por `useFinancialAccounts()`, com "Todas" como opção. Os 6 filtros por entidade deste lote
— os 2 quebrados e os 4 ausentes — são esse mesmo componente aplicado onde ele falta.

---

## 11.1 — FT-01 + FT-02: os dois filtros quebrados

**Arquivo:** `apps/web/app/(dashboard)/estoque/produtos/page.tsx:325-350`

```tsx
<Input
  value={categoryFilter}
  onChange={(e) => setCategoryFilter(e.target.value)}
  placeholder="Filtrar por categoria"
/>
```

O valor vai direto para `categoryId` na query, e o backend faz `where.categoryId = categoryId`
(`products.service.ts:58`) — comparação **exata com um cuid**. Digitar "Eletrônicos" pesquisa por um
id chamado `Eletrônicos` e devolve zero linhas, sempre. Não existe texto que o usuário possa digitar
para este filtro funcionar; só um cuid, que ele não tem como conhecer.

Isto não é desconforto de UX: é um controle que **nunca** produz o resultado certo, e que ainda por
cima parece funcionar (a tabela responde "nenhum registro", que é a mesma tela de um filtro legítimo
sem resultados — a família do AE-28).

**Passos**

1. Trocar os dois `<Input>` por `<EntityFilterSelect>` (11.6), alimentados por `useCategories()` e
   `useBrands()` — **os dois hooks já existem** e são usados pelo formulário de produto.
2. Categorias são uma árvore no modelo (hoje a base só tem nós de topo): achatar com indentação por
   profundidade, como `estoque/categorias/page.tsx` já faz (`flattenTree`), para "Eletrônicos › Áudio"
   ficar legível assim que existir.
3. Mostrar a contagem que a API já devolve (`_count.products`) ao lado do nome — o operador vê de
   antemão que "Casa & Decoração (1)" tem pouco a filtrar.
4. Uma categoria/marca apagada continua referenciada por produtos antigos; o select tem de exibir o
   valor selecionado mesmo que ele não esteja mais na lista, senão o filtro ativo vira um campo vazio
   com resultados filtrados — pior que o bug original.

**Aceite:** abrir Produtos › Filtros › Categoria mostra as categorias cadastradas; escolher uma filtra
a tabela; nenhum campo de filtro que espera id aceita digitação livre.

---

## 11.2 — FT-03 + FT-04: filtros que a API aceita e a tela não oferece

Estes não estão quebrados: **não existem**, embora o backend esteja pronto há tempo.

- **FT-03 — Movimentações** (`estoque/movimentacoes/page.tsx`). `MovementQueryDto` aceita `productId`
  e `warehouseId`. Sem eles, responder "o que entrou e saiu do Depósito Central esta semana?" — a
  pergunta mais comum da tela — exige rolar a listagem inteira. Depósito é um `EntityFilterSelect`
  (poucos registros); produto é `SearchableSelect` com busca no servidor, o mesmo componente que o
  modal de movimentação já usa.
- **FT-04 — Pedidos** (`vendas/pedidos/page.tsx`). `OrderQueryDto` aceita `customerId`. A busca livre
  procura por número do pedido e nome do cliente juntos, então "Silva" traz pedidos de três clientes
  diferentes. O filtro por cliente é `SearchableSelect` — a base de clientes não cabe num dropdown.

**A regra de cardinalidade** (vale para o lote inteiro):

| Entidade | Ordem de grandeza | Componente |
|---|---|---|
| Categoria, marca, depósito, conta, caixa, método/condição de pagamento | dezenas | `EntityFilterSelect` (carrega tudo) |
| Cliente, produto | milhares | `SearchableSelect` (busca no servidor, 300 ms de debounce) |

Carregar todos os clientes num `<Select>` é o mesmo erro do dropdown de produto que o lote 2 já
resolveu com busca no servidor — não repetir.

---

## 11.3 — FT-05 + FT-06: telas sem filtro nenhum

Quatro telas não têm nem busca, apesar de a API aceitar:

| Tela | Adicionar |
|---|---|
| `financeiro/contas` | busca, tipo (Corrente/Poupança/Caixa/Digital), ativo/inativo |
| `configuracoes/metodos-pagamento` | busca, tipo, ativo/inativo |
| `configuracoes/condicoes-pagamento` | busca, tipo, ativo/inativo |
| `financeiro/caixa` (histórico de sessões) | **caixa** (`EntityFilterSelect` de `useCashRegisters`), status Aberto/Fechado |

O filtro "ativo/inativo" tem peso próprio: o lote 4 **desativou** as duplicatas acumuladas de métodos
e contas em vez de apagá-las, e o lote 8 passou a desativar depósitos com histórico. Sem esse filtro
não há como enxergar nem revisar o que foi desativado — a decisão de preservar o histórico fica
invisível.

---

## 11.4 — FT-07 + FT-08 + FT-09 + FT-10: acabamento

- **FT-07 — Clientes.** `tag` e `documentType` aceitos e não oferecidos. `documentType` é um select
  fixo (Pessoa Física / Jurídica); `tag` vem de uma lista aberta — expor as tags em uso exige um
  `GET /customers/tags`, ou fica fora deste lote.
- **FT-08 — Subcategorias.** `where.categoryId = categoryId` é exato, então filtrar por "Eletrônicos"
  não traria nada de "Eletrônicos › Áudio". **É latente, não um erro que o usuário já sofre**: a base
  tem 6 categorias, todas de topo, e nenhuma com filhas — conferido na API. Mas o modelo tem
  `parentId`/`children` e a tela de categorias já monta a árvore com `flattenTree`, então é uma
  hierarquia de verdade à espera do primeiro cadastro. Decidir agora, enquanto custa pouco: expandir
  os descendentes no `where` (`categoryId: { in: [...] }`) ou assumir "só esta categoria" e dizer
  isso na tela. **Recomendo expandir** — é o que se espera de uma hierarquia, e a alternativa vira
  bug de campo no dia em que alguém criar a primeira subcategoria.
- **FT-09 — `<select>` nativo.** Pedidos e Clientes usam `<select>` cru enquanto o resto do sistema
  usa o `Select` do design system. Além da aparência destoante, o sentinela de "todos" diverge:
  `value=""` nos nativos, `"__all"` nos demais. Padronizar no `Select`.
- **FT-10 — Alertas por depósito.** `AlertQueryDto` só aceita `status`. Um alerta de estoque baixo é
  sempre de um par produto×depósito, e a tela já mostra a coluna Depósito — filtrar por ela exige
  `warehouseId` no DTO e no `where`. É o único item do lote que precisa de backend novo.

---

## 11.5 — FT-11: o painel de filtros repetido

Produtos, Pedidos, Clientes e Movimentações reimplementam a mesma coisa: botão "Filtros" com contador
de filtros ativos, painel em grid, botão "Limpar filtros". São quatro cópias que já divergiram no
número de colunas e no comportamento do contador.

Extrair `<FilterPanel>` (`components/tables/filter-panel.tsx`) recebendo os campos como filhos e
cuidando de: alternância, contagem de ativos, "Limpar filtros" e — o que hoje nenhuma faz — **voltar
para a página 1** ao mudar qualquer filtro. Hoje cada tela chama `setPage(1)` à mão em cada
`onChange`, e um esquecimento deixa o usuário na página 7 de um resultado com duas páginas.

---

## 11.6 — O componente compartilhado

`components/forms/entity-filter-select.tsx`:

```tsx
<EntityFilterSelect
  label="Categoria"
  value={categoryFilter}
  onChange={setCategoryFilter}
  options={categoryOptions}   // { value, label, hint? }
  isLoading={categoriesLoading}
  error={categoriesError}
  allLabel="Todas as categorias"
/>
```

Responsabilidades, todas herdadas de bugs já corrigidos:

1. **Opção "Todas" com sentinela `"__all"`**, nunca `""` — o Radix trata string vazia como "sem
   valor" e o placeholder some.
2. **Estado de carregamento explícito.** Enquanto a lista não chega, o campo fica desabilitado com
   "Carregando…" em vez de vazio: um select vazio parece "não há categorias cadastradas".
3. **Erro nunca vira lista vazia** (AE-28). Sem permissão para ler a entidade, o filtro se esconde;
   com falha de rede, mostra o motivo. Um filtro vazio por 403 é a mesma mentira que a tabela vazia
   por 403.
4. **O valor selecionado sobrevive ao sumiço da opção** (item 4 da 11.1).
5. **Mudar o filtro volta para a página 1** (junto com o `<FilterPanel>`).

---

## Testes

- **Unidade (`entity-filter-select.test.tsx`)**: renderiza "Todas" com o sentinela certo; desabilita e
  rotula enquanto carrega; esconde-se em erro de permissão e mostra a mensagem em erro genérico;
  mantém o valor selecionado quando ele sai da lista.
- **Unidade (`filter-panel.test.tsx`)**: conta os filtros ativos; "Limpar filtros" zera todos;
  qualquer mudança dispara `onPageReset`.
- **API**: `products.service` filtra pela categoria **e pelas descendentes** — o teste precisa criar a
  subcategoria, porque a base não tem nenhuma (FT-08); `inventory.service` aceita `warehouseId` em
  alertas, que hoje responde 400 (FT-10).
- **E2E (`e2e/filtros.spec.ts`)**, a barreira que impede a regressão de classe:
  1. para cada tela de listagem, abrir o painel de filtros e afirmar que **nenhum campo que a API
     recebe como id é um `<input type="text">`** — é exatamente FT-01/FT-02 escrito como teste;
  2. em Produtos, escolher a primeira categoria do select e afirmar que a tabela responde com linhas
     (o filtro quebrado devolvia zero, sempre);
  3. afirmar que cada filtro ativo se reflete na query enviada à API — o efeito colateral do outro
     lado, na regra do lote 10.

---

## Checklist de saída do lote

- [ ] Nenhum filtro que a API recebe como id é campo de texto livre
      (`grep -rn "Filtrar por" apps/web/app` = 0)
- [ ] Todo filtro por entidade cadastrada é um select alimentado pela API
- [ ] Os 16 filtros que a API já aceita estão disponíveis em tela
- [ ] Alta cardinalidade (cliente, produto) usa busca no servidor, não dropdown carregado
- [ ] Nenhum `<select>` nativo remanescente (`grep -rn "<select" apps/web/app` = 0)
- [ ] Mudar qualquer filtro volta para a página 1
- [ ] Filtro sem permissão de leitura se esconde; filtro com erro mostra o motivo
- [ ] Regra registrada no `apps/web/CLAUDE.md`

---

---

## Resultado

### O que mudou

| Item | Entrega |
|---|---|
| FT-01/FT-02 | Categoria e Marca viraram `EntityFilterSelect` alimentado por `useCategories`/`useBrands`, com a árvore achatada e a contagem de produtos ao lado |
| FT-03 | Movimentações ganhou Depósito (select) e Produto (busca no servidor) |
| FT-04 | Pedidos ganhou Cliente (busca no servidor) |
| FT-05 | Contas, Métodos e Condições ganharam busca + tipo + situação |
| FT-06 | Histórico de sessões ganhou Caixa e Status |
| FT-07 | Clientes ganhou Tipo (Pessoa Física/Jurídica) |
| FT-08 | `products.findAll` expande a árvore de categorias (`resolveCategoryTree`) |
| FT-09 | Os dois `<select>` nativos viraram `Select` do design system |
| FT-10 | `AlertQueryDto` e `getLowStockAlerts` aceitam `warehouseId` e `productId` |
| FT-11 | `FilterPanel` + `useFilters` no lugar de quatro cópias do painel |

### Componentes criados

- `components/forms/entity-filter-select.tsx` — sentinela `__all`, estado de
  carregamento no rótulo, some no 403 e mostra o motivo no 5xx, preserva o valor
  selecionado quando a opção some da lista.
- `components/tables/filter-panel.tsx` — alternância, contador e "Limpar filtros".
- `components/tables/list-search.tsx` — busca com debounce para as telas que
  montam a própria tabela e por isso não herdavam a do `DataTable`.
- `hooks/use-filters.ts` — o reset de página é **efeito colateral do `set`**, não
  algo a lembrar em cada `onChange`.
- `lib/category-options.ts`, `lib/entity-search.ts` — opções da árvore e os
  carregadores por busca no servidor.
- `SearchableSelectBase` — extraído de `SearchableSelect`, que virou um wrapper
  fino do react-hook-form. Sem isso, o filtro por produto/cliente seria uma
  segunda cópia do dropdown inteiro.

### Decisões que fogem da letra do plano

1. **O reset de página saiu do `FilterPanel` e foi para o `useFilters`.** O plano
   o coloca no painel, mas quem tem o estado é a tela — o painel não teria como
   forçá-lo. Como efeito do `set`, é estrutural em vez de lembrado.
2. **`tag` em Clientes ficou de fora**, como o próprio plano previa: expor as
   tags em uso exige um `GET /customers/tags` que não existe. `documentType`
   entrou.
3. **`next lint` não cobria `hooks/` nem `stores/`.** Descoberto ao rodar o
   ESLint direto: havia erros invisíveis ao portão do CI (um import morto em
   `use-auth.test.ts`). O alvo passou a listar os diretórios explicitamente, e
   os erros que apareceram foram corrigidos — o lint segue em **0 erros**.

### Achados novos

1. **Botões de paginação sem nome acessível.** As quatro setas do `DataTable`
   eram só ícone; o tooltip do Radix é `aria-describedby` e não substitui o
   rótulo. É o mesmo achado do lote 8 em outro componente — e de novo foi o teste
   de UI que denunciou, ao não conseguir encontrar "Próxima página".
2. **jsdom não implementa a API de ponteiro** que o `Select` do Radix usa. Todo
   teste que abrisse um select morria com `hasPointerCapture is not a function`,
   o que se lê como bug do componente e é lacuna do ambiente. Os stubs foram para
   `test/setup.ts`, valendo para qualquer teste futuro.
3. **O filtro de categoria não considerava subcategorias — e agora foi provado.**
   A base não tinha nenhuma; criei uma subcategoria de verdade, movi um produto
   para ela e conferi que a categoria-pai continua devolvendo 4 (antes devolveria
   3). O cenário virou teste de unidade, já que a base segue sem hierarquia.

### Testes

- **API**: **938 testes verdes** (eram 928), nos três fusos. Novos: 6 da árvore de
  categorias (incluindo ciclo em `parentId`) e 4 dos filtros de alerta.
- **Web**: **489 testes, 489 passando** (eram 460), nos três fusos. Novos: 8 do
  `EntityFilterSelect`, 6 do `FilterPanel`, 6 do `useFilters` e 9 de
  `toCategoryOptions`.
- **E2E**: **86 testes** (eram 64). Os 22 novos varrem as 8 listagens.
- Lint do web em 0 erros, agora cobrindo também `hooks/` e `stores/`.

### Verificação no app rodando

```
— a barreira, tela a tela —
PASS Produtos, Pedidos, Clientes, Movimentações, Contas, Métodos, Condições e
     Caixa: nenhum campo de texto livre no painel de filtros
PASS as 8 telas expõem ao menos os filtros que a API aceita
PASS nenhum `<select>` nativo sobrou

— FT-01, o bug —
PASS o select mostra as categorias cadastradas com a contagem
     Acessórios (2) | Casa & Decoração (1) | Eletrônicos (4)
PASS escolher uma categoria devolve 4 linhas (antes: sempre zero)
PASS o valor enviado é um cuid, não um nome digitado

— FT-08, provado com massa própria —
PASS a categoria-pai continua trazendo o produto movido para a subcategoria

— FT-11 —
PASS mudar um filtro na página 2 volta para a página 1
PASS "Limpar filtros" zera o contador

— FT-10 —
PASS GET /inventory/alerts?warehouseId=<real> responde 200 (antes: 400)
```

### Checklist de saída

- [x] Nenhum filtro que a API recebe como id é campo de texto livre
      (`grep -rn "Filtrar por" apps/web/app` = 0)
- [x] Todo filtro por entidade cadastrada é um select alimentado pela API
- [x] Os 16 filtros que a API já aceita estão disponíveis em tela
- [x] Alta cardinalidade (cliente, produto) usa busca no servidor
- [x] Nenhum `<select>` nativo remanescente
- [x] Mudar qualquer filtro volta para a página 1
- [x] Filtro sem permissão de leitura se esconde; filtro com erro mostra o motivo
- [x] Regra registrada no `apps/web/CLAUDE.md` e no `apps/api/CLAUDE.md`

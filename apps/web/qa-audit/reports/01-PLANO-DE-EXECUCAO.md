# Plano de execução — correções do ciclo de QA UX/UI

Os 121 achados dos cinco relatórios colapsam em **34 unidades de trabalho**, porque
vários relatórios encontraram o mesmo defeito por caminhos diferentes. Este plano é
organizado por **causa**, não por tela, e em ondas: cada onda só depende das anteriores.

Referência de origem: [00-CONSOLIDADO.md](00-CONSOLIDADO.md) e os cinco relatórios.

## Duplicatas identificadas (trate como um item só)

| Item | Achados que o descrevem |
|---|---|
| Tooltip não é nome acessível | DS-01, EST-08 |
| `ConfirmDialog` não é diálogo | DS-08, EST-07 |
| Branco sobre o verde da marca = 2,59:1 | DS-05, CFG-07 |
| Cor literal + contraste reprovado | DS-10, FIN-04, FIN-08, VND-07, EST-05, EST-06 |
| `isError` como estado vazio (5xx) | FIN-02, FIN-03, VND-03, VND-04, CFG-04 |
| Helper de erro errado | DS-02, VND-05 |
| Busca/filtro dentro do flex do título | FIN-01, CFG-06 |

---

## Onda 0 — Pré-requisitos (antes de tocar em código)

Sem isto, você não consegue provar que uma correção funcionou.

### 0.1 Limpar a massa de teste
Conferida pela API depois do ciclo. A base saiu de 118 para 126 pedidos.

| O que | Estado | Ação |
|---|---|---|
| `PED-000119`, `PED-000120` | `PENDING`, **estoque real consumido** | cancelar/remover e devolver o estoque |
| 8 clientes `qa-cfg-*` / `QA Cliente …` | ativos | remover |
| 1 marca + 1 categoria `QA … 4902` | ativas | remover |
| Caixa `QA Caixa Financeiro` | `OPEN`, R$ 200,00 | fechar |
| 8 produtos `qa-est-*` | `status: INACTIVE` | **nada** — já neutralizados |

### 0.2 Corrigir a variável de CORS (bloqueia o ambiente de QA)
`apps/api/.env` declara `CORS_ORIGINS`; `apps/api/src/main.ts:22` e
`src/config/app.config.ts:32` leem `CORS_ORIGIN`. A configuração é ignorada e cai
sempre no default. Padronizar no plural (que é o nome que suporta lista) e aceitar
`origin` como array.

### 0.3 Descontar os falso positivos do harness
Os relatórios de **estoque, vendas, financeiro e clientes-config** foram escritos antes
que o agente de Design System auditasse a ferramenta. Ignore nesses quatro:
- "alvo de toque < 24 px" em **links de texto inline** (exceção do WCAG 2.5.8)
- "corte sem scroll" em **`span.sr-only`**
- "anel de foco ausente" — existe, é o padrão do navegador, não `ring-ring`

Os números de **contraste** continuam válidos: são medidos do pixel renderizado.

### 0.4 Saber o que a suíte atual não faz
Os 6 specs em `qa-audit/` são **observacionais**: medem, fotografam e passam. Eles não
falham quando o bug volta. A onda 5 converte os críticos em teste assertivo — até lá,
a verificação de cada item é manual, pelo comando indicado.

---

## Onda 1 — Primitivos ✅ EXECUTADA

**Verificação:** 506/506 testes unitários e 11/11 no navegador
(`qa-audit/onda1-verificacao.spec.ts`, que **reprova** — é o primeiro pedaço da
onda 8). Nenhum erro novo de tipo ou lint.

**Arquivos:** `components/ui/tooltip.tsx`, `components/ui/dialog.tsx`,
`components/ui/confirm-dialog.tsx`, `app/globals.css`,
`app/(dashboard)/financeiro/contas/page.tsx` (rótulo no chamador),
`components/ui/toast.test.tsx` (o teste afirmava o defeito).

### Três coisas que só apareceram ao executar

1. **O Radix 1.1.15 não emite `aria-modal`.** Nenhum diálogo do sistema se
   anunciava como modal. Adicionado explicitamente no primitivo.

2. **O foco não voltava em nenhum diálogo do sistema, não só no `ConfirmDialog`.**
   O Radix restaura com `context.triggerRef.current?.focus()`, e `triggerRef` só
   existe quando o diálogo é aberto por `<DialogTrigger>`. Os 20 diálogos daqui
   são controlados por `open`/`onOpenChange`, então `triggerRef` é sempre `null`
   e o foco caía no `<body>`. Corrigido com um rastreador global do último foco
   fora de diálogo — capturar dentro do `DialogContent` não funciona, porque o
   `FocusScope` é descendente e seus efeitos rodam antes.

3. **`/financeiro/contas` não foi alcançada pela correção do primitivo**: seus
   botões de linha não usam `Tooltip`, então não havia de onde tirar o rótulo.
   Eram 14 controles sem nome, e a tela não estava na minha lista inicial de
   verificação. Corrigido no chamador e a rota foi adicionada à suíte.

### Impacto medido (9 rotas × 2 temas, depois da onda)

| Sintoma | Antes | Depois |
|---|---|---|
| Controles sem nome acessível | 28 | **0** |
| Falhas de contraste por `--muted-foreground` | dominava a lista | **0** |
| Falhas de contraste restantes | 97 | **97** — todas por cor literal |

As 97 restantes são `rgb(220,38,38)`, `rgb(22,163,74)` e `rgb(5,150,105)`:
`text-destructive`, `green-600` e `emerald-600` escritos à mão. São o **item 6.1**,
não a onda 1 — o token `--muted-foreground` desapareceu completamente da lista.

> ⚠️ O total de 97 **não é comparável** aos "96 achados de contraste" do relatório
> de Design System: aquele deduplicava por cor+fundo+tamanho e cobria 28 rotas;
> este conta cada ocorrência em 9 rotas nos dois temas. O que a medição prova é a
> *composição* do que sobrou, não uma variação de volume.

---

### Detalhamento original da onda

Máxima alavancagem do ciclo: nenhuma tela é tocada e a maior parte da lista some.
**Faça esta onda inteira antes de qualquer outra** — várias correções seguintes
deixam de ser necessárias depois dela.

### 1.1 `components/ui/tooltip.tsx:24` — tooltip vira nome acessível
**Resolve:** DS-01, EST-08 (Críticos) · **Impacto:** 35 dos 45 controles só-ícone do repo.

O `content` só chega ao `Content` do Radix, que liga por `aria-describedby` —
*descrição*, não *nome*. `getByRole("button", {name:"Editar"})` retorna 0 nas cinco
listagens; em `/estoque/produtos` são 60 de 60 botões sem nome.

Passar `content` também como `aria-label` no trigger (via `cloneElement` ou um
`<span className="sr-only">`), sem sobrescrever um `aria-label` que o chamador já tenha.

**Verificar:** `getByRole("button", {name:"Editar"})` > 0 em produtos, categorias,
marcas, clientes e movimentações.

### 1.2 `components/ui/dialog.tsx:38` — `max-h` no default
**Resolve:** DS-03 (Crítico) · **Impacto:** 18 de 22 diálogos.

Em 390×667 três estouram sem rolar: contas 746px, lançamentos 738px, métodos 762px.
Os dois que declaram `max-h-[85vh]` clampam certo em 566,95px.

`max-h-[85vh]` + corpo `overflow-y-auto` + rodapé fixo no primitivo. Depois, remover as
declarações locais que viraram redundantes.

**Verificar:** os 22 diálogos em 390×667 com `getBoundingClientRect().bottom <= 667`.

### 1.3 `app/globals.css:25` — `--muted-foreground: 215 16% 43%`
**Resolve:** DS-04 (Alto) · **Impacto:** ~90% dos 96 achados de contraste, em 27 das 28 rotas.

O valor atual (`47%`) dá 4,511:1 em ponto flutuante — **passa** — mas o browser
arredonda para `rgb(101,117,139)` e o pixel real mede **4,4949:1**, que reprova por
0,005. `43%` leva a 5,208:1.

**Verificar:** reexecutar a varredura de contraste e conferir a queda dos 96 achados.

### 1.4 `ConfirmDialog` — virar um diálogo de verdade
**Resolve:** DS-08, EST-07 (Altos) · `components/ui/confirm-dialog.tsx:100`

Sem `role="dialog"`, sem foco preso, sem devolver o foco ao fechar. Reconstruir sobre o
mesmo primitivo `Dialog` do item 1.2, herdando o `max-h` de brinde.

> ⚠️ Este arquivo tem histórico: o AE-09 ("Expected static flag was missing") nasceu de
> um `if (!open) return null` acima de um `useEffect`. **Hooks antes de qualquer return
> condicional** — `rules-of-hooks` é `error` no lint e deve continuar.

---

## Onda 2 — Perda e corrupção de dados (o que mais dói no usuário)

### 2.1 Duplo submit cria dois pedidos reais
**VND-01 (Crítico)** · `vendas/pedidos/novo/page.tsx:942-946`, `vendas/balcao/page.tsx:1071-1078`

O `disabled` olha só `createOrder.isPending`, mas `onSubmit` (`novo:364-390`,
`balcao:460-490`) faz `await refreshCartStock()` — um `GET /products/:id` por item —
**antes** do `mutateAsync`. Nessa janela `isPending` é `false` e o botão segue clicável.
Provado: `PED-000119` e `PED-000120`, 1,2 s de diferença, dois consumos de estoque.

`formState.isSubmitting || createOrder.isPending` no `disabled` **e** na condição do
spinner. `useRef(false)` no topo do `onSubmit` cobre o disparo via teclado.
`Idempotency-Key` no servidor resolveria a classe inteira — vale abrir como item à parte.

### 2.2 Imagens do produto descartadas em silêncio
**EST-26 (Alto)** · O `FileUpload` da aba Imagens é montado sem `onUpload`: zero
requisições, `POST /products` sem imagens, produto criado com `images: []` — e o
usuário lê "Produto criado com sucesso!". Ligar o handler ou remover a aba.

### 2.3 O perfil grava telefone inválido e comemora
**CFG-08 (Alto)** · Salva `(11) 9` e responde "Perfil atualizado com sucesso!".
Validar pelo número de dígitos desmascarados, como manda o CLAUDE.md.

### 2.4 "URL do Logo" da marca: contrato quebrado dos dois lados
**EST-01 (Crítico)** · A UI manda `logoUrl`, a API só conhece `logo` e responde **400**
com `["property logoUrl should not exist"]` cru, em inglês, no toast. Na leitura,
`GET /products/brands` devolve `{"name":"Apple","logo":null}` e a lista lê
`brand.logoUrl` → a coluna nunca renderiza. *(Verificado direto na API durante a
consolidação.)*

Decidir o nome canônico (`logo`, que é o que o banco já usa), alinhar
`brand-form-dialog.tsx:28,68`, `marcas/page.tsx:69,80,128` e o tipo em
`packages/shared-types`.

---

## Onda 3 — Estados de erro (a regressão sistêmica do ciclo)

### 3.1 `isError` desenhado como estado vazio — 9 telas
**FIN-02, FIN-03, VND-03, VND-04, CFG-04** (1 Crítico + 4 Altos)

O time aplicou "isError nunca é estado vazio" pensando em **403**; as nove telas falham
em **5xx**. O guarda de permissão funciona, o de erro de servidor não existe.

| Tela | Hoje mostra |
|---|---|
| `/` (dashboard) | 5 skeletons **eternos** + "Sem vendas no período" |
| `/financeiro/contas` | "Nenhuma conta financeira cadastrada" |
| `/financeiro/caixa` | "Nenhum caixa cadastrado" (VD-07) |
| `/vendas/pedidos/novo` | "Nenhum caixa aberto" **+ botão travado** |
| `/vendas/pedidos/[id]` | "Pedido não encontrado" (500 **e** 403) |
| `/clientes/[id]` | "Cliente não encontrado" (500 **e** 403) |
| `/configuracoes/metodos-pagamento` | "Nenhum método cadastrado" |
| `/configuracoes/condicoes-pagamento` | "Nenhuma condição cadastrada" |

**Referências que já acertam:** `/clientes/[id]/edit` e `/vendas/balcao`. Copie o padrão
delas. Comece pelo dashboard (`app/(dashboard)/page.tsx:58,181`), que é o pior: o
skeleton nunca para.

### 3.2 Atualizar a regra no CLAUDE.md
A regra atual não menciona 5xx — foi por isso que a correção anterior não pegou. Trocar
por: *"`isError` nunca é estado vazio, **seja 403, 5xx ou falha de rede**. Distinga
'sem permissão' de 'erro do servidor' de 'zero linhas'."*

### 3.3 Helper de erro errado — 15 call sites
**DS-02 (Crítico), VND-05 (Alto)**

`getApiErrorMessage` trata 403 mas **não** 5xx. Provado lado a lado com a mesma mutação
em 500: marcas → "Erro ao criar marca." ✅ · perfil → "Internal server error" ❌ ·
balcão → ``Invalid `tx.order.create()` invocation in .../orders.service.ts:440:38`` ❌

Trocar por `getMutationErrorMessage(error, fallback)` em:

```
app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:381
app/(dashboard)/configuracoes/metodos-pagamento/page.tsx:449
app/(dashboard)/configuracoes/perfil/_components/profile-form.tsx:62
app/(dashboard)/configuracoes/perfil/_components/password-form.tsx:74
app/(dashboard)/estoque/produtos/page.tsx:80
app/(dashboard)/financeiro/contas/_components/transfer-dialog.tsx:98
app/(dashboard)/financeiro/lancamentos/_components/delete-entry-dialog.tsx:70
app/(dashboard)/financeiro/lancamentos/_components/edit-entry-dialog.tsx:99
app/(dashboard)/financeiro/lancamentos/_components/settle-entry-dialog.tsx:91
app/(dashboard)/financeiro/lancamentos/_components/reverse-settlement-dialog.tsx:85
app/(dashboard)/vendas/balcao/page.tsx:527
app/(dashboard)/vendas/pedidos/novo/page.tsx:426
app/(dashboard)/vendas/pedidos/[id]/_components/exchange-dialog.tsx:92
components/orders/status-actions.tsx:105
lib/api.ts:136
```

Depois, um lint rule ou teste que barre `getApiErrorMessage` dentro de `catch` de mutação.

---

## Onda 4 — Contratos de API (front e back no mesmo commit)

Estes exigem tocar `apps/api`. Nenhum depende das ondas anteriores.

| Item | Achado | O quê |
|---|---|---|
| 4.1 | **CFG-03** (Alto) | `enableImplicitConversion: true` (`api/src/main.ts:31-36`) faz `Boolean('false') === true` → `isActive=false` devolve os **ativos** e as 13 formas inativas ficam inalcançáveis. Corrigir no pipe ou no `@Transform` do DTO. **Verifique o efeito colateral em todo booleano de query do sistema.** |
| 4.2 | **CFG-02** (Alto) | `documentType` é aceito no DTO e **nunca aplicado ao `where`** (`api/src/modules/crm/customers.service.ts:36-45`): `meta.total = 102` com CNPJ, com CPF e sem filtro. |
| 4.3 | **EST-03** (Alto) | Colunas "ordenáveis" de Movimentações não ordenam: o hook não repassa `sortBy/sortOrder` e o `MovementQueryDto` nem os aceita. A seta é decoração. |
| 4.4 | **CFG-05** (Alto) | O seller tem `payment-methods:read` e a API responde 200, mas as páginas guardam com `financial:create` (`metodos-pagamento/page.tsx:619`, `condicoes-pagamento/page.tsx:629`, `lib/nav-items.ts:82-91`) — negação falsa. |
| 4.5 | **FIN-06** (Alto) | Período invertido: a tela avisa **e consulta assim mesmo**; a API troca as datas em silêncio (`date-range.util.ts:120-122`) e os cards recalculam R$ 18.438,10 como se fossem do período pedido. Bloquear o submit no front **e** rejeitar no back. |
| 4.6 | **FIN-05** (Alto) | Transferência que deixa a conta negativa é beco sem saída: o backend pede "Confirme para continuar." e o diálogo não tem o que confirmar, embora a API aceite `allowNegativeBalance`. |

**Regra que faltava:** antes de entregar uma tela, diffar o `*QueryDto` contra o painel
de filtros. Três destes seis são exatamente esse gap.

---

## Onda 5 — Layout e responsividade

| Item | Achado | O quê |
|---|---|---|
| 5.1 | **FIN-01** (Crít.), **CFG-06** (Alto) | Busca e filtros aninhados dentro do flex row do título. Em `/financeiro/contas` a 390px "Transferência" e "Nova Conta" caem em `x=661→796` e a página **não rola** (`docScrollWidth === 390`): no celular não dá para criar conta nem transferir. Mesmo erro, independente, em condições-de-pagamento (`x:774,y:144` contra `x:296,y:216` na tela irmã). `contas/page.tsx:129-204`. |
| 5.2 | **VND-02** (Crít.) | Preço unitário ilegível: `clientWidth 55` × `scrollWidth 114`; R$ 3.299,00 mostra só "R$", R$ 89,90 vira "R$ 89". A 1440px com sidebar aberta — as colunas `w-36` encolhem e o `pl-10` do prefixo come a área de texto. |
| 5.3 | **VND-06** (Alto) | 390px: a coluna `lg:col-span-2` sem `min-w-0`, grid de 358px contra 728px de conteúdo, a tabela nunca usa seu `overflow-x-auto` e a página inteira rola de lado. |
| 5.4 | **DS-06** (Alto) | AE-07 real **só em 1024px**: KPIs com `scrollWidth 202 > clientWidth 121`, `overflow-x: hidden`, sem ellipsis — é onde `lg:grid-cols-5` liga e a sidebar de 264px ainda é fixa. `page.tsx:169-178` + `kpi-card.tsx:44`. |
| 5.5 | design review #3 | `data-table.tsx:149` só liga `table-fixed` se a coluna declarar a prop `width`, mas as telas escrevem a largura no `className` (`"text-right w-[120px]"`) → coluna "Ações" cortada a 1440px em quase toda lista. |

Aproveitar 5.5 para `sticky top-0` no `thead` e `py-3` → `py-2` (passo de 57px → 44px),
que é o item de densidade do design review.

---

## Onda 6 — Cor, contraste e acessibilidade

### 6.1 Erradicar cor literal — 304 ocorrências, 128 em três primitivos
**DS-10, FIN-04, FIN-08, VND-07, EST-05, EST-06**

Comece pelos três primitivos (resolve 128 de uma vez), depois as telas. Casos que
reprovam AA e devem sair primeiro:

| Onde | Medido | Contexto |
|---|---|---|
| `text-destructive` no dark | **2,66:1** | estoque zerado, badge "Saída" |
| badge `destructive` no dark | **2,66:1** | "Vencido", "Despesa" |
| `text-yellow-600` no claro | **2,81:1** | o número que a tela de estoque baixo existe para destacar |
| vermelho de dinheiro no dark | 3,96:1 | todo o módulo financeiro |
| `+qtd` verde no claro | 3,61:1 | movimentações |

### 6.2 Branco sobre o verde da marca reprova nos dois temas
**DS-05, CFG-07 (Altos)** · `--accent-foreground` sobre `--accent` = **2,59:1**. É o CTA
"Entrar" do login. Escurecer o `--accent` para uso como fundo, ou trocar o foreground.
Decida junto com a direção estética do design review, que propõe o verde como idioma da
interação.

### 6.3 Saldo negativo pintado igual a positivo
**FIN-07 (Alto)** · Cor sozinha nunca deve ser o único portador de significado — sinal
explícito ou ícone junto.

### 6.4 Shell acessível
**DS-07 (Alto)** · Sem skip link, sem `aria-current`, landmarks sem nome: **13 Tabs até
o conteúdo, em toda rota**.

### 6.5 Paleta de comandos
**DS-09 (Alto)** · Tab escapa, Esc para de funcionar, seleção invisível para leitor de tela.

### 6.6 Acentuação
**CFG-09 (Alto)** · 11 strings sem acento em Métodos e Condições (FN-27).

---

## Onda 7 — Formulários

### 7.1 Login engole o 401 e apaga o que foi digitado
**CFG-01 (Crítico)** · A API responde 401 com "Email ou senha inválidos" e a tela não
mostra nada: durante o request o formulário vira um spinner de tela cheia e, ao voltar,
`#email`/`#password` estão vazios e o banner não existe.

Causa encadeada: `useAuthStore.login()` faz `set({ isLoading: true })`
(`stores/auth.store.ts:68`) e o `AuthLayout` desmonta `children` enquanto `isLoading`
(`app/(auth)/layout.tsx:32-38`), destruindo o `useState` que guardava o erro.

Corrigir no layout (não desmontar) **ou** mover o erro para fora do componente. Não
mexa só no sintoma: qualquer tela de auth que use esse layout tem o mesmo problema.

### 7.2 Erro invisível na edição de produto
**EST-02 (Crítico)** · NCM inválido na aba Fiscal + submit em outra aba: nenhum PATCH
sai, a aba não troca, nenhuma aba ganha contador e **nem abrindo a aba Fiscal existe
mensagem** — só o toast genérico. `edit/page.tsx` não usa `lib/form-tabs.ts` (AE-11) e
os campos fiscais não renderizam `errors` (FN-13).

`novo/page.tsx` faz certo — é divergência entre irmãs, não limitação. Rode a varredura
que o próprio CLAUDE.md sugere: `grep '{...register(' | grep -v 'errors\.'`.

---

## Onda 8 — Blindagem (para o ciclo não se repetir)

O ciclo anterior corrigiu AE-28 e AE-10; os dois voltaram. A diferença entre corrigir e
blindar está aqui.

1. **Converter os 11 críticos em teste assertivo.** Os specs de hoje observam e passam.
   Transformar em asserção que falha, nomeada com o ID (`VND-01: …`), no padrão que
   `e2e/` já usa. Prioridade: VND-01 (duplo submit), o grupo AE-28/5xx e DS-01
   (nome acessível), que são os que voltam sozinhos.
2. **Teste de contraste como gate**, varrendo os tokens nos dois temas. Pega DS-04,
   DS-05 e a família 6.1 de uma vez — e teria pego a diferença de 0,005 do pixel.
3. **Lint contra cor literal** em `className` (`text-gray-*`, `bg-[#…]`).
4. **Lint contra `getApiErrorMessage` dentro de `catch` de mutação.**
5. **Regra de contrato:** diffar `*QueryDto` contra o painel de filtros antes de
   entregar uma tela. Pega a onda 4 inteira.

---

## Ordem sugerida e o que ela entrega

| Onda | Escopo | Entrega |
|---|---|---|
| 0 | massa, CORS, triagem | ambiente confiável |
| 1 | 4 primitivos | ~100 sintomas apagados, nenhuma tela tocada |
| 2 | 4 correções | fim da perda de dados |
| 3 | 9 telas + 15 call sites + regra | fim do erro disfarçado de vazio |
| 4 | 6 itens front+back | filtros e permissões passam a dizer a verdade |
| 5 | 5 itens | mobile e 1024px utilizáveis |
| 6 | 6 grupos | AA nos dois temas |
| 7 | 2 formulários | erro sempre visível |
| 8 | 5 blindagens | o ciclo não se repete |

**Ondas 1 a 3 cobrem 10 dos 11 críticos** e a maior parte dos altos. Se houver corte de
escopo, corte a partir da onda 6, e nunca a onda 8 inteira — foi a ausência dela que
trouxe AE-28 e AE-10 de volta.

### Após cada onda

```bash
cd apps/web
npx playwright test -c qa-audit/playwright.qa.config.ts --reporter=list
```

Lembre da onda 0.4: hoje isso **mede**, não reprova. Compare os JSONs em
`qa-audit/artifacts/ds/` antes e depois — é a linha de base do ciclo. A partir da
onda 8, passa a reprovar de verdade.

### Os 78 achados restantes (Médio e Baixo)

Não estão neste plano por prioridade, e estão detalhados nos cinco relatórios com
evidência, arquivo e correção. A maior parte cai junto com as ondas 1 e 6 — reavalie a
lista depois delas, porque muita coisa já não vai existir.

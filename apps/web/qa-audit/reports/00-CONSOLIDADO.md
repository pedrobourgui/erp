# Ciclo de QA UX/UI — Consolidado

Auditoria em navegador real (Playwright) sobre 28 rotas, nos temas claro e escuro,
em 390/768/1024/1440 px, com os papéis `owner` e `seller`. Seis agentes: cinco de QA
funcional/visual e um de avaliação de design.

| Relatório | Crítico | Alto | Médio | Baixo | Total |
|---|---:|---:|---:|---:|---:|
| [Estoque](estoque.md) | 2 | 7 | 10 | 7 | 26 |
| [Design System](design-system.md) | 3 | 7 | 11 | 5 | 26 |
| [Financeiro e Dashboard](financeiro.md) | 3 | 5 | 11 | 5 | 24 |
| [Clientes, Config e Auth](clientes-config.md) | 1 | 8 | 10 | 4 | 23 |
| [Vendas](vendas.md) | 2 | 5 | 9 | 6 | 22 |
| **Total** | **11** | **32** | **51** | **27** | **121** |

Mais a [avaliação de design](design-review.md), que não conta achados: dá nota por
dimensão e propõe uma direção estética.

➡️ **Para executar as correções, use o [plano de execução](01-PLANO-DE-EXECUCAO.md)**,
que colapsa os 121 achados em 34 unidades de trabalho organizadas em 9 ondas.

---

## O que este ciclo diz, além da lista

Os 121 achados não são 121 problemas independentes. Cinco causas explicam a maior
parte deles, e quase todas moram num primitivo ou numa regra — não na tela onde o
sintoma aparece.

### 1. AE-28 voltou por uma porta que a regra não cobria

O CLAUDE.md diz que `isError` nunca é estado vazio, e o time aplicou a regra pensando
em **403**. As nove telas onde o defeito reapareceu falham em **5xx**: o guarda de
permissão funciona, o de erro de servidor não existe.

| Tela | Mostra | Deveria mostrar |
|---|---|---|
| `/financeiro/contas` | "Nenhuma conta financeira cadastrada" | erro do servidor |
| `/financeiro/caixa` | "Nenhum caixa cadastrado" (VD-07) | erro do servidor |
| `/` (dashboard) | 5 skeletons eternos + "Sem vendas no período" | erro do servidor |
| `/vendas/pedidos/[id]` | "Pedido não encontrado" (500 **e** 403) | erro / sem permissão |
| `/vendas/pedidos/novo` | "Nenhum caixa aberto" + botão travado | erro do servidor |
| `/clientes/[id]` | "Cliente não encontrado" (500 **e** 403) | erro / sem permissão |
| `/configuracoes/metodos-pagamento` | "Nenhum método cadastrado" | erro do servidor |
| `/configuracoes/condicoes-pagamento` | "Nenhuma condição cadastrada" | erro do servidor |

A regra no CLAUDE.md precisa dizer **5xx** explicitamente, e `/clientes/[id]/edit` e
`/vendas/balcao` — que acertam — servem de referência.

### 2. O helper errado de mensagem de erro está espalhado

`getApiErrorMessage` trata 403 mas **não** 5xx; `getMutationErrorMessage` troca 5xx
pelo fallback. Onde o primeiro é usado sozinho, o operador lê o que o servidor
vazou. Provado lado a lado com a mesma mutação respondida com 500:

- `/estoque/marcas` → "Erro ao criar marca." ✅
- `/configuracoes/perfil` → "Internal server error" ❌
- `/vendas/balcao` → ``Invalid `tx.order.create()` invocation in .../orders.service.ts:440:38 … Unique constraint failed`` ❌

**15 call sites** com essa forma, listados com arquivo:linha no relatório do Design System.

### 3. Um `content: string` que não vira nome acessível

`components/ui/tooltip.tsx:24` passa o texto ao `Content` do Radix, que liga por
`aria-describedby` — descrição, não nome. Resultado: **60 de 60** botões só-ícone da
tabela de produtos sem nome acessível, e `getByRole("button", {name:"Editar"})`
retorna 0 nas cinco listagens testadas. Atinge 35 dos 45 controles só-ícone do
repositório. Correção de uma linha, no primitivo.

### 4. Regras de layout que moram no chamador em vez do primitivo

- **18 de 22 `DialogContent` sem `max-h`** — em 390×667, três diálogos passam 35 a
  47 px da tela sem rolar. Os dois com `max-h-[85vh]` clampam certo. A regra devia
  estar em `components/ui/dialog.tsx:38`.
- **Busca e filtros dentro do flex do título** — mesmo erro de aninhamento de JSX
  quebrou `/financeiro/contas` (botões em `x=661` num viewport de 390) e
  `/configuracoes/condicoes-pagamento`, em módulos diferentes, de forma independente.
- **`data-table.tsx:149`** só liga `table-fixed` se a coluna declarar a prop `width`,
  mas as telas escrevem a largura no `className` — a coluna "Ações" corta a 1440 px
  em quase toda lista.

### 5. Contratos de API que ninguém compara

- **Marca**: a UI manda `logoUrl`, a API só conhece `logo` e responde 400; na leitura
  a lista lê `brand.logoUrl` num objeto que traz `logo`. Verificado direto na API:
  `{"name":"Apple","logo":null}` e `POST {logoUrl}` → **400**.
- **Filtro "Tipo"** em `/clientes`: a API aceita `documentType` no DTO e nunca aplica
  ao `where` — `meta.total = 102` com CNPJ, com CPF e sem filtro.
- **Filtro "Situação"**: `enableImplicitConversion: true` (`main.ts:31-36`) faz
  `Boolean('false') === true`, então `isActive=false` devolve os ativos e as 13
  formas inativas ficam inalcançáveis.
- **Ordenação de Movimentações**: o hook não repassa `sortBy/sortOrder` e o
  `MovementQueryDto` nem os aceita — a seta na coluna é decoração.
- **Imagens do produto**: o `FileUpload` é montado sem `onUpload`; zero requisições,
  produto criado com `images: []`, e o usuário lê "Produto criado com sucesso!".

---

## Os 11 críticos

| ID | Tela | Achado |
|---|---|---|
| VND-01 | `/vendas/pedidos/novo` | duplo clique cria **dois pedidos reais** (`PED-000119`/`PED-000120`): o `disabled` olha só `isPending`, mas `onSubmit` faz `await refreshCartStock()` antes do `mutateAsync` |
| CFG-01 | `/login` | o 401 é engolido e o formulário é apagado: `AuthLayout` desmonta `children` enquanto `isLoading`, destruindo o `useState` do erro |
| DS-01 | todas | nenhum botão de ação de linha tem nome acessível (primitivo `tooltip.tsx`) |
| DS-02 | 15 call sites | AE-10 reaberto: stack trace do Prisma e "Internal server error" no toast |
| DS-03 | 18 diálogos | sem `max-h`: em 390×667 o rodapé fica fora da tela e não rola |
| FIN-01 | `/financeiro/contas` | a 390 px "Transferência" e "Nova Conta" ficam em `x=661→796` e a página não rola |
| FIN-02 | `/` | 5 skeletons pulsando para sempre quando `/reports/dashboard` responde 500 |
| FIN-03 | `/financeiro/contas`, `/financeiro/caixa` | erro desenhado como estado vazio |
| VND-02 | `/vendas/pedidos/novo` | preço unitário ilegível: `clientWidth 55` × `scrollWidth 114`; R$ 3.299,00 mostra só "R$" |
| EST-01 | `/estoque/marcas` | "URL do Logo" nunca salva e a coluna nunca renderiza (contrato quebrado dos dois lados) |
| EST-02 | `/estoque/produtos/[id]/edit` | erro de validação invisível: nenhuma aba badgeia, nenhum campo mostra a mensagem; `novo/page.tsx` faz certo |

---

## Correções de maior alavancagem

Sete mudanças pequenas, quase todas num arquivo só, que apagam a maior parte da lista:

1. `components/ui/tooltip.tsx` — repassar `content` como nome acessível ao trigger.
   Resolve **35 controles** em todas as telas. *(1 linha)*
2. `components/ui/dialog.tsx:38` — `max-h-[85vh]` + corpo rolável no default.
   Resolve **18 diálogos**. *(1 linha)*
3. `app/globals.css:25` — `--muted-foreground: 215 16% 43%`. Resolve **~90% dos 96
   achados de contraste**, presentes em 27 das 28 rotas. *(1 valor)*
4. Trocar `getApiErrorMessage(err) ?? fallback` por `getMutationErrorMessage(error, fallback)`
   nos **15 call sites**. *(busca e substituição guiada)*
5. `formState.isSubmitting || isPending` no `disabled` dos submits que fazem `await`
   antes do `mutateAsync`. Mata o duplo pedido.
6. Ler `error`/`isError` nas **9 telas** da tabela do item 1 e distinguir 5xx de 403.
7. `data-table.tsx:149` — aceitar a largura via prop `width` (ou ler do `className`)
   para o `table-fixed` ligar. Devolve a coluna "Ações" em quase toda lista.

---

## Avaliação de design — resumo

Notas: hierarquia 5, tipografia 4, cor 5, densidade 4, composição 6, detalhamento 6,
estados 6, identidade 4.

O achado estrutural: **Satoshi nunca carrega**. `globals.css:1` pede a família ao
Google Fonts, que não a serve — verificado: a requisição isolada responde **400** e a
requisição combinada devolve só Plus Jakarta Sans. Não há `.woff2` local nem
`next/font/local`. O pareamento display+corpo de `tailwind.config.ts:20-23` não existe
em runtime, Plus Jakarta é baixada duas vezes, e o `font-feature-settings` de
`globals.css:103` são codinomes do **Inter**, sobra de outro setup.

O resto está em [design-review.md](design-review.md), com os 10 ajustes ordenados por
impacto ÷ esforço e uma direção estética que evolui o design system em vez de
substituí-lo.

---

## Notas de método

**Dois sinais do harness eram falso positivo** e foram derrubados pelo agente de
Design System, que auditou a própria ferramenta: os "alvos < 24 px" são links de texto
inline (exceção explícita do WCAG 2.5.8) e os "cortes sem scroll" são `span.sr-only`.
O anel de foco, reverificado focando de verdade e lendo o `outline` computado, existe
— é o padrão do navegador, não `ring-ring`. Quem for triar os relatórios de Estoque,
Vendas, Financeiro e Clientes deve aplicar o mesmo desconto a esses três sinais.

**O contraste medido é o do pixel, não o do token.** `--muted-foreground: 215 16% 47%`
dá 4,511:1 em ponto flutuante (passa) e **4,4949:1** depois que o browser arredonda
para `rgb(101,117,139)` (reprova). A medição do DOM é a que vale.

**Massa de teste deixada no banco**, conferida pela API depois do ciclo:

| O que | Estado | Precisa de ação? |
|---|---|---|
| 8 produtos `qa-est-*` | `status: INACTIVE` | não — a limpeza do teste `EST-cleanup` os neutralizou, como documentado |
| 1 marca e 1 categoria `QA … 4902` | ativas | sim, remover |
| 8 clientes `qa-cfg-*` / `QA Cliente …` | **todos ativos** | sim, remover |
| `PED-000119` e `PED-000120` | **`PENDING`, estoque real consumido** | sim — são o efeito colateral do teste de duplo clique (VND-01) |
| Caixa `QA Caixa Financeiro` | `OPEN`, R$ 200,00 | sim, fechar |
| Telefone do admin, condição de pagamento | restaurados pela API | não |

A base saiu de 118 para 126 pedidos.

**Bug de configuração encontrado na montagem do ambiente**: `apps/api/.env` declara
`CORS_ORIGINS`, mas `main.ts:22` e `config/app.config.ts:32` leem `CORS_ORIGIN`. A
variável configurada é ignorada e o valor cai sempre no default `http://localhost:3000`.

## Como reproduzir

```bash
# API (porta 3001) e web (porta 3100) precisam estar no ar
cd apps/web
npx playwright test -c qa-audit/playwright.qa.config.ts --reporter=list
```

O harness (`qa-audit/qa-fixtures.ts`) autentica por token, arma captura de console/
pageerror/HTTP≥400 e expõe `measure(page)`, que mede overflow, contraste WCAG com o
fundo efetivo, escala de espaçamento, raios, alvos de toque e cor fora dos tokens.

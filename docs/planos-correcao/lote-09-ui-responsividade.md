# Lote 9 — UI, responsividade e acabamento

> O sistema é inutilizável em celular nos três domínios, e uma linha de tabela com texto longo derruba o
> layout inteiro. O resto é acabamento barato que muda muito a percepção de qualidade.
> Estimativa: **4 dias**. Sem dependências.

| Bug | Sev. | Resumo |
|---|---|---|
| AE-07 / FN-10 / VD-15 | 🟠 Alto | Mobile 390×844 inutilizável: sidebar fixa de 264px sem drawer |
| AE-20 | 🟠 Alto | Nome de produto longo estoura a tabela e joga colunas para fora |
| VD-13 | 🟡 Médio | Campos de moeda da tabela de itens truncam o valor ("R$ 89", "R$ 1₄") |
| AE-09 | 🟠 Alto | Violações das Rules of Hooks (detalhe de cliente e **todo** ConfirmDialog) |
| FN-18 | 🟡 Médio | 404 cru do Next em inglês nas rotas-pai do menu |
| AE-26 | 🔵 Baixo | Dropdown de produto cobre o restante do modal de movimentação |
| VD-18 | 🟡 Médio | PDV sem atalhos de teclado e sem retomar o foco na busca |
| VD-16 / FN-19 | 🟡 Médio | CPF, telefone, CNPJ e CEP exibidos sem máscara |
| FN-22 | 🔵 Baixo | Nenhuma tela tem breadcrumb |
| FN-27 | 🔵 Baixo | Rótulos sem acentuação em Configurações e Contas |
| AE-21 / AE-23 | 🔵 Baixo | "1 itens"; rótulos de status inconsistentes ("Separação" × "Separando") |

---

## 9.1 — Responsividade (AE-07 / FN-10 / VD-15)

**Arquivo:** `apps/web/components/layouts/sidebar.tsx:126-131`

A `<aside>` tem `w-[264px]` fixos, sem nenhum breakpoint e sem estado de drawer. Em 390 px sobram ~126 px de
conteúdo: o título vira "Despesas e Receit…", os cards "R$ 3.0…" e as tabelas ficam **cortadas, sem scroll**
(`scrollWidth === clientWidth`) — inacessíveis, não apenas feias.

**Passos**
1. Sidebar responsiva: escondida por padrão abaixo de `lg`, aberta como drawer (overlay + `Sheet`) via botão
   hambúrguer no header; visível e fixa a partir de `lg`. Fechar ao navegar e ao pressionar ESC; travar o
   scroll do body enquanto aberta.
2. Conteúdo com `min-w-0` e `w-full` (sem `min-w-0`, um filho flex nunca encolhe — é a causa do corte).
3. Tabelas dentro de container `overflow-x-auto`; em telas pequenas, exibir as colunas essenciais e mover o
   resto para um card expansível por linha.
4. Cards de KPI em `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
5. Modais: `max-h-[85vh] overflow-y-auto` com rodapé fixo (mesma correção pedida em FN-14, lote 6).
6. Verificar as 25 rotas em 390×844 e 768×1024 — o QA tem screenshots das principais para comparação.

**Aceite:** em 390×844, nenhuma tela tem conteúdo cortado; todo conteúdo largo rola horizontalmente dentro do
próprio container; o menu abre e fecha por hambúrguer.

---

## 9.2 — Tabelas que quebram com conteúdo real (AE-20, VD-13)

- **AE-20** — um produto com nome de 255 caracteres (permitido pelo schema) expandiu a tabela e empurrou
  Categoria, Preço, Estoque, Status e Ações para fora da tela, inutilizando **todas** as linhas.
  → `truncate max-w-[Xch]` na célula + `title`/tooltip com o texto completo; container com `overflow-x-auto`;
  `table-layout: fixed` com larguras declaradas por coluna no `DataTable`.
- **VD-13** — nas colunas "Preço Unit." e "Desconto" o texto sai cortado já em 1440 px ("R$ 89" para R$ 89,90).
  → Largura mínima adequada para colunas monetárias, alinhamento à direita e `whitespace-nowrap`.
- Corrigir no **componente de tabela compartilhado**, não tela a tela.

---

## 9.3 — AE-09: Rules of Hooks

Dois casos, um deles afetando o app inteiro:

- `clientes/[id]/page.tsx` — `return` condicionais nas linhas 55 e 63, e `useToast()` só na 72 →
  *"React has detected a change in the order of Hooks called by CustomerDetailPage"*.
- `components/ui/confirm-dialog.tsx` — `if (!open) return null` na linha 40 e `React.useEffect` (handler de
  ESC) na 59 → *"Internal React error: Expected static flag was missing"* **em todo diálogo de confirmação
  do sistema** (excluir produto, cliente, categoria, marca…). Na prática, o listener de ESC monta e desmonta
  de forma inconsistente.

**Passos**
1. Mover **todos** os hooks para antes de qualquer `return` condicional nos dois arquivos.
2. No `ConfirmDialog`, manter o componente montado e controlar a visibilidade por props (padrão do Radix
   Dialog), em vez de retornar `null` antes dos hooks.
3. Habilitar `eslint-plugin-react-hooks` com `rules-of-hooks: error` no lint do CI — isso impede a
   reintrodução. Rodar em todo o front e corrigir o que aparecer.

---

## 9.4 — FN-18: 404 amigável

`/xyz`, `/financeiro`, `/vendas` e `/estoque` caem no 404 cru do Next: página branca, "This page could not be
found", em inglês, sem sidebar e sem link de volta. E `/financeiro`, `/vendas` e `/estoque` são exatamente os
`href` dos grupos do menu (`sidebar.tsx:53/64/78`) — o usuário chega lá com um clique.

**Passos**
1. Criar `app/not-found.tsx` (global) e `app/(dashboard)/not-found.tsx` (dentro do shell, com menu e botão
   "Voltar ao início"), em pt-BR.
2. Decidir o comportamento das rotas-pai: `redirect()` para o primeiro filho (ex.: `/financeiro` →
   `/financeiro/lancamentos`) **ou** virar item não clicável no menu. Recomendo o redirect — o usuário
   costuma clicar no grupo.
3. Adicionar `error.tsx` por seção do dashboard, para erro de render não apagar o shell (complementa o lote 1).

---

## 9.5 — Máscaras e texto (VD-16, FN-19, FN-27, AE-21, AE-23, VD-19)

O `apps/web/CLAUDE.md` já torna as máscaras obrigatórias — o que falta é aplicá-las na **exibição**:

- **VD-16** — aba Cliente do pedido mostra `11185874640` e `31999643603`.
- **FN-19** — `/configuracoes` não mascara CNPJ nem CEP na digitação.
- → Usar `maskCPF`/`maskCNPJ`/`maskPhone`/`maskCEP` de `@/lib/masks` em toda exibição e em todo input.
  Varredura: `grep -rn "customer.document\|\.phone\|zipCode" apps/web/app`.
- **FN-27** — "Metodos de Pagamento", "Condicoes", "Acoes", "Poupanca", "Codigo", "Nao", "Liquidacao",
  "Nome obrigatorio" em todo o módulo de Configurações e Contas, enquanto o resto do sistema é acentuado.
  Corrigir e adicionar checagem no review.
- **AE-21** — "1 itens" no card Estoque Crítico → pluralização (`item`/`itens`).
- **AE-23** — gráfico "Pedidos por Status" usa "Separação" no eixo e "Separando" na legenda. Centralizar os
  rótulos de status em `packages/constants` e importar em todos os lugares (badges, gráficos, filtros).

---

## 9.6 — VD-18 + AE-26: usabilidade operacional

- **VD-18 (PDV)** — nenhum atalho funciona (testados F2/F4/F9/ESC) e o campo de busca perde o foco após
  adicionar um item, obrigando um clique por produto. Num balcão isso custa segundos por venda.
  → Retomar o foco na busca após cada item; atalhos: `F2` buscar produto, `F4` cliente, `F9` finalizar,
  `ESC` limpar/cancelar, `+`/`-` quantidade do último item; suporte a leitor de código de barras (entrada
  rápida terminada em `Enter`, sem esperar o debounce de 300 ms); exibir a legenda dos atalhos no rodapé.
- **AE-26** — no modal "Nova movimentação", o dropdown de produto cobre Depósito, Quantidade, Motivo e
  Observações, e o modal não cresce nem rola. → Posicionar em portal com detecção de colisão (o Radix já faz
  isso — o combobox atual parece ser custom) e dar `max-h` com scroll à lista.

---

## 9.7 — FN-22: breadcrumbs

Telas de segundo nível não têm trilha (`/financeiro/lancamentos`, `/configuracoes/metodos-pagamento`).
Adicionar breadcrumb derivado da rota no layout do dashboard, com o mesmo mapa de rótulos do menu.

---

## Checklist de saída do lote

- [ ] As 25 rotas verificadas em 390×844 sem corte de conteúdo
- [ ] Nenhum warning de Rules of Hooks no console; regra de lint ativa no CI
- [ ] Nenhum documento ou telefone exibido sem máscara
- [ ] `/xyz` e as rotas-pai do menu levam a página amigável em pt-BR
- [ ] Rótulos de status vindos de uma fonte única

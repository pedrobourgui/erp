# Planos de Correção — Ciclo de QA de 31/07/2026

Consolidação dos 78 bugs encontrados no ciclo de QA (216 cenários, 3 domínios, 338 evidências) em
**10 lotes de trabalho**. Cada lote tem seu próprio arquivo com objetivo, arquivos afetados, passo a
passo, critérios de aceite e testes.

## Critério de divisão

Os lotes **não** seguem a divisão por módulo dos relatórios de QA. Eles agrupam bugs por **causa raiz
e arquivo tocado**, porque o mapeamento real é n:1 — um único helper de data resolve 4 bugs em 3
telas diferentes; um único componente de sidebar resolve o "mobile quebrado" dos três domínios.
Agrupar por módulo faria três times editarem o mesmo arquivo e ainda deixaria a causa de pé.

Regras usadas:

1. **Um lote = um conjunto de arquivos** — dois lotes não editam o mesmo arquivo, para permitir
   paralelismo sem conflito de merge.
2. **Severidade define a ordem, não o agrupamento** — os críticos foram concentrados nos lotes 1 e 2.
3. **Correção estrutural antes de correção pontual** — ex.: criar o helper de fuso (lote 3) antes de
   sair corrigindo tela por tela.
4. **Baixos entram de carona** no lote que já abre o arquivo (custo marginal ~zero).

## Os 10 lotes

> **Estado atual da implementação: veja [PROGRESSO.md](PROGRESSO.md).**
> **Os 10 lotes estão concluídos** e verificados no app rodando. As divergências de arquitetura
> encontradas pelo caminho foram todas resolvidas com fonte única: pacotes do workspace utilizáveis
> em runtime, máquina de estados, aritmética de dinheiro, a **matriz de permissões** (lote 4, que
> existia em duas versões incompatíveis) e os rótulos de papel, plano e regime tributário (lote 8).
> O lote 10 deixou **64 testes E2E** em `apps/web/e2e/` e um CI que os roda antes do merge — e achou
> um bug crítico que nenhum teste unitário pegaria: o VD-10 estava fechado só no frontend, e a API
> aceitava uma venda de R$ 0,00. Há achados novos registrados lá.

| # | Lote | Bugs | Sev. máx | Estimativa | Depende de |
|---|---|---|---|---|---|
| 1 | [Parada de linha](lote-01-parada-de-linha.md) — crash, dinheiro errado, corrupção ✅ | 5 | 🔴 Crítico | 1,5 d | — |
| 2 | [Ciclo de vida do pedido](lote-02-ciclo-pedido.md) — estoque × financeiro ✅ | 11 | 🔴 Crítico | 4 d | L1 |
| 3 | [Datas e fuso horário](lote-03-datas-fuso.md) ✅ | 5 | 🟠 Alto | 2 d | — |
| 4 | [Autorização e sessão no frontend](lote-04-autorizacao-frontend.md) ✅ | 7 | 🟠 Alto | 3 d | — |
| 5 | [Integridade financeira](lote-05-integridade-financeira.md) ✅ | 12 | 🟠 Alto | 5 d | L3 |
| 6 | [Validações de domínio](lote-06-validacoes-dominio.md) ✅ | 13 | 🟠 Alto | 4 d | — |
| 7 | [Feedback de erro e contratos de API](lote-07-erros-contratos.md) ✅ | 8 | 🟡 Médio | 2,5 d | — |
| 8 | [Funcionalidades ausentes](lote-08-funcionalidades-ausentes.md) ✅ | 8 | 🟠 Alto | 6 d | L4, L6 |
| 9 | [UI, responsividade e acentuação](lote-09-ui-responsividade.md) ✅ | 13 | 🟠 Alto | 4 d | — |
| 10 | [Rede de proteção (testes)](lote-10-rede-de-protecao.md) ✅ | — | — | 3 d | L1–L9 |
| 11 | [Filtros por entidade cadastrada](lote-11-filtros-por-entidade.md) ✅ | 11 | 🔴 Crítico | 3 d | L4, L8 |

**Total: ~38 dias-desenvolvedor.**

> **Lote 11 é posterior ao ciclo de QA de 31/07.** Ele saiu de uma varredura dedicada aos filtros
> (03/08), comparando cada `*QueryDto` do backend com o painel de cada tela. Achou dois filtros que
> **não podem funcionar** — Categoria e Marca em Produtos são texto livre enviado como id, e devolvem
> zero resultados para qualquer coisa que se digite — e onze filtros que a API já aceita e nenhuma
> tela oferece. Os IDs usam o prefixo `FT-nn`.

## Sequenciamento sugerido (3 trilhas paralelas)

```
Semana 1        Semana 2         Semana 3        Semana 4
─────────────────────────────────────────────────────────────────
Trilha A   L1 ──► L2 ──────────────► L2 ──────► L8 ──────► L8
(fullstack     críticos + pedidos          funcionalidades ausentes
 sênior)

Trilha B   L3 ──► L5 ──────────────► L5 ──────► L10
(backend)  fuso    integridade financeira        testes/CI

Trilha C   L4 ──► L6 ──────► L7 ──► L9 ──────► L9
(frontend) authz   validações  erros  UI/responsivo
```

- **L1 é bloqueante para todo mundo**: enquanto o `MoneyInput` grava valor errado, qualquer teste
  manual de preço/pedido/financeiro produz dado sujo. Faça o lote 1 e reseede antes de seguir.
- **L3 antes de L5**: o helper de data é pré-requisito para validar vencimento/OVERDUE.
- **L4 e L6 antes de L8**: as telas novas do lote 8 já devem nascer com gating de permissão e as
  validações do lote 6.
- **L10 é contínuo**: cada lote entrega seus próprios testes (regra de TDD dos `CLAUDE.md`); o lote 10
  é só a infraestrutura de E2E/CI e os testes de regressão dos críticos.

## Convenção de IDs

Os relatórios originais numeram os bugs por domínio. Aqui eles ganham prefixo:

| Prefixo | Origem |
|---|---|
| `AE-nn` | `relatorio-auth-estoque.md` (BUG-00 … BUG-28) |
| `VD-nn` | `relatorio-vendas.md` (BUG-01 … BUG-21) |
| `FN-nn` | `relatorio-financeiro.md` (#1 … #28) |
| `FT-nn` | varredura de filtros de 03/08/2026 (lote 11) |

Os relatórios completos estão versionados em [`relatorios-qa/`](relatorios-qa/) — com passos de
reprodução, resultado esperado × obtido e arquivo/linha por bug.

As **338 evidências em PNG** (126 MB, grandes demais para o repositório) ficaram num diretório de
sessão, que **já não existe** — assim como os roteiros `t01-auth.js` … `s15-filtros.js` que as
geraram. É precisamente por isso que o lote 10 existe: a suíte em `apps/web/e2e/` é versionada, roda
com `npm run e2e --workspace=@erp/web` e guarda trace e screenshot das falhas como artefato do CI.

## Matriz de rastreabilidade (78 bugs → lote)

| Lote | Bugs cobertos |
|---|---|
| 1 | AE-00, AE-01, AE-03, VD-03, VD-04 |
| 2 | VD-01, VD-02, VD-05, VD-06, VD-08, VD-10, VD-12, VD-14, VD-17, VD-20, VD-21 |
| 3 | FN-01, FN-02, FN-23, VD-09, AE-22 |
| 4 | AE-17, AE-19, AE-27, AE-28, FN-09, VD-07, FN-71(UX do 403) |
| 5 | FN-03, FN-04, FN-05, FN-06, FN-11, FN-12, FN-15, FN-16, FN-17, FN-20, FN-28, VD-11 |
| 6 | AE-02, AE-04, AE-05, AE-08, AE-11, AE-12c, AE-15, AE-24, FN-13, FN-14, FN-24, FN-25, FN-26 |
| 7 | AE-10, AE-12a, AE-12b, AE-13, AE-14, FN-21, VD-19, (VD-17 → L2) |
| 8 | AE-06, AE-12d, AE-16, AE-18, AE-25, FN-07, FN-08, VD-11(UI) |
| 9 | AE-07, AE-09, AE-20, AE-21, AE-23, AE-26, FN-10, FN-18, FN-19, FN-22, FN-27, VD-13, VD-15, VD-16, VD-18 |
| 10 | regressão dos críticos + E2E no CI |
| 11 | FT-01 … FT-11 (achados após o ciclo de QA) |

## Fora de escopo (registrado, não planejado)

Cenários que o QA não conseguiu exercitar e que precisam de uma rodada própria depois destes lotes:
expiração real do JWT com refresh em background, upload de imagem de produto, importação CSV
(clientes, produtos, despesas), variações de produto, exportação CSV de pedidos, isolamento
multi-tenant real (só existe um tenant no seed), concorrência (duas baixas simultâneas do mesmo
título) e os módulos `purchases`, `fiscal`, `reports`, `notifications` e `imports`, que não têm tela
no menu atual.

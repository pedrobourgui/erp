# Lote 3 — Datas e fuso horário

> Cinco bugs, uma causa: o sistema mistura *timestamps* (instantes) com *datas civis* (dia do
> calendário) e converte entre UTC e America/Sao_Paulo sem critério. Estimativa: **2 dias**.
> Sem dependências — e é pré-requisito do lote 5.

| Bug | Sev. | Resumo |
|---|---|---|
| FN-01 | 🟠 Alto | Filtro de período descarta quase todo o último dia (backend) |
| FN-02 | 🟠 Alto | Todas as datas do financeiro exibem 1 dia a menos |
| VD-09 | 🟠 Alto | Filtro "hoje" em pedidos retorna 0 de 5 |
| FN-23 | 🔵 Baixo | Período invertido (De > Até) não é criticado |
| AE-22 | 🔵 Baixo | Eixo do gráfico do dashboard em formato ISO (`07-31`) |

---

## O diagnóstico

Duas naturezas de dado estão sendo tratadas como uma só:

| Natureza | Exemplos | Como deve ser gravada | Como deve ser exibida |
|---|---|---|---|
| **Instante** | `createdAt`, `paidAt`, `shippedAt` | `timestamptz` em UTC | convertida para o fuso do tenant |
| **Data civil** | `dueDate`, `competenceDate`, filtros De/Até | dia, sem hora — meia-noite **no fuso do tenant** ou coluna `date` | exatamente o dia gravado, sem conversão |

Hoje `dueDate` é gravada como meia-noite **UTC** (`financial-entries.service.ts:106`) e renderizada em
horário local por `formatDate` (`apps/web/lib/utils.ts:18-24`) → em BRT (−03) vira 21 h do dia anterior,
e o usuário vê 14/01 onde digitou 15/01.

Nos filtros, o backend faz parse UTC e depois `setHours` **local**:

```ts
const end = new Date(endDate);   // '2026-07-31' → 2026-07-31T00:00:00Z (= 30/07 21:00 em -03)
end.setHours(23, 59, 59, 999);   // setHours é LOCAL → 2026-07-31T02:59:59Z
```

O fim do período fica ~21 h antes do esperado. Medido na API: `endDate=2026-07-31` → **4** registros;
`endDate=2026-08-01` → **11**.

---

## 3.1 — Helper único de intervalo (backend)

**Novo arquivo:** `apps/api/src/common/utils/date-range.util.ts`

```ts
/** Converte 'YYYY-MM-DD' no início do dia, no fuso do tenant, em instante UTC. */
export function startOfDayInTz(date: string, tz = 'America/Sao_Paulo'): Date
/** Idem para o fim do dia (23:59:59.999). */
export function endOfDayInTz(date: string, tz = 'America/Sao_Paulo'): Date
/** Monta { gte, lte } tolerando datas invertidas (troca e sinaliza). */
export function toDateRange(from?: string, to?: string, tz?: string): { gte?: Date; lte?: Date }
```

Implementar com `date-fns-tz` (ou `Intl.DateTimeFormat` com `timeZone`) — **nunca** com `setHours`, que
sempre usa o fuso do processo. O fuso deve vir da configuração do tenant, com default
`America/Sao_Paulo`; enquanto o campo não existir no modelo, usar a constante e deixar `TODO` explícito.

**Aplicar em todos os pontos que hoje montam intervalo à mão:**
- `financial-entries.service.ts:309-318` (FN-01)
- `orders.service.ts:88-92` (VD-09 — hoje usa `lte: new Date(dateTo)`, 00:00 do dia final)
- varrer: `grep -rn "setHours\|new Date(.*date" apps/api/src --include=*.service.ts`

**Aceite:** `?startDate=2026-07-31&endDate=2026-07-31` retorna **todos** os registros de 31/07 no fuso do
tenant, em pedidos e no financeiro. Um registro criado às 23h50 de 31/07 (BRT) entra em 31/07 e não em 01/08.

---

## 3.2 — Data civil: gravar e exibir o mesmo dia

**Backend** (`financial-entries.service.ts:106` e demais `new Date(dto.xxxDate)`)
1. Para campos de data civil, gravar meia-noite **no fuso do tenant** convertida para UTC
   (`startOfDayInTz`), não `new Date('2026-01-15')`.
2. Alternativa mais robusta, se houver apetite para migration: mudar as colunas de data civil
   (`dueDate`, `competenceDate`) para `@db.Date` no Prisma — o tipo `date` do Postgres não tem fuso e o
   bug fica impossível por construção. Recomendado, porque elimina a classe inteira de erro.

**Frontend** (`apps/web/lib/utils.ts:18-24`)
3. Criar duas funções distintas e proibir o uso ambíguo:
   - `formatDate(iso)` → para **datas civis**: formatar em UTC (`formatInTimeZone(iso, 'UTC', 'dd/MM/yyyy')`),
     nunca em local;
   - `formatDateTime(iso)` → para **instantes**: converter para o fuso do usuário e exibir dd/MM/yyyy HH:mm.
4. Trocar as chamadas: vencimentos, competência e datas de filtro usam `formatDate`; `createdAt`,
   `paidAt`, histórico de status usam `formatDateTime`.
5. Nos `<input type="date">`, enviar e receber sempre `YYYY-MM-DD` puro, sem passar por `new Date()`.

**Aceite:** criar título com vencimento 15/01/2026 → lista, detalhe e diálogo de baixa exibem **15/01/2026**;
`GET` da API devolve o mesmo dia; o valor sobrevive a F5 e a mudança de fuso do navegador.

**Teste:** `utils.test.ts` com `TZ=America/Sao_Paulo`, `TZ=UTC` e `TZ=Asia/Tokyo` (roda no CI com as três) —
a data civil precisa exibir 15/01 nos três casos.

---

## 3.3 — FN-23: período invertido

Com De = 31/12/2026 e Até = 01/01/2026 a lista volta vazia com a mensagem genérica "Ajuste os filtros".

**Passos**
1. No front, validar no schema do filtro: `endDate ≥ startDate`, com mensagem "A data final deve ser
   posterior à inicial".
2. No backend, `toDateRange` inverte os extremos automaticamente (defensivo) — mas o front avisa antes.

---

## 3.4 — AE-22: formato brasileiro nos gráficos

O eixo X de "Vendas do Período" mostra `07-31` e o tooltip `2026-07-22`.

**Passos**
1. Formatar os ticks com `dd/MM` e o tooltip com `dd/MM/yyyy` (usar o `formatDate` novo).
2. Varrer os demais gráficos (`apps/web/components/charts`) atrás de datas cruas.

---

## Checklist de saída do lote

- [x] Nenhuma ocorrência de `setHours` em código de filtro no backend
- [x] Suíte rodando com três `TZ` diferentes — `npm run test:tz` (raiz, API e web).
      **O wiring no CI fica para o lote 10**: o repositório ainda não tem
      `.github/workflows`
- [x] Filtro "hoje" retorna os registros de hoje em pedidos e em lançamentos
- [x] Vencimento digitado = vencimento exibido = vencimento no banco
- [x] Regra escrita no `apps/api/CLAUDE.md` e no `apps/web/CLAUDE.md`

**Concluído em 01/08/2026** — 8/8 checagens no app rodando, feitas às 22h50 de BRT
(já 01/08 em UTC), que é exatamente a janela em que a família de bugs se manifesta.
Ver [PROGRESSO.md](PROGRESSO.md) para o detalhamento e para o que foi além do plano.

# Lote 7 — Feedback de erro e contratos de API

> Dois padrões sistêmicos: (a) o backend devolve mensagens úteis e a UI as joga fora, e (b) o front lê
> campos que a API não devolve, então colunas inteiras ficam vazias. Ambos são de correção mecânica e alto
> retorno percebido. Estimativa: **2,5 dias**. Sem dependências.

| Bug | Sev. | Resumo |
|---|---|---|
| AE-10 | 🟡 Médio | Toasts genéricos escondem o motivo real (6 casos comprovados) |
| AE-12a | 🟡 Médio | Mensagens do backend em inglês vazando para o usuário |
| FN-21 | 🔵 Baixo | Descrições de títulos em inglês ("Receivable for order PED-000003") |
| VD-19 | 🟡 Médio | Valor não formatado no toast ("R$ 11730.00") |
| AE-13 | 🟡 Médio | "Pedidos" e "Total Gasto" da lista de clientes sempre vazios |
| AE-14 | 🟡 Médio | Coluna CLIENTE vazia em "Pedidos Recentes" no dashboard |
| AE-12b | 🟡 Médio | Card de depósito exibe ", -" e " produtos" sem número |

---

## 7.1 — AE-10: aplicar `getApiErrorMessage` em todas as mutations

O helper **já existe** em `apps/web/lib/api.ts:105-116` e é usado corretamente no diálogo de movimentação.
Só não foi aplicado no resto. Casos medidos pelo QA:

| Ação | Backend devolve | Usuário vê |
|---|---|---|
| Cliente com documento duplicado | `Já existe um cliente com o documento "529.982.247-25"` | "Erro ao criar cliente. Tente novamente." |
| SKU duplicado | `Product with SKU "…" already exists` | "Erro ao criar produto…" |
| Slug de categoria duplicado | `Category with slug "…" already exists` | "Erro ao criar categoria." |
| Marca duplicada | `Brand "…" already exists` | "Erro ao criar marca." |
| Excluir categoria em uso | `Cannot delete category: 4 product(s) are still using it` | "Erro ao excluir categoria." |
| Excluir marca em uso | `Cannot delete brand: 4 product(s) are still using it` | "Erro ao excluir marca." |

**Passos**
1. Criar `useMutationToast()` (ou um wrapper `handleMutationError`) que centraliza o padrão:
   ```ts
   catch (error) {
     addToast({ variant: "destructive",
                title: fallback,
                description: getApiErrorMessage(error) ?? "Tente novamente." });
   }
   ```
   com tratamento especial para 403 ("Você não tem permissão…", ligado ao lote 4) e 5xx.
2. Aplicar em **todas** as chamadas `mutateAsync` do front —
   `grep -rn "mutateAsync" apps/web | wc -l` dá a lista de trabalho.
3. Antecipar o erro onde a informação já está na tela: o diálogo de excluir categoria/marca deve avisar
   "4 produtos usam esta categoria" **antes** de confirmar — a coluna "Produtos" já mostra o número na
   mesma linha.
4. Regra para o `apps/web/CLAUDE.md`: *toast de erro sem `getApiErrorMessage` não passa em code review*.

---

## 7.2 — AE-12a + FN-21 + VD-19: mensagens em português e formatação

- **AE-12a** — o usuário vê literalmente "Cannot create inventory item with negative quantity"
  (`inventory.service.ts:803`) e "Insufficient stock. Current: 19, Change: -999" (`:788-790`). Traduzir
  para pt-BR e tornar acionável: *"Estoque insuficiente no depósito Makeimports: disponível 19, saída solicitada 999."*
- **FN-21** — recebíveis nascem como "Receivable for order PED-000003" e aparecem assim ao lado de
  "Venda balcão PED-000004". Padronizar a geração em pt-BR e migrar os registros existentes.
- **VD-19** — toast de troca exibe "Diferença a devolver: R$ 11730.00". Usar `formatCurrency` em **todas**
  as interpolações de valor em mensagens (`grep -rn "R\$ \${" apps/web`).

**Política a adotar:** toda mensagem de erro voltada ao usuário nasce em pt-BR no backend; inglês fica
restrito a log e a mensagem técnica interna. Vale uma varredura:
`grep -rn "throw new \(Bad\|Conflict\|NotFound\|Forbidden\)" apps/api/src | grep -v "[À-ú]"`.

---

## 7.3 — AE-13 + AE-14 + AE-12b: contratos front × back

Três colunas vazias, mesma causa: o componente lê um campo que a resposta não tem. Ninguém percebe porque
`undefined` renderiza como vazio ou como `R$ 0,00`.

| Tela | Front lê | API devolve | Correção |
|---|---|---|---|
| `clientes/page.tsx:139-150` | `totalOrders`, `totalSpent` | `_count.orders` | Backend passa a devolver `totalOrders` e `totalSpent` agregados (também usados nos cards do detalhe) |
| Dashboard "Pedidos Recentes" | `customerName`, `total` | `customerId` preenchido, `customerName: null`, `total: null` | Backend inclui nome do cliente e total no resumo |
| `estoque/depositos/page.tsx:59-60,68` | `city`, `state`, `productCount` | `{id,name,code,address,isDefault}` | Backend devolve cidade/UF e a contagem de produtos |

**Passos**
1. Corrigir do lado do **backend** (os campos fazem sentido no domínio e a UI já foi desenhada para eles),
   cuidando da performance da agregação (`_count`/`_sum` no Prisma, não N+1).
2. **Eliminar a classe do problema**: tipar as respostas a partir de `packages/shared-types`, gerados/mantidos
   junto com os DTOs do backend, e proibir `type` de resposta redigitado dentro de `apps/web/app`.
   Complemento no lote 10: teste de contrato que falha quando a resposta perde um campo.
3. Varredura ativa: para cada tabela do sistema, conferir se todos os `accessor` existem na resposta —
   os três casos acima foram achados em três telas diferentes, provavelmente há mais.

**Aceite:** nenhuma coluna renderiza vazio por campo inexistente; cliente com pedidos mostra a contagem e o
total corretos; card de depósito mostra "Rua X, São Paulo - SP" e "12 produtos".

---

## Checklist de saída do lote

- [ ] Toda mutation exibe a mensagem específica do backend
- [ ] Nenhuma mensagem em inglês visível ao usuário (varredura feita)
- [ ] Nenhum valor monetário interpolado sem `formatCurrency`
- [ ] Tipos de resposta importados de `packages/shared-types` nas telas corrigidas

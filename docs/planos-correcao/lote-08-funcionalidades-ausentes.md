# Lote 8 — Funcionalidades ausentes

> Não são defeitos de código: são telas que faltam ou que existem só como fachada. Duas delas
> (`Dados da Empresa` e `Usuários`) **mentem** para o usuário — pior que não existir.
> Estimativa: **6 dias**. Depende dos lotes 4 (permissões) e 6 (validações), para as telas novas já
> nascerem certas.

| Bug | Sev. | Resumo |
|---|---|---|
| FN-07 | 🟠 Alto | `/configuracoes` → Dados da Empresa: `// TODO: integrate with API` |
| FN-08 | 🟠 Alto | Abas Usuários e Plano exibem mock hardcoded |
| AE-25 | 🟠 Alto | Transferência entre depósitos e Ajuste não existem na UI |
| AE-06 | 🟠 Alto | Não existe edição de cliente (CRUD sem "U") |
| AE-16 | 🟡 Médio | Cliente sem endereço; nenhuma busca por CEP |
| AE-12d | 🟡 Médio | Depósito não pode ser editado nem excluído |
| VD-11(UI) | 🟡 Médio | Método de pagamento não expõe a conta financeira vinculada |
| AE-18 | 🟡 Médio | Busca global do topbar não faz nada |

---

## 8.1 — FN-07 + FN-08: `/configuracoes` precisa parar de mentir

**Arquivo:** `apps/web/app/(dashboard)/configuracoes/page.tsx:104-118, 240`

```ts
const onSubmit = async (_data: CompanyFormValues) => {
  // TODO: integrate with API
};
```
`defaultValues` fixos em `""`, sem `useQuery` do tenant. O usuário preenche razão social, CNPJ e endereço,
clica em "Salvar Alterações", **nada acontece** (nem requisição HTTP) e ele acredita que cadastrou os dados
fiscais da empresa. As abas Usuários e Plano mostram "João Silva / Maria Santos / Pedro Oliveira" e
"245/500 produtos" — dados falsos sobre quem tem acesso ao sistema.

**Passos**
1. **Antes de qualquer coisa** (pode ir junto com o lote 1, é trivial): desabilitar o botão "Salvar" e
   marcar as abas como "Em breve". Uma tela honesta e inerte é melhor que uma que finge salvar.
2. Backend: `GET /tenants/current` e `PATCH /tenants/current` com os dados cadastrais e fiscais (razão
   social, nome fantasia, CNPJ, IE, regime tributário, endereço completo, contato). Escopo por tenant e
   permissão `settings:update`.
3. Front: carregar via React Query, aplicar máscaras de CNPJ/CEP (ver lote 9), validar CNPJ com DV (lote 6),
   toast de sucesso e persistência conferida com F5.
4. Aba **Usuários**: listar os usuários reais do tenant (`GET /users`), com papel, status e ações de
   convidar/desativar (`POST /users/invite` — o botão "Convidar" hoje é outro `// TODO`).
5. Aba **Plano**: consumir os limites reais do tenant. Se ainda não existe modelo de plano/limites, **remover
   a aba** em vez de exibir números inventados.

**Aceite:** dados da empresa carregam do banco, salvam com toast e sobrevivem a F5; a aba Usuários lista
Administrador e Ana Vendedora; nenhuma tela exibe dado hardcoded.

---

## 8.2 — AE-25: transferência entre depósitos e ajuste de estoque

O modal "Nova movimentação" só oferece Entrada e Saída. O comentário em
`movimentacoes/_components/movement-form-dialog.tsx:36` diz *"transfers/adjustments have their own flows"* —
**esses fluxos não existem em lugar nenhum do front**. O backend suporta:
`POST /inventory/transfer` (valida origem ≠ destino e saldo — `inventory.service.ts:435,459`) e `ADJUSTMENT`
em `POST /inventory/movement`. Movimentação entre depósitos e ajuste de inventário são função básica de ERP.

**Passos**
1. Adicionar "Transferência" ao modal: depósito de origem, destino, produto, quantidade, motivo — com
   validação de saldo na origem e feedback do saldo resultante nos dois depósitos.
2. Adicionar "Ajuste": quantidade alvo (não delta), motivo obrigatório (avaria, furto, contagem) e
   justificativa; registrar usuário e horário para auditoria.
3. Restringir por permissão: `inventory:transfer` e `inventory:adjust` (já existem em `packages/constants`).
4. Exibir os 6 tipos corretamente na listagem (feito no lote 1) e permitir filtrar por eles.
5. Opcional de alto valor: tela de **inventário/contagem** (importar contagem e gerar ajustes em lote).

---

## 8.3 — AE-06 + AE-16: cliente completo

- **AE-06** — o detalhe só tem "Excluir"; `/clientes/[id]/edit` é 404. O ícone `Edit` está importado em
  `clientes/[id]/page.tsx:26` e nunca usado, e o backend já expõe `PATCH /customers/:id`. Criar a rota de
  edição reaproveitando o formulário de criação (extrair `<CustomerForm mode="create" | "edit">`).
- **AE-16** — o cadastro tem 4 campos (nome, documento, e-mail, telefone), mas o detalhe tem uma aba
  "Endereços" que nunca pode ser preenchida. Adicionar CRUD de endereços (cobrança/entrega, com um
  principal) e **busca automática por CEP** (ViaCEP ou BrasilAPI): preencher logradouro, bairro, cidade e UF,
  deixando número e complemento para o usuário. Tratar CEP inexistente e indisponibilidade do serviço sem
  travar o cadastro. Aplicar o mesmo componente no formulário de depósito, que já tem CEP e não busca nada.

---

## 8.4 — AE-12d + VD-11(UI): depósitos e métodos de pagamento

- **AE-12d** — cards de depósito não têm editar nem excluir. Adicionar as duas ações (excluir só sem saldo e
  sem movimentações — mesma regra do lote 6 para produto) e a marcação de padrão único (lote 6).
- **VD-11(UI)** — `Configurações > Métodos de Pagamento` não exibe nem permite editar a **conta financeira
  vinculada**, justamente o campo que as telas de venda mandam configurar quando bloqueiam a venda
  ("forma à vista sem conta vinculada"). Adicionar o campo, torná-lo obrigatório para métodos à vista
  (regra do lote 5) e mostrar o tipo do método na listagem.

---

## 8.5 — AE-18: busca global

O campo "Buscar..." do topbar aceita digitação e não faz nada.

**Passos**
1. Definir escopo: clientes, produtos e pedidos (por nome, SKU, documento e número).
2. Implementar como command palette (`Ctrl/Cmd+K`), com debounce de 300 ms, resultados agrupados por
   entidade e navegação por teclado.
3. Backend: endpoint único `GET /search?q=` que consulta as três entidades com limite por grupo, escopado por
   tenant e respeitando permissões.
4. Se não houver apetite para isso agora, **remover o campo** — um input inerte no topbar de todas as telas é
   dívida visível.

---

## Checklist de saída do lote

- [ ] Nenhum `// TODO: integrate with API` em tela publicada (`grep -rn "TODO: integrate" apps/web` = 0)
- [ ] Nenhum dado mock em tela publicada (`grep -rn "MOCK_" apps/web` = 0)
- [ ] Transferência e ajuste operáveis pela UI, com permissão e auditoria
- [ ] Cliente pode ser editado e ter endereço com busca por CEP
- [ ] Todas as telas novas nascem com gating de permissão (lote 4) e validação (lote 6)

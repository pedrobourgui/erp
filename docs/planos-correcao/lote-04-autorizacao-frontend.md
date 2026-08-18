# Lote 4 — Autorização e sessão no frontend

> O backend está correto: o vendedor recebe 403 em todos os endpoints financeiros e administrativos, e
> **nenhum dado vazou** nos testes. O problema é que a UI ignora isso — mostra o menu inteiro, botões
> habilitados e estados vazios enganosos. Estimativa: **3 dias**. Sem dependências.

| Bug | Sev. | Resumo |
|---|---|---|
| AE-27 / FN-09 | 🟠 Alto | Vendedor vê menu completo, dashboard financeiro e todas as rotas administrativas |
| AE-28 | 🟡 Médio | 403 é renderizado como "lista vazia" — "Nenhum caixa cadastrado" com 2 caixas |
| VD-07 | 🟠 Alto | Vendedor **não consegue vender**: 403 em métodos/condições/caixa |
| AE-17 | 🟡 Médio | `/login` acessível estando logado |
| AE-19 | 🟡 Médio | Tokens JWT em `localStorage`, sem cookie httpOnly |
| FN-71 | 🟡 Médio | Erro de permissão vira "Erro ao criar metodo. Tente novamente." |

---

## O que já existe (não precisa ser construído)

`GET /auth/me` **já devolve as permissões do usuário** (`auth.service.ts:257-289`):

```jsonc
{ "role": { "id": "...", "name": "vendedor",
            "permissions": [{ "permission": { "resource": "orders", "action": "create" } }, …] } }
```

E `packages/constants/src/index.ts:55-101` já define as 40 permissões canônicas (`products:read`,
`orders:cancel`, `inventory:transfer`, `settings:update`, …). Ou seja: **o contrato existe e só falta
consumi-lo**. Note que o payload do `POST /auth/login` traz apenas `role: {id, name}` — o front deve
buscar `/auth/me` logo após o login para obter as permissões.

---

## 4.1 — Fundação: `usePermissions`

**Novos arquivos:** `apps/web/hooks/use-permissions.ts`, `apps/web/components/auth/can.tsx`,
`apps/web/components/auth/require-permission.tsx`

1. Estender `auth.store.ts` para guardar `permissions: string[]` (formato `"resource:action"`),
   populado pelo `/auth/me` no login e na hidratação.
2. `usePermissions()` expõe:
   ```ts
   const { can, canAny, canAll, isOwner } = usePermissions();
   can("financial:read")   // boolean
   ```
   `owner`/`admin` retorna `true` para tudo.
3. `<Can permission="products:create">…</Can>` — renderiza os filhos só com permissão. Para botões,
   preferir **desabilitar com tooltip** ("Você não tem permissão para esta ação") a sumir: some sem
   explicação confunde tanto quanto o 403.
4. `<RequirePermission permission="financial:read">` — wrapper de página que renderiza a tela de
   **Acesso negado** quando falta permissão (com ícone, explicação e botão "Voltar ao início").

**Teste:** `use-permissions.test.ts` cobrindo owner, papel parcial e papel sem permissão nenhuma.

---

## 4.2 — AE-27 / FN-09: menu, rotas e ações

**Arquivos:** `apps/web/components/layouts/sidebar.tsx`, todas as `page.tsx` de `(dashboard)`

1. Declarar a permissão exigida por item de menu na própria configuração da sidebar:
   ```ts
   { label: "Financeiro", href: "/financeiro", permission: "financial:read", children: [...] }
   ```
   Filtrar itens e grupos — um grupo sem filhos visíveis não aparece.
2. Envolver cada página administrativa com `<RequirePermission>`. Lista mínima verificada no QA:
   `/financeiro/*`, `/configuracoes/*`, `/estoque/depositos`, `/estoque/movimentacoes`, `/estoque/alertas`.
3. **Dashboard**: os KPIs financeiros ("A Pagar R$ 11.730,00", "A Receber", faturamento, ticket médio) só
   com `reports:financial`. O vendedor deve ver a versão de vendas do painel — não uma tela vazia.
4. Botões de mutação (`Novo Produto`, `Nova Categoria`, `Nova Conta`, `Importar Despesas`, excluir cliente…)
   passam por `<Can>`.
5. Ao montar o menu, garantir que o item sem permissão também não seja alcançável por URL — o guard da
   página é a defesa real; o menu é só cosmética.

**Aceite:** logado como vendedor, a sidebar não mostra Financeiro nem Configurações; acessar
`/financeiro/contas` por URL direta exibe "Acesso negado"; nenhum botão de ação proibida fica clicável;
o console não acumula rajadas de 403.

---

## 4.3 — AE-28: 403 nunca pode virar estado vazio

Hoje `/financeiro/contas` mostra "Nenhuma conta financeira cadastrada" (existem 6) e `/financeiro/caixa`
"Total de Caixas 0" (existem 2). O usuário conclui que o sistema perdeu os dados.

**Passos**
1. Nos hooks de listagem, propagar o erro em vez de cair no estado vazio: `isError` + `error.status`.
2. Nos componentes de tabela/lista, tratar três estados distintos — **carregando**, **sem permissão** (403)
   e **vazio de verdade** (200 com zero linhas). Criar um `<PermissionDeniedState />` reaproveitável.
3. Regra a documentar no `apps/web/CLAUDE.md`: *`isError` nunca pode ser renderizado como estado vazio*.

**Aceite:** com 403, a tela diz "Você não tem permissão para ver estas informações", nunca "nenhum registro".

---

## 4.4 — VD-07: o vendedor precisa conseguir vender

Este é um bug de **política de permissão**, não de UI: `/vendas/balcao` e `/vendas/pedidos/novo` recebem 403
em `GET /payment-methods`, `GET /payment-conditions`, `GET /cash-register-sessions` e
`GET /financial-accounts`. O seletor fica vazio e a tela mostra o aviso **falso** "Nenhum caixa aberto".

**Passos**
1. Revisar as permissões do papel `vendedor` no seed e em `SYSTEM_ROLES`: quem vende precisa de **leitura**
   de métodos de pagamento, condições de pagamento e da sessão de caixa aberta. Sugestão de permissões
   novas e granulares: `payment-methods:read`, `payment-conditions:read`, `cash-registers:read-session`.
2. Não conceder leitura ampla de `financial-accounts` — expor apenas a conta vinculada ao método escolhido,
   ou devolver a conta já resolvida dentro do método de pagamento.
3. Corrigir o aviso "Nenhum caixa aberto" para distinguir *não há caixa* de *não pude consultar* (ligado ao 4.3).
4. Reteste completo: o vendedor deve conseguir concluir uma venda de balcão de ponta a ponta.

**Aceite:** vendedor faz login, abre o PDV, vê as formas de pagamento, vende e o pedido nasce `COMPLETED`
com baixa de estoque — sem nenhum 403 no console.

---

## 4.5 — AE-17 e AE-19: sessão

- **AE-17** — `/login` estando autenticado deve redirecionar para `/`. Implementar no layout de `(auth)`,
  checando o estado hidratado do store (evitar flicker: renderizar `null` enquanto `isLoading`).
- **AE-19** — `erp_token` e `erp_refresh_token` vivem em `localStorage`; qualquer XSS entrega a sessão
  inteira, inclusive o refresh de 7 dias. Plano em duas etapas:
  1. **Agora (barato):** encurtar o refresh para 24 h, adicionar rotação de refresh token no backend
     (invalidar o anterior a cada uso) e revogar no logout do lado do servidor.
  2. **Depois (estrutural):** migrar para cookie `httpOnly` + `SameSite=Lax` + CSRF token, com o Next
     atuando como BFF nas rotas de auth. Exige mudança no CORS e no interceptor — planejar como tarefa
     própria, não misturar com este lote.
  Registrar a decisão em ADR; se a etapa 2 for adiada, isso precisa ser aceito conscientemente.

---

## 4.6 — FN-71: mensagem de permissão

Ao submeter sem permissão, o usuário vê "Erro ao criar metodo. Tente novamente." — sugere falha técnica.
Tratar o 403 explicitamente no helper de erro (lote 7): *"Você não tem permissão para realizar esta ação.
Fale com o administrador."*

---

## Checklist de saída do lote

- [ ] Matriz papel × tela validada manualmente para `owner` e `vendedor` (e para um papel novo "financeiro", se existir)
- [ ] Nenhuma tela renderiza 403 como vazio
- [ ] Vendedor consegue vender de ponta a ponta
- [ ] Testes de `usePermissions`, do menu filtrado e do guard de página
- [ ] ADR de estratégia de token escrita e aprovada

import { z } from "zod";

import { test, expect, type ApiClient } from "./fixtures";

/**
 * Testes de contrato front × back (10.4).
 *
 * AE-13, AE-14 e AE-12b têm a mesma causa: a tela lê um campo que a resposta
 * não traz, e `undefined` renderiza como célula em branco ou `R$ 0,00`. Ninguém
 * percebe que o contrato quebrou — só acha que o cliente nunca comprou.
 *
 * Cada schema abaixo declara **o que a tela lê**. `.passthrough()` de
 * propósito: campo a mais não quebra a UI, campo a menos sim.
 */

const money = z.union([z.number(), z.string()]);
const nullableText = z.string().nullable().optional();

const SCHEMAS: {
  screen: string;
  path: string;
  /** Onde estão as linhas na resposta. */
  pick?: (body: unknown) => unknown[];
  row: z.ZodTypeAny;
}[] = [
  {
    screen: "Clientes",
    path: "/customers?limit=5",
    row: z
      .object({
        id: z.string(),
        name: z.string(),
        document: nullableText,
        documentType: nullableText,
        email: nullableText,
        phone: nullableText,
        // AE-13: a coluna "Pedidos" e o card "Total Gasto" ficavam vazios
        // porque a API mandava `_count.orders` e a tela lia estes dois.
        totalOrders: z.number(),
        totalSpent: z.number(),
      })
      .passthrough(),
  },
  {
    screen: "Pedidos",
    path: "/orders?limit=5",
    row: z
      .object({
        id: z.string(),
        orderNumber: z.string(),
        status: z.string(),
        totalAmount: money,
        createdAt: z.string(),
        // AE-14: a coluna CLIENTE lia um campo plano que não existia.
        customerName: nullableText,
        // VD-02: a UI monta os botões de transição a partir disto.
        allowedTransitions: z.array(z.string()),
      })
      .passthrough(),
  },
  {
    screen: "Produtos",
    path: "/products?limit=5",
    row: z
      .object({
        id: z.string(),
        sku: z.string(),
        name: z.string(),
        salePrice: money,
        status: z.string(),
      })
      .passthrough(),
  },
  {
    screen: "Depósitos",
    path: "/inventory/warehouses?limit=5",
    row: z
      .object({
        id: z.string(),
        name: z.string(),
        // AE-12b: cidade, UF e CEP são campos próprios — concatená-los dentro
        // de `address` foi o que produziu ", -" no card.
        city: nullableText,
        state: nullableText,
        zipCode: nullableText,
        isDefault: z.boolean(),
        // AE-12d: a tela precisa distinguir um depósito desativado.
        isActive: z.boolean(),
        productCount: z.number(),
      })
      .passthrough(),
  },
  {
    screen: "Movimentações",
    path: "/inventory/movements?limit=5",
    row: z
      .object({
        id: z.string(),
        productName: nullableText,
        productSku: nullableText,
        type: z.string(),
        reason: z.string(),
        quantity: z.number(),
        // O sinal da quantidade sai destes dois (AE-25).
        fromWarehouseId: z.string().nullable(),
        toWarehouseId: z.string().nullable(),
        userName: z.string(),
        createdAt: z.string(),
      })
      .passthrough(),
  },
  {
    screen: "Alertas de estoque",
    path: "/inventory/alerts?limit=5",
    row: z
      .object({
        id: z.string(),
        productName: nullableText,
        // A tela lê `currentStock`/`minStock` — não `currentQuantity`.
        currentStock: z.number(),
        minStock: z.number(),
        status: z.string(),
      })
      .passthrough(),
  },
  {
    screen: "Lançamentos financeiros",
    path: "/financial-entries?limit=5",
    row: z
      .object({
        id: z.string(),
        kind: z.string(),
        type: z.string(),
        description: z.string(),
        amount: z.number(),
        date: z.string(),
        status: z.string(),
        accountName: nullableText,
      })
      .passthrough(),
  },
  {
    screen: "Métodos de pagamento",
    path: "/payment-methods?limit=5",
    row: z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        defaultAccountId: z.string().nullable(),
        // VD-11(UI): a tela mostra qual conta está vinculada.
        defaultAccount: z
          .object({ id: z.string(), name: z.string() })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough(),
  },
  {
    screen: "Sessões de caixa",
    path: "/cash-register-sessions?limit=5",
    row: z
      .object({
        id: z.string(),
        cashRegisterId: z.string(),
        status: z.string(),
        openingBalance: money,
      })
      .passthrough(),
  },
  {
    screen: "Usuários",
    path: "/users?limit=5",
    row: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        status: z.string(),
        role: z.object({ id: z.string(), name: z.string() }).passthrough().nullable(),
      })
      .passthrough(),
  },
  {
    screen: "Papéis",
    path: "/users/roles",
    pick: (body) => (body as { data?: unknown[] }).data ?? [],
    row: z
      .object({
        id: z.string(),
        name: z.string(),
        // FN-08: sem rótulo, o select do convite mostraria o slug cru.
        label: z.string(),
        userCount: z.number(),
      })
      .passthrough(),
  },
];

function rowsOf(body: unknown, pick?: (body: unknown) => unknown[]): unknown[] {
  if (pick) return pick(body);
  return (body as { data?: unknown[] }).data ?? [];
}

async function assertContract(
  client: ApiClient,
  entry: (typeof SCHEMAS)[number]
) {
  const response = await client.get(entry.path);
  expect(response.status, `${entry.screen}: ${entry.path}`).toBe(200);

  const rows = rowsOf(response.body, entry.pick);
  if (rows.length === 0) {
    // Nada a conferir — registrado em vez de silenciosamente aprovado.
    test.info().annotations.push({
      type: "sem massa",
      description: `${entry.screen} (${entry.path}) respondeu zero linhas`,
    });
    return;
  }

  for (const row of rows) {
    const parsed = entry.row.safeParse(row);
    expect(
      parsed.success,
      `${entry.screen} — campo que a tela lê faltando na resposta: ${
        parsed.success ? "" : JSON.stringify(parsed.error.issues)
      }`
    ).toBe(true);
  }
}

test.describe("contrato front × back", () => {
  for (const entry of SCHEMAS) {
    test(`${entry.screen} devolve os campos que a tela lê`, async ({ apiClient }) => {
      await assertContract(apiClient, entry);
    });
  }

  test("o dashboard entrega os blocos que a tela renderiza", async ({ apiClient }) => {
    const response = await apiClient.get("/reports/dashboard");
    expect(response.status).toBe(200);

    const data = (response.body as { data?: Record<string, unknown> }).data ?? {};
    // AE-22/TZ-01: o gráfico monta a série a partir daqui.
    expect(Array.isArray(data.salesTrend), "salesTrend não é uma série").toBeTruthy();
  });
});

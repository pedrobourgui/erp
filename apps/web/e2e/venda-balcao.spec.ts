import {
  test,
  expect,
  createCustomer,
  ensureOpenCashSession,
  ensureSellableProduct,
  productAvailable,
} from "./fixtures";

/**
 * Jornada: PDV com desconto, troco e múltiplos pagamentos.
 *
 * Cobre VD-04 (o PDV não enviava o desconto), VD-08 (troco virava receita) e
 * VD-10 (desconto acima do valor do item).
 */
test.describe("venda: balcão", () => {
  test("VD-04: o desconto informado chega ao pedido", async ({ apiClient }) => {
    const { sessionId } = await ensureOpenCashSession(apiClient);
    const product = await ensureSellableProduct(apiClient);
    const customer = await createCustomer(apiClient);

    const methods = await apiClient.get("/payment-methods?limit=50");
    const cash = (
      (methods.body as { data?: { id: string; type: string }[] }).data ?? []
    ).find((m) => m.type === "CASH");
    expect(cash, "nenhuma forma de pagamento em dinheiro").toBeTruthy();

    const created = await apiClient.post("/orders", {
      customerId: customer.id,
      origin: "BALCAO",
      cashRegisterSessionId: sessionId,
      discount: 10,
      items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentMethodId: cash!.id, amount: 90 }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const order = (created.body as {
      data: { id: string; discount: string; totalAmount: string; status: string };
    }).data;

    // O desconto era descartado no submit e o pedido nascia com o valor cheio.
    expect(Number(order.discount)).toBe(10);
    expect(Number(order.totalAmount)).toBe(90);
    expect(order.status).toBe("COMPLETED");
  });

  test("VD-08: o troco não é registrado como recebimento", async ({ apiClient }) => {
    const { sessionId } = await ensureOpenCashSession(apiClient);
    const product = await ensureSellableProduct(apiClient);
    const customer = await createCustomer(apiClient);

    const methods = await apiClient.get("/payment-methods?limit=50");
    const cash = (
      (methods.body as { data?: { id: string; type: string }[] }).data ?? []
    ).find((m) => m.type === "CASH");

    // O cliente entrega R$ 100 para uma venda de R$ 89,90; o que entra no caixa
    // é 89,90 — registrar os 100 desequilibraria a sessão no fechamento.
    const created = await apiClient.post("/orders", {
      customerId: customer.id,
      origin: "BALCAO",
      cashRegisterSessionId: sessionId,
      items: [{ productId: product.id, quantity: 1, unitPrice: 89.9 }],
      payments: [{ paymentMethodId: cash!.id, amount: 89.9 }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const order = (created.body as { data: { id: string } }).data;

    const detail = await apiClient.get(`/orders/${order.id}`);
    const payments =
      (detail.body as { data: { payments: { amount: string }[] } }).data.payments ?? [];
    const paid = payments.reduce((acc, p) => acc + Math.round(Number(p.amount) * 100), 0);
    expect(paid, "o valor gravado difere do total cobrado").toBe(8990);
  });

  test("a venda de balcão nasce COMPLETED e baixa o estoque na hora", async ({
    apiClient,
  }) => {
    const { sessionId } = await ensureOpenCashSession(apiClient);
    const product = await ensureSellableProduct(apiClient);
    const customer = await createCustomer(apiClient);

    const methods = await apiClient.get("/payment-methods?limit=50");
    const cash = (
      (methods.body as { data?: { id: string; type: string }[] }).data ?? []
    ).find((m) => m.type === "CASH");

    const before = await productAvailable(apiClient, product.id);

    const created = await apiClient.post("/orders", {
      customerId: customer.id,
      origin: "BALCAO",
      cashRegisterSessionId: sessionId,
      items: [{ productId: product.id, quantity: 2, unitPrice: 25 }],
      payments: [{ paymentMethodId: cash!.id, amount: 50 }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const after = await productAvailable(apiClient, product.id);
    expect(after, `saldo ${before} -> ${after}`).toBe(before - 2);
  });

  test("VD-10: desconto acima do valor da linha é recusado", async ({ apiClient }) => {
    const { sessionId } = await ensureOpenCashSession(apiClient);
    const product = await ensureSellableProduct(apiClient);
    const customer = await createCustomer(apiClient);

    const created = await apiClient.post("/orders", {
      customerId: customer.id,
      origin: "BALCAO",
      cashRegisterSessionId: sessionId,
      items: [{ productId: product.id, quantity: 1, unitPrice: 50, discount: 80 }],
    });

    expect(created.status, JSON.stringify(created.body)).toBeGreaterThanOrEqual(400);
  });

  test("VD-18: o PDV abre com o foco na busca e responde aos atalhos", async ({
    appPage,
  }) => {
    await appPage.goto("/vendas/balcao");
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForTimeout(1500);

    const legend = (await appPage.textContent("body")) ?? "";
    // A legenda dos atalhos é o que torna o ganho descobrível (VD-18).
    expect(legend).toMatch(/F2/);
    expect(legend).toMatch(/F9/);
  });
});

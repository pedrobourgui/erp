import {
  test,
  expect,
  ensureOpenCashSession,
  ensureSellableProduct,
  createCustomer,
  type ApiClient,
} from "./fixtures";

/**
 * VD-07 / FN-05: a venda de balcão exige caixa aberto.
 *
 * A regra vale na API, não só na tela: um botão desabilitado é uma cortesia
 * para quem usa a interface, e um `POST /orders` continua aberto para quem não
 * usa. Estes testes atacam os dois lados.
 *
 * A suíte inteira depende de haver caixa aberto (as jornadas de venda o
 * consomem), então cada teste devolve o ambiente ao estado em que o encontrou.
 */

const WIDE = { width: 1440, height: 950 };

/** Fecha todo caixa aberto e devolve o que foi fechado. */
async function fecharCaixas(client: ApiClient): Promise<string[]> {
  const abertos = await client.get("/cash-register-sessions?status=OPEN&limit=50");
  const sessoes =
    (abertos.body as { data?: { id: string; cashRegisterId: string }[] }).data ??
    [];

  for (const sessao of sessoes) {
    // O fechamento é pela rota do caixa, não da sessão.
    const fechou = await client.post(
      `/cash-registers/${sessao.cashRegisterId}/close`,
      { closingBalance: 0, notes: "e2e: bloqueio de venda sem caixa" }
    );
    expect(
      [200, 201],
      `fechamento do caixa: ${JSON.stringify(fechou.body)}`
    ).toContain(fechou.status);
  }

  return sessoes.map((s) => s.cashRegisterId);
}

/**
 * Monta uma venda de balcão válida em tudo menos no caixa.
 *
 * Usa os helpers das fixtures em vez de pegar "o primeiro produto ativo": as
 * jornadas da suíte consomem estoque, e o primeiro da lista chega sem saldo na
 * hora em que este teste roda. A venda seria recusada por falta de estoque e o
 * teste diria "bloqueado por falta de caixa" — verde pelo motivo errado, ou
 * vermelho sem relação com a regra.
 */
async function vendaDeBalcao(client: ApiClient) {
  const produto = await ensureSellableProduct(client);
  const cliente = await createCustomer(client);
  return {
    customerId: cliente.id,
    origin: "BALCAO",
    items: [
      { productId: produto.id, quantity: 1, unitPrice: 89.9, discount: 0 },
    ],
  };
}

test.describe("balcão sem caixa aberto", () => {
  test("a API recusa a venda de balcão e diz o porquê", async ({ apiClient }) => {
    // A venda é montada antes de fechar o caixa: criar produto e cliente
    // exige o ambiente no ar, e o que está sob teste é só a falta do caixa.
    const venda = await vendaDeBalcao(apiClient);
    await fecharCaixas(apiClient);

    try {
      const resposta = await apiClient.post("/orders", venda);

      // 409, não 500 nem 201: é um conflito de estado do negócio.
      expect(resposta.status).toBe(409);
      // E a mensagem diz o que fazer, não só que deu errado.
      expect(JSON.stringify(resposta.body)).toMatch(/caixa aberto/i);
      expect(JSON.stringify(resposta.body)).toMatch(/Abra o caixa/i);
    } finally {
      await ensureOpenCashSession(apiClient);
    }
  });

  test("a tela desabilita finalizar e explica o que falta", async ({
    appPage,
    apiClient,
  }) => {
    await fecharCaixas(apiClient);

    try {
      await appPage.setViewportSize(WIDE);
      await appPage.goto("/vendas/balcao");

      // O aviso é a parte que ensina: um botão cinza sem explicação faz o
      // operador achar que o sistema travou.
      await expect(appPage.getByText(/Nenhum caixa aberto/i)).toBeVisible();
      await expect(
        appPage.getByRole("button", { name: /Finalizar Venda/i })
      ).toBeDisabled();
    } finally {
      await ensureOpenCashSession(apiClient);
    }
  });

  test("com o caixa aberto, a mesma venda passa", async ({ appPage, apiClient }) => {
    // O contraponto do teste acima. Sem ele, um bloqueio permanente — ou um
    // erro por outro motivo qualquer — passaria por "regra implementada".
    //
    // A prova é a requisição, não o botão: "Finalizar Venda" também fica
    // desabilitado com o carrinho vazio, então a tela não isola a causa.
    await ensureOpenCashSession(apiClient);
    const venda = await vendaDeBalcao(apiClient);

    const resposta = await apiClient.post("/orders", venda);

    expect(
      resposta.status,
      `venda recusada com caixa aberto: ${JSON.stringify(resposta.body)}`
    ).toBe(201);

    // E a tela não mostra mais o aviso.
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/balcao");
    await expect(appPage.getByText(/Nenhum caixa aberto/i)).toBeHidden();
  });
});

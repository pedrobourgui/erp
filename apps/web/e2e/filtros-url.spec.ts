import { test, expect } from "./fixtures";

/**
 * A visão filtrada como endereço.
 *
 * Os filtros moravam em `useState`: um F5 perdia tudo, e a única forma de
 * passar "os pedidos concluídos" para um colega era descrever os cliques para
 * chegar lá. Cada teste aqui é uma dessas perdas, virada do avesso.
 */

const WIDE = { width: 1440, height: 900 };

/** Escolhe um valor num select do painel pelo rótulo do campo. */
async function escolher(
  page: import("@playwright/test").Page,
  campo: string,
  opcao: string
) {
  await page
    .getByTestId("filter-fields")
    .locator("> div")
    .filter({ hasText: campo })
    .locator("button[role=combobox]")
    .click();
  await page.getByRole("option", { name: opcao, exact: true }).click();
}

test.describe("filtros na URL", () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
  });

  test("escolher um filtro escreve o endereço", async ({ appPage }) => {
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();

    await escolher(appPage, "Status", "Concluído");

    await expect(appPage).toHaveURL(/status=COMPLETED/);
  });

  test("um link já filtrado abre filtrado", async ({ appPage }) => {
    // O caso que não existia: colar o endereço de um colega.
    await appPage.goto("/vendas/pedidos?status=COMPLETED");
    await appPage.getByTestId("filter-panel").waitFor();

    // O painel reflete o endereço...
    await expect(
      appPage
        .getByTestId("filter-fields")
        .locator("> div")
        .filter({ hasText: "Status" })
        .locator("button[role=combobox]")
    ).toContainText("Concluído");

    // ...e a tabela também. É a asserção que importa: o painel podia mostrar o
    // filtro certo e a query sair sem ele.
    const status = await appPage.locator("tbody tr td:nth-child(5)").allInnerTexts();
    expect(status.length).toBeGreaterThan(0);
    expect(status.every((s) => s.includes("Concluído"))).toBe(true);
  });

  test("recarregar a página preserva o filtro", async ({ appPage }) => {
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();
    await escolher(appPage, "Status", "Concluído");
    await expect(appPage).toHaveURL(/status=COMPLETED/);

    await appPage.reload();
    await appPage.getByTestId("filter-panel").waitFor();

    await expect(appPage).toHaveURL(/status=COMPLETED/);
    const status = await appPage.locator("tbody tr td:nth-child(5)").allInnerTexts();
    expect(status.every((s) => s.includes("Concluído"))).toBe(true);
  });

  test("voltar no navegador desfaz o último filtro", async ({ appPage }) => {
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();

    await escolher(appPage, "Status", "Concluído");
    await expect(appPage).toHaveURL(/status=COMPLETED/);

    await escolher(appPage, "Origem", "Balcão");
    await expect(appPage).toHaveURL(/origin=BALCAO/);

    await appPage.goBack();

    // Desfez a origem e manteve o status: uma entrada por filtro escolhido.
    await expect(appPage).toHaveURL(/status=COMPLETED/);
    await expect(appPage).not.toHaveURL(/origin=BALCAO/);
  });

  test("a busca não enche o histórico a cada tecla", async ({ appPage }) => {
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();
    await escolher(appPage, "Status", "Concluído");

    const busca = appPage.getByPlaceholder("Buscar por número ou cliente...");
    await busca.fill("PED");
    await expect(appPage).toHaveURL(/search=PED/);
    await busca.fill("PED-0");
    await expect(appPage).toHaveURL(/search=PED-0/);

    // Um único "voltar" tem de sair da busca inteira e cair no estado anterior
    // — e não desfazer uma letra de cada vez.
    await appPage.goBack();

    await expect(appPage).not.toHaveURL(/search=/);
    await expect(appPage).toHaveURL(/status=COMPLETED/);
  });

  test("limpar filtros esvazia o endereço", async ({ appPage }) => {
    await appPage.goto("/vendas/pedidos?status=COMPLETED&origin=BALCAO");
    await appPage.getByTestId("filter-panel").waitFor();

    await appPage.getByRole("button", { name: /Limpar filtros/ }).click();

    await expect(appPage).not.toHaveURL(/status=/);
    await expect(appPage).not.toHaveURL(/origin=/);
  });

  test("a busca das telas com tabela própria também vai para o endereço", async ({
    appPage,
  }) => {
    // Contas monta a própria tabela e guardava a busca noutro lugar; era a
    // única que ficaria de fora do link.
    await appPage.goto("/financeiro/contas");
    await appPage.getByTestId("filter-panel").waitFor();

    await appPage.getByPlaceholder("Buscar por nome ou banco...").fill("Caixa");

    await expect(appPage).toHaveURL(/search=Caixa/);
  });
});

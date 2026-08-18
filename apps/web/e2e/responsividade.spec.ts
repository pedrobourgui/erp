import { test, expect } from "./fixtures";

/**
 * Jornada: o sistema em 390×844.
 *
 * Cobre AE-07/FN-10/VD-15 (mobile inutilizável), AE-20 (nome longo derrubava a
 * tabela) e FN-18 (404 cru em inglês).
 *
 * O critério é o mesmo que o QA mediu: `scrollWidth === clientWidth` no body.
 * Conteúdo largo tem de rolar **dentro do próprio container**, nunca esticando
 * a página.
 */
const MOBILE = { width: 390, height: 844 };

const ROUTES = [
  "/",
  "/clientes",
  "/estoque/produtos",
  "/estoque/movimentacoes",
  "/estoque/depositos",
  "/estoque/alertas",
  "/vendas/pedidos",
  "/vendas/balcao",
  "/financeiro/lancamentos",
  "/financeiro/contas",
  "/financeiro/caixa",
  "/configuracoes",
];

test.describe("responsividade", () => {
  test("AE-07: a sidebar vira drawer abaixo de lg", async ({ appPage }) => {
    await appPage.setViewportSize(MOBILE);
    await appPage.goto("/");
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForTimeout(1200);

    const menuButton = appPage.getByRole("button", { name: "Abrir menu" });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await appPage.waitForTimeout(600);
    await expect(appPage.locator("aside").first()).toBeVisible();

    await appPage.keyboard.press("Escape");
    await appPage.waitForTimeout(600);
  });

  for (const route of ROUTES) {
    test(`AE-07: ${route} não estoura a largura em 390px`, async ({ appPage }) => {
      await appPage.setViewportSize(MOBILE);
      await appPage.goto(route);
      await appPage.waitForLoadState("networkidle");
      await appPage.waitForTimeout(1200);

      const overflow = await appPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      // Um filho flex sem `min-w-0` mantém a largura intrínseca e o conteúdo
      // fica cortado **sem scroll** — inacessível, não apenas feio.
      expect(
        overflow.scrollWidth,
        `${route} rola horizontalmente: ${overflow.scrollWidth} > ${overflow.clientWidth}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }

  test("FN-18: uma rota inexistente mostra 404 em pt-BR", async ({ appPage }) => {
    await appPage.goto("/rota-que-nao-existe-e2e");
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForTimeout(1000);

    const body = (await appPage.textContent("body")) ?? "";
    expect(body).toMatch(/não encontrada|não existe|404/i);
    // O texto cru do Next ("This page could not be found") era o que aparecia.
    expect(body).not.toMatch(/This page could not be found/i);
  });

  test("FN-18: os grupos do menu levam à primeira tela do grupo", async ({ appPage }) => {
    // `redirect()` do App Router resolve no cliente: esperar a URL mudar é a
    // asserção correta — um `waitForTimeout` fixo passa ou falha por sorte.
    const destinations: Record<string, RegExp> = {
      "/estoque": /\/estoque\/produtos/,
      "/vendas": /\/vendas\/pedidos/,
      "/financeiro": /\/financeiro\/lancamentos/,
    };

    for (const [group, destination] of Object.entries(destinations)) {
      await appPage.goto(group);
      await appPage.waitForURL(destination, { timeout: 20_000 });
      expect(appPage.url(), `${group} não redirecionou`).toMatch(destination);
    }
  });
});

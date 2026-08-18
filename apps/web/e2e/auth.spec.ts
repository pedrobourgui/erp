import { test, expect, api, login, CREDENTIALS } from "./fixtures";

/**
 * Jornada: entrar, sair e alcançar apenas o que o papel permite.
 *
 * Cobre AE-03 (login sem mensagem), AE-17 (`/login` acessível logado),
 * AE-27/FN-09 (menu e rotas abertos) e AE-28 (403 desenhado como lista vazia).
 */
test.describe("auth", () => {
  test("AE-03: login inválido mostra o motivo na tela", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/e-?mail|seu@email/i).first().fill("admin@admin.com");
    await page.locator('input[type="password"]').fill("senha-errada");
    await page.getByRole("button", { name: /entrar/i }).click();

    // O bug era o silêncio: o formulário não dizia nada e o usuário tentava de novo.
    await expect(page.getByText(/credenciais|inválid|incorret/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("login válido leva ao dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/e-?mail|seu@email/i).first().fill(CREDENTIALS.owner.email);
    await page.locator('input[type="password"]').fill(CREDENTIALS.owner.password);
    await page.getByRole("button", { name: /entrar/i }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /dashboard|visão geral/i }).first())
      .toBeVisible({ timeout: 15_000 });
  });

  test("AE-17: /login autenticado redireciona para o início", async ({ appPage }) => {
    await appPage.goto("/login");

    await appPage.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });
    expect(appPage.url()).not.toContain("/login");
  });

  test("logout limpa a sessão e volta ao login", async ({ appPage }) => {
    await appPage.goto("/");
    await appPage.waitForLoadState("networkidle");

    await appPage.getByRole("button", { name: /administrador|perfil|conta/i }).first().click();
    await appPage.getByText(/^Sair$/).click();

    await appPage.waitForURL(/\/login/, { timeout: 20_000 });
    const token = await appPage.evaluate(() => localStorage.getItem("erp_token"));
    expect(token, "o token continuou no localStorage depois do logout").toBeNull();
  });

  test("AE-27/AE-28: o vendedor não alcança o financeiro nem vê lista vazia no lugar do 403", async ({
    signInAs,
  }) => {
    const { page } = await signInAs("seller");

    await page.goto("/financeiro/contas");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const body = (await page.textContent("body")) ?? "";
    // AE-28: o 403 virava "Nenhuma conta cadastrada" com seis contas no banco.
    expect(body).toMatch(/acesso negado|não tem permissão/i);
    expect(body).not.toMatch(/Nenhuma conta (financeira )?cadastrada/i);
  });

  test("AE-27: o menu do vendedor não oferece Financeiro nem Configurações", async ({
    signInAs,
  }) => {
    const { page } = await signInAs("seller");

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const sidebar = page.locator("aside").first();
    const menu = (await sidebar.textContent()) ?? "";
    expect(menu).toContain("Vendas");
    expect(menu).not.toContain("Financeiro");
    expect(menu).not.toContain("Configurações");
  });

  test("FN-09: os KPIs financeiros não viajam na resposta do vendedor", async ({ request }) => {
    // Esconder na tela mantém "A Pagar R$ 12.156,70" no corpo da resposta.
    const seller = await login(request, "seller");
    const sellerApi = api(request, seller.accessToken);

    const dashboard = await sellerApi.get("/reports/dashboard");
    expect(dashboard.status).toBe(200);
    expect(JSON.stringify(dashboard.body)).not.toMatch(/accountsPayable|totalPayable/i);
  });
});

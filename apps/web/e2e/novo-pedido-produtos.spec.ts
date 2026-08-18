import { test, expect } from "./fixtures";

/**
 * O seletor de produtos em Nova Venda.
 *
 * Era uma busca própria: nada aparecia antes de digitar, e o que aparecia era
 * uma tabela dentro do formulário empurrando o carrinho para baixo. O seletor
 * de cliente, na mesma tela, sempre abriu com os primeiros já listados — eram
 * dois comportamentos para o mesmo gesto. Agora é o mesmo componente.
 */

const WIDE = { width: 1440, height: 950 };

function abrirSeletor(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /Buscar produto/ });
}

/** As opções do dropdown aberto. */
function opcoes(page: import("@playwright/test").Page) {
  return page.locator("div.max-h-56 > button");
}

test.describe("nova venda: seletor de produtos", () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos/novo");
    await abrirSeletor(appPage).waitFor();
  });

  test("o pedido começa sem itens", async ({ appPage }) => {
    await expect(appPage.getByText("Nenhum item adicionado")).toBeVisible();
    // O formulário não abre com tabela de resultado nenhuma ocupando espaço.
    await expect(opcoes(appPage)).toHaveCount(0);
  });

  test("abrir o seletor já lista os produtos, sem digitar nada", async ({
    appPage,
  }) => {
    await abrirSeletor(appPage).click();

    await expect(opcoes(appPage).first()).toBeVisible();
    expect(await opcoes(appPage).count()).toBeGreaterThan(1);
  });

  test("cada opção mostra SKU, preço e saldo", async ({ appPage }) => {
    // O saldo é o que decide a escolha: sem ele, vender um item sem estoque só
    // é descoberto ao tentar salvar.
    await abrirSeletor(appPage).click();
    await expect(opcoes(appPage).first()).toBeVisible();

    const texto = await opcoes(appPage).first().innerText();
    expect(texto).toMatch(/R\$/);
    expect(texto).toMatch(/un\.|sem estoque/);
  });

  test("digitar filtra a lista", async ({ appPage, apiClient }) => {
    const { body } = await apiClient.get("/products?limit=1&status=ACTIVE");
    const alvo = ((body as { data?: { name: string }[] }).data ?? [])[0].name;

    await abrirSeletor(appPage).click();
    await expect(opcoes(appPage).first()).toBeVisible();

    await appPage.getByPlaceholder("Buscar...").fill(alvo.slice(0, 12));

    await expect(opcoes(appPage).first()).toContainText(alvo.slice(0, 12));
  });

  test("uma busca sem resultado diz que não achou", async ({ appPage }) => {
    await abrirSeletor(appPage).click();
    await appPage.getByPlaceholder("Buscar...").fill("zzz-nao-existe-zzz");

    await expect(appPage.getByText("Nenhum produto encontrado")).toBeVisible();
  });

  test("escolher um produto soma um item ao pedido", async ({ appPage }) => {
    // O que prova a funcionalidade não é a opção aparecer: é o item entrar no
    // carrinho e o resumo somar.
    await abrirSeletor(appPage).click();
    await expect(opcoes(appPage).first()).toBeVisible();

    await opcoes(appPage).first().click();

    await expect(appPage.getByText("Nenhum item adicionado")).toBeHidden();
    // "1 item", não "1 itens": a contagem passa por `pluralize` (AE-21).
    await expect(appPage.getByText(/Subtotal \(1 item\)/)).toBeVisible();

    // E o campo volta ao estado inicial, pronto para o próximo item — escolher
    // aqui é uma ação, não um valor guardado.
    await expect(abrirSeletor(appPage)).toBeVisible();
  });

  test("AE-31: um nome longo não transforma a opção num parágrafo", async ({
    appPage,
  }) => {
    // O rótulo vem do banco e vai a 255 caracteres. Sem `min-w-0` e `truncate`,
    // um nome sem espaços quebrava em seis linhas dentro do dropdown.
    await abrirSeletor(appPage).click();
    await expect(opcoes(appPage).first()).toBeVisible();

    const alturas = await opcoes(appPage).evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().height))
    );
    const maior = Math.max(...alturas);
    const menor = Math.min(...alturas);

    // Todas as opções com a mesma altura: nenhuma cresceu por causa do texto.
    expect(maior).toBe(menor);
    expect(maior).toBeLessThan(80);

    // E o texto cortado continua alcançável.
    await expect(
      opcoes(appPage).first().locator("span[title]").first()
    ).toHaveAttribute("title", /.+/);
  });
});

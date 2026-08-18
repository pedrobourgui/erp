import { test, expect, stamp, makeCpf, type ApiClient } from "./fixtures";

/**
 * Jornada: texto do tamanho que o schema permite.
 *
 * AE-31: um nome de produto de 255 caracteres — o limite da própria coluna —
 * saía da coluna dele e era pintado **por cima** dos campos SKU e Tipo ao lado,
 * e o título da página ia embora da viewport. Não era um defeito estético: dois
 * campos ficavam ilegíveis por causa de um terceiro.
 *
 * A regra que este arquivo protege: todo texto vindo do banco corta com
 * reticências e devolve o conteúdo inteiro por tooltip. Um texto cortado **sem**
 * como ler o resto é a mesma perda de dado que a sobreposição.
 */

/**
 * Sem espaços de propósito. Texto com espaços quebra linha sozinho e nunca
 * estoura nada — o caso que derrubou a tela era uma palavra só de 255
 * caracteres, e é o que um SKU, um código de barras, uma URL ou um e-mail
 * produzem naturalmente.
 */
const LONG_NAME = `E2E-${"NomeDeProdutoSemEspacosQueNaoQuebraLinha-".repeat(8)}`.slice(0, 255);

/** Um produto com nome no limite do schema, criado para esta execução. */
async function createLongNamedProduct(client: ApiClient) {
  const suffix = stamp();
  const created = await client.post("/products", {
    name: LONG_NAME,
    sku: `E2E-LONGO-${suffix}`,
    status: "ACTIVE",
    costPrice: 10,
    salePrice: 20,
  });
  expect(created.status, `produto longo: ${JSON.stringify(created.body)}`).toBe(201);
  return (created.body as { data: { id: string; name: string } }).data;
}

/**
 * Todo elemento de texto visível que está cortado e não oferece o texto inteiro,
 * ou que é pintado para fora da caixa do pai.
 *
 * O mesmo critério do detector que varreu o sistema: `scrollWidth` maior que
 * `clientWidth` é o que o QA consegue medir; `textOverflow` e o tooltip são o
 * que separa "encurtado" de "perdido".
 */
async function textoPerdido(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const problemas: string[] = [];
    const temTooltip = (el: Element) => {
      let n: Element | null = el;
      for (let i = 0; i < 4 && n; i += 1) {
        if (n.getAttribute("data-truncated") === "true") return true;
        if (n.getAttribute("title")) return true;
        n = n.parentElement;
      }
      return false;
    };

    for (const el of Array.from(document.querySelectorAll("main *"))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (el.className?.toString().includes("sr-only")) continue;
      if (el.children.length > 0 || !el.textContent?.trim()) continue;
      const desc = `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`;

      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        const cortado = cs.overflowX === "hidden" || cs.overflowX === "clip";
        if (!cortado) {
          // Sem recorte, o texto é **desenhado fora da própria caixa** — foi
          // assim que o campo Nome apareceu por cima de SKU e Tipo. A caixa do
          // elemento continua do tamanho da coluna, então comparar retângulos
          // não acusa nada: quem denuncia é o scrollWidth.
          problemas.push(`texto pintado fora da caixa: ${desc}`);
        } else if (cs.textOverflow !== "ellipsis") {
          problemas.push(`cortado sem reticências: ${desc}`);
        } else if (!temTooltip(el)) {
          problemas.push(`cortado sem tooltip: ${desc}`);
        }
      }
    }
    return problemas;
  });
}

test.describe("texto longo", () => {
  test("AE-31: o nome de 255 caracteres não invade os campos vizinhos", async ({
    appPage,
    apiClient,
  }) => {
    const product = await createLongNamedProduct(apiClient);

    await appPage.goto(`/estoque/produtos/${product.id}`);
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForSelector("text=Informações gerais");

    expect(await textoPerdido(appPage)).toEqual([]);
  });

  test("AE-31: o texto cortado devolve o conteúdo inteiro no tooltip", async ({
    appPage,
    apiClient,
  }) => {
    const product = await createLongNamedProduct(apiClient);

    await appPage.goto(`/estoque/produtos/${product.id}`);
    await appPage.waitForLoadState("networkidle");

    const titulo = appPage.locator('h1[data-truncated="true"]');
    await expect(titulo).toBeVisible();

    await titulo.hover();
    // O tooltip carrega o nome inteiro, não o pedaço que coube na tela.
    await expect(appPage.getByRole("tooltip")).toContainText(LONG_NAME.slice(0, 120));
  });

  test("AE-31: em 390px o nome longo também não estoura a página", async ({
    appPage,
    apiClient,
  }) => {
    const product = await createLongNamedProduct(apiClient);
    await appPage.setViewportSize({ width: 390, height: 844 });

    await appPage.goto(`/estoque/produtos/${product.id}`);
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForSelector("text=Informações gerais");

    expect(await textoPerdido(appPage)).toEqual([]);
    const overflow = await appPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("AE-31: a listagem com nome longo mantém as demais colunas legíveis", async ({
    appPage,
    apiClient,
  }) => {
    await createLongNamedProduct(apiClient);

    await appPage.goto("/estoque/produtos");
    await appPage.waitForLoadState("networkidle");
    await appPage.waitForSelector("table");

    expect(await textoPerdido(appPage)).toEqual([]);
  });

  test("AE-31: um cliente de nome longo não quebra o próprio detalhe", async ({
    appPage,
    apiClient,
  }) => {
    const suffix = stamp();
    const created = await apiClient.post("/customers", {
      name: `E2E-${"RazaoSocialCompridaSemEspacos-".repeat(9)}`.slice(0, 255),
      documentType: "CPF",
      document: makeCpf(),
      email: `e2e.longo.${suffix}@exemplo.com.br`,
      phone: "(11) 98888-7777",
    });
    expect(created.status).toBe(201);
    const customer = (created.body as { data: { id: string } }).data;

    await appPage.goto(`/clientes/${customer.id}`);
    await appPage.waitForLoadState("networkidle");

    expect(await textoPerdido(appPage)).toEqual([]);
  });
});

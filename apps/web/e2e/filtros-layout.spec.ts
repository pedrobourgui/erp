import { test, expect } from "./fixtures";

/**
 * O painel de filtros é injetado pelo `DataTable` dentro de uma linha
 * `flex flex-wrap`. Sem `basis-full` ele nasce como flex item e encolhe até o
 * conteúdo: 609px de 1440 em Produtos, 164px por select em Pedidos e 215px numa
 * tela de 390 — mais estreito no celular do que no desktop.
 *
 * Nada disso aparece num teste de unidade: o jsdom não calcula layout. Só a
 * medição no navegador reprova a regressão, e ela voltou uma vez ao trocar o
 * `className` do formulário por outra prop.
 */

/** Sobra espaço: o painel fica na tela e o botão não existe. */
const WIDE = { width: 1440, height: 900 };
/**
 * Espaço apertado: 1040px com a sidebar aberta deixa 712px de conteúdo, abaixo
 * do limiar de 720. Repare que é mais estreito do que os 952px que sobram em
 * 1000px, onde a sidebar já se recolheu sozinha — o que decide é o espaço, não
 * o viewport.
 */
const TIGHT = { width: 1040, height: 800 };

test.describe("layout do painel de filtros", () => {
  test("o painel ocupa a linha inteira em vez de encolher", async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);

    for (const url of ["/estoque/produtos", "/vendas/pedidos"]) {
      await appPage.goto(url);

      const panel = appPage.getByTestId("filter-panel");
      await panel.waitFor();
      const box = (await panel.boundingBox())!;

      // A largura útil da página descontando a sidebar e o respiro lateral. O
      // número exato varia com o tema; o que não pode voltar é o painel valer
      // menos da metade dela.
      expect(box.width, `painel estreito em ${url}`).toBeGreaterThan(900);
    }
  });

  test("havendo espaço, o painel já vem aberto e sem botão", async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");

    // Sem clicar em nada.
    await expect(appPage.getByTestId("filter-panel")).toBeVisible();
    await expect(appPage.getByRole("button", { name: /^Filtros/ })).toBeHidden();
  });

  test("faltando espaço, o botão volta e o painel começa fechado", async ({ appPage }) => {
    await appPage.setViewportSize(TIGHT);
    await appPage.goto("/vendas/pedidos");

    const panel = appPage.getByTestId("filter-panel");
    await expect(panel).toBeHidden();

    const trigger = appPage.getByRole("button", { name: /^Filtros/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(panel).toBeVisible();
  });

  /**
   * A razão de a régua ser uma container query e não um breakpoint.
   *
   * Recolher a sidebar devolve ~190px de conteúdo sem alterar um pixel do
   * viewport. Medindo a janela, o painel continuaria escondido num espaço em
   * que ele agora cabe — e o usuário teria acabado de abrir espaço para nada.
   */
  test("recolher a sidebar abre espaço e traz o painel de volta, no mesmo viewport", async ({
    appPage,
  }) => {
    await appPage.setViewportSize(TIGHT);
    await appPage.goto("/vendas/pedidos");

    const panel = appPage.getByTestId("filter-panel");
    const scope = appPage.locator(".filters-scope");
    await expect(panel).toBeHidden();

    const antes = (await scope.boundingBox())!.width;

    await appPage.getByRole("button", { name: "Recolher menu" }).click();

    await expect(panel).toBeVisible();
    await expect(appPage.getByRole("button", { name: /^Filtros/ })).toBeHidden();

    const depois = (await scope.boundingBox())!.width;
    expect(depois).toBeGreaterThan(antes);
    expect(depois).toBeGreaterThanOrEqual(720);
  });

  test("a busca fica na última célula do painel", async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");
    const panel = appPage.getByTestId("filter-panel");
    await panel.waitFor();

    const cells = appPage.getByTestId("filter-fields").locator("> div");
    await expect(cells.last()).toContainText("Buscar");
    await expect(
      cells.last().getByPlaceholder("Buscar por número ou cliente...")
    ).toBeVisible();

    // E a barra de busca antiga saiu da toolbar — não existem duas.
    await expect(
      appPage.getByPlaceholder("Buscar por número ou cliente...")
    ).toHaveCount(1);
  });

  test("buscar pelo painel reduz a lista de verdade", async ({ appPage, apiClient }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();

    const { body } = await apiClient.get("/orders?page=1&limit=1");
    const alvo = ((body as { data?: { orderNumber: string }[] }).data ?? [])[0]
      .orderNumber;

    await appPage.getByPlaceholder("Buscar por número ou cliente...").fill(alvo);

    // A busca é debounced em 300ms; o que prova que ela chegou à API é a
    // tabela responder, não o campo aceitar o texto.
    await expect(appPage.getByRole("cell", { name: `#${alvo}` })).toBeVisible();
    await expect(appPage.locator("tbody tr")).toHaveCount(1);
  });

  test("o campo de data ocupa só o que precisa, não a coluna inteira", async ({
    appPage,
  }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");
    const panel = appPage.getByTestId("filter-panel");
    await panel.waitFor();

    const data = (await panel.locator('input[type="date"]').first().boundingBox())!;
    const enumSelect = (await panel.locator('button[role="combobox"]').first().boundingBox())!;

    // "dd/mm/yyyy" mais o ícone do calendário, e nada além disso: esticado até
    // a coluna, um filtro de data pesava tanto quanto o de cliente.
    expect(data.width).toBeLessThan(enumSelect.width);

    // Mas continua um alvo de toque confortável — encolher não é sumir.
    expect(data.width).toBeGreaterThan(120);
  });

  /**
   * Um intervalo é um filtro só.
   *
   * Separados, os dois campos ocupavam uma célula do grid cada e preenchiam
   * 156px dela — sobrava um vão depois de cada um, e a segunda linha do painel
   * não alinhava com nada da primeira.
   */
  test("as duas datas formam um único campo Período", async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");
    const panel = appPage.getByTestId("filter-panel");
    await panel.waitFor();

    const celulas = appPage.getByTestId("filter-fields").locator("> div");
    const periodo = celulas.filter({ hasText: "Período" });

    await expect(periodo).toHaveCount(1);
    await expect(periodo.locator('input[type="date"]')).toHaveCount(2);
    await expect(periodo).toContainText("até");

    // "Data Início"/"Data Fim" e "De"/"Até" eram quatro nomes para dois
    // conceitos entre Pedidos e Movimentações.
    await expect(celulas.filter({ hasText: "Data Início" })).toHaveCount(0);

    // As duas datas encostadas uma na outra, e não a uma coluna de distância.
    const [ini, fim] = await periodo.locator('input[type="date"]').all();
    const a = (await ini.boundingBox())!;
    const b = (await fim.boundingBox())!;
    expect(b.x - (a.x + a.width)).toBeLessThan(60);
  });

  test("cada filtro recebe a largura que o seu tipo pede", async ({ appPage }) => {
    await appPage.setViewportSize(WIDE);
    await appPage.goto("/vendas/pedidos");
    await appPage.getByTestId("filter-panel").waitFor();

    const widthOf = async (label: string) => {
      const field = appPage
        .getByTestId("filter-panel")
        .locator("div", { has: appPage.getByText(label, { exact: true }) })
        .last();
      return (await field.boundingBox())!.width;
    };

    const status = await widthOf("Status");
    const cliente = await widthOf("Cliente");

    // Um enum cabe em uma coluna; a busca sobre a base de clientes pede duas.
    // Era exatamente o campo mais sufocado pela divisão em partes iguais.
    expect(status).toBeGreaterThan(180);
    expect(cliente).toBeGreaterThan(status * 1.5);
  });

  test("no mobile os filtros abrem numa folha ancorada no rodapé", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await appPage.goto("/vendas/pedidos");

    await appPage.getByRole("button", { name: /Filtros/ }).click();
    const sheet = appPage.getByTestId("filter-sheet");
    await sheet.waitFor();

    // Empilhado, o painel empurrava a tabela para fora da tela. A folha entra
    // deslizando: medir no primeiro frame pega a animação, não o repouso.
    await expect
      .poll(async () => {
        const b = (await sheet.boundingBox())!;
        return Math.round(b.y + b.height);
      })
      .toBe(844);

    const box = (await sheet.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.height).toBeLessThanOrEqual(844 * 0.8);

    // O painel de desktop não pode aparecer junto — seriam dois conjuntos do
    // mesmo filtro montados ao mesmo tempo.
    await expect(appPage.getByTestId("filter-panel")).toBeHidden();

    await appPage.getByRole("button", { name: "Ver resultados" }).click();
    await expect(sheet).toBeHidden();
  });

  test("filtrar pelo celular reduz a lista de verdade", async ({ appPage }) => {
    await appPage.setViewportSize({ width: 390, height: 844 });
    await appPage.goto("/vendas/pedidos");

    await appPage.getByRole("button", { name: /Filtros/ }).click();
    await appPage.getByTestId("filter-sheet").waitFor();

    // Pelo rótulo, não pela posição: `getByRole("combobox").first()` apontava
    // para Status por acidente de ordem, e passou a apontar para Cliente no dia
    // em que os campos largos foram para a frente do painel. O teste falhou por
    // ter sido escrito contra o arranjo, não contra o comportamento.
    await appPage
      .getByTestId("filter-fields")
      .locator("> div")
      .filter({ hasText: "Status" })
      .locator("button[role=combobox]")
      .click();
    await appPage.getByRole("option", { name: "Concluído", exact: true }).click();

    // Escolher o filtro é uma navegação: fechar a folha antes de ela assentar é
    // uma corrida que passa numa máquina rápida e falha na outra.
    await expect(appPage).toHaveURL(/status=COMPLETED/);

    await appPage.getByRole("button", { name: "Ver resultados" }).click();
    await expect(appPage.getByTestId("filter-sheet")).toBeHidden();

    // O contador no botão é a prova de que o filtro chegou ao estado, e não
    // apenas de que a folha fechou.
    await expect(appPage.getByTestId("active-filter-count")).toHaveText("1");
  });
});

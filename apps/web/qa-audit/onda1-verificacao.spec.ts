import { test, expect, authenticate, captureNoise, visit } from "./qa-fixtures";

/**
 * Verificação da onda 1 do plano de execução: as quatro correções em primitivos.
 * Ao contrário dos specs de auditoria, este **reprova** — é o começo da onda 8.
 */

const LISTAS = [
  { rota: "/estoque/produtos", nome: "Produtos" },
  { rota: "/estoque/categorias", nome: "Categorias" },
  { rota: "/estoque/marcas", nome: "Marcas" },
  { rota: "/clientes", nome: "Clientes" },
  { rota: "/estoque/movimentacoes", nome: "Movimentações" },
  // Escapou da primeira lista, e era a única tela que ainda reprovava: os
  // botões de linha daqui não usam `Tooltip`, então a correção no primitivo
  // não os alcançava — precisou de rótulo no próprio chamador.
  { rota: "/financeiro/contas", nome: "Contas" },
];

test.describe("DS-01: botões só-ícone têm nome acessível", () => {
  for (const { rota, nome } of LISTAS) {
    test(`${nome} — nenhum botão sem nome na tabela`, async ({ page }) => {
      const noise = captureNoise(page);
      await authenticate(page);
      await visit(page, rota, 3000);

      const semNome = await page.evaluate(() => {
        const dentroDaTabela = Array.from(
          document.querySelectorAll("table button, table a[href]")
        );
        return dentroDaTabela.filter((el) => {
          const texto = (el.textContent || "").trim();
          const rotulo =
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            el.querySelector(".sr-only")?.textContent ||
            "";
          return !texto && !rotulo.trim();
        }).length;
      });

      expect(semNome, `${nome}: controles sem nome acessível`).toBe(0);
      expect(noise.pageerror).toEqual([]);
    });
  }

  test("Produtos — o botão de editar é alcançável por nome", async ({ page }) => {
    await authenticate(page);
    await visit(page, "/estoque/produtos", 3000);

    const editar = page.getByRole("button", { name: /editar/i });
    expect(await editar.count()).toBeGreaterThan(0);
  });
});

test.describe("DS-03: diálogos cabem na tela", () => {
  test("o diálogo de nova conta cabe em 390×667", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await authenticate(page);
    await visit(page, "/financeiro/contas", 3000);

    await page.getByRole("button", { name: /nova conta/i }).first().click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();

    const caixa = await dialogo.boundingBox();
    expect(caixa, "o diálogo precisa estar renderizado").not.toBeNull();
    expect(
      Math.round((caixa?.y ?? 0) + (caixa?.height ?? 0)),
      "o rodapé do diálogo não pode passar da viewport"
    ).toBeLessThanOrEqual(667);
  });

  test("todo diálogo é modal e nomeado", async ({ page }) => {
    await authenticate(page);
    await visit(page, "/estoque/marcas", 3000);

    await page.getByRole("button", { name: /nova marca/i }).first().click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(await dialogo.getAttribute("aria-labelledby")).toBeTruthy();
  });

  test("o foco volta para o botão que abriu o diálogo", async ({ page }) => {
    await authenticate(page);
    await visit(page, "/estoque/marcas", 3000);

    const abrir = page.getByRole("button", { name: /nova marca/i }).first();
    await abrir.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    const voltou = await page.evaluate(() => {
      const ativo = document.activeElement;
      return (
        !!ativo &&
        ativo !== document.body &&
        /nova marca/i.test(ativo.textContent || "")
      );
    });
    expect(voltou, "o foco deve voltar ao gatilho, não ao <body>").toBe(true);
  });
});

test.describe("DS-04: contraste do texto secundário", () => {
  test("--muted-foreground passa em AA sobre o fundo", async ({ page }) => {
    await authenticate(page);
    await visit(page, "/estoque/produtos", 3000);

    const razao = await page.evaluate(() => {
      const canal = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = (cor: string) => {
        const m = (cor.match(/[\d.]+/g) || []).map(Number);
        return 0.2126 * canal(m[0]) + 0.7152 * canal(m[1]) + 0.0722 * canal(m[2]);
      };
      const raiz = getComputedStyle(document.documentElement);
      const sonda = document.createElement("span");
      sonda.style.color = `hsl(${raiz.getPropertyValue("--muted-foreground")})`;
      sonda.style.backgroundColor = `hsl(${raiz.getPropertyValue("--background")})`;
      document.body.appendChild(sonda);
      const cs = getComputedStyle(sonda);
      const l1 = lum(cs.color);
      const l2 = lum(cs.backgroundColor);
      sonda.remove();
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    });

    expect(razao, "texto secundário precisa de 4,5:1").toBeGreaterThanOrEqual(4.5);
  });
});

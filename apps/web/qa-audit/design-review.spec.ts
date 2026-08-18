import fs from "node:fs";
import path from "node:path";

import { test, expect, authenticate, visit } from "./qa-fixtures";
import type { Page } from "@playwright/test";

/**
 * Captura visual para o review de design (não é caça-bug).
 *
 * Gera PNGs em alta resolução (deviceScaleFactor: 2 vem do config) de todas as
 * telas principais em claro/escuro × 1440/390, mais um conjunto de estados
 * ricos: lista cheia, formulário longo, dialog aberto, toast visível, estado
 * vazio e estado de carregando.
 *
 * Somente observação — nenhum registro é criado ou alterado. O único submit
 * disparado é um submit inválido (formulário vazio), que só produz o toast de
 * validação do `useInvalidSubmit` e nunca chega à API.
 */

const OUT = path.resolve(__dirname, "artifacts/design");

function shotPath(name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  return path.join(OUT, `${name}.png`);
}

/** Rotas principais, na ordem em que o menu as apresenta. */
const ROUTES: { slug: string; path: string }[] = [
  { slug: "dashboard", path: "/" },
  { slug: "estoque-hub", path: "/estoque" },
  { slug: "estoque-produtos", path: "/estoque/produtos" },
  { slug: "estoque-produto-novo", path: "/estoque/produtos/novo" },
  { slug: "estoque-categorias", path: "/estoque/categorias" },
  { slug: "estoque-marcas", path: "/estoque/marcas" },
  { slug: "estoque-movimentacoes", path: "/estoque/movimentacoes" },
  { slug: "estoque-depositos", path: "/estoque/depositos" },
  { slug: "estoque-alertas", path: "/estoque/alertas" },
  { slug: "vendas-hub", path: "/vendas" },
  { slug: "vendas-pedidos", path: "/vendas/pedidos" },
  { slug: "vendas-pedido-novo", path: "/vendas/pedidos/novo" },
  { slug: "vendas-balcao", path: "/vendas/balcao" },
  { slug: "clientes", path: "/clientes" },
  { slug: "cliente-novo", path: "/clientes/novo" },
  { slug: "financeiro-hub", path: "/financeiro" },
  { slug: "financeiro-contas", path: "/financeiro/contas" },
  { slug: "financeiro-lancamentos", path: "/financeiro/lancamentos" },
  { slug: "financeiro-caixa", path: "/financeiro/caixa" },
  { slug: "configuracoes", path: "/configuracoes" },
  { slug: "configuracoes-perfil", path: "/configuracoes/perfil" },
  { slug: "configuracoes-condicoes", path: "/configuracoes/condicoes-pagamento" },
];

/** Subconjunto que também vale em 390 px — o resto repete o mesmo padrão. */
const MOBILE_ROUTES = new Set([
  "dashboard",
  "estoque-produtos",
  "estoque-produto-novo",
  "vendas-pedidos",
  "vendas-balcao",
  "clientes",
  "financeiro-lancamentos",
]);

async function settle(page: Page) {
  // Deixa as animações de entrada (slide-up + stagger até 0.4s) terminarem,
  // senão metade dos cards sai com opacity 0.
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function capture(page: Page, name: string, fullPage = true) {
  await settle(page);
  await page.screenshot({ path: shotPath(name), fullPage });
}

// ─── Varredura de rotas ─────────────────────────────────────────────────

for (const theme of ["light", "dark"] as const) {
  test(`sweep 1440 ${theme}`, async ({ page }) => {
    test.setTimeout(600_000);
    await authenticate(page, "owner", theme);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of ROUTES) {
      await visit(page, route.path, 2200);
      await capture(page, `1440-${theme}-${route.slug}`);
    }
    expect(true).toBe(true);
  });

  test(`sweep 390 ${theme}`, async ({ page }) => {
    test.setTimeout(600_000);
    await authenticate(page, "owner", theme);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ROUTES.filter((r) => MOBILE_ROUTES.has(r.slug))) {
      await visit(page, route.path, 2200);
      await capture(page, `390-${theme}-${route.slug}`);
    }

    // Menu mobile aberto — o tratamento da sidebar em telas pequenas.
    await visit(page, "/", 2000);
    const burger = page
      .locator("header button")
      .filter({ has: page.locator("svg") })
      .first();
    await burger.click().catch(() => undefined);
    await page.waitForTimeout(600);
    await page.screenshot({ path: shotPath(`390-${theme}-menu-aberto`), fullPage: false });

    expect(true).toBe(true);
  });
}

// ─── Login (fora do shell autenticado) ──────────────────────────────────

test("login claro e escuro", async ({ page }) => {
  test.setTimeout(180_000);
  for (const theme of ["light", "dark"] as const) {
    await page.context().addInitScript((t: string) => {
      try {
        localStorage.setItem("theme", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      } catch {
        /* noop */
      }
    }, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await capture(page, `1440-${theme}-login`, false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await capture(page, `390-${theme}-login`, false);
  }
  expect(true).toBe(true);
});

// ─── Estados ricos ──────────────────────────────────────────────────────

for (const theme of ["light", "dark"] as const) {
  test(`estados ricos ${theme}`, async ({ page }) => {
    test.setTimeout(600_000);
    await authenticate(page, "owner", theme);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Lista cheia com paginação no limite máximo.
    await visit(page, "/estoque/produtos", 2500);
    const limitTrigger = page.locator("[role=combobox]").last();
    if (await limitTrigger.count()) {
      await limitTrigger.click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: shotPath(`1440-${theme}-select-aberto`),
        fullPage: false,
      });
      await page.getByRole("option", { name: "100" }).click().catch(() => undefined);
      await page.waitForTimeout(1800);
    }
    await capture(page, `1440-${theme}-lista-cheia`);

    // 2. Estado vazio — busca que responde 200 com zero linhas.
    await visit(page, "/estoque/produtos", 2000);
    const search = page.getByPlaceholder(/buscar/i).first();
    if (await search.count()) {
      await search.fill("zzqqxx-nao-existe");
      await page.waitForTimeout(2200);
    }
    await capture(page, `1440-${theme}-estado-vazio`);

    // 3. Estado de carregando — o skeleton da lista, fotografado antes de a
    //    resposta chegar. Sem interceptar a rota: um `route` pendente deixava
    //    a navegação seguinte presa.
    await page.goto("/estoque/produtos", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: shotPath(`1440-${theme}-estado-carregando`),
      fullPage: false,
    });

    // 4. Dialog aberto (criação de categoria — aberto e fechado sem salvar).
    await visit(page, "/estoque/categorias", 2200);
    const novo = page.getByRole("button", { name: /nova|novo|adicionar/i }).first();
    if (await novo.count()) {
      await novo.click().catch(() => undefined);
      await page.waitForTimeout(700);
      await page.screenshot({
        path: shotPath(`1440-${theme}-dialog-aberto`),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // 5. Dialog de confirmação destrutiva (aberto, nunca confirmado).
    const excluir = page
      .locator("button[aria-label*='xclui'], button[title*='xclui']")
      .first();
    if (await excluir.count()) {
      await excluir.click().catch(() => undefined);
      await page.waitForTimeout(700);
      await page.screenshot({
        path: shotPath(`1440-${theme}-dialog-confirmacao`),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // 6. Toast — submit inválido de formulário vazio. Não chega à API.
    await visit(page, "/clientes/novo", 2200);
    const submit = page
      .getByRole("button", { name: /salvar|criar|cadastrar/i })
      .first();
    if (await submit.count()) {
      await submit.click().catch(() => undefined);
      await page.waitForTimeout(900);
      await page.screenshot({
        path: shotPath(`1440-${theme}-toast-e-erros-de-form`),
        fullPage: false,
      });
      await page.screenshot({
        path: shotPath(`1440-${theme}-form-longo-com-erros`),
        fullPage: true,
      });
    }

    // 7. Command palette.
    await visit(page, "/", 2000);
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(600);
    let palette = await page.locator("[role=dialog]").count();
    if (!palette) {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(600);
      palette = await page.locator("[role=dialog]").count();
    }
    if (palette) {
      await page.screenshot({
        path: shotPath(`1440-${theme}-command-palette`),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
    }

    // 8. Hover e foco numa linha de tabela + botão primário.
    await visit(page, "/vendas/pedidos", 2500);
    const firstRow = page.locator("tbody tr").first();
    if (await firstRow.count()) {
      await firstRow.hover().catch(() => undefined);
      await page.waitForTimeout(300);
    }
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.screenshot({
      path: shotPath(`1440-${theme}-hover-e-foco`),
      fullPage: false,
    });

    // 9. Detalhe de um pedido — a densidade de uma tela de leitura.
    const link = page.locator("tbody tr a[href^='/vendas/pedidos/']").first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      if (href) {
        await visit(page, href, 2500);
        await capture(page, `1440-${theme}-pedido-detalhe`);
      }
    }

    // 10. Detalhe de produto (abas).
    await visit(page, "/estoque/produtos", 2200);
    const prod = page.locator("tbody tr a[href^='/estoque/produtos/']").first();
    if (await prod.count()) {
      const href = await prod.getAttribute("href");
      if (href) {
        await visit(page, href, 2500);
        await capture(page, `1440-${theme}-produto-detalhe`);
      }
    }

    expect(true).toBe(true);
  });
}

// ─── Papel reduzido (vendedor) — o mesmo shell com menos itens ──────────

test("vendedor 1440 claro", async ({ page }) => {
  test.setTimeout(240_000);
  await authenticate(page, "seller", "light");
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, "/", 2500);
  await capture(page, "1440-light-dashboard-vendedor");
  await visit(page, "/financeiro/contas", 2500);
  await capture(page, "1440-light-acesso-negado-vendedor");
  expect(true).toBe(true);
});

/**
 * Auditoria UX/UI — módulo Vendas (prefixo VND).
 *
 * Telas: /vendas, /vendas/pedidos, /vendas/pedidos/novo,
 * /vendas/pedidos/[id] e /vendas/balcao.
 *
 * Este arquivo é observação medida: tudo que vira achado no relatório sai de
 * um número impresso aqui (measure(), getComputedStyle, corpo HTTP real) ou de
 * um screenshot em qa-audit/artifacts/vnd/.
 */
import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  API_URL,
  apiLogin,
  authenticate,
  captureNoise,
  expect,
  measure,
  probeTooltip,
  test,
  visit,
} from "./qa-fixtures";

// ─── Helpers locais ────────────────────────────────────────────────────

const ART = path.resolve(__dirname, "artifacts/vnd");
fs.mkdirSync(ART, { recursive: true });

const STAMP = `qa-vnd-${Date.now()}`;

async function shot(page: Page, name: string, fullPage = true) {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return `qa-audit/artifacts/vnd/${name}.png`;
}

function report(title: string, value: unknown) {
  // eslint-disable-next-line no-console
  console.log(`\n### ${title}\n${JSON.stringify(value, null, 1)}`);
}

let TOKEN = "";
async function token() {
  if (!TOKEN) {
    TOKEN = (await apiLogin("owner")).accessToken;
  }
  return TOKEN;
}

async function apiReq<T = unknown>(
  method: string,
  route: string,
  body?: unknown
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API_URL}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

/**
 * O dev server do Next compila a rota no primeiro acesso e a página fica num
 * spinner de página inteira. Espera o conteúdo real antes de medir.
 */
async function settle(page: Page, heading: RegExp) {
  await page
    .getByRole("heading", { name: heading })
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1500);
}

/** Texto de todos os toasts visíveis. */
async function toastTexts(page: Page): Promise<string[]> {
  return page
    .locator('div.fixed.bottom-4.right-4 p')
    .allInnerTexts()
    .catch(() => []);
}

/** Estilo computado de uma lista de elementos. */
async function styleOf(page: Page, selector: string, props: string[]) {
  return page.evaluate(
    ({ selector: sel, props: p }) =>
      Array.from(document.querySelectorAll(sel))
        .slice(0, 12)
        .map((el) => {
          const cs = getComputedStyle(el);
          const out: Record<string, string> = {
            text: (el.textContent || "").trim().slice(0, 40),
            classes: (el.className || "").toString().slice(0, 160),
          };
          for (const prop of p) {
            out[prop] = (cs as unknown as Record<string, string>)[prop];
          }
          return out;
        }),
    { selector, props }
  );
}

/** Palavras pt-BR sem acento visíveis na tela (FN-27). */
async function missingAccents(page: Page) {
  const suspects = [
    "Preco",
    "Metodo",
    "Condicao",
    "Autorizacao",
    "Balcao",
    "disponivel",
    "sera ",
    "podera",
    "regularizacao",
    "Ha itens",
    "nao ",
    "Observacoes",
    "Codigo",
    "Historico",
  ];
  const body = await page.locator("body").innerText();
  return suspects.filter((s) => body.includes(s));
}

/** Cliente e produto de massa (não cria nada; usa o que já existe). */
async function pickCustomer(page: Page) {
  await page
    .getByRole("button", { name: /Buscar cliente por nome ou documento/ })
    .click();
  const search = page.getByPlaceholder("Buscar...");
  await search.fill("e");
  await page.waitForTimeout(900);
  const option = page.locator("div.absolute.z-50 button").first();
  const name = await option.innerText();
  await option.click();
  return name.split("\n")[0];
}

async function addProduct(page: Page, query: string, sku: string) {
  await page.getByPlaceholder(/Buscar produto por nome/).fill(query);
  const row = page.locator("tr", { hasText: sku });
  await row.first().waitFor({ state: "visible", timeout: 15_000 });
  await row.getByRole("button", { name: "Adicionar" }).first().click();
  await page.waitForTimeout(400);
}

async function addCashPayment(page: Page) {
  await page.getByRole("button", { name: "Adicionar pagamento" }).click();
  await page.waitForTimeout(300);
  const trigger = page
    .locator('[role="combobox"]')
    .filter({ hasText: /Selecione/ })
    .first();
  await trigger.click();
  await page.getByRole("option", { name: /^Dinheiro · dinheiro$/ }).click();
  await page.waitForTimeout(400);
}

// ────────────────────────────────────────────────────────────────────────
// 1. /vendas → redirect e lista de pedidos (1440, claro)
// ────────────────────────────────────────────────────────────────────────

test("VND lista: /vendas redireciona, tokens, contraste e dinheiro", async ({
  page,
}) => {
  const noise = captureNoise(page);
  await authenticate(page);

  // FN-18: /vendas é só um redirect para a primeira tela do grupo. O redirect
  // é resolvido no cliente, então mede-se quanto tempo o usuário fica olhando
  // o shell vazio (VND-22) em vez de assumir que é instantâneo.
  const t0 = Date.now();
  await page.goto("/vendas", { waitUntil: "domcontentloaded" });
  let redirectMs = -1;
  try {
    await page.waitForURL("**/vendas/pedidos", { timeout: 30_000 });
    redirectMs = Date.now() - t0;
  } catch {
    report("lista — /vendas NÃO redirecionou em 30 s", {
      url: page.url(),
      screenshot: await shot(page, "23-vendas-sem-redirect"),
    });
  }
  report("lista — tempo até o redirect de /vendas (ms, dev server)", redirectMs);
  if (redirectMs < 0) {
    await visit(page, "/vendas/pedidos", 500);
  }
  await settle(page, /^Pedidos$/);
  expect(page.url()).toContain("/vendas/pedidos");

  const m = await measure(page);
  report("lista 1440 claro — measure", {
    horizontalOverflow: m.horizontalOverflow,
    docScrollWidth: m.docScrollWidth,
    docClientWidth: m.docClientWidth,
    clippedNoScroll: m.clippedNoScroll,
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
    inconsistentRadius: m.inconsistentRadius,
    missingFocusRing: m.missingFocusRing,
  });

  // Badges de status: classes e cor/fundo efetivos
  const badges = await styleOf(page, "td span.rounded-full", [
    "color",
    "backgroundColor",
    "borderColor",
    "borderRadius",
    "fontSize",
  ]);
  report("lista — badges de status", badges);

  // Coluna Total: alinhamento e nowrap (VD-13)
  const money = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    return rows.slice(0, 5).map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const cell = cells[5];
      if (!cell) {return null;}
      const cs = getComputedStyle(cell);
      return {
        text: (cell.textContent || "").trim(),
        textAlign: cs.textAlign,
        whiteSpace: cs.whiteSpace,
        fontVariantNumeric: cs.fontVariantNumeric,
      };
    });
  });
  report("lista — coluna Total", money);

  // Tooltip do botão só-ícone
  report(
    "lista — tooltip 'Ver detalhes'",
    await probeTooltip(page, "tbody tr button")
  );

  // Paginação
  const pager = await page
    .locator("text=/Mostrando|Página|de \\d+/")
    .allInnerTexts()
    .catch(() => []);
  report("lista — paginação", pager);

  report("lista — noise", noise);
  report("lista — screenshot", await shot(page, "01-lista-1440-claro"));
});

// ────────────────────────────────────────────────────────────────────────
// 2. Lista em dark mode
// ────────────────────────────────────────────────────────────────────────

test("VND lista: dark mode", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "owner", "dark");
  await visit(page, "/vendas/pedidos", 500);
  await settle(page, /^Pedidos$/);

  const m = await measure(page);
  report("lista dark — measure", {
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
    horizontalOverflow: m.horizontalOverflow,
  });
  report(
    "lista dark — badges",
    await styleOf(page, "td span.rounded-full", ["color", "backgroundColor"])
  );
  report("lista dark — noise", noise);
  report("lista dark — screenshot", await shot(page, "02-lista-dark"));
});

// ────────────────────────────────────────────────────────────────────────
// 3. Lista responsiva
// ────────────────────────────────────────────────────────────────────────

test("VND lista: responsivo 390 / 768", async ({ page }) => {
  await authenticate(page);
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, "/vendas/pedidos", 500);
    await settle(page, /^Pedidos$/);
    const m = await measure(page);
    report(`lista ${width} — measure`, {
      horizontalOverflow: m.horizontalOverflow,
      docScrollWidth: m.docScrollWidth,
      docClientWidth: m.docClientWidth,
      clippedNoScroll: m.clippedNoScroll,
      smallHitTargets: m.smallHitTargets,
    });
    report(
      `lista ${width} — screenshot`,
      await shot(page, `03-lista-${width}`)
    );
  }
});

// ────────────────────────────────────────────────────────────────────────
// 4. /vendas/pedidos/novo — layout, tokens, acentos, labels
// ────────────────────────────────────────────────────────────────────────

test("VND novo: layout, tokens, acentos e labels", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);

  const m = await measure(page);
  report("novo 1440 — measure", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
    inconsistentRadius: m.inconsistentRadius,
    missingFocusRing: m.missingFocusRing,
  });

  report("novo — acentos ausentes", await missingAccents(page));

  // Labels sem associação (sem htmlFor / sem input aninhado)
  const orphanLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("label"))
      .filter(
        (l) =>
          !l.getAttribute("for") &&
          !l.querySelector("input,textarea,select,button")
      )
      .map((l) => (l.textContent || "").trim())
  );
  report("novo — labels sem associação", orphanLabels);

  // Padding dos cards e gap do grid
  const cards = await styleOf(page, "[class*=rounded-xl][class*=border]", [
    "padding",
    "borderRadius",
    "borderColor",
    "gap",
  ]);
  report("novo — cards", cards.slice(0, 8));

  report("novo — noise", noise);
  report("novo — screenshot", await shot(page, "04-novo-1440-claro"));
});

// ────────────────────────────────────────────────────────────────────────
// 5. VD-07 — a falha da consulta de caixa vira "nenhum caixa aberto"?
// ────────────────────────────────────────────────────────────────────────

test("VND VD-07: /novo confunde 'zero caixas' com 'a requisição falhou'", async ({
  page,
}) => {
  await authenticate(page);
  // A consulta de sessões abertas falha (500). Nada mais é tocado.
  await page.route("**/cash-register-sessions**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "boom" }),
    })
  );

  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);

  const body = await page.locator("body").innerText();
  const saysNoRegister = body.includes("Nenhum caixa aberto");
  const saysCouldNotCheck = body.includes("Não foi possível consultar");
  const submit = page.getByRole("button", { name: /Criar Pedido/ });
  const submitDisabled = await submit.isDisabled();

  report("VD-07 /novo com a consulta de caixa quebrada", {
    saysNoRegister,
    saysCouldNotCheck,
    submitDisabled,
    trecho: body
      .split("\n")
      .filter((l) => /caixa/i.test(l))
      .slice(0, 4),
  });
  report("VD-07 /novo — screenshot", await shot(page, "05-novo-caixa-erro"));

  // O balcão é a implementação correta da mesma regra — comparativo.
  await visit(page, "/vendas/balcao", 500);
  await settle(page, /Venda no Balcao/);
  const balcao = await page.locator("body").innerText();
  report("VD-07 /balcao com a consulta de caixa quebrada", {
    saysNoRegister: balcao.includes("Nenhum caixa aberto"),
    saysCouldNotCheck: balcao.includes("Não foi possível consultar"),
    submitDisabled: await page
      .getByRole("button", { name: /Finalizar Venda/ })
      .isDisabled(),
  });
  report("VD-07 /balcao — screenshot", await shot(page, "05-balcao-caixa-erro"));
});

// ────────────────────────────────────────────────────────────────────────
// 6. Validação: submit vazio, cliente vazio, pedido sem itens
// ────────────────────────────────────────────────────────────────────────

test("VND novo: submit vazio mostra (ou não) os erros do zod", async ({
  page,
}) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);

  const submit = page.getByRole("button", { name: /Criar Pedido/ });
  report("novo vazio — submit habilitado?", !(await submit.isDisabled()));
  await submit.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(900);

  const errors = await page
    .locator(".text-destructive")
    .allInnerTexts()
    .catch(() => []);
  report("novo vazio — mensagens de erro renderizadas", errors);
  report("novo vazio — toasts", await toastTexts(page));
  report("novo vazio — noise", noise);
  report("novo vazio — screenshot", await shot(page, "06-novo-submit-vazio"));
});

// ────────────────────────────────────────────────────────────────────────
// 7. Carrinho: soma das linhas, dinheiro, quantidade acima do estoque
// ────────────────────────────────────────────────────────────────────────

test("VND novo: total x soma das linhas, nowrap do dinheiro e excesso de estoque", async ({
  page,
}) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);

  await pickCustomer(page);
  // R$ 89,90 — o valor exato do VD-13.
  await addProduct(page, "Capinha", "ACESS-001");
  await addProduct(page, "Camiseta Nike", "ROUP-001");
  await page.waitForTimeout(500);

  const lines = await page.evaluate(() => {
    const table = document.querySelectorAll("table");
    const items = table[table.length - 1];
    const rows = Array.from(items.querySelectorAll("tbody tr"));
    return rows.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const totalCell = cells[cells.length - 2];
      const cs = getComputedStyle(totalCell);
      return {
        produto: (cells[0].textContent || "").trim().slice(0, 30),
        total: (totalCell.textContent || "").trim(),
        whiteSpace: cs.whiteSpace,
        textAlign: cs.textAlign,
        width: +totalCell.getBoundingClientRect().width.toFixed(1),
      };
    });
  });
  report("novo — linhas do carrinho", lines);

  const resumo = await page
    .locator("text=/^R\\$/")
    .allInnerTexts()
    .catch(() => []);
  report("novo — valores exibidos", resumo);

  // Quantidade acima do estoque na primeira linha
  const qty = page.locator('input[type="number"]').first();
  await qty.fill("999999");
  await qty.blur();
  await page.waitForTimeout(1200);
  const warn = await page.locator("body").innerText();
  report("novo — aviso de excesso de estoque", {
    excede: warn.includes("Excede estoque"),
    avisoResumo: warn.includes("excedem o estoque"),
  });
  report(
    "novo — cores do aviso de estoque",
    await styleOf(page, "[class*=amber]", ["color", "backgroundColor"])
  );
  report(
    "novo — screenshot carrinho",
    await shot(page, "07-novo-carrinho-excesso")
  );

  // Submeter com quantidade impossível: quem responde, o front ou a API?
  const responses: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/orders") && r.request().method() === "POST") {
      responses.push(`${r.status()} ${JSON.stringify(await r.json().catch(() => null)).slice(0, 200)}`);
    }
  });
  await addCashPayment(page);
  await page.getByRole("button", { name: /Criar Pedido/ }).click();
  await page.waitForTimeout(2500);
  report("novo — toast do excesso de estoque", await toastTexts(page));
  report("novo — POST /orders disparados", responses);
  report("novo — noise", noise);
  report(
    "novo — screenshot pós-submit",
    await shot(page, "07-novo-erro-estoque")
  );
});

// ────────────────────────────────────────────────────────────────────────
// 8. Responsivo e dark do formulário
// ────────────────────────────────────────────────────────────────────────

test("VND novo: responsivo 390/768 e dark com itens no carrinho", async ({
  page,
}) => {
  await authenticate(page, "owner", "dark");
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);
  await addProduct(page, "Smart TV", "CASA-001");
  await page.waitForTimeout(500);
  const mDark = await measure(page);
  report("novo dark 1440 — measure", {
    lowContrast: mDark.lowContrast,
    hardcodedColors: mDark.hardcodedColors,
    horizontalOverflow: mDark.horizontalOverflow,
  });
  report("novo dark — screenshot", await shot(page, "08-novo-dark"));

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(700);
    const m = await measure(page);
    const table = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      const items = tables[tables.length - 1];
      if (!items) {return null;}
      const wrapper = items.parentElement!;
      const cs = getComputedStyle(wrapper);
      return {
        tableScrollWidth: items.scrollWidth,
        wrapperClientWidth: wrapper.clientWidth,
        wrapperScrollWidth: wrapper.scrollWidth,
        overflowX: cs.overflowX,
        rolaNoProprioContainer: wrapper.scrollWidth > wrapper.clientWidth,
      };
    });
    report(`novo ${width} — tabela de itens`, table);

    // VD-13: o dinheiro da linha quebra em duas linhas?
    const moneyCells = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      const items = tables[tables.length - 1];
      if (!items) {return [];}
      return Array.from(items.querySelectorAll("tbody tr, tfoot tr")).map(
        (tr) => {
          const cells = Array.from(tr.querySelectorAll("td"));
          const cell = cells[cells.length - 2] ?? cells[cells.length - 1];
          const cs = getComputedStyle(cell);
          const r = cell.getBoundingClientRect();
          const lineHeight = parseFloat(cs.lineHeight) || 20;
          return {
            text: (cell.textContent || "").trim(),
            whiteSpace: cs.whiteSpace,
            width: +r.width.toFixed(1),
            height: +r.height.toFixed(1),
            linhas: Math.round(
              (r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) /
                lineHeight
            ),
          };
        }
      );
    });
    report(`novo ${width} — dinheiro da linha (VD-13)`, moneyCells);
    report(`novo ${width} — measure`, {
      horizontalOverflow: m.horizontalOverflow,
      docScrollWidth: m.docScrollWidth,
      docClientWidth: m.docClientWidth,
      clippedNoScroll: m.clippedNoScroll,
      smallHitTargets: m.smallHitTargets,
    });
    report(`novo ${width} — screenshot`, await shot(page, `08-novo-${width}`));
  }
});

// ────────────────────────────────────────────────────────────────────────
// 9. Balcão: layout, atalhos, consistência com /novo
// ────────────────────────────────────────────────────────────────────────

test("VND balcao: layout, tokens e consistência com o pedido", async ({
  page,
}) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/vendas/balcao", 500);
  await settle(page, /Venda no Balcao/);

  const m = await measure(page);
  report("balcao 1440 — measure", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
    inconsistentRadius: m.inconsistentRadius,
  });
  report("balcao — acentos ausentes", await missingAccents(page));

  // Consistência: mesma linha de item, mesma cor de destaque?
  await addProduct(page, "Capinha", "ACESS-001");
  const qty = page.locator('input[type="number"]').first();
  await qty.fill("999999");
  await qty.blur();
  await page.waitForTimeout(1200);
  const rowStyle = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"));
    const row = tables[tables.length - 1]?.querySelector("tbody tr");
    if (!row) {return null;}
    return {
      classes: row.className,
      backgroundColor: getComputedStyle(row).backgroundColor,
    };
  });
  report("balcao — linha em excesso de estoque", rowStyle);
  report("balcao — texto do aviso", {
    excede: (await page.locator("body").innerText()).includes(
      "Excede estoque!"
    ),
  });
  report("balcao — screenshot", await shot(page, "09-balcao-1440"));
  report("balcao — noise", noise);

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(600);
    const mm = await measure(page);
    report(`balcao ${width} — measure`, {
      horizontalOverflow: mm.horizontalOverflow,
      docScrollWidth: mm.docScrollWidth,
      docClientWidth: mm.docClientWidth,
      clippedNoScroll: mm.clippedNoScroll,
    });
    report(`balcao ${width} — screenshot`, await shot(page, `09-balcao-${width}`));
  }
});

// ────────────────────────────────────────────────────────────────────────
// 10. Duplo submit — cria dois pedidos?
// ────────────────────────────────────────────────────────────────────────

test("VND balcao: duplo clique em Finalizar cria dois pedidos?", async ({
  page,
}) => {
  const noise = captureNoise(page);
  await authenticate(page);

  const posts: { status: number; orderNumber?: string; body?: string }[] = [];
  page.on("response", async (r) => {
    if (
      r.request().method() === "POST" &&
      /\/orders(\?|$)/.test(r.url().replace(API_URL, ""))
    ) {
      const b = (await r.json().catch(() => null)) as
        | { data?: { orderNumber?: string }; message?: string }
        | null;
      posts.push({
        status: r.status(),
        orderNumber: b?.data?.orderNumber,
        body: r.status() >= 400 ? JSON.stringify(b).slice(0, 300) : undefined,
      });
    }
  });

  await visit(page, "/vendas/balcao", 500);
  await settle(page, /Venda no Balcao/);
  await pickCustomer(page);
  await addProduct(page, "Capinha", "ACESS-001");
  await addCashPayment(page);
  await page
    .locator("textarea")
    .first()
    .fill(`${STAMP} duplo submit`)
    .catch(() => undefined);

  const finalizar = page.getByRole("button", { name: /Finalizar Venda/ });
  await expect(finalizar).toBeEnabled();

  // Dois cliques em sequência imediata, sem esperar reação nenhuma.
  await finalizar.click({ noWaitAfter: true });
  await finalizar.click({ noWaitAfter: true, force: true, timeout: 2000 }).catch(() => undefined);

  // Amostra os toasts durante toda a janela: o de erro dura 4 s e some.
  const seen = new Set<string>();
  for (let i = 0; i < 20; i += 1) {
    for (const t of await toastTexts(page)) {
      seen.add(t);
    }
    await page.waitForTimeout(400);
  }

  report("duplo submit — POSTs /orders", posts);
  report("duplo submit — toasts vistos na janela inteira", [...seen]);
  report("duplo submit — url final", page.url());
  report("duplo submit — noise", noise);
  report("duplo submit — screenshot", await shot(page, "10-duplo-submit"));

  // Confirmação pelo backend: quantos pedidos nasceram com esta observação?
  const { body } = await apiReq<{ data: { orderNumber: string; notes: string }[] }>(
    "GET",
    `/orders?limit=10&search=`
  );
  const mine = (body?.data ?? []).filter((o) =>
    (o.notes ?? "").includes(STAMP)
  );
  report("duplo submit — pedidos criados com o carimbo", mine.map((o) => o.orderNumber));
});

// ────────────────────────────────────────────────────────────────────────
// 11. Janela de corrida do /novo: o botão fica habilitado durante a
//     revalidação de estoque que antecede o POST?
// ────────────────────────────────────────────────────────────────────────

test("VND novo: o botão continua clicável durante a revalidação de estoque", async ({
  page,
}) => {
  await authenticate(page);
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);
  await pickCustomer(page);
  await addProduct(page, "Capinha", "ACESS-001");
  await addCashPayment(page);

  // Atrasa só a revalidação de estoque (GET /products/:id) para tornar
  // observável a janela que já existe entre o clique e o POST.
  await page.route(/\/products\/[a-z0-9]+$/, async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  const posts: number[] = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST" && r.url().endsWith("/orders")) {
      posts.push(r.status());
    }
  });

  const submit = page.getByRole("button", { name: /Criar Pedido/ });
  await submit.click({ noWaitAfter: true });
  await page.waitForTimeout(800); // ainda dentro da revalidação
  const stillEnabled = await submit.isEnabled();
  const label = await submit.innerText();
  const spinner = await page
    .locator("button:has-text('Criar Pedido') .animate-spin")
    .count();
  report("janela de corrida — estado do botão durante a revalidação", {
    stillEnabled,
    label,
    spinner,
  });
  report(
    "janela de corrida — screenshot",
    await shot(page, "11-novo-janela-corrida")
  );

  if (stillEnabled) {
    await submit.click({ noWaitAfter: true, force: true });
  }
  await page.waitForTimeout(9000);
  report("janela de corrida — POSTs /orders", posts);
  report("janela de corrida — toasts", await toastTexts(page));
});

// ────────────────────────────────────────────────────────────────────────
// 12. Detalhe do pedido: layout, dark, dialog de cancelamento
// ────────────────────────────────────────────────────────────────────────

test("VND detalhe: layout, transições e a11y do dialog", async ({ page }) => {
  const noise = captureNoise(page);
  const { body: list } = await apiReq<{
    data: { id: string; orderNumber: string; status: string }[];
  }>("GET", "/orders?limit=1&status=PENDING");
  const order = list.data[0];
  report("detalhe — pedido usado", order);

  await authenticate(page);
  await visit(page, `/vendas/pedidos/${order.id}`, 500);
  await settle(page, /Pedido #/);

  const m = await measure(page);
  report("detalhe 1440 — measure", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
    inconsistentRadius: m.inconsistentRadius,
  });
  report("detalhe — acentos", await missingAccents(page));
  report("detalhe — screenshot", await shot(page, "12-detalhe-1440"));

  // Abas
  for (const tab of ["Cliente", "Envio", "Financeiro", "Histórico"]) {
    await page.getByRole("button", { name: tab, exact: false }).first().click();
    await page.waitForTimeout(600);
  }
  report("detalhe — abas ok", true);
  await page.getByRole("button", { name: "Itens" }).first().click();
  await page.waitForTimeout(400);

  // Dialog de cancelamento: aria, foco, tamanho
  await page.getByRole("button", { name: /Cancelar Pedido/ }).click();
  await page.waitForTimeout(600);
  const dialog = await page.evaluate(() => {
    const el = document.querySelector(".fixed.inset-0.z-50 > div.relative");
    if (!el) {return null;}
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      role: el.getAttribute("role"),
      ariaModal: el.getAttribute("aria-modal"),
      ariaLabelledby: el.getAttribute("aria-labelledby"),
      maxHeight: cs.maxHeight,
      height: +r.height.toFixed(0),
      viewport: window.innerHeight,
      borderRadius: cs.borderRadius,
      focused: document.activeElement?.tagName,
    };
  });
  report("detalhe — dialog de cancelamento", dialog);
  report("detalhe — screenshot dialog", await shot(page, "12-detalhe-dialog"));

  // Confirmar sem motivo
  await page
    .locator(".fixed.inset-0.z-50")
    .getByRole("button", { name: /Cancelar Pedido/ })
    .click();
  await page.waitForTimeout(500);
  report(
    "detalhe — erro de motivo obrigatório",
    await page.locator(".fixed.inset-0.z-50 .text-destructive").allInnerTexts()
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Dark + 390
  report("detalhe — noise", noise);
  await page.setViewportSize({ width: 390, height: 900 });
  await visit(page, `/vendas/pedidos/${order.id}`, 500);
  await settle(page, /Pedido #/);
  const m390 = await measure(page);
  report("detalhe 390 — measure", {
    horizontalOverflow: m390.horizontalOverflow,
    docScrollWidth: m390.docScrollWidth,
    docClientWidth: m390.docClientWidth,
    clippedNoScroll: m390.clippedNoScroll,
  });
  report("detalhe 390 — screenshot", await shot(page, "12-detalhe-390"));
});

test("VND detalhe: dark mode", async ({ page }) => {
  const { body: list } = await apiReq<{ data: { id: string }[] }>(
    "GET",
    "/orders?limit=1&status=PENDING"
  );
  await authenticate(page, "owner", "dark");
  await visit(page, `/vendas/pedidos/${list.data[0].id}`, 500);
  await settle(page, /Pedido #/);
  const m = await measure(page);
  report("detalhe dark — measure", {
    lowContrast: m.lowContrast,
    hardcodedColors: m.hardcodedColors,
  });
  report("detalhe dark — screenshot", await shot(page, "13-detalhe-dark"));
});

// ────────────────────────────────────────────────────────────────────────
// 13. Toast x corpo da resposta: cancelar um pedido já cancelado
// ────────────────────────────────────────────────────────────────────────

test("VND detalhe: o toast de erro repete a mensagem do backend?", async ({
  page,
}) => {
  const { body: list } = await apiReq<{
    data: { id: string; orderNumber: string }[];
  }>("GET", "/orders?limit=1&status=PENDING");
  const order = list.data[0];

  await authenticate(page);
  await visit(page, `/vendas/pedidos/${order.id}`, 500);
  await settle(page, /Pedido #/);

  let httpBody = "";
  let httpStatus = 0;
  page.on("response", async (r) => {
    if (r.url().includes("/cancel")) {
      httpStatus = r.status();
      httpBody = JSON.stringify(await r.json().catch(() => null));
    }
  });

  await page.getByRole("button", { name: /Cancelar Pedido/ }).click();
  await page.waitForTimeout(500);
  await page.locator("#cancel-reason").fill(`${STAMP} motivo de teste`);

  // Enquanto o dialog está aberto, o pedido é cancelado por fora — é assim
  // que se obtém um erro real do backend sem inventar resposta nenhuma.
  const pre = await apiReq(
    "PATCH",
    `/orders/${order.id}/cancel`,
    { reason: `${STAMP} cancelado por fora` }
  );
  report("toast x backend — cancelamento prévio", pre.status);

  await page
    .locator(".fixed.inset-0.z-50")
    .getByRole("button", { name: /Cancelar Pedido/ })
    .click();
  await page.waitForTimeout(2500);

  const toasts = await toastTexts(page);
  report("toast x backend", {
    httpStatus,
    httpBody,
    toasts,
    idem: httpBody.includes(toasts[0] ?? "___"),
  });
  report("toast x backend — screenshot", await shot(page, "14-toast-backend"));
});

// ────────────────────────────────────────────────────────────────────────
// 14. AE-07 no 390: quem corta a página do formulário?
// ────────────────────────────────────────────────────────────────────────

test("VND novo/balcao 390: cadeia de ancestrais que corta o conteúdo", async ({
  page,
}) => {
  await authenticate(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [route, heading, name] of [
    ["/vendas/pedidos/novo", /Nova Venda/, "novo"],
    ["/vendas/balcao", /Venda no Balcao/, "balcao"],
  ] as const) {
    await visit(page, route, 500);
    await settle(page, heading);
    await addProduct(page, "Smart TV", "CASA-001");
    await page.waitForTimeout(800);

    const chain = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      const items = tables[tables.length - 1];
      if (!items) {return null;}
      const out: Record<string, unknown>[] = [];
      let node: Element | null = items;
      while (node && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        out.push({
          el: `${node.tagName.toLowerCase()}.${(node.className || "")
            .toString()
            .split(/\s+/)
            .slice(0, 3)
            .join(".")}`,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          overflowX: cs.overflowX,
          minWidth: cs.minWidth,
        });
        node = node.parentElement;
      }
      return {
        viewport: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        chain: out,
      };
    });
    report(`AE-07 ${name} @390 — cadeia`, chain);

    const offscreen = await page.evaluate(() => {
      const vw = window.innerWidth;
      return Array.from(document.querySelectorAll("th,button,input,h1"))
        .filter((el) => el.getBoundingClientRect().right > vw + 2)
        .slice(0, 12)
        .map((el) => ({
          el: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 30),
          right: +el.getBoundingClientRect().right.toFixed(0),
        }));
    });
    report(`AE-07 ${name} @390 — elementos fora da viewport`, offscreen);
    report(
      `AE-07 ${name} @390 — screenshot`,
      await shot(page, `15-${name}-390-corte`)
    );
  }
});

// ────────────────────────────────────────────────────────────────────────
// 15. Detalhe: isError renderizado como "não encontrado" (AE-28)
// ────────────────────────────────────────────────────────────────────────

test("VND detalhe: a falha da requisição vira 'Pedido não encontrado'?", async ({
  page,
}) => {
  const { body: list } = await apiReq<{ data: { id: string }[] }>(
    "GET",
    "/orders?limit=1&status=PENDING"
  );
  const id = list.data[0].id;

  await authenticate(page);
  await page.route(`**/api/v1/orders/${id}`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        statusCode: 500,
        message: "Internal server error",
      }),
    })
  );
  await visit(page, `/vendas/pedidos/${id}`, 4000);

  const body = await page.locator("body").innerText();
  report("detalhe com 500 — o que a tela diz", {
    naoEncontrado: body.includes("Pedido não encontrado"),
    falaEmErro: /erro|falha|tente novamente/i.test(body),
    trecho: body.split("\n").filter((l) => l.trim()).slice(-6),
  });
  report("detalhe com 500 — screenshot", await shot(page, "16-detalhe-erro"));

  // Mesma pergunta para um 403 (o caso do vendedor sem permissão)
  await page.unroute(`**/api/v1/orders/${id}`);
  await page.route(`**/api/v1/orders/${id}`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        statusCode: 403,
        message: "Permissão insuficiente para esta ação",
      }),
    })
  );
  await visit(page, `/vendas/pedidos/${id}`, 4000);
  const body403 = await page.locator("body").innerText();
  report("detalhe com 403 — o que a tela diz", {
    naoEncontrado: body403.includes("Pedido não encontrado"),
    falaEmPermissao: /permiss/i.test(body403),
  });
  report("detalhe com 403 — screenshot", await shot(page, "16-detalhe-403"));
});

// ────────────────────────────────────────────────────────────────────────
// 16. Dialog de cancelamento: foco, tabulação e aria
// ────────────────────────────────────────────────────────────────────────

test("VND dialog: foco, ordem de tabulação e aria", async ({ page }) => {
  const { body: list } = await apiReq<{ data: { id: string }[] }>(
    "GET",
    "/orders?limit=1&status=PENDING"
  );
  await authenticate(page);
  await visit(page, `/vendas/pedidos/${list.data[0].id}`, 500);
  await settle(page, /Pedido #/);

  const trigger = page.getByRole("button", { name: /Cancelar Pedido/ });
  await trigger.click();
  await page.waitForTimeout(700);

  const focus = await page.evaluate(() => {
    const dialog = document.querySelector(".fixed.inset-0.z-50 > div.relative");
    const active = document.activeElement;
    return {
      focoDentroDoDialog: !!dialog && !!active && dialog.contains(active),
      activeTag: active?.tagName,
      activeText: (active?.textContent || "").trim().slice(0, 30),
      roleNoDialog: dialog?.getAttribute("role"),
      ariaModal: dialog?.getAttribute("aria-modal"),
      temFocusTrap: false,
    };
  });
  report("dialog — foco ao abrir", focus);

  // Tab três vezes: o foco escapa para trás do overlay?
  const trail: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    trail.push(
      await page.evaluate(() => {
        const dialog = document.querySelector(
          ".fixed.inset-0.z-50 > div.relative"
        );
        const a = document.activeElement;
        const inside = !!dialog && !!a && dialog.contains(a);
        return `${inside ? "dentro" : "FORA"}: ${a?.tagName}/${(
          a?.textContent || a?.getAttribute("placeholder") || ""
        )
          .trim()
          .slice(0, 22)}`;
      })
    );
  }
  report("dialog — trilha do Tab", trail);
  report("dialog — screenshot", await shot(page, "17-dialog-foco"));
});

// ────────────────────────────────────────────────────────────────────────
// 17. Lista: estado de erro x estado vazio, e o papel vendedor
// ────────────────────────────────────────────────────────────────────────

test("VND lista: erro x vazio e papel vendedor", async ({ page }) => {
  await authenticate(page);

  // (a) A listagem falha com 500
  await page.route("**/api/v1/orders?**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "Internal server error" }),
    })
  );
  await visit(page, "/vendas/pedidos", 12000);
  const erro = await page.locator("body").innerText();
  report("lista com 500", {
    diz_nenhum_registro: /nenhum (pedido|registro)/i.test(erro),
    diz_erro: /erro|não foi poss|tente novamente/i.test(erro),
    trecho: erro.split("\n").filter((l) => /erro|nenhum|registro/i.test(l)).slice(0, 4),
  });
  report("lista com 500 — screenshot", await shot(page, "18-lista-erro"));
  await page.unroute("**/api/v1/orders?**");

  // (b) Resultado legitimamente vazio
  await visit(page, "/vendas/pedidos", 1500);
  await page
    .getByPlaceholder("Buscar por número ou cliente...")
    .fill(`${STAMP}-inexistente`);
  await page.waitForTimeout(2500);
  const vazio = await page.locator("body").innerText();
  report("lista vazia (200 com zero linhas)", {
    diz_nenhum_registro: /nenhum/i.test(vazio),
    trecho: vazio.split("\n").filter((l) => /nenhum/i.test(l)).slice(0, 3),
  });
  report("lista vazia — screenshot", await shot(page, "18-lista-vazia"));
});

test("VND papel vendedor: lista, novo e balcão", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "seller");

  for (const [route, name] of [
    ["/vendas/pedidos", "lista"],
    ["/vendas/pedidos/novo", "novo"],
    ["/vendas/balcao", "balcao"],
  ] as const) {
    await visit(page, route, 12000);
    const body = await page.locator("body").innerText();
    report(`vendedor ${name}`, {
      acessoNegado: /acesso negado/i.test(body),
      spinnerPreso: body.trim().length < 40,
      avisos: body
        .split("\n")
        .filter((l) => /permiss|não foi poss|nenhum caixa/i.test(l))
        .slice(0, 4),
    });
    report(`vendedor ${name} — screenshot`, await shot(page, `19-vendedor-${name}`));
  }
  report("vendedor — noise", noise);
});

// ────────────────────────────────────────────────────────────────────────
// 18. PaymentLine: condição, código de autorização, acentos e labels
// ────────────────────────────────────────────────────────────────────────

test("VND pagamento: payment-line com cartão de crédito", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/vendas/pedidos/novo", 500);
  await settle(page, /Nova Venda/);
  await pickCustomer(page);
  await addProduct(page, "Capinha", "ACESS-001");

  await page.getByRole("button", { name: "Adicionar pagamento" }).click();
  await page.waitForTimeout(300);
  await page
    .locator('[role="combobox"]')
    .filter({ hasText: /Selecione/ })
    .first()
    .click();
  await page.getByRole("option", { name: /crédito/ }).first().click();
  await page.waitForTimeout(600);

  report("pagamento — acentos ausentes", await missingAccents(page));

  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("label")).map((l) => ({
      text: (l.textContent || "").trim().slice(0, 30),
      htmlFor: l.getAttribute("for"),
      envolveControle: !!l.querySelector("input,select,textarea,button"),
    }))
  );
  report("pagamento — labels", labels);

  // Escolhe a condição 3x e confere a prévia de parcelas
  const condTrigger = page
    .locator('[role="combobox"]')
    .filter({ hasText: /Selecione/ })
    .first();
  if (await condTrigger.count()) {
    await condTrigger.click();
    await page.getByRole("option", { name: /3x sem juros/ }).first().click();
    await page.waitForTimeout(500);
  }
  const preview = await page
    .locator("text=/vencimentos em/")
    .allInnerTexts()
    .catch(() => []);
  report("pagamento — prévia de parcelas", preview);

  const m = await measure(page);
  report("pagamento — measure", {
    hardcodedColors: m.hardcodedColors,
    lowContrast: m.lowContrast,
    smallHitTargets: m.smallHitTargets,
    inconsistentRadius: m.inconsistentRadius,
  });

  // Submit sem código de autorização
  await page.getByRole("button", { name: /Criar Pedido/ }).click();
  await page.waitForTimeout(1200);
  report(
    "pagamento — erros após submit",
    await page.locator(".text-destructive").allInnerTexts()
  );
  report("pagamento — barra de progresso", await styleOf(page, "div.h-2 > div", ["backgroundColor", "width"]));
  report("pagamento — noise", noise);
  report("pagamento — screenshot", await shot(page, "20-pagamento-credito"));
});

// ────────────────────────────────────────────────────────────────────────
// 19. Rodapé da tabela durante o carregamento
// ────────────────────────────────────────────────────────────────────────

test("VND lista: o que o rodapé diz enquanto carrega", async ({ page }) => {
  await authenticate(page);
  await page.route("**/api/v1/orders?**", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto("/vendas/pedidos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const durante = await page.evaluate(() => {
    const skeletons = document.querySelectorAll("tbody tr").length;
    const footer = Array.from(document.querySelectorAll("div.text-sm"))
      .map((d) => (d.textContent || "").trim())
      .filter((t) => /registro|Mostrando/i.test(t));
    return { skeletons, footer };
  });
  report("lista carregando — rodapé", durante);
  report("lista carregando — screenshot", await shot(page, "21-lista-carregando"));
});

// ────────────────────────────────────────────────────────────────────────
// 20. VD-13 no MoneyInput da linha de item: "R$ 89,90" vira "R$ 89"?
// ────────────────────────────────────────────────────────────────────────

test("VND item: o campo de preço unitário corta o centavo", async ({ page }) => {
  await authenticate(page);
  for (const [route, heading, name] of [
    ["/vendas/pedidos/novo", /Nova Venda/, "novo"],
    ["/vendas/balcao", /Venda no Balcao/, "balcao"],
  ] as const) {
    await visit(page, route, 500);
    await settle(page, heading);
    await addProduct(page, "Smart TV", "CASA-001"); // R$ 3.299,00
    await page.waitForTimeout(600);

    const inputs = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tbody tr"));
      const out: Record<string, unknown>[] = [];
      for (const tr of rows) {
        for (const input of Array.from(
          tr.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')
        )) {
          const cs = getComputedStyle(input);
          out.push({
            value: input.value,
            clientWidth: input.clientWidth,
            scrollWidth: input.scrollWidth,
            cortado: input.scrollWidth > input.clientWidth + 1,
            paddingLeft: cs.paddingLeft,
            paddingRight: cs.paddingRight,
            textAlign: cs.textAlign,
          });
        }
      }
      return out;
    });
    report(`VD-13 ${name} — MoneyInput da linha`, inputs);
    report(
      `VD-13 ${name} — screenshot`,
      await shot(page, `22-${name}-money-input`)
    );
  }
});

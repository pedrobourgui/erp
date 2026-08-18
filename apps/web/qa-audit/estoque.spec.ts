/**
 * QA UX/UI — módulo Estoque (prefixo EST).
 *
 * Observação, não jornada: cada teste mede o DOM real, força um erro de verdade
 * ou compara duas telas equivalentes. Nada aqui depende de outro teste.
 */
import fs from "node:fs";
import path from "node:path";

import {
  test,
  authenticate,
  captureNoise,
  measure,
  type Measurements,
} from "./qa-fixtures";
import type { Page } from "@playwright/test";

const ART = path.join(__dirname, "artifacts", "est");
fs.mkdirSync(ART, { recursive: true });

const STAMP = `qa-est-${Date.now()}`;

/** Log estruturado: é o relatório em bruto que eu leio depois. */
function note(id: string, payload: unknown) {
  // eslint-disable-next-line no-console
  console.log(`\n@@${id} ${JSON.stringify(payload, null, 1)}`);
}

async function shot(page: Page, name: string) {
  const file = path.join(ART, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return `qa-audit/artifacts/est/${name}.png`;
}

/** Só o que interessa de `measure`, para o log não virar ruído. */
function digest(m: Measurements) {
  return {
    overflow: m.horizontalOverflow,
    doc: `${m.docScrollWidth}/${m.docClientWidth}`,
    clipped: m.clippedNoScroll.slice(0, 6),
    small: m.smallHitTargets.slice(0, 6),
    oddSpacing: m.oddSpacing.slice(0, 8),
    lowContrast: m.lowContrast.slice(0, 8),
    hardcoded: m.hardcodedColors.slice(0, 12),
    radius: m.inconsistentRadius,
    noFocusRing: m.missingFocusRing.slice(0, 6),
  };
}

/**
 * Toasts visíveis no momento.
 *
 * `components/ui/toast.tsx` não usa `role="status"` nem `aria-live`: o toast é
 * uma `div` com `.animate-slide-down` dentro de um portal. Por isso o seletor é
 * estrutural — e por isso ele **não** é anunciado por leitor de tela (EST-14).
 */
async function toasts(page: Page): Promise<string[]> {
  const sel = ".animate-slide-down.pointer-events-auto, [role='status'], [role='alert']";
  const els = page.locator(sel);
  const n = await els.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (await els.nth(i).innerText().catch(() => "")).trim();
    if (t) out.push(t.replace(/\s+/g, " "));
  }
  return out;
}

/** Espera qualquer toast aparecer e devolve o texto (ou [] no timeout). */
async function waitToasts(page: Page, timeout = 6000): Promise<string[]> {
  await page
    .locator(".animate-slide-down.pointer-events-auto")
    .first()
    .waitFor({ state: "visible", timeout })
    .catch(() => undefined);
  return toasts(page);
}

/**
 * Preenche um `MoneyInput`. O componente não tem `name` nem `id` no `<input>`
 * (EST-11): a única âncora é a ordem dos `input[inputmode="numeric"]`.
 * Cada dígito digitado é um centavo.
 */
async function fillMoney(page: Page, index: number, digits: string) {
  const el = page.locator('input[inputmode="numeric"]').nth(index);
  await el.click();
  await el.pressSequentially(digits, { delay: 25 });
}

/** Abre um SearchableSelect (botão + campo "Buscar...") e escolhe a 1ª opção. */
async function pickFirstFromSearchable(page: Page, scope: string, placeholder: RegExp) {
  const trigger = page.locator(`${scope} button`, { hasText: placeholder }).first();
  await trigger.click();
  await page.waitForTimeout(300);
  const search = page.locator(`${scope} input[placeholder="Buscar..."]`).first();
  if (await search.count()) {
    await search.fill("a");
  }
  await page.waitForTimeout(1800);
  const opts = page.locator(`${scope} .max-h-56 button`);
  const count = await opts.count();
  if (count) await opts.first().click();
  return count;
}

/**
 * Navega e espera a tela existir de fato. O dev server compila sob demanda e,
 * com vários agentes no mesmo host, um `waitForTimeout` fixo estoura o timeout
 * do teste antes de a página aparecer.
 */
async function visitReady(page: Page, path: string, settle = 1500) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // `h1` cobre as telas normais; `permission-denied` cobre o 403 do
  // `RequirePermission`, que não tem título.
  await page
    .locator('h1, [data-testid="permission-denied"]')
    .first()
    .waitFor({ state: "visible", timeout: 25_000 })
    .catch(() => undefined);
  await page.waitForTimeout(settle);
}

/** Nome acessível calculado pelo navegador para cada botão só-ícone. */
async function iconButtonNames(page: Page, scope = "body") {
  return page.evaluate((s) => {
    const root = document.querySelector(s) ?? document.body;
    const out: { html: string; ariaLabel: string | null; title: string | null; text: string }[] = [];
    for (const b of Array.from(root.querySelectorAll("button"))) {
      const text = (b.textContent || "").trim();
      const hasOnlyIcon = text.length === 0 && b.querySelector("svg") !== null;
      if (!hasOnlyIcon) continue;
      out.push({
        html: b.outerHTML.slice(0, 90),
        ariaLabel: b.getAttribute("aria-label"),
        title: b.getAttribute("title"),
        text: (b.querySelector(".sr-only")?.textContent || "").trim(),
      });
    }
    return out;
  }, scope);
}

/** Todo <label> da tela e se ele aponta para algum controle. */
async function labelAssociation(page: Page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const orphans: string[] = [];
    for (const l of labels) {
      const forAttr = l.getAttribute("for");
      const wraps = l.querySelector("input,select,textarea,button,[role=combobox]");
      if (!forAttr && !wraps) orphans.push((l.textContent || "").trim().slice(0, 40));
    }
    return { total: labels.length, orphans };
  });
}

const AUTH_HEADERS = async () => {
  const res = await fetch("http://localhost:3001/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@admin.com", password: "123456" }),
  });
  const body = await res.json();
  return { Authorization: `Bearer ${body.data.accessToken}`, "Content-Type": "application/json" };
};

// ─────────────────────────────────────────────────────────────────────────
// 1. Varredura de tokens/espacamento/contraste em todas as listas
// ─────────────────────────────────────────────────────────────────────────

const LISTS = [
  { slug: "produtos", path: "/estoque/produtos" },
  { slug: "categorias", path: "/estoque/categorias" },
  { slug: "marcas", path: "/estoque/marcas" },
  { slug: "movimentacoes", path: "/estoque/movimentacoes" },
  { slug: "depositos", path: "/estoque/depositos" },
  { slug: "alertas", path: "/estoque/alertas" },
];

test("EST-scan: tokens, contraste e escala em todas as listas (claro)", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  for (const l of LISTS) {
    await visitReady(page, l.path, 1500);
    const m = await measure(page);
    note(`scan.light.${l.slug}`, { ...digest(m), shot: await shot(page, `light-${l.slug}`) });
  }
  note("scan.light.noise", noise);
});

test("EST-scan: dark mode em todas as listas", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "owner", "dark");
  for (const l of LISTS) {
    await visitReady(page, l.path, 1500);
    const m = await measure(page);
    note(`scan.dark.${l.slug}`, { ...digest(m), shot: await shot(page, `dark-${l.slug}`) });
  }
  note("scan.dark.noise", noise);
});

/** Um teste por largura: 6 navegações cabem no timeout, 12 não. */
for (const width of [390, 768] as const) {
  test(`EST-scan: responsivo ${width} nas listas`, async ({ page }) => {
    await authenticate(page);
    await page.setViewportSize({ width, height: 844 });
    for (const l of LISTS) {
      await visitReady(page, l.path, 1500);
      const m = await measure(page);
      note(`scan.${width}.${l.slug}`, {
        overflow: m.horizontalOverflow,
        doc: `${m.docScrollWidth}/${m.docClientWidth}`,
        clipped: m.clippedNoScroll.slice(0, 5),
        small: m.smallHitTargets.slice(0, 5),
        shot: await shot(page, `w${width}-${l.slug}`),
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Consistência entre telas equivalentes (produtos x categorias x marcas)
// ─────────────────────────────────────────────────────────────────────────

test("EST-consistency: geometria das listas equivalentes", async ({ page }) => {
  await authenticate(page);
  const geo: Record<string, unknown> = {};
  for (const l of LISTS) {
    await visitReady(page, l.path, 1500);
    geo[l.slug] = await page.evaluate(() => {
      const cs = (el: Element | null, p: string) =>
        el ? getComputedStyle(el).getPropertyValue(p) : null;
      const td = document.querySelector("tbody td");
      const th = document.querySelector("thead th");
      const card = document.querySelector('[class*="rounded-md border"], [class*="rounded-xl"]');
      const h1 = document.querySelector("h1");
      const primary = Array.from(document.querySelectorAll("button")).find((b) =>
        /Nov[ao]|Criar/i.test(b.textContent || "")
      );
      const searchInput = document.querySelector('input[placeholder^="Buscar"]');
      const root = document.querySelector("main > div, main");
      return {
        tdPadding: td ? `${cs(td, "padding-top")} ${cs(td, "padding-left")}` : null,
        thPadding: th ? `${cs(th, "padding-top")} ${cs(th, "padding-left")}` : null,
        cardRadius: cs(card, "border-radius"),
        h1Size: cs(h1, "font-size"),
        primaryBtn: primary
          ? `${primary.getBoundingClientRect().height}px r=${getComputedStyle(primary).borderRadius}`
          : null,
        searchH: searchInput ? searchInput.getBoundingClientRect().height : null,
        rootGap: root ? `${cs(root, "row-gap")}` : null,
        headerAlign: document.querySelector("h1")?.parentElement?.parentElement?.className.slice(0, 60),
      };
    });
  }
  note("consistency.geometry", geo);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Botões só-ícone: nome acessível e tooltip
// ─────────────────────────────────────────────────────────────────────────

test("EST-a11y: botões só-ícone e labels nas listas", async ({ page }) => {
  await authenticate(page);
  // Escopo: só as linhas da lista (ou os cards, em Depósitos). O shell
  // (sidebar/topbar) é de outro agente e não entra na contagem.
  for (const [l, scope] of [
    ["/estoque/produtos", "tbody"],
    ["/estoque/categorias", "tbody"],
    ["/estoque/marcas", "tbody"],
    ["/estoque/depositos", "main"],
  ] as const) {
    await visitReady(page, l, 2500);
    await page
      .locator(scope === "tbody" ? "tbody tr td" : "main button")
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined);
    const btns = await iconButtonNames(page, scope);
    const unnamed = btns.filter((b) => !b.ariaLabel && !b.title && !b.text);
    note(`a11y.iconbuttons${l}`, {
      scope,
      rows: await page.locator("tbody tr").count(),
      iconOnlyButtons: btns.length,
      unnamed: unnamed.length,
      named: btns.length - unnamed.length,
      sample: unnamed.slice(0, 2).map((b) => b.html),
    });
  }

  // O tooltip do Radix existe? (aria-describedby, não substitui o rótulo)
  await visitReady(page, "/estoque/produtos", 2500);
  const rows = page.locator("tbody tr");
  if (await rows.count()) {
    const editBtn = rows.first().locator("button").nth(1);
    await editBtn.hover();
    await page.waitForTimeout(600);
    const tip = page.locator('[role="tooltip"], [data-radix-popper-content-wrapper]');
    note("a11y.tooltip.produtos.editar", {
      tooltipVisible: (await tip.count()) > 0,
      tooltipText: (await tip.first().innerText().catch(() => "")).trim(),
      accessibleName: await editBtn.evaluate((b) => {
        const id = b.getAttribute("aria-labelledby");
        return b.getAttribute("aria-label") ?? (id ? "labelledby" : null);
      }),
    });
  }
});

test("EST-a11y: labels do formulário de produto e foco visível", async ({ page }) => {
  await authenticate(page);
  await visitReady(page, "/estoque/produtos/novo", 2500);
  note("a11y.labels.novo-produto", await labelAssociation(page));

  const nameInput = page.locator('input[name="name"]');
  await nameInput.focus();
  const ring = await nameInput.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle, boxShadow: cs.boxShadow.slice(0, 60), border: cs.borderColor };
  });
  note("a11y.focusring.novo-produto", ring);

  // Ordem de tabulação a partir do primeiro campo
  const order: string[] = [];
  await nameInput.focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return "none";
        return `${a.tagName.toLowerCase()}[${a.getAttribute("name") ?? a.getAttribute("aria-label") ?? (a.textContent || "").trim().slice(0, 18)}]`;
      })
    );
  }
  note("a11y.taborder.novo-produto", order);

  note("a11y.labels.categorias.dialog", await (async () => {
    await visitReady(page, "/estoque/categorias", 2500);
    await page.getByRole("button", { name: /Nova Categoria/i }).click();
    await page.waitForTimeout(700);
    const assoc = await labelAssociation(page);
    const dialog = page.locator('[role="dialog"]');
    const aria = {
      role: await dialog.count(),
      ariaLabelledby: await dialog.first().getAttribute("aria-labelledby"),
      ariaDescribedby: await dialog.first().getAttribute("aria-describedby"),
      ariaModal: await dialog.first().getAttribute("aria-modal"),
    };
    await shot(page, "dialog-categoria-light");
    await page.keyboard.press("Escape");
    return { assoc, aria };
  })());
});

test("EST-a11y: ConfirmDialog não é um dialog para o leitor de tela", async ({ page }) => {
  await authenticate(page);
  await visitReady(page, "/estoque/categorias", 2500);
  const rows = page.locator("tbody tr");
  await rows.first().locator("button").last().click();
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find((h) =>
      /Excluir/i.test(h.textContent || "")
    );
    const box = heading?.closest("div.relative");
    return {
      dialogRoles: document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length,
      boxRole: box?.getAttribute("role") ?? null,
      ariaModal: box?.getAttribute("aria-modal") ?? null,
      ariaLabelledby: box?.getAttribute("aria-labelledby") ?? null,
      focused: (document.activeElement?.tagName || "") + "/" + (document.activeElement?.className || "").slice(0, 40),
      closeBtnName:
        box?.querySelector("button")?.getAttribute("aria-label") ??
        (box?.querySelector("button")?.textContent || "").trim() ??
        null,
    };
  });
  note("a11y.confirmdialog", { ...info, shot: await shot(page, "confirm-dialog-categoria") });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Erros reais: o que o backend disse x o que o toast mostrou
// ─────────────────────────────────────────────────────────────────────────

test("EST-err: marca com URL de logo — payload logoUrl x contrato logo", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/marcas", 2500);

  const bodies: { url: string; status: number; body: string; sent: string | null }[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/products/brands") && r.request().method() === "POST") {
      bodies.push({
        url: r.url(),
        status: r.status(),
        body: (await r.text().catch(() => "")).slice(0, 400),
        sent: r.request().postData(),
      });
    }
  });

  await page.getByRole("button", { name: /Nova Marca/i }).click();
  await page.waitForTimeout(600);
  await page.locator('input[name="name"]').fill(`Marca ${STAMP}`);
  await page.locator('input[name="logoUrl"]').fill("https://exemplo.com/logo.png");
  await shot(page, "marca-dialog-logo");
  await page.getByRole("button", { name: /^Criar$/ }).click();
  const shown = await waitToasts(page);
  await page.waitForTimeout(500);

  note("err.brand.logoUrl", {
    requests: bodies,
    toasts: shown,
    dialogStillOpen: await page.locator('[role="dialog"]').isVisible().catch(() => false),
    shot: await shot(page, "marca-logo-erro"),
    http: noise.http,
  });

  // E o contrato de leitura: a API devolve `logo`, a UI lê `logoUrl`.
  const headers = await AUTH_HEADERS();
  const brands = await (
    await fetch("http://localhost:3001/api/v1/products/brands", { headers })
  ).json();
  note("err.brand.contract", {
    firstBrandKeys: Object.keys(brands.data?.[0] ?? {}),
    sample: brands.data?.slice(0, 2),
  });
});

test("EST-err: SKU duplicado no cadastro de produto", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  // Cria pela API, com sufixo único, para depois duplicar pela UI.
  const headers = await AUTH_HEADERS();
  const sku = `SKU-${STAMP}`;
  const created = await fetch("http://localhost:3001/api/v1/products", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Produto ${STAMP}`,
      sku,
      costPrice: 10,
      salePrice: 20,
      status: "ACTIVE",
    }),
  });
  note("err.sku.seed", { status: created.status });

  const responses: { status: number; body: string }[] = [];
  page.on("response", async (r) => {
    if (r.url().endsWith("/products") && r.request().method() === "POST") {
      responses.push({ status: r.status(), body: (await r.text().catch(() => "")).slice(0, 300) });
    }
  });

  await visitReady(page, "/estoque/produtos/novo", 2500);
  await page.locator('input[name="name"]').fill(`Duplicado ${STAMP}`);
  await page.locator('input[name="sku"]').fill(sku);
  await page.getByRole("button", { name: /^Preços$/ }).click();
  await page.waitForTimeout(300);
  await fillMoney(page, 0, "1000"); // custo R$ 10,00
  await fillMoney(page, 1, "2000"); // venda R$ 20,00
  await page.waitForTimeout(300);
  note("err.sku.prices", {
    values: await page.locator('input[inputmode="numeric"]').evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value)
    ),
  });

  const submit = page.getByRole("button", { name: /Publicar Produto/ });
  await submit.click();
  await page.waitForTimeout(120);
  const lockedDuring = await submit.isDisabled().catch(() => false);
  const shown = await waitToasts(page);
  await page.waitForTimeout(500);

  note("err.sku.duplicate", {
    apiResponses: responses,
    submitDisabledDuringMutation: lockedDuring,
    toasts: shown,
    stillOnForm: page.url(),
    shot: await shot(page, "sku-duplicado"),
    http: noise.http,
  });
});

test("EST-err: excluir categoria em uso", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/categorias", 2500);

  // Uma categoria com produtos > 0 (a coluna Produtos está na mesma linha).
  const target = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      const count = Number((cells[3]?.textContent || "0").trim());
      if (count > 0) return { index: i, name: (cells[0]?.textContent || "").trim(), count };
    }
    return null;
  });
  note("err.category.target", target);
  if (!target) return;

  await page.locator("tbody tr").nth(target.index).locator("button").last().click();
  await page.waitForTimeout(500);
  const message = await page
    .locator("h3:has-text('Excluir Categoria')")
    .locator("xpath=../div")
    .innerText()
    .catch(() => "");
  const confirmBtn = page.getByRole("button", { name: /^Excluir$/ });
  const enabledBefore = await confirmBtn.isEnabled();
  const before = noise.http.length;
  await confirmBtn.click();
  const shown = await waitToasts(page);
  await page.waitForTimeout(500);

  note("err.category.inuse", {
    dialogMessage: message.replace(/\s+/g, " "),
    confirmEnabledEvenThoughDialogSaysItCannot: enabledBefore,
    newHttpErrors: noise.http.slice(before),
    toasts: shown,
    shot: await shot(page, "categoria-em-uso"),
  });
});

test("EST-err: NCM inválido na edição — erro sem lugar para aparecer", async ({ page }) => {
  await authenticate(page);
  const headers = await AUTH_HEADERS();
  const list = await (
    await fetch("http://localhost:3001/api/v1/products?limit=1", { headers })
  ).json();
  const id = list.data?.[0]?.id;
  note("err.ncm.product", { id });
  if (!id) return;

  await visitReady(page, `/estoque/produtos/${id}/edit`, 3000);
  await page.getByRole("button", { name: /^Fiscal$/ }).click();
  await page.waitForTimeout(400);
  await page.locator('input[name="ncm"]').fill("ABCDEFG");
  // Volta para a primeira aba: o erro passa a morar numa aba oculta.
  await page.getByRole("button", { name: /Dados Gerais/ }).click();
  await page.waitForTimeout(300);

  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PATCH") requests.push(r.url());
  });
  await page.getByRole("button", { name: /Salvar Alterações/ }).click();
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const activeTab = Array.from(document.querySelectorAll("button")).find((b) =>
      b.className.includes("border-primary")
    );
    return {
      activeTab: (activeTab?.textContent || "").trim(),
      tabsWithBadge: Array.from(document.querySelectorAll("button"))
        .filter((b) => b.className.includes("border-b-2"))
        .map((b) => (b.textContent || "").trim()),
      destructiveTexts: Array.from(document.querySelectorAll(".text-destructive")).map((e) =>
        (e.textContent || "").trim().slice(0, 60)
      ),
    };
  });
  note("err.ncm.edit", {
    patchSent: requests,
    ...state,
    toasts: await waitToasts(page),
    fiscalTabHasErrorAfterOpening: await (async () => {
      await page.getByRole("button", { name: /^Fiscal$/ }).click();
      await page.waitForTimeout(300);
      return page.evaluate(() =>
        Array.from(document.querySelectorAll("p.text-destructive")).map((e) =>
          (e.textContent || "").trim()
        )
      );
    })(),
    shot: await shot(page, "edit-ncm-aba-oculta"),
  });

  // Mesma situação no cadastro novo, que tem o mapa de abas
  await visitReady(page, "/estoque/produtos/novo", 2500);
  await page.getByRole("button", { name: /^Fiscal$/ }).click();
  await page.waitForTimeout(300);
  await page.locator('input[name="ncm"]').fill("ABCDEFG");
  await page.getByRole("button", { name: /Dados Gerais/ }).click();
  await page.waitForTimeout(300);
  await page.locator('input[name="name"]').fill(`Teste ${STAMP}`);
  await page.locator('input[name="sku"]').fill(`X-${STAMP}`);
  await page.getByRole("button", { name: /Publicar Produto/ }).click();
  await page.waitForTimeout(1200);
  const novoState = await page.evaluate(() => ({
    activeTab: (
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.className.includes("border-primary")
      )?.textContent || ""
    ).trim(),
    badges: Array.from(document.querySelectorAll("span.rounded-full")).map((s) =>
      (s.textContent || "").trim()
    ),
  }));
  note("err.ncm.novo", { ...novoState, shot: await shot(page, "novo-ncm-aba-badge") });
});

test("EST-err: campos sem erro visível no cadastro (dimensões / markup)", async ({ page }) => {
  await authenticate(page);
  await visitReady(page, "/estoque/produtos/novo", 2500);
  await page.locator('input[name="name"]').fill(`Neg ${STAMP}`);
  await page.locator('input[name="sku"]').fill(`N-${STAMP}`);
  await page.getByRole("button", { name: /^Preços$/ }).click();
  await page.waitForTimeout(300);
  await fillMoney(page, 0, "1000");
  await fillMoney(page, 1, "2000");
  await page.getByRole("button", { name: /Dimensões/ }).click();
  await page.waitForTimeout(300);
  await page.locator('input[name="weight"]').fill("-5");
  await page.getByRole("button", { name: /Publicar Produto/ }).click();
  const shown = await waitToasts(page);
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({
    activeTab: (
      Array.from(document.querySelectorAll("button")).find((b) =>
        b.className.includes("border-primary")
      )?.textContent || ""
    ).trim(),
    // A aba Dimensões continua aberta e nenhum campo dela mostra erro (FN-13).
    errorTextsOnScreen: Array.from(document.querySelectorAll("p.text-destructive")).map((e) =>
      (e.textContent || "").trim()
    ),
    tabBadges: Array.from(document.querySelectorAll("button"))
      .filter((b) => b.className.includes("border-b-2"))
      .map((b) => (b.textContent || "").trim()),
  }));
  note("err.negative-weight", { ...st, toasts: shown, shot: await shot(page, "novo-peso-negativo") });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Máscaras e maxLength dos campos fiscais
// ─────────────────────────────────────────────────────────────────────────

test("EST-mask: NCM / CEST / EAN — máscara e maxLength, novo x edição", async ({ page }) => {
  await authenticate(page);
  await visitReady(page, "/estoque/produtos/novo", 2500);
  await page.getByRole("button", { name: /^Fiscal$/ }).click();
  await page.waitForTimeout(300);

  const probe = async () => {
    const out: Record<string, unknown> = {};
    for (const f of ["ncm", "cest", "ean", "cfop"]) {
      const el = page.locator(`input[name="${f}"]`);
      if (!(await el.count())) {
        out[f] = "AUSENTE";
        continue;
      }
      await el.fill("");
      await el.type("12345678901234567890".slice(0, 20), { delay: 5 });
      out[f] = {
        maxLength: await el.getAttribute("maxlength"),
        valueAfterTyping: await el.inputValue(),
        id: await el.getAttribute("id"),
      };
    }
    return out;
  };

  note("mask.novo", await probe());
  await shot(page, "novo-fiscal-sem-mascara");

  const headers = await AUTH_HEADERS();
  const list = await (
    await fetch("http://localhost:3001/api/v1/products?limit=1", { headers })
  ).json();
  const id = list.data?.[0]?.id;
  if (id) {
    await visitReady(page, `/estoque/produtos/${id}/edit`, 3000);
    await page.getByRole("button", { name: /^Fiscal$/ }).click();
    await page.waitForTimeout(400);
    note("mask.edit", await probe());
    await shot(page, "edit-fiscal");
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Ordenação de movimentações: o header ordena de verdade?
// ─────────────────────────────────────────────────────────────────────────

test("EST-sort: ordenação em Movimentações chega à API?", async ({ page }) => {
  await authenticate(page);
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/inventory/movements")) urls.push(r.url());
  });
  await visitReady(page, "/estoque/movimentacoes", 3000);
  const firstBefore = await page.locator("tbody tr").first().innerText().catch(() => "");
  await page.locator("thead th", { hasText: "Quantidade" }).click();
  await page.waitForTimeout(2500);
  const firstAfter = await page.locator("tbody tr").first().innerText().catch(() => "");
  await page.locator("thead th", { hasText: "Quantidade" }).click();
  await page.waitForTimeout(2500);
  const firstDesc = await page.locator("tbody tr").first().innerText().catch(() => "");
  note("sort.movimentacoes", {
    requests: urls,
    anyWithSortBy: urls.some((u) => u.includes("sortBy")),
    firstRowBefore: firstBefore.replace(/\s+/g, " ").slice(0, 90),
    firstRowAsc: firstAfter.replace(/\s+/g, " ").slice(0, 90),
    firstRowDesc: firstDesc.replace(/\s+/g, " ").slice(0, 90),
    shot: await shot(page, "movimentacoes-sort"),
  });

  // Comparação: produtos ordena?
  const purls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/products?")) purls.push(r.url());
  });
  await visitReady(page, "/estoque/produtos", 2500);
  await page.locator("thead th", { hasText: "Preço" }).click();
  await page.waitForTimeout(2000);
  note("sort.produtos", { anyWithSortBy: purls.some((u) => u.includes("sortBy")), sample: purls.slice(-2) });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Truncamento de célula com nome longo
// ─────────────────────────────────────────────────────────────────────────

test("EST-trunc: nome de 255 caracteres na lista de produtos", async ({ page }) => {
  const headers = await AUTH_HEADERS();
  const longName = `${STAMP} ` + "A".repeat(240);
  const res = await fetch("http://localhost:3001/api/v1/products", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: longName.slice(0, 255),
      sku: `LONG-${STAMP}`,
      costPrice: 1,
      salePrice: 2,
      status: "ACTIVE",
    }),
  });
  const created = await res.json().catch(() => ({}));
  note("trunc.seed", { status: res.status, id: created?.data?.id });

  await authenticate(page);
  await visitReady(page, `/estoque/produtos?x=1`, 2000);
  await page.locator('input[placeholder^="Buscar"]').fill(STAMP);
  await page.waitForTimeout(2500);
  const m = await measure(page);
  const cell = await page.evaluate(() => {
    const td = Array.from(document.querySelectorAll("tbody td")).find((t) =>
      (t.textContent || "").includes("AAAAAAAAAA")
    );
    if (!td) return null;
    const inner = td.querySelector("span");
    return {
      tdTitle: td.getAttribute("title"),
      tdWidth: td.getBoundingClientRect().width,
      innerClass: inner?.className ?? null,
      innerScroll: inner ? `${inner.scrollWidth}/${inner.clientWidth}` : null,
      overflow: inner ? getComputedStyle(inner).textOverflow : null,
    };
  });
  note("trunc.produtos", {
    cell,
    docOverflow: m.horizontalOverflow,
    doc: `${m.docScrollWidth}/${m.docClientWidth}`,
    clipped: m.clippedNoScroll.slice(0, 4),
    shot: await shot(page, "trunc-nome-longo-1440"),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const m390 = await measure(page);
  note("trunc.produtos.390", {
    docOverflow: m390.horizontalOverflow,
    doc: `${m390.docScrollWidth}/${m390.docClientWidth}`,
    clipped: m390.clippedNoScroll.slice(0, 4),
    shot: await shot(page, "trunc-nome-longo-390"),
  });

  if (created?.data?.id) {
    await fetch(`http://localhost:3001/api/v1/products/${created.data.id}`, {
      method: "DELETE",
      headers,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 8. Papel seller: 403, <Can> e botões que não deveriam estar clicáveis
// ─────────────────────────────────────────────────────────────────────────

test("EST-403: papel seller nas seis telas", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "seller");
  const out: Record<string, unknown> = {};
  for (const l of LISTS) {
    await visitReady(page, l.path, 2800);
    out[l.slug] = await page.evaluate(() => {
      const body = (document.body.innerText || "").replace(/\s+/g, " ");
      return {
        denied: /não tem permissão|Acesso negado|sem permissão/i.test(body),
        emptyState: /Nenhum[ao]? /i.test(body),
        rows: document.querySelectorAll("tbody tr").length,
        actionButtons: Array.from(document.querySelectorAll("tbody button")).filter(
          (b) => !(b as HTMLButtonElement).disabled
        ).length,
        disabledByPermission: document.querySelectorAll('[data-testid="permission-disabled"]').length,
        createBtn: Array.from(document.querySelectorAll("button")).some((b) =>
          /Nov[ao]|Criar|movimenta/i.test(b.textContent || "")
        ),
        snippet: body.slice(0, 130),
      };
    });
    await shot(page, `seller-${l.slug}`);
  }
  note("403.seller", { screens: out, http: noise.http });
});

test("EST-403: seller clica em excluir produto e lê o toast", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "seller");
  await visitReady(page, "/estoque/produtos", 3000);
  const rows = page.locator("tbody tr");
  if (!(await rows.count())) {
    note("403.delete", "sem linhas");
    return;
  }
  await rows.first().locator("button").last().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Excluir$/ }).click();
  const shown = await waitToasts(page);
  await page.waitForTimeout(400);
  // O toast é anunciado? (região sem role/aria-live não é lida)
  const live = await page.evaluate(() => {
    const t = document.querySelector(".animate-slide-down.pointer-events-auto");
    const region = t?.parentElement;
    return {
      toastRole: t?.getAttribute("role") ?? null,
      toastAriaLive: t?.getAttribute("aria-live") ?? null,
      regionRole: region?.getAttribute("role") ?? null,
      regionAriaLive: region?.getAttribute("aria-live") ?? null,
      regionClass: (region?.className ?? "").slice(0, 70),
    };
  });
  note("403.delete.produto", {
    toasts: shown,
    toastAccessibility: live,
    http: noise.http,
    shot: await shot(page, "seller-excluir-403"),
  });
});

test("EST-403: seller na dialog de nova movimentação", async ({ page }) => {
  await authenticate(page, "seller");
  await visitReady(page, "/estoque/movimentacoes", 3000);
  note("403.movimentacoes", {
    body: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 200),
    shot: await shot(page, "seller-movimentacoes"),
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 9. Movimentações: entrada real, feedback e trava de submit
// ─────────────────────────────────────────────────────────────────────────

test("EST-mov: entrada de estoque — sucesso, erro e trava do submit", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/movimentacoes", 3000);
  await page.getByRole("button", { name: /Nova movimentação/i }).click();
  await page.waitForTimeout(800);

  const dialogInfo = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return {
      h: Math.round(r.height),
      maxH: getComputedStyle(d).maxHeight,
      radius: getComputedStyle(d).borderRadius,
      tabs: Array.from(d.querySelectorAll("button"))
        .filter((b) => b.className.includes("border-b-2"))
        .map((b) => (b.textContent || "").trim()),
      labels: Array.from(d.querySelectorAll("label")).map((l) => ({
        text: (l.textContent || "").trim(),
        htmlFor: l.getAttribute("for"),
      })),
    };
  });
  await shot(page, "movimentacao-dialog");

  // Saída maior que o saldo: o backend recusa e a mensagem tem que aparecer.
  await page.getByRole("button", { name: /^Saída$/ }).click();
  await page.waitForTimeout(400);
  const optCount = await pickFirstFromSearchable(page, '[role="dialog"]', /Selecione o produto/);
  await page.waitForTimeout(400);

  const responses: { status: number; body: string }[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/inventory/movement")) {
      responses.push({ status: r.status(), body: (await r.text().catch(() => "")).slice(0, 250) });
    }
  });

  // Depósito de origem
  const whTrigger = page.locator('[role="dialog"] button[role="combobox"]').first();
  await whTrigger.click();
  await page.waitForTimeout(400);
  const item = page.locator('[role="option"]').first();
  if (await item.count()) await item.click();
  await page.waitForTimeout(200);

  await page.locator('[role="dialog"] input[type="number"]').fill("999999");

  const reasonTrigger = page.locator('[role="dialog"] button[role="combobox"]').last();
  await reasonTrigger.click();
  await page.waitForTimeout(400);
  const rItem = page.locator('[role="option"]').first();
  if (await rItem.count()) await rItem.click();
  await page.waitForTimeout(200);
  await shot(page, "movimentacao-saida-preenchida");

  const submit = page.getByRole("button", { name: /^Registrar$/ });
  await submit.click();
  await page.waitForTimeout(120);
  const disabledDuring = await submit.isDisabled().catch(() => null);
  const shown = await waitToasts(page);
  await page.waitForTimeout(500);

  note("mov.saida-sem-saldo", {
    dialogInfo,
    optionsFound: optCount,
    apiResponses: responses,
    submitDisabledDuringMutation: disabledDuring,
    toasts: shown,
    http: noise.http,
    shot: await shot(page, "movimentacao-erro-saldo"),
  });
});

test("EST-mov: ajuste de estoque — feedback e trava do submit", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/movimentacoes", 3000);
  await page.getByRole("button", { name: /Nova movimentação/i }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Ajuste$/ }).click();
  await page.waitForTimeout(400);

  const responses: { status: number; body: string }[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/inventory/adjust")) {
      responses.push({ status: r.status(), body: (await r.text().catch(() => "")).slice(0, 250) });
    }
  });

  const opts = await pickFirstFromSearchable(page, '[role="dialog"]', /Selecione o produto/);
  const whTrigger = page.locator('[role="dialog"] button[role="combobox"]').first();
  await whTrigger.click();
  await page.waitForTimeout(400);
  const item = page.locator('[role="option"]').first();
  if (await item.count()) await item.click();
  await page.waitForTimeout(1500);

  // Justificativa em branco: o zod exige e o campo tem que dizer isso.
  await page.getByRole("button", { name: /Registrar ajuste/ }).click();
  const invalidToast = await waitToasts(page);
  const invalidState = await page.evaluate(() => ({
    errors: Array.from(document.querySelectorAll('[role="dialog"] p.text-destructive')).map((e) =>
      (e.textContent || "").trim()
    ),
  }));

  // Agora válido
  await page.locator('[role="dialog"] input[type="number"]').last().fill("7");
  await page
    .locator('[role="dialog"] input[placeholder*="contagem" i]')
    .fill(`Auditoria ${STAMP}`);
  await page.waitForTimeout(400);
  const delta = await page
    .locator('[data-testid="adjustment-delta"]')
    .innerText()
    .catch(() => null);
  const submit = page.getByRole("button", { name: /Registrar ajuste/ });
  await submit.click();
  await page.waitForTimeout(120);
  const disabledDuring = await submit.isDisabled().catch(() => null);
  const okToast = await waitToasts(page);
  await page.waitForTimeout(500);

  note("mov.ajuste", {
    optionsFound: opts,
    invalidToast,
    invalidState,
    delta,
    apiResponses: responses,
    submitDisabledDuringMutation: disabledDuring,
    successToast: okToast,
    http: noise.http,
    shot: await shot(page, "movimentacao-ajuste"),
  });
});

/**
 * A mutação é rápida demais para julgar a trava pelo relógio: atrasa a resposta
 * de propósito e observa o botão *durante* a requisição, e se o duplo clique
 * cria dois registros.
 */
test("EST-lock: botão de submit durante a mutação (resposta atrasada)", async ({ page }) => {
  await authenticate(page);

  // 1) Categoria — dialog com `loading` vindo de isPending
  await page.route("**/products/categories", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((r) => setTimeout(r, 3000));
    }
    await route.continue();
  });
  const catPosts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/products/categories"))
      catPosts.push(r.postData() ?? "");
  });

  await visitReady(page, "/estoque/categorias", 2500);
  await page.getByRole("button", { name: /Nova Categoria/i }).click();
  await page.waitForTimeout(600);
  await page.locator('input[name="name"]').fill(`Cat ${STAMP}`);
  const criar = page.getByRole("button", { name: /^Criar$/ });
  await criar.click({ force: true });
  await page.waitForTimeout(400);
  const catDisabled = await criar.isDisabled().catch(() => null);
  await criar.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(4000);
  note("lock.categoria", {
    disabledDuringMutation: catDisabled,
    postsSent: catPosts.length,
    toasts: await toasts(page),
  });
  await page.unroute("**/products/categories");

  // 2) Produto — botão "Publicar Produto"
  await page.route("**/api/v1/products", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((r) => setTimeout(r, 3000));
    }
    await route.continue();
  });
  const prodPosts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/v1/products"))
      prodPosts.push(r.url());
  });

  await visitReady(page, "/estoque/produtos/novo", 2500);
  await page.locator('input[name="name"]').fill(`Lock ${STAMP}`);
  await page.locator('input[name="sku"]').fill(`LK-${STAMP}`);
  await page.getByRole("button", { name: /^Preços$/ }).click();
  await page.waitForTimeout(300);
  await fillMoney(page, 0, "1000");
  await fillMoney(page, 1, "2000");
  const publicar = page.getByRole("button", { name: /Publicar Produto/ });
  await publicar.click();
  await page.waitForTimeout(400);
  const prodDisabled = await publicar.isDisabled().catch(() => null);
  const spinnerDuring = await page
    .locator(".animate-spin")
    .count()
    .catch(() => 0);
  await publicar.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(4500);
  note("lock.produto", {
    disabledDuringMutation: prodDisabled,
    spinnersDuring: spinnerDuring,
    postsSent: prodPosts.length,
    urlAfter: page.url(),
    shot: await shot(page, "lock-publicar-produto"),
  });
  await page.unroute("**/api/v1/products");

  // 3) Movimentação — dialog "Registrar"
  await page.route("**/inventory/movement", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((r) => setTimeout(r, 3000));
    }
    await route.continue();
  });
  const movPosts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/inventory/movement"))
      movPosts.push(r.url());
  });

  await visitReady(page, "/estoque/movimentacoes", 3000);
  await page.getByRole("button", { name: /Nova movimentação/i }).click();
  await page.waitForTimeout(800);
  await pickFirstFromSearchable(page, '[role="dialog"]', /Selecione o produto/);
  const wh = page.locator('[role="dialog"] button[role="combobox"]').first();
  await wh.click();
  await page.waitForTimeout(400);
  await page.locator('[role="option"]').first().click();
  await page.locator('[role="dialog"] input[type="number"]').fill("1");
  const reason = page.locator('[role="dialog"] button[role="combobox"]').last();
  await reason.click();
  await page.waitForTimeout(400);
  await page.locator('[role="option"]').first().click();
  const registrar = page.getByRole("button", { name: /^Registrar$/ });
  await registrar.click();
  await page.waitForTimeout(400);
  const movDisabled = await registrar.isDisabled().catch(() => null);
  await registrar.click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(4500);
  note("lock.movimentacao", {
    disabledDuringMutation: movDisabled,
    postsSent: movPosts.length,
    toasts: await toasts(page),
    shot: await shot(page, "lock-registrar-movimentacao"),
  });
  await page.unroute("**/inventory/movement");
});

test("EST-mov: dark mode no dialog de movimentação e no formulário de produto", async ({ page }) => {
  await authenticate(page, "owner", "dark");
  await visitReady(page, "/estoque/movimentacoes", 3000);
  await page.getByRole("button", { name: /Nova movimentação/i }).click();
  await page.waitForTimeout(900);
  const m = await measure(page);
  note("dark.dialog.movimentacao", { ...digest(m), shot: await shot(page, "dark-dialog-movimentacao") });

  await visitReady(page, "/estoque/produtos/novo", 2500);
  const m2 = await measure(page);
  note("dark.form.novo-produto", { ...digest(m2), shot: await shot(page, "dark-novo-produto") });

  await page.getByRole("button", { name: /^Fiscal$/ }).click();
  await page.waitForTimeout(400);
  await shot(page, "dark-novo-produto-fiscal");
});

// ─────────────────────────────────────────────────────────────────────────
// 10. Detalhe do produto
// ─────────────────────────────────────────────────────────────────────────

test("EST-detalhe: KPIs, tokens e responsivo", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  const headers = await AUTH_HEADERS();
  const list = await (
    await fetch("http://localhost:3001/api/v1/products?limit=1", { headers })
  ).json();
  const id = list.data?.[0]?.id;
  if (!id) return;

  await visitReady(page, `/estoque/produtos/${id}`, 3000);
  const m = await measure(page);
  note("detalhe.light", { ...digest(m), shot: await shot(page, "detalhe-produto") });

  const kpi = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[class*="rounded-lg"]'))
      .filter((d) => /bg-(emerald|blue|amber|primary)/.test(d.className))
      .map((d) => ({
        cls: d.className,
        bg: getComputedStyle(d).backgroundColor,
        fg: getComputedStyle(d).color,
      }))
  );
  note("detalhe.kpis", kpi);

  await authenticate(page, "owner", "dark");
  await visitReady(page, `/estoque/produtos/${id}`, 3000);
  const md = await measure(page);
  note("detalhe.dark", { ...digest(md), shot: await shot(page, "detalhe-produto-dark") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const m390 = await measure(page);
  note("detalhe.390", {
    overflow: m390.horizontalOverflow,
    doc: `${m390.docScrollWidth}/${m390.docClientWidth}`,
    clipped: m390.clippedNoScroll.slice(0, 5),
    shot: await shot(page, "detalhe-produto-390"),
  });
  note("detalhe.noise", noise);
});

// ─────────────────────────────────────────────────────────────────────────
// 11. Estados de carregamento e /estoque
// ─────────────────────────────────────────────────────────────────────────

test("EST-load: skeleton, /estoque e paginação", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  await page.goto("/estoque", { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  note("load.redirect", {
    url: page.url(),
    h1: await page.locator("h1").first().innerText().catch(() => null),
  });

  // Alertas: os filtros que o AlertQueryDto aceita x os que a tela tem
  await visitReady(page, "/estoque/alertas", 2500);
  note("load.alertas.filtros", await page.evaluate(() => ({
    selects: Array.from(document.querySelectorAll("main button[role=combobox]")).map((b) =>
      (b.textContent || "").trim()
    ),
    labels: Array.from(document.querySelectorAll("main label")).map((l) => (l.textContent || "").trim()),
    hasSearch: !!document.querySelector('input[placeholder^="Buscar"]'),
  })));

  // Paginação: a lista de marcas tem total = itens carregados
  await visitReady(page, "/estoque/marcas", 2500);
  const pag = await page.evaluate(() => {
    const txt = document.body.innerText;
    const m = txt.match(/Mostrando[^\n]*/);
    return { line: m?.[0] ?? null, rows: document.querySelectorAll("tbody tr").length };
  });
  note("load.paginacao.marcas", pag);

  // Skeleton por último: a rota atrasada não pode atrapalhar as navegações acima.
  await page.route("**/products?*", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto("/estoque/produtos", { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const loadingState = await page.evaluate(() => ({
    skeletonRows: document.querySelectorAll("tbody .animate-pulse").length,
    skeletonTdPadding: (() => {
      const td = document.querySelector("tbody td");
      return td ? getComputedStyle(td).padding : null;
    })(),
    spinners: document.querySelectorAll(".animate-spin").length,
    saysEmpty: /Nenhum registro/i.test(document.body.innerText || ""),
  }));
  note("load.skeleton.produtos", { ...loadingState, shot: await shot(page, "loading-produtos") });
  await page.waitForTimeout(4500);
  const loadedPadding = await page.evaluate(() => {
    const td = document.querySelector("tbody td");
    return td ? getComputedStyle(td).padding : null;
  });
  note("load.skeleton.padding-shift", {
    skeleton: loadingState.skeletonTdPadding,
    loaded: loadedPadding,
  });
  await page.unroute("**/products?*");
  note("load.noise", noise);
});

/** AE-28: uma requisição que falhou não pode virar "nenhum registro". */
test("EST-erro: 500 e 403 forçados nas listas do módulo", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  for (const [slug, pattern, route] of [
    ["categorias", "**/products/categories*", "/estoque/categorias"],
    ["produtos", "**/api/v1/products?*", "/estoque/produtos"],
    ["alertas", "**/inventory/alerts*", "/estoque/alertas"],
    ["movimentacoes", "**/inventory/movements*", "/estoque/movimentacoes"],
  ] as const) {
    for (const status of [500, 403] as const) {
      await page.route(pattern, (r) =>
        r.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ success: false, statusCode: status, message: "forçado pelo QA" }),
        })
      );
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3500);
      const st = await page.evaluate(() => {
        const t = (document.body.innerText || "").replace(/\s+/g, " ");
        return {
          saysEmpty: /Nenhum[ao]? (registro|categoria|marca|alerta|movimenta)/i.test(t),
          saysError: /Não foi possível carregar/i.test(t),
          saysDenied: /não tem permissão|Acesso negado/i.test(t),
          paginationLine: t.match(/Mostrando[^|]{0,40}|Nenhum registro/)?.[0] ?? null,
          len: t.length,
        };
      });
      note(`erro.${slug}.${status}`, { ...st, shot: await shot(page, `erro-${status}-${slug}`) });
      await page.unroute(pattern);
    }
  }
  note("erro.noise", { console: noise.console.slice(0, 4), pageerror: noise.pageerror });
});

/** Contraste medido nos elementos coloridos "na mão" do módulo. */
test("EST-cor: contraste das cores literais (claro e escuro)", async ({ page }) => {
  const probe = async () =>
    page.evaluate(() => {
      const lum = (c: string) => {
        const m = c.match(/[\d.]+/g);
        if (!m) return null;
        const [r, g, b] = m.map(Number);
        const f = (v: number) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bgOf = (el: Element) => {
        let n: Element | null = el;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const m = c.match(/[\d.]+/g);
          if (m && Number(m[3] ?? 1) > 0.5) return c;
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const ratio = (el: Element) => {
        const l1 = lum(getComputedStyle(el).color);
        const l2 = lum(bgOf(el));
        if (l1 === null || l2 === null) return null;
        return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
      };
      const pick = (sel: string) =>
        Array.from(document.querySelectorAll(sel))
          .filter((e) => (e.textContent || "").trim())
          .slice(0, 3)
          .map((e) => ({
            text: (e.textContent || "").trim().slice(0, 24),
            color: getComputedStyle(e).color,
            bg: bgOf(e),
            fontSize: getComputedStyle(e).fontSize,
            weight: getComputedStyle(e).fontWeight,
            ratio: ratio(e),
          }));
      return {
        yellow600: pick(".text-yellow-600"),
        emerald600: pick(".text-emerald-600"),
        destructiveText: pick("tbody .text-destructive"),
        badgeDestructive: pick('[class*="bg-destructive/15"]'),
        badgeWarning: pick('[class*="bg-amber-500/15"]'),
        badgeSuccess: pick('[class*="bg-emerald-500/15"]'),
        statusBadge: pick("span.rounded-full.border"),
        mutedFg: pick("main p.text-muted-foreground"),
      };
    });

  await authenticate(page);
  for (const p of ["/estoque/produtos", "/estoque/alertas", "/estoque/movimentacoes"]) {
    await visitReady(page, p, 4000);
    note(`cor.light${p}`, await probe());
  }
  await authenticate(page, "owner", "dark");
  for (const p of ["/estoque/produtos", "/estoque/alertas", "/estoque/movimentacoes"]) {
    await visitReady(page, p, 4000);
    note(`cor.dark${p}`, { ...(await probe()), shot: await shot(page, `cor-dark-${p.split("/").pop()}`) });
  }
});

test("EST-busca: filtros e busca em cada lista", async ({ page }) => {
  await authenticate(page);
  const out: Record<string, unknown> = {};

  await visitReady(page, "/estoque/produtos", 2500);
  const reqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/products?")) reqs.push(r.url());
  });
  await page.locator('input[placeholder^="Buscar"]').fill("zzz-nao-existe");
  await page.waitForTimeout(2500);
  out["produtos.busca"] = {
    urls: reqs.slice(-1),
    body: (await page.locator("tbody").innerText()).replace(/\s+/g, " ").slice(0, 120),
  };

  await page.getByRole("button", { name: /^Filtros$/ }).click();
  await page.waitForTimeout(500);
  out["produtos.filtros"] = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="filter-panel"]');
    if (!panel) return null;
    return {
      controls: Array.from(panel.querySelectorAll("label")).map((l) => (l.textContent || "").trim()),
      freeTextInputs: panel.querySelectorAll('input[type="text"]').length,
      gap: getComputedStyle(panel).gap,
      padding: getComputedStyle(panel).padding,
    };
  });
  await shot(page, "produtos-filtros");

  // Categorias e Marcas: têm painel de filtro?
  for (const p of ["/estoque/categorias", "/estoque/marcas", "/estoque/alertas"]) {
    await visitReady(page, p, 2200);
    out[`${p}.toolbar`] = await page.evaluate(() => ({
      hasFilters: Array.from(document.querySelectorAll("button")).some(
        (b) => (b.textContent || "").trim() === "Filtros"
      ),
      hasSearch: !!document.querySelector('input[placeholder^="Buscar"]'),
      hasExport: Array.from(document.querySelectorAll("button")).some((b) =>
        /Exportar/i.test(b.textContent || "")
      ),
    }));
  }
  note("busca.filtros", out);
});

/**
 * Quais colunas cabem na largura padrão de desktop? A tabela rola no próprio
 * container (correto), mas se a coluna de Ações fica fora da área visível o
 * usuário precisa descobrir o scroll horizontal para editar qualquer linha.
 */
test("EST-colunas: o que fica visível em 1440 / 768 / 390", async ({ page }) => {
  await authenticate(page);
  const out: Record<string, unknown> = {};
  for (const w of [1440, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const p of ["/estoque/produtos", "/estoque/categorias", "/estoque/movimentacoes"]) {
      await visitReady(page, p, 2000);
      out[`${w}${p}`] = await page.evaluate(() => {
        const wrap = document.querySelector(".overflow-x-auto");
        const ths = Array.from(document.querySelectorAll("thead th"));
        const box = wrap?.getBoundingClientRect();
        return {
          scroll: wrap ? `${wrap.scrollWidth}/${wrap.clientWidth}` : null,
          needsScroll: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : null,
          headers: ths.map((t) => (t.textContent || "").trim()),
          widths: ths.map((t) => `${(t.textContent || "").trim()}:${Math.round(t.getBoundingClientRect().width)}`),
          visibleHeaders: ths
            .filter((t) => {
              const r = t.getBoundingClientRect();
              return box ? r.left >= box.left - 1 && r.right <= box.right + 1 : false;
            })
            .map((t) => (t.textContent || "").trim()),
        };
      });
    }
  }
  note("colunas", out);
  await page.setViewportSize({ width: 1440, height: 900 });
  await visitReady(page, "/estoque/produtos", 2500);
  await shot(page, "produtos-1440-colunas");
});

/**
 * Depois de criar, para onde vai o usuário? `onSubmit` faz
 * `router.push("/estoque/produtos")` logo após o toast — sem interceptação
 * nenhuma, para não confundir o efeito com o do teste de trava.
 */
test("EST-redirect: para onde vai a tela depois de criar um produto", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/produtos/novo", 2500);
  const sku = `RD-${STAMP}`;
  await page.locator('input[name="name"]').fill(`Redirect ${STAMP}`);
  await page.locator('input[name="sku"]').fill(sku);
  await page.getByRole("button", { name: /^Preços$/ }).click();
  await page.waitForTimeout(300);
  await fillMoney(page, 0, "1000");
  await fillMoney(page, 1, "2000");

  const posts: number[] = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST" && r.url().endsWith("/api/v1/products"))
      posts.push(r.status());
  });

  await page.getByRole("button", { name: /Publicar Produto/ }).click();
  await page.waitForTimeout(6000);

  note("redirect.novo-produto", {
    postStatuses: posts,
    urlAfter: page.url(),
    h1: await page.locator("h1").first().innerText().catch(() => null),
    // Se ficou no formulário, os campos continuam preenchidos e um segundo
    // clique manda o mesmo SKU de novo.
    nameStillFilled: await page
      .locator('input[name="name"]')
      .inputValue()
      .catch(() => null),
    toasts: await toasts(page),
    http: noise.http,
    shot: await shot(page, "redirect-apos-criar"),
  });
});

/**
 * A aba "Imagens" do cadastro aceita até 8 arquivos e marca cada um como
 * concluído. Eles chegam ao servidor?
 */
test("EST-imagens: o que acontece com as imagens enviadas no cadastro", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visitReady(page, "/estoque/produtos/novo", 2000);

  const uploads: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && !r.url().endsWith("/api/v1/products")) uploads.push(r.url());
  });

  const sku = `IMG-${STAMP}`;
  await page.locator('input[name="name"]').fill(`Imagens ${STAMP}`);
  await page.locator('input[name="sku"]').fill(sku);
  await page.getByRole("button", { name: /^Preços$/ }).click();
  await page.waitForTimeout(300);
  await fillMoney(page, 0, "1000");
  await fillMoney(page, 1, "2000");

  await page.getByRole("button", { name: /^Imagens$/ }).click();
  await page.waitForTimeout(400);
  // 1x1 PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: `qa-est-${Date.now()}.png`,
    mimeType: "image/png",
    buffer: png,
  });
  await page.waitForTimeout(1500);
  const uiState = await page.evaluate(() => ({
    body: (document.querySelector("main")?.innerText || "").replace(/\s+/g, " ").slice(0, 240),
    progressBars: document.querySelectorAll('[class*="bg-primary"][style*="width"]').length,
  }));
  await shot(page, "novo-imagens-upload");

  const created: { status: number; body: string }[] = [];
  page.on("response", async (r) => {
    if (r.request().method() === "POST" && r.url().endsWith("/api/v1/products"))
      created.push({ status: r.status(), body: (await r.text().catch(() => "")).slice(0, 200) });
  });
  await page.getByRole("button", { name: /Publicar Produto/ }).click();
  await page.waitForTimeout(5000);

  // O produto criado tem imagens?
  const headers = await AUTH_HEADERS();
  const list = await (
    await fetch(`http://localhost:3001/api/v1/products?search=${sku}&limit=1`, { headers })
  ).json();
  const id = list.data?.[0]?.id;
  const detail = id
    ? await (await fetch(`http://localhost:3001/api/v1/products/${id}`, { headers })).json()
    : null;

  note("imagens.novo-produto", {
    uploadRequests: uploads,
    uiAfterPick: uiState,
    createResponses: created,
    productImages: detail?.data?.images ?? null,
    imagesLength: (detail?.data?.images ?? []).length,
    toasts: await toasts(page),
    urlAfter: page.url(),
    http: noise.http,
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 12. Limpeza da massa criada por esta auditoria
// ─────────────────────────────────────────────────────────────────────────

test("EST-cleanup: remove a massa qa-est", async () => {
  const headers = await AUTH_HEADERS();
  const removed: string[] = [];

  const products = await (
    await fetch("http://localhost:3001/api/v1/products?search=qa-est&limit=100", { headers })
  ).json();
  for (const p of products.data ?? []) {
    const r = await fetch(`http://localhost:3001/api/v1/products/${p.id}`, {
      method: "DELETE",
      headers,
    });
    if (r.status >= 400) {
      // Produto com movimentação não pode ser excluído — inativa para não
      // poluir a lista dos outros agentes.
      const inact = await fetch(`http://localhost:3001/api/v1/products/${p.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      removed.push(`produto ${p.sku} → DELETE ${r.status}, INACTIVE ${inact.status}`);
    } else {
      removed.push(`produto ${p.sku} → ${r.status}`);
    }
  }

  const cats = await (
    await fetch("http://localhost:3001/api/v1/products/categories", { headers })
  ).json();
  const flat = (nodes: { id: string; name: string; children?: unknown[] }[]): { id: string; name: string }[] =>
    (nodes ?? []).flatMap((c) => [
      c,
      ...flat((c.children ?? []) as { id: string; name: string; children?: unknown[] }[]),
    ]);
  for (const c of flat(cats.data ?? []).filter((c) => c.name.includes("qa-est"))) {
    const r = await fetch(`http://localhost:3001/api/v1/products/categories/${c.id}`, {
      method: "DELETE",
      headers,
    });
    removed.push(`categoria ${c.name} → ${r.status}`);
  }

  const brands = await (
    await fetch("http://localhost:3001/api/v1/products/brands", { headers })
  ).json();
  for (const b of (brands.data ?? []).filter((b: { name: string }) => b.name.includes("qa-est"))) {
    const r = await fetch(`http://localhost:3001/api/v1/products/brands/${b.id}`, {
      method: "DELETE",
      headers,
    });
    removed.push(`marca ${b.name} → ${r.status}`);
  }

  note("cleanup", removed);
});

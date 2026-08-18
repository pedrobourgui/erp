/**
 * QA UX/UI — módulo Financeiro + Dashboard (prefixo FIN).
 *
 * Tudo aqui é observação: as únicas mutações disparadas são as que o backend
 * **recusa** (transferência sem saldo, sangria maior que o caixa), justamente
 * para comparar o toast com o corpo da resposta HTTP. Nenhum caixa é aberto ou
 * fechado — outros agentes dependem do estado do caixa.
 */
import path from "node:path";

import {
  test,
  expect,
  authenticate,
  captureNoise,
  visit,
  measure,
  API_URL,
  apiLogin,
} from "./qa-fixtures";
import type { Page } from "@playwright/test";

const ART = path.resolve(__dirname, "artifacts", "fin");

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

/** Espera a casca autenticada terminar de montar (o spinner do layout some). */
async function settled(page: Page, heading: RegExp, extra = 1200) {
  await page.getByRole("heading", { name: heading }).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(extra);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(ART, `${name}.png`), fullPage });
  return path.join(ART, `${name}.png`);
}

/** Resolve um token do design system para o rgb que o browser realmente pinta. */
async function tokenRgb(page: Page, cssVar: string) {
  return page.evaluate((v) => {
    const el = document.createElement("div");
    el.style.color = `hsl(var(${v}))`;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, cssVar);
}

/** Texto de todos os toasts visíveis. */
async function toastTexts(page: Page) {
  const items = page.locator("div.fixed.bottom-4.right-4 > div");
  const n = await items.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push((await items.nth(i).innerText()).replace(/\s+/g, " ").trim());
  return out;
}

/** Cor computada + classes de um elemento, para provar token vs literal. */
async function styleOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim().slice(0, 60),
      color: cs.color,
      classes: (el.className || "").toString(),
      textAlign: cs.textAlign,
      whiteSpace: cs.whiteSpace,
    };
  }, selector);
}

function logFinding(id: string, data: unknown) {
  // eslint-disable-next-line no-console
  console.log(`\n[${id}] ${JSON.stringify(data, null, 2)}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────

test("FIN dashboard — baseline 1440 claro: medições, KPIs e cor de tendência", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/", 3500);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const m = await measure(page);
  logFinding("FIN dashboard 1440", {
    horizontalOverflow: m.horizontalOverflow,
    docScrollWidth: m.docScrollWidth,
    hardcodedColors: m.hardcodedColors,
    lowContrast: m.lowContrast.slice(0, 8),
    oddSpacing: m.oddSpacing,
    inconsistentRadius: m.inconsistentRadius,
    smallHitTargets: m.smallHitTargets,
    clippedNoScroll: m.clippedNoScroll,
  });

  // Grid de KPIs: gap e padding do card, para comparar com o financeiro.
  const kpiGeom = await page.evaluate(() => {
    const card = document.querySelector('[class*="rounded-xl"][class*="bg-card"]');
    const grid = card?.parentElement?.parentElement ?? null;
    const inner = card?.querySelector("div");
    return {
      gridClasses: (grid?.className || "").toString(),
      gridGap: grid ? getComputedStyle(grid).gap : null,
      cardPadding: inner ? getComputedStyle(inner).padding : null,
      cardRadius: card ? getComputedStyle(card).borderRadius : null,
      cardBorder: card ? getComputedStyle(card).borderColor : null,
    };
  });
  logFinding("FIN dashboard geometria KPI", kpiGeom);

  // FIN-04: a tendência do "Ticket Médio" usa emerald/red literais.
  const trend = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("span")).filter((s) =>
      /^[+-]?\d+[.,]\d%$/.test((s.textContent || "").trim())
    );
    return spans.map((s) => ({
      text: (s.textContent || "").trim(),
      color: getComputedStyle(s).color,
      classes: (s.className || "").toString(),
    }));
  });
  const successRgb = await tokenRgb(page, "--success");
  const dangerRgb = await tokenRgb(page, "--danger");
  logFinding("FIN-04 tendência do KPI", { trend, successRgb, dangerRgb });

  // Sparkline: a cor é literal no SVG, não token.
  const sparkStroke = await page.evaluate(() => {
    const p = document.querySelector(".recharts-area-curve");
    return p ? (p as SVGElement).getAttribute("stroke") : null;
  });
  logFinding("FIN-04 sparkline stroke", { sparkStroke, successRgb });

  await shot(page, "dashboard-1440-light");
  logFinding("FIN dashboard ruído", noise);
});

test("FIN dashboard — gráficos: eixo pt-BR, tooltip e legenda", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/", 3500);

  const axes = await page.evaluate(() => {
    const read = (sel: string) =>
      Array.from(document.querySelectorAll(`${sel} text`)).map((t) => (t.textContent || "").trim());
    return {
      xTicks: read(".recharts-xAxis"),
      yTicks: read(".recharts-yAxis"),
      tickStyles: Array.from(document.querySelectorAll(".recharts-cartesian-axis-tick text")).slice(0, 3).map((t) => {
        const cs = getComputedStyle(t);
        return { fill: cs.fill, fontSize: cs.fontSize };
      }),
    };
  });
  logFinding("FIN gráficos — eixos", axes);

  // Tooltip do gráfico de área "Vendas do Período" (a 1ª .recharts-surface da
  // página é o sparkline do KPI, que não tem tooltip).
  const salesCard = page.locator('[class*="bg-card"]', { hasText: "Vendas do Período" }).first();
  const chart = salesCard.locator(".recharts-surface").first();
  const box = await chart.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.55);
    await page.waitForTimeout(800);
  }
  const tip = salesCard.locator(".recharts-tooltip-wrapper");
  const tipText = (await tip.count()) ? (await tip.first().innerText().catch(() => "")).replace(/\s+/g, " ") : "";
  const tipStyle = await page.evaluate(() => {
    const w = document.querySelector(".recharts-default-tooltip");
    if (!w) return null;
    const cs = getComputedStyle(w);
    return { bg: cs.backgroundColor, border: cs.border, radius: cs.borderRadius, color: cs.color };
  });
  logFinding("FIN gráficos — tooltip", { tipText, tipStyle });

  // Barras: legenda e cor
  const bars = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".recharts-bar-rectangle path"));
    return {
      count: rects.length,
      fills: Array.from(new Set(rects.map((r) => r.getAttribute("fill")))),
      legenda: Array.from(document.querySelectorAll(".recharts-legend-item")).length,
    };
  });
  logFinding("FIN gráficos — barras", bars);

  // Contraste dos textos dentro do SVG (measure() não enxerga <text> do SVG:
  // ele filtra por childNodes de texto em HTML). Cálculo direto aqui.
  const svgContrast = await page.evaluate(() => {
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
    const bg = getComputedStyle(document.body).backgroundColor;
    const cardBg = (() => {
      const card = document.querySelector('[class*="bg-card"]');
      return card ? getComputedStyle(card).backgroundColor : bg;
    })();
    const out: { text: string; fill: string; size: string; ratio: number }[] = [];
    for (const t of Array.from(document.querySelectorAll(".recharts-cartesian-axis-tick text"))) {
      const cs = getComputedStyle(t);
      const l1 = lum(cs.fill);
      const l2 = lum(cardBg);
      if (l1 === null || l2 === null) continue;
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      out.push({ text: (t.textContent || "").trim(), fill: cs.fill, size: cs.fontSize, ratio: +ratio.toFixed(2) });
    }
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.fill + o.size) ? false : (seen.add(o.fill + o.size), true)));
  });
  logFinding("FIN gráficos — contraste do eixo", svgContrast);

  await shot(page, "dashboard-charts-light", false);
});

test("FIN dashboard — dark mode", async ({ page }) => {
  await authenticate(page, "owner", "dark");
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/", 3500);

  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  const m = await measure(page);
  logFinding("FIN dashboard dark", {
    isDark,
    lowContrast: m.lowContrast.slice(0, 10),
    hardcodedColors: m.hardcodedColors,
  });

  const trendDark = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll("span")).filter((s) =>
      /^[+-]?\d+[.,]\d%$/.test((s.textContent || "").trim())
    );
    return spans.map((s) => ({ text: (s.textContent || "").trim(), color: getComputedStyle(s).color }));
  });
  const svgContrastDark = await page.evaluate(() => {
    const lum = (c: string) => {
      const m2 = c.match(/[\d.]+/g);
      if (!m2) return null;
      const [r, g, b] = m2.map(Number);
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const card = document.querySelector('[class*="bg-card"]');
    const cardBg = card ? getComputedStyle(card).backgroundColor : getComputedStyle(document.body).backgroundColor;
    const out: { fill: string; size: string; ratio: number }[] = [];
    for (const t of Array.from(document.querySelectorAll(".recharts-cartesian-axis-tick text"))) {
      const cs = getComputedStyle(t);
      const l1 = lum(cs.fill);
      const l2 = lum(cardBg);
      if (l1 === null || l2 === null) continue;
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      out.push({ fill: cs.fill, size: cs.fontSize, ratio: +ratio.toFixed(2) });
    }
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.fill + o.size) ? false : (seen.add(o.fill + o.size), true)));
  });
  logFinding("FIN dashboard dark — tendência e eixo", { trendDark, svgContrastDark });

  await shot(page, "dashboard-1440-dark");
});

test("FIN dashboard — isError vira skeleton eterno", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.route("**/api/v1/reports/dashboard*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, statusCode: 500, message: "Internal server error" }),
    })
  );
  await visit(page, "/", 1500);
  await settled(page, /^Dashboard$/, 4000);

  const state = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      skeletons: document.querySelectorAll(".animate-pulse").length,
      hasErrorWord: /erro|não foi possível|tente novamente|falha/i.test(body),
      salesSection: /Sem vendas no período/.test(body),
      statusSection: /Sem dados disponíveis/.test(body),
      kpiLabels: /Vendas do Dia|Ticket Médio/.test(body),
    };
  });
  logFinding("FIN-02 dashboard em erro", state);
  await shot(page, "dashboard-error-500");

  expect(state.skeletons, "KPIs continuam em skeleton após o 500").toBeGreaterThan(0);
  expect(state.hasErrorWord, "nenhuma menção de erro na tela").toBeFalsy();
});

test("FIN dashboard — responsivo 390 e 768", async ({ page }) => {
  await authenticate(page);
  for (const [name, vp] of [["390", VIEWPORTS.mobile], ["768", VIEWPORTS.tablet]] as const) {
    await page.setViewportSize(vp);
    await visit(page, "/", 1500);
    await settled(page, /^Dashboard$/, 2500);
    const m = await measure(page);
    const grid = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("div")).find((d) =>
        /grid gap-5 (md:grid-cols-2|lg:grid-cols)/.test((d.className || "").toString())
      );
      return el ? { cols: getComputedStyle(el).gridTemplateColumns, gap: getComputedStyle(el).gap } : null;
    });
    logFinding(`FIN dashboard ${name}px`, {
      horizontalOverflow: m.horizontalOverflow,
      docScrollWidth: m.docScrollWidth,
      docClientWidth: m.docClientWidth,
      clippedNoScroll: m.clippedNoScroll,
      grid,
    });
    await shot(page, `dashboard-${name}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// /financeiro
// ─────────────────────────────────────────────────────────────────────────

test("FIN /financeiro — redireciona para lançamentos", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro", 1000);
  // O redirect é do servidor, mas em dev o primeiro acesso compila a rota; com
  // 6 agentes no mesmo servidor isso passa de 30 s.
  await page.waitForURL("**/financeiro/lancamentos", { timeout: 90_000 }).catch(() => {});
  logFinding("FIN /financeiro", { url: page.url() });
  expect(page.url()).toContain("/financeiro/lancamentos");
});

// ─────────────────────────────────────────────────────────────────────────
// /financeiro/contas
// ─────────────────────────────────────────────────────────────────────────

test("FIN contas — baseline, cabeçalho, saldo negativo e botão só-ícone", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/contas", 3500);

  await expect(page.getByRole("heading", { name: /Contas Financeiras/i })).toBeVisible();

  const m = await measure(page);
  logFinding("FIN contas 1440", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    hardcodedColors: m.hardcodedColors,
    lowContrast: m.lowContrast.slice(0, 6),
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
  });

  // Cabeçalho: título, busca, painel de filtros e ações no MESMO flex row.
  const header = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const row = h1?.parentElement?.parentElement ?? null;
    if (!row) return null;
    const kids = Array.from(row.children).map((c) => {
      const r = c.getBoundingClientRect();
      return {
        tag: c.tagName.toLowerCase(),
        classes: (c.className || "").toString().slice(0, 90),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 45),
      };
    });
    return { rowClasses: (row.className || "").toString(), display: getComputedStyle(row).display, kids };
  });
  logFinding("FIN-01 cabeçalho de contas", header);

  // Saldo negativo: cor e nowrap
  const balances = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    return rows.slice(0, 6).map((r) => {
      const td = r.querySelectorAll("td")[3];
      const cs = td ? getComputedStyle(td) : null;
      return {
        text: (td?.textContent || "").trim(),
        color: cs?.color ?? null,
        whiteSpace: cs?.whiteSpace ?? null,
        textAlign: cs?.textAlign ?? null,
        classes: (td?.className || "").toString(),
      };
    });
  });
  const dangerRgb = await tokenRgb(page, "--danger");
  const fgRgb = await tokenRgb(page, "--foreground");
  logFinding("FIN-07 saldo das contas", { balances, dangerRgb, fgRgb });

  // Botão só-ícone de editar
  const editBtn = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("tbody button")).find((x) => x.querySelector("svg"));
    if (!b) return null;
    return {
      ariaLabel: b.getAttribute("aria-label"),
      title: b.getAttribute("title"),
      innerText: (b.textContent || "").trim(),
      hasSrOnly: !!b.querySelector(".sr-only"),
      classes: (b.className || "").toString().slice(0, 80),
    };
  });
  // e o tooltip realmente aparece?
  const firstEdit = page.locator("tbody button").first();
  await firstEdit.hover();
  await page.waitForTimeout(700);
  const tooltipVisible = await page.locator('[role="tooltip"], [data-radix-popper-content-wrapper]').count();
  logFinding("FIN-09 botão editar conta", { editBtn, tooltipVisible });

  // Texto sem acento (FN-27)
  const missingAccents = await page.evaluate(() => {
    const body = document.body.innerText;
    return ["bancarias", "Codigo", "Agencia", "Nao"].filter((w) => new RegExp(`\\b${w}\\b`).test(body));
  });
  logFinding("FIN-19 acentuação", { missingAccents });

  await shot(page, "contas-1440-light");
  logFinding("FIN contas ruído", noise);
});

test("FIN contas — 500 renderizado como estado vazio (AE-28)", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.route("**/api/v1/financial-accounts*", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, statusCode: 500, message: "Internal server error" }),
    });
  });
  await visit(page, "/financeiro/contas", 1500);
  await settled(page, /Contas Financeiras/, 3000);

  const body = await page.evaluate(() => document.body.innerText);
  const state = {
    saysEmpty: /Nenhuma conta financeira cadastrada/.test(body),
    saysError: /não foi possível|erro|falha|tente novamente/i.test(body),
  };
  logFinding("FIN-03 contas em erro", state);
  await shot(page, "contas-error-500");

  expect(state.saysEmpty, 'a tela diz "Nenhuma conta financeira cadastrada" em cima de um 500').toBeTruthy();
  expect(state.saysError).toBeFalsy();
});

test("FIN contas/lançamentos/caixa — papel seller (sem financial:read)", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "seller");
  await page.setViewportSize(VIEWPORTS.desktop);

  for (const route of ["/financeiro/contas", "/financeiro/lancamentos", "/financeiro/caixa"]) {
    await visit(page, route, 1500);
    // espera a casca montar: ou a negativa, ou (se o guarda falhar) o título
    await page
      .getByText(/não tem permissão|Acesso negado/i)
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText);
    logFinding(`FIN seller ${route}`, {
      url: page.url(),
      deniedState: /acesso negado|não tem permissão|sem permissão/i.test(body),
      emptyState: /Nenhuma conta financeira cadastrada|Nenhum caixa cadastrado|Nenhum lançamento/i.test(body),
      excerpt: body.replace(/\s+/g, " ").slice(0, 220),
    });
    await shot(page, `seller-${route.split("/").pop()}`);
  }
  logFinding("FIN seller ruído", { http: noise.http.slice(0, 10) });
});

test("FIN contas — transferência: saldo insuficiente e saldo negativo (toast x corpo HTTP)", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/contas", 1500);
  await settled(page, /Contas Financeiras/, 1500);

  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/financial-accounts/transfer")) {
      bodies.push(`${r.status()} ${await r.text().catch(() => "")}`);
    }
  });

  await page.getByRole("button", { name: /Transferência/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Opções do select de origem — nomes duplicados?
  const fromTrigger = dialog.locator("button[role=combobox]").first();
  await fromTrigger.click();
  await page.waitForTimeout(500);
  const options = await page.locator("[role=option]").allInnerTexts();
  const dup = options.filter((o, i) => options.indexOf(o) !== i);
  logFinding("FIN-12 opções do select de origem", { options, duplicadas: Array.from(new Set(dup)) });
  await shot(page, "contas-transfer-select", false);

  // Origem = Caixa Principal (tipo CASH, não pode ficar negativo)
  const caixaIdx = options.findIndex((o) => /Caixa Principal/i.test(o));
  await page.locator("[role=option]").nth(caixaIdx >= 0 ? caixaIdx : 0).click();
  await page.waitForTimeout(300);

  const toTrigger = dialog.locator("button[role=combobox]").nth(1);
  await toTrigger.click();
  await page.waitForTimeout(500);
  const toOptions = await page.locator("[role=option]").allInnerTexts();
  const digitalIdx = toOptions.findIndex((o) => /Conta Digital/i.test(o));
  await page.locator("[role=option]").nth(digitalIdx >= 0 ? digitalIdx : 1).click();
  await page.waitForTimeout(300);

  // A tela mostra o saldo da origem antes de submeter?
  const showsBalance = await dialog.evaluate((d) => /R\$\s?\d/.test(d.textContent || ""));
  logFinding("FIN-05 diálogo mostra saldo?", { showsBalance });

  const amount = dialog.locator('input[inputmode="numeric"]');
  await amount.click();
  await amount.type("99999900"); // R$ 999.999,00

  const submit = dialog.getByRole("button", { name: /^Transferir$/ });
  await submit.click();
  await page.waitForTimeout(2500);

  const toasts1 = await toastTexts(page);
  logFinding("FIN-05 transferência sem saldo", { toasts: toasts1, http: bodies });
  await shot(page, "contas-transfer-saldo-insuficiente");

  // O botão volta a ficar habilitado (não trava)
  logFinding("FIN transferência — botão após erro", {
    disabled: await submit.isDisabled(),
    dialogAindaAberto: await dialog.isVisible(),
  });

  // Agora o caso "Confirme para continuar": origem CHECKING zerada.
  await page.waitForTimeout(4200); // deixa o toast sumir
  await fromTrigger.click();
  await page.waitForTimeout(400);
  const opts2 = await page.locator("[role=option]").allInnerTexts();
  const santanderIdx = opts2.findIndex((o) => /^Santander$/i.test(o.trim()));
  if (santanderIdx >= 0) {
    await page.locator("[role=option]").nth(santanderIdx).click();
    await page.waitForTimeout(300);
    await amount.click();
    await page.keyboard.press("Control+A");
    await amount.fill("");
    await amount.type("10000"); // R$ 100,00
    await submit.click();
    await page.waitForTimeout(2500);
    const toasts2 = await toastTexts(page);
    const confirmControl = await dialog.evaluate(
      (d) => /confirmar|autorizo|permitir saldo negativo/i.test(d.textContent || "") ||
        !!d.querySelector('input[type="checkbox"]')
    );
    logFinding("FIN-05 transferência que deixa negativo", {
      toasts: toasts2,
      http: bodies,
      existeControleParaConfirmar: confirmControl,
    });
    await shot(page, "contas-transfer-confirme-para-continuar");
  }
});

test("FIN contas — diálogo Nova Conta: rótulos, altura e foco", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.mobile);
  await visit(page, "/financeiro/contas", 1500);
  await settled(page, /Contas Financeiras/, 1500);

  await page.getByRole("button", { name: /Nova Conta/i }).click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const info = await dialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    const labels = Array.from(d.querySelectorAll("label")).map((l) => ({
      text: (l.textContent || "").trim().slice(0, 30),
      htmlFor: l.getAttribute("for"),
      wrapsControl: !!l.querySelector("input,select,textarea"),
    }));
    const controls = Array.from(d.querySelectorAll("input,textarea,select")).map((i) => ({
      id: i.id || null,
      name: (i as HTMLInputElement).name || null,
      ariaLabel: i.getAttribute("aria-label"),
      ariaLabelledby: i.getAttribute("aria-labelledby"),
    }));
    return {
      top: Math.round(r.top),
      height: Math.round(r.height),
      viewport: window.innerHeight,
      overflowsViewport: r.height > window.innerHeight,
      maxHeight: cs.maxHeight,
      overflowY: cs.overflowY,
      radius: cs.borderRadius,
      ariaLabelledby: d.getAttribute("aria-labelledby"),
      ariaDescribedby: d.getAttribute("aria-describedby"),
      role: d.getAttribute("role"),
      labels,
      controls,
      labelsSemFor: labels.filter((l) => !l.htmlFor && !l.wrapsControl).length,
    };
  });
  logFinding("FIN-13/FIN-14 diálogo Nova Conta (390px)", info);
  await shot(page, "contas-dialog-390", false);

  // Foco visível no primeiro campo
  const focus = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] input') as HTMLInputElement | null;
    el?.focus();
    const cs = el ? getComputedStyle(el) : null;
    return { outline: cs?.outlineStyle, boxShadow: cs?.boxShadow?.slice(0, 60), classes: (el?.className || "").slice(0, 120) };
  });
  logFinding("FIN diálogo — foco", focus);
});

// ─────────────────────────────────────────────────────────────────────────
// /financeiro/lancamentos
// ─────────────────────────────────────────────────────────────────────────

test("FIN lançamentos — baseline, cores de valor, datas e cards", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/lancamentos", 4000);

  await expect(page.getByRole("heading", { name: /Despesas e Receitas/i })).toBeVisible();

  const m = await measure(page);
  logFinding("FIN lançamentos 1440", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    hardcodedColors: m.hardcodedColors,
    lowContrast: m.lowContrast.slice(0, 8),
    oddSpacing: m.oddSpacing,
    smallHitTargets: m.smallHitTargets,
    inconsistentRadius: m.inconsistentRadius,
  });

  const successRgb = await tokenRgb(page, "--success");
  const dangerRgb = await tokenRgb(page, "--danger");

  // Cards de totais: cor, padding e gap — comparar com o KPI do dashboard.
  const totals = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="rounded-xl"][class*="bg-card"]')).slice(0, 4);
    const grid = cards[0]?.parentElement ?? null;
    return {
      gridGap: grid ? getComputedStyle(grid).gap : null,
      gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      cards: cards.map((c) => {
        const value = c.querySelector("p.text-2xl");
        const inner = c.querySelector("div");
        return {
          label: (c.querySelector("p.text-sm")?.textContent || "").trim(),
          value: (value?.textContent || "").trim(),
          color: value ? getComputedStyle(value).color : null,
          classes: (value?.className || "").toString(),
          padding: inner ? getComputedStyle(inner).padding : null,
        };
      }),
    };
  });
  logFinding("FIN-04 cards de totais", { totals, successRgb, dangerRgb });

  // Coluna Valor da tabela
  const amounts = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr")).slice(0, 8);
    return rows.map((r) => {
      const tds = Array.from(r.querySelectorAll("td"));
      const amountTd = tds[5];
      const span = amountTd?.querySelector("span");
      const dateTd = tds[0];
      return {
        date: (dateTd?.textContent || "").trim(),
        amount: (amountTd?.textContent || "").trim(),
        color: span ? getComputedStyle(span).color : null,
        classes: (span?.className || "").toString(),
        whiteSpace: amountTd ? getComputedStyle(amountTd).whiteSpace : null,
        textAlign: amountTd ? getComputedStyle(amountTd).textAlign : null,
        rowClasses: (r.className || "").toString(),
      };
    });
  });
  logFinding("FIN-04 coluna Valor", { amounts, successRgb, dangerRgb });

  // Linha OVERDUE: bg literal
  const overdueRow = await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll("tbody tr")).find((x) =>
      /bg-red-50/.test((x.className || "").toString())
    );
    return r ? { classes: (r.className || "").toString(), bg: getComputedStyle(r).backgroundColor } : null;
  });
  logFinding("FIN-04 linha vencida", overdueRow);

  await shot(page, "lancamentos-1440-light");
  logFinding("FIN lançamentos ruído", { http: noise.http.slice(0, 8), console: noise.console.slice(0, 5) });
});

test("FIN lançamentos — filtro de período invertido e datas civis", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/lancamentos", 4000);

  const requests: string[] = [];
  const responses: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/financial-entries?")) requests.push(r.url().split("/api/v1")[1]);
  });
  page.on("response", async (r) => {
    if (r.url().includes("/financial-entries?")) {
      const body = await r.text().catch(() => "");
      responses.push(`${r.status()} total=${(body.match(/"total":(\d+)/) || [])[1]}`);
    }
  });

  const de = page.locator('input[type="date"]').first();
  const ate = page.locator('input[type="date"]').nth(1);

  // ordem invertida: preenche "Até" antes de "De"
  await ate.fill("2026-01-01");
  await page.waitForTimeout(800);
  await de.fill("2026-12-31");
  await page.waitForTimeout(2000);

  const inverted = await page.evaluate(() => {
    const body = document.body.innerText;
    const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
    return {
      aviso: /data final deve ser posterior/i.test(body),
      values: inputs.map((i) => (i as HTMLInputElement).value),
      minMax: inputs.map((i) => ({ min: i.getAttribute("min"), max: i.getAttribute("max") })),
      ariaInvalid: inputs.map((i) => i.getAttribute("aria-invalid")),
      bordas: inputs.map((i) => getComputedStyle(i).borderColor),
      tabelaVazia: /Nenhum lançamento encontrado/.test(body),
      linhas: document.querySelectorAll("tbody tr").length,
      primeiraData: (document.querySelector("tbody tr td")?.textContent || "").trim(),
      totaisCards: Array.from(document.querySelectorAll("p.text-2xl")).map((p) => (p.textContent || "").trim()),
      rodape: (document.querySelector("div.text-sm.text-muted-foreground")?.textContent || "").trim(),
    };
  });
  logFinding("FIN-06 período invertido", { ...inverted, requests, responses });
  await shot(page, "lancamentos-periodo-invertido");

  // Data civil: comparar o que a API devolve com o que a célula mostra
  const session = await apiLogin("owner");
  const apiRows = await fetch(`${API_URL}/financial-entries?limit=5`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  }).then((r) => r.json() as Promise<{ data: { date: string; description: string }[] }>);
  await de.fill("");
  await ate.fill("");
  await page.waitForTimeout(2500);
  const uiRows = await page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody tr"))
      .slice(0, 5)
      .map((r) => {
        const tds = r.querySelectorAll("td");
        return { date: (tds[0]?.textContent || "").trim(), description: (tds[1]?.textContent || "").trim() };
      })
  );
  logFinding("FIN datas civis", {
    api: apiRows.data?.slice(0, 5).map((r) => ({ date: r.date, description: r.description })),
    ui: uiRows,
  });
});

test("FIN lançamentos — baixa: valor zero, botão travado e toast de erro", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/lancamentos", 1500);
  await settled(page, /Despesas e Receitas/, 2500);

  const settle = page.getByRole("button", { name: /Receber|Pagar/ }).first();
  if (!(await settle.count())) {
    logFinding("FIN baixa", { skipped: "nenhum título em aberto na primeira página" });
    return;
  }
  await settle.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const dialogInfo = await dialog.evaluate((d) => ({
    titulo: (d.querySelector("h2,[id]")?.textContent || "").trim().slice(0, 60),
    descricao: (d.textContent || "").replace(/\s+/g, " ").slice(0, 160),
    ariaLabelledby: d.getAttribute("aria-labelledby"),
    ariaDescribedby: d.getAttribute("aria-describedby"),
    labelsSemFor: Array.from(d.querySelectorAll("label")).filter(
      (l) => !l.getAttribute("for") && !l.querySelector("input,select,textarea")
    ).length,
  }));
  logFinding("FIN-13 diálogo de baixa", dialogInfo);

  // valor zero → zod deve recusar com mensagem visível
  const amount = dialog.locator('input[inputmode="numeric"]');
  await amount.click();
  await page.keyboard.press("Control+A");
  await amount.fill("");
  await page.waitForTimeout(200);
  await dialog.getByRole("button", { name: /Confirmar baixa/i }).click();
  await page.waitForTimeout(1200);

  const zero = await dialog.evaluate((d) => ({
    mensagem: Array.from(d.querySelectorAll(".text-destructive")).map((e) => (e.textContent || "").trim()),
    aindaAberto: true,
    valorNoInput: (d.querySelector('input[inputmode="numeric"]') as HTMLInputElement)?.value,
  }));
  logFinding("FIN-24 baixa com valor zero", zero);
  await shot(page, "lancamentos-baixa-valor-zero", false);

  await page.keyboard.press("Escape");
});

test("FIN lançamentos — responsivo 390 e 768", async ({ page }) => {
  await authenticate(page);
  for (const [name, vp] of [["390", VIEWPORTS.mobile], ["768", VIEWPORTS.tablet]] as const) {
    await page.setViewportSize(vp);
    await visit(page, "/financeiro/lancamentos", 1500);
    await settled(page, /Despesas e Receitas/, 2500);
    const m = await measure(page);
    const table = await page.evaluate(() => {
      const wrap = document.querySelector("table")?.parentElement ?? null;
      const t = document.querySelector("table");
      return wrap && t
        ? {
            wrapClasses: (wrap.className || "").toString(),
            overflowX: getComputedStyle(wrap).overflowX,
            wrapClientWidth: wrap.clientWidth,
            tableScrollWidth: t.scrollWidth,
            rolaNoContainer: wrap.scrollWidth > wrap.clientWidth,
          }
        : null;
    });
    const header = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const row = h1?.parentElement?.parentElement ?? null;
      return row ? { display: getComputedStyle(row).display, flexWrap: getComputedStyle(row).flexWrap, classes: (row.className || "").toString() } : null;
    });
    logFinding(`FIN lançamentos ${name}px`, {
      horizontalOverflow: m.horizontalOverflow,
      docScrollWidth: m.docScrollWidth,
      docClientWidth: m.docClientWidth,
      clippedNoScroll: m.clippedNoScroll,
      table,
      header,
    });
    await shot(page, `lancamentos-${name}`);
  }
});

test("FIN lançamentos — dark mode", async ({ page }) => {
  await authenticate(page, "owner", "dark");
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/lancamentos", 1500);
  await settled(page, /Despesas e Receitas/, 2500);
  const m = await measure(page);
  const cards = await page.evaluate(() => {
    const vals = Array.from(document.querySelectorAll("p.text-2xl"));
    return vals.map((v) => ({ text: (v.textContent || "").trim(), color: getComputedStyle(v).color, classes: (v.className || "").toString() }));
  });
  const overdueRow = await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll("tbody tr")).find((x) => /bg-red-50/.test((x.className || "").toString()));
    return r ? getComputedStyle(r).backgroundColor : null;
  });
  logFinding("FIN lançamentos dark", { lowContrast: m.lowContrast.slice(0, 10), cards, overdueRow });
  await shot(page, "lancamentos-1440-dark");
});

// ─────────────────────────────────────────────────────────────────────────
// /financeiro/caixa
// ─────────────────────────────────────────────────────────────────────────

test("FIN caixa — baseline, histórico e colunas monetárias", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/caixa", 4000);

  await expect(page.getByRole("heading", { name: /^Caixas$/ })).toBeVisible();

  const m = await measure(page);
  logFinding("FIN caixa 1440", {
    horizontalOverflow: m.horizontalOverflow,
    clippedNoScroll: m.clippedNoScroll,
    hardcodedColors: m.hardcodedColors,
    lowContrast: m.lowContrast.slice(0, 8),
    smallHitTargets: m.smallHitTargets,
    oddSpacing: m.oddSpacing,
  });

  // Colunas monetárias do histórico de sessões: nowrap + alinhamento
  const history = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table"));
    const t = tables[tables.length - 1];
    if (!t) return null;
    const headers = Array.from(t.querySelectorAll("thead th")).map((h) => (h.textContent || "").trim());
    const firstRow = t.querySelector("tbody tr");
    const cells = firstRow
      ? Array.from(firstRow.querySelectorAll("td")).map((td) => ({
          text: (td.textContent || "").trim().slice(0, 24),
          whiteSpace: getComputedStyle(td).whiteSpace,
          textAlign: getComputedStyle(td).textAlign,
          truncated: !!td.querySelector("span.truncate"),
        }))
      : null;
    return { headers, cells };
  });
  logFinding("FIN-10 histórico de sessões", history);

  // Cartões de caixa: ações e tooltips
  const cardButtons = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[class*="rounded-xl"][class*="bg-card"]'));
    const out: { card: string; label: string; ariaLabel: string | null; onlyIcon: boolean }[] = [];
    for (const c of cards) {
      const title = (c.querySelector("[class*=text-base]")?.textContent || "").trim();
      for (const b of Array.from(c.querySelectorAll("button"))) {
        const txt = (b.textContent || "").trim();
        out.push({ card: title, label: txt, ariaLabel: b.getAttribute("aria-label"), onlyIcon: txt.length === 0 });
      }
    }
    return out;
  });
  logFinding("FIN caixa — botões dos cartões", cardButtons);

  const summary = await page.evaluate(() => {
    const vals = Array.from(document.querySelectorAll("p.text-2xl"));
    return vals.map((v) => ({ text: (v.textContent || "").trim(), color: getComputedStyle(v).color, classes: (v.className || "").toString() }));
  });
  logFinding("FIN-04 cartões de resumo do caixa", { summary, successRgb: await tokenRgb(page, "--success") });

  await shot(page, "caixa-1440-light");
  logFinding("FIN caixa ruído", { http: noise.http.slice(0, 8), console: noise.console.slice(0, 5) });
});

test("FIN caixa — fechamento sem conferência (o diálogo não mostra o esperado)", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/caixa", 1500);
  await settled(page, /^Caixas$/, 2500);

  const closeBtn = page.getByRole("button", { name: /^Fechar$/ }).first();
  if (!(await closeBtn.count())) {
    logFinding("FIN fechamento", { skipped: "nenhum caixa aberto" });
    return;
  }
  await closeBtn.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const info = await dialog.evaluate((d) => {
    const txt = (d.textContent || "").replace(/\s+/g, " ");
    return {
      texto: txt.slice(0, 260),
      mostraSaldoEsperado: /esperado|saldo do sistema|saldo atual|diferença/i.test(txt),
      mostraValorMonetario: /R\$\s?\d/.test(txt),
      campos: Array.from(d.querySelectorAll("input,textarea")).map((i) => ({
        tipo: i.getAttribute("type") ?? i.tagName.toLowerCase(),
        id: i.id || null,
        placeholder: i.getAttribute("placeholder"),
      })),
      labelsSemFor: Array.from(d.querySelectorAll("label")).filter(
        (l) => !l.getAttribute("for") && !l.querySelector("input,select,textarea")
      ).length,
    };
  });
  logFinding("FIN-11 diálogo de fechamento", info);
  await shot(page, "caixa-fechamento-sem-conferencia", false);

  // NÃO fechar o caixa: outro agente pode depender do estado.
  await dialog.getByRole("button", { name: /Cancelar/ }).click();
  await page.waitForTimeout(400);
  logFinding("FIN fechamento", { cancelado: !(await dialog.isVisible().catch(() => false)) });
});

test("FIN caixa — sangria maior que o saldo: toast x corpo HTTP", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/caixa", 1500);
  await settled(page, /^Caixas$/, 2500);

  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (/\/cash-registers\/.+\/(withdraw|supply)/.test(r.url())) {
      bodies.push(`${r.status()} ${await r.text().catch(() => "")}`);
    }
  });

  // botão só-ícone de sangria (ArrowDownCircle) — o 3º botão do cartão aberto
  const openCard = page.locator('[class*="rounded-xl"]', { has: page.getByText("Aberto", { exact: true }) }).first();
  const sangria = openCard.locator("button").nth(2);
  if (!(await sangria.count())) {
    logFinding("FIN sangria", { skipped: "nenhum caixa aberto" });
    return;
  }
  await sangria.hover();
  await page.waitForTimeout(600);
  const tip = await page.locator('[role="tooltip"], [data-radix-popper-content-wrapper]').first().innerText().catch(() => "");
  logFinding("FIN caixa — tooltip do botão só-ícone", { tip });

  await sangria.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  const titulo = await dialog.locator("h2").first().innerText();
  logFinding("FIN sangria — diálogo", { titulo, mostraSaldoDisponivel: /R\$\s?\d/.test(await dialog.innerText()) });

  const amount = dialog.locator('input[inputmode="numeric"]');
  await amount.click();
  await amount.type("99999900"); // R$ 999.999,00
  await dialog.locator('input[placeholder="Motivo da movimentação"]').fill(`qa-fin-${Date.now()}`);
  await dialog.getByRole("button", { name: /Confirmar/ }).click();
  await page.waitForTimeout(2500);

  const toasts = await toastTexts(page);
  logFinding("FIN-11 sangria sem saldo", { toasts, http: bodies });
  await shot(page, "caixa-sangria-sem-saldo");

  await page.keyboard.press("Escape");
});

test("FIN caixa — 500 renderizado como estado vazio", async ({ page }) => {
  await authenticate(page);
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.route("**/api/v1/cash-registers*", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, statusCode: 500, message: "Internal server error" }),
    });
  });
  await visit(page, "/financeiro/caixa", 1500);
  await settled(page, /^Caixas$/, 3000);

  const body = await page.evaluate(() => document.body.innerText);
  const state = {
    saysEmpty: /Nenhum caixa cadastrado/.test(body),
    saysError: /não foi possível carregar/i.test(body),
    resumoZerado: /Total de Caixas\s*0/.test(body.replace(/\n/g, " ")),
  };
  logFinding("FIN-03b caixa em erro", state);
  await shot(page, "caixa-error-500");
  expect(state.saysEmpty, 'a grade diz "Nenhum caixa cadastrado" em cima de um 500').toBeTruthy();
});

test("FIN caixa — dark mode e responsivo 390", async ({ page }) => {
  await authenticate(page, "owner", "dark");
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/caixa", 1500);
  await settled(page, /^Caixas$/, 2500);
  const mDark = await measure(page);
  logFinding("FIN caixa dark", { lowContrast: mDark.lowContrast.slice(0, 8), hardcodedColors: mDark.hardcodedColors });
  await shot(page, "caixa-1440-dark");

  await page.setViewportSize(VIEWPORTS.mobile);
  await visit(page, "/financeiro/caixa", 1500);
  await settled(page, /^Caixas$/, 2500);
  const m390 = await measure(page);
  logFinding("FIN caixa 390", {
    horizontalOverflow: m390.horizontalOverflow,
    docScrollWidth: m390.docScrollWidth,
    docClientWidth: m390.docClientWidth,
    clippedNoScroll: m390.clippedNoScroll,
  });
  await shot(page, "caixa-390-dark");
});

test("FIN contas — dark mode e responsivo 390", async ({ page }) => {
  await authenticate(page, "owner", "dark");
  await page.setViewportSize(VIEWPORTS.desktop);
  await visit(page, "/financeiro/contas", 1500);
  await settled(page, /Contas Financeiras/, 2500);
  const mDark = await measure(page);
  logFinding("FIN contas dark", { lowContrast: mDark.lowContrast.slice(0, 8), hardcodedColors: mDark.hardcodedColors });
  await shot(page, "contas-1440-dark");

  await page.setViewportSize(VIEWPORTS.mobile);
  await visit(page, "/financeiro/contas", 1500);
  await settled(page, /Contas Financeiras/, 2500);
  const m390 = await measure(page);
  const header = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const row = h1?.parentElement?.parentElement ?? null;
    const table = document.querySelector("table")?.parentElement ?? null;
    return {
      headerDisplay: row ? getComputedStyle(row).display : null,
      headerFlexWrap: row ? getComputedStyle(row).flexWrap : null,
      headerScrollWidth: row?.scrollWidth,
      headerClientWidth: row?.clientWidth,
      tableWrapOverflow: table ? getComputedStyle(table).overflowX : null,
    };
  });
  // FIN-01: os controles do cabeçalho ficam fora da tela e não há scroll.
  const offscreen = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const row = h1?.parentElement?.parentElement ?? null;
    if (!row) return null;
    const vw = document.documentElement.clientWidth;
    return Array.from(row.querySelectorAll("button,input")).map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(Math.min(Math.max(cx, 0), vw - 1), cy);
      return {
        rotulo: (el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 30),
        left: Math.round(r.left),
        right: Math.round(r.right),
        viewportWidth: vw,
        foraDaTela: r.right > vw,
        alcancavelPorClique: !!hit && (hit === el || el.contains(hit)),
      };
    });
  });
  logFinding("FIN contas 390", {
    horizontalOverflow: m390.horizontalOverflow,
    docScrollWidth: m390.docScrollWidth,
    docClientWidth: m390.docClientWidth,
    clippedNoScroll: m390.clippedNoScroll,
    header,
    controlesDoCabecalho: offscreen,
  });
  await shot(page, "contas-390-dark");

  // Prova final: dá para clicar em "Nova Conta" a 390 px?
  const novaConta = page.getByRole("button", { name: /Nova Conta/i });
  const box = await novaConta.boundingBox();
  logFinding("FIN-01 botão Nova Conta a 390px", {
    box,
    dentroDaTela: box ? box.x + box.width <= 390 : null,
  });
});

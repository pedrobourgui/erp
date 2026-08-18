/**
 * Ciclo de QA UX/UI — escopo CFG
 * Clientes, Configurações e Autenticação.
 *
 * Prefixo de ID: CFG. Artefatos em qa-audit/artifacts/cfg/.
 *
 * O suite é de observação: mede o DOM real, força os erros de verdade contra a
 * API e compara o texto do toast com o corpo da resposta HTTP. Nada aqui
 * "conserta" a tela — cada `console.log` marcado com `[CFG-…]` é a evidência
 * que vai para o relatório.
 */
import {
  test,
  authenticate,
  captureNoise,
  visit,
  measure,
  probeTooltip,
  apiLogin,
  API_URL,
  type Noise,
} from "./qa-fixtures";
import type { Page } from "@playwright/test";

const SHOT = "qa-audit/artifacts/cfg";
const STAMP = Date.now();
const SUFFIX = `qa-cfg-${STAMP}`;

// ─── Helpers locais ────────────────────────────────────────────────────────

/** CPF válido gerado (dígitos verificadores de verdade) — nunca um fixo. */
function makeCPF(seed = Math.floor(Math.random() * 1e9)): string {
  const base = String(seed).padStart(9, "0").slice(-9).split("").map(Number);
  const dv = (digits: number[]) => {
    const len = digits.length + 1;
    const sum = digits.reduce((acc, d, i) => acc + d * (len - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
}

function maskCPF(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Lê os toasts visíveis.
 *
 * O `Toaster` (components/ui/toast.tsx) monta um portal em
 * `div.fixed.bottom-4.right-4` e **não** marca nada com `role="status"`,
 * `role="alert"` ou `aria-live` — daí o seletor estrutural.
 */
const TOAST_SEL = 'div.fixed.bottom-4.right-4 > div, [role="status"], [role="alert"]';

async function toastTexts(page: Page): Promise<string[]> {
  const loc = page.locator(TOAST_SEL);
  const n = await loc.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (await loc.nth(i).innerText().catch(() => "")).trim();
    if (t) out.push(t.replace(/\s+/g, " ").slice(0, 200));
  }
  return out;
}

/** Atributos de acessibilidade e cores do container de toasts. */
async function toastA11y(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector("div.fixed.bottom-4.right-4");
    if (!wrap) return null;
    const item = wrap.firstElementChild as HTMLElement | null;
    return {
      wrapperRole: wrap.getAttribute("role"),
      wrapperAriaLive: wrap.getAttribute("aria-live"),
      itemRole: item?.getAttribute("role") ?? null,
      itemAriaLive: item?.getAttribute("aria-live") ?? null,
      itemClasses: item?.className ?? null,
      fecharTemAriaLabel: item?.querySelector("button")?.getAttribute("aria-label") ?? null,
    };
  });
}

/** Espera um toast aparecer e devolve o texto (ou "" no timeout). */
async function waitToast(page: Page, timeout = 8000): Promise<string> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await toastTexts(page);
    if (t.length) return t.join(" | ");
    await page.waitForTimeout(200);
  }
  return "";
}

/** Geometria e atributos de um conjunto de controles. */
async function controlMetrics(page: Page) {
  return page.evaluate(() => {
    const rows: { sel: string; tag: string; h: number; radius: string; border: string }[] = [];
    const push = (sel: string) => {
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.height === 0) return;
        rows.push({
          sel,
          tag: el.tagName.toLowerCase(),
          h: +r.height.toFixed(1),
          radius: cs.borderTopLeftRadius,
          border: cs.borderTopColor,
        });
      });
    };
    push("input:not([type=radio]):not([type=checkbox])");
    push("button");
    push("[role=combobox]");
    return rows;
  });
}

/** Todo input e o label que o descreve (ou a falta dele). */
async function labelAudit(page: Page) {
  return page.evaluate(() => {
    const out: {
      name: string;
      id: string;
      type: string;
      labelledBy: "for" | "wrap" | "aria" | "NONE";
      autocomplete: string;
      maxLength: number;
    }[] = [];
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      const input = el as HTMLInputElement;
      if (input.type === "hidden") return;
      const id = input.id;
      let how: "for" | "wrap" | "aria" | "NONE" = "NONE";
      if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) how = "for";
      else if (input.closest("label")) how = "wrap";
      else if (input.getAttribute("aria-label") || input.getAttribute("aria-labelledby")) how = "aria";
      out.push({
        name: input.name || "(sem name)",
        id: id || "(sem id)",
        type: input.type,
        labelledBy: how,
        autocomplete: input.getAttribute("autocomplete") ?? "(ausente)",
        maxLength: input.maxLength,
      });
    });
    return out;
  });
}

/**
 * Espera a tela assentar antes de medir/fotografar: sem spinner de rota e com um
 * `h1` na página. Sem isso, sob carga (seis agentes de QA em paralelo), o
 * screenshot sai em branco e a evidência não vale nada.
 */
async function settle(page: Page, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ok = await page
      .evaluate(() => {
        const spinners = Array.from(document.querySelectorAll("svg.animate-spin")).filter(
          (s) => (s as SVGElement).getBoundingClientRect().height > 20
        );
        return spinners.length === 0 && !!document.querySelector("h1");
      })
      .catch(() => false);
    if (ok) {
      await page.waitForTimeout(300);
      return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
}

function dumpNoise(tag: string, noise: Noise) {
  const relevant = {
    console: noise.console.filter((c) => !/favicon|Download the React DevTools/.test(c)).slice(0, 6),
    pageerror: noise.pageerror.slice(0, 6),
    http: noise.http.filter((h) => !/_next|favicon/.test(h)).slice(0, 12),
  };
  console.log(`[${tag}] noise`, JSON.stringify(relevant));
}

function dumpMeasure(tag: string, m: Awaited<ReturnType<typeof measure>>) {
  console.log(
    `[${tag}] measure`,
    JSON.stringify({
      overflow: m.horizontalOverflow,
      doc: `${m.docScrollWidth}/${m.docClientWidth}`,
      clipped: m.clippedNoScroll.slice(0, 5),
      smallHits: m.smallHitTargets.slice(0, 6),
      oddSpacing: m.oddSpacing.slice(0, 8),
      lowContrast: m.lowContrast.slice(0, 10),
      hardcoded: m.hardcodedColors.slice(0, 10),
      noFocusRing: m.missingFocusRing.slice(0, 6),
      radius: m.inconsistentRadius.slice(0, 6),
    })
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1. /login — a única tela pública
// ════════════════════════════════════════════════════════════════════════

test("CFG-A1 login: tokens, contraste, espaçamento e atributos dos campos", async ({ page }) => {
  const noise = captureNoise(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, "/login", 1500);

  const m = await measure(page);
  dumpMeasure("CFG-A1", m);
  dumpNoise("CFG-A1", noise);

  console.log("[CFG-A1] labels", JSON.stringify(await labelAudit(page)));

  // Espaçamento vertical real entre os blocos do formulário.
  const gaps = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return null;
    const kids = Array.from(form.children) as HTMLElement[];
    const cs = getComputedStyle(form);
    return {
      formClass: form.className || "(sem classe)",
      formGap: cs.rowGap,
      children: kids.map((k) => {
        const r = k.getBoundingClientRect();
        return { cls: k.className.slice(0, 60), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
      }),
      deltas: kids.slice(1).map((k, i) => {
        const prev = kids[i].getBoundingClientRect();
        return +(k.getBoundingClientRect().top - prev.bottom).toFixed(1);
      }),
    };
  });
  console.log("[CFG-A1] form-gaps", JSON.stringify(gaps));

  // Foco inicial e presença de mostrar/ocultar senha.
  const focused = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return a ? `${a.tagName.toLowerCase()}#${a.id || ""}.${(a.className || "").slice(0, 40)}` : "(nenhum)";
  });
  const toggleCount = await page
    .locator(
      'button[aria-label*="senha" i], button[aria-label*="Mostrar" i], form button:not([type="submit"])'
    )
    .count();
  console.log("[CFG-A1] focoInicial", focused, "| toggleSenha:", toggleCount);

  // Contraste real do login: o texto é branco com alpha sobre o gradiente
  // escuro, então compomos a cor final antes de calcular a razão.
  const loginContrast = await page.evaluate(() => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const relLum = (rgb: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
    };
    // Base do `.gradient-mesh`: hsl(225 33% 7%) ≈ rgb(12, 15, 24).
    const BASE = [12, 15, 24];
    const over = (fg: number[], bg: number[]) => {
      const a = fg[3] ?? 1;
      return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    };
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    document.querySelectorAll("p, label, span, button, input, h1, h2, h3").forEach((el) => {
      const cs = getComputedStyle(el);
      const txt = (el.textContent || "").trim().slice(0, 34);
      if (!txt) return;
      const fg = parse(cs.color);
      if (fg.length < 3) return;
      // fundo: o card de vidro sobre a base do gradiente
      const cardBgEl = el.closest("[class*=glass]") as HTMLElement | null;
      const cardBg = cardBgEl ? parse(getComputedStyle(cardBgEl).backgroundColor) : BASE;
      const bg = cardBg.length >= 3 ? over(cardBg, BASE) : BASE;
      const own = parse(cs.backgroundColor);
      const effBg = own.length >= 3 && (own[3] ?? 1) > 0 ? over(own, bg) : bg;
      const effFg = over(fg, effBg);
      const l1 = relLum(effFg);
      const l2 = relLum(effBg);
      const ratio = +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
      const size = parseFloat(cs.fontSize);
      const req = size >= 24 || (size >= 18.66 && parseFloat(cs.fontWeight) >= 700) ? 3 : 4.5;
      const key = `${txt}|${cs.color}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (ratio < req)
        out.push({
          txt,
          tag: el.tagName.toLowerCase(),
          classes: (el.className || "").toString().slice(0, 70),
          corDeclarada: cs.color,
          corComposta: effFg.map((n) => Math.round(n)).join(","),
          fundoComposto: effBg.map((n) => Math.round(n)).join(","),
          fontSize: cs.fontSize,
          ratio,
          exigido: req,
        });
    });
    return out;
  });
  console.log("[CFG-A1] contrasteLogin", JSON.stringify(loginContrast));

  // Contraste dos textos-chave, medido individualmente.
  const contrast = await page.evaluate(() => {
    const lum = (c: string) => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number);
      const [r, g, b] = n;
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // Fundo efetivo: o login é vidro sobre gradiente, então amostramos o body.
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const pick = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      // resolve a cor efetiva do texto contra o fundo do card
      const l1 = lum(cs.color);
      const l2 = lum(bodyBg === "rgba(0, 0, 0, 0)" ? "rgb(12, 15, 25)" : bodyBg);
      const alpha = Number((cs.color.match(/[\d.]+/g) ?? [])[3] ?? 1);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return {
        sel,
        text: (el.textContent || "").trim().slice(0, 40),
        color: cs.color,
        alpha,
        fontSize: cs.fontSize,
        ratioVsPageBg: +ratio.toFixed(2),
      };
    };
    return [
      pick("[class*=CardDescription]"),
      ...Array.from(document.querySelectorAll("p, label, span")).slice(0, 0),
    ].filter(Boolean);
  });
  console.log("[CFG-A1] contrasteAmostra", JSON.stringify(contrast));

  await page.screenshot({ path: `${SHOT}/CFG-A1-login-1440-light.png`, fullPage: true });
});

test("CFG-A2 login: submit vazio, credencial errada e estado de carregando", async ({ page }) => {
  const noise = captureNoise(page);
  await visit(page, "/login", 1200);

  // 1. submit vazio — a mensagem tem que ser do zod, em pt-BR.
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(700);
  const emptyErrors = await page.locator("form p").allInnerTexts();
  const validationBubble = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    return inputs.map((i) => ({ name: i.name, msg: (i as HTMLInputElement).validationMessage }));
  });
  const noValidate = await page.locator("form").first().getAttribute("novalidate");
  console.log(
    "[CFG-A2] submitVazio",
    JSON.stringify({ errors: emptyErrors, noValidate, validationBubble })
  );
  await page.screenshot({ path: `${SHOT}/CFG-A2-login-vazio.png` });

  // 2. credencial errada — mensagem do backend.
  await page.locator("#email").fill("naoexiste@exemplo.com");
  await page.locator("#password").fill("senhaerrada123");
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login"), { timeout: 15000 }),
    page.getByRole("button", { name: /entrar/i }).click(),
  ]);
  const body = await resp.text();
  await page.waitForTimeout(600);
  const shown = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return { textoDoForm: "(sem form)" };
    const banner = form.querySelector("div.animate-slide-down") as HTMLElement | null;
    let info: Record<string, unknown> | null = null;
    if (banner) {
      const cs = getComputedStyle(banner);
      const lum = (c: string) => {
        const n = (c.match(/[\d.]+/g) ?? []).map(Number);
        const f = (v: number) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(n[0]) + 0.7152 * f(n[1]) + 0.0722 * f(n[2]);
      };
      const l1 = lum(cs.color);
      const l2 = lum("rgb(12, 15, 25)");
      const next = banner.nextElementSibling?.getBoundingClientRect();
      info = {
        classes: banner.className,
        texto: banner.innerText.slice(0, 120),
        color: cs.color,
        bg: cs.backgroundColor,
        ratioVsFundoDaPagina: +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2),
        gapAteProximoCampo: next ? +(next.top - banner.getBoundingClientRect().bottom).toFixed(1) : null,
      };
    }
    return { textoDoForm: (form.innerText || "").replace(/\s+/g, " ").slice(0, 220), banner: info };
  });
  console.log(
    "[CFG-A2] credencialErrada",
    JSON.stringify({ status: resp.status(), body: body.slice(0, 200), tela: shown })
  );
  await page.screenshot({ path: `${SHOT}/CFG-A2-login-credencial-errada.png` });

  // 3. estado de carregando: o botão fica desabilitado durante o request?
  await page.route("**/auth/login", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.locator("#email").fill("admin@admin.com");
  await page.locator("#password").fill("123456");
  const btn = page.locator('form button[type="submit"]');
  await btn.click();
  await page.waitForTimeout(900);
  const loading = {
    disabled: await btn.isDisabled().catch(() => "n/d"),
    label: (await btn.innerText().catch(() => "n/d")).trim(),
    spinner: await page.locator("form svg.animate-spin").count(),
  };
  console.log("[CFG-A2] carregando", JSON.stringify(loading));
  await page.screenshot({ path: `${SHOT}/CFG-A2-login-carregando.png` });
  await page.unroute("**/auth/login");
  dumpNoise("CFG-A2", noise);
});

test("CFG-A3 login: teclado, foco visível e responsivo 390/768/1440 + dark", async ({ page }) => {
  await visit(page, "/login", 1200);

  // Ordem de tabulação a partir do topo.
  const order: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return "(nenhum)";
        const cs = getComputedStyle(a);
        return `${a.tagName.toLowerCase()}#${a.id || (a.textContent || "").trim().slice(0, 14)} outline=${cs.outlineStyle}/${cs.outlineWidth} shadow=${cs.boxShadow.slice(0, 40)}`;
      })
    );
  }
  console.log("[CFG-A3] tabOrder", JSON.stringify(order));

  // Login inteiro só pelo teclado.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Tab");
  await page.keyboard.type("admin@admin.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("123456");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  console.log("[CFG-A3] loginTeclado url:", page.url());

  // Responsivo + dark.
  for (const w of [390, 768, 1440]) {
    const ctx = await page.context().newPage();
    await ctx.setViewportSize({ width: w, height: 900 });
    await ctx.goto("/login", { waitUntil: "domcontentloaded" });
    await ctx.waitForTimeout(1200);
    const m = await measure(ctx);
    console.log(
      `[CFG-A3] login@${w}`,
      JSON.stringify({
        overflow: m.horizontalOverflow,
        doc: `${m.docScrollWidth}/${m.docClientWidth}`,
        clipped: m.clippedNoScroll.slice(0, 3),
        lowContrast: m.lowContrast.length,
      })
    );
    await ctx.screenshot({ path: `${SHOT}/CFG-A3-login-${w}.png`, fullPage: true });
    await ctx.close();
  }

  const dark = await page.context().newPage();
  await dark.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await dark.goto("/login", { waitUntil: "domcontentloaded" });
  await dark.waitForTimeout(1200);
  const md = await measure(dark);
  console.log(
    "[CFG-A3] login dark",
    JSON.stringify({ lowContrast: md.lowContrast.slice(0, 8), hardcoded: md.hardcodedColors.slice(0, 6) })
  );
  await dark.screenshot({ path: `${SHOT}/CFG-A3-login-dark.png`, fullPage: true });
  await dark.close();
});

// ════════════════════════════════════════════════════════════════════════
// 2. /convite/[token] — token inválido
// ════════════════════════════════════════════════════════════════════════

test("CFG-B1 convite: token inválido — estado de erro", async ({ page }) => {
  const noise = captureNoise(page);
  await visit(page, `/convite/token-invalido-${STAMP}`, 2000);

  const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
  const formCount = await page.locator("form").count();
  console.log("[CFG-B1] naEntrada", JSON.stringify({ formCount, bodyText }));
  console.log("[CFG-B1] labels", JSON.stringify(await labelAudit(page)));
  await page.screenshot({ path: `${SHOT}/CFG-B1-convite-invalido.png`, fullPage: true });

  // Só descobre que o token é inválido depois de preencher tudo e submeter?
  if (formCount > 0) {
    const inputs = page.locator("form input");
    await inputs.nth(0).fill("Fulano de Teste");
    await inputs.nth(1).fill("Senha@Forte123");
    await inputs.nth(2).fill("Senha@Forte123");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("accept-invite"), { timeout: 15000 }).catch(() => null),
      page.getByRole("button", { name: /criar conta/i }).click(),
    ]);
    const t = await waitToast(page);
    console.log(
      "[CFG-B1] aposSubmit",
      JSON.stringify({
        status: resp?.status() ?? "(sem request)",
        body: resp ? (await resp.text()).slice(0, 250) : "",
        toast: t,
      })
    );
    await page.screenshot({ path: `${SHOT}/CFG-B1-convite-erro-submit.png`, fullPage: true });
  }

  const m = await measure(page);
  dumpMeasure("CFG-B1", m);
  dumpNoise("CFG-B1", noise);
});

// ════════════════════════════════════════════════════════════════════════
// 3. /clientes — lista, busca, filtros
// ════════════════════════════════════════════════════════════════════════

test("CFG-C1 clientes lista: tokens, máscaras na tabela, busca e filtros", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/clientes", 3000);
  await settle(page);

  const m = await measure(page);
  dumpMeasure("CFG-C1", m);

  // Documento e telefone precisam aparecer mascarados na tabela.
  const cells = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr")).slice(0, 5);
    return rows.map((r) =>
      Array.from(r.querySelectorAll("td")).map((td) => (td.textContent || "").trim().slice(0, 40))
    );
  });
  console.log("[CFG-C1] primeirasLinhas", JSON.stringify(cells));

  // Alturas de controle na tela (input de busca vs select de filtro vs botão).
  console.log("[CFG-C1] controles", JSON.stringify(await controlMetrics(page)));

  // Busca com debounce: quantas requisições saem por 8 teclas?
  const reqs: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/customers?") || /\/customers\?/.test(r.url())) reqs.push(r.url());
  });
  const search = page.getByPlaceholder(/Buscar por nome/i).first();
  await search.click();
  await search.type("ana silva", { delay: 60 });
  await page.waitForTimeout(1500);
  console.log("[CFG-C1] buscaRequests", reqs.length, JSON.stringify(reqs.slice(-2)));
  const afterSearch = await page.locator("tbody tr").count();
  console.log("[CFG-C1] linhasAposBusca", afterSearch);
  await search.fill("");
  await page.waitForTimeout(1200);

  // Filtro por tipo de documento — o painel abre num toggle.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(600);
  const combos = page.locator('[data-testid="filter-panel"] [role=combobox]');
  console.log("[CFG-C1] filtrosCount", await combos.count());
  console.log("[CFG-C1] controlesComFiltroAberto", JSON.stringify(await controlMetrics(page)));
  if ((await combos.count()) > 1) {
    reqs.length = 0;
    await combos.nth(1).click();
    await page.waitForTimeout(400);
    const opts = await page.getByRole("option").allInnerTexts();
    console.log("[CFG-C1] opcoesTipo", JSON.stringify(opts));
    await page.getByRole("option", { name: "Pessoa Jurídica" }).click();
    await page.waitForTimeout(2000);
    console.log("[CFG-C1] requestAposFiltro", JSON.stringify(reqs.slice(-2)));
    console.log("[CFG-C1] triggerValue", await combos.nth(1).innerText());
    const cnpjRows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("tbody tr")).slice(0, 4).map((r) => {
        const tds = r.querySelectorAll("td");
        return { tipo: tds[1]?.textContent?.trim(), doc: tds[2]?.textContent?.trim() };
      })
    );
    console.log("[CFG-C1] filtroCNPJ", JSON.stringify(cnpjRows));
    await page.screenshot({ path: `${SHOT}/CFG-C1-clientes-filtro-cnpj.png`, fullPage: true });
  }

  // Tooltip dos botões só-ícone da coluna Ações.
  const eye = await probeTooltip(page, "tbody tr:first-child button");
  console.log("[CFG-C1] tooltipAcoes", JSON.stringify(eye));

  await page.screenshot({ path: `${SHOT}/CFG-C1-clientes-1440.png`, fullPage: true });
  dumpNoise("CFG-C1", noise);
});

test("CFG-C2 clientes lista: isError não pode virar estado vazio", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  await page.route("**/customers?**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' })
  );
  await visit(page, "/clientes", 3000);
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(
    "[CFG-C2] lista500",
    JSON.stringify({
      temNenhumRegistro: /Nenhum registro/i.test(text),
      trecho: text.slice(text.indexOf("Clientes"), text.indexOf("Clientes") + 400),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-C2-clientes-erro-500.png`, fullPage: true });
  await page.unroute("**/customers?**");
  dumpNoise("CFG-C2", noise);
});

test("CFG-C3 clientes lista: responsivo 390/768 e dark", async ({ page }) => {
  await authenticate(page);
  for (const w of [390, 768]) {
    await page.setViewportSize({ width: w, height: 900 });
    await visit(page, "/clientes", 2500);
    await settle(page, 12000);
    const m = await measure(page);
    console.log(
      `[CFG-C3] clientes@${w}`,
      JSON.stringify({
        overflow: m.horizontalOverflow,
        doc: `${m.docScrollWidth}/${m.docClientWidth}`,
        clipped: m.clippedNoScroll.slice(0, 4),
        smallHits: m.smallHitTargets.slice(0, 4),
      })
    );
    await page.screenshot({ path: `${SHOT}/CFG-C3-clientes-${w}.png`, fullPage: true });
  }

  const dark = await page.context().newPage();
  await dark.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await dark.setViewportSize({ width: 1440, height: 900 });
  await dark.goto("/clientes", { waitUntil: "domcontentloaded" });
  await dark.waitForTimeout(3000);
  const md = await measure(dark);
  console.log(
    "[CFG-C3] clientes dark",
    JSON.stringify({ lowContrast: md.lowContrast.slice(0, 8), hardcoded: md.hardcodedColors.slice(0, 8) })
  );
  await dark.screenshot({ path: `${SHOT}/CFG-C3-clientes-dark.png`, fullPage: true });
  await dark.close();
});

// ════════════════════════════════════════════════════════════════════════
// 4. /clientes/novo — máscaras, validação, toasts
// ════════════════════════════════════════════════════════════════════════

test("CFG-D1 clientes/novo: máscaras brasileiras e dígito verificador", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/clientes/novo", 2500);
  await settle(page);

  console.log("[CFG-D1] labels", JSON.stringify(await labelAudit(page)));
  const noValidate = await page.locator("form").first().getAttribute("novalidate");
  console.log("[CFG-D1] noValidate", noValidate);

  const doc = page.locator('input[name="document"]');
  const phone = page.locator('input[name="phone"]');

  // CPF mascara enquanto digita?
  await doc.click();
  await doc.type("52998224725", { delay: 40 });
  await page.waitForTimeout(300);
  console.log(
    "[CFG-D1] cpfMascarado",
    JSON.stringify({
      valor: await doc.inputValue(),
      maxLength: await doc.getAttribute("maxlength"),
    })
  );

  // 111.111.111-11 tem 11 dígitos e é inválido — AE-04.
  await doc.fill("");
  await doc.type("11111111111", { delay: 30 });
  await page.waitForTimeout(600);
  const docErr = await page
    .locator('input[name="document"] ~ p, input[name="document"]')
    .locator("xpath=../p")
    .allInnerTexts()
    .catch(() => []);
  console.log("[CFG-D1] cpf-111", JSON.stringify({ valor: await doc.inputValue(), erro: docErr }));
  await page.screenshot({ path: `${SHOT}/CFG-D1-cpf-invalido.png`, fullPage: true });

  // Telefone
  await phone.click();
  await phone.type("11987654321", { delay: 30 });
  await page.waitForTimeout(300);
  console.log(
    "[CFG-D1] telefone",
    JSON.stringify({ valor: await phone.inputValue(), maxLength: await phone.getAttribute("maxlength") })
  );

  // CNPJ
  await page.getByText("Pessoa Jurídica", { exact: true }).first().click();
  await page.waitForTimeout(400);
  await doc.fill("");
  await doc.type("11222333000181", { delay: 30 });
  await page.waitForTimeout(400);
  console.log(
    "[CFG-D1] cnpjMascarado",
    JSON.stringify({ valor: await doc.inputValue(), maxLength: await doc.getAttribute("maxlength") })
  );

  // Overshoot: digitar dígitos demais.
  await doc.fill("");
  await doc.type("112223330001819999", { delay: 15 });
  console.log("[CFG-D1] cnpjOvershoot", await doc.inputValue());

  // Não existe campo de CEP no cadastro de cliente — o CEP fica no endereço.
  console.log("[CFG-D1] camposDoForm", JSON.stringify(await page.locator("form input").count()));

  const m = await measure(page);
  dumpMeasure("CFG-D1", m);
  console.log("[CFG-D1] controles", JSON.stringify(await controlMetrics(page)));
  await page.screenshot({ path: `${SHOT}/CFG-D1-clientes-novo.png`, fullPage: true });
  dumpNoise("CFG-D1", noise);
});

test("CFG-D2 clientes/novo: submit inválido nunca silencioso + e-mail inválido", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/clientes/novo", 2500);

  // Submit totalmente vazio.
  await page.getByRole("button", { name: /Salvar Cliente/i }).click();
  await page.waitForTimeout(900);
  const errs = await page.locator("form p.text-destructive").allInnerTexts();
  const toast = await toastTexts(page);
  console.log("[CFG-D2] submitVazio", JSON.stringify({ errosNoCampo: errs, toast }));
  await page.screenshot({ path: `${SHOT}/CFG-D2-submit-vazio.png`, fullPage: true });

  // E-mail inválido: a mensagem tem que ser do zod, em pt-BR.
  await page.locator('input[name="name"]').fill(`Cliente ${SUFFIX}`);
  await page.locator('input[name="document"]').type(maskCPF(makeCPF()), { delay: 15 });
  await page.locator('input[name="email"]').fill("nao-e-email");
  await page.locator('input[name="phone"]').type("11987654321", { delay: 15 });
  await page.getByRole("button", { name: /Salvar Cliente/i }).click();
  await page.waitForTimeout(900);
  const bubbles = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((i) => ({
      n: i.name,
      v: (i as HTMLInputElement).validationMessage,
    }))
  );
  console.log(
    "[CFG-D2] emailInvalido",
    JSON.stringify({
      errosNoCampo: await page.locator("form p.text-destructive").allInnerTexts(),
      bubblesNativos: bubbles,
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-D2-email-invalido.png`, fullPage: true });
  dumpNoise("CFG-D2", noise);
});

test("CFG-D3 clientes/novo: CPF duplicado — o toast tem que repetir o backend (AE-10)", async ({ page }) => {
  const noise = captureNoise(page);
  const session = await apiLogin("owner");

  // Cria um cliente pela API para garantir o conflito no run atual.
  const cpf = makeCPF();
  const created = await fetch(`${API_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({
      name: `Semente ${SUFFIX}`,
      documentType: "CPF",
      document: cpf,
      email: `semente.${STAMP}@exemplo.com`,
      phone: "11987654321",
    }),
  });
  console.log("[CFG-D3] semente", created.status, cpf);

  await authenticate(page);
  await visit(page, "/clientes/novo", 2500);

  await page.locator('input[name="name"]').fill(`Duplicado ${SUFFIX}`);
  await page.locator('input[name="document"]').type(maskCPF(cpf), { delay: 20 });
  await page.locator('input[name="email"]').fill(`duplicado.${STAMP}@exemplo.com`);
  await page.locator('input[name="phone"]').type("11987654322", { delay: 20 });

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/customers") && r.request().method() === "POST", {
      timeout: 20000,
    }),
    page.getByRole("button", { name: /Salvar Cliente/i }).click(),
  ]);
  const raw = await resp.text();
  const t = await waitToast(page);
  const backendMsg = JSON.parse(raw).message as string;
  console.log(
    "[CFG-D3] duplicado",
    JSON.stringify({
      status: resp.status(),
      corpoHTTP: raw.slice(0, 250),
      toast: t,
      toastRepeteOBackend: t.includes(backendMsg),
    })
  );
  console.log("[CFG-D3] toastA11y", JSON.stringify(await toastA11y(page)));
  const mToast = await measure(page);
  console.log("[CFG-D3] coresDoToast", JSON.stringify(mToast.hardcodedColors.slice(0, 8)));
  await page.screenshot({ path: `${SHOT}/CFG-D3-cpf-duplicado.png`, fullPage: true });

  // E-mail duplicado também.
  await page.locator('input[name="document"]').fill("");
  await page.locator('input[name="document"]').type(maskCPF(makeCPF()), { delay: 15 });
  await page.locator('input[name="email"]').fill(`semente.${STAMP}@exemplo.com`);
  const [resp2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/customers") && r.request().method() === "POST", {
      timeout: 20000,
    }),
    page.getByRole("button", { name: /Salvar Cliente/i }).click(),
  ]);
  const t2 = await waitToast(page);
  console.log(
    "[CFG-D3] emailDuplicado",
    JSON.stringify({ status: resp2.status(), corpoHTTP: (await resp2.text()).slice(0, 250), toast: t2 })
  );
  dumpNoise("CFG-D3", noise);
});

test("CFG-D4 clientes/novo: botão travado durante a mutação (duplo clique)", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/clientes/novo", 2500);

  let posts = 0;
  await page.route("**/customers", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await new Promise((r) => setTimeout(r, 2500));
    }
    await route.continue();
  });

  await page.locator('input[name="name"]').fill(`Duplo ${SUFFIX}`);
  await page.locator('input[name="document"]').type(maskCPF(makeCPF()), { delay: 15 });
  await page.locator('input[name="email"]').fill(`duplo.${STAMP}@exemplo.com`);
  await page.locator('input[name="phone"]').type("11987654323", { delay: 15 });

  const btn = page.getByRole("button", { name: /Salvar Cliente/i });
  await btn.click();
  await page.waitForTimeout(300);
  const state = { disabled: await btn.isDisabled(), spinner: await page.locator("form svg.animate-spin").count() };
  await btn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(3500);
  console.log("[CFG-D4] duploClique", JSON.stringify({ ...state, postsEnviados: posts }));
  await page.unroute("**/customers");
  dumpNoise("CFG-D4", noise);
});

// ════════════════════════════════════════════════════════════════════════
// 5. /clientes/[id] e /clientes/[id]/edit
// ════════════════════════════════════════════════════════════════════════

test("CFG-E1 clientes detalhe e edição: máscaras, estados e a11y", async ({ page }) => {
  const noise = captureNoise(page);
  const session = await apiLogin("owner");
  const list = await fetch(`${API_URL}/customers?limit=1`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  }).then((r) => r.json());
  const id = list?.data?.[0]?.id as string | undefined;
  console.log("[CFG-E1] clienteAlvo", id, JSON.stringify(list?.data?.[0]).slice(0, 220));
  if (!id) test.skip();

  await authenticate(page);
  await visit(page, `/clientes/${id}`, 3000);
  await settle(page);
  const header = (await page.locator("h1").first().innerText()) + " | " + (await page.locator("h1 ~ p, h1").first().innerText().catch(() => ""));
  const docShown = await page.locator("p.font-mono").first().innerText().catch(() => "(sem)");
  console.log("[CFG-E1] detalhe", JSON.stringify({ header: header.slice(0, 80), documento: docShown }));
  const m = await measure(page);
  dumpMeasure("CFG-E1", m);
  await page.screenshot({ path: `${SHOT}/CFG-E1-cliente-detalhe.png`, fullPage: true });

  // Abas: dialog de endereço tem aria?
  await page.getByRole("button", { name: /Endereços/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOT}/CFG-E1-cliente-enderecos.png`, fullPage: true });
  const addBtn = page.getByRole("button", { name: /Adicionar|Novo endere/i }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(900);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"], [data-state="open"][class*="fixed"]');
      if (!d) return null;
      return {
        role: d.getAttribute("role"),
        ariaModal: d.getAttribute("aria-modal"),
        ariaLabelledby: d.getAttribute("aria-labelledby"),
        ariaDescribedby: d.getAttribute("aria-describedby"),
      };
    });
    console.log("[CFG-E1] dialogEndereco", JSON.stringify(dlg));
    console.log("[CFG-E1] labelsDialog", JSON.stringify(await labelAudit(page)));
    // CEP mascara?
    const cep = page.locator("#address-cep").first();
    if (await cep.count()) {
      await cep.type("01310100", { delay: 40 });
      await page.waitForTimeout(300);
      console.log(
        "[CFG-E1] cep",
        JSON.stringify({ valor: await cep.inputValue(), maxLength: await cep.getAttribute("maxlength") })
      );
    }
    await page.screenshot({ path: `${SHOT}/CFG-E1-dialog-endereco.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Detalhe com erro: 500 vira "Cliente não encontrado"?
  await page.route(`**/customers/${id}`, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' })
  );
  await visit(page, `/clientes/${id}`, 4000);
  const errText = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return (main as HTMLElement).innerText.replace(/\s+/g, " ");
  });
  console.log("[CFG-E1] detalhe500", JSON.stringify(errText.slice(0, 400)));
  await page.screenshot({ path: `${SHOT}/CFG-E1-detalhe-500.png`, fullPage: true });

  // 403: um cliente que o usuário não pode ler.
  await page.unroute(`**/customers/${id}`);
  await page.route(`**/customers/${id}`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: '{"message":"Permissão insuficiente para esta ação"}',
    })
  );
  await visit(page, `/clientes/${id}`, 8000);
  const err403 = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return {
      texto: (main as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 300),
      permissionDenied: !!document.querySelector('[data-testid="permission-denied"]'),
      spinner: document.querySelectorAll("svg.animate-spin").length,
    };
  });
  console.log("[CFG-E1] detalhe403", JSON.stringify(err403));
  await page.screenshot({ path: `${SHOT}/CFG-E1-detalhe-403.png`, fullPage: true });

  // /edit com 403 tem que dizer "sem permissão", não abrir o formulário vazio.
  await visit(page, `/clientes/${id}/edit`, 8000);
  const edit403 = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    return {
      texto: (main as HTMLElement).innerText.replace(/\s+/g, " ").slice(0, 260),
      permissionDenied: !!document.querySelector('[data-testid="permission-denied"]'),
    };
  });
  console.log("[CFG-E1] edit403", JSON.stringify(edit403));
  await page.unroute(`**/customers/${id}`);
  await page.screenshot({ path: `${SHOT}/CFG-E1-detalhe-500.png`, fullPage: true });
  await page.unroute(`**/customers/${id}`);

  // Edição
  await visit(page, `/clientes/${id}/edit`, 3000);
  const values = await page.evaluate(() =>
    Array.from(document.querySelectorAll("form input")).map((i) => ({
      n: (i as HTMLInputElement).name,
      v: (i as HTMLInputElement).value,
    }))
  );
  console.log("[CFG-E1] edicaoValores", JSON.stringify(values));
  await page.screenshot({ path: `${SHOT}/CFG-E1-cliente-edit.png`, fullPage: true });
  dumpNoise("CFG-E1", noise);
});

// ════════════════════════════════════════════════════════════════════════
// 6. Permissões — seller
// ════════════════════════════════════════════════════════════════════════

test("CFG-F1 seller: menu escondido x rota alcançável por URL (AE-27)", async ({ page }) => {
  const noise = captureNoise(page);
  const session = await apiLogin("seller");

  // O que a API entrega ao seller nas rotas de configuração.
  for (const path of ["/payment-methods", "/payment-conditions", "/customers?limit=1"]) {
    const r = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const b = await r.text();
    console.log(`[CFG-F1] API seller ${path}`, r.status, b.slice(0, 120));
  }

  await authenticate(page, "seller");
  await visit(page, "/clientes", 3000);
  const menu = await page.evaluate(() =>
    Array.from(document.querySelectorAll("aside a, nav a")).map((a) => a.textContent?.trim()).filter(Boolean)
  );
  console.log("[CFG-F1] menuSeller", JSON.stringify(menu));
  await page.screenshot({ path: `${SHOT}/CFG-F1-seller-menu.png`, fullPage: true });

  for (const route of [
    "/configuracoes",
    "/configuracoes/metodos-pagamento",
    "/configuracoes/condicoes-pagamento",
    "/configuracoes/perfil",
  ]) {
    await visit(page, route, 2500);
    const t = (await page.locator("main").innerText().catch(async () => page.locator("body").innerText()))
      .replace(/\s+/g, " ")
      .slice(0, 260);
    const denied = await page.locator('[data-testid="permission-denied"]').count();
    console.log(`[CFG-F1] seller ${route}`, JSON.stringify({ denied, texto: t }));
    await page.screenshot({
      path: `${SHOT}/CFG-F1-seller-${route.replace(/\//g, "_")}.png`,
      fullPage: true,
    });
  }

  dumpNoise("CFG-F1", noise);
});

test("CFG-F1b seller: /configuracoes/perfil e os controles gateados de /clientes", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page, "seller");

  // /configuracoes/perfil não é gateado — confirma que o seller vê o próprio perfil.
  await visit(page, "/configuracoes/perfil", 4000);
  const perfilSeller = await page.evaluate(() => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    return {
      texto: main.innerText.replace(/\s+/g, " ").slice(0, 260),
      forms: document.querySelectorAll("form").length,
      spinner: document.querySelectorAll("svg.animate-spin").length,
      h1: document.querySelector("h1")?.textContent ?? null,
    };
  });
  console.log("[CFG-F1b] perfilSeller", JSON.stringify(perfilSeller));
  await page.screenshot({ path: `${SHOT}/CFG-F1b-seller-perfil.png`, fullPage: true });

  // O que o seller vê em /clientes: os botões gateados por <Can>.
  await visit(page, "/clientes", 3000);
  const btns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main button, main a[href]"))
      .map((b) => b.textContent?.trim())
      .filter((x) => x)
  );
  console.log("[CFG-F1b] sellerClientesControles", JSON.stringify(btns.slice(0, 20)));
  const rowBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody tr:first-child button")).map((b) => ({
      aria: b.getAttribute("aria-label"),
      svg: b.querySelector("svg")?.getAttribute("class")?.slice(0, 30),
    }))
  );
  console.log("[CFG-F1b] sellerAcoesDaLinha", JSON.stringify(rowBtns));
  await page.screenshot({ path: `${SHOT}/CFG-F1b-seller-clientes.png`, fullPage: true });
  dumpNoise("CFG-F1b", noise);
});

test("CFG-F2 permissions === null renderiza carregando, não Acesso negado", async ({ page }) => {
  const noise = captureNoise(page);
  const session = await apiLogin("owner");

  // Segura o /auth/me para observar a janela em que permissions ainda é null.
  await page.context().addInitScript(() => {
    /* noop — o token é semeado abaixo */
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([a, r]) => {
      localStorage.setItem("erp_token", a);
      localStorage.setItem("erp_refresh_token", r);
    },
    [session.accessToken, session.refreshToken]
  );

  // Segura o /auth/me: enquanto ele não responde, `permissions` é null.
  await page.route("**/auth/me", async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    await route.fallback();
  });

  await page.goto("/configuracoes/metodos-pagamento", { waitUntil: "domcontentloaded" });
  for (const t of [1200, 2500, 4000]) {
    await page.waitForTimeout(t === 1200 ? 1200 : 1300);
    const snap = await page.evaluate(() => {
      const main = (document.querySelector("main") ?? document.body) as HTMLElement;
      return {
        spinner: document.querySelectorAll("svg.animate-spin").length,
        denied: !!document.querySelector('[data-testid="permission-denied"]'),
        texto: main.innerText.replace(/\s+/g, " ").slice(0, 180),
      };
    });
    console.log(`[CFG-F2] t=${t}`, JSON.stringify(snap));
  }
  await page.screenshot({ path: `${SHOT}/CFG-F2-permissions-null.png`, fullPage: true });
  await page.waitForTimeout(6000);
  const final = await page.evaluate(() => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    return main.innerText.replace(/\s+/g, " ").slice(0, 180);
  });
  console.log("[CFG-F2] depoisDoMe", JSON.stringify(final));
  dumpNoise("CFG-F2", noise);
});

// ════════════════════════════════════════════════════════════════════════
// 7. /configuracoes e abas
// ════════════════════════════════════════════════════════════════════════

test("CFG-G1 configuracoes: abas, tokens, dialog de convite e a11y", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/configuracoes", 3000);
  await settle(page);

  const m = await measure(page);
  dumpMeasure("CFG-G1", m);
  console.log("[CFG-G1] controles", JSON.stringify(await controlMetrics(page)));

  // As "abas" têm role=tab?
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).slice(0, 12).map((b) => ({
      txt: b.textContent?.trim().slice(0, 20),
      role: b.getAttribute("role"),
      selected: b.getAttribute("aria-selected"),
    }))
  );
  console.log("[CFG-G1] abas", JSON.stringify(tabs));
  await page.screenshot({ path: `${SHOT}/CFG-G1-configuracoes-empresa.png`, fullPage: true });

  for (const label of ["Usuários", "Plano"]) {
    await page.getByRole("button", { name: label }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SHOT}/CFG-G1-configuracoes-${label.toLowerCase()}.png`,
      fullPage: true,
    });
    const mm = await measure(page);
    console.log(
      `[CFG-G1] aba ${label}`,
      JSON.stringify({
        lowContrast: mm.lowContrast.slice(0, 5),
        hardcoded: mm.hardcodedColors.slice(0, 6),
        smallHits: mm.smallHitTargets.slice(0, 4),
      })
    );
  }

  // Dialog de convite.
  await page.getByRole("button", { name: "Usuários" }).click();
  await page.waitForTimeout(1800);
  const invite = page.getByRole("button", { name: /^Convidar/i }).first();
  if (await invite.count()) {
    await invite.click();
    await page.waitForTimeout(900);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d
        ? {
            role: d.getAttribute("role"),
            ariaModal: d.getAttribute("aria-modal"),
            labelledby: d.getAttribute("aria-labelledby"),
            describedby: d.getAttribute("aria-describedby"),
          }
        : null;
    });
    console.log("[CFG-G1] dialogConvite", JSON.stringify(dlg));
    console.log("[CFG-G1] labelsConvite", JSON.stringify(await labelAudit(page)));
    await page.screenshot({ path: `${SHOT}/CFG-G1-dialog-convite.png`, fullPage: true });
    await page.keyboard.press("Escape");
  }

  // Empresa: campos de CNPJ/CEP/telefone mascarados?
  await page.getByRole("button", { name: "Empresa" }).click();
  await page.waitForTimeout(1500);
  console.log("[CFG-G1] labelsEmpresa", JSON.stringify(await labelAudit(page)));
  const cnpj = page.locator('input[name="document"], input[placeholder*="00.000.000"]').first();
  if (await cnpj.count()) {
    await cnpj.fill("");
    await cnpj.type("11222333000181", { delay: 30 });
    console.log("[CFG-G1] empresaCNPJ", await cnpj.inputValue());
  }
  const cep = page.locator("#tenant-cep");
  if (await cep.count()) {
    await cep.fill("");
    await cep.type("01310100", { delay: 30 });
    console.log(
      "[CFG-G1] empresaCEP",
      JSON.stringify({ v: await cep.inputValue(), maxLength: await cep.getAttribute("maxlength") })
    );
  }
  const empPhone = page.locator('input[name="phone"]').first();
  if (await empPhone.count()) {
    await empPhone.fill("");
    await empPhone.type("11987654321", { delay: 20 });
    console.log("[CFG-G1] empresaTelefone", await empPhone.inputValue());
  }
  await page.screenshot({ path: `${SHOT}/CFG-G1-configuracoes-empresa-mascaras.png`, fullPage: true });
  dumpNoise("CFG-G1", noise);
});

test("CFG-G2 configuracoes/perfil: formulários, máscara e feedback", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/configuracoes/perfil", 3000);
  await settle(page);

  const m = await measure(page);
  dumpMeasure("CFG-G2", m);
  console.log("[CFG-G2] labels", JSON.stringify(await labelAudit(page)));
  console.log("[CFG-G2] controles", JSON.stringify(await controlMetrics(page)));
  await page.screenshot({ path: `${SHOT}/CFG-G2-perfil.png`, fullPage: true });

  // Telefone com máscara?
  const phone = page.locator('input[placeholder="(00) 00000-0000"]').first();
  const phoneOriginal = await phone.inputValue().catch(() => "");
  if (await phone.count()) {
    await phone.fill("");
    await phone.type("11987654321", { delay: 30 });
    console.log(
      "[CFG-G2] telefone",
      JSON.stringify({ v: await phone.inputValue(), maxLength: await phone.getAttribute("maxlength") })
    );
    // valor inválido: 3 dígitos
    await phone.fill("");
    await phone.type("119", { delay: 30 });
    await page.getByRole("button", { name: /Salvar altera/i }).click();
    await page.waitForTimeout(1500);
    console.log(
      "[CFG-G2] telefoneCurto",
      JSON.stringify({
        erros: await page.locator("p.text-destructive").allInnerTexts(),
        toast: await toastTexts(page),
      })
    );
    await page.screenshot({ path: `${SHOT}/CFG-G2-perfil-telefone-curto.png`, fullPage: true });

    // Confirma no backend o que ficou gravado, e devolve o valor original.
    const s = await apiLogin("owner");
    const me = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${s.accessToken}` },
    }).then((r) => r.json());
    console.log("[CFG-G2] telefoneGravadoNoBackend", JSON.stringify(me?.data?.phone));
    await fetch(`${API_URL}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.accessToken}` },
      body: JSON.stringify({ phone: phoneOriginal || "(11) 99999-0001" }),
    });
  }

  // Troca de senha com senha atual errada — o toast tem que ser o do backend.
  const pw = page.locator('input[autocomplete="current-password"]');
  if (await pw.count()) {
    await pw.fill("senhaerradissima");
    await page.locator('input[autocomplete="new-password"]').nth(0).fill("Nova@Senha123");
    await page.locator('input[autocomplete="new-password"]').nth(1).fill("Nova@Senha123");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /password/i.test(r.url()), { timeout: 15000 }).catch(() => null),
      page.getByRole("button", { name: /Trocar senha/i }).click(),
    ]);
    const t = await waitToast(page);
    console.log(
      "[CFG-G2] senhaErrada",
      JSON.stringify({
        status: resp?.status(),
        corpo: resp ? (await resp.text()).slice(0, 200) : "(sem request)",
        toast: t,
      })
    );
    await page.screenshot({ path: `${SHOT}/CFG-G2-perfil-senha-errada.png`, fullPage: true });
  }
  dumpNoise("CFG-G2", noise);
});

// ════════════════════════════════════════════════════════════════════════
// 8. Condições e métodos de pagamento
// ════════════════════════════════════════════════════════════════════════

test("CFG-H1 condicoes-pagamento: layout do cabeçalho, tokens e estados", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/configuracoes/condicoes-pagamento", 3000);
  await settle(page);

  const m = await measure(page);
  dumpMeasure("CFG-H1", m);
  await page.screenshot({ path: `${SHOT}/CFG-H1-condicoes-1440.png`, fullPage: true });

  // A busca e o painel de filtros estão dentro do flex do cabeçalho?
  const layout = await page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) };
    };
    const h1 = document.querySelector("h1");
    // O contêiner flex do cabeçalho: o ancestral do h1 com display:flex.
    let header: HTMLElement | null = h1?.parentElement ?? null;
    while (header && getComputedStyle(header).display !== "flex") header = header.parentElement;
    const search = document.querySelector('input[placeholder*="Buscar"]');
    const filtros = Array.from(document.querySelectorAll("button")).find((b) =>
      /^Filtros/.test((b.textContent || "").trim())
    );
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Nova Condi/i.test(b.textContent || "")
    );
    return {
      headerClass: header?.className ?? "(?)",
      headerBox: box(header),
      h1Box: box(h1),
      searchBox: box(search),
      buscaDentroDoHeaderFlex: !!(header && search && header.contains(search)),
      filtrosDentroDoHeaderFlex: !!(header && filtros && header.contains(filtros)),
      btnNovaBox: box(btn ?? null),
      // O h1 e a busca deveriam estar em linhas distintas; medimos o eixo Y.
      mesmaLinhaQueOTitulo:
        !!(h1 && search) &&
        Math.abs(h1.getBoundingClientRect().top - search.getBoundingClientRect().top) < 60,
    };
  });
  console.log("[CFG-H1] layoutCabecalho", JSON.stringify(layout));

  // A mesma medida na tela irmã, que serve de referência.
  await visit(page, "/configuracoes/metodos-pagamento", 3000);
  await settle(page);
  const layoutRef = await page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) };
    };
    const h1 = document.querySelector("h1");
    let header: HTMLElement | null = h1?.parentElement ?? null;
    while (header && getComputedStyle(header).display !== "flex") header = header.parentElement;
    const search = document.querySelector('input[placeholder*="Buscar por nome"]');
    return {
      h1Box: box(h1),
      searchBox: box(search),
      buscaDentroDoHeaderFlex: !!(header && search && header.contains(search)),
    };
  });
  console.log("[CFG-H1] layoutReferencia(metodos)", JSON.stringify(layoutRef));
  await visit(page, "/configuracoes/condicoes-pagamento", 3000);
  await settle(page);

  // Texto sem acento (FN-27).
  const bodyTxt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const semAcento = ["Codigo", "Condicao", "condicao", "acao ", "Metodo", "metodo", "autorizacao", "serao", "Cartao"].filter(
    (w) => bodyTxt.includes(w)
  );
  console.log("[CFG-H1] textoSemAcento(tela)", JSON.stringify(semAcento));

  // Abre o dialog e mede.
  await page.getByRole("button", { name: /Nova Condi/i }).click();
  await page.waitForTimeout(900);
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return {
      role: d.getAttribute("role"),
      ariaModal: d.getAttribute("aria-modal"),
      labelledby: d.getAttribute("aria-labelledby"),
      describedby: d.getAttribute("aria-describedby"),
      h: +r.height.toFixed(0),
      radius: cs.borderTopLeftRadius,
      maxH: cs.maxHeight,
    };
  });
  console.log("[CFG-H1] dialogCondicao", JSON.stringify(dlg));
  console.log("[CFG-H1] labelsDialog", JSON.stringify(await labelAudit(page)));
  const dlgTxt = (await page.locator('[role="dialog"]').innerText()).replace(/\s+/g, " ");
  console.log("[CFG-H1] textoDialog", JSON.stringify(dlgTxt.slice(0, 300)));
  await page.screenshot({ path: `${SHOT}/CFG-H1-condicoes-dialog.png`, fullPage: true });

  // Submit vazio dentro do dialog.
  await page.locator('[role="dialog"] input').first().fill("");
  await page.getByRole("button", { name: /^Criar$/ }).click();
  await page.waitForTimeout(900);
  console.log(
    "[CFG-H1] dialogSubmitVazio",
    JSON.stringify({
      erros: await page.locator('[role="dialog"] p.text-destructive').allInnerTexts(),
      toast: await toastTexts(page),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H1-condicoes-submit-vazio.png`, fullPage: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  dumpNoise("CFG-H1", noise);
});

test("CFG-H2 condicoes-pagamento: excluir uma condição em uso", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/configuracoes/condicoes-pagamento", 3000);
  await settle(page);

  const rows = await page.locator("tbody tr").count();
  console.log("[CFG-H2] linhas", rows);
  if (rows === 0) test.skip();

  // O diálogo antecipa o uso antes de confirmar?
  const del = page.locator("tbody tr").first().locator("button").nth(1);
  const tip = await probeTooltip(page, "tbody tr:first-child button:nth-child(2)");
  console.log("[CFG-H2] tooltipExcluir", JSON.stringify(tip));
  await del.click();
  await page.waitForTimeout(700);
  const dialogTxt = await page
    .locator("div.fixed.inset-0 >> nth=0")
    .innerText()
    .catch(() => "(sem)");
  const dlgAria = await page.evaluate(() => {
    const d = document.querySelector("div.fixed.inset-0.z-50");
    return d
      ? {
          role: d.getAttribute("role"),
          ariaModal: d.getAttribute("aria-modal"),
          labelledby: d.getAttribute("aria-labelledby"),
          focoAtual: (document.activeElement?.tagName ?? "").toLowerCase(),
          focoDentro: d.contains(document.activeElement),
        }
      : null;
  });
  console.log("[CFG-H2] confirmDialog", JSON.stringify({ texto: dialogTxt.replace(/\s+/g, " ").slice(0, 250), aria: dlgAria }));
  await page.screenshot({ path: `${SHOT}/CFG-H2-confirm-excluir.png`, fullPage: true });

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "DELETE", { timeout: 15000 }).catch(() => null),
    page.getByRole("button", { name: /^Confirmar$|^Excluir$/ }).first().click(),
  ]);
  const t = await waitToast(page);
  console.log(
    "[CFG-H2] exclusao",
    JSON.stringify({
      status: resp?.status(),
      corpo: resp ? (await resp.text()).slice(0, 250) : "(sem request)",
      toast: t,
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H2-exclusao-resultado.png`, fullPage: true });
  dumpNoise("CFG-H2", noise);
});

test("CFG-H3 metodos-pagamento: tokens, texto, dialog e erro de mutação", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);
  await visit(page, "/configuracoes/metodos-pagamento", 3000);
  await settle(page);

  const m = await measure(page);
  dumpMeasure("CFG-H3", m);
  await page.screenshot({ path: `${SHOT}/CFG-H3-metodos-1440.png`, fullPage: true });

  const bodyTxt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(
    "[CFG-H3] textoSemAcento(tela)",
    JSON.stringify(["Metodo", "metodo", "Cartao", "autorizacao", "serao", "Codigo"].filter((w) => bodyTxt.includes(w)))
  );

  // Existe botão de excluir método?
  const rowBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll("tbody tr:first-child button")).map((b) => ({
      aria: b.getAttribute("aria-label"),
      title: b.getAttribute("title"),
      svg: b.querySelector("svg")?.getAttribute("class")?.slice(0, 40),
    }))
  );
  console.log("[CFG-H3] botoesLinha", JSON.stringify(rowBtns));
  const tip = await probeTooltip(page, "tbody tr:first-child button");
  console.log("[CFG-H3] tooltipEditar", JSON.stringify(tip));

  // Dialog "Novo Método"
  await page.getByRole("button", { name: /Novo M[eé]todo/i }).click();
  await page.waitForTimeout(900);
  console.log("[CFG-H3] labelsDialog", JSON.stringify(await labelAudit(page)));
  const dlgTxt = (await page.locator('[role="dialog"]').innerText()).replace(/\s+/g, " ");
  console.log("[CFG-H3] textoDialog", JSON.stringify(dlgTxt.slice(0, 400)));
  await page.screenshot({ path: `${SHOT}/CFG-H3-metodos-dialog.png`, fullPage: true });

  // Nome longo: o zod tem .max(100) sem mensagem — a mensagem sai em inglês?
  const nameInput = page.locator('[role="dialog"] input').first();
  await nameInput.fill("");
  await page.getByRole("button", { name: /^Criar$/ }).click();
  await page.waitForTimeout(900);
  console.log(
    "[CFG-H3] dialogSubmitVazio",
    JSON.stringify({
      erros: await page.locator('[role="dialog"] p.text-destructive').allInnerTexts(),
      toast: await toastTexts(page),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H3-metodos-submit-vazio.png`, fullPage: true });

  // Código fiscal > 5 caracteres via schema (o maxLength do input trava, então
  // forçamos pelo DOM para ver a mensagem do zod).
  const fiscal = page.locator('[role="dialog"] input').nth(3);
  await nameInput.fill(`Metodo ${SUFFIX}`);
  await page.waitForTimeout(200);

  // Alinhamento dos controles dentro do diálogo (Input 40px x SelectTrigger 36px).
  const dlgControls = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const grid = d.querySelector(".grid");
    return Array.from(grid?.querySelectorAll("input, [role=combobox]") ?? []).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        h: +r.height.toFixed(1),
        top: +r.top.toFixed(1),
        bottom: +r.bottom.toFixed(1),
      };
    });
  });
  console.log("[CFG-H3] alturaControlesDoDialog", JSON.stringify(dlgControls));

  // Erro do backend: o toast tem que repetir a mensagem, não engoli-la.
  await page.route("**/payment-methods", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          statusCode: 409,
          message: "Já existe um método de pagamento com o nome \"Boleto\"",
        }),
      });
      return;
    }
    await route.fallback();
  });
  await nameInput.fill(`Metodo ${SUFFIX}`);
  // Tipo CASH exige conta vinculada (VD-11) — escolhe a primeira disponível.
  const accountTrigger = page.locator('[role="dialog"] [role=combobox]').last();
  await accountTrigger.click();
  await page.waitForTimeout(500);
  const opts = page.getByRole("option");
  if ((await opts.count()) > 1) await opts.nth(1).click();
  await page.waitForTimeout(400);
  const [resp] = await Promise.all([
    page
      .waitForResponse((r) => r.url().includes("payment-methods") && r.request().method() === "POST", {
        timeout: 15000,
      })
      .catch(() => null),
    page.getByRole("button", { name: /^Criar$/ }).click(),
  ]);
  const t = await waitToast(page);
  console.log(
    "[CFG-H3] erro409",
    JSON.stringify({
      status: resp?.status(),
      corpo: resp ? (await resp.text()).slice(0, 200) : "(sem request)",
      toast: t,
      repeteOBackend: t.includes("Já existe um método de pagamento"),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H3-metodos-erro-409.png`, fullPage: true });
  await page.unroute("**/payment-methods");
  await page.keyboard.press("Escape");
  void fiscal;
  dumpNoise("CFG-H3", noise);
});

test("CFG-H4a metodos/condicoes: um 500 vira estado vazio? (AE-28)", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  await page.route("**/payment-methods**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' })
  );
  await visit(page, "/configuracoes/metodos-pagamento", 3000);
  await settle(page, 15000);
  const t1 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(
    "[CFG-H4a] metodos500",
    JSON.stringify({
      mostraVazio: /Nenhum m[ée]todo de pagamento cadastrado/i.test(t1),
      trecho: t1.slice(t1.indexOf("Métodos"), t1.indexOf("Métodos") + 250),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H4a-metodos-500.png`, fullPage: true });
  await page.unroute("**/payment-methods**");

  await page.route("**/payment-conditions**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' })
  );
  await visit(page, "/configuracoes/condicoes-pagamento", 3000);
  await settle(page, 15000);
  const t2 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(
    "[CFG-H4a] condicoes500",
    JSON.stringify({
      mostraVazio: /Nenhuma condi[çc][ãa]o de pagamento cadastrada/i.test(t2),
      trecho: t2.slice(0, 250),
    })
  );
  await page.screenshot({ path: `${SHOT}/CFG-H4a-condicoes-500.png`, fullPage: true });
  await page.unroute("**/payment-conditions**");
  dumpNoise("CFG-H4a", noise);
});

test("CFG-H4b configuracoes: responsivo 390/768 e um formulário no tema escuro", async ({ page }) => {
  const noise = captureNoise(page);
  await authenticate(page);

  for (const w of [390, 768]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const r of ["/configuracoes/condicoes-pagamento", "/configuracoes/metodos-pagamento", "/configuracoes/perfil"]) {
      await visit(page, r, 2500);
      await settle(page, 12000);
      const mm = await measure(page);
      console.log(
        `[CFG-H4b] ${r}@${w}`,
        JSON.stringify({
          overflow: mm.horizontalOverflow,
          doc: `${mm.docScrollWidth}/${mm.docClientWidth}`,
          clipped: mm.clippedNoScroll.slice(0, 3),
        })
      );
      await page.screenshot({
        path: `${SHOT}/CFG-H4b-${r.split("/").pop()}-${w}.png`,
        fullPage: true,
      });
    }
  }

  const dark = await page.context().newPage();
  await dark.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await dark.setViewportSize({ width: 1440, height: 900 });
  await dark.goto("/clientes/novo", { waitUntil: "domcontentloaded" });
  await dark.waitForTimeout(2500);
  const md = await measure(dark);
  console.log(
    "[CFG-H4b] clientes/novo dark",
    JSON.stringify({ lowContrast: md.lowContrast.slice(0, 6), hardcoded: md.hardcodedColors.slice(0, 6) })
  );
  await dark.screenshot({ path: `${SHOT}/CFG-H4b-clientes-novo-dark.png`, fullPage: true });
  await dark.close();
  dumpNoise("CFG-H4b", noise);
});


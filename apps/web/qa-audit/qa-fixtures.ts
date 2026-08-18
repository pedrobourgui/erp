import { test as base, expect, type Page } from "@playwright/test";

export const API_URL = process.env.QA_API_URL ?? "http://localhost:3001/api/v1";

export const CREDENTIALS = {
  owner: { email: "admin@admin.com", password: "123456" },
  seller: { email: "vendedor@exemplo.com", password: "Vendedor@123" },
} as const;

export type Role = keyof typeof CREDENTIALS;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string };
}

export async function apiLogin(role: Role = "owner"): Promise<Session> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDENTIALS[role]),
  });
  if (!res.ok) throw new Error(`login ${role} failed: ${res.status}`);
  const body = (await res.json()) as { data?: Session } & Session;
  return (body.data ?? body) as Session;
}

/** Everything the browser complained about while the page was open. */
export interface Noise {
  console: string[];
  pageerror: string[];
  http: string[];
}

export const test = base;

/**
 * Arms capture and seeds the auth token. Call at the top of each test that
 * needs an authenticated page — kept explicit rather than as an auto-fixture so
 * a test can observe the unauthenticated states too.
 */
export async function authenticate(page: Page, role: Role = "owner", theme: "light" | "dark" = "light") {
  const session = await apiLogin(role);

  // Seeding through an init script alone is not enough: the dark class has to
  // survive every client-side navigation, and the tokens have to exist on an
  // origin the page already visited. Do both.
  await page.context().addInitScript(
    (t: string) => {
      try {
        localStorage.setItem("theme", t);
        if (t === "dark") document.documentElement.classList.add("dark");
      } catch {
        /* storage unavailable */
      }
    },
    theme
  );

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([access, refresh]) => {
      localStorage.setItem("erp_token", access);
      localStorage.setItem("erp_refresh_token", refresh);
    },
    [session.accessToken, session.refreshToken]
  );
  return session;
}

/** Attaches console/pageerror/HTTP capture to a page and returns the sink. */
export function captureNoise(page: Page): Noise {
  const noise: Noise = { console: [], pageerror: [], http: [] };
  page.on("console", (m) => {
    if (m.type() === "error") noise.console.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => noise.pageerror.push(String(e).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400) noise.http.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return noise;
}

/** Navigate and let React Query settle. */
export async function visit(page: Page, path: string, wait = 2000) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
}

export interface Measurements {
  horizontalOverflow: boolean;
  docScrollWidth: number;
  docClientWidth: number;
  clippedNoScroll: { el: string; scrollWidth: number; clientWidth: number }[];
  smallHitTargets: { el: string; w: number; h: number }[];
  oddSpacing: { el: string; prop: string; value: string }[];
  lowContrast: { el: string; ratio: number; required: number; color: string; bg: string; fontSize: string }[];
  hardcodedColors: { el: string; classes: string[] }[];
  missingFocusRing: { el: string }[];
  inconsistentRadius: { el: string; radius: string }[];
}

/**
 * Measures, straight from the rendered DOM, the facts a UX review argues about:
 * overflow, contrast, spacing scale, hit-target size, focus rings, radii and
 * colors written as literals instead of tokens.
 */
export async function measure(page: Page): Promise<Measurements> {
  return page.evaluate(() => {
    const out: Measurements = {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      clippedNoScroll: [],
      smallHitTargets: [],
      oddSpacing: [],
      lowContrast: [],
      hardcodedColors: [],
      missingFocusRing: [],
      inconsistentRadius: [],
    };
    const px = (v: string) => parseFloat(v) || 0;
    const lum = (c: string) => {
      const m = c.match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b, a = 1] = m.map(Number);
      if (a === 0) return null;
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
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(/\s+/).slice(0, 4).join(".")} "${(el.textContent || "").trim().slice(0, 40)}"`;

    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "hidden" && cs.textOverflow !== "ellipsis")
        out.clippedNoScroll.push({ el: label(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });

      const interactive =
        el.matches("button,a[href],input,select,textarea,[role=button],[role=tab],[role=menuitem],[role=switch]") &&
        !el.hasAttribute("disabled");
      if (interactive) {
        if (r.height < 24 || r.width < 24)
          out.smallHitTargets.push({ el: label(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
        const cls = (el.className || "").toString();
        if (!/focus-visible:|focus:/.test(cls) && cs.outlineStyle === "none")
          out.missingFocusRing.push({ el: label(el) });
      }

      for (const p of ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "gap", "marginBottom"] as const) {
        const v = px((cs as unknown as Record<string, string>)[p]);
        if (v > 0 && v < 100 && Math.abs(v % 4) > 0.5 && Math.abs((v % 4) - 4) > 0.5)
          out.oddSpacing.push({ el: label(el), prop: p, value: (cs as unknown as Record<string, string>)[p] });
      }

      const radius = cs.borderRadius;
      if (radius && radius !== "0px" && el.matches("button,input,select,textarea,[class*=card],[class*=badge],[role=dialog]")) {
        const v = px(radius);
        const allowed = [2, 4, 6, 8, 10, 9999];
        if (!allowed.some((a) => Math.abs(v - a) < 1.5) && v < 500)
          out.inconsistentRadius.push({ el: label(el), radius });
      }

      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || "").trim().length > 1);
      if (ownText) {
        const l1 = lum(cs.color);
        const l2 = lum(bgOf(el));
        if (l1 !== null && l2 !== null) {
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const size = px(cs.fontSize);
          const bold = px(cs.fontWeight) >= 700;
          const large = size >= 24 || (size >= 18.66 && bold);
          const min = large ? 3 : 4.5;
          if (ratio < min)
            out.lowContrast.push({
              el: label(el),
              ratio: +ratio.toFixed(2),
              required: min,
              color: cs.color,
              bg: bgOf(el),
              fontSize: cs.fontSize,
            });
        }
      }
    }

    for (const el of all) {
      const cls = (el.className || "").toString();
      const m = cls.match(
        /(?:text|bg|border|ring)-\[#[0-9a-fA-F]{3,8}\]|(?:text|bg|border)-(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|emerald|amber|orange|indigo|purple)-\d{2,3}/g
      );
      if (m) out.hardcodedColors.push({ el: label(el), classes: Array.from(new Set(m)).slice(0, 6) });
    }

    const dedupe = <T,>(arr: T[], k: (x: T) => string, n = 25) => {
      const seen = new Set<string>();
      return arr.filter((x) => (seen.has(k(x)) ? false : (seen.add(k(x)), true))).slice(0, n);
    };
    out.clippedNoScroll = dedupe(out.clippedNoScroll, (x) => x.el);
    out.smallHitTargets = dedupe(out.smallHitTargets, (x) => x.el);
    out.oddSpacing = dedupe(out.oddSpacing, (x) => x.prop + x.value, 20);
    out.lowContrast = dedupe(out.lowContrast, (x) => x.color + x.bg + x.fontSize, 20);
    out.hardcodedColors = dedupe(out.hardcodedColors, (x) => x.classes.join(","), 20);
    out.missingFocusRing = dedupe(out.missingFocusRing, (x) => x.el, 15);
    out.inconsistentRadius = dedupe(out.inconsistentRadius, (x) => x.radius, 10);
    return out;
  });
}

/** Does hovering this element actually produce a tooltip? */
export async function probeTooltip(page: Page, selector: string) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return { found: false as const };
  await el.hover();
  await page.waitForTimeout(500);
  const tip = page.locator('[role="tooltip"], [data-radix-popper-content-wrapper]');
  const visible = (await tip.count()) > 0 && (await tip.first().isVisible().catch(() => false));
  return {
    found: true as const,
    tooltip: visible ? await tip.first().innerText().catch(() => "") : null,
    title: await el.getAttribute("title"),
    ariaLabel: await el.getAttribute("aria-label"),
  };
}

export { expect };

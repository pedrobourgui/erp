# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/web/e2e/filtros.spec.ts >> filtros >> FT-01: Movimentações não tem filtro de entidade em texto livre
- Location: apps/web/e2e/filtros.spec.ts:36:9

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "undefined/login", waiting until "domcontentloaded"

```

# Test source

```ts
  77  |  *
  78  |  * Hardcoding one makes the second run fail with 409 — the duplicate rule from
  79  |  * AE-15 doing its job. The check digits are computed so the document passes the
  80  |  * same validator the API uses.
  81  |  */
  82  | export function makeCpf(seed: number = Date.now()): string {
  83  |   const base = String(seed).slice(-9).padStart(9, "0").split("").map(Number);
  84  |   const digit = (nums: number[]) => {
  85  |     const weightStart = nums.length + 1;
  86  |     const sum = nums.reduce((acc, n, i) => acc + n * (weightStart - i), 0);
  87  |     const rest = (sum * 10) % 11;
  88  |     return rest === 10 ? 0 : rest;
  89  |   };
  90  |   const d1 = digit(base);
  91  |   const d2 = digit([...base, d1]);
  92  |   return [...base, d1, d2].join("");
  93  | }
  94  | 
  95  | export function stamp(): string {
  96  |   return Date.now().toString().slice(-8);
  97  | }
  98  | 
  99  | // ─── Fixtures ───────────────────────────────────────────────────────────
  100 | 
  101 | interface Fixtures {
  102 |   /** A page already authenticated as `owner`. */
  103 |   appPage: Page;
  104 |   /** API client authenticated as `owner`, for side-effect assertions. */
  105 |   apiClient: ApiClient;
  106 |   session: ApiSession;
  107 |   /** Signs in as any role and returns a fresh page. */
  108 |   signInAs: (role: Role) => Promise<{ page: Page; session: ApiSession }>;
  109 | }
  110 | 
  111 | /**
  112 |  * Global instrumentation (step 4 of 10.3).
  113 |  *
  114 |  * Every journey fails on an uncaught page error, a console error or an HTTP
  115 |  * 5xx. On its own this would have caught AE-00 (the white screen) and AE-09
  116 |  * (the hooks violation in every confirmation dialog) with no assertion written
  117 |  * for either.
  118 |  */
  119 | const IGNORED_CONSOLE = [
  120 |   /favicon/i,
  121 |   /Download the React DevTools/i,
  122 |   /punycode/i,
  123 |   // Next dev overlay noise, not application errors.
  124 |   /Fast Refresh/i,
  125 | ];
  126 | 
  127 | export function instrument(page: Page) {
  128 |   const pageErrors: string[] = [];
  129 |   const consoleErrors: string[] = [];
  130 |   const serverErrors: string[] = [];
  131 | 
  132 |   page.on("pageerror", (error) => pageErrors.push(String(error)));
  133 |   page.on("console", (message) => {
  134 |     if (message.type() !== "error") return;
  135 |     const text = message.text();
  136 |     if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
  137 |     // A página 404 responde 404 — é o comportamento correto, e o browser
  138 |     // registra isso como erro de console. Ignorado só quando a URL do erro é
  139 |     // o próprio documento: um 404 de chamada de API continua sendo falha.
  140 |     if (
  141 |       /status of 404/.test(text) &&
  142 |       message.location().url === page.url()
  143 |     ) {
  144 |       return;
  145 |     }
  146 |     consoleErrors.push(text);
  147 |   });
  148 |   page.on("response", (response) => {
  149 |     if (response.status() >= 500) {
  150 |       serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  151 |     }
  152 |   });
  153 | 
  154 |   return {
  155 |     assertClean() {
  156 |       expect(pageErrors, "erro de JavaScript não tratado na página").toEqual([]);
  157 |       expect(serverErrors, "resposta 5xx durante a jornada").toEqual([]);
  158 |       expect(consoleErrors, "erro no console durante a jornada").toEqual([]);
  159 |     },
  160 |   };
  161 | }
  162 | 
  163 | export const test = base.extend<Fixtures>({
  164 |   session: async ({ request }, use) => {
  165 |     await use(await login(request, "owner"));
  166 |   },
  167 | 
  168 |   apiClient: async ({ request, session }, use) => {
  169 |     await use(api(request, session.accessToken));
  170 |   },
  171 | 
  172 |   appPage: async ({ page, session, baseURL }, use) => {
  173 |     const instrumentation = instrument(page);
  174 | 
  175 |     // Seed the tokens the same way the app does, then navigate: going through
  176 |     // the login form on every test would test the login form 40 times.
> 177 |     await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
      |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  178 |     await page.evaluate(
  179 |       ([access, refresh]) => {
  180 |         localStorage.setItem("erp_token", access);
  181 |         localStorage.setItem("erp_refresh_token", refresh);
  182 |       },
  183 |       [session.accessToken, session.refreshToken]
  184 |     );
  185 | 
  186 |     await use(page);
  187 | 
  188 |     instrumentation.assertClean();
  189 |   },
  190 | 
  191 |   signInAs: async ({ browser, request, baseURL }, use) => {
  192 |     const pages: Page[] = [];
  193 | 
  194 |     await use(async (role: Role) => {
  195 |       const context = await browser.newContext({
  196 |         locale: "pt-BR",
  197 |         timezoneId: "America/Sao_Paulo",
  198 |         viewport: { width: 1440, height: 900 },
  199 |       });
  200 |       const page = await context.newPage();
  201 |       pages.push(page);
  202 |       const roleSession = await login(request, role);
  203 |       await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  204 |       await page.evaluate(
  205 |         ([access, refresh]) => {
  206 |           localStorage.setItem("erp_token", access);
  207 |           localStorage.setItem("erp_refresh_token", refresh);
  208 |         },
  209 |         [roleSession.accessToken, roleSession.refreshToken]
  210 |       );
  211 |       return { page, session: roleSession };
  212 |     });
  213 | 
  214 |     await Promise.all(pages.map((page) => page.context().close()));
  215 |   },
  216 | });
  217 | 
  218 | export { expect };
  219 | 
  220 | // ─── Deterministic mass (step 5 of 10.3) ────────────────────────────────
  221 | 
  222 | export interface SellableProduct {
  223 |   id: string;
  224 |   name: string;
  225 |   sku: string;
  226 |   available: number;
  227 | }
  228 | 
  229 | /**
  230 |  * Available balance of a product row.
  231 |  *
  232 |  * Two names on purpose: `GET /products` answers `inventory` and
  233 |  * `GET /products/:id` answers `inventorySummary` — the same aggregate under two
  234 |  * keys. Reading only one of them silently returns 0 and an assertion on the
  235 |  * stock passes for the wrong reason. Registered as a contract finding; the
  236 |  * suite reads both until the API settles on one.
  237 |  */
  238 | function availableOf(product: Record<string, unknown>): number {
  239 |   const summary = (product.inventorySummary ?? product.inventory) as
  240 |     | { totalAvailable?: number }
  241 |     | undefined;
  242 |   return Number(summary?.totalAvailable ?? 0);
  243 | }
  244 | 
  245 | /**
  246 |  * A product with stock to sell, created if the base has none.
  247 |  *
  248 |  * Depending on whatever the previous run left behind is how a suite starts
  249 |  * failing for reasons unrelated to the code: the journeys here consume stock,
  250 |  * so the tenth run would find nothing to sell.
  251 |  */
  252 | export async function ensureSellableProduct(
  253 |   client: ApiClient,
  254 |   minimumStock = 5
  255 | ): Promise<SellableProduct> {
  256 |   const listed = await client.get("/products?limit=50&status=ACTIVE");
  257 |   const products = (listed.body as { data?: Record<string, unknown>[] }).data ?? [];
  258 |   const existing = products.find((p) => availableOf(p) >= minimumStock);
  259 |   if (existing) {
  260 |     return {
  261 |       id: existing.id as string,
  262 |       name: existing.name as string,
  263 |       sku: existing.sku as string,
  264 |       available: availableOf(existing),
  265 |     };
  266 |   }
  267 | 
  268 |   const suffix = stamp();
  269 |   const created = await client.post("/products", {
  270 |     name: `E2E Produto ${suffix}`,
  271 |     sku: `E2E-${suffix}`,
  272 |     status: "ACTIVE",
  273 |     costPrice: 10,
  274 |     salePrice: 20,
  275 |   });
  276 |   expect(created.status, `criação do produto E2E: ${JSON.stringify(created.body)}`).toBe(201);
  277 |   const product = (created.body as { data: { id: string; name: string; sku: string } }).data;
```
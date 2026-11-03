# UI testing

The `e2e/` folder holds a dependency-free Playwright toolkit for the dashboard:

| Script | What it does | Output |
| --- | --- | --- |
| `npm run test:e2e` | Smoke suite: opens **every** route in `src/App.tsx` for each role that may open it and asserts it rendered cleanly. Exit code 1 on failures. | `e2e/report/smoke.json`, `e2e/report/smoke.md` |
| `npm run e2e:capture` | Screenshots every route in light and dark theme (1440×900; `/waiter`, `/owner`, `/order`, `/display`, `/kiosk` routes also at 390×844). | `e2e/report/shots/<theme>/<route>.png` (`<route>@mobile.png` for the phone size), `e2e/report/capture-<theme>.json` |
| `npm run e2e:contrast` | Dark-mode contrast audit: samples the computed colours of all visible text and lists pairs with a WCAG contrast ratio below 3.0. | `e2e/report/contrast-dark.json`, `e2e/report/contrast-dark.md` |

The runners are plain Node ESM scripts (`e2e/**/*.mjs`) driven by the globally
installed `playwright` package, so nothing needs to be installed in the repo and
they stay outside the app's `tsconfig` (`tsc -b` only includes `src`).
`playwright.config.ts` mirrors the same settings for a future `@playwright/test`
setup; the runners themselves read `e2e/lib/config.mjs`.

## Running locally

You need the full local stack with the seeded demo database:

1. API running on `http://localhost:5068` (Swagger at `/swagger`) against a
   seeded database. The runners log in through `POST /api/auth/login` with the
   seeded accounts `admin@axislb.com`, `cashier@axislb.com`,
   `gamecashier@axislb.com` and `chef@axislb.com` (password `Axis@12345`), and
   read demo data (`GET /kiosk/devices` for the kiosk token, self-order table
   `TBL-1`).
2. UI dev server: `npm run dev` (`http://localhost:5173`). A production
   `vite preview` works as well; point `E2E_BASE_URL` at it.
3. Chromium for Playwright (`npx playwright install chromium` if the global
   package has no browser yet).

Then:

```bash
npm run test:e2e                      # smoke suite, exit 1 on failures
npm run e2e:capture                   # light + dark screenshots
npm run e2e:contrast                  # dark-mode contrast findings

# variants
node e2e/smoke/run.mjs --only /admin/promotions --role admin --theme dark
node e2e/capture/run.mjs --theme dark --only /owner --viewport-only
node e2e/a11y-contrast/run.mjs --theme dark --threshold 4.5 --strict
```

Environment variables (all optional):

| Variable | Default | Meaning |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:5173` | UI origin |
| `E2E_API_URL` | `http://localhost:5068/api` | API base URL used for login and data lookups |
| `E2E_PASSWORD` | `Axis@12345` | password of the seeded accounts |
| `E2E_ADMIN_EMAIL`, `E2E_CASHIER_EMAIL`, `E2E_GAMECASHIER_EMAIL`, `E2E_CHEF_EMAIL` | `<role>@axislb.com` | account per role |

The suite takes a few minutes (about 100 route/role combinations, ~3 s each).
A run filtered with `--only` or `--role` writes `smoke-partial.*` so it does not
overwrite the full report.

## How routes are discovered

`e2e/lib/routes.mjs` parses `src/App.tsx` at run time (JSX comments are
stripped, so a commented-out `<Route>` is not tested). Every `path="..."` is
collected together with the guard that wraps it, either its own
`element={<XxxRoute>…}` or the guard of the enclosing layout route. New routes
are therefore picked up automatically; nothing has to be registered.

| Guard in `App.tsx` | Opened as |
| --- | --- |
| `AdminRoute` | admin |
| `CashierRoute` | cashier |
| `GameCashieRoute` | gamecashier |
| `ChefRoute` | chef |
| `ProtectedRoute` (own or inherited from the layout) | admin **and** cashier |
| no guard, outside the layout | public, no token |
| `AdminFnBRoute`, `BarTenderRoute` | skipped (no seeded account); reported as `SKIP` |

Dynamic segments get demo values: `/order/:tableCode` → `TBL-1`,
`/waiter/table/:tableId` → `1`, any other `:param` → `1`
(`demoParams` in `e2e/lib/config.mjs`).

Guarded routes cannot be hard-loaded (the guard redirects to `/signin` before
`AuthContext` has decoded the token), so the runner seeds `localStorage`
(`access_token`, and `theme` for dark mode) through an init script, loads a
cheap public page (`/__e2e__/boot`, the NotFound route), waits for React to
mount and then navigates client-side with `history.pushState` + `popstate`.
Public routes are loaded directly.

## What the smoke suite asserts per route/role

- no uncaught page error (`page.on('pageerror')`);
- no `console.error` whose text contains `Uncaught` or `React` (all console
  errors are still listed in the report);
- a page title appears within 10 s: `h1`, `h2`, `[data-page-title]` or the
  `PageBreadcrumb` (`nav ol li`), ignoring the sidebar/header when the app
  layout is present;
- the page did not redirect to `/signin` (guarded routes) and did not redirect
  elsewhere (except `/`, whose `RoleHome` redirects by design, and routes with
  `allowRedirectTo` in the exceptions file);
- no API response with status ≥ 500 (`page.on('response')`); 4xx responses
  are recorded as information only;
- pages that take longer than 5 s to render and settle are flagged `slow`
  (not a failure).

The Markdown report lists pass/fail per route, console errors, slow pages and
all API responses ≥ 400.

## Adding a route exception

Edit `e2e/route-exceptions.json`. Keys are the exact `path="…"` values from
`App.tsx`; every field is optional:

```json
{
  "/kiosk": { "query": "?token=${kioskToken}" },
  "/signup": { "skip": "sign-up is disabled in the product" },
  "/some/page": { "roles": ["admin"], "allowRedirectTo": "/some/page/list", "titleSelector": "[data-testid=title]" }
}
```

- `skip` — do not open the route; the reason shows up as `SKIP` in the report.
- `roles` — override the guard mapping (`null` in the list means public).
- `query` — query string appended to the URL. `${kioskToken}` is resolved at
  run time from `GET /api/kiosk/devices` (first active device) as admin; add
  more resolvers in `resolveVars` in `e2e/lib/session.mjs`.
- `allowRedirectTo` — a client-side redirect to this path is not a failure.
- `titleSelector` — custom CSS selector for the page-title assertion.
- any other key (e.g. `$why`) is ignored, so it can hold a comment.

To exclude a block of markup from the title lookup or the contrast sampler,
add `data-e2e-ignore` to it.

## Contrast audit details

`e2e/lib/contrast.mjs` runs inside the page: it walks every visible text node,
converts the computed `color` and `background-color` (including Tailwind's
`oklch()` values) to sRGB through a canvas, composites translucent layers over
their ancestors (and the element's effective `opacity`), skips elements whose
background comes from an image/gradient, and computes the WCAG 2 contrast
ratio. Findings are de-duplicated per page by tag + class list + colours and
sorted by ratio. The Markdown report starts with the styles that recur on the
most pages, which are the cheapest fixes, then lists findings per page with a
CSS selector, the element's class list and a text snippet.

The audit exits 0 unless `--strict` is passed.

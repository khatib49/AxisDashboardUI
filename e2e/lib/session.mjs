// Login + navigation helpers shared by every runner.
//
// Guarded routes must be entered client-side: a hard load of e.g. /admin/users
// redirects to /signin before AuthContext has decoded the token. So we load a
// cheap public page first (the NotFound route, outside the app layout), let the
// providers mount, then pushState + popstate to the target route.
import { createRequire } from "node:module";
import { apiUrl, baseUrl, accounts, password, timeouts } from "./config.mjs";

// `playwright` is pre-installed globally (NODE_PATH); createRequire honours it.
const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export const BOOT_PATH = "/__e2e__/boot";

export async function login(email) {
  const r = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email} failed: HTTP ${r.status}`);
  const body = await r.json();
  if (!body.token) throw new Error(`login ${email}: no token in response`);
  return body.token;
}

/** Logs in every account in `roles` (null = public, no token). */
export async function loginRoles(roles) {
  const tokens = {};
  for (const role of roles) {
    if (!role || tokens[role]) continue;
    tokens[role] = await login(accounts[role]);
  }
  return tokens;
}

export async function apiGet(path, token) {
  const r = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

/** Runtime values for ${placeholders} in route-exceptions.json. */
export async function resolveVars(tokens) {
  const vars = {};
  if (tokens.admin) {
    const devices = await apiGet("/kiosk/devices", tokens.admin).catch(() => null);
    const active = Array.isArray(devices) ? devices.find((d) => d.isActive) || devices[0] : null;
    if (active?.token) vars.kioskToken = active.token;
  }
  return vars;
}

export async function newContext(browser, { token, theme = "light", viewport }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: theme === "dark" ? "dark" : "light",
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(
    ({ token, theme }) => {
      try {
        localStorage.setItem("theme", theme);
        if (token) localStorage.setItem("access_token", token);
        else localStorage.removeItem("access_token");
      } catch {
        /* storage may be unavailable */
      }
    },
    { token: token || null, theme },
  );
  return context;
}

/** Attaches error / response collectors to a page. Call `reset()` per route. */
export function attachCollectors(page) {
  const c = { pageErrors: [], consoleErrors: [], serverErrors: [], clientErrors: [] };
  page.on("pageerror", (e) => c.pageErrors.push(String(e?.message || e).slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error") c.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 500) {
      c.serverErrors.push({ status, method: res.request().method(), url: res.url() });
    } else if (status >= 400 && res.url().startsWith(apiUrl)) {
      c.clientErrors.push({ status, method: res.request().method(), url: res.url() });
    }
  });
  c.reset = () => {
    c.pageErrors.length = 0;
    c.consoleErrors.length = 0;
    c.serverErrors.length = 0;
    c.clientErrors.length = 0;
  };
  return c;
}

/**
 * Navigates `page` to a route. Public routes are loaded directly; guarded
 * routes go through the boot page and a client-side pushState.
 */
export async function openRoute(page, { url, query = "", isPublic }) {
  const target = url + query;
  if (isPublic) {
    await page.goto(baseUrl + target, { waitUntil: "domcontentloaded", timeout: timeouts.boot });
    return;
  }
  await page.goto(baseUrl + BOOT_PATH, { waitUntil: "domcontentloaded", timeout: timeouts.boot });
  // wait for React to have mounted the providers, then for their effects to
  // flush: AuthContext decodes the token in a useEffect one commit after the
  // first paint, and a pushState inside that window makes the guards see an
  // authenticated user without roles and bounce to "/".
  await page.waitForSelector("#root > *", { timeout: timeouts.boot });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 100))));
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, target);
}

export const TITLE_SELECTOR = "h1, h2, [data-page-title], nav ol li, .page-title";

// Runs in the browser: the first page title outside the app chrome. Inside the
// app layout (which has an <aside> sidebar) headings in <aside>/<header> are
// ignored; layout-less pages (kiosk, self-order, ...) may title themselves in
// a <header>.
function findTitle(sel) {
  const inLayout = !!document.querySelector("aside");
  const ignore = inLayout ? "aside, header, [data-e2e-ignore]" : "[data-e2e-ignore]";
  const nodes = Array.from(document.querySelectorAll(sel));
  const el = nodes.find((n) => !n.closest(ignore) && n.textContent.trim());
  return el ? el.textContent.trim().slice(0, 80) : null;
}

/**
 * Waits for a page title (h1 / h2 / [data-page-title] / breadcrumb) outside
 * the sidebar and header. Returns { found, ms, title }.
 */
export async function waitForTitle(page, selector, timeout = timeouts.title) {
  const started = Date.now();
  const sel = selector || TITLE_SELECTOR;
  try {
    const handle = await page.waitForFunction(findTitle, sel, { timeout, polling: 150 });
    const title = await handle.jsonValue();
    return { found: true, ms: Date.now() - started, title };
  } catch {
    return { found: false, ms: Date.now() - started, title: null };
  }
}

/** The page title once the page has settled (transient loading states may win the first match). */
export async function readTitle(page, selector) {
  return page.evaluate(findTitle, selector || TITLE_SELECTOR).catch(() => null);
}

/** Lets pending requests finish, so late API errors are collected. */
export async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: timeouts.idle }).catch(() => {});
  await page.waitForTimeout(timeouts.settle);
}

export async function currentPath(page) {
  return page.evaluate(() => window.location.pathname);
}

export const pageTitleText = (page) => page.title().catch(() => "");

// Shared configuration for the e2e runners (smoke, capture, a11y-contrast).
// Everything is plain ESM so it runs with `node` and stays outside the app's
// tsconfig (which only includes `src`).
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, "..", "..");
export const e2eRoot = path.resolve(here, "..");
export const reportDir = path.join(e2eRoot, "report");
export const appTsxPath = path.join(repoRoot, "src", "App.tsx");
export const exceptionsPath = path.join(e2eRoot, "route-exceptions.json");

const trimSlash = (s) => s.replace(/\/+$/, "");
export const baseUrl = trimSlash(process.env.E2E_BASE_URL || "http://localhost:5173");
export const apiUrl = trimSlash(process.env.E2E_API_URL || "http://localhost:5068/api");

export const password = process.env.E2E_PASSWORD || "Axis@12345";

/** Accounts per role. The role key is what the route guards are mapped to. */
export const accounts = {
  admin: process.env.E2E_ADMIN_EMAIL || "admin@axislb.com",
  cashier: process.env.E2E_CASHIER_EMAIL || "cashier@axislb.com",
  gamecashier: process.env.E2E_GAMECASHIER_EMAIL || "gamecashier@axislb.com",
  chef: process.env.E2E_CHEF_EMAIL || "chef@axislb.com",
};

/** Which account(s) may open a route, by guard component name in App.tsx. */
export const guardRoles = {
  AdminRoute: ["admin"],
  CashierRoute: ["cashier"],
  GameCashieRoute: ["gamecashier"],
  ChefRoute: ["chef"],
  ProtectedRoute: ["admin", "cashier"],
  // No seeded accounts for these roles: the routes are reported as skipped.
  AdminFnBRoute: [],
  BarTenderRoute: [],
  // Public routes are opened without a token.
  public: [null],
};

/** Demo values for dynamic route segments (":param"). */
export const demoParams = {
  tableCode: "TBL-1",
  tableId: "1",
};
export const defaultDemoParam = "1";

export const timeouts = {
  boot: 45_000, // first load of the SPA (Vite cold start can be slow)
  title: 10_000, // an <h1>/<h2>/[data-page-title]/breadcrumb must appear
  idle: 15_000, // network idle after the route rendered
  settle: 600, // extra quiet time so late API responses are captured
};

export const slowPageMs = 5_000;

export const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Route prefixes that are also captured at the mobile viewport. */
export const mobilePrefixes = ["/waiter", "/owner", "/order", "/display", "/kiosk"];

export const contrastThreshold = 3.0;

/** Minimal argv parser: --key value, --flag, --key=value. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

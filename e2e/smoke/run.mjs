#!/usr/bin/env node
// UI smoke suite: opens every route in src/App.tsx for each role that may open
// it and asserts the page rendered without errors. Exit code 1 on failures.
//
//   node e2e/smoke/run.mjs [--only <substring>] [--role admin] [--theme light|dark]
import path from "node:path";
import {
  baseUrl,
  apiUrl,
  parseArgs,
  slowPageMs,
  viewports,
  timeouts,
} from "../lib/config.mjs";
import { parseRoutes, applyExceptions } from "../lib/routes.mjs";
import {
  chromium,
  loginRoles,
  resolveVars,
  newContext,
  attachCollectors,
  openRoute,
  waitForTitle,
  readTitle,
  settle,
  currentPath,
} from "../lib/session.mjs";
import { writeJson, writeText, mdTable, fmtMs } from "../lib/report.mjs";

const args = parseArgs();
const theme = args.theme === "dark" ? "dark" : "light";
const only = typeof args.only === "string" ? args.only : null;
const roleFilter = typeof args.role === "string" ? args.role : null;

const isBadConsole = (msg) => /Uncaught|React/.test(msg);

async function checkRoute(page, collectors, route, role) {
  collectors.reset();
  const started = Date.now();
  const entry = {
    route: route.path,
    url: route.url + route.query,
    role: role ?? "public",
    guard: route.guard,
    status: "pass",
    reasons: [],
    title: null,
    titleMs: null,
    durationMs: null,
    slow: false,
    finalPath: null,
    pageErrors: [],
    consoleErrors: [],
    serverErrors: [],
    clientErrors: [],
  };
  try {
    await openRoute(page, { url: route.url, query: route.query, isPublic: role == null });
    const t = await waitForTitle(page, route.titleSelector);
    entry.title = t.title;
    entry.titleMs = t.ms;
    await settle(page);
    entry.title = (await readTitle(page, route.titleSelector)) ?? t.title;
    entry.finalPath = await currentPath(page);
    entry.durationMs = Date.now() - started;
    entry.slow = entry.durationMs > slowPageMs;

    if (!t.found) entry.reasons.push(`no page title (h1/h2/[data-page-title]/breadcrumb) within ${timeouts.title / 1000}s`);
    if (role != null && entry.finalPath === "/signin") entry.reasons.push("redirected to /signin");
    const expected = new Set([route.url, route.allowRedirectTo].filter(Boolean));
    if (route.path === "/") expected.add(entry.finalPath); // RoleHome redirects by design
    if (entry.finalPath !== "/signin" && !expected.has(entry.finalPath)) {
      entry.reasons.push(`redirected to ${entry.finalPath}`);
    }
  } catch (e) {
    entry.durationMs = Date.now() - started;
    entry.reasons.push(`navigation error: ${String(e.message || e).split("\n")[0]}`);
  }
  entry.pageErrors = [...collectors.pageErrors];
  entry.consoleErrors = [...collectors.consoleErrors];
  entry.serverErrors = [...collectors.serverErrors];
  entry.clientErrors = [...collectors.clientErrors];
  if (entry.pageErrors.length) entry.reasons.push(`${entry.pageErrors.length} uncaught page error(s)`);
  const bad = entry.consoleErrors.filter(isBadConsole);
  if (bad.length) entry.reasons.push(`${bad.length} console error(s) mentioning Uncaught/React`);
  if (entry.serverErrors.length) entry.reasons.push(`${entry.serverErrors.length} API response(s) >= 500`);
  if (entry.reasons.length) entry.status = "fail";
  return entry;
}

async function main() {
  const routes = parseRoutes();
  const allRoles = new Set(routes.flatMap((r) => r.roles).filter(Boolean));
  const tokens = await loginRoles([...allRoles]);
  const vars = await resolveVars(tokens);
  let plan = applyExceptions(routes, undefined, vars);
  if (only) plan = plan.filter((r) => r.path.includes(only));

  const results = [];
  const browser = await chromium.launch();
  try {
    // group by role so one context (one login) serves many routes
    const byRole = new Map();
    for (const r of plan) {
      if (r.skip) {
        results.push({ route: r.path, role: "-", guard: r.guard, status: "skip", reasons: [r.skip] });
        continue;
      }
      if (!r.roles.length) {
        results.push({ route: r.path, role: "-", guard: r.guard, status: "skip", reasons: [`no seeded account for guard ${r.guard}`] });
        continue;
      }
      for (const role of r.roles) {
        if (roleFilter && (role ?? "public") !== roleFilter) continue;
        if (!byRole.has(role)) byRole.set(role, []);
        byRole.get(role).push(r);
      }
    }
    for (const [role, list] of byRole) {
      const context = await newContext(browser, { token: role ? tokens[role] : null, theme, viewport: viewports.desktop });
      for (const route of list) {
        const page = await context.newPage();
        const collectors = attachCollectors(page);
        const entry = await checkRoute(page, collectors, route, role);
        results.push(entry);
        const mark = entry.status === "pass" ? "ok  " : "FAIL";
        console.log(`${mark} ${(role ?? "public").padEnd(11)} ${route.path.padEnd(42)} ${fmtMs(entry.durationMs)}${entry.slow ? " SLOW" : ""}${entry.reasons.length ? "  " + entry.reasons.join("; ") : ""}`);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    apiUrl,
    theme,
    total: results.length,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    skipped: results.filter((r) => r.status === "skip").length,
    slow: results.filter((r) => r.slow).length,
  };
  // a filtered run must not overwrite the full report
  const reportName = only || roleFilter ? "smoke-partial" : "smoke";
  const jsonFile = writeJson(`${reportName}.json`, { summary, results });

  const rows = results.map((r) => [
    r.status.toUpperCase(),
    r.route,
    r.role,
    r.guard,
    fmtMs(r.durationMs) + (r.slow ? " (slow)" : ""),
    r.reasons.join("; "),
  ]);
  const consoleRows = results
    .filter((r) => r.consoleErrors?.length || r.pageErrors?.length)
    .map((r) => [r.route, r.role, [...(r.pageErrors || []).map((e) => `pageerror: ${e}`), ...(r.consoleErrors || [])].slice(0, 5).join(" / ")]);
  const slowRows = results.filter((r) => r.slow).map((r) => [r.route, r.role, fmtMs(r.durationMs), fmtMs(r.titleMs)]);
  const apiRows = results
    .filter((r) => r.serverErrors?.length || r.clientErrors?.length)
    .map((r) => [r.route, r.role, [...(r.serverErrors || []), ...(r.clientErrors || [])].map((e) => `${e.status} ${e.method} ${e.url.replace(apiUrl, "")}`).slice(0, 6).join(", ")]);

  const md = [
    `# UI smoke report`,
    ``,
    `Generated ${summary.generatedAt} against ${baseUrl} (API ${apiUrl}), theme ${theme}.`,
    ``,
    `**${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.slow} slow (> ${slowPageMs / 1000}s)** out of ${summary.total} route/role checks.`,
    ``,
    `## Routes`,
    ``,
    mdTable(["Status", "Route", "Role", "Guard", "Time", "Reasons"], rows),
    ``,
    `## Console / page errors`,
    ``,
    consoleRows.length ? mdTable(["Route", "Role", "Errors (first 5)"], consoleRows) : "_none_",
    ``,
    `## Slow pages (> ${slowPageMs / 1000}s)`,
    ``,
    slowRows.length ? mdTable(["Route", "Role", "Total", "Title after"], slowRows) : "_none_",
    ``,
    `## API responses >= 400`,
    ``,
    apiRows.length ? mdTable(["Route", "Role", "Responses"], apiRows) : "_none_",
    ``,
  ].join("\n");
  const mdFile = writeText(`${reportName}.md`, md);

  console.log(`\n${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.slow} slow`);
  console.log(`report: ${path.relative(process.cwd(), jsonFile)}, ${path.relative(process.cwd(), mdFile)}`);
  process.exitCode = summary.failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

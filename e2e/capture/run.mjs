#!/usr/bin/env node
// Screenshots every route for a theme into e2e/report/shots/<theme>/<route>.png
// (1440x900). Routes under /waiter, /owner, /order, /display, /kiosk are also
// captured at 390x844 as <route>@mobile.png.
//
//   node e2e/capture/run.mjs --theme light|dark [--only <substring>] [--viewport-only]
import fs from "node:fs";
import path from "node:path";
import { parseArgs, reportDir, viewports, mobilePrefixes, baseUrl } from "../lib/config.mjs";
import { parseRoutes, applyExceptions, routeFileName } from "../lib/routes.mjs";
import {
  chromium,
  loginRoles,
  resolveVars,
  newContext,
  attachCollectors,
  openRoute,
  waitForTitle,
  settle,
} from "../lib/session.mjs";
import { writeJson } from "../lib/report.mjs";

const args = parseArgs();
const theme = args.theme === "dark" ? "dark" : "light";
const only = typeof args.only === "string" ? args.only : null;
const fullPage = !args["viewport-only"];

/** Role used to open a route when several may: admin first, then the others. */
export function captureRole(route) {
  return route.roles.includes("admin") ? "admin" : route.roles[0];
}

async function main() {
  const routes = parseRoutes();
  const tokens = await loginRoles([...new Set(routes.flatMap((r) => r.roles).filter(Boolean))]);
  const vars = await resolveVars(tokens);
  let plan = applyExceptions(routes, undefined, vars).filter((r) => !r.skip && r.roles.length);
  if (only) plan = plan.filter((r) => r.path.includes(only));

  const outDir = path.join(reportDir, "shots", theme);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    const jobs = [];
    for (const r of plan) {
      jobs.push({ route: r, role: captureRole(r), viewport: "desktop" });
      if (mobilePrefixes.some((p) => r.path.startsWith(p))) jobs.push({ route: r, role: captureRole(r), viewport: "mobile" });
    }
    // one context per (role, viewport)
    const groups = new Map();
    for (const j of jobs) {
      const key = `${j.role ?? "public"}|${j.viewport}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(j);
    }
    for (const [, list] of groups) {
      const { role, viewport } = list[0];
      const context = await newContext(browser, { token: role ? tokens[role] : null, theme, viewport: viewports[viewport] });
      for (const { route } of list) {
        const page = await context.newPage();
        const collectors = attachCollectors(page);
        const file = path.join(outDir, `${routeFileName(route.path)}${viewport === "mobile" ? "@mobile" : ""}.png`);
        const entry = { route: route.path, role: role ?? "public", viewport, theme, file: path.relative(reportDir, file), ok: true };
        try {
          await openRoute(page, { url: route.url, query: route.query, isPublic: role == null });
          await waitForTitle(page, route.titleSelector);
          await settle(page);
          await page.screenshot({ path: file, fullPage });
          entry.errors = collectors.pageErrors.length + collectors.consoleErrors.length;
          console.log(`shot ${viewport.padEnd(7)} ${route.path.padEnd(42)} -> ${path.relative(process.cwd(), file)}`);
        } catch (e) {
          entry.ok = false;
          entry.error = String(e.message || e).split("\n")[0];
          console.log(`FAIL ${viewport.padEnd(7)} ${route.path.padEnd(42)} ${entry.error}`);
        }
        results.push(entry);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  writeJson(`capture-${theme}.json`, { generatedAt: new Date().toISOString(), baseUrl, theme, results });
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} captured, ${failed} failed -> ${path.relative(process.cwd(), outDir)}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

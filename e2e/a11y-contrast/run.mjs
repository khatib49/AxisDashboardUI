#!/usr/bin/env node
// Dark-mode contrast audit (no dependencies). Opens every route in the given
// theme (default dark), samples the computed colours of visible text and
// reports pairs whose WCAG contrast ratio is below the threshold (3.0).
//
//   node e2e/a11y-contrast/run.mjs [--theme dark|light] [--only <substring>]
//        [--threshold 3] [--strict]   (--strict exits 1 when findings exist)
import path from "node:path";
import { parseArgs, viewports, baseUrl, contrastThreshold } from "../lib/config.mjs";
import { parseRoutes, applyExceptions } from "../lib/routes.mjs";
import {
  chromium,
  loginRoles,
  resolveVars,
  newContext,
  openRoute,
  waitForTitle,
  settle,
} from "../lib/session.mjs";
import { sampleContrast } from "../lib/contrast.mjs";
import { writeJson, writeText, mdTable } from "../lib/report.mjs";

const args = parseArgs();
const theme = args.theme === "light" ? "light" : "dark";
const only = typeof args.only === "string" ? args.only : null;
const threshold = args.threshold ? Number(args.threshold) : contrastThreshold;
const PER_PAGE = 40;

const pickRole = (route) => (route.roles.includes("admin") ? "admin" : route.roles[0]);

async function main() {
  const routes = parseRoutes();
  const tokens = await loginRoles([...new Set(routes.flatMap((r) => r.roles).filter(Boolean))]);
  const vars = await resolveVars(tokens);
  let plan = applyExceptions(routes, undefined, vars).filter((r) => !r.skip && r.roles.length);
  if (only) plan = plan.filter((r) => r.path.includes(only));

  const browser = await chromium.launch();
  const pages = [];
  try {
    const groups = new Map();
    for (const r of plan) {
      const role = pickRole(r);
      if (!groups.has(role)) groups.set(role, []);
      groups.get(role).push(r);
    }
    for (const [role, list] of groups) {
      const context = await newContext(browser, { token: role ? tokens[role] : null, theme, viewport: viewports.desktop });
      for (const route of list) {
        const page = await context.newPage();
        const entry = { route: route.path, role: role ?? "public", findings: [], error: null };
        try {
          await openRoute(page, { url: route.url, query: route.query, isPublic: role == null });
          await waitForTitle(page, route.titleSelector);
          await settle(page);
          const found = await page.evaluate(sampleContrast, threshold);
          entry.total = found.length;
          entry.findings = found.slice(0, PER_PAGE);
          console.log(`${route.path.padEnd(42)} ${found.length} low-contrast text style(s)`);
        } catch (e) {
          entry.error = String(e.message || e).split("\n")[0];
          console.log(`${route.path.padEnd(42)} ERROR ${entry.error}`);
        }
        pages.push(entry);
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const totalFindings = pages.reduce((n, p) => n + (p.total || 0), 0);
  const jsonFile = writeJson(`contrast-${theme}.json`, {
    generatedAt: new Date().toISOString(),
    baseUrl,
    theme,
    threshold,
    totalFindings,
    pages,
  });

  // Styles that recur across pages are the best fix targets: aggregate by class list + colours.
  const byStyle = new Map();
  for (const p of pages) {
    for (const f of p.findings) {
      const key = `${f.tag}|${f.classes}|${f.fg}|${f.bg}`;
      if (!byStyle.has(key)) byStyle.set(key, { ...f, routes: new Set() });
      byStyle.get(key).routes.add(p.route);
    }
  }
  const recurring = [...byStyle.values()]
    .map((s) => ({ ...s, routes: [...s.routes] }))
    .sort((a, b) => b.routes.length - a.routes.length || a.ratio - b.ratio)
    .slice(0, 40);

  const md = [
    `# ${theme}-mode low contrast`,
    ``,
    `Generated ${new Date().toISOString()} against ${baseUrl}. Threshold: contrast ratio < ${threshold} (WCAG relative luminance; translucent colours composited over their ancestors; elements with background images skipped).`,
    ``,
    `**${totalFindings} low-contrast text style(s) across ${pages.filter((p) => p.findings.length).length} of ${pages.length} pages.**`,
    ``,
    `## Recurring styles (fix once, fixes many pages)`,
    ``,
    recurring.length
      ? mdTable(
          ["Pages", "Tag", "Classes", "Text", "fg", "bg", "Ratio"],
          recurring.map((s) => [s.routes.length, s.tag, s.classes.slice(0, 120), s.text.slice(0, 30), s.fg, s.bg, s.ratio]),
        )
      : "_none_",
    ``,
    `## Per page`,
    ``,
    ...pages.flatMap((p) => {
      if (p.error) return [`### ${p.route} (${p.role})`, ``, `Error: ${p.error}`, ``];
      if (!p.findings.length) return [];
      return [
        `### ${p.route} (${p.role}) — ${p.total} finding(s)${p.total > PER_PAGE ? `, first ${PER_PAGE}` : ""}`,
        ``,
        mdTable(
          ["Ratio", "fg", "bg", "Selector", "Classes", "Text"],
          p.findings.map((f) => [f.ratio, f.fg, f.bg, f.selector, f.classes.slice(0, 120), f.text.slice(0, 40)]),
        ),
        ``,
      ];
    }),
  ].join("\n");
  const mdFile = writeText(`contrast-${theme}.md`, md);

  console.log(`\n${totalFindings} low-contrast finding(s) on ${pages.filter((p) => p.findings.length).length} page(s)`);
  console.log(`report: ${path.relative(process.cwd(), jsonFile)}, ${path.relative(process.cwd(), mdFile)}`);
  process.exitCode = args.strict && totalFindings ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

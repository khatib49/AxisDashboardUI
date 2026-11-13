// Collects every <Route path="..."> from src/App.tsx at runtime, together with
// the guard that wraps it (own guard, or the guard of the enclosing layout
// route), and applies e2e/route-exceptions.json.
import fs from "node:fs";
import {
  appTsxPath,
  exceptionsPath,
  guardRoles,
  demoParams,
  defaultDemoParam,
} from "./config.mjs";

const GUARD_RE = /element=\{<(\w+Route)\b/;

/** Strip JSX comments so commented-out routes are not collected. */
function stripComments(src) {
  return src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Returns [{ path, guard, roles, line, inherited }]. `guard` is the component
 * name ("AdminRoute", "ProtectedRoute", ...) or "public".
 */
export function parseRoutes(file = appTsxPath) {
  const raw = fs.readFileSync(file, "utf8");
  const src = stripComments(raw);
  const tokens = [...src.matchAll(/<Route\b|<\/Route>|<\/Routes>/g)];
  const stack = []; // guards of enclosing layout routes
  const routes = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok[0] === "</Route>") {
      stack.pop();
      continue;
    }
    if (tok[0] === "</Routes>") continue;
    const end = i + 1 < tokens.length ? tokens[i + 1].index : src.length;
    const chunk = src.slice(tok.index, end);
    const pathMatch = chunk.match(/\bpath="([^"]+)"/);
    const guardMatch = chunk.match(GUARD_RE);
    const ownGuard = guardMatch ? guardMatch[1] : null;
    const selfClosing = /\/>\s*$/.test(chunk.trimEnd());
    const line = src.slice(0, tok.index).split("\n").length;
    if (pathMatch && pathMatch[1] !== "*") {
      const guard = ownGuard || stack.at(-1) || "public";
      routes.push({
        path: pathMatch[1],
        guard,
        inherited: !ownGuard && stack.length > 0,
        roles: guardRoles[guard] ?? [],
        line,
      });
    }
    if (!selfClosing) stack.push(ownGuard || stack.at(-1) || null);
  }
  // de-duplicate (a path registered twice keeps its first definition)
  const seen = new Set();
  return routes.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
}

/** Replace ":param" segments with demo values. */
export function resolvePath(routePath) {
  return routePath.replace(/:(\w+)\??/g, (_, name) => demoParams[name] ?? defaultDemoParam);
}

export function loadExceptions(file = exceptionsPath) {
  if (!fs.existsSync(file)) return {};
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  delete json.$schema;
  delete json.$comment;
  return json;
}

/**
 * Applies route-exceptions.json:
 *  { "/path": { "skip": "reason", "roles": ["admin"], "query": "?x=${kioskToken}",
 *               "allowRedirectTo": "/other", "titleSelector": "css" } }
 * `vars` fills ${placeholders} in `query`.
 */
export function applyExceptions(routes, exceptions = loadExceptions(), vars = {}) {
  return routes.map((r) => {
    const ex = exceptions[r.path];
    const url = resolvePath(r.path);
    if (!ex) return { ...r, url, query: "" };
    const query = (ex.query || "").replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    return {
      ...r,
      url,
      query,
      roles: ex.roles ?? r.roles,
      skip: ex.skip,
      allowRedirectTo: ex.allowRedirectTo,
      titleSelector: ex.titleSelector,
    };
  });
}

/** File-system safe name for a route ("/" -> "home"). */
export function routeFileName(routePath) {
  const clean = resolvePath(routePath).replace(/^\/+/, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return clean || "home";
}

// JSON + Markdown report writers.
import fs from "node:fs";
import path from "node:path";
import { reportDir } from "./config.mjs";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(name, data) {
  ensureDir(reportDir);
  const file = path.join(reportDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function writeText(name, text) {
  ensureDir(reportDir);
  const file = path.join(reportDir, name);
  fs.writeFileSync(file, text);
  return file;
}

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

export function mdTable(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`),
  ];
  return lines.join("\n");
}

export function fmtMs(ms) {
  return ms == null ? "-" : `${(ms / 1000).toFixed(1)}s`;
}

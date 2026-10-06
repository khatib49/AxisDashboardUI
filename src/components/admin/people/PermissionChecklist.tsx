// PermissionChecklist — the page-grant editor on Roles & Permissions.
// One card per page group (catalogue order), a "select all" checkbox per group
// (indeterminate when only some are ticked) and one checkbox per page.
// Controlled: the caller owns the Set of page keys.

import { Checkbox } from "antd";
import type { PageInfo } from "../../../services/roleService";

const toggle = (set: Set<string>, key: string, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
};

export default function PermissionChecklist({ groups, value, onChange, disabled }: {
  groups: [string, PageInfo[]][];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {groups.map(([group, pages]) => {
        const all = pages.every((p) => value.has(p.key));
        const some = !all && pages.some((p) => value.has(p.key));
        const ticked = pages.filter((p) => value.has(p.key)).length;
        return (
          <fieldset
            key={group}
            className={`min-w-0 overflow-hidden rounded-xl border transition ${
              ticked > 0
                ? "border-violet-200 bg-violet-50/30 dark:border-violet-500/25 dark:bg-violet-500/[0.04]"
                : "border-gray-200/80 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]"
            }`}
          >
            <label className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-3.5 py-2.5 dark:border-white/[0.06]">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{group}</span>
                <span className="block text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  {ticked} of {pages.length} page{pages.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="hidden text-[11px] text-gray-500 sm:inline dark:text-gray-400">All</span>
                <Checkbox
                  checked={all}
                  indeterminate={some}
                  disabled={disabled}
                  aria-label={`Select all pages in ${group}`}
                  onChange={(e) => {
                    let next = new Set(value);
                    for (const p of pages) next = toggle(next, p.key, e.target.checked);
                    onChange(next);
                  }}
                />
              </span>
            </label>
            <div className="space-y-0.5 p-1.5">
              {pages.map((p) => (
                <label
                  key={p.key}
                  className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <Checkbox checked={value.has(p.key)} disabled={disabled} onChange={(e) => onChange(toggle(value, p.key, e.target.checked))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-800 dark:text-gray-200">{p.label}</span>
                    <span className="block truncate font-mono text-[11px] text-gray-400 dark:text-gray-500">{p.path}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

// VenueKit — small presentation helpers shared by the venue admin pages
// (Discounts, Channels, Rooms, Printers). Pure UI: the pages own all state,
// API calls and handlers; these only render what they're given.

import type { ReactNode } from "react";
import { Button, Dropdown, Select } from "antd";
import type { MenuProps } from "antd";
import { LeftOutlined, MoreOutlined, RightOutlined } from "@ant-design/icons";
import Alert from "../../ui/alert/Alert";

/** ⋮ row-actions menu. `label` names the row for screen readers. */
export function RowMenu({ label, items }: { label: string; items: NonNullable<MenuProps["items"]> }) {
  return (
    <Dropdown trigger={["click"]} menu={{ items }} placement="bottomRight">
      <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Actions for ${label}`} />
    </Dropdown>
  );
}

/** Inline error block used inside a Panel. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{children}</div>
  );
}

/** Square tinted icon used as a StatTile accent / row avatar. */
export function IconChip({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "blue" | "emerald" | "amber" | "gray" | "red" }) {
  const cls = {
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    gray: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  }[tone];
  return <span className={`inline-flex rounded-lg p-1.5 ${cls}`}>{children}</span>;
}

export type Notice = {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
} | null;

/** Bottom-right toast (the shared Alert), full-width on phones. */
export function Toast({ notification }: { notification: Notice }) {
  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 sm:left-auto sm:right-6">
      {notification && (
        <div className="ml-auto max-w-sm">
          <Alert variant={notification.variant} title={notification.title} message={notification.message} />
        </div>
      )}
    </div>
  );
}

/**
 * Footer row of a server-paged list: "Showing X of Y", optional page size,
 * page number and Prev / Next. The page owns the paging state and decides
 * when Prev / Next are disabled.
 */
export function VenuePager({
  shown,
  total,
  page,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  shown: number;
  total: number | null;
  page?: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">
      <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {total !== null ? `Showing ${shown} of ${total}` : ""}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizeOptions && onPageSizeChange && (
          <>
            <span className="text-xs text-gray-500 dark:text-gray-400">Page size</span>
            <Select
              size="small"
              value={pageSize}
              onChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizeOptions.map((n) => ({ value: n, label: String(n) }))}
              style={{ width: 72 }}
              aria-label="Page size"
            />
          </>
        )}
        {page !== undefined && <span className="px-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">Page {page}</span>}
        <Button size="small" icon={<LeftOutlined />} onClick={onPrev} disabled={prevDisabled}>Prev</Button>
        <Button size="small" onClick={onNext} disabled={nextDisabled}>
          Next <RightOutlined />
        </Button>
      </div>
    </div>
  );
}

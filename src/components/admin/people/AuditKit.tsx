// AuditKit — presentation pieces shared by the two Audit Logs tabs
// (Transactions, Admin Activity): the action pill and the Prev / Next pager.
// Pure presentation: the tabs own their paging state.

import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Pill } from "../../ui/PageKit";

type Tone = "gray" | "violet" | "purple" | "blue" | "emerald" | "amber" | "red";

// Admin activity uses Created / Updated / Deleted; the transaction log has its
// own verbs (CloseInvoice, AddItems, …) — same palette as the old badge.
const ACTION_TONE: Record<string, Tone> = {
  Created: "emerald",
  Updated: "blue",
  Deleted: "red",
  CloseGameSession: "blue",
  CloseInvoice: "blue",
  AddItems: "amber",
  UpdateSet: "purple",
  AdminUpdate: "red",
};

/** Action label as a pill with a dot (never colour alone). */
export function ActionPill({ action }: { action: string }) {
  return <Pill tone={ACTION_TONE[action] ?? "gray"} dot>{action}</Pill>;
}

/** Footer row: "Showing X of Y", Page N of M, Prev / Next. */
export function AuditPager({ summary, page, totalPages, onPrev, onNext, prevDisabled, nextDisabled }: {
  summary: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">
      <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{summary}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" icon={<LeftOutlined />} onClick={onPrev} disabled={prevDisabled}>Previous</Button>
        <span className="px-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
        <Button size="small" onClick={onNext} disabled={nextDisabled}>
          Next <RightOutlined />
        </Button>
      </div>
    </div>
  );
}

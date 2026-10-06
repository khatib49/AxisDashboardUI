// PagerFooter — the footer row of a server-paged inventory list
// (Items, Categories): "Showing X of Y", page size and Prev / Next.
// Pure presentation: the page owns the paging state and decides when
// Prev / Next are disabled.

import { Button, Select } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export default function PagerFooter({
  shown,
  total,
  page,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  shown: number;
  total: number | null;
  page: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/[0.06]">
      <div className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
        {total !== null ? `Showing ${shown} of ${total}` : ""}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Rows</span>
        <Select
          size="small"
          value={pageSize}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
          style={{ width: 72 }}
          aria-label="Page size"
        />
        <span className="px-1 text-xs text-gray-500 tabular-nums dark:text-gray-400">Page {page}</span>
        <Button size="small" icon={<LeftOutlined />} onClick={onPrev} disabled={prevDisabled}>Prev</Button>
        <Button size="small" onClick={onNext} disabled={nextDisabled}>
          Next <RightOutlined />
        </Button>
      </div>
    </div>
  );
}

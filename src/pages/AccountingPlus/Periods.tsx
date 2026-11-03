import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { periods, errorMessage, fmtDate, MONTHS, AccountingPeriodDto } from "../../services/accountingPlusService";
import { Notice, NoticeBar, StateBlock, btnSmall } from "./shared";

export default function Periods() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<AccountingPeriodDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setRows(await periods.list(year)); }
    catch (e) { setError(errorMessage(e, "Failed to load periods")); }
    finally { setLoading(false); }
  }, [year]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(p: AccountingPeriodDto) {
    setBusy(p.month);
    try {
      if (p.isLocked) {
        if (!window.confirm(`Unlock ${MONTHS[p.month - 1]} ${p.year}? New postings will be allowed again.`)) return;
        await periods.unlock(p.year, p.month);
        setNotice({ variant: "success", title: "Unlocked", message: `${MONTHS[p.month - 1]} ${p.year} is open` });
      } else {
        const note = window.prompt(`Lock ${MONTHS[p.month - 1]} ${p.year}. Optional note:`, "Month closed");
        if (note === null) return;
        await periods.lock(p.year, p.month, note || undefined);
        setNotice({ variant: "success", title: "Locked", message: `${MONTHS[p.month - 1]} ${p.year} is locked` });
      }
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally { setBusy(null); }
  }

  const now = new Date();
  const lockedCount = rows.filter((r) => r.isLocked).length;

  return (
    <>
      <PageMeta title="Accounting Periods | Axis" description="Lock closed months against new postings" />
      <PageBreadcrumb pageTitle="Accounting Periods" />
      <NoticeBar notice={notice} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-40"><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} /></div>
        <div className="flex gap-2 pb-1">
          <button className={btnSmall} onClick={() => setYear(year - 1)}>Prev</button>
          <button className={btnSmall} onClick={() => setYear(year + 1)}>Next</button>
        </div>
        <div className="pb-2 text-sm text-gray-500 dark:text-gray-400">{lockedCount} of 12 months locked. Locked months reject supplier bills, payments, depreciation runs and bank reconciliations dated inside them.</div>
      </div>

      <StateBlock loading={loading} error={error} empty={rows.length === 0} emptyText="No periods.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {rows.map((p) => {
            const isCurrent = p.year === now.getFullYear() && p.month === now.getMonth() + 1;
            const isFuture = p.year > now.getFullYear() || (p.year === now.getFullYear() && p.month > now.getMonth() + 1);
            return (
              <div key={p.month} className={`rounded-2xl border p-4 ${p.isLocked ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold text-gray-800 dark:text-white/90">{MONTHS[p.month - 1]} {p.year}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isLocked ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>{p.isLocked ? "Locked" : "Open"}</span>
                </div>
                <div className="mt-1 min-h-10 text-xs text-gray-500 dark:text-gray-400">
                  {p.isLocked ? <>Locked {fmtDate(p.lockedOn)}{p.lockedBy ? ` by ${p.lockedBy}` : ""}{p.note ? <div className="italic">{p.note}</div> : null}</> : isCurrent ? "Current month" : isFuture ? "Future" : "Open for postings"}
                </div>
                <button className={`${btnSmall} mt-2 w-full`} disabled={busy === p.month} onClick={() => toggle(p)}>{p.isLocked ? "Unlock" : "Lock"}</button>
              </div>
            );
          })}
        </div>
      </StateBlock>
    </>
  );
}

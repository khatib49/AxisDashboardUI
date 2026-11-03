import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  assets,
  getPostableAccounts,
  errorMessage,
  money,
  fmtDate,
  MONTHS,
  FixedAssetDto,
  FixedAssetUpsertDto,
  DepreciationScheduleRowDto,
  AssetRegisterSummaryDto,
  PostableAccount,
} from "../../services/accountingPlusService";
import { AccountSelect, Card, Notice, NoticeBar, StateBlock, StatusPill, btnDanger, btnPrimary, btnSecondary, btnSmall, selectClass, toInputDate } from "./shared";

const th = (h: string) => <TableCell key={h} isHeader className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>;
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

type Form = {
  id?: number; name: string; category: string; acquiredOn: string; cost: number; salvageValue: number; usefulLifeMonths: number; method: string;
  assetGlAccountId: number | ""; accumulatedDepGlAccountId: number | ""; depExpenseGlAccountId: number | ""; notes: string;
};

export default function FixedAssets() {
  const now = new Date();
  const [summary, setSummary] = useState<AssetRegisterSummaryDto | null>(null);
  const [accounts, setAccounts] = useState<PostableAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Active");

  const [runYear, setRunYear] = useState(now.getFullYear());
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1);

  const blank: Form = { name: "", category: "", acquiredOn: toInputDate(now), cost: 0, salvageValue: 0, usefulLifeMonths: 36, method: "StraightLine", assetGlAccountId: "", accumulatedDepGlAccountId: "", depExpenseGlAccountId: "", notes: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const [scheduleAsset, setScheduleAsset] = useState<FixedAssetDto | null>(null);
  const [schedule, setSchedule] = useState<DepreciationScheduleRowDto[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [disposeAsset, setDisposeAsset] = useState<FixedAssetDto | null>(null);
  const [disposeForm, setDisposeForm] = useState({ disposedOn: toInputDate(now), proceeds: 0, cashGlAccountId: "" as number | "", gainLossGlAccountId: "" as number | "", notes: "" });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    getPostableAccounts().then((a) => {
      setAccounts(a);
      const byNo = (n: string) => a.find((x) => x.accountNumber === n)?.id ?? "";
      setForm((f) => ({ ...f, assetGlAccountId: byNo("1500"), accumulatedDepGlAccountId: byNo("1600"), depExpenseGlAccountId: byNo("5700") }));
      setDisposeForm((d) => ({ ...d, cashGlAccountId: byNo("1000") }));
    }).catch(() => setAccounts([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setSummary(await assets.summary()); }
    catch (e) { setError(errorMessage(e, "Failed to load assets")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = (summary?.assets ?? []).filter((a) => !statusFilter || a.status === statusFilter);

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); setNotice({ variant: "success", title: "Done", message: okMsg }); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function saveAsset() {
    if (!form.name.trim() || form.cost <= 0 || form.assetGlAccountId === "" || form.accumulatedDepGlAccountId === "" || form.depExpenseGlAccountId === "") {
      setNotice({ variant: "error", title: "Validation", message: "Name, positive cost and the three GL accounts are required" });
      return;
    }
    const dto: FixedAssetUpsertDto = {
      name: form.name.trim(), category: form.category || null, acquiredOn: form.acquiredOn, cost: form.cost, salvageValue: form.salvageValue,
      usefulLifeMonths: form.usefulLifeMonths, method: form.method, assetGlAccountId: form.assetGlAccountId,
      accumulatedDepGlAccountId: form.accumulatedDepGlAccountId, depExpenseGlAccountId: form.depExpenseGlAccountId, notes: form.notes || null,
    };
    await act(async () => { if (form.id) await assets.update(form.id, dto); else await assets.create(dto); setFormOpen(false); }, "Asset saved");
  }

  function openEdit(a: FixedAssetDto) {
    setForm({ id: a.id, name: a.name, category: a.category ?? "", acquiredOn: a.acquiredOn.slice(0, 10), cost: a.cost, salvageValue: a.salvageValue, usefulLifeMonths: a.usefulLifeMonths, method: a.method, assetGlAccountId: a.assetGlAccountId, accumulatedDepGlAccountId: a.accumulatedDepGlAccountId, depExpenseGlAccountId: a.depExpenseGlAccountId, notes: a.notes ?? "" });
    setFormOpen(true);
  }

  async function openSchedule(a: FixedAssetDto) {
    setScheduleAsset(a);
    setScheduleLoading(true);
    try { setSchedule(await assets.schedule(a.id)); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); setSchedule([]); }
    finally { setScheduleLoading(false); }
  }

  async function runDepreciation(assetId?: number) {
    await act(async () => {
      const r = await assets.runDepreciation(runYear, runMonth, assetId);
      setNotice({ variant: r.posted > 0 ? "success" : "info", title: `Depreciation ${MONTHS[runMonth - 1]} ${runYear}`, message: `${r.posted} posted, ${r.skipped} skipped, total ${money(r.totalAmount)}${r.messages.length ? ` - ${r.messages.slice(0, 3).join("; ")}` : ""}` });
    }, "Depreciation run complete");
  }

  async function submitDispose() {
    if (!disposeAsset || disposeForm.gainLossGlAccountId === "" || (disposeForm.proceeds > 0 && disposeForm.cashGlAccountId === "")) {
      setNotice({ variant: "error", title: "Validation", message: "Gain/loss account is required (and a cash account when there are proceeds)" });
      return;
    }
    const id = disposeAsset.id;
    await act(async () => {
      await assets.dispose(id, { disposedOn: disposeForm.disposedOn, proceeds: disposeForm.proceeds, cashGlAccountId: disposeForm.cashGlAccountId === "" ? 0 : disposeForm.cashGlAccountId, gainLossGlAccountId: disposeForm.gainLossGlAccountId as number, notes: disposeForm.notes || null });
      setDisposeAsset(null);
    }, "Asset disposed");
  }

  return (
    <>
      <PageMeta title="Fixed Assets | Axis" description="Fixed asset register and depreciation" />
      <PageBreadcrumb pageTitle="Fixed Assets" />
      <NoticeBar notice={notice} />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Active assets" value={`${summary?.activeAssets ?? 0}`} sub={`${summary?.disposedAssets ?? 0} disposed`} />
        <Card title="Total cost" value={money(summary?.totalCost)} />
        <Card title="Accumulated depreciation" value={money(summary?.totalAccumulatedDepreciation)} />
        <Card title="Net book value" value={money(summary?.totalNetBookValue)} tone="ok" />
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div><Label>Status</Label>
            <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option><option value="Active">Active</option><option value="Disposed">Disposed</option>
            </select>
          </div>
          <div><Label>Month</Label>
            <select className={selectClass} value={runMonth} onChange={(e) => setRunMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><Label>Year</Label><Input type="number" value={runYear} onChange={(e) => setRunYear(Number(e.target.value))} /></div>
          <button className={btnSecondary} disabled={busy} onClick={() => runDepreciation()}>Run depreciation for month</button>
        </div>
        <button className={btnPrimary} onClick={() => { setForm({ ...blank, assetGlAccountId: form.assetGlAccountId, accumulatedDepGlAccountId: form.accumulatedDepGlAccountId, depExpenseGlAccountId: form.depExpenseGlAccountId }); setFormOpen(true); }}>+ New asset</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <StateBlock loading={loading} error={error} empty={visible.length === 0} emptyText="No fixed assets registered.">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Asset", "Category", "Acquired", "Method", "Cost", "Accum. dep.", "NBV", "Status", ""].map(th)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {visible.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className={`${td} font-medium`}>{a.name}</TableCell>
                    <TableCell className={td}>{a.category}</TableCell>
                    <TableCell className={td}>{fmtDate(a.acquiredOn)}</TableCell>
                    <TableCell className={td}>{a.method === "StraightLine" ? "Straight line" : "Declining"} / {a.usefulLifeMonths}m</TableCell>
                    <TableCell className={td}>{money(a.cost)}</TableCell>
                    <TableCell className={td}>{money(a.accumulatedDepreciation)}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{money(a.netBookValue)}</TableCell>
                    <TableCell className="px-4 py-3"><StatusPill status={a.status} />{a.disposedOn ? <div className="text-xs text-gray-400">{fmtDate(a.disposedOn)}</div> : null}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className={btnSmall} onClick={() => openSchedule(a)}>Schedule</button>
                        {a.status === "Active" && <button className={btnSmall} disabled={busy} onClick={() => openEdit(a)}>Edit</button>}
                        {a.status === "Active" && <button className={btnSmall} disabled={busy} onClick={() => runDepreciation(a.id)}>Depreciate</button>}
                        {a.status === "Active" && <button className={btnDanger} disabled={busy} onClick={() => { setDisposeAsset(a); setDisposeForm({ ...disposeForm, proceeds: 0, notes: "" }); }}>Dispose</button>}
                        {a.status === "Active" && a.depreciationEntriesCount === 0 && <button className={btnDanger} disabled={busy} onClick={() => window.confirm("Delete this asset?") && act(() => assets.delete(a.id), "Asset deleted")}>Delete</button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </div>

      {/* asset form */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={form.id ? "Edit asset" : "New asset"} className="max-w-2xl">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Gaming, Furniture, IT..." /></div>
          <div><Label>Acquired on</Label><Input type="date" value={form.acquiredOn} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value })} /></div>
          <div><Label>Method</Label>
            <select className={selectClass} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="StraightLine">Straight line</option><option value="DecliningBalance">Declining balance (double)</option>
            </select>
          </div>
          <div><Label>Cost</Label><Input type="number" step={0.01} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
          <div><Label>Salvage value</Label><Input type="number" step={0.01} value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: Number(e.target.value) })} /></div>
          <div><Label>Useful life (months)</Label><Input type="number" value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: Number(e.target.value) })} /></div>
          <div><Label>Asset account</Label><AccountSelect value={form.assetGlAccountId} onChange={(id) => setForm({ ...form, assetGlAccountId: id })} accounts={accounts} filterType={["Asset"]} /></div>
          <div><Label>Accumulated depreciation account</Label><AccountSelect value={form.accumulatedDepGlAccountId} onChange={(id) => setForm({ ...form, accumulatedDepGlAccountId: id })} accounts={accounts} filterType={["Asset"]} /></div>
          <div><Label>Depreciation expense account</Label><AccountSelect value={form.depExpenseGlAccountId} onChange={(id) => setForm({ ...form, depExpenseGlAccountId: id })} accounts={accounts} filterType={["Expense"]} /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnSecondary} onClick={() => setFormOpen(false)}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={saveAsset}>Save</button>
        </div>
      </Modal>

      {/* schedule */}
      <Modal isOpen={scheduleAsset !== null} onClose={() => setScheduleAsset(null)} title={scheduleAsset ? `Schedule - ${scheduleAsset.name}` : "Schedule"} className="max-w-2xl">
        <StateBlock loading={scheduleLoading} error={null} empty={schedule.length === 0} emptyText="Nothing to depreciate.">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader><TableRow>{["Period", "Amount", "Accumulated", "NBV", "Posted"].map(th)}</TableRow></TableHeader>
              <TableBody>
                {schedule.map((r) => (
                  <TableRow key={`${r.year}-${r.month}`} className={r.posted ? "bg-green-50 dark:bg-green-900/10" : ""}>
                    <TableCell className={td}>{MONTHS[r.month - 1]} {r.year}</TableCell>
                    <TableCell className={td}>{money(r.amount)}</TableCell>
                    <TableCell className={td}>{money(r.accumulatedAfter)}</TableCell>
                    <TableCell className={td}>{money(r.netBookValueAfter)}</TableCell>
                    <TableCell className={td}>{r.posted ? "Yes" : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </Modal>

      {/* dispose */}
      <Modal isOpen={disposeAsset !== null} onClose={() => setDisposeAsset(null)} title={disposeAsset ? `Dispose - ${disposeAsset.name}` : "Dispose"} className="max-w-lg">
        {disposeAsset && (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">Cost {money(disposeAsset.cost)} - accumulated {money(disposeAsset.accumulatedDepreciation)} = NBV <strong>{money(disposeAsset.netBookValue)}</strong>. Gain/loss = proceeds - NBV = <strong>{money(disposeForm.proceeds - disposeAsset.netBookValue)}</strong></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Disposed on</Label><Input type="date" value={disposeForm.disposedOn} onChange={(e) => setDisposeForm({ ...disposeForm, disposedOn: e.target.value })} /></div>
              <div><Label>Proceeds</Label><Input type="number" step={0.01} value={disposeForm.proceeds} onChange={(e) => setDisposeForm({ ...disposeForm, proceeds: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Proceeds received into</Label><AccountSelect value={disposeForm.cashGlAccountId} onChange={(id) => setDisposeForm({ ...disposeForm, cashGlAccountId: id })} accounts={accounts} filterType={["Asset"]} /></div>
            <div><Label>Gain / loss account</Label><AccountSelect value={disposeForm.gainLossGlAccountId} onChange={(id) => setDisposeForm({ ...disposeForm, gainLossGlAccountId: id })} accounts={accounts} filterType={["Revenue", "Expense"]} /></div>
            <div><Label>Notes</Label><Input value={disposeForm.notes} onChange={(e) => setDisposeForm({ ...disposeForm, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btnSecondary} onClick={() => setDisposeAsset(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy} onClick={submitDispose}>Dispose</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

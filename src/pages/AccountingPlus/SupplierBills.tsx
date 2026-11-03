import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  bills,
  getPostableAccounts,
  getSuppliers,
  errorMessage,
  money,
  fmtDate,
  SupplierBillDto,
  SupplierBillCreateDto,
  ApAgingReportDto,
  DueSoonBillDto,
  PostableAccount,
  SupplierLite,
} from "../../services/accountingPlusService";
import { AccountSelect, Card, Notice, NoticeBar, StateBlock, StatusPill, btnDanger, btnPrimary, btnSecondary, btnSmall, selectClass, toInputDate } from "./shared";

type Tab = "bills" | "aging" | "due";

export default function SupplierBills() {
  const [tab, setTab] = useState<Tab>("bills");
  const [rows, setRows] = useState<SupplierBillDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [accounts, setAccounts] = useState<PostableAccount[]>([]);

  const [aging, setAging] = useState<ApAgingReportDto | null>(null);
  const [asOf, setAsOf] = useState(toInputDate(new Date()));
  const [dueSoon, setDueSoon] = useState<DueSoonBillDto[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const emptyForm = {
    supplierId: "" as number | "", billNumber: "", billDate: toInputDate(new Date()), dueDate: toInputDate(new Date(Date.now() + 30 * 86400000)),
    subtotal: 0, taxAmount: 0, expenseGlAccountId: "" as number | "", payableGlAccountId: "" as number | "", notes: "", status: "Open" as "Open" | "Draft",
  };
  const [form, setForm] = useState(emptyForm);

  const [payBill, setPayBill] = useState<SupplierBillDto | null>(null);
  const [payForm, setPayForm] = useState({ paidOn: toInputDate(new Date()), amount: 0, method: "Cash", reference: "", cashGlAccountId: "" as number | "" });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    getPostableAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "bills") {
        const r = await bills.list({ status: status || undefined, search: search || undefined, page, pageSize });
        setRows(r.data ?? []);
        setTotal(r.totalCount ?? 0);
      } else if (tab === "aging") {
        setAging(await bills.aging(asOf));
      } else {
        setDueSoon(await bills.dueSoon(14));
      }
    } catch (e) {
      setError(errorMessage(e, "Failed to load"));
    } finally {
      setLoading(false);
    }
  }, [tab, status, search, page, asOf]);

  useEffect(() => { void load(); }, [load]);

  async function submitCreate() {
    if (form.supplierId === "" || !form.billNumber.trim() || form.expenseGlAccountId === "" || form.subtotal + form.taxAmount <= 0) {
      setNotice({ variant: "error", title: "Validation", message: "Supplier, bill number, expense account and a positive total are required" });
      return;
    }
    setBusy(true);
    try {
      const dto: SupplierBillCreateDto = {
        supplierId: form.supplierId, billNumber: form.billNumber.trim(), billDate: form.billDate, dueDate: form.dueDate,
        subtotal: form.subtotal, taxAmount: form.taxAmount, expenseGlAccountId: form.expenseGlAccountId,
        payableGlAccountId: form.payableGlAccountId === "" ? null : form.payableGlAccountId, notes: form.notes || null, status: form.status,
      };
      await bills.create(dto);
      setCreateOpen(false);
      setForm(emptyForm);
      setNotice({ variant: "success", title: "Saved", message: form.status === "Open" ? "Bill created and posted" : "Draft saved" });
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally { setBusy(false); }
  }

  async function submitPayment() {
    if (!payBill || payForm.amount <= 0 || payForm.cashGlAccountId === "") {
      setNotice({ variant: "error", title: "Validation", message: "Amount and cash/bank account are required" });
      return;
    }
    setBusy(true);
    try {
      const updated = await bills.addPayment(payBill.id, { paidOn: payForm.paidOn, amount: payForm.amount, method: payForm.method || null, reference: payForm.reference || null, cashGlAccountId: payForm.cashGlAccountId });
      setPayBill(updated);
      setPayForm({ ...payForm, amount: updated.outstanding, reference: "" });
      setNotice({ variant: "success", title: "Payment recorded", message: `Status: ${updated.status}` });
      await load();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally { setBusy(false); }
  }

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); setNotice({ variant: "success", title: "Done", message: okMsg }); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? "bg-brand-500 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"}`}>{label}</button>
  );
  const th = (h: string) => <TableCell key={h} isHeader className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>;
  const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

  return (
    <>
      <PageMeta title="Supplier Bills | Axis" description="Accounts payable: supplier bills, payments and aging" />
      <PageBreadcrumb pageTitle="Supplier Bills" />
      <NoticeBar notice={notice} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">{tabBtn("bills", "Bills")}{tabBtn("aging", "AP Aging")}{tabBtn("due", "Due soon")}</div>
        <button className={btnPrimary} onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>+ New bill</button>
      </div>

      {tab === "bills" && (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Search bill #, supplier, notes" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
            <select className={selectClass} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">All statuses</option>
              <option value="Unpaid">Unpaid (Open + Partially paid)</option>
              {["Draft", "Open", "PartiallyPaid", "Paid", "Void"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <StateBlock loading={loading} error={error} empty={rows.length === 0} emptyText="No supplier bills yet.">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Bill #", "Supplier", "Bill date", "Due", "Total", "Paid", "Outstanding", "Status", ""].map(th)}</TableRow></TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {rows.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className={td}>{b.billNumber}</TableCell>
                        <TableCell className={td}>{b.supplierName ?? b.supplierId}</TableCell>
                        <TableCell className={td}>{fmtDate(b.billDate)}</TableCell>
                        <TableCell className={td}>{fmtDate(b.dueDate)}</TableCell>
                        <TableCell className={td}>{money(b.total)}</TableCell>
                        <TableCell className={td}>{money(b.paidAmount)}</TableCell>
                        <TableCell className={`${td} font-medium`}>{money(b.outstanding)}</TableCell>
                        <TableCell className="px-4 py-3"><StatusPill status={b.status} /></TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex gap-2">
                            {(b.status === "Open" || b.status === "PartiallyPaid") && <button className={btnSmall} disabled={busy} onClick={() => { setPayBill(b); setPayForm({ ...payForm, amount: b.outstanding, cashGlAccountId: payForm.cashGlAccountId === "" ? (accounts.find((a) => a.accountNumber === "1000")?.id ?? "") : payForm.cashGlAccountId }); }}>Pay</button>}
                            {b.status === "Draft" && <button className={btnSmall} disabled={busy} onClick={() => act(() => bills.open(b.id), "Bill posted")}>Post</button>}
                            {b.status === "Draft" && <button className={btnDanger} disabled={busy} onClick={() => window.confirm("Delete draft?") && act(() => bills.deleteDraft(b.id), "Draft deleted")}>Delete</button>}
                            {b.status !== "Void" && b.status !== "Draft" && <button className={btnDanger} disabled={busy} onClick={() => { const reason = window.prompt("Void reason?"); if (reason !== null) void act(() => bills.void(b.id, reason), "Bill voided"); }}>Void</button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </StateBlock>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{total} bill(s)</span>
            <div className="flex gap-2">
              <button className={btnSmall} disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span className="px-2 py-1">Page {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
              <button className={btnSmall} disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </>
      )}

      {tab === "aging" && (
        <>
          <div className="mb-3 flex items-end gap-3">
            <div><Label>As of</Label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
          </div>
          {aging && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <Card title="Current" value={money(aging.totals.current)} />
              <Card title="1-30" value={money(aging.totals.days1To30)} />
              <Card title="31-60" value={money(aging.totals.days31To60)} />
              <Card title="61-90" value={money(aging.totals.days61To90)} />
              <Card title="90+" value={money(aging.totals.over90)} tone={aging.totals.over90 > 0 ? "bad" : "neutral"} />
              <Card title="Total payable" value={money(aging.totals.total)} />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <StateBlock loading={loading} error={error} empty={!aging || aging.rows.length === 0} emptyText="No open supplier bills.">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Supplier", "Open bills", "Current", "1-30", "31-60", "61-90", "90+", "Total"].map(th)}</TableRow></TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {aging?.rows.map((r) => (
                    <TableRow key={r.supplierId}>
                      <TableCell className={td}>{r.supplierName}</TableCell>
                      <TableCell className={td}>{r.openBills}</TableCell>
                      <TableCell className={td}>{money(r.buckets.current)}</TableCell>
                      <TableCell className={td}>{money(r.buckets.days1To30)}</TableCell>
                      <TableCell className={td}>{money(r.buckets.days31To60)}</TableCell>
                      <TableCell className={td}>{money(r.buckets.days61To90)}</TableCell>
                      <TableCell className={td}>{money(r.buckets.over90)}</TableCell>
                      <TableCell className={`${td} font-semibold`}>{money(r.buckets.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </StateBlock>
          </div>
        </>
      )}

      {tab === "due" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <StateBlock loading={loading} error={error} empty={dueSoon.length === 0} emptyText="Nothing due in the next 14 days.">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Bill #", "Supplier", "Due", "Days", "Outstanding", "Status"].map(th)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {dueSoon.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className={td}>{d.billNumber}</TableCell>
                    <TableCell className={td}>{d.supplierName}</TableCell>
                    <TableCell className={td}>{fmtDate(d.dueDate)}</TableCell>
                    <TableCell className={`${td} ${d.daysUntilDue < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{d.daysUntilDue < 0 ? `${-d.daysUntilDue} overdue` : d.daysUntilDue}</TableCell>
                    <TableCell className={td}>{money(d.outstanding)}</TableCell>
                    <TableCell className="px-4 py-3"><StatusPill status={d.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StateBlock>
        </div>
      )}

      {/* create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New supplier bill" className="max-w-2xl">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div><Label>Supplier</Label>
            <select className={selectClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value === "" ? "" : Number(e.target.value) })}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><Label>Bill number</Label><Input value={form.billNumber} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} /></div>
          <div><Label>Bill date</Label><Input type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })} /></div>
          <div><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          <div><Label>Subtotal</Label><Input type="number" step={0.01} value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })} /></div>
          <div><Label>Tax</Label><Input type="number" step={0.01} value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: Number(e.target.value) })} /></div>
          <div><Label>Expense account</Label><AccountSelect value={form.expenseGlAccountId} onChange={(id) => setForm({ ...form, expenseGlAccountId: id })} accounts={accounts} /></div>
          <div><Label>Payable account (default 2000)</Label><AccountSelect value={form.payableGlAccountId} onChange={(id) => setForm({ ...form, payableGlAccountId: id })} accounts={accounts} filterType={["Liability"]} placeholder="Default: Accounts Payable" /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div><Label>Create as</Label>
            <select className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "Open" | "Draft" })}>
              <option value="Open">Open (post to ledger now)</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
          <div className="flex items-end justify-end text-sm text-gray-600 dark:text-gray-300">Total: <strong className="ml-1">{money(form.subtotal + form.taxAmount)}</strong></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnSecondary} onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className={btnPrimary} disabled={busy} onClick={submitCreate}>Save</button>
        </div>
      </Modal>

      {/* payments modal */}
      <Modal isOpen={payBill !== null} onClose={() => setPayBill(null)} title={payBill ? `Payments - ${payBill.billNumber}` : "Payments"} className="max-w-2xl">
        {payBill && (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Card title="Total" value={money(payBill.total)} />
              <Card title="Paid" value={money(payBill.paidAmount)} />
              <Card title="Outstanding" value={money(payBill.outstanding)} tone={payBill.outstanding === 0 ? "ok" : "neutral"} />
            </div>
            {payBill.payments.length > 0 && (
              <div className="mb-3 max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <Table>
                  <TableHeader><TableRow>{["Date", "Amount", "Method", "Ref", "JE"].map(th)}</TableRow></TableHeader>
                  <TableBody>
                    {payBill.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className={td}>{fmtDate(p.paidOn)}</TableCell>
                        <TableCell className={td}>{money(p.amount)}</TableCell>
                        <TableCell className={td}>{p.method}</TableCell>
                        <TableCell className={td}>{p.reference}</TableCell>
                        <TableCell className={td}>{p.journalEntryId ? `#${p.journalEntryId}` : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {(payBill.status === "Open" || payBill.status === "PartiallyPaid") && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div><Label>Paid on</Label><Input type="date" value={payForm.paidOn} onChange={(e) => setPayForm({ ...payForm, paidOn: e.target.value })} /></div>
                <div><Label>Amount</Label><Input type="number" step={0.01} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
                <div><Label>Method</Label>
                  <select className={selectClass} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                    {["Cash", "Bank transfer", "Card", "Cheque", "Other"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div><Label>Reference</Label><Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>Paid from (cash/bank account)</Label><AccountSelect value={payForm.cashGlAccountId} onChange={(id) => setPayForm({ ...payForm, cashGlAccountId: id })} accounts={accounts} filterType={["Asset"]} /></div>
                <div className="flex justify-end md:col-span-2"><button className={btnPrimary} disabled={busy} onClick={submitPayment}>Record payment</button></div>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

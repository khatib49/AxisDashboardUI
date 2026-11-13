import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { CategoryDto, getCategories } from "../../services/categoryService";
import {
  CouponDto,
  CouponRedemptionDto,
  CouponUpsertDto,
  createCoupon,
  deleteCoupon,
  errorMessage,
  getCouponRedemptions,
  listCoupons,
  updateCoupon,
} from "../../services/promotionsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

type Form = {
  code: string; name: string; type: "Percent" | "Fixed"; value: string;
  minOrderAmount: string; maxDiscountAmount: string; maxUses: string; maxUsesPerCustomer: string;
  validFrom: string; validTo: string; categoryIds: number[]; isActive: boolean;
};

const emptyForm: Form = {
  code: "", name: "", type: "Percent", value: "", minOrderAmount: "", maxDiscountAmount: "",
  maxUses: "", maxUsesPerCustomer: "", validFrom: "", validTo: "", categoryIds: [], isActive: true,
};

const toLocalInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export default function Coupons() {
  const [rows, setRows] = useState<CouponDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [redemptionsFor, setRedemptionsFor] = useState<CouponDto | null>(null);
  const [redemptions, setRedemptions] = useState<CouponRedemptionDto[]>([]);
  const [redLoading, setRedLoading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    getCategories(1, 200).then((r) => setCategories(r.data ?? [])).catch(() => setCategories([]));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCoupons(page, pageSize, search || undefined);
      setRows(res.data ?? []);
      setTotal(res.totalCount ?? 0);
    } catch (e) {
      setError(errorMessage(e, "Failed to load coupons"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 250);
    return () => clearTimeout(t);
  }, [reload]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(c: CouponDto) {
    setEditing(c);
    setForm({
      code: c.code, name: c.name, type: c.type === "Fixed" ? "Fixed" : "Percent", value: String(c.value),
      minOrderAmount: c.minOrderAmount?.toString() ?? "", maxDiscountAmount: c.maxDiscountAmount?.toString() ?? "",
      maxUses: c.maxUses?.toString() ?? "", maxUsesPerCustomer: c.maxUsesPerCustomer?.toString() ?? "",
      validFrom: toLocalInput(c.validFrom), validTo: toLocalInput(c.validTo),
      categoryIds: (c.categoryIdsCsv ?? "").split(",").map((s) => Number(s)).filter((n) => n > 0),
      isActive: c.isActive,
    });
    setFormOpen(true);
  }

  async function submit() {
    if (!form.code.trim() || !form.name.trim()) {
      setNotice({ variant: "error", title: "Validation", message: "Code and name are required" });
      return;
    }
    const value = Number(form.value);
    if (!value || value <= 0 || (form.type === "Percent" && value > 100)) {
      setNotice({ variant: "error", title: "Validation", message: form.type === "Percent" ? "Percent must be 1-100" : "Value must be greater than zero" });
      return;
    }
    const dto: CouponUpsertDto = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type,
      value,
      minOrderAmount: numOrNull(form.minOrderAmount),
      maxDiscountAmount: numOrNull(form.maxDiscountAmount),
      maxUses: numOrNull(form.maxUses),
      maxUsesPerCustomer: numOrNull(form.maxUsesPerCustomer),
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
      categoryIdsCsv: form.categoryIds.length ? form.categoryIds.join(",") : null,
      isActive: form.isActive,
    };
    setSubmitting(true);
    try {
      const res = editing ? await updateCoupon(editing.id, dto) : await createCoupon(dto);
      if (!res.success) {
        setNotice({ variant: "error", title: "Save failed", message: res.message });
        return;
      }
      setNotice({ variant: "success", title: "Saved", message: res.message });
      setFormOpen(false);
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(c: CouponDto) {
    if (!window.confirm(`Delete coupon ${c.code}? (A used coupon is deactivated instead.)`)) return;
    try {
      await deleteCoupon(c.id);
      setNotice({ variant: "success", title: "Deleted", message: `${c.code} removed` });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) });
    }
  }

  async function showRedemptions(c: CouponDto) {
    setRedemptionsFor(c);
    setRedLoading(true);
    try {
      setRedemptions(await getCouponRedemptions(c.id));
    } catch {
      setRedemptions([]);
    } finally {
      setRedLoading(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const catName = (csv?: string | null) => {
    if (!csv) return "All";
    const ids = csv.split(",").map(Number);
    return ids.map((id) => categories.find((c) => c.id === id)?.name ?? `#${id}`).join(", ");
  };

  return (
    <>
      <PageMeta title="Coupons | Axis" description="Coupon and voucher codes" />
      <PageBreadcrumb pageTitle="Coupons" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <div className="mb-4 flex items-center gap-3">
          <div className="w-64"><Input placeholder="Search code / name" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} /></div>
          <button className="ml-auto rounded bg-brand-500 px-4 py-2 text-sm text-white" onClick={openCreate}>New coupon</button>
        </div>

        {error && <Alert variant="error" title="Error" message={error} />}
        {loading ? <div className="flex justify-center py-10"><Loader /></div> : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-500 dark:text-gray-400">No coupons yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>{["Code", "Name", "Discount", "Min order", "Uses", "Valid", "Categories", "Active", ""].map((h) => <TableCell key={h} isHeader className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>)}</TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className="px-3 py-3 font-mono text-sm">{c.code}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.name}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.type === "Fixed" ? `${c.value.toFixed(2)} off` : `${c.value}%`}{c.maxDiscountAmount ? ` (max ${c.maxDiscountAmount})` : ""}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.minOrderAmount ?? "—"}</TableCell>
                    <TableCell className="px-3 py-3 text-sm"><button className="text-brand-500 dark:text-brand-400 hover:underline" onClick={() => void showRedemptions(c)}>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</button></TableCell>
                    <TableCell className="px-3 py-3 text-xs">{c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "…"} → {c.validTo ? new Date(c.validTo).toLocaleDateString() : "…"}</TableCell>
                    <TableCell className="px-3 py-3 text-xs">{catName(c.categoryIdsCsv)}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-sm">
                      <div className="flex justify-end gap-3">
                        <button className="text-brand-500 dark:text-brand-400 hover:underline" onClick={() => openEdit(c)}>Edit</button>
                        <DeleteIconButton onClick={() => void remove(c)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{total} coupon(s)</span>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 disabled:opacity-50 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="px-2 py-1">{page} / {pages}</span>
            <button className="rounded border px-3 py-1 disabled:opacity-50 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.code}` : "New coupon"}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          <div className="md:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>Type</Label>
            <select className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "Percent" | "Fixed" })}>
              <option value="Percent">Percent</option>
              <option value="Fixed">Fixed amount</option>
            </select>
          </div>
          <div><Label>{form.type === "Percent" ? "Percent *" : "Amount *"}</Label><Input type="number" step={0.01} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div><Label>Max discount (cap)</Label><Input type="number" step={0.01} value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })} /></div>
          <div><Label>Min order amount</Label><Input type="number" step={0.01} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} /></div>
          <div><Label>Max uses</Label><Input type="number" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} /></div>
          <div><Label>Max uses per customer</Label><Input type="number" value={form.maxUsesPerCustomer} onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })} /></div>
          <div><Label>Valid from</Label><Input type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></div>
          <div><Label>Valid to</Label><Input type="datetime-local" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label></div>
          <div className="col-span-2 md:col-span-3">
            <Label>Restrict to categories (none = whole order)</Label>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-auto rounded-lg border p-2 dark:border-gray-700">
              {categories.length === 0 && <span className="text-xs text-gray-500 dark:text-gray-400">No categories loaded</span>}
              {categories.map((c) => {
                const on = form.categoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand-500 bg-brand-500 text-white" : "dark:border-gray-700"}`}
                    onClick={() => setForm({ ...form, categoryIds: on ? form.categoryIds.filter((id) => id !== c.id) : [...form.categoryIds, c.id] })}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="col-span-2 flex justify-end gap-2 md:col-span-3">
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700 text-gray-700 dark:text-gray-300" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={submitting} onClick={submit}>{submitting ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!redemptionsFor} onClose={() => setRedemptionsFor(null)} title={redemptionsFor ? `Redemptions of ${redemptionsFor.code}` : ""}>
        {redLoading ? <Loader /> : redemptions.length === 0 ? <div className="text-gray-500 dark:text-gray-400">Not used yet.</div> : (
          <Table>
            <TableHeader><TableRow>{["When", "Invoice", "Customer", "Discount", "By"].map((h) => <TableCell key={h} isHeader className="px-2 py-1 text-left text-xs text-gray-500 dark:text-gray-400">{h}</TableCell>)}</TableRow></TableHeader>
            <TableBody>
              {redemptions.map((r) => (
                <TableRow key={r.id} className="border-t border-gray-100 text-sm dark:border-white/[0.05]">
                  <TableCell className="px-2 py-1">{new Date(r.redeemedOn).toLocaleString()}</TableCell>
                  <TableCell className="px-2 py-1">#{r.transactionId}</TableCell>
                  <TableCell className="px-2 py-1">{r.userId ? `user ${r.userId}` : "—"}</TableCell>
                  <TableCell className="px-2 py-1">{r.discountAmount.toFixed(2)}</TableCell>
                  <TableCell className="px-2 py-1">{r.redeemedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Modal>
    </>
  );
}

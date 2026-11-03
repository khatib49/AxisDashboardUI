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
import { getItems, ItemDto } from "../../services/itemService";
import {
  ComboDto,
  ComboUpsertDto,
  createCombo,
  deleteCombo,
  errorMessage,
  listCombos,
  sellCombo,
  updateCombo,
} from "../../services/promotionsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };
type Line = { itemId: number; name: string; unitPrice: number; quantity: number };
type Form = { name: string; description: string; price: string; isActive: boolean; items: Line[] };
const emptyForm: Form = { name: "", description: "", price: "", isActive: true, items: [] };

export default function Combos() {
  const [combos, setCombos] = useState<ComboDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ComboDto | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // item picker
  const [itemSearch, setItemSearch] = useState("");
  const [itemResults, setItemResults] = useState<ItemDto[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  // sell
  const [sellFor, setSellFor] = useState<ComboDto | null>(null);
  const [sellTx, setSellTx] = useState("");
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCombos((await listCombos(true)) ?? []);
    } catch (e) {
      setError(errorMessage(e, "Failed to load combos"));
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Item search (existing items endpoint), debounced
  useEffect(() => {
    if (!formOpen) return;
    let alive = true;
    setItemLoading(true);
    const t = setTimeout(() => {
      getItems(1, 15, null, itemSearch || null)
        .then((r) => { if (alive) setItemResults(r.data ?? []); })
        .catch(() => { if (alive) setItemResults([]); })
        .finally(() => { if (alive) setItemLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [itemSearch, formOpen]);

  function openCreate() { setEditing(null); setForm(emptyForm); setItemSearch(""); setFormOpen(true); }
  function openEdit(c: ComboDto) {
    setEditing(c);
    setForm({
      name: c.name, description: c.description ?? "", price: String(c.price), isActive: c.isActive,
      items: c.items.map((i) => ({ itemId: i.itemId, name: i.itemName, unitPrice: i.unitPrice, quantity: i.quantity })),
    });
    setItemSearch("");
    setFormOpen(true);
  }

  function addItem(it: ItemDto) {
    const id = Number(it.id);
    setForm((f) => {
      const existing = f.items.find((l) => l.itemId === id);
      if (existing) return { ...f, items: f.items.map((l) => (l.itemId === id ? { ...l, quantity: l.quantity + 1 } : l)) };
      return { ...f, items: [...f.items, { itemId: id, name: it.name, unitPrice: Number(it.price) || 0, quantity: 1 }] };
    });
  }
  function setQty(itemId: number, qty: number) {
    setForm((f) => ({ ...f, items: qty <= 0 ? f.items.filter((l) => l.itemId !== itemId) : f.items.map((l) => (l.itemId === itemId ? { ...l, quantity: qty } : l)) }));
  }

  const itemsTotal = form.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  async function submit() {
    const price = Number(form.price);
    if (!form.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    if (Number.isNaN(price) || price < 0) { setNotice({ variant: "error", title: "Validation", message: "Price must be 0 or more" }); return; }
    if (form.items.length === 0) { setNotice({ variant: "error", title: "Validation", message: "Add at least one item" }); return; }
    const dto: ComboUpsertDto = {
      name: form.name.trim(), description: form.description.trim() || null, price, isActive: form.isActive,
      items: form.items.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    };
    setSubmitting(true);
    try {
      const res = editing ? await updateCombo(editing.id, dto) : await createCombo(dto);
      if (!res.success) { setNotice({ variant: "error", title: "Save failed", message: res.message }); return; }
      setNotice({ variant: "success", title: "Saved", message: res.message });
      setFormOpen(false);
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Save failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(c: ComboDto) {
    if (!window.confirm(`Delete combo "${c.name}"?`)) return;
    try {
      await deleteCombo(c.id);
      setNotice({ variant: "success", title: "Deleted", message: c.name });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Delete failed", message: errorMessage(e) });
    }
  }

  async function doSell() {
    if (!sellFor) return;
    setSelling(true);
    try {
      const res = await sellCombo(sellFor.id, sellTx ? Number(sellTx) : null);
      if (!res.success || !res.data) { setNotice({ variant: "error", title: "Sell failed", message: res.message }); return; }
      const d = res.data;
      setNotice({
        variant: "success", title: d.createdNewInvoice ? `Opened invoice #${d.transactionId}` : `Added to invoice #${d.transactionId}`,
        message: `${d.comboName}: items ${d.itemsTotal.toFixed(2)}, combo ${d.comboPrice.toFixed(2)}, adjustment ${d.adjustmentApplied.toFixed(2)}. Invoice total now ${d.invoiceTotalAfter.toFixed(2)}`,
      });
      setSellFor(null);
    } catch (e) {
      setNotice({ variant: "error", title: "Sell failed", message: errorMessage(e) });
    } finally {
      setSelling(false);
    }
  }

  return (
    <>
      <PageMeta title="Combos | Axis" description="Bundle items at one price" />
      <PageBreadcrumb pageTitle="Combos" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center">
          <p className="text-sm text-gray-500">Selling a combo adds its items to the invoice at full price, then books the saving as one adjustment.</p>
          <button className="ml-auto rounded bg-brand-500 px-4 py-2 text-sm text-white" onClick={openCreate}>New combo</button>
        </div>
        {error && <Alert variant="error" title="Error" message={error} />}
        {loading ? <div className="flex justify-center py-10"><Loader /></div> : combos.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No combos yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>{["Name", "Items", "Items total", "Combo price", "Saving", "Active", ""].map((h) => <TableCell key={h} isHeader className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</TableCell>)}</TableRow>
              </TableHeader>
              <TableBody>
                {combos.map((c) => (
                  <TableRow key={c.id} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className="px-3 py-3 text-sm"><div className="font-medium">{c.name}</div>{c.description && <div className="text-xs text-gray-500">{c.description}</div>}</TableCell>
                    <TableCell className="px-3 py-3 text-xs">{c.items.map((i) => `${i.quantity}× ${i.itemName}`).join(", ")}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.itemsTotal.toFixed(2)}</TableCell>
                    <TableCell className="px-3 py-3 text-sm font-semibold">{c.price.toFixed(2)}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.saving > 0 ? <span className="text-success-700 dark:text-success-400">-{c.saving.toFixed(2)}</span> : "—"}</TableCell>
                    <TableCell className="px-3 py-3 text-sm">{c.isActive ? "Yes" : "No"}</TableCell>
                    <TableCell className="px-3 py-3 text-right text-sm">
                      <div className="flex justify-end gap-3">
                        <button className="text-brand-500 hover:underline" disabled={!c.isActive} onClick={() => { setSellFor(c); setSellTx(""); }}>Sell</button>
                        <button className="text-brand-500 hover:underline" onClick={() => openEdit(c)}>Edit</button>
                        <DeleteIconButton onClick={() => void remove(c)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Builder */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.name}` : "New combo"}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Combo price *</Label><Input type="number" step={0.01} min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>

            <div className="rounded-lg border p-3 text-sm dark:border-gray-700">
              <div className="mb-2 font-medium">Items in combo</div>
              {form.items.length === 0 && <div className="text-gray-500">Pick items from the list.</div>}
              {form.items.map((l) => (
                <div key={l.itemId} className="flex items-center gap-2 py-1">
                  <span className="flex-1">{l.name} <span className="text-xs text-gray-500">@ {l.unitPrice.toFixed(2)}</span></span>
                  <button className="rounded border px-2 dark:border-gray-700" onClick={() => setQty(l.itemId, l.quantity - 1)}>−</button>
                  <span className="w-6 text-center">{l.quantity}</span>
                  <button className="rounded border px-2 dark:border-gray-700" onClick={() => setQty(l.itemId, l.quantity + 1)}>+</button>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t pt-2 dark:border-gray-700">
                <span>Items total</span><strong>{itemsTotal.toFixed(2)}</strong>
              </div>
              {form.price !== "" && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Saving vs items</span><span>{Math.max(0, itemsTotal - Number(form.price)).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Find items</Label>
            <Input placeholder="Search items…" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border dark:border-gray-700">
              {itemLoading ? <div className="p-3"><Loader size={18} /></div> : itemResults.length === 0 ? <div className="p-3 text-sm text-gray-500">No items.</div> : (
                itemResults.map((it) => (
                  <button key={it.id} type="button" className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]" onClick={() => addItem(it)}>
                    <span>{it.name}</span>
                    <span className="text-xs text-gray-500">{Number(it.price).toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 md:col-span-2">
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={submitting} onClick={submit}>{submitting ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Sell */}
      <Modal isOpen={!!sellFor} onClose={() => setSellFor(null)} title={sellFor ? `Sell ${sellFor.name}` : ""} className="max-w-md">
        {sellFor && (
          <div className="space-y-3 text-sm">
            <div>{sellFor.items.map((i) => `${i.quantity}× ${i.itemName}`).join(", ")} for <strong>{sellFor.price.toFixed(2)}</strong></div>
            <div><Label>Open invoice # (leave empty to open a new invoice)</Label><Input type="number" value={sellTx} onChange={(e) => setSellTx(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <button className="rounded border px-4 py-2 dark:border-gray-700" onClick={() => setSellFor(null)}>Cancel</button>
              <button className="rounded bg-brand-500 px-4 py-2 text-white disabled:opacity-50" disabled={selling} onClick={doSell}>{selling ? "Selling…" : sellTx ? "Add to invoice" : "Open new invoice"}</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import BranchScopeBadge from "./BranchScopeBadge";
import { useBranchScope } from "./useBranchScope";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  ReorderSuggestionDto,
  ReorderRuleDto,
  IngredientLite,
  SupplierLite,
  PURCHASE_DRAFT_STORAGE_KEY,
  getReorderSuggestions,
  buildPurchaseDraft,
  getReorderRules,
  createReorderRule,
  updateReorderRule,
  deleteReorderRule,
  getIngredients,
  getSuppliers,
  errorMessage,
} from "../../services/stockOpsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";
const select = "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90";
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function ReorderSuggestions() {
  const { branchId } = useBranchScope();
  const [tab, setTab] = useState<"suggestions" | "rules">("suggestions");
  const [suggestions, setSuggestions] = useState<ReorderSuggestionDto[]>([]);
  const [rules, setRules] = useState<ReorderRuleDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "">("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preparing, setPreparing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientLite[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);

  const [isRuleOpen, setIsRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReorderRuleDto | null>(null);
  const [ruleForm, setRuleForm] = useState({ ingredientId: "" as number | "", minQty: "", targetQty: "", preferredSupplierId: "" as number | "", leadTimeDays: "0", isActive: true });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([getReorderSuggestions(), getReorderRules()]);
      setSuggestions(s);
      setRules(r);
      setSelected(new Set(s.map((x) => x.ingredientId)));
    } catch (err) {
      setError(errorMessage(err, "Failed to load reorder data"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getIngredients().then((i) => setIngredients(i.filter((x) => x.isActive))).catch(() => setIngredients([]));
    getSuppliers().then((s) => setSuppliers(s.filter((x) => x.isActive))).catch(() => setSuppliers([]));
    try {
      setDraftReady(!!sessionStorage.getItem(PURCHASE_DRAFT_STORAGE_KEY));
    } catch {
      setDraftReady(false);
    }
    // Re-run when the header BranchSwitcher changes the X-Branch-Id scope.
  }, [load, branchId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const supplierOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of suggestions) if (s.supplierId != null) m.set(s.supplierId, s.supplierName ?? `#${s.supplierId}`);
    return Array.from(m.entries());
  }, [suggestions]);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return suggestions.filter((x) => (!s || x.ingredientName.toLowerCase().includes(s)) && (supplierFilter === "" || x.supplierId === supplierFilter));
  }, [suggestions, search, supplierFilter]);

  const selectedRows = useMemo(() => visible.filter((x) => selected.has(x.ingredientId)), [visible, selected]);
  const selectedCost = selectedRows.reduce((a, x) => a + x.estimatedCost, 0);

  function toggle(id: number) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  }

  async function prepare() {
    if (selectedRows.length === 0) {
      setNotice({ variant: "warning", title: "Nothing selected", message: "Tick at least one suggestion." });
      return;
    }
    setPreparing(true);
    try {
      const draft = await buildPurchaseDraft({
        ingredientIds: selectedRows.map((x) => x.ingredientId),
        supplierId: supplierFilter === "" ? null : supplierFilter,
      });
      sessionStorage.setItem(PURCHASE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setDraftReady(true);
      setNotice({ variant: "success", title: "Draft ready", message: `${draft.lines.length} line(s) prepared. Open the Purchases page to review and save it.` });
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to prepare the purchase draft") });
    } finally {
      setPreparing(false);
    }
  }

  function openCreateRule(prefillIngredientId?: number) {
    setEditingRule(null);
    const ing = prefillIngredientId ? ingredients.find((i) => i.id === prefillIngredientId) : undefined;
    setRuleForm({
      ingredientId: prefillIngredientId ?? "",
      minQty: ing?.reorderLevel != null ? String(ing.reorderLevel) : "",
      targetQty: ing?.reorderLevel != null ? String(ing.reorderLevel * 2) : "",
      preferredSupplierId: "",
      leadTimeDays: "0",
      isActive: true,
    });
    setIsRuleOpen(true);
  }

  function openEditRule(r: ReorderRuleDto) {
    setEditingRule(r);
    setRuleForm({
      ingredientId: r.ingredientId,
      minQty: String(r.minQty),
      targetQty: String(r.targetQty),
      preferredSupplierId: r.preferredSupplierId ?? "",
      leadTimeDays: String(r.leadTimeDays),
      isActive: r.isActive,
    });
    setIsRuleOpen(true);
  }

  async function submitRule() {
    if (ruleForm.ingredientId === "") {
      setNotice({ variant: "warning", title: "Missing ingredient", message: "Pick an ingredient." });
      return;
    }
    const minQty = Number(ruleForm.minQty);
    const targetQty = Number(ruleForm.targetQty);
    if (Number.isNaN(minQty) || Number.isNaN(targetQty) || targetQty <= minQty) {
      setNotice({ variant: "warning", title: "Check quantities", message: "Target must be greater than the minimum." });
      return;
    }
    setSubmitting(true);
    try {
      const dto = {
        ingredientId: Number(ruleForm.ingredientId),
        minQty,
        targetQty,
        preferredSupplierId: ruleForm.preferredSupplierId === "" ? null : Number(ruleForm.preferredSupplierId),
        leadTimeDays: Number(ruleForm.leadTimeDays) || 0,
        isActive: ruleForm.isActive,
      };
      if (editingRule) await updateReorderRule(editingRule.id, dto);
      else await createReorderRule(dto);
      setIsRuleOpen(false);
      setNotice({ variant: "success", title: "Saved", message: "Reorder rule saved." });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to save rule") });
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRule(r: ReorderRuleDto) {
    if (!window.confirm(`Delete the rule for ${r.ingredientName}?`)) return;
    try {
      await deleteReorderRule(r.id);
      setNotice({ variant: "success", title: "Deleted", message: "Rule removed." });
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Error", message: errorMessage(err, "Failed to delete rule") });
    }
  }

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === key ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6">
      <PageMeta title="Reorder Suggestions | Axis" description="What to buy next, based on stock levels" />
      <PageBreadcrumb pageTitle="Reorder Suggestions" />
      <BranchScopeBadge note={'Quantities are what this branch holds (its locations), so suggestions show what the branch needs to pull in.'} />

      {notice && (
        <div className="mb-4">
          <Alert variant={notice.variant} title={notice.title} message={notice.message} />
        </div>
      )}

      {draftReady && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <span>A purchase draft is waiting. Open the Purchases page to review and save it.</span>
          <div className="flex items-center gap-3">
            <Link to="/chef/purchases" className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700">Go to Purchases</Link>
            <button className="underline" onClick={() => { try { sessionStorage.removeItem(PURCHASE_DRAFT_STORAGE_KEY); } catch { /* ignore */ } setDraftReady(false); }}>Discard</button>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b border-gray-200 dark:border-white/10">
        {tabBtn("suggestions", `Suggestions (${suggestions.length})`)}
        {tabBtn("rules", `Rules (${rules.length})`)}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && tab === "suggestions" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Input placeholder="Search ingredient..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-white/10 dark:bg-gray-900 dark:text-white/90" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">All suppliers</option>
              {supplierOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline" onClick={load}>Refresh</button>
            <div className="ml-auto flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
              <span>{selectedRows.length} selected · est. <b>{money(selectedCost)}</b></span>
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50" disabled={preparing || selectedRows.length === 0} onClick={prepare}>
                {preparing ? "Preparing..." : "Prepare purchase"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>
                      <input type="checkbox" checked={visible.length > 0 && visible.every((x) => selected.has(x.ingredientId))} onChange={(e) => {
                        const n = new Set(selected);
                        for (const x of visible) { if (e.target.checked) n.add(x.ingredientId); else n.delete(x.ingredientId); }
                        setSelected(n);
                      }} />
                    </TableCell>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>On hand</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Threshold</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Suggested</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Unit cost</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Est. cost</TableCell>
                    <TableCell isHeader className={th}>Supplier</TableCell>
                    <TableCell isHeader className={th}>Last purchase</TableCell>
                    <TableCell isHeader className={th}>Rule</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {visible.length === 0 && (
                    <TableRow><TableCell className={`${td} text-center`}>{suggestions.length === 0 ? "Nothing needs reordering right now." : "No suggestions match the filters."}</TableCell></TableRow>
                  )}
                  {visible.map((s) => (
                    <TableRow key={s.ingredientId}>
                      <TableCell className={td}><input type="checkbox" checked={selected.has(s.ingredientId)} onChange={() => toggle(s.ingredientId)} /></TableCell>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{s.ingredientName} <span className="text-xs text-gray-400">{s.unit}</span></TableCell>
                      <TableCell className={`${td} text-end tabular-nums ${s.quantityOnHand <= 0 ? "text-red-600" : ""}`}>{qty(s.quantityOnHand)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(s.threshold)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums font-semibold`}>{qty(s.suggestedQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{s.unitCost == null ? "—" : money(s.unitCost)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{money(s.estimatedCost)}</TableCell>
                      <TableCell className={td}>{s.supplierName ?? "—"}{s.leadTimeDays > 0 && <div className="text-xs text-gray-400">{s.leadTimeDays}d lead</div>}</TableCell>
                      <TableCell className={td}>{s.lastPurchaseOn ? new Date(s.lastPurchaseOn).toLocaleDateString() : "—"}{s.lastPurchaseUnitCost != null && <div className="text-xs text-gray-400">@ {money(s.lastPurchaseUnitCost)}</div>}</TableCell>
                      <TableCell className={td}>
                        {s.hasRule ? (
                          <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => { const r = rules.find((x) => x.ingredientId === s.ingredientId); if (r) openEditRule(r); }}>Rule</button>
                        ) : (
                          <button className="text-gray-500 dark:text-gray-400 hover:underline" onClick={() => openCreateRule(s.ingredientId)}>Add rule</button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Without a rule an ingredient is suggested when it drops to its reorder level, with a target of twice that level. Rules override both numbers and can pin a preferred supplier.
          </p>
        </>
      )}

      {!loading && !error && tab === "rules" && (
        <>
          <div className="mb-4 flex justify-end">
            <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition" onClick={() => openCreateRule()}>+ Add Rule</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>Ingredient</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Min</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Target</TableCell>
                    <TableCell isHeader className={th}>Preferred supplier</TableCell>
                    <TableCell isHeader className={`${th} text-end`}>Lead days</TableCell>
                    <TableCell isHeader className={th}>Active</TableCell>
                    <TableCell isHeader className={th}>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {rules.length === 0 && (
                    <TableRow><TableCell className={`${td} text-center`}>No rules yet. Ingredients fall back to their reorder level.</TableCell></TableRow>
                  )}
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{r.ingredientName} <span className="text-xs text-gray-400">{r.unit}</span></TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(r.minQty)}</TableCell>
                      <TableCell className={`${td} text-end tabular-nums`}>{qty(r.targetQty)}</TableCell>
                      <TableCell className={td}>{r.preferredSupplierName ?? "—"}</TableCell>
                      <TableCell className={`${td} text-end`}>{r.leadTimeDays}</TableCell>
                      <TableCell className={td}>{r.isActive ? "Yes" : "No"}</TableCell>
                      <TableCell className={td}>
                        <div className="flex items-center gap-3">
                          <button className="text-blue-600 dark:text-blue-400 hover:underline" onClick={() => openEditRule(r)}>Edit</button>
                          <DeleteIconButton onClick={() => removeRule(r)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={isRuleOpen}
        onClose={() => setIsRuleOpen(false)}
        title={editingRule ? `Rule — ${editingRule.ingredientName}` : "New Reorder Rule"}
        className="max-w-lg"
        footer={
          <>
            <button className="px-4 py-2 rounded border dark:border-white/10 text-gray-700 dark:text-gray-300" onClick={() => setIsRuleOpen(false)} disabled={submitting}>Cancel</button>
            <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" onClick={submitRule} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="rr-ing">Ingredient</Label>
            <select id="rr-ing" className={select} value={ruleForm.ingredientId} disabled={!!editingRule} onChange={(e) => setRuleForm({ ...ruleForm, ingredientId: e.target.value === "" ? "" : Number(e.target.value) })}>
              <option value="">Select ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rr-min">Minimum qty</Label>
              <Input id="rr-min" type="number" step={0.001} min="0" value={ruleForm.minQty} onChange={(e) => setRuleForm({ ...ruleForm, minQty: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="rr-target">Target qty</Label>
              <Input id="rr-target" type="number" step={0.001} min="0" value={ruleForm.targetQty} onChange={(e) => setRuleForm({ ...ruleForm, targetQty: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="rr-sup">Preferred supplier</Label>
            <select id="rr-sup" className={select} value={ruleForm.preferredSupplierId} onChange={(e) => setRuleForm({ ...ruleForm, preferredSupplierId: e.target.value === "" ? "" : Number(e.target.value) })}>
              <option value="">None (use last purchase)</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="rr-lead">Lead time (days)</Label>
            <Input id="rr-lead" type="number" min="0" value={ruleForm.leadTimeDays} onChange={(e) => setRuleForm({ ...ruleForm, leadTimeDays: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })} />
            Active
          </label>
        </div>
      </Modal>
    </div>
  );
}

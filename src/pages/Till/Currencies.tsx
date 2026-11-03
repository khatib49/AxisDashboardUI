import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  getCurrencies,
  createCurrency,
  updateCurrency,
  setRate,
  getRateHistory,
  type CurrencyDto,
  type ExchangeRateDto,
} from "../../services/currencyService";
import { errorMessage } from "../../services/tillService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

export default function Currencies() {
  const [rows, setRows] = useState<CurrencyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<string>("");
  const [history, setHistory] = useState<ExchangeRateDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");

  const [form, setForm] = useState<{ code: string; name: string; symbol: string; decimalPlaces: string; roundingStep: string; initialRate: string } | null>(null);
  const [editing, setEditing] = useState<CurrencyDto | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; symbol: string; decimalPlaces: string; roundingStep: string; isActive: boolean } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getCurrencies(true);
      setRows(list);
      setSelected((s) => s || list.find((c) => !c.isBase)?.code || "");
    } catch (err) {
      setError(errorMessage(err, "Failed to load currencies"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    setHistoryLoading(true);
    getRateHistory(selected)
      .then((h) => { if (mounted) setHistory(h); })
      .catch(() => { if (mounted) setHistory([]); })
      .finally(() => { if (mounted) setHistoryLoading(false); });
    return () => { mounted = false; };
  }, [selected, rows]);

  const chartData = useMemo(
    () => history.map((h) => ({ date: new Date(h.effectiveFrom).toLocaleDateString(), rate: h.rate })),
    [history]
  );

  const selectedCurrency = rows.find((c) => c.code === selected);

  async function saveRate() {
    const r = parseFloat(newRate);
    if (!selected) return;
    if (Number.isNaN(r) || r <= 0) return setNotice({ variant: "error", title: "Validation", message: "Rate must be greater than zero" });
    setBusy(true);
    try {
      const res = await setRate({ currencyCode: selected, rate: r, effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null });
      if (!res.success) return setNotice({ variant: "error", title: "Failed", message: res.error || res.message });
      setNotice({ variant: "success", title: "Rate saved", message: `1 USD = ${r.toLocaleString()} ${selected}` });
      setNewRate("");
      setEffectiveFrom("");
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function saveNew() {
    if (!form) return;
    if (form.code.trim().length !== 3) return setNotice({ variant: "error", title: "Validation", message: "Code must be 3 letters" });
    if (!form.name.trim()) return setNotice({ variant: "error", title: "Validation", message: "Name is required" });
    const rate = parseFloat(form.initialRate);
    if (Number.isNaN(rate) || rate <= 0) return setNotice({ variant: "error", title: "Validation", message: "Initial rate must be greater than zero" });
    setBusy(true);
    try {
      const res = await createCurrency({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        symbol: form.symbol.trim() || form.code.trim().toUpperCase(),
        decimalPlaces: parseInt(form.decimalPlaces, 10) || 0,
        roundingStep: parseFloat(form.roundingStep) || 0,
        isBase: false,
        isActive: true,
        initialRate: rate,
      });
      if (!res.success) return setNotice({ variant: "error", title: "Failed", message: res.error || res.message });
      setNotice({ variant: "success", title: "Created", message: res.message });
      setForm(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing || !editForm) return;
    setBusy(true);
    try {
      const res = await updateCurrency(editing.code, {
        name: editForm.name,
        symbol: editForm.symbol,
        decimalPlaces: parseInt(editForm.decimalPlaces, 10) || 0,
        roundingStep: parseFloat(editForm.roundingStep) || 0,
        isActive: editForm.isActive,
      });
      if (!res.success) return setNotice({ variant: "error", title: "Failed", message: res.error || res.message });
      setNotice({ variant: "success", title: "Updated", message: res.message });
      setEditing(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageMeta title="Currencies | Axis" description="Currencies and daily exchange rates" />
      <PageBreadcrumb pageTitle="Currencies & Rates" />
      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}
      {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-white/90">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h4 className="text-sm font-semibold dark:text-white">Currencies</h4>
              <button onClick={() => setForm({ code: "", name: "", symbol: "", decimalPlaces: "2", roundingStep: "0.01", initialRate: "" })} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600">+ Add</button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader /></div>
            ) : rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No currencies.</p>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500 dark:text-gray-400">Code</TableCell>
                    <TableCell isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500 dark:text-gray-400">Name</TableCell>
                    <TableCell isHeader className="px-4 py-2 text-right text-xs uppercase text-gray-500 dark:text-gray-400">Rate / 1 base</TableCell>
                    <TableCell isHeader className="px-4 py-2 text-right text-xs uppercase text-gray-500 dark:text-gray-400">Step</TableCell>
                    <TableCell isHeader className="px-4 py-2 text-right text-xs uppercase text-gray-500 dark:text-gray-400">{""}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.code} className={`cursor-pointer border-t border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200 ${c.code === selected ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}>
                      <TableCell className="px-4 py-2 font-semibold">
                        <button onClick={() => setSelected(c.code)}>{c.code}{c.isBase && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">BASE</span>}</button>
                        {!c.isActive && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                      </TableCell>
                      <TableCell className="px-4 py-2">{c.name} <span className="text-gray-400">{c.symbol}</span></TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">{c.isBase ? "1" : c.currentRate != null ? c.currentRate.toLocaleString() : "—"}</TableCell>
                      <TableCell className="px-4 py-2 text-right tabular-nums">{c.roundingStep}</TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        <button onClick={() => { setEditing(c); setEditForm({ name: c.name, symbol: c.symbol, decimalPlaces: String(c.decimalPlaces), roundingStep: String(c.roundingStep), isActive: c.isActive }); }} className="text-brand-500 dark:text-brand-400 hover:underline">Edit</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-white/90">
            <h4 className="mb-3 text-sm font-semibold dark:text-white">Today's rate {selectedCurrency ? `· 1 USD → ${selectedCurrency.code}` : ""}</h4>
            {!selectedCurrency ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Select a non-base currency on the left.</p>
            ) : selectedCurrency.isBase ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">The base currency always has rate 1.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="rate">Rate ({selectedCurrency.code} per 1 USD)</Label>
                  <Input id="rate" type="number" min="0" step={0.000001} value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder={selectedCurrency.currentRate != null ? String(selectedCurrency.currentRate) : ""} />
                </div>
                <div>
                  <Label htmlFor="eff">Effective from (default today)</Label>
                  <Input id="eff" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button disabled={busy} onClick={saveRate} className="h-11 rounded-lg bg-brand-500 px-4 text-sm text-white hover:bg-brand-600 disabled:opacity-50">{busy ? "Saving…" : "Save rate"}</button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 text-gray-800 dark:text-white/90">
            <h4 className="mb-3 text-sm font-semibold dark:text-white">Rate history {selected ? `· ${selected}` : ""}</h4>
            {historyLoading ? (
              <div className="flex justify-center py-10"><Loader /></div>
            ) : chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No rates recorded yet.</p>
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} />
                      <YAxis tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString()} width={80} />
                      <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} ${selected}`, "Rate"]} contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="rate" stroke="#465fff" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 max-h-56 overflow-auto">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
                      <TableRow>
                        <TableCell isHeader className="px-3 py-1.5 text-left text-xs uppercase text-gray-500 dark:text-gray-400">Effective</TableCell>
                        <TableCell isHeader className="px-3 py-1.5 text-right text-xs uppercase text-gray-500 dark:text-gray-400">Rate</TableCell>
                        <TableCell isHeader className="px-3 py-1.5 text-left text-xs uppercase text-gray-500 dark:text-gray-400">Set by</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...history].reverse().map((h) => (
                        <TableRow key={h.id} className="border-t border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200">
                          <TableCell className="px-3 py-1.5">{new Date(h.effectiveFrom).toLocaleDateString()}</TableCell>
                          <TableCell className="px-3 py-1.5 text-right tabular-nums">{h.rate.toLocaleString()}</TableCell>
                          <TableCell className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{h.createdBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!form}
        onClose={() => setForm(null)}
        title="Add currency"
        className="max-w-md"
        footer={
          <>
            <button onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={saveNew} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Create"}</button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="c-code">Code</Label><Input id="c-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EUR" /></div>
            <div><Label htmlFor="c-symbol">Symbol</Label><Input id="c-symbol" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="€" /></div>
            <div className="col-span-2"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="c-dp">Decimal places</Label><Input id="c-dp" type="number" min="0" max="6" value={form.decimalPlaces} onChange={(e) => setForm({ ...form, decimalPlaces: e.target.value })} /></div>
            <div><Label htmlFor="c-step">Cash rounding step</Label><Input id="c-step" type="number" min="0" step={0.01} value={form.roundingStep} onChange={(e) => setForm({ ...form, roundingStep: e.target.value })} /></div>
            <div className="col-span-2"><Label htmlFor="c-rate">Initial rate (units per 1 USD)</Label><Input id="c-rate" type="number" min="0" step={0.000001} value={form.initialRate} onChange={(e) => setForm({ ...form, initialRate: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!editing && !!editForm}
        onClose={() => { setEditing(null); setEditForm(null); }}
        title={`Edit ${editing?.code ?? ""}`}
        className="max-w-md"
        footer={
          <>
            <button onClick={() => { setEditing(null); setEditForm(null); }} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-white">Cancel</button>
            <button disabled={busy} onClick={saveEdit} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          </>
        }
      >
        {editForm && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label htmlFor="e-name">Name</Label><Input id="e-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label htmlFor="e-symbol">Symbol</Label><Input id="e-symbol" value={editForm.symbol} onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value })} /></div>
            <div><Label htmlFor="e-dp">Decimal places</Label><Input id="e-dp" type="number" min="0" max="6" value={editForm.decimalPlaces} onChange={(e) => setEditForm({ ...editForm, decimalPlaces: e.target.value })} /></div>
            <div><Label htmlFor="e-step">Cash rounding step</Label><Input id="e-step" type="number" min="0" step={0.01} value={editForm.roundingStep} onChange={(e) => setEditForm({ ...editForm, roundingStep: e.target.value })} /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm dark:text-gray-200">
              <input type="checkbox" disabled={editing?.isBase} checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

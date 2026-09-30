// Admin → Shipping & Aramex
// =========================
// One page for everything delivery: which Aramex environment is live, the
// shop/delivery/COD switches, the shipper (pickup) address printed on every
// AWB, the flat-fee delivery zones, and every shipment with its tracking —
// plus the money side: book a courier pickup and settle the COD that Aramex
// pays out (net of their fees) into cash or bank with one journal entry.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import Modal from "../../components/ui/Modal";
import Loader from "../../components/ui/Loader";
import { integrationSettingsService } from "../../services/integrationSettingsService";
import {
  Shipment, ShippingSettings, ShippingZone, ShippingZoneInput, ShipmentList, ShipmentFilterStatus,
  ShippingTestResult, PickupResult, CodSettlementResult,
  getShippingSettings, testAramex, listZones, createZone, updateZone, deleteZone,
  listShipments, refreshShipmentAdmin, markDeliveredAdmin, setShipmentStatusAdmin, pollShipments, bookPickup, settleCod,
  apiErrorMessage, SHIPMENT_STATUS_STYLE, SHIPMENT_STATUS_LABEL,
} from "../../services/shippingService";

const money = (n: number, c = "USD") => `${c === "USD" ? "$" : c + " "}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const localYmd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtDt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

const inputCls = "w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const smallInput = "h-8 px-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500";
const btnSecondary = "h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const btnPrimary = "h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50";

function StatusPill({ s }: { s: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${SHIPMENT_STATUS_STYLE[s] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>{SHIPMENT_STATUS_LABEL[s] ?? s}</span>;
}

function Toggle({ checked, onChange, disabled, label, hint }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint?: string }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

// ── Header cards ─────────────────────────────────────────────────────────
function HeaderCards({ settings, list, onReloadSettings }: { settings: ShippingSettings | null; list: ShipmentList | null; onReloadSettings: () => Promise<void> }) {
  const [switching, setSwitching] = useState(false);
  const [test, setTest] = useState<ShippingTestResult | "running" | null>(null);
  const live = settings?.environment === "production";

  const switchEnv = async (env: "sandbox" | "production") => {
    if (!settings || settings.environment === env) return;
    if (env === "production" && !confirm("Switch Aramex to PRODUCTION? Real shipments will be created and billed to your Aramex account from now on.")) return;
    setSwitching(true);
    try { await integrationSettingsService.upsert("Aramex.Environment", env); await onReloadSettings(); }
    catch (e: unknown) { alert(apiErrorMessage(e, "Could not switch environment.")); }
    finally { setSwitching(false); }
  };
  const runTest = async () => {
    setTest("running");
    try { setTest(await testAramex()); }
    catch (e: unknown) { setTest({ ok: false, message: apiErrorMessage(e, "Test failed") }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <div className={`lg:col-span-2 rounded-2xl border p-4 ${live ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Aramex</h2>
              {settings ? (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${live ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>{settings.environment}</span>
              ) : <Loader size={14} />}
              {settings && (
                <span className={`text-[11px] ${(live ? settings.productionConfigured : settings.sandboxConfigured) ? "text-emerald-700" : "text-red-600"}`}>
                  {(live ? settings.productionConfigured : settings.sandboxConfigured) ? "● credentials set" : "● not configured"}
                </span>
              )}
            </div>
            {settings && (
              <p className="text-xs text-gray-500 mt-1">
                Sandbox {settings.sandboxConfigured ? "✓" : "—"} · Production {settings.productionConfigured ? "✓" : "—"} · host {live ? settings.productionUrl : settings.sandboxUrl}.
                Keys are under <Link to="/admin/integrations" className="text-indigo-600 underline">Integrations</Link>.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
              <button disabled={switching || !settings} onClick={() => switchEnv("sandbox")}
                className={`px-3 h-8 text-xs font-semibold ${!live ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Sandbox</button>
              <button disabled={switching || !settings} onClick={() => switchEnv("production")}
                className={`px-3 h-8 text-xs font-semibold ${live ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Production</button>
            </div>
            <button onClick={runTest} disabled={test === "running"} className={btnSecondary}>{test === "running" ? "Testing…" : "Test connection"}</button>
          </div>
        </div>
        {test && test !== "running" && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${test.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {test.ok ? "✓ " : "✗ "}{test.message ?? (test.ok ? "OK" : "Failed")}
            {test.ok && test.rateAmount != null && <> · sample rate {money(test.rateAmount, test.rateCurrency ?? "USD")}</>}
          </div>
        )}
      </div>
      <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
        <div className="text-[11px] font-semibold uppercase text-indigo-700">🚚 Open shipments</div>
        <div className="text-2xl font-bold text-indigo-800">{list ? list.openCount : "—"}</div>
        <div className="text-[11px] text-indigo-600">created, picked up or in transit</div>
      </div>
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
        <div className="text-[11px] font-semibold uppercase text-amber-700">💵 COD to collect from Aramex</div>
        <div className="text-2xl font-bold text-amber-800">{list ? money(list.codOutstanding) : "—"}</div>
        <div className="text-[11px] text-amber-600">{list ? `${list.deliveredUnsettledCount} delivered, not settled` : ""}</div>
      </div>
    </div>
  );
}

// ── Shop & delivery switches ─────────────────────────────────────────────
function ShopSwitches({ settings, onReload }: { settings: ShippingSettings | null; onReload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = async (key: string, value: string) => {
    setBusy(key); setErr(null);
    try { await integrationSettingsService.upsert(key, value); await onReload(); }
    catch (e: unknown) { setErr(apiErrorMessage(e, "Could not save.")); }
    finally { setBusy(null); }
  };
  if (!settings) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-gray-900">Shop & delivery</h2>
      <p className="text-xs text-gray-500 mb-3">Each switch saves immediately.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Toggle label="Online shop" hint="Shop.Enabled — customers can order" checked={settings.shopEnabled} disabled={busy !== null} onChange={(v) => save("Shop.Enabled", v ? "true" : "false")} />
        <Toggle label="Delivery" hint="Shop.DeliveryEnabled — offer delivery at checkout" checked={settings.deliveryEnabled} disabled={busy !== null} onChange={(v) => save("Shop.DeliveryEnabled", v ? "true" : "false")} />
        <Toggle label="Cash on delivery" hint="Shop.CodEnabled — Aramex collects the cash" checked={settings.codEnabled} disabled={busy !== null} onChange={(v) => save("Shop.CodEnabled", v ? "true" : "false")} />
        <label className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <div className="text-sm font-medium text-gray-800">Delivery fee</div>
          <select value={settings.rateMode} disabled={busy !== null} onChange={(e) => save("Shop.RateMode", e.target.value)}
            className="mt-1 w-full h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700">
            <option value="zones">Zones (flat fee per city list)</option>
            <option value="aramex">Aramex live rate, zone fallback</option>
            <option value="free">Free delivery</option>
          </select>
        </label>
      </div>
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </section>
  );
}

// ── Shipper profile ──────────────────────────────────────────────────────
type ShipperField = { key: string; label: string; from: (s: ShippingSettings) => string; type?: string; placeholder?: string };
const SHIPPER_FIELDS: ShipperField[] = [
  { key: "Shipping.Shipper.CompanyName", label: "Company", from: (s) => s.shipperCompany ?? "", placeholder: "AXIS" },
  { key: "Shipping.Shipper.PersonName", label: "Contact person", from: (s) => s.shipperPerson ?? "" },
  { key: "Shipping.Shipper.Phone", label: "Phone", from: (s) => s.shipperPhone ?? "" },
  { key: "Shipping.Shipper.Cell", label: "Mobile", from: (s) => s.shipperCell ?? "" },
  { key: "Shipping.Shipper.Email", label: "Email", from: (s) => s.shipperEmail ?? "", type: "email" },
  { key: "Shipping.Shipper.Line1", label: "Address line 1", from: (s) => s.shipperLine1 ?? "" },
  { key: "Shipping.Shipper.Line2", label: "Address line 2", from: (s) => s.shipperLine2 ?? "" },
  { key: "Shipping.Shipper.City", label: "City", from: (s) => s.shipperCity ?? "", placeholder: "Beirut" },
  { key: "Shipping.Shipper.CountryCode", label: "Country code", from: (s) => s.shipperCountry ?? "", placeholder: "LB" },
  { key: "Shipping.DefaultWeightKg", label: "Default weight (kg)", from: (s) => String(s.defaultWeightKg ?? ""), type: "number" },
];

function ShipperProfile({ settings, onReload }: { settings: ShippingSettings | null; onReload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!settings) return;
    const d: Record<string, string> = {};
    for (const f of SHIPPER_FIELDS) d[f.key] = f.from(settings);
    setDraft(d);
  }, [settings]);

  const changed = useMemo(() => settings ? SHIPPER_FIELDS.filter((f) => (draft[f.key] ?? "") !== f.from(settings)) : [], [draft, settings]);

  const save = async () => {
    if (changed.length === 0) return;
    setSaving(true); setMsg(null);
    try {
      for (const f of changed) await integrationSettingsService.upsert(f.key, draft[f.key] ?? "");
      await onReload();
      setMsg({ ok: true, text: `Saved ${changed.length} field${changed.length === 1 ? "" : "s"}.` });
    } catch (e: unknown) { setMsg({ ok: false, text: apiErrorMessage(e, "Could not save.") }); }
    finally { setSaving(false); }
  };

  if (!settings) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">Shipper profile</h2>
          <p className="text-xs text-gray-500">Pickup address printed on every AWB and used for rate quotes. Country code is ISO-2 (LB).</p>
        </div>
        <button onClick={save} disabled={saving || changed.length === 0} className={btnPrimary}>{saving ? "Saving…" : changed.length > 0 ? `Save (${changed.length})` : "Saved"}</button>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {SHIPPER_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-gray-500">{f.label}</label>
            <input type={f.type ?? "text"} step={f.type === "number" ? "0.1" : undefined} value={draft[f.key] ?? ""} placeholder={f.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} className={inputCls} />
          </div>
        ))}
      </div>
      {msg && <div className={`mt-2 text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</div>}
    </section>
  );
}

// ── Delivery zones ───────────────────────────────────────────────────────
type ZoneDraft = { name: string; cities: string; fee: string; freeAbove: string; estimatedDays: string; sortOrder: string; isActive: boolean };
const emptyZone = (): ZoneDraft => ({ name: "", cities: "", fee: "", freeAbove: "", estimatedDays: "", sortOrder: "0", isActive: true });
const toDraft = (z: ShippingZone): ZoneDraft => ({
  name: z.name, cities: z.cities, fee: String(z.fee), freeAbove: z.freeAbove != null ? String(z.freeAbove) : "",
  estimatedDays: z.estimatedDays ?? "", sortOrder: String(z.sortOrder), isActive: z.isActive,
});
const toInput = (d: ZoneDraft): ShippingZoneInput => ({
  name: d.name.trim(), cities: d.cities.trim(), fee: Number(d.fee) || 0,
  freeAbove: d.freeAbove.trim() === "" ? null : Number(d.freeAbove),
  estimatedDays: d.estimatedDays.trim() || null,
  sortOrder: Number(d.sortOrder) || 0, isActive: d.isActive,
});

function ZoneEditorRow({ draft, setDraft, onSave, onCancel, busy }: { draft: ZoneDraft; setDraft: (d: ZoneDraft) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <tr className="bg-indigo-50/40">
      <td className="px-3 py-2 align-top"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Beirut" className={`${smallInput} w-32`} autoFocus /></td>
      <td className="px-3 py-2 align-top"><textarea value={draft.cities} onChange={(e) => setDraft({ ...draft, cities: e.target.value })} placeholder="Beirut, Hamra, Achrafieh" rows={2} className="w-full min-w-[220px] px-2 py-1 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" /></td>
      <td className="px-3 py-2 align-top"><input type="number" step="0.5" min="0" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} className={`${smallInput} w-20`} /></td>
      <td className="px-3 py-2 align-top"><input type="number" step="1" min="0" value={draft.freeAbove} onChange={(e) => setDraft({ ...draft, freeAbove: e.target.value })} placeholder="—" className={`${smallInput} w-20`} /></td>
      <td className="px-3 py-2 align-top"><input value={draft.estimatedDays} onChange={(e) => setDraft({ ...draft, estimatedDays: e.target.value })} placeholder="1–2 days" className={`${smallInput} w-24`} /></td>
      <td className="px-3 py-2 align-top"><input type="number" step="1" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} className={`${smallInput} w-16`} /></td>
      <td className="px-3 py-2 align-top"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> active</label></td>
      <td className="px-3 py-2 align-top text-right whitespace-nowrap">
        <button onClick={onSave} disabled={busy || !draft.name.trim()} className="text-xs px-2.5 h-8 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{busy ? "…" : "Save"}</button>
        <button onClick={onCancel} disabled={busy} className="ml-1 text-xs px-2.5 h-8 rounded-lg border border-gray-200">Cancel</button>
      </td>
    </tr>
  );
}

function ZonesTable() {
  const [zones, setZones] = useState<ShippingZone[] | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<ZoneDraft>(emptyZone());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setZones(await listZones(true)); }
    catch (e: unknown) { setErr(apiErrorMessage(e, "Could not load zones.")); setZones([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (editingId === "new") await createZone(toInput(draft));
      else if (typeof editingId === "number") await updateZone(editingId, toInput(draft));
      setEditingId(null);
      await load();
    } catch (e: unknown) { setErr(apiErrorMessage(e, "Could not save zone.")); }
    finally { setBusy(false); }
  };
  const remove = async (z: ShippingZone) => {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    setBusy(true); setErr(null);
    try { await deleteZone(z.id); await load(); }
    catch (e: unknown) { setErr(apiErrorMessage(e, "Could not delete zone.")); }
    finally { setBusy(false); }
  };

  const th = "text-left px-3 py-2";
  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">Delivery zones</h2>
          <p className="text-xs text-gray-500">Flat fee by city. The customer's city is matched against each zone's list (case-insensitive). Used when the rate mode is "zones" or as Aramex fallback.</p>
        </div>
        <button onClick={() => { setDraft(emptyZone()); setEditingId("new"); }} disabled={editingId !== null} className={btnPrimary}>+ Add zone</button>
      </div>
      {err && <div className="mx-4 mb-2 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">{err}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
            <tr>
              <th className={th}>Name</th><th className={th}>Cities</th><th className={th}>Fee</th><th className={th}>Free above</th><th className={th}>Est. days</th><th className={th}>Sort</th><th className={th}>Active</th><th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {editingId === "new" && <ZoneEditorRow draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditingId(null)} busy={busy} />}
            {zones === null ? (
              <tr><td colSpan={8} className="py-8 text-center"><Loader /></td></tr>
            ) : zones.length === 0 && editingId !== "new" ? (
              <tr><td colSpan={8} className="py-8 text-center text-xs text-gray-400">No zones yet — add one so delivery can be priced.</td></tr>
            ) : zones.map((z) => editingId === z.id ? (
              <ZoneEditorRow key={z.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditingId(null)} busy={busy} />
            ) : (
              <tr key={z.id} className={z.isActive ? "" : "opacity-50"}>
                <td className="px-3 py-2 font-medium text-gray-900">{z.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600 max-w-[380px]">{z.cities}</td>
                <td className="px-3 py-2 whitespace-nowrap">{money(z.fee)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{z.freeAbove != null ? money(z.freeAbove) : "—"}</td>
                <td className="px-3 py-2 text-gray-600">{z.estimatedDays || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{z.sortOrder}</td>
                <td className="px-3 py-2">{z.isActive ? <span className="text-green-700 text-xs">● active</span> : <span className="text-gray-400 text-xs">○ off</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => { setDraft(toDraft(z)); setEditingId(z.id); }} disabled={editingId !== null || busy} className="text-xs px-2 h-7 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Edit</button>
                  <button onClick={() => remove(z)} disabled={editingId !== null || busy} className="ml-1 text-xs px-2 h-7 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Pickup modal ─────────────────────────────────────────────────────────
function PickupModal({ open, onClose, onBooked }: { open: boolean; onClose: () => void; onBooked: () => void }) {
  const [date, setDate] = useState(localYmd(new Date()));
  const [ready, setReady] = useState("11:00");
  const [last, setLast] = useState("16:00");
  const [closing, setClosing] = useState("20:00");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PickupResult | null>(null);

  useEffect(() => { if (open) { setDate(localYmd(new Date())); setReady("11:00"); setLast("16:00"); setClosing("20:00"); setReference(""); setResult(null); } }, [open]);

  const submit = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await bookPickup({ pickupDate: date, readyTime: ready, lastPickupTime: last, closingTime: closing, reference: reference || null });
      setResult(r);
      if (r.success) onBooked();
    } catch (e: unknown) { setResult({ success: false, error: apiErrorMessage(e, "Could not book the pickup."), shipmentsAttached: 0 }); }
    finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Book Aramex courier pickup">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Asks Aramex to send a courier to the shipper address for every shipment still in "Created". Times are local.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-gray-500">Pickup date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="optional" className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Ready from</label><input type="time" value={ready} onChange={(e) => setReady(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Last pickup</label><input type="time" value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Closing time</label><input type="time" value={closing} onChange={(e) => setClosing(e.target.value)} className={inputCls} /></div>
        </div>
        {result && (
          <div className={`rounded-lg px-3 py-2 text-sm ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {result.success ? <>✓ Pickup booked — id <b>{result.pickupId ?? "—"}</b>{result.pickupGuid ? <span className="text-xs text-green-600"> ({result.pickupGuid})</span> : null}. {result.shipmentsAttached} shipment{result.shipmentsAttached === 1 ? "" : "s"} attached.</> : <>✗ {result.error ?? "Failed"}</>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">{result?.success ? "Close" : "Cancel"}</button>
          {!result?.success && <button onClick={submit} disabled={busy} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy ? "Booking…" : "Book pickup"}</button>}
        </div>
      </div>
    </Modal>
  );
}

// ── COD settlement modal ─────────────────────────────────────────────────
function SettleCodModal({ open, onClose, candidates, onSettled }: { open: boolean; onClose: () => void; candidates: Shipment[]; onSettled: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [net, setNet] = useState("");
  const [fees, setFees] = useState("");
  const [into, setInto] = useState<"cash" | "bank">("cash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CodSettlementResult | null>(null);
  const [netTouched, setNetTouched] = useState(false);

  const total = useMemo(() => candidates.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.codAmount, 0), [candidates, selected]);

  useEffect(() => {
    if (open) { setSelected(new Set(candidates.map((s) => s.id))); setInto("cash"); setReference(""); setResult(null); setNetTouched(false); setFees("0"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Net defaults to the COD total until the user edits it; fees = total − net.
  useEffect(() => {
    if (!netTouched) { setNet(total.toFixed(2)); setFees("0.00"); }
    else { const n = Number(net) || 0; setFees(Math.max(0, total - n).toFixed(2)); }
  }, [total, net, netTouched]);

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = candidates.length > 0 && selected.size === candidates.length;

  const submit = async () => {
    if (selected.size === 0) return;
    const n = Number(net); const f = Number(fees);
    if (!(n >= 0) || !(f >= 0)) { setResult({ success: false, error: "Net and fees must be numbers.", codTotal: total, netReceived: 0, fees: 0, shipmentsSettled: 0 }); return; }
    if (Math.abs(n + f - total) > 0.01 && !confirm(`Net ${money(n)} + fees ${money(f)} ≠ COD total ${money(total)}. Continue anyway?`)) return;
    setBusy(true); setResult(null);
    try {
      const r = await settleCod({ shipmentIds: Array.from(selected), netReceived: n, fees: f, receivedInto: into, reference: reference || null });
      setResult(r);
      if (r.success) onSettled();
    } catch (e: unknown) { setResult({ success: false, error: apiErrorMessage(e, "Could not settle."), codTotal: total, netReceived: 0, fees: 0, shipmentsSettled: 0 }); }
    finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Settle COD from Aramex" className="max-w-2xl w-full">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Tick the delivered COD shipments covered by this Aramex payout. One journal entry moves the amount from the Aramex receivable into cash or bank; the difference is booked as courier fees.</p>
        {candidates.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">Nothing to settle — no delivered COD shipments are outstanding.</div>
        ) : (
          <div className="rounded-xl border border-gray-200 max-h-64 overflow-y-auto divide-y divide-gray-100">
            <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold bg-gray-50 sticky top-0">
              <input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(candidates.map((s) => s.id)) : new Set())} /> Select all ({candidates.length})
            </label>
            {candidates.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50/40 cursor-pointer">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="font-mono text-xs text-gray-700">{s.awbNumber ?? "—"}</span>
                <span className="text-gray-900">{s.orderCode}</span>
                <span className="text-gray-500 text-xs truncate">{s.customerName}{s.city ? ` · ${s.city}` : ""}</span>
                <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">{s.deliveredOn ? new Date(s.deliveredOn).toLocaleDateString() : ""}</span>
                <span className="font-semibold whitespace-nowrap">{money(s.codAmount, s.codCurrency ?? "USD")}</span>
              </label>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-semibold text-gray-500">COD total</label><div className="h-10 flex items-center text-lg font-bold text-gray-900">{money(total)}</div></div>
          <div><label className="text-xs font-semibold text-gray-500">Net received</label><input type="number" step="0.01" min="0" value={net} onChange={(e) => { setNetTouched(true); setNet(e.target.value); }} className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-gray-500">Aramex fees</label><input type="number" step="0.01" min="0" value={fees} onChange={(e) => { setNetTouched(true); setFees(e.target.value); setNet(Math.max(0, total - (Number(e.target.value) || 0)).toFixed(2)); }} className={inputCls} /></div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Received into</label>
            <select value={into} onChange={(e) => setInto(e.target.value as "cash" | "bank")} className={inputCls}>
              <option value="cash">Cash on hand</option>
              <option value="bank">Bank (1050)</option>
            </select>
          </div>
        </div>
        <div><label className="text-xs font-semibold text-gray-500">Reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Aramex remittance / transfer ref" className={inputCls} /></div>
        {result && (
          <div className={`rounded-lg px-3 py-2 text-sm ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
            {result.success
              ? <>✓ Settled {result.shipmentsSettled} shipment{result.shipmentsSettled === 1 ? "" : "s"} — COD {money(result.codTotal)}, net {money(result.netReceived)}, fees {money(result.fees)}. Journal entry <b>#{result.journalEntryId ?? "—"}</b>.</>
              : <>✗ {result.error ?? "Failed"}</>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium">{result?.success ? "Close" : "Cancel"}</button>
          {!result?.success && <button onClick={submit} disabled={busy || selected.size === 0} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy ? "Settling…" : `Settle ${money(total)}`}</button>}
        </div>
      </div>
    </Modal>
  );
}

// ── Shipments table ──────────────────────────────────────────────────────
type Chip = { key: string; label: string; status: ShipmentFilterStatus };
const CHIPS: Chip[] = [
  { key: "all", label: "All", status: "" },
  { key: "open", label: "Open", status: "open" },
  { key: "unsettled", label: "Delivered · unsettled", status: "unsettled" },
  { key: "returned", label: "Returned", status: "Returned" },
  { key: "failed", label: "Failed", status: "Failed" },
];

function ShipmentRow({ s, onChanged }: { s: Shipment; onChanged: (updated?: Shipment) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<Shipment>) => {
    setBusy(true); setErr(null);
    try { onChanged(await fn()); }
    catch (e: unknown) {
      setErr(apiErrorMessage(e, "Failed"));
      const sh = (e as { response?: { data?: { shipment?: Shipment | null } } })?.response?.data?.shipment;
      if (sh) onChanged(sh);
    } finally { setBusy(false); }
  };
  const terminal = s.status === "Delivered" || s.status === "Returned" || s.status === "Cancelled" || s.status === "Failed";
  const isCod = s.paymentMode === "COD" || s.codAmount > 0;
  const act = "text-xs px-2 h-7 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap";

  return (
    <>
      <tr className={`hover:bg-indigo-50/30 ${open ? "bg-indigo-50/20" : ""}`}>
        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 text-xs">
          <button onClick={() => setOpen(!open)} className="mr-1 text-gray-400" title="Events">{open ? "▾" : "▸"}</button>
          {new Date(s.createdOn).toLocaleString()}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-gray-900">{s.orderCode}</td>
        <td className="px-3 py-2.5">
          <div className="text-gray-900">{s.customerName || "—"}</div>
          <div className="text-[11px] text-gray-400">{[s.city, s.customerPhone].filter(Boolean).join(" · ")}</div>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          {s.awbNumber ? (
            s.trackingUrl ? <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-600 underline">{s.awbNumber}</a> : <span className="font-mono text-xs">{s.awbNumber}</span>
          ) : <span className="text-xs text-gray-400">no AWB</span>}
          {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer" className="ml-2 text-[11px] text-indigo-600">label ↗</a>}
        </td>
        <td className="px-3 py-2.5">
          <StatusPill s={s.status} />
          {s.error && <div className="text-[10px] text-red-500 mt-0.5 max-w-[180px] truncate" title={s.error}>{s.error}</div>}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          {isCod ? <>
            <span className="font-semibold text-gray-900">{money(s.codAmount, s.codCurrency ?? "USD")}</span>
            {s.settledOn ? <span className="ml-1 text-green-600" title={`Settled ${fmtDt(s.settledOn)}${s.settlementJournalEntryId ? ` · JE #${s.settlementJournalEntryId}` : ""}`}>✓</span>
              : s.status === "Delivered" ? <span className="ml-1 text-[10px] text-amber-600">unsettled</span> : null}
          </> : <span className="text-xs text-gray-400">{s.paymentMode === "Online" ? "paid online" : "—"}</span>}
        </td>
        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[220px]">
          <div className="truncate" title={s.lastTrackingText ?? ""}>{s.lastTrackingText || "—"}</div>
          {s.lastTrackingAt && <div className="text-[10px] text-gray-400">{fmtDt(s.lastTrackingAt)}</div>}
        </td>
        <td className="px-3 py-2.5">
          {s.environment === "sandbox" && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">sandbox</span>}
          {s.environment === "production" && <span className="text-[10px] px-1 rounded bg-emerald-100 text-emerald-700">live</span>}
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <div className="flex gap-1 justify-end">
            {!terminal && <button disabled={busy} onClick={() => run(() => refreshShipmentAdmin(s.id))} className={act} title="Refresh tracking">↻</button>}
            {!terminal && <button disabled={busy} onClick={() => { if (confirm(`Mark ${s.orderCode} as delivered?${isCod ? ` This closes the invoice and books ${money(s.codAmount)} COD as an Aramex receivable.` : ""}`)) run(() => markDeliveredAdmin(s.id)); }} className={`${act} text-green-700 border-green-200`}>Delivered</button>}
            {!terminal && <button disabled={busy} onClick={() => { const r = prompt("Reason for return?"); if (r !== null) run(() => setShipmentStatusAdmin(s.id, "Returned", r)); }} className={`${act} text-purple-700 border-purple-200`}>Returned</button>}
            {!terminal && <button disabled={busy} onClick={() => { const r = prompt("Reason for cancelling?"); if (r !== null) run(() => setShipmentStatusAdmin(s.id, "Cancelled", r)); }} className={`${act} text-red-600 border-red-200`}>Cancel</button>}
            {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer" className={`${act} leading-7`}>Label</a>}
          </div>
          {err && <div className="text-[10px] text-red-600 mt-1 max-w-[220px] text-right">{err}</div>}
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/60">
          <td colSpan={9} className="px-6 py-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
              <div className="lg:col-span-2">
                <div className="text-[11px] font-semibold uppercase text-gray-500 mb-1">Tracking events</div>
                {s.events.length === 0 ? <div className="text-gray-400">No events yet{s.lastPolledAt ? ` · last polled ${fmtDt(s.lastPolledAt)}` : ""}.</div> : (
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white max-h-56 overflow-y-auto">
                    {s.events.map((e) => (
                      <div key={e.id} className="px-3 py-1.5 flex items-start justify-between gap-3">
                        <div>
                          <span className="font-semibold text-gray-800">{e.code ? `${e.code} · ` : ""}{e.description || "—"}</span>
                          {e.location && <span className="text-gray-500"> · {e.location}</span>}
                          {e.comments && <div className="text-gray-500">{e.comments}</div>}
                        </div>
                        <span className="text-gray-400 whitespace-nowrap">{fmtDt(e.eventAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1 text-gray-600">
                <div><span className="text-gray-400">Provider</span> {s.provider} · {s.environment}</div>
                <div><span className="text-gray-400">Weight / pieces</span> {s.weightKg} kg · {s.pieces}</div>
                <div><span className="text-gray-400">Order</span> {s.orderCode} · {s.orderStatus ?? "—"} · {money(s.orderTotal)} · {s.paymentMode ?? "—"}</div>
                {s.pickupId && <div><span className="text-gray-400">Pickup</span> {s.pickupId}</div>}
                {s.deliveredOn && <div><span className="text-gray-400">Delivered</span> {fmtDt(s.deliveredOn)}</div>}
                {s.settledOn && <div><span className="text-gray-400">Settled</span> {fmtDt(s.settledOn)}{s.settlementJournalEntryId ? ` · JE #${s.settlementJournalEntryId}` : ""}</div>}
                {s.lastPolledAt && <div><span className="text-gray-400">Last polled</span> {fmtDt(s.lastPolledAt)}</div>}
                {s.error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-2 py-1 mt-1 break-words">{s.error}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function Shipments() {
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);
  const [list, setList] = useState<ShipmentList | null>(null);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pickupOpen, setPickupOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSettings = useCallback(async () => {
    try { setSettings(await getShippingSettings()); setSettingsErr(null); }
    catch (e: unknown) { setSettingsErr(apiErrorMessage(e, "Could not load shipping settings.")); }
  }, []);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = CHIPS.find((c) => c.key === chip)?.status ?? "";
      setList(await listShipments({ status, from: from || undefined, to: to || undefined, search: search || undefined }));
    } catch (e: unknown) { setToast({ ok: false, text: apiErrorMessage(e, "Could not load shipments.") }); }
    finally { setLoading(false); }
  }, [chip, from, to, search]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const patchRow = (updated?: Shipment) => {
    if (!updated) { load(); return; }
    setList((l) => l ? { ...l, shipments: l.shipments.map((s) => (s.id === updated.id ? updated : s)) } : l);
    load();
  };

  const poll = async () => {
    setPolling(true);
    try { const r = await pollShipments(); setToast({ ok: true, text: `Polled Aramex — ${r.changed} shipment${r.changed === 1 ? "" : "s"} changed.` }); await load(); }
    catch (e: unknown) { setToast({ ok: false, text: apiErrorMessage(e, "Poll failed.") }); }
    finally { setPolling(false); }
  };

  // Candidates for settlement come from the current list when it already
  // shows delivered-unsettled COD rows; otherwise we fetch that filter.
  const [settleCandidates, setSettleCandidates] = useState<Shipment[]>([]);
  const openSettle = async () => {
    try {
      const r = await listShipments({ status: "unsettled" });
      setSettleCandidates(r.shipments.filter((s) => s.codAmount > 0 && !s.settledOn));
    } catch (e: unknown) { setToast({ ok: false, text: apiErrorMessage(e, "Could not load unsettled shipments.") }); return; }
    setSettleOpen(true);
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shipping & Aramex</h1>
          <p className="text-sm text-gray-500 mt-0.5">Delivery switches, zones, the shipper address, every Aramex shipment with live tracking, courier pickups and COD settlement.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={poll} disabled={polling} className={btnSecondary}>{polling ? "Polling…" : "↻ Poll Aramex now"}</button>
          <button onClick={() => setPickupOpen(true)} className={btnSecondary}>🚚 Book courier pickup</button>
          <button onClick={openSettle} className={btnPrimary}>💵 Settle COD</button>
        </div>
      </div>

      {toast && <div className={`rounded-xl px-4 py-2 text-sm ${toast.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{toast.text}</div>}
      {settingsErr && <div className="rounded-xl px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200">{settingsErr}</div>}

      <HeaderCards settings={settings} list={list} onReloadSettings={loadSettings} />
      <ShopSwitches settings={settings} onReload={loadSettings} />
      <ShipperProfile settings={settings} onReload={loadSettings} />
      <ZonesTable />

      {/* Shipments */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 mr-2">Shipments</h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {CHIPS.map((c) => (
              <button key={c.key} onClick={() => setChip(c.key)} className={`px-3 h-9 text-xs font-medium ${chip === c.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>{c.label}</button>
            ))}
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-xs text-gray-700" title="From" />
          <span className="text-xs text-gray-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-gray-200 px-2 text-xs text-gray-700" title="To" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 AWB, order code, name, phone, city…" className="h-9 flex-1 min-w-[200px] rounded-lg border border-gray-200 px-3 text-sm" />
          <button onClick={load} className="h-9 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">↻</button>
        </div>
        {loading && !list ? <div className="py-12 flex justify-center"><Loader /></div> : !list || list.shipments.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No shipments for these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-left px-3 py-2">Order</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">AWB</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">COD</th>
                  <th className="text-left px-3 py-2">Last tracking</th>
                  <th className="text-left px-3 py-2">Env</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.shipments.map((s) => <ShipmentRow key={s.id} s={s} onChanged={patchRow} />)}
              </tbody>
            </table>
          </div>
        )}
        {list && list.shipments.length > 0 && <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">{list.shipments.length} shipment{list.shipments.length === 1 ? "" : "s"}</div>}
      </section>

      <PickupModal open={pickupOpen} onClose={() => setPickupOpen(false)} onBooked={load} />
      <SettleCodModal open={settleOpen} onClose={() => setSettleOpen(false)} candidates={settleCandidates} onSettled={() => { load(); }} />
    </div>
  );
}

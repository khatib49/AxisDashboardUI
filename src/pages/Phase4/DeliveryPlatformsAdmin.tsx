import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, ItemPicker, Notice, btnDanger, btnGhost, btnPrimary, inputCls, money, td, th } from "../../components/phase4/ui";
import {
  createDeliveryPlatform, deleteDeliveryPlatform, deletePlatformMapping, listDeliveryPlatforms, listPlatformMappings, listPlatformPushes,
  previewPlatformMenu, retryPlatformPush, runPlatformPushes, testPlatformCallback, updateDeliveryPlatform, upsertPlatformMapping,
  type DeliveryItemMappingDto, type DeliveryMenuFeedDto, type DeliveryPlatformDto, type DeliveryPlatformPushDto, type DeliveryPlatformUpsertDto,
} from "../../services/phase4Service";

const EMPTY: DeliveryPlatformUpsertDto = { source: "", displayName: "", isActive: true, statusCallbackUrl: "", priceMarkupPercent: 0, autoAccept: false, mappedItemsOnly: false };
const apiBase = () => {
  const b = (import.meta.env.VITE_API_BASE_URL as string) || "/api";
  return /^https?:/i.test(b) ? b.replace(/\/api\/?$/, "") : window.location.origin;
};

/** Admin: connect delivery apps (Toters etc.), map their item ids, watch status updates. */
export default function DeliveryPlatformsAdmin() {
  const [platforms, setPlatforms] = useState<DeliveryPlatformDto[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<DeliveryPlatformUpsertDto & { id?: number }>(EMPTY);
  const [mappings, setMappings] = useState<DeliveryItemMappingDto[]>([]);
  const [pushes, setPushes] = useState<DeliveryPlatformPushDto[]>([]);
  const [feed, setFeed] = useState<DeliveryMenuFeedDto | null>(null);
  const [map, setMap] = useState<{ item: { id: number; name: string } | null; ext: string; price: string; available: boolean }>({ item: null, ext: "", price: "", available: true });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const reload = () => listDeliveryPlatforms().then((l) => { setPlatforms(l); setSelected((s) => s ?? l[0]?.id ?? null); }).catch(fail);
  useEffect(() => { void reload(); }, []);
  const current = platforms.find((p) => p.id === selected) ?? null;
  const reloadDetail = (id: number) => Promise.all([listPlatformMappings(id).then(setMappings), listPlatformPushes(id).then(setPushes)]).catch(fail);
  useEffect(() => { setFeed(null); if (selected) void reloadDetail(selected); else { setMappings([]); setPushes([]); } }, [selected]);

  async function save() {
    setBusy(true); setNotice(null);
    const dto = { ...form, statusCallbackUrl: form.statusCallbackUrl?.trim() || null };
    try {
      const r = form.id ? await updateDeliveryPlatform(form.id, dto) : await createDeliveryPlatform(dto);
      setNotice({ kind: "ok", text: form.id ? "Saved." : `${r.displayName} connected. Set its shared secret in Integrations as ${secretKey(r.source)}.` });
      setForm(EMPTY); await reload(); setSelected(r.id);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function saveMapping() {
    if (!current || !map.item) return;
    setBusy(true);
    try {
      await upsertPlatformMapping(current.id, { externalItemId: map.ext.trim(), itemId: map.item.id, priceOverride: map.price.trim() ? Number(map.price) : null, isAvailable: map.available });
      setMap({ item: null, ext: "", price: "", available: true }); await reloadDetail(current.id); await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function act(fn: () => Promise<unknown>, ok?: (r: unknown) => string) {
    setBusy(true);
    try { const r = await fn(); if (ok) setNotice({ kind: "info", text: ok(r) }); if (current) await reloadDetail(current.id); await reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  }

  const secretKey = (s: string) => `Delivery.WebhookSecret.${s}`;
  const chk = "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300";
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Delivery Apps | Axis" description="Connected delivery apps" />
      <PageBreadcrumb pageTitle="Delivery Apps" />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={form.id ? "Edit app" : "Connect an app"}>
          <div className="space-y-3">
            <label className="block text-xs text-gray-600 dark:text-gray-400">Source name (in the URLs)
              <input className={`${inputCls} mt-1`} placeholder="toters" value={form.source} disabled={!!form.id} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value.toLowerCase() }))} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">Display name
              <input className={`${inputCls} mt-1`} placeholder="Toters" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">App status callback URL (optional)
              <input className={`${inputCls} mt-1`} placeholder="https://partner.app.com/axis/status" value={form.statusCallbackUrl ?? ""} onChange={(e) => setForm((f) => ({ ...f, statusCallbackUrl: e.target.value }))} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">Menu price markup %
              <input type="number" min={0} max={100} className={`${inputCls} mt-1 w-28`} value={form.priceMarkupPercent} onChange={(e) => setForm((f) => ({ ...f, priceMarkupPercent: Number(e.target.value) || 0 }))} />
            </label>
            <label className={chk}><input type="checkbox" checked={form.autoAccept} onChange={(e) => setForm((f) => ({ ...f, autoAccept: e.target.checked }))} /> Accept new orders automatically</label>
            <label className={chk}><input type="checkbox" checked={form.mappedItemsOnly} onChange={(e) => setForm((f) => ({ ...f, mappedItemsOnly: e.target.checked }))} /> Only send mapped items in the menu</label>
            <label className={chk}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active</label>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy || !form.source.trim() || !form.displayName.trim()} onClick={() => void save()}>{form.id ? "Save" : "Connect"}</button>
              {form.id && <button type="button" className={btnGhost} onClick={() => setForm(EMPTY)}>Cancel</button>}
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {platforms.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setSelected(p.id)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${p.id === selected ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 dark:border-gray-800"} text-gray-800 dark:text-white/90`}>
                  <span className="font-medium">{p.displayName}</span> <span className="text-gray-500 dark:text-gray-400">· {p.mappedItems} mapped{p.failedPushes ? ` · ${p.failedPushes} failed updates` : ""}{p.isActive ? "" : " · inactive"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!current ? <Card><p className="text-sm text-gray-500 dark:text-gray-400">Connect a delivery app to see its setup.</p></Card> : (
            <>
              <Card title={`${current.displayName} setup`} actions={
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => setForm({ ...current, statusCallbackUrl: current.statusCallbackUrl ?? "", id: current.id })}>Edit</button>
                  <button type="button" className={btnDanger} onClick={() => { if (window.confirm(`Disconnect ${current.displayName}? Orders already received stay.`)) void act(() => deleteDeliveryPlatform(current.id)).then(() => setSelected(null)); }}>Disconnect</button>
                </div>}>
                {!current.secretConfigured && <Notice kind="error" text={`No shared secret yet. Add ${secretKey(current.source)} in Admin → Integrations and give the same value to the app.`} />}
                <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-gray-500 dark:text-gray-400">Orders webhook</dt><dd className="break-all font-mono text-xs text-gray-800 dark:text-white/90">POST {apiBase()}{current.webhookPath}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Menu feed</dt><dd className="break-all font-mono text-xs text-gray-800 dark:text-white/90">GET {apiBase()}{current.menuFeedPath}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Auth header</dt><dd className="font-mono text-xs text-gray-800 dark:text-white/90">X-Webhook-Secret: value of {secretKey(current.source)}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Status updates</dt><dd className="text-gray-800 dark:text-white/90">{current.statusCallbackUrl ? <>Signed with X-Axis-Signature (HMAC SHA-256 of the body) to <span className="break-all font-mono text-xs">{current.statusCallbackUrl}</span></> : "Off. Add a callback URL to send them."}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">New orders</dt><dd className="text-gray-800 dark:text-white/90">{current.autoAccept ? "Accepted automatically" : "Wait for the kitchen to accept"} · markup {current.priceMarkupPercent}%</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} disabled={busy} onClick={() => void previewPlatformMenu(current.id).then(setFeed).catch(fail)}>Preview menu feed</button>
                  <button type="button" className={btnGhost} disabled={busy || !current.statusCallbackUrl} onClick={() => void act(() => testPlatformCallback(current.id), (r) => (r as { message: string }).message)}>Test callback</button>
                </div>
                {feed && (
                  <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full"><thead><tr><th className={th}>Category</th><th className={th}>App id</th><th className={th}>Item</th><th className={th}>Price</th><th className={th}>Available</th></tr></thead>
                      <tbody>{feed.categories.flatMap((c) => c.items.map((i) => <tr key={i.externalId}><td className={td}>{c.name}</td><td className={`${td} font-mono text-xs`}>{i.externalId}</td><td className={td}>{i.name}</td><td className={td}>{money(i.price)}</td><td className={td}>{i.available ? "Yes" : "No"}</td></tr>))}</tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Item mapping">
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Map each app item id to an Axis item. Unmapped items still work with the id axis-&lt;item number&gt; from the menu feed.</p>
                <div className="grid items-end gap-2 sm:grid-cols-[1fr_10rem_7rem_auto_auto]">
                  <ItemPicker label="Axis item" value={map.item} onChange={(v) => setMap((m) => ({ ...m, item: v }))} />
                  <label className="text-xs text-gray-600 dark:text-gray-400">App item id<input className={`${inputCls} mt-1`} value={map.ext} onChange={(e) => setMap((m) => ({ ...m, ext: e.target.value }))} /></label>
                  <label className="text-xs text-gray-600 dark:text-gray-400">App price<input className={`${inputCls} mt-1`} inputMode="decimal" placeholder="auto" value={map.price} onChange={(e) => setMap((m) => ({ ...m, price: e.target.value }))} /></label>
                  <label className={`${chk} pb-2`}><input type="checkbox" checked={map.available} onChange={(e) => setMap((m) => ({ ...m, available: e.target.checked }))} /> Available</label>
                  <button type="button" className={btnPrimary} disabled={busy || !map.item || !map.ext.trim()} onClick={() => void saveMapping()}>Save</button>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full"><thead><tr><th className={th}>App id</th><th className={th}>Axis item</th><th className={th}>Price</th><th className={th}>Available</th><th className={th}></th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {mappings.length === 0 && <tr><td className={td} colSpan={5}>No mappings yet.</td></tr>}
                      {mappings.map((m) => (
                        <tr key={m.id}>
                          <td className={`${td} font-mono text-xs`}>{m.externalItemId}</td><td className={td}>{m.itemName}</td>
                          <td className={td}>{m.priceOverride != null ? money(m.priceOverride) : `auto (${money(m.itemPrice)} + markup)`}</td>
                          <td className={td}>{m.isAvailable ? "Yes" : "No"}</td>
                          <td className={td}><button type="button" className={btnDanger} onClick={() => void act(() => deletePlatformMapping(current.id, m.id))}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Status updates sent to the app" actions={<button type="button" className={btnGhost} disabled={busy} onClick={() => void act(() => runPlatformPushes(), (r) => { const x = r as { sent: number; retrying: number; failed: number }; return `Sent ${x.sent}, retrying ${x.retrying}, failed ${x.failed}.`; })}>Send now</button>}>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full"><thead><tr><th className={th}>Order</th><th className={th}>Status</th><th className={th}>State</th><th className={th}>Tries</th><th className={th}>Last answer</th><th className={th}></th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pushes.length === 0 && <tr><td className={td} colSpan={6}>No updates yet.</td></tr>}
                      {pushes.map((x) => (
                        <tr key={x.id}>
                          <td className={td}>{x.externalRef}<span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(x.createdOn).toLocaleString()}</span></td>
                          <td className={td}>{x.platformStatus}</td>
                          <td className={td}><span className={x.state === "Sent" ? "text-green-600" : x.state === "Failed" ? "text-red-600" : "text-amber-600"}>{x.state}</span></td>
                          <td className={td}>{x.attempts}</td>
                          <td className={`${td} max-w-xs truncate`} title={x.lastError ?? ""}>{x.lastHttpStatus ? `HTTP ${x.lastHttpStatus}` : ""} {x.lastError ?? ""}</td>
                          <td className={td}>{x.state === "Failed" && <button type="button" className={btnGhost} onClick={() => void act(() => retryPlatformPush(current.id, x.id))}>Retry</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getItems, ItemDto } from "../../services/itemService";
import { getCategoriesByType, CategoryDto } from "../../services/categoryService";
import {
  ChannelDto,
  createDeliveryOrder,
  DeliveryOrderType,
  DeliveryZoneDto,
  getChannels,
  getZones,
} from "../../services/deliveryService";

const money = (n: number) => n.toFixed(2);
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Request failed";

type CartLine = { item: ItemDto; qty: number };

export default function NewDeliveryOrder() {
  const navigate = useNavigate();
  const [type, setType] = useState<DeliveryOrderType>("Delivery");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");

  const [zones, setZones] = useState<DeliveryZoneDto[]>([]);
  const [channels, setChannels] = useState<ChannelDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<ItemDto[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ variant: "success" | "error" | "warning" | "info"; title: string; message: string } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    getZones().then((z) => mounted && setZones(z)).catch(() => undefined);
    getChannels().then((c) => mounted && setChannels(c.filter((x) => x.isActive))).catch(() => undefined);
    getCategoriesByType("item", 1, 100).then((r) => mounted && setCategories(r.data || [])).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingItems(true);
    getItems(1, 60, selectedCategory, debounced)
      .then((r) => {
        if (!mounted) return;
        setItems((r.data || []).filter((i) => i.statusId === 1 || i.statusId == null));
        setItemsError(null);
      })
      .catch((e) => mounted && setItemsError(errMsg(e)))
      .finally(() => mounted && setLoadingItems(false));
    return () => { mounted = false; };
  }, [selectedCategory, debounced]);

  const zone = useMemo(() => zones.find((z) => z.id === zoneId) ?? null, [zones, zoneId]);
  const lines = useMemo(() => Object.values(cart), [cart]);
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.item.price * l.qty, 0), [lines]);
  const fee = type === "Delivery" && zone ? zone.fee : 0;
  const belowMin = type === "Delivery" && zone != null && subtotal < zone.minOrder;

  const add = (item: ItemDto) =>
    setCart((c) => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty ?? 0) + 1 } }));
  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id]; else next[id] = { ...next[id], qty };
      return next;
    });

  const canSubmit =
    customerName.trim().length > 0 &&
    lines.length > 0 &&
    !belowMin &&
    (type === "Takeaway" || address.trim().length > 0) &&
    !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const order = await createDeliveryOrder({
        type,
        customerName: customerName.trim(),
        phone: phone.trim() || null,
        address: type === "Delivery" ? address.trim() : null,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ itemId: Number(l.item.id), quantity: l.qty })),
        zoneId: type === "Delivery" ? zoneId : null,
        channelId,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      });
      setNotification({ variant: "success", title: "Order created", message: `#${order.id} on invoice #${order.transactionId} — total ${money(order.total)}` });
      setCart({});
      setTimeout(() => navigate("/delivery/board"), 800);
    } catch (e) {
      setNotification({ variant: "error", title: "Could not create the order", message: errMsg(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-4 text-sm dark:bg-gray-900 dark:text-white/90";

  return (
    <div>
      <PageMeta title="New delivery order | Axis" description="Create a delivery or takeaway order" />
      <PageBreadcrumb pageTitle="New delivery / takeaway order" />
      {notification && <div className="mb-4"><Alert variant={notification.variant} title={notification.title} message={notification.message} /></div>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Customer */}
        <div className="lg:col-span-2 space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 text-gray-800 dark:text-white/90">
          <div className="flex gap-2">
            {(["Delivery", "Takeaway"] as DeliveryOrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${type === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="cust">Customer name *</Label>
            <Input id="cust" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="70 123 456" />
          </div>
          {type === "Delivery" && (
            <>
              <div>
                <Label htmlFor="zone">Zone</Label>
                <select id="zone" className={inputCls} value={zoneId ?? ""} onChange={(e) => setZoneId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">No zone (no fee)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name} — fee {money(z.fee)}, min {money(z.minOrder)}, ~{z.etaMinutes} min</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="addr">Address *</Label>
                <textarea id="addr" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={`${inputCls} h-auto py-2`} placeholder="Street, building, floor" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="channel">Sales channel</Label>
            <select id="channel" className={inputCls} value={channelId ?? ""} onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Direct (phone / walk-in)</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="sched">Scheduled for (optional)</Label>
            <input id="sched" type="datetime-local" className={inputCls} value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} h-auto py-2`} placeholder="Ring the bell, no onions…" />
          </div>
        </div>

        {/* Items */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 text-gray-800 dark:text-white/90">
            <div className="flex flex-wrap gap-2 mb-3">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="max-w-xs" />
              <select className={`${inputCls} max-w-xs`} value={selectedCategory ?? ""} onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {itemsError && <Alert variant="error" title="Items" message={itemsError} />}
            {loadingItems ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-4"><Loader /> Loading items…</div>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">No items found.</p>
            ) : (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 max-h-[420px] overflow-auto">
                {items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => add(it)}
                    className="text-left rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 text-gray-700 dark:text-gray-300"
                  >
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90 line-clamp-2">{it.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{money(it.price)}{cart[it.id] ? ` · in cart ×${cart[it.id].qty}` : ""}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] p-4 text-gray-800 dark:text-white/90">
            <h3 className="font-semibold text-gray-800 dark:text-white/90 mb-2">Cart</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Tap items above to add them.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.item.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-1.5 text-gray-800 dark:text-white/90">{l.item.name}</td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setQty(l.item.id, l.qty - 1)} className="w-7 h-7 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">−</button>
                          <span className="w-8 text-center">{l.qty}</span>
                          <button onClick={() => setQty(l.item.id, l.qty + 1)} className="w-7 h-7 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">+</button>
                        </div>
                      </td>
                      <td className="py-1.5 text-right w-24">{money(l.item.price * l.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              {type === "Delivery" && <div className="flex justify-between"><span>Delivery fee{zone ? ` (${zone.name})` : ""}</span><span>{money(fee)}</span></div>}
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{money(subtotal + fee)}</span></div>
              {belowMin && zone && (
                <div className="text-xs text-red-600">Minimum order for {zone.name} is {money(zone.minOrder)}.</div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">The fee is tracked on the delivery order; the invoice carries the items only.</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => navigate("/delivery/board")} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">Back to board</button>
              <button onClick={submit} disabled={!canSubmit} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? "Creating…" : "Create open invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { getKioskMenu, KioskOrderResultDto, placeKioskOrder } from "../../services/kioskService";
import type { MenuItemDto, PublicMenuDto } from "../../services/selfOrderService";
import WhishPayPanel from "../SelfOrder/WhishPayPanel";

const RESET_SECONDS = 20;
const money = (n: number) => n.toFixed(2);
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

/** Public, layout-less kiosk screen: /kiosk?token=… (token issued per device by the admin). */
export default function KioskPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [menu, setMenu] = useState<PublicMenuDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, { item: MenuItemDto; qty: number }>>({});
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<KioskOrderResultDto | null>(null);
  const [countdown, setCountdown] = useState(RESET_SECONDS);
  const [toast, setToast] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidOnline, setPaidOnline] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!token) { setError("No kiosk token in the URL. Ask an admin for this device's link."); setLoading(false); return; }
    setLoading(true);
    getKioskMenu(token)
      .then((m) => { if (!mounted.current) return; setMenu(m); setCategory(m.categories[0]?.id ?? null); setError(null); })
      .catch((e) => mounted.current && setError(errMsg(e)))
      .finally(() => mounted.current && setLoading(false));
    return () => { mounted.current = false; };
  }, [token]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Order-number screen auto-resets for the next customer.
  useEffect(() => {
    if (!done || paying) return;
    setCountdown(RESET_SECONDS);
    const t = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(t); setDone(null); setPaidOnline(false); return RESET_SECONDS; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [done, paying]);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const setQty = (item: MenuItemDto, qty: number) =>
    setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[item.id]; else n[item.id] = { item, qty }; return n; });

  const submit = async () => {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await placeKioskOrder(token, lines.map((l) => ({ itemId: l.item.id, quantity: l.qty })), name.trim() || null, null);
      setDone(r);
      setCart({});
      setName("");
    } catch (e) {
      setToast(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-blue-600 text-white flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="text-2xl mb-4">Thank you{done.deviceName ? "" : ""}! Your order number is</div>
        <div className="text-[140px] leading-none font-black tracking-tight">{done.orderNumber}</div>
        <div className="text-2xl mt-6">{paidOnline ? "Paid online: " : "Total to pay at the counter: "}<span className="font-bold">{money(done.total)}</span></div>
        <div className="text-lg mt-2 opacity-80">{paidOnline ? "Please wait for your number." : "Please pay at the counter and wait for your number."}</div>
        {token && done.transactionId > 0 && !paidOnline && (
          <div className="mt-8 w-full max-w-xl text-left text-gray-900">
            <WhishPayPanel
              token={token}
              transactionId={done.transactionId}
              amount={done.total}
              size="kiosk"
              returnUrl={`${window.location.origin}/kiosk?token=${encodeURIComponent(token)}`}
              onActiveChange={setPaying}
              onPaid={() => { setPaidOnline(true); setPaying(false); }}
            />
          </div>
        )}
        {paidOnline && <div className="mt-6 rounded-2xl bg-white/15 px-6 py-4 text-xl">Receipt: order {done.orderNumber} · invoice #{done.transactionId} · {money(done.total)} · paid with Whish</div>}
        <button onClick={() => { setDone(null); setPaidOnline(false); }} className="mt-10 px-8 py-4 rounded-2xl bg-white text-blue-700 text-xl font-semibold">
          New order{paying ? "" : ` (${countdown})`}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white/90 select-none flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order here</h1>
        <div className="text-sm text-gray-500">{menu?.tableLabel ?? "Kiosk"}</div>
      </header>
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-xl bg-gray-900 text-white text-lg shadow-lg">{toast}</div>}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xl text-gray-500">Loading menu…</div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-xl font-medium">{error}</p>
          <p className="text-gray-500 mt-2">This kiosk is not available. Please order at the counter.</p>
        </div>
      ) : menu && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0">
          <div className="flex min-h-0">
            <aside className="w-44 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-auto">
              {menu.categories.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.id)} className={`block w-full text-left px-4 py-5 text-lg font-medium border-b border-gray-100 dark:border-gray-800 ${category === c.id ? "bg-blue-600 text-white" : ""}`}>
                  {c.name}
                </button>
              ))}
            </aside>
            <main className="flex-1 overflow-auto p-4 grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 content-start">
              {menu.categories.length === 0 && <p className="col-span-full text-center text-gray-500 py-10 text-xl">The menu is empty.</p>}
              {(menu.categories.find((c) => c.id === category)?.items ?? []).map((it) => {
                const qty = cart[it.id]?.qty ?? 0;
                return (
                  <button
                    key={it.id}
                    onClick={() => setQty(it, qty + 1)}
                    className={`relative rounded-2xl bg-white dark:bg-gray-900 border-2 p-4 text-left min-h-[170px] flex flex-col active:scale-95 transition ${qty > 0 ? "border-blue-600" : "border-transparent"}`}
                  >
                    {it.imagePath ? <img src={it.imagePath} alt="" className="w-full h-24 object-cover rounded-xl mb-2 bg-gray-100" /> : <div className="w-full h-24 rounded-xl bg-gray-100 dark:bg-gray-800 mb-2" />}
                    <div className="font-semibold text-lg leading-tight">{it.name}</div>
                    <div className="text-gray-500 mt-auto">{money(it.price)}</div>
                    {qty > 0 && <span className="absolute top-3 right-3 w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">{qty}</span>}
                  </button>
                );
              })}
            </main>
          </div>

          <aside className="bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 text-xl font-semibold">Your order</div>
            <div className="flex-1 overflow-auto px-5">
              {lines.length === 0 ? <p className="text-gray-500 py-8 text-center text-lg">Tap items to add them</p> : lines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{l.item.name}</div><div className="text-sm text-gray-500">{money(l.item.price * l.qty)}</div></div>
                  <button onClick={() => setQty(l.item, l.qty - 1)} className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 text-2xl">−</button>
                  <span className="w-6 text-center text-lg font-semibold">{l.qty}</span>
                  <button onClick={() => setQty(l.item, l.qty + 1)} className="w-11 h-11 rounded-xl bg-blue-600 text-white text-2xl">+</button>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full h-12 rounded-xl border border-gray-300 dark:border-gray-700 px-4 text-lg dark:bg-gray-800" />
              <div className="flex justify-between text-2xl font-bold"><span>Total</span><span>{money(total)}</span></div>
              <button disabled={count === 0 || submitting} onClick={submit} className="w-full py-5 rounded-2xl bg-blue-600 text-white text-2xl font-bold disabled:opacity-40 active:scale-95 transition">
                {submitting ? "Placing order…" : `Place order (${count})`}
              </button>
              {count > 0 && <button onClick={() => setCart({})} className="w-full py-2 text-gray-500">Clear</button>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

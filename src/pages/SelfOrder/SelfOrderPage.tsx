import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  getSelfOrderMenu, getSelfOrderStatus, MenuItemDto, PublicMenuDto, SelfOrderSessionStatusDto,
  startSelfOrderSession, submitSelfOrder,
} from "../../services/selfOrderService";

const POLL_MS = 8000;
const money = (n: number) => n.toFixed(2);
const errMsg = (e: unknown) => (e as { message?: string })?.message || "Something went wrong";

function readToken(code: string): string | null {
  try { return localStorage.getItem(`selforder:${code.toUpperCase()}`); } catch { return null; }
}
function writeToken(code: string, token: string | null) {
  try {
    const k = `selforder:${code.toUpperCase()}`;
    if (token) localStorage.setItem(k, token); else localStorage.removeItem(k);
  } catch { /* storage unavailable (private mode) — session lives in memory only */ }
}

/** Public, layout-less page opened from the table QR: /order/:tableCode */
export default function SelfOrderPage() {
  const { tableCode = "" } = useParams<{ tableCode: string }>();
  const [menu, setMenu] = useState<PublicMenuDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, { item: MenuItemDto; qty: number }>>({});
  const [note, setNote] = useState("");
  const [token, setToken] = useState<string | null>(() => readToken(tableCode));
  const [status, setStatus] = useState<SelfOrderSessionStatusDto | null>(null);
  const [view, setView] = useState<"menu" | "status">("menu");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    getSelfOrderMenu(tableCode)
      .then((m) => {
        if (!mounted.current) return;
        setMenu(m);
        setCategory(m.categories[0]?.id ?? null);
        setError(null);
      })
      .catch((e) => mounted.current && setError(errMsg(e)))
      .finally(() => mounted.current && setLoading(false));
    return () => { mounted.current = false; };
  }, [tableCode]);

  const refreshStatus = useCallback(async (tok: string) => {
    try {
      const s = await getSelfOrderStatus(tok);
      if (!mounted.current) return;
      setStatus(s);
      if (s.status === "Closed") writeToken(tableCode, null);
    } catch {
      // token expired / unknown → start fresh next time
      if (!mounted.current) return;
      setToken(null);
      setStatus(null);
      writeToken(tableCode, null);
    }
  }, [tableCode]);

  // Resume an existing session and poll while it is submitted.
  useEffect(() => {
    if (!token) return;
    refreshStatus(token);
    const t = setInterval(() => refreshStatus(token), POLL_MS);
    return () => clearInterval(t);
  }, [token, refreshStatus]);

  useEffect(() => {
    if (status && status.status !== "Open" && status.items.length > 0 && Object.keys(cart).length === 0) setView("status");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status]);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const setQty = (item: MenuItemDto, qty: number) =>
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[item.id]; else n[item.id] = { item, qty };
      return n;
    });

  const submit = async () => {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      let tok = token;
      if (!tok || status?.status === "Closed") {
        const s = await startSelfOrderSession(tableCode);
        tok = s.token;
        writeToken(tableCode, tok);
        setToken(tok);
      }
      const s = await submitSelfOrder(tok, lines.map((l) => ({ itemId: l.item.id, quantity: l.qty })), note.trim() || null);
      setStatus(s);
      setCart({});
      setNote("");
      setView("status");
      setToast("Order sent to the kitchen!");
    } catch (e) {
      const msg = errMsg(e);
      setToast(msg);
      if (/closed|not found/i.test(msg)) { setToken(null); writeToken(tableCode, null); }
    } finally {
      setSubmitting(false);
    }
  };

  const closed = status?.status === "Closed" || status?.invoicePaid;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white/90 pb-28">
      <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500">Self-ordering</div>
            <h1 className="text-lg font-semibold">{menu?.tableLabel ?? `Table ${tableCode.toUpperCase()}`}</h1>
          </div>
          {status && status.items.length > 0 && (
            <div className="flex gap-1 text-sm">
              <button onClick={() => setView("menu")} className={`px-3 py-1.5 rounded-lg ${view === "menu" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>Menu</button>
              <button onClick={() => setView("status")} className={`px-3 py-1.5 rounded-lg ${view === "status" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>My order</button>
            </div>
          )}
        </div>
      </header>

      {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm shadow-lg">{toast}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading menu…</div>
      ) : error ? (
        <div className="p-8 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <p className="font-medium">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Please ask a member of staff.</p>
        </div>
      ) : view === "status" && status ? (
        <section className="p-4 max-w-lg mx-auto">
          <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Your order</h2>
              <span className={`px-2 py-0.5 text-xs rounded-full ${closed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {closed ? "Paid · closed" : status.status === "Submitted" ? "Being prepared" : status.status}
              </span>
            </div>
            {status.items.length === 0 ? <p className="text-sm text-gray-500">Nothing ordered yet.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {status.items.map((l) => (
                  <li key={l.itemId} className="flex justify-between py-2"><span>{l.quantity} × {l.itemName}</span><span>{money(l.lineTotal)}</span></li>
                ))}
              </ul>
            )}
            <div className="flex justify-between font-semibold mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"><span>Total</span><span>{money(status.total)}</span></div>
            {status.guestNote && <p className="text-xs text-gray-500 mt-2">Note: {status.guestNote}</p>}
            <p className="text-xs text-gray-500 mt-3">{closed ? "Thank you! Scan the QR again to start a new order." : "Pay at the counter when you are done. This page refreshes automatically."}</p>
          </div>
          {!closed && <button onClick={() => setView("menu")} className="mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-medium">Order more</button>}
        </section>
      ) : menu ? (
        <>
          <nav className="sticky top-[61px] z-10 bg-gray-50 dark:bg-gray-950 px-3 py-2 flex gap-2 overflow-x-auto">
            {menu.categories.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm ${category === c.id ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"}`}>
                {c.name}
              </button>
            ))}
          </nav>
          <section className="p-3 grid gap-3 grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto">
            {menu.categories.length === 0 && <p className="text-center text-gray-500 col-span-full py-8">The menu is empty right now.</p>}
            {(menu.categories.find((c) => c.id === category)?.items ?? []).map((it) => {
              const qty = cart[it.id]?.qty ?? 0;
              return (
                <div key={it.id} className={`flex items-center gap-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 ${!it.available ? "opacity-60" : ""}`}>
                  {it.imagePath ? <img src={it.imagePath} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" /> : <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-sm text-gray-500">{money(it.price)}{!it.available ? " · may be unavailable" : ""}</div>
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => setQty(it, 1)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">Add</button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(it, qty - 1)} className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-lg">−</button>
                      <span className="w-5 text-center font-semibold">{qty}</span>
                      <button onClick={() => setQty(it, qty + 1)} className="w-9 h-9 rounded-lg bg-blue-600 text-white text-lg">+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      ) : null}

      {view === "menu" && menu && !error && (
        <footer className="fixed bottom-0 inset-x-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3">
          <div className="max-w-3xl mx-auto space-y-2">
            {cartCount > 0 && (
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the kitchen (optional)" className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 px-3 text-sm dark:bg-gray-800" />
            )}
            <button
              disabled={cartCount === 0 || submitting}
              onClick={submit}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50 flex justify-between px-5"
            >
              <span>{submitting ? "Sending…" : cartCount === 0 ? "Pick something to order" : `Send order (${cartCount})`}</span>
              <span>{money(cartTotal)}</span>
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

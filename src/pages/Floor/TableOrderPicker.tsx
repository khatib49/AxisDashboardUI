import { useEffect, useMemo, useRef, useState } from "react";
import Loader from "../../components/ui/Loader";
import {
  CartLine,
  MenuCategoryDto,
  MenuItemDto,
  SendOrderResult,
  cartTotal,
  getMenuCategories,
  getMenuItems,
  lineProblem,
  lineTotal,
  newCartLine,
  sendTableOrder,
} from "../../services/waiterService";
import { errorMessage } from "../../services/floorService";

/**
 * Item picker for table service. Used as a side drawer on the desktop floor
 * and as a full-screen page in the handheld waiter mode. Every control is at
 * least 44px tall and nothing depends on hover.
 */
export type TableOrderPickerProps = {
  transactionId: number;
  guestCount: number;
  tableLabel: string;
  /** "drawer" = fixed right-hand panel (desktop); "page" = fills its container (phone). */
  mode: "drawer" | "page";
  onSent: (result: SendOrderResult) => void;
  onClose: () => void;
};

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const tap = "min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-sm font-medium transition disabled:opacity-50 select-none";
const chip = `${tap} px-3 border border-gray-300 bg-white text-gray-800 dark:bg-gray-800 dark:text-white dark:border-gray-600`;
const chipOn = `${tap} px-3 border border-blue-600 bg-blue-600 text-white`;
const stepBtn = `${tap} bg-gray-100 text-gray-900 active:bg-gray-300 dark:bg-gray-700 dark:text-white`;

function seatLabel(seat: number | null) {
  return seat === null ? "Table" : `Seat ${seat}`;
}

export default function TableOrderPicker({ transactionId, guestCount, tableLabel, mode, onSent, onClose }: TableOrderPickerProps) {
  const [categories, setCategories] = useState<MenuCategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<MenuItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seat, setSeat] = useState<number | null>(guestCount >= 1 ? 1 : null);
  const [course, setCourse] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const seats = useMemo(() => Array.from({ length: Math.max(0, Math.min(guestCount, 50)) }, (_, i) => i + 1), [guestCount]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    getMenuCategories()
      .then((c) => alive && setCategories(c))
      .catch(() => alive && setCategories([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMenuItems(categoryId, debounced || null)
      .then((list) => {
        if (!alive) return;
        setItems(list.filter((i) => (i.statusId ?? 1) === 1));
        setError(null);
      })
      .catch((err) => alive && setError(errorMessage(err, "Could not load the menu")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [categoryId, debounced]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const count = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const problems = useMemo(() => cart.map(lineProblem).filter((p): p is string => !!p), [cart]);

  function addItem(item: MenuItemDto) {
    setSendError(null);
    setCart((prev) => {
      // Same item, same seat, same course, no extras picked yet → bump the quantity.
      const existing = prev.find(
        (l) => l.item.id === item.id && l.seatNumber === seat && l.courseNumber === course && Object.keys(l.addOns).length === 0 && Object.keys(l.variants).length === 0
      );
      if (existing && !(item.variants ?? []).some((v) => v.isActive)) {
        return prev.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const line = newCartLine(item, seat, course);
      if ((item.addOns ?? []).some((a) => a.isActive) || (item.variants ?? []).some((v) => v.isActive)) setExpanded(line.key);
      return [...prev, line];
    });
  }
  function update(key: string, patch: (l: CartLine) => CartLine) {
    setCart((prev) => prev.map((l) => (l.key === key ? patch(l) : l)));
  }
  function setQty(key: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.key !== key));
      return;
    }
    update(key, (l) => ({ ...l, quantity: qty }));
  }
  function cycleSeat(key: string) {
    update(key, (l) => {
      const order: (number | null)[] = [null, ...seats];
      const idx = order.indexOf(l.seatNumber);
      return { ...l, seatNumber: order[(idx + 1) % order.length] };
    });
  }

  async function send() {
    if (cart.length === 0 || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const r = await sendTableOrder(transactionId, cart);
      if (!r.success) {
        setSendError(r.message);
        return;
      }
      setCart([]);
      setCartOpen(false);
      onSent(r);
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const shell =
    mode === "drawer"
      ? "fixed inset-y-0 right-0 z-[100000] w-full md:w-[760px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col text-gray-800 dark:text-white/90"
      : "flex flex-col h-full min-h-0 bg-white dark:bg-gray-900 text-gray-800 dark:text-white/90";

  const cartPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white">Order · {count} item{count === 1 ? "" : "s"}</span>
        {cartOpen && <button type="button" className={chip} onClick={() => setCartOpen(false)}>Back to menu</button>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-white/[0.05]">
        {cart.length === 0 && <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Tap items to add them for {seatLabel(seat)}.</p>}
        {cart.map((l) => {
          const addOns = (l.item.addOns ?? []).filter((a) => a.isActive);
          const variants = (l.item.variants ?? []).filter((v) => v.isActive);
          const hasExtras = addOns.length > 0 || variants.length > 0;
          const problem = lineProblem(l);
          const open = expanded === l.key;
          return (
            <div key={l.key} className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">{l.item.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{money(lineTotal(l))}{problem ? <span className="ml-2 text-amber-600">{problem}</span> : null}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className={stepBtn} aria-label="Less" onClick={() => setQty(l.key, l.quantity - 1)}>−</button>
                  <span className="w-8 text-center font-semibold text-gray-900 dark:text-white">{l.quantity}</span>
                  <button type="button" className={stepBtn} aria-label="More" onClick={() => setQty(l.key, l.quantity + 1)}>+</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={`${chip} !min-w-[88px]`} onClick={() => cycleSeat(l.key)} title="Tap to change the seat">
                  {seatLabel(l.seatNumber)}
                </button>
                <label className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
                  Course
                  <select
                    className="min-h-[44px] rounded-lg border border-gray-300 px-2 text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    value={l.courseNumber}
                    onChange={(e) => update(l.key, (x) => ({ ...x, courseNumber: Number(e.target.value) }))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                {hasExtras && (
                  <button type="button" className={open ? chipOn : chip} onClick={() => setExpanded(open ? null : l.key)}>
                    {open ? "Done" : "Options"}
                  </button>
                )}
                <button type="button" className={`${chip} ml-auto text-red-600 dark:text-red-400`} onClick={() => setQty(l.key, 0)} aria-label="Remove">Remove</button>
              </div>
              {open && hasExtras && (
                <div className="rounded-lg bg-gray-50 dark:bg-white/[0.03] p-2 space-y-2">
                  {addOns.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Add-ons (per unit)</div>
                      <div className="flex flex-wrap gap-2">
                        {addOns.map((a) => {
                          const q = l.addOns[a.id] ?? 0;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className={q > 0 ? chipOn : chip}
                              onClick={() => update(l.key, (x) => {
                                const next = { ...x.addOns };
                                if (q > 0) delete next[a.id]; else next[a.id] = 1;
                                return { ...x, addOns: next };
                              })}
                            >
                              {a.name} +{money(a.price)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {variants.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Options — pick {l.quantity}</div>
                      <div className="space-y-1">
                        {variants.map((v) => {
                          const q = l.variants[v.id] ?? 0;
                          return (
                            <div key={v.id} className="flex items-center gap-2">
                              <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">
                                {v.color && <i className="inline-block w-3 h-3 rounded-full mr-1 align-middle border border-gray-300 dark:border-gray-700" style={{ background: v.color }} />}
                                {v.name}{v.priceDelta ? ` (${v.priceDelta > 0 ? "+" : ""}${money(v.priceDelta)})` : ""}
                                <span className="text-xs text-gray-500 dark:text-gray-400"> · {v.quantity} in stock</span>
                              </span>
                              <button type="button" className={stepBtn} aria-label="Less" disabled={q <= 0} onClick={() => update(l.key, (x) => ({ ...x, variants: { ...x.variants, [v.id]: Math.max(0, q - 1) } }))}>−</button>
                              <span className="w-6 text-center text-sm">{q}</span>
                              <button type="button" className={stepBtn} aria-label="More" onClick={() => update(l.key, (x) => ({ ...x, variants: { ...x.variants, [v.id]: q + 1 } }))}>+</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {sendError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded p-2">{sendError}</div>}
        <div className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
          <span>Total to add</span>
          <span className="font-semibold text-lg text-gray-900 dark:text-white">{money(total)}</span>
        </div>
        <button
          type="button"
          className={`${tap} w-full h-12 bg-blue-600 text-white active:bg-blue-800 text-base`}
          disabled={sending || cart.length === 0 || problems.length > 0}
          onClick={send}
        >
          {sending ? "Sending…" : `Send to invoice #${transactionId}`}
        </button>
      </div>
    </div>
  );

  return (
    <div className={shell} role="dialog" aria-label={`Order for ${tableLabel}`}>
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-gray-900 dark:text-white truncate text-base" data-page-title>Order · {tableLabel}</h1>
          <div className="text-xs text-gray-500 dark:text-gray-400">Invoice #{transactionId} · {guestCount} guest{guestCount === 1 ? "" : "s"}</div>
        </div>
        <button type="button" className={chip} onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* seat + course selector */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Adding for</span>
        <button type="button" className={seat === null ? chipOn : chip} onClick={() => setSeat(null)}>Table</button>
        {seats.map((n) => (
          <button key={n} type="button" className={seat === n ? chipOn : chip} onClick={() => setSeat(n)}>Seat {n}</button>
        ))}
        <label className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          Course
          <select
            className="min-h-[44px] rounded-lg border border-gray-300 px-2 text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
            value={course}
            onChange={(e) => setCourse(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* menu */}
        <div className={`flex flex-col min-h-0 flex-1 ${mode === "page" && cartOpen ? "hidden" : ""}`}>
          <div className="px-3 py-2 flex items-center gap-2">
            <input
              ref={searchRef}
              className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-3 text-base bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputMode="search"
            />
            {search && <button type="button" className={chip} onClick={() => { setSearch(""); searchRef.current?.focus(); }}>Clear</button>}
          </div>
          <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
            <button type="button" className={categoryId === null ? chipOn : chip} onClick={() => setCategoryId(null)}>All</button>
            {categories.map((c) => (
              <button key={c.id} type="button" className={`${categoryId === c.id ? chipOn : chip} shrink-0`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded p-2 mb-2">{error}</div>}
            {loading && items.length === 0 && <div className="flex justify-center py-8"><Loader /></div>}
            {!loading && items.length === 0 && !error && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No items match.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((it) => {
                const inCart = cart.filter((l) => l.item.id === it.id).reduce((s, l) => s + l.quantity, 0);
                const extras = (it.addOns ?? []).some((a) => a.isActive) || (it.variants ?? []).some((v) => v.isActive);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => addItem(it)}
                    className="relative min-h-[84px] rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left active:border-blue-500 active:bg-blue-50 dark:active:bg-blue-500/10 text-gray-800 dark:text-white/90"
                  >
                    <div className="font-medium text-gray-900 dark:text-white leading-tight line-clamp-2">{it.name}</div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{money(it.price)}{extras ? <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">· options</span> : null}</div>
                    {inCart > 0 && (
                      <span className="absolute top-2 right-2 min-w-[24px] h-6 px-1 rounded-full bg-blue-600 text-white text-xs font-bold inline-flex items-center justify-center">{inCart}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {mode === "page" && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-900 text-gray-800 dark:text-white/90">
              <button type="button" className={`${tap} w-full h-12 bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-base`} onClick={() => setCartOpen(true)} disabled={cart.length === 0}>
                Review order · {count} item{count === 1 ? "" : "s"} · {money(total)}
              </button>
            </div>
          )}
        </div>

        {/* cart */}
        {mode === "drawer" && <div className="w-[340px] shrink-0 border-l border-gray-200 dark:border-gray-700 hidden md:flex flex-col min-h-0">{cartPanel}</div>}
        {mode === "drawer" && cartOpen && <div className="md:hidden absolute inset-0 bg-white dark:bg-gray-900 flex flex-col text-gray-800 dark:text-white/90">{cartPanel}</div>}
        {mode === "page" && cartOpen && <div className="flex-1 min-h-0 flex flex-col">{cartPanel}</div>}
      </div>

      {mode === "drawer" && (
        <div className="md:hidden p-3 border-t border-gray-200 dark:border-gray-700">
          <button type="button" className={`${tap} w-full h-12 bg-gray-900 text-white text-base`} onClick={() => setCartOpen(true)} disabled={cart.length === 0}>
            Review order · {count} · {money(total)}
          </button>
        </div>
      )}
    </div>
  );
}

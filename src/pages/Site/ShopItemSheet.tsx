// Item detail bottom-sheet shared by the café menu (view only) and the online
// shop (order mode with variants, add-ons, quantity and add-to-cart).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { ItemVariantDto, ItemAddOnDto } from "../../services/itemService";
import { addToCart } from "../../services/shopService";
import { onImageError, resolveImageUrl } from "./siteHelpers";

/** Minimal shape accepted by the sheet — both ItemDto and ShopCatalogItem fit. */
export type SheetItem = {
  id: string | number;
  name: string;
  price: number;
  imagePath?: string | null;
  quantity: number;
  description?: string | null;
  variants?: ItemVariantDto[] | null;
  addOns?: ItemAddOnDto[] | null;
};

export type ShopItemSheetMode = "order" | "view";

type Props = {
  item: SheetItem;
  categoryName?: string | null;
  onClose: () => void;
  mode: ShopItemSheetMode;
};

const CHIP_INFO = "flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-gray-200";

export default function ShopItemSheet({ item, categoryName, onClose, mode }: Props) {
  const navigate = useNavigate();
  const [pickVariant, setPickVariant] = useState<number | null>(null);
  const [pickAddOns, setPickAddOns] = useState<Record<number, number>>({});
  const [pickQty, setPickQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Reset the choices whenever a different item is shown.
  useEffect(() => { setPickVariant(null); setPickAddOns({}); setPickQty(1); setAdded(false); }, [item.id]);

  // Close with Escape and lock the page scroll behind the sheet. onClose is
  // read through a ref so an inline callback from the parent doesn't re-run this.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);

  const addOns = (item.addOns ?? []).filter((a) => a.isActive !== false);
  const variants = (item.variants ?? []).filter((v) => v.isActive !== false);
  const anyVariantInStock = variants.some((v) => v.quantity > 0);
  const inStock = variants.length > 0 ? anyVariantInStock : item.quantity > 0;

  const chosen = variants.find((v) => v.id === pickVariant);
  const unit = item.price + (chosen?.priceDelta ?? 0);
  const extras = addOns.reduce((s, a) => s + a.price * (pickAddOns[a.id] ?? 0), 0);
  const total = unit * pickQty + extras;
  const needsVariant = variants.length > 0 && !chosen;
  const order = mode === "order";

  const renderVariantChip = (v: ItemVariantDto) => {
    const sel = pickVariant === v.id;
    const out = v.quantity <= 0;
    const swatch = v.color && /^#[0-9a-fA-F]{6}$/.test(v.color)
      ? <span className="h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: v.color }} />
      : null;
    const delta = v.priceDelta !== 0
      ? <span className="text-[#b9d3ee]">{v.priceDelta > 0 ? "+" : "−"}${Math.abs(v.priceDelta).toFixed(2)}</span>
      : null;
    if (!order) {
      return (
        <span key={v.id} className={`${CHIP_INFO} ${out ? "opacity-40 line-through" : ""}`}>
          {swatch}{v.name}{delta}
        </span>
      );
    }
    return (
      <button key={v.id} type="button" disabled={out} onClick={() => setPickVariant(v.id)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${sel ? "border-[#87b2dd] bg-[#87b2dd]/20 text-white" : "border-white/15 bg-white/5 text-gray-200"} ${out ? "opacity-40 line-through" : ""}`}>
        {swatch}{v.name}{delta}
      </button>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#0e1a2a] text-white rounded-t-3xl sm:rounded-3xl border border-white/15 shadow-2xl animate-[slideUp_.25s_ease-out]">
        <div className="relative aspect-[16/10] sm:aspect-[16/9]">
          <img
            src={resolveImageUrl(item.imagePath)}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={onImageError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1a2a] via-transparent to-black/30" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 text-white text-lg flex items-center justify-center hover:bg-black/80"
          >
            ✕
          </button>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-white/50 sm:hidden" />
        </div>

        <div className="px-5 pb-6 -mt-6 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {categoryName && <div className="text-[11px] uppercase tracking-[0.2em] text-[#b9d3ee] mb-1">{categoryName}</div>}
              <h3 className="text-2xl font-bold leading-tight">{item.name}</h3>
            </div>
            <div className="shrink-0 text-2xl font-bold text-[#b9d3ee]">${item.price.toFixed(2)}</div>
          </div>

          {item.description && (
            <p className="mt-3 text-sm text-gray-300 leading-relaxed">{item.description}</p>
          )}

          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${inStock ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${inStock ? "bg-green-400" : "bg-red-400"}`} />
              {inStock ? (order ? "In stock" : "Available now") : (order ? "Sold out" : "Sold out today")}
            </span>
          </div>

          {variants.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2">
                {order ? "Choose colour / type" : "Colours / types"}
              </div>
              <div className="flex flex-wrap gap-2">{variants.map(renderVariantChip)}</div>
            </div>
          )}

          {addOns.length > 0 && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d3ee] mb-2">
                {order ? "Make it yours" : "Extras"}
              </div>
              <div className="rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden bg-white/5">
                {addOns.map((a) => {
                  const q = pickAddOns[a.id] ?? 0;
                  return (
                    <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="ml-2 text-sm font-bold text-[#b9d3ee]">+${a.price.toFixed(2)}</span>
                      </div>
                      {order && (
                        <div className="flex items-center rounded-lg border border-white/15 overflow-hidden">
                          <button type="button" disabled={q === 0} onClick={() => setPickAddOns((p) => { const c = { ...p }; if (q - 1 <= 0) delete c[a.id]; else c[a.id] = q - 1; return c; })} className="h-8 w-8 text-gray-300 disabled:opacity-30">−</button>
                          <div className="h-8 w-8 flex items-center justify-center text-sm font-bold">{q}</div>
                          <button type="button" onClick={() => setPickAddOns((p) => ({ ...p, [a.id]: q + 1 }))} className="h-8 w-8 bg-[#87b2dd] text-[#071018] font-bold">+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {order && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center rounded-xl border border-white/15 overflow-hidden">
                  <button type="button" disabled={pickQty <= 1} onClick={() => setPickQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-lg text-gray-300 disabled:opacity-30">−</button>
                  <div className="h-11 w-12 flex items-center justify-center font-bold">{pickQty}</div>
                  <button type="button" onClick={() => setPickQty((q) => q + 1)} className="h-11 w-11 text-lg bg-[#87b2dd] text-[#071018] font-bold">+</button>
                </div>
                <div className="text-xl font-bold">${total.toFixed(2)}</div>
              </div>
              <button
                type="button"
                disabled={!inStock || needsVariant}
                onClick={() => {
                  addToCart({
                    itemId: Number(item.id), name: item.name, imagePath: item.imagePath, unitPrice: item.price, quantity: pickQty,
                    variantId: chosen?.id ?? null, variantName: chosen?.name ?? null, variantPriceDelta: chosen?.priceDelta ?? 0,
                    addOns: addOns.filter((a) => (pickAddOns[a.id] ?? 0) > 0).map((a) => ({ addOnId: a.id, name: a.name, unitPrice: a.price, quantity: pickAddOns[a.id] })),
                  });
                  setAdded(true);
                }}
                className="w-full h-12 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] active:scale-[0.98] transition disabled:opacity-40"
              >
                {added ? "✓ Added to cart" : needsVariant ? "Choose an option first" : !inStock ? "Sold out" : "Add to cart"}
              </button>
              {added && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-white/15 text-sm text-gray-200">Keep browsing</button>
                  <button type="button" onClick={() => navigate("/cart")} className="flex-1 h-10 rounded-xl bg-white text-[#071018] text-sm font-bold">Go to cart →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(24px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>,
    document.body
  );
}

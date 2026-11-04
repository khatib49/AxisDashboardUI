import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { getCatalog } from "../../services/shopService";
import { useCart, useShopSession } from "./store";

/**
 * Public storefront chrome (no staff AppLayout): sticky header with search,
 * cart badge and account link, light/dark toggle (same "theme" key + html
 * class the dashboard uses), and a footer. Pages wrap themselves in it.
 */
export default function ShopLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { count } = useCart();
  const { signedIn, customer } = useShopSession();
  const [shopTitle, setShopTitle] = useState(title ?? "AXIS Shop");
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains("dark"));
  const [q, setQ] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    let on = true;
    getCatalog().then((c) => { if (on && c.title) setShopTitle(c.title); }).catch(() => { /* header keeps the default */ });
    return () => { on = false; };
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium ${isActive ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800 dark:bg-gray-950 dark:text-white/90">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-2">
          <Link to="/shop" className="flex items-center gap-2 shrink-0" aria-label={`${shopTitle} home`}>
            <img src="/images/logo/axis-mark.svg" alt="" className="h-7 w-7" />
            <span className="font-bold text-base sm:text-lg tracking-tight">{shopTitle}</span>
          </Link>
          <form
            role="search"
            className="hidden sm:flex flex-1 max-w-md mx-3"
            onSubmit={(e) => { e.preventDefault(); nav(`/shop/c/all?q=${encodeURIComponent(q.trim())}`); }}
          >
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products"
              className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800"
            />
          </form>
          <nav className="ml-auto flex items-center gap-1">
            <NavLink to="/shop" end className={link}>Shop</NavLink>
            <NavLink to="/shop/orders" className={`${link({ isActive: false })} hidden sm:inline-block`}>Orders</NavLink>
            <NavLink to="/shop/account" className={link} aria-label="Account">
              <span className="hidden sm:inline">{signedIn ? customer?.firstName || "Account" : "Sign in"}</span>
              <span className="sm:hidden" aria-hidden>👤</span>
            </NavLink>
            <button type="button" onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
              {dark ? "☀" : "☾"}
            </button>
            <Link to="/shop/cart" aria-label={`Cart, ${count} items`}
              className="relative h-9 px-3 rounded-lg bg-brand-500 text-white text-sm font-semibold flex items-center gap-1 hover:bg-brand-600">
              <span aria-hidden>🛒</span>
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && <span className="ml-1 rounded-full bg-white/25 px-1.5 text-xs" data-testid="cart-count">{count}</span>}
            </Link>
          </nav>
        </div>
        <form
          role="search"
          className="sm:hidden px-4 pb-2"
          onSubmit={(e) => { e.preventDefault(); nav(`/shop/c/all?q=${encodeURIComponent(q.trim())}`); }}
        >
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products"
            className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800"
          />
        </form>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-5 sm:py-8">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {shopTitle}</span>
          <nav className="flex gap-4">
            <Link to="/shop" className="hover:underline">Shop</Link>
            <Link to="/shop/orders" className="hover:underline">My orders</Link>
            <Link to="/shop/account" className="hover:underline">Account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

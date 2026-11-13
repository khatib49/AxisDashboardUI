import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { DisplayViewDto, getDisplayView } from "../../services/displayService";

const POLL_MS = 2000;
const usd = (n: number) => `$${n.toFixed(2)}`;
const lbp = (n: number) => `${Math.round(n).toLocaleString("en-US")} LL`;

const IDLE: DisplayViewDto = { registerName: "", status: "Idle", cart: [], totalUsd: 0, rateLbp: 0, totalLbp: 0, updatedOn: "" };

/**
 * Public, layout-less customer-facing screen: /display?token=…
 * Polls the register's state every 2 s. Big type, dark background, logo.
 * When the API is unreachable (or the display is not configured yet) it keeps
 * the last known state and shows a small "offline" marker instead of an error.
 */
export default function CustomerDisplayPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [view, setView] = useState<DisplayViewDto>(IDLE);
  const [online, setOnline] = useState<boolean | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [clock, setClock] = useState(new Date());
  const mounted = useRef(true);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!token) return () => { mounted.current = false; };
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const v = await getDisplayView(token);
        if (!mounted.current) return;
        setView(v);
        setOnline(true);
        setUnauthorized(false);
      } catch (e) {
        if (!mounted.current) return;
        const msg = (e as { message?: string })?.message ?? "";
        setOnline(false);
        if (/unknown display|missing display|unauthorized/i.test(msg)) setUnauthorized(true);
      } finally {
        busy = false;
      }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => { mounted.current = false; clearInterval(t); };
  }, [token]);

  const status = view.status;
  const showCart = status === "Cart" || status === "Awaiting";
  const rateText = view.rateLbp > 0 ? `1 USD = ${Math.round(view.rateLbp).toLocaleString("en-US")} LL` : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white select-none flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <img src="/images/logo/axis-mark.svg" alt="" className="h-14 w-14" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div>
            <div className="text-3xl font-black tracking-tight">AXIS</div>
            {view.registerName && <div className="text-sm text-white/50">{view.registerName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-white/60 text-xl">
          <span>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span
            title={online === false ? "Not connected to the till" : "Connected"}
            className={`inline-block w-3 h-3 rounded-full ${online === false ? "bg-amber-400" : online ? "bg-emerald-400" : "bg-white/30"}`}
          />
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        {!token ? (
          <Centered title="No display token" subtitle="Open this screen from Admin → Customer displays." />
        ) : unauthorized ? (
          <Centered title="Display not recognised" subtitle="This link's token is no longer valid. Ask an admin for a new display link." />
        ) : status === "Paid" || status === "Thanks" ? (
          <Centered
            icon="✓"
            title="Paid – thank you!"
            subtitle={view.totalUsd > 0 ? `${usd(view.totalUsd)} · ${lbp(view.totalLbp)}` : "See you again soon."}
            accent
          />
        ) : !showCart || view.cart.length === 0 ? (
          <Centered title="Welcome to AXIS" subtitle="Your order will appear here." muted />
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_440px] min-h-0">
            <section className="min-h-0 overflow-auto px-10 py-8">
              <ul className="divide-y divide-white/10">
                {view.cart.map((l, i) => (
                  <li key={`${l.name}-${i}`} className="flex items-center justify-between py-4 text-3xl">
                    <span className="flex items-center gap-5 min-w-0">
                      <span className="w-12 text-right tabular-nums text-white/60">{l.qty}×</span>
                      <span className="truncate font-medium">{l.name}</span>
                    </span>
                    <span className="tabular-nums font-semibold">{usd(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="border-l border-white/10 bg-white/5 px-10 py-8 flex flex-col justify-between">
              <div>
                <div className="text-white/60 text-2xl">Total</div>
                <div className="text-7xl font-black tabular-nums mt-2 leading-none">{usd(view.totalUsd)}</div>
                <div className="text-4xl font-semibold tabular-nums mt-4 text-emerald-300">{lbp(view.totalLbp)}</div>
                {rateText && <div className="text-white/40 text-lg mt-3">{rateText}</div>}
              </div>

              {status === "Awaiting" && view.qrPayload ? (
                <div className="mt-8 rounded-3xl bg-white p-6 text-gray-900 flex flex-col items-center">
                  <QRCodeSVG value={view.qrPayload} size={260} level="M" includeMargin={false} />
                  <div className="mt-4 text-2xl font-bold">Scan to pay with Whish</div>
                  <div className="text-gray-600 text-lg">{usd(view.whishAmount ?? view.totalUsd)}</div>
                </div>
              ) : status === "Awaiting" ? (
                <div className="mt-8 text-2xl text-amber-300">Preparing payment…</div>
              ) : (
                <div className="mt-8 text-white/50 text-2xl">Pay at the counter or ask for Whish.</div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Centered({ title, subtitle, icon, accent, muted }: { title: string; subtitle?: string; icon?: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center text-center px-10 ${accent ? "bg-emerald-600" : ""}`}>
      {icon && <div className="w-32 h-32 rounded-full bg-white text-emerald-600 text-7xl font-black flex items-center justify-center mb-8">{icon}</div>}
      <h1 className={`text-6xl font-black tracking-tight ${muted ? "text-white/80" : ""}`}>{title}</h1>
      {subtitle && <p className={`mt-5 text-3xl ${accent ? "text-white/90" : "text-white/50"}`}>{subtitle}</p>}
    </div>
  );
}

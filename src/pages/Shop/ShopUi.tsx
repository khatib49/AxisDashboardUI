// Shared bits for the website shop pages (cart / checkout / account / orders).
import { ReactNode } from "react";
import { Link } from "react-router";

export const money = (n: number) => `$${n.toFixed(2)}`;

export function ShopPage({ title, subtitle, children, back }: { title: string; subtitle?: string; children: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div
      style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
      className="min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507] text-white"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {back && <Link to={back.to} className="text-sm text-[#b9d3ee] hover:underline">← {back.label}</Link>}
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-300">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export const inputCls = "w-full h-12 rounded-xl border border-white/15 bg-white/5 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#87b2dd]";
export const primaryBtn = "w-full h-12 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] active:scale-[0.98] transition disabled:opacity-50";
export const ghostBtn = "h-10 px-4 rounded-xl border border-white/15 text-sm text-gray-200 hover:bg-white/5";

export const STATUS_TEXT: Record<string, { label: string; tone: string; hint: string }> = {
  New:             { label: "Received",          tone: "bg-blue-500/20 text-blue-200",     hint: "We got it — the team will confirm shortly." },
  AwaitingPayment: { label: "Awaiting payment",  tone: "bg-amber-500/20 text-amber-200",   hint: "Finish the card payment to send your order to the kitchen." },
  Paid:            { label: "Paid",              tone: "bg-green-500/20 text-green-200",   hint: "Payment received — being prepared." },
  Accepted:        { label: "Being prepared",    tone: "bg-indigo-500/20 text-indigo-200", hint: "The kitchen / bar is on it." },
  Ready:           { label: "Ready for pickup",  tone: "bg-green-500/20 text-green-200",   hint: "Come and grab it at the counter." },
  Shipped:         { label: "Shipped",           tone: "bg-sky-500/20 text-sky-200",       hint: "Your parcel is with Aramex — track it below." },
  Delivered:       { label: "Delivered",         tone: "bg-green-500/20 text-green-200",   hint: "Delivered — enjoy!" },
  Completed:       { label: "Completed",         tone: "bg-white/10 text-gray-300",        hint: "Enjoy!" },
  Cancelled:       { label: "Cancelled",         tone: "bg-red-500/20 text-red-200",       hint: "This order was cancelled." },
};

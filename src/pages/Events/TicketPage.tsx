// Public event ticket — /tickets/:code
// ====================================
// The thing the attendee shows at the door. Anonymous (the code is the
// secret), mobile-first, printable. Self-contained: no SiteLayout.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import PageMeta from "../../components/common/PageMeta";
import { IMAGES } from "../Site/siteContent";
import {
  getTicket, ticketIcs, ticketShareText, ticketUrl, ticketHeroUrl, formatTicketDate,
} from "../../services/eventTicketService";
import type { EventTicket } from "../../services/eventTicketService";

const FONT = "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial";
const money = (n: number, c: string) => `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;

const POLL_MS = 4000;
const POLL_MAX = 30; // 30 × 4s = 2 minutes

export default function TicketPage() {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const justPaid = params.get("paid") === "1";

  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState(0);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await getTicket(code);
      if (!t) { setNotFound(true); setTicket(null); return null; }
      setTicket(t);
      setNotFound(false);
      return t;
    } catch {
      setNotFound(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { if (code) load(); }, [code, load]);

  // Coming back from the gateway: the callback can lag a few seconds, so
  // keep asking until the ticket flips to Paid (or we give up after 2 min).
  const confirming = justPaid && !!ticket && ticket.paymentStatus === "Pending" && polls < POLL_MAX;
  useEffect(() => {
    if (!confirming) return;
    pollTimer.current = window.setTimeout(async () => {
      await load();
      setPolls((n) => n + 1);
    }, POLL_MS);
    return () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); };
  }, [confirming, polls, load]);

  const url = ticketUrl(code);

  return (
    <div style={{ fontFamily: FONT }} className="tk-root min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507] text-white flex flex-col">
      <PageMeta title="Your ticket — AXIS" description="Your AXIS event ticket — show the QR at the door." />
      <style>{PRINT_CSS}</style>

      <header className="tk-noprint px-5 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/events" aria-label="AXIS events" className="block">
          <img src={IMAGES.branding} alt="AXIS" className="h-8 w-auto" />
        </Link>
        <Link to="/events" className="text-[11px] uppercase tracking-[0.25em] text-[#b9d3ee] hover:text-white">All events →</Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          {loading && <div className="text-center py-16 text-gray-400">Loading your ticket…</div>}

          {!loading && notFound && (
            <div className="tk-noprint rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <div className="text-4xl mb-2">🎟</div>
              <div className="font-bold text-lg">Ticket not found</div>
              <p className="text-sm text-gray-300 mt-1">
                We couldn't find a ticket with code <span className="font-mono">{code}</span>. Check the link you were sent, or find it under My account → My tickets.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Link to="/account" className="h-11 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] flex items-center justify-center">My account</Link>
                <Link to="/events" className="text-sm text-[#b9d3ee] underline">Browse events</Link>
              </div>
            </div>
          )}

          {!loading && ticket && (
            <>
              {confirming && (
                <div className="tk-noprint mb-4 rounded-2xl border border-[#87b2dd]/40 bg-[#87b2dd]/10 px-4 py-3 flex items-center gap-3">
                  <div className="h-6 w-6 shrink-0 rounded-full border-4 border-[#87b2dd]/30 border-t-[#87b2dd] animate-spin" />
                  <div className="text-sm">
                    <div className="font-semibold">Confirming your payment…</div>
                    <div className="text-xs text-gray-300">This usually takes a few seconds. Your ticket updates automatically.</div>
                  </div>
                </div>
              )}

              <TicketCard ticket={ticket} url={url} />

              {ticket.paymentStatus === "Pending" && !confirming && (
                <div className="tk-noprint mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
                  <div className="font-bold text-amber-200">Your spot is not confirmed yet</div>
                  {ticket.payUrl ? (
                    <>
                      <p className="text-sm text-amber-100/80 mt-1">Pay {money(ticket.amount, ticket.currency)} online and this ticket turns green right away.</p>
                      <a href={ticket.payUrl} className="mt-3 h-12 rounded-2xl font-bold text-[#071018] bg-gradient-to-r from-[#f5c451] to-[#f8d97f] flex items-center justify-center">
                        Pay now — {money(ticket.amount, ticket.currency)}
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-amber-100/80 mt-1">
                      {ticket.paymentMethod === "Cash"
                        ? `Pay ${money(ticket.amount, ticket.currency)} in cash at the AXIS counter (or at the door) and we'll confirm your ticket on the spot.`
                        : `Send us your payment receipt on WhatsApp and we'll confirm your ticket as soon as we see it.`}
                    </p>
                  )}
                  {ticket.whatsAppUrl && (
                    <a href={ticket.whatsAppUrl} target="_blank" rel="noreferrer"
                      className="mt-3 h-11 rounded-2xl font-semibold border border-green-400/40 bg-green-500/15 text-green-100 flex items-center justify-center gap-2">
                      💬 Message us on WhatsApp
                    </a>
                  )}
                </div>
              )}

              {ticket.paymentStatus === "Rejected" && (
                <div className="tk-noprint mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
                  This registration was not confirmed. If you think that's a mistake, message us and we'll sort it out.
                  {ticket.whatsAppUrl && (
                    <a href={ticket.whatsAppUrl} target="_blank" rel="noreferrer" className="block mt-2 underline">Contact AXIS on WhatsApp</a>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="tk-noprint mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
                <a href={ticketIcs(ticket)} download={`axis-${ticket.ticketCode}.ics`}
                  className="h-14 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1">
                  <span className="text-lg leading-none">📅</span>Add to calendar
                </a>
                <a href={`https://wa.me/?text=${encodeURIComponent(ticketShareText(ticket))}`} target="_blank" rel="noreferrer"
                  className="h-14 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1">
                  <span className="text-lg leading-none">💬</span>Share on WhatsApp
                </a>
                <button type="button" onClick={() => window.print()}
                  className="h-14 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-1">
                  <span className="text-lg leading-none">🖨</span>Save / Print
                </button>
              </div>

              <p className="tk-noprint mt-6 text-center text-xs text-gray-400">
                Show this QR at the door. Screenshots work too.
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="tk-noprint px-5 py-4 text-center text-[11px] text-gray-500">AXIS Game Lounge · Beirut</footer>
    </div>
  );
}

// ── The ticket itself ─────────────────────────────────────────────────────
function TicketCard({ ticket, url }: { ticket: EventTicket; url: string }) {
  const hero = ticketHeroUrl(ticket.heroImagePath);
  const status = statusOf(ticket);

  return (
    <div className="tk-print-area rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-[#0b1420]">
      {/* Hero */}
      <div className="relative h-40 sm:h-48 bg-gradient-to-br from-[#1b2f47] to-[#0b1420]">
        {hero && <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1420] via-[#0b1420]/40 to-transparent" />
        <div className="absolute top-3 left-4 text-[10px] uppercase tracking-[0.3em] text-white/80 drop-shadow">AXIS presents</div>
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${status.tone}`}>{status.label}</div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-2xl font-bold leading-tight drop-shadow">{ticket.eventTitle}</div>
          {ticket.eventSubtitle && <div className="text-sm text-gray-200 mt-0.5">{ticket.eventSubtitle}</div>}
        </div>
      </div>

      {/* When / where */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#b9d3ee]">Date &amp; time</div>
          <div className="font-semibold mt-0.5">{formatTicketDate(ticket.eventDate)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#b9d3ee]">Location</div>
          <div className="font-semibold mt-0.5">{ticket.location || "AXIS Game Lounge, Beirut"}</div>
        </div>
      </div>

      {/* Perforation */}
      <div className="tk-perf relative h-6 flex items-center">
        <span className="absolute -left-3 h-6 w-6 rounded-full bg-[#0e1a2a] border border-white/15 tk-notch" />
        <div className="mx-6 w-full border-t-2 border-dashed border-white/20" />
        <span className="absolute -right-3 h-6 w-6 rounded-full bg-[#0e1a2a] border border-white/15 tk-notch" />
      </div>

      {/* Attendee + QR */}
      <div className="px-5 pb-5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#b9d3ee]">Attendee</div>
            <div className="text-lg font-bold truncate">{ticket.firstName} {ticket.lastName}</div>
            <div className="text-sm text-gray-300">{ticket.phone}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#b9d3ee]">{ticket.ticketTypeName ? "Ticket" : "Price"}</div>
            {ticket.ticketTypeName && <div className="text-lg font-bold leading-tight">{ticket.ticketTypeName}</div>}
            <div className={ticket.ticketTypeName ? "text-sm font-semibold text-gray-200" : "text-lg font-bold"}>{money(ticket.amount, ticket.currency)}</div>
            <div className="text-[11px] text-gray-400">{ticket.paymentMethod}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-3 shadow-inner">
            <QRCodeSVG value={url} size={200} level="M" bgColor="#ffffff" fgColor="#071018" includeMargin={false} />
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#b9d3ee]">Ticket code</div>
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.15em] mt-0.5">{ticket.ticketCode}</div>
          {ticket.checkedInOn && (
            <div className="mt-2 text-xs text-green-200">Checked in {new Date(ticket.checkedInOn).toLocaleString()}</div>
          )}
          {!ticket.checkedInOn && ticket.paidOn && (
            <div className="mt-2 text-[11px] text-gray-400">Paid {new Date(ticket.paidOn).toLocaleString()}</div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
        <span>Show this QR at the door</span>
        <span>AXIS Game Lounge · Beirut</span>
      </div>
    </div>
  );
}

function statusOf(t: EventTicket): { label: string; tone: string } {
  if (t.checkedInOn) {
    const time = new Date(t.checkedInOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { label: `CHECKED IN ✓ ${time}`, tone: "bg-[#87b2dd] text-[#071018]" };
  }
  switch (t.paymentStatus) {
    case "Paid": return { label: "PAID", tone: "bg-green-500 text-white" };
    case "Pending": return { label: "PENDING PAYMENT", tone: "bg-amber-400 text-[#2a1d00]" };
    case "Rejected": return { label: "REJECTED", tone: "bg-red-500 text-white" };
    case "Refunded": return { label: "REFUNDED", tone: "bg-gray-400 text-[#071018]" };
    default: return { label: t.paymentStatus.toUpperCase(), tone: "bg-white/20 text-white" };
  }
}

// Only the ticket card prints, on white, with dark text so the QR and the
// code stay legible on paper.
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  body { background: #fff !important; }
  .tk-root { background: #fff !important; color: #111 !important; min-height: 0 !important; }
  .tk-noprint { display: none !important; }
  .tk-print-area { box-shadow: none !important; border: 1px solid #ccc !important; background: #fff !important; color: #111 !important; max-width: 420px; margin: 0 auto; }
  .tk-print-area * { color: #111 !important; text-shadow: none !important; }
  .tk-print-area .text-\\[\\#b9d3ee\\] { color: #555 !important; }
  .tk-print-area .border-white\\/10, .tk-print-area .border-white\\/20 { border-color: #ccc !important; }
  .tk-print-area .tk-notch { background: #fff !important; border-color: #ccc !important; }
  .tk-print-area img { display: none !important; }
  .tk-print-area .bg-gradient-to-br, .tk-print-area .bg-gradient-to-t { background: #f3f4f6 !important; }
  .tk-print-area .bg-green-500, .tk-print-area .bg-amber-400, .tk-print-area .bg-red-500, .tk-print-area .bg-\\[\\#87b2dd\\] { border: 1px solid #111; }
}
`;

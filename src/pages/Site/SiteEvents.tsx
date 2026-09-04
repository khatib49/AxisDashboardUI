// Public events page. Lists the events an admin has published under
// Admin → Events ("Show on website"); "Join this event" opens that event's
// registration page. If the API can't be reached, the original site's
// sample schedule is shown so the page never looks broken.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { EventPublicSummary, getPublishedEvents } from "../../services/eventService";
import { FALLBACK_EVENTS, SiteEventItem } from "./siteContent";
import { useSiteContent } from "./SiteContentContext";
import { BTN_OUTLINE, BTN_PRIMARY, EYEBROW, ScrollCue } from "./SiteUi";
import { hideImageOnError, resolveSiteImage, whatsappUrl } from "./siteHelpers";

const CATEGORY_STYLES: Record<string, string> = {
  TCG: "from-[#87b2dd]/20 to-[#87b2dd]/5 text-[#d8e8f8] border-[#87b2dd]/40",
  PlayStation: "from-[#6a99cb]/20 to-[#6a99cb]/5 text-[#d8e8f8] border-[#6a99cb]/40",
  "Board Games": "from-[#9fc1e6]/20 to-[#9fc1e6]/5 text-[#d8e8f8] border-[#9fc1e6]/40",
  Billiards: "from-[#9fc1e6]/20 to-[#9fc1e6]/5 text-[#d8e8f8] border-[#9fc1e6]/40",
  Tournament: "from-[#6a99cb]/20 to-[#6a99cb]/5 text-[#d8e8f8] border-[#6a99cb]/40",
  Community: "from-[#7fa9d7]/20 to-[#7fa9d7]/5 text-[#d8e8f8] border-[#7fa9d7]/40",
  Workshop: "from-[#b9d3ee]/20 to-[#b9d3ee]/5 text-[#e6f1fb] border-[#b9d3ee]/40",
};
const CATEGORY_ORDER = ["TCG", "PlayStation", "Board Games", "Billiards", "Tournament", "Community", "Workshop"];

/** Admin event "type" chips → the site's category filters. */
function toCategory(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("tcg")) return "TCG";
  if (t.includes("ps5") || t.includes("playstation")) return "PlayStation";
  if (t.includes("board")) return "Board Games";
  if (t.includes("billiard")) return "Billiards";
  if (t.includes("tournament")) return "Tournament";
  if (t.includes("workshop")) return "Workshop";
  return "Community";
}

function formatPrice(price: number, currency: string): string {
  if (!price || price <= 0) return "Free";
  const cur = (currency || "USD").toUpperCase();
  return cur === "USD" ? `$${price}` : `${price} ${cur}`;
}

function toItem(e: EventPublicSummary): SiteEventItem {
  const d = e.eventDate ? new Date(e.eventDate) : null;
  const valid = d !== null && !Number.isNaN(d.getTime());
  return {
    id: e.key,
    title: e.title,
    category: toCategory(e.type),
    day: valid ? d.toLocaleDateString("en-US", { weekday: "short" }) : "TBA",
    date: valid ? d.getDate() : "—",
    time: valid ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Time TBA",
    spots: e.isSoldOut ? "Sold out" : e.capacity ? `${e.capacity} seats` : "Open",
    href: `/events/${e.key}`,
    price: formatPrice(e.price, e.currency),
    location: e.location,
  };
}

const FIELD =
  "w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#87b2dd]";

export default function SiteEvents() {
  const { events, contact } = useSiteContent();
  const { hero, listing, cta } = events;
  const waBase = whatsappUrl(contact.whatsapp);

  const [items, setItems] = useState<SiteEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  // Join dialog (WhatsApp request to customer service)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactDate, setContactDate] = useState("");

  useEffect(() => {
    let alive = true;
    getPublishedEvents()
      .then((list) => alive && setItems(list.map(toItem)))
      .catch(() => alive && setItems(FALLBACK_EVENTS))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(
    () => ["All", ...CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c))],
    [items]
  );
  const visible = useMemo(() => (filter === "All" ? items : items.filter((i) => i.category === filter)), [filter, items]);
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) || visible[0] || items[0],
    [items, selectedId, visible]
  );

  const openDialog = (id?: string) => {
    setSelectedId(id || visible[0]?.id || items[0]?.id || "");
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const whatsappHref = useMemo(() => {
    if (!selected || !fullName.trim()) return waBase;
    const lines = [
      "Hello AXIS Customer Service,",
      `My full name: ${fullName.trim()}`,
      `Event: ${selected.title}`,
      `Category: ${selected.category}`,
      `Event date: ${selected.day} ${selected.date}`,
      `Event time: ${selected.time}`,
      contactDate ? `Preferred contact date: ${contactDate}` : null,
      "I would like to join this event. Please contact me with the details.",
    ].filter(Boolean);
    return `${waBase}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [fullName, contactDate, selected, waBase]);

  return (
    <div>
      <PageMeta title="Events & Tournaments — AXIS" description={hero.description} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={resolveSiteImage(hero.image)}
          alt="Events at AXIS"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          onError={hideImageOnError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/70 via-[#050507]/85 to-[#050507]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <p className={EYEBROW}>{hero.eyebrow}</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
            {hero.title}{" "}
            <span className="bg-gradient-to-r from-[#b9d3ee] to-[#87b2dd] bg-clip-text text-transparent">
              {hero.highlight}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/70">{hero.description}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            {hero.secondaryLabel && (
              <Link to={hero.secondaryHref || "/services"} className={BTN_OUTLINE}>
                {hero.secondaryLabel}
              </Link>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => openDialog()}
                className="rounded-full border border-[#87b2dd]/45 px-8 py-4 font-bold text-[#d8e8f8] transition-colors hover:bg-[#87b2dd]/10"
              >
                {hero.joinLabel || "Join an Event"}
              </button>
            )}
          </div>
        </div>
      </section>

      <ScrollCue />

      {/* Listing */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={EYEBROW}>{listing.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{listing.title}</h2>
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    filter === c
                      ? "border-transparent bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] text-[#071018]"
                      : "border-white/15 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-10 text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#87b2dd]" />
            <p className="mt-4 text-white/60">Loading events...</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((ev) => {
              const soldOut = ev.spots === "Sold out";
              const joinClass =
                "mt-5 rounded-full border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/80 transition-colors hover:border-[#87b2dd]/60 hover:bg-[#87b2dd]/10 hover:text-white";
              return (
                <article
                  key={ev.id}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{ev.day}</span>
                      <span className="text-2xl font-black text-white">{ev.date}</span>
                    </div>
                    <span
                      className={`rounded-full border bg-gradient-to-r px-3 py-1 text-xs font-bold ${
                        CATEGORY_STYLES[ev.category] || CATEGORY_STYLES.Community
                      }`}
                    >
                      {ev.category}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-white">{ev.title}</h3>
                  {ev.location && <p className="mt-1 text-sm text-white/50">📍 {ev.location}</p>}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                    <span className="text-white/70">🕒 {ev.time}</span>
                    <span className={soldOut ? "text-red-300" : "text-white/50"}>
                      {ev.price && <span className="mr-2 font-bold text-[#b9d3ee]">{ev.price}</span>}
                      {ev.spots}
                    </span>
                  </div>
                  {ev.href ? (
                    soldOut ? (
                      <span className={`${joinClass} cursor-not-allowed opacity-60`}>Sold out</span>
                    ) : (
                      <Link to={ev.href} className={joinClass}>
                        Join this event
                      </Link>
                    )
                  ) : (
                    <button type="button" onClick={() => openDialog(ev.id)} className={joinClass}>
                      Join this event
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <p className="mt-10 text-center text-white/50">{listing.emptyState}</p>
        )}
      </section>

      <ScrollCue />

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold text-white">{cta.title}</h2>
            <p className="mt-2 text-white/70">{cta.description}</p>
          </div>
          {cta.buttonLabel && (
            <Link to={cta.buttonHref || "/contact"} className={BTN_PRIMARY}>
              {cta.buttonLabel}
            </Link>
          )}
        </div>
      </section>

      {/* Join dialog */}
      {dialogOpen && selected && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#050507]/80 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#090b10] p-6 shadow-2xl shadow-black/40 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b9d3ee]">Join an event</p>
                <h3 className="mt-3 text-2xl font-extrabold text-white">Send a WhatsApp request to AXIS</h3>
                <p className="mt-2 text-sm text-white/60">
                  Choose the event, add your full name, and send the message directly to customer service.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close join event dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-white/75">Available event</span>
                <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className={FIELD}>
                  {items.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-[#0c0f14]">
                      {ev.title} - {ev.day} {ev.date} · {ev.time}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-white/75">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  type="text"
                  placeholder="Enter your full name"
                  className={FIELD}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-white/75">Preferred contact date</span>
                <input value={contactDate} onChange={(e) => setContactDate(e.target.value)} type="date" className={FIELD} />
              </label>
              <div className="space-y-2">
                <span className="text-sm font-semibold text-white/75">Selected event</span>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="font-semibold text-white">{selected.title}</div>
                  <div>
                    {selected.category} · {selected.day} {selected.date} · {selected.time}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              {selected.href && (
                <Link
                  to={selected.href}
                  className="rounded-full border border-[#87b2dd]/45 px-5 py-3 font-semibold text-[#d8e8f8] transition-colors hover:bg-[#87b2dd]/10"
                >
                  Register online
                </Link>
              )}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={`rounded-full px-5 py-3 font-semibold text-[#071018] transition-transform hover:scale-105 ${
                  fullName.trim()
                    ? "bg-gradient-to-r from-[#6a99cb] to-[#87b2dd]"
                    : "pointer-events-none bg-white/20 text-white/40"
                }`}
                aria-disabled={!fullName.trim()}
              >
                Open WhatsApp message
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

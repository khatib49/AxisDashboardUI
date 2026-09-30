// Legal pages: /terms, /privacy, /shipping-policy, /refund-policy.
// One component; the route decides which policy to render. Content lives in
// policies.ts and is filled with the live contact details from Admin → Website.
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useSiteContent } from "./SiteContentContext";
import { buildPolicies, POLICY_LINKS, type PolicyKey } from "./policies";

export default function SitePolicies({ policy }: { policy: PolicyKey }) {
  const { contact } = useSiteContent();
  const { pathname } = useLocation();

  const docs = useMemo(() => buildPolicies({
    tradeName: "AXIS Game Lounge",
    domain: "www.axislb.com",
    address: contact.addressLong || contact.address || "Achrafieh, Beirut",
    phone: contact.whatsapp || contact.phone || "",
    email: contact.email || "",
    country: "Lebanon",
  }), [contact]);
  const doc = docs[policy];

  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div
      style={{ fontFamily: "'Cygre', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}
      className="min-h-screen bg-gradient-to-br from-[#050507] via-[#0e1a2a] to-[#050507] text-white"
    >
      <PageMeta title={`${doc.title} — AXIS`} description={`${doc.title} for orders, tickets and services on www.axislb.com`} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Policy switcher */}
        <nav aria-label="Policies" className="lg:sticky lg:top-24 self-start">
          <div className="text-[11px] uppercase tracking-[0.25em] text-[#b9d3ee] mb-3">Legal</div>
          <ul className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar">
            {POLICY_LINKS.map((l) => (
              <li key={l.key} className="shrink-0">
                <Link
                  to={l.path}
                  className={`block rounded-xl px-3 py-2 text-sm transition ${l.key === policy ? "bg-white text-[#071018] font-semibold" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
        </nav>

        {/* Document */}
        <article className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{doc.title}</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-gray-400">Last updated: {doc.updated}</p>
          {doc.intro && <p className="mt-6 text-base leading-relaxed text-gray-200">{doc.intro}</p>}

          <div className="mt-8 space-y-7">
            {doc.sections.map((s, i) => (
              <section key={`${s.heading}-${i}`}>
                {s.heading && <h2 className="text-lg font-bold text-white mb-2">{s.heading}</h2>}
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm sm:text-[15px] leading-relaxed text-gray-300 mb-3">{p}</p>
                ))}
                {s.bullets && (
                  <ul className="list-disc pl-5 space-y-1.5 text-sm sm:text-[15px] leading-relaxed text-gray-300">
                    {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
            <div className="font-semibold text-white mb-1">AXIS Game Lounge</div>
            <div>{contact.addressLong || contact.address}</div>
            <div className="mt-1">
              <a className="text-[#b9d3ee] hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a>
              {" · "}
              <span>{contact.whatsapp || contact.phone}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useSiteContent } from "./SiteContentContext";
import { BTN_PRIMARY, EYEBROW, ScrollCue } from "./SiteUi";
import { hasText, onImageError, resolveSiteImage } from "./siteHelpers";

export default function SiteServices() {
  const { services: s } = useSiteContent();
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <PageMeta title="Services & Passes — AXIS" description={s.description} />

      <div className="max-w-2xl">
        <p className={EYEBROW}>{s.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">{s.title}</h1>
        <p className="mt-6 text-white/70">{s.description}</p>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {s.items.filter((item) => hasText(item.title, item.tagline)).map((item, i) => (
          <article
            key={`${item.title}-${i}`}
            className={`group flex flex-col overflow-hidden rounded-2xl border transition-colors ${
              item.featured
                ? "border-[#87b2dd]/50 bg-gradient-to-b from-[#87b2dd]/15 to-[#6a99cb]/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            }`}
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={resolveSiteImage(item.image)}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={onImageError}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/30 to-transparent" />
              {item.featured && (
                <span className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#071018]">
                  Bundle
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-extrabold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-white/60">{item.tagline}</p>
              <ul className="mt-5 space-y-2 border-t border-white/10 pt-5">
                {(item.passes || []).filter((p) => hasText(p.label, p.price)).map((pass, j) => (
                  <li key={`${pass.label}-${j}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/80">
                      {pass.label}
                      {pass.note && <span className="ml-1 text-white/40">· {pass.note}</span>}
                    </span>
                    <span className="whitespace-nowrap bg-gradient-to-r from-[#b9d3ee] to-[#87b2dd] bg-clip-text text-lg font-black text-transparent">
                      {pass.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <ScrollCue />

      <div className="mt-16 flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
        <div className="flex-1">
          <h2 className="text-2xl font-extrabold text-white">{s.ctaTitle}</h2>
          <p className="mt-2 text-white/70">{s.ctaDescription}</p>
        </div>
        {s.ctaButtonLabel && (
          <Link to={s.ctaButtonHref || "/menu"} className={BTN_PRIMARY}>
            {s.ctaButtonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

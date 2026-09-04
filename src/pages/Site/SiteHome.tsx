import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useSiteContent } from "./SiteContentContext";
import { BTN_OUTLINE, BTN_PRIMARY, EYEBROW, ScrollCue } from "./SiteUi";
import { hasText, hideImageOnError, onImageError, resolveSiteImage } from "./siteHelpers";

export default function SiteHome() {
  const { home } = useSiteContent();
  const { hero, overview, gallery, cta } = home;
  const stats = hero.stats.filter((s) => hasText(s.value, s.label));
  const paragraphs = overview.paragraphs.filter((p) => hasText(p));
  const photos = gallery.items.filter((g) => hasText(g.image, g.caption));
  const tags = home.tags.filter((t) => hasText(t));
  return (
    <div>
      <PageMeta title="AXIS — Where Everything Connects" description={hero.description} />

      {/* Hero */}
      <section className="relative min-h-[86vh] overflow-hidden">
        <img
          src={resolveSiteImage(hero.image)}
          alt={hero.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={hideImageOnError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050507]/35 via-[#050507]/65 to-[#050507]" />
        <div className="relative mx-auto flex min-h-[86vh] max-w-7xl items-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className={EYEBROW}>{hero.eyebrow}</p>
            <p className="mt-4 text-3xl font-black uppercase tracking-[0.09em] text-white sm:text-5xl">{hero.title}</p>
            <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">{hero.description}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              {hero.primaryLabel && (
                <Link to={hero.primaryHref || "/menu"} className={BTN_PRIMARY}>
                  {hero.primaryLabel}
                </Link>
              )}
              {hero.secondaryLabel && (
                <Link to={hero.secondaryHref || "/services"} className={BTN_OUTLINE}>
                  {hero.secondaryLabel}
                </Link>
              )}
            </div>
            {stats.length > 0 && (
              <div className="mt-12 grid max-w-lg grid-cols-3 gap-6">
                {stats.map((s, i) => (
                  <div key={`${s.label}-${i}`}>
                    <div className="text-3xl font-black text-white">{s.value}</div>
                    <div className="mt-1 text-sm text-white/60">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <ScrollCue />

      {/* Overview */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className={EYEBROW}>{overview.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">{overview.title}</h2>
          {paragraphs.map((p, i) => (
            <p key={i} className="mt-6 text-white/70">
              {p}
            </p>
          ))}
        </div>
      </section>

      <ScrollCue />

      {/* Gallery */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className={EYEBROW}>{gallery.eyebrow}</p>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">{gallery.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">{gallery.description}</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {photos.map((g, i) => (
            <figure key={`${g.caption}-${i}`} className="overflow-hidden rounded-2xl border border-white/10">
              <img src={resolveSiteImage(g.image)} alt={g.caption} className="h-56 w-full object-cover" onError={onImageError} />
              <figcaption className="px-4 py-3 text-sm text-white/60">{g.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Tag strip */}
      {tags.length > 0 && (
        <section className="border-y border-white/10 bg-white/[0.02] py-10">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-4 sm:px-6 lg:px-8">
            {tags.map((t, i) => (
              <span key={`${t}-${i}`} className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/70">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">{cta.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/70">{cta.description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {cta.primaryLabel && (
            <Link to={cta.primaryHref || "/menu"} className={BTN_PRIMARY}>
              {cta.primaryLabel}
            </Link>
          )}
          {cta.secondaryLabel && (
            <Link to={cta.secondaryHref || "/events"} className={BTN_OUTLINE}>
              {cta.secondaryLabel}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

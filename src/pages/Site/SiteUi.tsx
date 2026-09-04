// Small building blocks shared by the public website pages.
import { Link } from "react-router";
import { IMAGES } from "./siteContent";

/** Solid brand-gradient pill button (the site's primary CTA). */
export const BTN_PRIMARY =
  "rounded-full bg-gradient-to-r from-[#6a99cb] to-[#87b2dd] px-8 py-4 font-bold text-[#071018] shadow-lg shadow-[#87b2dd]/40 transition-transform hover:scale-105";
/** Outlined pill button (secondary CTA). */
export const BTN_OUTLINE =
  "rounded-full border border-white/20 px-8 py-4 font-bold text-white transition-colors hover:bg-white/10";
/** Outlined pill in brand blue. */
export const BTN_BRAND_OUTLINE =
  "rounded-full border border-[#87b2dd]/45 px-8 py-4 font-bold text-[#d8e8f8] transition-colors hover:bg-[#87b2dd]/10";

export const EYEBROW = "text-sm font-semibold uppercase tracking-[0.3em] text-[#b9d3ee]";

/** Site logo (the pixel AXIS wordmark) linking home. */
export function SiteLogo({ to = "/", imageClassName = "h-10 sm:h-12" }: { to?: string; imageClassName?: string }) {
  return (
    <Link to={to} aria-label="AXIS home" className="block">
      <img src={IMAGES.branding} alt="AXIS Where Everything Connects" className={`w-auto ${imageClassName}`} />
    </Link>
  );
}

/** The ✕ mark with the animated "scroll down" mouse cue between sections. */
export function ScrollCue({ label = "Scroll Down" }: { label?: string }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <img src={IMAGES.xMark} alt="AXIS symbol" className="h-16 w-16 sm:h-20 sm:w-20" />
      <div className="mt-3 flex flex-col items-center text-[#87b2dd]/80">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">{label}</span>
        <div className="axis-mouse mt-2">
          <span className="axis-mouse-wheel" />
        </div>
      </div>
    </div>
  );
}

/** Full-screen brand loader (used while a page is fetching its data). */
export function SiteLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-white">
      <div className="flex flex-col items-center gap-4">
        <img src={IMAGES.branding} alt="AXIS" className="h-14 w-auto animate-pulse sm:h-16" />
        <p className="text-xs uppercase tracking-[0.28em] text-[#b9d3ee]/80">{label}</p>
      </div>
    </div>
  );
}

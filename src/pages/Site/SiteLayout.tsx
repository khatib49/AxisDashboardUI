// Public website shell: announcement bar, sticky header with mobile menu,
// scroll-reveal main area, footer and the floating WhatsApp button.
// Every public page (/, /menu, /services, /events, /contact) renders in
// here through <Outlet />. Staff who are signed in get a "Dashboard"
// shortcut instead of "Sign In". All wording comes from the website
// content document (Admin → Website).
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { NAV_LINKS } from "./siteContent";
import { SiteContentProvider, useSiteContent, useSitePreview } from "./SiteContentContext";
import { SiteLogo } from "./SiteUi";
import { phoneUrl, whatsappUrl } from "./siteHelpers";
import "./site.css";

/**
 * Fade/blur-in every section, heading, paragraph… as it scrolls into view.
 * Mirrors the original site's IntersectionObserver + MutationObserver so
 * content rendered later (after a fetch) is picked up too.
 */
function useScrollReveal(pathname: string) {
  useEffect(() => {
    const root = document.querySelector("main.axis-page");
    if (!root) return;

    const itemSelector = "section, article, figure, h1, h2, h3, h4, p, li, .axis-scroll-reveal";
    const imageSelector = "img";
    const seen = new Set<Element>();

    const itemObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("axis-reveal-visible");
            itemObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    const imageObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("axis-reveal-visible");
            imageObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" }
    );

    // Safety net: observers only report while the tab is painting. If a
    // callback never comes (background tab, throttled frame), anything
    // already inside the viewport is revealed by hand so content can't
    // stay invisible.
    let fallbackTimer: number | undefined;
    const revealInView = () => {
      const limit = window.innerHeight * 1.1;
      for (const el of seen) {
        if (el.classList.contains("axis-reveal-visible")) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < limit) el.classList.add("axis-reveal-visible");
      }
    };
    const scheduleFallback = () => {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(revealInView, 1200);
    };

    const register = (el: Element) => {
      if (seen.has(el)) return;
      seen.add(el);
      if (el.matches(imageSelector)) {
        el.classList.add("axis-reveal-image");
        imageObserver.observe(el);
        return;
      }
      el.classList.add("axis-reveal-item");
      itemObserver.observe(el);
    };

    root.querySelectorAll(itemSelector).forEach(register);
    scheduleFallback();

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(itemSelector)) register(node);
          node.querySelectorAll?.(itemSelector).forEach(register);
        });
      }
      scheduleFallback();
    });
    mutations.observe(root, { childList: true, subtree: true });
    document.addEventListener("visibilitychange", revealInView);

    return () => {
      window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", revealInView);
      itemObserver.disconnect();
      imageObserver.disconnect();
      mutations.disconnect();
    };
  }, [pathname]);
}

function AnnouncementBar() {
  const { announcement } = useSiteContent();
  if (!announcement.active || !announcement.text.trim()) return null;
  return (
    <div
      style={{ backgroundColor: announcement.bgColor || "#87b2dd", color: announcement.textColor || "#071018" }}
      className="sticky top-0 z-40 w-full px-4 py-3 text-center text-sm font-semibold sm:py-4 sm:text-base"
    >
      {announcement.text}
    </div>
  );
}

export default function SiteLayout() {
  return (
    <SiteContentProvider>
      <SiteShell />
    </SiteContentProvider>
  );
}

function SiteShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { contact } = useSiteContent();
  const preview = useSitePreview();
  useScrollReveal(location.pathname);

  const homeHref = "/";
  const links = NAV_LINKS;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="axis-site min-h-screen bg-[#050507] text-white">
      {preview && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[80] rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200 backdrop-blur">
          Preview · unsaved changes
        </div>
      )}
      <AnnouncementBar />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050507]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <SiteLogo to={homeHref} imageClassName="h-10 sm:h-12" />

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.id}
                to={l.href}
                end={l.href === "/"}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${isActive ? "text-white" : "text-white/60 hover:text-white"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 text-white md:hidden"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>

        {menuOpen && (
          <div className="absolute left-0 right-0 top-full z-[60] border-t border-white/10 bg-[#050507]/95 backdrop-blur-md md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
              {links.map((l) => (
                <NavLink
                  key={l.id}
                  to={l.href}
                  end={l.href === "/"}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `py-3 text-base font-semibold ${isActive ? "text-white" : "text-white/70"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close mobile menu"
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-transparent md:hidden"
        />
      )}

      <main className="axis-page">
        <Outlet />
      </main>

      <SiteFooter homeHref={homeHref} />

      <a
        href={whatsappUrl(contact.whatsapp)}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#87b2dd] text-2xl text-[#0b111a] shadow-lg shadow-[#87b2dd]/40 transition-transform hover:scale-110"
      >
        <span aria-hidden>💬</span>
      </a>
    </div>
  );
}

function SiteFooter({ homeHref }: { homeHref: string }) {
  const { footer, contact } = useSiteContent();
  const social =
    "grid h-10 w-10 place-items-center rounded-lg border border-[#87b2dd]/40 text-[#87b2dd] transition-colors hover:border-[#87b2dd] hover:bg-[#87b2dd]/10";
  return (
    <footer className="border-t border-white/10 bg-[#050507]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <SiteLogo to={homeHref} imageClassName="h-12 sm:h-14" />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">{footer.blurb}</p>
          <div className="mt-6 flex gap-3">
            {contact.instagram && (
              <a href={contact.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className={social}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
                </svg>
              </a>
            )}
            <a href={whatsappUrl(contact.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className={social}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.7897 3.52231 15.4574 4.42301 16.858L3.5 20.5L7.14203 19.577C8.54259 20.4777 10.2103 21 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.2 8.8C9.4 8.4 9.6 8.4 9.8 8.4H10.6C10.8 8.4 11 8.5 11.1 8.8L11.7 10.2C11.8 10.5 11.8 10.8 11.6 11L11.1 11.6C11 11.7 11 11.9 11.1 12.1C11.4 12.7 11.9 13.2 12.5 13.6C12.7 13.7 12.9 13.7 13 13.6L13.6 13.1C13.8 12.9 14.1 12.9 14.4 13L15.8 13.6C16.1 13.7 16.2 13.9 16.2 14.1V14.9C16.2 15.1 16.2 15.3 15.8 15.5C15.4 15.7 14.8 15.8 14.3 15.7C12.9 15.5 11.5 14.8 10.4 13.7C9.3 12.6 8.6 11.2 8.4 9.8C8.3 9.3 8.4 8.9 8.6 8.5L9.2 8.8Z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest text-white">Explore</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/60">
            <li>
              <Link className="hover:text-white" to="/menu">
                Café Menu
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/services">
                Services & Passes
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/events">
                Events & Tournaments
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" to="/contact">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest text-white">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/60">
            <li>
              <a className="hover:text-white" href={phoneUrl(contact.phone)}>
                {contact.phone}
              </a>
            </li>
            <li>
              <a className="hover:text-white" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </li>
            {footer.openNote && <li>{footer.openNote}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} AXIS. All rights reserved.</p>
          <p className="uppercase tracking-[0.2em]">{footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}

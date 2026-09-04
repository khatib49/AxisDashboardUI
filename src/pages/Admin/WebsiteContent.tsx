// Website content editor (Admin → Website).
// Route: /admin/website  (admin only)
//
// Every word, price, opening hour, contact detail and image on the public
// site lives in one document. Pick a section on the left, edit, watch the
// live preview, then Save to publish. Events are NOT edited here — they come
// from Admin → Events ("Show on website").

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Drawer, Dropdown, Modal, Tooltip, message } from "antd";
import {
  CalendarOutlined, CheckCircleFilled, CoffeeOutlined, EyeOutlined, HomeOutlined,
  MailOutlined, MoreOutlined, SaveOutlined, SettingOutlined, TagsOutlined, UndoOutlined,
} from "@ant-design/icons";
import PageMeta from "../../components/common/PageMeta";
import { DEFAULT_SITE_CONTENT, SiteContent } from "../Site/siteContent";
import { getSiteContent, saveSiteContent } from "../../services/siteContentService";
import { PreviewPanel, usePreviewBridge } from "./website/PreviewPanel";
import {
  ContactSection, EventsSection, GeneralSection, HomeSection, MenuSection, ServicesSection,
} from "./website/sections";

type SectionKey = "general" | "home" | "menu" | "services" | "events" | "contact";

const SECTIONS: { key: SectionKey; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "general", label: "General & Contact", desc: "Announcement, contact details, hours, footer", icon: <SettingOutlined /> },
  { key: "home", label: "Home page", desc: "Hero, overview, gallery, closing message", icon: <HomeOutlined /> },
  { key: "menu", label: "Menu page", desc: "Header of the café menu", icon: <CoffeeOutlined /> },
  { key: "services", label: "Services & Pricing", desc: "Cards, passes and prices", icon: <TagsOutlined /> },
  { key: "events", label: "Events page", desc: "Header and wording", icon: <CalendarOutlined /> },
  { key: "contact", label: "Contact page", desc: "Header and form wording", icon: <MailOutlined /> },
];

function relativeTime(d: Date, now: number): string {
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** True when the viewport matches the CSS media query (kept in sync). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function WebsiteContent() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [baseline, setBaseline] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [section, setSection] = useState<SectionKey>("general");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Side-by-side preview needs room; below this the preview opens over the form.
  const wide = useMediaQuery("(min-width: 1280px)");
  usePreviewBridge(previewOpen, content);

  const load = useCallback(async () => {
    try {
      const c = await getSiteContent();
      setContent(c);
      setBaseline(JSON.stringify(c));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as { message?: string })?.message || "Could not load the website content.");
      const c = structuredClone(DEFAULT_SITE_CONTENT);
      setContent(c);
      setBaseline(JSON.stringify(c));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Ticks the "saved x ago" label.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  const dirty = useMemo(() => content !== null && JSON.stringify(content) !== baseline, [content, baseline]);

  /** Apply a mutation to a fresh copy of the document. */
  const patch = useCallback((fn: (draft: SiteContent) => void) => {
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!content || saving) return;
    setSaving(true);
    try {
      await saveSiteContent(content);
      setBaseline(JSON.stringify(content));
      setSavedAt(new Date());
      setNow(Date.now());
      message.success("Website published — visitors see the new content on their next visit.");
    } catch (e) {
      message.error((e as { message?: string })?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [content, saving]);

  const discard = () => {
    if (!baseline) return;
    setContent(JSON.parse(baseline));
    message.info("Changes discarded.");
  };

  const resetDefaults = () => {
    setContent(structuredClone(DEFAULT_SITE_CONTENT));
    message.info("Original content restored — press Save to publish it.");
  };

  // Don't lose edits on an accidental close, and let Ctrl/Cmd+S save.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
    };
  }, [dirty, save]);

  if (!content) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-500">
        <span className="inline-flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading website content…
        </span>
      </div>
    );
  }

  const active = SECTIONS.find((s) => s.key === section)!;
  const sectionProps = { c: content, patch };
  const body = {
    general: <GeneralSection {...sectionProps} />,
    home: <HomeSection {...sectionProps} />,
    menu: <MenuSection {...sectionProps} />,
    services: <ServicesSection {...sectionProps} />,
    events: <EventsSection {...sectionProps} />,
    contact: <ContactSection {...sectionProps} />,
  }[section];

  const status = dirty ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Unsaved changes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300">
      <CheckCircleFilled />
      {savedAt ? `Published ${relativeTime(savedAt, now)}` : "Up to date"}
    </span>
  );

  return (
    <div className="space-y-5">
      <PageMeta title="Website — AXIS Admin" description="Edit the public AXIS website content" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Website</h1>
            {status}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Everything visitors see on the public site. Edit, check the live preview, then press Save to publish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen((o) => !o)} type={previewOpen ? "default" : "default"}>
            {previewOpen ? "Hide preview" : "Live preview"}
          </Button>
          <Tooltip title={dirty ? "Throw away your unsaved edits" : "Nothing to discard"}>
            <Button icon={<UndoOutlined />} disabled={!dirty} onClick={discard}>
              Discard
            </Button>
          </Tooltip>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!dirty} onClick={save}>
            Save & publish
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "reload", label: "Reload from server", onClick: () => void load() },
                { key: "site", label: "Open the live site", onClick: () => window.open("/", "_blank", "noreferrer") },
                { type: "divider" },
                {
                  key: "reset",
                  danger: true,
                  label: "Restore original content…",
                  onClick: () =>
                    Modal.confirm({
                      title: "Restore the original content?",
                      content:
                        "Wording, prices, hours and images go back to the originals on screen. Nothing changes on the site until you press Save.",
                      okText: "Restore",
                      okButtonProps: { danger: true },
                      onOk: resetDefaults,
                    }),
                },
              ],
            }}
          >
            <Button icon={<MoreOutlined />} aria-label="More actions" />
          </Dropdown>
        </div>
      </div>

      {loadError && (
        <Alert
          type="warning"
          showIcon
          message="Could not load the saved content"
          description={`${loadError} — showing the original content instead. Saving now would overwrite what is stored.`}
        />
      )}

      {/* Body: section nav + form, with the live preview beside them on wide screens */}
      <div className={`grid gap-5 ${previewOpen && wide ? "xl:grid-cols-[minmax(0,1fr)_minmax(400px,46%)]" : ""}`}>
        <div className={`@container grid min-w-0 gap-5 ${previewOpen ? "" : "xl:grid-cols-[260px_minmax(0,1fr)]"}`}>
          <nav className={previewOpen ? "" : "xl:sticky xl:top-24 xl:self-start"} aria-label="Website sections">
            <div className={`flex gap-2 overflow-x-auto pb-1 ${previewOpen ? "" : "xl:flex-col xl:overflow-visible xl:pb-0"}`}>
              {SECTIONS.map((s) => {
                const isActive = s.key === section;
                const vertical = !previewOpen;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${vertical ? "xl:w-full" : ""} ${
                      isActive
                        ? "border-brand-200 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                        : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-white dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${
                        isActive ? "bg-white text-brand-600 dark:bg-brand-500/20 dark:text-brand-200" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                      }`}
                    >
                      {s.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{s.label}</span>
                      {vertical && <span className="hidden text-xs text-gray-500 xl:block dark:text-gray-400">{s.desc}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {active.icon}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{active.label}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{active.desc}</p>
              </div>
            </div>
            {body}
          </div>
        </div>

        {previewOpen && wide && (
          <aside className="xl:sticky xl:top-20 xl:h-[calc(100vh-6.5rem)]">
            <PreviewPanel onClose={() => setPreviewOpen(false)} />
          </aside>
        )}
      </div>

      {/* Narrow screens: the preview opens over the form instead of beside it */}
      {!wide && (
        <Drawer
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          placement="bottom"
          height="92vh"
          closable={false}
          styles={{ body: { padding: 12 }, header: { display: "none" } }}
        >
          <PreviewPanel onClose={() => setPreviewOpen(false)} className="h-[calc(92vh-24px)]" />
        </Drawer>
      )}

      {/* Floating save bar */}
      {dirty && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-theme-lg backdrop-blur dark:border-white/10 dark:bg-gray-900/95">
          <span className="text-sm text-gray-700 dark:text-gray-200">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
            Unsaved changes
          </span>
          <Button size="small" onClick={discard}>
            Discard
          </Button>
          <Button size="small" type="primary" loading={saving} onClick={save} icon={<SaveOutlined />}>
            Save & publish
          </Button>
        </div>
      )}

    </div>
  );
}

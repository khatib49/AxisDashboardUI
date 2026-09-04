// Live preview of the public site while editing. The draft is handed to the
// site through localStorage: the iframe (same origin) reads it on load and
// on every change, so the preview updates as you type — before saving.
//
// On wide screens the panel sits next to the form; on smaller screens it
// opens full-width over it (see WebsiteContent).
import { useEffect, useState } from "react";
import { Button, Segmented, Tooltip } from "antd";
import { CloseOutlined, DesktopOutlined, ExportOutlined, MobileOutlined, ReloadOutlined } from "@ant-design/icons";
import { SiteContent } from "../../Site/siteContent";

export const PREVIEW_STORAGE_KEY = "axis-site-preview";

const PAGES = [
  { label: "Home", path: "/" },
  { label: "Menu", path: "/menu" },
  { label: "Services", path: "/services" },
  { label: "Events", path: "/events" },
  { label: "Contact", path: "/contact" },
];

/** Publishes the draft for the preview iframe while `open`; clears it otherwise. */
// eslint-disable-next-line react-refresh/only-export-components
export function usePreviewBridge(open: boolean, content: SiteContent | null) {
  useEffect(() => {
    try {
      if (open && content) localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(content));
      else localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {
      /* storage unavailable — preview simply shows the saved site */
    }
  }, [open, content]);

  useEffect(
    () => () => {
      try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch { /* ignore */ }
    },
    []
  );
}

export function PreviewPanel({ onClose, className = "" }: { onClose: () => void; className?: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [page, setPage] = useState("/");
  const [nonce, setNonce] = useState(0);
  const mobile = device === "mobile";

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card dark:border-white/10 dark:bg-gray-900 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-white/10">
        <div className="mr-auto flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">Live preview</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            unsaved changes included
          </span>
        </div>
        <Segmented size="small" value={page} onChange={(v) => setPage(String(v))} options={PAGES.map((p) => ({ label: p.label, value: p.path }))} />
        <Segmented
          size="small"
          value={device}
          onChange={(v) => setDevice(v as "desktop" | "mobile")}
          options={[
            { value: "desktop", icon: <DesktopOutlined /> },
            { value: "mobile", icon: <MobileOutlined /> },
          ]}
        />
        <Tooltip title="Reload preview">
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setNonce((n) => n + 1)} />
        </Tooltip>
        <Tooltip title="Open the live site in a new tab">
          <Button size="small" icon={<ExportOutlined />} href={page} target="_blank" />
        </Tooltip>
        <Tooltip title="Close preview">
          <Button size="small" icon={<CloseOutlined />} onClick={onClose} />
        </Tooltip>
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[#050507] p-3">
        <iframe
          key={`${nonce}-${page}`}
          src={page}
          title="Website preview"
          className={
            mobile
              ? "h-[760px] w-[390px] shrink-0 rounded-[2rem] border-[10px] border-gray-800 bg-black shadow-2xl"
              : "h-full min-h-[520px] w-full rounded-lg border border-white/10 bg-black"
          }
        />
      </div>
    </div>
  );
}

// Live preview of the public site while editing. The draft is handed to the
// site through localStorage: the iframe (same origin) reads it on load and
// on every change, so the preview updates as you type — before saving.
import { useEffect, useState } from "react";
import { Button, Drawer, Segmented, Tooltip } from "antd";
import { DesktopOutlined, ExportOutlined, MobileOutlined, ReloadOutlined } from "@ant-design/icons";
import { SiteContent } from "../../Site/siteContent";

export const PREVIEW_STORAGE_KEY = "axis-site-preview";

const PAGES = [
  { label: "Home", path: "/home" },
  { label: "Menu", path: "/menu" },
  { label: "Services", path: "/services" },
  { label: "Events", path: "/events" },
  { label: "Contact", path: "/contact" },
];

export function PreviewDrawer({ open, onClose, content }: { open: boolean; onClose: () => void; content: SiteContent | null }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [page, setPage] = useState("/home");
  const [nonce, setNonce] = useState(0);

  // Publish the draft for the iframe on every change; clear it when closed.
  useEffect(() => {
    if (!open || !content) {
      try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    try { localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(content)); } catch { /* ignore */ }
  }, [open, content]);

  useEffect(() => () => {
    try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const mobile = device === "mobile";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      mask={false}
      placement="right"
      width={mobile ? 470 : "min(1100px, 88vw)"}
      title={
        <div className="flex flex-wrap items-center gap-3">
          <span>Live preview</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            shows unsaved changes
          </span>
        </div>
      }
      extra={
        <div className="flex items-center gap-2">
          <Segmented
            size="small"
            value={page}
            onChange={(v) => setPage(String(v))}
            options={PAGES.map((p) => ({ label: p.label, value: p.path }))}
          />
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
        </div>
      }
      styles={{ body: { padding: 0, background: "#050507" }, header: { paddingTop: 12, paddingBottom: 12 } }}
    >
      <div className="flex h-full items-start justify-center overflow-auto bg-[#050507] p-3">
        <iframe
          key={`${nonce}-${page}`}
          src={page}
          title="Website preview"
          className={
            mobile
              ? "h-[780px] w-[390px] shrink-0 rounded-[2rem] border-[10px] border-gray-800 bg-black shadow-2xl"
              : "h-full min-h-[600px] w-full rounded-lg border border-white/10 bg-black"
          }
        />
      </div>
    </Drawer>
  );
}

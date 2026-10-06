// SupplierKit — presentation helpers for the Suppliers page
// (/chef/suppliers). Pure UI: the page owns all state, API calls and
// handlers; these only render what they are given.

import { Button, Tooltip } from "antd";
import { EditOutlined, EnvironmentOutlined, EyeInvisibleOutlined, MailOutlined, PhoneOutlined } from "@ant-design/icons";
import type { SupplierDto } from "../../services/supplierService";
import { Pill } from "../ui/PageKit";

type ContactPart = { kind: "email" | "phone" | "text"; value: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mostly digits, with the usual phone punctuation; at least 6 digits.
const PHONE_RE = /^\+?[\d\s().-]{6,}$/;

/**
 * Contact info is one free-text field ("phone / email / address"). Split it
 * on the obvious separators (new line, ";", "|", " / ") and tag each part so
 * emails and phone numbers get an icon and a link. Commas are left alone —
 * they usually belong to an address.
 */
function parseContact(raw: string | null): ContactPart[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/\s*[\n;|]\s*|\s+\/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      if (EMAIL_RE.test(value)) return { kind: "email" as const, value };
      if (PHONE_RE.test(value) && value.replace(/\D/g, "").length >= 6) return { kind: "phone" as const, value };
      return { kind: "text" as const, value };
    });
}

/** Contact info laid out one line per part, with icons and mailto / tel links. */
export function SupplierContact({ raw }: { raw: string | null }) {
  const parts = parseContact(raw);
  if (parts.length === 0) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return (
    <ul className="min-w-0 space-y-1 text-sm">
      {parts.map((p, i) => (
        <li key={i} className="flex min-w-0 items-start gap-2">
          <span aria-hidden className="mt-0.5 shrink-0 text-gray-400">
            {p.kind === "email" ? <MailOutlined /> : p.kind === "phone" ? <PhoneOutlined /> : <EnvironmentOutlined />}
          </span>
          {p.kind === "email" ? (
            <a href={`mailto:${p.value}`} className="min-w-0 break-all text-gray-700 hover:text-violet-700 hover:underline dark:text-gray-300 dark:hover:text-violet-300">{p.value}</a>
          ) : p.kind === "phone" ? (
            <a href={`tel:${p.value.replace(/[^\d+]/g, "")}`} className="min-w-0 whitespace-nowrap tabular-nums text-gray-700 hover:text-violet-700 hover:underline dark:text-gray-300 dark:hover:text-violet-300">{p.value}</a>
          ) : (
            <span className="min-w-0 break-words text-gray-700 dark:text-gray-300">{p.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Initials avatar for a supplier row. */
export function SupplierAvatar({ name, muted }: { name: string; muted?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
        muted ? "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      }`}
    >
      {initials}
    </span>
  );
}

export function SupplierStatus({ active }: { active: boolean }) {
  return active ? <Pill tone="emerald" dot>Active</Pill> : <Pill tone="gray" dot>Hidden</Pill>;
}

/** Visible row actions, shared by the table and the mobile cards. */
export function SupplierRowActions({ r, onEdit, onHide, stretch }: {
  r: SupplierDto; onEdit: (r: SupplierDto) => void; onHide: (r: SupplierDto) => void; stretch?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${stretch ? "" : "justify-end"}`}>
      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} className={stretch ? "flex-1" : ""} aria-label={`Edit ${r.name}`}>
        Edit
      </Button>
      {r.isActive && (
        <Tooltip title="Hide — historical purchases stay intact">
          <Button size="small" danger icon={<EyeInvisibleOutlined />} onClick={() => onHide(r)} className={stretch ? "flex-1" : ""} aria-label={`Hide ${r.name}`}>
            Hide
          </Button>
        </Tooltip>
      )}
    </div>
  );
}

/** One supplier as a stacked card (below md). */
export function SupplierCard({ r, onEdit, onHide }: { r: SupplierDto; onEdit: (r: SupplierDto) => void; onHide: (r: SupplierDto) => void }) {
  return (
    <li className="min-w-0 rounded-xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <SupplierAvatar name={r.name} muted={!r.isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate font-semibold text-gray-900 dark:text-gray-100">{r.name}</span>
            <SupplierStatus active={r.isActive} />
          </div>
          {r.notes && <p className="mt-0.5 line-clamp-2 break-words text-xs text-gray-500 dark:text-gray-400">{r.notes}</p>}
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
        <div className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">Contact</div>
        <SupplierContact raw={r.contactInfo} />
      </div>
      <div className="mt-3">
        <SupplierRowActions r={r} onEdit={onEdit} onHide={onHide} stretch />
      </div>
    </li>
  );
}

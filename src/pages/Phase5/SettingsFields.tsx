import { useEffect, useState } from "react";
import { btnPrimary, inputCls } from "../../components/phase4/ui";
import { listIntegrationSettings, saveIntegrationSetting, type IntegrationSetting } from "../../services/phase5Service";

export type FieldDef = { key: string; label: string; secret?: boolean; placeholder?: string; help?: string };

/** Edits a few IntegrationSettings keys. Secrets show "set" and are only replaced when typed. */
export default function SettingsFields({ fields, onSaved }: { fields: FieldDef[]; onSaved?: (msg: string) => void }) {
  const [rows, setRows] = useState<Record<string, IntegrationSetting>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => listIntegrationSettings().then((l) => {
    const m: Record<string, IntegrationSetting> = {}; l.forEach((r) => { m[r.key] = r; }); setRows(m);
    setValues(Object.fromEntries(fields.map((f) => [f.key, f.secret ? "" : (m[f.key]?.value ?? "")])));
  }).catch((e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save() {
    setBusy(true); setErr(null);
    try {
      for (const f of fields) {
        const v = values[f.key] ?? "";
        if (f.secret && v === "") continue;
        if (!f.secret && v === (rows[f.key]?.value ?? "")) continue;
        await saveIntegrationSetting(f.key, v);
      }
      await load(); onSaved?.("Settings saved.");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block text-xs text-gray-600 dark:text-gray-400">
          {f.label} <span className="font-mono text-[10px] text-gray-400">{f.key}</span>
          <input className={`${inputCls} mt-1`} type={f.secret ? "password" : "text"} autoComplete="off" value={values[f.key] ?? ""}
            placeholder={f.secret ? (rows[f.key]?.hasValue ? "•••••• (set, type to replace)" : "not set") : f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          {f.help && <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">{f.help}</span>}
        </label>
      ))}
      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save settings"}</button>
    </div>
  );
}

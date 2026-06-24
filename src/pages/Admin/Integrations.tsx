// Integrations
// ============
// Where the admin pastes API keys for Anthropic (Claude) and WhatsApp
// (Meta Cloud API). Secret values are never returned in plaintext from
// the API — only the last 4 chars are visible, so the admin can verify
// what's saved without exposing the full key.

import { useEffect, useState } from "react";
import {
  IntegrationSetting, IntegrationTestResult,
  integrationSettingsService,
} from "../../services/integrationSettingsService";

// Friendly grouping for the page
const GROUPS: { title: string; subtitle: string; keys: string[] }[] = [
  {
    title: "Anthropic (Claude AI)",
    subtitle: "API key for the chatbot. Get one at console.anthropic.com.",
    keys: ["Anthropic.ApiKey", "Anthropic.Model"],
  },
  {
    title: "WhatsApp (Meta Cloud API)",
    subtitle: "Credentials from Meta Business Manager → WhatsApp app.",
    keys: ["WhatsApp.PhoneNumberId", "WhatsApp.AccessToken", "WhatsApp.BusinessAccountId", "WhatsApp.DefaultTemplate"],
  },
  {
    title: "AI Autonomous Monitors",
    subtitle: "Toggle the Hangfire jobs that propose actions on their own.",
    keys: ["AiMonitor.OccupancyEnabled", "AiMonitor.PatternsEnabled", "AiMonitor.OccupancyThresholdPct"],
  },
];

function SettingRow({ s, onChange }: { s: IntegrationSetting; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(""); setEditing(true); };
  const cancel    = () => { setEditing(false); setDraft(""); };

  const save = async () => {
    setSaving(true);
    try {
      await integrationSettingsService.upsert(s.key, draft);
      setEditing(false); setDraft(""); onChange();
    } finally { setSaving(false); }
  };

  // What to display when not editing
  const displayed = s.isSet
    ? (s.isSecret ? s.value : s.value)
    : <span className="text-gray-400 italic">not set</span>;

  return (
    <div className="border-b border-gray-100 py-3 grid grid-cols-12 gap-3 items-center">
      <div className="col-span-4">
        <div className="font-mono text-xs text-gray-700">{s.key}</div>
        {s.description && <div className="text-[11px] text-gray-500 mt-0.5">{s.description}</div>}
      </div>

      <div className="col-span-5">
        {editing ? (
          <input
            type={s.isSecret ? "password" : "text"}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            placeholder={s.isSecret ? "Paste new value (will replace existing)" : "Value"}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <div className="text-sm font-mono text-gray-800">{displayed}</div>
        )}
      </div>

      <div className="col-span-3 flex gap-2 justify-end">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={saving}
              className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
            >{saving ? "Saving…" : "Save"}</button>
            <button onClick={cancel} className="px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={startEdit} className="px-2 py-1 bg-gray-100 text-xs rounded hover:bg-gray-200">
              {s.isSet ? "Change" : "Set"}
            </button>
            {s.isSet && (
              <button
                onClick={async () => {
                  if (confirm(`Clear ${s.key}?`)) {
                    await integrationSettingsService.upsert(s.key, "");
                    onChange();
                  }
                }}
                className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100"
              >Clear</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSetting[]>([]);
  const [loading, setLoading]   = useState(false);
  const [tests, setTests]       = useState<Record<string, IntegrationTestResult | "running">>({});

  const reload = async () => {
    setLoading(true);
    try { setSettings(await integrationSettingsService.list()); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const runTest = async (which: "anthropic" | "whatsapp") => {
    setTests(t => ({ ...t, [which]: "running" }));
    try {
      const res = which === "anthropic"
        ? await integrationSettingsService.testAnthropic()
        : await integrationSettingsService.testWhatsApp();
      setTests(t => ({ ...t, [which]: res }));
    } catch (e: any) {
      setTests(t => ({ ...t, [which]: { ok: false, message: e?.message ?? "failed" } }));
    }
  };

  const byKey = new Map(settings.map(s => [s.key, s]));

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          API keys for Claude AI and WhatsApp. Secrets are never returned in plaintext — only the last 4 chars are shown.
        </p>
      </div>

      {loading && <div className="text-gray-400">Loading…</div>}

      {GROUPS.map(g => (
        <section key={g.title} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
          <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">{g.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{g.subtitle}</p>
            </div>
            {g.title.startsWith("Anthropic") && (
              <button
                onClick={() => runTest("anthropic")}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >Test connection</button>
            )}
            {g.title.startsWith("WhatsApp") && (
              <button
                onClick={() => runTest("whatsapp")}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >Test connection</button>
            )}
          </header>

          {(g.title.startsWith("Anthropic") && tests.anthropic) && <TestResult t={tests.anthropic} />}
          {(g.title.startsWith("WhatsApp")  && tests.whatsapp)  && <TestResult t={tests.whatsapp} />}

          <div className="px-5">
            {g.keys.map(k => {
              const s = byKey.get(k);
              if (!s) return null;
              return <SettingRow key={k} s={s} onChange={reload} />;
            })}
          </div>
        </section>
      ))}

      <section className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">WhatsApp setup checklist</div>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Create a Meta Business account and verify the lounge as a business.</li>
          <li>In Meta Business Manager → WhatsApp → add a phone number, get its <b>Phone Number ID</b>.</li>
          <li>Generate a <b>long-lived System User Access Token</b> (not the 24h test token).</li>
          <li>Submit at least these message templates for approval: <code>tournament_invite</code>, <code>slot_reservation</code>.</li>
          <li>Paste the Phone Number ID + Access Token above, then hit "Test connection".</li>
        </ol>
      </section>
    </div>
  );
}

function TestResult({ t }: { t: IntegrationTestResult | "running" }) {
  if (t === "running")
    return <div className="px-5 py-2 bg-gray-50 text-gray-600 text-sm">Testing…</div>;
  return (
    <div className={"px-5 py-2 text-sm " + (t.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
      {t.ok ? "✓ " : "✗ "} {t.message ?? (t.ok ? "OK" : "Failed")}
    </div>
  );
}

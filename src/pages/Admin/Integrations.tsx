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
import { testAramex, apiErrorMessage } from "../../services/shippingService";

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
  {
    title: "MontyPay (online card payments)",
    subtitle: "Hosted checkout for event tickets, wallet top-ups, invoices and pay links. Keep sandbox and production side by side; the switch below picks the live one.",
    keys: [
      "MontyPay.Environment",
      "MontyPay.Sandbox.CheckoutUrl", "MontyPay.Sandbox.MerchantKey", "MontyPay.Sandbox.Password",
      "MontyPay.Production.CheckoutUrl", "MontyPay.Production.MerchantKey", "MontyPay.Production.Password",
      "MontyPay.HashAlgorithm", "MontyPay.SendNotificationUrl",
      "Payments.PublicBaseUrl", "Payments.ApiBaseUrl",
    ],
  },
  {
    title: "Aramex (delivery)",
    subtitle: "Shipping API credentials from your Aramex account manager (ClientInfo). Sandbox and production side by side; the switch below picks the live one. Shop switches, zones and shipments live on Shipping & Aramex.",
    keys: [
      "Aramex.Environment",
      "Aramex.Sandbox.UserName", "Aramex.Sandbox.Password", "Aramex.Sandbox.AccountNumber", "Aramex.Sandbox.AccountPin", "Aramex.Sandbox.AccountEntity",
      "Aramex.Production.UserName", "Aramex.Production.Password", "Aramex.Production.AccountNumber", "Aramex.Production.AccountPin", "Aramex.Production.AccountEntity",
      "Aramex.AccountCountryCode", "Aramex.Source", "Aramex.ProductGroup", "Aramex.ProductType", "Aramex.PaymentType", "Aramex.CodCurrency",
      "Aramex.LabelReportId", "Aramex.DescriptionOfGoods", "Aramex.TrackingPollMinutes",
    ],
  },
  {
    title: "Whish Collect (e-wallet)",
    subtitle: "Whish Money merchant credentials for event tickets.",
    keys: ["Whish.Channel", "Whish.Secret", "Whish.WebsiteUrl", "Whish.BaseUrl", "Event.PublicBaseUrl", "Event.WhatsAppNumber"],
  },
];

// Keys the UI knows about even before the SQL seed ran — shown as "not set"
// so the admin can fill them in (upsert creates the row).
const KNOWN_DESCRIPTIONS: Record<string, string> = {
  "MontyPay.Environment": "sandbox or production — which credentials are live",
  "MontyPay.Sandbox.CheckoutUrl": "Sandbox CHECKOUT_URL from your MontyPay account manager",
  "MontyPay.Sandbox.MerchantKey": "Sandbox merchant key (Test key)",
  "MontyPay.Sandbox.Password": "Sandbox merchant password (used only to sign requests)",
  "MontyPay.Production.CheckoutUrl": "Production CHECKOUT_URL",
  "MontyPay.Production.MerchantKey": "Production merchant key",
  "MontyPay.Production.Password": "Production merchant password",
  "MontyPay.HashAlgorithm": "md5 (default) or sha256 — must match your MontyPay protocol mapping",
  "MontyPay.SendNotificationUrl": "true = send our callback URL with every session; false = rely on the URL set in MontyPay's panel",
  "Payments.PublicBaseUrl": "Website base for pay links (falls back to Event.PublicBaseUrl)",
  "Payments.ApiBaseUrl": "Public API base for callbacks (auto-detected when empty)",
  "Aramex.Environment": "sandbox or production — which Aramex credentials and host are live",
  "Aramex.Sandbox.UserName": "Sandbox ClientInfo UserName (email)",
  "Aramex.Sandbox.Password": "Sandbox ClientInfo Password",
  "Aramex.Sandbox.AccountNumber": "Sandbox AccountNumber",
  "Aramex.Sandbox.AccountPin": "Sandbox AccountPin",
  "Aramex.Sandbox.AccountEntity": "Sandbox AccountEntity (e.g. BEY)",
  "Aramex.Production.UserName": "Production ClientInfo UserName (email)",
  "Aramex.Production.Password": "Production ClientInfo Password",
  "Aramex.Production.AccountNumber": "Production AccountNumber",
  "Aramex.Production.AccountPin": "Production AccountPin",
  "Aramex.Production.AccountEntity": "Production AccountEntity (e.g. BEY)",
  "Aramex.AccountCountryCode": "Account country ISO-2 (LB)",
  "Aramex.Source": "ClientInfo Source (default 24)",
  "Aramex.ProductGroup": "DOM (domestic) or EXP (express/international)",
  "Aramex.ProductType": "Service type — OND for domestic on-demand, PPX/PDX for express",
  "Aramex.PaymentType": "P = prepaid (shipper pays), C = collect",
  "Aramex.CodCurrency": "Currency Aramex collects COD in (USD or LBP)",
  "Aramex.LabelReportId": "Label report template id (default 9729)",
  "Aramex.DescriptionOfGoods": "Text printed on the AWB (e.g. Retail goods)",
  "Aramex.TrackingPollMinutes": "How often the background job polls tracking for open shipments (0 = off)",
};

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

  const runTest = async (which: "anthropic" | "whatsapp" | "aramex") => {
    setTests(t => ({ ...t, [which]: "running" }));
    try {
      let res: IntegrationTestResult;
      if (which === "anthropic") res = await integrationSettingsService.testAnthropic();
      else if (which === "whatsapp") res = await integrationSettingsService.testWhatsApp();
      else {
        const r = await testAramex();
        res = { ok: r.ok, message: r.ok && r.rateAmount != null ? `${r.message ?? "OK"} · sample rate ${r.rateAmount} ${r.rateCurrency ?? ""}`.trim() : r.message ?? null };
      }
      setTests(t => ({ ...t, [which]: res }));
    } catch (e: unknown) {
      setTests(t => ({ ...t, [which]: { ok: false, message: apiErrorMessage(e, "failed") } }));
    }
  };

  const byKey = new Map(settings.map(s => [s.key, s]));
  // Placeholder row for a known key that has no DB row yet.
  const rowFor = (k: string): IntegrationSetting | undefined =>
    byKey.get(k) ?? (KNOWN_DESCRIPTIONS[k]
      ? { id: 0, key: k, value: null, isSecret: /password|secret|key$|accountpin/i.test(k) && !/MerchantKey/.test(k), isSet: false, description: KNOWN_DESCRIPTIONS[k], updatedBy: null, updatedOn: "" }
      : undefined);

  const aramexEnv = byKey.get("Aramex.Environment")?.value ?? "sandbox";
  const [switchingAramex, setSwitchingAramex] = useState(false);
  const switchAramexEnv = async (env: "sandbox" | "production") => {
    if (env === "production" && !confirm("Switch Aramex to PRODUCTION? Real shipments will be created and billed to your Aramex account from now on.")) return;
    setSwitchingAramex(true);
    try { await integrationSettingsService.upsert("Aramex.Environment", env); await reload(); }
    finally { setSwitchingAramex(false); }
  };

  const montyEnv = byKey.get("MontyPay.Environment")?.value ?? "sandbox";
  const [switching, setSwitching] = useState(false);
  const switchEnv = async (env: "sandbox" | "production") => {
    if (env === "production" && !confirm("Switch MontyPay to PRODUCTION? Real cards will be charged from now on.")) return;
    setSwitching(true);
    try { await integrationSettingsService.upsert("MontyPay.Environment", env); await reload(); }
    finally { setSwitching(false); }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          API keys for Claude AI, WhatsApp, MontyPay, Aramex and Whish. Secrets are never returned in plaintext — only the last 4 chars are shown.
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
            {g.title.startsWith("Aramex") && (
              <button
                onClick={() => runTest("aramex")}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >Test connection</button>
            )}
          </header>

          {(g.title.startsWith("Anthropic") && tests.anthropic) && <TestResult t={tests.anthropic} />}
          {(g.title.startsWith("WhatsApp")  && tests.whatsapp)  && <TestResult t={tests.whatsapp} />}
          {(g.title.startsWith("Aramex")    && tests.aramex)    && <TestResult t={tests.aramex} />}

          {g.title.startsWith("Aramex") && (
            <div className={`mx-5 mt-4 rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap ${aramexEnv === "production" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Environment: <span className={aramexEnv === "production" ? "text-emerald-700" : "text-amber-700"}>{aramexEnv.toUpperCase()}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Test host ws.dev.aramex.net / Live host ws.aramex.net.
                  {" "}Zones, shipper profile and shipments are on <a href="/admin/shipments" className="text-indigo-600 underline">Shipping & Aramex</a>.
                </div>
              </div>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                <button disabled={switchingAramex} onClick={() => switchAramexEnv("sandbox")}
                  className={`px-4 h-9 text-xs font-semibold ${aramexEnv !== "production" ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Sandbox</button>
                <button disabled={switchingAramex} onClick={() => switchAramexEnv("production")}
                  className={`px-4 h-9 text-xs font-semibold ${aramexEnv === "production" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Production</button>
              </div>
            </div>
          )}

          {g.title.startsWith("MontyPay") && (
            <div className={`mx-5 mt-4 rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap ${montyEnv === "production" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Environment: <span className={montyEnv === "production" ? "text-emerald-700" : "text-amber-700"}>{montyEnv.toUpperCase()}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {montyEnv === "production" ? "Real cards are charged." : "Test mode — use card 4111 1111 1111 1111, expiry 01/38, any CVV."}
                  {" "}Callback URL and status are on <a href="/admin/online-payments" className="text-indigo-600 underline">Online Payments</a>.
                </div>
              </div>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                <button disabled={switching} onClick={() => switchEnv("sandbox")}
                  className={`px-4 h-9 text-xs font-semibold ${montyEnv !== "production" ? "bg-amber-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Sandbox</button>
                <button disabled={switching} onClick={() => switchEnv("production")}
                  className={`px-4 h-9 text-xs font-semibold ${montyEnv === "production" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>Production</button>
              </div>
            </div>
          )}

          <div className="px-5">
            {g.keys.map(k => {
              const s = rowFor(k);
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

import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { Card, Notice, btnDanger, btnGhost, btnPrimary, inputCls, money, td, th } from "../../components/phase4/ui";
import {
  createCardTerminal, deleteCardTerminal, getTerminalReport, listCardTerminals, updateCardTerminal,
  type CardTerminalDto, type CardTerminalProvider, type CardTerminalUpsertDto, type TerminalReportDto,
} from "../../services/phase4Service";

const EMPTY: CardTerminalUpsertDto & { id?: number } = { name: "", provider: "Manual", providerTerminalId: "", isActive: true };
const PROVIDERS: { value: CardTerminalProvider; label: string; help: string }[] = [
  { value: "Manual", label: "Stand-alone terminal", help: "The cashier keys the amount on the bank terminal and types the approval code into Axis. Works with any terminal today." },
  { value: "CloudHttp", label: "Connected terminal (API)", help: "Axis sends the amount to the terminal through the bank or provider API set in Integrations (CardTerminal.Cloud.BaseUrl and ApiKey). Needs the terminal id (TID)." },
  { value: "Simulator", label: "Simulator (testing only)", help: "Approves after 3 seconds; amounts ending in .13 are declined. Works only when CardTerminal.AllowSimulator = true." },
];
const today = () => new Date().toISOString().slice(0, 10);

/** Admin: card terminals per register and the card reconciliation report. */
export default function CardTerminalsAdmin() {
  const [terminals, setTerminals] = useState<CardTerminalDto[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<TerminalReportDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const fail = (e: unknown) => setNotice({ kind: "error", text: (e as Error).message });

  const reload = () => listCardTerminals(true).then(setTerminals).catch(fail);
  const loadReport = () => {
    const end = new Date(to); end.setDate(end.getDate() + 1);
    return getTerminalReport(new Date(from).toISOString(), end.toISOString()).then(setReport).catch(fail);
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => { void loadReport(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true); setNotice(null);
    const dto = { name: form.name, provider: form.provider, providerTerminalId: form.providerTerminalId?.trim() || null, branchId: form.branchId ?? null, isActive: form.isActive };
    try {
      if (form.id) await updateCardTerminal(form.id, dto); else await createCardTerminal(dto);
      setNotice({ kind: "ok", text: "Terminal saved." }); setForm(EMPTY); await reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  const help = PROVIDERS.find((p) => p.value === form.provider)?.help;
  return (
    <div className="p-4 sm:p-6">
      <PageMeta title="Card Terminals | Axis" description="Card terminals and card reconciliation" />
      <PageBreadcrumb pageTitle="Card Terminals" />
      {notice && <Notice kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={form.id ? "Edit terminal" : "Add a terminal"}>
          <div className="space-y-3">
            <label className="block text-xs text-gray-600 dark:text-gray-400">Name
              <input className={`${inputCls} mt-1`} placeholder="Register 1 terminal" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="block text-xs text-gray-600 dark:text-gray-400">Type
              <select className={`${inputCls} mt-1`} value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as CardTerminalProvider }))}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {help && <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>}
            <label className="block text-xs text-gray-600 dark:text-gray-400">Terminal id (TID){form.provider === "CloudHttp" ? "" : " · optional"}
              <input className={`${inputCls} mt-1`} value={form.providerTerminalId ?? ""} onChange={(e) => setForm((f) => ({ ...f, providerTerminalId: e.target.value }))} />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active</label>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy || !form.name.trim()} onClick={() => void save()}>{form.id ? "Save" : "Add terminal"}</button>
              {form.id && <button type="button" className={btnGhost} onClick={() => setForm(EMPTY)}>Cancel</button>}
            </div>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {terminals.map((t) => (
              <li key={t.id} className={`flex items-center justify-between gap-2 py-2 text-sm ${t.isActive ? "" : "opacity-60"}`}>
                <span className="text-gray-800 dark:text-white/90">{t.name}<span className="block text-xs text-gray-500 dark:text-gray-400">{PROVIDERS.find((p) => p.value === t.provider)?.label}{t.providerTerminalId ? ` · ${t.providerTerminalId}` : ""}{t.busy ? " · busy" : ""}{t.isActive ? "" : " · inactive"}</span></span>
                <span className="flex gap-2">
                  <button type="button" className={btnGhost} onClick={() => setForm({ id: t.id, name: t.name, provider: t.provider, providerTerminalId: t.providerTerminalId ?? "", branchId: t.branchId ?? null, isActive: t.isActive })}>Edit</button>
                  <button type="button" className={btnDanger} onClick={() => { if (window.confirm(`Delete ${t.name}?`)) void deleteCardTerminal(t.id).then((m) => { setNotice({ kind: "info", text: m }); return reload(); }).catch(fail); }}>Delete</button>
                </span>
              </li>
            ))}
            {terminals.length === 0 && <li className="py-2 text-sm text-gray-500 dark:text-gray-400">No terminals yet.</li>}
          </ul>
        </Card>

        <Card title="Card payments" className="lg:col-span-2" actions={
          <div className="flex items-center gap-2">
            <input type="date" className={`${inputCls} w-40`} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <input type="date" className={`${inputCls} w-40`} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </div>}>
          {report && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Approved", String(report.approved)], ["Approved amount", money(report.approvedAmount)], ["Declined", String(report.declined)], ["Cancelled", String(report.cancelled)]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-white/5"><p className="text-xs text-gray-500 dark:text-gray-400">{k}</p><p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white/90">{v}</p></div>
                ))}
              </div>
              {report.byScheme.length > 0 && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">By card: {report.byScheme.map((s) => `${s.scheme} ${s.count} · ${money(s.amount)}`).join("  |  ")}</p>}
              <div className="mt-3 max-h-[28rem] overflow-auto">
                <table className="min-w-full"><thead><tr><th className={th}>Time</th><th className={th}>Invoice</th><th className={th}>Terminal</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Card</th><th className={th}>Code</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.payments.length === 0 && <tr><td className={td} colSpan={7}>No card payments in this period.</td></tr>}
                    {report.payments.map((p) => (
                      <tr key={p.id}>
                        <td className={td}>{new Date(p.createdOn).toLocaleString()}<span className="block text-xs text-gray-500 dark:text-gray-400">{p.createdBy}</span></td>
                        <td className={td}>#{p.transactionId}</td><td className={td}>{p.terminalName}</td><td className={td}>{money(p.amount)}</td>
                        <td className={td}><span className={p.status === "Approved" ? "text-green-600" : p.status === "Pending" ? "text-amber-600" : "text-red-600"}>{p.status}</span></td>
                        <td className={td}>{p.cardScheme ?? ""}{p.cardLast4 ? ` •••• ${p.cardLast4}` : ""}</td><td className={`${td} font-mono text-xs`}>{p.approvalCode ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

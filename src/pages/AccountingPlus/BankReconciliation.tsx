import { useCallback, useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import {
  bank,
  getPostableAccounts,
  errorMessage,
  money,
  fmtDate,
  BankAccountDto,
  BankStatementDto,
  BankStatementDetailDto,
  BankMatchSuggestionDto,
  BankReconciliationSummaryDto,
  PostableAccount,
} from "../../services/accountingPlusService";
import { AccountSelect, Card, Notice, NoticeBar, StateBlock, StatusPill, btnPrimary, btnSecondary, btnSmall, selectClass, toInputDate } from "./shared";

export default function BankReconciliation() {
  const [accounts, setAccounts] = useState<BankAccountDto[]>([]);
  const [glAccounts, setGlAccounts] = useState<PostableAccount[]>([]);
  const [bankId, setBankId] = useState<number | "">("");
  const [statements, setStatements] = useState<BankStatementDto[]>([]);
  const [statementId, setStatementId] = useState<number | "">("");
  const [detail, setDetail] = useState<BankStatementDetailDto | null>(null);
  const [summary, setSummary] = useState<BankReconciliationSummaryDto | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  // bank account modal
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState<{ name: string; bankName: string; masked: string; currency: string; glAccountId: number | "" }>({
    name: "", bankName: "", masked: "", currency: "USD", glAccountId: "",
  });

  // import modal
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date();
  const [importForm, setImportForm] = useState({
    periodFrom: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    periodTo: toInputDate(today),
    openingBalance: 0,
    closingBalance: 0,
  });

  // suggestion picker
  const [pickLineId, setPickLineId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<BankMatchSuggestionDto[]>([]);
  const [sugLoading, setSugLoading] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const loadAccounts = useCallback(async () => {
    try {
      const [a, gl] = await Promise.all([bank.listAccounts(false), getPostableAccounts().catch(() => [] as PostableAccount[])]);
      setAccounts(a);
      setGlAccounts(gl);
      if (a.length && bankId === "") setBankId(a[0].id);
    } catch (e) {
      setError(errorMessage(e, "Failed to load bank accounts"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    if (bankId === "") { setStatements([]); setStatementId(""); return; }
    let alive = true;
    bank.listStatements(bankId)
      .then((s) => { if (!alive) return; setStatements(s); setStatementId(s.length ? s[0].id : ""); })
      .catch((e) => alive && setError(errorMessage(e, "Failed to load statements")));
    return () => { alive = false; };
  }, [bankId]);

  const loadStatement = useCallback(async () => {
    if (statementId === "") { setDetail(null); setSummary(null); return; }
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([bank.getStatement(statementId, filter || undefined), bank.summary(statementId)]);
      setDetail(d);
      setSummary(s);
    } catch (e) {
      setError(errorMessage(e, "Failed to load statement"));
    } finally {
      setLoading(false);
    }
  }, [statementId, filter]);

  useEffect(() => { void loadStatement(); }, [loadStatement]);

  async function saveAccount() {
    if (!acctForm.name.trim() || acctForm.glAccountId === "") {
      setNotice({ variant: "error", title: "Validation", message: "Name and GL account are required" });
      return;
    }
    setBusy(true);
    try {
      const created = await bank.createAccount({ name: acctForm.name, bankName: acctForm.bankName || null, accountNumberMasked: acctForm.masked || null, currencyCode: acctForm.currency || "USD", glAccountId: acctForm.glAccountId, isActive: true });
      setAcctOpen(false);
      await loadAccounts();
      setBankId(created.id);
      setNotice({ variant: "success", title: "Saved", message: "Bank account created" });
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally { setBusy(false); }
  }

  async function importCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file || bankId === "") {
      setNotice({ variant: "error", title: "Validation", message: "Pick a CSV file first" });
      return;
    }
    setBusy(true);
    try {
      const r = await bank.importCsv(file, { bankAccountId: bankId, ...importForm });
      setImportOpen(false);
      const s = await bank.listStatements(bankId);
      setStatements(s);
      setStatementId(r.statementId);
      setNotice({ variant: r.errors.length ? "warning" : "success", title: "Imported", message: `${r.imported} lines imported${r.skipped ? `, ${r.skipped} skipped` : ""}` });
    } catch (e) {
      setNotice({ variant: "error", title: "Import failed", message: errorMessage(e) });
    } finally { setBusy(false); }
  }

  async function openSuggestions(lineId: number) {
    if (statementId === "") return;
    setPickLineId(lineId);
    setSugLoading(true);
    try { setSuggestions(await bank.suggestions(statementId, lineId)); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); setSuggestions([]); }
    finally { setSugLoading(false); }
  }

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try { await fn(); setNotice({ variant: "success", title: "Done", message: okMsg }); await loadStatement(); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  const pickLine = detail?.lines.find((l) => l.id === pickLineId) ?? null;

  return (
    <>
      <PageMeta title="Bank Reconciliation | Axis" description="Match bank statement lines against the ledger" />
      <PageBreadcrumb pageTitle="Bank Reconciliation" />
      <NoticeBar notice={notice} />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <Label>Bank account</Label>
          <select className={selectClass} value={bankId} onChange={(e) => setBankId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Select bank account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.glAccountNumber})</option>)}
          </select>
        </div>
        <div>
          <Label>Statement</Label>
          <select className={selectClass} value={statementId} onChange={(e) => setStatementId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Select statement</option>
            {statements.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.periodFrom)} - {fmtDate(s.periodTo)} ({s.status})</option>)}
          </select>
        </div>
        <div>
          <Label>Lines</Label>
          <select className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="Unmatched">Unmatched</option>
            <option value="Matched">Matched</option>
            <option value="Excluded">Excluded</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className={btnSecondary} onClick={() => setAcctOpen(true)}>+ Bank account</button>
          <button className={btnPrimary} disabled={bankId === ""} onClick={() => setImportOpen(true)}>Import CSV</button>
        </div>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card title="Statement closing" value={money(summary.closingBalance)} sub={`as of ${fmtDate(summary.periodTo)}`} />
          <Card title="Ledger balance" value={money(summary.ledgerBalanceAsOfPeriodTo)} sub="posted entries to period end" />
          <Card title="Difference" value={money(summary.difference)} tone={summary.difference === 0 ? "ok" : "bad"} />
          <Card title="Unmatched lines" value={`${summary.unmatchedCount}`} sub={`total ${money(summary.unmatchedTotal)}`} tone={summary.unmatchedCount === 0 ? "ok" : "bad"} />
          <div className="flex flex-col justify-center gap-2">
            <StatusPill status={summary.status} />
            <button className={btnPrimary} disabled={!summary.canReconcile || busy} onClick={() => statementId !== "" && act(() => bank.reconcile(statementId), "Statement reconciled")}>Reconcile</button>
            {summary.unmatchedLedgerLinesInPeriod > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{summary.unmatchedLedgerLinesInPeriod} ledger line(s) in period not on statement ({money(summary.unmatchedLedgerTotalInPeriod)})</span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <StateBlock loading={loading} error={error} empty={!detail || detail.lines.length === 0} emptyText={statementId === "" ? "Pick a bank account and statement, or import a CSV." : "No statement lines."}>
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["Date", "Description", "Reference", "Amount", "Status", "Matched to", ""].map((h) => (
                    <TableCell key={h} isHeader className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {detail?.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{fmtDate(l.date)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{l.description}{l.note ? <span className="ml-2 text-xs text-gray-400">({l.note})</span> : null}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{l.reference}</TableCell>
                    <TableCell className={`px-4 py-3 text-sm font-medium ${l.amount < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{money(l.amount)}</TableCell>
                    <TableCell className="px-4 py-3"><StatusPill status={l.matchStatus} /></TableCell>
                    <TableCell className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{l.matchedJournalEntryLineId ? `JE line #${l.matchedJournalEntryLineId}` : ""}</TableCell>
                    <TableCell className="px-4 py-3">
                      {detail.statement.status !== "Reconciled" && (
                        <div className="flex gap-2">
                          {l.matchStatus === "Unmatched" && <button className={btnSmall} disabled={busy} onClick={() => openSuggestions(l.id)}>Match</button>}
                          {l.matchStatus === "Unmatched" && <button className={btnSmall} disabled={busy} onClick={() => statementId !== "" && act(() => bank.exclude(statementId, l.id, "excluded by user"), "Line excluded")}>Exclude</button>}
                          {l.matchStatus !== "Unmatched" && <button className={btnSmall} disabled={busy} onClick={() => statementId !== "" && act(() => bank.unmatch(statementId, l.id), "Line reset")}>Undo</button>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </div>

      {detail && detail.statement.status !== "Reconciled" && (
        <div className="mt-3 flex justify-end">
          <DeleteIconButton title="Delete statement" onClick={() => statementId !== "" && window.confirm("Delete this statement and its lines?") && act(async () => { await bank.deleteStatement(statementId); setStatementId(""); setStatements(await bank.listStatements(bankId === "" ? undefined : bankId)); }, "Statement deleted")} />
        </div>
      )}

      {/* suggestion picker */}
      <Modal isOpen={pickLineId !== null} onClose={() => setPickLineId(null)} title="Match statement line" className="max-w-3xl">
        {pickLine && (
          <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
            {fmtDate(pickLine.date)} - {pickLine.description} - <strong>{money(pickLine.amount)}</strong>
          </div>
        )}
        <StateBlock loading={sugLoading} error={null} empty={suggestions.length === 0} emptyText="No posted ledger lines on this bank's GL account within 3 days with the same amount.">
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {["Entry", "Date", "Description", "Amount", "Days", ""].map((h) => <TableCell key={h} isHeader className="px-3 py-2 text-start text-xs text-gray-500 dark:text-gray-400">{h}</TableCell>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s) => (
                  <TableRow key={s.journalEntryLineId}>
                    <TableCell className="px-3 py-2 text-sm">{s.entryNumber}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{fmtDate(s.entryDate)}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{s.description}</TableCell>
                    <TableCell className="px-3 py-2 text-sm font-medium">{money(s.signedAmount)}</TableCell>
                    <TableCell className="px-3 py-2 text-sm">{s.dayDifference}</TableCell>
                    <TableCell className="px-3 py-2"><button className={btnPrimary} disabled={busy} onClick={() => statementId !== "" && pickLineId !== null && act(async () => { await bank.match(statementId, pickLineId, s.journalEntryLineId); setPickLineId(null); }, "Line matched")}>Use</button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </Modal>

      {/* bank account modal */}
      <Modal isOpen={acctOpen} onClose={() => setAcctOpen(false)} title="New bank account" className="max-w-lg">
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} /></div>
          <div><Label>Bank</Label><Input value={acctForm.bankName} onChange={(e) => setAcctForm({ ...acctForm, bankName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Account (masked)</Label><Input value={acctForm.masked} onChange={(e) => setAcctForm({ ...acctForm, masked: e.target.value })} placeholder="****1234" /></div>
            <div><Label>Currency</Label><Input value={acctForm.currency} onChange={(e) => setAcctForm({ ...acctForm, currency: e.target.value })} /></div>
          </div>
          <div><Label>GL account</Label><AccountSelect value={acctForm.glAccountId} onChange={(id) => setAcctForm({ ...acctForm, glAccountId: id })} accounts={glAccounts} filterType={["Asset"]} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={btnSecondary} onClick={() => setAcctOpen(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy} onClick={saveAccount}>Save</button>
          </div>
        </div>
      </Modal>

      {/* import modal */}
      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Import statement CSV" className="max-w-lg">
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Columns: date, description, reference, amount (signed). Dates dd/MM/yyyy or yyyy-MM-dd.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Period from</Label><Input type="date" value={importForm.periodFrom} onChange={(e) => setImportForm({ ...importForm, periodFrom: e.target.value })} /></div>
            <div><Label>Period to</Label><Input type="date" value={importForm.periodTo} onChange={(e) => setImportForm({ ...importForm, periodTo: e.target.value })} /></div>
            <div><Label>Opening balance</Label><Input type="number" step={0.01} value={importForm.openingBalance} onChange={(e) => setImportForm({ ...importForm, openingBalance: Number(e.target.value) })} /></div>
            <div><Label>Closing balance</Label><Input type="number" step={0.01} value={importForm.closingBalance} onChange={(e) => setImportForm({ ...importForm, closingBalance: Number(e.target.value) })} /></div>
          </div>
          <div><Label>CSV file</Label><input ref={fileRef} type="file" accept=".csv,text/csv" className="block w-full text-sm text-gray-700 dark:text-gray-300" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={btnSecondary} onClick={() => setImportOpen(false)}>Cancel</button>
            <button className={btnPrimary} disabled={busy} onClick={importCsv}>Import</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

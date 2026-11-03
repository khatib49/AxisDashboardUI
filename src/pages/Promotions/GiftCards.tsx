import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import GiftCardRedeem from "./GiftCardRedeem";
import {
  adjustGiftCard,
  disableGiftCard,
  errorMessage,
  getGiftCardTransactions,
  GiftCardDto,
  GiftCardTransactionDto,
  issueGiftCard,
  listGiftCards,
  loadGiftCard,
  refundGiftCard,
} from "../../services/promotionsService";

type Notice = { variant: "success" | "error" | "warning" | "info"; title: string; message: string };

const statusClass: Record<string, string> = {
  Active: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  Depleted: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Expired: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  Disabled: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
};

export default function GiftCards() {
  const [cards, setCards] = useState<GiftCardDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ amount: "", currencyCode: "USD", expiresOn: "", issuedTo: "", notes: "" });
  const [issued, setIssued] = useState<GiftCardDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState<GiftCardDto | null>(null);
  const [ledger, setLedger] = useState<GiftCardTransactionDto[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [action, setAction] = useState<{ kind: "load" | "adjust" | "refund"; amount: string; txId: string; note: string } | null>(null);

  const [redeemOpen, setRedeemOpen] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listGiftCards(page, pageSize, search || undefined, status || undefined);
      setCards(res.data ?? []);
      setTotal(res.totalCount ?? 0);
    } catch (e) {
      setError(errorMessage(e, "Failed to load gift cards"));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 250);
    return () => clearTimeout(t);
  }, [reload]);

  async function submitIssue() {
    const amount = Number(issueForm.amount);
    if (!amount || amount <= 0) {
      setNotice({ variant: "error", title: "Validation", message: "Amount must be greater than zero" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await issueGiftCard({
        amount,
        currencyCode: issueForm.currencyCode || "USD",
        expiresOn: issueForm.expiresOn ? new Date(issueForm.expiresOn).toISOString() : null,
        issuedTo: issueForm.issuedTo || null,
        notes: issueForm.notes || null,
      });
      if (!res.success || !res.data) {
        setNotice({ variant: "error", title: "Issue failed", message: res.message });
        return;
      }
      setIssued(res.data);
      setNotice({ variant: "success", title: "Issued", message: `Gift card ${res.data.code} issued` });
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Issue failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function openDetail(card: GiftCardDto) {
    setDetail(card);
    setAction(null);
    setLedgerLoading(true);
    try {
      setLedger(await getGiftCardTransactions(card.id));
    } catch {
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function runAction() {
    if (!detail || !action) return;
    const amount = Number(action.amount);
    if (!amount) {
      setNotice({ variant: "error", title: "Validation", message: "Enter an amount" });
      return;
    }
    setSubmitting(true);
    try {
      const res =
        action.kind === "load"
          ? await loadGiftCard(detail.id, amount, action.note || undefined)
          : action.kind === "adjust"
            ? await adjustGiftCard(detail.id, amount, action.note || undefined)
            : await refundGiftCard(detail.id, amount, action.txId ? Number(action.txId) : null, action.note || undefined);
      if (!res.success || !res.data) {
        setNotice({ variant: "error", title: "Failed", message: res.message });
        return;
      }
      setNotice({ variant: "success", title: "Done", message: res.message });
      await openDetail(res.data);
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  async function disable() {
    if (!detail) return;
    if (!window.confirm(`Disable gift card ${detail.code}? It can no longer be used.`)) return;
    setSubmitting(true);
    try {
      const res = await disableGiftCard(detail.id);
      if (!res.success || !res.data) {
        setNotice({ variant: "error", title: "Failed", message: res.message });
        return;
      }
      setNotice({ variant: "success", title: "Disabled", message: res.message });
      await openDetail(res.data);
      void reload();
    } catch (e) {
      setNotice({ variant: "error", title: "Failed", message: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageMeta title="Gift Cards | Axis" description="Issue and manage gift cards" />
      <PageBreadcrumb pageTitle="Gift Cards" />

      {notice && <div className="mb-4"><Alert variant={notice.variant} title={notice.title} message={notice.message} /></div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Input placeholder="Search code / issued to" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          </div>
          <select
            className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            <option value="">All statuses</option>
            {["Active", "Depleted", "Expired", "Disabled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <button className="rounded border px-4 py-2 text-sm dark:border-gray-700 text-gray-700 dark:text-gray-300" onClick={() => setRedeemOpen(true)}>Redeem on invoice</button>
            <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white" onClick={() => { setIssued(null); setIssueForm({ amount: "", currencyCode: "USD", expiresOn: "", issuedTo: "", notes: "" }); setIssueOpen(true); }}>
              Issue gift card
            </button>
          </div>
        </div>

        {error && <Alert variant="error" title="Error" message={error} />}

        {loading ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : cards.length === 0 ? (
          <div className="py-10 text-center text-gray-500 dark:text-gray-400">No gift cards found.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  {["Code", "Issued to", "Balance", "Initial", "Status", "Issued", "Expires", ""].map((h) => (
                    <TableCell key={h} isHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((c) => (
                  <TableRow key={c.id} className="border-b border-gray-100 dark:border-white/[0.05]">
                    <TableCell className="px-4 py-3 font-mono text-sm">{c.code}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{c.issuedTo || "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-sm font-semibold">{c.balance.toFixed(2)} {c.currencyCode}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{c.initialAmount.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm"><span className={`rounded px-2 py-0.5 text-xs ${statusClass[c.status] ?? ""}`}>{c.status}</span></TableCell>
                    <TableCell className="px-4 py-3 text-sm">{new Date(c.issuedOn).toLocaleDateString()}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{c.expiresOn ? new Date(c.expiresOn).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm">
                      <button className="text-brand-500 dark:text-brand-400 hover:underline" onClick={() => void openDetail(c)}>Manage</button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{total} card(s)</span>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 disabled:opacity-50 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="px-2 py-1">{page} / {pages}</span>
            <button className="rounded border px-3 py-1 disabled:opacity-50 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {/* Issue */}
      <Modal isOpen={issueOpen} onClose={() => setIssueOpen(false)} title="Issue gift card" className="max-w-lg">
        {issued ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border p-4 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">Gift card code</div>
              <div className="font-mono text-2xl tracking-widest">{issued.code}</div>
              <div className="mt-1">{issued.balance.toFixed(2)} {issued.currencyCode}</div>
            </div>
            <div className="text-right"><button className="rounded bg-brand-500 px-4 py-2 text-white" onClick={() => setIssueOpen(false)}>Close</button></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount *</Label><Input type="number" step={0.01} min="0" value={issueForm.amount} onChange={(e) => setIssueForm({ ...issueForm, amount: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={issueForm.currencyCode} onChange={(e) => setIssueForm({ ...issueForm, currencyCode: e.target.value.toUpperCase() })} /></div>
            <div><Label>Issued to (name / phone)</Label><Input value={issueForm.issuedTo} onChange={(e) => setIssueForm({ ...issueForm, issuedTo: e.target.value })} /></div>
            <div><Label>Expires on</Label><Input type="date" value={issueForm.expiresOn} onChange={(e) => setIssueForm({ ...issueForm, expiresOn: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} /></div>
            <div className="col-span-2 flex justify-end gap-2">
              <button className="rounded border px-4 py-2 text-sm dark:border-gray-700 text-gray-700 dark:text-gray-300" onClick={() => setIssueOpen(false)}>Cancel</button>
              <button className="rounded bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={submitting} onClick={submitIssue}>{submitting ? "Issuing…" : "Issue"}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail / manage */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Gift card ${detail.code}` : ""}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div><div className="text-xs text-gray-500 dark:text-gray-400">Balance</div><div className="text-lg font-semibold">{detail.balance.toFixed(2)} {detail.currencyCode}</div></div>
              <div><div className="text-xs text-gray-500 dark:text-gray-400">Status</div><div><span className={`rounded px-2 py-0.5 text-xs ${statusClass[detail.status] ?? ""}`}>{detail.status}</span></div></div>
              <div><div className="text-xs text-gray-500 dark:text-gray-400">Issued to</div><div>{detail.issuedTo || "—"}</div></div>
              <div><div className="text-xs text-gray-500 dark:text-gray-400">Expires</div><div>{detail.expiresOn ? new Date(detail.expiresOn).toLocaleDateString() : "never"}</div></div>
            </div>
            {detail.notes && <div className="text-gray-500 dark:text-gray-400">{detail.notes}</div>}

            <div className="flex flex-wrap gap-2">
              <button className="rounded border px-3 py-1 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={detail.status === "Disabled"} onClick={() => setAction({ kind: "load", amount: "", txId: "", note: "" })}>Load value</button>
              <button className="rounded border px-3 py-1 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={detail.status === "Disabled"} onClick={() => setAction({ kind: "adjust", amount: "", txId: "", note: "" })}>Adjust (±)</button>
              <button className="rounded border px-3 py-1 dark:border-gray-700 text-gray-700 dark:text-gray-300" disabled={detail.status === "Disabled"} onClick={() => setAction({ kind: "refund", amount: "", txId: "", note: "" })}>Refund to card</button>
              <button className="rounded border border-error-500 px-3 py-1 text-error-500" disabled={detail.status === "Disabled" || submitting} onClick={disable}>Disable</button>
            </div>

            {action && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 dark:border-gray-700">
                <div><Label>{action.kind === "adjust" ? "Delta (negative to deduct)" : "Amount"}</Label><Input type="number" step={0.01} value={action.amount} onChange={(e) => setAction({ ...action, amount: e.target.value })} /></div>
                {action.kind === "refund" && <div><Label>Invoice # (optional)</Label><Input type="number" value={action.txId} onChange={(e) => setAction({ ...action, txId: e.target.value })} /></div>}
                <div className={action.kind === "refund" ? "" : "col-span-2"}><Label>Note</Label><Input value={action.note} onChange={(e) => setAction({ ...action, note: e.target.value })} /></div>
                <div className="col-span-3 flex justify-end gap-2">
                  <button className="rounded border px-3 py-1 dark:border-gray-700 text-gray-700 dark:text-gray-300" onClick={() => setAction(null)}>Cancel</button>
                  <button className="rounded bg-brand-500 px-3 py-1 text-white disabled:opacity-50" disabled={submitting} onClick={runAction}>Apply</button>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 font-medium">History</div>
              {ledgerLoading ? <Loader /> : ledger.length === 0 ? <div className="text-gray-500 dark:text-gray-400">No movements.</div> : (
                <Table>
                  <TableHeader><TableRow>{["When", "Type", "Amount", "Balance after", "Invoice", "By", "Note"].map((h) => <TableCell key={h} isHeader className="px-2 py-1 text-left text-xs text-gray-500 dark:text-gray-400">{h}</TableCell>)}</TableRow></TableHeader>
                  <TableBody>
                    {ledger.map((t) => (
                      <TableRow key={t.id} className="border-t border-gray-100 dark:border-white/[0.05]">
                        <TableCell className="px-2 py-1">{new Date(t.on).toLocaleString()}</TableCell>
                        <TableCell className="px-2 py-1">{t.type}</TableCell>
                        <TableCell className="px-2 py-1">{t.type === "Redeem" ? "-" : "+"}{t.amount.toFixed(2)}</TableCell>
                        <TableCell className="px-2 py-1">{t.balanceAfter.toFixed(2)}</TableCell>
                        <TableCell className="px-2 py-1">{t.transactionId ? `#${t.transactionId}` : "—"}</TableCell>
                        <TableCell className="px-2 py-1">{t.by}</TableCell>
                        <TableCell className="px-2 py-1 text-gray-500 dark:text-gray-400">{t.note || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Modal>

      <GiftCardRedeem isOpen={redeemOpen} onClose={() => { setRedeemOpen(false); void reload(); }} />
    </>
  );
}

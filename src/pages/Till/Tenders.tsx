import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { getTenderSummary, errorMessage, type TenderSummaryDto } from "../../services/tillService";
import { formatUsd } from "../../utils/money";
import TenderDialog from "./TenderDialog";

/** Small demo / utility page: look up a transaction and record multi-currency tenders against it. */
export default function Tenders() {
  const [txInput, setTxInput] = useState("");
  const [summary, setSummary] = useState<TenderSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function lookup() {
    const id = parseInt(txInput, 10);
    if (!id || id <= 0) return setError("Enter a transaction id.");
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const r = await getTenderSummary(id);
      if (!r.success || !r.data) return setError(r.error || r.message || "Transaction not found");
      setSummary(r.data);
    } catch (err) {
      setError(errorMessage(err, "Transaction not found"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageMeta title="Tenders | Axis" description="Record multi-currency payments against a transaction" />
      <PageBreadcrumb pageTitle="Tenders" />
      <div className="max-w-xl space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Label htmlFor="tx">Transaction id</Label>
          <div className="flex gap-2">
            <Input id="tx" type="number" min="1" value={txInput} onChange={(e) => setTxInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void lookup(); }} />
            <button onClick={lookup} disabled={loading} className="h-11 rounded-lg bg-brand-500 px-4 text-sm text-white hover:bg-brand-600 disabled:opacity-50">Find</button>
          </div>
        </div>

        {error && <Alert variant="error" title="Error" message={error} />}
        {loading && <div className="flex justify-center py-6"><Loader /></div>}

        {summary && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div><p className="text-xs text-gray-500">Total</p><p className="font-semibold">{formatUsd(summary.totalPrice)}</p></div>
              <div><p className="text-xs text-gray-500">Paid</p><p className="font-semibold">{formatUsd(summary.paidInBase)}</p></div>
              <div><p className="text-xs text-gray-500">Remaining</p><p className={`font-semibold ${summary.remainingInBase > 0 ? "text-warning-600" : "text-success-600"}`}>{formatUsd(summary.remainingInBase)}</p></div>
              <div><p className="text-xs text-gray-500">Change</p><p className="font-semibold">{formatUsd(summary.changeInBase)}</p></div>
            </div>
            {summary.changeInBase > 0 && (
              <p className="mb-3 text-xs text-gray-500">Change due: {summary.changeByCurrency.map((c) => `${c.amount.toLocaleString()} ${c.currencyCode}`).join(" · ")}</p>
            )}
            <p className="mb-3 text-xs text-gray-500">{summary.tenders.length} tender(s) recorded.</p>
            <button onClick={() => setDialogOpen(true)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600">Record payment</button>
          </div>
        )}
      </div>

      {summary && (
        <TenderDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          transactionId={summary.transactionId}
          total={summary.totalPrice}
          onSaved={(s) => setSummary(s)}
        />
      )}
    </>
  );
}

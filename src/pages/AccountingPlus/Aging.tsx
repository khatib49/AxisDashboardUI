import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { bills, receivables, errorMessage, money, AgingBucketsDto, ApAgingReportDto, ArAgingReportDto } from "../../services/accountingPlusService";
import { Card, StateBlock, toInputDate } from "./shared";

const th = (h: string) => <TableCell key={h} isHeader className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>;
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

function BucketCells({ b }: { b: AgingBucketsDto }) {
  return (
    <>
      <TableCell className={td}>{money(b.current)}</TableCell>
      <TableCell className={td}>{money(b.days1To30)}</TableCell>
      <TableCell className={td}>{money(b.days31To60)}</TableCell>
      <TableCell className={td}>{money(b.days61To90)}</TableCell>
      <TableCell className={`${td} ${b.over90 > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{money(b.over90)}</TableCell>
      <TableCell className={`${td} font-semibold`}>{money(b.total)}</TableCell>
    </>
  );
}

export default function Aging() {
  const [asOf, setAsOf] = useState(toInputDate(new Date()));
  const [ap, setAp] = useState<ApAgingReportDto | null>(null);
  const [ar, setAr] = useState<ArAgingReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, r] = await Promise.all([bills.aging(asOf), receivables.aging(asOf)]);
      setAp(a);
      setAr(r);
    } catch (e) {
      setError(errorMessage(e, "Failed to load aging"));
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { void load(); }, [load]);

  const headers = ["Current", "1-30", "31-60", "61-90", "90+", "Total"];

  return (
    <>
      <PageMeta title="Aging | Axis" description="Accounts payable and receivable aging" />
      <PageBreadcrumb pageTitle="AP / AR Aging" />
      <div className="mb-4 flex items-end gap-3">
        <div><Label>As of</Label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Total payable (AP)" value={money(ap?.totals.total)} sub={`${ap?.rows.length ?? 0} supplier(s)`} />
        <Card title="AP over 90 days" value={money(ap?.totals.over90)} tone={(ap?.totals.over90 ?? 0) > 0 ? "bad" : "ok"} />
        <Card title="Total receivable (AR)" value={money(ar?.totals.total)} sub={`${ar?.rows.length ?? 0} customer(s)`} />
        <Card title="AR over 90 days" value={money(ar?.totals.over90)} tone={(ar?.totals.over90 ?? 0) > 0 ? "bad" : "ok"} />
      </div>

      <h3 className="mb-2 text-base font-semibold text-gray-800 dark:text-white/90">Accounts payable (supplier bills by due date)</h3>
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <StateBlock loading={loading} error={error} empty={!ap || ap.rows.length === 0} emptyText="No open supplier bills.">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Supplier", "Bills", ...headers].map(th)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {ap?.rows.map((r) => (
                  <TableRow key={r.supplierId}><TableCell className={td}>{r.supplierName}</TableCell><TableCell className={td}>{r.openBills}</TableCell><BucketCells b={r.buckets} /></TableRow>
                ))}
                {ap && <TableRow className="bg-gray-50 dark:bg-white/[0.02]"><TableCell className={`${td} font-semibold`}>Total</TableCell><TableCell className={td}>{ap.rows.reduce((s, r) => s + r.openBills, 0)}</TableCell><BucketCells b={ap.totals} /></TableRow>}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </div>

      <h3 className="mb-2 text-base font-semibold text-gray-800 dark:text-white/90">Accounts receivable (open invoices by invoice date)</h3>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] text-gray-800 dark:text-white/90">
        <StateBlock loading={loading} error={error} empty={!ar || ar.rows.length === 0} emptyText="No open invoices.">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Customer", "Invoices", ...headers].map(th)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {ar?.rows.map((r) => (
                  <TableRow key={r.userId ?? "walkin"}><TableCell className={td}>{r.customerName}</TableCell><TableCell className={td}>{r.openInvoices}</TableCell><BucketCells b={r.buckets} /></TableRow>
                ))}
                {ar && <TableRow className="bg-gray-50 dark:bg-white/[0.02]"><TableCell className={`${td} font-semibold`}>Total</TableCell><TableCell className={td}>{ar.rows.reduce((s, r) => s + r.openInvoices, 0)}</TableCell><BucketCells b={ar.totals} /></TableRow>}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </div>
    </>
  );
}

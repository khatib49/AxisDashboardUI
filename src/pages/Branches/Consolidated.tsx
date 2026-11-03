import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { BranchKpiDto, ConsolidatedDashboardDto, getConsolidated } from "../../services/branchService";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(v: number, ccy?: string): string {
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${ccy ? ` ${ccy}` : ""}`;
}

const th = "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400";
const td = "px-5 py-3 text-sm text-gray-700 dark:text-gray-300";

function KpiCard({ k }: { k: BranchKpiDto }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-mono text-gray-400">{k.code}</div>
          <div className="font-semibold text-gray-800 dark:text-white/90">{k.name}</div>
        </div>
        {k.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/10">default</span>}
      </div>
      <div className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">{money(k.sales, k.currencyCode)}</div>
      <div className="mt-1 text-xs text-gray-500">{k.orders} orders · avg {money(k.averageTicket)}</div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Open invoices</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{k.openInvoices} · {money(k.openInvoicesValue)}</span>
      </div>
    </div>
  );
}

export default function Consolidated() {
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 6 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const [data, setData] = useState<ConsolidatedDashboardDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getConsolidated(from, to));
    } catch (err) {
      const m = err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Failed to load consolidated dashboard";
      setError(m);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <PageMeta title="Consolidated | Axis" description="Per-branch KPIs across all branches" />
      <PageBreadcrumb pageTitle="Consolidated dashboard" />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 pb-0.5">
          {[{ l: "Today", d: 0 }, { l: "7 days", d: 6 }, { l: "30 days", d: 29 }].map((p) => (
            <button
              key={p.l}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              onClick={() => {
                const t = new Date();
                setTo(isoDay(t));
                setFrom(isoDay(new Date(t.getTime() - p.d * 86400000)));
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {data && data.attribution === "default-branch" && (
        <div className="mb-5">
          <Alert variant="info" title="Attribution: default branch" message={data.attributionNote} />
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10"><Loader /></div>
      )}
      {error && <div className="text-red-600 bg-red-50 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && data && (
        <>
          {data.branches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
              No branches yet. Create one under Branches to see it here.
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard k={data.total} />
              {data.branches.map((b) => <KpiCard key={b.branchId} k={b} />)}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className={th}>Branch</TableCell>
                    <TableCell isHeader className={th}>Sales</TableCell>
                    <TableCell isHeader className={th}>Orders</TableCell>
                    <TableCell isHeader className={th}>Avg ticket</TableCell>
                    <TableCell isHeader className={th}>Open invoices</TableCell>
                    <TableCell isHeader className={th}>Open value</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {data.branches.map((b) => (
                    <TableRow key={b.branchId}>
                      <TableCell className={td}><span className="font-mono text-xs text-gray-400 mr-2">{b.code}</span>{b.name}</TableCell>
                      <TableCell className={td}>{money(b.sales, b.currencyCode)}</TableCell>
                      <TableCell className={td}>{b.orders}</TableCell>
                      <TableCell className={td}>{money(b.averageTicket)}</TableCell>
                      <TableCell className={td}>{b.openInvoices}</TableCell>
                      <TableCell className={td}>{money(b.openInvoicesValue)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 dark:bg-white/[0.02]">
                    <TableCell className={`${td} font-semibold`}>Total</TableCell>
                    <TableCell className={`${td} font-semibold`}>{money(data.total.sales, data.total.currencyCode)}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{data.total.orders}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{money(data.total.averageTicket)}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{data.total.openInvoices}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{money(data.total.openInvoicesValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Range {data.from.slice(0, 10)} → {data.to.slice(0, 10)} · attribution: <code>{data.attribution}</code>
          </p>
        </>
      )}
    </div>
  );
}

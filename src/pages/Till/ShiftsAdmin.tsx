import { useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Loader from "../../components/ui/Loader";
import Alert from "../../components/ui/alert/Alert";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { listShifts, getZReport, errorMessage, type CashierShiftDto, type ShiftReportDto } from "../../services/tillService";
import { getRates, pickSecondaryRate } from "../../services/currencyService";
import { formatUsd } from "../../utils/money";
import ShiftReportView from "./ShiftReportView";

export default function ShiftsAdmin() {
  const [rows, setRows] = useState<CashierShiftDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState("");
  const [register, setRegister] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const [report, setReport] = useState<ShiftReportDto | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    getRates().then((c) => setRate(pickSecondaryRate(c))).catch(() => setRate(0));
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listShifts({
      status: status || undefined,
      registerName: register || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      page,
      pageSize,
    })
      .then((r) => { if (mounted) { setRows(r.data || []); setTotal(r.totalCount || 0); } })
      .catch((err) => { if (mounted) setError(errorMessage(err, "Failed to load shifts")); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [status, register, from, to, page]);

  async function openReport(id: number) {
    setReportLoading(true);
    try {
      setReport(await getZReport(id));
    } catch (err) {
      setError(errorMessage(err, "Failed to load report"));
    } finally {
      setReportLoading(false);
    }
  }

  const varianceClass = (v?: number | null) =>
    v == null ? "text-gray-400" : v === 0 ? "text-success-600" : v < 0 ? "text-error-600" : "text-warning-600";

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageMeta title="Shifts | Axis" description="Cashier shifts, Z reports and variances" />
      <PageBreadcrumb pageTitle="Cashier Shifts" />

      {error && <div className="mb-4"><Alert variant="error" title="Error" message={error} /></div>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-5 dark:border-gray-700 dark:bg-gray-800">
        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-600 dark:text-white">
            <option value="">All</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div><Label>Register</Label><Input value={register} onChange={(e) => { setPage(1); setRegister(e.target.value); }} placeholder="Any" /></div>
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} /></div>
        <div className="flex items-end"><p className="text-sm text-gray-500">{total} shift(s)</p></div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex justify-center py-10"><Loader /></div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No shifts match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-900/40">
                <TableRow>
                  {["#", "Register", "Cashier", "Opened", "Closed", "Float", "Expected", "Counted", "Variance", "Status", ""].map((h) => (
                    <TableCell key={h} isHeader className="px-4 py-2 text-left text-xs uppercase text-gray-500">{h}</TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className="border-t border-gray-100 text-sm dark:border-gray-700 dark:text-gray-200">
                    <TableCell className="px-4 py-2">{s.id}</TableCell>
                    <TableCell className="px-4 py-2">{s.registerName}</TableCell>
                    <TableCell className="px-4 py-2">{s.userName}</TableCell>
                    <TableCell className="px-4 py-2 whitespace-nowrap">{new Date(s.openedOn).toLocaleString()}</TableCell>
                    <TableCell className="px-4 py-2 whitespace-nowrap">{s.closedOn ? new Date(s.closedOn).toLocaleString() : "—"}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{formatUsd(s.openingFloat)}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{s.expectedCash != null ? formatUsd(s.expectedCash) : "—"}</TableCell>
                    <TableCell className="px-4 py-2 tabular-nums">{s.countedCash != null ? formatUsd(s.countedCash) : "—"}</TableCell>
                    <TableCell className={`px-4 py-2 tabular-nums font-semibold ${varianceClass(s.variance)}`}>{s.variance != null ? formatUsd(s.variance) : "—"}</TableCell>
                    <TableCell className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${s.status === "Open" ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"}`}>{s.status}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <button onClick={() => openReport(s.id)} className="text-brand-500 hover:underline">{s.status === "Open" ? "X report" : "Z report"}</button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm dark:border-gray-700">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-white">Prev</button>
          <span className="text-gray-500">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-white">Next</button>
        </div>
      </div>

      <Modal isOpen={reportLoading || !!report} onClose={() => setReport(null)} title="Shift report" className="max-w-3xl">
        {reportLoading ? <div className="flex justify-center py-10"><Loader /></div> : report && <ShiftReportView report={report} rate={rate} onPrint={() => window.print()} />}
      </Modal>
    </>
  );
}

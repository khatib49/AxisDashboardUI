import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Modal from "../../components/ui/Modal";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import DeleteIconButton from "../../components/ui/DeleteIconButton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { tax, errorMessage, money, MONTHS, VatReportDto, TaxRateDto, TaxRateUpsertDto } from "../../services/accountingPlusService";
import { Card, Notice, NoticeBar, StateBlock, btnPrimary, btnSecondary, btnSmall, selectClass, toInputDate } from "./shared";

const th = (h: string) => <TableCell key={h} isHeader className="px-4 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>;
const td = "px-4 py-3 text-sm text-gray-700 dark:text-gray-300";

export default function VatReport() {
  const now = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(now.getFullYear(), 0, 1)));
  const [to, setTo] = useState(toInputDate(now));
  const [inclusive, setInclusive] = useState(true);
  const [report, setReport] = useState<VatReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [rates, setRates] = useState<TaxRateDto[]>([]);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [rateForm, setRateForm] = useState<TaxRateUpsertDto & { id?: number }>({ name: "", ratePercent: 11, isDefault: true, isActive: true, appliesTo: "Both" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const loadRates = useCallback(async () => {
    try { setRates(await tax.listRates(true)); } catch { setRates([]); }
  }, []);
  useEffect(() => { void loadRates(); }, [loadRates]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setReport(await tax.vatReport(from, to, inclusive)); }
    catch (e) { setError(errorMessage(e, "Failed to load VAT report")); }
    finally { setLoading(false); }
  }, [from, to, inclusive]);
  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    if (!report) return;
    const head = ["Year", "Month", "Sales gross", "Sales net", "Output VAT", "Purchases net", "Input VAT", "Net payable"];
    const lines = report.rows.map((r) => [r.year, r.month, r.salesGross, r.salesNet, r.outputVat, r.purchasesNet, r.inputVat, r.netPayable].join(","));
    lines.push(["Total", "", "", "", report.totalOutputVat, "", report.totalInputVat, report.totalNetPayable].join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveRate() {
    if (!rateForm.name.trim()) { setNotice({ variant: "error", title: "Validation", message: "Name is required" }); return; }
    setBusy(true);
    try {
      const dto: TaxRateUpsertDto = { name: rateForm.name.trim(), ratePercent: rateForm.ratePercent, isDefault: rateForm.isDefault, isActive: rateForm.isActive, appliesTo: rateForm.appliesTo };
      if (rateForm.id) await tax.updateRate(rateForm.id, dto); else await tax.createRate(dto);
      setRateForm({ name: "", ratePercent: 11, isDefault: false, isActive: true, appliesTo: "Both" });
      await loadRates();
      await load();
      setNotice({ variant: "success", title: "Saved", message: "Tax rate saved" });
    } catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  async function removeRate(id: number) {
    if (!window.confirm("Delete this tax rate?")) return;
    setBusy(true);
    try { await tax.deleteRate(id); await loadRates(); await load(); }
    catch (e) { setNotice({ variant: "error", title: "Failed", message: errorMessage(e) }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageMeta title="VAT Report | Axis" description="Output and input VAT per month" />
      <PageBreadcrumb pageTitle="VAT Report" />
      <NoticeBar notice={notice} />

      <div className="mb-4 grid grid-cols-1 items-end gap-3 md:grid-cols-5">
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label>Prices are</Label>
          <select className={selectClass} value={inclusive ? "1" : "0"} onChange={(e) => setInclusive(e.target.value === "1")}>
            <option value="1">Tax inclusive</option>
            <option value="0">Tax exclusive</option>
          </select>
        </div>
        <div className="flex gap-2 md:col-span-2">
          <button className={btnSecondary} onClick={() => setRatesOpen(true)}>Tax rates</button>
          <button className={btnPrimary} disabled={!report || report.rows.length === 0} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {report && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card title="Sales rate" value={`${report.salesRatePercent}%`} sub={report.salesRatePercent === 0 ? "No sales tax rate configured" : report.inclusive ? "inclusive" : "exclusive"} tone={report.salesRatePercent === 0 ? "bad" : "neutral"} />
          <Card title="Output VAT" value={money(report.totalOutputVat)} />
          <Card title="Input VAT" value={money(report.totalInputVat)} />
          <Card title="Net payable" value={money(report.totalNetPayable)} tone={report.totalNetPayable > 0 ? "bad" : "ok"} />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <StateBlock loading={loading} error={error} empty={!report || report.rows.length === 0} emptyText="No data for this period.">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]"><TableRow>{["Month", "Sales gross", "Sales net", "Output VAT", "Purchases net", "Input VAT", "Net payable"].map(th)}</TableRow></TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {report?.rows.map((r) => (
                  <TableRow key={`${r.year}-${r.month}`}>
                    <TableCell className={td}>{MONTHS[r.month - 1]} {r.year}</TableCell>
                    <TableCell className={td}>{money(r.salesGross)}</TableCell>
                    <TableCell className={td}>{money(r.salesNet)}</TableCell>
                    <TableCell className={td}>{money(r.outputVat)}</TableCell>
                    <TableCell className={td}>{money(r.purchasesNet)}</TableCell>
                    <TableCell className={td}>{money(r.inputVat)}</TableCell>
                    <TableCell className={`${td} font-semibold`}>{money(r.netPayable)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </div>

      <Modal isOpen={ratesOpen} onClose={() => setRatesOpen(false)} title="Tax rates" className="max-w-2xl">
        <div className="mb-4 max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <Table>
            <TableHeader><TableRow>{["Name", "Rate", "Applies to", "Default", "Active", ""].map(th)}</TableRow></TableHeader>
            <TableBody>
              {rates.length === 0 && <TableRow><TableCell className={td}>No tax rates yet</TableCell></TableRow>}
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={td}>{r.name}</TableCell>
                  <TableCell className={td}>{r.ratePercent}%</TableCell>
                  <TableCell className={td}>{r.appliesTo}</TableCell>
                  <TableCell className={td}>{r.isDefault ? "Yes" : ""}</TableCell>
                  <TableCell className={td}>{r.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell className="px-4 py-3"><div className="flex items-center gap-2"><button className={btnSmall} onClick={() => setRateForm({ ...r })}>Edit</button><DeleteIconButton onClick={() => removeRate(r.id)} /></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} /></div>
          <div><Label>Rate %</Label><Input type="number" step={0.01} value={rateForm.ratePercent} onChange={(e) => setRateForm({ ...rateForm, ratePercent: Number(e.target.value) })} /></div>
          <div><Label>Applies to</Label>
            <select className={selectClass} value={rateForm.appliesTo} onChange={(e) => setRateForm({ ...rateForm, appliesTo: e.target.value })}>
              {["Both", "Sales", "Purchases"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={rateForm.isDefault} onChange={(e) => setRateForm({ ...rateForm, isDefault: e.target.checked })} /> Default</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={rateForm.isActive} onChange={(e) => setRateForm({ ...rateForm, isActive: e.target.checked })} /> Active</label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {rateForm.id && <button className={btnSecondary} onClick={() => setRateForm({ name: "", ratePercent: 11, isDefault: false, isActive: true, appliesTo: "Both" })}>New</button>}
          <button className={btnPrimary} disabled={busy} onClick={saveRate}>{rateForm.id ? "Update" : "Add"}</button>
        </div>
      </Modal>
    </>
  );
}

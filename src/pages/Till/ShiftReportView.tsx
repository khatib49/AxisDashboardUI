import type { ShiftReportDto } from "../../services/tillService";
import { formatDual, formatUsd } from "../../utils/money";

type Props = {
  report: ShiftReportDto;
  /** LBP per USD, for dual display. 0 hides the LBP column. */
  rate?: number;
  onPrint?: () => void;
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}

/** Print-friendly X / Z report. Wrap in a `print:` friendly container; everything else is hidden on print. */
export default function ShiftReportView({ report, rate = 0, onPrint }: Props) {
  const money = (v: number) => (rate > 0 ? formatDual(v, rate) : formatUsd(v));
  const isZ = report.reportType === "Z";
  const varianceTone =
    report.variance == null
      ? ""
      : report.variance === 0
      ? "text-success-600"
      : report.variance < 0
      ? "text-error-600"
      : "text-warning-600";

  const Row = ({ label, value, strong = false, tone = "" }: { label: string; value: string; strong?: boolean; tone?: string }) => (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""} ${tone}`}>
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </div>
  );

  return (
    <div className="shift-report rounded-lg border border-gray-200 bg-white p-5 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 print:border-0 print:p-0 print:text-black">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{isZ ? "Z Report (closing)" : "X Report (live)"}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Shift #{report.shiftId} · {report.registerName} · {report.userName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Opened {fmtDate(report.openedOn)} · {isZ ? `Closed ${fmtDate(report.closedOn)}` : `Generated ${fmtDate(report.generatedOn)}`}
          </p>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 print:hidden"
          >
            Print
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-1 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700">Sales by payment method</h4>
          {report.salesByMethod.length === 0 && <p className="py-2 text-sm text-gray-400">No tenders recorded on this shift.</p>}
          {report.salesByMethod.map((m) => (
            <Row key={m.method} label={`${m.method} (${m.count})`} value={money(m.amountInBase)} />
          ))}
          <Row label="Total tendered" value={money(report.tenderedTotalInBase)} strong />

          <h4 className="mb-1 mt-4 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700">Tenders by currency</h4>
          {report.tendersByCurrency.length === 0 && <p className="py-2 text-sm text-gray-400">—</p>}
          {report.tendersByCurrency.map((c) => (
            <Row
              key={c.currencyCode}
              label={`${c.currencyCode} (${c.count})`}
              value={`${c.amountInCurrency.toLocaleString("en-US")} ${c.currencyCode} = ${formatUsd(c.amountInBase)}`}
            />
          ))}

          <h4 className="mb-1 mt-4 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700">Transactions</h4>
          <Row label="Paid transactions" value={String(report.transactionCount)} />
          <Row label="Transactions total" value={money(report.transactionTotal)} />
          <Row label="Voids pending / approved" value={`${report.voidsPending} / ${report.voidsApproved}`} />
          <Row label="Voided amount" value={money(report.voidsApprovedAmount)} />
          <Row label="Refunds approved" value={`${report.refundsApproved} · ${money(report.refundsApprovedAmount)}`} />
        </div>

        <div>
          <h4 className="mb-1 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700">Cash drawer</h4>
          <Row label="Opening float" value={money(report.openingFloat)} />
          <Row label="+ Cash tendered" value={money(report.cashTenderedInBase)} />
          <Row label={`+ Pay-ins (${report.payInCount})`} value={money(report.payInTotal)} />
          <Row label={`− Pay-outs (${report.payOutCount})`} value={money(report.payOutTotal)} />
          <div className="my-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
          <Row label="Expected cash" value={money(report.expectedCash)} strong />
          {isZ && (
            <>
              <Row label="Counted cash" value={money(report.countedCash ?? 0)} strong />
              <Row
                label="Variance (counted − expected)"
                value={(report.variance ?? 0) > 0 ? `+${money(report.variance ?? 0)}` : money(report.variance ?? 0)}
                strong
                tone={varianceTone}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

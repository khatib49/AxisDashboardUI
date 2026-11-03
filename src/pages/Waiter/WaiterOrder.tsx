import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Loader from "../../components/ui/Loader";
import PageMeta from "../../components/common/PageMeta";
import TableOrderPicker from "../Floor/TableOrderPicker";
import { LayoutTableDto, getLayout, errorMessage } from "../../services/floorService";
import { neutralBtn } from "./WaiterShell";

/** Full-screen phone item picker for one table's open invoice. */
export default function WaiterOrder() {
  const { tableId } = useParams();
  const id = Number(tableId);
  const navigate = useNavigate();
  const [table, setTable] = useState<LayoutTableDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getLayout()
      .then((l) => {
        if (!alive) return;
        const t = l.areas.flatMap((a) => a.tables).find((x) => x.id === id) ?? null;
        setTable(t);
        setError(t ? (t.openSession ? null : "This table has no open session. Open it first.") : "Table not found.");
      })
      .catch((err) => alive && setError(errorMessage(err, "Could not load the table")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const back = `/waiter/table/${id}`;
  return (
    <div className="h-dvh min-h-[100vh] flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <PageMeta title="Order | Waiter" description="Take an order for a table" />
      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {!loading && (error || !table?.openSession) && (
        <div className="p-4 space-y-3">
          <div className="rounded-lg bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200 px-3 py-2 text-sm">{error ?? "No open session."}</div>
          <button type="button" className={`${neutralBtn} w-full`} onClick={() => navigate(back)}>Back to table</button>
        </div>
      )}
      {!loading && table?.openSession && (
        <TableOrderPicker
          transactionId={table.openSession.transactionId}
          guestCount={table.openSession.guestCount}
          tableLabel={`${table.code} — ${table.name}`}
          mode="page"
          onClose={() => navigate(back)}
          onSent={(r) => navigate(back, { state: { notice: { variant: r.seatWarning ? "warning" : "success", message: r.seatWarning ? `${r.message}: ${r.seatWarning}` : r.message } } })}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PageMeta from "../../components/common/PageMeta";
import Loader from "../../components/ui/Loader";
import { useAuth } from "../../context/AuthContext";
import { OwnerSummaryDto, getOwnerSummary } from "../../services/biService";
import { BranchDto, getMyBranches } from "../../services/branchService";

const REFRESH_MS = 60_000;
const LINE = "#465FFF"; // single series: brand hue, no legend needed

function money(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Delta({ pct, label }: { pct?: number | null; label: string }) {
  if (pct == null) return <span className="text-xs text-gray-400">{label}: n/a</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? "text-green-600" : "text-red-600"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(pct).toFixed(1)}% <span className="text-gray-400">{label}</span>
    </span>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{title}</div>
      {children}
    </div>
  );
}

type ChartPoint = { label: string; total: number; date: string };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <div className="text-gray-500">{p.date}</div>
      <div className="font-semibold">{money(p.total)}</div>
    </div>
  );
}

export default function OwnerView() {
  const { hasAnyRole, loading: authLoading, authenticated } = useAuth();
  const [data, setData] = useState<OwnerSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  // null = all branches (server default)
  const [branchId, setBranchId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyBranches()
      .then((me) => { if (!cancelled) setBranches(me.branches ?? []); })
      .catch(() => { if (!cancelled) setBranches([]); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await getOwnerSummary(undefined, branchId);
      setData(d);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      const m = err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Could not load summary";
      setError(m);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const branchName = branchId ? branches.find((b) => b.id === branchId)?.name ?? `#${branchId}` : "All branches";

  if (authLoading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasAnyRole("admin", "admin_fnb")) return <Navigate to="/" replace />;

  const series: ChartPoint[] = (data?.last14Days ?? []).map((p) => {
    const d = new Date(p.date);
    return { label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, total: p.total, date: p.date.slice(0, 10) };
  });

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <PageMeta title="Owner view | Axis" description="Today at a glance" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Owner view</h1>
          <div className="text-xs text-gray-400">
            {data ? `Business day ${data.day.slice(0, 10)}` : ""}{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString()}` : ""} · refreshes every minute
          </div>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:text-gray-300" aria-label="Refresh">↻</button>
      </div>

      {branches.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label htmlFor="owner-branch" className="text-xs text-gray-500">Branch</label>
          <select
            id="owner-branch"
            value={branchId ?? ""}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{branchName}</span>
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Loader /></div>}
      {error && !data && <div className="rounded bg-red-50 p-3 text-red-600">{error}</div>}

      {data && (
        <div className="space-y-4">
          <Card title="Sales today">
            <div className="text-3xl font-semibold text-gray-900 dark:text-white">{money(data.today.sales)}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <Delta pct={data.salesDeltaVsYesterdayPct} label="vs yesterday" />
              <Delta pct={data.salesDeltaVsLastWeekPct} label="vs last week" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
              <div><div className="text-gray-400">Yesterday</div><div className="font-medium text-gray-700 dark:text-gray-300">{money(data.yesterday.sales)}</div></div>
              <div><div className="text-gray-400">Same day last week</div><div className="font-medium text-gray-700 dark:text-gray-300">{money(data.sameDayLastWeek.sales)}</div></div>
              <div><div className="text-gray-400">Avg ticket</div><div className="font-medium text-gray-700 dark:text-gray-300">{money(data.today.averageTicket)}</div></div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card title="Orders today">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{data.today.orders}</div>
              <div className="mt-1 flex flex-col gap-0.5">
                <Delta pct={data.ordersDeltaVsYesterdayPct} label="vs yesterday" />
                <Delta pct={data.ordersDeltaVsLastWeekPct} label="vs last week" />
              </div>
            </Card>
            <Card title="Open invoices">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{data.openInvoicesCount}</div>
              <div className="text-xs text-gray-500">{money(data.openInvoicesValue)} outstanding</div>
              <div className={`mt-2 text-xs ${data.lowStockCount > 0 ? "text-yellow-600" : "text-gray-400"}`}>
                {data.lowStockCount} low-stock ingredient{data.lowStockCount === 1 ? "" : "s"}
              </div>
            </Card>
          </div>

          <Card title="Sales, last 14 days">
            {series.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No data.</div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }} />
                    <Line type="monotone" dataKey="total" stroke={LINE} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Top items today">
            {data.topItems.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-400">Nothing sold yet today.</div>
            ) : (
              <ol className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {data.topItems.map((i, idx) => (
                  <li key={i.itemId} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs text-gray-400">{idx + 1}</span>
                      <div>
                        <div className="font-medium text-gray-800 dark:text-white/90">{i.itemName}</div>
                        <div className="text-xs text-gray-400">{i.categoryName} · {i.quantity} sold</div>
                      </div>
                    </div>
                    <div className="font-medium text-gray-700 dark:text-gray-300">{money(i.amount)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {error && <div className="text-xs text-red-500">Last refresh failed: {error}</div>}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Loader from "../../components/ui/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../components/ui/table";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getCategories } from "../../services/categoryService";
import {
  errorMessage,
  exportMenuEngineeringCsv,
  getItemCostBreakdown,
  getMenuEngineeringReport,
  ItemCostBreakdownDto,
  MenuEngineeringItemDto,
  MenuEngineeringReportDto,
  Quadrant,
} from "../../services/menuEngineeringService";

// ─── helpers ────────────────────────────────────────────────────────────────
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);
const idx = (n: number) => n.toFixed(2);
const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
const POPULARITY_FACTOR = 0.7;

const QUADRANTS: Quadrant[] = ["Star", "Plowhorse", "Puzzle", "Dog"];

// Categorical palette validated with the dataviz checks (all-pairs, light + dark).
// Quadrant identity is also carried by position (bands) and the pill text, never by colour alone.
const QUADRANT_COLORS: Record<"light" | "dark", Record<Quadrant, string>> = {
  light: { Star: "#008300", Plowhorse: "#2a78d6", Puzzle: "#eda100", Dog: "#d55181" },
  dark: { Star: "#008300", Plowhorse: "#3987e5", Puzzle: "#c98500", Dog: "#d55181" },
};

const QUADRANT_HINT: Record<Quadrant, string> = {
  Star: "Popular and profitable — keep, feature, protect the recipe.",
  Plowhorse: "Popular but low margin — trim portion cost or nudge the price.",
  Puzzle: "Profitable but slow — promote, reposition on the menu, or rename.",
  Dog: "Neither — consider removing or reworking.",
};

type SortKey = keyof Pick<
  MenuEngineeringItemDto,
  "name" | "category" | "price" | "unitCost" | "marginPct" | "unitsSold" | "revenue" | "contribution" | "popularityIndex" | "profitabilityIndex" | "quadrant"
>;
type SortDir = "asc" | "desc";
type CategoryOption = { id: number; name: string };
type Point = MenuEngineeringItemDto & { x: number; y: number };

const btnPrimary = "rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";
const btnSecondary =
  "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5";
const card = "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]";

// ─── small components ───────────────────────────────────────────────────────
function Kpi({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "ok" | "bad" | "neutral" }) {
  const color = tone === "ok" ? "text-green-600 dark:text-green-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-white/90";
  return (
    <div className={card}>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
    </div>
  );
}

function QuadrantPill({ quadrant, colors }: { quadrant: string; colors: Record<Quadrant, string> }) {
  const q = (QUADRANTS.includes(quadrant as Quadrant) ? quadrant : "Dog") as Quadrant;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
      title={QUADRANT_HINT[q]}
    >
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: colors[q] }} />
      {quadrant}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return <span className={`ml-1 text-xs ${active ? "text-brand-500" : "text-gray-300 dark:text-gray-600"}`}>{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: Point }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <div className="font-semibold text-gray-800 dark:text-white">{p.name}</div>
      <div className="text-gray-500 dark:text-gray-400">{p.category} · {p.quadrant}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-gray-500 dark:text-gray-400">Units</span><span className="text-right">{p.unitsSold}</span>
        <span className="text-gray-500 dark:text-gray-400">Margin</span><span className="text-right">{pct(p.marginPct)}</span>
        <span className="text-gray-500 dark:text-gray-400">Price</span><span className="text-right">{money(p.price)}</span>
        <span className="text-gray-500 dark:text-gray-400">Unit cost</span><span className="text-right">{money(p.unitCost)}</span>
        <span className="text-gray-500 dark:text-gray-400">Popularity</span><span className="text-right">{idx(p.popularityIndex)}×</span>
      </div>
    </div>
  );
}

function MatrixChart({ report, colors, dark, onPick }: { report: MenuEngineeringReportDto; colors: Record<Quadrant, string>; dark: boolean; onPick: (id: number) => void }) {
  const points: Point[] = report.items.map((i) => ({ ...i, x: i.popularityIndex, y: i.marginPct }));
  const maxX = Math.max(1.5, Math.ceil((Math.max(0, ...points.map((p) => p.x)) + 0.2) * 10) / 10);
  const minY = Math.min(0, Math.floor(Math.min(0, ...points.map((p) => p.y)) / 10) * 10);
  const splitY = Math.max(minY, Math.min(100, report.profitabilityThresholdPct));
  const grid = dark ? "#2a2f3a" : "#e5e7eb";
  const ink = dark ? "#c3c2b7" : "#52514e";
  const bandOpacity = dark ? 0.18 : 0.08;
  const label = (text: string, position: "insideTopLeft" | "insideTopRight" | "insideBottomLeft" | "insideBottomRight") => ({
    value: text, position, fill: ink, fontSize: 11, fontWeight: 600,
  });

  return (
    <div className="h-80 w-full sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name="Popularity index" domain={[0, maxX]} tick={{ fill: ink, fontSize: 11 }} stroke={grid}
            label={{ value: "Popularity index (units ÷ avg units per item)", position: "insideBottom", offset: -4, fill: ink, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Margin %" domain={[minY, 100]} tick={{ fill: ink, fontSize: 11 }} stroke={grid} width={40}
            tickFormatter={(v: number) => `${v}%`} />
          <ReferenceArea x1={0} x2={POPULARITY_FACTOR} y1={splitY} y2={100} fill={colors.Puzzle} fillOpacity={bandOpacity} label={label("Puzzles", "insideTopLeft")} />
          <ReferenceArea x1={POPULARITY_FACTOR} x2={maxX} y1={splitY} y2={100} fill={colors.Star} fillOpacity={bandOpacity} label={label("Stars", "insideTopRight")} />
          <ReferenceArea x1={0} x2={POPULARITY_FACTOR} y1={minY} y2={splitY} fill={colors.Dog} fillOpacity={bandOpacity} label={label("Dogs", "insideBottomLeft")} />
          <ReferenceArea x1={POPULARITY_FACTOR} x2={maxX} y1={minY} y2={splitY} fill={colors.Plowhorse} fillOpacity={bandOpacity} label={label("Plowhorses", "insideBottomRight")} />
          <ReferenceLine x={POPULARITY_FACTOR} stroke={ink} strokeDasharray="4 4" />
          <ReferenceLine y={splitY} stroke={ink} strokeDasharray="4 4" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip />} />
          <Legend verticalAlign="top" align="right" height={24} wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: ink }}>{value}</span>} />
          {QUADRANTS.map((q) => (
            <Scatter
              key={q}
              name={q}
              data={points.filter((p) => p.quadrant === q)}
              fill={colors[q]}
              stroke={dark ? "#1a1a19" : "#ffffff"}
              strokeWidth={2}
              onClick={(p: unknown) => {
                const id = (p as { itemId?: number } | undefined)?.itemId;
                if (id != null) onPick(id);
              }}
              cursor="pointer"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function CostDrawer({ itemId, colors, onClose }: { itemId: number | null; colors: Record<Quadrant, string>; onClose: () => void }) {
  const [target, setTarget] = useState(70);
  const [data, setData] = useState<ItemCostBreakdownDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (itemId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getItemCostBreakdown(itemId, target)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { setData(null); setError(errorMessage(e, "Failed to load cost breakdown")); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [itemId, target]);

  useEffect(() => {
    if (itemId == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [itemId, onClose]);

  if (itemId == null) return null;
  const priceGap = data ? data.suggestedPrice - data.price : 0;

  return (
    <div className="fixed inset-0 z-[99999] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="relative flex h-full w-full flex-col overflow-y-auto bg-white shadow-xl dark:bg-gray-900 sm:w-[480px]" role="dialog" aria-label="Cost breakdown">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Cost breakdown</div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{data?.name ?? "…"}</h3>
          </div>
          <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-4 p-4">
          {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader /> Loading…</div>}
          {error && !loading && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}

          {data && !loading && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Kpi title="Sell price" value={money(data.price)} sub={data.category} />
                <Kpi title="Unit cost" value={money(data.unitCost)} sub={data.costSource === "recipe" ? "from recipe" : data.costSource === "buy" ? "from buy price (no recipe)" : "unknown — no recipe or buy price"} tone={data.costSource === "none" ? "bad" : "neutral"} />
                <Kpi title="Gross margin" value={money(data.grossMargin)} tone={data.grossMargin >= 0 ? "ok" : "bad"} />
                <Kpi title="Margin %" value={pct(data.marginPct)} tone={data.marginPct >= 60 ? "ok" : "bad"} />
              </div>

              {data.unpricedIngredients.length > 0 && (
                <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                  No buy price yet for: {data.unpricedIngredients.join(", ")}. The cost below is understated until they are priced on the Ingredients page.
                </div>
              )}

              <div>
                <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Ingredients</div>
                {data.lines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    This item has no recipe. Add one on the Recipes page to cost it from ingredients.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-white/[0.03]">
                        <TableRow>
                          {["Ingredient", "Qty", "In stock unit", "Unit cost", "Line cost"].map((h) => (
                            <TableCell key={h} isHeader className="px-3 py-2 text-start text-xs font-medium text-gray-500 dark:text-gray-400">{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.lines.map((l) => (
                          <TableRow key={l.ingredientId} className="border-t border-gray-100 dark:border-gray-800">
                            <TableCell className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                              {l.ingredient}
                              {!l.converted && <span className="ml-1 text-xs text-yellow-600" title="Unit could not be converted; quantity used as-is">⚠</span>}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{l.quantity} {l.unit}</TableCell>
                            <TableCell className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{l.convertedQuantity} {l.ingredientUnit}</TableCell>
                            <TableCell className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">{l.unitCost == null ? <span className="text-yellow-600">unpriced</span> : `${money(l.unitCost)}/${l.ingredientUnit}`}</TableCell>
                            <TableCell className="px-3 py-2 text-right text-sm font-medium text-gray-800 dark:text-gray-200">{money(l.lineCost)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03]">
                          <TableCell colSpan={4} className="px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Recipe cost</TableCell>
                          <TableCell className="px-3 py-2 text-right text-sm font-semibold text-gray-800 dark:text-gray-200">{money(data.recipeCost)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-25 p-4 dark:border-brand-800 dark:bg-brand-500/10">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="target-margin">Target margin %</Label>
                    <Input id="target-margin" type="number" min="0" max="99" step={1} value={target}
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v < 100) setTarget(v); }} />
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggested price</div>
                    <div className="text-2xl font-semibold text-gray-800 dark:text-white/90">{money(data.suggestedPrice)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">rounded {money(data.suggestedPriceRounded)}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {priceGap > 0.005
                    ? `Raise by ${money(priceGap)} to reach ${data.targetMarginPct}% margin on a ${money(data.unitCost)} cost.`
                    : `Current price already yields ${pct(data.marginPct)} — ${money(Math.abs(priceGap))} of headroom above the target.`}
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: colors.Star }} aria-hidden="true" />
                Price = cost ÷ (1 − target). Margin uses list price; the matrix uses realised revenue for contribution.
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── page ───────────────────────────────────────────────────────────────────
export default function MenuEngineering() {
  const { hasAnyRole, loading: authLoading, authenticated } = useAuth();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const colors = QUADRANT_COLORS[dark ? "dark" : "light"];

  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [threshold, setThreshold] = useState(60);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [applied, setApplied] = useState(() => ({ from, to, threshold, categoryIds: [] as number[] }));

  const [report, setReport] = useState<MenuEngineeringReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("contribution");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | "all">("all");
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  useEffect(() => {
    getCategories(1, 100)
      .then((res) => setCategoryOptions((res.data || []).filter((c) => c.type === "item").map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCategoryOptions([]));
  }, []);

  const query = useMemo(() => {
    const toExclusive = new Date(`${applied.to}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return {
      from: applied.from ? `${applied.from}T00:00:00Z` : undefined,
      to: applied.to ? toExclusive.toISOString() : undefined,
      categoryIds: applied.categoryIds.length ? applied.categoryIds : undefined,
      marginThresholdPct: applied.threshold,
    };
  }, [applied]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setReport(await getMenuEngineeringReport(query)); }
    catch (e) { setReport(null); setError(errorMessage(e, "Failed to load the menu engineering report")); }
    finally { setLoading(false); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const apply = () => setApplied({ from, to, threshold, categoryIds: selectedCategoryIds });
  const reset = () => {
    const f = toInputDate(new Date(Date.now() - 30 * 86400000));
    const t = toInputDate(new Date());
    setFrom(f); setTo(t); setThreshold(60); setSelectedCategoryIds([]);
    setApplied({ from: f, to: t, threshold: 60, categoryIds: [] });
  };
  const toggleCategory = (id: number) => setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" || k === "category" || k === "quadrant" ? "asc" : "desc"); }
  };

  const rows = useMemo(() => {
    if (!report) return [];
    const mul = sortDir === "asc" ? 1 : -1;
    return report.items
      .filter((i) => quadrantFilter === "all" || i.quadrant === quadrantFilter)
      .slice()
      .sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        if (typeof av === "string" && typeof bv === "string") return mul * av.localeCompare(bv);
        return mul * ((av as number) - (bv as number));
      });
  }, [report, sortKey, sortDir, quadrantFilter]);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await exportMenuEngineeringCsv(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `menu-engineering-${applied.from}-to-${applied.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setNotice(errorMessage(e, "Export failed")); }
    finally { setExporting(false); }
  }

  if (authLoading) return <div className="p-6 text-center">Loading...</div>;
  if (!authenticated) return <Navigate to="/signin" replace />;
  if (!hasAnyRole("admin", "admin_fnb")) return <Navigate to="/" replace />;

  const th = (key: SortKey, label: string, align = "text-start") => (
    <TableCell key={key} isHeader className={`cursor-pointer select-none whitespace-nowrap px-3 py-3 ${align} text-xs font-medium text-gray-500 hover:text-brand-500 dark:text-gray-400`}>
      <button type="button" className="inline-flex items-center" onClick={() => onSort(key)}>{label}<SortIcon active={sortKey === key} dir={sortDir} /></button>
    </TableCell>
  );
  const td = "px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap";
  const totals = report?.totals;

  return (
    <div>
      <PageMeta title="Menu Engineering | Axis" description="Recipe costing and the Star / Plowhorse / Puzzle / Dog matrix" />
      <PageBreadcrumb pageTitle="Menu Engineering" />

      {notice && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{notice}</div>}

      {/* Filters */}
      <div className={`${card} mb-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label htmlFor="me-from">From</Label>
            <Input id="me-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="me-to">To</Label>
            <Input id="me-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="me-threshold">Low-margin threshold %</Label>
            <Input id="me-threshold" type="number" min="0" max="100" step={1} value={threshold}
              onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setThreshold(Math.min(100, Math.max(0, v))); }} />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button className={btnPrimary} onClick={apply} disabled={loading}>Apply</button>
            <button className={btnSecondary} onClick={reset} disabled={loading}>Reset</button>
            <button className={`${btnSecondary} ml-auto`} onClick={() => void exportCsv()} disabled={exporting || loading || !report}>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>
        {categoryOptions.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">Categories <span className="font-normal text-gray-400">(none = all)</span></div>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((c) => {
                const on = selectedCategoryIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCategory(c.id)} aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"}`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-6 text-gray-500 dark:text-gray-400"><Loader /> Loading…</div>
      )}
      {!loading && error && (
        <div className={`${card} text-center`}>
          <div className="text-sm font-medium text-red-600 dark:text-red-400">{error}</div>
          <button className={`${btnSecondary} mt-3`} onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loading && !error && report && report.items.length === 0 && (
        <div className={`${card} text-center text-sm text-gray-500 dark:text-gray-400`}>
          No menu items in scope. Pick other categories or make sure items are enabled.
        </div>
      )}

      {!loading && !error && report && totals && report.items.length > 0 && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi title="Revenue" value={money(totals.revenue)} sub={`${totals.unitsSold} units · ${totals.itemCount} items`} />
            <Kpi title="Food cost" value={money(totals.cost)} sub={totals.revenue > 0 ? `${pct(100 - totals.avgMarginPct)} of revenue` : undefined} />
            <Kpi title="Contribution" value={money(totals.contribution)} tone={totals.contribution >= 0 ? "ok" : "bad"} />
            <Kpi title="Avg margin" value={pct(totals.avgMarginPct)} sub={`${totals.lowMarginCount} below ${report.marginThresholdPct}%`} tone={totals.avgMarginPct >= report.marginThresholdPct ? "ok" : "bad"} />
          </div>

          {/* Quadrant counts (double as a table filter) */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {QUADRANTS.map((q) => {
              const n = q === "Star" ? totals.stars : q === "Plowhorse" ? totals.plowhorses : q === "Puzzle" ? totals.puzzles : totals.dogs;
              const on = quadrantFilter === q;
              return (
                <button key={q} type="button" onClick={() => setQuadrantFilter(on ? "all" : q)} aria-pressed={on} title={QUADRANT_HINT[q]}
                  className={`${card} text-left transition ${on ? "ring-2 ring-brand-500" : "hover:bg-gray-50 dark:hover:bg-white/5"}`}>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[q] }} />{q}s
                  </div>
                  <div className="mt-1 text-xl font-semibold text-gray-800 dark:text-white/90">{n}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{QUADRANT_HINT[q].split(" — ")[0]}</div>
                </button>
              );
            })}
          </div>

          {report.missingRecipes.length > 0 && (
            <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
              <span className="font-semibold">{report.missingRecipes.length} item{report.missingRecipes.length === 1 ? "" : "s"} without a recipe</span>
              {" "}(costed from buy price, or $0): {report.missingRecipes.slice(0, 12).join(", ")}{report.missingRecipes.length > 12 ? ", …" : ""}
            </div>
          )}

          {/* Chart */}
          <div className={card}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Menu matrix</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                popular ≥ {report.popularityThresholdUnits} units (70% of {report.avgUnitsPerItem} avg) · profitable ≥ {pct(report.profitabilityThresholdPct)} margin · click a dot for its cost
              </div>
            </div>
            <MatrixChart report={report} colors={colors} dark={dark} onPick={setSelectedItem} />
          </div>

          {/* Table */}
          <div className={`${card} p-0`}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Items {quadrantFilter !== "all" && <span className="text-sm font-normal text-gray-500">· {quadrantFilter}s only</span>}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">{rows.length} of {report.items.length} · click a row for the cost breakdown</div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]">
                  <TableRow>
                    {th("name", "Item")}
                    {th("category", "Category")}
                    {th("price", "Price", "text-end")}
                    {th("unitCost", "Unit cost", "text-end")}
                    {th("marginPct", "Margin %", "text-end")}
                    {th("unitsSold", "Units", "text-end")}
                    {th("revenue", "Revenue", "text-end")}
                    {th("contribution", "Contribution", "text-end")}
                    {th("popularityIndex", "Pop. idx", "text-end")}
                    {th("profitabilityIndex", "Prof. idx", "text-end")}
                    {th("quadrant", "Quadrant")}
                    <TableCell isHeader className="px-3 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400">Flags</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={12} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No items in this quadrant.</TableCell></TableRow>
                  )}
                  {rows.map((i) => (
                    <tr key={i.itemId}
                      className="cursor-pointer border-b border-gray-100 hover:bg-brand-25 dark:border-gray-800 dark:hover:bg-white/5"
                      onClick={() => setSelectedItem(i.itemId)}>
                      <TableCell className={`${td} font-medium text-gray-800 dark:text-white/90`}>{i.name}</TableCell>
                      <TableCell className={td}>{i.category}</TableCell>
                      <TableCell className={`${td} text-end`}>{money(i.price)}</TableCell>
                      <TableCell className={`${td} text-end`}>
                        {money(i.unitCost)}
                        {i.costSource !== "recipe" && <span className="ml-1 text-xs text-gray-400" title={i.costSource === "buy" ? "From buy price (no recipe)" : "No cost known"}>{i.costSource === "buy" ? "(buy)" : "(?)"}</span>}
                      </TableCell>
                      <TableCell className={`${td} text-end font-semibold ${i.lowMarginFlag ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>{pct(i.marginPct)}</TableCell>
                      <TableCell className={`${td} text-end`}>{i.unitsSold}</TableCell>
                      <TableCell className={`${td} text-end`}>{money(i.revenue)}</TableCell>
                      <TableCell className={`${td} text-end font-semibold ${i.contribution >= 0 ? "text-gray-800 dark:text-white/90" : "text-red-600 dark:text-red-400"}`}>{money(i.contribution)}</TableCell>
                      <TableCell className={`${td} text-end`}>{idx(i.popularityIndex)}</TableCell>
                      <TableCell className={`${td} text-end`}>{idx(i.profitabilityIndex)}</TableCell>
                      <TableCell className={td}><QuadrantPill quadrant={i.quadrant} colors={colors} /></TableCell>
                      <TableCell className={td}>
                        <div className="flex gap-1">
                          {i.lowMarginFlag && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">Low margin</span>}
                          {!i.hasRecipe && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">No recipe</span>}
                        </div>
                      </TableCell>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      <CostDrawer itemId={selectedItem} colors={colors} onClose={() => setSelectedItem(null)} />
    </div>
  );
}

import { useBranchScope } from "./useBranchScope";

/**
 * Small line under the page title telling which branch the StockOps lists are
 * scoped to. With a branch selected the API returns that branch's locations,
 * stocktakes, transfers and batches plus the shared ones (BranchId null);
 * without a selection everything is shown.
 */
export default function BranchScopeBadge({ note }: { note?: string }) {
  const { branchId, branch, loading } = useBranchScope();

  const label = branchId
    ? branch
      ? `${branch.name} (${branch.code})`
      : loading
      ? `Branch #${branchId}`
      : `Branch #${branchId}`
    : "All branches";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400" data-testid="branch-scope">
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Scope: {label}
      </span>
      <span>
        {branchId
          ? note ?? "Showing this branch's locations and records plus the shared ones. Switch branch in the header."
          : note ?? "No branch selected in the header: showing every location and record."}
      </span>
    </div>
  );
}

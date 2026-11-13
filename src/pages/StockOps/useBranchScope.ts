import { useEffect, useState } from "react";
import {
  BRANCH_CHANGED_EVENT,
  BRANCH_STORAGE_KEY,
  BranchDto,
  getMyBranches,
  getSelectedBranchId,
} from "../../services/branchService";

export type BranchScope = {
  /** Branch id the BranchSwitcher stored under localStorage "axis.branchId" (sent as X-Branch-Id by api.ts). */
  branchId: number | null;
  /** Resolved branch (from /branches/me) when known. */
  branch: BranchDto | null;
  /** True while the branch list is being fetched. */
  loading: boolean;
};

/**
 * Follows the header BranchSwitcher: re-renders when "axis:branch-changed"
 * fires (same tab) or the storage key changes (other tab). StockOps pages use
 * the branchId as an effect dependency so their lists reload with the new
 * X-Branch-Id header.
 */
export function useBranchScope(): BranchScope {
  const [branchId, setBranchId] = useState<number | null>(getSelectedBranchId());
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onChange = () => setBranchId(getSelectedBranchId());
    const onStorage = (e: StorageEvent) => {
      if (e.key === BRANCH_STORAGE_KEY || e.key === null) onChange();
    };
    window.addEventListener(BRANCH_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(BRANCH_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getMyBranches()
      .then((me) => mounted && setBranches(me.branches ?? []))
      .catch(() => mounted && setBranches([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const branch = branchId ? branches.find((b) => b.id === branchId) ?? null : null;
  return { branchId, branch, loading };
}

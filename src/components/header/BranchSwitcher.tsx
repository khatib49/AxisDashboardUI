import { useCallback, useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import {
  BranchDto,
  getMyBranches,
  getSelectedBranchId,
  setSelectedBranchId,
} from "../../services/branchService";

/**
 * Header control: lists /branches/me, stores the pick in localStorage
 * ("axis.branchId") and fires window event "axis:branch-changed".
 * Renders nothing when the API is unreachable or returns no branches.
 */
export default function BranchSwitcher() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(getSelectedBranchId());
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await getMyBranches();
      const list = me.branches ?? [];
      setBranches(list);
      const stored = getSelectedBranchId();
      const valid = stored && list.some((b) => b.id === stored) ? stored : null;
      const pick = valid ?? me.defaultBranchId ?? list[0]?.id ?? null;
      if (pick !== stored) setSelectedBranchId(pick);
      setSelectedId(pick);
    } catch {
      setBranches([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded || branches.length === 0) return null;

  const current = branches.find((b) => b.id === selectedId) ?? branches[0];

  function choose(id: number) {
    setSelectedBranchId(id);
    setSelectedId(id);
    setIsOpen(false);
  }

  if (branches.length === 1) {
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
        title="Current branch"
      >
        <BranchIcon />
        {current.name}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="dropdown-toggle inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        title="Switch branch"
      >
        <BranchIcon />
        <span className="max-w-[120px] truncate">{current.name}</span>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900 text-gray-800 dark:text-white/90"
      >
        <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400">Branch</div>
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => choose(b.id)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 ${
              b.id === current.id ? "font-semibold text-brand-500 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <span className="truncate">{b.name}</span>
            <span className="ml-2 text-xs text-gray-400">{b.code}</span>
          </button>
        ))}
      </Dropdown>
    </div>
  );
}

function BranchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

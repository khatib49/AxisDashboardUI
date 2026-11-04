import api from "./api";

export type BranchDto = {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  currencyCode: string;
  timeZoneId: string;
  isActive: boolean;
  isDefault: boolean;
  openingTime?: string | null; // "HH:mm"
  closingTime?: string | null;
  createdOn: string;
  modifiedOn?: string | null;
};

export type BranchCreateDto = {
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  currencyCode?: string | null;
  timeZoneId?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
};

export type BranchUpdateDto = Partial<BranchCreateDto>;

/** source: "admin" | "assigned" | "default-fallback" */
export type MyBranchesDto = {
  branches: BranchDto[];
  defaultBranchId?: number | null;
  source: string;
};

export type UserBranchDto = {
  id: number;
  userId: number;
  userName?: string | null;
  email?: string | null;
  branchId: number;
  branchCode: string;
  branchName: string;
  isDefault: boolean;
};

export type BranchSettingDto = {
  key: string;
  value?: string | null;
  updatedOn: string;
  updatedBy?: string | null;
};

export type BranchKpiDto = {
  branchId: number;
  code: string;
  name: string;
  currencyCode: string;
  isDefault: boolean;
  sales: number;
  orders: number;
  averageTicket: number;
  openInvoices: number;
  openInvoicesValue: number;
};

/**
 * attribution: "default-branch" while no transaction carries a branch,
 * "transaction" once at least one does (legacy rows still count towards the default branch).
 */
export type ConsolidatedDashboardDto = {
  from: string;
  to: string;
  attribution: string;
  attributionNote: string;
  branches: BranchKpiDto[];
  total: BranchKpiDto;
};

/** Minimal shape of /users rows used by the assignment picker. */
export type BranchUserPick = {
  id: number | string;
  email?: string;
  displayName?: string;
  roles?: string[];
};

export const BRANCH_STORAGE_KEY = "axis.branchId";
export const BRANCH_CHANGED_EVENT = "axis:branch-changed";

export function getSelectedBranchId(): number | null {
  try {
    const raw = localStorage.getItem(BRANCH_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function setSelectedBranchId(id: number | null): void {
  try {
    if (id && id > 0) localStorage.setItem(BRANCH_STORAGE_KEY, String(id));
    else localStorage.removeItem(BRANCH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BRANCH_CHANGED_EVENT, { detail: { branchId: id } }));
  }
}

export async function getMyBranches(): Promise<MyBranchesDto> {
  const res = await api.get<MyBranchesDto>("/branches/me");
  return res.data;
}

export async function getBranches(includeInactive = true): Promise<BranchDto[]> {
  const res = await api.get<BranchDto[]>(`/branches?includeInactive=${includeInactive}`);
  return res.data;
}

export async function getBranch(id: number): Promise<BranchDto> {
  const res = await api.get<BranchDto>(`/branches/${id}`);
  return res.data;
}

export async function createBranch(payload: BranchCreateDto): Promise<BranchDto> {
  const res = await api.post<BranchDto>("/branches", payload);
  return res.data;
}

export async function updateBranch(id: number, payload: BranchUpdateDto): Promise<BranchDto> {
  const res = await api.put<BranchDto>(`/branches/${id}`, payload);
  return res.data;
}

export async function deleteBranch(id: number): Promise<void> {
  await api.delete(`/branches/${id}`);
}

export async function getBranchUsers(id: number): Promise<UserBranchDto[]> {
  const res = await api.get<UserBranchDto[]>(`/branches/${id}/users`);
  return res.data;
}

export async function assignUser(id: number, userId: number, isDefault = false): Promise<UserBranchDto> {
  const res = await api.post<UserBranchDto>(`/branches/${id}/users`, { userId, isDefault });
  return res.data;
}

export async function unassignUser(id: number, userId: number): Promise<void> {
  await api.delete(`/branches/${id}/users/${userId}`);
}

export async function getBranchSettings(id: number): Promise<BranchSettingDto[]> {
  const res = await api.get<BranchSettingDto[]>(`/branches/${id}/settings`);
  return res.data;
}

/** value === null deletes the key. */
export async function setBranchSettings(
  id: number,
  settings: { key: string; value: string | null }[]
): Promise<BranchSettingDto[]> {
  const res = await api.put<BranchSettingDto[]>(`/branches/${id}/settings`, settings);
  return res.data;
}

export async function getConsolidated(from?: string, to?: string): Promise<ConsolidatedDashboardDto> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const res = await api.get<ConsolidatedDashboardDto>(`/branches/consolidated${qs ? `?${qs}` : ""}`);
  return res.data;
}

export type BackfillResult = {
  success: boolean;
  error?: string | null;
  message: string;
  /** Number of transactions that received a BranchId. */
  data: number;
};

/** Admin one-off: stamp BranchId on every transaction that has none (default: the default branch). */
export async function backfillTransactions(branchId?: number | null): Promise<BackfillResult> {
  const qs = branchId && branchId > 0 ? `?branchId=${branchId}` : "";
  const res = await api.post<BackfillResult>(`/branches/backfill-transactions${qs}`);
  return res.data;
}

export type BranchBackfillResultDto = {
  branchId: number;
  branchCode: string;
  branchName: string;
  /** Tables processed, in order. */
  tables: string[];
  /** Table name => rows whose BranchId was null and is now branchId. */
  counts: Record<string, number>;
  total: number;
};

export type BackfillAllResult = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: BranchBackfillResultDto | null;
};

/**
 * Phase 3: stamp BranchId on every legacy row of the branch-aware tables
 * (transactions, Till_*, Delivery_Orders, Floor_Reservations/Tips, Hr_AttendanceRecords,
 * StockOps_*, Promo_*). tables = "all" or a comma-separated subset.
 */
export async function backfillAll(branchId?: number | null, tables = "all"): Promise<BackfillAllResult> {
  const q = new URLSearchParams();
  if (branchId && branchId > 0) q.set("branchId", String(branchId));
  q.set("tables", tables || "all");
  const res = await api.post<BackfillAllResult>(`/branches/backfill?${q.toString()}`);
  return res.data;
}

/** Staff list for the assignment picker (existing /users endpoint, unchanged). */
export async function listStaffUsers(pageSize = 200): Promise<BranchUserPick[]> {
  const res = await api.get<{ data?: BranchUserPick[] }>(`/users?Page=1&PageSize=${pageSize}`);
  return res.data?.data ?? [];
}

export default {
  getMyBranches,
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  getBranchUsers,
  assignUser,
  unassignUser,
  getBranchSettings,
  setBranchSettings,
  getConsolidated,
  backfillTransactions,
  backfillAll,
  listStaffUsers,
  getSelectedBranchId,
  setSelectedBranchId,
};

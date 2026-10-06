import { get, post, put, del } from "./api";

// Owners (partners + ownership %) and their drawings — cash taken out for
// personal use. Drawings are booked against equity (each owner's 33x0
// Drawings account under the Owners' Drawings header), never as an expense.

export type OwnerDto = {
  id: number;
  name: string;
  ownershipPercent: number;
  drawingsAccountId: number;
  drawingsAccountNumber: string;
  drawingsAccountName: string;
  notes: string | null;
  isActive: boolean;
  createdOn: string;
  modifiedOn: string | null;
};

export type OwnerCreateDto = {
  name: string;
  ownershipPercent: number;
  notes?: string | null;
  /** Link an existing Equity account instead of creating a new one. */
  existingAccountId?: number | null;
};

export type OwnerUpdateDto = {
  name: string;
  ownershipPercent: number;
  notes?: string | null;
  isActive: boolean;
};

export type OwnerDrawingDto = {
  id: number;
  ownerId: number;
  ownerName: string;
  amount: number;
  drawingDate: string;
  paymentMethod: string | null;
  comment: string | null;
  journalEntryId: number | null;
  journalEntryNumber: string | null;
  isVoided: boolean;
  voidedOn: string | null;
  voidReason: string | null;
  createdBy: number | null;
  createdOn: string;
};

export type OwnerDrawingSaveDto = {
  ownerId: number;
  amount: number;
  drawingDate: string; // yyyy-MM-dd
  paymentMethod?: string | null;
  comment?: string | null;
};

export type OwnerDrawingFilter = {
  from?: string | null;
  to?: string | null;
  ownerId?: number | null;
  includeVoided?: boolean;
  page?: number;
  pageSize?: number;
};

export type PagedOwnerDrawingsResult = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalAmountAll: number;
  items: OwnerDrawingDto[];
};

export type OwnerDrawingsLineDto = {
  ownerId: number | null;
  name: string;
  ownershipPercent: number;
  accountId: number;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
  drawn: number;
  entryCount: number;
  shareOfDrawingsPercent: number;
  entitledAmount: number;
  variance: number;
  lifetimeDrawn: number;
};

export type UnlinkedEquityCategoryDto = {
  categoryId: number;
  categoryName: string;
  accountNumber: string;
  accountName: string;
  totalAmount: number;
  entryCount: number;
};

export type OwnerDrawingsSummaryDto = {
  from: string | null;
  to: string | null;
  headerAccountId: number;
  headerAccountNumber: string;
  headerAccountName: string;
  totalDrawings: number;
  lifetimeTotalDrawings: number;
  totalOwnershipPercent: number;
  owners: OwnerDrawingsLineDto[];
  otherAccounts: OwnerDrawingsLineDto[];
  unlinkedEquityCategories: UnlinkedEquityCategoryDto[];
};

// ── Owners ──────────────────────────────────────────────────────────────

export async function getOwners(includeInactive = false): Promise<OwnerDto[]> {
  return await get<OwnerDto[]>(`/owners${includeInactive ? "?includeInactive=true" : ""}`);
}

export async function createOwner(dto: OwnerCreateDto): Promise<OwnerDto> {
  return await post<OwnerDto>("/owners", dto);
}

export async function updateOwner(id: number, dto: OwnerUpdateDto): Promise<OwnerDto> {
  return await put<OwnerDto>(`/owners/${id}`, dto);
}

export async function deactivateOwner(id: number): Promise<void> {
  return await del<void>(`/owners/${id}`);
}

// ── Drawings ────────────────────────────────────────────────────────────

export async function queryOwnerDrawings(filter: OwnerDrawingFilter = {}): Promise<PagedOwnerDrawingsResult> {
  const params = new URLSearchParams();
  if (filter.from) params.append("from", filter.from);
  if (filter.to) params.append("to", filter.to);
  if (filter.ownerId) params.append("ownerId", String(filter.ownerId));
  if (filter.includeVoided) params.append("includeVoided", "true");
  if (filter.page) params.append("page", String(filter.page));
  if (filter.pageSize) params.append("pageSize", String(filter.pageSize));
  const qs = params.toString();
  return await get<PagedOwnerDrawingsResult>(`/owners/drawings${qs ? `?${qs}` : ""}`);
}

export async function createOwnerDrawing(dto: OwnerDrawingSaveDto): Promise<OwnerDrawingDto> {
  return await post<OwnerDrawingDto>("/owners/drawings", dto);
}

export async function updateOwnerDrawing(id: number, dto: OwnerDrawingSaveDto): Promise<OwnerDrawingDto> {
  return await put<OwnerDrawingDto>(`/owners/drawings/${id}`, dto);
}

export async function voidOwnerDrawing(id: number, reason?: string | null): Promise<OwnerDrawingDto> {
  return await post<OwnerDrawingDto>(`/owners/drawings/${id}/void`, { reason: reason ?? null });
}

// ── Report ──────────────────────────────────────────────────────────────

export async function getOwnerDrawingsSummary(from?: string | null, to?: string | null): Promise<OwnerDrawingsSummaryDto> {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const qs = params.toString();
  return await get<OwnerDrawingsSummaryDto>(`/owners/drawings-summary${qs ? `?${qs}` : ""}`);
}

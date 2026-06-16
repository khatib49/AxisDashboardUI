import { get, post } from "./api";

export type PurchaseLineDto = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  notes: string | null;
};

export type PurchaseDto = {
  id: number;
  supplierId: number | null;
  supplierName: string | null;
  purchaseDate: string;
  invoiceNumber: string | null;
  totalCost: number;
  notes: string | null;
  createdBy: string | null;
  createdOn: string;
  lines: PurchaseLineDto[];
};

export type PurchaseLineInputDto = {
  ingredientId: number;
  quantity: number;
  unitCost: number;
  notes?: string | null;
};

export type PurchaseCreateDto = {
  supplierId?: number | null;
  purchaseDate: string; // ISO
  invoiceNumber?: string | null;
  notes?: string | null;
  lines: PurchaseLineInputDto[];
};

export type PagedPurchases = {
  totalCount: number;
  data: PurchaseDto[];
  pageNumber: number;
  pageSize: number;
};

export type PriceTrendPoint = {
  date: string;
  unitCost: number;
  quantity: number;
  supplierId: number | null;
  supplierName: string | null;
  purchaseId: number;
};

export async function createPurchase(dto: PurchaseCreateDto): Promise<PurchaseDto> {
  return await post<PurchaseDto>("/purchases", dto);
}

export async function getPurchase(id: number): Promise<PurchaseDto> {
  return await get<PurchaseDto>(`/purchases/${id}`);
}

export async function listPurchases(opts: {
  supplierId?: number | null;
  ingredientId?: number | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<PagedPurchases> {
  const p = new URLSearchParams();
  if (opts.supplierId != null) p.append("supplierId", String(opts.supplierId));
  if (opts.ingredientId != null) p.append("ingredientId", String(opts.ingredientId));
  if (opts.from) p.append("from", opts.from);
  if (opts.to) p.append("to", opts.to);
  if (opts.page) p.append("page", String(opts.page));
  if (opts.pageSize) p.append("pageSize", String(opts.pageSize));
  const qs = p.toString();
  return await get<PagedPurchases>(`/purchases${qs ? `?${qs}` : ""}`);
}

export async function getPriceTrend(
  ingredientId: number,
  from?: string,
  to?: string
): Promise<PriceTrendPoint[]> {
  const p = new URLSearchParams();
  if (from) p.append("from", from);
  if (to) p.append("to", to);
  const qs = p.toString();
  return await get<PriceTrendPoint[]>(`/purchases/price-trend/${ingredientId}${qs ? `?${qs}` : ""}`);
}

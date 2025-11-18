import { get, post, put, del } from "./api";

export type TransactionItem = {
  id: string;
  roomId: string;
  room: string;
  gameTypeId: string;
  gameType: string;
  gameId: string;
  game: string;
  gameSettingId: string;
  gameSetting: string;
  hours: number;
  totalPrice: number;
  statusId: number;
  createdOn: string;
  modifiedOn?: string | null;
  createdBy?: string | null;
};

export type PagedResponse<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
};

export type TransactionQuery = {
  page?: number;
  pageSize?: number;
  categoryId?: number | null;
  search?: string | null;
  createdBy?: string | null;
};

export async function getTransactions(query: TransactionQuery = {}) {
  const { page = 1, pageSize = 10, categoryId, search, createdBy } = query;
  const params: Record<string, unknown> = { Page: page, PageSize: pageSize };
  if (categoryId !== undefined && categoryId !== null)
    params.CategoryId = String(categoryId);
  if (search) params.Search = search;
  if (createdBy) params.CreatedBy = createdBy;

  const res = await get<PagedResponse<TransactionItem>>("/transactions", {
    params,
  });
  return res;
}

export type OrderItemRequest = { itemId: string; quantity: number };

export type ApiResponse<T = unknown> = {
  success: boolean;
  error: string | null;
  message: string;
  data: T;
};

export async function createCoffeeShopOrder(itemsRequest: OrderItemRequest[]) {
  // POST the array as JSON body
  const res = await post<ApiResponse>(
    "/transactions/CreateCoffeeShopOrder",
    itemsRequest
  );
  return res;
}

// ---- Reports: item-transactions & game-transactions ----
export type ItemTransactionLine = {
  itemId: number;
  itemName: string;
  categoryId: number;
  categoryName: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imagePath?: string | null;
};

export type ItemTransaction = {
  transactionId: number;
  createdOn: string;
  statusId: number;
  createdBy: string;
  roomId?: number | null;
  roomName?: string | null;
  setId?: number | null;
  setName?: string | null;
  hours: number;
  totalPrice: number;
  items: ItemTransactionLine[];
};

export type GameTransaction = ItemTransaction & {
  gameTypeId?: number | null;
  gameTypeName?: string | null;
  gameId?: number | null;
  gameName?: string | null;
  gameCategoryId?: number | null;
  gameCategoryName?: string | null;
  gameSettingId?: number | null;
  gameSettingName?: string | null;
};

export type PagedDataResponse<T> = {
  totalCount: number;
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalInvoices?: number;
};

export type TransactionsReportQuery = {
  StatusIds?: number[];
  CategoryIds?: number[];
  CreatedBy?: string[];
  From?: string;
  To?: string;
  Search?: string;
  Page?: number;
  PageSize?: number;
  CategoryId?: number | null;
  search?: string | null;
  createdBy?: string | null;
};

export async function getItemTransactions(query: TransactionsReportQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.StatusIds) params.StatusIds = query.StatusIds;
  if (query.CategoryIds) params.CategoryIds = query.CategoryIds;
  if (query.CreatedBy) params.CreatedBy = query.CreatedBy;
  if (query.From) params.From = query.From;
  if (query.To) params.To = query.To;
  if (query.Search) params.Search = query.Search;
  if (query.Page !== undefined) params.Page = query.Page;
  if (query.PageSize !== undefined) params.PageSize = query.PageSize;
  if (query.CategoryId !== undefined && query.CategoryId !== null)
    params.CategoryId = String(query.CategoryId);
  if (query.search) params.search = query.search;
  if (query.createdBy) params.createdBy = query.createdBy;

  const res = await get<PagedDataResponse<ItemTransaction>>(
    "/TransactionsReports/item-transactions",
    { params }
  );
  return res;
}

export async function getGameTransactions(query: TransactionsReportQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.StatusIds) params.StatusIds = query.StatusIds;
  if (query.CategoryIds) params.CategoryIds = query.CategoryIds;
  if (query.CreatedBy) params.CreatedBy = query.CreatedBy;
  if (query.From) params.From = query.From;
  if (query.To) params.To = query.To;
  if (query.Search) params.Search = query.Search;
  if (query.Page !== undefined) params.Page = query.Page;
  if (query.PageSize !== undefined) params.PageSize = query.PageSize;
  if (query.CategoryId !== undefined && query.CategoryId !== null)
    params.CategoryId = String(query.CategoryId);
  if (query.search) params.search = query.search;
  if (query.createdBy) params.createdBy = query.createdBy;

  const res = await get<PagedDataResponse<GameTransaction>>(
    "/TransactionsReports/game-transactions",
    { params }
  );
  return res;
}

export type DailySalesQuery = {
  from?: string; // date-time format
  to?: string; // date-time format
  categoryIds?: string; // comma-separated category IDs, e.g., "8,5"
};

export type DailySalesData = {
  date: string; // ISO date-time
  itemsTotal: number;
  gamesTotal: number;
  grandTotal: number;
};

export async function getDailySales(query: DailySalesQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.categoryIds) params.categoryIds = query.categoryIds;

  const res = await get<DailySalesData[]>("/TransactionsReports/daily-sales", {
    params,
  });
  return res;
}

export type PeriodTotalsDto = {
  totalAmount: number;
  ordersCount: number;
};

export type TotalSalesQuery = {
  from?: string; // date-time format
  to?: string; // date-time format
  categoryIds?: string; // comma-separated category IDs, e.g., "8,5"
};

export async function getTotalSales(query: TotalSalesQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.categoryIds) params.categoryIds = query.categoryIds;

  const res = await get<PeriodTotalsDto>("/TransactionsReports/total-sales", {
    params,
  });
  return res;
}

export type TransactionUpdateDto = {
  roomId?: number | null;
  gameTypeId?: number | null;
  gameId?: number | null;
  gameSettingId?: number | null;
  hours?: number | null;
  totalPrice?: number | null;
  statusId?: number | null;
  setId?: number | null;
};

export async function updateTransaction(id: number, dto: TransactionUpdateDto) {
  const res = await put(`/transactions/${id}`, dto);
  return res;
}

export async function deleteTransaction(id: number) {
  const res = await del(`/transactions/${id}`);
  return res;
}

export default {
  getTransactions,
  createCoffeeShopOrder,
  getItemTransactions,
  getGameTransactions,
  getDailySales,
  getTotalSales,
  updateTransaction,
  deleteTransaction,
};

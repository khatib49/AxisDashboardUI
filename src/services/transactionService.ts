import api, { get, post, put, del } from "./api";

// ============ CORE TYPES ============

export type OrderItemRequest = { 
    itemId: number; 
    quantity: number;
    /** Paid extras picked in the customize sheet. */
    addOns?: Array<{ addOnId: number; quantity: number }>;
};

export type ApiResponse<T = unknown> = {
    success: boolean;
    error: string | null;
    message: string;
    data: T;
};

export type PagedResponse<T> = {
    totalCount: number;
    data: T[];
    pageNumber: number;
    pageSize: number;
};

export type PagedDataResponse<T> = {
    totalCount: number;
    data: T[];
    pageNumber: number;
    pageSize: number;
    totalInvoices?: number;
};

// ============ TRANSACTION TYPES ============

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

export type TransactionQuery = {
    page?: number;
    pageSize?: number;
    categoryId?: number | null;
    search?: string | null;
    createdBy?: string | null;
};

export type TransactionUpdateDto = {
  roomId?: number | null;
  gameTypeId?: number | null;
  gameId?: number | null;
  gameSettingId?: number | null;
  hours?: number | null;
  totalPrice?: number | null;
  statusId?: number | null;
  setId?: number | null;
  items?: Array<{ itemId: number; quantity: number }> | null;  // ← ADD THIS LINE ONLY
  // Attach or change the client on a session. > 0 sets, 0 clears, null leaves alone.
  userId?: number | null;
};

// ============ OPEN SESSION TYPES ============

export type OpenSessionDto = {
    id: number;
    roomId?: number | null;
    room?: string | null;
    gameTypeId?: number | null;
    gameType?: string | null;
    gameId?: number | null;
    game?: string | null;
    gameSettingId?: number | null;
    gameSetting?: string | null;
    hours: number;
    totalPrice: number;
    statusId: number;
    createdOn: string;
    modifiedOn?: string | null;
    createdBy: string;
    items?: unknown[];
    setId?: number | null;
    set?: string | null;
    discountId?: number | null;
    discountName?: string | null;
    numberOfPersons?: number;
    isDayPass?: boolean;
    // Client attached to the session (nullable — cashier can add/change later).
    // Backend TransactionDto already returns these; adding them to the FE
    // type just surfaces what's already in the payload.
    userId?: number | null;
    userName?: string | null;
};

// ============ DISCOUNT TYPES ============

export type DiscountInfo = {
    id: number;
    name: string;
    type: string;
    description?: string | null;
    percentage: number;
    isActive: boolean;
    createdOn: string;
    updatedOn: string;
};

export interface SimpleDiscount {
    name: string;
    percentage: number;
}

// ============ ITEM TRANSACTION TYPES ============

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

export interface ItemTransaction {
    transactionId: number;
    createdOn: string;
    statusId: number;
    createdBy: string;
    roomId?: number;
    roomName?: string;
    setId?: number;
    setName?: string;
    totalPrice: number;
    numberOfPersons?: number;
    items: Array<{
        itemId: number;
        itemName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        categoryName?: string;
        itemType?: string;
        imagePath?: string;
        /** Bundled with an event setting — handed over, but not charged. */
        isIncluded?: boolean;
        /** Paid extras chosen for this line (snapshotted at sale time). */
        addOns?: Array<{ addOnId: number; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    }>;
    discount?: SimpleDiscount | null;
    comment?: string;
    userId?: number;
    userName?: string;
    channelId?: number;
    channelName?: string;
    modifiedOn?: string;
}

// ============ GAME TRANSACTION TYPES ============

export interface GameTransaction {
    id: number;
    transactionId?: number;  // Alias for id
    createdOn: string;
    statusId: number;
    createdBy: string;
    roomId?: number;
    roomName?: string;
    room?: string;  // Alias for roomName
    setId?: number;
    setName?: string;
    set?: string;  // Alias for setName
    gameId?: number;
    gameName?: string;
    game?: string;  // Alias for gameName
    gameTypeId?: number;
    gameTypeName?: string;
    gameType?: string;  // Alias for gameTypeName
    gameCategoryName?: string;
    gameSettingId?: number;
    gameSettingName?: string;
    gameSetting?: string;  // Alias for gameSettingName
    hours: number;
    isDayPass: boolean;
    totalPrice: number;
    discountId?: number;
    discountName?: string;
    discountPercentage?: number;
    discount?: SimpleDiscount | null;
    numberOfPersons?: number;
    userId?: number;
    userName?: string;
    comment?: string;
    channelId?: number;
    channelName?: string;
    expectedEndOn?: string;
    modifiedOn?: string;
    items?: Array<{
        itemId: number;
        itemName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        categoryName?: string;
        itemType?: string;
        price?: number; 
    imagePath?: string;
    }>;
}

// ============ OPEN INVOICE TYPES ============

export interface OpenInvoiceDto {
    id: number;
    totalPrice: number;
    createdOn: string;
    createdBy: string;
    userId?: number;
    userName?: string;
    discountId?: number;
    discountName?: string;
    discountPercentage?: number;
    statusId: number;
    comment?: string;
    roomId?: number;
    room?: string;
    setId?: number;
    set?: string;
    items: Array<{
        itemId: number;
        itemName: string;
        quantity: number;
        price: number;
        type: string;
        isIncluded?: boolean;
        addOns?: Array<{ addOnId: number; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
    }>;
}

export interface OpenInvoiceResponse {
    success: boolean;
    data?: OpenInvoiceDto[];
    message?: string;
    error?: string;
}

export interface SingleInvoiceResponse {
    success: boolean;
    data?: OpenInvoiceDto;
    message?: string;
    error?: string;
}

// ============ REPORTS QUERY TYPES ============

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

export type DailySalesQuery = {
    from?: string;
    to?: string;
    categoryIds?: string;
};

export type DailySalesData = {
    date: string;
    itemsTotal: number;
    gamesTotal: number;
    grandTotal: number;
};

export type PeriodTotalsDto = {
    totalAmount: number;
    ordersCount: number;
};

export type TotalSalesQuery = {
    from?: string;
    to?: string;
    categoryIds?: string;
};

export type OrdersCountQuery = {
    from?: string;
    to?: string;
    categoryIds?: string;
};

export type ItemSalesReportDto = {
    itemId: number;
    itemName: string;
    categoryId: number;
    categoryName: string;
    totalQuantity: number;
    totalAmount: number;
    imagePath?: string | null;
};

export type ItemSalesReportQuery = {
    from?: string;
    to?: string;
    categoryIds?: string;
    top?: number;
};

export type GameHourlySalesDto = {
    hour: number;
    sessionsCount: number;
    totalHours: number;
    totalAmount: number;
};

export type GameHourlySalesQuery = {
    from?: string;
    to?: string;
    categoryIds?: string;
};

// ============ API FUNCTIONS ============

// --- Basic Transactions ---

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

export async function updateTransaction(id: number, dto: TransactionUpdateDto) {
    const res = await put(`/transactions/${id}`, dto);
    return res;
}

export async function deleteTransaction(id: number) {
    const res = await del(`/transactions/${id}`);
    return res;
}

// Narrow endpoint the cashier UI uses to attach or detach a client on
// an open Board / PS5 session. Backed by PUT /transactions/{id}/client,
// which is authorized for cashier + gamecashier + admin_fnb + admin.
// Pass userId = null (or 0) to detach the client.
export async function attachClientToTransaction(id: number, userId: number | null) {
    const res = await put(`/transactions/${id}/client`, { userId });
    return res;
}

// Same narrow shape for discounts: PUT /transactions/{id}/discount, open to
// cashier + gamecashier + admin_fnb + admin. The server recomputes the total
// and returns the refreshed transaction, so the caller should trust the
// response rather than doing its own math. Pass null (or 0) to remove.
export async function setTransactionDiscount(id: number, discountId: number | null) {
    const res = await put(`/transactions/${id}/discount`, { discountId });
    return res as { success: boolean; error?: string; message?: string; data?: GameTransaction };
}

// ADMIN-ONLY: replace ALL item lines on a transaction (any status, any
// type). Backend diffs against current lines, syncs stock (item counters
// + ingredient consumption), adjusts TotalPrice discount-aware, and
// writes an AdminItemsEdit audit entry.
export async function replaceTransactionItems(
    id: number,
    items: Array<{ itemId: number; quantity: number }>,
) {
    const res = await put(`/transactions/${id}/items`, { items });
    return res;
}

// --- Game Sessions ---

export async function getOpenPs5Sessions() {
    const res = await get<ApiResponse<OpenSessionDto[]>>(
        "/transactions/GetOpenPs5Sessions"
    );
    return res;
}

export async function getOpenBoardGameSessions() {
    const res = await get<ApiResponse<OpenSessionDto[]>>(
        "/transactions/GetOpenBoardGameSessions"
    );
    return res;
}

export async function closeGameSession(invoiceId: number, walletAmount = 0) {
    // walletAmount > 0 settles that much from the client's wallet (server
    // clamps to the final time-based total); the rest is cash.
    const q = walletAmount > 0 ? `?walletAmount=${walletAmount}` : "";
    const url = `/transactions/sessions/${invoiceId}/close${q}`;
    const res = await post<ApiResponse>(url, null);
    return res;
}

// --- Coffee Shop Orders ---

export async function updateOpenInvoiceSet(
    invoiceId: number,
    setId: number | null
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    const res = await put<{ success: boolean; data?: any; message?: string; error?: string }>(
        `/transactions/UpdateOpenInvoiceSet/${invoiceId}`,
        { setId }
    );
    return res;
}

// Main-dashboard transaction row (flat shape from the new
// /transactions/dashboard endpoint).
export type DashboardTransactionRow = {
    id: number;
    createdOn: string;
    createdBy: string;
    statusId: number;
    totalPrice: number;
    channelId?: number | null;
    channelName?: string | null;
    comment?: string | null;
    itemsCount: number;
};

export type PagedDashboardTransactions = {
    totalCount: number;
    data: DashboardTransactionRow[];
    pageNumber: number;
    pageSize: number;
};

export async function getDashboardTransactions(opts: {
    from?: string | null;
    to?: string | null;
    channelId?: number | null;
    page?: number;
    pageSize?: number;
}): Promise<PagedDashboardTransactions> {
    const p = new URLSearchParams();
    if (opts.from) p.append("from", opts.from);
    if (opts.to) p.append("to", opts.to);
    if (opts.channelId != null) p.append("channelId", String(opts.channelId));
    if (opts.page) p.append("page", String(opts.page));
    if (opts.pageSize) p.append("pageSize", String(opts.pageSize));
    const qs = p.toString();
    return await get<PagedDashboardTransactions>(
        `/transactions/dashboard${qs ? `?${qs}` : ""}`
    );
}

// Excel export — returns the raw xlsx Blob so the caller can trigger a
// browser download. Uses the same filter as getDashboardTransactions.
export async function exportDashboardTransactionsXlsx(opts: {
    from?: string | null;
    to?: string | null;
    channelId?: number | null;
}): Promise<Blob> {
    const p = new URLSearchParams();
    if (opts.from) p.append("from", opts.from);
    if (opts.to) p.append("to", opts.to);
    if (opts.channelId != null) p.append("channelId", String(opts.channelId));
    const qs = p.toString();
    const res = await api.get<Blob>(
        `/transactions/dashboard/export${qs ? `?${qs}` : ""}`,
        { responseType: "blob" }
    );
    return res.data as unknown as Blob;
}

export async function createCoffeeShopOrder(
    items: OrderItemRequest[],
    discountId: number | null = null,
    userId: number | null = null,
    comment: string | null = null,
    isOpenInvoice: boolean = false,
    setId: number | null = null,
    // Optional sales channel (e.g. Toters). Trailing param so existing
    // callers don't break; the cashier UI will start passing it.
    channelId: number | null = null,
    // Portion paid from the attached client's wallet (pay-now orders only).
    walletAmount = 0
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    const body: any = {
        userId,
        itemsRequest: items,
        discountId: discountId || 0,
        isOpenInvoice,
        setId,
    };

    if (comment) body.comment = comment;
    if (channelId != null) body.channelId = channelId;
    if (walletAmount > 0) body.walletAmount = walletAmount;

    const res = await post<{ success: boolean; data?: any; message?: string; error?: string }>(
        "/transactions/CreateCoffeeShopOrder",
        body
    );
    return res;
}

// --- Open Invoices ---

export async function getOpenFnbInvoices(): Promise<OpenInvoiceResponse> {
    const res = await get<OpenInvoiceResponse>("/transactions/GetOpenFnbInvoices");
    return res;
}

export async function addItemsToOpenInvoice(
    invoiceId: number,
    items: OrderItemRequest[]
): Promise<SingleInvoiceResponse> {
    const res = await post<SingleInvoiceResponse>(
        `/transactions/AddItemsToOpenInvoice/${invoiceId}`,
        items
    );
    return res;
}

export async function closeOpenInvoice(invoiceId: number, walletAmount = 0): Promise<SingleInvoiceResponse> {
    const q = walletAmount > 0 ? `?walletAmount=${walletAmount}` : "";
    const res = await post<SingleInvoiceResponse>(
        `/transactions/CloseOpenInvoice/${invoiceId}${q}`,
        {}
    );
    return res;
}

// --- Reports ---

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
        {
            params,
            paramsSerializer: {
                indexes: null,
            },
        }
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

    console.log("getGameTransactions query params:", params);

    const res = await get<PagedDataResponse<GameTransaction>>(
        "/TransactionsReports/game-transactions",
        {
            params,
            paramsSerializer: {
                indexes: null,
            },
        }
    );

    console.log("getGameTransactions response:", res);
    return res;
}

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

export async function getOrdersCount(query: OrdersCountQuery = {}) {
    const params: Record<string, unknown> = {};
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.categoryIds) params.categoryIds = query.categoryIds;

    const res = await get<{ ordersCount: number }>(
        "/TransactionsReports/orders/count",
        { params }
    );
    return res;
}

export async function getClientsCount() {
    const res = await get<{ count: number }>(
        "/TransactionsReports/clients/count"
    );
    return res;
}

export async function getItemSalesReport(query: ItemSalesReportQuery = {}) {
    const params: Record<string, unknown> = {};
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.categoryIds) params.categoryIds = query.categoryIds;
    if (query.top !== undefined) params.top = query.top;

    const res = await get<ItemSalesReportDto[]>(
        "/TransactionsReports/items/report",
        { params }
    );
    return res;
}

export async function getGameHourlyHeatmap(query: GameHourlySalesQuery = {}) {
    const params: Record<string, unknown> = {};
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.categoryIds) params.categoryIds = query.categoryIds;

    const res = await get<GameHourlySalesDto[]>(
        "/TransactionsReports/games/hourly-heatmap",
        { params }
    );
    return res;
}


// DELETE /api/transactions/{transactionId}/items/{itemId}
export async function removeItemFromOpenInvoice(
    transactionId: number,
    itemId: number
): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await del<{ success: boolean; message?: string; error?: string }>(
        `/transactions/${transactionId}/items/${itemId}`
    );
    return res;
}
// --- Default Export ---

export default {
    getTransactions,
    createCoffeeShopOrder,
    getItemTransactions,
    getGameTransactions,
    getDailySales,
    getTotalSales,
    getOrdersCount,
    getClientsCount,
    getItemSalesReport,
    getGameHourlyHeatmap,
    updateTransaction,
    deleteTransaction,
    getOpenFnbInvoices,
    addItemsToOpenInvoice,
    closeOpenInvoice,
    getOpenPs5Sessions,
    getOpenBoardGameSessions,
    closeGameSession,
    removeItemFromOpenInvoice
};
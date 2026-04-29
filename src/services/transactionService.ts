import { get, post, put, del } from "./api";

// ============ CORE TYPES ============

export type OrderItemRequest = { 
    itemId: number; 
    quantity: number 
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
    items: Array<{
        itemId: number;
        itemName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        categoryName?: string;
        itemType?: string;
        imagePath?: string;
    }>;
    discount?: SimpleDiscount | null;
    comment?: string;
    userId?: number;
    userName?: string;
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

export async function closeGameSession(invoiceId: number) {
    console.log("Closing session with invoiceId:", invoiceId);
    const url = `/transactions/sessions/${invoiceId}/close`;
    console.log("POST URL:", url);
    const res = await post<ApiResponse>(url, null);
    console.log("Close session response:", res);
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

export async function createCoffeeShopOrder(
    items: OrderItemRequest[],
    discountId: number | null = null,
    userId: number | null = null,
    comment: string | null = null,
    isOpenInvoice: boolean = false,
    setId: number | null = null 
): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    const body: any = {
        userId,
        itemsRequest: items,
        discountId: discountId || 0,
        isOpenInvoice,
        setId,
    };

    if (comment) {
        body.comment = comment;
    }

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

export async function closeOpenInvoice(invoiceId: number): Promise<SingleInvoiceResponse> {
    const res = await post<SingleInvoiceResponse>(
        `/transactions/CloseOpenInvoice/${invoiceId}`,
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
import { get } from "./api";

export type ItemRevenueLineDto = {
    itemId: number;
    itemName: string;
    categoryId: number;
    categoryName: string;
    imagePath?: string | null;
    sellPrice: number;
    buyPrice?: number | null;
    unitsSold: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct?: number | null;
    stockOnHand: number;
    stockBuyValue: number;
    stockSellValue: number;
    stockPotentialProfit: number;
};

export type ItemRevenueCategoryGroupDto = {
    categoryId: number;
    categoryName: string;
    items: ItemRevenueLineDto[];
    totalUnitsSold: number;
    totalRevenue: number;
    totalCogs: number;
    totalGrossProfit: number;
    grossMarginPct?: number | null;
    totalStockBuyValue: number;
    totalStockSellValue: number;
    totalStockPotentialProfit: number;
};

export type ItemRevenueReportDto = {
    from?: string | null;
    to?: string | null;
    filteredCategoryIds: number[];
    categories: ItemRevenueCategoryGroupDto[];
    grandTotalUnitsSold: number;
    grandTotalRevenue: number;
    grandTotalCogs: number;
    grandTotalGrossProfit: number;
    grandGrossMarginPct?: number | null;
    grandTotalStockBuyValue: number;
    grandTotalStockSellValue: number;
    grandTotalStockPotentialProfit: number;
    tcgRevenue: number;
    tcgCogs: number;
    tcgGrossProfit: number;
    tcgStockBuyValue: number;
    tcgStockSellValue: number;
};

export async function getItemRevenueReport(params: {
    from?: string;
    to?: string;
    categoryIds?: number[];
}): Promise<ItemRevenueReportDto> {
    const query = new URLSearchParams();
    if (params.from) query.append("from", params.from);
    if (params.to) query.append("to", params.to);
    if (params.categoryIds?.length) {
        params.categoryIds.forEach(id => query.append("categoryIds", String(id)));
    }
    return await get<ItemRevenueReportDto>(
        `/item-revenue-report?${query.toString()}`
    );
}
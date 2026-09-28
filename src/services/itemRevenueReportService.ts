import { get } from "./api";

export type ItemRevenueLineDto = {
    itemId: number;
    itemName: string;
    categoryId: number;
    categoryName: string;
    imagePath?: string | null;
    sellPrice: number;
    buyPrice?: number | null;
    unitCost?: number | null;
    costSource: "buy" | "recipe" | "none";
    isRecipe: boolean;
    /** Item status is "Deleted" — shown only because it sold in the period; stock counted as 0. */
    isDeleted?: boolean;
    unitsSold: number;
    unitsGivenFree: number;
    grossRevenue: number;
    discountGiven: number;
    addOnRevenue: number;
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
    itemType?: string | null;
    isTcg: boolean;
    items: ItemRevenueLineDto[];
    totalUnitsSold: number;
    totalUnitsGivenFree: number;
    totalGrossRevenue: number;
    totalDiscount: number;
    totalAddOnRevenue: number;
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
    generatedAt: string;
    transactionCount: number;
    filteredCategoryIds: number[];
    categories: ItemRevenueCategoryGroupDto[];
    grandTotalUnitsSold: number;
    grandTotalUnitsGivenFree: number;
    grandTotalGrossRevenue: number;
    grandTotalDiscount: number;
    grandTotalAddOnRevenue: number;
    grandTotalRevenue: number;
    grandTotalCogs: number;
    grandTotalGrossProfit: number;
    grandGrossMarginPct?: number | null;
    grandTotalStockBuyValue: number;
    grandTotalStockSellValue: number;
    grandTotalStockPotentialProfit: number;
    tcgUnitsSold: number;
    tcgRevenue: number;
    tcgCogs: number;
    tcgGrossProfit: number;
    tcgMarginPct?: number | null;
    tcgStockBuyValue: number;
    tcgStockSellValue: number;
    fnbUnitsSold: number;
    fnbRevenue: number;
    fnbCogs: number;
    fnbGrossProfit: number;
    fnbMarginPct?: number | null;
};

/**
 * `from` is inclusive, `to` is EXCLUSIVE — both ISO instants. Send local
 * midnight boundaries (Date#toISOString of a local-midnight Date) so the
 * period is the venue's day, not UTC's.
 */
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

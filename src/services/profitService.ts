import { get } from "./api";

export type ProfitDto = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  transactionCount: number;
  fromDate: string | null;
  toDate: string | null;
};

export type DetailedOverallProfitDto = {
  fnbProfit: ProfitDto;
  gamingProfit: ProfitDto;
  tcgRetailProfit: ProfitDto;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  transactionCount: number;
  fromDate: string | null;
  toDate: string | null;
};

export type ProfitQuery = {
  from?: string;
  to?: string;
  categoryIds?: string;
};

export async function getGamingProfit(query: ProfitQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.categoryIds) params.categoryIds = query.categoryIds;

  const res = await get<ProfitDto>("/Profit/gaming", { params });
  return res;
}

export async function getTcgRetailProfit(query: ProfitQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.categoryIds) params.categoryIds = query.categoryIds;

  const res = await get<ProfitDto>("/Profit/tcg-retail", { params });
  return res;
}

export async function getFnbProfit(query: ProfitQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;
  if (query.categoryIds) params.categoryIds = query.categoryIds;

  const res = await get<ProfitDto>("/Profit/fnb", { params });
  return res;
}

export async function getOverallProfit(
  query: Omit<ProfitQuery, "categoryIds"> = {}
) {
  const params: Record<string, unknown> = {};
  if (query.from) params.from = query.from;
  if (query.to) params.to = query.to;

  const res = await get<DetailedOverallProfitDto>("/Profit/overall", {
    params,
  });
  return res;
}

export default {
  getGamingProfit,
  getTcgRetailProfit,
  getFnbProfit,
  getOverallProfit,
};

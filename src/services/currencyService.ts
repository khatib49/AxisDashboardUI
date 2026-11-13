import api from "./api";

export type BaseResponse<T> = {
  success: boolean;
  error?: string | null;
  message: string;
  data?: T | null;
};

export type CurrencyDto = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBase: boolean;
  isActive: boolean;
  roundingStep: number;
  currentRate?: number | null;
};

export type CurrencyCreateDto = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
  isBase?: boolean;
  isActive?: boolean;
  roundingStep?: number;
  initialRate?: number | null;
};

export type CurrencyUpdateDto = {
  name?: string | null;
  symbol?: string | null;
  decimalPlaces?: number | null;
  isActive?: boolean | null;
  roundingStep?: number | null;
};

export type SetRateDto = {
  currencyCode: string;
  rate: number;
  effectiveFrom?: string | null;
};

export type ExchangeRateDto = {
  id: number;
  currencyCode: string;
  rate: number;
  effectiveFrom: string;
  createdOn: string;
  createdBy: string;
};

export type ConversionResultDto = {
  amount: number;
  from: string;
  to: string;
  result: number;
  rateFrom: number;
  rateTo: number;
  roundingStep: number;
};

export async function getCurrencies(includeInactive = false): Promise<CurrencyDto[]> {
  const res = await api.get<CurrencyDto[]>(`/currency/currencies?includeInactive=${includeInactive}`);
  return res.data;
}

export async function getCurrency(code: string): Promise<CurrencyDto> {
  const res = await api.get<CurrencyDto>(`/currency/currencies/${encodeURIComponent(code)}`);
  return res.data;
}

export async function createCurrency(payload: CurrencyCreateDto): Promise<BaseResponse<CurrencyDto>> {
  const res = await api.post<BaseResponse<CurrencyDto>>(`/currency/currencies`, payload);
  return res.data;
}

export async function updateCurrency(code: string, payload: CurrencyUpdateDto): Promise<BaseResponse<CurrencyDto>> {
  const res = await api.put<BaseResponse<CurrencyDto>>(`/currency/currencies/${encodeURIComponent(code)}`, payload);
  return res.data;
}

/** Active currencies with their latest effective rate. */
export async function getRates(): Promise<CurrencyDto[]> {
  const res = await api.get<CurrencyDto[]>(`/currency/rates`);
  return res.data;
}

export async function setRate(payload: SetRateDto): Promise<BaseResponse<ExchangeRateDto>> {
  const res = await api.post<BaseResponse<ExchangeRateDto>>(`/currency/rates`, payload);
  return res.data;
}

export async function getRateHistory(code: string, from?: string, to?: string): Promise<ExchangeRateDto[]> {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  const qs = params.toString();
  const res = await api.get<ExchangeRateDto[]>(
    `/currency/rates/${encodeURIComponent(code)}/history${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export async function convert(amount: number, from: string, to: string): Promise<BaseResponse<ConversionResultDto>> {
  const params = new URLSearchParams({ amount: String(amount), from, to });
  const res = await api.get<BaseResponse<ConversionResultDto>>(`/currency/convert?${params.toString()}`);
  return res.data;
}

/** Convenience: the LBP-per-USD rate (or the first non-base currency's rate) from the rates list. */
export function pickSecondaryRate(currencies: CurrencyDto[], code = "LBP"): number {
  const c = currencies.find((x) => x.code === code) ?? currencies.find((x) => !x.isBase);
  return c?.currentRate ?? 0;
}

export default {
  getCurrencies,
  getCurrency,
  createCurrency,
  updateCurrency,
  getRates,
  setRate,
  getRateHistory,
  convert,
  pickSecondaryRate,
};

import api from "./api";

/** Mirrors Application/DTOs/RetailDtos.cs (camelCase JSON). */
export type BarcodeDto = {
    id: number;
    itemId: number;
    itemName: string;
    variantId: number | null;
    variantName: string | null;
    code: string;
    symbology: string;
    isPrimary: boolean;
    createdOn: string;
    createdBy: string;
};

export type BarcodeLookupDto = {
    barcodeId: number;
    code: string;
    symbology: string;
    itemId: number;
    itemName: string;
    categoryId: number | null;
    imagePath: string | null;
    variantId: number | null;
    variantName: string | null;
    price: number;
    stock: number;
    requiresSerial: boolean;
    serialsInStock: number;
    matchedSerial: string | null;
};

export type LabelDto = {
    itemId: number;
    itemName: string;
    variantId: number | null;
    variantName: string | null;
    code: string | null;
    symbology: string | null;
    price: number;
};

export type SerialSettingDto = {
    itemId: number;
    itemName: string;
    requiresSerial: boolean;
    prefix: string | null;
    modifiedOn: string | null;
    modifiedBy: string | null;
};

export type SerialStatus = "InStock" | "Sold" | "Returned" | "Faulty";

export type SerialNumberDto = {
    id: number;
    itemId: number;
    itemName: string;
    variantId: number | null;
    variantName: string | null;
    serial: string;
    status: SerialStatus;
    transactionId: number | null;
    receivedOn: string;
    soldOn: string | null;
    returnedOn: string | null;
    notes: string | null;
    branchId: number | null;
};

export type SerialReceiveResultDto = { created: number; createdSerials: string[]; skipped: string[] };

export type SerialSummaryDto = {
    itemId: number;
    itemName: string;
    requiresSerial: boolean;
    prefix: string | null;
    inStock: number;
    sold: number;
    returned: number;
    faulty: number;
    itemQuantity: number;
    variance: number;
};

export type BaseResponse<T> = { success: boolean; error: string | null; message: string; data: T | null };

export const SYMBOLOGIES = ["EAN13", "CODE128", "QR", "OTHER"] as const;

/** Colour / type option of an item as GET /item/{id} returns it (subset). */
export type ItemVariantLite = { id: number; name: string; sku?: string | null; priceDelta: number; quantity: number; isActive: boolean };

/** Active options of one item, read from the existing item endpoint. */
export async function getItemVariants(itemId: number): Promise<ItemVariantLite[]> {
    try {
        const res = await api.get<{ variants?: ItemVariantLite[] | null }>(`/item/${itemId}`);
        return (res.data?.variants || []).filter((v) => v.isActive);
    } catch {
        return [];
    }
}

const barcodes = "/retail/barcodes";
const serials = "/retail/serials";

/** Axios throws on 4xx; this turns a BaseResponse error body into a plain failed response. */
function asResponse<T>(err: unknown): BaseResponse<T> {
    const e = err as { response?: { status?: number; data?: Partial<BaseResponse<T>> }; message?: string };
    const body = e?.response?.data;
    if (body && typeof body === "object" && "success" in body) {
        return { success: false, error: body.error ?? null, message: body.message ?? body.error ?? "Request failed", data: null };
    }
    const status = e?.response?.status;
    const msg = status === 403 ? "You are not allowed to do that." : status === 404 ? "Not available on this server yet." : e?.message || "Request failed";
    return { success: false, error: msg, message: msg, data: null };
}

// ── Barcodes ────────────────────────────────────────────────────────────
export async function listBarcodes(itemId?: number | null, search?: string | null): Promise<BarcodeDto[]> {
    const q = new URLSearchParams();
    if (itemId != null) q.set("itemId", String(itemId));
    if (search) q.set("search", search);
    const res = await api.get<BarcodeDto[]>(`${barcodes}?${q.toString()}`);
    return res.data || [];
}

export async function lookupBarcode(code: string): Promise<BaseResponse<BarcodeLookupDto>> {
    try {
        const res = await api.get<BaseResponse<BarcodeLookupDto>>(`${barcodes}/lookup/${encodeURIComponent(code.trim())}`);
        return res.data;
    } catch (err) {
        return asResponse<BarcodeLookupDto>(err);
    }
}

export async function createBarcode(body: { itemId: number; variantId?: number | null; code: string; symbology?: string; isPrimary?: boolean }): Promise<BaseResponse<BarcodeDto>> {
    try {
        const res = await api.post<BaseResponse<BarcodeDto>>(barcodes, body);
        return res.data;
    } catch (err) {
        return asResponse<BarcodeDto>(err);
    }
}

export async function generateBarcode(itemId: number, variantId?: number | null): Promise<BaseResponse<BarcodeDto>> {
    try {
        const res = await api.post<BaseResponse<BarcodeDto>>(`${barcodes}/generate`, { itemId, variantId: variantId ?? null });
        return res.data;
    } catch (err) {
        return asResponse<BarcodeDto>(err);
    }
}

export async function setPrimaryBarcode(id: number): Promise<BaseResponse<BarcodeDto>> {
    try {
        const res = await api.post<BaseResponse<BarcodeDto>>(`${barcodes}/${id}/primary`);
        return res.data;
    } catch (err) {
        return asResponse<BarcodeDto>(err);
    }
}

export async function deleteBarcode(id: number): Promise<BaseResponse<boolean>> {
    try {
        const res = await api.delete<BaseResponse<boolean>>(`${barcodes}/${id}`);
        return res.data;
    } catch (err) {
        return asResponse<boolean>(err);
    }
}

export async function getLabels(itemIds: number[]): Promise<LabelDto[]> {
    if (itemIds.length === 0) return [];
    const res = await api.get<LabelDto[]>(`${barcodes}/labels?itemIds=${encodeURIComponent(itemIds.join(","))}`);
    return res.data || [];
}

// ── Serials ─────────────────────────────────────────────────────────────
export async function listSerialSettings(): Promise<SerialSettingDto[]> {
    const res = await api.get<SerialSettingDto[]>(`${serials}/settings`);
    return res.data || [];
}

export async function getSerialSetting(itemId: number): Promise<SerialSettingDto | null> {
    try {
        const res = await api.get<SerialSettingDto>(`${serials}/settings/${itemId}`);
        return res.data;
    } catch {
        return null;
    }
}

export async function setSerialSetting(itemId: number, body: { requiresSerial: boolean; prefix?: string | null }): Promise<BaseResponse<SerialSettingDto>> {
    try {
        const res = await api.put<BaseResponse<SerialSettingDto>>(`${serials}/settings/${itemId}`, body);
        return res.data;
    } catch (err) {
        return asResponse<SerialSettingDto>(err);
    }
}

export async function listSerials(params: { itemId?: number | null; status?: SerialStatus | "" | null; search?: string | null; transactionId?: number | null }): Promise<SerialNumberDto[]> {
    const q = new URLSearchParams();
    if (params.itemId != null) q.set("itemId", String(params.itemId));
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.transactionId != null) q.set("transactionId", String(params.transactionId));
    const res = await api.get<SerialNumberDto[]>(`${serials}?${q.toString()}`);
    return res.data || [];
}

export async function receiveSerials(body: { itemId: number; variantId?: number | null; serials?: string[] | null; count?: number | null; notes?: string | null }): Promise<BaseResponse<SerialReceiveResultDto>> {
    try {
        const res = await api.post<BaseResponse<SerialReceiveResultDto>>(`${serials}/receive`, body);
        return res.data;
    } catch (err) {
        return asResponse<SerialReceiveResultDto>(err);
    }
}

export async function sellSerial(serial: string, transactionId: number): Promise<BaseResponse<SerialNumberDto>> {
    try {
        const res = await api.post<BaseResponse<SerialNumberDto>>(`${serials}/sell`, { serial, transactionId });
        return res.data;
    } catch (err) {
        return asResponse<SerialNumberDto>(err);
    }
}

async function changeStatus(id: number, action: "return" | "faulty" | "restock", notes?: string | null): Promise<BaseResponse<SerialNumberDto>> {
    try {
        const res = await api.post<BaseResponse<SerialNumberDto>>(`${serials}/${id}/${action}`, { notes: notes ?? null });
        return res.data;
    } catch (err) {
        return asResponse<SerialNumberDto>(err);
    }
}
export const returnSerial = (id: number, notes?: string | null) => changeStatus(id, "return", notes);
export const markSerialFaulty = (id: number, notes?: string | null) => changeStatus(id, "faulty", notes);
export const restockSerial = (id: number, notes?: string | null) => changeStatus(id, "restock", notes);

export async function getSerialSummary(itemId?: number | null): Promise<SerialSummaryDto[]> {
    const res = await api.get<SerialSummaryDto[]>(`${serials}/summary${itemId != null ? `?itemId=${itemId}` : ""}`);
    return res.data || [];
}

export default {
    listBarcodes, lookupBarcode, createBarcode, generateBarcode, setPrimaryBarcode, deleteBarcode, getLabels,
    listSerialSettings, getSerialSetting, setSerialSetting, listSerials, receiveSerials, sellSerial,
    returnSerial, markSerialFaulty, restockSerial, getSerialSummary,
};

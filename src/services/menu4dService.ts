import api from "./api";
import { publicApi, publicError } from "./selfOrderService";
import { apiError } from "./phase4Service";
import type { BaseResponse } from "./deliveryService";

/** A labelled part of a dish: x/y = centre on the photo (percent); pos3D/normal3D = spot on the 3D model. */
export type Dish4DPart = { name: string; detail?: string | null; x: number; y: number; pos3D?: string | null; normal3D?: string | null };

export type Item4DRow = {
  itemId: number; itemName: string; imagePath?: string | null; category?: string | null; description?: string | null;
  parts: Dish4DPart[]; partsPublished: boolean; realSizeCm?: number | null;
  genStatus: "None" | "Queued" | "Running" | "Done" | "Failed"; genProgress: number; genError?: string | null; genFinishedOn?: string | null;
  hasModel: boolean; modelActive: boolean; modelIsAi: boolean;
};
export type Item4DPublic = { itemId: number; parts: Dish4DPart[]; realSizeCm?: number | null };
export type Menu4DStatus = {
  aiReady: boolean; make3DReady: boolean; itemsWithPhoto: number; withParts: number; published: number;
  withModel: number; queued: number; running: number; failed: number; estimatedCostPerModelUsd: number;
};
export type Menu4DBulk = { queued: number; message: string };

async function call<T>(p: Promise<{ data: T }>): Promise<T> {
  try { return (await p).data; } catch (e) { throw apiError(e); }
}
async function callBase<T>(p: Promise<{ data: BaseResponse<T> }>): Promise<T> {
  try {
    const r = (await p).data;
    if (!r.success || r.data == null) throw new Error(r.message || r.error || "Request failed");
    return r.data;
  } catch (e) {
    const data = (e as { response?: { data?: BaseResponse<T> } })?.response?.data;
    if (data && typeof data === "object" && "success" in data) throw new Error(data.message || data.error || "Request failed");
    if (e instanceof Error && !(e as { response?: unknown }).response) throw e;
    throw apiError(e);
  }
}

export async function listPublicParts(): Promise<Item4DPublic[]> {
  try { return (await publicApi.get<Item4DPublic[]>("/menu-4d/public")).data; } catch (e) { throw publicError(e); }
}

export const list4D = () => call<Item4DRow[]>(api.get("/menu-4d"));
export const status4D = () => call<Menu4DStatus>(api.get("/menu-4d/status"));
export const analyze4D = (itemId: number) => callBase<Item4DRow>(api.post(`/menu-4d/${itemId}/analyze`));
export const analyzeAll4D = () => call<Menu4DBulk>(api.post("/menu-4d/analyze-all"));
export const update4D = (itemId: number, dto: { parts: Dish4DPart[]; published: boolean; realSizeCm?: number | null }) =>
  callBase<Item4DRow>(api.put(`/menu-4d/${itemId}`, dto));
export const publishAll4D = () => call<Menu4DBulk>(api.post("/menu-4d/publish-all"));
export const makeModel4D = (itemId: number) => callBase<Item4DRow>(api.post(`/menu-4d/${itemId}/model`));
export const makeAllModels4D = () => call<Menu4DBulk>(api.post("/menu-4d/models-all"));
export const process4D = () => call<{ changed: number }>(api.post("/menu-4d/process"));

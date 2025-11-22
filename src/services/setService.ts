import { get, post, put, del } from "./api";

export type SetDto = {
  id: number;
  roomId: number;
  roomName: string;
  name: string;
};

export type CreateSetRequest = {
  roomId: number;
  name: string;
};

export type PagedSetsResponse = {
  totalCount: number;
  data: SetDto[];
  pageNumber: number;
  pageSize: number;
};

export type SetsQuery = {
  Page?: number;
  PageSize?: number;
  RoomId?: number;
  Search?: string;
};

export type SetAvailabilityDto = {
  roomId: number;
  available: Array<{ id: number; name: string }>;
  unavailable: Array<{ id: number; name: string }>;
  availableCount: number;
  unavailableCount: number;
};

export async function getSets(query: SetsQuery = {}) {
  const params: Record<string, unknown> = {};
  if (query.Page !== undefined) params.Page = query.Page;
  if (query.PageSize !== undefined) params.PageSize = query.PageSize;
  if (query.RoomId !== undefined) params.RoomId = query.RoomId;
  if (query.Search) params.Search = query.Search;

  const res = await get<PagedSetsResponse>("/Set", { params });
  return res;
}

export async function getSetById(id: number) {
  const res = await get<SetDto>(`/Set/${id}`);
  return res;
}

export async function createSet(body: CreateSetRequest) {
  const res = await post<SetDto>("/Set", body);
  return res;
}

export async function updateSet(id: number, body: CreateSetRequest) {
  await put<void>(`/Set/${id}`, body);
}

export async function deleteSet(id: number) {
  await del<void>(`/Set/${id}`);
}

export async function getSetAvailability(
  roomId: number,
  ongoingStatusId: number = 10
) {
  const res = await get<SetAvailabilityDto>(
    `/room/${roomId}/sets/availability`,
    {
      params: { ongoingStatusId },
    }
  );
  return res;
}

export default {
  getSets,
  getSetById,
  createSet,
  updateSet,
  deleteSet,
  getSetAvailability,
};

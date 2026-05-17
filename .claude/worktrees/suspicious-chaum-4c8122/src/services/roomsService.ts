import api from "./api";

export type RoomDto = {
  id: string;
  name: string;
  categoryId: number;
  categoryName?: string;
  sets: number;
  isOpenSet?: boolean;
  createdOn?: string | null;
  modifiedOn?: string | null;
};

export type PagedRoomsResponse = {
  totalCount: number;
  data: RoomDto[];
  pageNumber?: number;
  pageSize?: number;
};

export async function getRooms(
  page = 1,
  pageSize = 10
): Promise<PagedRoomsResponse> {
  const res = await api.get<PagedRoomsResponse>(
    `/room?Page=${page}&PageSize=${pageSize}`
  );
  return res.data;
}

export async function getRoomById(id: string): Promise<RoomDto> {
  const res = await api.get<RoomDto>(`/room/${id}`);
  return res.data;
}

export type CreateRoomRequest = {
  name: string;
  categoryId: number;
  setCount: number;
  isOpenSet: boolean;
};

export async function createRoom(body: CreateRoomRequest): Promise<RoomDto> {
  const res = await api.post<RoomDto>("/room", body);
  return res.data;
}

export async function updateRoom(
  id: string,
  body: CreateRoomRequest
): Promise<void> {
  await api.put<void>(`/room/${id}`, body);
}

export async function deleteRoom(id: string): Promise<void> {
  await api.delete<void>(`/room/${id}`);
}

export default { getRooms, getRoomById, createRoom, updateRoom, deleteRoom };

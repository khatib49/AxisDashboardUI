import { get, post, put, del } from "./api";

// Sales channel an F&B order can come through (e.g. Toters delivery).
// Optional on TransactionRecord — null means an in-house / direct order.

export type ChannelDto = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdOn: string;
  modifiedOn: string | null;
};

export type ChannelCreateDto = {
  name: string;
  description?: string | null;
};

export type ChannelUpdateDto = {
  name: string;
  description?: string | null;
  isActive: boolean;
};

// Cashier list: default — active only. Admin can pass includeHidden=true to
// see soft-deleted channels in the management page.
export async function getChannels(includeHidden = false): Promise<ChannelDto[]> {
  const q = includeHidden ? "?includeHidden=true" : "";
  return await get<ChannelDto[]>(`/channel${q}`);
}

export async function createChannel(dto: ChannelCreateDto): Promise<ChannelDto> {
  return await post<ChannelDto>("/channel", dto);
}

export async function updateChannel(id: number, dto: ChannelUpdateDto): Promise<ChannelDto> {
  return await put<ChannelDto>(`/channel/${id}`, dto);
}

// Soft-delete (hide). Backend keeps the row so historical transactions
// referencing it still resolve.
export async function deactivateChannel(id: number): Promise<void> {
  return await del<void>(`/channel/${id}`);
}

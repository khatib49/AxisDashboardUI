import api from "./api";

export type SettingAttribute = {
  id: string;
  name: string;
  attributeValue: string;
  settingsId: string;
};

/** One item handed out with an event setting. Quantity is PER PERSON. */
export type SettingItemDto = {
  id: number;
  itemId: number;
  itemName: string;
  itemPrice: number;
  categoryName?: string | null;
  quantityPerPerson: number;
};

export type GameSettingDto = {
  id: string;
  name: string;
  type: string;
  isOffer?: boolean;
  gameId: string;
  gameName?: string;
  hours?: number;
  price?: number;
  isOpenHour?: boolean;
  isDayPass?: boolean;
  createdOn?: string | null;
  modifiedOn?: string | null;
  attributes: SettingAttribute[];
  values: unknown[];
  // false = soft-hidden. Backend filters these out by default; admin UI can
  // request them via includeHidden=true to restore.
  isActive?: boolean;
  /** Event settings (Pre Release, Draft…) can bundle stock items. */
  isEvent?: boolean;
  items?: SettingItemDto[];
};

export type PagedSettingsResponse = {
  totalCount: number;
  data: GameSettingDto[];
  pageNumber?: number;
  pageSize?: number;
};

export async function getSettings(
  page = 1,
  pageSize = 10,
  includeHidden = false
): Promise<PagedSettingsResponse> {
  // Add cache-buster to avoid stale cached responses
  const ts = Date.now();
  const hidden = includeHidden ? `&includeHidden=true` : "";
  const res = await api.get<PagedSettingsResponse>(
    `/setting?Page=${page}&PageSize=${pageSize}${hidden}&_=${ts}`
  );
  return res.data;
}
export type CreateSettingRequest = {
  name: string;
  type: string;
  isOffer?: boolean;
  gameId: string;
  hours?: number;
  price?: number;
  isOpenHour?: boolean;
  isDayPass?: boolean;
  // Only sent from the admin edit modal; the create flow never sets it.
  isActive?: boolean;
  isEvent?: boolean;
  /**
   * Full replacement list — whatever is sent becomes the setting's bundle.
   * Omit or send [] to clear it.
   */
  items?: Array<{ itemId: number; quantityPerPerson: number }>;
};

export async function createSetting(body: CreateSettingRequest) {
  const res = await api.post<GameSettingDto>("/setting", body);
  return res.data as GameSettingDto;
}

export async function updateSetting(id: string, body: CreateSettingRequest) {
  const res = await api.put<GameSettingDto>(`/setting/${id}`, body);
  return res.data as GameSettingDto;
}

export async function deleteSetting(id: string) {
  const res = await api.delete<void>(`/setting/${id}`);
  return res.data;
}

export default { getSettings, createSetting, updateSetting, deleteSetting };

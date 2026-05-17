import api from "./api";

export type SettingAttribute = {
  id: string;
  name: string;
  attributeValue: string;
  settingsId: string;
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
};

export type PagedSettingsResponse = {
  totalCount: number;
  data: GameSettingDto[];
  pageNumber?: number;
  pageSize?: number;
};

export async function getSettings(
  page = 1,
  pageSize = 10
): Promise<PagedSettingsResponse> {
  // Add cache-buster to avoid stale cached responses
  const ts = Date.now();
  const res = await api.get<PagedSettingsResponse>(
    `/setting?Page=${page}&PageSize=${pageSize}&_=${ts}`
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

import api from "./api";

export type CreateGameSessionRequest = {
  gameId: string;
  gameSettingId: string;
  hours: number;
  status: string; // status id
  setId?: number; // optional set id
  isOpenHour?: boolean;
  discountId?: number | null; // optional discount id
};

export async function createGameSession(body: CreateGameSessionRequest) {
  // POST request with params in query string as requested by the backend
  const params: Record<string, unknown> = {
    gameId: body.gameId,
    gameSettingId: body.gameSettingId,
    hours: body.hours,
    status: body.status,
  };
  if (body.setId !== undefined) {
    params.setId = body.setId;
  }
  if (body.isOpenHour !== undefined) {
    params.isOpenHour = body.isOpenHour;
  }
  if (body.discountId !== undefined && body.discountId !== null) {
    params.discountId = body.discountId;
  }
  const res = await api.post("/transactions/CreateGameSession", null, {
    params,
  });
  return res.data;
}

export default { createGameSession };

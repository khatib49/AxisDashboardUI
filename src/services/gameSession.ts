import api from "./api";

export type CreateGameSessionRequest = {
  gameId: string;
  gameSettingId: string;
  hours: number;
  status: string; // status id
  setId?: number; // optional set id
  isOpenHour?: boolean;
  discountId?: number | null; // optional discount id
  userId?: number | null; // optional user/client id
  isDayPass?: boolean;
  numberOfPersons?: number;
  comment?: string; // optional comment
};

// Add TransactionItemDto type if needed
export type TransactionItemDto = {
  // Define properties as per your backend DTO
  // Example:
  // id: number;
  // name: string;
  // quantity: number;
  // price: number;
};

export type TransactionDto = {
  id: number;
  roomId?: number;
  room: string;
  gameTypeId?: number;
  gameType: string;
  gameId?: number;
  game: string;
  gameSettingId?: number;
  gameSetting: string;
  hours: number;
  totalPrice: number;
  statusId: number;
  createdOn: string;
  modifiedOn?: string;
  createdBy: string;
  items: TransactionItemDto[];
  setId?: number;
  set: string;
  discountId?: number;
  discountPercentage?: number;
  discountName?: string;
  numberOfPersons: number;
  isDayPass: boolean;
  comment?: string;
  userId?: number;
  userName?: string;
};

export type BaseResponse<T> = {
  success: boolean;
  error: string | null;
  message: string;
  data: T | null;
};

export type CreateGameSessionResponse = BaseResponse<TransactionDto>;


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
  if (body.userId !== undefined && body.userId !== null) {
    params.userId = body.userId;
  }
  if (body.isDayPass !== undefined) {
    params.isDayPass = body.isDayPass;
  }
  if (body.numberOfPersons !== undefined) {
    params.numberOfPersons = body.numberOfPersons;
  }
  if (body.comment !== undefined && body.comment !== "") {
    params.comment = body.comment;
  }
  const res = await api.post<CreateGameSessionResponse>("/transactions/CreateGameSession", null, {
    params,
  });
  return res.data;
}

export default { createGameSession };

import api from "./api";

export type CardDto = {
  id: string;
  cardName: string;
  cardType: string;
  isActive: boolean;
  createdOn: string;
  modifiedOn: string | null;
};

export type CardCreateDto = {
  cardName: string;
  cardType: string;
};

type PagedCards = { data: CardDto[]; totalCount?: number };

export const getCards = async (): Promise<CardDto[]> => {
  // GET /api/card may return a plain array or a paginated envelope
  // ({ totalCount, data, ... }); unwrap `.data` in the latter case.
  const res = await api.get<CardDto[] | PagedCards>('/card');
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray((body as PagedCards).data)) return (body as PagedCards).data;
  return [];
};

export const getCard = async (id: string): Promise<CardDto> => {
  const res = await api.get<CardDto>(`/card/${id}`);
  return res.data;
};

export const createCard = async (body: CardCreateDto): Promise<CardDto> => {
  const res = await api.post<CardDto>('/card', body);
  return res.data;
};

export const updateCard = async (id: string, body: { cardName: string; cardType: string; isActive: boolean; }): Promise<void> => {
  await api.put(`/card/${id}`, body);
};

export const deleteCard = async (id: string): Promise<void> => {
  await api.delete(`/card/${id}`);
};

export default {
  getCards,
  getCard,
  createCard,
  updateCard,
  deleteCard,
};

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

export const getCards = async (): Promise<CardDto[]> => {
  const res = await api.get<CardDto[]>('/card');
  return res.data;
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

import api from "./api";

export type DiscountDto = {
  id: number;
  name: string;
  type: string;
  description?: string | null;
  percentage: number;
  isActive: boolean;
  createdOn: string;
  updatedOn: string;
};

export type DiscountCreateDto = {
  name: string;
  type: string;
  description?: string | null;
  percentage: number;
  isActive?: boolean | null;
};

export type DiscountUpdateDto = {
  name?: string | null;
  type?: string | null;
  description?: string | null;
  percentage?: number | null;
  isActive?: boolean | null;
};

export type DiscountListResponse = {
  totalCount: number;
  data: DiscountDto[];
};

export async function getDiscounts(
  page = 1,
  pageSize = 10,
  search?: string
): Promise<DiscountListResponse> {
  const params = new URLSearchParams({
    Page: String(page),
    PageSize: String(pageSize),
  });
  if (search) params.append("search", search);

  const res = await api.get<DiscountListResponse>(
    `/discount?${params.toString()}`
  );
  return res.data;
}

export async function getDiscountById(id: number): Promise<DiscountDto> {
  const res = await api.get<DiscountDto>(`/discount/${id}`);
  return res.data;
}

export async function getDiscountsByType(
  type: string,
  page = 1,
  pageSize = 10
): Promise<DiscountListResponse> {
  const res = await api.get<DiscountListResponse>(
    `/discount/type/${encodeURIComponent(
      type
    )}?Page=${page}&PageSize=${pageSize}`
  );
  return res.data;
}

export async function createDiscount(
  payload: DiscountCreateDto
): Promise<DiscountDto> {
  const res = await api.post<DiscountDto>(`/discount`, payload);
  return res.data;
}

export async function updateDiscount(
  id: number,
  payload: DiscountUpdateDto
): Promise<void> {
  await api.put(`/discount/${id}`, payload);
}

export async function deleteDiscount(id: number): Promise<void> {
  await api.delete(`/discount/${id}`);
}

export default {
  getDiscounts,
  getDiscountById,
  getDiscountsByType,
  createDiscount,
  updateDiscount,
  deleteDiscount,
};

import api from "./api";

export type CategoryDto = {
  id: number;
  name: string;
  type?: string;
  itemType?: string;
  /** Listed on the public online shop. */
  showInShop?: boolean;
  /** Fallback shipping weight for items in this category without their own. */
  defaultWeightKg?: number | null;
};

export type CategoryInput = {
  name: string;
  type: string;
  itemType?: string;
  showInShop?: boolean;
  defaultWeightKg?: number | null;
};

export type PagedCategoryResponse = {
  totalCount: number;
  data: CategoryDto[];
  pageNumber?: number;
  pageSize?: number;
};

export type CategoryListResponse = {
  totalCount: number;
  data: CategoryDto[];
};

export async function getCategories(
  page = 1,
  pageSize = 10
): Promise<CategoryListResponse> {
  const res = await api.get<CategoryListResponse>(
    `/category?Page=${page}&PageSize=${pageSize}`
  );
  return res.data;
}

export async function getCategoriesByType(
  type = "game",
  page = 1,
  pageSize = 10
): Promise<PagedCategoryResponse> {
  const res = await api.get<PagedCategoryResponse>(
    `/category/type/${encodeURIComponent(
      type
    )}?Page=${page}&PageSize=${pageSize}`
  );
  return res.data;
}

export async function getCategoryById(id: number): Promise<CategoryDto> {
  const res = await api.get<CategoryDto>(`/category/${id}`);
  return res.data;
}

const toPayload = (p: CategoryInput) => ({
  name: p.name,
  type: p.type,
  itemType: p.itemType,
  showInShop: p.showInShop ?? false,
  defaultWeightKg: p.defaultWeightKg ?? null,
});

export async function createCategory(payload: CategoryInput): Promise<CategoryDto> {
  const res = await api.post<CategoryDto>(`/category`, toPayload(payload));
  return res.data;
}

export async function updateCategory(id: number, payload: CategoryInput): Promise<void> {
  await api.put(`/category/${id}`, toPayload(payload));
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/category/${id}`);
}

export default {
  getCategories,
  getCategoriesByType,
};

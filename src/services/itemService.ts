import api from "../services/api";

/** A paid extra an item offers ("Oat Milk +$1.00"). */
export type ItemAddOnDto = {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
};

export type ItemDto = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  type: string;
  categoryId: number | null;
  gameId: string | null;
  statusId?: number | null;
  imagePath?: string | null;
  buyPrice?: number | null;
  /** Active add-ons, present on the cashier list. */
  addOns?: ItemAddOnDto[] | null;
};

const basePath = "/item";

/** Admin: all add-ons of an item, inactive included. */
export async function getItemAddOns(itemId: string | number): Promise<ItemAddOnDto[]> {
  const res = await api.get<ItemAddOnDto[]>(`${basePath}/${itemId}/addons`);
  return res.data;
}

/** Admin: replace-all sync of an item's add-ons. Returns the saved list. */
export async function setItemAddOns(
  itemId: string | number,
  addOns: Array<{ id?: number | null; name: string; price: number; isActive?: boolean }>
): Promise<ItemAddOnDto[]> {
  const res = await api.put<ItemAddOnDto[]>(`${basePath}/${itemId}/addons`, addOns);
  return res.data;
}

export type ItemListResponse = {
  totalCount: number;
  data: ItemDto[];
};

export async function getItems(
  page = 1,
  pageSize = 10,
  categoryId?: number | null,
  search?: string | null
): Promise<ItemListResponse> {
  let url = `${basePath}?Page=${page}&PageSize=${pageSize}`;
  if (categoryId !== undefined && categoryId !== null)
    url += `&CategoryId=${encodeURIComponent(String(categoryId))}`;
  if (search) url += `&Search=${encodeURIComponent(search)}`;
  const res = await api.get<ItemListResponse>(url);
  return res.data;
}

export async function getItem(id: string): Promise<ItemDto> {
  const res = await api.get<ItemDto>(`${basePath}/${id}`);
  return res.data;
}

export async function createItem(
  body: Omit<ItemDto, "id"> & { image?: File | null }
): Promise<ItemDto> {
  const form = new FormData();
  form.append("name", body.name);
  form.append("quantity", String(body.quantity));
  form.append("price", String(body.price));
  form.append("type", body.type);
  form.append("categoryId", String(body.categoryId ?? "0"));
if (body.buyPrice !== undefined && body.buyPrice !== null) {
  form.append("buyPrice", String(body.buyPrice));
}

  if (body.statusId !== undefined && body.statusId !== null) {
    form.append("statusId", String(body.statusId));
  }

  // Only append image if a file is provided
  if (body.image) {
    form.append("image", body.image);
  }

  const res = await api.post<ItemDto>(basePath, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function updateItem(
  id: string,
  body: Omit<ItemDto, "id"> & { image?: File | null }
): Promise<void> {
  const form = new FormData();
  form.append("name", body.name);
  form.append("quantity", String(body.quantity));
  form.append("price", String(body.price));
  form.append("type", body.type);
  form.append("categoryId", String(body.categoryId ?? "0"));

  if (body.buyPrice !== undefined && body.buyPrice !== null) {
  form.append("buyPrice", String(body.buyPrice));
}

  if (body.statusId !== undefined && body.statusId !== null)
    form.append("statusId", String(body.statusId));
  // Only append image if a file is provided; otherwise keep existing image on server
  if (body.image) {
    form.append("image", body.image);
  }
  await api.put(`${basePath}/${id}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return;
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete(`${basePath}/${id}`);
}

export default { getItems, getItem, createItem, updateItem, deleteItem };

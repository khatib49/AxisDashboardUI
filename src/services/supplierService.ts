import { get, post, put, del } from "./api";

export type SupplierDto = {
  id: number;
  name: string;
  contactInfo: string | null;
  notes: string | null;
  isActive: boolean;
  createdOn: string;
  modifiedOn: string | null;
};

export type SupplierCreateDto = { name: string; contactInfo?: string | null; notes?: string | null };
export type SupplierUpdateDto = SupplierCreateDto & { isActive: boolean };

export async function getSuppliers(includeHidden = false): Promise<SupplierDto[]> {
  const q = includeHidden ? "?includeHidden=true" : "";
  return await get<SupplierDto[]>(`/suppliers${q}`);
}

export async function getSupplier(id: number): Promise<SupplierDto> {
  return await get<SupplierDto>(`/suppliers/${id}`);
}

export async function createSupplier(dto: SupplierCreateDto): Promise<SupplierDto> {
  return await post<SupplierDto>("/suppliers", dto);
}

export async function updateSupplier(id: number, dto: SupplierUpdateDto): Promise<SupplierDto> {
  return await put<SupplierDto>(`/suppliers/${id}`, dto);
}

export async function deactivateSupplier(id: number): Promise<void> {
  return await del<void>(`/suppliers/${id}`);
}

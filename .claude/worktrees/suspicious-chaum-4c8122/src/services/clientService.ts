import api from "./api";

export type ClientUserDto = {
  id: number;
  email?: string | null;
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export type ClientUserCreateRequest = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ClientUserResponse = {
  id: number;
  phoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  isNewlyCreated: boolean;
};

export type UserUpdateDto = {
  email?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  statusId?: number | null;
};

export type ClientUserUpdateRequest = {
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type PaginatedResponse<T> = {
  data: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages?: number;
  totalInvoices?: number;
};

// Create a new client
export async function createClient(
  request: ClientUserCreateRequest
): Promise<ClientUserResponse> {
  const res = await api.post<ClientUserResponse>("/users/client", request);
  return res.data;
}

// Search clients by phone number
export async function searchClientsByPhone(
  phone: string
): Promise<ClientUserDto[]> {
  const res = await api.get<ClientUserDto[]>("/users/search", {
    params: { phone },
  });
  return res.data;
}

// Get all users by role ID (Client role = 6) with pagination
export async function getUsersByRoleId(
  roleId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<ClientUserDto>> {
  const res = await api.get<PaginatedResponse<ClientUserDto>>(
    `/users/by-role/${roleId}`,
    {
      params: { Page: page, PageSize: pageSize },
    }
  );
  return res.data;
}

// Get user by ID
export async function getClientById(id: number): Promise<ClientUserDto> {
  const res = await api.get<ClientUserDto>(`/users/${id}`);
  return res.data;
}

// Update client
export async function updateClient(
  id: number,
  request: ClientUserUpdateRequest
): Promise<ClientUserResponse> {
  const res = await api.put<ClientUserResponse>(
    `/users/clients/${id}`,
    request
  );
  return res.data;
}

export default {
  createClient,
  searchClientsByPhone,
  getUsersByRoleId,
  getClientById,
  updateClient,
};

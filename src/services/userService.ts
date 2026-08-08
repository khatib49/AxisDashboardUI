import api from "./api";

export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  statusId?: number;
};

export type UserListResponse = {
  totalCount: number;
  data: UserDto[];
};

export const getUsers = async (
  page = 1,
  pageSize = 10,
  search?: string
): Promise<UserListResponse> => {
  // The server searches across email, username, display name, first/last name
  // and phone — and does it BEFORE paging, so totalCount reflects the matches.
  const res = await api.get(`/users`, {
    params: {
      Page: page,
      PageSize: pageSize,
      search: search?.trim() || undefined,
    },
  });
  return res.data as UserListResponse;
};

export type RegisterRequest = {
  email: string;
  password: string;
  displayName: string;
  roleName: string;
  statusId?: number;
};

export const registerUser = async (body: RegisterRequest) => {
  const res = await api.post("/auth/register", body);
  return res.data;
};

export type UpdateUserRequest = {
  displayName: string;
  email: string;
  roles: string[];
  statusId?: number;
  password?: string;
};

export const updateUser = async (id: string, body: UpdateUserRequest) => {
  const res = await api.put(`/users/${id}`, body);
  return res.data;
};

export const deleteUser = async (id: string) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

export const getClientsCount = async (): Promise<{ count: number }> => {
  const res = await api.get("/users/clients/count");
  return res.data;
};

export default {
  getUsers,
  registerUser,
  updateUser,
  deleteUser,
  getClientsCount,
};

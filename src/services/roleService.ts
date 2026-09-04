// Roles & page permissions (Admin → Roles & Permissions).
import api from "./api";

export type PageInfo = { key: string; label: string; group: string; path: string };

export type RoleInfo = {
  name: string;
  /** Ships with the system; can't be deleted (admin can't be edited either). */
  builtIn: boolean;
  users: number;
  pages: string[];
};

export async function getPageCatalog(): Promise<PageInfo[]> {
  const { data } = await api.get<PageInfo[]>("/admin/roles/catalog");
  return data;
}

export async function getRoles(): Promise<RoleInfo[]> {
  const { data } = await api.get<RoleInfo[]>("/admin/roles");
  return data;
}

export async function createRole(name: string, pages: string[]): Promise<RoleInfo> {
  const { data } = await api.post<RoleInfo>("/admin/roles", { name, pages });
  return data;
}

export async function setRolePages(name: string, pages: string[]): Promise<RoleInfo> {
  const { data } = await api.put<RoleInfo>(`/admin/roles/${encodeURIComponent(name)}/pages`, { pages });
  return data;
}

export async function deleteRole(name: string): Promise<void> {
  await api.delete(`/admin/roles/${encodeURIComponent(name)}`);
}

/** Pages the signed-in user may open (any role). */
export async function getMyPages(): Promise<string[]> {
  const { data } = await api.get<string[]>("/roles/my-pages");
  return Array.isArray(data) ? data : [];
}

/** "social_media" → "Social media" */
export function roleLabel(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

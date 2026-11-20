import api, { post } from './api';

// DTOs aligned with backend
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string | null;
  roleName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string | null;
  error?: string | null;
}

export interface BaseResponse {
  success: boolean;
  error?: string | null;
}

const AUTH_BASE = '/auth';

export async function registerUser(req: RegisterRequest, signal?: AbortSignal): Promise<BaseResponse> {
  // backend returns { message } on success; we'll normalize to BaseResponse
  await api.post<{ message?: string }>(`${AUTH_BASE}/register`, req, { signal });
  return { success: true };
}

export async function loginUser(req: LoginRequest, signal?: AbortSignal): Promise<AuthResponse> {
  const res = await post<{ token: string }>(`${AUTH_BASE}/login`, req, { signal });
  const token = res.token;
  if (token) {
    try { localStorage.setItem('access_token', token); } catch { /* ignore */ }
  }
  return { success: true, token };
}

export function logout(): void {
  try { localStorage.removeItem('access_token'); } catch { /* ignore */ }
}

export function isAuthenticated(): boolean {
  try { return !!localStorage.getItem('access_token'); } catch { return false; }
}

// Password reset by email. forgotPassword always resolves the same way whether
// or not the email has an account; resetPassword rejects with { error }.
export async function forgotPassword(email: string): Promise<string> {
  const res = await api.post<{ message: string }>(`${AUTH_BASE}/forgot-password`, { email });
  return res.data.message;
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<string> {
  const res = await api.post<{ message: string }>(`${AUTH_BASE}/reset-password`, { email, token, newPassword });
  return res.data.message;
}

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosRequestHeaders,
} from "axios";

// Small contract for API errors
export type ApiError = {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
};

// Base config: you can override VITE_API_BASE_URL in .env files
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // send cookies if your API needs them
  timeout: 20000, // 20s default timeout
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Helper to safely read tokens from localStorage
function getAccessToken(): string | null {
  try {
    return localStorage.getItem("access_token");
  } catch {
    return null;
  }
}

// Request interceptor: attach auth token and any custom headers
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      // axios v1 uses AxiosHeaders which supports .set(); fall back to plain object merge
      const headersUnknown = (config.headers ?? {}) as unknown as {
        set?: (key: string, value: string) => void;
      } & Record<string, string>;
      if (typeof headersUnknown.set === "function") {
        headersUnknown.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers = {
          ...(headersUnknown as Record<string, string>),
          Authorization: `Bearer ${token}`,
        } as AxiosRequestHeaders;
      }
    }

    // Example: add a request id or locale
    // config.headers = { ...(config.headers || {}), 'x-request-id': crypto.randomUUID() };

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: normalize errors and handle 401/403 with logout
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;

    // Network/timeout
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      const apiError: ApiError = {
        status: 0,
        message: "Request timed out",
        code: "TIMEOUT",
      };
      return Promise.reject(apiError);
    }

    // On 401/403: logout by clearing token and redirecting to signin (if not already there)
    if (status === 401 || status === 403) {
      try {
        localStorage.removeItem("access_token");
      } catch {
        /* ignore */
      }
      // Only redirect if not already on login page
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/signin") &&
        !window.location.pathname.includes("/signup")
      ) {
        window.location.assign("/signin");
      }
      const apiError: ApiError = {
        status: status ?? 0,
        message: status === 403 ? "Forbidden" : "Unauthorized",
        code: status === 403 ? "FORBIDDEN" : "UNAUTHORIZED",
      };
      return Promise.reject(apiError);
    }

    // Build a normalized error
    const data = error.response?.data as unknown;
    let message = error.message || "Request failed";
    let code: string | undefined;
    if (data && typeof data === "object") {
      const obj = data as { message?: unknown; code?: unknown };
      if (typeof obj.message === "string") message = obj.message;
      if (typeof obj.code === "string") code = obj.code;
    }

    const apiError: ApiError = {
      status: status ?? 0,
      message,
      code,
      details: data,
    };

    return Promise.reject(apiError);
  }
);

export default api;

// Convenience typed helpers
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.get<T>(url, config);
  return res.data;
}

export async function post<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.post<T>(url, body, config);
  return res.data;
}

export async function put<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.put<T>(url, body, config);
  return res.data;
}

export async function patch<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.patch<T>(url, body, config);
  return res.data;
}

export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.delete<T>(url, config);
  return res.data;
}

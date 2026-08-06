import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { ApiError } from "@/utils/errors";
import type { TokenPair } from "@/types/api";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

/** Lazily imported to keep a single-direction dependency chain (services → stores). */
function getAuthStore() {
  return import("@/stores/auth-store").then((m) => m.useAuthStore);
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

apiClient.interceptors.request.use(async (config) => {
  const store = await getAuthStore();
  const token = store.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh");
}

/** Single-flight refresh: concurrent 401s share one rotation (Part 3.7.6). */
let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<string | null> {
  const store = await getAuthStore();
  const refreshToken = store.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<TokenPair>(`${API_BASE}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    store.getState().setTokens(data);
    return data.access_token;
  } catch {
    await forceLogout();
    return null;
  }
}

function forceLogout() {
  const storePromise = getAuthStore();
  return storePromise.then(({ useAuthStore }) => {
    useAuthStore.getState().clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
  });
}

function normalizeError(error: AxiosError): ApiError {
  const data = error.response?.data as
    | { detail?: string; title?: string; trace_id?: string }
    | string
    | undefined;
  const status = error.response?.status;
  let message = error.message;

  if (typeof data === "string") {
    message = data;
  } else if (data && typeof data === "object") {
    if (data.detail) message = data.detail;
    else if (data.title) message = data.title;
  } else if (status === 401) {
    message = "Your session has expired. Please sign in again.";
  }

  return new ApiError(message, {
    status,
    title: typeof data === "object" && data && "title" in data ? data.title : undefined,
    traceId: typeof data === "object" && data && "trace_id" in data ? data.trace_id : undefined,
  });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
    }

    throw normalizeError(error);
  },
);

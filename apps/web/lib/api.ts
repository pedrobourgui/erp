import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("erp_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Endpoints where a 401 means "wrong credentials", not "expired session".
 * Running the refresh flow on these swallows the error the form needs to show.
 */
const AUTH_ROUTES = [
  "/auth/login",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/accept-invite",
];

function isAuthRoute(url?: string): boolean {
  if (!url) {
    return false;
  }
  return AUTH_ROUTES.some((route) => url.includes(route));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute(originalRequest.url)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("erp_refresh_token");
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = data.data;
        localStorage.setItem("erp_token", accessToken);
        localStorage.setItem("erp_refresh_token", newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_refresh_token");
        // Already on the login screen: reloading would wipe the error message
        // the form is about to render.
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extracts a user-facing message from an API error (NestJS error shape),
 * so toasts can show the backend's specific message instead of a generic one.
 * Returns undefined when no usable message is present.
 */
export const PERMISSION_DENIED_MESSAGE =
  "Você não tem permissão para realizar esta ação. Fale com o administrador.";

export function getApiErrorMessage(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    // FN-71: the API answers a 403 with "Permissão insuficiente para esta
    // ação", which callers wrapped into "Erro ao criar metodo. Tente
    // novamente." — the user reads a system failure and retries forever.
    if (error.response?.status === 403) {
      return PERMISSION_DENIED_MESSAGE;
    }

    const data = error.response?.data as { message?: unknown } | undefined;
    const message = data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    if (Array.isArray(message)) {
      const joined = message.filter((m): m is string => typeof m === "string").join(", ");
      if (joined.trim()) {
        return joined;
      }
    }
  }
  return undefined;
}

export default api;

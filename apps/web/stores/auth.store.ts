import { create } from "zustand";

import api from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string | { id: string; name: string };
  tenantId: string;
  avatar?: string;
}

/** Shape of `GET /auth/me` — the only endpoint that returns the permissions. */
interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  avatar?: string;
  role?: {
    id: string;
    name: string;
    permissions?: { permission: { resource: string; action: string } }[];
  } | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  /**
   * `"resource:action"` grants of the user's role.
   *
   * `null` means **not loaded yet**, which is not the same as "has none": a
   * missing list must render as loading, never as "acesso negado" (AE-28 in
   * miniature — a false denial reads like the system lost the user's access).
   */
  permissions: string[] | null;
  roleName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => void;
}

/** `[{ permission: { resource, action } }]` → `["resource:action"]`. */
function extractPermissions(profile: ProfileResponse | null): string[] {
  return (profile?.role?.permissions ?? []).map(
    (entry) => `${entry.permission.resource}:${entry.permission.action}`
  );
}

function roleNameOf(profile: ProfileResponse | null): string | null {
  return profile?.role?.name ?? null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  permissions: null,
  roleName: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post("/auth/login", { email, password });
      const { user, accessToken, refreshToken } = response.data.data;

      localStorage.setItem("erp_token", accessToken);
      localStorage.setItem("erp_refresh_token", refreshToken);

      set({
        user,
        token: accessToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // The login payload carries only `role: { id, name }`. The permissions
      // live behind /auth/me, so the UI cannot gate anything until this lands.
      try {
        const { data } = await api.get("/auth/me");
        const profile = data.data as ProfileResponse;
        set({
          user: profile as unknown as User,
          permissions: extractPermissions(profile),
          roleName: roleNameOf(profile),
        });
      } catch {
        // Session is valid; the gating stays in its loading state and the next
        // hydrate() resolves it. Failing the login here would be worse.
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("erp_token");
    localStorage.removeItem("erp_refresh_token");
    set({
      user: null,
      token: null,
      permissions: null,
      roleName: null,
      isAuthenticated: false,
    });
  },

  setUser: (user: User) => {
    set({ user });
  },

  hydrate: () => {
    if (typeof window === "undefined") {return;}
    const token = localStorage.getItem("erp_token");
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    set({ token, isAuthenticated: true, isLoading: true });
    api
      .get("/auth/me")
      .then(({ data }) => {
        const profile = data.data as ProfileResponse;
        set({
          user: profile as unknown as User,
          permissions: extractPermissions(profile),
          roleName: roleNameOf(profile),
          isLoading: false,
        });
      })
      .catch(() => {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_refresh_token");
        set({
          token: null,
          isAuthenticated: false,
          user: null,
          permissions: null,
          roleName: null,
          isLoading: false,
        });
      });
  },
}));

import { create } from "zustand";
import api from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
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
      isAuthenticated: false,
    });
  },

  setUser: (user: User) => {
    set({ user });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("erp_token");
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    set({ token, isAuthenticated: true, isLoading: true });
    api
      .get("/auth/me")
      .then(({ data }) => {
        set({ user: data.data, isLoading: false });
      })
      .catch(() => {
        localStorage.removeItem("erp_token");
        localStorage.removeItem("erp_refresh_token");
        set({ token: null, isAuthenticated: false, user: null, isLoading: false });
      });
  },
}));

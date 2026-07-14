import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiResponse } from "@erp/shared-types";
import { useAuthStore } from "@/stores/auth.store";

// ─── Query ─────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
};

// ─── Types ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  avatar: string | null;
  roleId: string | null;
  role?: { id: string; name: string } | null;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Reflects updated profile fields into the global auth store. */
function syncAuthStore(profile: UserProfile) {
  const current = useAuthStore.getState().user;
  if (!current) return;
  useAuthStore.getState().setUser({
    ...current,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar ?? undefined,
  });
}

export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<UserProfile>>("/users/me");
      return data.data;
    },
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const { data } = await api.patch<ApiResponse<UserProfile>>(
        "/users/me",
        payload
      );
      return data.data;
    },
    onSuccess: (profile) => syncAuthStore(profile),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: ChangePasswordPayload) => {
      const { data } = await api.post<ApiResponse<unknown>>(
        "/users/me/password",
        payload
      );
      return data;
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
      const token =
        typeof window !== "undefined" ? localStorage.getItem("erp_token") : null;

      // Native fetch so the browser sets the multipart boundary automatically.
      const res = await fetch(`${baseUrl}/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(body?.message ?? "Falha ao enviar o avatar");
      }

      const data = (await res.json()) as ApiResponse<UserProfile>;
      return data.data;
    },
    onSuccess: (profile) => syncAuthStore(profile),
  });
}

import type { ApiResponse, PaginatedResponse } from "@erp/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────

export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatar: string | null;
  lastLoginAt: string | null;
  roleId: string | null;
  role: { id: string; name: string } | null;
}

export interface TenantRole {
  id: string;
  name: string;
  label: string;
  description: string | null;
  userCount: number;
}

export interface InviteUserPayload {
  email: string;
  roleId: string;
}

/** What `POST /users/invite` answers — the token is the invite link's payload. */
export interface InviteResult {
  email: string;
  roleId: string;
  roleName: string;
  token: string;
  expiresIn: number;
}

// ─── Query keys ────────────────────────────────────────────────────────

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (page: number) => [...userKeys.lists(), { page }] as const,
  roles: () => [...userKeys.all, "roles"] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────

export function useUsers(page = 1) {
  return useQuery({
    queryKey: userKeys.list(page),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<TenantUser>>("/users", {
        params: { page, limit: 50 },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: userKeys.roles(),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TenantRole[]>>("/users/roles");
      return data.data;
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: InviteUserPayload) => {
      const { data } = await api.post<ApiResponse<InviteResult>>(
        "/users/invite",
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & Partial<Pick<TenantUser, "name" | "status" | "roleId">>) => {
      const { data } = await api.patch<ApiResponse<TenantUser>>(
        `/users/${id}`,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      // The plan tab counts users — invalidate the whole prefix, not just the
      // list (FN-11 was exactly this mistake on the cash register).
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
}

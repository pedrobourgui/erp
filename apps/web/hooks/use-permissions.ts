"use client";

import { FULL_ACCESS_ROLES, type PermissionName } from "@erp/constants";
import { useMemo } from "react";

import { useAuthStore } from "@/stores/auth.store";

export interface UsePermissionsResult {
  /** Whether the role has this exact `"resource:action"` grant. */
  can: (permission: PermissionName) => boolean;
  /** Whether the role has at least one of them. An empty list is satisfied. */
  canAny: (permissions: PermissionName[]) => boolean;
  /** Whether the role has all of them. */
  canAll: (permissions: PermissionName[]) => boolean;
  /** `owner` or `admin` — passes every check. */
  isOwner: boolean;
  /**
   * Whether the grants are known. While `false`, `can()` answers `false` but
   * the UI must render a loading state instead of "acesso negado": denying
   * access we simply have not fetched yet is the bug, not the fix.
   */
  isLoaded: boolean;
  /** The raw grant list, for debugging and for the settings screen. */
  permissions: string[];
}

/**
 * Reads the permissions of the logged-in user (populated from `/auth/me`).
 *
 * The permission names come from `@erp/constants` — the same list the seed
 * writes and the API guards require. Typing `can()` against `PermissionName`
 * makes a typo a compile error instead of a silently hidden button.
 */
export function usePermissions(): UsePermissionsResult {
  const permissions = useAuthStore((state) => state.permissions);
  const roleName = useAuthStore((state) => state.roleName);

  return useMemo(() => {
    const isOwner = !!roleName && FULL_ACCESS_ROLES.includes(roleName);
    const granted = permissions ?? [];
    const can = (permission: PermissionName) =>
      isOwner || granted.includes(permission);

    return {
      can,
      canAny: (list: PermissionName[]) =>
        list.length === 0 || list.some((permission) => can(permission)),
      canAll: (list: PermissionName[]) =>
        list.every((permission) => can(permission)),
      isOwner,
      isLoaded: isOwner || permissions !== null,
      permissions: granted,
    };
  }, [permissions, roleName]);
}

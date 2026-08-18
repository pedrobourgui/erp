"use client";

import type { PermissionName } from "@erp/constants";
import React from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/use-permissions";

interface CanProps {
  /** Permission required to render the children. */
  permission?: PermissionName;
  /** Any one of these is enough. Use instead of `permission`, not with it. */
  anyOf?: PermissionName[];
  /** All of these are required. */
  allOf?: PermissionName[];
  /**
   * Render the children disabled with an explanatory tooltip instead of hiding
   * them. Preferred for buttons: a control that vanishes without a word
   * confuses as much as the 403 it was meant to prevent.
   */
  mode?: "hide" | "disable";
  /** Shown when the permission is missing and `mode` is `"hide"`. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const DENIED_MESSAGE = "Você não tem permissão para esta ação";

/**
 * Gates a piece of UI behind a permission (AE-27/FN-09).
 *
 * While the permissions are still loading nothing is rendered — showing a
 * button that disappears a moment later is worse than showing it a moment late.
 */
export function Can({
  permission,
  anyOf,
  allOf,
  mode = "hide",
  fallback = null,
  children,
}: CanProps) {
  const { can, canAny, canAll, isLoaded } = usePermissions();

  const allowed =
    (permission ? can(permission) : true) &&
    (anyOf ? canAny(anyOf) : true) &&
    (allOf ? canAll(allOf) : true);

  if (!isLoaded) {
    return null;
  }
  if (allowed) {
    return <>{children}</>;
  }
  if (mode === "hide") {
    return <>{fallback}</>;
  }

  return (
    <Tooltip content={DENIED_MESSAGE}>
      <span
        className="inline-flex cursor-not-allowed opacity-50 [&>*]:pointer-events-none"
        aria-disabled="true"
        data-testid="permission-disabled"
      >
        {children}
      </span>
    </Tooltip>
  );
}

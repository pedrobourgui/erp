"use client";

import type { PermissionName } from "@erp/constants";
import { Loader2 } from "lucide-react";
import React from "react";

import { PermissionDeniedState } from "@/components/auth/permission-denied-state";
import { usePermissions } from "@/hooks/use-permissions";

interface RequirePermissionProps {
  /** Permission required to render the page. */
  permission?: PermissionName;
  /** Any one of these is enough — for pages fed by more than one module. */
  anyOf?: PermissionName[];
  /** What the page shows, used in the denial message ("os lançamentos"). */
  subject?: string;
  children: React.ReactNode;
}

/**
 * Page-level guard (AE-27/FN-09). The menu filter is cosmetic — this is the
 * real defense, because an unlisted route is still reachable by URL.
 *
 * It is a UX guard, not a security boundary: the API is. Its job is to replace
 * a screenful of 403-driven empty tables with one honest message.
 */
export function RequirePermission({
  permission,
  anyOf,
  subject,
  children,
}: RequirePermissionProps) {
  const { can, canAny, isLoaded } = usePermissions();

  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allowed =
    (permission ? can(permission) : true) && (anyOf ? canAny(anyOf) : true);

  if (!allowed) {
    return (
      <PermissionDeniedState
        subject={subject ?? "esta página"}
        showHomeLink
        className="min-h-[40vh]"
      />
    );
  }

  return <>{children}</>;
}

"use client";

import { getRoleLabel } from "@erp/constants";
import { Loader2, UserPlus } from "lucide-react";
import React, { useState } from "react";

import { Can } from "@/components/auth/can";
import { PermissionDeniedState } from "@/components/auth/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useUpdateUser, useUsers, type TenantUser } from "@/hooks/use-users";
import { isPermissionError } from "@/lib/api-errors";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { formatDateTime } from "@/lib/utils";

import { InviteUserDialog } from "./invite-user-dialog";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};

const STATUS_VARIANTS: Record<string, "success" | "secondary" | "destructive"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  BLOCKED: "destructive",
};

/**
 * Users tab (FN-08).
 *
 * It used to render three invented people — "João Silva / Maria Santos / Pedro
 * Oliveira" — as the answer to *who has access to this system*. That is worse
 * than an empty screen: it is a confident wrong answer to a security question.
 */
export function UsersTab() {
  const { data, isLoading, isError, error } = useUsers();
  const updateUser = useUpdateUser();
  const { addToast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  const users = data?.data ?? [];

  const handleToggleStatus = async (user: TenantUser) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateUser.mutateAsync({ id: user.id, status: nextStatus });
      addToast(
        nextStatus === "ACTIVE"
          ? `${user.name} foi reativado.`
          : `${user.name} foi desativado.`,
        "success"
      );
    } catch (err) {
      addToast(
        getMutationErrorMessage(err, "Erro ao alterar o status do usuário."),
        "error"
      );
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-lg">Usuários</CardTitle>
            <CardDescription>Gerencie os membros da equipe</CardDescription>
          </div>
          <Can permission="users:create" mode="disable">
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar
            </Button>
          </Can>
        </CardHeader>
        <CardContent>
          <UsersList
            users={users}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onToggleStatus={handleToggleStatus}
            isMutating={updateUser.isPending}
          />
        </CardContent>
      </Card>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

// ─── List ───────────────────────────────────────────────────────────────

interface UsersListProps {
  users: TenantUser[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onToggleStatus: (user: TenantUser) => void;
  isMutating: boolean;
}

function UsersList({
  users,
  isLoading,
  isError,
  error,
  onToggleStatus,
  isMutating,
}: UsersListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando usuários...
      </div>
    );
  }

  // AE-28: a request that failed is not an empty list.
  if (isError) {
    return isPermissionError(error) ? (
      <PermissionDeniedState subject="os usuários" />
    ) : (
      <p className="py-8 text-sm text-destructive">
        {getMutationErrorMessage(error, "Não foi possível carregar os usuários.")}
      </p>
    );
  }

  if (users.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>;
  }

  return (
    <div className="divide-y">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {user.lastLoginAt
                ? `Último acesso em ${formatDateTime(user.lastLoginAt)}`
                : "Nunca acessou"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {user.role ? getRoleLabel(user.role.name) : "Sem perfil"}
            </Badge>
            <Badge variant={STATUS_VARIANTS[user.status] ?? "secondary"}>
              {STATUS_LABELS[user.status] ?? user.status}
            </Badge>
            <Can permission="users:update" mode="disable">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isMutating}
                onClick={() => onToggleStatus(user)}
              >
                {user.status === "ACTIVE" ? "Desativar" : "Reativar"}
              </Button>
            </Can>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { ShieldOff } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";

interface PermissionDeniedStateProps {
  /** What the user was trying to see, e.g. "as contas financeiras". */
  subject?: string;
  /** Renders the "Voltar ao início" button. Off inside cards and tables. */
  showHomeLink?: boolean;
  className?: string;
}

/**
 * AE-28: a 403 must never be drawn as an empty state.
 *
 * `/financeiro/contas` said "Nenhuma conta financeira cadastrada" with six
 * accounts in the database, and `/financeiro/caixa` reported "Total de Caixas
 * 0" with two — the user concludes the system lost the data instead of learning
 * they lack access.
 */
export function PermissionDeniedState({
  subject = "estas informações",
  showHomeLink = false,
  className,
}: PermissionDeniedStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center ${className ?? ""}`}
      role="status"
      data-testid="permission-denied"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Você não tem permissão para ver {subject}
        </p>
        <p className="text-sm text-muted-foreground">
          Fale com o administrador do sistema se precisar deste acesso.
        </p>
      </div>
      {showHomeLink ? <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/">Voltar ao início</Link>
        </Button> : null}
    </div>
  );
}

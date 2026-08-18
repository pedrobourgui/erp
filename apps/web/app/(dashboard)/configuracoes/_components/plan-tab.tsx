"use client";

import { getTenantPlanLabel } from "@erp/constants";
import { Loader2 } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTenantUsage, type TenantUsageLimit } from "@/hooks/use-tenant";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { formatDate, cn } from "@/lib/utils";

/**
 * Plan tab (FN-08).
 *
 * The plan told every tenant it used "245/500 produtos" and "1247/5000 pedidos"
 * — four numbers written into the component. The limits were never invented:
 * `maxUsers`, `maxProducts`, `maxOrders` and `maxWarehouses` have always been
 * columns on `Tenant`. Only the reading was missing, so the tab is now real
 * instead of removed.
 */
export function PlanTab() {
  const { data, isLoading, isError, error } = useTenantUsage();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando o consumo do plano...
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-destructive">
          {getMutationErrorMessage(error, "Não foi possível carregar o plano.")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg">Plano Atual</CardTitle>
              <CardDescription>
                {data.trialEndsAt
                  ? `Avaliação até ${formatDate(data.trialEndsAt)}`
                  : "Detalhes do seu plano e uso"}
              </CardDescription>
            </div>
            <Badge variant="success" className="px-3 py-1 text-sm">
              {getTenantPlanLabel(data.plan)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.limits.map((limit) => (
            <LimitBar key={limit.key} limit={limit} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Limit bar ──────────────────────────────────────────────────────────

function LimitBar({ limit }: { limit: TenantUsageLimit }) {
  // A zero or missing maximum means "no limit configured" — dividing by it
  // would render NaN% and a bar of undefined width.
  const hasLimit = limit.max > 0;
  const pct = hasLimit ? Math.round((limit.current / limit.max) * 100) : 0;
  const isNearLimit = hasLimit && pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{limit.label}</span>
        <span className="whitespace-nowrap text-muted-foreground">
          {hasLimit ? `${limit.current} / ${limit.max}` : `${limit.current} · sem limite`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isNearLimit ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {isNearLimit ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Você está utilizando {pct}% do limite
        </p>
      ) : null}
    </div>
  );
}

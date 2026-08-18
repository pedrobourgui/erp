"use client";

import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { OrderStatusHistoryEntry } from "@/hooks/use-orders";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * VD-06: the tab read `order.history`, which the API never returns, so it was
 * empty even for orders with several recorded transitions.
 */
export function HistoryTab({
  history,
}: {
  history: OrderStatusHistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum histórico disponível
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de Alterações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative ml-4 border-l pl-6">
          {history.map((entry, idx) => (
            <div
              key={entry.id}
              className={cn(
                "relative pb-8",
                idx === history.length - 1 && "pb-0"
              )}
            >
              <div className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background" />

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {entry.fromStatus ? <>
                      <StatusBadge status={entry.fromStatus} />
                      <span className="text-xs text-muted-foreground">→</span>
                    </> : null}
                  <StatusBadge status={entry.toStatus} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  <span className="font-medium">
                    {entry.changedByName ?? "Sistema"}
                  </span>
                  {entry.notes ? <span className="text-muted-foreground">
                      {" "}
                      &mdash; {entry.notes}
                    </span> : null}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

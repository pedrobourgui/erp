"use client";

import { Copy, ExternalLink } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { OrderDetail } from "@/hooks/use-orders";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

/**
 * VD-06: this tab used to read `order.shipping.*` and always rendered
 * "Dados de envio não disponíveis" — the API returns these fields flat on the
 * order.
 */
export function ShippingTab({ order }: { order: OrderDetail }) {
  const hasShippingData =
    Number(order.shippingCost ?? 0) > 0 ||
    !!order.shippingMethod ||
    !!order.trackingCode ||
    !!order.shippedAt;

  if (!hasShippingData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Este pedido não tem dados de envio registrados.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Envio e Rastreamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Método</p>
            <p className="font-medium">{order.shippingMethod ?? "-"}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Custo do Frete</p>
            <p className="font-medium">
              {formatCurrency(Number(order.shippingCost ?? 0))}
            </p>
          </div>
          {order.estimatedDelivery ? <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">
                Previsão de Entrega
              </p>
              <p className="font-medium">
                {formatDate(order.estimatedDelivery)}
              </p>
            </div> : null}
        </div>

        {order.trackingCode ? <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-sm font-medium">Código de Rastreamento</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-1.5 font-mono text-sm">
                {order.trackingCode}
              </code>
              <Tooltip content="Copiar código">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 md:h-8 md:w-8"
                  onClick={() =>
                    navigator.clipboard.writeText(order.trackingCode ?? "")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </Tooltip>
              {order.trackingUrl ? <Tooltip content="Rastrear">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 md:h-8 md:w-8"
                    onClick={() =>
                      window.open(order.trackingUrl ?? "", "_blank")
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Tooltip> : null}
            </div>
          </div> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          {order.shippedAt ? <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Enviado em</p>
              <p className="font-medium">{formatDateTime(order.shippedAt)}</p>
            </div> : null}
          {order.deliveredAt ? <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Entregue em</p>
              <p className="font-medium">{formatDateTime(order.deliveredAt)}</p>
            </div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

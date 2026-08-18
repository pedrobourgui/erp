"use client";

import type { OrderStatus } from "@erp/shared-types";
import { MoreHorizontal } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useCancelOrder,
  useReverseSale,
  useUpdateOrderStatus,
} from "@/hooks/use-orders";
import { getApiErrorMessage } from "@/lib/api";
import {
  getOrderStatusActions,
  splitOrderActions,
  type OrderStatusAction,
} from "@/lib/order-status-actions";
import { cn, formatCurrency } from "@/lib/utils";

interface StatusActionsProps {
  orderId: string;
  orderNumber: string;
  /** Comes from the API — never recomputed here. */
  allowedTransitions: OrderStatus[] | undefined;
  /** `icon` renders tooltip-only buttons, for table rows. */
  size?: "default" | "icon";
  /** Only used to word the reversal action (VD-14). */
  origin?: string;
  status?: OrderStatus;
}

export function StatusActions({
  orderId,
  orderNumber,
  allowedTransitions,
  size = "default",
  origin,
  status,
}: StatusActionsProps) {
  const updateStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();
  const reverseSale = useReverseSale();
  const { addToast } = useToast();

  const [pending, setPending] = useState<OrderStatusAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const actions = getOrderStatusActions(allowedTransitions, { origin, status });
  const { primary, overflow } = splitOrderActions(actions);

  const openAction = (action: OrderStatusAction) => {
    setPending(action);
    setReason("");
    setReasonError(null);
  };

  // Numa linha de tabela os slots existem mesmo vazios: um pedido cancelado
  // não oferece ação nenhuma, e se o componente saísse da árvore o "ver
  // detalhes" renderizado antes dele deslizaria para a direita — indo parar
  // exatamente na coluna onde, em toda outra linha, está o menu. Fora da
  // tabela não há grade para manter, então nada é renderizado.
  if (actions.length === 0 && size !== "icon") {
    return null;
  }

  const close = () => {
    setPending(null);
    setReason("");
    setReasonError(null);
  };

  const handleConfirm = async () => {
    if (!pending) {
      return;
    }

    if (pending.requiresReason && !reason.trim()) {
      setReasonError(
        pending.targetStatus === "CANCELLED"
          ? "Informe o motivo do cancelamento."
          : "Informe o motivo do estorno."
      );
      return;
    }

    try {
      if (pending.targetStatus === "CANCELLED") {
        await cancelOrder.mutateAsync({ id: orderId, reason });
        addToast(`Pedido #${orderNumber} cancelado.`, "success");
      } else if (pending.targetStatus === "RETURNED") {
        // VD-14: a return is not a status change — it puts the goods back in
        // stock and takes the refund out of the cash session.
        const result = await reverseSale.mutateAsync({ id: orderId, reason });
        const refunded = result.data?.refundedAmount ?? 0;
        addToast(
          refunded > 0
            ? `Venda #${orderNumber} estornada. Estoque devolvido e ${formatCurrency(
                refunded
              )} a devolver ao cliente.`
            : `Venda #${orderNumber} estornada e estoque devolvido.`,
          "success"
        );
      } else {
        await updateStatus.mutateAsync({
          id: orderId,
          status: pending.targetStatus,
        });
        addToast(`Pedido atualizado: ${pending.label}.`, "success");
      }
      close();
    } catch (error) {
      // VD-17: the API explains exactly why the transition was refused —
      // showing "Erro ao atualizar status" instead hid the reason.
      addToast(
        getApiErrorMessage(error) ??
          "Erro ao atualizar o pedido. Tente novamente.",
        "error"
      );
      close();
    }
  };

  const isPending =
    updateStatus.isPending || cancelOrder.isPending || reverseSale.isPending;

  return (
    <>
      {size === "icon" ? (
        /* T10: slot fixo. A ação que avança o fluxo fica sempre na mesma
           coluna — muda só o rótulo — e tudo o que reverte vai para o menu,
           com texto. Antes eram de um a três ícones soltos por linha, então o
           mesmo botão nunca caía duas vezes no mesmo x. */
        <div className="flex items-center justify-end gap-1">
          <div className="w-10 md:w-9">
            {primary ? (
              <Tooltip content={primary.label}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 md:h-9 md:w-9"
                  onClick={() => openAction(primary)}
                  aria-label={primary.label}
                >
                  <primary.icon className="h-4 w-4" />
                </Button>
              </Tooltip>
            ) : null}
          </div>
          <div className="w-10 md:w-9">
            {overflow.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 md:h-9 md:w-9"
                    aria-label={`Mais ações do pedido ${orderNumber}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((action) => (
                    <DropdownMenuItem
                      key={action.targetStatus}
                      destructive={action.tone === "danger"}
                      onSelect={() => openAction(action)}
                    >
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.targetStatus}
                variant={action.variant}
                className={cn(
                  action.tone === "danger" &&
                    "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
                onClick={() => openAction(action)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
        </div>
      )}

      {pending ? <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={pending.label}
          destructive={pending.tone === "danger"}
          loading={isPending}
          confirmLabel={pending.label}
          onConfirm={handleConfirm}
          message={
            pending.requiresReason ? (
              <div className="space-y-2 text-left">
                <p>
                  {pending.targetStatus === "CANCELLED"
                    ? `O cancelamento libera o estoque reservado e cancela o título a receber do pedido #${orderNumber}.`
                    : `O estorno devolve os itens ao estoque, cancela os títulos em aberto e registra a devolução do valor já pago do pedido #${orderNumber}.`}
                </p>
                <label
                  htmlFor="cancel-reason"
                  className="block text-sm font-medium text-foreground"
                >
                  {pending.targetStatus === "CANCELLED"
                    ? "Motivo do cancelamento"
                    : "Motivo do estorno"}
                </label>
                <textarea
                  id="cancel-reason"
                  value={reason}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) {setReasonError(null);}
                  }}
                  className="w-full rounded-md border bg-background p-2 text-sm text-foreground"
                  placeholder="Ex.: cliente desistiu da compra"
                />
                {reasonError ? <p className="text-sm text-destructive">{reasonError}</p> : null}
              </div>
            ) : (
              `Confirmar a ação "${pending.label}" para o pedido #${orderNumber}?`
            )
          }
        /> : null}
    </>
  );
}

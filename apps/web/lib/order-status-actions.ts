import type { OrderStatus } from "@erp/shared-types";
import {
  CheckCircle2,
  FileText,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Button metadata for each status an order can move to.
 *
 * VD-02: the UI used to keep its own — and wrong — copy of the state machine,
 * offering `PICKING → SHIPPED` while the API only accepted `PICKING → PACKED`.
 * Which buttons to show now comes from `order.allowedTransitions`, returned by
 * the API; this file only says how each of them looks.
 */
export interface OrderStatusAction {
  targetStatus: OrderStatus;
  label: string;
  icon: LucideIcon;
  variant: "default" | "outline" | "secondary";
  /**
   * `danger` para o que **reverte** um pedido — cancelar, estornar, devolver.
   *
   * T5: estas ações vinham em vermelho cheio, o mesmo peso visual de um
   * "excluir", numa tela em que às vezes eram a única ação disponível. A regra
   * do sistema passou a ser: preenchimento vermelho destrói dado, contorno
   * vermelho reverte dado, primário avança o fluxo. Nenhuma transição de
   * pedido destrói nada — o pedido continua lá, com outro status.
   */
  tone: "neutral" | "danger";
  /** Cancelling goes through its own endpoint and requires a reason. */
  requiresReason?: boolean;
}

const ACTION_BY_TARGET: Record<OrderStatus, OrderStatusAction | null> = {
  DRAFT: null,
  PENDING: {
    targetStatus: "PENDING",
    label: "Enviar para Aprovação",
    icon: FileText,
    variant: "default",
    tone: "neutral",
  },
  CONFIRMED: {
    targetStatus: "CONFIRMED",
    label: "Confirmar Pedido",
    icon: CheckCircle2,
    variant: "default",
    tone: "neutral",  },
  PICKING: {
    targetStatus: "PICKING",
    label: "Iniciar Separação",
    icon: Package,
    variant: "default",
    tone: "neutral",  },
  PACKED: {
    targetStatus: "PACKED",
    label: "Marcar como Embalado",
    icon: PackageCheck,
    variant: "default",
    tone: "neutral",  },
  SHIPPED: {
    targetStatus: "SHIPPED",
    label: "Marcar como Enviado",
    icon: Truck,
    variant: "default",
    tone: "neutral",  },
  DELIVERED: {
    targetStatus: "DELIVERED",
    label: "Confirmar Entrega",
    icon: CheckCircle2,
    variant: "default",
    tone: "neutral",  },
  COMPLETED: {
    targetStatus: "COMPLETED",
    label: "Concluir Pedido",
    icon: CheckCircle2,
    variant: "default",
    tone: "neutral",  },
  RETURNED: {
    targetStatus: "RETURNED",
    label: "Registrar Devolução",
    icon: RotateCcw,
    variant: "outline",
    tone: "danger",
    // VD-14: returning goods moves stock and money, so it goes through
    // POST /orders/:id/reverse and needs a reason on record.
    requiresReason: true,
  },
  CANCELLED: {
    targetStatus: "CANCELLED",
    label: "Cancelar Pedido",
    icon: XCircle,
    variant: "outline",
    tone: "danger",
    requiresReason: true,
  },
};

export interface OrderActionContext {
  origin?: string;
  status?: OrderStatus;
}

/**
 * Turns the transitions the API allows into the buttons to render, keeping the
 * destructive one last.
 */
export function getOrderStatusActions(
  allowedTransitions: OrderStatus[] | undefined,
  context: OrderActionContext = {}
): OrderStatusAction[] {
  // A counter sale is not "returned", it is reversed — same endpoint, wording
  // the operator recognises (VD-14).
  const isCounterSale =
    context.origin === "BALCAO" && context.status === "COMPLETED";

  const actions = (allowedTransitions ?? [])
    .map((target) => ACTION_BY_TARGET[target])
    .filter((action): action is OrderStatusAction => action !== null)
    .map((action) =>
      action.targetStatus === "RETURNED" && isCounterSale
        ? { ...action, label: "Estornar Venda", tone: "danger" as const }
        : action
    );

  return [
    ...actions.filter((a) => a.tone !== "danger"),
    ...actions.filter((a) => a.tone === "danger"),
  ];
}

/**
 * Separa a ação que ocupa o slot fixo da linha das que vão para o menu.
 *
 * T10: numa lista, cada pedido oferecia de uma a três ações e todas viravam
 * ícones lado a lado, então o mesmo botão aparecia numa coluna diferente em
 * cada linha — o "ver detalhes" foi medido em x=1298, x=1340 e x=1375 em três
 * linhas seguidas. Com um slot fixo, a ação que avança o fluxo fica sempre no
 * mesmo lugar e muda apenas de rótulo conforme o status.
 *
 * O que reverte nunca é promovido ao slot: um clique de reflexo na posição de
 * sempre não pode cancelar um pedido.
 */
export function splitOrderActions(actions: OrderStatusAction[]): {
  primary: OrderStatusAction | null;
  overflow: OrderStatusAction[];
} {
  const firstSafe = actions.findIndex((a) => a.tone !== "danger");

  if (firstSafe === -1) {
    return { primary: null, overflow: actions };
  }

  return {
    primary: actions[firstSafe],
    overflow: actions.filter((_, i) => i !== firstSafe),
  };
}

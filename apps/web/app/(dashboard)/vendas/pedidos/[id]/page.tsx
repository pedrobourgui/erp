"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useOrder,
  useUpdateOrderStatus,
  type OrderDetail,
  type OrderItem,
  type OrderPayment,
  type OrderHistoryEntry,
} from "@/hooks/use-orders";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  Truck,
  XCircle,
  Package,
  Loader2,
  Copy,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  FileText,
  Clock,
  CreditCard,
  User,
} from "lucide-react";
import type { OrderStatus } from "@erp/shared-types";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Tabs ───────────────────────────────────────────────────────────────

const tabs = [
  { id: "itens", label: "Itens", icon: Package },
  { id: "cliente", label: "Cliente", icon: User },
  { id: "envio", label: "Envio", icon: Truck },
  { id: "financeiro", label: "Financeiro", icon: CreditCard },
  { id: "historico", label: "Histórico", icon: Clock },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ─── Status transitions ─────────────────────────────────────────────────

interface StatusAction {
  targetStatus: OrderStatus;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "destructive" | "outline" | "secondary";
}

function getAvailableActions(currentStatus: OrderStatus): StatusAction[] {
  const map: Partial<Record<OrderStatus, StatusAction[]>> = {
    PENDING: [
      {
        targetStatus: "CONFIRMED",
        label: "Confirmar Pedido",
        icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
        variant: "default",
      },
      {
        targetStatus: "CANCELLED",
        label: "Cancelar",
        icon: <XCircle className="mr-2 h-4 w-4" />,
        variant: "destructive",
      },
    ],
    CONFIRMED: [
      {
        targetStatus: "PICKING",
        label: "Iniciar Separação",
        icon: <Package className="mr-2 h-4 w-4" />,
        variant: "default",
      },
      {
        targetStatus: "CANCELLED",
        label: "Cancelar",
        icon: <XCircle className="mr-2 h-4 w-4" />,
        variant: "destructive",
      },
    ],
    PICKING: [
      {
        targetStatus: "SHIPPED",
        label: "Marcar como Enviado",
        icon: <Truck className="mr-2 h-4 w-4" />,
        variant: "default",
      },
    ],
    SHIPPED: [
      {
        targetStatus: "DELIVERED",
        label: "Confirmar Entrega",
        icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
        variant: "default",
      },
    ],
  };
  return map[currentStatus] ?? [];
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { data: orderResp, isLoading } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("itens");
  const [statusAction, setStatusAction] = useState<{
    open: boolean;
    targetStatus: OrderStatus;
    label: string;
    destructive: boolean;
  } | null>(null);

  const order = orderResp?.data;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Pedido não encontrado</p>
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
      </div>
    );
  }

  const availableActions = getAvailableActions(order.status);

  const handleStatusChange = async () => {
    if (!statusAction) return;
    try {
      await updateStatus.mutateAsync({
        id: orderId,
        status: statusAction.targetStatus,
      });
      addToast(`Pedido atualizado para "${statusAction.label}" com sucesso!`, "success");
      setStatusAction(null);
    } catch {
      addToast("Erro ao atualizar status do pedido. Tente novamente.", "error");
      setStatusAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Voltar">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                Pedido #{order.orderNumber}
              </h1>
              <StatusBadge status={order.status} size="md" />
            </div>
            <p className="text-muted-foreground">
              {order.customerName ?? order.customer?.name} &mdash; {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availableActions.map((action) => (
            <Button
              key={action.targetStatus}
              variant={action.variant}
              onClick={() =>
                setStatusAction({
                  open: true,
                  targetStatus: action.targetStatus,
                  label: action.label,
                  destructive: action.variant === "destructive",
                })
              }
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total do Pedido</p>
            <p className="text-xl font-bold">
              {formatCurrency(order.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens</p>
            <p className="text-xl font-bold">{order.items?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Origem</p>
            <p className="text-xl font-bold capitalize">{order.origin}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Frete</p>
            <p className="text-xl font-bold">
              {formatCurrency(order.shipping?.cost ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "itens" && <ItemsTab items={order.items ?? []} />}
      {activeTab === "cliente" && <CustomerTab order={order} />}
      {activeTab === "envio" && <ShippingTab order={order} />}
      {activeTab === "financeiro" && <FinanceTab order={order} />}
      {activeTab === "historico" && <HistoryTab history={order.history ?? []} />}

      {/* Confirm status change */}
      {statusAction && (
        <ConfirmDialog
          open={statusAction.open}
          onOpenChange={(open) => setStatusAction(open ? statusAction : null)}
          title={statusAction.label}
          message={`Confirmar a ação "${statusAction.label}" para o pedido #${order.orderNumber}?`}
          destructive={statusAction.destructive}
          loading={updateStatus.isPending}
          onConfirm={handleStatusChange}
        />
      )}
    </div>
  );
}

// ─── Items tab ──────────────────────────────────────────────────────────

function ItemsTab({ items }: { items: OrderItem[] }) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Itens do Pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Produto
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  SKU
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Qtd
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Preço Unit.
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Desconto
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{item.productName ?? item.product?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.sku ?? item.product?.sku}
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(Number(item.unitPrice))}
                  </td>
                  <td className="px-4 py-3 text-right text-destructive">
                    {Number(item.discount) > 0
                      ? `-${formatCurrency(Number(item.discount))}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(item.totalPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td
                  colSpan={5}
                  className="px-4 py-3 text-right font-semibold"
                >
                  Subtotal
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(subtotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Customer tab ───────────────────────────────────────────────────────

function CustomerTab({ order }: { order: OrderDetail }) {
  const c = order.customer;
  if (!c) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Dados do cliente não disponíveis
        </CardContent>
      </Card>
    );
  }

  const defaultAddr = c.addresses?.find((a) => a.isDefault) ?? c.addresses?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{c.name}</p>
                {c.document && (
                  <p className="text-sm text-muted-foreground">{c.document}</p>
                )}
              </div>
            </div>
            {c.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm">{c.email}</p>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm">{c.phone}</p>
              </div>
            )}
          </div>

          {defaultAddr && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium">
                  Endereço{defaultAddr.label ? ` (${defaultAddr.label})` : ""}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  {defaultAddr.street}, {defaultAddr.number}
                  {defaultAddr.complement ? ` - ${defaultAddr.complement}` : ""}
                </p>
                <p>{defaultAddr.neighborhood}</p>
                <p>
                  {defaultAddr.city} - {defaultAddr.state}
                </p>
                <p>CEP: {defaultAddr.zipCode}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Shipping tab ───────────────────────────────────────────────────────

function ShippingTab({ order }: { order: OrderDetail }) {
  const s = order.shipping;
  if (!s) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Dados de envio não disponíveis
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
            <p className="text-xs text-muted-foreground">Transportadora</p>
            <p className="font-medium">{s.carrier}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Método</p>
            <p className="font-medium">{s.method}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Custo do Frete</p>
            <p className="font-medium">{formatCurrency(s.cost)}</p>
          </div>
        </div>

        {s.trackingCode && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-2 text-sm font-medium">Código de Rastreamento</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-1.5 text-sm font-mono">
                {s.trackingCode}
              </code>
              <Tooltip content="Copiar código">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    navigator.clipboard.writeText(s.trackingCode ?? "")
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </Tooltip>
              {s.trackingUrl && (
                <Tooltip content="Rastrear">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(s.trackingUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {s.shippedAt && (
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Enviado em</p>
              <p className="font-medium">{formatDateTime(s.shippedAt)}</p>
            </div>
          )}
          {s.estimatedDelivery && (
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">
                Previsão de Entrega
              </p>
              <p className="font-medium">{formatDate(s.estimatedDelivery)}</p>
            </div>
          )}
          {s.deliveredAt && (
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Entregue em</p>
              <p className="font-medium">{formatDateTime(s.deliveredAt)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Finance tab ────────────────────────────────────────────────────────

function FinanceTab({ order }: { order: OrderDetail }) {
  const payments = order.payments ?? [];
  const receivables = order.receivables ?? [];

  return (
    <div className="space-y-6">
      {/* Payments section */}
      <PaymentsSection payments={payments} />

      {/* Receivables section */}
      <ReceivablesSection receivables={receivables} />
    </div>
  );
}

// ─── Payments section ──────────────────────────────────────────────────

function PaymentsSection({ payments }: { payments: OrderPayment[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum pagamento registrado
        </CardContent>
      </Card>
    );
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pagamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Forma de Pagamento
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Condicao
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Parcelas
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Cod. Autorizacao
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-3 font-medium">
                    {p.paymentMethod.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.paymentCondition?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(p.amount))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.installments ?? 1}x
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {p.authorizationCode ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td colSpan={2} className="px-4 py-3 text-right font-semibold">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(total)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Receivables section ───────────────────────────────────────────────

function ReceivablesSection({
  receivables,
}: {
  receivables: { id: string; description?: string; installment?: number; totalInstallments?: number; dueDate: string; amount: number; paidAmount?: number; status: string; method?: string; paymentMethod?: { name: string }; paidAt?: string }[];
}) {
  const receivableStatusColors: Record<string, string> = {
    PENDING: "text-yellow-600",
    PAID: "text-green-600",
    OVERDUE: "text-red-600",
    CANCELLED: "text-gray-400",
    PARTIALLY_PAID: "text-blue-600",
    pending: "text-yellow-600",
    paid: "text-green-600",
    overdue: "text-red-600",
    cancelled: "text-gray-400",
  };

  const receivableStatusLabels: Record<string, string> = {
    PENDING: "Pendente",
    PAID: "Pago",
    OVERDUE: "Atrasado",
    CANCELLED: "Cancelado",
    PARTIALLY_PAID: "Parcial",
    pending: "Pendente",
    paid: "Pago",
    overdue: "Atrasado",
    cancelled: "Cancelado",
  };

  if (receivables.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Contas a Receber</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Vencimento
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Forma
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Pago em
                </th>
              </tr>
            </thead>
            <tbody>
              {receivables.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-4 py-3">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3">{r.paymentMethod?.name ?? r.method ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-medium",
                        receivableStatusColors[r.status]
                      )}
                    >
                      {receivableStatusLabels[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.paidAt ? formatDateTime(r.paidAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History tab ────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: OrderHistoryEntry[] }) {
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
              className={cn("relative pb-8", idx === history.length - 1 && "pb-0")}
            >
              {/* Dot */}
              <div className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background" />

              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm">
                  <span className="font-medium">{entry.userName}</span>
                  {entry.note && (
                    <span className="text-muted-foreground">
                      {" "}&mdash; {entry.note}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

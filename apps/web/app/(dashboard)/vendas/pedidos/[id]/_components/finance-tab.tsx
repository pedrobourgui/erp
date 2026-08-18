"use client";

import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TruncatedText } from "@/components/ui/truncated-text";
import type {
  OrderDetail,
  OrderPayment,
  OrderReceivable,
} from "@/hooks/use-orders";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

const RECEIVABLE_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "text-yellow-600" },
  PAID: { label: "Pago", className: "text-green-600" },
  OVERDUE: { label: "Atrasado", className: "text-red-600" },
  CANCELLED: { label: "Cancelado", className: "text-gray-400" },
  PARTIALLY_PAID: { label: "Parcial", className: "text-blue-600" },
};

export function FinanceTab({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-6">
      <PaymentsSection payments={order.payments ?? []} />
      <ReceivablesSection receivables={order.receivables ?? []} />
    </div>
  );
}

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
                  Condição
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Valor
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Parcelas
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Cód. Autorização
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-4 py-3 font-medium">
                    <TruncatedText text={p.paymentMethod.name} className="max-w-[32ch]" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <TruncatedText text={p.paymentCondition?.name} fallback="-" className="max-w-[32ch]" />
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

function ReceivablesSection({
  receivables,
}: {
  receivables: OrderReceivable[];
}) {
  if (receivables.length === 0) {
    return null;
  }

  const total = receivables.reduce((sum, r) => sum + Number(r.amount), 0);

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
                {/* VD-05: an order paid in 3x generated three receivables but
                    the table gave no way to tell them apart. */}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Parcela
                </th>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.installment && r.totalInstallments
                      ? `${r.installment}/${r.totalInstallments}`
                      : "1/1"}
                  </td>
                  <td className="px-4 py-3">{formatDate(r.dueDate)}</td>
                  <td className="px-4 py-3">
                    <TruncatedText
                      text={r.paymentMethod?.name ?? r.method}
                      fallback="-"
                      className="max-w-[32ch]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(Number(r.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-medium",
                        RECEIVABLE_STATUS[r.status]?.className
                      )}
                    >
                      {RECEIVABLE_STATUS[r.status]?.label ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.paidAt ? formatDateTime(r.paidAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                  Total a receber
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

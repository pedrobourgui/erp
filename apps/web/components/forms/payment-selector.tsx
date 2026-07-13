"use client";

import React, { useEffect, useMemo } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormSetValue,
  type FieldValues,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePaymentConditions } from "@/hooks/use-payment-conditions";
import { formatCurrency, cn } from "@/lib/utils";
import { Plus, CreditCard } from "lucide-react";
import {
  PaymentLine,
  shouldShowCondition,
  requiresLinkedAccount,
  hasMissingAccount,
} from "./payment-line";

// ─── Types ─────────────────────────────────────────────────────────────

interface PaymentSelectorProps {
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  totalAmount: number;
  errors?: Record<string, unknown>;
  /**
   * Fires whenever an immediate payment line lacks a linked account — the API
   * refuses such a sale (SCRUM-30), so the page must block its submit.
   */
  onMissingAccountChange?: (missing: boolean) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export function PaymentSelector({
  control,
  setValue,
  totalAmount,
  errors,
  onMissingAccountChange,
}: PaymentSelectorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "payments",
  });

  const payments = useWatch({ control, name: "payments" }) as
    | Array<{
        paymentMethodId: string;
        paymentConditionId?: string;
        financialAccountId?: string;
        amount: number;
        installments?: number;
        authorizationCode?: string;
      }>
    | undefined;

  const { data: methodsData } = usePaymentMethods();
  const { data: conditionsData } = usePaymentConditions();

  const methods = useMemo(
    () => (methodsData?.data ?? []).filter((m) => m.isActive),
    [methodsData]
  );
  const conditions = useMemo(
    () => (conditionsData?.data ?? []).filter((c) => c.isActive),
    [conditionsData]
  );

  // Auto-sync amount when single payment line
  useEffect(() => {
    if (fields.length === 1 && totalAmount > 0) {
      const currentAmount = Number(payments?.[0]?.amount) || 0;
      if (Math.abs(currentAmount - totalAmount) > 0.01) {
        setValue("payments.0.amount" as never, totalAmount as never);
      }
    }
  }, [fields.length, totalAmount, payments, setValue]);

  const missingAccount = hasMissingAccount(payments, methods);

  useEffect(() => {
    onMissingAccountChange?.(missingAccount);
  }, [missingAccount, onMissingAccountChange]);

  const paymentTotal = (payments ?? []).reduce(
    (sum, p) => sum + (Number(p?.amount) || 0),
    0
  );

  const diff = paymentTotal - totalAmount;
  const progressPct =
    totalAmount > 0
      ? Math.min((paymentTotal / totalAmount) * 100, 100)
      : 0;

  const handleAdd = () => {
    append({
      paymentMethodId: "",
      paymentConditionId: "",
      financialAccountId: "",
      amount: fields.length === 0 ? totalAmount : 0,
      installments: 1,
      authorizationCode: "",
    });
  };

  const rootError =
    errors && typeof errors === "object" && "message" in errors
      ? (errors as { message?: string }).message
      : undefined;

  return (
    <div className="space-y-4">
      {/* Payment lines */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <CreditCard className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhuma forma de pagamento adicionada
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const payment = payments?.[index];
            const selectedMethod = methods.find(
              (m) => m.id === payment?.paymentMethodId
            );
            const methodType = selectedMethod?.type ?? null;
            const lineError = (
              errors as unknown as
                | Array<{ authorizationCode?: { message?: string } }>
                | undefined
            )?.[index];

            const lineMissingAccount =
              requiresLinkedAccount(methodType) &&
              !(payment?.financialAccountId || selectedMethod?.defaultAccountId);

            return (
              <PaymentLine
                key={field.id}
                index={index}
                control={control as Control<Record<string, unknown>>}
                setValue={setValue}
                methods={methods}
                conditions={conditions}
                selectedMethodType={methodType}
                requiresAuthorization={
                  selectedMethod?.requiresAuthorization ?? false
                }
                showCondition={shouldShowCondition(methodType)}
                authorizationError={lineError?.authorizationCode?.message}
                missingAccount={lineMissingAccount}
                onRemove={() => remove(index)}
              />
            );
          })}
        </div>
      )}

      {/* Add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleAdd}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar pagamento
      </Button>

      {/* Progress bar and totals */}
      {fields.length > 0 && (
        <PaymentProgress
          totalAmount={totalAmount}
          paymentTotal={paymentTotal}
          diff={diff}
          progressPct={progressPct}
        />
      )}

      {rootError && (
        <p className="text-xs text-destructive">{rootError}</p>
      )}
    </div>
  );
}

// ─── Progress sub-component ────────────────────────────────────────────

function PaymentProgress({
  totalAmount,
  paymentTotal,
  diff,
  progressPct,
}: {
  totalAmount: number;
  paymentTotal: number;
  diff: number;
  progressPct: number;
}) {
  const isExact = Math.abs(diff) < 0.01;
  const isOver = diff > 0.01;
  const isUnder = diff < -0.01;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 dark:bg-muted/10">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Pagamentos</span>
        <span className="font-medium">
          {formatCurrency(paymentTotal)} / {formatCurrency(totalAmount)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isExact && "bg-emerald-500",
            isOver && "bg-red-500",
            isUnder && "bg-amber-500"
          )}
          style={{ width: `${Math.min(progressPct, 100)}%` }}
        />
      </div>
      {isUnder && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          Falta: {formatCurrency(Math.abs(diff))}
        </p>
      )}
      {isOver && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Troco: {formatCurrency(diff)}
        </p>
      )}
      {isExact && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Pagamento completo
        </p>
      )}
    </div>
  );
}

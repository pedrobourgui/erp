"use client";

import React from "react";
import { Controller, type Control, type UseFormSetValue, type FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/forms/money-input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, AlertTriangle } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/hooks/use-payment-methods";
import type { PaymentCondition } from "@/hooks/use-payment-conditions";

// ─── Types ─────────────────────────────────────────────────────────────

interface PaymentLineProps {
  index: number;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  methods: PaymentMethod[];
  conditions: PaymentCondition[];
  selectedMethodType: string | null;
  requiresAuthorization: boolean;
  showCondition: boolean;
  authorizationError?: string;
  missingAccount?: boolean;
  onRemove: () => void;
}

// ─── Condition-showing types ───────────────────────────────────────────

const CONDITION_TYPES = new Set([
  "CREDIT_CARD",
  "BOLETO",
  "BANK_TRANSFER",
]);

export function shouldShowCondition(type: string | null): boolean {
  return type !== null && CONDITION_TYPES.has(type);
}

// ─── Linked account (SCRUM-30) ─────────────────────────────────────────

/**
 * Immediate payments land in a bank account the moment the sale is registered,
 * so they need one linked. Term payments (boleto, crédito…) resolve their
 * account later, at settlement.
 */
const IMMEDIATE_TYPES = new Set(["CASH", "PIX", "DEBIT_CARD"]);

export function requiresLinkedAccount(type: string | null): boolean {
  return type !== null && IMMEDIATE_TYPES.has(type);
}

type PaymentDraft = {
  paymentMethodId?: string;
  financialAccountId?: string;
};

/** True when any payment line would be refused by the API for lacking an account. */
export function hasMissingAccount(
  payments: PaymentDraft[] | undefined,
  methods: PaymentMethod[]
): boolean {
  return (payments ?? []).some((payment) => {
    const method = methods.find((m) => m.id === payment?.paymentMethodId);
    if (!method || !requiresLinkedAccount(method.type)) return false;
    return !(payment?.financialAccountId || method.defaultAccountId);
  });
}

// ─── Component ─────────────────────────────────────────────────────────

export function PaymentLine({
  index,
  control,
  setValue,
  methods,
  conditions,
  selectedMethodType,
  requiresAuthorization,
  showCondition,
  authorizationError,
  missingAccount,
  onRemove,
}: PaymentLineProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 dark:bg-muted/10 sm:flex-row sm:items-end",
        missingAccount && "border-amber-400 dark:border-amber-700"
      )}
    >
      {/* Payment Method */}
      <div className="min-w-0 flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Forma de Pagamento
        </label>
        <Controller
          name={`payments.${index}.paymentMethodId`}
          control={control}
          render={({ field }) => (
            <Select
              value={String(field.value ?? "")}
              onValueChange={(val) => {
                field.onChange(val);
                const method = methods.find((m) => m.id === val);
                if (method?.defaultAccountId) {
                  setValue(
                    `payments.${index}.financialAccountId`,
                    method.defaultAccountId
                  );
                }
                // Track whether this method requires an authorization code so the
                // form schema can make the field conditionally required.
                setValue(
                  `payments.${index}.requiresAuthorization`,
                  method?.requiresAuthorization ?? false,
                  { shouldValidate: true }
                );
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {missingAccount && (
          <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Sem conta financeira vinculada. Configure em Configurações &gt; Métodos
            de Pagamento.
          </p>
        )}
      </div>

      {/* Payment Condition */}
      {showCondition && (
        <div className="min-w-0 flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Condicao
          </label>
          <Controller
            name={`payments.${index}.paymentConditionId`}
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value ?? "")}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Amount */}
      <div className={cn("space-y-1", showCondition ? "w-full sm:w-36" : "w-full sm:w-44")}>
        <label className="text-xs font-medium text-muted-foreground">
          {selectedMethodType === "CASH" ? "Valor Recebido" : "Valor"}
        </label>
        <MoneyInput name={`payments.${index}.amount`} control={control} />
      </div>

      {/* Authorization Code */}
      {requiresAuthorization && (
        <div className="w-full space-y-1 sm:w-36">
          <label className="text-xs font-medium text-muted-foreground">
            Cod. Autorizacao
          </label>
          <Controller
            name={`payments.${index}.authorizationCode`}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={String(field.value ?? "")}
                placeholder="000000"
                maxLength={50}
                className={cn(
                  "h-9",
                  authorizationError &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
            )}
          />
          {authorizationError && (
            <p className="text-xs text-destructive">{authorizationError}</p>
          )}
        </div>
      )}

      {/* Remove */}
      <Tooltip content="Remover pagamento">
        <Button
          type="button"
          variant="ghost"
          action="delete"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

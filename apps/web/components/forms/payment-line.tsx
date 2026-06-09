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
import { Trash2 } from "lucide-react";
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
  onRemove,
}: PaymentLineProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 dark:bg-muted/10 sm:flex-row sm:items-end">
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
                className="h-9"
              />
            )}
          />
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

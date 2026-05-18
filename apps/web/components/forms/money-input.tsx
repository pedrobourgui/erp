"use client";

import React, { useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

// ─── Formatting helpers ─────────────────────────────────────────────────

function parseBRLToNumber(value: string): number {
  // Remove R$, dots (thousands), and convert comma to dot
  const cleaned = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatNumberToBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatInputValue(raw: string): string {
  // Only keep digits
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Convert to number (cents)
  const cents = parseInt(digits, 10);
  const value = cents / 100;
  return formatNumberToBRL(value);
}

// ─── Types ──────────────────────────────────────────────────────────────

interface MoneyInputProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

export function MoneyInput<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  placeholder = "0,00",
  disabled = false,
  className,
  error,
}: MoneyInputProps<TFieldValues>) {
  const {
    field,
    fieldState: { error: fieldError },
  } = useController({ name, control });

  const displayValue =
    field.value != null && field.value !== ""
      ? formatNumberToBRL(Number(field.value))
      : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatInputValue(raw);
      if (formatted === "") {
        field.onChange(0);
      } else {
        field.onChange(parseBRLToNumber(formatted));
      }
    },
    [field]
  );

  const errorMessage = error ?? fieldError?.message;

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onBlur={field.onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm text-right ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            errorMessage && "border-destructive focus-visible:ring-destructive"
          )}
        />
      </div>
      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

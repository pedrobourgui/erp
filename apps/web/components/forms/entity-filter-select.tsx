"use client";

import React from "react";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { isPermissionError } from "@/lib/api-errors";
import { getMutationErrorMessage } from "@/lib/mutation-error";

/**
 * Sentinel for "no filter".
 *
 * Radix treats the empty string as "no value at all", which wipes the
 * placeholder and leaves the trigger blank — the rest of the system already
 * uses `__all` for this and the two native `<select>` filters that used `""`
 * were the odd ones out (FT-09).
 */
export const ALL_VALUE = "__all";

export interface EntityFilterOption {
  value: string;
  label: string;
  /** Secondary text, e.g. the product count of a category. */
  hint?: string;
}

export interface EntityFilterSelectProps {
  label: string;
  /** Empty string means "no filter". */
  value: string;
  onChange: (value: string) => void;
  options: EntityFilterOption[];
  isLoading?: boolean;
  error?: unknown;
  /** Text of the "no filter" option — "Todas as categorias", "Todos os depósitos". */
  allLabel: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A filter over something registered in the system (FT-01 … FT-06).
 *
 * The filters for Categoria and Marca were free-text `<input>`s whose value was
 * sent as `categoryId`/`brandId` — an exact match against a cuid. Typing
 * "Eletrônicos" queried for an id named `Eletrônicos` and returned zero rows,
 * always, while the table said "nenhum registro" exactly like a legitimate
 * empty result. There is no text a user could type to make it work.
 *
 * `/financeiro/lancamentos` already did this right with its "Conta" select;
 * this is that pattern, extracted.
 */
export function EntityFilterSelect({
  label,
  value,
  onChange,
  options,
  isLoading,
  error,
  allLabel,
  disabled,
  id,
}: EntityFilterSelectProps) {
  // AE-28: a filter that failed to load must not look like "nothing is
  // registered". Without permission it hides — offering a control the user can
  // never populate is noise.
  if (isPermissionError(error)) {
    return null;
  }

  const selectedIsMissing = !!value && !options.some((o) => o.value === value);

  // The trigger renders the *selected item's* text, not the placeholder —
  // `SelectValue`'s placeholder only shows when nothing is selected, and the
  // no-filter state is a real selection (`__all`). So the loading state has to
  // live in the item's label.
  const noFilterLabel = isLoading ? "Carregando..." : allLabel;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>

      <Select
        value={value || ALL_VALUE}
        onValueChange={(next) => onChange(next === ALL_VALUE ? "" : next)}
        disabled={disabled || isLoading || !!error}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={noFilterLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{noFilterLabel}</SelectItem>

          {/* A category can be deleted while a filter on it is still active.
              Dropping the option would leave the trigger blank with the list
              still filtered — worse than the bug this replaces. */}
          {selectedIsMissing ? (
            <SelectItem value={value}>Selecionado (removido)</SelectItem>
          ) : null}

          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.hint ? (
                <span className="ml-1 text-muted-foreground">{option.hint}</span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error ? (
        <p className="text-xs text-destructive">
          {getMutationErrorMessage(error, `Não foi possível carregar ${label.toLowerCase()}.`)}
        </p>
      ) : null}
    </div>
  );
}

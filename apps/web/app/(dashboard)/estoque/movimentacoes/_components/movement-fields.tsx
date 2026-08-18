"use client";

import type { PaginatedResponse } from "@erp/shared-types";
import React, { useCallback } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";

import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import type { Warehouse } from "@/hooks/use-inventory";
import api from "@/lib/api";

/** Server-side product search, so the picker is not capped at the first page. */
export function useProductSearch() {
  return useCallback(async (search: string) => {
    const { data } = await api.get<
      PaginatedResponse<{ id: string; name: string; sku: string }>
    >("/products", { params: { search, limit: 20, status: "ACTIVE" } });
    return (data.data ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      description: p.sku,
    }));
  }, []);
}

export function FieldShell({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function ProductField<T extends FieldValues>({
  control,
  name,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  error?: string;
}) {
  const loadProducts = useProductSearch();
  return (
    <FieldShell label="Produto">
      <SearchableSelect
        name={name}
        control={control}
        loadOptions={loadProducts}
        placeholder="Selecione o produto"
        error={error}
      />
    </FieldShell>
  );
}

export function WarehouseField({
  label,
  value,
  onChange,
  warehouses,
  error,
  excludeId,
  placeholder = "Selecione o depósito",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  warehouses: Warehouse[];
  error?: string;
  /** Hides one option — origin and destination cannot be the same. */
  excludeId?: string;
  placeholder?: string;
}) {
  const options = warehouses.filter((w) => w.id !== excludeId);

  return (
    <FieldShell label={label} error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

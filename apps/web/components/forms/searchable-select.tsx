"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Loader2, Search, Check } from "lucide-react";
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

// ─── Types ──────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  control: Control<TFieldValues>;
  options?: SelectOption[];
  loadOptions?: (search: string) => Promise<SelectOption[]>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  emptyMessage?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

export function SearchableSelect<TFieldValues extends FieldValues>({
  name,
  control,
  options: staticOptions,
  loadOptions,
  label,
  placeholder = "Selecionar...",
  disabled = false,
  className,
  error,
  emptyMessage = "Nenhum resultado encontrado",
}: SearchableSelectProps<TFieldValues>) {
  const {
    field,
    fieldState: { error: fieldError },
  } = useController({ name, control });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOptions, setAsyncOptions] = useState<SelectOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = loadOptions ? asyncOptions : staticOptions ?? [];

  // Filter static options locally
  const filteredOptions = loadOptions
    ? options
    : options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          opt.value.toLowerCase().includes(search.toLowerCase())
      );

  // Async loading
  useEffect(() => {
    if (!loadOptions || !open) return;

    setIsLoadingOptions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await loadOptions(search);
        setAsyncOptions(results);
      } catch {
        setAsyncOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, open, loadOptions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Find selected label
  const allOptions = loadOptions ? asyncOptions : staticOptions ?? [];
  const selectedOption = allOptions.find((o) => o.value === field.value);

  const handleSelect = (option: SelectOption) => {
    field.onChange(option.value);
    setSearch("");
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    field.onChange("");
    setSearch("");
  };

  const errorMessage = error ?? fieldError?.message;

  return (
    <div className={cn("space-y-1", className)} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(!open);
            if (!open) setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            errorMessage && "border-destructive focus:ring-destructive/20 focus:border-destructive"
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {field.value && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            )}
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground/70 transition-transform duration-200",
              open && "rotate-180"
            )} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-elevated animate-in fade-in-0 zoom-in-[0.98] duration-150">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                maxLength={120}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {isLoadingOptions && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {filteredOptions.length === 0 && !isLoadingOptions ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "relative flex w-full items-start gap-2 rounded-md px-2 py-2 pl-8 text-sm transition-colors",
                        "hover:bg-accent/10",
                        isSelected && "bg-accent/10"
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-accent" />
                      )}
                      <div className="flex flex-col items-start">
                        <span className={cn("font-medium", isSelected && "text-accent-foreground")}>
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

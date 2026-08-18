"use client";

import { Search } from "lucide-react";
import React from "react";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ListSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Search box for the screens that render their own table (FT-05).
 *
 * `DataTable` already carries one, but Contas, Métodos e Condições de pagamento
 * build their own `<table>` and therefore had **no search at all** — three
 * screens where the only way to find a row was to read the list.
 *
 * The 300 ms debounce is the frontend rule; without it every keystroke is a
 * request.
 */
export function ListSearch({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: ListSearchProps) {
  const [draft, setDraft] = React.useState(value);
  const debounced = useDebouncedValue(draft, 300);

  React.useEffect(() => {
    onChange(debounced);
    // `onChange` comes from the page and is recreated each render; depending on
    // it would fire the callback on every render instead of on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Keep in sync when the caller clears the filters from outside.
  React.useEffect(() => {
    if (value === "") {setDraft("");}
  }, [value]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

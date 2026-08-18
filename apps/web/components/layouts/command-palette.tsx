"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useGlobalSearch,
  MIN_SEARCH_LENGTH,
  type SearchHit,
} from "@/hooks/use-search";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * AE-18: global search.
 *
 * The topbar "Buscar..." field accepted typing and did nothing at all — an
 * inert input on every screen of the system. It is now the trigger for this
 * palette, also reachable with Ctrl/Cmd+K.
 *
 * Not a Radix Dialog on purpose: a palette needs the input focused with the
 * list navigable by arrows while focus stays in the field, which fights the
 * dialog's focus trap.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedTerm = useDebouncedValue(term, 300);
  const { data: groups, isFetching } = useGlobalSearch(debouncedTerm);

  // One flat list so the arrow keys can walk across group boundaries.
  const flatHits = useMemo(
    () =>
      (groups ?? []).flatMap((group) =>
        group.hits.map((hit) => ({ ...hit, groupLabel: group.label }))
      ),
    [groups]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedTerm, groups]);

  useEffect(() => {
    if (open) {
      // The input mounts with the palette; focus on the next frame.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setTerm("");
    return undefined;
  }, [open]);

  const go = useCallback(
    (hit: SearchHit) => {
      onOpenChange(false);
      router.push(hit.href);
    },
    [onOpenChange, router]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (flatHits.length ? (i + 1) % flatHits.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) =>
        flatHits.length ? (i - 1 + flatHits.length) % flatHits.length : 0
      );
      return;
    }
    if (event.key === "Enter" && flatHits[activeIndex]) {
      event.preventDefault();
      go(flatHits[activeIndex]);
    }
  };

  if (!open) {return null;}

  const isTooShort = term.trim().length < MIN_SEARCH_LENGTH;
  const showEmpty =
    !isTooShort && !isFetching && flatHits.length === 0 && !!groups;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-elevated"
        role="dialog"
        aria-label="Busca global"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, produtos e pedidos..."
            aria-label="Buscar clientes, produtos e pedidos"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {isFetching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {isTooShort ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Digite ao menos {MIN_SEARCH_LENGTH} caracteres.
            </p>
          ) : null}

          {showEmpty ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nada encontrado para &ldquo;{term.trim()}&rdquo;.
            </p>
          ) : null}

          {(groups ?? []).map((group) => (
            <div key={group.entity} className="mb-2 last:mb-0">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              {group.hits.map((hit) => {
                const index = flatHits.findIndex((h) => h.href === hit.href);
                return (
                  <button
                    key={hit.href}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(hit)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      index === activeIndex ? "bg-accent/15" : "hover:bg-accent/10"
                    )}
                  >
                    {/* O resultado é escolhido pelo texto: cortá-lo sem deixar
                        ler o resto transforma dois produtos de nome parecido no
                        mesmo item aos olhos de quem busca. */}
                    <span className="w-full truncate font-medium" title={hit.title}>
                      {hit.title}
                    </span>
                    {hit.subtitle ? (
                      <span
                        className="w-full truncate text-xs text-muted-foreground"
                        title={hit.subtitle}
                      >
                        {hit.subtitle}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}

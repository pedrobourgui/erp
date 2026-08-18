import type { ApiResponse } from "@erp/shared-types";
import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchGroup {
  entity: "customers" | "products" | "orders";
  label: string;
  hits: SearchHit[];
}

/** Below this the term matches half the catalogue — the API refuses too. */
export const MIN_SEARCH_LENGTH = 2;

export const searchKeys = {
  all: ["search"] as const,
  query: (term: string) => [...searchKeys.all, term] as const,
};

/**
 * AE-18: global search.
 *
 * The 300 ms debounce is the caller's job (`useDebouncedValue`) — putting it
 * here would debounce the cache key too and refetch every keystroke anyway.
 */
export function useGlobalSearch(term: string) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: searchKeys.query(trimmed),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SearchGroup[]>>("/search", {
        params: { q: trimmed },
      });
      return data.data;
    },
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    // Results go stale fast in an ERP, but not within one palette session.
    staleTime: 30_000,
  });
}

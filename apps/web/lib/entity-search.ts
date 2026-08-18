import type { PaginatedResponse } from "@erp/shared-types";
import { formatDocument } from "@erp/validators";

import type { SelectOption } from "@/components/forms/searchable-select";
import api from "@/lib/api";

/**
 * Server-side option loaders for the high-cardinality filters.
 *
 * Products and customers are counted in thousands: loading them all into a
 * `<Select>` is the mistake the product picker already avoided in lote 2. These
 * feed `SearchableSelectBase`, which debounces at 300 ms.
 */

const PAGE_SIZE = 20;

export async function searchProducts(search: string): Promise<SelectOption[]> {
  const { data } = await api.get<
    PaginatedResponse<{ id: string; name: string; sku: string }>
  >("/products", { params: { search: search || undefined, limit: PAGE_SIZE } });

  return (data.data ?? []).map((product) => ({
    value: product.id,
    label: product.name,
    description: product.sku,
  }));
}

export async function searchCustomers(search: string): Promise<SelectOption[]> {
  const { data } = await api.get<
    PaginatedResponse<{ id: string; name: string; document?: string | null }>
  >("/customers", { params: { search: search || undefined, limit: PAGE_SIZE } });

  return (data.data ?? []).map((customer) => ({
    value: customer.id,
    // VD-16: o documento é guardado só com dígitos; a máscara é exibição.
    description: customer.document ? formatDocument(customer.document) : undefined,
    label: customer.name,
  }));
}

"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useFinancialAccounts } from "@/hooks/use-financial-accounts";
import type { FinancialEntryListParams } from "@/hooks/use-financial-entries";

const ALL = "all";

export interface EntriesFiltersProps {
  filters: FinancialEntryListParams;
  onChange: (patch: Partial<FinancialEntryListParams>) => void;
}

export function EntriesFilters({ filters, onChange }: EntriesFiltersProps) {
  const { data: accountsData } = useFinancialAccounts({ isActive: true });
  const accounts = accountsData?.data ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">De</label>
        <Input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Até</label>
        <Input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) => onChange({ endDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Tipo</label>
        <Select
          value={filters.type ?? ALL}
          onValueChange={(v) =>
            onChange({ type: v === ALL ? undefined : (v as "REVENUE" | "EXPENSE") })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="REVENUE">Receita</SelectItem>
            <SelectItem value="EXPENSE">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Conta</label>
        <Select
          value={filters.accountId ?? ALL}
          onValueChange={(v) => onChange({ accountId: v === ALL ? undefined : v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={filters.status ?? ALL}
          onValueChange={(v) =>
            onChange({ status: v === ALL ? undefined : (v as "PAID" | "OPEN") })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="PAID">Pago</SelectItem>
            <SelectItem value="OPEN">Em aberto</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

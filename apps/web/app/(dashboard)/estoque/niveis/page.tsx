"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/tables/data-table";
import { useInventoryItems, useSetMinStock } from "@/hooks/use-inventory";
import { useToast } from "@/components/ui/toast";
import { Loader2, Pencil } from "lucide-react";

// Enriched inventory item returned by GET /inventory
interface StockLevelRow {
  id: string;
  quantity: number;
  reserved: number;
  available: number;
  minStock: number;
  product?: { id: string; name: string; sku: string };
  warehouse?: { id: string; name: string };
}

export default function StockLevelsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [editing, setEditing] = useState<StockLevelRow | null>(null);

  const { data, isLoading } = useInventoryItems({ page, limit });
  const items = (data?.data ?? []) as unknown as StockLevelRow[];
  const total = data?.meta?.total ?? 0;

  const columns: ColumnDef<StockLevelRow>[] = [
    {
      id: "product",
      header: "Produto",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.product?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground font-mono">{row.product?.sku}</p>
        </div>
      ),
    },
    { id: "warehouse", header: "Depósito", cell: (row) => row.warehouse?.name ?? "—" },
    { id: "quantity", header: "Qtd", cell: (row) => row.quantity, className: "text-right", headerClassName: "text-right" },
    { id: "available", header: "Disponível", cell: (row) => row.available, className: "text-right", headerClassName: "text-right" },
    {
      id: "minStock",
      header: "Estoque mínimo",
      className: "text-right",
      headerClassName: "text-right",
      cell: (row) => {
        const below = row.minStock > 0 && row.available <= row.minStock;
        const zero = row.available <= 0;
        return (
          <div className="flex items-center justify-end gap-2">
            {(below || zero) && (
              <Badge variant={zero ? "destructive" : "warning"} className="text-[10px]">
                {zero ? "Zerado" : "Abaixo do mínimo"}
              </Badge>
            )}
            <span className="font-medium">{row.minStock}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
          <Pencil className="mr-1 h-3 w-3" />
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Níveis de estoque</h1>
        <p className="text-muted-foreground">
          Estoque por produto/depósito e definição do estoque mínimo.
        </p>
      </div>

      <DataTable<StockLevelRow>
        columns={columns}
        data={items}
        pagination={{ page, limit, total }}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isLoading}
        emptyMessage="Nenhum item de estoque"
        emptyDescription="Os saldos de estoque por depósito aparecerão aqui."
      />

      <MinStockDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// ─── Min-stock edit dialog ────────────────────────────────────────────

function MinStockDialog({
  item,
  onClose,
}: {
  item: StockLevelRow | null;
  onClose: () => void;
}) {
  const { addToast } = useToast();
  const setMinStock = useSetMinStock();
  const [value, setValue] = useState<number>(0);

  React.useEffect(() => {
    if (item) setValue(item.minStock);
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    if (value < 0 || !Number.isInteger(value)) {
      addToast("Informe um estoque mínimo válido (inteiro ≥ 0).", "error");
      return;
    }
    try {
      await setMinStock.mutateAsync({ itemId: item.id, minStock: value });
      addToast("Estoque mínimo atualizado!", "success");
      onClose();
    } catch {
      addToast("Erro ao atualizar o estoque mínimo. Tente novamente.", "error");
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Estoque mínimo</DialogTitle>
          <DialogDescription>
            {item?.product?.name} — {item?.warehouse?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Estoque mínimo
          </label>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setMinStock.isPending}>
            {setMinStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

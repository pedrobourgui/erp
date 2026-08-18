"use client";

import {
  Plus,
  Warehouse as WarehouseIcon,
  MapPin,
  Package,
  Pencil,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";

import { Can } from "@/components/auth/can";
import { RequirePermission } from "@/components/auth/require-permission";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";
import {
  useWarehouses,
  useDeleteWarehouse,
  type Warehouse,
} from "@/hooks/use-inventory";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { pluralize } from "@/lib/utils";

import { WarehouseFormDialog } from "./_components/warehouse-form-dialog";

/**
 * Endereço do depósito, só com as partes que existem.
 *
 * AE-12b: a tela interpolava `{address}, {city} - {state}` com separadores
 * fixos, então um depósito sem cidade exibia ", -" — que o QA leu como dado
 * corrompido.
 */
function formatWarehouseAddress(warehouse: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const cityState = [warehouse.city, warehouse.state].filter(Boolean).join(" - ");
  return [warehouse.address, cityState].filter(Boolean).join(", ");
}

// ─── Warehouse card ─────────────────────────────────────────────────────

interface WarehouseCardProps {
  warehouse: Warehouse;
  onEdit: (warehouse: Warehouse) => void;
  onDelete: (warehouse: Warehouse) => void;
}

function WarehouseCard({ warehouse, onEdit, onDelete }: WarehouseCardProps) {
  const address = formatWarehouseAddress(warehouse);
  const isInactive = warehouse.isActive === false;

  return (
    <Card className={isInactive ? "opacity-60" : undefined}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TruncatedText as="h3" text={warehouse.name} className="font-semibold" />
                {warehouse.isDefault ? (
                  <Badge variant="success" className="text-xs">
                    Padrão
                  </Badge>
                ) : null}
                {isInactive ? (
                  <Badge variant="secondary" className="text-xs">
                    Inativo
                  </Badge>
                ) : null}
              </div>
              {address ? (
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <TruncatedText text={address} />
                </div>
              ) : null}
            </div>
          </div>

          {/* AE-12d: os cards não tinham editar nem excluir. */}
          <div className="flex shrink-0 gap-1">
            <Can permission="inventory:update" mode="disable">
              <Tooltip content="Editar depósito">
                {/* Um botão só de ícone precisa de nome acessível: o tooltip do
                    Radix é `aria-describedby`, não substitui o rótulo. */}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar depósito"
                  onClick={() => onEdit(warehouse)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tooltip>
            </Can>
            <Can permission="inventory:delete" mode="disable">
              <Tooltip
                content={
                  warehouse.isDefault
                    ? "O depósito padrão não pode ser excluído"
                    : "Excluir depósito"
                }
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir depósito"
                  disabled={warehouse.isDefault}
                  onClick={() => onDelete(warehouse)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Tooltip>
            </Can>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-semibold">{warehouse.productCount ?? 0}</span>{" "}
            <span className="text-muted-foreground">
              {pluralize(warehouse.productCount ?? 0, "produto", "produtos")}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

function WarehousesPageContent() {
  const { data: resp, isLoading } = useWarehouses();
  const deleteWarehouse = useDeleteWarehouse();
  const { addToast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  const warehouses = resp?.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (warehouse: Warehouse) => {
    setEditing(warehouse);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting?.id) {return;}
    try {
      const result = await deleteWarehouse.mutateAsync(deleting.id);
      // The API decides between deleting and deactivating — say which one
      // happened instead of a generic "excluído com sucesso" that would be a
      // lie for a warehouse that is still there, inactive.
      addToast(result.message, "success");
      setDeleting(null);
    } catch (err) {
      addToast(getMutationErrorMessage(err, "Erro ao excluir o depósito."), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Depósitos</h1>
          <p className="text-muted-foreground">Gerencie seus depósitos e locais de estoque</p>
        </div>
        <Can permission="inventory:create" mode="disable">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Depósito
          </Button>
        </Can>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      ) : null}

      {!isLoading && warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WarehouseIcon className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Nenhum depósito cadastrado
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro depósito
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && warehouses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : null}

      {formOpen ? (
        <WarehouseFormDialog
          key={editing?.id ?? "new"}
          warehouse={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir depósito"
        message={
          deleting && (deleting.productCount ?? 0) > 0
            ? `"${deleting.name}" tem ${pluralize(deleting.productCount ?? 0, "produto", "produtos")} vinculados. Depósitos com histórico são desativados, não excluídos.`
            : `"${deleting?.name}" será excluído. Se houver histórico de movimentações, ele será apenas desativado.`
        }
        confirmLabel="Excluir"
        destructive
        loading={deleteWarehouse.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// AE-27/FN-09: the menu hides this route, but a URL still reaches it — the
// page guard is the real one.
export default function WarehousesPage() {
  return (
    <RequirePermission permission="inventory:read" subject="os depósitos">
      <WarehousesPageContent />
    </RequirePermission>
  );
}

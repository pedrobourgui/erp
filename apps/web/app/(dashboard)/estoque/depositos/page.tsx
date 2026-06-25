"use client";

import { warehouseSchema, type WarehouseFormValues } from "@repo/validators";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWarehouses, useCreateWarehouse, type Warehouse } from "@/hooks/use-inventory";
import { useToast } from "@/components/ui/toast";
import { Plus, Warehouse as WarehouseIcon, MapPin, Package, Loader2 } from "lucide-react";
import { maskCEP } from "@/lib/masks";

// ─── Warehouse card ─────────────────────────────────────────────────────

function WarehouseCard({ warehouse }: { warehouse: Warehouse }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{warehouse.name}</h3>
                {warehouse.isDefault && (
                  <Badge variant="success" className="text-xs">Padrão</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {warehouse.address}, {warehouse.city} - {warehouse.state}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-semibold">{warehouse.productCount}</span>{" "}
            <span className="text-muted-foreground">produtos</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function WarehousesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: resp, isLoading } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const { addToast } = useToast();
  const warehouses = resp?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: "", address: "", city: "", state: "", zipCode: "", isDefault: false },
  });

  const handleCreate = async (values: WarehouseFormValues) => {
    try {
      await createWarehouse.mutateAsync(values);
      addToast("Depósito criado com sucesso!", "success");
      reset();
      setDialogOpen(false);
    } catch {
      addToast("Erro ao criar depósito. Tente novamente.", "error");
    }
  };

  const fieldError = (field: keyof WarehouseFormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Depósitos</h1>
          <p className="text-muted-foreground">Gerencie seus depósitos e locais de estoque</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Depósito
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <WarehouseIcon className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">Nenhum depósito cadastrado</p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro depósito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh) => (
            <WarehouseCard key={wh.id} warehouse={wh} />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Depósito</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo depósito.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome *</label>
              <Input {...register("name")} placeholder="Nome do depósito"/>
              {fieldError("name") && <p className="text-xs text-destructive">{fieldError("name")}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Endereço *</label>
              <Input {...register("address")} placeholder="Rua, número"/>
              {fieldError("address") && <p className="text-xs text-destructive">{fieldError("address")}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cidade *</label>
                <Input {...register("city")} placeholder="Cidade"/>
                {fieldError("city") && <p className="text-xs text-destructive">{fieldError("city")}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">UF *</label>
                <Input {...register("state")} placeholder="SP" maxLength={2} />
                {fieldError("state") && <p className="text-xs text-destructive">{fieldError("state")}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">CEP *</label>
                <Input
                  {...register("zipCode")}
                  onChange={(e) => {
                    const masked = maskCEP(e.target.value);
                    setValue("zipCode", masked, { shouldValidate: true });
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {fieldError("zipCode") && <p className="text-xs text-destructive">{fieldError("zipCode")}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" {...register("isDefault")} className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="isDefault" className="text-sm font-medium">Depósito padrão</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="cancel" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createWarehouse.isPending}>
                {createWarehouse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Depósito
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";

import { Can } from "@/components/auth/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useDeleteCustomerAddress,
  type CustomerAddress,
} from "@/hooks/use-customers";
import { maskCEP } from "@/lib/masks";
import { getMutationErrorMessage } from "@/lib/mutation-error";

import { AddressFormDialog } from "./address-form-dialog";

interface AddressesTabProps {
  customerId: string;
  addresses: CustomerAddress[];
}

export function AddressesTab({ customerId, addresses }: AddressesTabProps) {
  const { addToast } = useToast();
  const deleteAddress = useDeleteCustomerAddress(customerId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [deleting, setDeleting] = useState<CustomerAddress | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (address: CustomerAddress) => {
    setEditing(address);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting?.id) {return;}
    try {
      await deleteAddress.mutateAsync(deleting.id);
      addToast("Endereço removido com sucesso!", "success");
      setDeleting(null);
    } catch (err) {
      addToast(getMutationErrorMessage(err, "Erro ao remover o endereço."), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can permission="customers:update" mode="disable">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo endereço
          </Button>
        </Can>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum endereço cadastrado
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <Card key={addr.id ?? `${addr.street}-${addr.number}`}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{addr.label || "Endereço"}</span>
                    {addr.isDefault ? (
                      <Badge variant="success" className="text-xs">
                        Padrão
                      </Badge>
                    ) : null}
                  </div>
                  <Can permission="customers:update" mode="disable">
                    <div className="flex shrink-0 gap-1">
                      <Tooltip content="Editar endereço">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar endereço"
                          onClick={() => openEdit(addr)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Remover endereço">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover endereço"
                          onClick={() => setDeleting(addr)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </Tooltip>
                    </div>
                  </Can>
                </div>
                <div className="space-y-0.5 text-sm text-muted-foreground">
                  <p>
                    {[`${addr.street}, ${addr.number}`, addr.complement]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  <p>{addr.neighborhood}</p>
                  {/* AE-12b: compose with filter(Boolean), never interpolate a
                      fixed separator — that is what produced ", -". */}
                  <p>{[addr.city, addr.state].filter(Boolean).join(" - ")}</p>
                  <p>CEP: {maskCEP(addr.zipCode)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {formOpen ? (
        <AddressFormDialog
          key={editing?.id ?? "new"}
          customerId={customerId}
          address={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remover endereço"
        message={
          deleting?.isDefault
            ? "Este é o endereço principal. Outro endereço passará a ser o principal automaticamente."
            : "O endereço será removido deste cliente."
        }
        confirmLabel="Remover"
        destructive
        loading={deleteAddress.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

"use client";

import type { PermissionName } from "@erp/constants";
import React, { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

import { AdjustmentForm } from "./adjustment-form";
import { EntryExitForm } from "./entry-exit-form";
import { TransferForm } from "./transfer-form";

type MovementMode = "ENTRY" | "EXIT" | "TRANSFER" | "ADJUSTMENT";

/**
 * AE-25: the dialog used to offer only Entrada and Saída, with a comment saying
 * transfers and adjustments "have their own flows" — flows that existed nowhere
 * in the frontend, while the backend supported both all along.
 *
 * A transfer and an adjustment are not plain entries, so each has its own
 * permission: `inventory:transfer` and `inventory:adjust`.
 */
const MODES: {
  value: MovementMode;
  label: string;
  description: string;
  permission: PermissionName;
}[] = [
  {
    value: "ENTRY",
    label: "Entrada",
    description: "Adicione produtos ao estoque de um depósito.",
    permission: "inventory:create",
  },
  {
    value: "EXIT",
    label: "Saída",
    description: "Remova produtos do estoque de um depósito.",
    permission: "inventory:create",
  },
  {
    value: "TRANSFER",
    label: "Transferência",
    description: "Mova produtos entre dois depósitos.",
    permission: "inventory:transfer",
  },
  {
    value: "ADJUSTMENT",
    label: "Ajuste",
    description: "Acerte o saldo do sistema com a quantidade contada.",
    permission: "inventory:adjust",
  },
];

interface MovementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementFormDialog({ open, onOpenChange }: MovementFormDialogProps) {
  const { can, isLoaded } = usePermissions();

  const availableModes = useMemo(() => MODES.filter((m) => can(m.permission)), [can]);

  const [mode, setMode] = useState<MovementMode>("ENTRY");

  // Land on a tab the user can actually use — a warehouse operator without
  // `inventory:adjust` must not open on a form that will 403 on submit.
  useEffect(() => {
    if (!isLoaded || availableModes.length === 0) {return;}
    if (!availableModes.some((m) => m.value === mode)) {
      setMode(availableModes[0].value);
    }
  }, [isLoaded, availableModes, mode]);

  const current = MODES.find((m) => m.value === mode) ?? MODES[0];
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
          <DialogDescription>{current.description}</DialogDescription>
        </DialogHeader>

        <div className="mb-2 flex shrink-0 gap-1 overflow-x-auto border-b">
          {availableModes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                mode === m.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Each mode gets a fresh form: `key` remounts it so a half-filled
            transfer does not leak into an adjustment. */}
        {mode === "ENTRY" || mode === "EXIT" ? (
          <EntryExitForm key={mode} type={mode} onDone={close} />
        ) : null}
        {mode === "TRANSFER" ? <TransferForm key={mode} onDone={close} /> : null}
        {mode === "ADJUSTMENT" ? <AdjustmentForm key={mode} onDone={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}

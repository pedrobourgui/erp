"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  useDeleteFinancialEntry,
  type FinancialEntry,
} from "@/hooks/use-financial-entries";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface DeleteEntryDialogProps {
  entry: FinancialEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * FN-04: exclusão de título.
 *
 * É soft delete e exige motivo: um lançamento financeiro que some sem rastro é
 * indefensável numa conciliação. A API só aceita para título sem baixa e sem
 * documento de origem.
 */
export function DeleteEntryDialog({
  entry,
  open,
  onOpenChange,
}: DeleteEntryDialogProps) {
  const { addToast } = useToast();
  const remove = useDeleteFinancialEntry();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      setReason("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!entry) {
      return;
    }
    if (!reason.trim()) {
      setError("Informe o motivo da exclusão");
      return;
    }

    try {
      await remove.mutateAsync({ id: entry.id, reason: reason.trim() });
      addToast("Lançamento excluído com sucesso!", "success");
      handleClose(false);
    } catch (err) {
      addToast(
        getApiErrorMessage(err) ??
          "Erro ao excluir o lançamento. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir lançamento</DialogTitle>
          <DialogDescription>
            {entry?.description} — {formatCurrency(entry?.amount ?? 0)}. O
            lançamento sai das telas, mas fica registrado para auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="delete-reason">
            Motivo da exclusão
          </label>
          <Input
            id="delete-reason"
            value={reason}
            maxLength={500}
            placeholder="Ex.: lançado em duplicidade"
            onChange={(e) => {
              setReason(e.target.value);
              if (error) {setError(null);}
            }}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={remove.isPending}
          >
            {remove.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

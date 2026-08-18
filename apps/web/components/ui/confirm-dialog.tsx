"use client";

import { AlertTriangle } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  icon?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────

/**
 * DS-08 / EST-07: isto era uma `<div>` sobreposta com overlay próprio. Sem
 * `role="dialog"`, um leitor de tela não anunciava que algo tinha aberto; sem
 * foco preso, o Tab passeava pela página atrás do overlay; sem devolução de
 * foco, quem fechava com Esc voltava para o topo do documento. Confirmar uma
 * exclusão é o pior lugar do sistema para o usuário não saber onde está.
 *
 * Reconstruído sobre o `Dialog` do Radix, que resolve os três de uma vez e
 * ainda traz o `max-h-[85vh]` do DS-03 e o travamento de scroll de brinde.
 *
 * AE-09 continua valendo: hooks **antes** de qualquer return condicional. Aqui
 * não há nenhum — o Radix é que decide o que montar a partir de `open`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmDialogProps) {
  /**
   * Esc, clique no overlay e o "×" do primitivo chegam todos aqui como
   * `open === false`. Cancelar por qualquer um dos três é cancelar — o
   * `onCancel` do chamador não pode depender de qual foi.
   */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onCancel?.();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <div
            className={cn(
              "mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:mb-0 sm:mr-4",
              destructive
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            )}
          >
            {icon ?? <AlertTriangle className="h-6 w-6" />}
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle>{title}</DialogTitle>
            {/* `message` aceita ReactNode, e um `<div>` dentro do `<p>` padrão
                do Description seria HTML inválido. */}
            <DialogDescription asChild>
              <div className="mt-2 text-sm text-muted-foreground">{message}</div>
            </DialogDescription>
          </div>
        </div>

        <DialogFooter className="mt-6 flex-col-reverse gap-2 sm:mt-6">
          <Button
            type="button"
            variant="cancel"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

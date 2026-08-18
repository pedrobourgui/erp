"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
  useEntrySettlements,
  useReverseSettlement,
  type FinancialEntry,
} from "@/hooks/use-financial-entries";
import { getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface ReverseSettlementDialogProps {
  entry: FinancialEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * FN-04: estorno de baixa.
 *
 * Um título pode ter sido baixado várias vezes, então a tela lista as baixas e
 * o operador escolhe qual estornar — adivinhar "a última" seria decidir por ele.
 * A baixa já estornada continua na lista, marcada: o histórico é o que torna a
 * conciliação auditável.
 */
export function ReverseSettlementDialog({
  entry,
  open,
  onOpenChange,
}: ReverseSettlementDialogProps) {
  const { addToast } = useToast();
  const { data: settlements, isLoading } = useEntrySettlements(
    open ? entry?.id ?? null : null
  );
  const reverse = useReverseSettlement();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const reversible = (settlements ?? []).filter((s) => !s.isReversed);

  const handleClose = (next: boolean) => {
    if (!next) {
      setSelectedId(null);
      setReason("");
      setReasonError(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!entry || !selectedId) {
      return;
    }
    if (!reason.trim()) {
      setReasonError("Informe o motivo do estorno");
      return;
    }

    try {
      await reverse.mutateAsync({
        id: entry.id,
        settlementId: selectedId,
        reason: reason.trim(),
      });
      addToast("Baixa estornada com sucesso!", "success");
      handleClose(false);
    } catch (err) {
      addToast(
        getApiErrorMessage(err) ?? "Erro ao estornar a baixa. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estornar baixa</DialogTitle>
          <DialogDescription>
            {entry?.description} — o estorno devolve o saldo em aberto do título e
            lança a transação contrária na conta.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (settlements ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Este título ainda não tem baixa registrada.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {(settlements ?? []).map((settlement) => (
                <button
                  key={settlement.id}
                  type="button"
                  disabled={settlement.isReversed}
                  onClick={() => setSelectedId(settlement.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    settlement.isReversed
                      ? "cursor-not-allowed opacity-60"
                      : selectedId === settlement.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(settlement.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(settlement.settledAt)}
                    </p>
                  </div>
                  {settlement.isReversed ? <Badge variant="secondary">Estornada</Badge> : null}
                </button>
              ))}
            </div>

            {reversible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todas as baixas deste título já foram estornadas.
              </p>
            ) : (
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="reversal-reason">
                  Motivo do estorno
                </label>
                <Input
                  id="reversal-reason"
                  value={reason}
                  maxLength={500}
                  placeholder="Ex.: baixa lançada na conta errada"
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) {setReasonError(null);}
                  }}
                />
                {reasonError ? <p className="text-xs text-destructive">{reasonError}</p> : null}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || reverse.isPending}
          >
            {reverse.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            Estornar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

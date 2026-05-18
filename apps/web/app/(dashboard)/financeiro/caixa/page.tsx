"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useCashRegisters,
  useCashRegisterSession,
  type CashRegister,
} from "@/hooks/use-cash-registers";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, Loader2, Landmark, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { CashRegisterCard } from "./_components/cash-register-card";
import {
  CreateCashRegisterDialog,
  OpenSessionDialog,
  CloseSessionDialog,
  MovementDialog,
} from "./_components/cash-register-dialogs";

// ─── Page ─────────────────────────────────────────────────────────────

export default function CashRegistersPage() {
  const { data, isLoading } = useCashRegisters();

  const [createOpen, setCreateOpen] = useState(false);
  const [openTarget, setOpenTarget] = useState<CashRegister | null>(null);
  const [closeTarget, setCloseTarget] = useState<CashRegister | null>(null);
  const [supplyTarget, setSupplyTarget] = useState<CashRegister | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<CashRegister | null>(null);
  const [viewTarget, setViewTarget] = useState<CashRegister | null>(null);

  const registers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caixas</h1>
          <p className="text-muted-foreground">
            Gerencie os caixas registradores e suas sessoes
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Caixa
        </Button>
      </div>

      {/* Summary cards */}
      <SummaryBar registers={registers} />

      {/* Cash register grid */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : registers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p>Nenhum caixa cadastrado</p>
            <p className="mt-1 text-xs">
              Crie um caixa para comecar a registrar operacoes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {registers.map((reg) => (
            <CashRegisterCard
              key={reg.id}
              register={reg}
              onOpen={setOpenTarget}
              onClose={setCloseTarget}
              onSupply={setSupplyTarget}
              onWithdraw={setWithdrawTarget}
              onViewSession={setViewTarget}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateCashRegisterDialog open={createOpen} onOpenChange={setCreateOpen} />
      <OpenSessionDialog register={openTarget} onClose={() => setOpenTarget(null)} />
      <CloseSessionDialog register={closeTarget} onClose={() => setCloseTarget(null)} />
      <MovementDialog register={supplyTarget} type="supply" onClose={() => setSupplyTarget(null)} />
      <MovementDialog register={withdrawTarget} type="withdraw" onClose={() => setWithdrawTarget(null)} />
      <SessionDetailDialog register={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────

function SummaryBar({ registers }: { registers: CashRegister[] }) {
  const openCount = registers.filter(
    (r) => r.currentSession?.status === "OPEN"
  ).length;
  const closedCount = registers.length - openCount;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Caixas</p>
            <p className="text-2xl font-bold">{registers.length}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Abertos</p>
            <p className="text-2xl font-bold text-green-600">{openCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <ArrowDownCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fechados</p>
            <p className="text-2xl font-bold">{closedCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Session detail dialog ────────────────────────────────────────────

function SessionDetailDialog({
  register: reg,
  onClose,
}: {
  register: CashRegister | null;
  onClose: () => void;
}) {
  const sessionId = reg?.currentSession?.id ?? "";
  const { data, isLoading } = useCashRegisterSession(sessionId);
  const session = data?.data;

  return (
    <Dialog open={!!reg} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sessao - {reg?.name}</DialogTitle>
          <DialogDescription>
            Detalhes da sessao aberta atualmente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !session ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma sessao aberta para este caixa.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Session info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={session.status === "OPEN" ? "success" : "secondary"}>
                  {session.status === "OPEN" ? "Aberto" : "Fechado"}
                </Badge>
              </div>
              {session.operator && (
                <div>
                  <p className="text-muted-foreground">Operador</p>
                  <p className="font-medium">{session.operator.name}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Aberto em</p>
                <p className="font-medium">{formatDateTime(session.openedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Saldo abertura</p>
                <p className="font-medium">{formatCurrency(session.openingBalance)}</p>
              </div>
            </div>

            {/* Movements */}
            {session.movements && session.movements.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Movimentacoes</p>
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
                  {session.movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div>
                        <Badge
                          variant={
                            mov.type === "SUPPLY"
                              ? "success"
                              : mov.type === "WITHDRAW"
                                ? "destructive"
                                : "default"
                          }
                          className="mr-2"
                        >
                          {mov.type === "SUPPLY"
                            ? "Suprimento"
                            : mov.type === "WITHDRAW"
                              ? "Sangria"
                              : "Venda"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {mov.reason || mov.description}
                        </span>
                      </div>
                      <span className="font-medium">
                        {mov.type === "WITHDRAW" ? "- " : "+ "}
                        {formatCurrency(mov.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma movimentacao registrada nesta sessao.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  DoorOpen,
  DoorClosed,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
} from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type { CashRegister } from "@/hooks/use-cash-registers";
import { formatCurrency, formatDateTime } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────

interface CashRegisterCardProps {
  register: CashRegister;
  onOpen: (register: CashRegister) => void;
  onClose: (register: CashRegister) => void;
  onSupply: (register: CashRegister) => void;
  onWithdraw: (register: CashRegister) => void;
  onViewSession: (register: CashRegister) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export function CashRegisterCard({
  register: reg,
  onOpen,
  onClose,
  onSupply,
  onWithdraw,
  onViewSession,
}: CashRegisterCardProps) {
  const isOpen = reg.currentSession?.status === "OPEN";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{reg.name}</CardTitle>
        <Badge variant={isOpen ? "success" : "secondary"}>
          {isOpen ? "Aberto" : "Fechado"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOpen && reg.currentSession ? <div className="space-y-2 text-sm">
            {reg.currentSession.operator ? <div className="flex justify-between">
                <span className="text-muted-foreground">Operador</span>
                <span className="font-medium">
                  {reg.currentSession.operator.name}
                </span>
              </div> : null}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aberto em</span>
              <span>{formatDateTime(reg.currentSession.openedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo abertura</span>
              <span className="font-medium">
                {formatCurrency(reg.currentSession.openingBalance)}
              </span>
            </div>
          </div> : null}

        {!isOpen && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Nenhuma sessão aberta
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!isOpen ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onOpen(reg)}
            >
              <DoorOpen className="mr-1.5 h-3.5 w-3.5" />
              Abrir Caixa
            </Button>
          ) : (
            <>
              {/* Fechar o caixa é rotina de fim de turno, não destruição de
                  dado — e vinha em vermelho cheio enquanto "Abrir Caixa", o
                  ato simétrico, vinha em primário. Regra do sistema:
                  preenchimento vermelho destrói dado, contorno vermelho
                  reverte dado, primário avança o fluxo. */}
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onClose(reg)}
              >
                <DoorClosed className="mr-1.5 h-3.5 w-3.5" />
                Fechar
              </Button>
              <Tooltip content="Suprimento">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSupply(reg)}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="Sangria">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onWithdraw(reg)}
                >
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="Ver sessão">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewSession(reg)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

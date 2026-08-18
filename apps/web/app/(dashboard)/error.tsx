"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Erro na tela do dashboard:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Não foi possível carregar esta tela</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Você pode tentar novamente — o restante do sistema continua
          funcionando pelo menu ao lado.
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

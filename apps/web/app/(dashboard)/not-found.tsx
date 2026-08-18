"use client";

import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * FN-18: 404 **dentro** do shell do dashboard — o usuário mantém o menu e
 * consegue continuar trabalhando, em vez de cair numa página branca em inglês
 * e ter que digitar a URL de novo.
 */
export default function DashboardNotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Página não encontrada
        </h2>
        <p className="text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi movido. Use o menu ao lado
          para continuar.
        </p>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
        <Button asChild>
          <Link href="/">Ir para o início</Link>
        </Button>
      </div>
    </div>
  );
}

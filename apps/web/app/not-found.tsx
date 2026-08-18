import { FileQuestion } from "lucide-react";
import Link from "next/link";

/**
 * FN-18: `/xyz` caía no 404 cru do Next — página branca, "This page could not
 * be found", em inglês, sem menu e sem link de volta.
 *
 * Este é o 404 global (fora do shell do dashboard). O de dentro do shell fica
 * em `app/(dashboard)/not-found.tsx`, com o menu preservado.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="text-muted-foreground">
          O endereço que você abriu não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Voltar ao início
      </Link>
    </div>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildBreadcrumbs } from "@/lib/breadcrumbs";

/**
 * FN-22: trilha de navegação derivada da rota.
 *
 * Some no mobile: em 390 px ela competiria com o próprio conteúdo, que é o que
 * o AE-07 acabou de liberar.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Trilha de navegação"
      className="mb-4 hidden items-center gap-1 text-sm text-muted-foreground sm:flex"
    >
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground" aria-current="page">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

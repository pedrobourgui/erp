import { NAV_ITEMS } from "@/lib/nav-items";

export interface Crumb {
  label: string;
  /** `null` no último item — a página atual não é link. */
  href: string | null;
}

/**
 * Rótulos de segmentos que não vêm do menu (telas de segundo nível, ações).
 * O menu continua sendo a fonte para tudo que ele conhece.
 */
const EXTRA_LABELS: Record<string, string> = {
  novo: "Novo",
  edit: "Editar",
  perfil: "Perfil",
  configuracoes: "Configurações",
  clientes: "Clientes",
};

/** Rótulo conhecido para um caminho, vindo do menu. */
function labelFromNav(href: string): string | null {
  for (const item of NAV_ITEMS) {
    if (item.href === href) {
      return item.title;
    }
    for (const child of item.children ?? []) {
      if (child.href === href) {
        return child.title;
      }
    }
  }
  return null;
}

/** Segmento sem rótulo conhecido: vira Título Capitalizado, sem hífens. */
function humanize(segment: string): string {
  return segment
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * FN-22: nenhuma tela tinha trilha. Em `/configuracoes/metodos-pagamento` o
 * usuário não sabia onde estava nem como subir um nível.
 *
 * A trilha sai da própria rota, com os rótulos do menu — assim ela não pode
 * divergir do que o usuário clicou para chegar ali.
 */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }

  const crumbs: Crumb[] = [{ label: "Início", href: "/" }];

  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;

    // Um id (cuid/uuid) não vira migalha legível — a página cuida do título.
    const isId = /^[0-9a-f]{8,}$/i.test(segment) || segment.length > 20;
    const label =
      labelFromNav(href) ?? EXTRA_LABELS[segment] ?? (isId ? "Detalhe" : humanize(segment));

    crumbs.push({ label, href: isLast ? null : href });
  });

  return crumbs;
}

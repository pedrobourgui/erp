"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShoppingCart,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Warehouse,
  AlertTriangle,
  ShoppingBag,
  BoxIcon,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Types ──────────────────────────────────────────────────────────────

interface NavChild {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: NavChild[];
}

// ─── Navigation config ──────────────────────────────────────────────────

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Estoque",
    href: "/estoque",
    icon: Package,
    children: [
      { title: "Produtos", href: "/estoque/produtos" },
      { title: "Categorias", href: "/estoque/categorias" },
      { title: "Marcas", href: "/estoque/marcas" },
      { title: "Movimentações", href: "/estoque/movimentacoes" },
      { title: "Níveis de estoque", href: "/estoque/niveis" },
      { title: "Depósitos", href: "/estoque/depositos" },
      { title: "Alertas", href: "/estoque/alertas" },
    ],
  },
  {
    title: "Vendas",
    href: "/vendas",
    icon: ShoppingCart,
    children: [
      { title: "Pedidos", href: "/vendas/pedidos" },
      { title: "Nova Venda", href: "/vendas/pedidos/novo" },
      { title: "Venda Balcão", href: "/vendas/balcao" },
    ],
  },
  {
    title: "Clientes",
    href: "/clientes",
    icon: Users,
  },
  {
    title: "Financeiro",
    href: "/financeiro",
    icon: Landmark,
    children: [
      { title: "Contas", href: "/financeiro/contas" },
      { title: "Caixas", href: "/financeiro/caixa" },
    ],
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    children: [
      { title: "Geral", href: "/configuracoes" },
      { title: "Cond. Pagamento", href: "/configuracoes/condicoes-pagamento" },
      { title: "Métodos Pagamento", href: "/configuracoes/metodos-pagamento" },
    ],
  },
];

// ─── Sidebar ────────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    navItems.forEach((item) => {
      if (item.children && item.href !== "/" && pathname.startsWith(item.href)) {
        initial.add(item.href);
      }
    });
    return initial;
  });

  const toggleGroup = (href: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "grain-texture relative flex h-screen flex-col bg-sidebar-bg transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[264px]"
      )}
    >
      {/* Logo area */}
      <div className="relative z-10 flex h-16 items-center border-b border-white/[0.06] px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20 transition-transform duration-200 group-hover:scale-105">
              <span className="text-sm font-bold text-white font-heading">E</span>
            </div>
            <span className="text-[15px] font-bold text-white/90 font-heading tracking-tight">ERP System</span>
          </Link>
        )}
        {collapsed && (
          <div className="flex w-full justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20">
              <span className="text-sm font-bold text-white font-heading">E</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            isOpen={openGroups.has(item.href)}
            onToggle={() => toggleGroup(item.href)}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      <Tooltip content={collapsed ? "Expandir menu" : "Recolher menu"}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-20 z-20 h-6 w-6 rounded-full border border-border bg-card shadow-soft hover:bg-accent hover:text-white hover:border-accent transition-all duration-200"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </Tooltip>
        
      {/* Bottom */}
      <div className="relative z-10 border-t border-white/[0.06] px-4 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
            <span className="text-[11px] text-sidebar-fg/60">Sistema ativo</span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse-glow" />
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Nav item component ─────────────────────────────────────────────────

function NavItemComponent({
  item,
  pathname,
  collapsed,
  isOpen,
  onToggle,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  if (hasChildren && !collapsed) {
    return (
      <div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
            isActive
              ? "active-bar bg-white/[0.08] text-white"
              : "text-sidebar-fg hover:bg-white/[0.04] hover:text-white/90"
          )}
        >
          <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors duration-200", isActive && "text-accent")} />
          <span className="flex-1 truncate text-left">{item.title}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="ml-[30px] mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-3">
            {item.children?.map((child) => {
               const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-200",
                    childActive
                      ? "bg-white/[0.08] text-white"
                      : "text-sidebar-fg/70 hover:bg-white/[0.04] hover:text-white/90"
                  )}
                >
                  {child.title}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={hasChildren ? item.children![0].href : item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
        isActive
          ? "active-bar bg-white/[0.08] text-white"
          : "text-sidebar-fg hover:bg-white/[0.04] hover:text-white/90",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? item.title : undefined}
    >
      <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors duration-200", isActive && "text-accent")} />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </Link>
  );
}

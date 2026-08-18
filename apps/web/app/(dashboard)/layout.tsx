"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { Breadcrumbs } from "@/components/layouts/breadcrumbs";
import { Header } from "@/components/layouts/header";
import { Sidebar } from "@/components/layouts/sidebar";
import { useAuthStore } from "@/stores/auth.store";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* A navegação vem antes do conteúdo no DOM, então quem usa teclado
          percorre o menu inteiro a cada página. Este atalho — visível só
          quando recebe foco — pula direto para o conteúdo. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <Sidebar mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />
      {/* AE-07: `min-w-0` é o que permite este filho flex encolher. Sem ele o
          conteúdo mantém a largura intrínseca e a tela **corta** — foi a causa
          do `scrollWidth === clientWidth` que o QA mediu em 390 px. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main
          id="conteudo"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-background p-4 animate-fade-in sm:p-6 lg:p-8"
        >
          {/* `filters-scope` marca o que conta como "espaço disponível" para o
              painel de filtros: a largura real do conteúdo, que muda quando a
              sidebar recolhe sem que o viewport mude. Ver `globals.css`. */}
          <div className="filters-scope mx-auto w-full min-w-0 max-w-[1600px]">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

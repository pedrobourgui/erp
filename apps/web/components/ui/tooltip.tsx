"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";

import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
}

/** Há texto visível em algum lugar desta árvore? */
function hasVisibleText(node: React.ReactNode): boolean {
  if (typeof node === "string") {
    return node.trim().length > 0;
  }
  if (typeof node === "number") {
    return true;
  }
  if (Array.isArray(node)) {
    return node.some(hasVisibleText);
  }
  if (React.isValidElement(node)) {
    return hasVisibleText((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

/**
 * DS-01: o `content` só chegava ao `Content` do Radix, que o liga por
 * `aria-describedby` — **descrição**, não **nome**. Um botão só-ícone ficava
 * sem nome acessível nenhum: o QA mediu 60 de 60 botões de ação da tabela de
 * produtos assim, e `getByRole("button", { name: "Editar" })` respondia zero
 * nas cinco listagens. Eram 35 dos 45 controles só-ícone do repositório.
 *
 * O rótulo só é injetado quando o gatilho **não tem texto visível** e ainda não
 * declara um nome próprio. Um botão que mostra "Salvar" precisa continuar se
 * chamando "Salvar", mesmo que o tooltip explique mais — trocar o nome pelo
 * texto do tooltip quebraria o WCAG 2.5.3 e o comando de voz junto.
 */
function withAccessibleName(children: React.ReactNode, content: string): React.ReactNode {
  if (!React.isValidElement(children)) {
    return children;
  }

  const props = children.props as {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    children?: React.ReactNode;
  };

  if (props["aria-label"] || props["aria-labelledby"] || hasVisibleText(props.children)) {
    return children;
  }

  return React.cloneElement(children as React.ReactElement<{ "aria-label"?: string }>, {
    "aria-label": content,
  });
}

export function Tooltip({ content, children, side = "bottom", align = "center", className }: TooltipProps) {
  if (!content) {
    return <>{children}</>;
  }

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        {withAccessibleName(children, content)}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-[100] rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

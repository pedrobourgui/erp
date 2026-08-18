"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * Último elemento focado **fora** de um diálogo — na prática, quem abriu o que
 * está aberto agora.
 *
 * O Radix devolve o foco com `triggerRef.current?.focus()`, e `triggerRef` só
 * existe quando o diálogo é aberto por um `<DialogTrigger>`. Nenhum diálogo
 * deste sistema é: todos são controlados por `open`/`onOpenChange` a partir de
 * um botão de linha ou de cabeçalho. Fechar qualquer um deles jogava o foco no
 * `<body>`, e quem navega por teclado voltava ao topo do documento em vez de
 * para o botão que acabou de usar.
 *
 * O rastreio precisa ser global. Capturar dentro do `DialogContent` não
 * funciona: o `FocusScope` do Radix é descendente, e efeitos de descendente
 * rodam **antes** — quando chega a nossa vez, o foco já entrou no diálogo.
 */
let lastFocusOutsideDialog: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[role="dialog"]')) {
        return;
      }
      lastFocusOutsideDialog = target;
    },
    true
  );
}

/**
 * Onde o diálogo se ancora.
 *
 * As duas posições são strings completas em vez de sobreposições sobre a
 * centralizada: `left-[50%] … translate-x-[-50%]` e as animações de entrada
 * formam um conjunto, e desmontá-lo classe a classe pelo `className` depende de
 * o `tailwind-merge` reconhecer cada par — o que não acontece com as variantes
 * de `slide-in-from-*`. Uma folha pedida assim nasceu 69px acima do rodapé.
 */
const POSITION_CLASS = {
  center:
    "left-[50%] top-[50%] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 p-6 sm:rounded-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
  /** Folha ancorada no rodapé — o alcance do polegar no mobile. */
  bottom:
    "inset-x-0 bottom-0 w-full rounded-t-xl border-x-0 border-b-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
} as const;

export type DialogPosition = keyof typeof POSITION_CLASS;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    position?: DialogPosition;
  }
>(({ className, children, onCloseAutoFocus, position = "center", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      // O Radix 1.1.15 não emite `aria-modal`. Sem ele, um leitor de tela não
      // anuncia que o resto da página saiu de cena.
      aria-modal="true"
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (event.defaultPrevented) {
          return;
        }
        // Lido na hora do fechamento, não guardado na abertura: o corpo deste
        // componente monta junto com a página, muito antes de o diálogo abrir.
        // Como o rastreador ignora foco dentro de diálogos, o que está aqui
        // ainda é quem abriu este.
        const opener = lastFocusOutsideDialog;
        if (opener && document.contains(opener)) {
          event.preventDefault();
          opener.focus();
        }
      }}
      className={cn(
        "fixed z-50 grid border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        POSITION_CLASS[position],
        // DS-03: o limite mora aqui, não em cada chamador. 18 dos 22 diálogos
        // do sistema não o declaravam, e em 390×667 três passavam da tela sem
        // rolagem — o rodapé, com o botão de confirmar, ficava fora de alcance
        // (FN-14, AE-26). `cn()` deixa o chamador sobrescrever quando precisar.
        "max-h-[85vh] overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        className
      )}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        className
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};

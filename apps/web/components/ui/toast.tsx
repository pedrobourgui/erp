"use client";

import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import React, { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

// ─── Variant config ─────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  error: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
};

// ─── Context ────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser usado dentro de um Toaster");
  }
  return ctx;
}

// ─── Toast item ─────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border p-4 shadow-elevated animate-slide-down",
        variantStyles[toast.variant]
      )}
    >
      <div className="shrink-0">{variantIcons[toast.variant]}</div>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <Tooltip content="Fechar">
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}

// ─── Toaster provider ───────────────────────────────────────────────────

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {mounted ? createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none">
            {toasts.map((toast) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onRemove={removeToast}
              />
            ))}
          </div>,
          document.body
        ) : null}
    </ToastContext.Provider>
  );
}

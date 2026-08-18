"use client";

import { scorePassword, passwordStrengthLabel } from "@erp/validators";

import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

/** Cor por faixa: vermelho, laranja, âmbar, verde-claro, verde. */
const BAR_COLORS = [
  "bg-destructive",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-green-600",
];

/**
 * Medidor de força de senha (FN-25).
 *
 * É um indicador de **conforto**, não de validade: uma senha pode passar na
 * política (score 2) e ainda assim valer a pena melhorar. O que barra o submit
 * é o zod; isto só mostra onde a senha está.
 */
export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  if (!password) {
    return null;
  }

  const score = scorePassword(password);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < score ? BAR_COLORS[score] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Força da senha:{" "}
        <span className="font-medium text-foreground">
          {passwordStrengthLabel(score)}
        </span>
      </p>
    </div>
  );
}

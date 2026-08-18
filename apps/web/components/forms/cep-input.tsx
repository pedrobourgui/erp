"use client";

import { Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { lookupCep, isValidCepFormat, type CepAddress } from "@/lib/cep";
import { maskCEP } from "@/lib/masks";

export interface CepInputProps {
  value: string;
  onChange: (masked: string) => void;
  /** Called only when the lookup succeeds. Never called on failure. */
  onAddressFound: (address: CepAddress) => void;
  /** Rendered under the field — the caller owns the zod error message. */
  error?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * CEP field that fills the address (AE-16).
 *
 * The lookup fires as soon as 8 digits are typed, so a pasted CEP resolves
 * without waiting for a blur. Street, neighbourhood, city and state come from
 * the provider; number and complement are always the user's to type.
 *
 * A failed lookup shows a hint and nothing else — it must never block the
 * submit, because a warehouse in a brand-new subdivision has a CEP that ViaCEP
 * does not know yet, and that warehouse still has to be registered.
 */
export function CepInput({
  value,
  onChange,
  onAddressFound,
  error,
  disabled,
  id,
}: CepInputProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "not-found" | "unavailable">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const lastLookedUp = useRef<string>("");

  // Drop an in-flight lookup when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const runLookup = useCallback(
    async (digits: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("loading");
      const result = await lookupCep(digits, controller.signal);
      if (controller.signal.aborted) {return;}

      if (result.status === "ok") {
        setStatus("idle");
        onAddressFound(result.address);
        return;
      }
      setStatus(result.status);
    },
    [onAddressFound]
  );

  const handleChange = (raw: string) => {
    const masked = maskCEP(raw);
    onChange(masked);

    const digits = masked.replace(/\D/g, "");
    if (!isValidCepFormat(digits)) {
      lastLookedUp.current = "";
      setStatus("idle");
      return;
    }
    // Retyping the same CEP must not fire a second request — and must not
    // overwrite an address the user has since corrected by hand.
    if (lastLookedUp.current === digits) {return;}
    lastLookedUp.current = digits;
    void runLookup(digits);
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        CEP
      </label>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="00000-000"
          maxLength={9}
          inputMode="numeric"
          disabled={disabled}
        />
        {status === "loading" ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && status === "not-found" ? (
        <p className="text-xs text-muted-foreground">
          CEP não encontrado. Preencha o endereço manualmente.
        </p>
      ) : null}
      {!error && status === "unavailable" ? (
        <p className="text-xs text-muted-foreground">
          Busca de CEP indisponível. Preencha o endereço manualmente.
        </p>
      ) : null}
    </div>
  );
}

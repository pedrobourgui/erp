"use client";

import React, { useCallback } from "react";

import { Input } from "@/components/ui/input";

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: (value: string) => string;
  value: string;
  onChange: (maskedValue: string, rawValue: string) => void;
}

export function MaskedInput({ mask, value, onChange, ...props }: MaskedInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const masked = mask(raw);
      onChange(masked, raw.replace(/\D/g, ''));
    },
    [mask, onChange]
  );

  return <Input {...props} value={value} onChange={handleChange} />;
}

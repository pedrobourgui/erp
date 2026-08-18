"use client";

import { useEffect, useState } from "react";

/**
 * Value that only settles after `delay` ms without changes.
 *
 * The frontend rules ask for a 300 ms debounce on every search input; this is
 * that rule in one place instead of a `setTimeout` per screen.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

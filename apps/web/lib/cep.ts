/**
 * CEP lookup (AE-16).
 *
 * Three screens ask for a CEP and none of them ever used it: the user typed the
 * postal code and then retyped street, neighbourhood, city and state by hand.
 *
 * The lookup is a **convenience, never a gate**: a CEP that does not exist, a
 * provider that is down or a request that times out must leave the form usable
 * with everything the user already typed. That is why every failure path here
 * returns a value instead of throwing at the caller's face.
 */

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type CepLookupResult =
  | { status: "ok"; address: CepAddress }
  | { status: "not-found" }
  | { status: "unavailable" };

const LOOKUP_TIMEOUT_MS = 5000;

/** A CEP is exactly 8 digits — mask and hyphen are display only. */
export function isValidCepFormat(value: string): boolean {
  return /^\d{8}$/.test(value.replace(/\D/g, ""));
}

interface ViaCepPayload {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

/**
 * Looks a CEP up on ViaCEP.
 *
 * `signal` lets the caller drop a stale request when the user keeps typing —
 * without it a slow answer for `01310-1` can land after the answer for
 * `01310-100` and overwrite the right address with the wrong one.
 */
export async function lookupCep(
  cep: string,
  signal?: AbortSignal
): Promise<CepLookupResult> {
  const digits = cep.replace(/\D/g, "");
  if (!isValidCepFormat(digits)) {return { status: "not-found" };}

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), LOOKUP_TIMEOUT_MS);

  // Abort on either the caller's signal or our own timeout.
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener("abort", onCallerAbort);

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${digits}/json/`,
      { signal: timeout.signal }
    );

    if (!response.ok) {return { status: "unavailable" };}

    const payload = (await response.json()) as ViaCepPayload;

    // ViaCEP answers 200 with `{ "erro": true }` for a well-formed CEP that
    // does not exist — a status code check alone would call it a success.
    if (payload.erro) {return { status: "not-found" };}

    return {
      status: "ok",
      address: {
        street: payload.logradouro ?? "",
        neighborhood: payload.bairro ?? "",
        city: payload.localidade ?? "",
        state: payload.uf ?? "",
      },
    };
  } catch {
    // Offline, DNS failure, timeout, CORS — all the same to the user: the
    // address stays manual.
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

import { AxiosError } from "axios";

/**
 * HTTP status of a failed request, or `undefined` when the failure was not an
 * HTTP response (network error, thrown `Error`, cancelled request).
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status;
  }
  return undefined;
}

/**
 * Whether a request failed because the user lacks the permission (403).
 *
 * AE-28: lists must ask this before drawing an empty state. "Nenhuma conta
 * financeira cadastrada" on top of a 403 tells the user their data vanished;
 * only a request that *succeeded* with zero rows is really empty.
 *
 * 401 is deliberately not a permission error — that is an expired session and
 * the interceptor already handles it.
 */
export function isPermissionError(error: unknown): boolean {
  return getApiErrorStatus(error) === 403;
}

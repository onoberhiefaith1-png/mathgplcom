/**
 * One place for timeout + bounded retry + friendly error text.
 *
 * Every teacher-facing async operation should go through `resilient()` so it
 * can only ever end in success, a friendly failure, or a cancellation —
 * never an endless spinner and never a raw technical error.
 */
import { RequestTimeoutError, withTimeout } from "@/lib/async/withTimeout";

export type ResilientOptions = {
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Total attempts, including the first. */
  attempts?: number;
  /** Base backoff; grows exponentially with jitter. */
  backoffMs?: number;
  /** Message shown if every attempt fails. */
  message?: string;
  signal?: AbortSignal;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const candidate = error as { status?: unknown; statusCode?: unknown };
    const value = candidate.status ?? candidate.statusCode;
    if (typeof value === "number") return value;
  }
  return undefined;
}

/** Retrying a 4xx (except 408/429) just wastes the user's time. */
function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === undefined) return true; // network / timeout
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

function retryAfterMs(error: unknown): number | undefined {
  const headers = (error as { headers?: Headers } | null)?.headers;
  const raw = headers?.get?.("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1_000 : undefined;
}

export async function resilient<T>(
  work: (attempt: number) => PromiseLike<T>,
  options: ResilientOptions = {},
): Promise<T> {
  const { timeoutMs = 20_000, attempts = 3, backoffMs = 600, message, signal } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await withTimeout(work(attempt), timeoutMs, message);
    } catch (error) {
      lastError = error;
      if ((error as { name?: string })?.name === "AbortError") throw error;
      if (attempt === attempts || !isRetryable(error)) break;
      const wait = retryAfterMs(error) ?? backoffMs * 2 ** (attempt - 1) * (0.7 + Math.random() * 0.6);
      await sleep(wait);
    }
  }
  throw lastError;
}

/** Human wording for an HTTP status. Technical detail stays in the logs. */
export function friendlyMessage(error: unknown, fallback = "Something didn't work. Your work is safe — please try again."): string {
  if (error instanceof RequestTimeoutError) {
    return "That took longer than expected. Your work is safe — please try again.";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Your changes are stored on this device and will sync when the connection returns.";
  }
  switch (statusOf(error)) {
    case 400:
      return "That request couldn't be understood. Please check the details and try again.";
    case 401:
      return "Your session has expired. Please sign in again — your work is kept.";
    case 403:
      return "You don't have access to that. Ask the account owner if you think this is wrong.";
    case 404:
      return "We couldn't find that MathGPL page or item.";
    case 408:
      return "The request timed out. Please try again.";
    case 409:
      return "This was changed somewhere else. Reload to see the latest version.";
    case 429:
      return "MathGPL is busy right now. Please wait a moment and try again.";
    case 500:
    case 502:
      return "Something went wrong on our side. Your saved work is safe — please try again.";
    case 503:
      return "MathGPL is temporarily busy. Your saved work is safe. Please try again shortly.";
    case 504:
      return "The request took too long to come back. Please try again.";
    default:
      return fallback;
  }
}

/**
 * Prevents duplicate operations: a second call with the same key while the
 * first is still running returns the first promise instead of starting again.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = work().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export function isOperationRunning(key: string): boolean {
  return inFlight.has(key);
}

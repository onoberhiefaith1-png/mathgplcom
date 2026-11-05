/**
 * Reads the real failure out of a `supabase.functions.invoke` error.
 *
 * supabase-js reports every non-2xx edge-function reply as a generic
 * "Edge Function returned a non-2xx status code" and keeps the JSON body on
 * `error.context` (a `Response`). The server-side credit gate answers 402 with
 * `{ error, reason, available }`, so without reading that body an account that
 * is not on an AI plan only ever sees a vague failure.
 */

export type FunctionErrorInfo = {
  /** HTTP status when the error carried a Response, otherwise null. */
  status: number | null;
  /** Machine reason from the credit gate (`no_ai_plan`, `insufficient`, ...). */
  reason: string | null;
  /** Server-supplied message when there was one. */
  serverMessage: string | null;
  /** Credits left, when the gate reported it. */
  available: number | null;
};

const GENERIC_NON_2XX = /non-2xx status code/i;
const PLAN_REASONS = new Set([
  "no_ai_plan",
  "insufficient",
  "floor",
  "past_due",
  "expired",
  "disabled",
]);

/** Parse the JSON body of an invoke error. Never throws. */
export async function readFunctionError(
  error: unknown,
): Promise<FunctionErrorInfo> {
  const info: FunctionErrorInfo = {
    status: null,
    reason: null,
    serverMessage: null,
    available: null,
  };
  const ctx = (error as { context?: unknown } | null)?.context as
    | {
        status?: unknown;
        clone?: () => { json: () => Promise<unknown> };
        json?: () => Promise<unknown>;
      }
    | undefined;
  if (!ctx || typeof ctx !== "object") return info;
  if (typeof ctx.status === "number") info.status = ctx.status;
  try {
    const source = typeof ctx.clone === "function" ? ctx.clone() : ctx;
    if (typeof source.json !== "function") return info;
    const body = (await source.json()) as Record<string, unknown> | null;
    if (body && typeof body === "object") {
      if (typeof body.error === "string" && body.error.trim())
        info.serverMessage = body.error.trim();
      if (typeof body.reason === "string" && body.reason.trim())
        info.reason = body.reason.trim();
      if (typeof body.available === "number" && Number.isFinite(body.available))
        info.available = body.available;
    }
  } catch {
    /* body was not JSON: keep what we have */
  }
  return info;
}

export type FunctionErrorToast = {
  title: string;
  description: string;
  /** True when the user can fix this by upgrading or topping up. */
  needsPlan: boolean;
};

/**
 * Turn an invoke error (plus what was read from it) into the toast to show.
 * 402 is the credit gate: out of credits, no AI plan, past due, expired.
 */
export function describeFunctionError(
  error: unknown,
  info: FunctionErrorInfo,
  fallbackTitle = "Could not generate",
): FunctionErrorToast {
  const raw = String(
    (error as { message?: unknown } | null)?.message ?? error ?? "",
  );
  const timeout = /took too long/i.test(raw);

  if (info.status === 402 || (info.reason && PLAN_REASONS.has(info.reason))) {
    if (info.reason === "no_ai_plan") {
      return {
        title: "AI plan or credits required",
        description:
          info.serverMessage ??
          "AI generation is part of a paid plan. Upgrade your plan to generate.",
        needsPlan: true,
      };
    }
    if (
      info.reason === "past_due" ||
      info.reason === "expired" ||
      info.reason === "disabled"
    ) {
      return {
        title: "AI plan or credits required",
        description:
          info.serverMessage ??
          "Your plan needs attention before you can generate.",
        needsPlan: true,
      };
    }
    return {
      title: "Out of AI credits",
      description:
        info.serverMessage ??
        "Top up your balance in Plans & credits to keep generating.",
      needsPlan: true,
    };
  }

  if (info.serverMessage) {
    return {
      title: fallbackTitle,
      description: info.serverMessage,
      needsPlan: false,
    };
  }
  if (timeout)
    return { title: fallbackTitle, description: raw, needsPlan: false };
  if (GENERIC_NON_2XX.test(raw) && info.status) {
    return {
      title: fallbackTitle,
      description: `The server replied with an error (${info.status}). Please try again.`,
      needsPlan: false,
    };
  }
  return {
    title: fallbackTitle,
    description: raw || "Something went wrong. Please try again.",
    needsPlan: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// "Edge Function" failures (teachers hear/report these as an "H function
// error"). supabase-js throws three classes, all with opaque messages:
//   FunctionsHttpError  — "Edge Function returned a non-2xx status code"
//   FunctionsRelayError — "Relay Error invoking the Edge Function"
//   FunctionsFetchError — "Failed to send a request to the Edge Function"
// They appear INTERMITTENTLY because they depend on how long one request
// runs (platform wall-clock / worker limits, dropped connections), not on the
// content itself — the same copy/rewrite can pass once and fail the next time.
// ─────────────────────────────────────────────────────────────────────────

const EDGE_FUNCTION_NOISE = /edge function|non-2xx status code|relay error/i;

/** True when the failure is a transient platform/network hiccup worth one silent retry. */
export function isTransientFunctionError(error: unknown, info?: FunctionErrorInfo): boolean {
  const name = String((error as { name?: unknown } | null)?.name ?? "");
  if (name === "AbortError") return false;
  if (name === "FunctionsFetchError" || name === "FunctionsRelayError") return true;
  const status = info?.status ?? null;
  // 5xx (incl. Supabase's 546 worker limit) are transient; 4xx are answers.
  if (status != null) return status >= 500;
  const raw = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return /failed to send a request|relay error|failed to fetch|network/i.test(raw);
}

/**
 * Read an invoke error into ONE teacher-readable sentence. Never returns the
 * opaque "Edge Function returned a non-2xx status code" text, and never frames
 * a long solution as the problem.
 */
export async function friendlyFunctionErrorMessage(error: unknown): Promise<string> {
  const info = await readFunctionError(error);
  const raw = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  let detail: string | null = null;
  try {
    const ctx = (error as { context?: { clone?: () => Response } } | null)?.context;
    if (ctx && typeof ctx.clone === "function") {
      const body = (await ctx.clone().json()) as Record<string, unknown> | null;
      if (body && typeof body.detail === "string" && body.detail.trim()) detail = body.detail.trim();
    }
  } catch { /* not JSON */ }
  if (detail) return detail;
  // Server text, or a machine code (e.g. question_lock_mismatch) callers match on.
  if (info.serverMessage) return info.serverMessage;
  if (info.status === 402) return "The AI service needs credits before it can continue.";
  if (info.status === 429) return "The AI is busy right now. Please wait a moment and try again.";
  if (isTransientFunctionError(error, info) || EDGE_FUNCTION_NOISE.test(raw)) {
    return "The connection to the AI server dropped before it finished. Nothing was changed — please try again.";
  }
  return raw || "Something went wrong. Please try again.";
}

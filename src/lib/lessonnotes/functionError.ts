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

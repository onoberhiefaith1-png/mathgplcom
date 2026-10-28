/**
 * Which requests the credit gate applies to.
 *
 * Pure and dependency-free so it can be unit-tested outside Deno.
 *
 * The gate exists to stop work that costs AI credits. A request that cannot
 * reach an AI model must not need an AI plan or credits: a free teacher can
 * still arrange the floating numbers they highlighted. Only modes verified to
 * make no model call are listed here; anything unknown stays gated.
 */

/**
 * `notebook-ai` modes that never call the AI gateway (verified in
 * supabase/functions/notebook-ai/index.ts: the handlers run only
 * `deterministicExtractLine`, `hardStripMath`, the verifiers and best-effort
 * database logging).
 */
const DETERMINISTIC_MODES: Record<string, ReadonlySet<string>> = {
  "notebook-ai": new Set(["floating_highlights", "floating"]),
};

/** Mode string in a parsed JSON request body, or null. */
export function modeOf(body: unknown): string | null {
  const mode = (body as { mode?: unknown } | null)?.mode;
  return typeof mode === "string" ? mode : null;
}

/**
 * `floating_line_edit` calls the model only when the teacher typed an
 * instruction (MAX_ATTEMPTS = instruction ? 3 : 0); a plain re-extract is
 * deterministic.
 */
function isPlainLineEdit(body: unknown): boolean {
  const b = body as { mode?: unknown; instruction?: unknown } | null;
  return (
    b?.mode === "floating_line_edit" &&
    String(b.instruction ?? "").trim() === ""
  );
}

/** True when this request must pass the credit gate (the default). */
export function requiresCreditGate(feature: string, body: unknown): boolean {
  const mode = modeOf(body);
  if (mode === null) return true; // unparseable or mode-less: stay gated
  if (DETERMINISTIC_MODES[feature]?.has(mode)) return false;
  if (feature === "notebook-ai" && isPlainLineEdit(body)) return false;
  return true;
}

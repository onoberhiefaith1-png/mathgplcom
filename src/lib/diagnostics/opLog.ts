// Development-only diagnostic logging for the operations most likely to hang
// (floating-number generate/save, test-board open, question/solution load,
// marking, evaluation, archive). Teachers never see this — it is console only,
// and it is silent in production builds.

const enabled = (() => {
  try {
    return typeof import.meta !== "undefined" && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
  } catch {
    return false;
  }
})();

export type OpOutcome = "ok" | "fail" | "timeout" | "cancelled";

export interface OpFields {
  subsectionId?: string;
  questionId?: string;
  solutionId?: string;
  floatingNumberId?: string;
  assessmentId?: string;
  [key: string]: unknown;
}

/**
 * Start timing one operation. The returned function closes it out.
 *
 *   const end = diag.start("floating.generate", { subsectionId });
 *   ... end("ok", { lines: 4 })  /  end("fail", { error })
 */
const start = (operation: string, fields: OpFields = {}) => {
  const startedAt = Date.now();
  if (enabled) console.debug(`[op] ${operation} start`, { ...fields, startedAt });
  return (outcome: OpOutcome, extra: OpFields = {}) => {
    if (!enabled) return;
    const endedAt = Date.now();
    const log = outcome === "ok" ? console.debug : console.warn;
    log(`[op] ${operation} ${outcome}`, {
      ...fields,
      ...extra,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
    });
  };
};

export const diag = { start, enabled };

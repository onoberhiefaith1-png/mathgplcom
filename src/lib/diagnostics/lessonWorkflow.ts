import { APP_BUILD_ID } from "@/lib/appUpdate";

type Operation = "floating.open" | "floating.load" | "assign.options" | "assign.submit" | "academia.catalog" | "academia.sessions" | "academia.submit" | "mcq.convert";
type Context = "personal" | "school" | "editor";
type Method = "local" | "ai";

const knownCodes = new Set([
  "42501", "23503", "23505", "23514", "40001", "57014",
  "PGRST116", "PGRST202", "PGRST301", "PGRST303", "permission_denied",
  "insufficient_quota", "over_request_rate_limit", "not_authenticated", "session_expired", "selection_blocked",
]);

export function lessonWorkflowCause(error: unknown): string {
  if (!error || typeof error !== "object") return "unclassified";
  if ("code" in error && typeof error.code === "string" && knownCodes.has(error.code)) return error.code;
  if ("status" in error && typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599) {
    return `http-${error.status}`;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return "cancelled";
    if (error.name === "LessonActionTimeout") return "timeout";
    if (error.name === "LessonActionOffline") return "offline";
    if (error instanceof TypeError) return "transport-or-client";
  }
  return "unclassified";
}

/** Browser logs use fixed fields only. Never log user IDs, note content, raw
 * errors, URL, request bodies or headers. Staff can share the single line. */
export function startLessonWorkflow(operation: Operation, context: Context = "editor") {
  const started = performance.now();
  return (result?: { error?: unknown; method?: Method }) => {
    if (typeof window === "undefined") return;
    const cause = result && "error" in result ? lessonWorkflowCause(result.error) : undefined;
    const log = cause ? console.warn : console.info;
    log("[lesson-workflow]", {
      operation, context, build: APP_BUILD_ID, durationMs: Math.round(performance.now() - started),
      outcome: cause ? "failed" : "ok", ...(cause && { cause }), ...(result?.method && { method: result.method }),
    });
  };
}

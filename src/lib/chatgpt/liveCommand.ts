// Pure rules for the ChatGPT live link, kept apart from the React listener so
// they are testable.

export const COMMAND_MAX_AGE_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** In-app path for an `open` command; never leaves the site. */
export function pathForOpen(target: unknown, notebookId?: unknown): string {
  const id = typeof notebookId === "string" && UUID.test(notebookId) ? notebookId : null;
  switch (target) {
    case "lesson_notes": return "/lesson-notes";
    case "note": return id ? `/lesson-notes/${id}` : "/lesson-notes";
    case "smartboard": return id ? `/smartboard/${id}` : "/smartboard";
    case "game": return "/game";
    case "academia": return "/academia";
    default: return "/";
  }
}

/** Commands older than a minute are discarded, not performed. */
export function isFreshCommand(createdAt: string, now = Date.now()): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && now - t <= COMMAND_MAX_AGE_MS;
}

/** Smartboard step count, clamped to 1..20. */
export function smartboardSteps(times: unknown): number {
  const n = Math.floor(Number(times));
  return Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 1;
}

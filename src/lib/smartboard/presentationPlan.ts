// Smartboard Presentation Plan — local, teacher-scoped Present/Skip flags
// for each renderable unit in a lesson. Persisted in localStorage so both
// the Preview page and the live PresentationView read the same skip set,
// giving a 1:1 relationship between what the teacher approved in Preview
// and what the classroom smartboard actually presents.

const KEY = (notebookId: string) => `smartboard:presentationPlan:${notebookId}`;
const APPROVED_KEY = (notebookId: string) => `smartboard:presentationApproved:${notebookId}`;

export interface PresentationPlan {
  /** Beat ids the teacher chose to SKIP for this notebook's next presentation. */
  skipped: string[];
}

export const loadPlan = (notebookId: string | null | undefined): PresentationPlan => {
  if (!notebookId || typeof window === "undefined") return { skipped: [] };
  try {
    const raw = window.localStorage.getItem(KEY(notebookId));
    if (!raw) return { skipped: [] };
    const parsed = JSON.parse(raw);
    const skipped = Array.isArray(parsed?.skipped)
      ? parsed.skipped.filter((s: unknown): s is string => typeof s === "string")
      : [];
    return { skipped };
  } catch {
    return { skipped: [] };
  }
};

export const savePlan = (notebookId: string, plan: PresentationPlan) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(notebookId), JSON.stringify(plan));
  } catch { /* noop */ }
};

export const toggleSkipped = (notebookId: string, beatId: string): PresentationPlan => {
  const cur = loadPlan(notebookId);
  const set = new Set(cur.skipped);
  if (set.has(beatId)) set.delete(beatId); else set.add(beatId);
  const next = { skipped: Array.from(set) };
  savePlan(notebookId, next);
  return next;
};

export const clearSkipped = (notebookId: string): PresentationPlan => {
  const next = { skipped: [] };
  savePlan(notebookId, next);
  return next;
};

export const isSkipped = (plan: PresentationPlan, beatId: string): boolean =>
  plan.skipped.includes(beatId);

/** Approval snapshot — records that the teacher rehearsed and confirmed the
 *  current plan. Purely informational for now (used to badge the shelf card).
 *  The 1:1 guarantee comes from Preview and Live both reading the same
 *  section data + skip flags, not from a serialised beat snapshot. */
export const markApproved = (notebookId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPROVED_KEY(notebookId), new Date().toISOString());
  } catch { /* noop */ }
};

export const loadApprovedAt = (notebookId: string | null | undefined): string | null => {
  if (!notebookId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(APPROVED_KEY(notebookId));
  } catch {
    return null;
  }
};

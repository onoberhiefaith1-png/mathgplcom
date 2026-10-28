/**
 * Local draft mirror for lesson notes.
 *
 * A teacher can spend hours on one lesson. Every save also writes the document
 * to this device, so a failed save, an expired session, a dropped connection or
 * a reload can never silently destroy that work.
 */

const PREFIX = "mathgpl.draft.";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;

export type LocalDraft = {
  notebookId: string;
  doc: unknown;
  savedAt: number;
  /** False once the server has confirmed the same content. */
  pending: boolean;
};

const key = (notebookId: string) => `${PREFIX}${notebookId}`;

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function writeLocalDraft(notebookId: string, doc: unknown, pending: boolean): void {
  if (!available()) return;
  try {
    const payload: LocalDraft = { notebookId, doc, savedAt: Date.now(), pending };
    window.localStorage.setItem(key(notebookId), JSON.stringify(payload));
  } catch {
    // Quota or private mode — the in-memory document is still intact.
  }
}

export function markLocalDraftSynced(notebookId: string): void {
  if (!available()) return;
  try {
    const existing = readLocalDraft(notebookId);
    if (!existing) return;
    window.localStorage.setItem(
      key(notebookId),
      JSON.stringify({ ...existing, pending: false } satisfies LocalDraft),
    );
  } catch {
    /* ignore */
  }
}

export function readLocalDraft(notebookId: string): LocalDraft | null {
  if (!available()) return null;
  try {
    const raw = window.localStorage.getItem(key(notebookId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key(notebookId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** A draft that never reached the server — offer it back to the teacher. */
export function readPendingLocalDraft(notebookId: string): LocalDraft | null {
  const draft = readLocalDraft(notebookId);
  return draft?.pending ? draft : null;
}

export function clearLocalDraft(notebookId: string): void {
  if (!available()) return;
  try {
    window.localStorage.removeItem(key(notebookId));
  } catch {
    /* ignore */
  }
}

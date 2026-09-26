// SmartBoard identity.
//
// A student SmartBoard is NEVER a global writing surface. It belongs to one
// exact combination of:
//
//   student × class × workspace (assignment | adventure) × assessment × question
//
// Only when all of those match is previous work restored. If any single part
// changes — a different question, the same question in another class, the same
// question reached through Adventure instead of Assignment — the board must
// start completely empty.
//
// This module produces the one string every per-board cache key is built from,
// so no storage bucket can be coarser than the board identity itself.

export type BoardWorkspace = "assignment" | "adventure" | "notebook" | "floating_test" | "game";

export type BoardScopeInput = {
  studentId?: string | null;
  classId?: string | null;
  workspace?: BoardWorkspace | null;
  /** Adventure game the question was opened from (adventures are independent). */
  gameId?: string | null;
  assessmentId?: string | null;
  questionId?: string | null;
  /** Teacher / non-assessment fallback so the lesson SmartBoard is unchanged. */
  notebookId?: string | null;
};

const part = (v: string | null | undefined) => (v && String(v).trim()) || "_";

/**
 * Stable identity for one SmartBoard.
 *
 * Assessment mode (student assignment / adventure board) →
 *   `board:<student>:<class>:<workspace>:<game>:<assessment>:<question>`
 * Everything else (teacher lesson SmartBoard) keeps the historical
 *   `notebook:<id>` shape so existing boards keep their saved layout.
 */
export const buildBoardScope = (input: BoardScopeInput): string => {
  const { assessmentId, notebookId } = input;
  if (!assessmentId) return `notebook:${part(notebookId)}`;
  return [
    "board",
    part(input.studentId),
    part(input.classId),
    part(input.workspace ?? "assignment"),
    part(input.gameId),
    part(assessmentId),
    part(input.questionId),
  ].join(":");
};

/** Namespaced localStorage key for one board-content bucket. */
export const boardKey = (bucket: string, scope: string): string =>
  `smartboard:${bucket}:${scope}`;

/**
 * Drop every cached bucket belonging to ONE board scope.
 *
 * Only temporary board content is removed — lesson notes, questions,
 * solutions, floating-number configurations and diagrams live in the database
 * and are never touched here.
 */
export const clearBoardScope = (scope: string): void => {
  if (typeof window === "undefined") return;
  try {
    const suffix = `:${scope}`;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("smartboard:") && key.endsWith(suffix)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* private mode / quota — a fresh board is still rendered */
  }
};

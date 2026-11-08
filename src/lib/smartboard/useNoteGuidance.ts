// AUTO NOTE GUIDANCE controller — shared by every PresentationView mode
// (Smartboard main + classroom, Practice/Play assessment boards, Game).
//
// Rule (unchanged from the board's original `activateNoteOnce`): the note
// authored for a Lesson Line is shown once per attempt, at the moment the
// solver moves FORWARD off that line. Callers report forward moves
// explicitly (`leaveLine`) — never inferred from render state — from every
// path that advances a line: Next / counter / Game Next, the automatic
// advance after a correct Check, the Game runtime moving to its next line,
// a tap on a later line.
//
// It also owns the attempt: `resetAttempt` (Try again / Reset) and a new
// question clear what was shown, so notes come back on the next attempt.
// A note whose text arrives after its line was already left (late metadata)
// is shown then — only for lines already left, never for future lines.
import { useCallback, useEffect, useRef, useState } from "react";

export interface NoteGuidanceOptions {
  /** Identity of the current question/attempt scope (e.g. reservoir/beat id). */
  questionKey: string;
  /** Authored note for a line ("" when none). Read at call time. */
  noteFor: (lineIdx: number) => string;
  /** Number of guided lines. Read at call time. */
  lineCount: () => number;
  /** False for read-only viewers / mirrored boards: they never write. */
  canWrite: boolean;
  /** Places the note on the board (existing writer). */
  write: (lineIdx: number, note: string) => void;
}

export function notesDueOnLineChange(c: {
  from: number | null; to: number; lineCount: number;
  noteFor: (k: number) => string; shown: ReadonlySet<number>; userDriven: boolean;
}): number[] {
  if (!c.userDriven || c.from === null || !(c.to > c.from)) return [];
  const k = c.from;
  if (k < 0 || k >= c.lineCount || c.shown.has(k)) return [];
  return c.noteFor(k).trim() ? [k] : [];
}

export function useNoteGuidance(o: NoteGuidanceOptions) {
  const [shown, setShown] = useState<Set<number>>(() => new Set());
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const left = useRef<Set<number>>(new Set());
  const opts = useRef(o);
  opts.current = o;

  const show = useCallback((k: number) => {
    const { noteFor, write } = opts.current;
    const note = noteFor(k).trim();
    if (!note || shownRef.current.has(k)) return false;
    shownRef.current = new Set(shownRef.current).add(k);
    write(k, note);
    setShown((cur) => (cur.has(k) ? cur : new Set(cur).add(k)));
    return true;
  }, []);

  /** Report a forward move off `from` (to `to`). Idempotent. */
  const leaveLine = useCallback((from: number, to: number) => {
    const { canWrite, noteFor } = opts.current;
    const lineCount = opts.current.lineCount();
    if (!canWrite || !(to > from) || from < 0 || from >= lineCount) return;
    left.current.add(from);
    for (const k of notesDueOnLineChange({ from, to, lineCount, noteFor, shown: shownRef.current, userDriven: true })) show(k);
  }, [show]);

  /** Mark a note shown without writing (manual open already placed it). */
  const markShown = useCallback((k: number) => {
    if (shownRef.current.has(k)) return;
    shownRef.current = new Set(shownRef.current).add(k);
    setShown((cur) => (cur.has(k) ? cur : new Set(cur).add(k)));
  }, []);

  const resetAttempt = useCallback(() => {
    left.current = new Set();
    shownRef.current = new Set();
    setShown(new Set());
  }, []);

  // New question → fresh attempt.
  const keyRef = useRef(o.questionKey);
  useEffect(() => {
    if (keyRef.current === o.questionKey) return;
    keyRef.current = o.questionKey;
    resetAttempt();
  }, [o.questionKey, resetAttempt]);

  /** Call when the question's lines/notes may have changed (late
   *  metadata): shows notes for lines already left that were not shown. */
  const reconcileLate = useCallback(() => {
    if (!opts.current.canWrite) return;
    const n = opts.current.lineCount();
    for (const k of left.current) if (k < n && !shownRef.current.has(k)) show(k);
  }, [show]);

  /** Drop-in for the board's old `setShownNotebookIdx`, kept in sync
   *  synchronously so a following leaveLine sees it. */
  const setShownSync = useCallback((u: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    const next = typeof u === "function" ? u(shownRef.current) : u;
    shownRef.current = next;
    setShown(next);
  }, []);

  return { shown, setShown: setShownSync, leaveLine, markShown, resetAttempt, reconcileLate };
}

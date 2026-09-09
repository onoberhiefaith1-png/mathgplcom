export type QuestionMarkerState = {
  permanent: boolean;
  attempt: boolean;
};

/** Three stable phone positions, centred on the active question where possible. */
export const getQuestionWindow = (
  count: number,
  activeIndex: number,
): Array<number | null> => {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return [null, null, null];
  const active = Math.max(0, Math.min(Math.floor(activeIndex), safeCount - 1));
  const start = safeCount <= 3 ? 0 : Math.max(0, Math.min(active - 1, safeCount - 3));
  return Array.from({ length: 3 }, (_, slot) => {
    const index = start + slot;
    return index < safeCount ? index : null;
  });
};

/** Reset affects only the temporary (brown) timed-attempt layer. */
export const resetAttemptMarkers = (
  states: Record<string, QuestionMarkerState>,
): Record<string, QuestionMarkerState> =>
  Object.fromEntries(
    Object.entries(states).map(([key, state]) => [key, { ...state, attempt: false }]),
  );

export const fasterTime = (current: number | null, candidate: number): number =>
  current == null ? candidate : Math.min(current, candidate);

/**
 * NO FLOATING NUMBER = NO MARK STATE.
 *
 * A note-only line (prose, explanation, an empty row) carries nothing to
 * solve, so it must stay neutral: never blue, never brown. Only a line with
 * real floating-number content can hold a mark state.
 */
export const lineCarriesMarkState = (line: {
  notebookOnly?: boolean;
  equation?: string;
  fragments?: string[];
  fragmentStart?: number;
  fragmentEnd?: number;
  table?: unknown;
} | null | undefined): boolean => {
  if (!line) return false;
  if (line.notebookOnly) return false;
  if (line.table) return true;
  const span =
    typeof line.fragmentStart === "number" && typeof line.fragmentEnd === "number"
      ? line.fragmentEnd - line.fragmentStart
      : (line.fragments?.length ?? 0);
  if (span > 0) return true;
  return !!(line.equation ?? "").trim();
};

/**
 * PHONE / TABLET QUESTION TABS — the only three states a 1 / 2 / 3 tab can
 * carry. Score is information, never a colour input:
 *   neutral — nothing to solve here, or nothing done yet
 *   blue    — the mark is permanently earned
 *   brown   — this line/question is inside the live timed attempt right now
 */
export type QuestionTabState = "neutral" | "blue" | "brown";

export const questionTabState = (input: {
  /** The tab addresses something solvable (a floating number / marks). */
  carries: boolean;
  /** A mark is permanently recorded here. */
  marked: boolean;
  /** Confirmed inside the attempt that is being timed right now. */
  confirmedNow: boolean;
  /** A timed attempt is running on this board. */
  timerActive: boolean;
}): QuestionTabState => {
  if (!input.carries) return "neutral";
  if (input.timerActive && input.confirmedNow) return "brown";
  if (input.marked) return "blue";
  return "neutral";
};

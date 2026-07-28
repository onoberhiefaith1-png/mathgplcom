// One active line, one editing session.
//
// The Smartboard has exactly ONE active line at any moment. Everything the
// student creates between the moment they ENTER a line (Start Point) and the
// moment they LEAVE it (End Point) belongs to that line — no matter whether it
// came from the Floating Number Display, the Presenter Preview, the keyboard,
// a symbol palette, or an AI insertion.
//
// At the End Point the expression is FROZEN. Anything written afterwards
// belongs to the next session and can never change the already-recorded
// result — exactly like a teacher marking exercise books.

export type LineSource =
  | "floating"
  | "preview"
  | "board"
  | "grader"
  | "restore"
  | "remote";

export interface SessionEntry {
  /** Where the content came from — informational only. */
  source: LineSource | "keyboard" | "chip" | "ai" | "symbol";
  at: number;
}

export interface EditingSession {
  lineIdx: number;
  lineId: string | null;
  startedAt: number;
  entries: SessionEntry[];
  /** Set at the End Point. Once frozen the session is immutable. */
  frozenAscii?: string;
  endedAt?: number;
}

export const startSession = (lineIdx: number, lineId: string | null): EditingSession => ({
  lineIdx,
  lineId,
  startedAt: Date.now(),
  entries: [],
});

export const recordEntry = (
  session: EditingSession | null,
  source: SessionEntry["source"],
): EditingSession | null => {
  if (!session || session.frozenAscii !== undefined) return session;
  session.entries.push({ source, at: Date.now() });
  return session;
};

/** End Point — freeze what the student produced during this session. */
export const freezeSession = (
  session: EditingSession | null,
  ascii: string,
): EditingSession | null => {
  if (!session) return null;
  if (session.frozenAscii !== undefined) return session; // already frozen
  session.frozenAscii = ascii;
  session.endedAt = Date.now();
  return session;
};

export const isFrozen = (session: EditingSession | null): boolean =>
  !!session && session.frozenAscii !== undefined;

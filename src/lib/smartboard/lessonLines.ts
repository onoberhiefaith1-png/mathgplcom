// Lesson-aware line model for the Smartboard.
//
// Definitional layer that sits on top of the physical row grid in
// `grid.ts`. A **physical row** is one slot on the writing baseline; a
// **Lesson Line** is one complete teaching step (sentence, equation,
// fraction, matrix, …) and may span 1..N physical rows.
//
// The cursor, floating-number strip and notebook attach to Lesson Lines
// — never to individual physical rows. Locked lines (question / heading
// / prose introductions / explanations) reject pointer and arrow caret
// placement.

export type LessonLineKind =
  | "writable"          // teacher may type here (inside a Solution working area)
  | "prose-locked"      // explanation / introduction / notebook narration
  | "heading-locked"    // section / beat caption ("Solution", "Example 2", …)
  | "question-locked";  // the problem statement itself

export interface LessonLine {
  /** Stable id (`${beatId}:${index}`). Survives row reflow. */
  id: string;
  /** Beat this line belongs to. */
  beatId: string;
  kind: LessonLineKind;
  /** Index of the line inside its beat (0-based). */
  indexInBeat: number;
  /** First physical row this line occupies. */
  topRow: number;
  /** rowSpan: how many physical rows the line currently occupies. */
  rowSpan: number;
  /** Optional id of the floating-number group bound to this line. */
  floatingGroupId?: string;
}

export interface WorkingArea {
  beatId: string;
  /** First writable physical row inside the beat. */
  topRow: number;
  /** Last writable physical row inside the beat. */
  bottomRow: number;
}

export interface LessonLineMap {
  lines: LessonLine[];
  workingAreas: WorkingArea[];
}

const inLine = (l: LessonLine, row: number) =>
  row >= l.topRow && row < l.topRow + Math.max(1, l.rowSpan);

/** Resolve which Lesson Line contains a given physical row, if any. */
export const lineAt = (map: LessonLineMap, row: number): LessonLine | null => {
  for (const l of map.lines) if (inLine(l, row)) return l;
  return null;
};

/** Working area for a beat. */
export const workingAreaFor = (
  map: LessonLineMap,
  beatId: string,
): WorkingArea | null =>
  map.workingAreas.find((w) => w.beatId === beatId) ?? null;

/** All writable lines belonging to a beat, in order. */
export const writableLinesFor = (
  map: LessonLineMap,
  beatId: string,
): LessonLine[] =>
  map.lines.filter((l) => l.beatId === beatId && l.kind === "writable");

/** Next/previous writable Lesson Line (within the same beat). */
export const nextWritable = (
  map: LessonLineMap,
  current: LessonLine,
): LessonLine | null => {
  const beat = writableLinesFor(map, current.beatId);
  const i = beat.findIndex((l) => l.id === current.id);
  return i >= 0 && i + 1 < beat.length ? beat[i + 1] : null;
};

export const prevWritable = (
  map: LessonLineMap,
  current: LessonLine,
): LessonLine | null => {
  const beat = writableLinesFor(map, current.beatId);
  const i = beat.findIndex((l) => l.id === current.id);
  return i > 0 ? beat[i - 1] : null;
};

/** First writable Lesson Line inside a beat, or null if the beat is
 *  pure presentation (no working area). */
export const firstWritable = (
  map: LessonLineMap,
  beatId: string,
): LessonLine | null => writableLinesFor(map, beatId)[0] ?? null;

/** Is a click on this row allowed to move the sensor? Locked lines and
 *  rows that fall outside every working area both reject the click. */
export const isClickAllowed = (
  map: LessonLineMap,
  row: number,
  activeBeatId: string | null,
): boolean => {
  const l = lineAt(map, row);
  if (!l) return false;
  if (l.kind !== "writable") return false;
  if (activeBeatId && l.beatId !== activeBeatId) return false;
  return true;
};

/** Lightweight builder used by tests / future PresentationView wiring.
 *  Real presentation builds the map from beat layouts (see
 *  `PresentationView.tsx`). */
export const buildLessonLineMap = (
  beats: { id: string; lines: Omit<LessonLine, "beatId" | "id" | "indexInBeat">[] }[],
): LessonLineMap => {
  const lines: LessonLine[] = [];
  const workingAreas: WorkingArea[] = [];
  for (const b of beats) {
    let topW: number | null = null;
    let botW: number | null = null;
    b.lines.forEach((l, i) => {
      const line: LessonLine = {
        id: `${b.id}:${i}`,
        beatId: b.id,
        indexInBeat: i,
        kind: l.kind,
        topRow: l.topRow,
        rowSpan: Math.max(1, l.rowSpan),
        floatingGroupId: l.floatingGroupId,
      };
      lines.push(line);
      if (line.kind === "writable") {
        if (topW === null) topW = line.topRow;
        botW = line.topRow + line.rowSpan - 1;
      }
    });
    if (topW !== null && botW !== null) {
      workingAreas.push({ beatId: b.id, topRow: topW, bottomRow: botW });
    }
  }
  return { lines, workingAreas };
};

// Floating Number Preparation — pure helpers.
// Used by FloatingNumbersPage to (a) shuffle a row of fillers in a controlled,
// repeatable pattern, and (b) compile every per-line workspace into the one
// Master Floating Bucket the Smartboard will later scroll through.

export type ContainerKind =
  | "fraction"
  | "bracket"
  | "radical"
  | "power"
  | "log"
  | "integral"
  | "matrix"
  | "differential"
  | "abs"
  | "vector";

export interface FloatingLine {
  lineId: string;
  equation: string;
  /** Floating Terms in ASCII form with their operation signs preserved
   *  (e.g. "+2x²", "-4ac", "=", "±"). Leading "+" is dropped only at render. */
  fillers: string[];
  containers: ContainerKind[];
  /** index permutation applied to fillers when feeding the Smartboard */
  arrangement: number[];
  /** Optional teacher-facing explanation (e.g. "Multiply by the conjugate").
   *  Surfaced on the smartboard as a toggleable "+" marker beside the line. */
  explanation?: string;
  /** Persisted teacher highlight state, parallel to fillers. */
  fillersSelected?: boolean[];
  /** Persisted teacher highlight state, parallel to containers. */
  containersSelected?: boolean[];
  /** Marks awarded when a student reproduces this line correctly. */
  marks?: number;
}

export type ScoringMode = "equal" | "individual";

export interface FloatingScoring {
  /** Display label the teacher chose (Marks / Points / Score / Credits / Reward). */
  label: string;
  mode: ScoringMode;
  /** Used in equal mode — applied to every line. */
  marksPerLine: number;
}

export const SCORE_LABELS = ["Marks", "Points", "Score", "Credits", "Reward"] as const;

export const DEFAULT_SCORING: FloatingScoring = {
  label: "Marks",
  mode: "equal",
  marksPerLine: 1,
};

/** Sum the per-line marks into a Total Available. */
export const totalMarks = (lines: FloatingLine[]): number =>
  lines.reduce((sum, l) => sum + (Number(l.marks) || 0), 0);

export interface FloatingBucket {
  fillers: string[];
  containers: ContainerKind[];
  byLine: { lineId: string; fillerStart: number; fillerEnd: number }[];
  /** Combined floating numbers across every line, in original equation order. */
  viewCombined: string[];
  /** Continuous rearrangement of viewCombined using the 2,4,1,3 pattern. */
  viewRearranged: string[];
  /** Highlight state parallel to fillers / viewCombined. */
  selected: boolean[];
  /** Highlight state parallel to viewRearranged. */
  selectedRearranged: boolean[];
  /** Highlight state parallel to containers. */
  containersSelected: boolean[];
}

/** Rearrangement pattern — groups of four follow [2,4,1,3].
 *  Leftover 3 → [2,1,3] · leftover 2 → [2,1] · leftover 1 → unchanged. */
export const rearrangeIndices = (n: number): number[] => {
  const out: number[] = [];
  let i = 0;
  while (i + 4 <= n) {
    out.push(i + 1, i + 3, i + 0, i + 2);
    i += 4;
  }
  const rem = n - i;
  if (rem === 3) out.push(i + 1, i + 0, i + 2);
  else if (rem === 2) out.push(i + 1, i + 0);
  else if (rem === 1) out.push(i);
  return out;
};

export const applyArrangement = <T,>(items: T[], arr: number[]): T[] => {
  if (!arr.length || arr.length !== items.length) return items.slice();
  return arr.map((i) => items[i]);
};

/** Apply the rearrangement pattern directly to any array (used by View). */
export const rearrangeStream = <T,>(items: T[]): T[] =>
  applyArrangement(items, rearrangeIndices(items.length));

const identityArrangement = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Compile all lines into the Master Floating Bucket + View Session. */
export const compileBucket = (lines: FloatingLine[]): FloatingBucket => {
  const fillers: string[] = [];
  const containerSet = new Map<ContainerKind, boolean>();
  const containers: ContainerKind[] = [];
  const byLine: FloatingBucket["byLine"] = [];
  const viewCombined: string[] = [];
  const selectedOrdered: boolean[] = [];
  const selectedCombined: boolean[] = [];

  for (const line of lines) {
    const start = fillers.length;
    const rawFillers = line.fillers ?? [];
    const rawSelected = line.fillersSelected ?? [];
    // Teacher chips are presentation-source-of-truth. Do not run display
    // conversion here: structural chips (\frac, \sqrt, brackets, powers)
    // must reach the Smartboard exactly as the teacher saved them.
    const cleanedWithIdx: { v: string; sel: boolean }[] = rawFillers.map((raw, i) => {
      return { v: String(raw ?? ""), sel: !!rawSelected[i] };
    });
    // Teacher chips are presentation-source-of-truth. Preserve every saved
    // highlighted/edited filler exactly: no sign stripping, no splitting, no
    // reconstruction.
    const cleanFillers = cleanedWithIdx.map((c) => c.v);
    const cleanSelected = cleanedWithIdx.map((c) => c.sel);
      const cleanArrangement = cleanFillers.length === rawFillers.length
      ? (line.arrangement ?? identityArrangement(cleanFillers.length))
      : identityArrangement(cleanFillers.length);
    const ordered = applyArrangement(cleanFillers, cleanArrangement);
    const orderedSel = applyArrangement(cleanSelected, cleanArrangement);
    fillers.push(...ordered);
    selectedOrdered.push(...orderedSel);
    viewCombined.push(...cleanFillers);
    selectedCombined.push(...cleanSelected);
    byLine.push({ lineId: line.lineId, fillerStart: start, fillerEnd: fillers.length });
    const lineContSel = line.containersSelected ?? [];
    for (let i = 0; i < line.containers.length; i++) {
      const c = line.containers[i];
      const sel = !!lineContSel[i];
      if (!containerSet.has(c)) {
        containerSet.set(c, sel);
        containers.push(c);
      } else if (sel) {
        containerSet.set(c, true);
      }
    }
  }
  const viewRearranged = viewCombined.slice();
  const selectedRearranged = selectedCombined.slice();
  const containersSelected = containers.map((c) => !!containerSet.get(c));
  return {
    fillers,
    containers,
    byLine,
    viewCombined,
    viewRearranged,
    selected: selectedOrdered,
    selectedRearranged,
    containersSelected,
  };
};

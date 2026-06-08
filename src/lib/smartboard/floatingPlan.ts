// Build a per-beat floating-math plan from a Beat using the strict Floating-Term
// vs Structural-Symbol extractor. Fragments are PRE-DECOMPOSED and shuffled
// using deterministic rotating patterns so they never appear in straight
// solving order — this forces reflective thinking on the smartboard.

import type { Beat } from "./presentation";
import { extractStructuresFromAscii } from "./floatingExtractor";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

export type ContainerKind =
  | "fraction"
  | "radical"
  | "bracket"
  | "power"
  | "log"
  | "integral"
  | "matrix"
  | "differential"
  | "abs"
  | "vector"
  | "box";


export interface FloatingPlan {
  /** Each entry is the ASCII form of a Floating Term, sign preserved
   *  (e.g. "+2x²", "-4ac", "=", "±"). Already shuffled by a rotating
   *  permutation so fragments do not appear in solving order. */
  fillers: string[];
  containers: ContainerKind[];
  /** Arithmetic operators / digits feed for the shell's TOP layer. */
  operators: string[];
  /** Indexes (into `fillers`) of the fragments most relevant to the next
   *  expected solving step. Used by the shell to drift the visible window
   *  back when the user wanders too far. */
  relevantIndexes: number[];
}

const uniqInOrder = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  return out;
};

const BASELINE_OPS = ["+", "−", "×", "÷", "=", ".", "0","1","2","3","4","5","6","7","8","9"];

const extractOperatorsUsed = (src: string): string[] => {
  if (!src) return [];
  const out: string[] = [];
  const map: Record<string, string> = { "*": "×", "/": "÷", "-": "−" };
  for (const c of src) {
    const m = map[c] ?? c;
    if (BASELINE_OPS.includes(m)) out.push(m);
  }
  return out;
};

/** Rotating permutation patterns. Each pattern is interpreted modulo the
 *  fragment count, so any size of token list gets reshuffled. The pattern
 *  index advances per beat so two consecutive beats never get the same
 *  ordering. */
const SHUFFLE_PATTERNS: number[][] = [
  [2, 0, 4, 1, 3],
  [1, 3, 0, 4, 2],
  [3, 1, 4, 0, 2],
  [4, 2, 0, 3, 1],
  [0, 3, 1, 4, 2],
];

/** Deterministically shuffle `arr` using one of the rotating patterns.
 *  Same `seed` → same shuffle, so reopening a lesson is stable. */
const shuffleByPattern = <T,>(arr: T[], seed: number): T[] => {
  if (arr.length <= 1) return arr.slice();
  const pat = SHUFFLE_PATTERNS[((seed % SHUFFLE_PATTERNS.length) + SHUFFLE_PATTERNS.length) % SHUFFLE_PATTERNS.length];
  // Build a stable permutation by walking the pattern repeatedly.
  const out: T[] = [];
  const placed = new Set<number>();
  let p = 0;
  while (out.length < arr.length) {
    const idx = pat[p % pat.length] % arr.length;
    if (!placed.has(idx)) {
      placed.add(idx);
      out.push(arr[idx]);
    } else {
      // walk forward to the next unplaced index
      for (let k = 1; k <= arr.length; k++) {
        const j = (idx + k) % arr.length;
        if (!placed.has(j)) { placed.add(j); out.push(arr[j]); break; }
      }
    }
    p++;
  }
  return out;
};

/** Cheap string hash → number, used as the shuffle seed for a beat. */
const seedFromString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const planForBeat = (beat: Beat, _allBeats: Beat[]): FloatingPlan => {
  // The Smartboard is a DISPLAY system, not a generator. Use the pre-
  // decomposed Floating Collection from the Lesson Note exactly as it was
  // stored — original extraction order, no shuffle.
  const orderedFillers = uniqInOrder(
    (beat.fragments ?? [])
      .map((f) => toUnicodeMath(String(f ?? "")))
      .filter((f) => f && !isStillDirty(f))
  );

  // Containers and operators are shell affordances (structures the teacher
  // may need), so we can still derive these from the equation text.
  const structures = extractStructuresFromAscii(beat.content);
  const containers = uniqInOrder(structures.map((s) => s.kind)).slice(0, 8) as ContainerKind[];
  const used = uniqInOrder(extractOperatorsUsed(beat.content));
  const operators = uniqInOrder([...used, ...BASELINE_OPS]);

  // Every fragment from the lesson is "relevant" — they were chosen by the
  // teacher when creating the lesson.
  const relevantIndexes = orderedFillers.map((_, i) => i);

  return { fillers: orderedFillers, containers, operators, relevantIndexes };
};

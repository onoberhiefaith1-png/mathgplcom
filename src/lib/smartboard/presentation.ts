// Lesson Note → Smartboard presentation sequencer.
// Walks an ordered list of notebook sections and produces a flat list of "beats"
// the teacher advances through with Next/Prev. The Smartboard never renders
// giant section headings — only the per-beat content.

import type { SectionRow, SectionKind, BlockRow, NotebookRow } from "@/hooks/useNotebook";
import type { ContainerKind } from "./floatingPlan";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { detectStructures, extractTermsFromAscii, dropContextualLeadingPlus } from "./floatingExtractor";
import { normEq } from "./rowAscii";

export type BeatKind =
  | "text"            // intro/explanation/summary — full block
  | "problem"         // question only (example/exercise/classwork/homework)
  | "solution-step"   // one solution line + matching reasoning chip
  | "exercise-prompt"; // exercise/classwork/homework — question, then await teacher

export interface Beat {
  id: string;
  kind: BeatKind;
  caption?: string;
  content: string;
  reasoning?: string;
  sectionKind: SectionKind;
  fragments?: string[];
}

/** One solution line worth of guidance inside a reservoir — the answer key
 *  the teacher must reproduce on the smartboard before the line is marked
 *  complete and the next line becomes active. */
export interface ReservoirLine {
  equation: string;
  fillers: string[];
  containers: ContainerKind[];
  /** [start, end) range in the reservoir's `fragments` array. */
  fragmentStart: number;
  fragmentEnd: number;
  /** Optional explanation surfaced via a "+" marker on the smartboard. */
  explanation?: string;
   /** Plain-text "Notebook N" block paired with this line — non-highlighted
   *  prose sitting immediately above the teacher's highlight in the lesson
   *  source. Empty string means no notebook (line appears alone). */
  notebook?: string;
  /** Assessment grading id for this line (set only in assessment mode). The
   *  correct equation is NEVER carried client-side in assessment mode; this id
   *  is sent to the server grader, which holds the hidden answer key. */
  lineId?: string;
  /** Marks awarded when this line is graded correct (assessment mode only). */
  marks?: number;
  /** This line has only notebook content and no highlighted floating math. */
  notebookOnly?: boolean;
}

export interface Reservoir {
  beatId: string;
  caption: string;
  fragments: string[];
  /** Per-line answer key. Empty for legacy notebooks without floating_lines. */
  lines: ReservoirLine[];
}


const NUMBERED: SectionKind[] = ["example", "exercise", "classwork", "homework"];


const findBlock = (blocks: BlockRow[], kind: string) =>
  blocks.find((b) => b.kind === kind);

const cleanFragments = (items: string[] | undefined | null): string[] =>
  (items ?? [])
    .map((item) => toUnicodeMath(String(item ?? "")))
    .filter((item) => item && !isStillDirty(item));

const cleanTeacherFragments = (items: string[] | undefined | null): string[] =>
  (items ?? [])
    .map((item) => String(item ?? ""))
    .filter((item) => item.trim().length > 0);

const fillersFromEquation = (equation: string): string[] =>
  dropContextualLeadingPlus(
    extractTermsFromAscii(equation)
      .map((term) => term.ascii)
      .filter(Boolean),
  );

type RawFloatingLine = {
  equation?: string;
  fillers?: string[];
  containers?: ContainerKind[];
  explanation?: string;
  arrangement?: number[];
};

export const lessonSourceKey = (raw: string): string => normEq(toUnicodeMath(String(raw ?? "").trim()));

const singleHighlightFallback = (payload: string): RawFloatingLine => ({
  equation: payload,
  fillers: payload.trim() ? [payload] : [],
  containers: detectStructures(payload) as ContainerKind[],
  arrangement: payload.trim() ? [0] : [],
});

export const findVerifiedFloatingLine = (
  payload: string,
  rawLines: RawFloatingLine[] | null | undefined,
): RawFloatingLine | undefined => {
  const key = lessonSourceKey(payload);
  if (!key || !rawLines?.length) return undefined;
  return rawLines.find((line) => lessonSourceKey(line?.equation ?? "") === key);
};

const splitSolutionLines = (solution: string | undefined | null): string[] =>
  String(solution ?? "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !isStillDirty(toUnicodeMath(line)));

/** Walk every non-empty line of the solution text and split into math vs
 *  prose. Each prose line attaches to the math equation immediately
 *  preceding it (or the first equation after, if it leads the block).
 *  Returns parsed entries in source order. */
const parseSolutionExplanations = (
  solution: string | undefined | null,
): { equation: string; explanation?: string }[] => {
  const raw = String(solution ?? "")
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { equation: string; explanation?: string }[] = [];
  const looksLikeMath = (l: string) => {
    const u = toUnicodeMath(l);
    if (!u || isStillDirty(u)) return false;
    // A line counts as math if it has an operator/equals or is mostly digits.
    return /[=+\-−×÷/^]/.test(u) || /^[\d\s.,()πθ]+$/.test(u);
  };
  let leading: string[] = [];
  const LABEL_RE = /^(explanation|reason|note|check|reasoning)\s*[:：]?\s*$/i;
  const STRIP_LABEL_RE = /^(explanation|reason|note|reasoning)\s*[:：]\s*/i;
  for (const rawLine of raw) {
    const line = rawLine.trim();
    if (!line) continue;
    if (LABEL_RE.test(line)) continue; // bare label line — skip
    if (looksLikeMath(line)) {
      out.push({ equation: line });
      if (leading.length && out.length === 1) {
        out[0].explanation = leading.join("\n");
        leading = [];
      }
    } else {
      const stripped = line.replace(STRIP_LABEL_RE, "").trim();
      if (!stripped) continue;
      if (out.length === 0) {
        leading.push(stripped);
      } else {
        const last = out[out.length - 1];
        last.explanation = last.explanation ? `${last.explanation}\n${stripped}` : stripped;
      }
    }
  }
  return out;

};

/** Deterministic per-line shuffle so floating chips never appear in the
 *  equation's natural order. Seeded by `${subId}-line-${k}` so reopening the
 *  lesson yields the same arrangement. */
const seedHash = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const shuffleLine = <T,>(arr: T[], seedStr: string): T[] => {
  if (arr.length <= 1) return arr.slice();
  const out = arr.slice();
  let seed = seedHash(seedStr) || 1;
  const rand = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17; seed >>>= 0;
    seed ^= seed << 5;  seed >>>= 0;
    return seed / 0xffffffff;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // If shuffle accidentally reproduced equation order, rotate by 1.
  let same = true;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== out[i]) { same = false; break; }
  if (same) out.push(out.shift()!);
  return out;
};

/** Build the full beat list for a notebook.
 *  Prepends one synthetic cover beat (`__cover__`) carrying title +
 *  topic + subtopic + date — rendered inline at the top of the
 *  continuous-scroll lesson canvas. */
export const buildBeats = (sections: SectionRow[], notebook?: NotebookRow | null): Beat[] => {
  const beats: Beat[] = [];
  const counters: Record<string, number> = {};

  if (notebook) {
    beats.push({
      id: "__cover__",
      kind: "text",
      caption: notebook.subject ?? "",
      content: notebook.title ?? "Untitled",
      reasoning: notebook.subtopic ?? "",
      sectionKind: "introduction",
    });
  }

  for (const sec of sections) {
    if (sec.kind === "introduction" || sec.kind === "explanation" || sec.kind === "summary") {
      const text = sec.loose.map((b) => b.content_ascii).filter(Boolean).join("\n\n").trim();
      if (text) {
        beats.push({
          id: `${sec.id}-text`,
          kind: "text",
          content: text,
          sectionKind: sec.kind,
        });
      }
      continue;
    }

    if (NUMBERED.includes(sec.kind)) {
      for (const sub of sec.subsections) {
        counters[sec.kind] = (counters[sec.kind] ?? 0) + 1;
        const n = counters[sec.kind];
        const caption = `${sec.kind[0].toUpperCase()}${sec.kind.slice(1)} ${n}`;

        const problemBlock = findBlock(sub.blocks, "problem");
        const problem = problemBlock?.content_ascii?.trim() ?? "";
        if (!problem) continue;

        // Pull pre-decomposed floating fragments from the Lesson Note bucket
        // if available, so the Smartboard COMPOSES the equation rather than
        // re-deriving fragments from the raw ASCII.
        const bucket = (sub as any).floating_bucket as
          | { viewCombined?: string[]; fillers?: string[] }
          | null
          | undefined;
        const lines = (sub as any).floating_lines as
          | { fillers?: string[] }[]
          | null
          | undefined;
        // Use the Floating Collection in its ORIGINAL extraction order.
        // No shuffle. No regeneration. The Smartboard only displays what
        // the Lesson Note already produced.
        const rawFragments: string[] | undefined =
          bucket?.viewCombined && bucket.viewCombined.length > 0
            ? bucket.viewCombined
            : lines && lines.length > 0
              ? lines.flatMap((l) => l.fillers ?? [])
              : undefined;
        const fragments = rawFragments ? cleanFragments(rawFragments) : undefined;

        // Single problem beat per subsection. Solution steps are NOT pushed —
        // the teacher solves manually using the floating-number system, and
        // "Next" advances to the next section/subsection.
        beats.push({
          id: `${sub.id}-q`,
          kind: sec.kind === "example" ? "problem" : "exercise-prompt",
          caption,
          content: problem,
          sectionKind: sec.kind,
          fragments,
        });
      }
    }
  }

  return beats;
};

/** Build one Reservoir per numbered subsection, in the same order as the
 *  problem beats produced by `buildBeats`. The Floating Display Carrier
 *  on the smartboard scrolls vertically through this list. */
export const buildReservoirs = (sections: SectionRow[]): Reservoir[] => {
  const reservoirs: Reservoir[] = [];
  const counters: Record<string, number> = {};
  for (const sec of sections) {
    if (!NUMBERED.includes(sec.kind)) continue;
    for (const sub of sec.subsections) {
      counters[sec.kind] = (counters[sec.kind] ?? 0) + 1;
      const n = counters[sec.kind];
      const caption = `${sec.kind[0].toUpperCase()}${sec.kind.slice(1)} ${n}`;
      const problemBlock = findBlock(sub.blocks, "problem");
      if (!problemBlock?.content_ascii?.trim()) continue;
      const bucket = (sub as any).floating_bucket as
        | { viewCombined?: string[]; viewRearranged?: string[]; fillers?: string[] }
        | null
        | undefined;
      const rawLines = (sub as any).floating_lines as
        | RawFloatingLine[]
        | null
        | undefined;
      // NOTE-ATTACHMENT CONSISTENCY LAW: a highlight owns ONLY its own
      // `precedingNotebook`. There is no equation-keyed fallback map — a
      // line has a note iff its own highlight authored one. Equation-match
      // guessing caused stray notes (e.g. entire solution tails) to latch
      // onto lines whose Floating Panel entry had no note. Never restore.
      // Whole-object highlights (tables / diagrams) are skipped here: the
      // Highlighting Page records them, but their sequencing lands later.
      const rawHighlights = ((sub as any).floating_highlights as
        | { payload?: string; precedingNotebook?: string; notebookOnly?: boolean; object?: any }[]
        | null
        | undefined)?.filter((h) => !h?.object);

      // Per-line answer key — preferred path when the Lesson Note has been
      // saved with structured floating_lines. Each line contributes its
      // fillers to the reservoir's combined fragment list in order.
      const lines: ReservoirLine[] = [];
      const fragmentsFromLines: string[] = [];
      const solutionBlock = findBlock(sub.blocks, "solution");
      const solutionLines = splitSolutionLines(solutionBlock?.content_ascii);
      // Walk the FULL solution text (math + prose) so we can attach any
      // narrative explanation directly to the equation it follows.
      const parsedSolution = parseSolutionExplanations(solutionBlock?.content_ascii);
      // Spec Rule 1 Case B / Rule 2: each notebookOnly highlight stands on
      // its own as a standalone notebook entry (no floating equation). It
      // is NOT folded into the following highlight — every notebook always
      // belongs to the highlight ABOVE it, so leading prose has no parent
      // and remains independent.
      const sourceLines = rawHighlights && rawHighlights.length > 0
        ? rawHighlights.reduce<Array<{ equation: string; fillers?: string[]; containers?: ContainerKind[]; explanation?: string; notebook?: string; notebookOnly?: boolean }>>((acc, h, hi) => {
            if (h.notebookOnly) {
              const nb = String(h.precedingNotebook ?? "").trim();
              if (!nb) return acc;
              acc.push({
                equation: "",
                fillers: [],
                containers: [],
                notebook: nb,
                notebookOnly: true,
              });
              return acc;
            }
            const payload = String(h.payload ?? "").trim();
            // Middleman parity guard: a highlight may only consume a saved
            // floating line when that line's Lesson Note equation matches the
            // highlight payload. Never fall back by array index — that can pull
            // chips/notebook text from a different lesson line after edits.
            const matched = findVerifiedFloatingLine(payload, rawLines)
              ?? singleHighlightFallback(payload);
            const ownNotebook = String(h.precedingNotebook ?? "").trim();
            acc.push({
              ...matched,
              equation: payload,
              notebook: ownNotebook || undefined,
              notebookOnly: false,
            });
            return acc;
          }, [])
        : rawLines && rawLines.length > 0
          ? rawLines
          : solutionLines.map((equation) => ({ equation, fillers: fillersFromEquation(equation), containers: detectStructures(equation) as ContainerKind[] }));

      if (sourceLines && sourceLines.length > 0) {
        for (let k = 0; k < sourceLines.length; k++) {
          const rl = sourceLines[k];
          const eq = (rl.equation ?? "").trim();
          const isNotebookOnly = (rl as any).notebookOnly === true;
          if (!eq && !isNotebookOnly) continue;
          // Preserve the EXACT order the teacher generated. No shuffle, no
          // rearrangement — the floating-number page should reflect the
          // teacher's own construction sequence.
          // Apply the teacher's saved arrangement (shuffle order) so the
          // smartboard shows fragments in the same order the teacher arranged
          // them on the Floating Numbers page — NOT raw equation order.
          // Teacher chips are immutable: when fillers came from the teacher's
          // preparation page (rl.fillers), pass them through verbatim. Only
          // machine-derived fillers (fillersFromEquation) may have their
          // contextual leading "+" stripped.
          const teacherProvided = !!(rl.fillers && rl.fillers.length > 0);
          const baseFills = isNotebookOnly
            ? []
            : (teacherProvided ? (rl.fillers as string[]) : fillersFromEquation(eq));
          const arr = (rl as any).arrangement as number[] | undefined;
          const ordered = (arr && arr.length === baseFills.length)
            ? arr.map((i) => baseFills[i])
            : baseFills;
          const fills = isNotebookOnly
            ? []
            : (teacherProvided
                ? cleanTeacherFragments(ordered)
                : dropContextualLeadingPlus(cleanFragments(ordered)));
          const start = fragmentsFromLines.length;
          fragmentsFromLines.push(...fills);
          // Explanations attach by EXACT equation match only. The old
          // positional fallback (parsedSolution[k]) let wrong-line prose
          // (even whole solution tails) latch onto any line. Never restore.
          const explanation = (rl as any).explanation
            ?? parsedSolution.find((p) => p.equation === eq)?.explanation;
          // Notes come ONLY from the highlight itself — never from an
          // equation-match fallback or from parsed solution prose.
          const notebook = (rl as any).notebook || undefined;
          lines.push({
            equation: eq,
            fillers: fills,
            containers: rl.containers ?? [],
            fragmentStart: start,
            fragmentEnd: fragmentsFromLines.length,
            explanation: explanation || undefined,
            notebook,
            notebookOnly: isNotebookOnly,
          });
        }
      }


      // Prefer per-line fragments; if those came back empty, fall back to
      // the compiled bucket so the Smartboard still shows the floating
      // numbers the teacher generated in the Lesson Note.
      // `bucket.fillers` carries the teacher's arranged order. Prefer it
      // over `viewCombined` (which is original equation order) so the
      // smartboard reflects the shuffle when per-line data is missing.
      // `bucket.fillers` and `bucket.viewCombined` are teacher-curated chip
      // strings (edited and arranged on the preparation page). They MUST
      // reach the Smartboard verbatim — never sign-stripped. Only the pure
      // machine fallback derived from solutionLines may be normalised.
      const bucketCombined =
        bucket?.fillers && bucket.fillers.length > 0
          ? cleanTeacherFragments(bucket.fillers)
          : bucket?.viewCombined && bucket.viewCombined.length > 0
            ? cleanTeacherFragments(bucket.viewCombined)
            : bucket?.viewRearranged && bucket.viewRearranged.length > 0
              ? cleanTeacherFragments(bucket.viewRearranged)
              : [];
      const solutionFallback = dropContextualLeadingPlus(
        cleanFragments(solutionLines.flatMap(fillersFromEquation)),
      );
      const fragments: string[] =
        fragmentsFromLines.length > 0
          ? fragmentsFromLines
          : bucketCombined.length > 0
            ? bucketCombined
            : solutionFallback;

      // Parity guard: any teacher-sourced fragment must survive byte-identical.
      const teacherSource = (bucket?.fillers && bucket.fillers.length > 0)
        ? bucket.fillers
        : null;
      if (teacherSource && fragments.length === teacherSource.length) {
        for (let i = 0; i < fragments.length; i++) {
          if (fragments[i] !== teacherSource[i]) {
            // eslint-disable-next-line no-console
            console.warn(
              "[smartboard parity] teacher chip drifted — restoring verbatim",
              { index: i, teacher: teacherSource[i], compiled: fragments[i] },
            );
            fragments[i] = teacherSource[i];
          }
        }
      }
      reservoirs.push({ beatId: `${sub.id}-q`, caption, fragments, lines });
    }
  }
  return reservoirs;
};


/** Whether the floating math system should be visible for this beat. */
export const beatNeedsFloatingMath = (beat: Beat | undefined): boolean => {
  if (!beat) return false;
  return beat.kind === "solution-step" || beat.kind === "exercise-prompt" || beat.kind === "problem";
};

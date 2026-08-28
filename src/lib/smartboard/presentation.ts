// Lesson Note → Smartboard presentation sequencer.
// Walks an ordered list of notebook sections and produces a flat list of "beats"
// the teacher advances through with Next/Prev. The Smartboard never renders
// giant section headings — only the per-beat content.

import type { SectionRow, SectionKind, BlockRow, SubsectionRow, NotebookRow } from "@/hooks/useNotebook";
import type { ContainerKind } from "./floatingPlan";
import type { FloatingTableRef } from "@/lib/lessonnotes/floatingCompile";
import { looksLikeMathOnly } from "@/lib/notebook/proseGuard";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { detectStructures, extractTermsFromAscii, dropContextualLeadingPlus } from "./floatingExtractor";
import { normEq } from "./rowAscii";
import type { SolutionObject } from "@/lib/floating/solutionItems";
import { readSolutionObjects, isFloatableObject, sortByPlacement } from "@/lib/floating/solutionItems";
import { boardObjects, notesLayerObjects, orderByPlacement } from "@/lib/lessonnotes/lessonOutline";

/** Objects stored on a block, filtered to what the student board may show. */
const blockObjects = (block?: BlockRow | null): SolutionObject[] => {
  const raw = (block as any)?.content_json?.objects;
  // PLACEMENT LAW: always ordered by the object's recorded home, never by the
  // order rows happened to arrive in.
  return Array.isArray(raw) ? orderByPlacement(boardObjects(raw as SolutionObject[])) : [];
};

/** NOTES-LAYER objects captured inside a Solution (diagrams, 3D scenes,
 *  graphs). They are NOT part of the floating solution — the reservoir never
 *  sees them — but they are permanent lesson content and therefore still
 *  render with the question/note block they belong to, in document order. */
const solutionNotesObjects = (block?: BlockRow | null): SolutionObject[] => {
  const raw = (block as any)?.content_json?.objects;
  return Array.isArray(raw) ? orderByPlacement(notesLayerObjects(raw as SolutionObject[])) : [];
};

/** Restore persisted note-attached objects (diagrams). Floatable objects can
 *  never be note content, so they are dropped defensively. */
const readNoteObjects = (raw: any): SolutionObject[] =>
  sortByPlacement(
    readSolutionObjects({ objects: Array.isArray(raw) ? raw : [] }).filter(
      (o) => !isFloatableObject(o),
    ),
  );

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
  /** SECTION IDENTITY — the one active lesson position shared by both boards
   *  ("introduction", "example-1", "exercise-2", "cover"…). */
  sectionId: string;
  /** Human label of that section, used as the Board B heading. */
  sectionLabel: string;
  sectionKind: SectionKind;
  fragments?: string[];
  /** Objects belonging to this beat's session (tables, diagrams, charts, 3D).
   *  Already filtered: geometry captured inside a Solution never appears here,
   *  because the teacher displays those diagrams separately. */
  objects?: SolutionObject[];
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
  /** Set when the line came from a highlighted table workspace. Carries the
   *  grid snapshot + retained cells so the board can render the table. */
  table?: FloatingTableRef;
  /** NOTES-LAYER objects (diagrams) belonging to this line's NOTE. They never
   *  enter the floating sequence — pressing the note icon reveals them with
   *  the note prose. */
  noteObjects?: SolutionObject[];
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

/** True when a numbered subsection carries teachable content even though its
 *  question block has no typed text — i.e. the question is an OBJECT (Smart
 *  Table, long division, ladder, base conversion, place-value chart) or the
 *  Lesson Note already produced floating content / a solution for it. */
const subsectionHasContent = (sub: SubsectionRow): boolean => {
  const bucket = (sub as any).floating_bucket as
    | { viewCombined?: string[]; fillers?: string[] } | null | undefined;
  if ((bucket?.viewCombined?.length ?? 0) > 0) return true;
  if ((bucket?.fillers?.length ?? 0) > 0) return true;
  const lines = (sub as any).floating_lines as any[] | null | undefined;
  if ((lines?.length ?? 0) > 0) return true;
  const highlights = (sub as any).floating_highlights as any[] | null | undefined;
  if ((highlights?.length ?? 0) > 0) return true;
  // A question can be drawn entirely as an OBJECT — a diagram, a 3D scene, a
  // graph or a table — with no typed text at all. That is still real lesson
  // content, so the beat must exist or the diagram would never reach the board.
  if (sub.blocks.some((b) => blockObjects(b).length > 0)) return true;
  return sub.blocks.some(
    (b) => b.kind !== "problem" && String(b.content_ascii ?? "").trim().length > 0,
  );
};


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
  table?: FloatingTableRef;
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
): { equation: string; explanation?: string; proseLine?: number }[] => {
  const raw = String(solution ?? "")
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { equation: string; explanation?: string; proseLine?: number }[] = [];
  const looksLikeMath = (l: string) => {
    const u = toUnicodeMath(l);
    if (!u || isStillDirty(u)) return false;
    // NOTE-PURITY LAW: a line that carries ordinary words is prose, even when
    // it quotes an equation ("Compare with ax² + bx + c = 0:").
    return looksLikeMathOnly(u);
  };

  let leading: string[] = [];
  let leadingLine = 0;
  const LABEL_RE = /^(explanation|reason|note|check|reasoning)\s*[:：]?\s*$/i;
  const STRIP_LABEL_RE = /^(explanation|reason|note|reasoning)\s*[:：]\s*/i;
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i].trim();
    if (!line) continue;
    if (LABEL_RE.test(line)) continue; // bare label line — skip
    if (looksLikeMath(line)) {
      out.push({ equation: line });
      if (leading.length && out.length === 1) {
        out[0].explanation = leading.join("\n");
        out[0].proseLine = leadingLine;
        leading = [];
      }
    } else {
      const stripped = line.replace(STRIP_LABEL_RE, "").trim();
      if (!stripped) continue;
      if (out.length === 0) {
        if (!leading.length) leadingLine = i;
        leading.push(stripped);
      } else {
        const last = out[out.length - 1];
        last.explanation = last.explanation ? `${last.explanation}\n${stripped}` : stripped;
        // SOURCE POSITION: the line this note starts on, so a diagram drawn
        // beneath it can be matched to this note row and no other.
        if (last.proseLine === undefined) last.proseLine = i;
      }
    }
  }
  return out;

};

/** SELECTION LAW fallback: with no teacher highlights, nothing floats. The
 *  lesson still reaches the board as NOTES — one note-only row per prose
 *  block, in source order, with every notes-layer diagram attached to the
 *  note row it actually sits under in the lesson note (never all piled on the
 *  last row). A diagram that precedes all prose gets its own leading row. */
const notesOnlyRows = (
  parsed: { equation: string; explanation?: string; proseLine?: number }[],
  noteObjects: SolutionObject[],
): Array<{
  equation: string;
  fillers: string[];
  containers: ContainerKind[];
  notebook?: string;
  notebookOnly?: boolean;
  noteObjects?: SolutionObject[];
}> => {
  const emptyRow = (notebook?: string) => ({
    equation: "",
    fillers: [] as string[],
    containers: [] as ContainerKind[],
    notebook,
    notebookOnly: true,
    noteObjects: undefined as SolutionObject[] | undefined,
  });

  const rows = parsed
    .map((p) => ({ notebook: String(p.explanation ?? "").trim(), line: p.proseLine ?? 0 }))
    .filter((r) => r.notebook)
    .map((r) => ({ row: emptyRow(r.notebook), line: r.line }));

  const diagrams = sortByPlacement((noteObjects ?? []).filter((o) => !isFloatableObject(o)));
  if (diagrams.length === 0) return rows.map((r) => r.row);
  if (rows.length === 0) {
    const only = emptyRow(undefined);
    only.noteObjects = diagrams;
    return [only];
  }

  // PLACEMENT LAW: a diagram belongs to the LAST note row that starts at or
  // before the line the diagram was drawn on. A diagram above every note row
  // becomes its own leading row, so nothing is ever pushed to the end.
  const out: Array<ReturnType<typeof emptyRow>> = [];
  const perRow = new Map<number, SolutionObject[]>();
  const leading: SolutionObject[] = [];
  for (const d of diagrams) {
    const line = Number.isFinite(d.afterLine) ? d.afterLine : Number.MAX_SAFE_INTEGER;
    let idx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].line <= line) idx = i; else break;
    }
    if (idx < 0) { leading.push(d); continue; }
    perRow.set(idx, [...(perRow.get(idx) ?? []), d]);
  }
  if (leading.length) {
    const lead = emptyRow(undefined);
    lead.noteObjects = leading;
    out.push(lead);
  }
  rows.forEach((r, i) => {
    const attached = perRow.get(i);
    if (attached?.length) r.row.noteObjects = attached;
    out.push(r.row);
  });
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
/** Stable section identity for a non-numbered section. */
const sectionIdFor = (kind: string, ordinal: number): string =>
  ordinal > 1 ? `${kind}-${ordinal}` : kind;

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
      sectionId: "cover",
      sectionLabel: notebook.title ?? "Lesson",
    });
  }

  for (const sec of sections) {
    if (sec.kind === "introduction" || sec.kind === "explanation" || sec.kind === "summary") {
      const text = sec.loose.map((b) => b.content_ascii).filter(Boolean).join("\n\n").trim();
      const objects = sec.loose.flatMap((b) => blockObjects(b));
      if (text || objects.length) {
        const looseKey = `__sec_${sec.kind}`;
        counters[looseKey] = (counters[looseKey] ?? 0) + 1;
        beats.push({
          id: `${sec.id}-text`,
          kind: "text",
          content: text,
          sectionKind: sec.kind,
          sectionId: sectionIdFor(sec.kind, counters[looseKey]),
          sectionLabel: `${sec.kind[0].toUpperCase()}${sec.kind.slice(1)}`,
          objects,
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
        // ASSET-ONLY QUESTIONS. A question can be drawn entirely as an object
        // (base conversion / place-value / long division / table) with no
        // typed text. It is still a question, so it still becomes a beat —
        // otherwise Next would dead-end on the previous example.
        if (!problem && !subsectionHasContent(sub)) continue;

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
          sectionId: `${sec.kind}-${n}`,
          sectionLabel: caption,
          fragments,
          // Every object this session owns, in block order:
          //  - the QUESTION's own objects (table, chart, question diagram)
          //  - notes-layer diagrams drawn inside the Solution — they keep their
          //    instructional position instead of vanishing from the board
          //  - objects stored on any other block of the subsection, so nothing
          //    a teacher drew can be silently dropped.
          objects: (() => {
            const out: SolutionObject[] = [];
            const seen = new Set<string>();
            const push = (list: SolutionObject[]) => {
              for (const o of list) {
                const key = o.objId ?? `${o.nodeType}#${out.length}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(o);
              }
            };
            push(blockObjects(problemBlock));
            for (const b of sub.blocks) {
              if (b === problemBlock || b.kind === "solution") continue;
              push(blockObjects(b));
            }
            // Final guarantee: the beat's objects follow their recorded home
            // (session → position in session), so a diagram can never drift
            // ahead of or behind a sibling drawn in the same session.
            return sortByPlacement(out);
          })(),

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
      if (!problemBlock?.content_ascii?.trim() && !subsectionHasContent(sub)) continue;
      const bucket = (sub as any).floating_bucket as
        | { viewCombined?: string[]; viewRearranged?: string[]; fillers?: string[] }
        | null
        | undefined;
      const rawLines = repairShiftedFloatingLines(
        (((sub as any).floating_lines ?? []) as RawFloatingLine[]) as any,
      ) as unknown as RawFloatingLine[] | null | undefined;

      // NOTE-ATTACHMENT CONSISTENCY LAW: a highlight owns ONLY its own
      // `precedingNotebook`. There is no equation-keyed fallback map — a
      // line has a note iff its own highlight authored one. Equation-match
      // guessing caused stray notes (e.g. entire solution tails) to latch
      // onto lines whose Floating Panel entry had no note. Never restore.
      // Whole-object highlights: a highlighted TABLE expands into the lines
      // its workspace generated (matched by objId on the saved floating
      // lines). Any other object (a diagram) can NEVER float — but its note
      // content must not vanish with it, so the row is converted into a
      // note-only row carrying the diagram as note content.
      const rawHighlights = ((sub as any).floating_highlights as
        | { payload?: string; precedingNotebook?: string; notebookOnly?: boolean; object?: any; noteObjects?: any }[]
        | null
        | undefined)?.map((h) => {
          if (!h?.object || h.object?.family === "table") return h;
          return {
            ...h,
            object: undefined,
            payload: "",
            notebookOnly: true,
            noteObjects: [
              ...(Array.isArray(h.noteObjects) ? h.noteObjects : []),
              h.object,
            ],
          };
        });


      // Per-line answer key — preferred path when the Lesson Note has been
      // saved with structured floating_lines. Each line contributes its
      // fillers to the reservoir's combined fragment list in order.
      const lines: ReservoirLine[] = [];
      const fragmentsFromLines: string[] = [];
      const solutionBlock = findBlock(sub.blocks, "solution");
      const hasTeacherFloating =
        (rawHighlights && rawHighlights.length > 0) ||
        (rawLines && rawLines.length > 0) ||
        (bucket?.fillers && bucket.fillers.length > 0) ||
        (bucket?.viewCombined && bucket.viewCombined.length > 0) ||
        (bucket?.viewRearranged && bucket.viewRearranged.length > 0);

      // NOTE: the solution text is never split into floating fragments here.
      // Walk the FULL solution text (math + prose) so we can attach any
      // narrative explanation directly to the equation it follows.
      const parsedSolution = parseSolutionExplanations(solutionBlock?.content_ascii);
      // Spec Rule 1 Case B / Rule 2: each notebookOnly highlight stands on
      // its own as a standalone notebook entry (no floating equation). It
      // is NOT folded into the following highlight — every notebook always
      // belongs to the highlight ABOVE it, so leading prose has no parent
      // and remains independent.
      const sourceLines = rawHighlights && rawHighlights.length > 0
        ? rawHighlights.reduce<Array<{ equation: string; fillers?: string[]; containers?: ContainerKind[]; explanation?: string; notebook?: string; notebookOnly?: boolean; table?: FloatingTableRef; noteObjects?: SolutionObject[] }>>((acc, h, hi) => {
            // Diagrams attached to this entry's note (never floating content).
            const noteObjects = readNoteObjects((h as any).noteObjects);
            if (h.notebookOnly) {
              const nb = String(h.precedingNotebook ?? "").trim();
              // A note-only row survives when it carries prose OR a diagram.
              if (!nb && noteObjects.length === 0) return acc;
              acc.push({
                equation: "",
                fillers: [],
                containers: [],
                notebook: nb,
                notebookOnly: true,
                noteObjects,
              });
              return acc;
            }
            if (h.object) {
              // Table workspace: emit every saved line that belongs to it, in
              // saved order. The grid snapshot travels with the line.
              const objId = String(h.object?.objId ?? "");
              for (const rl of (rawLines ?? [])) {
                if ((rl as any)?.table?.objId !== objId) continue;
                acc.push({
                  ...(rl as any),
                  equation: String((rl as any).equation ?? ""),
                  notebookOnly: false,
                });
              }
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
              noteObjects,
            });
            return acc;
          }, [])
        : rawLines && rawLines.length > 0
          ? rawLines
          : hasTeacherFloating
            ? []
            : parsedSolution.length > 0
              ? (() => {
                  // eslint-disable-next-line no-console
                  console.warn(
                    "[smartboard fallback] no teacher-curated floating data; deriving chips from solution equations for beat",
                    `${sub.id}-q`,
                  );
                  return parsedSolution.map((p) => ({
                    equation: p.equation,
                    fillers: undefined as string[] | undefined,
                    containers: detectStructures(p.equation) as ContainerKind[],
                    explanation: p.explanation,
                    // The prose that follows this equation IS its note, so the
                    // board shows chips first and the note underneath.
                    notebook: p.explanation,
                  }));


                })()
              : notesOnlyRows(
                  parsedSolution,
                  solutionNotesObjects(solutionBlock),
                );



      if (sourceLines && sourceLines.length > 0) {
        for (let k = 0; k < sourceLines.length; k++) {
          const rl = sourceLines[k];
          const eq = (rl.equation ?? "").trim();
          const isNotebookOnly = (rl as any).notebookOnly === true;
          const lineNoteObjects = readNoteObjects((rl as any).noteObjects);
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
            table: (rl as any).table,
            noteObjects: lineNoteObjects.length ? lineNoteObjects : undefined,
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
      // SELECTION LAW: there is no solution-derived fragment fallback. Chips
      // exist only where the teacher highlighted content; otherwise the
      // reservoir carries notes only.
      const fragments: string[] =
        fragmentsFromLines.length > 0
          ? fragmentsFromLines
          : bucketCombined;


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

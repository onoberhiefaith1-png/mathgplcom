// MathGPL Copilot — the FIXED lesson-building procedure.
//
// The procedure never changes:
//   greeting → structure (with number controls) → additional information
//   → analysis of that material → build (narrated) → supervision.
//
// The intelligence lives INSIDE these stages. The Copilot never asks
// "how many examples?" — the numbers are controls the teacher edits.

import { SECTION_LABELS, SOLUTION_SECTION_KINDS, type SectionKind } from "@/lib/lessonnotes/sectionKinds";

export type CoPilotStage =
  | "greeting"     // opening line, structure card being prepared
  | "structure"    // teacher adjusts the numbers
  | "material"     // additional information intake (always optional)
  | "analysing"    // planning the lesson (analysis → blueprint)
  | "blueprint"    // the teacher reviews / edits the plan before anything is written
  | "building"     // working through the queue
  | "idle";        // supervision / free conversation

/** The seven fixed rows of the lesson structure, in teaching order. */
export const STRUCTURE_ROWS: SectionKind[] = [
  "introduction", "explanation", "example", "classwork", "exercise", "homework", "summary",
];

/** Teacher-facing names for the structure card (app owns the real labels). */
export const STRUCTURE_ROW_LABEL: Partial<Record<SectionKind, string>> = {
  homework: "Assignment",
  summary: "Conclusion",
};

export const rowLabel = (k: SectionKind) => STRUCTURE_ROW_LABEL[k] ?? SECTION_LABELS[k];

export type StructureCounts = Record<string, number>;

export const DEFAULT_STRUCTURE: StructureCounts = {
  introduction: 1, explanation: 1, example: 1,
  classwork: 1, exercise: 1, homework: 1, summary: 1,
};

/** Caps keep a single click from queueing forty generation calls. */
export const MAX_PER_SECTION = 12;

export interface CoPilotFile {
  name: string;
  mime: string;
  /** data:<mime>;base64,… */
  dataUrl: string;
}

export interface CoPilotMaterial {
  text: string;
  files: CoPilotFile[];
}

export const emptyMaterial = (): CoPilotMaterial => ({ text: "", files: [] });

/** What the Copilot understood from the teacher's reference material. */
export interface CoPilotAnalysis {
  level: string;
  style: string;
  method: string;
  progression: string;
  terminology: string;
  /** One paragraph handed to every generator for the rest of the build. */
  brief: string;
}

export interface BuildItem {
  key: string;
  kind: SectionKind;
  /** "Example 2" style label for the teacher. */
  label: string;
  index: number;
  total: number;
  withSolution: boolean;
  /** Short professional note about WHY this item looks like it does. */
  note?: string;
  /** The planned content of this item — shown in the blueprint, editable. */
  plan?: string;
  /** The Co-Pilot's own decision: does this item need a 2D diagram? */
  needsDiagram?: boolean;
  /** Named existing 3D asset to place, when the item is a 3D one. */
  asset3d?: string;
  /** True once the teacher edited or revised the planned line. */
  edited?: boolean;
  state: "pending" | "running" | "done" | "failed" | "skipped";
  detail?: string;
}

/** The narrated planning steps — the panel rotates through these while planning. */
export const PLANNING_STEPS = [
  "Analysing the topic",
  "Checking the mathematical structure",
  "Planning the examples",
  "Checking question progression",
  "Preparing the lesson blueprint",
];

/** "proceed" and friends: the teacher telling the Co-Pilot to get on with it. */
export const isProceedIntent = (text: string) =>
  /^(ok(ay)?[,. ]*)?(please\s+)?(proceed|go ahead|carry on|continue|go on|build it|build the lesson|just build it|start|begin|approved?[.! ]*(build it)?)\b/i
    .test(text.trim());

/** Turn the confirmed structure counts into the ordered build queue. */
export function buildQueue(counts: StructureCounts): BuildItem[] {
  const out: BuildItem[] = [];
  for (const kind of STRUCTURE_ROWS) {
    const total = Math.max(0, Math.min(MAX_PER_SECTION, Math.floor(counts[kind] ?? 0)));
    for (let i = 1; i <= total; i++) {
      out.push({
        key: `${kind}-${i}`,
        kind,
        label: total > 1 ? `${rowLabel(kind)} ${i}` : rowLabel(kind),
        index: i,
        total,
        withSolution: SOLUTION_SECTION_KINDS.has(kind),
        state: "pending",
      });
    }
  }
  return out;
}

/**
 * The teaching instruction handed to the note's OWN generator for one item.
 * This is where the analysed style, the progression and the mathematical
 * checks travel — the Copilot itself never writes the mathematics.
 */
export function itemInstruction(
  item: BuildItem,
  analysis: CoPilotAnalysis | null,
  queue: BuildItem[],
): string {
  const done = queue.filter((q) => q.state === "done").map((q) => q.label);
  const lines: string[] = [];

  lines.push(`Write the ${item.label} for this subtopic.`);

  // The approved blueprint line is the leading instruction for this item.
  if (item.plan) lines.push(`This item was planned and approved by the teacher as: ${item.plan}`);
  if (item.needsDiagram) lines.push("This item needs a proper 2D mathematical diagram: build it with the geometry construction engine, accurate and fully labelled.");
  if (item.asset3d) lines.push(`Do not draw a 3D picture: state that the existing MathGPL 3D asset "${item.asset3d}" belongs here.`);

  if (item.kind === "example" && item.total > 1) {
    lines.push(
      item.index === 1
        ? "This is the first worked example: keep the method visible and straightforward so the students see the procedure clearly."
        : item.index === item.total
          ? "This is the last example: the student must recognise which structure/method applies rather than being told."
          : "Increase the difficulty a step from the previous example without leaving the method being taught.",
    );
  }
  if (item.kind === "classwork" || item.kind === "exercise" || item.kind === "homework") {
    lines.push("Only use methods that have already been demonstrated in the examples above.");
    if (item.total > 1) lines.push(`This is item ${item.index} of ${item.total}; keep a rising difficulty across them.`);
  }
  if (item.kind === "explanation" && item.total > 1) {
    lines.push(`Explanation ${item.index} of ${item.total} — cover a distinct idea, do not repeat the previous one.`);
  }

  if (done.length) lines.push(`Already built in this lesson: ${done.join(", ")}. Continue from it, do not repeat it.`);

  if (analysis?.brief) lines.push(`Teacher's reference material: ${analysis.brief}`);
  if (analysis?.level) lines.push(`Pitch it at: ${analysis.level}.`);
  if (analysis?.style) lines.push(`Match this question style: ${analysis.style}.`);
  if (analysis?.method) lines.push(`Method being practised: ${analysis.method}.`);

  lines.push(
    "Mathematical check before you commit: the question must be valid, solvable by the intended method, "
    + "test the same concept, and be structurally different from the reference — changing numbers alone is not a new question.",
  );

  return lines.join(" ");
}

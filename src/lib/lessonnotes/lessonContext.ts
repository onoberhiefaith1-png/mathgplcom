// Lesson-wide teaching context.
//
// Before generating ANY new section, the AI must know the whole lesson so far:
// topic, subtopic, level, objectives, introduction, every explanation, every
// worked example, the definitions/notation already introduced, and where the
// new section sits in the teaching sequence.
//
// This walks the TipTap document ABOVE the insertion point and condenses it
// into a small payload (the server hydrates the rest of the standards).

import { detectSectionKind, type SectionKind } from "@/lib/lessonnotes/sectionKinds";

export interface LessonExampleContext {
  label: string;
  problem: string;
  method?: string;
}

export interface LessonTeachingContext {
  level?: string;
  objectives?: string;
  introduction?: string;
  explanations: string[];
  examples: LessonExampleContext[];
  definitions: string[];
  notation: string[];
  sequencePosition?: string;
}

const MAX_EXPLANATIONS = 4;
const MAX_EXAMPLES = 6;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

/** Definitions look like "A quadratic equation is …" / "… is called …". */
const DEFINITION_RE = /\b(is defined as|is called|we call|means that|refers to|,?\s+is an?\s)/i;

/** Collect distinct notation-ish tokens (single letters w/ scripts, symbols). */
const collectNotation = (text: string): string[] => {
  const out = new Set<string>();
  const re = /(?:[A-Za-z]\^\{[^}]+\}|[A-Za-z]_\{[^}]+\}|[A-Za-z]'|[πθαβΔΣ∫√∞≤≥≠≈±])/g;
  for (const m of text.match(re) ?? []) out.add(m);
  return Array.from(out).slice(0, 12);
};

interface SectionChunk {
  kind: SectionKind | null;
  heading: string;
  text: string;
}

/**
 * Build the teaching context from the sections that appear before `beforePos`.
 * `sections` must already be in document order.
 */
export function buildLessonTeachingContext(opts: {
  sections: SectionChunk[];
  targetKind: SectionKind;
  level?: string | null;
}): LessonTeachingContext {
  const ctx: LessonTeachingContext = {
    level: opts.level ?? undefined,
    explanations: [],
    examples: [],
    definitions: [],
    notation: [],
  };

  const notation = new Set<string>();
  let exampleCount = 0;

  for (const s of opts.sections) {
    const body = s.text.trim();
    if (!body) continue;
    for (const n of collectNotation(body)) notation.add(n);

    switch (s.kind) {
      case "objectives":
        ctx.objectives = clip(body, 600);
        break;
      case "introduction":
        ctx.introduction = clip(body, 800);
        break;
      case "explanation":
        ctx.explanations.push(clip(body, 700));
        break;
      case "example":
      case "exercise":
      case "classwork":
      case "homework":
      case "assessment": {
        exampleCount++;
        const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
        const problem = clip(lines[0] ?? "", 220);
        // Method = the first two solving steps, condensed.
        const method = lines.slice(1, 3).join(" → ");
        ctx.examples.push({
          label: s.heading || `${s.kind} ${exampleCount}`,
          problem,
          method: method ? clip(method, 200) : undefined,
        });
        break;
      }
      default:
        break;
    }

    for (const line of body.split("\n")) {
      const t = line.trim();
      if (t.length > 15 && t.length < 200 && DEFINITION_RE.test(t)) ctx.definitions.push(t);
    }
  }

  // Trim to a sensible budget: keep the most recent items (closest context).
  ctx.explanations = ctx.explanations.slice(-MAX_EXPLANATIONS);
  ctx.examples = ctx.examples.slice(-MAX_EXAMPLES);
  ctx.definitions = Array.from(new Set(ctx.definitions)).slice(-6);
  ctx.notation = Array.from(notation);

  const sameKindCount = opts.sections.filter((s) => s.kind === opts.targetKind).length;
  ctx.sequencePosition =
    opts.targetKind === "example" || opts.targetKind === "exercise" ||
    opts.targetKind === "classwork" || opts.targetKind === "homework"
      ? `This is ${opts.targetKind} number ${sameKindCount + 1} of the lesson.`
      : `This is the ${opts.targetKind} section of the lesson.`;

  return ctx;
}

export { type SectionChunk };
export { detectSectionKind };

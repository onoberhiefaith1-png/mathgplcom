import { SECTION_LABELS, SOLUTION_SECTION_KINDS, type SectionKind } from "./sectionKinds";

type Block = { kind: string; content_ascii: string | null };
type LegacySection = {
  id: string; kind: SectionKind; title?: string | null; loose: Block[];
  subsections: { id: string; blocks: Block[] }[];
};

/** Import records without turning solution working into question text.
 * Structural headings and durable ownership are required by lessonOutline.
 * This handles unconverted notes only; it never guesses repairs to old docs. */
export function legacyNotebookDocument(sections: LegacySection[]) {
  const content: any[] = [];
  const counters = new Map<string, number>();
  const heading = (kind: SectionKind, title: string, id: string, owner?: string) => {
    content.push({ type: "heading", attrs: { level: kind === "solution" ? 3 : 2,
      sessionKind: kind, sectionId: id, ...(owner ? { ownerQuestionId: owner } : {}) },
      content: [{ type: "text", text: title }] });
  };
  const lines = (blocks: Block[]) => {
    for (const b of blocks) for (const text of (b.content_ascii ?? "").split("\n")) {
      if (text.trim()) content.push({ type: "paragraph", content: [{ type: "text", text }] });
    }
  };
  for (const sec of sections) {
    if (!SOLUTION_SECTION_KINDS.has(sec.kind) || !sec.subsections.length) {
      heading(sec.kind, sec.title || SECTION_LABELS[sec.kind], sec.id);
      lines(sec.loose);
      for (const sub of sec.subsections) lines(sub.blocks);
      continue;
    }
    // Each question owns exactly one heading and one Solution, even when the
    // legacy writer stored every mathematical step as a separate block.
    for (const sub of sec.subsections) {
      const ordinal = (counters.get(sec.kind) ?? 0) + 1;
      counters.set(sec.kind, ordinal);
      heading(sec.kind, sec.title || `${SECTION_LABELS[sec.kind]} ${ordinal}`, sub.id);
      lines(sec.loose);
      lines(sub.blocks.filter(b => b.kind === "problem" || b.kind === "text"));
      heading("solution", `Solution ${ordinal}`, `${sub.id}-solution`, sub.id);
      lines(sub.blocks.filter(b => b.kind === "solution" || b.kind === "reasoning"));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

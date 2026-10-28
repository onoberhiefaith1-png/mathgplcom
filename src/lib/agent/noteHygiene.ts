// What a lesson-note line is allowed to be.
//
// The page already prints its own headings — "Example 2", "Solution", "Classwork"
// are drawn by the application. So a line of note content must never carry one of
// those words as a label, and a single line must never hold a whole worked
// example. This module is the one deterministic gate every write goes through,
// and the same gate Aura uses to mend a note that was written badly before.
//
// Pure and client-safe, so it can be tested on its own.

/** Words the application owns. A line may never begin with one as a label. */
const LABEL_WORDS = [
  "problem",
  "question",
  "solution",
  "answer",
  "working",
  "workings",
  "reasoning",
  "step",
  "line",
  "example",
  "exercise",
  "classwork",
  "class work",
  "homework",
  "home work",
  "activity",
  "task",
  "session",
  "hint",
  "explanation",
];

const LABEL = new RegExp(
  `^\\s*(?:${LABEL_WORDS.join("|")})\\s*(?:\\(?\\s*\\d{1,3}\\s*\\)?)?\\s*(?:[:.)\\-–—]+\\s*|$)`,
  "i",
);

/** Remove every structural label stacked at the front of a line. */
export function stripLabels(line: string): string {
  let out = String(line ?? "").trim();
  for (let i = 0; i < 4; i += 1) {
    const m = LABEL.exec(out);
    if (!m || !m[0]) break;
    const rest = out.slice(m[0].length).trim();
    // "Step 3: 2x = 10" → keep the maths. A bare "Solution:" → nothing left.
    out = rest;
    if (!out) break;
  }
  return out;
}

/** Strip presentation syntax the notebook never renders. */
function stripSyntax(line: string): string {
  return String(line ?? "")
    .replace(/```[a-zA-Z0-9]*/g, "")
    .replace(/`/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^\s{0,4}[-*+•]\s+/, "")
    .replace(/^\s{0,4}\d{1,2}[.)]\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

/** One clean line, or an empty string when nothing of substance is left. */
export function cleanLine(line: string): string {
  return stripLabels(stripSyntax(String(line ?? "")));
}

/**
 * Turn whatever a generator produced into the lines a note may hold: one
 * complete step per line, no labels, nothing empty.
 */
export function cleanNoteLines(raw: string): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 0);
}

/** Does this text break the rule — a label, or several lines in one block? */
export function isDirty(text: string): boolean {
  const raw = String(text ?? "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 1) return true;
  const clean = cleanNoteLines(raw);
  return clean.length !== lines.length || clean[0] !== (lines[0] ?? "").trim();
}

export type BlockLike = { id: string; kind: string; content_ascii: string; order_index: number };

export type CleanupAction =
  | { blockId: string; action: "keep" }
  | { blockId: string; action: "rewrite"; before: string; after: string }
  | { blockId: string; action: "split"; before: string; lines: string[] }
  | { blockId: string; action: "delete"; before: string };

/**
 * What mending a note would do, block by block — read-only, so it can be shown
 * to the teacher before anything changes.
 */
export function planCleanup(blocks: BlockLike[]): CleanupAction[] {
  return blocks.map((b) => {
    const before = String(b.content_ascii ?? "");
    const lines = cleanNoteLines(before);
    if (lines.length === 0) return { blockId: b.id, action: "delete", before };
    // Prose paragraphs may run over several lines; mathematics may not.
    if (b.kind === "text") {
      const joined = lines.join("\n");
      return joined === before.trim()
        ? { blockId: b.id, action: "keep" }
        : { blockId: b.id, action: "rewrite", before, after: joined };
    }
    if (lines.length > 1) return { blockId: b.id, action: "split", before, lines };
    if (lines[0] !== before.trim()) return { blockId: b.id, action: "rewrite", before, after: lines[0]! };
    return { blockId: b.id, action: "keep" };
  });
}

/** A short, plain sentence describing a plan. */
export function describeCleanup(plan: CleanupAction[]): string {
  const n = (a: CleanupAction["action"]) => plan.filter((p) => p.action === a).length;
  const parts: string[] = [];
  if (n("split")) parts.push(`${n("split")} block${n("split") === 1 ? "" : "s"} split into separate lines`);
  if (n("rewrite")) parts.push(`${n("rewrite")} label${n("rewrite") === 1 ? "" : "s"} removed`);
  if (n("delete")) parts.push(`${n("delete")} empty line${n("delete") === 1 ? "" : "s"} removed`);
  return parts.length ? parts.join(", ") : "nothing to mend — every line is already clean";
}

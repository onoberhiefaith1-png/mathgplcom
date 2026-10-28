// Classify what kind of content the teacher highlighted in the TipTap editor.
// The kind drives both the AI Edit prompt and the suggestion list shown when
// the teacher clicks Generate with an empty input box.

export type SelectionKind =
  | "solution"
  | "fraction"
  | "matrix"
  | "equation"
  | "paragraph"
  | "lesson_section";

interface PMNode {
  type?: { name?: string };
  attrs?: any;
  textContent?: string;
  content?: { content?: PMNode[]; forEach?: (cb: (n: PMNode) => void) => void };
}

function walk(node: PMNode | null | undefined, visit: (n: PMNode) => void) {
  if (!node) return;
  visit(node);
  const c = (node as any).content;
  if (c?.content) c.content.forEach((ch: PMNode) => walk(ch, visit));
  else if (c?.forEach) c.forEach((ch: PMNode) => walk(ch, visit));
}

/** Inspect the slice currently selected in a TipTap/ProseMirror editor. */
export function detectSelectionKindFromSlice(slice: {
  content: { content?: PMNode[]; forEach?: (cb: (n: PMNode) => void) => void };
}): SelectionKind {
  let hasHeading = false;
  let mathBlocks = 0;
  let mathInlines = 0;
  let paragraphs = 0;
  let latex = "";

  const wrap: PMNode = { content: slice.content as any };
  walk(wrap, (n) => {
    const name = n.type?.name;
    if (name === "heading") hasHeading = true;
    if (name === "mathBlock") { mathBlocks++; latex += " " + String(n.attrs?.value ?? ""); }
    if (name === "mathInline") { mathInlines++; latex += " " + String(n.attrs?.value ?? ""); }
    if (name === "paragraph") paragraphs++;
  });

  const text = latex.toLowerCase();
  if (/\\begin\{[pb]?matrix\}|\\bmatrix|\\pmatrix|\\vmatrix/.test(text)) return "matrix";
  if (hasHeading) return "lesson_section";
  if (mathBlocks >= 2) return "solution";
  if ((mathBlocks + mathInlines) > 0 && /\\frac|\\dfrac|\\tfrac/.test(text)) return "fraction";
  if (mathBlocks + mathInlines > 0 && paragraphs <= 1) return "equation";
  return "paragraph";
}

/** Fallback: classify a plain text snippet (used by smartboard selections). */
export function detectSelectionKindFromText(s: string): SelectionKind {
  const t = (s || "").toLowerCase();
  if (/\\begin\{[pb]?matrix\}|\\bmatrix|\\pmatrix/.test(t)) return "matrix";
  if (/\\frac|\\dfrac|\\tfrac/.test(t)) return "fraction";
  if (/\n.*\n/.test(s) && /[=\\]/.test(s)) return "solution";
  if (/[=\\^_]/.test(s)) return "equation";
  return "paragraph";
}

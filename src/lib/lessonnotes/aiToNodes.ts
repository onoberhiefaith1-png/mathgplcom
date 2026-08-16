// Convert AI-produced (or pasted) text into TipTap nodes so the teacher
// never sees raw LaTeX. Lines that are dominated by math become a
// `mathBlock`; inline math inside a sentence becomes `mathInline` runs.
//
// The renderer (`renderMathInline`) is brace-balanced and already used by
// both the lesson-note math nodes AND the AI Edit preview panel. The bug
// this module fixes is upstream of the renderer: the OLD regex-based
// tokenizer used `[^{}]*` for fraction numerators/denominators, which
// silently failed on nested braces like `\frac{3 \sqrt{5}}{2 \sqrt{5} - 1}`.
// That leaked raw `\frac` / `{` / `}` text into paragraphs while only the
// inner `\sqrt{5}` rendered. The brace-aware tokenizer below matches the
// same grammar the renderer itself parses, so what AI Edit displays in its
// preview is what lands in the document — one renderer, end to end.

import { HAS_MATH } from "@/lib/notebook/mathRender";
import { assertDisplaySafe } from "@/lib/notebook/mathDisplayGate";
import { sanitizePresentation } from "@/lib/lessonnotes/outputHygiene";
import { normalizeMathSource } from "@/lib/notebook/mathNormalize";
import { hasDirectives, splitDirectives } from "@/lib/lessonnotes/ai/materializeDirectives";

type TipTapNode = any;

/* ------------------- ONE ENGINE: no splitting, ever -------------------
 *
 * The editor used to cut a line into many small math/prose atoms. Every gap
 * a teacher saw was a seam between those atoms, not something the renderer
 * produced. That splitter is gone. A line either contains mathematics or it
 * does not; when it does, the WHOLE line becomes a single object drawn by
 * one `renderMathInline` call — byte-for-byte what the AI Edit preview does
 * (`renderMathInline` renders ordinary words inside an expression correctly,
 * which is why AI Edit has never been wrong). */

export interface Run { kind: "text" | "math"; value: string; }

/** Words that are mathematics even though they are spelled out. */
const FUNC_WORDS = new Set([
  "log", "ln", "lg", "exp", "sin", "cos", "tan", "cot", "sec", "csc",
  "sinh", "cosh", "tanh", "arcsin", "arccos", "arctan", "asin", "acos",
  "atan", "lim", "max", "min", "sup", "inf", "det", "gcd", "lcm", "mod",
  "deg", "arg", "cm", "mm", "km", "kg", "sqrt", "frac",
]);

/** Classify ONE whitespace-delimited word. Never splits a word, so `log`
 *  can never be cut into `lo` + `g`. */
function isMathWord(word: string): boolean {
  const w = word.trim();
  if (!w) return false;
  if (/^\\[A-Za-z]+/.test(w)) return true;                 // LaTeX macro
  const bare = w.replace(/^[("'\[]+|[)"'\].,;:?!]+$/g, "");
  if (!bare) return /^[^A-Za-z]+$/.test(w);                // pure punctuation run
  if (FUNC_WORDS.has(bare.toLowerCase())) return true;
  if (/^[A-Za-z]$/.test(bare)) return true;                // single-letter variable
  if (/[0-9]/.test(bare)) return true;                     // any numeral
  // Operators, relations, script markers, fences.
  if (/[=+\-−×÷·^_/<>≤≥≠≈→↔±∓√∑∏∫∞|{}]/.test(bare)) return true;
  if (/^[A-Za-z]{1,3}$/.test(bare) && /[_^]/.test(w)) return true;
  return false;
}

/** Maximal math spans: consecutive mathematical words are grown into ONE run
 *  so a complete expression is a single object, while ordinary sentence words
 *  stay real text the sensor can walk through character by character. */
export function tokenizeMathLine(line: string): Run[] {
  if (!line) return [];
  if (!HAS_MATH(line)) return [{ kind: "text", value: line }];
  // Keep the whitespace so the reassembled line is byte-identical.
  const parts = line.split(/(\s+)/);
  const runs: Run[] = [];
  const push = (kind: Run["kind"], value: string) => {
    if (!value) return;
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.value += value;
    else runs.push({ kind, value });
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (/^\s+$/.test(p)) {
      // Whitespace belongs to the math run only when it sits *between* two
      // mathematical words; otherwise it is prose spacing.
      const prev = runs[runs.length - 1];
      const nextWord = parts[i + 1] ?? "";
      const glue = prev?.kind === "math" && isMathWord(nextWord);
      push(glue ? "math" : "text", p);
      continue;
    }
    push(isMathWord(p) ? "math" : "text", p);
  }
  // A math run must actually contain mathematics; a lone `a` between prose
  // words is just an article.
  return runs.map((r) =>
    r.kind === "math" && !HAS_MATH(r.value) && r.value.trim().length <= 1
      ? { kind: "text" as const, value: r.value }
      : r,
  );
}



/* ------------------------- node assembly ------------------------- */

function stripDollars(s: string): string {
  return s.replace(/\$+/g, "");
}

/** Return true if a line is a pure calculation (no sentence prose), which
 *  renders as a centred `mathBlock`. A line carrying real sentence words
 *  stays a paragraph holding one full-line math object. */
function isMostlyMath(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!HAS_MATH(t)) return false;
  // Strip LaTeX macros, then look for prose words (4+ letters, not a
  // mathematical function name or unit).
  const bare = t.replace(/\\[A-Za-z]+/g, " ");
  const words = bare.match(/[A-Za-z]{2,}/g) ?? [];
  const prose = words.filter((w) => w.length >= 4 && !FUNC_WORDS.has(w.toLowerCase()));
  return prose.length === 0;
}

/** Prose stays real text (the sensor walks it character by character);
 *  each complete expression becomes ONE math object drawn by the same
 *  `renderMathInline` call AI Edit uses. */
function inlineMixedParagraph(line: string): TipTapNode {
  const cleaned = stripDollars(line).replace(/\s+$/, "");
  if (!cleaned.trim()) return { type: "paragraph" };
  const content: TipTapNode[] = [];
  for (const run of tokenizeMathLine(cleaned)) {
    if (run.kind === "math") {
      const v = normalizeMathSource(run.value.trim());
      if (v) content.push({ type: "mathInline", attrs: { value: v } });
      // Keep the spacing that surrounded the expression as prose.
      const trail = run.value.match(/\s+$/)?.[0];
      if (trail) content.push({ type: "text", text: " " });
      continue;
    }
    if (run.value) content.push({ type: "text", text: run.value });
  }
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** Split one AI line into the micro-steps a classroom board would show:
 *   • prose that introduces mathematics with a colon → own line
 *   • a trailing parenthesised comment ("(Apply the product rule …)") →
 *     own explanation line, so it is editable as ordinary words. */
function splitLineIntoSteps(line: string): string[] {
  let rest = line.trim();
  if (!rest) return [];
  const out: string[] = [];

  // Prose lead-in ending with a colon, followed by mathematics.
  const colon = rest.match(/^([^:]{4,}?:)\s*(\S.*)$/);
  if (colon && !HAS_MATH(colon[1]) && HAS_MATH(colon[2])) {
    out.push(colon[1].trim());
    rest = colon[2].trim();
  }

  // Trailing parenthesised prose comment.
  const comment = rest.match(/^(.*\S)\s*\(([^()]{8,})\)\s*$/);
  if (comment) {
    const head = comment[1];
    const note = comment[2];
    const proseWords = (note.match(/[A-Za-z]{3,}/g) ?? []).filter(
      (w) => !FUNC_WORDS.has(w.toLowerCase()),
    );
    if (HAS_MATH(head) && proseWords.length >= 2) {
      out.push(head.trim());
      out.push(note.trim());
      return out;
    }
  }

  out.push(rest);
  return out;
}


/** Detect lines that are ASCII pseudo-diagrams (`/\`, `____`, `|  |`, etc.).
 *  These slipped past the AI's geometry rule and would otherwise pollute
 *  the notebook. The real diagram is inserted as a `geometryDiagram` node
 *  by `DocumentEditor.requestGeometryForRange`. */
function isAsciiArtLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length < 3) return false;
  // Pure-symbol lines made of slashes / backslashes / underscores / pipes /
  // dashes / dots / spaces. Allow at most one digit/letter to permit a
  // stray label, but if the line is dominated by drawing glyphs it is art.
  const drawing = (t.match(/[\/\\_|\-=.~`*]/g) ?? []).length;
  const letters = (t.match(/[A-Za-z0-9]/g) ?? []).length;
  if (drawing >= 3 && drawing >= t.replace(/\s/g, "").length - 1 && letters <= 2) return true;
  return false;
}

/** Workspace-tool aware entry point. AI directives (`[[tool:…]]`) become the
 *  real editable workspace nodes (Smart Table, Graph, Diagram, 3D object,
 *  Calculator, Structure); everything else falls through to the text pass. */
export function aiTextToNodes(text: string): TipTapNode[] {
  if (!text) return [{ type: "paragraph" }];
  if (!hasDirectives(text)) return plainAiTextToNodes(text);
  const out: TipTapNode[] = [];
  for (const part of splitDirectives(text)) {
    if (part.kind === "node") { out.push(part.node); continue; }
    const chunk = part.text.replace(/^\n+|\n+$/g, "");
    if (!chunk.trim()) continue;
    out.push(...plainAiTextToNodes(chunk).filter((n) => !isEmptyPara(n)));
  }
  return out.length ? out : [{ type: "paragraph" }];
}

function plainAiTextToNodes(text: string): TipTapNode[] {
  if (!text) return [{ type: "paragraph" }];
  // Presentation hygiene FIRST — markdown, JSON, HTML, escape residue and AI
  // placeholders must never become notebook text.
  const hygienic = sanitizePresentation(text);
  if (!hygienic) return [{ type: "paragraph" }];
  // Display gate — last line of defence before AI text reaches the editor.
  const gated = assertDisplaySafe(hygienic);
  if (!gated.safe) {
    // eslint-disable-next-line no-console
    console.warn("[aiTextToNodes] display gate flagged AI output:", gated.reasons);
  }
  const out: TipTapNode[] = [];
  const lines = gated.cleaned.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { out.push({ type: "paragraph" }); continue; }
    if (isAsciiArtLine(line)) {
      // Drop ASCII pseudo-diagrams entirely. A real GeometryDiagram node
      // will be inserted by the editor's geometry pass.
      continue;
    }
    for (const step of splitLineIntoSteps(line)) {
      if (isMostlyMath(step)) {
        out.push({ type: "mathBlock", attrs: { value: normalizeMathSource(stripDollars(step.trim())) } });
      } else if (HAS_MATH(step)) {
        out.push(inlineMixedParagraph(step));
      } else {
        out.push({ type: "paragraph", content: [{ type: "text", text: stripDollars(step) }] });
      }
    }
  }
  return out;
}



/* ---------------- two-column (Solution | Explanation) packer ---------------- */

const isMathNode = (n: TipTapNode) => n?.type === "mathBlock";
const isEmptyPara = (n: TipTapNode) =>
  n?.type === "paragraph" && (!n.content || n.content.length === 0);

/** Group AI-produced nodes into `solutionRow` blocks so calculations sit
 *  on the left and the matching explanation on the right.
 *
 *  Heuristic per row:
 *    [optional prose paragraph][one or more mathBlocks][optional trailing
 *    short paragraph that explains the result] → one row.
 *
 *  Standalone narrative with no nearby math stays as a full-width paragraph
 *  outside any row, so section intros ("Recall: i² = -1.") still flow
 *  naturally above the worked steps. */
export function aiTextToSolutionRows(text: string): TipTapNode[] {
  const flat = aiTextToNodes(text).filter((n) => !isEmptyPara(n));
  const out: TipTapNode[] = [];
  let i = 0;
  while (i < flat.length) {
    const node = flat[i];
    if (isMathNode(node)) {
      // Look back for a leading prose paragraph (the "why" of this step).
      let prose: TipTapNode | null = null;
      if (out.length) {
        const prev = out[out.length - 1];
        if (prev.type === "paragraph") { prose = prev; out.pop(); }
      }
      // Collect contiguous math lines into the left cell.
      const math: TipTapNode[] = [];
      while (i < flat.length && isMathNode(flat[i])) { math.push(flat[i]); i++; }
      // Look ahead for a single trailing prose paragraph that belongs to
      // this step (e.g. "Split into real and imaginary parts:").
      if (!prose && i < flat.length && flat[i].type === "paragraph") {
        // Only attach if the next-next node is math or end of stream, so we
        // don't swallow an intro paragraph for the next row.
        const after = flat[i + 1];
        if (!after || isMathNode(after)) { prose = flat[i]; i++; }
      }
      out.push({
        type: "solutionRow",
        content: [
          { type: "solutionMath", content: math },
          { type: "solutionProse", content: [prose ?? { type: "paragraph" }] },
        ],
      });
    } else {
      // Plain prose with no associated math — keep full-width.
      out.push(node);
      i++;
    }
  }
  return out.length ? out : [{ type: "paragraph" }];
}

/* ------------------------- repair migration ------------------------- */

/** Walk a TipTap document and rebuild any paragraph whose plain text still
 *  contains raw LaTeX-ish markup (`\frac`, `\sqrt`, `^{`, `_{`, …). This
 *  repairs notebooks written before the brace-aware tokenizer existed so
 *  teachers don't have to re-type anything. Returns `{ doc, changed }`. */
export function repairDocumentMath(doc: any): { doc: any; changed: boolean } {
  if (!doc || typeof doc !== "object") return { doc, changed: false };
  let changed = false;

  const needsRepair = (text: string): boolean => {
    if (!text) return false;
    // Any backslash macro, script markers, dollar delimiters, code-style
    // roots/powers or a bare `x_2` / `x^2` in prose is raw syntax and must
    // never be displayed as text.
    return /\\[A-Za-z]+/.test(text)
      || /[\^_]\{/.test(text)
      || /[A-Za-z0-9)\]}][\^_][A-Za-z0-9(]/.test(text)
      || /\$/.test(text)
      || /\b(?:sqrt|frac|log|ln|sin|cos|tan)\s*\(/.test(text)
      || /\*\*/.test(text);
  };

  /** Flatten a paragraph made only of text + mathInline runs back to source.
   *  Any other child type aborts (we must not lose a node view). */
  const flattenSource = (content: any[]): string | null => {
    let out = "";
    for (const c of content) {
      if (c?.type === "text") { out += c.text ?? ""; continue; }
      if (c?.type === "mathInline") { out += (c.attrs?.value ?? ""); continue; }
      return null;
    }
    return out;
  };

  const rebuildParagraph = (node: any, source: string) => {
    changed = true;
    const rebuilt = aiTextToNodes(source);
    if (rebuilt.length === 1 && rebuilt[0].type === "paragraph") {
      return { ...node, content: rebuilt[0].content ?? [] };
    }
    if (rebuilt.length === 1) return rebuilt[0];
    const inline = rebuilt.flatMap((b: any) => b.content ?? []).filter(Boolean);
    return { ...node, content: inline };
  };

  const visit = (node: any): any => {
    if (!node || typeof node !== "object") return node;
    // Paragraph: if any child text needs repair, retokenize the whole text.
    if (node.type === "paragraph" && Array.isArray(node.content)) {
      // Only repair if children are all plain text/marks (no node views to lose).
      const allText = node.content.every((c: any) => c?.type === "text");
      if (allText) {
        const fullText = node.content.map((c: any) => c.text ?? "").join("");
        if (needsRepair(fullText)) return rebuildParagraph(node, fullText);
      } else {
        // Mixed text + math runs: a line fragmented into several atoms
        // (`lo` + `g_2` + `(M × N) = …`) is re-grouped into ONE full-line
        // object so the renderer controls every gap.
        const hasMath = node.content.some((c: any) => c?.type === "mathInline");
        const source = hasMath ? flattenSource(node.content) : null;
        if (source) {
          const alreadyOne =
            node.content.length === 1 &&
            node.content[0]?.type === "mathInline" &&
            (node.content[0].attrs?.value ?? "") === normalizeMathSource(stripDollars(source));
          if (!alreadyOne) return rebuildParagraph(node, source);
        }
      }

    }

    if (Array.isArray(node.content)) {
      const next = node.content.map(visit);
      return { ...node, content: next };
    }
    return node;
  };

  const repaired = visit(doc);
  return { doc: repaired, changed };
}

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

/* ------------------------- brace-aware reader ------------------------- */

/** Read a brace-balanced `{...}` group starting at `start` (must be `{`). */
function readBraced(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 1;
  let j = start + 1;
  while (j < src.length && depth > 0) {
    const ch = src[j];
    if (ch === "\\") { j += 2; continue; } // skip escaped char
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) break; }
    j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

function readBracket(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "[") return null;
  let j = start + 1;
  while (j < src.length && src[j] !== "]") j++;
  if (src[j] !== "]") return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

const TWO_ARG = new Set(["frac", "binom", "dfrac", "tfrac"]);
const ONE_ARG = new Set([
  "sqrt", "sl", "vec", "hat", "bar", "tilde", "dot",
  "abs", "norm", "floor", "ceil", "overline", "underline",
]);
const LOG_NAMES = new Set(["log", "ln", "lg"]);
const BIG_OPS = new Set(["sum", "prod", "int", "oint", "lim"]);

export interface Run { kind: "text" | "math"; value: string; }

/** Function names that must be read as ONE word. Splitting `log` into `lo` +
 *  `g_2` was the exact cause of the broken spacing in lesson notes. */
const FUNC_WORDS = new Set([
  "log", "ln", "lg", "exp", "sin", "cos", "tan", "cot", "sec", "csc",
  "sinh", "cosh", "tanh", "arcsin", "arccos", "arctan", "asin", "acos",
  "atan", "lim", "max", "min", "sup", "inf", "det", "gcd", "lcm", "mod",
  "deg", "arg", "Pr",
]);

/** Characters that behave as mathematical operators/relations. */
const OPERATOR_CH = new Set([
  "=", "+", "-", "−", "±", "∓", "×", "·", "÷", "*", "/", "^", "_",
  "<", ">", "≤", "≥", "≠", "≈", "≡", "→", "←", "↔", "⇒", "⇔", "∴", "∈", "∉",
  "%", "!", "′",
]);
const BRACKET_CH = new Set(["(", ")", "[", "]", "{", "}", "|", "⟨", "⟩"]);

type TokKind = "space" | "math" | "prose" | "stop";
interface Tok { s: number; e: number; k: TokKind; }

/** Consume `_x` / `^{...}` scripts starting at `i`; returns new index. */
function readScripts(src: string, i: number): number {
  let q = i;
  for (let pass = 0; pass < 2; pass++) {
    if (src[q] !== "_" && src[q] !== "^") break;
    const after = q + 1;
    if (src[after] === "{") {
      const a = readBraced(src, after);
      if (!a) break;
      q = a.end;
      continue;
    }
    if (/[A-Za-z0-9+\-−]/.test(src[after] || "")) { q = after + 1; continue; }
    break;
  }
  return q;
}

/** Consume a `\macro` together with its arguments and any scripts. */
function readMacro(src: string, i: number): number {
  const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
  if (!m) return i + 1;
  const name = m[1];
  let q = i + 1 + name.length;
  const skipSpace = () => { while (src[q] === " ") q++; };
  if (TWO_ARG.has(name)) {
    skipSpace();
    const a = readBraced(src, q);
    if (a) {
      let r = a.end;
      while (src[r] === " ") r++;
      const b = readBraced(src, r);
      q = b ? b.end : a.end;
    }
  } else if (ONE_ARG.has(name)) {
    if (name === "sqrt") {
      skipSpace();
      if (src[q] === "[") { const o = readBracket(src, q); if (o) q = o.end; }
    }
    skipSpace();
    const a = readBraced(src, q);
    if (a) q = a.end;
  } else if (LOG_NAMES.has(name) || BIG_OPS.has(name)) {
    q = readScripts(src, q);
  } else {
    q = readScripts(src, q);
  }
  return q;
}

/** Scan a line into classified tokens. */
function scanTokens(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (/\s/.test(ch)) {
      let j = i; while (j < line.length && /\s/.test(line[j])) j++;
      out.push({ s: i, e: j, k: "space" }); i = j; continue;
    }
    if (ch === "\\") {
      const e = readMacro(line, i);
      out.push({ s: i, e, k: "math" }); i = e; continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const w = /^[A-Za-z]+/.exec(line.slice(i))![0];
      let j = i + w.length;
      const afterScripts = readScripts(line, j);
      const scripted = afterScripts > j;
      j = afterScripts;
      const isMath = scripted || w.length === 1 || FUNC_WORDS.has(w) || FUNC_WORDS.has(w.toLowerCase());
      out.push({ s: i, e: j, k: isMath ? "math" : "prose" }); i = j; continue;
    }
    if (/[0-9]/.test(ch)) {
      const n = /^[0-9]+(?:[.,][0-9]+)*/.exec(line.slice(i))![0];
      const j = readScripts(line, i + n.length);
      out.push({ s: i, e: j, k: "math" }); i = j; continue;
    }
    if (OPERATOR_CH.has(ch) || BRACKET_CH.has(ch)) {
      const j = readScripts(line, i + 1);
      out.push({ s: i, e: j, k: "math" }); i = j; continue;
    }
    // Sentence punctuation and anything else terminates a math span.
    out.push({ s: i, e: i + 1, k: "stop" }); i = i + 1; continue;
  }
  return out;
}

/** A grouped span is only treated as mathematics if it carries a real math
 *  signal — a structure macro, a script, or an operator/relation. This keeps
 *  ordinary prose numbers ("5 apples") as text. */
function hasMathSignal(v: string): boolean {
  if (/\\[A-Za-z]/.test(v)) return true;
  if (/[\^_]/.test(v)) return true;
  for (const ch of v) if (OPERATOR_CH.has(ch)) return true;
  return false;
}

/**
 * Segment a line into maximal math spans and prose. Adjacent mathematical
 * tokens (function names, operands, operators, brackets, structures) are
 * grouped into ONE math run so the whole expression is drawn by a single
 * `renderMathInline` call — exactly what the AI Edit preview does.
 */
export function tokenizeMathLine(line: string): Run[] {
  const toks = scanTokens(line);
  const runs: Run[] = [];
  let text = "";
  const pushText = (v: string) => { if (v) text += v; };
  const flushText = () => { if (text) { runs.push({ kind: "text", value: text }); text = ""; } };

  let i = 0;
  while (i < toks.length) {
    const t = toks[i];
    // A short/all-caps operand word directly followed by mathematics starts
    // the span too (`MN = 5`, `AB^2`).
    const startsSpan = t.k === "math" || (() => {
      if (t.k !== "prose") return false;
      const word = line.slice(t.s, t.e);
      const next = toks[i + 1];
      if (!next) return false;
      if (next.k === "math" && next.s === t.e) {
        return word.length <= 3 || /^[A-Z]+$/.test(word);
      }
      // All-caps label separated by a space: `MN = 5`.
      if (!/^[A-Z]{2,}$/.test(word)) return false;
      let k = i + 1;
      while (k < toks.length && toks[k].k === "space") k++;
      return k < toks.length && toks[k].k === "math";
    })();
    if (!startsSpan) { pushText(line.slice(t.s, t.e)); i++; continue; }


    // Grow the span: math tokens, plus interior whitespace when another math
    // token follows it.
    let end = i;
    let j = i + 1;
    while (j < toks.length) {
      const n = toks[j];
      if (n.k === "math") { end = j; j++; continue; }
      if (n.k === "prose") {
        // A short operand word glued to the mathematics (no whitespace)
        // belongs to the expression: `\log_{2}(MN)`, `\frac{1}{2}bh`.
        const prev = toks[j - 1];
        const next = toks[j + 1];
        const gluedLeft = !!prev && prev.e === n.s;
        const gluedRight = !!next && next.k === "math" && next.s === n.e;
        const word = line.slice(n.s, n.e);
        const short = word.length <= 3 || /^[A-Z]+$/.test(word);
        if (gluedLeft && short && (gluedRight || !next || next.k !== "prose")) {
          end = j; j++; continue;
        }
        break;
      }
      if (n.k === "space") {
        // Interior space only if the next non-space token is math.
        let k = j;
        while (k < toks.length && toks[k].k === "space") k++;
        if (k < toks.length && toks[k].k === "math") { j = k; continue; }
        break;
      }
      break;
    }

    const value = line.slice(toks[i].s, toks[end].e);
    if (hasMathSignal(value)) {
      flushText();
      runs.push({ kind: "math", value });
    } else {
      pushText(value);
    }
    i = end + 1;
  }
  flushText();
  return runs;
}


/* ------------------------- node assembly ------------------------- */

function stripDollars(s: string): string {
  return s.replace(/\$+/g, "");
}

/** Return true if a line is "mostly math" — short, with little non-math
 *  text after the math runs are removed. Such lines render as `mathBlock`. */
function isMostlyMath(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (!HAS_MATH(t)) return false;
  const runs = tokenizeMathLine(t);
  const textOnly = runs
    .filter((r) => r.kind === "text")
    .map((r) => r.value)
    .join("")
    .replace(/[=+\-−×÷·^_(){}[\]\d\s.,]/g, "");
  return textOnly.length <= Math.max(4, Math.floor(t.length * 0.15));
}

function inlineMixedParagraph(line: string): TipTapNode {
  const cleaned = stripDollars(line);
  const runs = tokenizeMathLine(cleaned);
  const content: TipTapNode[] = [];
  for (const r of runs) {
    if (r.kind === "math") {
      content.push({ type: "mathInline", attrs: { value: normalizeMathSource(r.value) } });
    } else if (r.value) {
      content.push({ type: "text", text: r.value });
    }
  }
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
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
    if (isMostlyMath(line)) {
      out.push({ type: "mathBlock", attrs: { value: normalizeMathSource(stripDollars(line.trim())) } });
    } else if (HAS_MATH(line)) {
      out.push(inlineMixedParagraph(line));
    } else {
      out.push({ type: "paragraph", content: [{ type: "text", text: stripDollars(line) }] });
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
    return /\\(?:frac|sqrt|binom|vec|hat|bar|tilde|dot|sl|abs|norm|floor|ceil|sum|prod|int|oint|lim|log|ln|lg|left|right|begin|end|cdot|times|pm|leq|geq|neq|infty|to|approx|alpha|beta|gamma|delta|theta|pi|sigma|mu|lambda|phi|omega)\b/.test(text)
      || /[\^_]\{/.test(text);
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
        // Mixed text + math runs: an expression fragmented into several math
        // atoms (`lo` + `g_2` + `(M × N) = …`) is re-grouped into ONE math
        // object so the renderer controls every gap.
        const hasMath = node.content.some((c: any) => c?.type === "mathInline");
        const source = hasMath ? flattenSource(node.content) : null;
        if (source) {
          const runs = tokenizeMathLine(source);
          const differs =
            runs.length !== node.content.length ||
            runs.some((r, idx) => {
              const c = node.content[idx];
              if (r.kind === "math") return c?.type !== "mathInline" || (c.attrs?.value ?? "") !== r.value;
              return c?.type !== "text" || (c.text ?? "") !== r.value;
            });
          if (differs) return rebuildParagraph(node, source);
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

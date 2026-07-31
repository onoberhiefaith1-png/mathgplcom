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

/** Brace-aware tokenizer. Splits a line into text/math runs that mirror
 *  the grammar accepted by `renderMathInline`. */
export function tokenizeMathLine(line: string): Run[] {
  const runs: Run[] = [];
  let buf = "";
  let i = 0;
  const flushText = () => {
    if (buf) { runs.push({ kind: "text", value: buf }); buf = ""; }
  };
  const pushMath = (v: string) => { flushText(); runs.push({ kind: "math", value: v }); };

  while (i < line.length) {
    const ch = line[i];

    // ---------- backslash macros ----------
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(line.slice(i));
      if (!m) { buf += ch; i++; continue; }
      const name = m[1];
      let p = i + 1 + name.length;

      // \frac{..}{..}, \binom{..}{..}
      if (TWO_ARG.has(name)) {
        let q = p;
        while (line[q] === " ") q++;
        const a = readBraced(line, q);
        if (!a) { buf += line.slice(i, p); i = p; continue; }
        let r = a.end;
        while (line[r] === " ") r++;
        const b = readBraced(line, r);
        if (!b) { buf += line.slice(i, p); i = p; continue; }
        pushMath(line.slice(i, b.end));
        i = b.end;
        continue;
      }

      // \sqrt[..]{..} / \sl{..} / \vec{..} / etc.
      if (ONE_ARG.has(name)) {
        let q = p;
        if (name === "sqrt" && line[q] === "[") {
          const o = readBracket(line, q);
          if (o) q = o.end;
        }
        while (line[q] === " ") q++;
        const a = readBraced(line, q);
        if (!a) { buf += line.slice(i, p); i = p; continue; }
        pushMath(line.slice(i, a.end));
        i = a.end;
        continue;
      }

      // \log_{..} | \log_X | bare \log
      if (LOG_NAMES.has(name)) {
        let q = p;
        if (line[q] === "_") {
          q++;
          if (line[q] === "{") {
            const a = readBraced(line, q);
            if (a) { pushMath(line.slice(i, a.end)); i = a.end; continue; }
          } else if (/[A-Za-z0-9]/.test(line[q] || "")) {
            pushMath(line.slice(i, q + 1)); i = q + 1; continue;
          }
        }
        pushMath(line.slice(i, p)); i = p; continue;
      }

      // \sum | \int | \prod | \oint | \lim with optional _{..}^{..}
      if (BIG_OPS.has(name)) {
        let q = p;
        for (let pass = 0; pass < 2; pass++) {
          while (line[q] === " ") q++;
          if ((line[q] === "_" || line[q] === "^") && line[q + 1] === "{") {
            const a = readBraced(line, q + 1);
            if (a) { q = a.end; continue; }
          }
          break;
        }
        pushMath(line.slice(i, q)); i = q; continue;
      }

      // generic \word (greek/macros)
      pushMath(line.slice(i, p));
      i = p;
      continue;
    }

    // ---------- X^{..} | X_{..} | X^N | X_N ----------
    if (/[A-Za-z0-9)\]]/.test(ch)) {
      const next = line[i + 1];
      if (next === "^" || next === "_") {
        const op = next;
        let q = i + 2;
        if (line[q] === "{") {
          const a = readBraced(line, q);
          if (a) { pushMath(`${ch}${op}{${a.inner}}`); i = a.end; continue; }
        } else if (/[A-Za-z0-9]/.test(line[q] || "")) {
          pushMath(`${ch}${op}${line[q]}`); i = q + 1; continue;
        }
      }
    }

    buf += ch;
    i++;
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

  const visit = (node: any): any => {
    if (!node || typeof node !== "object") return node;
    // Paragraph: if any child text needs repair, retokenize the whole text.
    if (node.type === "paragraph" && Array.isArray(node.content)) {
      // Only repair if children are all plain text/marks (no node views to lose).
      const allText = node.content.every((c: any) => c?.type === "text");
      if (allText) {
        const fullText = node.content.map((c: any) => c.text ?? "").join("");
        if (needsRepair(fullText)) {
          changed = true;
          const rebuilt = aiTextToNodes(fullText);
          // aiTextToNodes returns one or more block nodes; if it returns a
          // single paragraph, swap content; otherwise return the first block
          // (we can't replace a single paragraph with many blocks from inside
          // visit, so wrap into a paragraph by flattening inline content).
          if (rebuilt.length === 1 && rebuilt[0].type === "paragraph") {
            return { ...node, content: rebuilt[0].content ?? [] };
          }
          // Promote to mathBlock if AI tokenizer chose that.
          if (rebuilt.length === 1) return rebuilt[0];
          // Multi-line edge case: keep as paragraph with mixed runs only.
          const inline = rebuilt
            .flatMap((b: any) => b.content ?? [])
            .filter(Boolean);
          return { ...node, content: inline };
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

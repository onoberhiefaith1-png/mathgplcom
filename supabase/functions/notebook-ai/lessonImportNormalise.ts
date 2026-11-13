// Lesson-import normalisation.
//
// Regression (2026-11-04 e1be5b268 and 2026-11-05 f4e2e06ed):
// Preserve started refusing any paste whose labels were not exactly
// "Question <digits>" / "Beginner Practice", and every compose result was
// then forced through the session arranger. A Markdown export — doubled
// `\\(` delimiters, `\<`, `#` headings, ``` number-line fences, "Question V1"
// — missed that gate, so the model was asked to keep every sentence and the
// arranger then saw the headings only after hygiene had stripped the `#`.
// The title fell into an invented Introduction and "Question V1" was left
// as a second label under an invented Question 1. `repairPreserveNotation`
// never ran, so `\(`, `\boxed`, `\ge` and `\le` reached the page.
//
// Previously-good pastes (plain `\(`, `$...$`, "Question 1.", "Beginner
// Practice") still arranged. This module is the shared gate both Preserve
// and Generate run before a lesson is shown or saved: unescape the export,
// keep number lines legible, then the arranger can see the real sections.

const ROW = "\uE010";
const ROW_RE = new RegExp(ROW, "g");

/** Markdown export writes one visible backslash as two, and a LaTeX row
 *  break (`\\`) as four. Collapse that without touching a real `\frac`. */
export function unescapeMarkdownLatex(input: string): string {
  let s = String(input ?? "");
  // \\\\[5pt] (four or more backslashes, optional spacing) is a row break.
  s = s.replace(/\\{4,}(?:\[\s*\d+(?:\.\d+)?\s*(?:pt|em|ex|mu|mm|cm)\s*\])?/g, ROW);
  // \\( \\) \\[ \\] — but not a row break `\\[5pt]`.
  s = s.replace(/\\{2,}(\(|\)|\])/g, "\\$1");
  s = s.replace(/\\{2,}\[(?!\s*\d)/g, "\\[");
  // A leftover run (`\\\ `) is still a row break, not three literal slashes.
  s = s.replace(/\\{2,}/g, ROW);
  s = s.replace(/\\([<>])/g, "$1");
  s = s.replace(ROW_RE, "\\\\");
  return s;
}

function unwrapBoxed(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const m = /^\\boxed\s*\{/.exec(src.slice(i));
    if (!m) {
      out += src[i];
      i += 1;
      continue;
    }
    const start = i + m[0].length;
    let depth = 1;
    let j = start;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") depth -= 1;
      if (depth) j += 1;
    }
    if (depth !== 0) {
      out += src[i];
      i += 1;
      continue;
    }
    out += unwrapBoxed(src.slice(start, j));
    i = j + 1;
  }
  return out;
}

const PROTECTED_LINE = /[\u00a0←→─═○●]|\[\[tool:/;

/** Apply a rewrite only outside `\begin{...}...\end{...}` so matrix row
 *  breaks are not treated as stray escapes. */
function mapOutsideEnvironments(src: string, fn: (part: string) => string): string {
  const re = /\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\}/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out += fn(src.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(src.slice(last));
}

function collapseLooseSpaces(text: string): string {
  return text
    .split("\n")
    .map((line) => (PROTECTED_LINE.test(line) ? line : line.replace(/[ \t]{2,}/g, " ")))
    .join("\n");
}

/** Copy-paste / Markdown-export damage only. Sentences and values stay. */
export function repairLessonNotation(input: string): string {
  let s = unescapeMarkdownLatex(input);
  s = s.replace(/\{,\}/g, ",");
  s = s.replace(/\\\[\s*\d+(?:\.\d+)?\s*(?:pt|em|ex|mu|mm|cm)\s*\]/g, "\\\\");
  s = unwrapBoxed(s);
  s = s.replace(/\\(?:dfrac|tfrac)\b/g, "\\frac");
  s = s.replace(/\\mathbb\s*\{([A-Za-z])\}/g, (_m, ch: string) => {
    const board: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };
    return board[ch] ?? ch;
  });
  s = s.replace(/\\(?:varnothing|emptyset)\b/g, "∅");
  const op = (name: string, glyph: string) => {
    s = s.replace(new RegExp(`\\\\${name}(?![A-Za-z])`, "g"), glyph);
  };
  op("qquad", " ");
  op("quad", " ");
  op("times", "×");
  op("cdot", "·");
  op("neq", "≠");
  op("ne", "≠");
  op("leq", "≤");
  op("le", "≤");
  op("geq", "≥");
  op("ge", "≥");
  op("pm", "±");
  op("div", "÷");
  op("in", "∈");
  s = s.replace(/\\[,;:!]/g, " ");
  // A single `\` before a space is export residue. Inside a matrix or cases
  // environment that same `\` is the row break unicode-math leaves behind,
  // and `\\ ` is a cases row break. Leave both of those alone.
  s = mapOutsideEnvironments(s, (part) => part.replace(/(?<!\\)\\(?=\s)/g, ""));
  // Delimiters, after row breaks have been kept as `\\`.
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner: string) => inner);
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner: string) => inner);
  s = s.replace(/\\\(|\\\)|\\\[|\\\]/g, "");
  s = collapseLooseSpaces(s);
  s = s.replace(/^[ \t]+|[ \t]+$/gm, (lead) => (lead.includes("\u00a0") ? lead : ""));
  return s;
}

export function lessonImportDefects(text: string): string[] {
  const defects: string[] = [];
  if (/\\{2,}[()[\]]|\\\(|\\\)|\\\[|\\\]|\\boxed\b/.test(text)) {
    defects.push("raw LaTeX delimiters are still visible");
  }
  return defects;
}

type ParsedLine = { value: number; label: string; col: number };

function parseNumberTokens(row: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const re = /-?\d+(?:\/\d+)?(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(row))) {
    const label = m[0];
    const value = label.includes("/")
      ? Number(label.split("/")[0]) / Number(label.split("/")[1])
      : Number(label);
    if (!Number.isFinite(value)) return [];
    out.push({ value, label, col: m.index });
  }
  return out;
}

/** A fenced ASCII number line becomes a real number-line object when the
 *  ticks are evenly spaced, and a monospaced block otherwise. */
function numberLineFromFence(body: string): string | null {
  const lines = body.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
  const ray = lines.find((l) => /[←→]/.test(l) && /[─═○●]/.test(l));
  const nums = lines.find((l) => l !== ray && /\d/.test(l));
  if (!ray || !nums) return null;
  const tokens = parseNumberTokens(nums);
  if (tokens.length < 2) return null;
  const circle = ray.search(/[○●]/);
  const mode = circle < 0 ? "none" : ray[circle] === "●" ? "closed" : "open";
  const left = circle < 0 ? ray : ray.slice(0, circle);
  const right = circle < 0 ? "" : ray.slice(circle + 1);
  const shaded = (part: string) => (part.match(/═/g) ?? []).length >= 3;
  let shade = "none";
  if (circle < 0) shade = shaded(ray) ? "all" : "none";
  else if (shaded(left) && shaded(right)) shade = "all";
  else if (shaded(left)) shade = "left";
  else if (shaded(right)) shade = "right";
  const ints = tokens.every((t) => Number.isInteger(t.value));
  const step = tokens[1].value - tokens[0].value;
  const uniform = ints && step !== 0 && tokens.every((t, i) =>
    Math.abs(t.value - (tokens[0].value + i * step)) < 1e-6,
  );
  if (!uniform) return null;
  let marker = tokens[Math.floor(tokens.length / 2)].value;
  if (circle >= 0) {
    const start = ray.search(/[←─═○●→]/);
    const end = ray.split("").reduce((at, ch, i) => (/[←─═○●→]/.test(ch) ? i : at), start);
    const span = Math.max(1, end - start);
    const frac = (circle - start) / span;
    const target = tokens[0].col + frac * (tokens[tokens.length - 1].col - tokens[0].col);
    let best = tokens[0];
    for (const t of tokens) {
      if (Math.abs(t.col - target) < Math.abs(best.col - target)) best = t;
    }
    marker = best.value;
  }
  const ticks = tokens.map((t) => t.label).join(",");
  const min = tokens[0].value;
  const max = tokens[tokens.length - 1].value;
  return `[[tool:numberline min="${min}" max="${max}" marker="${marker}" step="${step}" mode="${mode}" shade="${shade}" ticks="${ticks}"]]`;
}

function keepMonospace(body: string): string {
  return body
    .split("\n")
    .map((line) => line.replace(/[ \t]/g, "\u00a0"))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Fenced number lines are lifted out before hygiene deletes the fence and
 *  collapses the spaces that keep the ticks aligned. */
export function protectNumberLineFences(input: string): string {
  return String(input ?? "").replace(/```[a-zA-Z0-9]*[ \t]*\n([\s\S]*?)```/g, (whole, body: string) => {
    if (!/[←→─═○●]/.test(body)) return whole;
    return numberLineFromFence(body) ?? keepMonospace(body);
  });
}

/** Normalise a pasted or uploaded lesson before Preserve or Generate reads it. */
export function prepareLessonImport(input: string): string {
  const text = String(input ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  return protectNumberLineFences(unescapeMarkdownLatex(text));
}

/** A line the number-line fence kept as aligned text (not a rendered line). */
export function isProtectedNumberLine(line: string): boolean {
  if (/[←→]/.test(line) && /[─═○●]/.test(line)) return true;
  if (/\u00a0/.test(line) && /\d/.test(line) && !/[A-Za-z]{4,}/.test(line)) return true;
  return false;
}

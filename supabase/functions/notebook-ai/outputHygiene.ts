// OUTPUT HYGIENE — deterministic presentation cleaner.
//
// The teacher must NEVER see raw syntax: markdown, JSON envelopes, code
// fences, escape residue, AI placeholders or internal formatting tags.
// This module is the final, non-negotiable pass applied to every string the
// notebook-ai function returns. It runs AFTER the model self-correction loop
// and AFTER hardStripMath, so nothing can bypass it.
//
// IMPORTANT: the renderer-safe math templates (\frac{}{}, \sqrt{}, \sqrt[n]{},
// x^{n}, x_{n}, \sl{}) are intentionally preserved — they are converted into
// real stacked math by the client renderer and are not "raw syntax".

/** control character → macro tails it can begin. JSON transport can eat the
 *  backslash of a macro (`\frac` → FORM FEED + "rac"), which used to reach the
 *  page as `rac140°2` beside an empty fraction bar. */
const MACRO_TAILS: Record<string, string[]> = {
  "\f": ["frac", "floor", "forall"],
  "\b": ["binom", "bar", "begin", "bigcup", "bigcap", "beta", "bmatrix"],
  "\v": ["vec", "vmatrix"],
  "\t": ["times", "tfrac", "tilde", "theta", "to", "tan", "text"],
  "\r": ["right", "rightarrow", "rho"],
  "\n": ["neq", "norm", "newline", "nu"],
  "\x07": ["alpha", "approx", "abs", "array", "angle"],
};

/** Last-resort recovery when even the control character is gone, so only the
 *  macro tail survives (`rac{3x}{3}`). Conservative: word boundary + brace, so
 *  ordinary words ("racing", "times") are never rewritten. */
const RESIDUE: Array<[RegExp, string]> = [
  [/(?<![A-Za-z\\])rac(?=\s*\{)/g, "\\frac"],
  [/(?<![A-Za-z\\])frac(?=\s*\{)/g, "\\frac"],
  [/(?<![A-Za-z\\])qrt(?=\s*[{[])/g, "\\sqrt"],
  [/(?<![A-Za-z\\])inom(?=\s*\{)/g, "\\binom"],
  [/(?<![A-Za-z\\])ec(?=\s*\{)/g, "\\vec"],
  [/(?<![A-Za-z\\])imes(?![A-Za-z])/g, "\\times"],
];

export function recoverMacroResidue(input: string): string {
  if (!input) return "";
  let out = input;
  for (const [re, rep] of RESIDUE) out = out.replace(re, rep);
  return out.replace(/\\{2,}(frac|sqrt|binom|vec|times)/g, "\\$1");
}

export function repairMangledMacros(input: string): string {
  if (!input) return "";
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const tails = MACRO_TAILS[ch];
    if (tails) {
      const rest = input.slice(i + 1);
      const hit = tails
        .filter((t) => rest.startsWith(t.slice(1)) && !/^[A-Za-z]/.test(rest.slice(t.length - 1)))
        .sort((a, b) => b.length - a.length)[0];
      if (hit) {
        out += `\\${hit}`;
        i += hit.length - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/** Unwrap an accidental JSON envelope such as {"content": "..."} or ["a","b"]. */
const unwrapJson = (s: string): string => {
  const t = s.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return s;
  try {
    const parsed = JSON.parse(t);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : ""))
        .filter(Boolean)
        .join("\n");
    }
    if (parsed && typeof parsed === "object") {
      for (const key of ["content", "text", "output", "result", "answer", "solution"]) {
        const v = (parsed as Record<string, unknown>)[key];
        if (typeof v === "string") return v;
        if (Array.isArray(v)) {
          return v.filter((x) => typeof x === "string").join("\n");
        }
      }
      // Unknown object shape — flatten its string values rather than printing JSON.
      const vals = Object.values(parsed).filter((v) => typeof v === "string") as string[];
      if (vals.length) return vals.join("\n");
    }
  } catch {
    /* not valid JSON — fall through and treat as prose */
  }
  return s;
};

/** Decode escape residue that leaked out of a JSON string. */
const decodeEscapes = (s: string): string =>
  s
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\u00a0/gi, " ");

/** Strip markdown syntax while keeping the words. */
const stripMarkdown = (s: string): string => {
  let out = s;
  // Fenced code blocks anywhere — keep the inner text, drop the fences.
  out = out.replace(/```[a-zA-Z0-9]*\n?/g, "").replace(/```/g, "");
  out = out.replace(/~~~[a-zA-Z0-9]*\n?/g, "").replace(/~~~/g, "");
  // Inline code ticks.
  out = out.replace(/`([^`\n]*)`/g, "$1").replace(/`/g, "");
  // Bold / italic markers (never valid maths markup in this system).
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1");
  out = out.replace(/___([^_\n]+)___/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/~~([^~\n]+)~~/g, "$1");
  // Stray unmatched emphasis markers.
  out = out.replace(/\*\*/g, "").replace(/(?<![\w{[(^_])\*(?![\w*])/g, "");
  // Headings and blockquotes at line start.
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "");
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  // Markdown bullets → plain lines (the notebook has no bullet styling).
  out = out.replace(/^[ \t]{0,4}[-*+][ \t]+/gm, "");
  // Horizontal rules.
  out = out.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");
  // Markdown tables → space separated cells.
  out = out.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/gm, "");
  out = out.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row: string) =>
    row.split("|").map((c) => c.trim()).filter(Boolean).join("   "),
  );
  // Markdown links / images → visible label only.
  out = out.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1");
  return out;
};

/** Remove HTML tags and internal formatting/placeholder tokens. */
const stripTagsAndPlaceholders = (s: string): string => {
  let out = s;
  // HTML tags (but never `<`/`>` used as maths comparison operators).
  out = out.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/g, "");
  // Handlebars / template variables.
  out = out.replace(/\{\{[^{}]*\}\}/g, "");
  // AI placeholders like [insert value], [your answer here], [TODO: ...].
  out = out.replace(/\[(?:insert|your|add|todo|placeholder|tbd|fill)[^\]\n]*\]/gi, "");
  out = out.replace(/\bTODO\b:?/g, "");
  // Internal role/label prefixes at line start.
  out = out.replace(/^[ \t]*(?:Solution|Answer|Problem|Question|Reasoning|Output|Response|Note to self)\s*:\s*/gim, "");
  // Stray XML-ish markers our own prompts use internally.
  out = out.replace(/\b(?:ACTIVE_QUESTION|QUESTION_LOCK|LESSON SO FAR|HIDDEN DRAFT)\b\s*:?\s*/g, "");
  return out;
};

const tidyWhitespace = (s: string): string =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Full presentation sanitiser. Deterministic, idempotent, never throws.
 */
export function sanitizePresentation(input: string): string {
  if (!input) return "";
  let out = unwrapJson(input);
  out = repairMangledMacros(out);
  out = decodeEscapes(out);
  out = stripMarkdown(out);
  out = stripTagsAndPlaceholders(out);
  out = tidyWhitespace(out);
  return out;
}

/** Structural label family owned by the APPLICATION, never by the AI. */
const LABEL_WORDS = [
  "example", "exercise", "classwork", "class work", "homework", "home work",
  "question", "problem", "solution", "answer", "working", "workings",
  "assessment", "quiz", "test", "activity", "task", "session",
];
const LABEL_PREFIX = new RegExp(
  `^\\s*(?:${LABEL_WORDS.join("|")})(?:\\s*\\(?\\s*\\d{1,3}\\s*\\)?)?\\s*(?:[:.)\\-–—]\\s*|$)`,
  "i",
);


/**
 * DEFENSIVE LAYER — the application already renders the section heading, so a
 * leading "Example 3" / "Classwork 2:" produced by the model is a duplicate.
 * Drop the label and KEEP the mathematics. Never a rejection.
 */
export function stripDuplicateHeading(text: string): string {
  const lines = String(text ?? "").split("\n");
  let removed = 0;
  let i = 0;
  while (i < lines.length && removed < 2) {
    const raw = lines[i];
    if (!raw.trim()) { i++; continue; }
    const m = LABEL_PREFIX.exec(raw.trim());
    if (!m || !m[0].trim()) break;
    const rest = raw.trim().slice(m[0].length).trim();
    if (rest) { lines[i] = rest; removed++; break; }
    lines.splice(i, 1);
    removed++;
  }
  return lines.join("\n").replace(/^\n+/, "").trim();
}

/** Human-readable list of raw-syntax residue still present (for warnings). */

export function residueReport(s: string): string[] {
  const hits: string[] = [];
  if (!s) return hits;
  if (/```|~~~/.test(s)) hits.push("code fence");
  if (/`/.test(s)) hits.push("backtick");
  if (/\*\*/.test(s)) hits.push("markdown bold");
  if (/^[ \t]{0,3}#{1,6}[ \t]/m.test(s)) hits.push("markdown heading");
  if (/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/.test(s)) hits.push("html tag");
  if (/\{\{|\}\}/.test(s)) hits.push("template placeholder");
  if (/\\n|\\t|\\"/.test(s)) hits.push("escape residue");
  if (/\bsqrt\s*\(|\*\*\d/.test(s)) hits.push("programming syntax");
  return Array.from(new Set(hits));
}

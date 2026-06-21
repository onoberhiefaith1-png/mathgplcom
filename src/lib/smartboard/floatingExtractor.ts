// Floating Terms vs Structural Symbols — clean separation.
//
// FLOATING TERM   = a complete value between arithmetic operations (+ − × / =).
//                   Internally carries its sign ("+2x²", "−4ac", "=", "±").
//                   Leading "+" is dropped ONLY at render time when the term is
//                   first or sits immediately after "=".
//
// STRUCTURAL SYMBOL = an empty mathematical framework that HOLDS terms:
//                   fraction, root, bracket, log, power, abs, matrix, vector.

import type { Node } from "@/lib/mathboard/tokens";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

export type TermSign = "+" | "−" | "×" | "÷" | "=" | "±" | "<" | ">" | "≤" | "≥";

export interface FloatingTerm {
  /** Operation sign that introduces this term (always present internally). */
  sign: TermSign;
  /** Bare body with no leading operation sign, e.g. "2x²", "4ac", "b". */
  body: string;
  /** Display string used by the renderer when the leading sign IS shown. */
  display: string;
  /** Raw insertion form (sign + body, with "*" / "/" instead of × ÷). */
  ascii: string;
  /** True when the extractor injected the leading "+" (not in the source). */
  synthetic?: boolean;
}

export type StructureKind =
  | "fraction"
  | "bracket"
  | "radical"
  | "power"
  | "log"
  | "integral"
  | "matrix"
  | "differential"
  | "abs"
  | "vector";

export interface StructuralSymbol {
  kind: StructureKind;
  /** Glyph shown on the structure chip (empty shell). */
  glyph: string;
}

export const STRUCTURE_GLYPH: Record<StructureKind, string> = {
  fraction: "□/□",
  bracket: "( □ )",
  radical: "√□",
  power: "□^□",
  log: "log□( □ )",
  integral: "∫□ dx",
  matrix: "[ □ ]",
  differential: "d/dx □",
  abs: "|□|",
  vector: "⟨□⟩",
};

/** Markup used to render each empty container as REAL stacked math (not text).
 *  The mathRender pipeline turns these into the proper visual shells. */
export const STRUCTURE_MARKUP: Record<StructureKind, string> = {
  fraction: "\\frac{\\,□\\,}{\\,□\\,}",
  bracket: "(\\,□\\,)",
  radical: "\\sqrt{□}",
  power: "□^{□}",
  log: "\\log_{□}(□)",
  integral: "\\int □\\, dx",
  matrix: "[\\,□\\,]",
  differential: "\\frac{d}{dx}\\,□",
  abs: "|\\,□\\,|",
  vector: "\\langle □ \\rangle",
};

/** Patterns inside a filler that indicate it is actually a STRUCTURAL macro
 *  (must NOT live in the fillers row). Each match contributes a container. */
const STRUCTURAL_PATTERNS: Array<{ kind: StructureKind; rx: RegExp }> = [
  { kind: "fraction", rx: /\\frac\b|\\dfrac\b|\\tfrac\b/i },
  { kind: "radical",  rx: /\\sqrt\b/i },
  { kind: "log",      rx: /\\log_/i },
  { kind: "integral", rx: /\\int\b/i },
  { kind: "matrix",   rx: /\\begin\{[bp]?matrix\}/i },
  { kind: "differential", rx: /\\frac\{d\}\{dx\}|\\partial/i },
];

/** Does this token have a visible +,−,×,÷,= at its TOP nesting level?
 *  (Signs inside (), [], {} do not count.) A leading +/− is ignored —
 *  that's the term's own sign, not a separator. */
export const hasTopLevelSign = (src: string): boolean => {
  if (!src) return false;
  const s = src.replace(/\s+/g, "");
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (i === 0) continue; // leading sign belongs to the term
    if (c === "+" || c === "-" || c === "−" || c === "–" ||
        c === "*" || c === "×" || c === "·" ||
        c === "/" || c === "÷" || c === "=") return true;
  }
  return false;
};

/** Strip structural macros out of a fillers list. A filler whose shell wraps a
 *  sign-free body (e.g. "+\sqrt{3}", "\frac{1}{2}", "+log_{2}5") IS a single
 *  floating number and is kept. Drop the filler only when it actually lumps
 *  multiple terms together (visible top-level +,−,×,÷,=). The structure kind
 *  is still recorded either way. */
export const sanitizeFillers = (
  fillers: string[],
): { fillers: string[]; structures: StructureKind[] } => {
  const seen = new Set<StructureKind>();
  const out: string[] = [];
  for (const raw of fillers) {
    const tok = toUnicodeMath(String(raw ?? "").trim());
    if (!tok) continue;
    if (isStillDirty(tok)) continue;
    // Unicode-based structure detection
    if (/√/.test(tok)) seen.add("radical");
    if (/[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]/.test(tok) || /\^/.test(tok)) seen.add("power");
    if (/\blog[₀₁₂₃₄₅₆₇₈₉]/.test(tok)) seen.add("log");
    if (/\|[^|]+\|/.test(tok)) seen.add("abs");
    // Legacy LaTeX structural macros (should not happen post-normalization).
    let isStructural = false;
    for (const { kind, rx } of STRUCTURAL_PATTERNS) {
      if (rx.test(tok)) { seen.add(kind); isStructural = true; }
    }
    if (isStructural && hasTopLevelSign(tok)) continue;
    out.push(tok);
  }
  return { fillers: out, structures: Array.from(seen) };
};

/** Detect structures present anywhere in a (possibly LaTeX-flavoured) string. */
export const detectStructures = (src: string): StructureKind[] => {
  if (!src) return [];
  const seen = new Set<StructureKind>();
  for (const { kind, rx } of STRUCTURAL_PATTERNS) {
    if (rx.test(src)) seen.add(kind);
  }
  // Also catch plain-text forms used by hand-typed equations.
  const ascii = extractStructuresFromAscii(src);
  for (const s of ascii) seen.add(s.kind);
  return Array.from(seen);
};

const PRETTY_SIGN: Record<TermSign, string> = {
  "+": "+", "−": "−", "×": "×", "÷": "÷",
  "=": "=", "±": "±",
  "<": "<", ">": ">", "≤": "≤", "≥": "≥",
};

const ASCII_SIGN: Record<TermSign, string> = {
  "+": "+", "−": "-", "×": "*", "÷": "/",
  "=": "=", "±": "±",
  "<": "<", ">": ">", "≤": "<=", "≥": ">=",
};

const normaliseSign = (c: string): TermSign | null => {
  switch (c) {
    case "+": return "+";
    case "-": case "−": case "–": return "−";
    case "*": case "×": case "·": return "×";
    case "÷": return "÷";
    case "=": return "=";
    case "±": return "±";
    case "<": return "<";
    case ">": return ">";
    default: return null;
  }
};

const mkTerm = (sign: TermSign, body: string, synthetic = false): FloatingTerm => {
  // A synthetic "+" came from an implicit position in the source equation
  // (start of expression, inside a shell, factor-split continuation). Teachers
  // never typed a "+" there, so the chip must not show one either.
  const showSign = !(sign === "+" && synthetic);
  return {
    sign, body, synthetic,
    display: sign === "=" || sign === "±"
      ? PRETTY_SIGN[sign]
      : showSign ? `${PRETTY_SIGN[sign]}${body}` : body,
    ascii: sign === "=" || sign === "±"
      ? ASCII_SIGN[sign]
      : showSign ? `${ASCII_SIGN[sign]}${body}` : body,
  };
};

/** Render rule: hide leading "+" if synthetic, or if term is first / right after "=". */
export const renderTermLabel = (
  t: FloatingTerm,
  ctx: { isFirst: boolean; prevWasEquals: boolean } = { isFirst: true, prevWasEquals: false },
): string => {
  if (t.sign === "=" || t.sign === "±") return PRETTY_SIGN[t.sign];
  if (t.sign === "+" && (t.synthetic || ctx.isFirst || ctx.prevWasEquals)) return t.body;
  return `${PRETTY_SIGN[t.sign]}${t.body}`;
};

/** Strip the leading "+" from any filler that, given its position in the
 *  line, should not display a sign:
 *    • the first non-"="/"±" chip of the line
 *    • any chip whose previous chip is "=" or "±"
 *  Chips that are "=" / "±" themselves and chips with a different sign
 *  ("−", "×", "÷") are left untouched. Operates on Unicode-math strings. */
export const dropContextualLeadingPlus = (fillers: string[]): string[] => {
  const out: string[] = [];
  let seenContent = false;
  for (let i = 0; i < fillers.length; i++) {
    const raw = String(fillers[i] ?? "");
    const t = raw.trim();
    if (!t) { out.push(raw); continue; }
    if (t === "=" || t === "±") {
      out.push(t);
      seenContent = false; // next content chip is "first" again
      continue;
    }
    const prev = out.length > 0 ? out[out.length - 1].trim() : "";
    const afterSplitter = prev === "=" || prev === "±";
    if ((!seenContent || afterSplitter) && t[0] === "+") {
      out.push(t.slice(1));
    } else {
      out.push(t);
    }
    seenContent = true;
  }
  return out;
};

const readGrouped = (src: string, start: number): { inner: string; end: number; open: string; close: string } | null => {
  const open = src[start];
  const close = open === "(" ? ")" : open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return null;
  let depth = 1;
  let i = start + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === open) depth++;
    else if (src[i] === close) depth--;
    if (depth) i++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, i), end: i + 1, open, close };
};

const readCommandName = (src: string, start: number): { name: string; end: number } | null => {
  if (src[start] !== "\\") return null;
  let i = start + 1;
  while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
  if (i === start + 1) return null;
  return { name: src.slice(start + 1, i), end: i };
};

const splitTopLevelTerms = (src: string): Array<{ sign: TermSign; body: string; synthetic: boolean }> => {
  const s = src.replace(/\s+/g, "");
  const out: Array<{ sign: TermSign; body: string; synthetic: boolean }> = [];
  let depth = 0;
  let last = 0;
  let pendingSign: TermSign = "+";
  let pendingSynthetic = true;

  const pushBody = (body: string) => {
    if (!body) return;
    out.push({ sign: pendingSign, body, synthetic: pendingSynthetic });
    pendingSign = "+";
    pendingSynthetic = true;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      const cmd = readCommandName(s, i);
      if (cmd) {
        i = cmd.end - 1;
        continue;
      }
    }
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (depth !== 0) continue;
    if (c === "=") {
      pushBody(s.slice(last, i));
      out.push({ sign: "=", body: "", synthetic: false });
      last = i + 1;
      continue;
    }
    if (c === "±") {
      pushBody(s.slice(last, i));
      out.push({ sign: "±", body: "", synthetic: false });
      last = i + 1;
      continue;
    }
    const sig = normaliseSign(c);
    if (sig && (sig === "+" || sig === "−" || sig === "×" || sig === "÷")) {
      if (i === last) {
        pendingSign = sig;
        pendingSynthetic = false;
        last = i + 1;
        continue;
      }
      pushBody(s.slice(last, i));
      pendingSign = sig;
      pendingSynthetic = false;
      last = i + 1;
    }
  }
  pushBody(s.slice(last));
  return out;
};

const hasComplexInner = (src: string): boolean => hasTopLevelSign(src);

/** Hard rule: any +, −, ×, ÷ ANYWHERE inside the body (including nested
 *  brackets) is a "red flag" — the chip must split. A leading sign on the
 *  whole body belongs to the term itself and is ignored. */
const hasHiddenArithmetic = (src: string): boolean => {
  if (!src) return false;
  const s = src.replace(/\s+/g, "");
  for (let i = 0; i < s.length; i++) {
    if (i === 0) continue;
    const c = s[i];
    if (c === "+" || c === "-" || c === "−" || c === "–" ||
        c === "*" || c === "×" || c === "·" ||
        c === "÷") return true;
  }
  return false;
};

// ── Implicit-multiplication "complex factor" split ──────────────────────
// Rule (from teacher): an implicit-multiplication run stays as ONE chip ONLY
// when every factor is in simple form. The moment any factor carries a
// POWER (², ³, ^…) or SUBSCRIPT (_…), the run is cut at factor boundaries.
// A leading numeric coefficient binds with the immediately following
// variable/function group ("3" + "x²" → "3x²"); other coefficient rules
// (e.g. 2xy whole / 2xyz split) are handled elsewhere and are not affected.
const FACTOR_POWER_RE = /[²³⁴⁵⁶⁷⁸⁹⁰¹]|\^|_/;

const readLatexFractionAt = (src: string, start: number): { numerator: string; denominator: string; end: number } | null => {
  const cmd = src.slice(start).match(/^\\(?:d|t)?frac/);
  if (!cmd) return null;
  let p = start + cmd[0].length;
  const numerator = src[p] === "{" ? readGrouped(src, p) : null;
  if (!numerator || numerator.open !== "{") return null;
  p = numerator.end;
  const denominator = src[p] === "{" ? readGrouped(src, p) : null;
  if (!denominator || denominator.open !== "{") return null;
  return { numerator: numerator.inner, denominator: denominator.inner, end: denominator.end };
};

const readSqrtTokenAt = (src: string, start: number): number | null => {
  if (!src.startsWith("\\sqrt", start)) return null;
  let p = start + 5;
  if (src[p] === "[") {
    const idx = readGrouped(src, p);
    if (!idx || idx.open !== "[") return null;
    p = idx.end;
  }
  const body = src[p] === "{" ? readGrouped(src, p) : null;
  return body && body.open === "{" ? body.end : null;
};

const readIntegralTokenAt = (src: string, start: number): number | null => {
  const prefix = src.startsWith("\\int", start) ? "\\int" : src[start] === "∫" ? "∫" : "";
  if (!prefix) return null;
  let depth = 0;
  let end = -1;
  for (let i = start + prefix.length; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      const cmd = readCommandName(src, i);
      if (cmd) { i = cmd.end - 1; continue; }
    }
    if (c === "(" || c === "[" || c === "{") { depth++; continue; }
    if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0 && c === "d" && /[a-zA-Z]/.test(src[i + 1] ?? "")) end = i + 2;
  }
  return end > 0 ? end : src.length;
};

const isStructuralFactor = (src: string): boolean =>
  !!readLatexFractionAt(src, 0) ||
  /^\\int|^∫|^\\sqrt|^√|^\([^)]*\)|^\[[^\]]*\]/.test(src);

const tokenizeImplicitFactors = (s: string): string[] => {
  if (!s) return [];
  const tokens: string[] = [];
  let i = 0;
  const consumeOptionalScript = (start: number): number => {
    let end = start;
    while (end < s.length && /[²³⁴⁵⁶⁷⁸⁹⁰¹]/.test(s[end])) end++;
    while (end < s.length && (s[end] === "^" || s[end] === "_")) {
      end++;
      if (s[end] === "{" || s[end] === "(") {
        const g = readGrouped(s, end);
        end = g ? g.end : end + 1;
      } else if (end < s.length) {
        end++;
      }
    }
    return end;
  };
  while (i < s.length) {
    const start = i;
    const frac = readLatexFractionAt(s, i);
    if (frac) {
      tokens.push(s.slice(start, frac.end));
      i = frac.end;
      continue;
    }
    const integralEnd = readIntegralTokenAt(s, i);
    if (integralEnd != null) {
      tokens.push(s.slice(start, integralEnd));
      i = integralEnd;
      continue;
    }
    const sqrtEnd = readSqrtTokenAt(s, i);
    if (sqrtEnd != null) {
      tokens.push(s.slice(start, sqrtEnd));
      i = sqrtEnd;
      continue;
    }
    // bracketed group (with optional ^ tail)
    if (s[i] === "(" || s[i] === "[" || s[i] === "{") {
      const g = readGrouped(s, i);
      if (!g) return [s];
      let end = g.end;
      end = consumeOptionalScript(end);
      tokens.push(s.slice(start, end));
      i = end;
      continue;
    }
    // numeric coefficient
    if (/[0-9]/.test(s[i])) {
      while (i < s.length && /[0-9.]/.test(s[i])) i++;
      tokens.push(s.slice(start, i));
      continue;
    }
    // function name (sin/cos/tan/sec/csc/cot/ln/log[subscript])
    const rest = s.slice(i);
    const fnMatch = rest.match(/^(sin|cos|tan|sec|csc|cot|ln|log)([₀₁₂₃₄₅₆₇₈₉ₐ-ₜ]*|_\{[^}]+\}|_[a-zA-Z0-9])?/i);
    if (fnMatch) {
      let end = i + fnMatch[0].length;
      end = consumeOptionalScript(end); // sin²θ etc
      // argument: bracketed OR next factor unit (coef + letter + script)
      if (s[end] === "(" || s[end] === "{" || s[end] === "[") {
        const g = readGrouped(s, end);
        end = g ? g.end : end + 1;
      } else {
        while (end < s.length && /[0-9.]/.test(s[end])) end++;
        if (end < s.length && /[a-zA-Zθφπα-ω]/.test(s[end])) {
          end++;
          end = consumeOptionalScript(end);
        }
      }
      tokens.push(s.slice(start, end));
      i = end;
      continue;
    }
    // letter + optional script
    if (/[a-zA-Zθφπα-ω]/.test(s[i])) {
      i++;
      i = consumeOptionalScript(i);
      tokens.push(s.slice(start, i));
      continue;
    }
    // unknown character — bail
    return [s];
  }
  // Merge leading numeric coefficient with the next factor group — UNLESS the
  // next factor is a bracket whose interior hides an arithmetic sign (then
  // the bracket must open on its own, and the coefficient stays separate).
  if (tokens.length >= 2 && /^[0-9]+(\.[0-9]+)?$/.test(tokens[0])) {
    const next = tokens[1];
    const nextOpensSign = /^[(\[{]/.test(next) && hasHiddenArithmetic(next);
    const nextIsStructural = isStructuralFactor(next);
    if (!nextOpensSign && !nextIsStructural) {
      tokens[0] = tokens[0] + tokens[1];
      tokens.splice(1, 1);
    }
  }
  return tokens;
};

const needsFactorSplit = (s: string): boolean => {
  if (!s) return false;
  const toks = tokenizeImplicitFactors(s);
  if (toks.some(isStructuralFactor)) return toks.length > 1;
  if (!FACTOR_POWER_RE.test(s) && !hasHiddenArithmetic(s)) return false;
  return toks.length > 1;
};

const readFractionBody = (src: string): { numerator: string; denominator: string } | null => {
  const frac = src.match(/^\\(?:d|t)?frac\{([\s\S]+)\}\{([\s\S]+)\}$/);
  if (frac) return { numerator: frac[1], denominator: frac[2] };

  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === "/") {
      const numerator = src.slice(0, i);
      const denominator = src.slice(i + 1);
      if (numerator && denominator) return { numerator, denominator };
    }
  }
  return null;
};

const readSqrtBody = (src: string): { index: string; radicand: string } | null => {
  if (src.startsWith("\\sqrt")) {
    let p = 5;
    let index = "";
    if (src[p] === "[") {
      const close = src.indexOf("]", p + 1);
      if (close > 0) {
        index = src.slice(p + 1, close);
        p = close + 1;
      }
    }
    const group = src[p] ? readGrouped(src, p) : null;
    if (group && group.end === src.length) return { index, radicand: group.inner };
  }
  if (src.startsWith("√")) {
    return { index: "", radicand: src.slice(1).replace(/^\((.*)\)$/s, "$1") };
  }
  return null;
};

const readFunctionBody = (src: string): { shell: string; arg: string } | null => {
  const latexLog = src.match(/^\\log_\{([^{}]+)\}(.*)$/);
  if (latexLog) {
    const arg = latexLog[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `log_${latexLog[1]}()`, arg: grp.inner };
    if (arg) return { shell: `log_${latexLog[1]}()`, arg };
  }
  const asciiLog = src.match(/^log_(?:\{([^{}]+)\}|([a-zA-Z0-9]))(.*)$/);
  if (asciiLog) {
    const sub = asciiLog[1] ?? asciiLog[2];
    const arg = asciiLog[3];
    const grp = arg && (arg[0] === "(" || arg[0] === "{") ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `log_${sub}()`, arg: grp.inner };
    if (arg) return { shell: `log_${sub}()`, arg };
  }
  const uniLog = src.match(/^(log[₀₁₂₃₄₅₆₇₈₉]+)(.*)$/);
  if (uniLog) {
    const arg = uniLog[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `${uniLog[1]}()`, arg: grp.inner };
    if (arg) return { shell: `${uniLog[1]}()`, arg };
  }
  const fn = src.match(/^(sin|cos|tan|ln|log)(.*)$/i);
  if (!fn) return null;
  const arg = fn[2];
  if (!arg) return null;
  const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
  if (grp && grp.end === arg.length) return { shell: `${fn[1]}()`, arg: grp.inner };
  return { shell: `${fn[1]}`, arg };
};

const readIntegralBody = (src: string): { shell: string; body: string } | null => {
  const trimmed = src.replace(/\\int/g, "∫");
  if (!trimmed.startsWith("∫")) return null;
  const dx = trimmed.match(/^(.*?)(d[a-zA-Z])$/);
  if (!dx) return null;
  const full = dx[1];
  const diff = dx[2];
  let i = 1;
  while (i < full.length && !(/[A-Za-z0-9√(\\]/.test(full[i]))) i++;
  const head = full.slice(0, i);
  const body = full.slice(i);
  if (!body) return null;
  return { shell: `${head}()${diff}`, body };
};

const readDerivativeBody = (src: string): { shell: string; body: string } | null => {
  const latex = src.match(/^\\frac\{d\}\{d([a-zA-Z]+)\}(.*)$/);
  if (latex) {
    const arg = latex[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `d/d${latex[1]}()`, body: grp.inner };
    if (arg) return { shell: `d/d${latex[1]}()`, body: arg };
  }
  const uni = src.match(/^d\/d([a-zA-Z]+)(.*)$/);
  if (uni) {
    const arg = uni[2];
    const grp = arg[0] === "(" || arg[0] === "{" ? readGrouped(arg, 0) : null;
    if (grp && grp.end === arg.length) return { shell: `d/d${uni[1]}()`, body: grp.inner };
    if (arg) return { shell: `d/d${uni[1]}()`, body: arg };
  }
  return null;
};

const readBracketPower = (src: string): { shell: string; inner: string; exponent?: string } | null => {
  if (!(src.startsWith("(") || src.startsWith("[") || src.startsWith("{"))) return null;
  const grp = readGrouped(src, 0);
  if (!grp) return null;
  const tail = src.slice(grp.end);
  if (!tail) return { shell: `${grp.open}${grp.close}`, inner: grp.inner };
  if (tail.startsWith("^") && tail.length > 1) {
    const expGroup = tail[1] === "{" || tail[1] === "(" ? readGrouped(tail, 1) : null;
    const exponent = expGroup ? expGroup.inner : tail.slice(1);
    if (expGroup ? expGroup.end === tail.length : true) {
      const expoSimple = exponent && !hasComplexInner(exponent);
      return {
        shell: expoSimple ? `${grp.open}${grp.close}${tail}` : `${grp.open}${grp.close}^()`,
        inner: grp.inner,
        exponent,
      };
    }
  }
  return null;
};

const emitSegmentTerms = (
  out: FloatingTerm[],
  sign: TermSign,
  body: string,
  synthetic: boolean,
): void => {
  if (!body) return;

  const bracketPow = readBracketPower(body);
  if (bracketPow) {
    out.push(mkTerm(sign, bracketPow.shell, synthetic));
    out.push(...extractTermsFromAscii(bracketPow.inner));
    if (bracketPow.exponent && (hasComplexInner(bracketPow.exponent) || hasHiddenArithmetic(bracketPow.exponent))) {
      out.push(...extractTermsFromAscii(bracketPow.exponent));
    }
    return;
  }

  const deriv = readDerivativeBody(body);
  if (deriv) {
    out.push(mkTerm(sign, deriv.shell, synthetic));
    out.push(...extractTermsFromAscii(deriv.body));
    return;
  }

  const integral = readIntegralBody(body);
  if (integral) {
    out.push(mkTerm(sign, integral.shell, synthetic));
    out.push(...extractTermsFromAscii(integral.body));
    return;
  }

  const frac = readFractionBody(body);
  if (frac) {
    const simpleNumerator = !hasComplexInner(frac.numerator) && !needsFactorSplit(frac.numerator) && !hasHiddenArithmetic(frac.numerator);
    const simpleDenominator = !hasComplexInner(frac.denominator) && !needsFactorSplit(frac.denominator) && !hasHiddenArithmetic(frac.denominator);
    if (simpleNumerator && simpleDenominator) {
      out.push(mkTerm(sign, `\\frac{${frac.numerator}}{${frac.denominator}}`, synthetic));
    } else {
      const left = extractTermsFromAscii(frac.numerator);
      if (left.length > 0) {
        left[0] = mkTerm(sign, left[0].body, synthetic);
        out.push(...left);
      }
      out.push(...extractTermsFromAscii(frac.denominator));
    }
    return;
  }

  const sqrt = readSqrtBody(body);
  if (sqrt) {
    if (!hasComplexInner(sqrt.radicand) && !readFractionBody(sqrt.radicand) && !needsFactorSplit(sqrt.radicand) && !hasHiddenArithmetic(sqrt.radicand)) {
      const prefix = sqrt.index ? `√[${sqrt.index}]` : "√";
      out.push(mkTerm(sign, `${prefix}${sqrt.radicand}`, synthetic));
    } else {
      const prefix = sqrt.index ? `√[${sqrt.index}]()` : "√()";
      out.push(mkTerm(sign, prefix, synthetic));
      out.push(...extractTermsFromAscii(sqrt.radicand));
    }
    return;
  }

  const fn = readFunctionBody(body);
  if (fn) {
    if (!hasComplexInner(fn.arg) && !readFractionBody(fn.arg) && !needsFactorSplit(fn.arg) && !hasHiddenArithmetic(fn.arg)) {
      const compactShell = fn.shell.endsWith("()") ? fn.shell.slice(0, -2) : fn.shell;
      // Keep parentheses for subscripted logs (log_a, log_{2}) so the
      // subscript can't visually fuse with the argument.
      const arg = /_/.test(compactShell) && fn.arg.length > 1 ? `(${fn.arg})` : fn.arg;
      out.push(mkTerm(sign, `${compactShell}${arg}`, synthetic));
    } else {
      out.push(mkTerm(sign, fn.shell, synthetic));
      out.push(...extractTermsFromAscii(fn.arg));
    }
    return;
  }

  // Implicit-multiplication factor split. Trigger when any factor has a
  // power/subscript OR any factor is a bracket hiding an arithmetic sign
  // (teacher's hard rule: a±b inside any container is a red flag). Each
  // factor is routed back through emitSegmentTerms so brackets explode into
  // shell + contents instead of leaking the hidden sign.
  if (needsFactorSplit(body)) {
    const toks = tokenizeImplicitFactors(body);
    if (toks.length > 1) {
      for (let k = 0; k < toks.length; k++) {
        emitSegmentTerms(out, k === 0 ? sign : "+", toks[k], k === 0 ? synthetic : true);
      }
      return;
    }
  }

  out.push(mkTerm(sign, body, synthetic));
};

/**
 * Extract floating terms from a flat ascii / friendly-math string, using the
 * classroom floating-number rules:
 * - visible top-level signs split
 * - simple fractions / radicals / logs stay whole
 * - complex structure contents become their own floating stream while the
 *   shell stays attached to the owning structure.
 */
export const extractTermsFromAscii = (src: string): FloatingTerm[] => {
  if (!src) return [];
  const s = src
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/–|—|−/g, "-");

  const out: FloatingTerm[] = [];
  for (const part of splitTopLevelTerms(s)) {
    if (part.sign === "=" || part.sign === "±") {
      out.push(mkTerm(part.sign, ""));
      continue;
    }
    emitSegmentTerms(out, part.sign, part.body, part.synthetic);
  }
  return out;
};

/** Detect which structural shells appear in the ascii string (order-preserving, deduped). */
export const extractStructuresFromAscii = (src: string): StructuralSymbol[] => {
  if (!src) return [];
  const found: StructureKind[] = [];
  const seen = new Set<StructureKind>();
  const add = (k: StructureKind) => { if (!seen.has(k)) { seen.add(k); found.push(k); } };

  if (/√|sqrt|root/i.test(src)) add("radical");
  if (/frac/i.test(src) || /[)\dx]\/[^/]+/.test(src)) add("fraction");
  if (src.includes("(")) add("bracket");
  if (/\^|[²³⁴⁵⁶⁷⁸⁹]/.test(src)) add("power");
  if (/log/i.test(src)) add("log");
  if (/∫|integral/i.test(src)) add("integral");
  if (/matrix|\[.*;.*\]/i.test(src)) add("matrix");
  if (/d\/dx|dy|differential/i.test(src)) add("differential");
  if (/\|[^|]+\|/.test(src)) add("abs");
  if (/⟨[^⟩]+⟩/.test(src)) add("vector");

  return found.map((kind) => ({ kind, glyph: STRUCTURE_GLYPH[kind] }));
};

/** Walk a Node[] tree and emit floating terms. Structural nodes are skipped
 *  (their slot contents become their own term streams). */
export const extractTermsFromNodes = (nodes: Node[]): FloatingTerm[] => {
  const flat: string[] = [];
  const push = (s: string) => flat.push(s);
  const walk = (arr: Node[]) => {
    for (const n of arr) {
      switch (n.kind) {
        case "num": push(n.value); break;
        case "var": push(n.name); break;
        case "op":  push(n.op); break;
        case "eq":  push(n.op); break;
        // Structural shells: do NOT inline; recurse so their inner terms emit
        // separately into the same stream (the structure-detector picks up the
        // shell). We render the body so the term list reflects every value.
        case "bracket": walk(n.body); break;
        case "frac":    walk(n.num); push("/"); walk(n.den); break;
        case "power":   walk(n.base); push("^"); walk(n.exp); break;
        case "root":    walk(n.radicand); break;
        case "abs":     walk(n.body); break;
        case "func":    walk(n.arg); break;
        default: break;
      }
    }
  };
  walk(nodes);
  return extractTermsFromAscii(flat.join(""));
};

export const extractStructuresFromNodes = (nodes: Node[]): StructuralSymbol[] => {
  const found: StructureKind[] = [];
  const seen = new Set<StructureKind>();
  const add = (k: StructureKind) => { if (!seen.has(k)) { seen.add(k); found.push(k); } };
  const walk = (arr: Node[]) => {
    for (const n of arr) {
      switch (n.kind) {
        case "bracket": add("bracket"); walk(n.body); break;
        case "frac":    add("fraction"); walk(n.num); walk(n.den); break;
        case "power":   add("power"); walk(n.base); walk(n.exp); break;
        case "root":    add("radical"); walk(n.radicand); break;
        case "abs":     add("abs"); walk(n.body); break;
        case "integral":add("integral"); walk(n.body); break;
        case "matrix":  add("matrix"); for (const row of n.rows) for (const cell of row) walk(cell); break;
        case "func":    if (/^log/i.test(n.name)) add("log"); walk(n.arg); break;
        case "deriv":
        case "partial": add("differential"); walk(n.body); break;
        default: break;
      }
    }
  };
  walk(nodes);
  return found.map((kind) => ({ kind, glyph: STRUCTURE_GLYPH[kind] }));
};

/* ────────────────────── Transition splitter ──────────────────────
 * When a term on line N+1 is the result of applying ÷, ×, ^ or √ to a
 * term on line N plus a scalar k, return the SOURCE pieces (prev, k) and
 * the structure that joins them, so the teacher can manually build the
 * transformation on the board instead of being handed the evaluated form.
 *
 * Detection is purely structural (string match on the bare bodies, with
 * Unicode-math input). No CAS, no algebraic simplification.
 */
const stripSign = (s: string): { sign: "+" | "−" | ""; body: string } => {
  if (!s) return { sign: "", body: "" };
  const c = s[0];
  if (c === "+" || c === "−" || c === "-") {
    return { sign: c === "-" ? "−" : (c as "+" | "−"), body: s.slice(1) };
  }
  return { sign: "", body: s };
};

const reSign = (sign: "+" | "−" | "", body: string) => `${sign}${body}`;

export const splitTransformPair = (
  prevFiller: string,
  currFiller: string,
): { pieces: string[]; structure: StructureKind } | null => {
  if (!prevFiller || !currFiller) return null;
  const p = stripSign(prevFiller.trim());
  const c = stripSign(currFiller.trim());
  if (!p.body || !c.body) return null;
  if (p.body === c.body) return null;

  // ── Division: c == "p/k" or "p÷k" (slashy form a teacher would never want
  //    as a single chip — split into [p, k] + fraction structure).
  const div = c.body.match(/^([^/÷]+)[/÷]([^/÷]+)$/);
  if (div) {
    const [, num, den] = div;
    if (num === p.body) {
      return { pieces: [reSign(c.sign, num), `+${den}`], structure: "fraction" };
    }
    if (den === p.body) {
      return { pieces: [reSign(c.sign, num), `+${den}`], structure: "fraction" };
    }
  }

  // ── Radical: c == "√p" or "√(p)" → [p] + radical structure.
  const rad = c.body.match(/^√\(?([^)]+)\)?$/);
  if (rad && rad[1] === p.body) {
    return { pieces: [reSign(c.sign, p.body)], structure: "radical" };
  }

  // ── Power: c == "p²" / "p³" / "p^k".
  const supMap: Record<string, string> = {
    "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  };
  const pow = c.body.match(/^(.+?)([²³⁴⁵⁶⁷⁸⁹])$/);
  if (pow && pow[1] === p.body) {
    return { pieces: [reSign(c.sign, p.body), `+${supMap[pow[2]]}`], structure: "power" };
  }

  // Implicit multiplication (e.g. "2y" where prev had "y") is NOT split:
  // coefficients stay attached to their variable per the Master Rule.

  // Complex bracket-power reuse lines: (x+1)^3 should expand to shell + parts
  // only on first introduction; later lines may keep the whole term.
  const bp = c.body.match(/^([\(\[].+[\)\]])\^(.+)$/);
  if (bp && bp[1] === p.body) {
    return { pieces: [reSign(c.sign, `${p.body}^()`), `+${bp[2]}`], structure: "power" };
  }

  return null;
};

/** Apply splitTransformPair across a (prevLineFillers, currLineFillers) pair,
 *  returning the expanded fillers + structures introduced. Only splits a term
 *  when the joining structure is BRAND-NEW for this beat (not already in
 *  `seenStructures`). Once a structure has been introduced on a previous
 *  line, the teacher knows the shape and the term stays as one whole chip. */
export const expandTransitionLine = (
  prevFillers: string[],
  currFillers: string[],
  seenStructures: Set<StructureKind> = new Set(),
): { fillers: string[]; structures: StructureKind[] } => {
  const introduced: StructureKind[] = [];
  const out: string[] = [];
  for (const c of currFillers) {
    let matched: { pieces: string[]; structure: StructureKind } | null = null;
    for (const p of prevFillers) {
      const r = splitTransformPair(p, c);
      if (r) { matched = r; break; }
    }
    if (matched && !seenStructures.has(matched.structure)) {
      out.push(...matched.pieces);
      if (!introduced.includes(matched.structure)) introduced.push(matched.structure);
    } else {
      out.push(c);
    }
  }
  return { fillers: out, structures: introduced };
};

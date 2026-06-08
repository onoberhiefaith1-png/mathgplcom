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
  power: "□²",
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
    if (/[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ]/.test(tok)) seen.add("power");
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

const mkTerm = (sign: TermSign, body: string, synthetic = false): FloatingTerm => ({
  sign, body, synthetic,
  display: sign === "=" || sign === "±" ? PRETTY_SIGN[sign] : `${PRETTY_SIGN[sign]}${body}`,
  ascii:   sign === "=" || sign === "±" ? ASCII_SIGN[sign]  : `${ASCII_SIGN[sign]}${body}`,
});

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

/**
 * Extract floating terms from a flat ascii / friendly-math string, IGNORING the
 * inside of any structural shell (parens, frac, root, log argument …). Those
 * insides are recursed into separately so each becomes its own term group.
 */
export const extractTermsFromAscii = (src: string): FloatingTerm[] => {
  if (!src) return [];
  // Normalise common math glyphs to ascii operators (but keep ², ³ as part of body).
  const s = src
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/–|—|−/g, "-");

  const out: FloatingTerm[] = [];
  let i = 0;
  let pendingSign: TermSign = "+"; // synthetic leading + for first term
  let pendingSynthetic = true;

  const flushBody = (body: string) => {
    if (!body) return;
    out.push(mkTerm(pendingSign, body, pendingSynthetic));
  };

  while (i < s.length) {
    const c = s[i];

    // Standalone splitters that are also their own term.
    if (c === "=") { out.push(mkTerm("=", "")); pendingSign = "+"; pendingSynthetic = true; i++; continue; }
    if (c === "±") { out.push(mkTerm("±", "")); pendingSign = "+"; pendingSynthetic = true; i++; continue; }

    // Arithmetic sign → starts the next term.
    const sig = normaliseSign(c);
    if (sig && (sig === "+" || sig === "−" || sig === "×" || sig === "÷")) {
      pendingSign = sig;
      pendingSynthetic = false;
      i++;
      continue;
    }

    // Bracket / structure skip — descend so inner terms come out separately.
    if (c === "(" || c === "[" || c === "{") {
      const close = c === "(" ? ")" : c === "[" ? "]" : "}";
      let depth = 1, j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === c) depth++;
        else if (s[j] === close) depth--;
        if (depth) j++;
      }
      const inner = s.slice(i + 1, j);
      out.push(...extractTermsFromAscii(inner));
      i = j + 1;
      pendingSign = "+";
      pendingSynthetic = true;
      continue;
    }

    // Otherwise, accumulate a body until the next splitter.
    let j = i;
    while (j < s.length) {
      const cj = s[j];
      if (cj === "=" || cj === "±") break;
      if (cj === "(" || cj === "[" || cj === "{") break;
      const ns = normaliseSign(cj);
      if (ns && (ns === "+" || ns === "−" || ns === "×" || ns === "÷")) break;
      j++;
    }
    flushBody(s.slice(i, j));
    i = j;
    pendingSign = "+";
    pendingSynthetic = true;
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
  if (/frac/i.test(src) || /[)\dx]\/[\d(x]/.test(src)) add("fraction");
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

// Equation → atom list parser for Highlight Generation.
//
// An "atom" is the smallest selectable unit in an equation, with a stable id
// so chips can be linked back to the exact characters they came from. The
// teacher clicks atoms in the equation; pressing Enter merges contiguous runs
// into chips (Floating Numbers). See src/lib/floating/highlightEngine.ts.

export type AtomKind =
  | "number"
  | "variable"
  | "operator"
  | "equality"
  | "bracket-open"
  | "bracket-close"
  | "exponent"      // attachment — preserves visual form (², ^{n})
  | "subscript"     // attachment
  | "fraction-bar"  // container marker
  | "root-sign"     // container marker
  | "function-name"
  | "symbol";

export interface Atom {
  id: string;
  value: string;
  kind: AtomKind;
  /** True for attachments (exponent/subscript) — they render visually attached
   *  to the preceding base when displayed as a chip. */
  attachment?: boolean;
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼ⁿⁱ";
const SUB = "₀₁₂₃₄₅₆₇₈₉₊₋₌";

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => /[A-Za-zα-ωΑ-Ω]/.test(c);

export const parseAtoms = (equation: string, lineId: string): Atom[] => {
  const out: Atom[] = [];
  const s = String(equation ?? "");
  let i = 0;
  const push = (value: string, kind: AtomKind, attachment = false) => {
    out.push({ id: `${lineId}:a${out.length}`, value, kind, attachment });
  };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }

    // Multi-digit number
    if (isDigit(c) || (c === "." && isDigit(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) j++;
      push(s.slice(i, j), "number");
      i = j; continue;
    }

    // Unicode superscript / subscript run → exponent / subscript atom
    if (SUP.includes(c)) {
      let j = i;
      while (j < s.length && SUP.includes(s[j])) j++;
      push(s.slice(i, j), "exponent", true);
      i = j; continue;
    }
    if (SUB.includes(c)) {
      let j = i;
      while (j < s.length && SUB.includes(s[j])) j++;
      push(s.slice(i, j), "subscript", true);
      i = j; continue;
    }

    // ^ → exponent (capture {…} or single char)
    if (c === "^") {
      let j = i + 1;
      let body = "";
      if (s[j] === "{") {
        let depth = 0;
        for (; j < s.length; j++) {
          if (s[j] === "{") { depth++; if (depth === 1) continue; }
          else if (s[j] === "}") { depth--; if (depth === 0) { j++; break; } }
          body += s[j];
        }
      } else if (j < s.length) { body = s[j]; j++; }
      push(`^${body}`, "exponent", true);
      i = j; continue;
    }
    if (c === "_") {
      let j = i + 1;
      let body = "";
      if (s[j] === "{") {
        let depth = 0;
        for (; j < s.length; j++) {
          if (s[j] === "{") { depth++; if (depth === 1) continue; }
          else if (s[j] === "}") { depth--; if (depth === 0) { j++; break; } }
          body += s[j];
        }
      } else if (j < s.length) { body = s[j]; j++; }
      push(`_${body}`, "subscript", true);
      i = j; continue;
    }

    // Letter run → single-letter variables (algebra convention so Ax² → A, x, ²)
    if (isAlpha(c)) {
      push(c, "variable");
      i++; continue;
    }

    if (c === "(" || c === "[" || c === "{") { push(c, "bracket-open"); i++; continue; }
    if (c === ")" || c === "]" || c === "}") { push(c, "bracket-close"); i++; continue; }

    if (c === "=") { push("=", "equality"); i++; continue; }
    if (c === "<" || c === ">" || c === "≤" || c === "≥" || c === "≠") {
      push(c, "equality"); i++; continue;
    }

    if ("+-−–±×·÷*".includes(c)) {
      const norm =
        c === "*" ? "×" :
        c === "-" || c === "–" ? "−" :
        c;
      push(norm, "operator"); i++; continue;
    }

    if (c === "/") { push("/", "fraction-bar"); i++; continue; }
    if (c === "√") { push("√", "root-sign"); i++; continue; }

    // Anything else — keep as a generic symbol so it remains selectable.
    push(c, "symbol"); i++;
  }
  return out;
};

/** Concatenate atom values to form the visible chip text. Attachments are
 *  joined directly to the previous atom; everything else is also joined
 *  directly — operators carry their own sign. */
export const atomsToText = (atoms: Atom[]): string =>
  atoms.map((a) => a.value).join("");

/** Best-effort: given the parsed atoms of an equation and the existing
 *  filler strings (legacy data without atomIds), greedily match each filler
 *  to a contiguous run of atoms whose concatenation equals the filler. */
export const reconstructAtomIds = (atoms: Atom[], fillers: string[]): string[][] => {
  const out: string[][] = [];
  const strip = (s: string) => s.replace(/\s+/g, "");
  let p = 0;
  for (const f of fillers) {
    const target = strip(f);
    let matched: string[] = [];
    for (let start = p; start < atoms.length; start++) {
      let buf = "";
      const ids: string[] = [];
      for (let j = start; j < atoms.length; j++) {
        buf += atoms[j].value;
        ids.push(atoms[j].id);
        if (strip(buf) === target) { matched = ids; p = j + 1; break; }
        if (strip(buf).length > target.length) break;
      }
      if (matched.length) break;
    }
    out.push(matched);
  }
  return out;
};

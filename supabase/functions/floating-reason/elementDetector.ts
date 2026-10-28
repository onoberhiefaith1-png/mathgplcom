// Element Detector — tokenises an equation/highlight into a typed inventory
// used by the Reasoning + Verification pipeline. Output is consumed BOTH by
// the law engine (ordered list) and by the verifier (multiset fingerprint).

export type ElementKind =
  | "number"
  | "variable"
  | "operator"
  | "equality"
  | "bracket-open"
  | "bracket-close"
  | "fraction"
  | "radical"
  | "power"
  | "subscript"
  | "integral"
  | "summation"
  | "matrix"
  | "function-name"
  | "text";

export interface MathElement {
  kind: ElementKind;
  value: string;
  /** Raw source span for reconstruction (kept verbatim, no normalisation). */
  raw: string;
}

const FUNCTION_NAMES = new Set([
  "sin", "cos", "tan", "csc", "sec", "cot",
  "asin", "acos", "atan", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh",
  "log", "ln", "lg", "exp",
]);

const TEXT_WORDS = new Set(["let", "if", "then", "where", "solve", "find", "given", "hence"]);

const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => /[A-Za-zα-ωΑ-Ωπρθφλμσ]/.test(c);
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼ⁿⁱ";
const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉₊₋₌";

/** Read a matched {...} group starting at i (s[i] === '{'); returns body and new index. */
const readBraceGroup = (s: string, i: number): { body: string; next: number } => {
  if (s[i] !== "{") return { body: "", next: i };
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return { body: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return { body: s.slice(i + 1), next: s.length };
};

/** Read a matched (...) group starting at i (s[i] === '('); returns body and new index. */
const readParenGroup = (s: string, i: number): { body: string; next: number } => {
  if (s[i] !== "(") return { body: "", next: i };
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") {
      depth--;
      if (depth === 0) return { body: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return { body: s.slice(i + 1), next: s.length };
};

export const detectElements = (src: string): MathElement[] => {
  const out: MathElement[] = [];
  const s = (src ?? "").trim();
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (/\s/.test(c)) { i++; continue; }

    // LaTeX commands
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        const cmd = m[1];
        let j = i + m[0].length;
        if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
          const a = readBraceGroup(s, j); j = a.next;
          const b = readBraceGroup(s, j); j = b.next;
          out.push({ kind: "fraction", value: `${a.body}/${b.body}`, raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "sqrt") {
          let index = "";
          if (s[j] === "[") {
            const end = s.indexOf("]", j);
            if (end > 0) { index = s.slice(j + 1, end); j = end + 1; }
          }
          const body = readBraceGroup(s, j); j = body.next;
          out.push({ kind: "radical", value: index ? `${index}:${body.body}` : body.body, raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "int") {
          out.push({ kind: "integral", value: "∫", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "sum") {
          out.push({ kind: "summation", value: "∑", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "pm") {
          out.push({ kind: "operator", value: "±", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "times") {
          out.push({ kind: "operator", value: "×", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "div") {
          out.push({ kind: "operator", value: "÷", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "cdot") {
          out.push({ kind: "operator", value: "·", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "neq") {
          out.push({ kind: "equality", value: "≠", raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "leq" || cmd === "le") {
          out.push({ kind: "equality", value: "≤", raw: s.slice(i, j) }); i = j; continue;
        }
        if (cmd === "geq" || cmd === "ge") {
          out.push({ kind: "equality", value: "≥", raw: s.slice(i, j) }); i = j; continue;
        }
        if (cmd === "text") {
          const body = readBraceGroup(s, j); j = body.next;
          out.push({ kind: "text", value: body.body.trim(), raw: s.slice(i, j) });
          i = j; continue;
        }
        if (cmd === "left" || cmd === "right") {
          // skip the next char (bracket)
          i = j + 1; continue;
        }
        if (FUNCTION_NAMES.has(cmd)) {
          out.push({ kind: "function-name", value: cmd, raw: s.slice(i, j) });
          i = j; continue;
        }
        // Greek/symbol command → variable
        out.push({ kind: "variable", value: cmd, raw: s.slice(i, j) });
        i = j; continue;
      }
      i++; continue;
    }

    // ^ power
    if (c === "^") {
      let j = i + 1;
      let body = "";
      if (s[j] === "{") {
        const g = readBraceGroup(s, j); body = g.body; j = g.next;
      } else if (j < s.length) {
        body = s[j]; j++;
      }
      out.push({ kind: "power", value: body, raw: s.slice(i, j) });
      i = j; continue;
    }
    // _ subscript
    if (c === "_") {
      let j = i + 1;
      let body = "";
      if (s[j] === "{") {
        const g = readBraceGroup(s, j); body = g.body; j = g.next;
      } else if (j < s.length) {
        body = s[j]; j++;
      }
      out.push({ kind: "subscript", value: body, raw: s.slice(i, j) });
      i = j; continue;
    }

    // Unicode supers/subs collapsed into power/subscript
    if (SUP_DIGITS.includes(c)) {
      let j = i;
      while (j < s.length && SUP_DIGITS.includes(s[j])) j++;
      out.push({ kind: "power", value: s.slice(i, j), raw: s.slice(i, j) });
      i = j; continue;
    }
    if (SUB_DIGITS.includes(c)) {
      let j = i;
      while (j < s.length && SUB_DIGITS.includes(s[j])) j++;
      out.push({ kind: "subscript", value: s.slice(i, j), raw: s.slice(i, j) });
      i = j; continue;
    }

    // Numbers
    if (isDigit(c) || (c === "." && isDigit(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === ".")) j++;
      out.push({ kind: "number", value: s.slice(i, j), raw: s.slice(i, j) });
      i = j; continue;
    }

    // Letters / words → function-name OR text-word OR variable
    if (isAlpha(c)) {
      let j = i;
      while (j < s.length && isAlpha(s[j])) j++;
      const word = s.slice(i, j);
      const lower = word.toLowerCase();
      if (FUNCTION_NAMES.has(lower) && s[j] === "(") {
        out.push({ kind: "function-name", value: lower, raw: word });
        i = j; continue;
      }
      if (TEXT_WORDS.has(lower)) {
        out.push({ kind: "text", value: word, raw: word });
        i = j; continue;
      }
      // Multi-letter variable token → split into single-letter variables
      // (algebra convention) unless it's a recognized function call.
      for (const ch of word) out.push({ kind: "variable", value: ch, raw: ch });
      i = j; continue;
    }

    // Brackets
    if (c === "(" || c === "[" || c === "{") {
      out.push({ kind: "bracket-open", value: c, raw: c });
      i++; continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      out.push({ kind: "bracket-close", value: c, raw: c });
      i++; continue;
    }

    // Operators / equalities
    if ("+-−–*×·÷/".includes(c)) {
      const norm = c === "*" ? "×" : c === "/" ? "÷" : c === "-" || c === "–" ? "−" : c;
      out.push({ kind: "operator", value: norm, raw: c });
      i++; continue;
    }
    if (c === "=" || c === "<" || c === ">" || c === "≠" || c === "≤" || c === "≥" || c === "±") {
      out.push({ kind: c === "±" ? "operator" : "equality", value: c, raw: c });
      i++; continue;
    }
    if (c === "√") {
      let j = i + 1;
      let body = "";
      if (s[j] === "(") { const g = readParenGroup(s, j); body = g.body; j = g.next; }
      else if (s[j] === "{") { const g = readBraceGroup(s, j); body = g.body; j = g.next; }
      else while (j < s.length && /[A-Za-z0-9]/.test(s[j])) { body += s[j]; j++; }
      out.push({ kind: "radical", value: body, raw: s.slice(i, j) });
      i = j; continue;
    }
    if (c === "∫") { out.push({ kind: "integral", value: "∫", raw: c }); i++; continue; }
    if (c === "∑") { out.push({ kind: "summation", value: "∑", raw: c }); i++; continue; }

    // Unknown char → skip (do not silently misclassify).
    i++;
  }
  return out;
};

/** Multiset fingerprint of the element list, used by the verifier coverage check. */
export const fingerprint = (elements: MathElement[]): Record<string, number> => {
  const fp: Record<string, number> = {};
  for (const e of elements) {
    const key = `${e.kind}:${e.value}`;
    fp[key] = (fp[key] ?? 0) + 1;
  }
  return fp;
};

/** Human label for a single element, used in UI lists. */
export const labelOf = (e: MathElement): string => {
  switch (e.kind) {
    case "number": return `Number ${e.value}`;
    case "variable": return `Variable ${e.value}`;
    case "operator": return `Operator ${e.value}`;
    case "equality": return `Equality ${e.value}`;
    case "bracket-open": return `Bracket ${e.value}`;
    case "bracket-close": return `Bracket ${e.value}`;
    case "fraction": return `Fraction ${e.value}`;
    case "radical": return `Radical √(${e.value})`;
    case "power": return `Power ^(${e.value})`;
    case "subscript": return `Subscript _(${e.value})`;
    case "integral": return `Integral ∫`;
    case "summation": return `Summation ∑`;
    case "matrix": return `Matrix`;
    case "function-name": return `Function ${e.value}`;
    case "text": return `Text "${e.value}"`;
  }
};

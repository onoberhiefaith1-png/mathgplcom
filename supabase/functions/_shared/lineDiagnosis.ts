// Line diagnosis engine — turns a raw equivalence verdict into a SPECIFIC,
// very short teacher-style label ("Incorrect sign", "Missing term", …).
//
// Contract:
//   • `label`  — 1–3 words. This is all the student ever sees in the popup.
//   • `detail` — one sentence, shown ONLY in the teacher Reasoning panel.
//   • The correct answer is never revealed by either field.
//
// The rule order below IS the priority order from the specification: the
// first rule that matches wins, so the most specific issue is always reported.

import { deterministicVerdict, normalize, type Verdict } from "./mathEquivalence.ts";

export type DiagnosisCode =
  | "equivalent"
  | "incomplete_line"
  | "incomplete_equation"
  | "incomplete_simplification"
  | "incorrect_expression"
  | "incorrect_calculation"
  | "incorrect_sign"
  | "incorrect_expansion"
  | "incorrect_factorisation"
  | "incorrect_substitution"
  | "incorrect_rearrangement"
  | "missing_equals_sign"
  | "missing_bracket"
  | "missing_term"
  | "extra_term"
  | "invalid_expression"
  | "not_in_floating_set"
  | "number_not_given"
  | "symbol_not_supplied"
  | "cannot_evaluate_yet"
  | "not_equivalent";

export interface Diagnosis {
  code: DiagnosisCode;
  label: string;
  detail: string;
}

const D = (code: DiagnosisCode, label: string, detail: string): Diagnosis => ({ code, label, detail });

/* ── text helpers ───────────────────────────────────────────────────────── */

const clean = (s: string): string =>
  String(s ?? "")
    .replace(/\u2212|[–—]/g, "-")
    .replace(/\u00d7/g, "*")
    .replace(/\u00b7/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\s+/g, " ")
    .trim();

/** Alphanumeric skeleton — used for "same characters, different structure". */
const alnum = (s: string): string => clean(s).replace(/[^A-Za-z0-9.]/g, "").toLowerCase();

/** Structure skeleton — numerals collapsed to `#`. */
const numSkeleton = (s: string): string =>
  clean(s).replace(/\d+(?:\.\d+)?/g, "#").replace(/\s+/g, "").toLowerCase();

const numeralsOf = (s: string): string[] => clean(s).match(/\d+(?:\.\d+)?/g) ?? [];

const eqParts = (s: string): string[] => clean(s).split("=").map((p) => p.trim());

const hasEq = (s: string): boolean => clean(s).includes("=");

const balanced = (s: string): boolean => {
  let d = 0;
  for (const ch of clean(s)) {
    if (ch === "(") d++;
    else if (ch === ")") { d--; if (d < 0) return false; }
  }
  return d === 0;
};

const bracketCount = (s: string): number => (clean(s).match(/\(/g) ?? []).length;

const hasVariable = (s: string): boolean => /[A-Za-z]/.test(clean(s));

/** Split an expression into signed top-level terms. */
export const topTerms = (expr: string): Array<{ sign: 1 | -1; body: string }> => {
  const s = clean(expr).replace(/\s+/g, "");
  const out: Array<{ sign: 1 | -1; body: string }> = [];
  let depth = 0;
  let sign: 1 | -1 = 1;
  let buf = "";
  const push = () => {
    if (buf) out.push({ sign, body: buf });
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    const prev = s[i - 1];
    const isSplit =
      depth === 0 &&
      (ch === "+" || ch === "-") &&
      i > 0 &&
      prev !== undefined &&
      !"+-*/^(".includes(prev);
    if (isSplit) {
      push();
      sign = ch === "-" ? -1 : 1;
      continue;
    }
    if (i === 0 && (ch === "+" || ch === "-")) {
      sign = ch === "-" ? -1 : 1;
      continue;
    }
    buf += ch;
  }
  push();
  return out;
};

/** Signed terms of `lhs - rhs` (an equation moved to one side). */
const equationTerms = (line: string): Array<{ sign: 1 | -1; body: string }> => {
  const parts = eqParts(line);
  const left = topTerms(parts[0] ?? "");
  const rest = parts.slice(1).flatMap((p) => topTerms(p).map((t) => ({ sign: (t.sign * -1) as 1 | -1, body: t.body })));
  return [...left, ...rest];
};

const bag = (items: string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return m;
};

const bagDiff = (a: Map<string, number>, b: Map<string, number>) => {
  const missing: string[] = [];
  const extra: string[] = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    const d = (a.get(k) ?? 0) - (b.get(k) ?? 0);
    for (let i = 0; i < d; i++) missing.push(k);
    for (let i = 0; i < -d; i++) extra.push(k);
  }
  return { missing, extra };
};

const termKey = (t: { sign: 1 | -1; body: string }) => t.body.toLowerCase();
const signedKey = (t: { sign: 1 | -1; body: string }) => `${t.sign > 0 ? "+" : "-"}${t.body.toLowerCase()}`;

const isEqual = (a: string, b: string): boolean => {
  try { return deterministicVerdict(a, b) === "equal"; } catch { return false; }
};

const parses = (s: string): boolean => {
  const body = clean(s);
  if (!body) return false;
  try { normalize(body); } catch { return false; }
  return true;
};

/* ── individual detectors ───────────────────────────────────────────────── */

const INVALID_PATTERNS = [
  /==/,
  /\+\s*\+/,
  /--\s*[A-Za-z0-9(]/,
  /\*\s*\*/,
  /\/\s*\//,
  /\^\s*\^/,
  /^\s*[*/^]/,
  /=\s*=/,
  /[A-Za-z0-9)]\s*=\s*=/,
];

const looksInvalid = (student: string): boolean => {
  const s = clean(student);
  if (!s) return true;
  if (INVALID_PATTERNS.some((re) => re.test(s))) return true;
  // A stray operator with nothing to operate on, e.g. "* 4 = 8".
  if (/^[*/^]/.test(s)) return true;
  return false;
};

const endsDangling = (student: string): "equation" | "line" | null => {
  const s = clean(student);
  if (/=\s*$/.test(s)) return "equation";
  if (/[+\-*/^(]\s*$/.test(s)) return "line";
  return null;
};

/** Teacher line is an identity/simplification (both sides the same value). */
const isSimplificationIdentity = (teacher: string): boolean => {
  const parts = eqParts(teacher);
  if (parts.length !== 2) return false;
  if (!hasVariable(parts[0]) && !hasVariable(parts[1])) return false;
  return isEqual(parts[0], parts[1]);
};

/** Would a single sign flip make the student's line correct? */
const signFlipFixes = (teacher: string, student: string): boolean => {
  const parts = eqParts(student);
  const candidates: string[] = [];
  if (parts.length === 2) {
    candidates.push(`${parts[0]} = ${flipAll(parts[1])}`);
    candidates.push(`${flipAll(parts[0])} = ${parts[1]}`);
    for (const side of [0, 1]) {
      const terms = topTerms(parts[side]);
      for (let i = 0; i < terms.length; i++) {
        const rebuilt = terms
          .map((t, j) => `${(j === i ? -t.sign : t.sign) > 0 ? "+" : "-"}${t.body}`)
          .join("")
          .replace(/^\+/, "");
        candidates.push(side === 0 ? `${rebuilt} = ${parts[1]}` : `${parts[0]} = ${rebuilt}`);
      }
    }
  } else {
    candidates.push(flipAll(parts[0] ?? student));
    const terms = topTerms(student);
    for (let i = 0; i < terms.length; i++) {
      candidates.push(
        terms
          .map((t, j) => `${(j === i ? -t.sign : t.sign) > 0 ? "+" : "-"}${t.body}`)
          .join("")
          .replace(/^\+/, ""),
      );
    }
  }
  return candidates.some((c) => isEqual(teacher, c));
};

const flipAll = (expr: string): string => {
  const terms = topTerms(expr);
  if (!terms.length) return expr;
  return terms
    .map((t) => `${t.sign > 0 ? "-" : "+"}${t.body}`)
    .join("")
    .replace(/^\+/, "");
};

const hasBracketProduct = (s: string): boolean =>
  /\)\s*\(/.test(clean(s)) || /\)\s*\^\s*2/.test(clean(s)) || /[0-9A-Za-z]\s*\(/.test(clean(s));

/* ── main entry ─────────────────────────────────────────────────────────── */

export function diagnoseLine(
  teacherAscii: string,
  studentAscii: string,
  verdict: Verdict | "not_in_floating_set",
  /** The floating chips supplied for this line — lets us say whether the
   *  offending atom was a NUMBER or a SYMBOL the student introduced. */
  allowedTokens?: string[],
): Diagnosis {
  const teacher = clean(teacherAscii);
  const student = clean(studentAscii);

  // 0 — nothing to judge yet.
  if (!student) {
    return D("cannot_evaluate_yet", "Nothing written", "This line is still empty, so there is no expression to evaluate.");
  }

  if (verdict === "not_in_floating_set") {
    const atoms = (s: string): string[] =>
      (clean(s).match(/[A-Za-z]+|\d+(?:\.\d+)?/g) ?? []).map((t) => t.toLowerCase());
    const allowed = new Set((allowedTokens ?? []).flatMap(atoms));
    const offending = allowed.size > 0 ? atoms(student).filter((a) => !allowed.has(a)) : [];
    const symbolIntroduced = offending.some((a) => /[A-Za-z]/.test(a));
    if (symbolIntroduced) {
      return D(
        "symbol_not_supplied",
        "Symbol not supplied",
        "The line introduces a letter or symbol that was not among the items supplied for this step.",
      );
    }
    return D(
      "number_not_given",
      "Number not given",
      "The line uses a value that was not among the floating numbers supplied for this step.",
    );
  }


  // 1 — invalid notation
  if (looksInvalid(student) || !parses(student)) {
    return D("invalid_expression", "Invalid expression", "The notation itself is not valid mathematics, so the line cannot be evaluated.");
  }

  // 2 — half-finished working
  const dangling = endsDangling(student);
  if (dangling === "equation") {
    return D("incomplete_equation", "Incomplete equation", "The equals sign is written but the right-hand side is still empty.");
  }
  if (dangling === "line") {
    return D("incomplete_line", "Incomplete line", "The line stops on an operator, so the step has not been finished.");
  }

  const tHasEq = hasEq(teacher);
  const sHasEq = hasEq(student);

  if (tHasEq && !sHasEq) {
    // 3 — missing equals sign: all the characters are there, the "=" is not.
    if (alnum(teacher) === alnum(student)) {
      return D("missing_equals_sign", "Missing equals sign", "Both sides of the statement are written but the equals sign between them is missing.");
    }
    const tLhs = eqParts(teacher)[0] ?? "";
    if (isEqual(tLhs, student) || alnum(tLhs) === alnum(student)) {
      if (isSimplificationIdentity(teacher)) {
        return D("incomplete_simplification", "Incomplete simplification", "The expression has been copied but not simplified into its final form.");
      }
      return D("incomplete_line", "Incomplete line", "Only the first part of the step is written; the rest of the line is missing.");
    }
  }

  // 4 — brackets
  if (!balanced(student)) {
    return D("missing_bracket", "Missing bracket", "A bracket is opened or closed without its partner.");
  }
  if (bracketCount(student) < bracketCount(teacher) && alnum(student) === alnum(teacher)) {
    return D("missing_bracket", "Missing bracket", "The same terms are written but a required pair of brackets is absent, which changes the grouping.");
  }

  // 5 — correct (possibly by another valid route)
  if (verdict === "equal") {
    return D("equivalent", "Equivalent", "The line is mathematically equivalent to the expected step, even if the route differs.");
  }

  // 6 — a single sign
  if (signFlipFixes(teacher, student)) {
    return D("incorrect_sign", "Incorrect sign", "The working is right apart from one positive/negative sign.");
  }

  const tParts = eqParts(teacher);
  const sParts = eqParts(student);

  // 7 — arithmetic slip in a purely numeric statement
  if (tParts.length === 2 && sParts.length === 2 && !hasVariable(tParts[0]) && !hasVariable(sParts[0])) {
    if (isEqual(tParts[0], sParts[0]) || alnum(tParts[0]) === alnum(sParts[0])) {
      return D("incorrect_calculation", "Incorrect calculation", "The method is right but the arithmetic result is wrong.");
    }
  }

  // 8 — expansion
  const teacherHasBrackets = bracketCount(teacher) > 0 || /\^\s*2/.test(teacher);
  if (teacherHasBrackets && bracketCount(student) === 0 && hasBracketProduct(teacher)) {
    return D("incorrect_expansion", "Incorrect expansion", "The bracket has not been multiplied out correctly across every term.");
  }

  // 9 — factorisation
  if (bracketCount(teacher) === 0 && /\)\s*\(/.test(student)) {
    return D("incorrect_factorisation", "Incorrect factorisation", "The factors chosen do not multiply back to the original expression.");
  }

  // 10 — substitution
  if (
    /\(\s*-?\d+(?:\.\d+)?\s*\)/.test(teacher) &&
    numSkeleton(teacher) === numSkeleton(student) &&
    numeralsOf(teacher).join(",") !== numeralsOf(student).join(",")
  ) {
    return D("incorrect_substitution", "Incorrect substitution", "A value has been substituted into the expression incorrectly.");
  }

  // 11–13 — term-level comparison of (lhs − rhs)
  if (parses(teacher)) {
    const tTerms = equationTerms(teacher);
    const sTerms = equationTerms(student);
    const unsignedDiff = bagDiff(bag(tTerms.map(termKey)), bag(sTerms.map(termKey)));
    const signedDiff = bagDiff(bag(tTerms.map(signedKey)), bag(sTerms.map(signedKey)));

    // 11 — same terms, wrong side / wrong sign after moving
    if (unsignedDiff.missing.length === 0 && unsignedDiff.extra.length === 0 && signedDiff.missing.length > 0) {
      return D("incorrect_rearrangement", "Incorrect rearrangement", "A term was moved across the equals sign without changing its sign correctly.");
    }
    // 12 — a term dropped
    if (unsignedDiff.missing.length > 0 && unsignedDiff.extra.length === 0) {
      return D("missing_term", "Missing term", "One of the terms from the previous step has been dropped.");
    }
    // 13 — a term appeared
    if (unsignedDiff.extra.length > 0 && unsignedDiff.missing.length === 0) {
      return D("extra_term", "Extra term", "A term appears that does not belong to this step.");
    }
    if (unsignedDiff.missing.length > 0 || unsignedDiff.extra.length > 0) {
      return D("incorrect_expression", "Incorrect expression", "The expression has been changed in a way that alters its mathematical meaning.");
    }
  }

  if (verdict === "not_equal") {
    return D("not_equivalent", "Not equivalent", "The line is valid mathematics but does not preserve equivalence with the expected step.");
  }

  return D("not_equivalent", "Not equivalent", "The line could not be shown to be equivalent to the expected step.");
}

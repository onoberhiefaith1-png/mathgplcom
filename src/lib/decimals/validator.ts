// Decimal challenge validators. Built on top of fraction-challenge parser
// (which already understands decimals and fractions), with kind-specific
// finalization rules.

import { Node } from "@/lib/mathboard/tokens";
import { parseExpr, isSingleCanonical } from "@/lib/fraction-challenge/validator";
import { Frac, reduce, decimalMatchesFraction, expandDecimal } from "./decimalUtils";
import { DecimalKind, GeneratedDecimal } from "./generator";

const fracEq = (a: Frac, b: Frac) => {
  const ra = reduce(a), rb = reduce(b);
  return ra.n === rb.n && ra.d === rb.d;
};

/** Read a row of nodes as a plain decimal string if possible. */
const nodesToDecimalString = (nodes: Node[]): string | null => {
  let out = "";
  let sign = 1;
  let i = 0;
  while (i < nodes.length && nodes[i].kind === "op" && ((nodes[i] as any).op === "+" || (nodes[i] as any).op === "-")) {
    if ((nodes[i] as any).op === "-") sign = -sign;
    i++;
  }
  for (; i < nodes.length; i++) {
    const n: any = nodes[i];
    if (n.kind === "num") out += n.value;
    else if (n.kind === "op" && n.op === ".") out += ".";
    else return null;
  }
  if (!out) return null;
  return (sign < 0 ? "-" : "") + out;
};

export type Status = "final" | "equivalent" | "invalid";

export interface DecValidationResult {
  status: Status;
}

/** Validate a student row against the expected decimal challenge. */
export const validateDecimalRow = (
  studentNodes: Node[],
  q: GeneratedDecimal,
): DecValidationResult => {
  if (!studentNodes || studentNodes.length === 0) return { status: "invalid" };

  // Special handling: Fraction → Decimal answer accepted as decimal string with
  // ≥4 repetitions of the repetend, or any equivalent fraction.
  if (q.kind === "frac-to-dec" && q.source) {
    const decStr = nodesToDecimalString(studentNodes);
    if (decStr !== null) {
      if (decimalMatchesFraction(decStr, q.source.n, q.source.d, 4)) {
        return { status: "final" };
      }
      // For terminating: also accept exact equality
      const exp = expandDecimal(q.source.n, q.source.d);
      if (!exp.repetend && decimalMatchesFraction(decStr, q.source.n, q.source.d, 0)) {
        return { status: "final" };
      }
    }
    // Fall through to fraction equivalence
    const v = parseExpr(studentNodes);
    if (v && fracEq(v, q.answer)) return { status: "equivalent" };
    return { status: "invalid" };
  }

  // Decimal → Fraction: require a single reduced fraction or integer for "final".
  if (q.kind === "dec-to-frac") {
    const v = parseExpr(studentNodes);
    if (!v || !fracEq(v, q.answer)) return { status: "invalid" };
    if (isSingleCanonical(studentNodes, q.answer)) return { status: "final" };
    return { status: "equivalent" };
  }

  // All arithmetic kinds: any equivalent value works; "final" when canonical
  // single value (decimal string OR canonical fraction).
  const v = parseExpr(studentNodes);
  if (!v || !fracEq(v, q.answer)) return { status: "invalid" };
  // Decimal canonical: pure decimal/integer string
  const decStr = nodesToDecimalString(studentNodes);
  if (decStr !== null) {
    // Make sure it represents the answer exactly (terminating).
    const ans = q.answer;
    // Build the terminating decimal of the answer if possible
    const exp = expandDecimal(ans.n, ans.d);
    if (!exp.repetend) {
      return { status: "final" };
    }
    // Repeating answer: accept ≥4 repetitions
    if (decimalMatchesFraction(decStr, ans.n, ans.d, 4)) return { status: "final" };
    return { status: "equivalent" };
  }
  if (isSingleCanonical(studentNodes, q.answer)) return { status: "final" };
  return { status: "equivalent" };
};

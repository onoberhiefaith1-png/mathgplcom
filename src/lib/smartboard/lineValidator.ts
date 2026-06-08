// Per-line validation with true symbolic equivalence (canonical form).
import { Node } from "@/lib/mathboard/tokens";
import { endsWithDangler, nodesToAscii, splitAtEq } from "./nodeUtils";
import { canonical, canonicalEqual } from "./canonical";

// purple = symbolically equivalent but diverges from the notebook's expected
// path (teacher chose a different but valid method — AI validation mode).
export type LineStatus = "empty" | "yellow" | "blue" | "red" | "purple";

export const validateLine = (current: Node[], previous: Node[]): LineStatus => {
  if (!current.length) return "empty";
  if (endsWithDangler(current)) return "yellow";
  const { lhs, rhs, hasEq } = splitAtEq(current);
  if (!hasEq || !lhs.length || !rhs.length) return "yellow";

  const curAscii = nodesToAscii(current);
  const prevAscii = nodesToAscii(previous);
  const cur = canonical(curAscii);
  const prev = canonical(prevAscii);
  if (!cur || !prev) return "yellow"; // mid-edit / cannot decide

  return canonicalEqual(cur, prev) ? "blue" : "red";
};

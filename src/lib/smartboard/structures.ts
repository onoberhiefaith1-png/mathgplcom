// Layer 3 structure templates. Tapping a structure chip inserts an empty
// container node and the cursor lands inside the first slot.

import { Node, mkBracket, mkFrac, mkPower, mkRoot, mkAbs } from "@/lib/mathboard/tokens";

export type StructureId = "paren" | "frac" | "power" | "root" | "abs";

export interface StructureSpec {
  id: StructureId;
  label: string; // shown on the chip
}

export const STRUCTURES: StructureSpec[] = [
  { id: "paren", label: "( )" },
  { id: "frac",  label: "□/□" },
  { id: "power", label: "□^□" },
  { id: "root",  label: "√□" },
  { id: "abs",   label: "|□|" },
];

export const buildStructure = (id: StructureId): Node[] => {
  switch (id) {
    case "paren": return [mkBracket("inline", "(")];
    case "frac":  return [mkFrac()];
    case "power": return [mkPower()];
    case "root":  return [mkRoot(false)];
    case "abs":   return [mkAbs()];
  }
};

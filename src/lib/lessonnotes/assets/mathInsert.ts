// Bridge between the Asset Library registry and the universal math editor
// (`MathInlineCanvas`). The @-menu inside mathematics uses the SAME asset
// definitions as the prose @-menu and the Asset Library dialog; this module
// only translates an `AssetDef` into math-tree nodes.

import type { AssetDef } from "./types";
import {
  type Node as MathNode,
  mkFrac,
  mkSqrt,
  mkPower,
  mkSub,
  mkSubSup,
  mkBracket,
  mkAbs,
  mkNorm,
  mkFloor,
  mkCeil,
  mkBigOp,
  mkMatrix,
  mkAccent,
  mkBinom,
} from "@/lib/smartboard/mathTree";

export interface MathInsertion {
  /** Plain characters typed before the structure (e.g. "log", "f"). */
  prefix?: string;
  /** Structure the caret descends into. */
  node?: MathNode;
}

const num = (v: unknown, d: number) => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const brFor = (br: unknown): ["(" | "[" | "{" | "|", ")" | "]" | "}" | "|"] => {
  switch (String(br ?? "(")) {
    case "[": return ["[", "]"];
    case "{": return ["{", "}"];
    case "|": return ["|", "|"];
    default: return ["(", ")"];
  }
};

/**
 * Translate an asset into something insertable inside a math run.
 * Returns `null` when the asset is a whole page object (diagram, chart,
 * table, image, saved node…) that cannot live inside an expression.
 */
export function assetToMathInsertion(a: AssetDef): MathInsertion | null {
  const r = a.render;

  if (r.kind === "symbol") return { prefix: r.char };
  if (r.kind !== "structure") return null;

  const attrs = (r.attrs ?? {}) as Record<string, unknown>;

  switch (r.structure) {
    case "fraction":
    case "slanted":
    case "mixed":
    case "deriv":
    case "partial":
      return { node: mkFrac() };

    case "sqrt":
      return { node: mkSqrt(false) };
    case "cuberoot":
    case "nroot":
      return { node: mkSqrt(true) };

    case "power":
      return { node: mkPower() };
    case "sub":
      return { node: mkSub() };
    case "subsup":
      return { node: mkSubSup() };

    case "log":
      return { prefix: "log", node: mkSub() };
    case "ln":
      return { prefix: "ln", node: mkBracket("(", ")") };
    case "func":
      return { prefix: "f", node: mkBracket("(", ")") };

    case "paren":
      return { node: mkBracket("(", ")") };
    case "sqbracket":
      return { node: mkBracket("[", "]") };
    case "brace":
      return { node: mkBracket("{", "}") };
    case "abs":
      return { node: mkAbs() };
    case "norm":
      return { node: mkNorm() };
    case "floor":
      return { node: mkFloor() };
    case "ceil":
      return { node: mkCeil() };

    case "bigop": {
      const op = String(attrs.op ?? "∑");
      if (op === "∏") return { node: mkBigOp("prod") };
      if (op === "∮") return { node: mkBigOp("oint") };
      if (op === "∫" || op === "∬") return { node: mkBigOp("int") };
      return { node: mkBigOp("sum") };
    }
    case "limit":
      return { node: mkBigOp("lim") };

    case "binom":
      return { node: mkBinom() };

    case "accent":
      return { node: mkAccent(String(attrs.mark ?? "¯")) };
    case "vector":
      return { node: mkAccent("→") };

    case "matrix": {
      const [l, rgt] = brFor(attrs.br);
      return { node: mkMatrix(num(attrs.rows, 2), num(attrs.cols, 2), l, rgt) };
    }

    default:
      return null;
  }
}

/** Can this asset be inserted inside a mathematical expression? */
export const isMathInsertable = (a: AssetDef) => assetToMathInsertion(a) !== null;

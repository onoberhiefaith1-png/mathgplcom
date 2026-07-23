// Helpers to convert between flat ASCII strings and MathBoard Node[] trees.
// Scope: Linear Equations only — digits, +, -, *, /, =, parentheses, single
// letter variables (x/y), and slash fractions (a/b).

import {
  Node, mkNum, mkVar, mkOp, mkEq, mkBracket, mkFrac,
} from "@/lib/mathboard/tokens";

/** Best-effort flatten of a Node[] subtree to ASCII. Used by the predictor. */
export const nodesToAscii = (nodes: Node[]): string => {
  let out = "";
  for (const n of nodes) {
    switch (n.kind) {
      case "num": out += n.value; break;
      case "var": out += n.name; break;
      case "op":
        out += n.op === "·" || n.op === "*" ? "*"
          : n.op === "/" ? "/" : n.op;
        break;
      case "eq": out += n.op; break;
      case "bracket": out += "(" + nodesToAscii(n.body) + ")"; break;
      case "frac": out += "(" + nodesToAscii(n.num) + ")/(" + nodesToAscii(n.den) + ")"; break;
      case "power": out += nodesToAscii(n.base) + "^(" + nodesToAscii(n.exp) + ")"; break;
      default: break;
    }
  }
  return out;
};

/** Tiny parser: ASCII string → Node[]. Supports digits, x/y/z, + - * / = ( ).
 *  Special tokens: "÷"→"/", "×"→"*", "−"→"-". Slash makes a fraction only when
 *  followed by a number/variable; otherwise stays as op. For linear-equation
 *  suggestions we keep flat structure (no fractions unless explicit).
 */
export const asciiToNodes = (s: string): Node[] => {
  const src = s
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/\s+/g, "");
  const out: Node[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isAlpha = (c: string) => /[a-zA-Z]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (isDigit(c)) {
      let j = i;
      while (j < src.length && (isDigit(src[j]) || src[j] === ".")) j++;
      out.push(mkNum(src.slice(i, j)));
      i = j;
    } else if (isAlpha(c)) {
      out.push(mkVar(c));
      i++;
    } else if (c === "+" || c === "-" || c === "*") {
      out.push(mkOp(c as any));
      i++;
    } else if (c === "/") {
      out.push(mkOp("/" as any));
      i++;
    } else if (c === "=") {
      out.push(mkEq("="));
      i++;
    } else if (c === "(") {
      // parse until matching )
      let depth = 1, j = i + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")") depth--;
        if (depth) j++;
      }
      const inner = src.slice(i + 1, j);
      const br = mkBracket("inline", "(");
      br.body = asciiToNodes(inner);
      out.push(br);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
};

/** Build a fraction node from two ascii strings. */
export const makeFracNodes = (numStr: string, denStr: string): Node[] => {
  const f = mkFrac();
  f.num = asciiToNodes(numStr);
  f.den = asciiToNodes(denStr);
  return [f];
};

/** Whether the last meaningful token is an operator/eq (line is mid-typing). */
export const endsWithDangler = (nodes: Node[]): boolean => {
  if (!nodes.length) return false;
  const last = nodes[nodes.length - 1];
  return last.kind === "op" || last.kind === "eq";
};

/** Split a Node[] equation around the first '=' into [lhs, rhs] (rhs may be empty). */
export const splitAtEq = (nodes: Node[]): { lhs: Node[]; rhs: Node[]; hasEq: boolean } => {
  const idx = nodes.findIndex((n) => n.kind === "eq");
  if (idx < 0) return { lhs: nodes, rhs: [], hasEq: false };
  return { lhs: nodes.slice(0, idx), rhs: nodes.slice(idx + 1), hasEq: true };
};

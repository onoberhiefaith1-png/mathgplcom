// Picks a context-appropriate assistant hint for the current line.
// Returns text-only descriptions for now — visual mini-helpers can be wired later.

import { Node } from "./tokens";

export interface AssistantHint {
  kind: "idle" | "balancing" | "long-division" | "visual-grouping" | "long-mul" | "lcm" | "decimal-to-frac";
  title: string;
  body: string;
}

const flatten = (nodes: Node[]): string => {
  let s = "";
  for (const n of nodes) {
    switch (n.kind) {
      case "num": s += n.value; break;
      case "var": s += n.name; break;
      case "op": s += n.op === "*" ? "×" : n.op === "/" ? "÷" : n.op; break;
      case "eq": s += n.op; break;
      case "sym": s += n.name; break;
      case "frac": s += `(${flatten(n.num)})/(${flatten(n.den)})`; break;
      case "bracket": s += `(${flatten(n.body)})`; break;
      case "power": s += `${flatten(n.base)}^${flatten(n.exp)}`; break;
      case "root": s += `√(${flatten(n.radicand)})`; break;
      default: break;
    }
  }
  return s;
};

const findOp = (s: string, op: string): { a: number; b: number } | null => {
  // Look for "<num> op <num>" patterns (allow decimals).
  const re = new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${op}\\s*(-?\\d+(?:\\.\\d+)?)`);
  const m = s.match(re);
  if (!m) return null;
  return { a: parseFloat(m[1]), b: parseFloat(m[2]) };
};

export const pickAssistant = (line: Node[], question: Node[]): AssistantHint => {
  const s = flatten(line);
  const q = flatten(question);
  const target = s || q;

  // Decimal × or ÷ decimal
  const decMul = target.match(/-?\d+\.\d+\s*[×÷]\s*-?\d+\.\d+/);
  if (decMul) {
    return {
      kind: "decimal-to-frac",
      title: "Decimal strategy",
      body: "Tip: convert each decimal into a fraction first.\n\nExample: 0.5 = 1/2,  0.2 = 1/5\nThen multiply or divide as fractions, and convert the result back if needed.",
    };
  }

  // Division
  const div = findOp(target, "÷");
  if (div && Number.isInteger(div.b)) {
    if (div.b > 0 && div.b <= 30 && Number.isInteger(div.a)) {
      return {
        kind: "visual-grouping",
        title: "Visual grouping",
        body: `Try grouping ${div.a} into sets of ${div.b}.\nCount the full groups — anything left is the remainder.`,
      };
    }
    return {
      kind: "long-division",
      title: "Long division",
      body: `Set up long division: ${div.a} ÷ ${div.b}.\nDivide the leading digits, multiply down, subtract, bring down the next digit, repeat.`,
    };
  }

  // Multiplication of multi-digit
  const mul = findOp(target, "×");
  if (mul && Number.isInteger(mul.a) && Number.isInteger(mul.b) && (Math.abs(mul.a) > 9 || Math.abs(mul.b) > 9)) {
    return {
      kind: "long-mul",
      title: "Long multiplication",
      body: `Stack ${mul.a} × ${mul.b} in columns.\nMultiply by each digit of the bottom number, shift, then add the partial products.`,
    };
  }

  // Fraction add/sub with unequal denominators
  const fracMatch = s.match(/\((-?\d+)\)\/\((\d+)\)\s*[+\-]\s*\((-?\d+)\)\/\((\d+)\)/);
  if (fracMatch && fracMatch[2] !== fracMatch[4]) {
    return {
      kind: "lcm",
      title: "Common denominator",
      body: `Find the LCM of ${fracMatch[2]} and ${fracMatch[4]}, then rewrite each fraction with that denominator before adding or subtracting.`,
    };
  }

  // Equation with =
  if (q.includes("=") || s.includes("=")) {
    return {
      kind: "balancing",
      title: "Equation balancing",
      body: "Whatever you do to one side of the equal sign, do to the other.\nAdd, subtract, multiply or divide both sides to isolate the unknown.",
    };
  }

  return {
    kind: "idle",
    title: "Verifying line by line",
    body: "Type your next step on the board and press Enter.\nThe board will check that your line is mathematically equivalent to the previous one.",
  };
};

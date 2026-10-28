// Graph app maths — independent of the Lesson Note / Smartboard graph
// (src/lib/graph/*). Everything is computed on the device, no AI.
import { compile, parse } from "mathjs";

export type Fn = (scope: Record<string, number>) => number;

export type ParsedEquation =
  | { kind: "curve2d"; f: Fn; src: string }
  | { kind: "implicit2d"; f: Fn; src: string }
  | { kind: "surface"; f: Fn; src: string }
  | { kind: "implicit3d"; f: Fn; src: string }
  | { kind: "parametric"; fx: Fn; fy: Fn; fz: Fn; dimension: 2 | 3; src: string }
  | { kind: "point3d"; p: [number, number, number]; src: string }
  | { kind: "point2d"; p: [number, number]; src: string }
  | { kind: "error"; message: string; src: string };

/** Teacher-friendly input → mathjs syntax (², √, ·, implicit "2x"). */
export function normalise(input: string): string {
  return input
    .replace(/²/g, "^2").replace(/³/g, "^3")
    .replace(/√\s*\(/g, "sqrt(").replace(/√\s*([a-z0-9.]+)/gi, "sqrt($1)")
    .replace(/[·×]/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
    .replace(/\|([^|]+)\|/g, "abs($1)")
    .replace(/π/g, "pi").replace(/\bln\(/g, "log(")
    .replace(/\blog\(/g, "LOG10(")
    .trim();
}

function makeFn(expr: string): Fn {
  const expression = normalise(expr).replace(/LOG10\(/g, "log10(");
  parse(expression).traverse((node) => {
    if (node.type === "SymbolNode" && "name" in node && !["x", "y", "z", "t", "e", "pi", "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "sqrt", "abs", "log", "log10", "exp", "floor", "ceil", "min", "max", "sign"].includes(String(node.name))) throw new Error(`Unknown symbol: ${String(node.name)}`);
    if (["AssignmentNode", "FunctionAssignmentNode", "BlockNode", "AccessorNode"].includes(node.type)) throw new Error("Enter a mathematical expression");
  });
  const code = compile(expression);
  return (scope) => {
    try {
      const v = code.evaluate({ ...scope, e: Math.E, pi: Math.PI });
      return typeof v === "number" ? v : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };
}

const NUM = /^\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\)\s*$/;

export function parseEquation(src: string): ParsedEquation {
  const s = src.trim();
  if (!s) return { kind: "error", message: "Enter an equation", src };
  try {
    const pm = s.match(NUM);
    if (pm) {
      return pm[3] !== undefined
        ? { kind: "point3d", p: [+pm[1], +pm[2], +pm[3]], src }
        : { kind: "point2d", p: [+pm[1], +pm[2]], src };
    }
    // Parametric: "x = cos(t); y = sin(t); z = t" (or commas between parts)
    if (/\bt\b/.test(s) && /x\s*=/.test(s) && /y\s*=/.test(s)) {
      const parts = s.split(/[;\n]|,(?=\s*[xyz]\s*=)/).map((p) => p.trim()).filter(Boolean);
      const get = (v: string) => parts.find((p) => p.startsWith(v))?.split("=")[1] ?? "0";
      return { kind: "parametric", fx: makeFn(get("x")), fy: makeFn(get("y")), fz: makeFn(get("z")), dimension: /\bz\s*=/.test(s) ? 3 : 2, src };
    }
    const sides = s.split("=");
    if (sides.length === 1) {
      const f = makeFn(s);
      return /\by\b/.test(s) ? { kind: "surface", f, src } : { kind: "curve2d", f, src };
    }
    if (sides.length !== 2) return { kind: "error", message: "Use one '=' sign", src };
    const [l, r] = sides.map((x) => x.trim());
    if (!l || !r) return { kind: "error", message: "Complete both sides of the equation", src };
    if (l === "y" && !/\by\b/.test(r)) return { kind: "curve2d", f: makeFn(r), src };
    if (l === "z" && !/\bz\b/.test(r)) return { kind: "surface", f: makeFn(r), src };
    const L = makeFn(l), R = makeFn(r);
    const f: Fn = (sc) => L(sc) - R(sc);
    if (/\bz\b/.test(s)) return { kind: "implicit3d", f, src };
    return { kind: "implicit2d", f, src };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Cannot read equation", src };
  }
}

/** f(x,y) = left − right for any equation source, or null when unreadable. */
export function makeLinearFn(src: string): Fn | null {
  const eq = parseEquation(src);
  if (eq.kind === "implicit2d") return eq.f;
  if (eq.kind === "curve2d") return (sc) => sc.y - eq.f(sc);
  return null;
}

/** Pleasant tick step for a visible span (1, 2, 5 × 10ⁿ). */
export function niceStep(span: number, target = 10): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

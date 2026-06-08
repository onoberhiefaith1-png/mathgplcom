// MathBoard equivalence checker.
// Strategy: compile node tree → JS arithmetic expression string → evaluate
// numerically. If both sessions evaluate to the same number (within epsilon),
// they are equivalent. For symbolic content (variables) we do a multi-sample
// check: substitute several random values for each free variable and require
// every sample to match. Returns "unknown" if the expression contains content
// the v1 evaluator can't handle (integrals, matrices, etc.).

import { Node } from "./tokens";

type Result = { ok: true; equal: boolean } | { ok: false; reason: "unknown" };

const EPS = 1e-6;

const collectVars = (nodes: Node[], out: Set<string>) => {
  for (const n of nodes) {
    switch (n.kind) {
      case "var": out.add(n.name); break;
      case "frac": collectVars(n.num, out); collectVars(n.den, out); break;
      case "mixed": collectVars(n.whole, out); collectVars(n.num, out); collectVars(n.den, out); break;
      case "bracket": collectVars(n.body, out); break;
      case "power": collectVars(n.base, out); collectVars(n.exp, out); break;
      case "root": collectVars(n.radicand, out); break;
      case "abs": collectVars(n.body, out); break;
      case "func": collectVars(n.arg, out); break;
      default: break;
    }
  }
};

const compile = (nodes: Node[]): string | null => {
  let out = "";
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const prev = nodes[i - 1];
    // Implicit multiplication between adjacent atoms (number/var/closing structure)
    const needsMul =
      prev &&
      !["op", "eq"].includes(prev.kind) &&
      !["op", "eq"].includes(n.kind);
    if (needsMul) out += "*";
    switch (n.kind) {
      case "num": out += n.value || "0"; break;
      case "var": out += `__v.${n.name}`; break;
      case "op":
        out += n.op === "·" || n.op === "*" ? "*" : n.op === "/" ? "/" : n.op === "." ? "." : n.op === "!" ? "" : n.op;
        break;
      case "eq": return null; // handled by splitEq
      case "frac": {
        const a = compile(n.num); const b = compile(n.den);
        if (a == null || b == null) return null;
        out += `((${a || "0"})/(${b || "1"}))`;
        break;
      }
      case "mixed": {
        const w = compile(n.whole); const a = compile(n.num); const b = compile(n.den);
        if (w == null || a == null || b == null) return null;
        out += `((${w || "0"})+((${a || "0"})/(${b || "1"})))`;
        break;
      }
      case "bracket": {
        const b = compile(n.body);
        if (b == null) return null;
        out += `(${b || "0"})`;
        break;
      }
      case "power": {
        const a = compile(n.base); const b = compile(n.exp);
        if (a == null || b == null) return null;
        out += `Math.pow(${a || "0"},${b || "0"})`;
        break;
      }
      case "root": {
        const r = compile(n.radicand); if (r == null) return null;
        const d = n.degree ? compile(n.degree) : "2";
        if (d == null) return null;
        out += `Math.pow(${r || "0"},1/(${d || "2"}))`;
        break;
      }
      case "abs": {
        const b = compile(n.body); if (b == null) return null;
        out += `Math.abs(${b || "0"})`;
        break;
      }
      case "func": {
        const a = compile(n.arg); if (a == null) return null;
        const fn = ({ sin: "Math.sin", cos: "Math.cos", tan: "Math.tan", log: "Math.log10", ln: "Math.log", exp: "Math.exp" } as Record<string, string>)[n.name];
        if (!fn) return null;
        out += `${fn}(${a || "0"})`;
        break;
      }
      default: return null;
    }
  }
  return out;
};

const splitEq = (nodes: Node[]): Node[][] => {
  const parts: Node[][] = [[]];
  for (const n of nodes) {
    if (n.kind === "eq" && n.op === "=") parts.push([]);
    else parts[parts.length - 1].push(n);
  }
  return parts;
};

const evalOne = (nodes: Node[], vars: Record<string, number>): number | null => {
  const code = compile(nodes);
  if (code == null) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("__v", `return (${code || "0"});`);
    const v = fn(vars);
    if (typeof v !== "number" || !isFinite(v)) return null;
    return v;
  } catch { return null; }
};

export const equivalent = (a: Node[], b: Node[]): Result => {
  const partsA = splitEq(a);
  const partsB = splitEq(b);
  if (partsA.length !== partsB.length) return { ok: true, equal: false };

  const vars = new Set<string>();
  collectVars(a, vars); collectVars(b, vars);
  const varList = Array.from(vars);

  const samples = varList.length === 0 ? [{}] : Array.from({ length: 5 }, () => {
    const env: Record<string, number> = {};
    for (const v of varList) env[v] = (Math.random() - 0.5) * 6 + 1.7;
    return env;
  });

  for (const env of samples) {
    for (let i = 0; i < partsA.length; i++) {
      const va = evalOne(partsA[i], env);
      const vb = evalOne(partsB[i], env);
      if (va == null || vb == null) return { ok: false, reason: "unknown" };
      if (Math.abs(va - vb) > EPS * Math.max(1, Math.abs(va), Math.abs(vb))) {
        return { ok: true, equal: false };
      }
    }
  }
  return { ok: true, equal: true };
};

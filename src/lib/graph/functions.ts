// Graph function engine — parses school-level mathematical expressions in x
// and samples them into polyline segments for the Smart Graph.
//
// Deliberately dependency-free and safe: no eval / new Function. The parser is
// a small recursive-descent implementation supporting the operators and named
// functions used in school mathematics, including implicit multiplication
// (2x, 3sin(x), 2(x+1)) so a teacher can type naturally.

export type CompiledFn = (x: number) => number;

interface Token {
  kind: "num" | "name" | "op" | "(" | ")" | ",";
  value: string;
}

const FUNCS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: (v: number) => Math.log10(v),
  log10: (v: number) => Math.log10(v),
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
};

const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, π: Math.PI };

function tokenize(src: string): Token[] {
  const s = src
    .replace(/−/g, "-")
    .replace(/×|·|∙/g, "*")
    .replace(/÷/g, "/")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")");
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      out.push({ kind: "num", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Zπ]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9π]/.test(s[j])) j += 1;
      out.push({ kind: "name", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") { out.push({ kind: "(", value: c }); i += 1; continue; }
    if (c === ")") { out.push({ kind: ")", value: c }); i += 1; continue; }
    if (c === ",") { out.push({ kind: ",", value: c }); i += 1; continue; }
    if ("+-*/^%".includes(c)) { out.push({ kind: "op", value: c }); i += 1; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return out;
}

type Node = (x: number) => number;

/** Parse an expression in x into a compiled evaluator. Throws on bad syntax. */
export function compileExpression(src: string): CompiledFn {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const eat = (value?: string) => {
    const t = tokens[pos];
    if (!t) throw new Error("Unexpected end of expression");
    if (value && t.value !== value) throw new Error(`Expected "${value}"`);
    pos += 1;
    return t;
  };

  // expr := term (("+"|"-") term)*
  const parseExpr = (): Node => {
    let left = parseTerm();
    while (peek() && peek().kind === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = eat().value;
      const right = parseTerm();
      const l = left;
      left = op === "+" ? (x) => l(x) + right(x) : (x) => l(x) - right(x);
    }
    return left;
  };

  // term := unary (("*"|"/"|"%"|implicit) unary)*
  const parseTerm = (): Node => {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.kind === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        const op = eat().value;
        const right = parseUnary();
        const l = left;
        left = op === "*"
          ? (x) => l(x) * right(x)
          : op === "/"
            ? (x) => l(x) / right(x)
            : (x) => l(x) % right(x);
        continue;
      }
      // Implicit multiplication: 2x, 2(x+1), x sin(x), )(
      if (t.kind === "num" || t.kind === "name" || t.kind === "(") {
        const right = parseUnary();
        const l = left;
        left = (x) => l(x) * right(x);
        continue;
      }
      break;
    }
    return left;
  };

  // unary := ("+"|"-") unary | power
  const parseUnary = (): Node => {
    const t = peek();
    if (t && t.kind === "op" && (t.value === "-" || t.value === "+")) {
      const op = eat().value;
      const inner = parseUnary();
      return op === "-" ? (x) => -inner(x) : inner;
    }
    return parsePower();
  };

  // power := primary ("^" unary)?  (right associative)
  const parsePower = (): Node => {
    const base = parsePrimary();
    const t = peek();
    if (t && t.kind === "op" && t.value === "^") {
      eat("^");
      const exp = parseUnary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  };

  const parsePrimary = (): Node => {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.kind === "num") {
      const v = Number(eat().value);
      if (!Number.isFinite(v)) throw new Error("Bad number");
      return () => v;
    }
    if (t.kind === "(") {
      eat("(");
      const inner = parseExpr();
      eat(")");
      return inner;
    }
    if (t.kind === "name") {
      const name = eat().value;
      const lower = name.toLowerCase();
      if (peek() && peek().kind === "(" && (FUNCS[lower] !== undefined)) {
        eat("(");
        const args: Node[] = [parseExpr()];
        while (peek() && peek().kind === ",") { eat(","); args.push(parseExpr()); }
        eat(")");
        const fn = FUNCS[lower];
        return (x) => fn(...args.map((a) => a(x)));
      }
      if (lower === "x") return (x) => x;
      if (CONSTS[lower] !== undefined) { const c = CONSTS[lower]; return () => c; }
      if (FUNCS[lower] !== undefined) {
        // sin x (no brackets) — accept a single following factor.
        const fn = FUNCS[lower];
        const arg = parseUnary();
        return (x) => fn(arg(x));
      }
      throw new Error(`Unknown name "${name}"`);
    }
    throw new Error(`Unexpected "${t.value}"`);
  };

  const root = parseExpr();
  if (pos !== tokens.length) throw new Error("Unexpected trailing input");
  return (x: number) => {
    const v = root(x);
    return typeof v === "number" ? v : NaN;
  };
}

export interface CompileResult {
  fn: CompiledFn | null;
  error: string | null;
}

/** Non-throwing compile used by the UI. */
export function tryCompile(src: string): CompileResult {
  const clean = (src ?? "").trim().replace(/^y\s*=\s*/i, "");
  if (!clean) return { fn: null, error: "Enter an expression in x" };
  try {
    const fn = compileExpression(clean);
    // Smoke test a couple of values so obvious nonsense fails immediately.
    fn(1); fn(-1);
    return { fn, error: null };
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : "Invalid expression" };
  }
}

export interface SampleOptions {
  /** Visible / allowed y window — samples outside are treated as off-paper. */
  yMin: number;
  yMax: number;
  /** Number of sample columns across [x0, x1]. */
  samples?: number;
}

/**
 * Sample a compiled function across [x0, x1], returning polyline segments in
 * DATA coordinates. Segments break at undefined values and at asymptotes
 * (a sign-flipping jump far outside the visible window), so reciprocal and
 * tangent graphs are never joined across their poles.
 */
export function sampleFunction(
  fn: CompiledFn,
  x0: number,
  x1: number,
  opts: SampleOptions,
): Array<Array<{ x: number; y: number }>> {
  const n = Math.max(32, Math.min(4000, opts.samples ?? 900));
  const step = (x1 - x0) / n;
  const span = Math.max(1e-9, opts.yMax - opts.yMin);
  const guard = span * 4; // vertical tolerance before a jump counts as a break
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  let prevY: number | null = null;

  const flush = () => {
    if (current.length > 1) segments.push(current);
    current = [];
  };

  for (let i = 0; i <= n; i += 1) {
    const x = x0 + i * step;
    let y: number;
    try { y = fn(x); } catch { y = NaN; }
    if (!Number.isFinite(y)) { flush(); prevY = null; continue; }

    if (prevY !== null) {
      const jump = Math.abs(y - prevY);
      const crossed = (prevY - opts.yMin) * (y - opts.yMin) < 0 || (prevY - opts.yMax) * (y - opts.yMax) < 0;
      // Big jump that also flips sign across the window => asymptote.
      if (jump > guard && (Math.sign(y - opts.yMax) !== Math.sign(prevY - opts.yMax) || crossed)) {
        flush();
      }
    }

    // Clamp far-off values so the SVG path stays sane but still leaves the frame.
    const clamped = Math.max(opts.yMin - span, Math.min(opts.yMax + span, y));
    current.push({ x, y: clamped });
    prevY = y;
  }
  flush();
  return segments;
}

/** Central-difference gradient at a point. */
export function gradientAt(fn: CompiledFn, x: number, h = 1e-5): number {
  const a = fn(x + h);
  const b = fn(x - h);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return (a - b) / (2 * h);
}

/** Approximate intersections of two functions across [x0, x1] by sign change + bisection. */
export function findIntersections(
  f: CompiledFn,
  g: CompiledFn,
  x0: number,
  x1: number,
  samples = 800,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const step = (x1 - x0) / samples;
  const d = (x: number) => f(x) - g(x);
  let px = x0;
  let pd = d(px);
  for (let i = 1; i <= samples; i += 1) {
    const cx = x0 + i * step;
    const cd = d(cx);
    if (Number.isFinite(pd) && Number.isFinite(cd) && pd !== 0 && pd * cd < 0) {
      let lo = px, hi = cx, lod = pd;
      for (let k = 0; k < 40; k += 1) {
        const mid = (lo + hi) / 2;
        const md = d(mid);
        if (!Number.isFinite(md)) break;
        if (lod * md <= 0) { hi = mid; } else { lo = mid; lod = md; }
      }
      const xr = (lo + hi) / 2;
      const yr = f(xr);
      if (Number.isFinite(yr)) out.push({ x: xr, y: yr });
      if (out.length >= 24) break;
    }
    px = cx;
    pd = cd;
  }
  return out;
}

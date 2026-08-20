// MathGPL Math Engine — deterministic verification.
//
// Nothing mathematical is trusted because a model wrote it. Every claim the
// Engine makes is re-computed here, in code: factorability, discriminants,
// roots substituted back into the original equation, plain arithmetic.
//
// Structure before numbers: "five quadratics solvable by factorisation" fails
// here unless all five actually factorise over the integers.

import type { EngineClaim, EngineQuestion, EngineVerification } from "./types";

/* ── a tiny, safe arithmetic evaluator ─────────────────────────────── */

/** Turn board-notation into plain arithmetic the evaluator understands. */
export function normaliseExpression(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt(($1))");
  s = s.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, "(($2)^(1/$1))");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/[×·]/g, "*").replace(/[÷]/g, "/").replace(/−/g, "-");
  s = s.replace(/\s+/g, "");
  return s;
}

type Tok = { t: "num" | "op" | "lp" | "rp" | "id"; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "(") { out.push({ t: "lp", v: c }); i++; continue; }
    if (c === ")") { out.push({ t: "rp", v: c }); i++; continue; }
    if ("+-*/^".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    // anything else (=, <, letters with accents, units) is not arithmetic
    throw new Error(`unsupported character "${c}"`);
  }
  return out;
}

/** Evaluate a normalised arithmetic expression with named variables. */
export function evaluateExpression(raw: string, vars: Record<string, number> = {}): number {
  const toks = lex(normaliseExpression(raw));
  let p = 0;
  const peek = () => toks[p];

  const primary = (): number => {
    const t = peek();
    if (!t) throw new Error("unexpected end of expression");
    if (t.t === "op" && (t.v === "-" || t.v === "+")) {
      p++;
      const v = primary();
      return t.v === "-" ? -v : v;
    }
    if (t.t === "num") { p++; return Number(t.v); }
    if (t.t === "lp") {
      p++;
      const v = expr();
      if (peek()?.t !== "rp") throw new Error("missing )");
      p++;
      return implicit(v);
    }
    if (t.t === "id") {
      p++;
      const name = t.v.toLowerCase();
      if (peek()?.t === "lp") {
        p++;
        const arg = expr();
        if (peek()?.t !== "rp") throw new Error("missing )");
        p++;
        const fns: Record<string, (n: number) => number> = {
          sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
          ln: Math.log, log: Math.log10,
        };
        const fn = fns[name];
        if (!fn) throw new Error(`unknown function ${name}`);
        return implicit(fn(arg));
      }
      if (name === "pi" || name === "π") return implicit(Math.PI);
      if (!(t.v in vars) && !(name in vars)) throw new Error(`unknown symbol ${t.v}`);
      return implicit(t.v in vars ? vars[t.v] : vars[name]);
    }
    throw new Error("unexpected token");
  };

  /** 2x, 3(x+1) and x(x+1) all mean multiplication. */
  const implicit = (left: number): number => {
    const t = peek();
    if (t && (t.t === "id" || t.t === "lp" || t.t === "num")) {
      return left * power();
    }
    return left;
  };

  const power = (): number => {
    let base = primary();
    if (peek()?.t === "op" && peek()!.v === "^") {
      p++;
      const exp = power();
      base = Math.pow(base, exp);
    }
    return base;
  };

  const term = (): number => {
    let v = power();
    while (peek()?.t === "op" && (peek()!.v === "*" || peek()!.v === "/")) {
      const op = toks[p++].v;
      const r = power();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };

  const expr = (): number => {
    let v = term();
    while (peek()?.t === "op" && (peek()!.v === "+" || peek()!.v === "-")) {
      const op = toks[p++].v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  const value = expr();
  if (p !== toks.length) throw new Error("trailing characters");
  if (!Number.isFinite(value)) throw new Error("not a finite value");
  return value;
}

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/** "3/4", "-2", "1.5" → number. */
export function parseNumeric(raw: string): number | null {
  try {
    return evaluateExpression(String(raw ?? "").replace(/[a-zA-Z=\s]+$/g, ""));
  } catch {
    return null;
  }
}

/* ── claim checks ──────────────────────────────────────────────────── */

/** Does ax² + bx + c factorise over the integers? */
export function factorisesOverIntegers(a: number, b: number, c: number): boolean {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) || a === 0) return false;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const r = Math.round(Math.sqrt(disc));
  return r * r === disc;
}

export function discriminant(a: number, b: number, c: number): number {
  return b * b - 4 * a * c;
}

export function checkClaim(claim: EngineClaim | null | undefined): { ok: boolean; detail?: string } {
  if (!claim || claim.kind === "none") return { ok: true };
  switch (claim.kind) {
    case "factorisable_quadratic": {
      const ok = factorisesOverIntegers(claim.a, claim.b, claim.c);
      return ok
        ? { ok: true }
        : { ok: false, detail: `${claim.a}x² + ${claim.b}x + ${claim.c} does not factorise over the integers (discriminant ${discriminant(claim.a, claim.b, claim.c)}).` };
    }
    case "linear_root": {
      const root = parseNumeric(claim.root);
      if (root === null) return { ok: false, detail: `The stated root "${claim.root}" is not a number.` };
      const lhs = claim.a * root + claim.b;
      return near(lhs, 0)
        ? { ok: true }
        : { ok: false, detail: `Substituting x = ${claim.root} into ${claim.a}x + ${claim.b} gives ${lhs}, not 0.` };
    }
    case "quadratic_roots": {
      for (const r of claim.roots) {
        const x = parseNumeric(r);
        if (x === null) return { ok: false, detail: `The stated root "${r}" is not a number.` };
        const v = claim.a * x * x + claim.b * x + claim.c;
        if (!near(v, 0, 1e-4)) {
          return { ok: false, detail: `Substituting x = ${r} back into the equation gives ${v}, not 0.` };
        }
      }
      return { ok: true };
    }
    case "arithmetic": {
      // A claim may hold several parts ("x=180-105; y=180-80") and each part
      // may be written as an equation. Check every part independently.
      const parts = String(claim.expression ?? "")
        .split(/[;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const values = String(claim.value ?? "")
        .split(/[;,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.length) return { ok: true };

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const sides = part.split("=").map((s) => s.trim()).filter(Boolean);
        const rhs = sides.length > 1 ? sides[sides.length - 1] : part;
        const expected = sides.length > 1 && parseNumeric(sides[0]) !== null
          ? sides[0]
          : (values[i] ?? (parts.length === 1 ? values[0] : undefined));

        let computed: number;
        try {
          computed = evaluateExpression(rhs);
        } catch (e) {
          return { ok: false, detail: `Could not re-compute ${part}: ${(e as Error).message}` };
        }
        if (expected === undefined) continue; // nothing claimed to compare against
        const right = parseNumeric(expected);
        if (right === null) return { ok: false, detail: `The stated value "${expected}" is not a number.` };
        if (!near(computed, right, 1e-4)) {
          return { ok: false, detail: `${rhs} evaluates to ${computed}, not ${expected}.` };
        }
      }
      return { ok: true };
    }

    default:
      return { ok: true };
  }
}

/* ── whole-question gates ──────────────────────────────────────────── */

const RAW_SYNTAX = /(\d\s*\/\s*\d|sqrt\s*\(|\*\*|\\times|\\cdot|\\left|\\right|```)/;

/** Every gate that must pass before a question may reach the canvas. */
export function verifyQuestion(q: EngineQuestion, opts: { method?: string } = {}): EngineVerification {
  const checks: EngineVerification["checks"] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });

  add("Question present", Boolean(q.text && q.text.trim().length > 3), "The question text is empty.");
  add("Target stated", Boolean(q.target && q.target.trim()), "The question does not say what must be found.");
  add("Solution present", (q.solutionSteps ?? []).length > 0, "No solution steps were produced.");
  add("Final answer present", Boolean(q.finalAnswer && q.finalAnswer.trim()), "No final answer was produced.");
  add("Board-ready notation", !RAW_SYNTAX.test(`${q.text}\n${(q.solutionSteps ?? []).join("\n")}`),
    "Raw syntax (slash fraction, sqrt(), ** or LaTeX command) reached the output.");

  if (opts.method && q.method) {
    const wanted = opts.method.toLowerCase();
    add("Method as requested", q.method.toLowerCase().includes(wanted) || wanted.includes(q.method.toLowerCase()),
      `The question uses "${q.method}" but "${opts.method}" was required.`);
  }

  const claim = checkClaim(q.claim ?? null);
  add("Mathematics re-computed", claim.ok, claim.detail);

  if (q.diagramRequired) {
    add("Diagram labels listed", (q.labels ?? []).length > 0,
      "A diagram is required but no labels were specified.");
  }

  return { ok: checks.every((c) => c.ok), checks };
}

/** Problems, as teacher-facing sentences, for a failed verification. */
export function verificationProblems(v: EngineVerification): string[] {
  return v.checks.filter((c) => !c.ok).map((c) => c.detail || c.name);
}

// Math equivalence engine — the sole judge of whether two lines represent the
// same mathematics. Layered strategy:
//   1. Symbolic (mathjs)          — deterministic, handles algebra & arithmetic.
//   2. Numeric sampling (mathjs)  — for expressions mathjs can't simplify to 0.
//   3. LLM fallback               — only when both above return "unknown".

import { create, all } from "npm:mathjs@12";

const math = create(all, {});

export type Verdict = "equal" | "not_equal" | "unknown";

const EPS = 1e-6;

const FUNCS = new Set([
  "sin","cos","tan","cot","sec","csc","asin","acos","atan",
  "sinh","cosh","tanh","log","ln","log10","log2","exp","sqrt","cbrt",
  "abs","floor","ceil","round","min","max","nthRoot",
]);

/** `ab` means a·b in school notation. Split multi-letter runs into explicit
 *  products, leaving recognised function names (when applied) intact. */
function expandImplicitProducts(s: string): string {
  return s.replace(/[A-Za-z]{2,}(\s*\()?/g, (run, call) => {
    const name = call ? run.slice(0, run.length - call.length) : run;
    if (FUNCS.has(name)) return run;
    return name.split("").join("*") + (call ?? "");
  });
}

export function normalize(input: string): string {
  let s = String(input ?? "");
  s = s.replace(/\u2212/g, "-");
  s = s.replace(/[–—]/g, "-");
  s = s.replace(/\u00d7/g, "*");
  s = s.replace(/\u00b7/g, "*");
  s = s.replace(/\u00f7/g, "/");
  s = s.replace(/²/g, "^2").replace(/³/g, "^3");
  s = s.replace(/\s+/g, " ").trim();
  s = expandImplicitProducts(s);
  s = s.replace(/(\d)\s*([A-Za-z(])/g, "$1*$2");
  s = s.replace(/([A-Za-z0-9)])\s*\(/g, (m, ch, off: number, whole: string) => {
    const before = whole.slice(0, off + 1);
    const nameMatch = before.match(/[A-Za-z]+$/);
    if (nameMatch && FUNCS.has(nameMatch[0])) return m;
    return `${ch}*(`;
  });
  s = s.replace(/\)\s*([A-Za-z0-9(])/g, ")*$1");
  return s;
}


function splitEq(s: string): { lhs: string; rhs: string | null } {
  const i = s.indexOf("=");
  if (i < 0) return { lhs: s, rhs: null };
  return { lhs: s.slice(0, i).trim(), rhs: s.slice(i + 1).trim() };
}

function tryParse(expr: string): any | null {
  try { return math.parse(expr); } catch { return null; }
}

function simplifiesToZero(a: any, b: any): boolean | null {
  try {
    const diff = math.simplify(math.parse(`(${a.toString()}) - (${b.toString()})`));
    const v = diff.evaluate?.();
    if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v) < EPS;
    const s = diff.toString().replace(/\s+/g, "");
    if (s === "0") return true;
    return null;
  } catch {
    return null;
  }
}

function collectSymbols(node: any, out: Set<string>) {
  if (!node) return;
  if (node.isSymbolNode && typeof node.name === "string") {
    const reserved = new Set(["e", "pi", "i", "Infinity", "NaN", "true", "false"]);
    if (!reserved.has(node.name)) out.add(node.name);
  }
  const kids = node.args ?? node.blocks ?? node.items ?? node.params ?? [];
  for (const k of kids) collectSymbols(k, out);
  if (node.object) collectSymbols(node.object, out);
  if (node.expr) collectSymbols(node.expr, out);
}

function numericEqual(a: any, b: any): Verdict {
  const vars = new Set<string>();
  collectSymbols(a, vars);
  collectSymbols(b, vars);
  const names = Array.from(vars);

  const compiledA = (() => { try { return a.compile(); } catch { return null; } })();
  const compiledB = (() => { try { return b.compile(); } catch { return null; } })();
  if (!compiledA || !compiledB) return "unknown";

  const samples = names.length === 0 ? 1 : 8;
  let anySuccess = false;
  for (let i = 0; i < samples; i++) {
    const scope: Record<string, number> = {};
    for (const n of names) scope[n] = (Math.random() - 0.5) * 6 + 1.7;
    let va: any, vb: any;
    try { va = compiledA.evaluate(scope); } catch { return "unknown"; }
    try { vb = compiledB.evaluate(scope); } catch { return "unknown"; }
    if (typeof va !== "number" || typeof vb !== "number") return "unknown";
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    anySuccess = true;
    if (Math.abs(va - vb) > EPS * Math.max(1, Math.abs(va), Math.abs(vb))) {
      return "not_equal";
    }
  }
  return anySuccess ? "equal" : "unknown";
}

export function deterministicVerdict(teacher: string, student: string): Verdict {
  const T = splitEq(normalize(teacher));
  const S = splitEq(normalize(student));

  if (T.rhs !== null) {
    const tL = tryParse(T.lhs); const tR = tryParse(T.rhs);
    if (!tL || !tR) return "unknown";

    if (S.rhs !== null) {
      const sL = tryParse(S.lhs); const sR = tryParse(S.rhs);
      if (!sL || !sR) return "unknown";
      const direct = simplifiesToZero(
        math.parse(`(${tL.toString()})-(${tR.toString()})`),
        math.parse(`(${sL.toString()})-(${sR.toString()})`),
      );
      const swapped = simplifiesToZero(
        math.parse(`(${tL.toString()})-(${tR.toString()})`),
        math.parse(`(${sR.toString()})-(${sL.toString()})`),
      );
      if (direct === true || swapped === true) return "equal";
      const nDirect = numericEqual(
        math.parse(`(${tL.toString()})-(${tR.toString()})`),
        math.parse(`(${sL.toString()})-(${sR.toString()})`),
      );
      if (nDirect === "equal") return "equal";
      const nSwap = numericEqual(
        math.parse(`(${tL.toString()})-(${tR.toString()})`),
        math.parse(`(${sR.toString()})-(${sL.toString()})`),
      );
      if (nSwap === "equal") return "equal";
      if (nDirect === "not_equal" && nSwap === "not_equal") return "not_equal";
      if (direct === false && swapped === false) return "not_equal";
      return "unknown";
    }

    const sE = tryParse(S.lhs);
    if (!sE) return "unknown";
    const eL = simplifiesToZero(tL, sE);
    const eR = simplifiesToZero(tR, sE);
    if (eL === true || eR === true) return "equal";
    const nL = numericEqual(tL, sE);
    const nR = numericEqual(tR, sE);
    if (nL === "equal" || nR === "equal") return "equal";
    if (nL === "not_equal" && nR === "not_equal" && eL !== null && eR !== null) return "not_equal";
    return "unknown";
  }

  const tE = tryParse(T.lhs);
  const sE = tryParse(S.rhs === null ? S.lhs : `(${S.lhs})-(${S.rhs})`);
  if (!tE || !sE) return "unknown";
  const sym = simplifiesToZero(tE, sE);
  if (sym === true) return "equal";
  const num = numericEqual(tE, sE);
  if (num !== "unknown") return num;
  return sym === false ? "not_equal" : "unknown";
}

async function llmVerdict(teacher: string, student: string): Promise<Verdict> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return "unknown";
  const system = [
    "You compare two single lines of mathematics and decide only whether the",
    "STUDENT line is mathematically equivalent to the TEACHER line.",
    "Accept algebraic rearrangement, expansion, factoring, arithmetic",
    "evaluation, side-swaps of equations, and any equivalent form.",
    "Reject anything that changes the mathematical relationship.",
    'Reply with ONLY compact JSON: {"equivalent": true} or {"equivalent": false}.',
  ].join(" ");
  const user = `TEACHER line: ${teacher}\nSTUDENT line: ${student}`;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
      }),
    });
    if (!resp.ok) return "unknown";
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (parsed?.equivalent === true) return "equal";
        if (parsed?.equivalent === false) return "not_equal";
      } catch { /* fall through */ }
    }
    if (/\btrue\b/i.test(text)) return "equal";
    if (/\bfalse\b/i.test(text)) return "not_equal";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function equivalent(
  teacherAscii: string,
  studentAscii: string,
): Promise<Verdict> {
  const t = String(teacherAscii ?? "").trim();
  const s = String(studentAscii ?? "").trim();
  if (!t || !s) return "unknown";
  const det = deterministicVerdict(t, s);
  if (det !== "unknown") return det;
  return await llmVerdict(t, s);
}

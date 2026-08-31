// MATHGPL Pre-Publication Validator — staged pipeline.
// Implements the 7-stage display-gate model:
//   Stage 1  Backend draft (model call lives in index.ts)
//   Stage 2  Step visibility
//   Stage 3  Benchmark compliance
//   Stage 4  Rendering scan (LaTeX leaks, slash fractions, prog syntax)
//   Stage 5  Structural scan (container vs content)
//   Stage 6  Classroom shape
//   Stage 7  Final hard gate (no backslash-letter token may remain)
//
// Pure functions, no I/O — safe from any edge function or test runner.

export type ValidationKind = "solution" | "problem" | "text" | "floating";

export type StageId = 2 | 3 | 4 | 5 | 6 | 7;

export interface Violation {
  phase: StageId;
  rule: string;
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

export interface StageResult extends ValidationResult {
  stage: StageId;
  stageName: string;
}

// Templates the renderer accepts. Everything else starting with `\letters`
// is a source-code leak.
const ALLOWED_MACROS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "sl", "binom",
  "sum", "prod", "int", "oint", "lim",
  "log", "ln", "lg",
  "vec", "hat", "bar", "tilde", "dot", "ddot",
  "abs", "norm", "floor", "ceil",
  "begin", "end",
  "square",
]);

const FORBIDDEN_PROG = [
  { re: /\bsqrt\s*\(/g, name: "sqrt(...) calculator syntax" },
  { re: /(?<!\*)\*\*(?!\*)/g, name: "** power operator" },
  { re: /```/g, name: "markdown code fence" },
];

const SIMPLE_LINEAR = /^\s*(-?\d+)\s*([a-zA-Z])\s*=\s*(-?\d+(?:\.\d+)?)\s*$/;
const ISOLATED_VAR = /^\s*([a-zA-Z])\s*=\s*(-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+)?)\s*$/;
const BINOMIAL_PRODUCT = /\(\s*[a-zA-Z0-9]+\s*[+\-−]\s*[a-zA-Z0-9]+\s*\)\s*\(\s*[a-zA-Z0-9]+\s*[+\-−]\s*[a-zA-Z0-9]+\s*\)/;
const TRINOMIAL = /[a-zA-Z]\s*[²2]\s*[+\-−]\s*\d*\s*[a-zA-Z]\s*[+\-−]\s*\d+/;

/** Read a brace-balanced `{...}` group; returns null if unbalanced. */
function readBraced(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 1;
  let j = start + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth) j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

/**
 * Walk the string; for every \frac / \sqrt / \sqrt[..]{..} replace it with a
 * placeholder (◇). Returns the masked string AND any unbalanced-brace
 * violations encountered.
 */
function maskTemplates(src: string): { masked: string; broken: string[] } {
  const broken: string[] = [];
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("\\frac", i) || src.startsWith("\\dfrac", i) || src.startsWith("\\tfrac", i)) {
      const cmd = src.startsWith("\\dfrac", i) ? "\\dfrac"
                : src.startsWith("\\tfrac", i) ? "\\tfrac" : "\\frac";
      // optional spaces, then {num}{den}
      let p = i + cmd.length;
      while (src[p] === " ") p++;
      const a = readBraced(src, p);
      let b: ReturnType<typeof readBraced> = null;
      if (a) {
        let q = a.end;
        while (src[q] === " ") q++;
        b = readBraced(src, q);
      }
      if (!a || !b) {
        broken.push(`${cmd} at offset ${i}: missing or unbalanced { } groups`);
        // skip just the command so we don't loop forever
        out += "◇";
        i = i + cmd.length;
        continue;
      }
      // Recursively mask the inner pieces too.
      const innerA = maskTemplates(a.inner);
      const innerB = maskTemplates(b.inner);
      broken.push(...innerA.broken, ...innerB.broken);
      out += "◇";
      i = b.end;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      let p = i + 5;
      // optional [index]
      if (src[p] === "[") {
        const close = src.indexOf("]", p + 1);
        if (close < 0) {
          broken.push(`\\sqrt at offset ${i}: missing ]`);
          out += "◇";
          i = p;
          continue;
        }
        p = close + 1;
      }
      while (src[p] === " ") p++;
      const a = readBraced(src, p);
      if (!a) {
        broken.push(`\\sqrt at offset ${i}: missing or unbalanced { }`);
        out += "◇";
        i = i + 5;
        continue;
      }
      const inner = maskTemplates(a.inner);
      broken.push(...inner.broken);
      out += "◇";
      i = a.end;
      continue;
    }
    out += src[i];
    i++;
  }
  return { masked: out, broken };
}

// ─── individual stage checkers ────────────────────────────────────────────

function stage4Rendering(text: string, kind: ValidationKind): Violation[] {
  const v: Violation[] = [];
  const { masked, broken } = maskTemplates(text);
  if (broken.length) {
    v.push({
      phase: 4,
      rule: "unbalanced-template",
      detail: broken.slice(0, 4).join("; "),
    });
  }
  // Empty-brace templates (\frac{}{}, \sqrt{}) — also a leak.
  if (/\\(?:d|t)?frac\s*\{\s*\}\s*\{[^{}]*\}/.test(text) ||
      /\\(?:d|t)?frac\s*\{[^{}]*\}\s*\{\s*\}/.test(text) ||
      /\\sqrt(?:\[[^\]]*\])?\s*\{\s*\}/.test(text)) {
    v.push({ phase: 4, rule: "empty-template-slot", detail: "empty {} inside \\frac/\\sqrt" });
  }
  // Template macros inside a SENTENCE. A well-formed, renderable template
  // (\frac{a}{b}, \sqrt{2}) is converted into real stacked mathematics by the
  // notebook renderer even inside a sentence, so it is safe. What is NOT safe
  // is a macro the renderer cannot convert — that one reaches the page as
  // literal source text beside the words.
  const RENDERABLE = new Set([
    "frac", "dfrac", "tfrac", "sqrt", "binom", "sum", "prod", "int", "oint",
    "lim", "log", "ln", "lg", "left", "right", "text", "begin", "end",
    "vec", "hat", "bar", "tilde", "dot", "ddot", "abs", "norm", "floor", "ceil",
  ]);
  const proseMacro: string[] = [];
  for (const line of text.split("\n")) {
    const macros = line.match(/\\[A-Za-z]+/g);
    if (!macros) continue;
    const unrenderable = macros.filter((m) => !RENDERABLE.has(m.slice(1)));
    if (!unrenderable.length) continue;
    const bare = line.replace(/\\[A-Za-z]+/g, " ");
    const words = (bare.match(/[A-Za-z]{4,}/g) ?? []).length;
    if (words >= 2) proseMacro.push(line.trim().slice(0, 60));
  }
  if (proseMacro.length) {
    v.push({
      phase: 4,
      rule: "no-templates-inside-prose",
      detail: `sentence carries raw syntax instead of finished symbols: ${proseMacro.slice(0, 3).join(" | ")}`,
    });
  }


  // `\\` outside a matrix environment. It is a matrix row separator only; in
  // ordinary text it reaches the page as visible marks and welds a multi-part
  // question into one blob that can no longer be sectioned or solved per part.
  const withoutMatrices = text.replace(
    /\\begin\{(bmatrix|pmatrix|matrix|vmatrix|Vmatrix|Bmatrix)\}[\s\S]*?\\end\{\1\}/g,
    " ",
  );
  if (/\\{2,}/.test(withoutMatrices) || /\\newline/.test(withoutMatrices)) {
    v.push({
      phase: 4,
      rule: "no-row-separator-in-text",
      detail: "\\\\ / \\newline used as a line break outside a matrix — start a real new line and put each part on its own line",
    });
  }



  const leftover = masked.match(/\\[A-Za-z]+/g) || [];
  const leaks = leftover.filter((cmd) => !ALLOWED_MACROS.has(cmd.slice(1)));
  if (leaks.length) {
    v.push({
      phase: 4,
      rule: "no-latex-commands",
      detail: `LaTeX/source-code commands leaked: ${Array.from(new Set(leaks)).slice(0, 8).join(" ")}`,
    });
  }
  for (const { re, name } of FORBIDDEN_PROG) {
    re.lastIndex = 0;
    if (re.test(text)) v.push({ phase: 4, rule: "no-programming-syntax", detail: name });
  }
  // Inline slash fractions — flag for ALL kinds.
  const slashFrac = /(?<![\w/])-?\d+\s*\/\s*-?\d+(?![\w/])/g;
  const m = text.match(slashFrac);
  if (m && m.length) {
    v.push({
      phase: 4,
      rule: "fractions-must-be-stacked",
      detail: `inline slash fractions: ${m.slice(0, 4).join(", ")}`,
    });
  }
  // Parenthesised slash fractions like (x+1)/(x-2) — now flagged for ALL
  // content kinds (was solution/floating only). The screenshot leak came
  // from a "problem" block — questions must obey the same standard.
  if (/\)\s*\/\s*\(/.test(text)) {
    v.push({
      phase: 4,
      rule: "fractions-must-be-stacked",
      detail: "parenthesised slash fraction (a)/(b)",
    });
  }
  void kind;
  return v;
}

function stage2StepVisibility(text: string, kind: ValidationKind): Violation[] {
  if (kind !== "solution") return [];
  const v: Violation[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i];
    const nxt = lines[i + 1];
    const lin = cur.match(SIMPLE_LINEAR);
    const iso = nxt.match(ISOLATED_VAR);
    if (lin && iso && lin[1] !== "1" && lin[1] !== "-1" && lin[2] === iso[1]) {
      v.push({
        phase: 2,
        rule: "missing-division-step",
        detail: `"${cur}" → "${nxt}" hides division by ${lin[1]}`,
      });
    }
    if (BINOMIAL_PRODUCT.test(cur) && TRINOMIAL.test(nxt) && !BINOMIAL_PRODUCT.test(nxt)) {
      const hasDistribution = /\b[a-zA-Z0-9]+\s*\(\s*[a-zA-Z0-9]+\s*[+\-−]/.test(nxt);
      if (!hasDistribution) {
        v.push({
          phase: 2,
          rule: "missing-bracket-expansion",
          detail: `"${cur}" → "${nxt}" jumps past distribution`,
        });
      }
    }
  }
  return v;
}

function stage3Benchmark(text: string, kind: ValidationKind): Violation[] {
  // Heuristic checks beyond Stage 2: very long solutions with very few lines.
  if (kind !== "solution") return [];
  const v: Violation[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines.length < 3 && /[=]/.test(text)) {
    // 2-line "solution" with an equation almost certainly skipped steps.
    v.push({
      phase: 3,
      rule: "benchmark-density",
      detail: "solution has fewer steps than benchmark library requires",
    });
  }
  return v;
}

function stage5Structural(text: string): Violation[] {
  const v: Violation[] = [];
  const m = text.match(/√[^\s{(][^=\n]{2,}/g);
  if (m && m.length) {
    const bad = m.filter((s) => /[+\-−]/.test(s.slice(1)));
    if (bad.length) {
      v.push({
        phase: 5,
        rule: "radical-radicand-bounds",
        detail: `ambiguous radical body — wrap in braces: ${bad.slice(0, 3).join(", ")}`,
      });
    }
  }
  if (/\^[{(][^)}]*[+\-−×÷=][^)}]*[})]/.test(text)) {
    v.push({
      phase: 5,
      rule: "complex-exponent-must-be-shell",
      detail: "a power with +, −, ×, ÷, or = inside the exponent must be emitted as a shell with separate floating pieces",
    });
  }
  if (/_[{(][^)}]*[+\-−×÷=][^)}]*[})]/.test(text)) {
    v.push({
      phase: 5,
      rule: "complex-subscript-must-be-shell",
      detail: "a subscript with +, −, ×, ÷, or = inside it must be emitted as a shell with separate floating pieces",
    });
  }
  return v;
}

function stage6ClassroomShape(text: string, kind: ValidationKind): Violation[] {
  const v: Violation[] = [];
  if (/^\s*(Solution|Answer|Problem|Reasoning)\s*:/im.test(text)) {
    v.push({ phase: 6, rule: "no-prefix-labels", detail: "found Solution:/Answer:/Problem: prefix" });
  }
  if (/^\s*#{1,6}\s+\S/m.test(text)) {
    v.push({ phase: 6, rule: "no-markdown-headings", detail: "# heading found" });
  }
  if (/^\s*[-*•]\s+\S/m.test(text) && kind !== "text") {
    v.push({ phase: 6, rule: "no-bullets", detail: "bullet list found" });
  }
  return v;
}

function stage7FinalGate(text: string, kind: ValidationKind): Violation[] {
  // Hard stop: re-run rendering + structural and refuse to pass if anything
  // resembling source code remains.
  const v: Violation[] = [];
  v.push(...stage4Rendering(text, kind));
  v.push(...stage5Structural(text));
  // Promote phase numbers to 7 so the caller knows this is the final gate.
  return v.map((x) => ({ ...x, phase: 7 as StageId, rule: `final-gate:${x.rule}` }));
}

/** Run all stages and return the FIRST failing stage (or last passing). */
export function runValidationPipeline(text: string, kind: ValidationKind): StageResult[] {
  const results: StageResult[] = [];
  const push = (stage: StageId, name: string, violations: Violation[]) => {
    results.push({ stage, stageName: name, ok: violations.length === 0, violations });
  };
  push(2, "Step Visibility", stage2StepVisibility(text, kind));
  push(3, "Benchmark Compliance", stage3Benchmark(text, kind));
  push(4, "Mathematical Rendering", stage4Rendering(text, kind));
  push(5, "Structural Rendering", stage5Structural(text));
  push(6, "Classroom Shape", stage6ClassroomShape(text, kind));
  push(7, "Final Quality Gate", stage7FinalGate(text, kind));
  return results;
}

/** First failing stage, or null if everything passed. */
export function firstFailingStage(results: StageResult[]): StageResult | null {
  return results.find((r) => !r.ok) ?? null;
}

/** Back-compat wrapper used by existing callers + tests. */
export function validateMathOutput(text: string, kind: ValidationKind = "solution"): ValidationResult {
  if (!text || !text.trim()) return { ok: true, violations: [] };
  const all = runValidationPipeline(text, kind);
  const failing = all.filter((r) => !r.ok);
  if (!failing.length) return { ok: true, violations: [] };
  // Surface only the FIRST failing stage's violations (so corrector prompts
  // address one concern at a time).
  return { ok: false, violations: failing[0].violations };
}

export function formatViolations(violations: Violation[]): string {
  if (!violations.length) return "";
  return violations.map((v) => `  - [Phase ${v.phase}] ${v.rule}: ${v.detail}`).join("\n");
}

// ─── Deterministic hard-strip — last server-side line of defence ──────────

function readBracedHS(src: string, start: number): { inner: string; end: number } | null {
  if (src[start] !== "{") return null;
  let depth = 1;
  let j = start + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") depth--;
    if (depth) j++;
  }
  if (depth !== 0) return null;
  return { inner: src.slice(start + 1, j), end: j + 1 };
}

function repairTemplatesHS(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const fracCmd = src.startsWith("\\dfrac", i) ? "\\dfrac"
                  : src.startsWith("\\tfrac", i) ? "\\tfrac"
                  : src.startsWith("\\frac", i) ? "\\frac" : "";
    if (fracCmd) {
      let p = i + fracCmd.length;
      while (src[p] === " ") p++;
      const a = readBracedHS(src, p);
      let b: ReturnType<typeof readBracedHS> = null;
      if (a) {
        let q = a.end;
        while (src[q] === " ") q++;
        b = readBracedHS(src, q);
      }
      if (a && b) {
        const innerA = repairTemplatesHS(a.inner) || "\\sl{}";
        const innerB = repairTemplatesHS(b.inner) || "\\sl{}";
        out += `\\frac{${innerA}}{${innerB}}`;
        i = b.end;
        continue;
      }
      out += "\\frac{\\sl{}}{\\sl{}}";
      i = i + fracCmd.length;
      continue;
    }
    if (src.startsWith("\\sqrt", i)) {
      let p = i + 5;
      let indexStr = "";
      if (src[p] === "[") {
        const close = src.indexOf("]", p + 1);
        if (close < 0) { out += "\\sqrt{\\sl{}}"; i = i + 5; continue; }
        indexStr = src.slice(p, close + 1);
        p = close + 1;
      }
      while (src[p] === " ") p++;
      const a = readBracedHS(src, p);
      if (!a) { out += `\\sqrt${indexStr}{\\sl{}}`; i = i + 5 + indexStr.length; continue; }
      const inner = repairTemplatesHS(a.inner) || "\\sl{}";
      out += `\\sqrt${indexStr}{${inner}}`;
      i = a.end;
      continue;
    }
    out += src[i];
    i++;
  }
  return out;
}

/** Server-side hard-strip. Idempotent. Always returns classroom-safe text. */
export function hardStripMath(src: string): string {
  if (!src) return src;
  let s = src;
  s = s.replace(/\$+/g, "");
  s = s.replace(/\\left\s*([\(\[\{\|])/g, "$1");
  s = s.replace(/\\right\s*([\)\]\}\|])/g, "$1");
  s = s.replace(/\\left\./g, "").replace(/\\right\./g, "");
  s = s.replace(/\\(?:displaystyle|textstyle|scriptstyle)\b\s*/g, "");
  s = s.replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " ");
  s = s.replace(/\\text\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\times\b/g, "×").replace(/\\cdot\b/g, "·")
       .replace(/\\pm\b/g, "±").replace(/\\mp\b/g, "∓")
       .replace(/\\leq\b/g, "≤").replace(/\\geq\b/g, "≥")
       .replace(/\\neq\b/g, "≠").replace(/\\div\b/g, "÷")
       .replace(/\\to\b/g, "→").replace(/\\infty\b/g, "∞")
       .replace(/\\approx\b/g, "≈");
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, a, b) => `\\frac{${a}}{${b}}`);
  s = s.replace(/(?<![\w/])(-?\d+|[a-zA-Z])\s*\/\s*(-?\d+)(?![\w/])/g, (_m, a, b) => `\\frac{${a}}{${b}}`);
  s = repairTemplatesHS(s);
  s = s.replace(/\\[A-Za-z]+/g, (cmd) => ALLOWED_MACROS.has(cmd.slice(1)) ? cmd : "");
  s = s.replace(/\bsqrt\s*\(/g, "√(").replace(/(?<!\*)\*\*(?!\*)/g, "^");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s;
}

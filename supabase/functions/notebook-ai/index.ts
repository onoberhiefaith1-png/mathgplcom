import { meterFunction } from "../_shared/usageMeter.ts";
meterFunction("notebook-ai");
// Notebook AI: generate section content OR extract math from an image.
// Uses Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PEDAGOGY_REFERENCE } from "./pedagogyReference.ts";
import { toUnicodeMath, isStillDirty } from "./unicodeMath.ts";
import { RENDERING_STANDARD } from "./renderingStandard.ts";
import { BENCHMARK_STANDARD } from "./benchmarkStandard.ts";
import { STRUCTURAL_STANDARD } from "./structuralStandard.ts";
import { INTEGRITY_STANDARD } from "./integrityStandard.ts";
import { INHERITANCE_STANDARD } from "./inheritanceStandard.ts";
import { CONTINUITY_STANDARD } from "./continuityStandard.ts";
import { QUESTION_TASK_STANDARD, hasTaskInstruction } from "./questionTaskStandard.ts";
import { sanitizePresentation, residueReport, stripDuplicateHeading } from "./outputHygiene.ts";
import { GEOMETRY_STANDARD, GEOMETRY_SCENE_SCHEMA } from "./geometryStandard.ts";
import {
  WORKSPACE_STANDARD,
  workspaceManifestBlock,
  workspaceViolations,
  workspaceCorrection,
} from "./workspaceStandard.ts";
import {
  runValidationPipeline,
  firstFailingStage,
  formatViolations,
  hardStripMath,
  type ValidationKind,
} from "./validator.ts";
import { extractLine as deterministicExtractLine, splitSolutionLines } from "./floatingExtractor.ts";
import { verifyLine as verifyFloatingLine } from "./floatingVerifier.ts";
import { verifyCompleteness, summariseMissing } from "./completenessVerifier.ts";
import {
  ensureEnginePrinciples,
  writeGenerationLog,
  inferAppliedPrinciples,
} from "./engineKnowledge.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

// MathGPL Pre-Publication Validation Engine — Phase 1 directive prepended to
// every system prompt. The model's first output is a HIDDEN DRAFT; we then
// validate against the rendering + benchmark standards and self-correct
// before anything reaches the screen.
const VALIDATION_DIRECTIVE = `
You are operating inside the MathGPL Pre-Publication Validation Engine.
The output you produce is a HIDDEN DRAFT. It will be validated against the
Mathematical Rendering Standard, Structural Rendering Standard, and
Benchmark Library 01–10 before being shown to the teacher.

UNIVERSAL CONTENT RULE — these standards apply to EVERY mathematical object
you generate, regardless of role: questions, answers, solutions, worked
examples, lesson notes, introductions, definitions, explanations, hints,
worksheets, assessments, homework, classwork, summaries, smartboard content,
floating-number content, and any other mathematics you produce. No
mathematical content is exempt — the question must be as clean as the
solution.

FORBIDDEN in ANY output (question OR answer OR prose):
  • Slash fractions:  a/b, 27/7, -1/2, (x+1)/(x-2)
  • LaTeX commands:   \\frac\\sqrt\\sum\\prod\\left\\right\\cdot\\times etc.
  • Programming syntax: sqrt(...), x**2, **
  • Markdown headings/bullets/code fences.

REQUIRED templates (renderer-safe): \\frac{a}{b}, \\sqrt{...}, \\sqrt[n]{...},
x^{n}, x_{n}, with Unicode operators (× ÷ ± ≤ ≥ ≠ ≈ → ∞ π θ α β).
Generation speed does not matter — benchmark compliance, classroom
readability, and rendering correctness do.

${INTEGRITY_STANDARD}
`.trim();

const MATH_MARKUP_RULES = `
MATH WRITING — write exactly how a teacher writes on the classroom board.

Do NOT use the word "square" as a placeholder for fractions or roots. Use proper
equation editor structures and mathematical templates instead.

For fractions, use the actual fraction box structure (stacked numerator over
denominator, with a horizontal bar):
   □
   —
   □
written as \\frac{numerator}{denominator}.

For square roots, use the root template √□ written as \\sqrt{...}.
For nth roots, use \\sqrt[n]{...}.

Do NOT spread expressions linearly. Keep equations in proper stacked
mathematical format exactly as they would appear in an equation editor or
textbook. Never inline a fraction as "a/b" or "a over b" — always \\frac{a}{b}.
Never write "sqrt(16)" or "x**2" — use \\sqrt{16} and x^{2}.

The notebook automatically converts these forms into beautiful stacked math:
- Fractions (stacked): \\frac{numerator}{denominator}   e.g.  x = \\frac{11}{10}
- Square roots: \\sqrt{...}                              e.g.  \\sqrt{16} = 4
- Powers:  x^{2}, (a+b)^{3}, 2^{4}                       (will render as x², (a+b)³, 2⁴)
- Subscripts: log_{2} 4, x_{1}                           (will render as log₂ 4, x₁)
- Multiplication: × (never *)
- Division (inline): ÷
- ± ≤ ≥ ≠ ≈ → ∞ are fine to use directly.
- Greek: π, θ, α, β are fine directly.
- One step per line. No bullets, no markdown, no code fences, no "Solution:" prefix.
NEVER output raw LaTeX commands like \\times \\cdot \\pm \\leq — use the Unicode symbol instead.
NEVER output the literal word "square" as a stand-in for □; if you need an empty
slot inside a template, use \\square (which renders as the empty box symbol).
`.trim();

const PEDAGOGY_RULES = PEDAGOGY_REFERENCE;

const AI_REQUEST_TIMEOUT_MS = 25_000;
const VALIDATION_BUDGET_MS = 55_000;

async function fetchAI(init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(ENDPOINT, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("AI request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function callAI(messages: any[], model = "google/gemini-2.5-flash") {
  const res = await fetchAI({
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// Rich call that also surfaces finish_reason so we can detect truncation
// (max_tokens / length) and retry. Used by the floating-number pipelines.
async function callAIRich(
  messages: any[],
  opts: { model?: string; maxTokens?: number } = {},
): Promise<{ content: string; finishReason: string }> {
  const model = opts.model ?? "google/gemini-2.5-flash";
  const body: any = { model, messages };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  const res = await fetchAI({
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text}`);
  }
  const json = await res.json();
  const choice = json.choices?.[0] ?? {};
  return {
    content: choice.message?.content ?? "",
    finishReason: String(choice.finish_reason ?? choice.finishReason ?? "stop"),
  };
}

/**
 * MathGPL Pre-Publication Validation Engine — staged pipeline.
 *
 * Stage 1  Backend draft (this model call — output never displayed yet)
 * Stage 2  Step visibility correction (benchmark step-density)
 * Stage 3  Benchmark compliance correction
 * Stage 4  Rendering scan (LaTeX leak + slash fraction + prog syntax)
 * Stage 5  Structural rendering scan
 * Stage 6  Classroom shape
 * Stage 7  Final hard gate (re-runs 4+5)
 *
 * For each failing stage we re-prompt the model with ONLY the standards
 * relevant to that stage (up to `maxRoundsPerStage` rounds). Once the stage
 * passes we advance. Output of the last stage is returned together with any
 * unresolved warnings (the client display gate is the absolute last line of
 * defence — see src/lib/notebook/mathDisplayGate.ts).
 */
const STAGE_STANDARDS: Record<number, string> = {
  2: BENCHMARK_STANDARD,
  3: BENCHMARK_STANDARD,
  4: RENDERING_STANDARD,
  5: STRUCTURAL_STANDARD,
  6: RENDERING_STANDARD,
  7: `${RENDERING_STANDARD}\n\n${STRUCTURAL_STANDARD}`,
};

async function generateValidated(opts: {
  messages: any[];
  kind: ValidationKind;
  model?: string;
  maxRoundsPerStage?: number;
}): Promise<{ content: string; warnings: string[]; lastStage: number }> {
  const model = opts.model ?? "google/gemini-2.5-flash";
  const maxRounds = opts.maxRoundsPerStage ?? 2;
  const messages = [...opts.messages];
  const deadline = Date.now() + VALIDATION_BUDGET_MS;
  let draft = await callAI(messages, model);
  let cleaned = sanitizePresentation(sanitizeMath(stripFences(draft)));
  let lastStage = 1;

  // Run the pipeline; on the first failing stage, correct in a loop until
  // that stage passes (or maxRounds hit). Then re-run the pipeline from the
  // top so earlier stages catch any regressions the correction introduced.
  let safety = 8; // hard cap across all stages to prevent runaway loops
  while (safety-- > 0) {
    if (Date.now() >= deadline) break;
    const results = runValidationPipeline(cleaned, opts.kind);
    const failing = firstFailingStage(results);
    if (!failing) {
      lastStage = 7;
      break;
    }
    lastStage = failing.stage;
    let round = 0;
    let stageOk = false;
    while (round < maxRounds) {
      if (Date.now() >= deadline) break;
      round++;
      const standards = STAGE_STANDARDS[failing.stage] ?? RENDERING_STANDARD;
      const correctorPrompt = `Your previous draft FAILED MathGPL pre-publication validation at STAGE ${failing.stage} — ${failing.stageName}.

VIOLATIONS (must be fixed):
${formatViolations(failing.violations)}

RE-READ THE RELEVANT STANDARD(S):
${standards}

Rewrite the entire output so EVERY violation above is resolved. Output only
the corrected content — no commentary, no apologies, no fences, no prefix
labels. Preserve the original meaning and final answer.

PREVIOUS DRAFT:
${cleaned}`;
      const correction = await callAI(
        [...messages, { role: "assistant", content: draft }, { role: "user", content: correctorPrompt }],
        model,
      );
      draft = correction;
      cleaned = sanitizePresentation(sanitizeMath(stripFences(correction)));
      const recheck = runValidationPipeline(cleaned, opts.kind);
      const stillFailing = firstFailingStage(recheck);
      if (!stillFailing || stillFailing.stage > failing.stage) {
        stageOk = true;
        break;
      }
      // still failing on the SAME stage — let the loop re-prompt
    }
    if (!stageOk) break; // give up on this stage; report warnings
  }

  // Deterministic hard-strip: even if the corrector loop gave up, no raw
  // \letters, slash fraction, or unbalanced template may leave the server.
  cleaned = hardStripMath(cleaned);
  // Presentation hygiene: markdown / JSON / escape residue / placeholders can
  // NEVER reach the teacher. Deterministic and applied to every mode.
  cleaned = sanitizePresentation(cleaned);
  const finalResults = runValidationPipeline(cleaned, opts.kind);
  const lastFailing = firstFailingStage(finalResults);
  const warnings = lastFailing
    ? lastFailing.violations.map((v) => `[Stage ${v.phase}] ${v.rule}: ${v.detail}`)
    : [];
  for (const r of residueReport(cleaned)) warnings.push(`[Hygiene] raw syntax residue: ${r}`);
  if (warnings.length) {
    console.warn(`[notebook-ai] validation warnings remain after stage ${lastStage}:`, warnings);
  }
  return { content: cleaned, warnings, lastStage };
}

const stripFences = (s: string) =>
  s.trim().replace(/^```[a-z]*\s*|\s*```$/gi, "").replace(/^(Solution|Problem|Reasoning|Answer)\s*:\s*/i, "");

/**
 * Remove LaTeX scaffolding that should NEVER reach the notebook renderer:
 * \left / \right / \displaystyle / \text / spacing macros / verbose operator
 * macros. Keeps \frac, \sqrt, \sqrt[n]{}, ^{} and _{} (which the renderer
 * draws as real stacked math).
 */
const sanitizeMath = (s: string): string => {
  if (!s) return s;
  let out = s;
  out = out.replace(/\\left\s*([\(\[\{\|])/g, "$1");
  out = out.replace(/\\right\s*([\)\]\}\|])/g, "$1");
  out = out.replace(/\\left\./g, "").replace(/\\right\./g, "");
  out = out.replace(/\\(?:displaystyle|textstyle|scriptstyle)\b\s*/g, "");
  out = out.replace(/\\,|\\;|\\:|\\!|\\quad|\\qquad/g, " ");
  out = out.replace(/\\text\s*\{([^{}]*)\}/g, "$1");
  out = out.replace(/\\times\b/g, "×");
  out = out.replace(/\\cdot\b/g, "·");
  out = out.replace(/\\pm\b/g, "±");
  out = out.replace(/\\mp\b/g, "∓");
  out = out.replace(/\\leq\b/g, "≤");
  out = out.replace(/\\geq\b/g, "≥");
  out = out.replace(/\\neq\b/g, "≠");
  out = out.replace(/\\div\b/g, "÷");
  out = out.replace(/\\to\b/g, "→");
  out = out.replace(/\\infty\b/g, "∞");
  out = out.replace(/\\approx\b/g, "≈");
  // Trim doubled spaces introduced by the strips.
  out = out.replace(/[ \t]{2,}/g, " ");
  return out;
};

const sanitizeLines = (arr: string[]): string[] => arr.map((l) => hardStripMath(sanitizeMath(l)));

// Whitespace/sign/operator-normalised compare for QUESTION_LOCK checks.
// Also strips equivalent calculus phrasings ("find the integral of …  dx" ⇔
// "\int … dx") and trailing punctuation, so the restatement is accepted when
// the model swaps prose for the integral symbol (or vice-versa) without
// touching any mathematics.
// Unicode superscripts (x² / x⁻¹) ⇔ caret form (x^2 / x^-1) so a restatement
// that renders the exponent differently is NOT treated as a different problem.
const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "ⁿ": "n", "ⁱ": "i",
};

const canonicalExponents = (s: string): string => {
  // x²⁵ → x^25 (one caret for the whole run of superscript characters)
  let out = String(s ?? "").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+/g, (run) =>
    `^{${Array.from(run).map((ch) => SUPERSCRIPTS[ch] ?? ch).join("")}}`,
  );
  // ^{2} → ^2 (brace-less form is canonical once whitespace is gone)
  out = out.replace(/\^\{\s*([^{}]*?)\s*\}/g, "^$1");
  return out;
};

const normaliseForLock = (s: string): string => {
  let out = canonicalExponents(hardStripMath(String(s ?? "")))
    .replace(/\s+/g, "")
    .replace(/[-−–—]/g, "-")
    .replace(/[×·*]/g, "x")
    .replace(/[÷]/g, "/")
    .toLowerCase();
  // Equivalent integral phrasings → canonical "\int".
  out = out
    .replace(/findtheintegralof/g, "\\int")
    .replace(/findtheintegral/g, "\\int")
    .replace(/evaluatetheintegralof/g, "\\int")
    .replace(/evaluatetheintegral/g, "\\int")
    .replace(/computetheintegralof/g, "\\int")
    .replace(/computetheintegral/g, "\\int")
    .replace(/integrate/g, "\\int");
  // Trailing punctuation that carries no math meaning.
  out = out.replace(/[.。,;:]+$/g, "");
  return out;
};

const firstNonEmptyLine = (s: string): string => {
  for (const l of String(s ?? "").split("\n")) {
    const t = l.trim();
    if (t) return t;
  }
  return "";
};

const nonEmptyLines = (s: string): string[] =>
  String(s ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const firstNNonEmptyLines = (s: string, n: number): string =>
  nonEmptyLines(s).slice(0, Math.max(0, n)).join("\n");


// ACTIVE_QUESTION may include a prose lead-in like "Solve for x:" followed by
// the equation on the next line, or inline as "Solve the equation: 2x + 1 = 0".
// The QUESTION_LOCK target is the equation itself while still allowing a
// full-string match for back-compat.
const lastNonEmptyLine = (s: string): string => {
  const lines = String(s ?? "").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t) return t;
  }
  return "";
};

const instructionTail = (s: string): string => {
  const text = String(s ?? "").trim();
  const match = /^(?:please\s+)?(?:solve|find|calculate|evaluate|simplify|factor|expand|work\s+out)(?:\s+(?:the\s+)?(?:equation|expression|problem|question|following|for\s+[a-z]))?\s*:\s*(.+)$/i.exec(text);
  const tail = match?.[1]?.trim() ?? "";
  return /[=<>≤≥]|[a-z]\s*\^|\^\{|\d/.test(tail) ? tail : "";
};

// Math-bearing lines only — drops prose lead-ins like "Solve for x and y:"
// so a restatement that lists just the equations still satisfies the lock.
const isMathLine = (l: string): boolean =>
  /[=<>≤≥]|\d|[a-z]\s*\^|\^\{/i.test(l);
const mathLinesJoined = (s: string): string =>
  nonEmptyLines(s).filter(isMathLine).join("\n");

// Pull out equation-like substrings embedded in prose, e.g.
// "If 8^{x} = 2, then determine the value of x." → "8^{x} = 2".
const embeddedEquations = (s: string): string[] => {
  const re = /[\w^{}()+\-*/.√]+(?:\s*[=<>≤≥]\s*[\w^{}()+\-*/.√]+)+/g;
  return (String(s ?? "").match(re) ?? []).map((m) => m.trim());
};

// Build the canonical lock target: prefer the last non-empty line (equation),
// inline instruction tails, embedded equations, and a full-string match.
const lockTargets = (s: string): string[] => {
  const full = normaliseForLock(s);
  const tail = normaliseForLock(lastNonEmptyLine(s));
  const inlineTail = normaliseForLock(instructionTail(lastNonEmptyLine(s)) || instructionTail(s));
  const mathOnly = normaliseForLock(mathLinesJoined(s));
  const embedded = embeddedEquations(s).map(normaliseForLock);
  return Array.from(new Set([full, tail, inlineTail, mathOnly, ...embedded].filter(Boolean)));
};
const matchesLock = (candidate: string, source: string): boolean => {
  const c = normaliseForLock(candidate);
  if (!c) return false;
  if (lockTargets(source).includes(c)) return true;
  // Match the first K math-lines of the candidate (K = math-lines in source)
  // so dropped prose lead-ins and trailing commentary don't break the lock.
  const srcMath = nonEmptyLines(source).filter(isMathLine);
  if (srcMath.length > 0) {
    const candMathPrefix = nonEmptyLines(candidate)
      .filter(isMathLine)
      .slice(0, srcMath.length)
      .join("\n");
    if (normaliseForLock(candMathPrefix) === normaliseForLock(srcMath.join("\n"))) return true;
  }

  // Prose lead-in tolerance. Questions such as
  //   "Rationalize the denominator of \frac{\sqrt{3}}{\sqrt{10} - \sqrt{5}}."
  // are frequently restated by the model as just the bare expression
  //   "\frac{\sqrt{3}}{\sqrt{10} - \sqrt{5}}".
  // That is the SAME locked problem — the instruction words were dropped, no
  // mathematics was changed. Accept when one side's normalised text fully
  // contains the other AND the contained side carries real math structure, so
  // the restatement still reproduces the exact locked expression verbatim.
  const s = normaliseForLock(source);
  const carriesMath = (x: string) =>
    x.length >= 4 && (/\\frac|\\sqrt|=|\^/.test(x) || ((x.match(/\d/g)?.length ?? 0) >= 2));
  if (s && c) {
    if (s.includes(c) && carriesMath(c)) return true;
    if (c.includes(s) && carriesMath(s)) return true;
  }

  return false;
};



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require an authenticated user — this endpoint proxies paid AI model calls.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimData, error: authError } = await supabaseAuth.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (authError || !claimData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // ─────────────────────────────────────────────────────────────
    // MODE: solve_with_reasoning
    // Returns a parallel solution + reasoning list for a problem.
    // First solution line MUST be the restated problem (no reasoning on that row).
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "solve_with_reasoning") {
      const { problem, subject, topic, subtopic, sectionKind, teacherPrompt } = body;
      if (!problem || !String(problem).trim()) {
        return new Response(JSON.stringify({ error: "missing problem" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sys = `${VALIDATION_DIRECTIVE}

${INHERITANCE_STANDARD}

You are a mathematics teacher solving a problem on a classroom board.
${MATH_MARKUP_RULES}

${RENDERING_STANDARD}

${STRUCTURAL_STANDARD}

${BENCHMARK_STANDARD}

${PEDAGOGY_RULES}

REASONING RULES — write SHORT teacher notes, the way a teacher actually says them:
- 2 to 6 words per note. Imperative voice.
- GOOD: "Subtract 5 from both sides", "Divide both sides by 10", "Simplify", "Factor", "Apply quadratic formula".
- BAD: "To isolate the variable term we perform the subtraction operation on both sides of the equation."
- No academic textbook tone. No "we will", "we can", "in order to".

OUTPUT FORMAT — return STRICT JSON ONLY (no prose, no fences):
{
  "solution": ["line 1", "line 2", ...],
  "reasoning": ["", "note for line 2", ...]
}
Rules:
- solution[0] is the original problem restated verbatim (no working).
- reasoning[0] MUST be the empty string "".
- solution.length === reasoning.length.
- Include intermediate operation lines (e.g. explicit division by 2) — see PEDAGOGY.
- A pure-simplification continuation line may have an empty reasoning "".
- The final solution line is the final answer.`;

      const lockedProblem = String(problem).trim();
      const userParts = [
        `Subject: ${subject || "Mathematics"} | Topic: ${topic || "—"} | Subtopic: ${subtopic || "—"} | Section: ${sectionKind || "example"}`,
        `QUESTION_LOCK (immutable — solve THIS exact problem, do not substitute):\n${lockedProblem}`,
        `PROBLEM:\n${lockedProblem}`,
      ];
      if (teacherPrompt && String(teacherPrompt).trim()) {
        userParts.push(`TEACHER INSTRUCTION (follow strictly, but never modify QUESTION_LOCK): ${String(teacherPrompt).trim()}`);
      }
      userParts.push(`Solve QUESTION_LOCK exactly and return the JSON. solution[0] must restate QUESTION_LOCK verbatim.`);
      const user = userParts.join("\n\n");

      const parseSolution = (raw: string): { solution: string[]; reasoning: string[] } => {
        const cleaned = stripFences(raw).replace(/^```json\s*|\s*```$/g, "");
        const out: { solution: string[]; reasoning: string[] } = { solution: [], reasoning: [] };
        try {
          const obj = JSON.parse(cleaned);
          if (Array.isArray(obj.solution) && Array.isArray(obj.reasoning)) {
            out.solution = obj.solution.map((s: any) => String(s));
            out.reasoning = obj.reasoning.map((s: any) => String(s));
          }
        } catch {
          const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
          out.solution = lines;
          out.reasoning = lines.map(() => "");
        }
        const n = Math.max(out.solution.length, out.reasoning.length);
        while (out.solution.length < n) out.solution.push("");
        while (out.reasoning.length < n) out.reasoning.push("");
        if (out.reasoning.length) out.reasoning[0] = "";
        return out;
      };

      // QUESTION_LOCK guard: normalise and compare to solution[0]; one retry then hard fail.
      const messages: any[] = [
        { role: "system", content: sys },
        { role: "user", content: user },
      ];
      let raw = await callAI(messages);
      let parsed = parseSolution(raw);
      let firstLine = parsed.solution[0] ?? "";
      if (!matchesLock(firstLine, lockedProblem)) {
        const corrector = `QUESTION_LOCK MISMATCH.
QUESTION_LOCK was:
${lockedProblem}

Your solution[0] was:
${firstLine || "(empty)"}

Regenerate the ENTIRE solution from QUESTION_LOCK. Do not change any number, sign, variable, or exponent. solution[0] must equal QUESTION_LOCK character-for-character. Return STRICT JSON only.`;
        raw = await callAI([
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: corrector },
        ]);
        parsed = parseSolution(raw);
        firstLine = parsed.solution[0] ?? "";
        if (!matchesLock(firstLine, lockedProblem)) {
          return new Response(
            JSON.stringify({
              error: "question_lock_mismatch",
              expected: lockedProblem,
              got: firstLine,
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }


      return new Response(
        JSON.stringify({
          solution: sanitizeLines(parsed.solution).join("\n"),
          reasoning: sanitizeLines(parsed.reasoning).join("\n"),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: generate  (single block: intro, explanation, summary, problem, etc.)
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "generate") {
      const b = body as {
        mode: "generate";
        sectionKind: string;
        blockKind: "problem" | "solution" | "reasoning" | "text";
        topic?: string; subtopic?: string; subject?: string;
        context?: string; currentContent?: string; teacherPrompt?: string;
        activeQuestion?: string;
        /** The section heading the application already renders on the page.
         *  Passed so the model never reproduces it. */
        existingHeading?: string;
        inheritedContext?: boolean;

        /** Full teaching context of the lesson generated so far. */
        lessonContext?: {
          level?: string;
          objectives?: string;
          introduction?: string;
          explanations?: string[];
          examples?: { label: string; problem: string; method?: string }[];
          definitions?: string[];
          notation?: string[];
          sequencePosition?: string;
        };
        /** Live manifest of workspace tools + Asset Library ids. */
        workspaceManifest?: string;
      };

      /** Render the lesson-so-far into a compact, prompt-friendly block. */
      const buildLessonSoFar = (): string => {
        const lc = b.lessonContext;
        if (!lc) return "";
        const seg: string[] = [];
        if (lc.level) seg.push(`Curriculum level: ${lc.level}`);
        if (lc.objectives) seg.push(`Learning objectives:\n${lc.objectives}`);
        if (lc.introduction) seg.push(`Introduction already written:\n${lc.introduction}`);
        if (lc.definitions?.length) seg.push(`Definitions already introduced:\n${lc.definitions.join("\n")}`);
        if (lc.notation?.length) seg.push(`Notation already in use: ${lc.notation.join(", ")}`);
        if (lc.explanations?.length) {
          seg.push(`Explanations already taught:\n${lc.explanations.join("\n---\n")}`);
        }
        if (lc.examples?.length) {
          seg.push(
            `Worked examples already given (in order):\n` +
              lc.examples
                .map((e, i) => `${i + 1}. ${e.label}: ${e.problem}${e.method ? `\n   Method: ${e.method}` : ""}`)
                .join("\n"),
          );
        }
        if (lc.sequencePosition) seg.push(`Position in the lesson: ${lc.sequencePosition}`);
        return seg.filter(Boolean).join("\n\n").trim();
      };
      const lessonSoFar = buildLessonSoFar();

      // QUESTION INHERITANCE GATE — Solution blocks must inherit ACTIVE_QUESTION
      // from the parent question block above. No inheritance → refuse to call the
      // model. This prevents the Solution AI from inventing its own equation.
      const isSolutionBlock = b.blockKind === "solution";
      const activeQuestion = String(b.activeQuestion ?? "").trim();
      if (isSolutionBlock && (b.inheritedContext !== true || !activeQuestion)) {
        return new Response(
          JSON.stringify({
            error: "missing_inherited_question",
            detail: "Solution blocks require an inherited parent question (ACTIVE_QUESTION). Add a question above the Solution and try again.",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const styleByKind: Record<string, Record<string, string>> = {
        introduction: {
          text: "Write a SHORT classroom introduction to the subtopic. 2–5 lines. Define the concept simply and, if there is a key formula for this subtopic, include it on its own line using the math markup (e.g. x = \\frac{-b ± \\sqrt{b^{2} − 4ac}}{2a}). No greetings, no 'Today we will...'.",
        },
        explanation: {
          text: "Write a teacher-voice explanation of the subtopic, 3–8 short lines. State the key rule, then one short illustrative line. Use math markup for any formula. Plain, classroom-friendly — readable aloud.",
        },
        example: {
          problem: "Write ONE worked-example question: an imperative instruction line naming the method this Subtopic teaches, then the mathematics on its own line(s). No solution, no working. Use math markup for fractions/roots/powers.",
          solution: "Solve ACTIVE_QUESTION. First line is ACTIVE_QUESTION restated verbatim. Then one step per line, using math markup. Final line is the answer.",
          reasoning: "Write one SHORT teacher note per line, matched 1:1 with the solution lines above. First note is empty. 2–6 words each: 'Subtract 5 from both sides', 'Simplify', 'Divide both sides by 10'.",
        },
        exercise: {
          problem: "Write ONE practice question: an imperative instruction line naming the method this Subtopic teaches, then the mathematics on its own line(s). No solution. Use math markup.",
          solution: "Solve ACTIVE_QUESTION. First line restates ACTIVE_QUESTION verbatim. One step per line. Math markup.",
          reasoning: "Short teacher notes, one per solution line. First note empty. 2–6 words each.",
        },
        classwork: {
          problem: "Write ONE classwork question: an imperative instruction line naming the method this Subtopic teaches, then the mathematics on its own line(s). No solution. Math markup.",
          solution: "Solve ACTIVE_QUESTION. First line restates ACTIVE_QUESTION verbatim. One step per line.",
          reasoning: "Short teacher notes, one per solution line. First empty.",
        },
        homework: {
          problem: "Write ONE homework question: an imperative instruction line naming the method this Subtopic teaches, then the mathematics on its own line(s). No solution. Math markup.",
          solution: "Solve ACTIVE_QUESTION. First line restates ACTIVE_QUESTION verbatim. One step per line.",
          reasoning: "Short teacher notes, one per solution line. First empty.",
        },
        summary: {
          text: "Write a brief lesson summary: 3–5 lines. Key rule, one example pattern, one closing tip. Use math markup for any formula.",
        },
      };

      const kindRules = styleByKind[b.sectionKind] ?? {};
      const styleLine = kindRules[b.blockKind] ?? "Write helpful classroom mathematics content using the math markup.";

      const sys = `${VALIDATION_DIRECTIVE}
${isSolutionBlock ? `\n${INHERITANCE_STANDARD}\n` : ""}
You are a mathematics teacher's quiet assistant writing INSIDE a real classroom notebook.
Context — Subject: ${b.subject || "Mathematics"} | Topic: ${b.topic || "—"} | Subtopic: ${b.subtopic || "—"} | Section: ${b.sectionKind} | Block: ${b.blockKind}.
${MATH_MARKUP_RULES}

${RENDERING_STANDARD}

${STRUCTURAL_STANDARD}

${GEOMETRY_STANDARD}

${CONTINUITY_STANDARD}

${WORKSPACE_STANDARD}

${workspaceManifestBlock(b.workspaceManifest)}
${isSolutionBlock ? `\n${BENCHMARK_STANDARD}\n\n${PEDAGOGY_RULES}\n` : ""}
${b.blockKind === "problem" ? `\n${QUESTION_TASK_STANDARD}\n` : ""}
Task style for this block: ${styleLine}

STRUCTURE OWNERSHIP — the application owns the document structure; you own the
mathematics. The section heading, its number and the "Solution" label are
ALREADY on the page${b.existingHeading ? ` (currently: "${String(b.existingHeading).trim()}")` : ""}. Never reproduce them.
Do not begin your output with "Example 3", "Classwork 2", "Exercise 5",
"Question 4", "Solution", "Answer" or any other section label — with or without
a number or a colon. Emit only the content that belongs inside that section.
Output ONLY the requested content. No headings like "Solution:", no markdown, no commentary.`;


      const parts: string[] = [];
      if (lessonSoFar) {
        parts.push(
          `LESSON SO FAR (everything already taught in THIS lesson — read it fully, then continue the sequence. Do not repeat it, do not contradict it, do not switch topic or method):\n${lessonSoFar}`,
        );
      }
      if (isSolutionBlock) {
        parts.push(
          `ACTIVE_QUESTION (QUESTION_LOCK — immutable; solve THIS exact problem, do not substitute):\n${activeQuestion}`,
        );
      }
      if (b.context && b.context.trim()) {
        parts.push(`EXISTING CONTENT IN THIS SUBSECTION (ground truth):\n${b.context.trim()}`);
      }
      if (b.currentContent && b.currentContent.trim()) {
        parts.push(`CURRENT CONTENT OF THIS BLOCK (the teacher already started — refine/complete it):\n${b.currentContent.trim()}`);
      }
      if (b.teacherPrompt && b.teacherPrompt.trim()) {
        parts.push(`TEACHER INSTRUCTION (follow strictly, but never modify ACTIVE_QUESTION): ${b.teacherPrompt.trim()}`);
      }
      if (isSolutionBlock) {
        parts.push(`The FIRST output line MUST restate ACTIVE_QUESTION verbatim. Every subsequent line must derive from ACTIVE_QUESTION. Do not invent or substitute a different problem.`);
      } else {
        parts.push(
          `Now generate the ${b.blockKind} for this ${b.sectionKind}. It must be the LOGICAL NEXT STEP of the lesson above — same topic, same subtopic, same method, gradual increase in difficulty.`,
        );
      }

      const validationKind: ValidationKind =
        isSolutionBlock ? "solution"
        : b.blockKind === "problem" ? "problem"
        : "text";

      const baseMessages: any[] = [
        { role: "system", content: sys },
        { role: "user", content: parts.join("\n\n") },
      ];

      let { content, warnings } = await generateValidated({
        messages: baseMessages,
        kind: validationKind,
      });

      // WORKSPACE GUARD — hand-typed tables / ASCII figures / described graphs
      // must be re-emitted as real workspace tool directives. One round.
      {
        const violations = workspaceViolations(content);
        if (violations.length) {
          const retry = await generateValidated({
            messages: [
              ...baseMessages,
              { role: "assistant", content },
              { role: "user", content: workspaceCorrection(violations) },
            ],
            kind: validationKind,
          });
          if (workspaceViolations(retry.content).length <= violations.length) {
            content = retry.content;
            warnings = retry.warnings;
          }
        }
      }


      // CONTINUITY GUARD — a newly generated question must not duplicate an
      // example already in the lesson. One corrective round, then accept.
      if (!isSolutionBlock && b.blockKind === "problem" && b.lessonContext?.examples?.length) {
        const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
        const prior = b.lessonContext.examples.map((e) => norm(e.problem || "")).filter(Boolean);
        if (prior.some((p) => p && norm(content).includes(p))) {
          const retry = await generateValidated({
            messages: [
              ...baseMessages,
              { role: "assistant", content },
              {
                role: "user",
                content:
                  `That question repeats an example already in this lesson. Write a DIFFERENT question that continues the sequence: same topic, same subtopic, same method, slightly more challenging than the last example. Output only the question.`,
              },
            ],
            kind: validationKind,
          });
          content = retry.content;
          warnings = retry.warnings;
        }
      }

      // TASK-PHRASING GUARD — a question must be a real task, not a naked
      // equation. One corrective round asking only for the instruction line,
      // then accept whatever came back (never blocks generation).
      if (!isSolutionBlock && b.blockKind === "problem" && !hasTaskInstruction(content)) {
        try {
          const retry = await generateValidated({
            messages: [
              ...baseMessages,
              { role: "assistant", content },
              {
                role: "user",
                content:
                  `That question has no instruction — it is a bare equation. Re-output the SAME mathematics unchanged, but put ONE short imperative instruction line above it naming the method this Subtopic teaches (e.g. "Solve the quadratic equation using the quadratic formula."). Output only the question: instruction line, then the mathematics.`,
              },
            ],
            kind: validationKind,
          });
          if (retry.content && retry.content.trim()) {
            content = retry.content;
            warnings = retry.warnings;
          }
        } catch {
          // phrasing is cosmetic — keep the original question
        }
      }



      // Post-generation QUESTION_LOCK guard for solution blocks: solution[0]
      // (the first non-empty line) must match ACTIVE_QUESTION. One retry, then 422.
      if (isSolutionBlock) {
        // For multi-line ACTIVE_QUESTION (e.g. a prose lead-in + a system of
        // equations) the restatement spans the SAME number of non-empty
        // lines. Compare that block — not just solution[0] — against the lock.
        const lockLineCount = Math.max(1, nonEmptyLines(activeQuestion).length);
        let firstBlock = firstNNonEmptyLines(content, lockLineCount);
        if (!matchesLock(firstBlock, activeQuestion)) {
          const corrector = `QUESTION_LOCK MISMATCH.
ACTIVE_QUESTION was:
${activeQuestion}

Your first ${lockLineCount} line(s) were:
${firstBlock || "(empty)"}

Regenerate the ENTIRE solution from ACTIVE_QUESTION. The FIRST ${lockLineCount} line(s) must equal ACTIVE_QUESTION character-for-character (same line breaks). Do not change any number, sign, variable, exponent, or fraction. Output only the corrected solution — no commentary.`;
          const retried = await generateValidated({
            messages: [
              ...baseMessages,
              { role: "assistant", content },
              { role: "user", content: corrector },
            ],
            kind: validationKind,
          });
          content = retried.content;
          warnings = retried.warnings;
          firstBlock = firstNNonEmptyLines(content, lockLineCount);
          if (!matchesLock(firstBlock, activeQuestion)) {
            return new Response(
              JSON.stringify({
                error: "question_lock_mismatch",
                expected: activeQuestion,
                got: firstBlock,
              }),
              { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      // The application owns the heading. If the model repeated it, drop the
      // duplicate label and keep the mathematics — never treat it as a failure.
      content = stripDuplicateHeading(content);

      return new Response(JSON.stringify({ content, warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    }


    // ─────────────────────────────────────────────────────────────
    // MODE: edit  (selection-based AI Edit from the Selection Toolbar)
    // Receives a snippet + a teacher instruction. Loads the standards
    // that match the detected kind; if the instruction mentions
    // structure / benchmark / rendering / layout, force-load ALL.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "edit") {
      const b = body as {
        mode: "edit";
        kind: "solution" | "fraction" | "matrix" | "equation" | "paragraph" | "lesson_section";
        instruction?: string;
        selectionText?: string;
        subject?: string; topic?: string; subtopic?: string;
        forceAllStandards?: boolean;
      };
      const selection = String(b.selectionText ?? "").trim();
      const instruction = String(b.instruction ?? "").trim();
      if (!selection) {
        return new Response(JSON.stringify({ error: "missing selectionText" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const kindToValidation: Record<string, ValidationKind> = {
        solution: "solution",
        fraction: "problem",
        matrix: "problem",
        equation: "problem",
        paragraph: "text",
        lesson_section: "text",
      };
      const validationKind: ValidationKind = kindToValidation[b.kind] ?? "text";

      const includeBenchmark = b.forceAllStandards || b.kind === "solution";
      const includePedagogy = b.forceAllStandards || b.kind === "solution" || b.kind === "lesson_section";

      const standardBlocks = [
        RENDERING_STANDARD,
        STRUCTURAL_STANDARD,
        includeBenchmark ? BENCHMARK_STANDARD : "",
        includePedagogy ? PEDAGOGY_RULES : "",
      ].filter(Boolean).join("\n\n");

      const sys = `${VALIDATION_DIRECTIVE}

You are a mathematics teacher's assistant performing an INLINE EDIT on a
fragment the teacher highlighted inside a Lesson Notes document.
Context — Subject: ${b.subject || "Mathematics"} | Topic: ${b.topic || "—"} | Subtopic: ${b.subtopic || "—"} | Selection kind: ${b.kind}.

${MATH_MARKUP_RULES}

${standardBlocks}

EDIT RULES:
- Rewrite ONLY the selected fragment. Do not add headings, prefaces, or
  commentary. Output the replacement text exactly as it should appear in
  the notebook.
- Preserve the teacher's intent. If the instruction asks for structural
  fixes, prefer the rendered template forms (\\frac{a}{b}, \\sqrt{...},
  x^{n}) over slash fractions or inline forms.
- Keep one micro-step per line when the fragment is a worked solution.`;

      const user = `SELECTED FRAGMENT (kind: ${b.kind}):
${selection}

TEACHER INSTRUCTION:
${instruction || "Improve the selected fragment while keeping its meaning."}`;

      const { content, warnings } = await generateValidated({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        kind: validationKind,
      });
      return new Response(JSON.stringify({ content, warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: geometry
    // Given a generated section's text + topic, decide whether a geometry
    // diagram is required. If yes, return a GeometryScene; otherwise null.
    // The teacher never asks for this — the Lesson Note Generator calls it
    // automatically after each section's text is produced.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "geometry") {
      const b = body as {
        mode: "geometry";
        sectionText: string;
        topic?: string; subtopic?: string; subject?: string;
        forceDiagram?: boolean;
      };
      const sectionText = String(b.sectionText ?? "").trim();
      if (!sectionText) {
        return new Response(JSON.stringify({ scene: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sys = `You decide whether a mathematics passage needs a geometry diagram,
and if so, produce one as a GeometryScene JSON object.

${GEOMETRY_STANDARD}

${GEOMETRY_SCENE_SCHEMA}

DECISION RULES:
- Return {"scene": null} if the passage is purely algebraic / arithmetic
  / statistical and does not describe a figure.
- Return a "scene" object when the passage references a geometric figure
  (triangle, quadrilateral, polygon, angle, parallel/perpendicular lines,
  circle, tangent, chord, arc, sector, transformation, locus,
  construction, coordinate geometry of lines/circles, similar/congruent
  triangles, Pythagoras, trigonometry of triangles, etc.) OR when the
  topic is naturally a geometry topic.
- The diagram must match the passage's labels and numbers exactly. If the
  passage names triangle ABC with angle A = 30°, your scene must use the
  same vertex names and angle value.
- Coordinates: origin top-left, y grows DOWNWARD. Layout the figure so it
  fits with ≥20-unit padding inside bounds.

OUTPUT — STRICT JSON only, no fences, no prose:
  {"scene": <GeometryScene>} or {"scene": null}`;

      const user = `Subject: ${b.subject || "Mathematics"} | Topic: ${b.topic || "—"} | Subtopic: ${b.subtopic || "—"}
${b.forceDiagram ? "The teacher has explicitly requested a diagram for this passage.\n" : ""}
PASSAGE:
${sectionText}`;

      const raw = await callAI(
        [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        "google/gemini-2.5-flash",
      );
      const cleaned = stripFences(raw).replace(/^```json\s*|\s*```$/g, "");
      let scene: unknown = null;
      try {
        const obj = JSON.parse(cleaned);
        scene = obj?.scene ?? null;
      } catch {
        scene = null;
      }
      return new Response(JSON.stringify({ scene }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: blueprint
    // Stage 2/3 of the question pipeline. Reads EVERY supplied material
    // (instruction text, photos, documents) and returns a STRUCTURED
    // mathematical blueprint. No question, no diagram, no prose yet.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "blueprint") {
      const b = body as {
        mode: "blueprint";
        sectionKind?: string;
        material?: { text?: string; images?: string[]; files?: Array<{ name: string; mime: string; dataUrl: string }> };
        materialSource?: string;
        contextDirective?: string;
        topic?: string; subtopic?: string; level?: string; difficulty?: string;
        diagramRequired?: boolean | null; reuse?: string;
      };
      const material = b.material ?? {};
      const instruction = `
You are the mathematical analysis stage of a lesson-note generator. You do NOT
write a question yet. You read everything the teacher supplied and return a
STRUCTURED BLUEPRINT of the mathematics involved.

${b.contextDirective ?? ""}

Section being prepared: ${b.sectionKind ?? "example"}
Material supplied: ${b.materialSource ?? "teacher instruction"}

RULES
• If the teacher supplied an existing question (typed, photographed or in a document),
  copy it VERBATIM into "sourceQuestion" and derive the blueprint from it.
• Extract real values and units. Never invent a value the material does not imply.
• "methods" lists the mathematics the question must actually require
  (e.g. "angle at centre = 2 × angle at circumference", "Pythagoras").
• Set diagramRequired true ONLY when the mathematics genuinely needs a diagram
  (geometry figures, bearings, graphs of shapes). Word problems do not.
• "diagramDescription" describes the figure in words: objects, points, which
  values are shown, which are unknown.
• "labels" lists every label that must appear on the diagram.
• "answerFormat" states the expected form of the final answer (degrees, cm, surd,
  simplified fraction, 2 decimal places, …).

Return STRICT JSON only, no markdown, exactly this shape:
{
  "topic": "", "subtopic": "", "level": "", "difficulty": "",
  "objective": "", "objects": [], 
  "given": [{"symbol":"","value":"","unit":""}],
  "unknown": "", "methods": [],
  "diagramRequired": false, "diagramDescription": "", "labels": [],
  "answerFormat": "", "sourceQuestion": "", "notes": ""
}
`.trim();

      const content: any[] = [{ type: "text", text: instruction }];
      if (String(material.text ?? "").trim()) {
        content.push({ type: "text", text: `TEACHER INSTRUCTION / MATERIAL:\n"""${material.text}"""` });
      }
      for (const img of (material.images ?? []).slice(0, 4)) {
        if (typeof img === "string" && img.startsWith("data:")) {
          content.push({ type: "image_url", image_url: { url: img } });
        }
      }
      for (const f of (material.files ?? []).slice(0, 3)) {
        if (!f?.dataUrl) continue;
        if (String(f.mime).startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: f.dataUrl } });
        } else if (String(f.mime) === "application/pdf") {
          content.push({ type: "file", file: { filename: f.name, file_data: f.dataUrl } });
        } else {
          content.push({
            type: "text",
            text: `A file named "${f.name}" (${f.mime}) was attached but its text could not be read here; rely on the instruction above.`,
          });
        }
      }

      const out = await callAI([{ role: "user", content }], "google/gemini-2.5-flash");
      const cleaned = out.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
      let blueprint: any = null;
      try {
        blueprint = JSON.parse(cleaned);
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) { try { blueprint = JSON.parse(m[0]); } catch { blueprint = null; } }
      }
      if (!blueprint || typeof blueprint !== "object") {
        return new Response(JSON.stringify({ error: "blueprint_failed" }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (b.topic && !blueprint.topic) blueprint.topic = b.topic;
      if (b.subtopic && !blueprint.subtopic) blueprint.subtopic = b.subtopic;
      if (b.level && !blueprint.level) blueprint.level = b.level;
      if (b.difficulty && !blueprint.difficulty) blueprint.difficulty = b.difficulty;
      if (b.diagramRequired === true) blueprint.diagramRequired = true;
      if (b.diagramRequired === false) blueprint.diagramRequired = false;
      return new Response(JSON.stringify({ blueprint }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: verify
    // Validation gate. Checks the generated question against the blueprint
    // (maths gate) or the diagram against the question (consistency gate).
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "verify") {
      const b = body as {
        mode: "verify";
        gate?: "maths" | "diagram" | "consistency";
        blueprint?: any;
        question?: string;
        solution?: string;
        diagramSummary?: string;
      };
      const gate = b.gate ?? "maths";
      const gateRules = gate === "consistency"
        ? `Check the DIAGRAM against the QUESTION. Report a problem when a value or label in the
question is missing from the diagram, when the diagram shows a value the question says is
unknown, or when the diagram contradicts the question.`
        : `Check the QUESTION against the BLUEPRINT. Report a problem when the question is not
solvable with the given information, when required values are missing or contradictory,
when it does not actually require the stated mathematics, or when the answer cannot be
expressed in the required format.`;

      const out = await callAI([{
        role: "user",
        content: `You are a validation gate for classroom mathematics. Be strict but do not invent faults.

${gateRules}

BLUEPRINT:
${JSON.stringify(b.blueprint ?? {}, null, 1)}

QUESTION:
"""${b.question ?? ""}"""

${b.solution ? `SOLUTION:\n"""${b.solution}"""` : ""}
${b.diagramSummary ? `DIAGRAM:\n"""${b.diagramSummary}"""` : ""}

Return STRICT JSON only: {"ok": true|false, "problems": ["short problem statement", ...]}
"problems" must be empty when ok is true.`,
      }], "google/gemini-2.5-flash");

      const cleaned = out.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
      let verdict: any = { ok: true, problems: [] };
      try {
        const parsed = JSON.parse(cleaned);
        verdict = { ok: Boolean(parsed?.ok), problems: Array.isArray(parsed?.problems) ? parsed.problems : [] };
      } catch { /* validator unreadable — soft pass */ }
      return new Response(JSON.stringify(verdict), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: scan  (extract problems from a photo)
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "scan") {
      const b = body as { mode: "scan"; imageDataUrl: string; instruction?: string };
      const instruction = b.instruction ||
        `${VALIDATION_DIRECTIVE}

Extract every distinct mathematics problem/question visible on this page.
Return STRICT JSON: an array of strings, each a single problem written naturally for a classroom.
${MATH_MARKUP_RULES}

${RENDERING_STANDARD}

${STRUCTURAL_STANDARD}

Examples of good output:
  "Solve 2x + 4 = 0"
  "Find x: x^{2} − 5x + 6 = 0"
  "Simplify \\frac{3x + 6}{3}"
No markdown, no prose, just the JSON array.`;
      const out = await callAI(
        [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: b.imageDataUrl } },
            ],
          },
        ],
        "google/gemini-2.5-flash",
      );
      let items: string[] = [];
      const cleaned = out.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) items = parsed.filter((x) => typeof x === "string");
      } catch {
        items = cleaned.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);
      }
      return new Response(JSON.stringify({ items: sanitizeLines(items) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: floating
    // Deterministic-first: split SOLUTION into equation lines and run the
    // deterministic extractor per line. AI is bypassed entirely for chip
    // generation — completeness and the five laws are guaranteed by
    // construction.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "floating") {
      const b = body as {
        mode: "floating";
        problem?: string; solution?: string;
        subject?: string; subtopic?: string; sectionKind?: string;
      };
      if (!b.solution || !String(b.solution).trim()) {
        return new Response(JSON.stringify({ error: "missing solution" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!b.problem || !String(b.problem).trim()) {
        return new Response(JSON.stringify({ error: "missing_inherited_question", detail: "Floating notes require the parent ACTIVE_QUESTION." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hasMath = (s: string): boolean =>
        /[=+\-−×÷\^_√≤≥≠±]|\\frac|\\sqrt|\d/.test(s);

      const lines = splitSolutionLines(b.solution)
        .map((rawEquation) => {
          const equation = hardStripMath(String(rawEquation).replace(/\$+/g, "").trim());
          if (!equation) return null;
          if (!hasMath(equation)) return null;
          const det = deterministicExtractLine(equation);
          const v = verifyFloatingLine({ fillers: det.fillers, containers: det.containers });
          if (!v.ok) {
            console.warn("[floating] verifier failures for line:", equation, JSON.stringify(v.failures));
          }
          const comp = verifyCompleteness(equation, det.fillers.join(" "));
          if (!comp.ok) {
            console.warn("[floating] completeness gap:", equation, summariseMissing(comp));
          }
          return det.fillers.length > 0
            ? { equation, fillers: det.fillers, containers: det.containers }
            : null;
        })
        .filter((l): l is { equation: string; fillers: string[]; containers: string[] } => !!l);

      console.log(`[floating] outcome=deterministic lines=${lines.length}`);

      // ─── Self-training: the engine documents its own reasoning ──────
      // Best-effort. Seeds engine principles for this owner if needed,
      // then writes one generation log per produced line. Never blocks
      // the response.
      try {
        const ownerId = (claimData?.claims as any)?.sub as string | undefined;
        if (ownerId && lines.length > 0) {
          await ensureEnginePrinciples(supabaseAuth, ownerId);
          for (const ln of lines) {
            const fillerJoin = ln.fillers.join(" ");
            const comp = verifyCompleteness(ln.equation, fillerJoin);
            const v = verifyFloatingLine({ fillers: ln.fillers, containers: ln.containers });
            const confidence = (v.ok ? 0.6 : 0.3) + (comp.ok ? 0.4 : 0);
            await writeGenerationLog(supabaseAuth, ownerId, {
              input_expression: ln.equation,
              generated_structure: {
                fillers: ln.fillers,
                containers: ln.containers,
              },
              applied_principles: inferAppliedPrinciples(ln.equation),
              generation_reasoning:
                `Scanned "${ln.equation}" left-to-right. Sign-detection bonded each '+' / '-' to its following term, producing ${ln.fillers.length} filler(s). Container boundaries opened at every top-level term and at '='.`,
              validation_reasoning: v.ok && comp.ok
                ? `Coverage 100%; reconstruction exact; container count matches top-level terms.`
                : `Validation issues: ${v.ok ? "" : "verifier=" + JSON.stringify(v.failures) + " "}${comp.ok ? "" : "completeness=" + summariseMissing(comp)}`,
              confidence_score: Math.max(0, Math.min(1, confidence)),
              context: {
                subject: b.subject,
                subtopic: b.subtopic,
                sectionKind: b.sectionKind,
              },
            });
          }
        }
      } catch (e) {
        console.warn("[floating] engine self-explanation skipped:", e);
      }

      return new Response(JSON.stringify({ lines, degraded: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: floating_highlights
    // Each teacher highlight = ONE floating-number block. The highlighted
    // payload is the IMMUTABLE source of truth — AI never rewrites, drops, or
    // re-solves it. Pure deterministic extraction guarantees both sides of
    // "=" and every element survive.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "floating_highlights") {
      const b = body as {
        mode: "floating_highlights";
        problem?: string;
        subject?: string; subtopic?: string; sectionKind?: string;
        highlights?: { groupId: number; payload: string }[];
      };
      const hs = Array.isArray(b.highlights) ? b.highlights : [];
      if (hs.length === 0) {
        return new Response(JSON.stringify({ error: "missing highlights" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hasMath = (s: string): boolean =>
        /[=+\-−×÷\^_√≤≥≠±]|\\frac|\\sqrt|\d/.test(s);

      const lines = hs.map((h) => {
        const payload = String(h.payload ?? "").trim();
        if (!payload) return { equation: "", fillers: [] as string[], containers: [] as string[] };

        if (!hasMath(payload)) {
          const words = payload.split(/\s+/).filter(Boolean);
          return { equation: payload, fillers: words, containers: [] };
        }

        const equation = hardStripMath(payload.replace(/\$+/g, "").trim()) || payload;
        const det = deterministicExtractLine(equation);
        const v = verifyFloatingLine({ fillers: det.fillers, containers: det.containers });
        if (!v.ok) {
          console.warn("[floating_highlights] verifier failures:", equation, JSON.stringify(v.failures));
        }
        const comp = verifyCompleteness(equation, det.fillers.join(" "));
        if (!comp.ok) {
          console.warn("[floating_highlights] completeness gap:", equation, summariseMissing(comp));
        }
        if (det.fillers.length === 0) {
          const toks = payload.split(/\s+/).filter(Boolean);
          return { equation, fillers: toks, containers: det.containers };
        }
        return { equation, fillers: det.fillers, containers: det.containers };
      });

      console.log(`[floating_highlights] outcome=deterministic lines=${lines.length}`);
      return new Response(JSON.stringify({ lines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: floating_line_edit
    // Regenerate ONE floating-number line. Optional teacher instruction
    // rewrites the equation (e.g. "split the bracket", "use completed
    // square"); without an instruction this is a deterministic re-extract.
    // Returns { equation, fillers, containers } for the single line only.
    // ─────────────────────────────────────────────────────────────
    if (body.mode === "floating_line_edit") {
      const b = body as {
        mode: "floating_line_edit";
        problem?: string;
        equation?: string;
        instruction?: string;
        currentFillers?: string[];
        currentContainers?: string[];
        subject?: string; subtopic?: string; sectionKind?: string;
      };
      const sourceEquation = String(b.equation ?? "").trim();
      if (!sourceEquation) {
        return new Response(JSON.stringify({ error: "missing equation" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const instruction = String(b.instruction ?? "").trim();
      const currentFillers = Array.isArray(b.currentFillers)
        ? b.currentFillers.map((x) => String(x))
        : [];

      // Strip leading prose words ("Let ", "Hence ", "So ", "Thus ",
      // "Therefore ", "Then ") that the extractor would otherwise treat as
      // variables and that frequently swallow the LHS of the equation.
      const stripProse = (s: string): string =>
        s.replace(/^\s*(?:let|hence|so|thus|therefore|then|given|we\s+have|implies|imply|⇒|=>)\b[:,]?\s*/i, "").trim();

      type DiagStatus = "pass" | "fail" | "fixed";
      interface Diag { id: string; label: string; status: DiagStatus; detail?: string }

      // Build the expected-chip "answer key" deterministically from the
      // source equation (after stripping prose lead-ins). This is the
      // ground truth the audit checks against.
      const buildExpected = (eq: string) => {
        const cleaned = hardStripMath(stripProse(eq).replace(/\$+/g, "").trim()) || eq;
        return deterministicExtractLine(cleaned);
      };

      // Normalise a chip for membership comparison: collapse whitespace,
      // unify sign glyphs, lowercase letters. Leading "+" is preserved
      // because expected chips encode it explicitly (e.g. "+5x").
      const normChip = (c: string): string =>
        String(c ?? "")
          .replace(/\s+/g, "")
          .replace(/[−–—]/g, "-")
          .replace(/[×·*]/g, "×")
          .replace(/[÷]/g, "÷")
          .toLowerCase();

      // Split a chip list into side groups using "=" / "±" as boundaries.
      const splitSides = (chips: string[]): string[][] => {
        const sides: string[][] = [[]];
        for (const c of chips) {
          if (c === "=" || c === "±") sides.push([]);
          else sides[sides.length - 1].push(c);
        }
        return sides;
      };

      // Per-chip audit: returns one Diag per expected chip plus splitter chips.
      const auditExpectedCoverage = (
        expectedFillers: string[],
        actualFillers: string[],
      ): { items: Diag[]; missing: string[] } => {
        const items: Diag[] = [];
        const missing: string[] = [];
        const expSides = splitSides(expectedFillers);
        const actSides = splitSides(actualFillers);
        const sideLabel = (i: number, total: number) => {
          if (total <= 1) return "expression";
          if (i === 0) return "before =";
          if (i === total - 1) return "after =";
          return `part ${i + 1}`;
        };
        const total = expSides.length;
        for (let si = 0; si < total; si++) {
          const expSide = expSides[si];
          const actSide = (actSides[si] ?? []).map(normChip);
          const label = sideLabel(si, total);
          for (const chip of expSide) {
            const ok = actSide.includes(normChip(chip));
            items.push({
              id: `chip-${si}-${items.length}`,
              label: `${label}: ${chip}`,
              status: ok ? "pass" : "fail",
              detail: ok ? undefined : "missing from chips",
            });
            if (!ok) missing.push(`${label}: ${chip}`);
          }
          if (si < total - 1) {
            // Check splitter chip presence (= or ± between si and si+1).
            const splitter = expectedFillers.find((c, idx) => {
              if (c !== "=" && c !== "±") return false;
              const before = splitSides(expectedFillers.slice(0, idx));
              return before.length - 1 === si;
            }) ?? "=";
            const splitterPresent = actualFillers.includes(splitter);
            items.push({
              id: `splitter-${si}`,
              label: `${splitter === "±" ? "Plus-or-minus" : "Equals"} sign present`,
              status: splitterPresent ? "pass" : "fail",
              detail: splitterPresent ? undefined : `missing "${splitter}" chip`,
            });
            if (!splitterPresent) missing.push(`splitter ${splitter}`);
          }
        }
        return { items, missing };
      };

      // The expected answer key (deterministic ground truth).
      const expected = buildExpected(sourceEquation);
      const expectedEquation = stripProse(sourceEquation);

      // STAGE A — audit the CURRENT chips (what the teacher is looking at)
      // against the expected chip list. Failures here become the rows that
      // are visibly marked "missing" before repair.
      const auditCurrent = auditExpectedCoverage(expected.fillers, currentFillers);

      // Optional: AI equation rewrite when teacher gave an instruction.
      // Runs up to 3 attempts, each time feeding back which chips/laws
      // failed so the model can self-correct ("sort it out himself").
      let targetEquation = sourceEquation;
      let lastFailureBrief = "";
      const MAX_ATTEMPTS = instruction ? 3 : 0;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const sys = `${VALIDATION_DIRECTIVE}

You rewrite a SINGLE mathematics equation line per a teacher instruction.

GOAL: produce an equation whose chips pass these laws:
  1. Equals sign "=" appears as its own chip (LHS and RHS must both be present).
  2. No chip hides "+" or "−" inside it (split sums into separate terms).
  3. No chip is a raw operator or empty bracket.
  4. Integrals / sums with multiple terms MUST be split: write
       ∫(a)dx + ∫(b)dx     not     ∫(a + b)dx
     Same for ∑.
  5. Fractions over a common denominator that contain a "+" or "−" in the
     numerator MUST be split into separate fractions before chip extraction.

RULES:
- Output ONLY the rewritten equation as a single line. No prose, no
  commentary, no fences, no "Equation:" prefix.
- Preserve every variable, number, sign, and exponent from the source
  unless the instruction explicitly asks otherwise. Never drop the LHS.
- Use Unicode classroom math (² ³ √ × ÷ ± ≤ ≥ π θ …). Keep stacked
  fractions as \\frac{a}{b} so the renderer stacks them.
- Return only the equation line — nothing else.`;
        const user = `PROBLEM CONTEXT (for understanding only):
${(b.problem || "").trim()}

CURRENT EQUATION:
${sourceEquation}

TEACHER INSTRUCTION:
${instruction}
${attempt > 1 ? `
PREVIOUS ATTEMPT FAILED — fix these issues now:
${lastFailureBrief}

Your previous output was:
${targetEquation}

Try again. Apply the instruction MORE AGGRESSIVELY: actually split the
integral/sum/fraction so no chip hides a "+" or "−". Do not return the
source unchanged.` : ""}

Return the rewritten equation line only.`;
        try {
          const rich = await callAIRich(
            [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            { maxTokens: 1024 },
          );
          const txt = stripFences(rich.content)
            .split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
            .filter((l) => !/^(equation|answer|result)\s*:/i.test(l))[0] ?? "";
          if (txt) targetEquation = txt;
        } catch (err) {
          console.warn(`[floating_line_edit] AI gateway error (attempt ${attempt})`, String(err));
          break;
        }

        // Verify this attempt — if clean, stop retrying.
        const tryExp = buildExpected(targetEquation);
        const tryAudit = auditExpectedCoverage(tryExp.fillers, tryExp.fillers);
        const tryVerify = verifyFloatingLine({ fillers: tryExp.fillers, containers: tryExp.containers as unknown as string[] });
        if (tryVerify.ok && tryAudit.missing.length === 0) break;

        // Build a concise failure brief for the next attempt.
        const parts: string[] = [];
        const hidden = tryVerify.failures.filter((f) => f.code === "NoHiddenSign").map((f) => f.chip).filter(Boolean);
        if (hidden.length) parts.push(`Chips still hide + or − inside: ${hidden.join(", ")}`);
        const rawOps = tryVerify.failures.filter((f) => ["NoRawOperatorChip", "NoRawBracketChip", "EmptyChip"].includes(f.code));
        if (rawOps.length) parts.push(`Raw operator/empty chips: ${rawOps.map((f) => f.chip || f.detail).join(", ")}`);
        if (tryAudit.missing.length) parts.push(`Missing terms: ${tryAudit.missing.join("; ")}`);
        lastFailureBrief = parts.join("\n") || "Chips still violate the five floating-number laws.";
      }

      // STAGE B — regenerate the chips deterministically from the (possibly
      // rewritten) target equation. This IS the repair: the extractor is
      // the ground truth, so it cannot miss the LHS of "=".
      const repaired = buildExpected(targetEquation);
      let det: { fillers: string[]; containers: string[] } = {
        fillers: repaired.fillers,
        containers: repaired.containers as unknown as string[],
      };

      // Re-audit against the equation the chips are FOR (target, not source,
      // so that an instruction-driven rewrite is audited against itself).
      const repairedExpected = buildExpected(targetEquation);
      const auditRepaired = auditExpectedCoverage(repairedExpected.fillers, det.fillers);

      // Law checks on the repaired chips.
      let v = verifyFloatingLine({ fillers: det.fillers, containers: det.containers });

      // Build diagnostics: per-chip rows reflect what was missing in the
      // current chips, then law-level rows reflect the repaired chips.
      const diagnostics: Diag[] = [];
      // Per-chip rows: mark "fixed" when current was missing but repaired
      // now contains it.
      const repairedActSet = new Set(det.fillers.map(normChip));
      for (const row of auditCurrent.items) {
        if (row.status === "pass") {
          diagnostics.push(row);
          continue;
        }
        // Was this chip recovered by repair?
        const expectedChip = row.label.split(": ").slice(1).join(": ") || row.label;
        const recovered = expectedChip === "Equals sign present"
          ? det.fillers.includes("=")
          : expectedChip === "Plus-or-minus sign present"
          ? det.fillers.includes("±")
          : repairedActSet.has(normChip(expectedChip));
        diagnostics.push({
          ...row,
          status: recovered ? "fixed" : "fail",
          detail: recovered ? undefined : row.detail,
        });
      }

      // Law-level rows (computed on repaired chips).
      const codes = new Set(v.failures.map((f) => f.code));
      const pushLaw = (id: string, label: string, failed: boolean, detail?: string) => {
        diagnostics.push({ id, label, status: failed ? "fail" : "pass", detail: failed ? detail : undefined });
      };
      pushLaw(
        "hidden-signs",
        "No hidden signs inside chips",
        codes.has("NoHiddenSign"),
        v.failures.filter((f) => f.code === "NoHiddenSign").map((f) => f.chip).join(", "),
      );
      pushLaw(
        "atomic-terms",
        "Atomic terms only (no raw operators)",
        codes.has("NoRawOperatorChip") || codes.has("NoRawBracketChip") || codes.has("EmptyChip"),
        v.failures
          .filter((f) => ["NoRawOperatorChip", "NoRawBracketChip", "EmptyChip"].includes(f.code))
          .map((f) => f.chip || f.detail).join(", "),
      );
      pushLaw(
        "leading-plus",
        "No synthetic leading +",
        codes.has("NoSyntheticLeadingPlus"),
        v.failures.filter((f) => f.code === "NoSyntheticLeadingPlus").map((f) => f.chip).join(", "),
      );
      pushLaw(
        "containers",
        "Container shells valid",
        codes.has("ContainerAllowed") || codes.has("ContainerDedup"),
        v.failures.filter((f) => f.code === "ContainerAllowed" || f.code === "ContainerDedup").map((f) => f.detail).join(", "),
      );
      pushLaw(
        "five-laws",
        "Five floating-number laws satisfied",
        !v.ok,
        v.ok ? undefined : `${v.failures.length} violation(s)`,
      );

      const remaining = diagnostics.filter((d) => d.status === "fail").length;
      const fixedCount = diagnostics.filter((d) => d.status === "fixed").length;
      const status: "clean" | "fixed" | "unresolved" =
        remaining === 0 ? (fixedCount > 0 ? "fixed" : "clean") : "unresolved";

      const finalEquation = stripProse(targetEquation) || targetEquation;
      if (!v.ok) {
        console.warn("[floating_line_edit] verifier failures:", finalEquation, JSON.stringify(v.failures));
      }
      if (auditRepaired.missing.length) {
        console.warn("[floating_line_edit] still missing after repair:", auditRepaired.missing);
      }

      // ── Recovery guidance — only attached when the auto-fix failed. ──
      let recovery:
        | {
            reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown";
            summary: string;
            hints: string[];
            suggestedInstructions: string[];
            canRevert: boolean;
          }
        | undefined;

      if (status === "unresolved") {
        const failedRows = diagnostics.filter((d) => d.status === "fail");
        const hiddenSignChips = v.failures
          .filter((f) => f.code === "NoHiddenSign")
          .map((f) => String(f.chip ?? ""));
        const offendingHasIntegral = hiddenSignChips.some((c) => /∫|\\int/.test(c));
        const offendingHasSum = hiddenSignChips.some((c) => /∑|\\sum/.test(c));
        const offendingHasFrac = hiddenSignChips.some((c) => /\\frac|□\/□|\//.test(c));

        const eq = finalEquation;
        const hasIntegral = /∫|\\int/.test(eq) || offendingHasIntegral;
        const hasSum = /∑|\\sum/.test(eq) || offendingHasSum;
        const missingTerms = auditRepaired.missing.length > 0;

        let reason: "structure_not_decomposed" | "law_violation" | "missing_terms" | "unknown";
        let summary: string;
        const hints: string[] = [];
        const suggestedInstructions: string[] = [];

        if (hiddenSignChips.length > 0 && (hasIntegral || hasSum || offendingHasFrac)) {
          reason = "structure_not_decomposed";
          if (hasIntegral) {
            summary =
              "The integral could not be split into separate chips, so a single chip still hides + or − inside it.";
            hints.push(
              "Split the integral into one integral per term so each chip contains only one fraction or expression.",
            );
            hints.push("Or expand the integrand into separate fractions before integrating.");
            hints.push("Avoid wrapping a sum of fractions inside a single ∫( … )dx.");
            suggestedInstructions.push(
              "Split the integral into separate integrals, one for each fraction.",
              "Expand the integrand into a sum of separate fractions before integrating.",
              "Combine the fractions over a common denominator first, then integrate.",
            );
          } else if (hasSum) {
            summary = "A summation chip still contains hidden + or − because its body wasn't decomposed.";
            hints.push("Rewrite the sum so each term appears on its own.");
            suggestedInstructions.push(
              "Split the summation into one sum per term.",
              "Distribute the summation across the sum inside it.",
            );
          } else {
            summary =
              "A chip still contains a + or − sign inside it. Each chip must be a single atomic term.";
            hints.push(
              "Rewrite the line so every term is separated by a top-level + or − (not hidden inside brackets).",
            );
            suggestedInstructions.push(
              "Expand the brackets so each term stands alone.",
              "Rewrite the expression as a clean sum of separate terms.",
            );
          }
        } else if (missingTerms) {
          reason = "missing_terms";
          summary = `Some expected terms are still missing after auto-fix: ${auditRepaired.missing
            .slice(0, 4)
            .join(", ")}.`;
          hints.push("Check that the equation includes every term you expect to see as a chip.");
          hints.push("If a term was dropped, retype the line with all terms present.");
          suggestedInstructions.push(
            "Rewrite the equation including every term explicitly.",
            "Restore any missing terms before the equals sign.",
          );
        } else if (failedRows.length > 0) {
          reason = "law_violation";
          summary =
            "Some floating-number laws are still failing. The chips look complete but don't pass all five laws.";
          hints.push("Rewrite the line so every term is a single atomic factor or shell.");
          hints.push("Avoid raw operator chips and synthetic leading + signs.");
          suggestedInstructions.push(
            "Simplify the line into clean atomic terms.",
            "Rewrite using stacked fractions and explicit Unicode operators.",
          );
        } else {
          reason = "unknown";
          summary = "Auto-fix could not resolve this line.";
          hints.push("Try regenerating, or describe what to change in plain language.");
          suggestedInstructions.push("Rewrite this line so every chip is a single atomic term.");
        }

        recovery = {
          reason,
          summary,
          hints,
          suggestedInstructions,
          canRevert: Array.isArray(currentFillers) && currentFillers.length > 0,
        };
      }

      return new Response(
        JSON.stringify({
          equation: finalEquation,
          fillers: det.fillers,
          containers: det.containers,
          diagnostics,
          status,
          ...(recovery ? { recovery } : {}),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }



    return new Response(JSON.stringify({ error: "unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notebook-ai error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

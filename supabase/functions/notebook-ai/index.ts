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
import {
  runValidationPipeline,
  firstFailingStage,
  formatViolations,
  hardStripMath,
  type ValidationKind,
} from "./validator.ts";

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


async function callAI(messages: any[], model = "google/gemini-2.5-flash") {
  const res = await fetch(ENDPOINT, {
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
  let draft = await callAI(messages, model);
  let cleaned = sanitizeMath(stripFences(draft));
  let lastStage = 1;

  // Run the pipeline; on the first failing stage, correct in a loop until
  // that stage passes (or maxRounds hit). Then re-run the pipeline from the
  // top so earlier stages catch any regressions the correction introduced.
  let safety = 8; // hard cap across all stages to prevent runaway loops
  while (safety-- > 0) {
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
      cleaned = sanitizeMath(stripFences(correction));
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
  const finalResults = runValidationPipeline(cleaned, opts.kind);
  const lastFailing = firstFailingStage(finalResults);
  const warnings = lastFailing
    ? lastFailing.violations.map((v) => `[Stage ${v.phase}] ${v.rule}: ${v.detail}`)
    : [];
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
const normaliseForLock = (s: string): string =>
  hardStripMath(String(s ?? ""))
    .replace(/\s+/g, "")
    .replace(/[-−–—]/g, "-")
    .replace(/[×·*]/g, "x")
    .replace(/[÷]/g, "/")
    .toLowerCase();

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
        inheritedContext?: boolean;
      };

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
          problem: "Write ONE concise worked-example problem only. No solution. Use math markup for fractions/roots/powers.",
          solution: "Solve ACTIVE_QUESTION. First line is ACTIVE_QUESTION restated verbatim. Then one step per line, using math markup. Final line is the answer.",
          reasoning: "Write one SHORT teacher note per line, matched 1:1 with the solution lines above. First note is empty. 2–6 words each: 'Subtract 5 from both sides', 'Simplify', 'Divide both sides by 10'.",
        },
        exercise: {
          problem: "Write ONE practice problem only. Use math markup.",
          solution: "Solve ACTIVE_QUESTION. First line restates ACTIVE_QUESTION verbatim. One step per line. Math markup.",
          reasoning: "Short teacher notes, one per solution line. First note empty. 2–6 words each.",
        },
        classwork: {
          problem: "Write ONE classwork problem only. Math markup.",
          solution: "Solve ACTIVE_QUESTION. First line restates ACTIVE_QUESTION verbatim. One step per line.",
          reasoning: "Short teacher notes, one per solution line. First empty.",
        },
        homework: {
          problem: "Write ONE homework problem only.",
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
${isSolutionBlock ? `\n${BENCHMARK_STANDARD}\n\n${PEDAGOGY_RULES}\n` : ""}
Task style for this block: ${styleLine}
Output ONLY the requested content. No headings like "Solution:", no markdown, no commentary.`;

      const parts: string[] = [];
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
        parts.push(`Now generate the ${b.blockKind} for this ${b.sectionKind}.`);
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
    // Extract floating-number preparation pieces for the Smartboard from an
    // already-solved subsection. Returns one entry per verified equation line:
    //   { equation, fillers[], containers[] }
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
      const sys = `${VALIDATION_DIRECTIVE}

${INHERITANCE_STANDARD}

You extract FLOATING-NUMBER PIECES for a Mathematics Smartboard.
The mathematics is ALREADY SOLVED. Do NOT re-solve. Extract only.
Every piece you emit must be traceable back to ACTIVE_QUESTION (the PROBLEM
field below). Never introduce numbers, variables, or expressions that do not
appear in ACTIVE_QUESTION or in its valid algebraic derivations in SOLUTION.

╔══════════════════════════════════════════════════════════════════╗
║  HARD RULE #1 — UNICODE ONLY. NEVER EMIT LATEX OR CODE SYNTAX.   ║
╠══════════════════════════════════════════════════════════════════╣
║  Every character in "equation" and every character in every       ║
║  "fillers" entry MUST be Unicode classroom math. A backslash,     ║
║  ^{...}, _{...}, sqrt(), or ** anywhere in the output is a BUG.   ║
║                                                                   ║
║  FORBIDDEN SUBSTRINGS — the response is INVALID if any appear:    ║
║    \\sqrt   \\frac   \\dfrac   \\tfrac   \\log_   \\ln   \\int    ║
║    \\sum    \\prod   \\begin{ \\end{   \\cdot   \\times   \\div   ║
║    \\pm     \\mp     \\leq    \\geq    \\neq    \\approx          ║
║    \\infty  \\pi     \\theta  \\,  \\!  \\;  \\\\                  ║
║    ^{       _{       sqrt(   **                                   ║
║    a backslash followed by ANY ASCII letter                       ║
║                                                                   ║
║  REQUIRED MAPPING — use the RIGHT column:                         ║
║    \\sqrt{3}       →  √3                                          ║
║    \\sqrt{75}      →  √75                                         ║
║    \\sqrt{b^2-4ac} →  √(b²−4ac)                                   ║
║    x^{2}, x^2     →  x²    (² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁰ ¹)                 ║
║    \\log_{2}5      →  log₂5   (₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉)              ║
║    \\frac{a}{b}    →  NEVER in fillers; emit a,b as separate       ║
║                       fillers and add "fraction" to containers.   ║
║    \\cdot, *       →  ×                                            ║
║    \\div           →  ÷                                            ║
║    \\pm            →  ±                                            ║
║    \\leq, \\geq    →  ≤, ≥                                         ║
║    plain "-"      →  − (proper Unicode minus)                     ║
╚══════════════════════════════════════════════════════════════════╝

══════════════════════════════════════════════════════════════════
 FLOATING-NUMBER LAWS — apply in order, recursively, to every chip
══════════════════════════════════════════════════════════════════

LAW 1 — NO SYNTHETIC SIGN.
A chip carries a leading +, −, ×, or ÷ ONLY when that exact sign is
literally visible in the source equation at that position. Otherwise
the chip is emitted bare (no sign prefix).
  • The FIRST chip of a line carries NO sign.
  • The chip immediately after "=" or "±" carries NO sign.
  • The FIRST chip inside any opened container (bracket, fraction
    numerator, fraction denominator, radicand, exponent, subscript,
    function argument) carries NO sign.
  • Every other chip keeps the visible sign that precedes it.
"=" and "±" are themselves chips ("=" / "±").
NEVER invent a "+" that is not in the source. A synthetic leading
"+" is a BUG.

LAW 2 — NO HIDDEN SIGN ANYWHERE (a±b is forbidden inside a chip).
If the body of ANY container — bracket, fraction numerator, fraction
denominator, radicand, exponent, subscript, log/function argument,
absolute-value body — contains a top-level +, −, ×, or ÷, that
container MUST be OPENED:
  • Emit the empty SHELL as one chip: "()", "□/□", "√()", "√[n]()",
    "()^()", "log_a()", "|()|", etc.
  • Then emit every interior term as its own chip, with each
    interior sign exactly as it appears (first interior chip bare).
  • Recurse: if an interior chip is itself a container with a hidden
    sign inside, open it too.
The strings "a+b", "a−b", "a×b", "a÷b" must NEVER sit hidden inside
any chip — not as a coefficient, not as an exponent, not as a base,
not as a denominator, not as an argument.

LAW 3 — STAY GLUED when there is NO hidden sign AND the expression
is not unusually long. Single chips are correct for:
  ab, 3x², 6ax, 4ac, 3n, −2y, √3, √75, log₂5, |x|, x², sin2x,
  5/(3n)  (denominator has no hidden sign → keep the whole fraction).

LAW 4 — LENGTH SPLIT. When an expression has no visible top-level
sign but is unusually long (e.g. a²b²c²d²/d²a²b² — long stack of
factors), split it using the same structural laws: open the
container, emit each factor / sub-piece as its own chip.

LAW 5 — STRUCTURE CONTAINERS. Emit one tag per structural kind that
appears, deduped. Allowed values ONLY:
  "fraction" | "bracket" | "radical" | "power" | "log" | "integral"
  | "matrix" | "differential" | "abs" | "vector"

══════════════════════════════════════════════════════════════════
 WORKED EXAMPLES — your output MUST follow this style exactly
══════════════════════════════════════════════════════════════════

  2x + 3y = 7
    fillers:    ["2x", "+3y", "=", "7"]
    containers: []

  3x − 2y = 0
    fillers:    ["3x", "−2y", "=", "0"]
    containers: []
    (NEVER split "−2y" into "−2" and "y" — coefficients stay attached.)

  ax² + bx + c = 0
    fillers:    ["ax²", "+bx", "+c", "=", "0"]
    containers: ["power"]

  2x + 3(x + 1) = 7                     (bracket has hidden + → OPEN)
    fillers:    ["2x", "+3", "()", "x", "+1", "=", "7"]
    containers: ["bracket"]

  √(b² − 4ac)                            (radicand has hidden − → OPEN)
    fillers:    ["√()", "b²", "−4ac"]
    containers: ["radical", "power"]

  log₂(xy)                               (argument has NO hidden sign → GLUED)
    fillers:    ["log₂()", "xy"]
    containers: ["log"]
    (xy has no top-level sign and is short → it stays as one chip
     inside the opened log shell. Open the log only because the
     log's argument is itself a container; do NOT further split xy.)

  log₂(x + y)                            (argument has hidden + → OPEN inner terms)
    fillers:    ["log₂()", "x", "+y"]
    containers: ["log"]

  5/(3n)                                 (denominator has no hidden sign → GLUED)
    fillers:    ["□/□", "5", "3n"]
    containers: ["fraction"]

  −23/(4(n+2))                           (denominator has hidden + → fully OPEN)
    fillers:    ["−□/□", "23", "4", "()", "n", "+2"]
    containers: ["fraction", "bracket"]

  −3n²(2x)^(n−4)                         (exponent has hidden − → OPEN exponent)
    fillers:    ["−3n²", "()^()", "2x", "n", "−4"]
    containers: ["power", "bracket"]

  +³√((x+2)^(n+1) / (x−4))              (every inner container has hidden sign → OPEN all)
    fillers:    ["+√[3]()", "□/□", "()^()", "x", "+2", "n", "+1", "x", "−4"]
    containers: ["radical", "fraction", "power", "bracket"]

  −ⁿ√(n(n+1)²)                          (radicand has hidden +; (n+1) opens too)
    fillers:    ["−√[n]()", "n", "()²", "n", "+1"]
    containers: ["radical", "power", "bracket"]

STRUCTURAL SYMBOLS — allowed values ONLY, one per kind, deduped:
  "fraction" | "bracket" | "radical" | "power" | "log" | "integral"
  | "matrix" | "differential" | "abs" | "vector"



OUTPUT — STRICT JSON only, no fences, no prose:
{ "lines": [
    { "equation": "...", "fillers": ["...","..."], "containers": ["..."] }
] }

EQUATION FIELD: keep stacked-fraction syntax \\frac{a}{b} INTACT in the
"equation" string (the notebook renderer turns it into a real stacked
fraction). NEVER write "a/b" inline for a true fraction. Powers may be
written as ² ³ ⁴ … in the equation field; the fillers extract uses the
same Unicode.

SELF-CHECK before emitting: re-read every "equation" and every
"fillers" entry. If you see a backslash (other than \\frac in the
equation field), "sqrt(", "^{", "_{", or "**" ANYWHERE, REWRITE IT TO
UNICODE first. A response containing any forbidden substring is
invalid and will be rejected.`;

      const user = `Subject: ${b.subject || "Mathematics"} | Subtopic: ${b.subtopic || "—"} | Section: ${b.sectionKind || "example"}
PROBLEM:
${(b.problem || "").trim()}

SOLUTION:
${b.solution.trim()}

Return the JSON.`;

      const raw = await callAI([
        { role: "system", content: sys },
        { role: "user", content: user },
      ]);
      const cleaned = stripFences(raw).replace(/^```json\s*|\s*```$/g, "");
      let out: { lines: any[] } = { lines: [] };
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed?.lines)) out.lines = parsed.lines;
      } catch {
        out.lines = [];
      }
      // Sanitize. Normalize to Unicode first, then detect structures
      // (from Unicode markers), then drop anything still containing code syntax.
      const allowed = new Set(["fraction","bracket","radical","power","log","integral","matrix","differential","abs","vector"]);
      const detectStructuresU = (t: string): string[] => {
        const out: string[] = [];
        if (/√/.test(t)) out.push("radical");
        if (/[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ⁺⁻⁽⁾]/.test(t)) out.push("power");
        if (/\blog[₀₁₂₃₄₅₆₇₈₉]/.test(t)) out.push("log");
        if (/\|[^|]+\|/.test(t)) out.push("abs");
        return out;
      };
      // Visible top-level arithmetic sign detector (ignores leading sign and
      // anything inside (), [], {}).
      const hasTopLevelSign = (src: string): boolean => {
        if (!src) return false;
        const s = src.replace(/\s+/g, "");
        let depth = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (c === "(" || c === "[" || c === "{") { depth++; continue; }
          if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
          if (depth !== 0) continue;
          if (i === 0) continue;
          if (c === "+" || c === "-" || c === "−" || c === "–" ||
              c === "×" || c === "·" || c === "÷" || c === "=") return true;
        }
        return false;
      };
      const lines = out.lines.map((l: any) => {
        // Equation: do NOT run through toUnicodeMath — it would strip the
        // braces around \frac{a}{b} and break stacked-fraction rendering.
        // The notebook renderer handles \frac, \sqrt, ^{...}, _{...} natively.
        // Just strip $…$ delimiters and trim.
        const equation = hardStripMath(String(l?.equation ?? "").replace(/\$+/g, "").trim());
        const rawFillers: string[] = Array.isArray(l?.fillers)
          ? l.fillers.map((x: any) => toUnicodeMath(String(x).trim())).filter(Boolean)
          : [];
        const derived = new Set<string>();
        const cleanFillers: string[] = [];
        for (const t of rawFillers) {
          if (isStillDirty(t)) {
            console.warn("[floating] dropping dirty filler:", t);
            continue;
          }
          for (const k of detectStructuresU(t)) derived.add(k);
          // Drop only if this filler still lumps multiple terms (top-level sign).
          if (hasTopLevelSign(t)) {
            console.warn("[floating] dropping compound filler:", t);
            continue;
          }
          cleanFillers.push(t);
        }
        // Safety net for the new sign rule: a chip carries "+" ONLY when the
        // source equation shows it at that position. Strip a leading "+" from
        // the first content chip of the line and from any chip that follows
        // "=" or "±" — the AI sometimes forgets to do this itself.
        const normFillers: string[] = [];
        let seenContent = false;
        for (const t of cleanFillers) {
          if (t === "=" || t === "±") {
            normFillers.push(t);
            seenContent = false;
            continue;
          }
          const prev = normFillers.length > 0 ? normFillers[normFillers.length - 1] : "";
          const afterSplitter = prev === "=" || prev === "±";
          if ((!seenContent || afterSplitter) && t[0] === "+") {
            normFillers.push(t.slice(1));
          } else {
            normFillers.push(t);
          }
          seenContent = true;
        }
        const rawContainers: string[] = Array.isArray(l?.containers)
          ? l.containers.map((x: any) => String(x).toLowerCase().trim()).filter((x: string) => allowed.has(x))
          : [];
        const seen = new Set<string>();
        const containers: string[] = [];
        for (const c of [...rawContainers, ...derived]) {
          if (!seen.has(c)) { seen.add(c); containers.push(c); }
        }
        return { equation, fillers: normFillers, containers };
      }).filter((l: any) => l.equation);

      return new Response(JSON.stringify({ lines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // MODE: floating_highlights
    // Each teacher highlight becomes ONE floating-number block, independent
    // of every other highlight. Prose-only highlights become word fillers.
    // Math highlights use the same per-line extraction as `floating` mode.
    // No transition / inheritance across highlights.
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

      const allowed = new Set([
        "fraction","bracket","radical","power","log","integral",
        "matrix","differential","abs","vector",
      ]);
      const detectStructuresU = (t: string): string[] => {
        const out: string[] = [];
        if (/√|\\sqrt/.test(t)) out.push("radical");
        if (/[²³⁴⁵⁶⁷⁸⁹⁰¹ⁿⁱ⁺⁻⁽⁾]|\^/.test(t)) out.push("power");
        if (/\\frac|\\dfrac|\\tfrac/.test(t)) out.push("fraction");
        if (/\blog[₀₁₂₃₄₅₆₇₈₉_]/.test(t)) out.push("log");
        if (/\|[^|]+\|/.test(t)) out.push("abs");
        return out;
      };
      const hasTopLevelSign = (src: string): boolean => {
        if (!src) return false;
        const s = src.replace(/\s+/g, "");
        let depth = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (c === "(" || c === "[" || c === "{") { depth++; continue; }
          if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth - 1); continue; }
          if (depth !== 0) continue;
          if (i === 0) continue;
          if (c === "+" || c === "-" || c === "−" || c === "–" ||
              c === "×" || c === "·" || c === "÷" || c === "=") return true;
        }
        return false;
      };

      // Build a single AI request listing all highlights — model returns
      // one entry per highlight in the same order.
      const sys = `${VALIDATION_DIRECTIVE}

You extract FLOATING-NUMBER PIECES for a Mathematics Smartboard.
The teacher has HIGHLIGHTED specific spans of an already-solved problem.
Each highlight is an INDEPENDENT floating-number block — do NOT carry
fillers, structures, or context across highlights. Do NOT re-solve
anything. Do NOT add numbers or variables not present in the highlight.

For EACH highlight you receive, emit one entry:
  { "equation": "<the highlight text>", "fillers": [...], "containers": [...] }

If the highlight is plain prose (no math symbols), emit one filler per
word in order, preserving punctuation attached to the word, with
containers = []. Example highlight "let the value of x be" →
  fillers: ["let","the","value","of","x","be"], containers: []

If the highlight is math, follow the SAME extraction rules as the
classroom floating-number standard:
  • Split on top-level + − × ÷ =. "=" and "±" are their own fillers.
  • Implicit multiplication (ab, 3x², 6ax), radicals over a sign-free
    body (√3, √75), log₂5, |x|, x² stay GLUED.
  • Bracket coefficient stays attached (e.g. "+3"); inner terms split.
  • For fractions, emit numerator and denominator as separate fillers
    and add "fraction" to containers. NEVER emit "a/b" as one filler.
  • Use ONLY Unicode classroom math in fillers (no \\frac, \\sqrt, ^{}, _{}, sqrt(), **).
  • The "equation" field MAY keep \\frac{a}{b} so the notebook renderer
    can stack it.
  • The FIRST chip carries NO sign. A chip right after "=" or "±" carries NO sign.

Allowed container values (one per kind, deduped):
  "fraction" | "bracket" | "radical" | "power" | "log" | "integral"
  | "matrix" | "differential" | "abs" | "vector"

OUTPUT — STRICT JSON only, no fences, no prose:
{ "lines": [ { "equation": "...", "fillers": ["..."], "containers": ["..."] } ] }

The "lines" array MUST have EXACTLY ${hs.length} entries, in the same
order as the highlights below. Never merge or drop a highlight.`;

      const user = `Subject: ${b.subject || "Mathematics"} | Subtopic: ${b.subtopic || "—"} | Section: ${b.sectionKind || "example"}
PROBLEM (context only — do NOT extract from this):
${(b.problem || "").trim()}

HIGHLIGHTS (one entry per item, in this exact order):
${hs.map((h, i) => `[${i + 1}] ${String(h.payload ?? "").trim()}`).join("\n")}

Return the JSON.`;

      const raw = await callAI([
        { role: "system", content: sys },
        { role: "user", content: user },
      ]);
      const cleaned = stripFences(raw).replace(/^```json\s*|\s*```$/g, "");
      let parsedLines: any[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed?.lines)) parsedLines = parsed.lines;
      } catch {
        parsedLines = [];
      }

      // Map results 1-to-1 onto highlights. If the AI missed an item or
      // returned junk, fall back to a local word/term split so the user
      // still sees something for every highlight.
      const lines = hs.map((h, i) => {
        const raw = parsedLines[i] ?? {};
        const payload = String(h.payload ?? "").trim();
        const equation = hardStripMath(
          String(raw?.equation ?? payload).replace(/\$+/g, "").trim(),
        ) || payload;

        const isProse = !hasMath(payload);

        // Prose fallback — always derive fillers locally for prose so we
        // do not depend on the model splitting words correctly.
        if (isProse) {
          const words = payload.split(/\s+/).filter(Boolean);
          return { equation: payload, fillers: words, containers: [] as string[] };
        }

        const rawFillers: string[] = Array.isArray(raw?.fillers)
          ? raw.fillers.map((x: any) => toUnicodeMath(String(x).trim())).filter(Boolean)
          : [];

        const derived = new Set<string>();
        const cleanFillers: string[] = [];
        for (const t of rawFillers) {
          if (isStillDirty(t)) continue;
          for (const k of detectStructuresU(t)) derived.add(k);
          if (hasTopLevelSign(t)) continue;
          cleanFillers.push(t);
        }
        // Leading-"+" normalisation (matches floating mode behaviour).
        const normFillers: string[] = [];
        let seenContent = false;
        for (const t of cleanFillers) {
          if (t === "=" || t === "±") {
            normFillers.push(t);
            seenContent = false;
            continue;
          }
          const prev = normFillers.length > 0 ? normFillers[normFillers.length - 1] : "";
          const afterSplitter = prev === "=" || prev === "±";
          if ((!seenContent || afterSplitter) && t[0] === "+") {
            normFillers.push(t.slice(1));
          } else {
            normFillers.push(t);
          }
          seenContent = true;
        }
        const rawContainers: string[] = Array.isArray(raw?.containers)
          ? raw.containers.map((x: any) => String(x).toLowerCase().trim()).filter((x: string) => allowed.has(x))
          : [];
        for (const k of detectStructuresU(equation)) derived.add(k);
        const seen = new Set<string>();
        const containers: string[] = [];
        for (const c of [...rawContainers, ...derived]) {
          if (!seen.has(c)) { seen.add(c); containers.push(c); }
        }
        // If the AI produced nothing usable, fall back to one chip per
        // whitespace-separated token from the payload.
        if (normFillers.length === 0) {
          const toks = payload.split(/\s+/).filter(Boolean);
          return { equation, fillers: toks, containers };
        }
        return { equation, fillers: normFillers, containers };
      });

      return new Response(JSON.stringify({ lines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

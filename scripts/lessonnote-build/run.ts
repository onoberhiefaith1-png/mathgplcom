// FULL LESSON NOTE BUILD — driven by the real MathGPL Math Engine.
//
// Same prompt stack the deployed engine uses (pedagogy reference, rendering
// standard, benchmark library, integrity/question-lock, construction standard),
// the same structured output shape, the same client-side verification
// (verify.ts) and the same figure pipeline (construction → compile → verify).
// Every item is one section: question, its figure when the mathematics needs
// one, and its own solution. Nothing ships unverified.
//
//   bun scripts/lessonnote-build/run.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { PEDAGOGY_REFERENCE } from "../../supabase/functions/notebook-ai/pedagogyReference.ts";
import { RENDERING_STANDARD } from "../../supabase/functions/notebook-ai/renderingStandard.ts";
import { BENCHMARK_STANDARD } from "../../supabase/functions/notebook-ai/benchmarkStandard.ts";
import { INTEGRITY_STANDARD } from "../../supabase/functions/notebook-ai/integrityStandard.ts";
import { buildEnginePrompt, parseEngineJson, type EngineOperation } from "../../supabase/functions/notebook-ai/mathEngine.ts";
import { toUnicodeMath } from "../../supabase/functions/notebook-ai/unicodeMath.ts";
import { sanitizePresentation } from "../../supabase/functions/notebook-ai/outputHygiene.ts";
import { verifyQuestion, verificationProblems } from "../../src/lib/mathengine/verify";
import { figureNeeded } from "../../src/lib/lessonnotes/figureNeed";
import { compileConstruction } from "../../src/lib/geometry/construct/compile";
import { verifyScene } from "../../src/lib/geometry/construct/validate";
import { sceneToSvg } from "../geometry-training/render";

const KEY = process.env["LOVABLE_API_KEY"]!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = process.env["ENGINE_MODEL"] ?? "google/gemini-2.5-flash";
const OUT = "/mnt/documents/lesson-notes";

const TOPIC = "Circle Geometry";
const SUBTOPIC = "Tangents to a circle";
const LEVEL = "IGCSE";

interface Item {
  key: string;
  label: string;
  operation: EngineOperation;
  sectionKind: string;
  instruction: string;
  demand?: string;
}

const PLAN: Item[] = [
  {
    key: "intro", label: "Introduction", operation: "generateLessonSection", sectionKind: "introduction",
    instruction: "Open the lesson on tangents to a circle: what a tangent is, how it differs from a chord and a secant, and why the point of contact matters. Teaching prose only, no question.",
  },
  {
    key: "explain", label: "Explanation", operation: "generateLessonSection", sectionKind: "explanation",
    instruction: "Teach the tangent results the class will use: a tangent is perpendicular to the radius at the point of contact, the two tangents from an external point are equal, the alternate segment theorem, and the tangent–secant length relationship. State each result and say when it is used. Teaching prose only, no question.",
  },
  { key: "ex1", label: "Example 1", operation: "generateExample", sectionKind: "example", demand: "single-step",
    instruction: "One worked example using the tangent–radius perpendicular property with a right-angled triangle and Pythagoras. The question must refer to a figure." },
  { key: "ex2", label: "Example 2", operation: "generateExample", sectionKind: "example", demand: "multi-step",
    instruction: "One worked example using the two equal tangents from an external point, leading to an isosceles triangle and an angle calculation. The question must refer to a figure." },
  { key: "ex3", label: "Example 3", operation: "generateExample", sectionKind: "example", demand: "method-choice",
    instruction: "One worked example using the alternate segment theorem combined with the angle sum of a triangle. The question must refer to a figure. Before you commit to the given angles, check that every triangle in your figure sums to 180° and that the alternate segment pairing holds — the solution must never have to argue with the data you gave." },

  ...[1, 2, 3, 4].map((n) => ({
    key: `cw${n}`, label: `Classwork ${n}`, operation: "generateClasswork" as EngineOperation, sectionKind: "classwork",
    demand: n <= 2 ? "single-step" : "multi-step",
    instruction: `Classwork question ${n} of 4 on tangents to a circle. Each of the four must use a different tangent result (tangent–radius perpendicular, equal tangents from an external point, alternate segment theorem, tangent length with Pythagoras). This one is number ${n}. The question must refer to a lettered figure.`,
  })),
  ...[1, 2, 3, 4, 5].map((n) => ({
    key: `as${n}`, label: `Assignment ${n}`, operation: "generateAssignment" as EngineOperation, sectionKind: "assignment",
    demand: n >= 4 ? "reverse" : "multi-step",
    instruction: `Assignment question ${n} of 5 on tangents to a circle, harder than the classwork by reasoning demand (more steps, combined results, or working backwards) — never by bigger numbers. This one is number ${n}. The question must refer to a lettered figure.`,
  })),
];

const VALIDATION_DIRECTIVE = `
You are operating inside the MathGPL Pre-Publication Validation Engine.
The output you produce is a HIDDEN DRAFT, validated against the Mathematical
Rendering Standard, the Structural Rendering Standard and Benchmark Library
01–10 before a teacher ever sees it. No mathematical content is exempt: the
question must be as clean as the solution. Never write slash fractions, raw
LaTeX operators, programming syntax or markdown. Use \\frac{a}{b}, \\sqrt{...},
x^{n}, x_{n} and Unicode operators (× ÷ ± ≤ ≥ ≠ ≈ → ∞ π θ).

${INTEGRITY_STANDARD}
`.trim();

interface EngineQuestionLike {
  text: string; solutionSteps: string[]; finalAnswer: string;
  diagramRequired?: boolean; labels?: string[]; claim?: any;
  givens?: any[]; target?: string; method?: string; demand?: any;
}

// The engine's own lenient reader: model replies carry \frac and \sqrt, which
// strict JSON.parse rejects as bad escapes.
const parseJson = (raw: string): any | null => parseEngineJson(raw) ?? null;


async function callEngine(args: {
  operation: EngineOperation; instruction?: string; question?: string;
  sectionKind?: string; demand?: string; count?: number; previousProblems?: string[];
}): Promise<any> {
  const prompt = [
    VALIDATION_DIRECTIVE,
    PEDAGOGY_REFERENCE,
    RENDERING_STANDARD,
    BENCHMARK_STANDARD,
    buildEnginePrompt({
      operation: args.operation,
      instruction: args.instruction,
      question: args.question,
      sectionKind: args.sectionKind,
      topic: TOPIC,
      subtopic: SUBTOPIC,
      level: LEVEL,
      demand: args.demand,
      count: args.count,
      previousProblems: args.previousProblems,
    }),
  ].join("\n\n");

  for (let tokens = 8000; tokens <= 16000; tokens *= 2) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: tokens,
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json: any = await res.json();
    const choice = json.choices?.[0];
    const out = choice?.message?.content ?? "";
    if (choice?.finish_reason === "length" && tokens < 16000) continue;
    const parsed = parseJson(out);
    if (!parsed) {
      writeFileSync(`/tmp/engine-unreadable-${Date.now()}.txt`, out);
      console.log(`  ↳ unreadable reply (${out.length} chars, finish=${choice?.finish_reason})`);
      throw new Error("the engine reply was unreadable");
    }


    if (Array.isArray(parsed.questions)) {
      parsed.questions = parsed.questions.map((q: any) => ({
        ...q,
        text: sanitizePresentation(toUnicodeMath(String(q?.text ?? ""))),
        solutionSteps: (Array.isArray(q?.solutionSteps) ? q.solutionSteps : [])
          .map((s: any) => sanitizePresentation(toUnicodeMath(String(s)))),
        finalAnswer: sanitizePresentation(toUnicodeMath(String(q?.finalAnswer ?? ""))),
      }));
    }
    return parsed;
  }
  throw new Error("the engine reply never completed");
}

/** A figure is CONSTRUCTED, solved exactly and verified — never painted. */
async function drawFigure(question: string, labels: string[]): Promise<{ svg?: string; problems: string[] }> {
  let problems: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    let payload: any;
    try {
      payload = await callEngine({
        operation: "generateGeometry",
        question,
        instruction: `Construct the figure this question refers to. Letter exactly the points the question names${labels.length ? ` (${labels.join(", ")})` : ""} and hide every helper point.`,
        previousProblems: problems,
      });
    } catch (e: any) {
      // A failed drawing call is a rejected attempt, not a failed figure.
      problems = [String(e?.message ?? e)];
      continue;
    }

    if (!payload?.construction) { problems = ["No construction program was returned."]; continue; }
    const { scene, problems: built } = compileConstruction(payload.construction as any);
    if (!scene) { problems = built.map((p: any) => p.message ?? String(p)); continue; }
    const verdict = verifyScene(scene, question);
    if (verdict.ok) return { svg: sceneToSvg(scene), problems: [] };
    problems = verdict.problems;
    if (process.env["FIGURE_DEBUG"]) {
      writeFileSync(`/tmp/figure-reject-${Date.now()}.json`, JSON.stringify(
        { question, problems, construction: payload.construction, points: (scene as any).objects.filter((o: any) => o.type === "point") }, null, 2));
    }

  }
  return { problems };
}

import { repairMangledMacros } from "../../src/lib/lessonnotes/macroRepair";

/* ── presentation: board-style math without a LaTeX runtime ─────────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mathHtml(raw: string): string {
  // JSON transport mangles "\\frac" into a control character plus "rac", so the
  // macro names are restored before anything is rendered.
  let s = esc(repairMangledMacros(String(raw ?? "")));
  const pass = (re: RegExp, fn: (...m: string[]) => string) => {
    for (let i = 0; i < 6; i++) {
      const next = s.replace(re, (...m) => fn(...(m as string[])));
      if (next === s) break;
      s = next;
    }
  };
  // A model sometimes writes \frac140°2 for \frac{140°}{2}; a bare macro must
  // still stack, never print as the word "frac".
  pass(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_a, n, d) =>
    `<span class="fr"><span class="nu">${n}</span><span class="de">${d}</span></span>`);
  pass(/\\frac\s*([0-9]+°?|[A-Za-z]|\{[^{}]*\})\s*([0-9]+°?|[A-Za-z]|\{[^{}]*\})/g, (_a, n, d) => {
    const bare = (x: string) => x.replace(/^\{|\}$/g, "");
    return `<span class="fr"><span class="nu">${bare(n)}</span><span class="de">${bare(d)}</span></span>`;
  });

  pass(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, (_a, n, x) => `<span class="rt"><sup>${n}</sup>√<span class="rd">${x}</span></span>`);
  pass(/\\sqrt\{([^{}]*)\}/g, (_a, x) => `<span class="rt">√<span class="rd">${x}</span></span>`);
  pass(/\^\{([^{}]*)\}/g, (_a, x) => `<sup>${x}</sup>`);
  pass(/_\{([^{}]*)\}/g, (_a, x) => `<sub>${x}</sub>`);
  s = s.replace(/\\square/g, "□").replace(/\\degree/g, "°").replace(/\\/g, "");
  return s;
}

interface Built {
  item: Item;
  narration: string;
  prose: string[];
  question?: EngineQuestionLike;
  svg?: string;
  figureProblems: string[];
  verified: boolean;
  problems: string[];
}

async function buildItem(item: Item): Promise<Built> {
  let problems: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    let payload: any;
    try {
      payload = await callEngine({
        operation: item.operation,
        instruction: item.instruction,
        sectionKind: item.sectionKind,
        demand: item.demand,
        count: item.operation === "generateLessonSection" ? undefined : 1,
        previousProblems: problems,
      });
    } catch (e: any) {
      // An unreadable or failed reply is a rejected attempt, not the end of the
      // item — ask again with the problem stated.
      problems = [String(e?.message ?? e)];
      continue;
    }

    const narration = String(payload?.narration ?? "").trim();
    const q: EngineQuestionLike | undefined = payload?.questions?.[0];

    if (item.operation === "generateLessonSection") {
      // The teaching prose itself lives in solutionSteps. A one-line summary of
      // the section is not the section, so it is a rejected attempt.
      const prose = [
        ...(q?.solutionSteps ?? []),
        ...(!(q?.solutionSteps ?? []).length && q?.text ? [q.text] : []),
      ].map((s: any) => String(s).trim()).filter(Boolean);

      if (prose.length < 4) {
        problems = ["The section came back as a one-line summary. Write the teaching prose itself in questions[0].solutionSteps — at least four classroom lines the teacher would write on the board."];
        continue;
      }
      return { item, narration, prose, figureProblems: [], verified: true, problems: [] };
    }


    if (!q?.text?.trim()) { problems = ["No question was produced."]; continue; }
    if (!(q.solutionSteps ?? []).length) { problems = ["The question came back with no solution."]; continue; }

    const v = verifyQuestion(q as any, {});
    if (!v.ok) { problems = verificationProblems(v); continue; }

    let svg: string | undefined;
    let figureProblems: string[] = [];
    if (figureNeeded(q.text, q.diagramRequired)) {
      const drawn = await drawFigure(q.text, (q.labels ?? []).map(String));
      svg = drawn.svg;
      figureProblems = drawn.problems;
      if (!svg) { problems = [`The figure this question needs could not be drawn: ${figureProblems[0] ?? "unknown"}`]; continue; }
    }
    return { item, narration, prose: [], question: q, svg, figureProblems, verified: true, problems: [] };
  }
  return { item, narration: "", prose: [], figureProblems: [], verified: false, problems };
}

function pageHtml(built: Built[]): string {
  const body = built.map((b) => {
    const head = `<h2>${esc(b.item.label)}</h2>`;
    if (!b.verified) {
      return `${head}<p class="fail">This item could not be produced to standard: ${esc(b.problems[0] ?? "")}</p>`;
    }
    if (b.prose.length) {
      return `${head}${b.prose.map((p) => `<p>${mathHtml(p)}</p>`).join("")}`;
    }
    const q = b.question!;
    return [
      head,
      `<p class="q">${mathHtml(q.text)}</p>`,
      b.svg ? `<figure>${b.svg}</figure>` : "",
      `<h3>Solution</h3>`,
      `<div class="sol">${q.solutionSteps.map((s) => `<p>${mathHtml(s)}</p>`).join("")}</div>`,
      q.finalAnswer ? `<p class="ans">${mathHtml(q.finalAnswer)}</p>` : "",
    ].join("");
  }).join("\n");

  return `<!doctype html><meta charset="utf-8"><title>${TOPIC} — ${SUBTOPIC}</title>
<style>
 body{font:16px/1.6 Georgia,serif;color:#111;max-width:820px;margin:32px auto;padding:0 20px}
 h1{font-size:26px;margin-bottom:2px} .sub{color:#555;margin-top:0}
 h2{font-size:20px;margin:28px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
 h3{font-size:16px;margin:14px 0 4px;color:#1a3f7a}
 p{margin:4px 0} .q{font-weight:600}
 .sol p{margin-left:14px} .ans{margin-left:14px;font-weight:600}
 figure{margin:10px 0 14px} svg{max-width:100%;height:auto}
 .fail{color:#a11}
 .fr{display:inline-block;vertical-align:middle;text-align:center;margin:0 3px;line-height:1.15}
 .fr .nu{display:block;border-bottom:1.4px solid currentColor;padding:0 4px}
 .fr .de{display:block;padding:0 4px}
 .rt .rd{border-top:1.4px solid currentColor;padding:0 2px}
</style>
<h1>${TOPIC}</h1><p class="sub">${SUBTOPIC} — ${LEVEL}</p>
${body}`;
}

const built: Built[] = [];
for (const item of PLAN) {
  const t0 = Date.now();
  try {
    const res = await buildItem(item);
    built.push(res);
    const fig = res.svg ? " + figure" : "";
    console.log(`${res.verified ? "✓" : "✗"} ${item.label}${fig} (${((Date.now() - t0) / 1000).toFixed(1)}s)${res.verified ? "" : ` — ${res.problems[0]}`}`);
  } catch (e: any) {
    built.push({ item, narration: "", prose: [], figureProblems: [], verified: false, problems: [String(e?.message ?? e)] });
    console.log(`✗ ${item.label} — ${String(e?.message ?? e).slice(0, 160)}`);
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/circle-geometry-tangents.html`, pageHtml(built));
const okCount = built.filter((b) => b.verified).length;
const figs = built.filter((b) => b.svg).length;
console.log(`\n${okCount}/${built.length} items verified · ${figs} figures constructed and verified`);

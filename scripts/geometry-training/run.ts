// GEOMETRY DRAWING TRAINING HARNESS
//
// Asks the real Engine to draw every figure in the drawing bank, compiles each
// construction exactly, verifies the finished figure, renders it to SVG and
// writes one contact sheet. Failures are visible, not theoretical.
//
//   bun scripts/geometry-training/run.ts [--round 1] [--only circle] [--limit 8]

import { mkdirSync, writeFileSync } from "node:fs";
import { CONSTRUCTION_STANDARD } from "../../supabase/functions/notebook-ai/constructionStandard.ts";
import { DRAWING_BANK, type DrawingCase } from "../../src/lib/geometry/__tests__/drawingBank";
import { compileConstruction } from "../../src/lib/geometry/construct/compile";
import { verifyScene } from "../../src/lib/geometry/construct/validate";
import { sceneToSvg } from "./render";

const KEY = process.env["LOVABLE_API_KEY"]!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = process.env["GEO_MODEL"] ?? "google/gemini-2.5-flash";

const args = process.argv.slice(2);
const arg = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const round = arg("round") ?? "1";
const only = arg("only");
const limit = Number(arg("limit") ?? "999");
const outDir = `/mnt/documents/geometry-training`;

const SYSTEM = `You are the MathGPL Math Engine drawing a classroom geometry figure.

${CONSTRUCTION_STANDARD}

Return STRICT JSON only, no prose and no code fences:
{"figure":"one-line description","steps":[ ...construction steps... ],"hide":["helper ids"]}`;

interface Result {
  c: DrawingCase;
  ok: boolean;
  problems: string[];
  svg?: string;
  program?: unknown;
}

function parseProgram(raw: string): any | null {
  let s = raw.trim().replace(/^```[a-zA-Z]*\s*/g, "").replace(/```$/g, "").trim();
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) { s = s.slice(start, i + 1); break; }
  }
  try {
    const obj = JSON.parse(s);
    return obj?.construction ?? obj;
  } catch { return null; }
}

async function drawOnce(c: DrawingCase, previous: string[]): Promise<Result> {
  const user = `QUESTION (verbatim, immutable):
"""${c.question}"""

Draw the figure this question needs. Letter exactly the points the question names${c.requires?.length ? ` (${c.requires.join(", ")})` : ""} and hide every helper point. Output the construction program as STRICT JSON.${previous.length ? `

YOUR PREVIOUS ATTEMPT WAS REJECTED BY THE DIAGRAM VERIFIER:
${previous.slice(0, 6).map((p) => `• ${p}`).join("\n")}
Fix the construction itself — construct every id before you use it, and do not
restate the same program with different names.` : ""}`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": KEY, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    }),
  });
  if (!res.ok) return { c, ok: false, problems: [`gateway ${res.status}: ${(await res.text()).slice(0, 200)}`] };
  const json: any = await res.json();
  const program = parseProgram(json?.choices?.[0]?.message?.content ?? "");
  if (!program || !Array.isArray(program.steps)) {
    return { c, ok: false, problems: ["the Engine did not return a readable construction program"] };
  }

  const { scene, problems: cp } = compileConstruction(program);
  const compileProblems = cp.map((p) => `step ${p.step}: ${p.message}`);
  if (!scene) return { c, ok: false, problems: compileProblems.length ? compileProblems : ["nothing was constructed"], program };

  const verdict = verifyScene(scene, c.question);
  const missing = (c.requires ?? []).filter(
    (l) => !scene.objects.some((o) => o.type === "point" && (o as any).label === l),
  );
  const problems = [
    ...compileProblems,
    ...verdict.problems,
    ...(missing.length ? [`the figure does not label ${missing.join(", ")}`] : []),
  ];
  return { c, ok: problems.length === 0, problems, svg: sceneToSvg(scene), program };
}

/** Two attempts, exactly as the production pipeline retries with the problems. */
async function draw(c: DrawingCase): Promise<Result> {
  let last = await drawOnce(c, []);
  const seen: string[] = [];
  for (let attempt = 0; attempt < 2 && !last.ok; attempt++) {
    seen.push(...last.problems);
    const next = await drawOnce(c, [...new Set(seen)]);
    last = next.ok ? next : { ...next, problems: [...new Set([...seen, ...next.problems])].slice(0, 5) };
  }
  return last;
}

const bank = DRAWING_BANK
  .filter((c) => !only || c.family.includes(only) || c.id.includes(only))
  .slice(0, limit);

const results: Result[] = [];
for (let i = 0; i < bank.length; i += 6) {
  const batch = bank.slice(i, i + 6);
  const settled = await Promise.all(batch.map(async (c) => {
    try { return await draw(c); }
    catch (e) { return { c, ok: false, problems: [String((e as Error)?.message ?? e)] } as Result; }
  }));
  results.push(...settled);
  for (const r of settled) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.c.id.padEnd(26)} ${r.problems[0] ?? ""}`);
}

const pass = results.filter((r) => r.ok).length;
console.log(`\nROUND ${round}: ${pass}/${results.length} clean (${Math.round((pass / results.length) * 100)}%)`);

const byFamily = new Map<string, { pass: number; total: number }>();
for (const r of results) {
  const e = byFamily.get(r.c.family) ?? { pass: 0, total: 0 };
  e.total++; if (r.ok) e.pass++;
  byFamily.set(r.c.family, e);
}
for (const [f, e] of byFamily) console.log(`  ${f.padEnd(26)} ${e.pass}/${e.total}`);

mkdirSync(outDir, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><title>Geometry drawing — round ${round}</title>
<style>body{font:14px system-ui;background:#f8fafc;color:#0f172a;margin:24px}
h1{font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
.card svg{width:100%;height:auto;border:1px solid #f1f5f9;border-radius:6px}
.q{font-size:12px;color:#334155;margin:8px 0 4px}.bad{color:#b91c1c;font-size:12px}
.tag{font-size:11px;color:#64748b}</style>
<h1>Geometry drawing — round ${round} · ${pass}/${results.length} clean</h1>
<p>${[...byFamily].map(([f, e]) => `${f}: <b>${e.pass}/${e.total}</b>`).join(" · ")}</p>
<div class=grid>
${results.map((r) => `<div class=card>
<div class=tag>${r.c.id} · ${r.c.family} · ${r.ok ? "clean" : "rejected"}</div>
${r.svg ?? "<p class=bad>no figure</p>"}
<div class=q>${r.c.question.replace(/</g, "&lt;")}</div>
${r.problems.map((p) => `<div class=bad>• ${p.replace(/</g, "&lt;")}</div>`).join("")}
</div>`).join("\n")}
</div>`;
writeFileSync(`${outDir}/round-${round}.html`, html);
writeFileSync(`${outDir}/round-${round}.json`, JSON.stringify(
  results.map((r) => ({ id: r.c.id, family: r.c.family, ok: r.ok, problems: r.problems, program: r.program })), null, 2));
console.log(`\ncontact sheet: ${outDir}/round-${round}.html`);

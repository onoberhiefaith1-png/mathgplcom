// Engine Knowledge — the generation engine documents its own reasoning.
//
// Two document kinds live in floating_knowledge_documents:
//   • engine_principle        — static primers describing how the engine
//                               actually decides things (sign detection,
//                               fraction protection, bracket scanning, …).
//   • engine_generation_log   — one row per successful generation, written
//                               automatically. Contains the input expression,
//                               the produced structure, the laws/principles
//                               applied, the validation result, a confidence
//                               score, and a human-readable explanation.
//
// The Floating Number AI reads both kinds on every turn, so the generator
// effectively teaches the assistant in a continuous feedback loop.

export const ENGINE_PRINCIPLE_KIND = "engine_principle";
export const ENGINE_GENERATION_LOG_KIND = "engine_generation_log";

export interface EnginePrinciple {
  slug: string;
  title: string;
  body: string;
}

export const ENGINE_PRINCIPLES: EnginePrinciple[] = [
  {
    slug: "sign-detection",
    title: "Engine Knowledge 1 — How arithmetic signs are detected",
    body:
`The generation engine scans the expression from left to right, one character
at a time, classifying each glyph as a digit, a variable, an operator, a
bracket, or a fraction bar.

When a sign character ('+' or '-') is encountered, the engine looks at the
next non-space character to decide what the sign attaches to:

  • If the next character starts a numeric or symbolic term, the sign is
    bonded to that term (e.g. "+5x", "-4y") and travels with it as a single
    filler.
  • If the next character is a bracket, the sign attaches to the bracket and
    is preserved when the bracket is expanded.
  • A sign at the very start of the expression is bonded to the first term.

The engine never leaves a bare sign chip floating on its own — every sign
ends up inside the filler whose value it modifies. This is the rule the
Floating Number AI should cite when explaining why "-3y" is one chip rather
than "-" and "3y".`,
  },
  {
    slug: "fraction-protection",
    title: "Engine Knowledge 2 — How fractions are protected",
    body:
`Fractions are treated as ATOMIC units. The engine recognises a fraction by
either a "\\frac{...}{...}" macro or a slash between two contiguous tokens
that are not separated by operators.

Once a fraction is detected the engine:

  1. Locks the numerator and denominator together as a single filler.
  2. Forbids any inner sign or operator from being extracted as a separate
     chip — "(a+b)/c" stays as one filler, not three.
  3. Carries the surrounding sign in the same way as a normal term.

This is why fractions never split across containers and why their internal
'+' or '-' is never confused with the expression-level sign-detection
rule.`,
  },
  {
    slug: "bracket-scanning",
    title: "Engine Knowledge 3 — How brackets are scanned",
    body:
`Brackets (round, square, curly) define a temporary inner scope. When the
engine meets an opening bracket it pushes a depth counter and continues
scanning until the matching closing bracket.

While inside a bracket:

  • Sign detection still applies, but signs attach to terms within the
    bracket, not to the bracket's exterior.
  • The bracket and its contents are treated as a single filler when the
    surrounding expression is broken into containers.
  • A coefficient touching the opening bracket (e.g. "3(x+1)") is absorbed
    into the same filler.

If brackets are unbalanced the engine refuses to emit a structure and
returns a validation failure rather than guessing.`,
  },
  {
    slug: "container-boundaries",
    title: "Engine Knowledge 4 — How container boundaries are generated",
    body:
`A container is the visual region that holds related fillers on the same
side of an equation or expression. The engine creates container boundaries
using these rules:

  • An '=' sign always opens a new container on each side.
  • A top-level '+' or '-' (outside any bracket or fraction) opens a new
    container for the term that follows.
  • Brackets, fractions, and signed terms never split a container —
    they belong to whichever container their root sign opens.

The number of containers therefore equals the number of top-level terms on
each side of the expression. "3x² + 5x + 1" produces three containers on
its single side; "2x + 1 = 7" produces two on the left and one on the
right.`,
  },
  {
    slug: "arrangement-ordering",
    title: "Engine Knowledge 5 — How arrangement order is produced",
    body:
`The arrangement array records the left-to-right reading order of the
fillers as they appear in the original expression. The engine never
reorders fillers for visual reasons — the arrangement always mirrors the
teacher's writing.

When fillers are added later via assistant tools, the engine inserts the
new filler at the position requested and shifts the arrangement indices to
keep the reading order continuous. The arrangement is the single source of
truth for how the floating number should be read aloud.`,
  },
  {
    slug: "validation-contract",
    title: "Engine Knowledge 6 — The validation contract",
    body:
`No floating-number structure is emitted unless it passes the verifier:

  • Coverage check — every element of the original expression must appear
    in exactly one filler. Missing elements fail the line.
  • Reconstruction check — concatenating the fillers back together must
    canonically equal the original expression.
  • Container check — the number of containers must match the number of
    top-level terms on each side of '='.

If any check fails the engine logs the failure but does not silently fix
it. The teacher sees the original line and the Floating Number AI may then
be asked to propose a correction.`,
  },
];

interface MaybeClient {
  from: (table: string) => any;
}

/** Insert the seed engine_principle docs for this owner if they don't exist
 *  yet. Idempotent on (owner_id, kind, filename). Best-effort. */
export async function ensureEnginePrinciples(
  client: MaybeClient,
  ownerId: string,
): Promise<void> {
  try {
    const { data: existing } = await client
      .from("floating_knowledge_documents")
      .select("filename")
      .eq("owner_id", ownerId)
      .eq("kind", ENGINE_PRINCIPLE_KIND);
    const have = new Set(((existing as any[]) ?? []).map((r) => r.filename));
    const missing = ENGINE_PRINCIPLES.filter((p) => !have.has(`${p.title}.md`));
    if (missing.length === 0) return;
    await client.from("floating_knowledge_documents").insert(
      missing.map((p) => ({
        owner_id: ownerId,
        kind: ENGINE_PRINCIPLE_KIND,
        filename: `${p.title}.md`,
        parsed_text: p.body,
        metadata: { slug: p.slug, source: "engine_seed_v1" },
      })),
    );
  } catch (e) {
    console.warn("[engineKnowledge] ensureEnginePrinciples failed (non-fatal):", e);
  }
}

export interface GenerationLogPayload {
  input_expression: string;
  generated_structure: {
    fillers: string[];
    containers: string[];
    arrangement?: number[];
  };
  applied_principles: string[];          // principle slugs the engine used
  applied_laws?: { number?: number; name?: string }[];
  generation_reasoning: string;
  validation_reasoning: string;
  confidence_score: number;              // 0..1
  rejected_alternatives?: string[];
  context?: { subject?: string; subtopic?: string; sectionKind?: string };
}

const renderLogText = (p: GenerationLogPayload): string => {
  const out: string[] = [];
  out.push(`# Generation Log — ${p.input_expression}`);
  out.push("");
  out.push("## Input Expression");
  out.push(p.input_expression);
  out.push("");
  out.push("## Generated Structure");
  p.generated_structure.fillers.forEach((f, i) => out.push(`  [${i}] ${f}`));
  if (p.generated_structure.containers.length) {
    out.push("");
    out.push("## Containers");
    out.push(p.generated_structure.containers.join("  |  "));
  }
  if (p.applied_laws?.length) {
    out.push("");
    out.push("## Applied Laws");
    p.applied_laws.forEach((l) =>
      out.push(`- LAW#${l.number ?? "?"} ${l.name ?? ""}`.trim()),
    );
  }
  if (p.applied_principles.length) {
    out.push("");
    out.push("## Engine Principles Used");
    p.applied_principles.forEach((s) => out.push(`- ${s}`));
  }
  out.push("");
  out.push("## Generation Reasoning");
  out.push(p.generation_reasoning);
  out.push("");
  out.push("## Validation Reasoning");
  out.push(p.validation_reasoning);
  out.push("");
  out.push(`## Confidence Score: ${(p.confidence_score * 100).toFixed(0)}%`);
  if (p.rejected_alternatives?.length) {
    out.push("");
    out.push("## Rejected Alternatives");
    p.rejected_alternatives.forEach((a) => out.push(`- ${a}`));
  }
  return out.join("\n");
};

export async function writeGenerationLog(
  client: MaybeClient,
  ownerId: string,
  payload: GenerationLogPayload,
): Promise<void> {
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    const safeExpr = payload.input_expression.replace(/\s+/g, " ").trim().slice(0, 80);
    await client.from("floating_knowledge_documents").insert({
      owner_id: ownerId,
      kind: ENGINE_GENERATION_LOG_KIND,
      filename: `Generation Log — ${safeExpr} — ${stamp}.md`,
      parsed_text: renderLogText(payload),
      metadata: payload,
    });
  } catch (e) {
    console.warn("[engineKnowledge] writeGenerationLog failed (non-fatal):", e);
  }
}

/** Infer which engine principles were used for a single line. Cheap
 *  heuristic over the raw expression so we don't depend on private
 *  internals of the extractor. */
export function inferAppliedPrinciples(expression: string): string[] {
  const used: string[] = [];
  if (/[+\-−]/.test(expression)) used.push("sign-detection");
  if (/\\frac|\//.test(expression)) used.push("fraction-protection");
  if (/[\(\)\[\]\{\}]/.test(expression)) used.push("bracket-scanning");
  used.push("container-boundaries");
  used.push("arrangement-ordering");
  used.push("validation-contract");
  return used;
}

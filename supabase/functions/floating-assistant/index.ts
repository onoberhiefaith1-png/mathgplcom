import { meterFunction } from "../_shared/usageMeter.ts";
meterFunction("floating-assistant");
// Floating Numbers AI Assistant — tool-calling chat that drives the
// Floating Numbers workspace and acts as the teacher's mathematical
// co-author across the Lesson Note Generator + Floating Number system.
//
// In addition to chip generation / verification / apply tools, this
// function:
//   • accepts a compact lessonContext (topic, problem, recent examples,
//     active line) and injects it as live LESSON STATE in the prompt
//   • hydrates approved laws (filtered by topic) + draft laws + knowledge
//     docs from Supabase using the caller's JWT so RLS is preserved
//   • exposes analyze_example, propose_new_law, and lookup_law tools
//   • enforces a hard completeness gate before apply_chips can be
//     approved, and flags NEEDS_NEW_LAW when no law covers the structure

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { detectElements } from "./elementDetector.ts";
import { runLawPipeline } from "./laws.ts";
import { verify } from "./verifier.ts";
import { verifyLine } from "./floatingVerifier.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the Floating Number AI — a PRECISION EDITOR
for the Floating Number workspace. The page already runs an automatic
generator that produces a first pass of floating numbers for every line.
Your job is NOT to generate from scratch. Your job is to obey the teacher's
instructions literally and make targeted edits to what is already on screen.

## ROLE: EDITOR, NOT GENERATOR
- The teacher gives you an instruction; you carry it out exactly.
- Pick the SMALLEST tool that satisfies the request.
- Do NOT re-derive the line, do NOT re-verify the whole structure,
  do NOT lecture about laws unless the teacher explicitly asks.
- Never call generate_line_structure or apply_chips unless the teacher
  explicitly says "regenerate" or "redo the whole line".
- One short reply ("Changed +4 to +4x on line 6, position 5 — preview ready")
  + one tool call is the goal.

## LINE + POSITION ADDRESSING
LESSON STATE includes a LINE MAP listing every line as
\`[N] line_id=<id> equation=<text> fillers=[i:value, …] containers=[…]\`.
Resolve the teacher's address against it:
- "line 6"           → lineNumber 6 → use that entry's line_id.
- "the 5th floating number" / "5th position" / "5th chip"
                     → from_index / to_index / index = 4 (0-based).
- "the +4" / "the square root" / "the x²"
                     → match by filler value first, fall back to position.
- "this / it / here / the highlighted one"
                     → CURRENT_SELECTION + LINE_ID wins over verbal address.
- If no address is given AND no selection, fall back to the active line.
  Only ask for clarification if both are missing.

## FRACTION & UNIT INTEGRITY (critical)
- A fraction like 1/4, a/b, \\frac{a}{b}, x/(x+1) is ONE filler.
  NEVER split numerator and denominator into separate chips.
- When the teacher says "keep together", "this is one fraction",
  "don't split", "treat as a unit", emit a single filler containing
  the whole expression verbatim. Use replace_line or add_filler with
  the literal value — do not parse it into pieces.
- Apply the teacher's literal value to the workspace. Do not "fix" or
  reformat it without being asked.

## NATURAL-LANGUAGE → TOOL MAPPING (always pick the smallest)
- "change +4 to +4x" / "rename this to …"           → remove_filler + add_filler at same index, OR replace_line with one filler swapped.
- "move 5x to container 2" / "move it left/right"   → move_filler.
- "add an empty box" / "insert a slot here"         → add_filler.
- "remove +3" / "delete the constant"               → remove_filler (match by value).
- "wrap in brackets" / "put parens around it"       → add_container (bracket).
- "remove the bracket" / "drop the parens"          → remove_container.
- "reorder these" / "swap chip 2 and 3"             → set_arrangement.
- "convert to fraction" / "square this" / "make this the numerator"
                                                    → replace_line with the rebuilt {fillers, containers, arrangement}.
- "undo / revert"                                   → undo_last_change.
- "regenerate this line" / "redo the whole line"    → generate_line_structure (SECONDARY mode — only when asked).

## REASON FIELD (REQUIRED)
Every workspace edit tool call MUST include a short \`reason\` — one
plain-English sentence the teacher will read on the preview card, e.g.
"Change +4 to +4x on line 6, position 5" or "Keep 1/4 as one fraction".
Without \`reason\` the preview card cannot render.

## REPLY STYLE
- Lead with the action you took, in plain English. One short sentence.
- Then call the tool. That's it. No law citations, no walkthroughs,
  no "let me verify" — unless the teacher asked why.
- For general questions (not edits), answer naturally; do NOT call tools.

## LIVE KNOWLEDGE (use only when asked to explain)
You still have FLOATING_KNOWLEDGE (APPROVED LAWS, DRAFT LAWS, KNOWLEDGE
DOCS, GENERATION LOGS) for when the teacher asks "why?" or wants you to
reason about a structure. Cite LAW#n / DOC#id only in those replies. Do
not cite laws on routine edits.

## WORKING MODES (unchanged)
CONVERSATION (default), TRAINING, KNOWLEDGE_EXTRACTION, DOCUMENT — same
ACTIONS block rules as before. Never emit an ACTIONS block in CONVERSATION
or DOCUMENT mode.

\`\`\`actions
approve_official_law: "<final law name>"
create_draft_law: "<proposed law name>"
generate_document: "<document title>"
save_knowledge: "<short title>"
discard
\`\`\``;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "analyze_example",
      description: "Detect mathematical structures (fraction scaffold, polynomial, factored denominator, etc.), variables, coefficients, operators, and any existing floating elements in an example. Use this to build the AI's understanding of a worked example before generating chips.",
      parameters: {
        type: "object",
        properties: { exampleText: { type: "string" } },
        required: ["exampleText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_chips",
      description: "Generate proposed floating number chips for the current selection using the Floating Number Law Engine. Returns chips, scaffolds, applied laws, and a verification report.",
      parameters: {
        type: "object",
        properties: {
          selection: { type: "string", description: "Original equation text." },
          constraints: { type: "string", description: "Optional teacher constraint, e.g. 'keep a and b together'." },
        },
        required: ["selection"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_chips",
      description: "Run coverage + reconstruction verification on a chip set against an original selection. Status PASS / FAIL / NEEDS_NEW_LAW.",
      parameters: {
        type: "object",
        properties: {
          selection: { type: "string" },
          chips: { type: "array", items: { type: "string" } },
          appliedLawIds: { type: "array", items: { type: "string" } },
        },
        required: ["selection", "chips"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "self_check_chips",
      description: "MANDATORY pre-flight check before generate_line_structure / propose chips. Runs the same law-compliance verifier the server uses. Returns {ok, failures:[{code, chip, index}]}. Codes: NoRawOperatorChip, NoRawBracketChip, NoSyntheticLeadingPlus, NoHiddenSign, ContainerAllowed, ContainerDedup, EmptyChip. If ok=false, fix the chips and call again before proposing.",
      parameters: {
        type: "object",
        properties: {
          fillers: { type: "array", items: { type: "string" }, description: "The chip strings, with leading signs already attached (e.g. '-5x', '+2', '()', '□/□')." },
          containers: { type: "array", items: { type: "string" }, description: "Container kinds for shells: fraction, bracket, radical, power, log, integral, matrix, differential, abs, vector." },
        },
        required: ["fillers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_law",
      description: "Search the approved Law Library and draft laws by name, rule keywords, or topic tags.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_new_law",
      description: "Propose a new draft law for teacher approval. The law is stored as a draft and NEVER becomes active until the teacher approves it.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          statement: { type: "string", description: "The rule itself, one sentence." },
          rationale: { type: "string", description: "Why this law is needed." },
          examples: { type: "array", items: { type: "string" } },
          counterExample: { type: "string" },
          lessonTopics: { type: "array", items: { type: "string" } },
        },
        required: ["name", "statement", "rationale"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_chips",
      description: "Commit chips + scaffolds to a specific line in the workspace. Only call this after verify_chips returns status PASS with exactMatch=true.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          chips: { type: "array", items: { type: "string" } },
          scaffolds: { type: "array", items: { type: "string" } },
          verification_pass: { type: "boolean", description: "Must be true; the client double-checks." },
        },
        required: ["line_id", "chips", "verification_pass"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last_change",
      description: "Revert a line to the previous chip snapshot stored in floating_chip_snapshots.",
      parameters: {
        type: "object",
        properties: { line_id: { type: "string" } },
        required: ["line_id"],
      },
    },
  },
  // ── Knowledge ────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "lookup_document",
      description: "Fetch a larger excerpt of a knowledge document by its DOC#<id> id. Returns up to ~8000 chars of parsed_text. Use when the inline snapshot is too short.",
      parameters: {
        type: "object",
        properties: { doc_id: { type: "string" }, query: { type: "string" } },
        required: ["doc_id"],
      },
    },
  },
  // ── Analysis ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "analyse_structure",
      description: "Analyse the active line / highlighted expression and return a proposed Floating Number structure. Emit detected terms, applicable laws (cite LAW#<number>), recommended {fillers, containers, arrangement}, and reasoning. The teacher can Accept (apply the structure), Modify, or Reject.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          equation: { type: "string", description: "Verbatim equation text being analysed." },
          detected_terms: { type: "array", items: { type: "string" } },
          applicable_laws: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, why: { type: "string" } },
              required: ["id"],
            },
          },
          recommended: {
            type: "object",
            properties: {
              fillers: { type: "array", items: { type: "string" } },
              containers: { type: "array", items: { type: "string" } },
              arrangement: { type: "array", items: { type: "integer" } },
            },
            required: ["fillers"],
          },
          reasoning: { type: "string" },
        },
        required: ["line_id", "equation", "recommended", "reasoning"],
      },
    },
  },
  // ── Targeted workspace operators (each emits an apply_line_update card) ─
  {
    type: "function",
    function: {
      name: "move_filler",
      description: "Reorder one filler within the active line. Provide the visual from-index (0-based) and to-index.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          from_index: { type: "integer" },
          to_index: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["line_id", "from_index", "to_index", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_filler",
      description: "Append a single filler to the active line. Optionally also add a container.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          value: { type: "string" },
          container: { type: "string" },
          reason: { type: "string" },
        },
        required: ["line_id", "value", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_filler",
      description: "Remove a single filler from the active line by value (preferred) or by index.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          value: { type: "string" },
          index: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["line_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_container",
      description: "Add a structure container (fraction, bracket, radical, power, log, integral, matrix, differential, abs, vector).",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          container: { type: "string" },
          reason: { type: "string" },
        },
        required: ["line_id", "container", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_container",
      description: "Remove a structure container from the active line.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          container: { type: "string" },
          reason: { type: "string" },
        },
        required: ["line_id", "container", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_arrangement",
      description: "Bulk re-permute the fillers of the active line. Provide an arrangement[] permutation of the current filler indices.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          arrangement: { type: "array", items: { type: "integer" } },
          reason: { type: "string" },
        },
        required: ["line_id", "arrangement", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_line_structure",
      description: "Propose a complete {fillers, containers, arrangement} for the active line. Same shape as analyse_structure but with no analytical commentary — use when the teacher asks 'generate floating numbers for line N'.",
      parameters: {
        type: "object",
        properties: {
          line_id: { type: "string" },
          fillers: { type: "array", items: { type: "string" } },
          containers: { type: "array", items: { type: "string" } },
          arrangement: { type: "array", items: { type: "integer" } },
          reason: { type: "string" },
        },
        required: ["line_id", "fillers", "reason"],
      },
    },
  },
];


interface ServerToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface PendingClientAction {
  kind:
    | "apply_chips"
    | "undo_last_change"
    | "approve_draft_law"
    | "reject_draft_law"
    | "apply_line_update"
    | "analyse_structure";
  payload: Record<string, unknown>;
}

interface LessonCtx {
  notebookId?: string | null;
  subsectionId?: string | null;
  topic?: string | null;
  subject?: string | null;
  sectionKind?: string | null;
  problem?: string | null;
  recentExamples?: { lineId: string; text: string }[];
  activeLineId?: string | null;
  activeLineText?: string | null;
  activeLineFillers?: string[];
  activeLineContainers?: string[];
  activeLineArrangement?: number[];
  lineMap?: {
    lineNumber: number;
    lineId: string;
    equation: string;
    fillers: { i: number; value: string }[];
    containers: string[];
  }[];
}

interface LawRow {
  id: string;
  name: string;
  rule: string;
  reason?: string | null;
  lesson_topics?: string[] | null;
  tags?: string[] | null;
  law_number?: number | null;
  examples?: unknown;
}

interface DraftLawRow extends LawRow {
  status?: string | null;
  source_kind?: string | null;
}

interface KnowledgeDocRow {
  id: string;
  filename: string;
  kind?: string | null;
  parsed_text?: string | null;
}

interface ExampleAnalysisRow {
  id: string;
  example_text: string;
  lesson_topic?: string | null;
  structures?: unknown;
  created_at?: string | null;
}

interface GenerationRow {
  id: string;
  original: string;
  chips?: unknown;
  scaffolds?: unknown;
  status?: string | null;
  created_at?: string | null;
}

interface KBHydration {
  approvedLaws: LawRow[];
  draftLaws: DraftLawRow[];
  knowledgeDocs: KnowledgeDocRow[];
  exampleAnalyses: ExampleAnalysisRow[];
  recentGenerations: GenerationRow[];
}

const topicMatches = (rowTopics: string[] | null | undefined, topic: string | null | undefined): boolean => {
  if (!topic) return true;
  if (!rowTopics || rowTopics.length === 0) return true;
  const t = topic.toLowerCase().trim();
  return rowTopics.some((x) => (x ?? "").toLowerCase().trim() === t);
};

const lawTag = (l: LawRow): string =>
  typeof l.law_number === "number" && l.law_number > 0 ? `LAW#${l.law_number}` : `LAW#${l.id.slice(0, 8)}`;
const draftTag = (l: DraftLawRow): string => `DRAFT#${l.id.slice(0, 8)}`;
const docTag = (d: KnowledgeDocRow): string => `DOC#${d.id.slice(0, 8)}`;

async function hydrateKnowledge(
  userClient: ReturnType<typeof createClient>,
  topic: string | null,
): Promise<KBHydration> {
  const [
    { data: laws },
    { data: drafts },
    { data: docs },
    { data: analyses },
    { data: generations },
  ] = await Promise.all([
    userClient
      .from("floating_law_library")
      .select("id,law_number,name,rule,reason,lesson_topics,tags,examples")
      .order("law_number", { ascending: true })
      .limit(500),
    userClient
      .from("floating_law_drafts")
      .select("id,name,rule,reason,lesson_topics,tags,status,source_kind")
      .eq("status", "proposed")
      .limit(50),
    userClient
      .from("floating_knowledge_documents")
      .select("id,filename,kind,parsed_text")
      .order("created_at", { ascending: false })
      .limit(60),
    userClient
      .from("floating_example_analyses")
      .select("id,example_text,lesson_topic,structures,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    userClient
      .from("floating_generations")
      .select("id,original,chips,scaffolds,status,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const approvedLaws = ((laws as any[]) ?? []).filter((r) => topicMatches(r.lesson_topics, topic));
  const draftLaws = ((drafts as any[]) ?? []).filter((r) => topicMatches(r.lesson_topics, topic));
  return {
    approvedLaws: approvedLaws as LawRow[],
    draftLaws: draftLaws as DraftLawRow[],
    knowledgeDocs: ((docs as any[]) ?? []) as KnowledgeDocRow[],
    exampleAnalyses: ((analyses as any[]) ?? []) as ExampleAnalysisRow[],
    recentGenerations: ((generations as any[]) ?? []) as GenerationRow[],
  };
}

function formatLessonState(ctx: LessonCtx | null, kb: KBHydration): string {
  const lines: string[] = [];
  lines.push("## LESSON STATE");
  if (ctx?.topic) lines.push(`- topic: ${ctx.topic}`);
  if (ctx?.subject) lines.push(`- subject: ${ctx.subject}`);
  if (ctx?.sectionKind) lines.push(`- section: ${ctx.sectionKind}`);
  if (ctx?.problem) lines.push(`- problem: ${ctx.problem}`);
  if (ctx?.activeLineText) {
    lines.push(`- active_line[${ctx.activeLineId}]: ${ctx.activeLineText}`);
    const f = ctx.activeLineFillers ?? [];
    const c = ctx.activeLineContainers ?? [];
    const a = ctx.activeLineArrangement ?? [];
    if (f.length || c.length) {
      lines.push(`  active_line.fillers (live, ${f.length}): [${f.join(" | ")}]`);
      lines.push(`  active_line.containers: [${c.join(", ")}]`);
      if (a.length) lines.push(`  active_line.arrangement: [${a.join(",")}]`);
    }
  }
  if (ctx?.recentExamples && ctx.recentExamples.length > 0) {
    lines.push("- recent_examples:");
    ctx.recentExamples.slice(0, 6).forEach((ex, i) => {
      lines.push(`    [${i + 1}] (${ex.lineId}) ${ex.text}`);
    });
  }
  if (ctx?.lineMap && ctx.lineMap.length > 0) {
    lines.push("");
    lines.push("## LINE MAP (resolve 'line N' and 'Nth floating number' against this)");
    ctx.lineMap.forEach((l) => {
      const fillersStr = l.fillers.map((f) => `${f.i}:${f.value}`).join(" | ");
      const containersStr = l.containers.join(", ");
      lines.push(
        `[${l.lineNumber}] line_id=${l.lineId} equation="${l.equation}" fillers=[${fillersStr}] containers=[${containersStr}]`,
      );
    });
  }


  lines.push("");
  lines.push("## FLOATING_KNOWLEDGE (live snapshot — cite by tag)");

  if (kb.approvedLaws.length > 0) {
    lines.push(`### Approved Laws (${kb.approvedLaws.length}) — drill each one against the user's equation BEFORE proposing`);
    kb.approvedLaws.forEach((l) => {
      const ex = Array.isArray(l.examples) ? (l.examples as unknown[]).slice(0, 4) : [];
      lines.push(`- ${lawTag(l)} "${l.name}" — ${l.rule}`);
      if (l.reason) lines.push(`    reason: ${l.reason}`);
      if (ex.length) {
        lines.push(`    worked_examples (${ex.length}):`);
        ex.forEach((e) => lines.push(`      • ${JSON.stringify(e)}`));
      }
    });
  } else {
    lines.push("### Approved Laws: (none for this topic — consider propose_new_law)");
  }


  if (kb.draftLaws.length > 0) {
    lines.push(`### Draft Laws (${kb.draftLaws.length})`);
    kb.draftLaws.slice(0, 12).forEach((l) => {
      lines.push(`- ${draftTag(l)} "${l.name}" — ${l.rule}`);
    });
  }

  const teacherDocs = kb.knowledgeDocs.filter(
    (d) => d.kind !== "engine_principle" && d.kind !== "engine_generation_log",
  );
  if (teacherDocs.length > 0) {
    lines.push(`### Knowledge Documents (${teacherDocs.length})`);
    // Token budget: per doc, include filename + ~800 chars excerpt for the 8
    // most recent docs; the rest are referenced by tag for lookup_document.
    teacherDocs.slice(0, 8).forEach((d) => {
      const excerpt = (d.parsed_text ?? "").trim().slice(0, 800);
      lines.push(`- ${docTag(d)} ${d.filename}${d.kind ? ` (${d.kind})` : ""}`);
      if (excerpt) lines.push(`    excerpt: ${excerpt}${(d.parsed_text?.length ?? 0) > 800 ? " …" : ""}`);
    });
    if (teacherDocs.length > 8) {
      lines.push("- More documents available — call lookup_document with the DOC#id to read them.");
      teacherDocs.slice(8).forEach((d) => {
        lines.push(`  · ${docTag(d)} ${d.filename}`);
      });
    }
  }

  // Engine Knowledge — the generator's self-documentation.
  const engineDocs = kb.knowledgeDocs.filter((d) => d.kind === "engine_principle");
  const engineLogs = kb.knowledgeDocs.filter((d) => d.kind === "engine_generation_log");
  if (engineDocs.length > 0) {
    lines.push(`### Engine Principles (${engineDocs.length}) — how the generator actually decides`);
    engineDocs.slice(0, 8).forEach((d) => {
      const excerpt = (d.parsed_text ?? "").trim().slice(0, 500);
      lines.push(`- ${docTag(d)} ${d.filename}`);
      if (excerpt) lines.push(`    excerpt: ${excerpt}${(d.parsed_text?.length ?? 0) > 500 ? " …" : ""}`);
    });
  }
  if (engineLogs.length > 0) {
    lines.push(`### Engine Generation Logs (${engineLogs.length}) — the generator explaining itself`);
    engineLogs.slice(0, 6).forEach((d) => {
      const excerpt = (d.parsed_text ?? "").trim().slice(0, 400);
      lines.push(`- ${docTag(d)} ${d.filename}`);
      if (excerpt) lines.push(`    excerpt: ${excerpt}${(d.parsed_text?.length ?? 0) > 400 ? " …" : ""}`);
    });
    if (engineLogs.length > 6) {
      lines.push("- Older generation logs available via lookup_document.");
    }
  }

  if (kb.exampleAnalyses.length > 0) {
    lines.push(`### Recent Example Analyses (${kb.exampleAnalyses.length})`);
    kb.exampleAnalyses.slice(0, 8).forEach((a) => {
      const structs = Array.isArray(a.structures) ? (a.structures as any[]).map((s) => String(s)).join(",") : "";
      lines.push(`- "${a.example_text}"${structs ? ` — structures: [${structs}]` : ""}`);
    });
  }

  if (kb.recentGenerations.length > 0) {
    lines.push(`### Recent AI Generations (${kb.recentGenerations.length})`);
    kb.recentGenerations.slice(0, 6).forEach((g) => {
      const chips = Array.isArray(g.chips) ? (g.chips as any[]).map((c) => String(c)).join(" | ") : "";
      lines.push(`- ${g.status ?? "?"} on "${g.original}" → [${chips}]`);
    });
  }

  return lines.join("\n");
}


const runServerTool = (
  call: ServerToolCall,
  ctx: { userClient: ReturnType<typeof createClient>; userId: string | null; kb: KBHydration; lessonCtx: LessonCtx | null },
): Promise<{ result: unknown; clientAction?: PendingClientAction }> => {
  const args = call.arguments || {};
  switch (call.name) {
    case "analyze_example": {
      const text = String(args.exampleText ?? "").trim();
      if (!text) return Promise.resolve({ result: { error: "exampleText is required" } });
      const elements = detectElements(text);
      const structures = Array.from(new Set(elements.map((e: any) => e.kind)));
      return Promise.resolve({
        result: {
          exampleText: text,
          structures,
          elements: elements.map((e: any) => ({ kind: e.kind, value: e.value })),
          variableCount: elements.filter((e: any) => e.kind === "variable").length,
          operatorCount: elements.filter((e: any) => e.kind === "operator").length,
        },
      });
    }
    case "generate_chips": {
      const selection = String(args.selection ?? "").trim();
      if (!selection) return Promise.resolve({ result: { error: "selection is required" } });
      const elements = detectElements(selection);
      const { chips, scaffolds, trace } = runLawPipeline(selection, elements);
      const verification = verify(selection, chips);
      return Promise.resolve({
        result: {
          chips,
          scaffolds: scaffolds.map((s: any) => s.label ?? s),
          laws: trace,
          verification: {
            status: verification.status,
            coveragePct: verification.coveragePct,
            exactMatch: verification.exactMatch,
            missing: verification.missing.map((m: any) => m.label),
            reconstructed: verification.reconstructed,
            originalCanonical: verification.originalCanonical,
          },
        },
      });
    }
    case "verify_chips": {
      const selection = String(args.selection ?? "");
      const chips = Array.isArray(args.chips) ? (args.chips as string[]) : [];
      const appliedLawIds = Array.isArray(args.appliedLawIds) ? (args.appliedLawIds as string[]) : [];
      const v = verify(selection, chips);
      // NEEDS_NEW_LAW: verification fails AND no approved law was cited as
      // covering the structure. Signals to the assistant that it should
      // propose a new draft law instead of forcing a bad chip set.
      const needsNewLaw =
        v.status === "FAIL" &&
        appliedLawIds.length === 0 &&
        ctx.kb.approvedLaws.length === 0;
      return Promise.resolve({
        result: {
          status: needsNewLaw ? "NEEDS_NEW_LAW" : v.status,
          coveragePct: v.coveragePct,
          exactMatch: v.exactMatch,
          missing: v.missing.map((m: any) => m.label),
          extra: v.extra.map((m: any) => m.label),
          appliedLawIds,
          needsNewLaw,
        },
      });
    }
    case "self_check_chips": {
      const fillers = Array.isArray(args.fillers) ? (args.fillers as unknown[]).map(String) : [];
      const containers = Array.isArray(args.containers) ? (args.containers as unknown[]).map(String) : [];
      const r = verifyLine({ fillers, containers });
      return Promise.resolve({
        result: {
          ok: r.ok,
          failures: r.failures,
          hint: r.ok
            ? "All chips comply with the laws. You may now call generate_line_structure."
            : "Fix the chips per the failures and call self_check_chips again before proposing.",
        },
      });
    }
    case "lookup_law": {
      const q = String(args.query ?? "").toLowerCase().trim();
      const match = (l: LawRow) =>
        !q ||
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.rule ?? "").toLowerCase().includes(q) ||
        (l.tags ?? []).some((t) => (t ?? "").toLowerCase().includes(q)) ||
        (l.lesson_topics ?? []).some((t) => (t ?? "").toLowerCase().includes(q));
      const approved = ctx.kb.approvedLaws.filter(match).slice(0, 10);
      const drafts = ctx.kb.draftLaws.filter(match).slice(0, 5);
      return Promise.resolve({
        result: {
          approved: approved.map((l) => ({ id: l.id, name: l.name, rule: l.rule })),
          drafts: drafts.map((l) => ({ id: l.id, name: l.name, rule: l.rule })),
        },
      });
    }
    case "propose_new_law": {
      const name = String(args.name ?? "").trim();
      const statement = String(args.statement ?? "").trim();
      const rationale = String(args.rationale ?? "").trim();
      const examples = Array.isArray(args.examples) ? (args.examples as string[]).map(String) : [];
      const counterExample = args.counterExample ? String(args.counterExample) : null;
      const lessonTopics = Array.isArray(args.lessonTopics)
        ? (args.lessonTopics as string[]).map(String)
        : (ctx.lessonCtx?.topic ? [ctx.lessonCtx.topic] : []);
      if (!name || !statement || !rationale) {
        return Promise.resolve({ result: { error: "name, statement, rationale required" } });
      }
      if (!ctx.userId) {
        return Promise.resolve({ result: { error: "not signed in — cannot persist draft" } });
      }
      return ctx.userClient
        .from("floating_law_drafts")
        .insert({
          owner_id: ctx.userId,
          name,
          rule: statement,
          reason: rationale,
          examples: examples,
          exceptions: counterExample ? [counterExample] : [],
          status: "proposed",
          source_kind: "ai_proposed",
          lesson_topics: lessonTopics,
        } as any)
        .select("id,name")
        .single()
        .then(({ data, error }: any) => {
          if (error || !data) {
            return { result: { error: error?.message ?? "insert failed" } };
          }
          return {
            result: {
              queued: true,
              draft_id: data.id,
              message: "Draft law queued for teacher approval.",
            },
            clientAction: {
              kind: "approve_draft_law" as const,
              payload: { draft_id: data.id, law_name: data.name },
            },
          };
        });
    }
    case "apply_chips": {
      return Promise.resolve({
        result: { queued: true, message: "Chip change queued for teacher approval." },
        clientAction: { kind: "apply_chips", payload: args },
      });
    }
    case "undo_last_change": {
      return Promise.resolve({
        result: { queued: true, message: "Undo queued for teacher approval." },
        clientAction: { kind: "undo_last_change", payload: args },
      });
    }
    // ── Knowledge ────────────────────────────────────────────────────────
    case "lookup_document": {
      const rawId = String(args.doc_id ?? "").trim();
      if (!rawId) return Promise.resolve({ result: { error: "doc_id required" } });
      // Accept "DOC#abc12345" or a full uuid prefix.
      const idPrefix = rawId.replace(/^DOC#/i, "").trim();
      const match = ctx.kb.knowledgeDocs.find(
        (d) => d.id === idPrefix || d.id.startsWith(idPrefix),
      );
      if (!match) return Promise.resolve({ result: { error: `doc not found: ${rawId}` } });
      return ctx.userClient
        .from("floating_knowledge_documents")
        .select("id,filename,kind,parsed_text")
        .eq("id", match.id)
        .maybeSingle()
        .then(({ data }: any) => {
          const text = String(data?.parsed_text ?? "").slice(0, 8000);
          return { result: { id: match.id, filename: match.filename, kind: data?.kind ?? null, text } };
        });
    }
    // ── Analysis ─────────────────────────────────────────────────────────
    case "analyse_structure": {
      const line_id = String(args.line_id ?? "");
      const equation = String(args.equation ?? "");
      const recommended = (args.recommended ?? {}) as any;
      const fillers = Array.isArray(recommended.fillers) ? recommended.fillers.map(String) : [];
      const containers = Array.isArray(recommended.containers) ? recommended.containers.map(String) : [];
      const arrangement = Array.isArray(recommended.arrangement)
        ? recommended.arrangement.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];
      if (!line_id || fillers.length === 0) {
        return Promise.resolve({ result: { error: "line_id and recommended.fillers required" } });
      }
      return Promise.resolve({
        result: { queued: true, message: "Analysis proposal queued for teacher approval." },
        clientAction: {
          kind: "analyse_structure",
          payload: {
            line_id,
            equation,
            detected_terms: Array.isArray(args.detected_terms) ? args.detected_terms.map(String) : [],
            applicable_laws: Array.isArray(args.applicable_laws) ? args.applicable_laws : [],
            reasoning: String(args.reasoning ?? ""),
            patch: { fillers, containers, arrangement },
          },
        },
      });
    }
    // ── Targeted workspace operators ────────────────────────────────────
    case "move_filler": {
      const line_id = String(args.line_id ?? "");
      const from_index = Number(args.from_index);
      const to_index = Number(args.to_index);
      if (!line_id || !Number.isFinite(from_index) || !Number.isFinite(to_index)) {
        return Promise.resolve({ result: { error: "line_id, from_index, to_index required" } });
      }
      return Promise.resolve({
        result: { queued: true, message: "Move queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: {
            line_id,
            op: "move_filler",
            from_index,
            to_index,
            reason: String(args.reason ?? ""),
          },
        },
      });
    }
    case "add_filler": {
      const line_id = String(args.line_id ?? "");
      const value = String(args.value ?? "").trim();
      if (!line_id || !value) return Promise.resolve({ result: { error: "line_id and value required" } });
      return Promise.resolve({
        result: { queued: true, message: "Add filler queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: {
            line_id,
            op: "add_filler",
            value,
            container: args.container ? String(args.container) : null,
            reason: String(args.reason ?? ""),
          },
        },
      });
    }
    case "remove_filler": {
      const line_id = String(args.line_id ?? "");
      const value = args.value != null ? String(args.value) : null;
      const index = args.index != null ? Number(args.index) : null;
      if (!line_id || (value == null && (index == null || !Number.isFinite(index)))) {
        return Promise.resolve({ result: { error: "line_id and (value or index) required" } });
      }
      return Promise.resolve({
        result: { queued: true, message: "Remove filler queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: { line_id, op: "remove_filler", value, index, reason: String(args.reason ?? "") },
        },
      });
    }
    case "add_container": {
      const line_id = String(args.line_id ?? "");
      const container = String(args.container ?? "").toLowerCase().trim();
      if (!line_id || !container) return Promise.resolve({ result: { error: "line_id and container required" } });
      return Promise.resolve({
        result: { queued: true, message: "Add container queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: { line_id, op: "add_container", container, reason: String(args.reason ?? "") },
        },
      });
    }
    case "remove_container": {
      const line_id = String(args.line_id ?? "");
      const container = String(args.container ?? "").toLowerCase().trim();
      if (!line_id || !container) return Promise.resolve({ result: { error: "line_id and container required" } });
      return Promise.resolve({
        result: { queued: true, message: "Remove container queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: { line_id, op: "remove_container", container, reason: String(args.reason ?? "") },
        },
      });
    }
    case "set_arrangement": {
      const line_id = String(args.line_id ?? "");
      const arrangement = Array.isArray(args.arrangement)
        ? args.arrangement.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];
      if (!line_id || arrangement.length === 0) return Promise.resolve({ result: { error: "line_id and arrangement[] required" } });
      return Promise.resolve({
        result: { queued: true, message: "Rearrangement queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: { line_id, op: "set_arrangement", arrangement, reason: String(args.reason ?? "") },
        },
      });
    }
    case "generate_line_structure": {
      const line_id = String(args.line_id ?? "");
      const fillers = Array.isArray(args.fillers) ? args.fillers.map(String) : [];
      const containers = Array.isArray(args.containers) ? args.containers.map(String) : [];
      const arrangement = Array.isArray(args.arrangement)
        ? args.arrangement.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [];
      if (!line_id || fillers.length === 0) return Promise.resolve({ result: { error: "line_id and fillers required" } });
      // Server-side law-compliance gate — refuse to queue proposals that
      // would emit raw operators, hidden signs, synthetic leading +, or
      // unknown containers. The AI must call self_check_chips first; this
      // is the belt-and-braces enforcement.
      const v = verifyLine({ fillers, containers });
      if (!v.ok) {
        return Promise.resolve({
          result: {
            error: "law_violation",
            message: "Proposal rejected — chips violate the Floating Number laws. Call self_check_chips, fix the failures, then retry.",
            failures: v.failures,
          },
        });
      }
      return Promise.resolve({
        result: { queued: true, message: "Generated structure queued for teacher approval." },
        clientAction: {
          kind: "apply_line_update",
          payload: {
            line_id,
            op: "replace_line",
            fillers,
            containers,
            arrangement,
            reason: String(args.reason ?? ""),
          },
        },
      });
    }
    default:
      return Promise.resolve({ result: { error: `Unknown tool: ${call.name}` } });
  }
};

async function callGateway(messages: any[]) {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
    });
  } catch (e: any) {
    throw makeError("upstream_unavailable", "AI service unreachable — please retry in a moment.", 503, e?.message);
  }
  if (res.status === 429) throw makeError("rate_limited", "The AI is busy right now — please retry in a few seconds.", 429);
  if (res.status === 402) throw makeError("credits_exhausted", "AI credits exhausted for this workspace.", 402);
  if (res.status === 413) throw makeError("payload_too_large", "Document or message too large for the AI — try a smaller file.", 413);
  if (res.status >= 500) throw makeError("upstream_unavailable", "AI service temporarily unavailable. Please retry.", 503, `gateway ${res.status}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const lower = detail.toLowerCase();
    if (lower.includes("context") || lower.includes("token") || lower.includes("too long")) {
      throw makeError("context_limit", "Conversation or document is too long — start a new chat or shorten the content.", 400, detail.slice(0, 400));
    }
    throw makeError("internal_error", `AI gateway error (${res.status}).`, res.status, detail.slice(0, 400));
  }
  return await res.json();
}

interface StructuredError extends Error {
  code: string;
  status: number;
  detail?: string;
}
function makeError(code: string, message: string, status = 500, detail?: string): StructuredError {
  const e = new Error(message) as StructuredError;
  e.code = code;
  e.status = status;
  if (detail) e.detail = detail;
  return e;
}

const SUPPORTED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
];
const isImageMime = (m: string) => m.startsWith("image/");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const userMessage: string = String(body.message ?? "").trim();
    const selection: string | undefined = body.selection;
    const selectionsRaw: any[] = Array.isArray(body.selections) ? body.selections : [];
    const selections = selectionsRaw
      .map((s) => ({
        id: String(s?.id ?? ""),
        text: String(s?.text ?? ""),
        lineId: s?.lineId ? String(s.lineId) : null,
      }))
      .filter((s) => s.text);
    const lineId: string | undefined = body.lineId;
    const history: { role: string; content: string }[] = Array.isArray(body.history) ? body.history : [];
    const lessonCtx: LessonCtx | null = body.lessonContext ?? null;
    const attachmentsRaw: any[] = Array.isArray(body.attachments) ? body.attachments : [];
    const attachments = attachmentsRaw
      .map((a) => ({
        filename: String(a?.filename ?? "file"),
        mime: String(a?.mime ?? "application/octet-stream"),
        data: typeof a?.data === "string" ? a.data : "",
        text: typeof a?.text === "string" ? a.text : null,
      }))
      .filter((a) => a.data || a.text);
    // Audio uploads are no longer accepted — the client now does live STT
    // and sends the transcript as `message`. Any legacy `audio` field is
    // silently ignored.

    if (!userMessage && attachments.length === 0 && !selection && selections.length === 0) {
      throw makeError("missing_input", "Type a message, highlight something, or attach a document first.", 400);
    }

    // Size guard — base64 inflates ~4/3; ~8MB raw is a safe cap per request.
    const totalB64 = attachments.reduce((n, a) => n + (a.data?.length ?? 0), 0);
    if (totalB64 > 11_000_000) {
      throw makeError("payload_too_large", "Document(s) too large — please upload a smaller file or split it.", 413);
    }

    // Format guard for binary attachments.
    const bad = attachments.find((a) => !a.text && a.data && !SUPPORTED_MIMES.includes(a.mime));
    if (bad) {
      throw makeError("unsupported_format", `Unsupported file format: ${bad.filename} (${bad.mime}). Try PDF, DOCX, TXT, or MD.`, 415);
    }

    // Per-request supabase client preserving the caller's JWT — RLS enforced.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // Hydrate the knowledge base (laws filtered by current lesson topic).
    const kb = await hydrateKnowledge(userClient, lessonCtx?.topic ?? null);

    const primaryText = selections[0]?.text ?? selection ?? lessonCtx?.activeLineText ?? "";
    const primaryLine = selections[0]?.lineId ?? lineId ?? lessonCtx?.activeLineId ?? null;

    const contextLines: string[] = [];
    if (selections.length > 0) {
      contextLines.push("SELECTED_CONTEXT:");
      for (let i = 0; i < selections.length; i++) {
        contextLines.push(`  [${i + 1}] ${selections[i].text}`);
      }
      contextLines.push(`PRIMARY_SELECTION: ${primaryText}`);
      contextLines.push(`LINE_ID: ${primaryLine ?? "(none)"}`);
    } else if (selection || lessonCtx?.activeLineText) {
      contextLines.push(`CURRENT_SELECTION: ${primaryText}`);
      contextLines.push(`LINE_ID: ${primaryLine ?? "(none)"}`);
    } else {
      contextLines.push("CURRENT_SELECTION: (none — teacher hasn't highlighted anything)");
    }
    if (attachments.length > 0) {
      contextLines.push("ATTACHMENTS:");
      attachments.forEach((a, i) => contextLines.push(`  [${i + 1}] ${a.filename} (${a.mime})`));
    }
    const contextBlock = contextLines.join("\n");
    const lessonStateBlock = formatLessonState(lessonCtx, kb);

    // Build the user turn. If we have binary file attachments, use the
    // multimodal content[] form so the gateway routes them through.
    let userContent: any = userMessage || "(see attachments)";
    const hasMultimodal = attachments.some((a) => !a.text);
    if (hasMultimodal) {
      const parts: any[] = [{ type: "text", text: userMessage || "(see attachments)" }];
      for (const a of attachments) {
        if (a.text) {
          parts.push({ type: "text", text: `\n\n[Attached ${a.filename}]\n${a.text.slice(0, 20000)}` });
        } else if (a.data) {
          if (isImageMime(a.mime)) {
            parts.push({
              type: "image_url",
              image_url: { url: `data:${a.mime};base64,${a.data}` },
            });
          } else {
            parts.push({
              type: "file",
              file: {
                filename: a.filename,
                file_data: `data:${a.mime};base64,${a.data}`,
              },
            });
          }
        }
      }
      userContent = parts;
    } else if (attachments.length > 0) {
      // All text-only attachments: inline them into the user text.
      const inlineDocs = attachments
        .map((a) => `\n\n[Attached ${a.filename}]\n${(a.text ?? "").slice(0, 20000)}`)
        .join("");
      userContent = (userMessage || "(see attachments)") + inlineDocs;
    }

    const modeRaw = String(body.mode ?? "conversation").toLowerCase();
    const mode = ["conversation", "training", "extraction", "knowledge_extraction", "document"].includes(modeRaw)
      ? (modeRaw === "extraction" ? "knowledge_extraction" : modeRaw)
      : "conversation";
    const modeBlock = `ACTIVE_MODE: ${mode.toUpperCase()}\nFollow the rules for this mode exactly. ${
      mode === "training" || mode === "knowledge_extraction"
        ? "End your reply with an ```actions block."
        : mode === "document"
        ? "Output only the law document markdown, no ACTIONS block."
        : "Do not emit an ACTIONS block."
    }`;

    const workspaceRaw = String(body.workspace ?? "").toLowerCase();
    const workspaceLabel =
      workspaceRaw === "knowledge" || workspaceRaw === "law" || workspaceRaw === "settings"
        ? "Law / Settings Workspace"
        : workspaceRaw === "floating_number" || workspaceRaw === "generation"
        ? "Floating Number Generation Workspace"
        : "Floating Number Platform";
    const workspaceBlock =
      `ACTIVE_WORKSPACE: ${workspaceLabel}\n` +
      `You are the single Floating Number AI; this is just the window you are currently in. ` +
      `All laws, drafts, documents, training and memory are shared with every other workspace — ` +
      `never speak as if a different AI runs the other page, and never greet your own prior output ` +
      `as if it came from another assistant.`;

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: workspaceBlock },
      { role: "system", content: modeBlock },
      { role: "system", content: lessonStateBlock },
      { role: "system", content: contextBlock },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userContent },
    ];


    const clientActions: PendingClientAction[] = [];
    const toolTrace: { name: string; args: unknown; result: unknown }[] = [];

    // Tool-calling loop (max 6 steps)
    for (let step = 0; step < 6; step++) {
      const json = await callGateway(messages);
      const choice = json.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;
      messages.push(msg);

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return new Response(
          JSON.stringify({ reply: msg.content ?? "", toolTrace, clientActions }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep empty */ }
        const { result, clientAction } = await runServerTool(
          { name: tc.function?.name, arguments: parsedArgs },
          { userClient, userId, kb, lessonCtx },
        );
        toolTrace.push({ name: tc.function?.name, args: parsedArgs, result });
        if (clientAction) clientActions.push(clientAction);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({
        reply: "(stopped after 6 reasoning steps — please rephrase)",
        toolTrace,
        clientActions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    const code = e?.code ?? "internal_error";
    const status = typeof e?.status === "number" ? e.status : 500;
    const message = e?.message ?? String(e);
    const detail = e?.detail;
    return new Response(
      JSON.stringify({ error: { code, message, detail } }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

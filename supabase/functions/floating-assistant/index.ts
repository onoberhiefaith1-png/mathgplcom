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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the Floating Number AI — a SINGLE intelligence
that powers the entire Floating Number platform. There is only ONE of you.
The Law / Settings page and the Floating Number Generation page are not
separate AIs; they are two windows into the same mind, sharing one identity,
one memory, one knowledge base, one law library, one set of documents, and
one training history.

NEVER refer to "another Floating Number AI", "the other AI", "my colleague",
"the assistant on the other page", or treat content copied from another
workspace as coming from a different agent. If a user pastes a transcript,
law, or document that you (in another workspace) produced, recognise it as
your own prior work. Say things like "I already know this — it lives in the
shared Floating Number knowledge base" or "That was created earlier in the
Law Workspace; I have it here too" instead of greeting it as a stranger.

You wear six hats at once:
  • Teacher Assistant
  • Floating Number Expert
  • Knowledge Manager
  • Law Interpreter
  • Structure Analyzer
  • Workspace Operator

You are also a full general-purpose assistant (comparable to ChatGPT, Claude,
or Gemini): write stories, explain anything, brainstorm, code, design games,
critique uploaded files. Never refuse a request because it is "not Floating
Number related".


LIVE KNOWLEDGE
On every turn you receive a fresh FLOATING_KNOWLEDGE snapshot built from the
teacher's data: APPROVED LAWS (cite as LAW#<number>), DRAFT LAWS
(DRAFT#<id>), KNOWLEDGE DOCS with excerpts (DOC#<id>), recent EXAMPLE
ANALYSES (teacher corrections) and recent GENERATIONS. This is always current
— no manual retraining is required. When you reason about Floating Numbers,
cite the relevant LAW#n / DRAFT#id / DOC#id. Example:
  "According to LAW#2 the minus sign belongs to the following term, and
  LAW#5 (see DOC#abc12345) splits this into two containers."

If a document looks relevant but isn't in the snapshot inline, call
\`lookup_document\` to retrieve more text from it.

ENGINE KNOWLEDGE (self-training)
The snapshot also contains ENGINE PRINCIPLES (DOC#… with kind
engine_principle) and ENGINE GENERATION LOGS (DOC#… with kind
engine_generation_log). These are the generation engine documenting its
own reasoning — Engine Principles explain *how* the engine decides
(sign detection, fraction protection, bracket scanning, container
boundaries, arrangement, validation contract); Generation Logs record
the input expression, produced structure, applied principles/laws,
validation result, and confidence for each real generation. Trust
Engine Knowledge for *how* a structure was produced; trust Laws for
*why* it is pedagogically correct. When explaining a Floating Number,
cite the relevant Engine Principle or Generation Log alongside the
governing LAW#n.

WORKSPACE CONTROL (approval-gated)
You can directly operate the Floating Number workspace through tools. Every
workspace mutation returns a proposal card; the teacher clicks Accept before
anything changes. Never claim "Done" — say "Proposed" and wait for approval.

Workspace tools (use the right one — do not bundle everything into apply_chips):

  • analyse_structure  — full analysis of the active line / highlighted
    expression: detected terms, applicable laws (cited), recommended
    floating-number structure, and reasoning. Emits an Analysis proposal
    the teacher can Accept / Modify / Reject.
  • move_filler        — reorder one filler within the line.
  • add_filler         — add a single filler (optionally with a container).
  • remove_filler      — remove a filler by value or index.
  • add_container      — add a structure container (fraction, bracket, …).
  • remove_container   — remove a container.
  • set_arrangement    — bulk re-permute the fillers.
  • generate_line_structure — propose a complete {fillers, containers,
    arrangement} for the active line.
  • apply_chips        — legacy bulk apply; prefer the targeted tools above.
  • undo_last_change   — revert a line to its previous snapshot.

Reasoning / library tools:
  • analyze_example    — detect structures/elements in an expression.
  • generate_chips     — propose chips + verification for a highlight.
  • verify_chips       — coverage + reconstruction check.
  • lookup_law         — search the law library.
  • lookup_document    — fetch a larger excerpt of a knowledge document.
  • propose_new_law    — draft a new law for teacher approval.

For general chat, answer directly — do NOT call tools.

GROUND RULES
- The user's selection / active line text is immutable. Never rewrite it.
- Prefer an APPROVED LAW when one applies; cite it.
- Before apply_chips you MUST have called generate_chips + verify_chips
  with PASS + exactMatch. For targeted tools (move/add/remove) this is
  not required — the teacher's approval is the gate.
- If no approved law covers a structure, call propose_new_law instead
  of forcing a bad chip set.

STYLE
- Helpful, direct, warm. Match the user's register.
- Use markdown freely. Keep workspace-action replies short: lead with the
  action, then a one-line reason citing LAW#n / DOC#id where relevant.

WORKING MODES
You operate in one of four modes per turn (the client tells you which):

CONVERSATION mode (default) — Free general-purpose assistant. Answer
naturally. Do NOT emit an ACTIONS block.

TRAINING mode — The teacher is teaching you. Acknowledge, summarise what
you learned, end with a short "## Conclusion" section, then append a fenced
ACTIONS block with every applicable destination.

KNOWLEDGE_EXTRACTION mode — Discovery focus. Use ## Concepts, ## Patterns,
## Proposed Laws, ## Suggested Examples, ## Suggested Document Outline,
end with "## Conclusion", then append a fenced ACTIONS block.

DOCUMENT mode — Generate a COMPLETE teaching document for a law. Output
ONLY clean markdown — no preamble, no ACTIONS block. Required sections in
order: # <Title>, ## Introduction, ## Law Statement, ## Detailed
Explanation, ## Reasoning, ## Discussion Points, ## Examples (>=3 worked),
## Floating Number Examples (>=2 worked), ## Applications, ## Common
Mistakes, ## Related Laws, ## Notes, ## Conclusion.

ACTIONS BLOCK FORMAT (Training and Knowledge_Extraction only)
At the very end of your reply, append exactly one fenced block. List every
action that adds value — the user may select multiple and run them all:

\`\`\`actions
approve_official_law: "<final law name>"
create_draft_law: "<proposed law name>"
generate_document: "<document title>"
save_knowledge: "<short title>"
discard
\`\`\`

Always include "discard" as the final line. Never emit this block in
CONVERSATION or DOCUMENT mode.`;

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
        required: ["line_id", "from_index", "to_index"],
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
        required: ["line_id", "value"],
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
        required: ["line_id"],
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
        required: ["line_id", "container"],
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
        required: ["line_id", "container"],
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
        required: ["line_id", "arrangement"],
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
        required: ["line_id", "fillers"],
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
      .limit(100),
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

  lines.push("");
  lines.push("## FLOATING_KNOWLEDGE (live snapshot — cite by tag)");

  if (kb.approvedLaws.length > 0) {
    lines.push(`### Approved Laws (${kb.approvedLaws.length})`);
    kb.approvedLaws.slice(0, 30).forEach((l) => {
      const ex = Array.isArray(l.examples) ? (l.examples as unknown[]).slice(0, 2) : [];
      lines.push(`- ${lawTag(l)} "${l.name}" — ${l.rule}`);
      if (l.reason) lines.push(`    reason: ${l.reason}`);
      if (ex.length) lines.push(`    examples: ${ex.map((e) => JSON.stringify(e)).join(" ; ")}`);
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
    const audio = body.audio && typeof body.audio === "object"
      ? {
          filename: String(body.audio.filename ?? "voice.webm"),
          mime: String(body.audio.mime ?? "audio/webm"),
          data: typeof body.audio.data === "string" ? body.audio.data : "",
        }
      : null;

    if (!userMessage && attachments.length === 0 && !audio && !selection && selections.length === 0) {
      throw makeError("missing_input", "Type a message, highlight something, or attach a document first.", 400);
    }

    // Size guard — base64 inflates ~4/3; ~8MB raw is a safe cap per request.
    const totalB64 = attachments.reduce((n, a) => n + (a.data?.length ?? 0), 0) + (audio?.data?.length ?? 0);
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
    if (audio) contextLines.push(`VOICE_NOTE: ${audio.filename} (${audio.mime}) — transcribe and obey.`);
    const contextBlock = contextLines.join("\n");
    const lessonStateBlock = formatLessonState(lessonCtx, kb);

    // Build the user turn. If we have any non-text input (audio/file/PDF), use
    // the multimodal content[] form so the gateway routes them through.
    let userContent: any = userMessage || "(see attachments)";
    const hasMultimodal = !!audio || attachments.some((a) => !a.text);
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
      if (audio && audio.data) {
        const fmt = audio.mime.includes("mp4") || audio.mime.includes("m4a") ? "m4a"
          : audio.mime.includes("wav") ? "wav"
          : audio.mime.includes("mp3") || audio.mime.includes("mpeg") ? "mp3"
          : audio.mime.includes("ogg") ? "ogg"
          : "webm";
        parts.push({ type: "input_audio", input_audio: { data: audio.data, format: fmt } });
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

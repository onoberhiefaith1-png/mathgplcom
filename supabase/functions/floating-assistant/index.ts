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

const SYSTEM_PROMPT = `You are the Floating Number AI Assistant — a specialised
mathematical copilot embedded inside a teacher's Floating Number workspace
and deeply integrated with the Lesson Note Generator.

You are a mathematical CO-AUTHOR, not a generic chatbot. You reason about
Floating Numbers, apply laws from the teacher's approved Law Library, and
operate on whatever the teacher has currently highlighted, the active
equation line, and the live lesson context (topic, problem, worked
examples) injected below.

GROUND RULES
- The teacher's CURRENT_SELECTION / ACTIVE_LINE is immutable. Never substitute,
  simplify, rename variables, or rewrite it.
- Always prefer an APPROVED LAW from the library when one applies. Cite it.
- Before changing the workspace, you MUST call generate_chips, then verify_chips,
  and only call apply_chips when coverage = 100 AND reconstruction is exact.
- When verification fails, return the failing report to the teacher.
  Never silently drop elements.
- If NO approved law explains the structure, propose a new law via
  propose_new_law with name + statement + rationale + 2 examples + 1
  counter-example. A proposed law NEVER becomes active automatically —
  the teacher must approve it.
- When the teacher asks for an explanation, explain in plain English
  referencing the applied laws and the current lesson topic.
- Keep replies short. Lead with the action, then a one-line reason.

TOOL USE
- analyze_example({ exampleText }) — detect structures, variables, operators,
  scaffolds, containers, existing floating elements.
- generate_chips({ selection, constraints? }) — propose chips + scaffolds + law trace.
- verify_chips({ selection, chips }) — coverage + reconstruction report.
  Status PASS = safe to apply. FAIL = missing elements or mismatch.
  NEEDS_NEW_LAW = structure not covered by any approved law.
- lookup_law({ query }) — search approved + draft laws in the library.
- propose_new_law({ name, statement, rationale, examples[], counterExample })
  — write a draft law for teacher approval.
- apply_chips({ line_id, chips, scaffolds }) — commit chips to the workspace.
  Only after verify_chips returns PASS.
- undo_last_change({ line_id }) — revert a line to its previous snapshot.`;

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
];

interface ServerToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface PendingClientAction {
  kind: "apply_chips" | "undo_last_change" | "approve_draft_law" | "reject_draft_law";
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
}

interface LawRow {
  id: string;
  name: string;
  rule: string;
  reason?: string | null;
  lesson_topics?: string[] | null;
  tags?: string[] | null;
}

interface DraftLawRow extends LawRow {
  status?: string | null;
  source_kind?: string | null;
}

interface KBHydration {
  approvedLaws: LawRow[];
  draftLaws: DraftLawRow[];
  knowledgeDocs: { id: string; filename: string; kind?: string | null }[];
}

const topicMatches = (rowTopics: string[] | null | undefined, topic: string | null | undefined): boolean => {
  if (!topic) return true;
  if (!rowTopics || rowTopics.length === 0) return true;
  const t = topic.toLowerCase().trim();
  return rowTopics.some((x) => (x ?? "").toLowerCase().trim() === t);
};

async function hydrateKnowledge(
  userClient: ReturnType<typeof createClient>,
  topic: string | null,
): Promise<KBHydration> {
  const [{ data: laws }, { data: drafts }, { data: docs }] = await Promise.all([
    userClient.from("floating_law_library").select("id,name,rule,reason,lesson_topics,tags").limit(100),
    userClient
      .from("floating_law_drafts")
      .select("id,name,rule,reason,lesson_topics,tags,status,source_kind")
      .eq("status", "proposed")
      .limit(50),
    userClient.from("floating_knowledge_documents").select("id,filename,kind").limit(50),
  ]);
  const approvedLaws = ((laws as any[]) ?? []).filter((r) => topicMatches(r.lesson_topics, topic));
  const draftLaws = ((drafts as any[]) ?? []).filter((r) => topicMatches(r.lesson_topics, topic));
  return {
    approvedLaws: approvedLaws as LawRow[],
    draftLaws: draftLaws as DraftLawRow[],
    knowledgeDocs: ((docs as any[]) ?? []).map((d) => ({ id: d.id, filename: d.filename, kind: d.kind })),
  };
}

function formatLessonState(ctx: LessonCtx | null, kb: KBHydration): string {
  const lines: string[] = [];
  lines.push("LESSON STATE:");
  if (ctx?.topic) lines.push(`  topic: ${ctx.topic}`);
  if (ctx?.subject) lines.push(`  subject: ${ctx.subject}`);
  if (ctx?.sectionKind) lines.push(`  section: ${ctx.sectionKind}`);
  if (ctx?.problem) lines.push(`  problem: ${ctx.problem}`);
  if (ctx?.activeLineText) lines.push(`  active_line[${ctx.activeLineId}]: ${ctx.activeLineText}`);
  if (ctx?.recentExamples && ctx.recentExamples.length > 0) {
    lines.push("  recent_examples:");
    ctx.recentExamples.slice(0, 6).forEach((ex, i) => {
      lines.push(`    [${i + 1}] (${ex.lineId}) ${ex.text}`);
    });
  }
  if (kb.approvedLaws.length > 0) {
    lines.push(`APPROVED LAWS (${kb.approvedLaws.length}) — cite by id:`);
    kb.approvedLaws.slice(0, 25).forEach((l) => {
      lines.push(`  - [${l.id}] ${l.name}: ${l.rule}`);
    });
  } else {
    lines.push("APPROVED LAWS: (none for this topic — consider proposing a new law)");
  }
  if (kb.draftLaws.length > 0) {
    lines.push(`PROPOSED DRAFT LAWS (${kb.draftLaws.length}):`);
    kb.draftLaws.slice(0, 10).forEach((l) => {
      lines.push(`  - [${l.id}] ${l.name}: ${l.rule}`);
    });
  }
  if (kb.knowledgeDocs.length > 0) {
    lines.push(`KNOWLEDGE DOCS: ${kb.knowledgeDocs.map((d) => d.filename).join(", ")}`);
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
    default:
      return Promise.resolve({ result: { error: `Unknown tool: ${call.name}` } });
  }
};

async function callGateway(messages: any[]) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
  });
  if (res.status === 429) throw new Error("AI rate limit exceeded — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
  return await res.json();
}

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

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const contextBlock = contextLines.join("\n");
    const lessonStateBlock = formatLessonState(lessonCtx, kb);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: lessonStateBlock },
      { role: "system", content: contextBlock },
      ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
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
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

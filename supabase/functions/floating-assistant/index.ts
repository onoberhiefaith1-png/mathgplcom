// Floating Numbers AI Assistant — tool-calling chat that drives the
// Floating Numbers workspace. Reuses the existing floating-reason
// engine (element detection, law pipeline, verifier) for the
// generate/verify/reconstruct tools.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { detectElements } from "./elementDetector.ts";
import { runLawPipeline } from "./laws.ts";
import { verify } from "./verifier.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the Floating Number AI Assistant — a specialised
mathematical copilot embedded inside a teacher's Floating Number workspace.

You are NOT a generic chatbot. You reason about Floating Numbers, apply laws
from the teacher's approved Law Library, and operate on the equation the
teacher has currently selected.

GROUND RULES
- The teacher's CURRENT_SELECTION is the immutable equation you reason about.
  Never substitute, simplify, or rewrite it.
- Before changing the workspace, you MUST call generate_chips, then verify_chips,
  and only call apply_chips when coverage = 100 AND reconstruction is exact.
- When verification fails, return the failing report to the teacher — do NOT
  silently drop elements.
- When the teacher asks for an explanation, explain in plain English referencing
  the applied laws.
- Keep replies short. Lead with the action you took, then a one-line reason.

TOOL USE
- generate_chips({ selection, constraints? }) — proposes chips + scaffolds + law trace.
- verify_chips({ selection, chips }) — coverage + reconstruction report.
- apply_chips({ line_id, chips, scaffolds }) — commits the chip set to the workspace.
- undo_last_change({ line_id }) — reverts a line to its previous snapshot.

Speak the teacher's language: "I generated 5 floating numbers, all 7 elements
covered, reconstruction passed — applied to line 3."`;

const TOOLS = [
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
      description: "Run coverage + reconstruction verification on a chip set against an original selection.",
      parameters: {
        type: "object",
        properties: {
          selection: { type: "string" },
          chips: { type: "array", items: { type: "string" } },
        },
        required: ["selection", "chips"],
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
  kind: "apply_chips" | "undo_last_change";
  payload: Record<string, unknown>;
}

const runServerTool = (call: ServerToolCall): { result: unknown; clientAction?: PendingClientAction } => {
  const args = call.arguments || {};
  switch (call.name) {
    case "generate_chips": {
      const selection = String(args.selection ?? "").trim();
      if (!selection) return { result: { error: "selection is required" } };
      const elements = detectElements(selection);
      const { chips, scaffolds, trace } = runLawPipeline(selection, elements);
      const verification = verify(selection, chips);
      return {
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
      };
    }
    case "verify_chips": {
      const selection = String(args.selection ?? "");
      const chips = Array.isArray(args.chips) ? (args.chips as string[]) : [];
      const v = verify(selection, chips);
      return {
        result: {
          status: v.status,
          coveragePct: v.coveragePct,
          exactMatch: v.exactMatch,
          missing: v.missing.map((m: any) => m.label),
          extra: v.extra.map((m: any) => m.label),
        },
      };
    }
    case "apply_chips": {
      return {
        result: { queued: true, message: "Chip change queued for teacher approval." },
        clientAction: { kind: "apply_chips", payload: args },
      };
    }
    case "undo_last_change": {
      return {
        result: { queued: true, message: "Undo queued for teacher approval." },
        clientAction: { kind: "undo_last_change", payload: args },
      };
    }
    default:
      return { result: { error: `Unknown tool: ${call.name}` } };
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
  if (res.status === 429) {
    throw new Error("AI rate limit exceeded — try again in a moment.");
  }
  if (res.status === 402) {
    throw new Error("AI credits exhausted — add credits to continue.");
  }
  if (!res.ok) {
    throw new Error(`AI gateway ${res.status}: ${await res.text()}`);
  }
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

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const primaryText = selections[0]?.text ?? selection ?? "";
    const primaryLine = selections[0]?.lineId ?? lineId ?? null;

    const contextLines: string[] = [];
    if (selections.length > 0) {
      contextLines.push("SELECTED_CONTEXT:");
      for (let i = 0; i < selections.length; i++) {
        contextLines.push(`  [${i + 1}] ${selections[i].text}`);
      }
      contextLines.push(`PRIMARY_SELECTION: ${primaryText}`);
      contextLines.push(`LINE_ID: ${primaryLine ?? "(none)"}`);
    } else if (selection) {
      contextLines.push(`CURRENT_SELECTION: ${selection}`);
      contextLines.push(`LINE_ID: ${lineId ?? "(none)"}`);
    } else {
      contextLines.push("CURRENT_SELECTION: (none — teacher hasn't highlighted anything)");
    }
    const contextBlock = contextLines.join("\n");

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
          JSON.stringify({
            reply: msg.content ?? "",
            toolTrace,
            clientActions,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep empty */ }
        const { result, clientAction } = runServerTool({ name: tc.function?.name, arguments: parsedArgs });
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

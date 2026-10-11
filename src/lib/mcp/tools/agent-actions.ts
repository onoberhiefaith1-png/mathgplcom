// ChatGPT-as-operator bridge: expose Aura's existing action engine as MCP tools.
// Every tool here wraps the SAME executors Aura uses (executeAgentTool), running
// as the signed-in teacher with RLS — no duplicated logic, no wider permissions.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { AGENT_TOOL_MANIFEST, type AgentToolSpec } from "@/lib/agent/toolTypes";
import { err, ok, requireUser } from "../supabase-user";

// Already exposed as dedicated, better-shaped MCP tools — don't duplicate them.
const ALREADY_EXPOSED = new Set([
  "workspace_snapshot",
  "list_classes",
  "create_class",
  "list_lesson_notes",
  "link_game_to_class",
  "link_lesson_note_to_class",
  "archive_lesson_note",
  "generate_floating_numbers",
]);

// Aura-internal: her own memory, attachments and self-description mean nothing
// to an external operator like ChatGPT.
const AURA_INTERNAL = new Set([
  "agent_capabilities",
  "propose_knowledge",
  "recall_knowledge",
  "list_attachments",
  "read_attachment",
  "explain_workflow",
]);

// Least privilege: ChatGPT already browses the web itself, and `navigate` only
// moves Aura's own screen (ChatGPT uses `open_screen`). Server-side web fetches
// would spend MathGPL resources on an external assistant's behalf.
const NOT_FOR_EXTERNAL = new Set(["web_search", "read_web_page", "study_tutorial", "navigate"]);

function zodFor(spec: AgentToolSpec) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of spec.params) {
    let t: z.ZodTypeAny;
    switch (param.type) {
      case "number": t = z.number(); break;
      case "boolean": t = z.boolean(); break;
      case "string[]": t = z.array(z.string()); break;
      case "number[]": t = z.array(z.number()); break;
      default: t = z.string();
    }
    t = t.describe(param.description);
    shape[param.name] = param.required ? t : t.optional();
  }
  if (spec.needsConfirmation) {
    shape["confirmed"] = z
      .boolean()
      .optional()
      .describe("Set true only after the teacher has clearly agreed to this action.");
  }
  return shape;
}

function makeTool(spec: AgentToolSpec) {
  return defineTool({
    name: spec.id,
    title: spec.title,
    description: spec.description,
    inputSchema: zodFor(spec),
    annotations: {
      readOnlyHint: spec.readOnly,
      idempotentHint: spec.readOnly,
      destructiveHint: spec.needsConfirmation,
      openWorldHint: false,
    },
    handler: async (input, ctx) => {
      const authed = await requireUser(ctx);
      if ("error" in authed) return err(authed.error);
      const { executeAgentTool } = await import("@/lib/agent/tools.server");
      const result = await executeAgentTool(
        { supabase: authed.client as never, userId: authed.userId },
        spec.id,
        input as Record<string, unknown>,
      );
      if (!result.ok) return err(result.error ?? "That action failed.");
      const data = result.data == null ? "" : `\n\n${JSON.stringify(result.data, null, 2)}`;
      const nav = result.navigateTo ? `\n\nOpens in app: ${result.navigateTo}` : "";
      return ok(
        `${result.summary ?? "Done."}${data}${nav}`,
        { summary: result.summary ?? null, navigateTo: result.navigateTo ?? null, data: result.data ?? null },
      );
    },
  });
}

export const agentActionTools = AGENT_TOOL_MANIFEST.filter(
  (spec) => !ALREADY_EXPOSED.has(spec.id) && !AURA_INTERNAL.has(spec.id) && !NOT_FOR_EXTERNAL.has(spec.id),
).map(makeTool);

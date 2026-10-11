// MathGPL Tutor runner: only a fixed allow-list of Aura's existing actions, run as
// the signed-in teacher (RLS applies). No AI model is ever called here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED = new Set([
  "workspace_snapshot",
  "list_classes",
  "create_class",
  "list_lesson_notes",
  "list_teaching_hub_games",
  "link_game_to_class",
  "link_lesson_note_to_class",
  "archive_lesson_note",
]);

export const runAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { toolId?: unknown; args?: unknown } | null;
    if (!v || typeof v.toolId !== "string" || !ALLOWED.has(v.toolId)) throw new Error("Action not allowed.");
    const args = v.args && typeof v.args === "object" && !Array.isArray(v.args) ? (v.args as Record<string, unknown>) : {};
    return { toolId: v.toolId, args };
  })
  .handler(async ({ data, context }) => {
    const { executeAgentTool } = await import("@/lib/agent/tools.server");
    const r = await executeAgentTool({ supabase: context.supabase as never, userId: context.userId }, data.toolId, data.args);
    const out = r as { ok: boolean; summary?: string; error?: string; navigateTo?: string; data?: unknown };
    return {
      ok: out.ok,
      summary: out.summary ?? null,
      error: out.error ?? null,
      navigateTo: out.navigateTo ?? null,
      json: JSON.stringify(out.data ?? null),
    };
  });

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";

export default defineTool({
  name: "preview_lesson_repair",
  title: "Preview a lesson-note repair",
  description:
    "Read-only. Reports what is wrong with an existing note's structure (questions without their own session or Solution area, loose lines) so the teacher can approve a repair. Changes nothing.",
  inputSchema: { notebookId: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ notebookId }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;
    const { data: own } = await client.from("notebooks").select("id, title").eq("id", notebookId).eq("owner_id", userId).maybeSingle();
    if (!own) return err("That lesson note was not found in your workspace.");
    const { executeAgentTool } = await import("@/lib/agent/tools.server");
    const r = await executeAgentTool({ supabase: client as never, userId }, "inspect_lesson_structure", { notebookId });
    if (!r.ok) return err(r.error ?? "Could not inspect the note.");
    return ok(
      `Repair preview for "${own.title}" (nothing changed). If the teacher approves: snapshot_lesson_note, then repair_lesson_structure, or rewrite questions with save_structured_lesson.\n\n${JSON.stringify(r.data, null, 2)}`,
      { notebookId, report: r.data ?? null },
    );
  },
});

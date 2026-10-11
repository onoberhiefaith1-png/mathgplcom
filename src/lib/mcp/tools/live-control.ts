import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";

export const openScreenTool = defineTool({
  name: "open_screen",
  title: "Open a screen in MathGPL",
  description:
    "Make the teacher's open MathGPL window (e.g. on the other half of a split screen) switch screens live. Targets: lesson_notes (shelf), note (a notebook in the editor), smartboard (present a notebook on the Smartboard), game, academia, home.",
  inputSchema: {
    target: z.enum(["home", "lesson_notes", "note", "smartboard", "game", "academia"]),
    notebookId: z.string().uuid().optional().describe("Required for note and smartboard."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ target, notebookId }, ctx) => {
    const a = await requireUser(ctx);
    if ("error" in a) return err(a.error);
    if ((target === "note" || target === "smartboard") && !notebookId) return err("notebookId is required.");
    if (notebookId) {
      const { data } = await a.client.from("notebooks").select("id").eq("id", notebookId).eq("owner_id", a.userId).maybeSingle();
      if (!data) return err("Notebook not found or not yours.");
    }
    const e = await sendLiveCommand(a.client, a.userId, "open", { target, notebookId });
    if (e) return err(e);
    return ok(`Sent: open ${target}. If MathGPL is open and signed in, it switches now.`);
  },
});

export const smartboardControlTool = defineTool({
  name: "smartboard_control",
  title: "Control the Smartboard",
  description: "Move the live Smartboard presentation in the teacher's open MathGPL window: next or previous step.",
  inputSchema: {
    action: z.enum(["next", "previous"]),
    times: z.number().int().min(1).max(20).default(1),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ action, times }, ctx) => {
    const a = await requireUser(ctx);
    if ("error" in a) return err(a.error);
    const e = await sendLiveCommand(a.client, a.userId, "smartboard", { action, times });
    if (e) return err(e);
    return ok(`Sent: Smartboard ${action} ×${times}.`);
  },
});

export const getCurrentViewTool = defineTool({
  name: "get_current_view",
  title: "What is on the teacher's screen",
  description:
    "Read what the teacher currently has open in MathGPL (page, notebook and visible text) so you can explain exactly what is on screen.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const a = await requireUser(ctx);
    if ("error" in a) return err(a.error);
    const { data } = await a.client.from("chatgpt_presence").select("*").eq("user_id", a.userId).maybeSingle();
    if (!data) return err("MathGPL is not open for this account right now. Ask the teacher to open mathgpl.com and sign in.");
    const ageSec = Math.round((Date.now() - new Date(data.updated_at).getTime()) / 1000);
    return ok(
      `Page: ${data.route}\nNotebook: ${data.notebook_id ?? "none"}\nUpdated ${ageSec}s ago\n\nVisible text:\n${data.screen_text ?? ""}`,
      { ...data, ageSeconds: ageSec },
    );
  },
});

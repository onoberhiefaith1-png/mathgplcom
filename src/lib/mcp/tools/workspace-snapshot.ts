import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";

export default defineTool({
  name: "workspace_snapshot",
  title: "Workspace snapshot",
  description:
    "Read-only overview of the signed-in teacher's workspace: their classes and recent lesson notebooks. Call this first to learn what exists before creating or editing anything.",
  inputSchema: {
    notebookLimit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum notebooks to include."),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ notebookLimit }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    const [notebooks, memberships] = await Promise.all([
      client
        .from("notebooks")
        .select("id,title,subject,subtopic,class_name,updated_at")
        .eq("owner_id", userId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(notebookLimit),
      client
        .from("class_members")
        .select("class_id, role, classes(id, name)")
        .eq("user_id", userId),
    ]);

    if (notebooks.error) return err(notebooks.error.message);

    const classes = (memberships.data ?? [])
      .map((m) => {
        const c = m.classes as unknown as { id: string; name: string } | null;
        return c ? { id: c.id, name: c.name, role: m.role } : null;
      })
      .filter(Boolean);

    const snapshot = { classes, notebooks: notebooks.data ?? [] };
    return ok(JSON.stringify(snapshot, null, 2), snapshot);
  },
});

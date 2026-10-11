import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, requireUser } from "../supabase-user";

export default defineTool({
  name: "get_notebook",
  title: "Get lesson notebook",
  description:
    "Fetch one of the signed-in teacher's own lesson notebooks by id, including its document JSON.",
  inputSchema: {
    id: z.string().uuid().describe("Notebook UUID."),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ id }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    // Owner-scoped on top of row-level security: shared or community notes are
    // never returned to an external assistant through this tool.
    const { data, error } = await authed.client
      .from("notebooks")
      .select("*")
      .eq("id", id)
      .eq("owner_id", authed.userId)
      .maybeSingle();
    if (error) return err(error.message);
    if (!data) return err("Notebook not found or not yours.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { notebook: data },
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { err, requireUser } from "../supabase-user";
import { z } from "zod";

export default defineTool({
  name: "list_notebooks",
  title: "List lesson notebooks",
  description:
    "List the signed-in teacher's lesson notebooks (id, title, subject, subtopic, updated_at).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum notebooks to return."),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ limit }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;
    // The caller's own notebooks only: the owner comes from their verified
    // token, never from anything the caller sends.
    const { data, error } = await client
      .from("notebooks")
      .select("id,title,subject,subtopic,updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error)
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { notebooks: data ?? [] },
    };
  },
});

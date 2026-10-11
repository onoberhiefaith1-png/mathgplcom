import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\[a-z]+/g, " ")
    .replace(/[{}$\\^_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default defineTool({
  name: "generate_floating",
  title: "Set Floating Numbers for a question",
  description:
    "Attach Floating Numbers lines to a question in a notebook. Each line is a list of tokens (numbers, operators, symbols) the student can tap on the board. The lines are stored on the question's subsection and appear in the Smartboard and Game players.",
  inputSchema: {
    notebookId: z.string().uuid().describe("Notebook UUID containing the question."),
    question: z.string().min(1).describe("The question text, exactly as it appears in the notebook."),
    lines: z
      .array(z.array(z.string().min(1)).min(1))
      .min(1)
      .describe("Floating lines; each line is an ordered list of tokens, e.g. [[\"x\", \"+\", \"7\", \"=\", \"15\"], [\"x\", \"=\", \"8\"]]."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ notebookId, question, lines }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    const { data: notebook } = await client
      .from("notebooks")
      .select("id")
      .eq("id", notebookId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!notebook) return err("Notebook not found or not yours.");

    const { data: sections } = await client.from("notebook_sections").select("id").eq("notebook_id", notebookId);
    const sectionIds = (sections ?? []).map((s) => s.id);
    if (!sectionIds.length) return err("This notebook has no sections yet — add the question first.");

    const { data: blocks } = await client
      .from("notebook_blocks")
      .select("id, section_id, subsection_id, content_ascii")
      .in("section_id", sectionIds)
      .eq("kind", "problem");

    const target = (blocks ?? []).find((b) => normalize(b.content_ascii).includes(normalize(question)));
    if (!target) return err("Could not find that question in the notebook. Check the wording with get_notebook.");
    if (!target.subsection_id) return err("That question has no subsection to hold Floating Numbers yet.");

    const floatingLines = lines.map((tokens) => ({ fillers: tokens }));
    const { error } = await client
      .from("notebook_subsections")
      .update({ floating_lines: floatingLines })
      .eq("id", target.subsection_id);
    if (error) return err(error.message);

    return ok(`Set ${lines.length} Floating Numbers line(s) on the question in notebook ${notebookId}.`, {
      notebookId,
      subsectionId: target.subsection_id,
      lines: lines.length,
    });
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";

/** Loose comparison: ignore case, whitespace and simple LaTeX wrappers. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\[a-z]+/g, " ") // \frac \cdot etc.
    .replace(/[{}$\\^_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default defineTool({
  name: "solve_question",
  title: "Save a verified solution",
  description:
    "Save a step-by-step solution for a question that already exists in a notebook. The solution contract is enforced: line 1 must restate the question, then one complete micro-step per line, no line empty, no line carrying two equations. The solution is saved as a solution block next to the question.",
  inputSchema: {
    notebookId: z.string().uuid().describe("Notebook UUID containing the question."),
    question: z.string().min(1).describe("The question text, exactly as it appears in the notebook."),
    lines: z
      .array(z.string().min(1))
      .min(2)
      .describe("Solution lines. Line 1 restates the question; each following line is one complete micro-step."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ notebookId, question, lines }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    // Solution contract checks (same rules the in-app generator enforces).
    if (normalize(lines[0]) !== normalize(question)) {
      return err("Rejected: line 1 must restate the question exactly. Fix line 1 and call again.");
    }
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) return err(`Rejected: line ${i + 1} is empty.`);
      const equals = (lines[i].match(/=/g) ?? []).length;
      if (equals > 1) return err(`Rejected: line ${i + 1} carries more than one equation; split it into separate lines.`);
    }

    // Find the question's problem block inside this notebook (owner-scoped).
    const { data: notebook } = await client
      .from("notebooks")
      .select("id")
      .eq("id", notebookId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!notebook) return err("Notebook not found or not yours.");

    const { data: sections } = await client.from("notebook_sections").select("id").eq("notebook_id", notebookId);
    const sectionIds = (sections ?? []).map((s) => s.id);
    if (!sectionIds.length) return err("This notebook has no sections yet — add the question first with update_notebook.");

    const { data: blocks } = await client
      .from("notebook_blocks")
      .select("id, section_id, subsection_id, order_index, content_ascii")
      .in("section_id", sectionIds)
      .eq("kind", "problem");

    const target = (blocks ?? []).find((b) => normalize(b.content_ascii).includes(normalize(question)));
    if (!target) return err("Could not find that question in the notebook. Check the wording with get_notebook.");

    const { data: last } = await client
      .from("notebook_blocks")
      .select("order_index")
      .eq("section_id", target.section_id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await client.from("notebook_blocks").insert({
      section_id: target.section_id,
      subsection_id: target.subsection_id,
      kind: "solution",
      content_ascii: lines.join("\n"),
      order_index: (last?.order_index ?? 0) + 1,
    });
    if (error) return err(error.message);

    await sendLiveCommand(client, userId, "refresh");
    return ok(`Saved a ${lines.length}-line verified solution for the question in notebook ${notebookId}.`, {
      notebookId,
      lines: lines.length,
    });
  },
});

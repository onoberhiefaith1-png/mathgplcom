import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";

const blockSchema = z.object({
  kind: z.enum(["problem", "solution", "reasoning", "text"]),
  content: z.string().max(20_000),
});

const sectionSchema = z.object({
  kind: z.enum([
    "introduction",
    "explanation",
    "example",
    "exercise",
    "classwork",
    "homework",
    "summary",
  ]),
  title: z.string().max(200).optional(),
  blocks: z.array(blockSchema).max(200).default([]),
});

export default defineTool({
  name: "update_notebook",
  title: "Update lesson notebook",
  description:
    "Update owner-scoped notebook cover details only. Nonempty appendSections are rejected: preview ChatGPT's own content and use save_structured_lesson after approval.",
  inputSchema: {
    id: z.string().uuid().describe("Notebook UUID."),
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("New lesson title."),
    subject: z.string().max(100).optional().describe("New subject name."),
    subtopic: z.string().max(200).optional().describe("New topic or subtopic."),
    className: z
      .string()
      .max(100)
      .optional()
      .describe("Class name shown on the cover."),
    teacher: z
      .string()
      .max(100)
      .optional()
      .describe("Teacher name shown on the cover."),
    appendSections: z
      .array(sectionSchema)
      .max(50)
      .default([])
      .describe("Sections to append at the end, in order."),
  },
  annotations: {
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (
    { id, title, subject, subtopic, className, teacher, appendSections },
    ctx,
  ) => {
    if (appendSections.length) return err("Nothing was changed. Lesson content must go through preview_structured_lesson and the approved save_structured_lesson path; appendSections must be empty here.");
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    // Ownership first: never touch details or append sections to a notebook
    // the caller does not own (even where a sharing rule would let them read it).
    const { data: owned } = await client
      .from("notebooks")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!owned) return err("Notebook not found or not yours.");

    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (subject !== undefined) patch.subject = subject;
    if (subtopic !== undefined) patch.subtopic = subtopic;
    if (className !== undefined) patch.class_name = className;
    if (teacher !== undefined) patch.teacher = teacher;

    if (Object.keys(patch).length) {
      const { error } = await client
        .from("notebooks")
        .update(patch)
        .eq("id", id)
        .eq("owner_id", userId);
      if (error) return err(error.message);
    }

    let appended = 0;
    if (appendSections.length) {
      const { data: last } = await client
        .from("notebook_sections")
        .select("order_index")
        .eq("notebook_id", id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      let order = (last?.order_index ?? -1) + 1;

      for (const s of appendSections) {
        const { data: section, error: sErr } = await client
          .from("notebook_sections")
          .insert({
            notebook_id: id,
            kind: s.kind,
            title: s.title ?? null,
            order_index: order++,
          })
          .select("id")
          .single();
        if (sErr || !section)
          return err(`Details saved but a section failed: ${sErr?.message}`);
        appended++;
        if (s.blocks.length) {
          const rows = s.blocks.map((b, j) => ({
            section_id: section.id,
            kind: b.kind,
            content_ascii: b.content,
            order_index: j,
          }));
          const { error: bErr } = await client
            .from("notebook_blocks")
            .insert(rows);
          if (bErr)
            return err(`Sections appended but blocks failed: ${bErr.message}`);
        }
      }
    }

    await sendLiveCommand(client, userId, "refresh");
    return ok(
      `Updated notebook ${id}: details ${Object.keys(patch).length ? "saved" : "unchanged"}, ${appended} section(s) appended.`,
      {
        notebookId: id,
        sectionsAppended: appended,
      },
    );
  },
});

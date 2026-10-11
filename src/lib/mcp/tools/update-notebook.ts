import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";

const blockSchema = z.object({
  kind: z.enum(["problem", "solution", "reasoning", "text"]),
  content: z.string(),
});

const sectionSchema = z.object({
  kind: z.enum(["introduction", "explanation", "example", "exercise", "classwork", "homework", "summary"]),
  title: z.string().optional(),
  blocks: z.array(blockSchema).default([]),
});

export default defineTool({
  name: "update_notebook",
  title: "Update lesson notebook",
  description:
    "Update a notebook's details (title, subject, subtopic, class name, teacher) and/or append new sections with content blocks at the end. Only the signed-in owner's notebooks can be changed.",
  inputSchema: {
    id: z.string().uuid().describe("Notebook UUID."),
    title: z.string().min(1).optional(),
    subject: z.string().optional(),
    subtopic: z.string().optional(),
    className: z.string().optional(),
    teacher: z.string().optional(),
    appendSections: z.array(sectionSchema).default([]).describe("Sections to append at the end, in order."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ id, title, subject, subtopic, className, teacher, appendSections }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    const patch: Record<string, unknown> = {};
    if (title !== undefined) patch.title = title;
    if (subject !== undefined) patch.subject = subject;
    if (subtopic !== undefined) patch.subtopic = subtopic;
    if (className !== undefined) patch.class_name = className;
    if (teacher !== undefined) patch.teacher = teacher;

    if (Object.keys(patch).length) {
      const { error } = await client.from("notebooks").update(patch).eq("id", id).eq("owner_id", userId);
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
          .insert({ notebook_id: id, kind: s.kind, title: s.title ?? null, order_index: order++ })
          .select("id")
          .single();
        if (sErr || !section) return err(`Details saved but a section failed: ${sErr?.message}`);
        appended++;
        if (s.blocks.length) {
          const rows = s.blocks.map((b, j) => ({
            section_id: section.id,
            kind: b.kind,
            content_ascii: b.content,
            order_index: j,
          }));
          const { error: bErr } = await client.from("notebook_blocks").insert(rows);
          if (bErr) return err(`Sections appended but blocks failed: ${bErr.message}`);
        }
      }
    }

    await sendLiveCommand(client, userId, "refresh");
    return ok(`Updated notebook ${id}: details ${Object.keys(patch).length ? "saved" : "unchanged"}, ${appended} section(s) appended.`, {
      notebookId: id,
      sectionsAppended: appended,
    });
  },
});

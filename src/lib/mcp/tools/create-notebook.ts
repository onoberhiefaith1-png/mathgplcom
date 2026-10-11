import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";

const blockSchema = z.object({
  kind: z
    .enum(["problem", "solution", "reasoning", "text"])
    .describe("Block type."),
  content: z
    .string()
    .max(20_000)
    .describe("Plain-text / ASCII math content of the block."),
});

const sectionSchema = z.object({
  kind: z
    .enum([
      "introduction",
      "explanation",
      "example",
      "exercise",
      "classwork",
      "homework",
      "summary",
    ])
    .describe("Section type."),
  title: z.string().max(200).optional().describe("Optional section heading."),
  blocks: z
    .array(blockSchema)
    .max(200)
    .default([])
    .describe("Content blocks in order."),
});

export default defineTool({
  name: "create_notebook",
  title: "Create lesson notebook",
  description:
    "Create a new lesson notebook in the signed-in teacher's workspace, optionally with sections and content blocks. Returns the new notebook id. Use workspace_snapshot first to see existing notebooks.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Lesson title."),
    subject: z
      .string()
      .max(100)
      .default("Mathematics")
      .describe("Subject name."),
    subtopic: z.string().max(200).default("").describe("Topic or subtopic."),
    className: z
      .string()
      .max(100)
      .default("")
      .describe("Class name shown on the cover, e.g. 'Year 10'."),
    teacher: z
      .string()
      .max(100)
      .default("")
      .describe("Teacher name shown on the cover."),
    sections: z
      .array(sectionSchema)
      .max(50)
      .default([])
      .describe("Lesson sections in order."),
  },
  annotations: {
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (
    { title, subject, subtopic, className, teacher, sections },
    ctx,
  ) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    const { data: notebook, error: nbErr } = await client
      .from("notebooks")
      .insert({
        owner_id: userId,
        title,
        subject,
        subtopic,
        class_name: className,
        teacher,
      })
      .select("id")
      .single();
    if (nbErr || !notebook)
      return err(nbErr?.message ?? "Could not create the notebook.");

    let sectionCount = 0;
    let blockCount = 0;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const { data: section, error: sErr } = await client
        .from("notebook_sections")
        .insert({
          notebook_id: notebook.id,
          kind: s.kind,
          title: s.title ?? null,
          order_index: i,
        })
        .select("id")
        .single();
      if (sErr || !section)
        return err(
          `Notebook created (id ${notebook.id}) but a section failed: ${sErr?.message}`,
        );
      sectionCount++;
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
          return err(
            `Notebook created (id ${notebook.id}) but blocks failed: ${bErr.message}`,
          );
        blockCount += rows.length;
      }
    }

    const result = {
      notebookId: notebook.id,
      sections: sectionCount,
      blocks: blockCount,
    };
    await sendLiveCommand(client, userId, "refresh");
    return ok(
      `Created notebook "${title}" (${notebook.id}) with ${sectionCount} sections and ${blockCount} blocks.`,
      result,
    );
  },
});

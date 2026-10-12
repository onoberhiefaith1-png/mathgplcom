import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";
import { GUIDE_VERSION } from "../guide/operatingGuide";
import {
  QUESTION_KINDS,
  TEACHING_KINDS,
  validateStructuredLesson,
  type StructuredSection,
} from "../guide/lessonValidator";

const line = z.string().max(2_000);
const questionSchema = z.object({
  question: z.string().min(1).max(4_000).describe("The question, exactly as the teacher wants it asked."),
  solution: z
    .array(line)
    .min(1)
    .max(80)
    .describe("Worked solution, one micro-step per item. Item 1 restates the question verbatim."),
  title: z.string().max(200).optional(),
});
const sectionSchema = z.object({
  kind: z.enum([...TEACHING_KINDS, ...QUESTION_KINDS]).describe("Section type."),
  title: z.string().max(200).optional(),
  lines: z.array(line).max(200).optional().describe("Teaching lines (introduction / explanation / summary only)."),
  questions: z.array(questionSchema).max(30).optional().describe("Questions (example / exercise / classwork / homework only)."),
});

export function toStructured(sections: z.infer<typeof sectionSchema>[]): StructuredSection[] {
  return sections.map((s) =>
    (QUESTION_KINDS as readonly string[]).includes(s.kind)
      ? { kind: s.kind as StructuredSection["kind"], title: s.title, questions: s.questions ?? [] } as StructuredSection
      : { kind: s.kind as StructuredSection["kind"], title: s.title, lines: s.lines ?? [] } as StructuredSection,
  );
}

export default defineTool({
  name: "save_structured_lesson",
  title: "Save a standards-checked lesson",
  description:
    "The way to save lesson content. Validates every section against MathGPL's classroom standard BEFORE writing (nothing saved if anything fails), gives each question its own session and Solution area, reads the note back and reports verified. Pass guideVersion from get_operating_guide. Omit notebookId to create a new note; pass it to append sections to the teacher's existing note. Uses no MathGPL AI credits.",
  inputSchema: {
    guideVersion: z.string().describe("guideVersion returned by get_operating_guide."),
    notebookId: z.string().uuid().optional().describe("Existing note to append to."),
    title: z.string().trim().min(1).max(200).optional().describe("Title for a new note."),
    subject: z.string().max(100).default("Mathematics").describe("Subject for a new note."),
    subtopic: z.string().max(200).default("").describe("Topic or subtopic for a new note."),
    sections: z.array(sectionSchema).min(1).max(50).describe("Lesson sections in teaching order."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ guideVersion, notebookId, title, subject, subtopic, sections }, ctx) => {
    if (guideVersion !== GUIDE_VERSION) {
      return err(`Operating guide is out of date (have "${guideVersion}", current "${GUIDE_VERSION}"). Call get_operating_guide again, then resend.`);
    }
    const structured = toStructured(sections);
    const problems = validateStructuredLesson(structured);
    if (problems.length) {
      return {
        ...err(`Nothing was saved. Fix these and resend:\n${problems.map((p) => `- ${p.where}: ${p.issue}`).join("\n")}`),
        structuredContent: { saved: false, problems },
      };
    }

    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;

    let id = notebookId;
    if (id) {
      const { data: own } = await client.from("notebooks").select("id").eq("id", id).eq("owner_id", userId).maybeSingle();
      if (!own) return err("That lesson note was not found in your workspace.");
    } else {
      if (!title) return err("A title is required to create a new lesson note.");
      const { data: nb, error } = await client
        .from("notebooks")
        .insert({ owner_id: userId, title, subject, subtopic })
        .select("id")
        .single();
      if (error || !nb) return err(error?.message ?? "Could not create the lesson note.");
      id = nb.id as string;
    }

    const { executeAgentTool } = await import("@/lib/agent/tools.server");
    const actx = { supabase: client as never, userId };
    const run = async (tool: string, args: Record<string, unknown>) => {
      const r = await executeAgentTool(actx, tool, args);
      if (!r.ok) throw new Error(r.error ?? `${tool} failed`);
      return (r.data ?? {}) as Record<string, unknown>;
    };

    const saved: { kind: string; sectionId: string; subsectionId?: string }[] = [];
    try {
      for (const s of structured) {
        if ("questions" in s) {
          for (const q of s.questions) {
            const d = await run("write_question", {
              notebookId: id, kind: s.kind, title: q.title ?? s.title, question: q.question, solution: q.solution,
            });
            saved.push({ kind: s.kind, sectionId: String(d.sectionId), subsectionId: String(d.subsectionId) });
          }
        } else {
          const d = await run("add_lesson_session", { notebookId: id, kind: s.kind, title: s.title });
          await run("append_lesson_lines", { sectionId: d.sectionId, lines: s.lines.filter((l) => l.trim()), kind: "text" });
          saved.push({ kind: s.kind, sectionId: String(d.sectionId) });
        }
      }
    } catch (e) {
      return {
        ...err(`Partly saved in note ${id}: ${saved.length} section(s) written before this failed: ${e instanceof Error ? e.message : e}. Call read_lesson_note and add only what is missing — do not resend the whole lesson.`),
        structuredContent: { saved: false, notebookId: id, savedSections: saved },
      };
    }

    const check = await executeAgentTool(actx, "inspect_lesson_structure", { notebookId: id });
    const issues = (((check as { data?: unknown }).data as { problems?: unknown[] } | null)?.problems ?? []) as unknown[];
    const verified = check.ok && issues.length === 0;
    await sendLiveCommand(client, userId, "refresh");
    return ok(
      verified
        ? `Saved and verified: ${saved.length} section(s) in note ${id}.`
        : `Saved ${saved.length} section(s) in note ${id}, but the read-back check reported issues — review before telling the teacher it is finished.`,
      { saved: true, verified, notebookId: id, sections: saved, issues },
    );
  },
});

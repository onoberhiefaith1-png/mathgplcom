import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";
import { GUIDE_VERSION } from "../guide/operatingGuide";
import { draftInputSchema, toStructured } from "../guide/lessonSchema";
import { draftDigest, reviewLessonDraft, type LessonDraft } from "../guide/lessonDraft";
export { toStructured } from "../guide/lessonSchema";

export default defineTool({
  name: "save_structured_lesson",
  title: "Save the teacher-approved ChatGPT lesson",
  description:
    "Save only after preview_structured_lesson and explicit teacher acceptance of that exact draft. Requires confirmed and matching approvalDigest, rechecks structure/counts/numerical claims before writing, and reports stored structure separately from mathematical checking. Unsupported mathematics also needs teacherReviewConfirmed. ChatGPT authors the content; no AI generator or MathGPL generation credits are used. Saving does not publish or assign work.",
  inputSchema: {
    guideVersion: z.string().describe("guideVersion returned by get_operating_guide."),
    ...draftInputSchema,
    confirmed: z.boolean().optional().describe("True only after the teacher explicitly accepts this exact previewed draft."),
    approvalDigest: z.string().regex(/^[a-f0-9]{64}$/).optional().describe("Digest returned by preview_structured_lesson for the accepted payload."),
    teacherReviewConfirmed: z.boolean().optional().describe("True only after the teacher explicitly reviews mathematics the preview marks as unsupported or approximate."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ guideVersion, confirmed, approvalDigest, teacherReviewConfirmed, ...input }, ctx) => {
    if (guideVersion !== GUIDE_VERSION) {
      return err(`Operating guide is out of date (have "${guideVersion}", current "${GUIDE_VERSION}"). Call get_operating_guide again, then resend.`);
    }
    const structured = toStructured(input.sections);
    const draft: LessonDraft = { ...input, sections: structured };
    const review = reviewLessonDraft(draft);
    const problems = review.problems;
    if (problems.length) {
      return {
        ...err(`Nothing was saved. Fix these and resend:\n${problems.map((p) => `- ${p.where}: ${p.issue}`).join("\n")}`),
        structuredContent: { saved: false, problems },
      };
    }
    if (confirmed !== true) return err("Nothing was saved. Show the full reviewed draft and wait for explicit teacher acceptance before setting confirmed: true.");
    if (!approvalDigest || approvalDigest !== await draftDigest(draft)) return err("Nothing was saved. The draft differs from the approved preview, or no approval digest was supplied. Preview this payload again and obtain acceptance.");
    if (review.reviewRequired.length && teacherReviewConfirmed !== true) return {
      ...err("Nothing was saved. The numerical checker cannot fully check this draft. Show reviewRequired and obtain explicit teacher mathematical review."),
      structuredContent: { saved: false, reviewRequired: review.reviewRequired, mathematics: review.mathematics },
    };
    const { notebookId, title, subject, subtopic, className, teacher } = input;

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
        .insert({ owner_id: userId, title, subject, subtopic, ...(className !== undefined ? { class_name: className } : {}), ...(teacher !== undefined ? { teacher } : {}) })
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
          saved.push({ kind: s.kind, sectionId: String(d.sectionId) });
          await run("append_lesson_lines", { sectionId: d.sectionId, lines: s.lines.filter((l) => l.trim()), kind: "text" });
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
    const structureVerified = check.ok && issues.length === 0;
    const verified = structureVerified && review.reviewRequired.length === 0;
    await sendLiveCommand(client, userId, "refresh");
    return ok(
      structureVerified
        ? `Saved and structure checked: ${saved.length} section(s) in note ${id}. Mathematics: ${review.mathematics}. This is not verification of every reasoning step or proof.`
        : `Saved ${saved.length} section(s) in note ${id}, but the structure read-back reported issues — review before telling the teacher it is finished.`,
      { saved: true, verified, structureVerified, mathematics: review.mathematics, answerChecks: review.checks,
        teacherReviewed: review.reviewRequired.length > 0 && teacherReviewConfirmed === true,
        checkingScope: review.scope, notebookId: id, sections: saved, issues },
    );
  },
});

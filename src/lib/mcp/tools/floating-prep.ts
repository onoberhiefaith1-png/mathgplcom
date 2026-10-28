// Precise highlighting, ChatGPT-supplied Floating Numbers and lesson validation.
// Reuses notebook_subsections.floating_highlights / floating_lines; no MathGPL AI.
import { defineTool } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { mintLineUid } from "@/lib/lessonnotes/lineIdentity";
import { compileBucket, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import {
  PrepError,
  buildHighlights,
  reconstructs,
  unhighlightedNotes,
  validateQuestion,
  type Highlight,
} from "../floatingPrep";

const QUESTION_KINDS = ["example", "exercise", "classwork", "homework"];
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

type Owned = {
  subsectionId: string;
  notebookId: string;
  sectionKind: string;
  problem: string;
  solution: string[];
  highlights: Highlight[];
  floatingLines: FloatingLine[];
};

/** Load one question session, only if the caller owns its notebook. */
async function loadOwned(client: SupabaseClient, userId: string, subsectionId: string): Promise<Owned> {
  const { data: sub } = await client
    .from("notebook_subsections")
    .select("id, section_id, floating_highlights, floating_lines")
    .eq("id", subsectionId)
    .maybeSingle();
  if (!sub) throw new PrepError("NOT_FOUND", "Question session not found or not yours.");
  const { data: section } = await client
    .from("notebook_sections")
    .select("id, notebook_id, kind")
    .eq("id", sub.section_id)
    .maybeSingle();
  if (!section) throw new PrepError("NOT_FOUND", "Question session not found or not yours.");
  const { data: nb } = await client
    .from("notebooks")
    .select("id")
    .eq("id", section.notebook_id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!nb) throw new PrepError("NOT_FOUND", "Question session not found or not yours.");
  const { data: blocks } = await client
    .from("notebook_blocks")
    .select("kind, content_ascii, order_index")
    .eq("subsection_id", subsectionId)
    .order("order_index", { ascending: true });
  const rows = list<{ kind: string; content_ascii: string }>(blocks);
  return {
    subsectionId,
    notebookId: section.notebook_id,
    sectionKind: section.kind,
    problem: rows.filter((b) => b.kind === "problem").map((b) => b.content_ascii).join("\n"),
    solution: rows.filter((b) => b.kind === "solution").map((b) => b.content_ascii),
    highlights: list<Highlight>(sub.floating_highlights),
    floatingLines: list<FloatingLine>(sub.floating_lines),
  };
}

const fail = (e: unknown) =>
  e instanceof PrepError ? err(`[${e.code}] ${e.message}`) : err(e instanceof Error ? e.message : String(e));

const numbered = (hs: Highlight[]) =>
  hs.filter((h) => !h.notebookOnly).map((h, i) => ({ line: `L${i + 1}`, uid: h.uid, text: h.payload, tokens: h.tokens }));

export const setSolutionHighlightsTool = defineTool({
  name: "set_solution_highlights",
  title: "Highlight solution text precisely",
  description:
    "Highlight whole solution lines or parts of them for one question session. Each selection becomes a numbered line (L1, L2…), in the order given. Unhighlighted text stays in the solution as Notes. Replaces this question's highlights; if Floating Numbers already exist, pass confirmed: true. Ranges must start/end between pieces (on spaces).",
  inputSchema: {
    subsectionId: z.string().uuid().describe("The question session id."),
    selections: z
      .array(
        z.object({
          solutionLine: z.number().int().min(1).describe("1-based solution line (as returned by read_lesson_note)."),
          start: z.number().int().min(0).optional().describe("Start character offset in that line (default 0)."),
          end: z.number().int().min(1).optional().describe("End character offset, exclusive (default end of line)."),
        }),
      )
      .min(1)
      .max(60)
      .describe("Ordered selections; each becomes the next numbered line."),
    confirmed: z.boolean().optional().describe("Required to replace highlights when Floating Numbers already exist."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ subsectionId, selections, confirmed }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    try {
      const q = await loadOwned(authed.client, authed.userId, subsectionId);
      if (q.solution.length === 0) throw new PrepError("NO_SOLUTION", "This question has no saved solution yet.");
      const highlights = buildHighlights(q.solution, selections, mintLineUid);
      if (q.floatingLines.length > 0 && !confirmed) {
        throw new PrepError("CONFIRM_REQUIRED", "This question already has Floating Numbers. Ask the teacher, then call again with confirmed: true.");
      }
      const { error } = await authed.client
        .from("notebook_subsections")
        .update({ floating_highlights: highlights })
        .eq("id", subsectionId);
      if (error) throw new Error(error.message);
      const after = await loadOwned(authed.client, authed.userId, subsectionId);
      const lines = numbered(after.highlights);
      return ok(`Saved ${lines.length} highlighted line(s).`, {
        subsectionId,
        lines,
        notes: unhighlightedNotes(after.solution, after.highlights),
        floatingNumbersNeedRegenerating: after.floatingLines.length > 0,
        nextStep: "generate_solution_floating_numbers",
      });
    } catch (e) {
      return fail(e);
    }
  },
});

export const generateSolutionFloatingNumbersTool = defineTool({
  name: "generate_solution_floating_numbers",
  title: "Save Floating Numbers for highlighted lines",
  description:
    "Save your own token groups for each highlighted line (from set_solution_highlights). A token may be a whole line, one symbol, or a group of symbols/words. Tokens joined in order must reproduce the highlighted text exactly (spaces ignored) or nothing is saved. Uses no MathGPL credits. Replacing existing Floating Numbers needs confirmed: true.",
  inputSchema: {
    subsectionId: z.string().uuid().describe("The question session id."),
    lines: z
      .array(
        z.object({
          line: z.string().describe('Highlighted line id: "L1", "L2"… or the highlight uid.'),
          tokens: z.array(z.string().min(1).max(500)).min(1).max(60),
        }),
      )
      .min(1)
      .max(60)
      .describe("Token groups per highlighted line."),
    confirmed: z.boolean().optional().describe("Required to replace existing Floating Numbers."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ subsectionId, lines, confirmed }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    try {
      const q = await loadOwned(authed.client, authed.userId, subsectionId);
      const live = q.highlights.filter((h) => !h.notebookOnly);
      if (live.length === 0) throw new PrepError("NO_HIGHLIGHTS", "Highlight the solution first with set_solution_highlights.");
      if (q.floatingLines.length > 0 && !confirmed) {
        throw new PrepError("CONFIRM_REQUIRED", "This question already has Floating Numbers. Ask the teacher, then call again with confirmed: true.");
      }
      const seen = new Set<string>();
      const built: FloatingLine[] = lines.map((l, i) => {
        const m = /^L(\d+)$/i.exec(l.line.trim());
        const h = m ? live[Number(m[1]) - 1] : live.find((x) => x.uid === l.line);
        if (!h) throw new PrepError("LINE_NOT_FOUND", `Entry ${i + 1}: highlighted line "${l.line}" does not exist (there are ${live.length}).`);
        if (seen.has(h.uid)) throw new PrepError("DUPLICATE_LINE", `Entry ${i + 1}: line "${l.line}" given twice.`);
        seen.add(h.uid);
        if (!reconstructs(h.payload, l.tokens)) {
          throw new PrepError("MISMATCH", `Entry ${i + 1} (${l.line}): tokens join to "${l.tokens.join("")}" but the highlight is "${h.payload}".`);
        }
        return {
          lineId: mintLineUid(),
          sourceUid: h.uid,
          questionId: subsectionId,
          equation: h.payload,
          fillers: l.tokens,
          containers: [],
          arrangement: l.tokens.map((_t, n) => n),
          fillersSelected: l.tokens.map(() => false),
          containersSelected: [],
        } as unknown as FloatingLine;
      });
      // Keep highlight order regardless of the order entries were sent.
      built.sort(
        (a, b) =>
          live.findIndex((h) => h.uid === (a as { sourceUid?: string }).sourceUid) -
          live.findIndex((h) => h.uid === (b as { sourceUid?: string }).sourceUid),
      );
      const { error } = await authed.client
        .from("notebook_subsections")
        .update({ floating_lines: built, floating_bucket: compileBucket(built) })
        .eq("id", subsectionId);
      if (error) throw new Error(error.message);
      const after = await loadOwned(authed.client, authed.userId, subsectionId);
      const report = validateQuestion({ solution: after.solution, highlights: after.highlights, floatingLines: after.floatingLines as never });
      return ok(`Saved Floating Numbers for ${after.floatingLines.length} line(s).`, {
        subsectionId,
        lines: report.lines,
        missingLines: report.lines.filter((l) => !l.tokens).map((l) => l.line),
        issues: report.issues,
        testPath: `/lesson-notes/${after.notebookId}/floating/${subsectionId}/test`,
      });
    } catch (e) {
      return fail(e);
    }
  },
});

export const validateLessonFloatingNumbersTool = defineTool({
  name: "validate_lesson_floating_numbers",
  title: "Validate a lesson's highlights and Floating Numbers",
  description:
    "Read back every question in one of your lesson notes: question, solution, numbered highlighted lines, Notes, saved tokens, whether each line reconstructs exactly, session placement and Smartboard readiness, with all faults listed. Read-only.",
  inputSchema: { notebookId: z.string().uuid().describe("Notebook UUID.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ notebookId }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    try {
      const { client, userId } = authed;
      const { data: nb } = await client.from("notebooks").select("id, title").eq("id", notebookId).eq("owner_id", userId).maybeSingle();
      if (!nb) throw new PrepError("NOT_FOUND", "Notebook not found or not yours.");
      const { data: sections } = await client
        .from("notebook_sections")
        .select("id, kind, title, order_index")
        .eq("notebook_id", notebookId)
        .order("order_index", { ascending: true });
      const questions: Record<string, unknown>[] = [];
      for (const s of list<{ id: string; kind: string; title: string | null }>(sections)) {
        const { data: subs } = await client
          .from("notebook_subsections")
          .select("id, order_index")
          .eq("section_id", s.id)
          .order("order_index", { ascending: true });
        for (const sub of list<{ id: string }>(subs)) {
          const q = await loadOwned(client, userId, sub.id);
          if (!q.problem && q.solution.length === 0) continue;
          const isQuestionSession = QUESTION_KINDS.includes(s.kind);
          const report = validateQuestion({ solution: q.solution, highlights: q.highlights, floatingLines: q.floatingLines as never });
          const issues = [...report.issues];
          if (!q.problem) issues.push("no question written");
          if (!isQuestionSession) issues.push(`question sits in a "${s.kind}" section, not a question section`);
          const allOk = report.lines.length > 0 && report.lines.every((l) => l.reconstructs && l.issues.length === 0);
          questions.push({
            subsectionId: sub.id,
            section: { id: s.id, kind: s.kind, title: s.title },
            question: q.problem,
            solution: q.solution,
            lines: report.lines,
            notes: unhighlightedNotes(q.solution, q.highlights),
            attachedToQuestionSession: isQuestionSession,
            smartboardReady: q.floatingLines.length > 0 && allOk,
            issues,
          });
        }
      }
      const faults = questions.filter((q) => (q.issues as string[]).length > 0 || !(q.smartboardReady as boolean)).length;
      return ok(
        faults === 0 ? `All ${questions.length} question(s) validated.` : `${faults} of ${questions.length} question(s) need attention.`,
        { notebookId, title: nb.title, valid: faults === 0, questions },
      );
    } catch (e) {
      return fail(e);
    }
  },
});

import { supabase } from "@/integrations/supabase/client";
import { parseInlineMcq } from "@/lib/lessonnotes/inlineMcq";
import { forcedMcqToQuestion, parseForcedMcq } from "@/lib/lessonnotes/forcedAssign";
import { normalizeTier, type AcademiaTier } from "@/lib/academia/tiers";
import { assignPaperToSession, type McqPaper } from "./api";
import type { McqQuestion } from "./core";

const db = supabase as any;

/** Set by Forced Assign so a question-only or answer-less highlight can still be copied. */
let pendingForcedMcq: McqQuestion | null = null;
export function setPendingForcedMcq(question: McqQuestion | null): void {
  pendingForcedMcq = question;
}

/** Each explicit Assign creates a new, independently removable MCQ activity. */
export async function assignLessonMcq(input: {
  sessionId: string; notebookId: string; subsectionId: string | null;
  title: string; tier?: AcademiaTier | null;
}): Promise<boolean> {
  if (!input.subsectionId) return false;
  const { data: blocks, error } = await db.from("notebook_blocks")
    .select("content_ascii").eq("subsection_id", input.subsectionId).eq("kind", "problem").order("order_index");
  if (error) throw error;
  const source = (blocks ?? []).map((block: { content_ascii: string | null }) => block.content_ascii ?? "").join("\n");
  const parsed = parseInlineMcq(source) ?? parseInlineMcq(source.replace(/\\n(?=\s|[A-F]\s*[.):–—-]|\([A-F]\)|(?:correct\s+)?(?:answer|option)\b)/gi, "\n"));
  const forced = parsed ? null : parseForcedMcq(source);
  const fromForced = pendingForcedMcq;
  pendingForcedMcq = null;
  // A highlight with no options is a worked question unless Forced Assign supplied it.
  if (!parsed && !fromForced && !(forced && forced.options.length)) return false;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Please sign in again.");
  const { data: subject, error: se } = await db.rpc("academia_subject_of_session", { _session: input.sessionId });
  if (se) throw se;
  if (!subject) throw new Error("The Session's subject is not available.");
  const questions = [{ ...(fromForced ?? (parsed ? { n: 1, ...parsed } : forcedMcqToQuestion(forced!))), source: { notebookId: input.notebookId, subsectionId: input.subsectionId } }];
  const { data: paper, error: pe } = await db.from("academia_mcq_papers").insert({
    // A whole-paper import key must not be reused for individual question copies.
    subject_id: subject, source_notebook_id: null, title: input.title,
    questions, created_by: user.user.id,
  }).select("id").single();
  if (pe) throw pe;
  const copy: McqPaper = { id: paper.id, subject_id: subject, title: input.title, source_notebook_id: null, questions };
  try {
    await assignPaperToSession(input.sessionId, copy, [1], normalizeTier(input.tier), input.subsectionId);
  } catch (error) {
    await db.from("academia_mcq_papers").delete().eq("id", paper.id);
    throw error;
  }
  return true;
}

import { supabase } from "@/integrations/supabase/client";
import { parseInlineMcq } from "@/lib/lessonnotes/inlineMcq";
import { normalizeTier, type AcademiaTier } from "@/lib/academia/tiers";
import { assignPaperToSession, type McqPaper } from "./api";

const db = supabase as any;

/** Each explicit Assign creates a new, independently removable MCQ activity. */
export async function assignLessonMcq(input: {
  sessionId: string; notebookId: string; subsectionId: string | null;
  title: string; tier?: AcademiaTier | null;
}): Promise<boolean> {
  if (!input.subsectionId) return false;
  const { data: blocks, error } = await db.from("notebook_blocks")
    .select("content_ascii").eq("subsection_id", input.subsectionId).eq("kind", "problem");
  if (error) throw error;
  const mcq = parseInlineMcq((blocks ?? []).map((b: any) => b.content_ascii ?? "").join("\n"));
  if (!mcq) return false;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Please sign in again.");
  const { data: subject, error: se } = await db.rpc("academia_subject_of_session", { _session: input.sessionId });
  if (se) throw se;
  if (!subject) throw new Error("The Session's subject is not available.");
  const questions = [{ n: 1, ...mcq, source: { notebookId: input.notebookId, subsectionId: input.subsectionId } }];
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

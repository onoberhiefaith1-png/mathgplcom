import { supabase } from "@/integrations/supabase/client";
import { parseInlineMcq } from "@/lib/lessonnotes/inlineMcq";
import { normalizeTier, TIER_LABEL, type AcademiaTier } from "@/lib/academia/tiers";
import { assignPaperToSession, type McqPaper } from "./api";

const db = supabase as any;

/** Copy a supplied lesson MCQ into the native paper/item activity engine.
 * Reassigning the same question refreshes its card rather than adding a twin. */
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
  const tier = normalizeTier(input.tier);
  const { data: rows, error: readError } = await db.from("academia_activities")
    .select("id,kind,ref_id,tier").eq("session_id", input.sessionId).eq("subsection_id", input.subsectionId);
  if (readError) throw readError;
  const existing = (rows ?? []).find((a: any) => a.kind === "question" || a.kind === "mcq");
  if (existing && normalizeTier(existing.tier) !== tier) {
    throw new Error(`This question is already in the ${TIER_LABEL[normalizeTier(existing.tier)]} batch. Remove it there first to move it.`);
  }
  // Every single-question copy is numbered locally, never with its source-note number.
  const questions = [{ n: 1, ...mcq }];
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Please sign in again.");
  let paperId = existing?.kind === "mcq" ? existing.ref_id as string : null;
  if (paperId) {
    const { error: e } = await db.from("academia_mcq_papers").update({ title: input.title, questions }).eq("id", paperId);
    if (e) throw e;
  } else {
    const { data: subject, error: se } = await db.rpc("academia_subject_of_session", { _session: input.sessionId });
    if (se) throw se;
    if (!subject) throw new Error("The Session's subject is not available.");
    const { data: paper, error: pe } = await db.from("academia_mcq_papers").insert({
      subject_id: subject, source_notebook_id: input.notebookId, title: input.title,
      questions, created_by: user.user.id,
    }).select("id").single();
    if (pe) throw pe;
    paperId = paper.id;
  }
  if (existing) {
    const { data: items, error: ie } = await db.from("academia_mcq_items").select("id").eq("activity_id", existing.id);
    if (ie) throw ie;
    const item = { activity_id: existing.id, ...questions[0], position: 1 };
    const { error: we } = items?.length
      ? await db.from("academia_mcq_items").update(item).eq("id", items[0].id)
      : await db.from("academia_mcq_items").insert([item]);
    if (we) throw we;
    const { error: ae } = await db.from("academia_activities").update({
      kind: "mcq", ref_id: paperId, title: input.title,
      assessment_id: null, game_id: null, class_id: null, link_code: null, game_link_code: null,
      practice_video: null, play_video: null,
    }).eq("id", existing.id);
    if (ae) throw ae;
  } else {
    const paper: McqPaper = { id: paperId!, subject_id: "", title: input.title, source_notebook_id: input.notebookId, questions };
    await assignPaperToSession(input.sessionId, paper, [1], tier, input.subsectionId);
  }
  return true;
}

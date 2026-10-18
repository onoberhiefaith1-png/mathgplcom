// Data access for subject-level multiple-choice papers.
import { supabase } from "@/integrations/supabase/client";
import { docToLines, parseMcq, withSolution, type McqAnswers, type McqQuestion, type McqSolution } from "./core";

// The MCQ tables arrive with the draft's staged migration; until the generated
// types catch up, address them through an untyped handle.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => any };

export interface McqPaper { id: string; subject_id: string; title: string; questions: McqQuestion[]; source_notebook_id: string | null }
export interface McqAttempt { id: string; paper_id: string; answers: McqAnswers; correct: number; incorrect: number; unanswered: number; total: number; submitted_at: string }

export async function subjectInfo(subjectId: string) {
  const { data } = await supabase.from("academia_subjects").select("id,name,class_id").eq("id", subjectId).maybeSingle();
  return data as { id: string; name: string; class_id: string } | null;
}

export async function listPapers(subjectId: string): Promise<McqPaper[]> {
  const { data, error } = await db.from("academia_mcq_papers").select("*").eq("subject_id", subjectId).order("position").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getPaper(id: string): Promise<McqPaper | null> {
  const { data, error } = await db.from("academia_mcq_papers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function canBuildSubject(subjectId: string): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return false;
  const { data } = await db.rpc("academia_can_build_subject", { _subject: subjectId });
  return data === true;
}

export async function myLessonNotes() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("notebooks").select("id,title,subject,updated_at")
    .eq("owner_id", u.user.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function previewNote(notebookId: string) {
  const { data, error } = await supabase.from("notebooks").select("id,title,document_json").eq("id", notebookId).single();
  if (error) throw error;
  return { title: data.title as string, ...parseMcq(docToLines(data.document_json)) };
}

export async function savePaper(subjectId: string, notebookId: string, title: string, questions: McqQuestion[]) {
  const { data: u } = await supabase.auth.getUser();
  // Always a new paper: each assigned range (1–10, 11–20, …) is its own paper.
  const { error } = await db.from("academia_mcq_papers").insert(
    { subject_id: subjectId, source_notebook_id: notebookId, title, questions, created_by: u.user?.id, updated_at: new Date().toISOString() },
  );
  if (error) throw error;
}

export async function deletePaper(id: string) {
  const { error } = await db.from("academia_mcq_papers").delete().eq("id", id);
  if (error) throw error;
}

// ---- Session Multiple-Choice activity -------------------------------------
// A teacher copies one or two questions from a paper into a Session; students
// get a standalone MCQ card next to Practice/Play and Adventure.

export interface McqSessionItem { id: string; n: number; text: string; options: { label: string; text: string }[]; answer: string | null }

export async function sessionSubjectId(sessionId: string): Promise<string | null> {
  const { data } = await db.rpc("academia_subject_of_session", { _session: sessionId });
  return (data as string | null) ?? null;
}

export async function assignPaperToSession(sessionId: string, paper: McqPaper, questionNs: number[]) {
  const chosen = paper.questions.filter((q) => questionNs.includes(q.n));
  if (!chosen.length) throw new Error("Pick at least one question.");
  const { data: u } = await supabase.auth.getUser();
  const { data: existing } = await db.from("academia_activities").select("id, position").eq("session_id", sessionId);
  if ((existing ?? []).some((a: any) => a.kind === "mcq" && a.ref_id === paper.id)) throw new Error("This paper is already in the Session.");
  const position = (existing ?? []).reduce((m: number, a: any) => Math.max(m, Number(a.position) || 0), 0) + 1;
  const { data: act, error } = await db.from("academia_activities").insert({
    session_id: sessionId, kind: "mcq", ref_id: paper.id, title: paper.title,
    position, created_by: u.user?.id,
  }).select("id").single();
  if (error) throw error;
  const rows = chosen.map((q, i) => ({
    activity_id: act.id, n: q.n, text: q.text, options: q.options, answer: q.answer, position: i + 1,
  }));
  const { error: ie } = await db.from("academia_mcq_items").insert(rows);
  if (ie) throw ie;
  return act.id as string;
}

export async function listSessionItems(activityId: string): Promise<McqSessionItem[]> {
  const { data, error } = await db.from("academia_mcq_items").select("*").eq("activity_id", activityId).order("position");
  if (error) throw error;
  return data ?? [];
}

// Attempts: signed-in students save to their account; Mathemagine guests keep
// them on this device.
const LOCAL = "mcq-attempts-v1";
const readLocal = (): McqAttempt[] => { try { return JSON.parse(localStorage.getItem(LOCAL) || "[]"); } catch { return []; } };

export async function myPaperAttempts(paperIds: string[]): Promise<McqAttempt[]> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return readLocal().filter((a) => paperIds.includes(a.paper_id));
  if (!paperIds.length) return [];
  const { data } = await db.from("academia_mcq_attempts").select("*").in("paper_id", paperIds).order("submitted_at", { ascending: false });
  return data ?? [];
}

export async function saveAttempt(a: Omit<McqAttempt, "id" | "submitted_at">): Promise<McqAttempt> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) {
    const row = { ...a, id: crypto.randomUUID(), submitted_at: new Date().toISOString() };
    localStorage.setItem(LOCAL, JSON.stringify([row, ...readLocal()].slice(0, 500)));
    return row;
  }
  const { data, error } = await db.from("academia_mcq_attempts").insert(a).select("*").single();
  if (error) throw error;
  return data;
}

/** Link a lesson-note solution to one existing question of a paper. */
export async function linkSolution(paperId: string, n: number, notebookId: string, subsectionId: string) {
  const { linesForQuestion } = await import("@/lib/academia/adventurePlay");
  const { data: ss, error: se } = await supabase.from("notebook_subsections").select("floating_lines").eq("id", subsectionId).maybeSingle();
  if (se) throw se;
  const lines = linesForQuestion((ss as any)?.floating_lines, null);
  if (!lines.length) throw new Error("This question has no Floating Numbers lines yet.");
  const paper = await getPaper(paperId);
  if (!paper) throw new Error("Paper not found.");
  const solution: McqSolution = { lines, notebookId, subsectionId };
  const { error } = await db.from("academia_mcq_papers")
    .update({ questions: withSolution(paper.questions, n, solution), updated_at: new Date().toISOString() }).eq("id", paperId);
  if (error) throw error;
}

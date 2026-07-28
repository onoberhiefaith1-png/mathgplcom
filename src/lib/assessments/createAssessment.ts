// Build a class Assessment from a Lesson Note question section.
//
// The student receives ONLY the question text + the shuffled floating chips +
// the per-line marks. The correct ordering is stored separately in
// assessment_answer_keys (owner-only RLS) and never reaches the client.

import { supabase } from "@/integrations/supabase/client";
import {
  type FloatingLine,
  markForLine,
  rearrangeStream,
  tokensFromEquation,
} from "@/lib/lessonnotes/floatingCompile";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

export type AssessmentKind = "classwork" | "homework" | "assessment" | "practice";

export interface CreateAssessmentInput {
  subsectionId: string;
  classId: string;
  notebookId: string;
  kind: AssessmentKind;
  title: string;
  scoreLabel: string;
  totalMarksOverride?: number | null;
}

export interface QuestionPayload {
  id: string;
  questionText: string;
  lines: {
    lineId: string;
    chips: string[];
    marks: number;
    containers: ContainerKind[];
    /** Teacher's correct equation for this line (the orange line). Student-safe
     *  only in the sense that it is NOT sent to the board — it stays in the
     *  answer key. Kept here so board sources can carry it for the teacher. */
  }[];
}

export interface AnswerKeyLine {
  questionId: string;
  lineId: string;
  /** Legacy/parallel token list. Kept for older rows and for display. */
  tokens: string[];
  /** THE expected line — the teacher's highlighted equation, verbatim.
   *  This — never the floating-number set — is what grading compares against. */
  equationAscii?: string;
}

export interface CompiledSection {
  questions: QuestionPayload[];
  answerKey: AnswerKeyLine[];
  total: number;
}

/** Normalise fillers for display WITHOUT ever dropping one.
 *  Teacher floating objects must reach the student one-for-one: if a filler
 *  cannot be fully converted to Unicode math we keep the original text rather
 *  than deleting the object, otherwise the student is handed an incomplete
 *  set and can never rebuild the expected line. */
const cleanFillers = (fillers: string[] | undefined): string[] =>
  (fillers ?? [])
    .map((f) => {
      const raw = String(f ?? "");
      const uni = toUnicodeMath(raw);
      if (uni && !isStillDirty(uni)) return uni;
      return (uni || raw).trim();
    })
    .filter((f) => f.length > 0);

const marksFor = (line: FloatingLine): number => markForLine(line);


export async function getNotebookScoreLabel(notebookId: string): Promise<string> {
  const { data } = await supabase
    .from("notebooks")
    .select("score_label")
    .eq("id", notebookId)
    .maybeSingle();
  const lbl = (data as any)?.score_label;
  return (lbl && String(lbl).trim()) || "Marks";
}

export async function compileSectionQuestions(sectionId: string): Promise<CompiledSection> {
  const { data: subs } = await supabase
    .from("notebook_subsections")
    .select("id, order_index, floating_lines")
    .eq("section_id", sectionId)
    .order("order_index", { ascending: true });

  const subIds = (subs ?? []).map((s: any) => s.id as string);

  const { data: blocks } = await supabase
    .from("notebook_blocks")
    .select("subsection_id, kind, content_ascii")
    .in("subsection_id", subIds.length ? subIds : ["00000000-0000-0000-0000-000000000000"]);
  const problemBySub = new Map<string, string>();
  for (const b of blocks ?? []) {
    if ((b as any).kind === "problem" && (b as any).subsection_id) {
      problemBySub.set((b as any).subsection_id, String((b as any).content_ascii ?? ""));
    }
  }

  const questions: QuestionPayload[] = [];
  const answerKey: AnswerKeyLine[] = [];
  let total = 0;

  for (const s of subs ?? []) {
    const sid = (s as any).id as string;
    const flLines = ((s as any).floating_lines ?? []) as FloatingLine[];
    const lines: QuestionPayload["lines"] = [];
    for (const line of flLines) {
      // Two DIFFERENT objects, never interchangeable:
      //  • chips   — the draggable floating numbers handed to the student.
      //  • tokens/equationAscii — the teacher's correct line (the answer key).
      const chips = cleanFillers(line.fillers);
      const equationAscii = (() => {
        const eq = String(line.equation ?? "").trim();
        if (!eq) return "";
        const uni = toUnicodeMath(eq);
        return (uni && !isStillDirty(uni) ? uni : eq).trim();
      })();
      const keyTokens = equationAscii
        ? cleanFillers(tokensFromEquation(equationAscii))
        : chips;
      const studentChips = chips.length > 0 ? chips : keyTokens;
      if (studentChips.length < 1 && !equationAscii) continue;
      const marks = marksFor(line);
      total += marks;
      lines.push({
        lineId: line.lineId,
        chips: rearrangeStream(studentChips),
        marks,
        containers: (line.containers ?? []) as ContainerKind[],
      });
      answerKey.push({
        questionId: sid,
        lineId: line.lineId,
        tokens: keyTokens.length > 0 ? keyTokens : studentChips,
        equationAscii: equationAscii || undefined,
      });
    }

    if (lines.length === 0) continue;
    questions.push({ id: sid, questionText: problemBySub.get(sid) ?? "", lines });
  }

  return { questions, answerKey, total };
}

export async function compileNotebookQuestions(notebookId: string): Promise<CompiledSection> {
  const { data: sections } = await supabase
    .from("notebook_sections")
    .select("id, order_index")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });

  const questions: QuestionPayload[] = [];
  const answerKey: AnswerKeyLine[] = [];
  let total = 0;
  for (const s of sections ?? []) {
    const compiled = await compileSectionQuestions((s as any).id as string);
    questions.push(...compiled.questions);
    answerKey.push(...compiled.answerKey);
    total += compiled.total;
  }
  return { questions, answerKey, total };
}

export async function compileQuestionSections(sectionIds: string[]): Promise<CompiledSection> {
  const questions: QuestionPayload[] = [];
  const answerKey: AnswerKeyLine[] = [];
  let total = 0;
  const seen = new Set<string>();

  for (const rawId of sectionIds) {
    const sectionId = String(rawId ?? "").trim();
    if (!sectionId || seen.has(sectionId)) continue;
    seen.add(sectionId);
    const compiled = await compileSectionQuestions(sectionId);
    questions.push(...compiled.questions);
    answerKey.push(...compiled.answerKey);
    total += compiled.total;
  }

  return { questions, answerKey, total };
}

export async function compileQuestionSection(sectionId: string): Promise<CompiledSection> {
  return compileSectionQuestions(sectionId);
}

export async function createAssessmentFromSubsection(
  input: CreateAssessmentInput,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const { data: clicked, error: subErr } = await supabase
    .from("notebook_subsections")
    .select("id, section_id")
    .eq("id", input.subsectionId)
    .maybeSingle();
  if (subErr || !clicked?.section_id) throw new Error("subsection_not_found");
  const sectionId = clicked.section_id as string;

  const { questions, answerKey, total } = await compileSectionQuestions(sectionId);
  if (questions.length === 0) throw new Error("no_floating_lines");
  const displayTotal = total;

  const { data: existingRows } = await supabase
    .from("assessments")
    .select("id, updated_at, created_at")
    .eq("class_id", input.classId)
    .eq("section_id", sectionId)
    .neq("kind", "adventure")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (existingRows ?? []) as { id: string }[];
  const keep = rows[0]?.id ?? null;
  const extras = rows.slice(1).map((r) => r.id);
  if (extras.length) {
    await supabase.from("assessments").delete().in("id", extras);
  }

  if (keep) {
    await supabase
      .from("assessments")
      .update({
        unassigned_at: null,
        kind: input.kind,
        title: input.title,
        score_label: input.scoreLabel,
        total_marks: displayTotal,
        questions: questions as any,
      } as never)
      .eq("id", keep);
    await supabase.from("assessment_answer_keys").delete().eq("assessment_id", keep);
    await supabase.from("assessment_answer_keys").insert({ assessment_id: keep, lines: answerKey as any });
    return keep;
  }

  const { data: created, error: insErr } = await supabase
    .from("assessments")
    .insert({
      class_id: input.classId,
      owner_id: uid,
      notebook_id: input.notebookId,
      section_id: sectionId,
      kind: input.kind,
      title: input.title,
      score_label: input.scoreLabel,
      total_marks: displayTotal,
      questions: questions as any,
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? "create_failed");

  const { error: keyErr } = await supabase
    .from("assessment_answer_keys")
    .insert({ assessment_id: created.id, lines: answerKey as any });
  if (keyErr) {
    await supabase.from("assessments").delete().eq("id", created.id);
    throw new Error(keyErr.message);
  }

  return created.id as string;
}

export async function unassignAssessment(id: string): Promise<void> {
  await supabase.from("assessments").delete().eq("id", id);
}

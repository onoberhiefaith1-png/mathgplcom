// Build a class Assessment from a Lesson Note question section.
//
// Grouping rule: every subsection within the SAME question section (Example 1,
// Example 2, … added via the "+ Add another" button) becomes one question on a
// single assignment board. Different sections are separate assignments.
//
// The student receives ONLY the question text + the shuffled floating chips +
// the per-line marks. The correct ordering is stored separately in
// assessment_answer_keys (owner-only RLS) and never reaches the client.

import { supabase } from "@/integrations/supabase/client";
import {
  type FloatingLine,
  rearrangeStream,
} from "@/lib/lessonnotes/floatingCompile";
import type { ContainerKind } from "@/lib/smartboard/floatingPlan";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";

export type AssessmentKind = "classwork" | "homework" | "assessment" | "practice";

export interface CreateAssessmentInput {
  subsectionId: string; // the clicked Solution's subsection
  classId: string;
  notebookId: string;
  kind: AssessmentKind;
  title: string;
  scoreLabel: string;
}

interface QuestionPayload {
  id: string;
  questionText: string;
  lines: { lineId: string; chips: string[]; marks: number }[];
}

interface AnswerKeyLine {
  questionId: string;
  lineId: string;
  tokens: string[];
}

const cleanFillers = (fillers: string[] | undefined): string[] =>
  (fillers ?? [])
    .map((f) => toUnicodeMath(String(f ?? "")))
    .filter((f) => f && !isStillDirty(f));

/** Create the assessment + hidden answer key. Returns the new assessment id. */
export async function createAssessmentFromSubsection(
  input: CreateAssessmentInput,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  // Resolve the parent section of the clicked solution.
  const { data: clicked, error: subErr } = await supabase
    .from("notebook_subsections")
    .select("id, section_id")
    .eq("id", input.subsectionId)
    .maybeSingle();
  if (subErr || !clicked?.section_id) throw new Error("subsection_not_found");
  const sectionId = clicked.section_id as string;

  // Load ALL subsections of that section (the grouped questions), in order.
  const { data: subs } = await supabase
    .from("notebook_subsections")
    .select("id, order_index, floating_lines")
    .eq("section_id", sectionId)
    .order("order_index", { ascending: true });

  const subIds = (subs ?? []).map((s: any) => s.id as string);

  // Problem text per subsection.
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
      const tokens = cleanFillers(line.fillers);
      if (tokens.length < 2) continue; // not enough chips to solve
      const marks = Math.max(0, Number(line.marks) || 0);
      total += marks;
      lines.push({
        lineId: line.lineId,
        chips: rearrangeStream(tokens), // shuffled for the student
        marks,
      });
      answerKey.push({
        questionId: sid,
        lineId: line.lineId,
        tokens, // correct order
      });
    }
    if (lines.length === 0) continue;
    questions.push({
      id: sid,
      questionText: problemBySub.get(sid) ?? "",
      lines,
    });
  }

  if (questions.length === 0) {
    throw new Error("no_floating_lines");
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
      total_marks: total,
      questions: questions as any,
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(insErr?.message ?? "create_failed");

  const { error: keyErr } = await supabase
    .from("assessment_answer_keys")
    .insert({ assessment_id: created.id, lines: answerKey as any });
  if (keyErr) {
    // Roll back the assessment so we never leave an ungradeable shell.
    await supabase.from("assessments").delete().eq("id", created.id);
    throw new Error(keyErr.message);
  }

  return created.id as string;
}

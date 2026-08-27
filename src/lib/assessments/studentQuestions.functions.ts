import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AssessmentStudentQuestion } from "./studentQuestions";

type Db = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };

const toQuestion = (row: Record<string, any>, names?: Map<string, string>): AssessmentStudentQuestion => ({
  id: row["id"],
  assessmentId: row["assessment_id"],
  classId: row["class_id"],
  studentUserId: row["student_user_id"],
  studentName: names?.get(row["student_user_id"]) ?? undefined,
  boardQuestionId: row["board_question_id"] ?? null,
  body: row["body"] ?? "",
  answerBody: row["answer_body"] ?? null,
  answeredAt: row["answered_at"] ?? null,
  createdAt: row["created_at"],
});

/** A student attaches a question to the assessment card they are working on. */
export const askAssessmentQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        classId: z.string().uuid(),
        boardQuestionId: z.string().max(160).nullable().optional(),
        body: z.string().trim().min(3).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<AssessmentStudentQuestion> => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("assessment_student_questions")
      .insert({
        assessment_id: data.assessmentId,
        class_id: data.classId,
        student_user_id: context.userId,
        board_question_id: data.boardQuestionId ?? null,
        body: data.body,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toQuestion(row as Record<string, any>);
  });

/** The signed-in student's own questions for one assessment. */
export const listMyAssessmentQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<AssessmentStudentQuestion[]> => {
    const db = context.supabase as unknown as Db;
    const { data: rows, error } = await db
      .from("assessment_student_questions")
      .select("*")
      .eq("assessment_id", data.assessmentId)
      .eq("student_user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Record<string, any>[]).map((r) => toQuestion(r));
  });

/** Every question on a set of assessment cards, for the class teacher. */
export const listAssessmentQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ classId: z.string().uuid(), assessmentIds: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<AssessmentStudentQuestion[]> => {
    const db = context.supabase as unknown as Db;
    const { data: rows, error } = await db
      .from("assessment_student_questions")
      .select("*")
      .in("assessment_id", data.assessmentIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: nameRows } = await db.rpc("get_class_member_names", { _class_id: data.classId });
    const names = new Map(
      ((nameRows ?? []) as { user_id: string; display_name: string }[]).map((r) => [r.user_id, r.display_name]),
    );
    return ((rows ?? []) as Record<string, any>[]).map((r) => toQuestion(r, names));
  });

/** The teacher's answer stays attached to the question. */
export const answerAssessmentQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), answer: z.string().trim().min(1).max(4000) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<AssessmentStudentQuestion> => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("assessment_student_questions")
      .update({ answer_body: data.answer, answered_by: context.userId, answered_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toQuestion(row as Record<string, any>);
  });

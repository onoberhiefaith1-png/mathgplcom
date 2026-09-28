/**
 * ACADEMIA — the School's learning space (Class -> Subject -> Topic -> Subtopic
 * -> Session -> Activity). A separate system from the 3D Academy/Building.
 */
import { supabase } from "@/integrations/supabase/client";

// New tables are not yet in the generated types on first load; keep calls loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AcademiaRow = {
  id: string;
  org_id: string;
  name: string;
  visibility: "private" | "public";
  allow_teacher_assign: boolean;
};
export type Named = { id: string; name: string; position: number };
export type AcademiaClass = Named & { academia_id: string };
export type AcademiaSubject = Named & { class_id: string };
export type AcademiaTopic = Named & { subject_id: string };
export type AcademiaSubtopic = Named & { topic_id: string };

export async function ensureSchoolAcademia(orgId: string): Promise<AcademiaRow> {
  const { data: id, error } = await db.rpc("ensure_school_academia", { _org: orgId });
  if (error) throw error;
  const { data, error: e2 } = await db.from("academia").select("*").eq("id", id).single();
  if (e2) throw e2;
  return data as AcademiaRow;
}

export async function updateAcademia(id: string, patch: Partial<AcademiaRow>) {
  const { error } = await db.from("academia").update(patch).eq("id", id);
  if (error) throw error;
}

const list = async <T,>(table: string, col: string, ids: string[]): Promise<T[]> => {
  if (!ids.length) return [];
  const { data, error } = await db.from(table).select("*").in(col, ids).order("position").order("created_at");
  if (error) throw error;
  return (data ?? []) as T[];
};

export async function loadAcademiaTree(academiaId: string) {
  const classes = await list<AcademiaClass>("academia_classes", "academia_id", [academiaId]);
  const subjects = await list<AcademiaSubject>("academia_subjects", "class_id", classes.map((c) => c.id));
  const topics = await list<AcademiaTopic>("academia_topics", "subject_id", subjects.map((s) => s.id));
  const subtopics = await list<AcademiaSubtopic>("academia_subtopics", "topic_id", topics.map((t) => t.id));
  const { data: st } = subjects.length
    ? await db.from("academia_subject_teachers").select("subject_id, teacher_id").in("subject_id", subjects.map((s) => s.id))
    : { data: [] };
  return { classes, subjects, topics, subtopics, subjectTeachers: (st ?? []) as { subject_id: string; teacher_id: string }[] };
}

export async function addClass(academiaId: string, name: string, position: number) {
  const { error } = await db.from("academia_classes").insert({ academia_id: academiaId, name, position });
  if (error) throw error;
}
export async function addSubject(classId: string, name: string, position: number) {
  const { error } = await db.from("academia_subjects").insert({ class_id: classId, name, position });
  if (error) throw error;
}
export async function removeRow(table: "academia_classes" | "academia_subjects", id: string) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function setSubjectTeachers(subjectId: string, teacherIds: string[]) {
  const { error } = await db.from("academia_subject_teachers").delete().eq("subject_id", subjectId);
  if (error) throw error;
  if (teacherIds.length) {
    const { error: e2 } = await db
      .from("academia_subject_teachers")
      .insert(teacherIds.map((teacher_id) => ({ subject_id: subjectId, teacher_id })));
    if (e2) throw e2;
  }
}

// Course Builder — all reads and writes. Owner-scoped by RLS; this module
// never assumes more than the signed-in teacher's own courses.
import { supabase } from "@/integrations/supabase/client";
import {
  defaultBlockConfig,
  type BlockConfig,
  type BlockKind,
  type Course,
  type CourseBlock,
  type CourseExerciseQuestion,
  type CourseSection,
  type CourseTree,
} from "./types";

const db = supabase as unknown as { from: (t: string) => any };

export interface CourseSummary extends Course {
  sectionCount: number;
  exerciseCount: number;
  studentCount: number;
}

export const listCourses = async (): Promise<CourseSummary[]> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "";
  const { data, error } = await db
    .from("courses")
    .select("*")
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const courses = (data ?? []) as Course[];
  if (courses.length === 0) return [];

  const ids = courses.map((c) => c.id);
  const { data: sectionRows } = await db
    .from("course_sections")
    .select("id, course_id")
    .in("course_id", ids);
  const sections = (sectionRows ?? []) as { id: string; course_id: string }[];
  const sectionToCourse = new Map(sections.map((s) => [s.id, s.course_id]));

  const exercisesByCourse = new Map<string, number>();
  if (sections.length > 0) {
    const { data: blockRows } = await db
      .from("course_blocks")
      .select("section_id, kind")
      .in("section_id", sections.map((s) => s.id));
    for (const b of (blockRows ?? []) as { section_id: string; kind: string }[]) {
      if (b.kind !== "exercise") continue;
      const cid = sectionToCourse.get(b.section_id);
      if (!cid) continue;
      exercisesByCourse.set(cid, (exercisesByCourse.get(cid) ?? 0) + 1);
    }
  }

  const sectionCounts = new Map<string, number>();
  for (const s of sections) {
    sectionCounts.set(s.course_id, (sectionCounts.get(s.course_id) ?? 0) + 1);
  }

  return courses.map((c) => ({
    ...c,
    sectionCount: sectionCounts.get(c.id) ?? 0,
    exerciseCount: exercisesByCourse.get(c.id) ?? 0,
    studentCount: 0,
  }));
};

export const createCourse = async (title = "Untitled course"): Promise<Course> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_signed_in");
  const { data, error } = await db
    .from("courses")
    .insert({ owner_id: uid, title })
    .select("*")
    .single();
  if (error) throw error;
  return data as Course;
};

export const updateCourse = async (id: string, patch: Partial<Course>): Promise<void> => {
  const { error } = await db.from("courses").update(patch).eq("id", id);
  if (error) throw error;
};

export const deleteCourse = async (id: string): Promise<void> => {
  const { error } = await db.from("courses").delete().eq("id", id);
  if (error) throw error;
};

export const loadCourseTree = async (id: string): Promise<CourseTree> => {
  const { data: course, error } = await db.from("courses").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: sectionRows } = await db
    .from("course_sections")
    .select("*")
    .eq("course_id", id)
    .order("position", { ascending: true });
  const sections = (sectionRows ?? []) as CourseSection[];
  let blocks: CourseBlock[] = [];
  let questions: CourseExerciseQuestion[] = [];
  if (sections.length > 0) {
    const { data: blockRows } = await db
      .from("course_blocks")
      .select("*")
      .in("section_id", sections.map((s) => s.id))
      .order("position", { ascending: true });
    blocks = ((blockRows ?? []) as CourseBlock[]).map((b) => ({
      ...b,
      config: (b.config ?? {}) as BlockConfig,
    }));
    if (blocks.length > 0) {
      const { data: qRows } = await db
        .from("course_exercise_questions")
        .select("*")
        .in("block_id", blocks.map((b) => b.id))
        .order("position", { ascending: true });
      questions = (qRows ?? []) as CourseExerciseQuestion[];
    }
  }
  return { course: course as Course, sections, blocks, questions };
};

export const addSection = async (courseId: string, position: number): Promise<CourseSection> => {
  const { data, error } = await db
    .from("course_sections")
    .insert({ course_id: courseId, title: `Section ${position + 1}`, position })
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseSection;
};

export const updateSection = async (id: string, patch: Partial<CourseSection>): Promise<void> => {
  const { error } = await db.from("course_sections").update(patch).eq("id", id);
  if (error) throw error;
};

export const deleteSection = async (id: string): Promise<void> => {
  const { error } = await db.from("course_sections").delete().eq("id", id);
  if (error) throw error;
};

export const addBlock = async (
  sectionId: string,
  kind: BlockKind,
  position: number,
): Promise<CourseBlock> => {
  const { data, error } = await db
    .from("course_blocks")
    .insert({ section_id: sectionId, kind, position, config: defaultBlockConfig(kind) })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as CourseBlock;
  return { ...row, config: (row.config ?? {}) as BlockConfig };
};

export const updateBlockConfig = async (id: string, config: BlockConfig): Promise<void> => {
  const { error } = await db.from("course_blocks").update({ config }).eq("id", id);
  if (error) throw error;
};

export const moveBlock = async (id: string, position: number): Promise<void> => {
  const { error } = await db.from("course_blocks").update({ position }).eq("id", id);
  if (error) throw error;
};

export const deleteBlock = async (id: string): Promise<void> => {
  const { error } = await db.from("course_blocks").delete().eq("id", id);
  if (error) throw error;
};

/** Deep copy of a course, its sections, blocks and question links. */
export const duplicateCourse = async (id: string): Promise<Course> => {
  const tree = await loadCourseTree(id);
  const { id: _id, owner_id: _owner, ...rest } = tree.course;
  const copy = await createCourse(`${tree.course.title} (copy)`);
  await updateCourse(copy.id, { ...rest, title: `${tree.course.title} (copy)`, status: "draft" });
  for (const section of tree.sections) {
    const newSection = await addSection(copy.id, section.position);
    await updateSection(newSection.id, { title: section.title });
    for (const block of tree.blocks.filter((b) => b.section_id === section.id)) {
      const newBlock = await addBlock(newSection.id, block.kind, block.position);
      await updateBlockConfig(newBlock.id, block.config ?? {});
      for (const q of tree.questions.filter((x) => x.block_id === block.id)) {
        await db.from("course_exercise_questions").insert({
          block_id: newBlock.id,
          position: q.position,
          notebook_id: q.notebook_id,
          subsection_id: q.subsection_id,
          section_id: q.section_id,
          question_key: q.question_key,
          label: q.label,
          total_marks: q.total_marks,
        });
      }
    }
  }
  return { ...copy, title: `${tree.course.title} (copy)` };
};

/** Link a lesson-note question block to an Exercise Card. Never duplicates
 *  the question itself — only the reference is stored. */
export const linkQuestionToExercise = async (args: {
  blockId: string;
  notebookId: string;
  subsectionId: string | null;
  sectionId: string | null;
  questionKey: string | null;
  label: string;
  totalMarks: number;
}): Promise<void> => {
  const { data: existing } = await db
    .from("course_exercise_questions")
    .select("id")
    .eq("block_id", args.blockId)
    .eq("subsection_id", args.subsectionId ?? "")
    .maybeSingle();
  if (existing) return;
  const { count } = await db
    .from("course_exercise_questions")
    .select("id", { count: "exact", head: true })
    .eq("block_id", args.blockId);
  const { error } = await db.from("course_exercise_questions").insert({
    block_id: args.blockId,
    position: count ?? 0,
    notebook_id: args.notebookId,
    subsection_id: args.subsectionId,
    section_id: args.sectionId,
    question_key: args.questionKey,
    label: args.label,
    total_marks: args.totalMarks,
  });
  if (error) throw error;
};

/** Courses → sections → exercise cards, for the Assign picker. */
export interface AssignTargets {
  courses: { id: string; title: string }[];
  sections: { id: string; course_id: string; title: string }[];
  exercises: { id: string; section_id: string; name: string }[];
}

export const loadAssignTargets = async (): Promise<AssignTargets> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "";
  const { data: courseRows } = await db
    .from("courses")
    .select("id, title")
    .eq("owner_id", uid)
    .order("title", { ascending: true });
  const courses = (courseRows ?? []) as { id: string; title: string }[];
  if (courses.length === 0) return { courses: [], sections: [], exercises: [] };
  const { data: sectionRows } = await db
    .from("course_sections")
    .select("id, course_id, title")
    .in("course_id", courses.map((c) => c.id))
    .order("position", { ascending: true });
  const sections = (sectionRows ?? []) as { id: string; course_id: string; title: string }[];
  let exercises: { id: string; section_id: string; name: string }[] = [];
  if (sections.length > 0) {
    const { data: blockRows } = await db
      .from("course_blocks")
      .select("id, section_id, kind, config")
      .in("section_id", sections.map((s) => s.id))
      .eq("kind", "exercise")
      .order("position", { ascending: true });
    exercises = ((blockRows ?? []) as { id: string; section_id: string; config: BlockConfig }[]).map(
      (b) => ({ id: b.id, section_id: b.section_id, name: b.config?.name || "Exercise" }),
    );
  }
  return { courses, sections, exercises };
};

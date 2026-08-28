// Class ⇄ Course wiring. A class never owns a course: it only holds an
// ordered list of references (the learning pathway) plus one learning mode.
import { supabase } from "@/integrations/supabase/client";
import type { Course } from "./types";

const db = supabase as unknown as { from: (t: string) => any };

export type LearningMode = "sequential" | "free";
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export interface ClassCourse {
  assignmentId: string;
  displayOrder: number;
  course: Course;
  /** False when the course row itself could not be read (e.g. removed, or not
   *  shared with this reader) — the pathway position is still kept. */
  available: boolean;
}

export interface ClassCourseSettings {
  learning_mode: LearningMode;
  allow_revisit: boolean;
}

export interface CourseProgressRow {
  course_id: string;
  status: ProgressStatus;
  progress: number;
  score: number | null;
  completed_at: string | null;
}

/** The ordered pathway for a class. Course rows come from the single source
 *  of truth (`courses`) — nothing is duplicated per class. A row whose course
 *  cannot be read is never dropped, so numbering never shifts. */
export const listClassCourses = async (classId: string): Promise<ClassCourse[]> => {
  const { data, error } = await db
    .from("class_course_assignments")
    .select("id, display_order, course_id, courses(*)")
    .eq("class_id", classId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { id: string; display_order: number; course_id: string; courses: Course | null }[]).map(
    (r) => ({
      assignmentId: r.id,
      displayOrder: r.display_order,
      available: !!r.courses,
      course:
        r.courses ??
        ({ id: r.course_id, title: "", status: "draft" } as unknown as Course),
    }),
  );
};


export const assignCourseToClass = async (classId: string, courseId: string): Promise<void> => {
  const { count } = await db
    .from("class_course_assignments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);
  const { error } = await db
    .from("class_course_assignments")
    .insert({ class_id: classId, course_id: courseId, display_order: count ?? 0 });
  if (error && !/duplicate key/i.test(error.message)) throw error;
};

export const removeClassCourse = async (assignmentId: string): Promise<void> => {
  const { error } = await db.from("class_course_assignments").delete().eq("id", assignmentId);
  if (error) throw error;
};

/** Persist an explicit ordering (drag-drop or move up/down) in one pass. */
export const reorderClassCourses = async (ordered: { assignmentId: string }[]): Promise<void> => {
  await Promise.all(
    ordered.map((row, i) =>
      db.from("class_course_assignments").update({ display_order: i }).eq("id", row.assignmentId),
    ),
  );
};

export const getClassCourseSettings = async (classId: string): Promise<ClassCourseSettings> => {
  const { data } = await db
    .from("class_course_settings")
    .select("learning_mode, allow_revisit")
    .eq("class_id", classId)
    .maybeSingle();
  return {
    learning_mode: ((data?.learning_mode as LearningMode) ?? "free"),
    allow_revisit: data?.allow_revisit ?? true,
  };
};

export const setClassCourseSettings = async (
  classId: string,
  patch: Partial<ClassCourseSettings>,
): Promise<void> => {
  const { error } = await db
    .from("class_course_settings")
    .upsert({ class_id: classId, ...patch }, { onConflict: "class_id" });
  if (error) throw error;
};

/** Progress rows for the signed-in student in this class. */
export const myCourseProgress = async (classId: string): Promise<CourseProgressRow[]> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];
  const { data } = await db
    .from("student_course_progress")
    .select("course_id, status, progress, score, completed_at")
    .eq("class_id", classId)
    .eq("student_id", uid);
  return (data ?? []) as CourseProgressRow[];
};

export const markCourseProgress = async (args: {
  classId: string;
  courseId: string;
  status: ProgressStatus;
  progress: number;
}): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  const now = new Date().toISOString();
  const { error } = await db.from("student_course_progress").upsert(
    {
      student_id: uid,
      class_id: args.classId,
      course_id: args.courseId,
      status: args.status,
      progress: Math.max(0, Math.min(100, Math.round(args.progress))),
      started_at: now,
      completed_at: args.status === "completed" ? now : null,
    },
    { onConflict: "student_id,class_id,course_id" },
  );
  if (error) throw error;
};

/** Sequential mode: a course unlocks only when every earlier one is done.
 *  A course that cannot be read never blocks the pathway. */
export const unlockedFlags = (
  pathway: { course: Course; available?: boolean }[],
  progress: CourseProgressRow[],
  mode: LearningMode,
): boolean[] => {
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.course_id));
  if (mode === "free") return pathway.map(() => true);
  let blocked = false;
  return pathway.map(({ course, available }) => {
    if (blocked) return false;
    if (available === false) return true;
    if (!done.has(course.id)) blocked = true;
    return true;
  });
};


/** Classes owned by the signed-in teacher — for "Assign to class". */
export const listOwnedClasses = async (): Promise<{ id: string; name: string }[]> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? "";
  const { data } = await db
    .from("classes")
    .select("id, name")
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });
  return (data ?? []) as { id: string; name: string }[];
};

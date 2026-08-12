/**
 * The school's read-only window into a connected member's Shared Workspace.
 *
 * Everything here reads material the member created *inside this school* —
 * scoped by the school's org id and the member's own id — so a member's
 * Personal Workspace can never appear. Nothing in this module writes: the
 * school views, monitors and reviews; the member creates and edits.
 */
import { supabase } from "@/integrations/supabase/client";

export type SharedNote = {
  id: string;
  title: string;
  subject: string | null;
  subtopic: string | null;
  updatedAt: string | null;
  colorIndex: number;
  coverConfig: unknown;
  teacher: string | null;
  className: string | null;
  session: string | null;
};

export async function fetchSharedNotes(orgId: string, userId: string): Promise<SharedNote[]> {
  const { data, error } = await supabase
    .from("notebooks")
    .select("id, title, subject, subtopic, updated_at, color_index, cover_config, teacher, class_name, session")
    .eq("org_id", orgId)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((n) => ({
    id: String(n.id),
    title: (n.title as string) || "Untitled lesson note",
    subject: (n.subject as string | null) ?? null,
    subtopic: (n.subtopic as string | null) ?? null,
    updatedAt: (n.updated_at as string | null) ?? null,
    colorIndex: Number(n.color_index ?? 0),
    coverConfig: n.cover_config ?? null,
    teacher: (n.teacher as string | null) ?? null,
    className: (n.class_name as string | null) ?? null,
    session: (n.session as string | null) ?? null,
  }));
}

export type SharedNoteDetail = SharedNote & { documentJson: unknown };

export async function fetchSharedNote(
  orgId: string,
  userId: string,
  noteId: string,
): Promise<SharedNoteDetail | null> {
  const { data, error } = await supabase
    .from("notebooks")
    .select(
      "id, title, subject, subtopic, updated_at, color_index, cover_config, teacher, class_name, session, document_json",
    )
    .eq("id", noteId)
    .eq("org_id", orgId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  const n = data as Record<string, unknown> | null;
  if (!n) return null;
  return {
    id: String(n.id),
    title: (n.title as string) || "Untitled lesson note",
    subject: (n.subject as string | null) ?? null,
    subtopic: (n.subtopic as string | null) ?? null,
    updatedAt: (n.updated_at as string | null) ?? null,
    colorIndex: Number(n.color_index ?? 0),
    coverConfig: n.cover_config ?? null,
    teacher: (n.teacher as string | null) ?? null,
    className: (n.class_name as string | null) ?? null,
    session: (n.session as string | null) ?? null,
    documentJson: n.document_json ?? null,
  };
}

export type SharedClass = { id: string; name: string; createdAt: string | null; boardOpen: boolean };

export async function fetchSharedClasses(orgId: string, userId: string): Promise<SharedClass[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, created_at, smartboard_visibility")
    .eq("org_id", orgId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    name: (c.name as string) || "Class",
    createdAt: (c.created_at as string | null) ?? null,
    boardOpen: c.smartboard_visibility === "student_access_enabled",
  }));
}

export type SharedClassDetail = {
  id: string;
  name: string;
  students: { userId: string; displayName: string }[];
  assignments: { id: string; title: string; status: string | null; dueAt: string | null }[];
  adventures: number;
  avgProgress: number;
};

export async function fetchSharedClassDetail(classId: string): Promise<SharedClassDetail | null> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw error;
  if (!cls) return null;

  const [names, assignments, adventures, progress] = await Promise.all([
    supabase.rpc("get_class_member_names", { _class_id: classId }),
    supabase
      .from("learning_assignments")
      .select("id, title, status, due_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false }),
    supabase.from("class_games").select("id", { count: "exact", head: true }).eq("class_id", classId),
    supabase.from("student_course_progress").select("progress").eq("class_id", classId),
  ]);

  const rows = (progress.data ?? []) as { progress: number | null }[];
  const avg = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + Number(r.progress ?? 0), 0) / rows.length)
    : 0;

  return {
    id: String((cls as { id: string }).id),
    name: ((cls as { name: string | null }).name) || "Class",
    students: ((names.data ?? []) as { user_id: string; display_name: string | null }[]).map((s) => ({
      userId: s.user_id,
      displayName: s.display_name || "Student",
    })),
    assignments: ((assignments.data ?? []) as Record<string, unknown>[]).map((a) => ({
      id: String(a.id),
      title: (a.title as string) || "Assignment",
      status: (a.status as string | null) ?? null,
      dueAt: (a.due_at as string | null) ?? null,
    })),
    adventures: adventures.count ?? 0,
    avgProgress: avg,
  };
}

export type SharedAdventure = {
  id: string;
  title: string;
  topic: string | null;
  subtopic: string | null;
  scenes: number;
  updatedAt: string | null;
};

export async function fetchSharedAdventures(orgId: string, userId: string): Promise<SharedAdventure[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, title, topic, subtopic, canvas, updated_at")
    .eq("org_id", orgId)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((g) => {
    const canvas = g.canvas as { scenes?: unknown[] } | null;
    return {
      id: String(g.id),
      title: (g.title as string) || "Untitled adventure",
      topic: (g.topic as string | null) ?? null,
      subtopic: (g.subtopic as string | null) ?? null,
      scenes: Array.isArray(canvas?.scenes) ? canvas!.scenes!.length : 0,
      updatedAt: (g.updated_at as string | null) ?? null,
    };
  });
}

export type SharedCourse = {
  id: string;
  title: string;
  subject: string | null;
  topic: string | null;
  status: string | null;
  learningMode: string | null;
  sections: { id: string; title: string; kind: string | null; blocks: number }[];
};

export async function fetchSharedCourses(orgId: string, userId: string): Promise<SharedCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, subject, topic, status, learning_mode")
    .eq("org_id", orgId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const courses = (data ?? []) as Record<string, unknown>[];
  if (courses.length === 0) return [];

  const ids = courses.map((c) => String(c.id));
  const { data: sectionRows } = await supabase
    .from("course_sections")
    .select("id, course_id, title, position")
    .in("course_id", ids)
    .order("position", { ascending: true });
  const sections = (sectionRows ?? []) as Record<string, unknown>[];

  const blockCounts = new Map<string, number>();
  if (sections.length > 0) {
    const { data: blocks } = await supabase
      .from("course_blocks")
      .select("id, section_id")
      .in("section_id", sections.map((s) => String(s.id)));
    for (const b of (blocks ?? []) as { section_id: string }[]) {
      blockCounts.set(b.section_id, (blockCounts.get(b.section_id) ?? 0) + 1);
    }
  }

  return courses.map((c) => ({
    id: String(c.id),
    title: (c.title as string) || "Untitled course",
    subject: (c.subject as string | null) ?? null,
    topic: (c.topic as string | null) ?? null,
    status: (c.status as string | null) ?? null,
    learningMode: (c.learning_mode as string | null) ?? null,
    sections: sections
      .filter((s) => String(s.course_id) === String(c.id))
      .map((s) => ({
        id: String(s.id),
        title: (s.title as string) || "Section",
        kind: (s.kind as string | null) ?? null,
        blocks: blockCounts.get(String(s.id)) ?? 0,
      })),
  }));
}

/** Counts used on the shared-workspace hub cards. */
export type SharedCounts = { notes: number; classes: number; adventures: number; courses: number };

export async function fetchSharedCounts(orgId: string, userId: string): Promise<SharedCounts> {
  const scoped = (table: "notebooks" | "classes" | "games" | "courses") =>
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("owner_id", userId);

  const [notes, classes, adventures, courses] = await Promise.all([
    scoped("notebooks"),
    scoped("classes"),
    scoped("games"),
    scoped("courses"),
  ]);

  return {
    notes: notes.count ?? 0,
    classes: classes.count ?? 0,
    adventures: adventures.count ?? 0,
    courses: courses.count ?? 0,
  };
}

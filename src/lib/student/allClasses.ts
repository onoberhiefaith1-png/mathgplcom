/**
 * The student's learning across every class they belong to.
 *
 * The Student Dashboard is a global view: assignments, adventures and Skill
 * Builder pathways from all enrolled classes at once. Each helper here simply
 * reads what the teacher already created — nothing is created, edited or
 * invented — and stays inside the active workspace, so School A's work never
 * appears while School B is active.
 */
import { supabase } from "@/integrations/supabase/client";
import { activeSchoolOrgId, viewOwnerId } from "@/lib/accounts/workspaceScope";
import { currentViewAs } from "@/lib/accounts/viewAsScope";

import {
  getClassCourseSettings,
  listClassCourses,
  unlockedFlags,
  type LearningMode,
} from "@/lib/courses/classCourses";
import { listAdventureNotes, type ClassAdventureNoteRow } from "@/lib/adventures/classAdventures";
import { grantedWorkspaces } from "./workspaceAccess";


export type EnrolledClass = { id: string; name: string };

/** The student whose learning a page shows (a school may be viewing it). */
async function ownerId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ? viewOwnerId(data.user.id) : null;
}

/**
 * Every class the student belongs to *and* has activated.
 *
 * A class only counts once the student has walked through its school's or
 * teacher's building and passed that gateway. Being enrolled is not enough:
 * connection and workspace access are two different things.
 */
export async function myClasses(): Promise<EnrolledClass[]> {
  const uid = await ownerId();
  if (!uid) return [];
  const viewing = currentViewAs();
  // A teacher looking at a student sees only the classes they teach them in.
  const allowed = viewing?.classIds ?? null;

  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", uid);
  let ids = ((memberships ?? []) as { class_id: string }[]).map((m) => m.class_id);
  if (allowed) ids = ids.filter((id) => allowed.includes(id));
  if (ids.length === 0) return [];

  const { data } = await supabase.from("classes").select("id, name, org_id, owner_id").in("id", ids);
  let rows = (data ?? []) as { id: string; name: string | null; org_id: string | null; owner_id: string | null }[];

  if (viewing) {
    // A school or teacher observing this student stays inside their own context.
    const orgId = await activeSchoolOrgId();
    rows = rows.filter((c) => (orgId ? c.org_id === orgId : c.org_id === null));
  } else {
    const granted = await grantedWorkspaces();
    const orgs = new Set(granted.orgIds);
    const owners = new Set(granted.ownerIds);
    rows = rows.filter((c) => (c.org_id ? orgs.has(c.org_id) : Boolean(c.owner_id && owners.has(c.owner_id))));
  }

  return rows.map((c) => ({ id: c.id, name: c.name ?? "Class" }));
}



export type ClassProgress = EnrolledClass & { progress: number };

/** Per-class progress plus the overall average, from the existing course progress. */
export async function myProgress(): Promise<{ overall: number; classes: ClassProgress[] }> {
  const uid = await ownerId();
  const classes = await myClasses();
  if (!uid || classes.length === 0) return { overall: 0, classes: classes.map((c) => ({ ...c, progress: 0 })) };

  const { data } = await supabase
    .from("student_course_progress")
    .select("class_id, progress")
    .eq("student_id", uid)
    .in("class_id", classes.map((c) => c.id));

  const rows = (data ?? []) as { class_id: string; progress: number | null }[];
  const per = classes.map((c) => {
    const mine = rows.filter((r) => r.class_id === c.id);
    const value =
      mine.length === 0
        ? 0
        : Math.round(mine.reduce((sum, r) => sum + Number(r.progress ?? 0), 0) / mine.length);
    return { ...c, progress: value };
  });

  const scored = per.filter((c) => c.progress > 0);
  const overall = scored.length === 0 ? 0 : Math.round(scored.reduce((s, c) => s + c.progress, 0) / scored.length);
  return { overall, classes: per };
}

export type GlobalAssignment = {
  classId: string;
  className: string;
  notebookId: string;
  title: string;
  subtopic: string | null;
  dueAt: string | null;
  completed: boolean;
};

/** Assignments from every enrolled class, newest first, tagged with its class. */
export async function myAssignments(): Promise<GlobalAssignment[]> {
  const uid = await ownerId();
  const classes = await myClasses();
  if (!uid || classes.length === 0) return [];
  const classById = new Map(classes.map((c) => [c.id, c.name]));

  const { data } = await supabase
    .from("assessments")
    .select("id, title, kind, notebook_id, class_id, assigned_at, due_at, unassigned_at")
    .in("class_id", classes.map((c) => c.id))
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false });

  const rows = ((data ?? []) as {
    id: string;
    title: string | null;
    kind: string | null;
    notebook_id: string | null;
    class_id: string;
    due_at: string | null;
  }[]).filter((r) =>
    r.kind !== "adventure" &&
    r.notebook_id &&
    (!r.due_at || Date.parse(r.due_at) > Date.now()),
  );
  if (rows.length === 0) return [];

  const [{ data: progress }, { data: notebooks }] = await Promise.all([
    supabase
      .from("assessment_progress")
      .select("assessment_id, status")
      .eq("student_id", uid)
      .in("assessment_id", rows.map((r) => r.id)),
    supabase
      .from("notebooks")
      .select("id, title, subtopic")
      .in("id", Array.from(new Set(rows.map((r) => r.notebook_id as string)))),
  ]);

  const done = new Set(
    ((progress ?? []) as { assessment_id: string; status: string | null }[])
      .filter((p) => p.status === "completed" || p.status === "submitted")
      .map((p) => p.assessment_id),
  );
  const meta = new Map(
    ((notebooks ?? []) as { id: string; title: string | null; subtopic: string | null }[]).map((n) => [n.id, n]),
  );

  // One card per lesson note per class: that is the unit a student opens.
  const seen = new Set<string>();
  const out: GlobalAssignment[] = [];
  for (const row of rows) {
    const notebookId = row.notebook_id as string;
    const key = `${row.class_id}:${notebookId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const note = meta.get(notebookId);
    out.push({
      classId: row.class_id,
      className: classById.get(row.class_id) ?? "Class",
      notebookId,
      title: note?.title ?? row.title ?? "Assignment",
      subtopic: note?.subtopic ?? null,
      dueAt: row.due_at,
      completed: rows
        .filter((r) => r.class_id === row.class_id && r.notebook_id === notebookId)
        .every((r) => done.has(r.id)),
    });
  }
  return out;
}

export type GlobalAdventure = {
  classId: string;
  className: string;
  id: string;
  notebookId: string;
  title: string;
  detail: string | null;
  dueAt: string | null;
};

/** Adventures from every enrolled class — to play, never to edit. */
export async function myAdventures(): Promise<GlobalAdventure[]> {
  const classes = await myClasses();
  if (classes.length === 0) return [];
  const lists = await Promise.all(classes.map((c) => listAdventureNotes(c.id)));

  return classes.flatMap((c, i) =>
    (lists[i] as ClassAdventureNoteRow[]).map((row) => ({
      classId: c.id,
      className: c.name,
      id: row.id,
      notebookId: row.notebook_id,
      title: row.notebook?.title ?? "Adventure",
      detail: row.section?.title ?? row.notebook?.subtopic ?? row.notebook?.subject ?? null,
      dueAt: row.due_at,
    })),
  );
}

export type GlobalSkill = {
  classId: string;
  className: string;
  courseId: string;
  title: string;
  mode: LearningMode;
  unlocked: boolean;
  status: string;
  blockedBy: string | null;
};

/** Skill Builder pathways from every enrolled class, honouring the teacher's locks. */
export async function mySkillBuilders(): Promise<GlobalSkill[]> {
  const uid = await ownerId();
  const classes = await myClasses();
  if (!uid || classes.length === 0) return [];

  const results = await Promise.all(
    classes.map(async (cls) => {
      const [pathway, settings, progress] = await Promise.all([
        listClassCourses(cls.id),
        getClassCourseSettings(cls.id),
        supabase
          .from("student_course_progress")
          .select("course_id, status")
          .eq("student_id", uid)
          .eq("class_id", cls.id),
      ]);
      const rows = ((progress.data ?? []) as { course_id: string; status: string | null }[]).map((r) => ({
        course_id: r.course_id,
        status: (r.status ?? "not_started") as "not_started" | "in_progress" | "completed",
        progress: 0,
        score: null,
        completed_at: null,
      }));
      const unlocked = unlockedFlags(pathway, rows, settings.learning_mode);

      return pathway.map((entry, i) => ({
        classId: cls.id,
        className: cls.name,
        courseId: entry.course.id,
        title: entry.course.title || "Untitled course",
        mode: settings.learning_mode,
        unlocked: unlocked[i] ?? true,
        status: rows.find((r) => r.course_id === entry.course.id)?.status ?? "not_started",
        blockedBy: pathway[i - 1]?.course.title ?? null,
      }));
    }),
  );

  return results.flat();
}

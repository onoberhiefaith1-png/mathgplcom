/**
 * Dashboard statistics.
 *
 * Every number here is a real count read from the database and scoped to the
 * workspace the person is currently operating in. Nothing is estimated and
 * nothing is invented: when a figure has no backing data it comes back as 0 so
 * the dashboard can show an honest empty state.
 *
 * Workspace isolation: a class belongs to a workspace (`classes.org_id`), and
 * everything inside a class — assignments, adventures, progress — inherits that
 * workspace through its class. So School A's work can never appear while School
 * B is the active workspace.
 */
import { supabase } from "@/integrations/supabase/client";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";

export type StatValue = { value: number; suffix?: string };

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  at: string | null;
};

export type TeacherStats = {
  schools: number;
  students: number;
  classes: number;
  assignments: number;
  activity: ActivityItem[];
};

export type SchoolStats = {
  teachers: number;
  students: number;
  classes: number;
  pendingRequests: number;
  activity: ActivityItem[];
};

export type StudentStats = {
  schools: number;
  classes: number;
  assignments: number;
  adventures: number;
  /** Average course progress in this workspace, 0–100. */
  progress: number;
  activity: ActivityItem[];
};

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);

/** Class ids owned by this teacher inside the active workspace. */
async function ownedClassIds(userId: string, orgId: string | null): Promise<string[]> {
  // Internal holder classes (Live, Smart Cards, Floating Number tests) are not
  // teaching classes and must never appear in workspace counts.
  const base = supabase
    .from("classes")
    .select("id")
    .eq("owner_id", userId)
    .eq("workspace", "classroom");
  const { data } = await (orgId ? base.eq("org_id", orgId) : base.is("org_id", null));
  return ids(data as { id: string }[] | null);
}

/** Class ids this student has joined inside the active workspace. */
async function joinedClassIds(userId: string, orgId: string | null): Promise<string[]> {
  const { data } = await supabase.from("class_members").select("class_id").eq("user_id", userId);
  const classIds = ((data ?? []) as { class_id: string }[]).map((r) => r.class_id);
  if (classIds.length === 0) return [];

  const scoped = supabase.from("classes").select("id").in("id", classIds);
  const { data: rows } = await (orgId ? scoped.eq("org_id", orgId) : scoped.is("org_id", null));
  return ids(rows as { id: string }[] | null);
}

const countIn = async (table: "learning_assignments" | "adventure_games", classIds: string[]) => {
  if (classIds.length === 0) return 0;
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("class_id", classIds);
  return count ?? 0;
};

async function recentNotebooks(userId: string, orgId: string | null): Promise<ActivityItem[]> {
  const base = supabase
    .from("notebooks")
    .select("id, title, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(5);
  const { data } = await (orgId ? base.eq("org_id", orgId) : base.is("org_id", null));
  return ((data ?? []) as { id: string; title: string | null; updated_at: string | null }[]).map((n) => ({
    id: n.id,
    title: n.title || "Untitled lesson note",
    detail: "Lesson note updated",
    at: n.updated_at,
  }));
}

export async function fetchTeacherStats(): Promise<TeacherStats> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { schools: 0, students: 0, classes: 0, assignments: 0, activity: [] };

  const orgId = await activeSchoolOrgId();
  const [classIds, workspaces, activity] = await Promise.all([
    ownedClassIds(user.id, orgId),
    supabase.rpc("my_workspaces"),
    recentNotebooks(user.id, orgId),
  ]);

  const schools = ((workspaces.data ?? []) as { kind: string; is_owner: boolean; status: string }[]).filter(
    (w) => w.kind === "school" && !w.is_owner && w.status === "active",
  ).length;

  let students = 0;
  if (classIds.length > 0) {
    const { data: members } = await supabase.from("class_members").select("user_id").in("class_id", classIds);
    students = new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id)).size;
  }

  return {
    schools,
    students,
    classes: classIds.length,
    assignments: await countIn("learning_assignments", classIds),
    activity,
  };
}

export async function fetchSchoolStats(orgId: string | null): Promise<SchoolStats> {
  if (!orgId) return { teachers: 0, students: 0, classes: 0, pendingRequests: 0, activity: [] };

  const [teachers, students, classes, counts] = await Promise.all([
    supabase.rpc("school_teachers", { _org_id: orgId }),
    supabase.rpc("workspace_students", { _org_id: orgId }),
    supabase.from("classes").select("id, name, created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.rpc("my_connection_counts"),
  ]);

  const classRows = (classes.data ?? []) as { id: string; name: string | null; created_at: string | null }[];
  const countRow = Array.isArray(counts.data) ? counts.data[0] : counts.data;

  return {
    teachers: ((teachers.data ?? []) as unknown[]).length,
    students: ((students.data ?? []) as unknown[]).length,
    classes: classRows.length,
    pendingRequests: Number((countRow as { pending_incoming?: number } | null)?.pending_incoming ?? 0),
    activity: classRows.slice(0, 5).map((c) => ({
      id: c.id,
      title: c.name || "Class",
      detail: "Class in this school",
      at: c.created_at,
    })),
  };
}

export async function fetchStudentStats(): Promise<StudentStats> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { schools: 0, classes: 0, assignments: 0, adventures: 0, progress: 0, activity: [] };

  const orgId = await activeSchoolOrgId();
  const [classIds, workspaces] = await Promise.all([joinedClassIds(user.id, orgId), supabase.rpc("my_workspaces")]);

  const schools = ((workspaces.data ?? []) as { kind: string; is_owner: boolean; status: string }[]).filter(
    (w) => w.kind === "school" && !w.is_owner && w.status === "active",
  ).length;

  const [assignments, adventures] = await Promise.all([
    countIn("learning_assignments", classIds),
    countIn("adventure_games", classIds),
  ]);

  let progress = 0;
  let activity: ActivityItem[] = [];
  if (classIds.length > 0) {
    const { data: rows } = await supabase
      .from("student_course_progress")
      .select("id, progress, updated_at, status")
      .eq("student_id", user.id)
      .in("class_id", classIds)
      .order("updated_at", { ascending: false })
      .limit(20);
    const progressRows = (rows ?? []) as { id: string; progress: number | null; updated_at: string | null; status: string | null }[];
    if (progressRows.length > 0) {
      progress = Math.round(
        progressRows.reduce((sum, r) => sum + Number(r.progress ?? 0), 0) / progressRows.length,
      );
    }
    activity = progressRows.slice(0, 5).map((r) => ({
      id: r.id,
      title: `Course progress ${Math.round(Number(r.progress ?? 0))}%`,
      detail: r.status ? `Status: ${r.status}` : "Course activity",
      at: r.updated_at,
    }));
  }

  return { schools, classes: classIds.length, assignments, adventures, progress, activity };
}

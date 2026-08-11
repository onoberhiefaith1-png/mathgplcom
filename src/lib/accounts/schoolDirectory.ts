/**
 * School oversight reads.
 *
 * A school administrator never authors anything inside a member's workspace —
 * these helpers only read, and every function behind them asserts that the
 * caller owns the school, so nothing can leak across schools.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./roles";

export type SchoolPerson = {
  userId: string;
  displayName: string;
  /** Public identity. Never an email address. */
  username: string | null;
  avatarUrl: string | null;
  mathgplId: string | null;
  status: string;
  connectionStatus: string | null;
};

export async function fetchSchoolTeachers(orgId: string): Promise<SchoolPerson[]> {
  const { data, error } = await supabase.rpc("school_teachers", { _org_id: orgId });
  if (error) throw error;
  return (
    (data ?? []) as {
      user_id: string;
      display_name: string;
      username: string | null;
      avatar_url: string | null;
      mathgpl_id: string | null;
      status: string;
      connection_status: string | null;
    }[]
  ).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name ?? "Teacher",
    username: r.username ?? null,
    avatarUrl: r.avatar_url ?? null,
    mathgplId: r.mathgpl_id,
    status: r.status ?? "active",
    connectionStatus: r.connection_status ?? "connected",
  }));
}


export async function fetchSchoolStudents(orgId: string): Promise<SchoolPerson[]> {
  const { data, error } = await supabase.rpc("workspace_students", { _org_id: orgId });
  if (error) throw error;
  return (
    (data ?? []) as { user_id: string; display_name: string; mathgpl_student_id: string | null; status: string }[]
  ).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name ?? "Student",
    username: null,
    avatarUrl: null,
    connectionStatus: null,
    mathgplId: r.mathgpl_student_id,
    status: r.status ?? "active",

  }));
}

export type MemberOverview = {
  displayName: string;
  mathgplId: string | null;
  role: AppRole;
  status: string;
  classes: number;
  students: number;
  lessonNotes: number;
  assignments: number;
  adventures: number;
  avgProgress: number;
};

export async function fetchMemberOverview(orgId: string, userId: string): Promise<MemberOverview | null> {
  const { data, error } = await supabase.rpc("school_member_overview", { _org_id: orgId, _user_id: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    displayName: String(row.display_name ?? "Member"),
    mathgplId: (row.mathgpl_id as string | null) ?? null,
    role: (row.role as AppRole) ?? "teacher",
    status: String(row.status ?? "active"),
    classes: Number(row.classes ?? 0),
    students: Number(row.students ?? 0),
    lessonNotes: Number(row.lesson_notes ?? 0),
    assignments: Number(row.assignments ?? 0),
    adventures: Number(row.adventures ?? 0),
    avgProgress: Math.round(Number(row.avg_progress ?? 0)),
  };
}

export type MemberClass = { id: string; name: string; students: number; assignments: number };

export async function fetchMemberClasses(orgId: string, userId: string): Promise<MemberClass[]> {
  const { data, error } = await supabase.rpc("school_member_classes", { _org_id: orgId, _user_id: userId });
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string; students: number; assignments: number }[]).map((r) => ({
    id: r.id,
    name: r.name ?? "Class",
    students: Number(r.students ?? 0),
    assignments: Number(r.assignments ?? 0),
  }));
}

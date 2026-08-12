/**
 * The family hub.
 *
 * A parent account never becomes the student. Each child keeps their own
 * MathGPL student account, and the parent is connected to it as a guardian and
 * observer: they can look, follow progress and introduce a school or teacher,
 * but they can never write inside a child's workspace.
 */
import { supabase } from "@/integrations/supabase/client";

export type ChildOverview = {
  childUserId: string;
  displayName: string;
  username: string | null;
  schools: number;
  teachers: number;
  classes: number;
  /** Overall progress across every school the child belongs to. */
  progress: number;
};

export type ChildBreakdownRow = {
  kind: "school" | "teacher";
  name: string;
  classes: number;
  progress: number;
};

/** Every child linked to the signed-in parent, with family-wide figures. */
export async function fetchChildren(): Promise<ChildOverview[]> {
  const { data, error } = await supabase.rpc("parent_child_overview");
  if (error) throw error;
  return ((data ?? []) as {
    child_user_id: string;
    display_name: string | null;
    username: string | null;
    schools: number | null;
    teachers: number | null;
    classes: number | null;
    progress: number | null;
  }[]).map((row) => ({
    childUserId: row.child_user_id,
    displayName: row.display_name ?? "Child",
    username: row.username,
    schools: Number(row.schools ?? 0),
    teachers: Number(row.teachers ?? 0),
    classes: Number(row.classes ?? 0),
    progress: Number(row.progress ?? 0),
  }));
}

/** The same child, split per school and per teacher. */
export async function fetchChildBreakdown(childUserId: string): Promise<ChildBreakdownRow[]> {
  const { data, error } = await supabase.rpc("parent_child_breakdown", {
    _child_user_id: childUserId,
  });
  if (error) throw error;
  return ((data ?? []) as {
    kind: string;
    name: string | null;
    classes: number | null;
    progress: number | null;
  }[]).map((row) => ({
    kind: row.kind === "teacher" ? "teacher" : "school",
    name: row.name ?? "Unnamed",
    classes: Number(row.classes ?? 0),
    progress: Number(row.progress ?? 0),
  }));
}

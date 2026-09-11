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
  /** Share of assigned lesson notes the child has finished. */
  assignments: number;
  /** Share of assigned adventures the child has finished. */
  adventures: number;
  /** Average Courses pathway progress. */
  skillBuilder: number;
};

export type ChildBreakdownRow = {
  kind: "school" | "teacher";
  name: string;
  classes: number;
  progress: number;
};

export type FamilyConnection = {
  kind: "school" | "teacher";
  targetUserId: string;
  name: string;
  username: string | null;
  /** How many of this parent's children this school or teacher covers. */
  children: number;
  connectedAt: string | null;
};

export type FamilyActivity = {
  childUserId: string;
  childName: string;
  kind: "assignment" | "adventure" | "skill";
  title: string;
  happenedAt: string | null;
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
    assignments: number | null;
    adventures: number | null;
    skill_builder: number | null;
  }[]).map((row) => ({
    childUserId: row.child_user_id,
    displayName: row.display_name ?? "Child",
    username: row.username,
    schools: Number(row.schools ?? 0),
    teachers: Number(row.teachers ?? 0),
    classes: Number(row.classes ?? 0),
    progress: Number(row.progress ?? 0),
    assignments: Number(row.assignments ?? 0),
    adventures: Number(row.adventures ?? 0),
    skillBuilder: Number(row.skill_builder ?? 0),
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

/** Schools and teachers the parent's children are connected to. */
export async function fetchFamilyConnections(): Promise<FamilyConnection[]> {
  const { data, error } = await supabase.rpc("parent_family_connections");
  if (error) throw error;
  return ((data ?? []) as {
    kind: string;
    target_user_id: string;
    name: string | null;
    username: string | null;
    children: number | null;
    connected_at: string | null;
  }[]).map((row) => ({
    kind: row.kind === "teacher" ? "teacher" : "school",
    targetUserId: row.target_user_id,
    name: row.name ?? "Unnamed",
    username: row.username,
    children: Number(row.children ?? 0),
    connectedAt: row.connected_at,
  }));
}

/** The most recent things the parent's children actually finished. */
export async function fetchFamilyActivity(): Promise<FamilyActivity[]> {
  const { data, error } = await supabase.rpc("parent_family_activity");
  if (error) throw error;
  return ((data ?? []) as {
    child_user_id: string;
    child_name: string | null;
    kind: string;
    title: string | null;
    happened_at: string | null;
  }[]).map((row) => ({
    childUserId: row.child_user_id,
    childName: row.child_name ?? "Child",
    kind: row.kind === "adventure" ? "adventure" : row.kind === "skill" ? "skill" : "assignment",
    title: row.title ?? "Activity",
    happenedAt: row.happened_at,
  }));
}

/**
 * Workspaces.
 *
 * One identity, many workspaces. A person's personal workspace and each school
 * they belong to is a row in `account_memberships`; the *active* workspace is
 * the one they are currently operating in (stored on `profiles.active_org_id`,
 * resolved server-side by `current_org_id()`).
 *
 * Switching a workspace changes context only — it never creates an account and
 * never moves data between workspaces.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./roles";

export type WorkspaceKind = "platform" | "school" | "teacher" | "parent" | "student";

export type Workspace = {
  orgId: string;
  kind: WorkspaceKind;
  name: string;
  role: AppRole;
  status: string;
  /** True for the person's own (personal) workspace. */
  isOwner: boolean;
  visibility: "public" | "private";
};

type WorkspaceRow = {
  org_id: string;
  kind: string;
  name: string;
  role: string;
  status: string;
  is_owner: boolean;
  visibility: string;
};

const toWorkspace = (row: WorkspaceRow): Workspace => ({
  orgId: row.org_id,
  kind: (row.kind ?? "teacher") as WorkspaceKind,
  name: row.name ?? "Workspace",
  role: (row.role ?? "teacher") as AppRole,
  status: row.status ?? "active",
  isOwner: Boolean(row.is_owner),
  visibility: (row.visibility === "private" ? "private" : "public") as "public" | "private",
});

export async function fetchWorkspaces(): Promise<{ workspaces: Workspace[]; activeOrgId: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { workspaces: [], activeOrgId: null };

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase.rpc("my_workspaces"),
    supabase.from("profiles").select("active_org_id").eq("user_id", userData.user.id).maybeSingle(),
  ]);

  const workspaces = ((rows ?? []) as WorkspaceRow[]).map(toWorkspace);
  const stored = (profile as { active_org_id?: string | null } | null)?.active_org_id ?? null;
  const active =
    workspaces.find((w) => w.orgId === stored && w.status === "active")?.orgId ??
    workspaces.find((w) => w.isOwner && w.status === "active")?.orgId ??
    workspaces[0]?.orgId ??
    null;

  return { workspaces, activeOrgId: active };
}

export async function setActiveWorkspace(orgId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_workspace", { _org_id: orgId });
  if (error) throw error;
}

/** Human label for a workspace chip. */
export const workspaceLabel = (workspace: Workspace): string =>
  workspace.isOwner ? "Personal" : workspace.name;

/** Students belonging to a workspace — never mixes school and personal rosters. */
export async function fetchWorkspaceStudents(orgId: string): Promise<
  { userId: string; displayName: string; mathgplId: string | null; status: string }[]
> {
  const { data } = await supabase.rpc("workspace_students", { _org_id: orgId });
  return ((data ?? []) as { user_id: string; display_name: string; mathgpl_student_id: string | null; status: string }[]).map(
    (r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      mathgplId: r.mathgpl_student_id,
      status: r.status,
    }),
  );
}

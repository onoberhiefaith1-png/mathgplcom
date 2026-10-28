/**
 * Workspace scoping for the material a person creates.
 *
 * A workspace is a container: a lesson note or adventure created inside a
 * school belongs to that school, and a note created in the personal workspace
 * belongs to nobody else. This resolves which container the person is
 * currently working in, so lists only ever show that container's material.
 *
 * The rule mirrors the database trigger that stamps new rows: only a *school*
 * workspace is recorded; the personal workspace is represented by NULL.
 */
import { supabase } from "@/integrations/supabase/client";
import { currentViewAs } from "@/lib/accounts/viewAsScope";

type Row = { org_id: string; kind: string; status: string };

let cache: { value: string | null; at: number } | null = null;
const TTL = 30_000;

/** The school workspace currently active, or null for the personal workspace. */
export async function activeSchoolOrgId(): Promise<string | null> {
  // Viewing someone else's Shared Workspace: their school container wins.
  const viewing = currentViewAs();
  if (viewing) return viewing.orgId;
  if (cache && Date.now() - cache.at < TTL) return cache.value;


  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase.rpc("my_workspaces"),
    supabase.from("profiles").select("active_org_id").eq("user_id", userData.user.id).maybeSingle(),
  ]);

  const workspaces = ((rows ?? []) as Row[]).filter((r) => r.status === "active");
  const stored = (profile as { active_org_id?: string | null } | null)?.active_org_id ?? null;
  const active = workspaces.find((w) => w.org_id === stored) ?? null;
  const value = active && active.kind === "school" ? active.org_id : null;

  cache = { value, at: Date.now() };
  return value;
}

/** Drop the cache after switching workspace. */
export function clearWorkspaceScopeCache(): void {
  cache = null;
}

/**
 * Restrict a Supabase select to the active workspace.
 * Personal workspace rows carry no org_id.
 */
export function withWorkspaceScope<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
  query: T,
  orgId: string | null,
): T {
  return orgId ? query.eq("org_id", orgId) : query.is("org_id", null);
}

/** Convenience: resolve the scope and apply it in one step. */
export async function scopedByWorkspace<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
  query: T,
): Promise<T> {
  return withWorkspaceScope(query, await activeSchoolOrgId());
}

/**
 * The person whose material a page should show.
 *
 * Normally this is the signed-in user. While viewing someone else's Shared
 * Workspace it is that person, so the lists render exactly what they own.
 */
export function viewOwnerId(signedInUserId: string): string {
  return currentViewAs()?.ownerId ?? signedInUserId;
}

/** Restrict a select to the owner a page should show (see `viewOwnerId`). */
export function withOwnerView<T extends { eq: (c: string, v: string) => T }>(query: T): T {
  const viewing = currentViewAs();
  return viewing ? query.eq("owner_id", viewing.ownerId) : query;
}

/** No real row carries this owner: a fail-closed filter when there is no session. */
const NOBODY = "00000000-0000-0000-0000-000000000000";

/**
 * The owner a "my content" list belongs to.
 *
 * Private shelves must never lean on the database's wider read paths
 * (Community publication, class sharing, school review) — those exist so
 * shared material shows up *where it is shared*, not on someone else's own
 * shelf. Every list of "my …" therefore states its owner explicitly, taken
 * from the session (or the explicit read-only view-as target), never from
 * anything the browser could supply.
 */
export async function myOwnerId(): Promise<string> {
  const viewing = currentViewAs();
  if (viewing) return viewing.ownerId;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? NOBODY;
}



/**
 * Workspace access for a student.
 *
 * A connection and workspace access are two different things. Accepting a
 * school's or teacher's request only says "I am connected to them"; the
 * student's learning becomes active once they walk through that owner's
 * building and pass its gateway. This module reads that state and records it.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchConnections, type Connection } from "@/lib/connections/connections";

export type OwnerKind = "school" | "teacher";

export type ConnectedOwner = {
  ownerId: string;
  orgId: string | null;
  name: string;
  kind: OwnerKind;
  /** True once the student has entered this workspace through its building. */
  entered: boolean;
};

export type GrantedScope = { ownerIds: string[]; orgIds: string[] };

let cache: { value: GrantedScope; at: number } | null = null;
const TTL = 15_000;

export function clearWorkspaceAccessCache(): void {
  cache = null;
}

/** Every school or teacher workspace this student has already entered. */
export async function grantedWorkspaces(): Promise<GrantedScope> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ownerIds: [], orgIds: [] };

  const { data } = await supabase
    .from("student_workspace_access")
    .select("owner_id, org_id")
    .eq("student_id", userData.user.id);

  const rows = (data ?? []) as { owner_id: string; org_id: string | null }[];
  const value: GrantedScope = {
    ownerIds: rows.map((r) => r.owner_id),
    orgIds: rows.map((r) => r.org_id).filter((id): id is string => Boolean(id)),
  };
  cache = { value, at: Date.now() };
  return value;
}

const OWNER_RELATIONS = new Set(["school_student", "teacher_student"]);

/** The schools and teachers this student is connected to, entered or not. */
export async function connectedOwners(): Promise<ConnectedOwner[]> {
  const [connections, granted] = await Promise.all([fetchConnections("accepted"), grantedWorkspaces()]);
  const entered = new Set(granted.ownerIds);

  const owners: ConnectedOwner[] = [];
  const seen = new Set<string>();
  for (const c of connections as Connection[]) {
    if (!OWNER_RELATIONS.has(c.relation)) continue;
    const kind: OwnerKind | null =
      c.counterpartRole === "school" ? "school" : c.counterpartRole === "teacher" ? "teacher" : null;
    if (!kind) continue;
    if (seen.has(c.counterpartUserId)) continue;
    seen.add(c.counterpartUserId);
    owners.push({
      ownerId: c.counterpartUserId,
      orgId: kind === "school" ? c.orgId : null,
      name: kind === "school" ? c.orgName ?? c.counterpartName : c.counterpartName,
      kind,
      entered: entered.has(c.counterpartUserId),
    });
  }
  return owners;
}

export type EnterResult = "granted" | "payment_required" | "not_connected";

/** Walks through a workspace's gateway. The database decides, never the page. */
export async function enterWorkspace(ownerId: string, orgId?: string | null): Promise<EnterResult> {
  const { data, error } = await supabase.rpc("enter_workspace", {
    _owner_id: ownerId,
    _org_id: orgId ?? undefined,
  });
  if (error) throw error;
  clearWorkspaceAccessCache();
  return (data as EnterResult) ?? "not_connected";
}

/** One connected owner, by account id. */
export async function connectedOwner(ownerId: string): Promise<ConnectedOwner | null> {
  const owners = await connectedOwners();
  return owners.find((o) => o.ownerId === ownerId) ?? null;
}

/** One connected school, by workspace id. */
export async function connectedSchoolByOrg(orgId: string): Promise<ConnectedOwner | null> {
  const owners = await connectedOwners();
  return owners.find((o) => o.kind === "school" && o.orgId === orgId) ?? null;
}

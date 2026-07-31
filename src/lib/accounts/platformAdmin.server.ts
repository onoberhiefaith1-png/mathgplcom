/**
 * Platform Owner reads. Deliberately limited to account, organisation and
 * subscription information — never lesson notes, classes or student work.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type PlatformStats = {
  schools: number;
  teachers: number;
  parents: number;
  students: number;
  activeOrgs: number;
  suspendedOrgs: number;
  newThisMonth: number;
};

export type AccountRow = {
  userId: string;
  name: string;
  email: string;
  organisation: string;
  status: string;
  joinedAt: string;
  teachers?: number;
  students?: number;
  parents?: number;
  subscription?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function assertPlatformAdmin(supabase: Client, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("platform_owner") && !roles.includes("co_admin")) {
    throw new Error("Platform administrators only.");
  }
}

export async function platformStats(): Promise<PlatformStats> {
  const db = await admin();
  const [{ data: roles }, { data: orgs }] = await Promise.all([
    db.from("user_roles").select("user_id, role, created_at"),
    db.from("organizations").select("id, kind, status, created_at"),
  ]);

  const count = (role: string) => (roles ?? []).filter((r) => r.role === role).length;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return {
    schools: count("school"),
    teachers: count("teacher"),
    parents: count("parent"),
    students: count("student"),
    activeOrgs: (orgs ?? []).filter((o) => o.status === "active").length,
    suspendedOrgs: (orgs ?? []).filter((o) => o.status !== "active").length,
    newThisMonth: (roles ?? []).filter((r) => new Date(r.created_at).getTime() > monthAgo).length,
  };
}

export async function platformAccounts(kind: string): Promise<AccountRow[]> {
  const db = await admin();
  const role = kind === "admins" ? "co_admin" : kind.replace(/s$/, "");
  const { data: roleRows } = await db
    .from("user_roles")
    .select("user_id, created_at")
    .eq("role", role as Database["public"]["Enums"]["app_role"])
    .order("created_at", { ascending: false });

  const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  if (!ids.length) return [];

  const [{ data: profiles }, { data: memberships }, { data: orgs }] = await Promise.all([
    db.from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", ids),
    db.from("account_memberships").select("user_id, org_id, role, status"),
    db.from("organizations").select("id, name, kind, status, owner_user_id, created_at"),
  ]);

  const emails = new Map<string, string>();
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of userList?.users ?? []) if (u.email) emails.set(u.id, u.email);

  return ids.map((id) => {
    const p = (profiles ?? []).find((x) => x.user_id === id);
    const ownOrg = (orgs ?? []).find((o) => o.owner_user_id === id);
    const membership = (memberships ?? []).find((m) => m.user_id === id);
    const org = ownOrg ?? (orgs ?? []).find((o) => o.id === membership?.org_id);
    const orgMembers = (memberships ?? []).filter((m) => m.org_id === (ownOrg?.id ?? ""));

    return {
      userId: id,
      name:
        p?.display_name?.trim() ||
        [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
        emails.get(id) ||
        "Account",
      email: emails.get(id) ?? "",
      organisation: ownOrg ? ownOrg.name : (org?.name ?? "Independent"),
      status: membership?.status ?? org?.status ?? "active",
      joinedAt:
        (roleRows ?? []).find((r) => r.user_id === id)?.created_at ?? org?.created_at ?? "",
      teachers: ownOrg ? orgMembers.filter((m) => m.role === "teacher").length : undefined,
      parents: ownOrg ? orgMembers.filter((m) => m.role === "parent").length : undefined,
      students: ownOrg ? orgMembers.filter((m) => m.role === "student").length : undefined,
      subscription: ownOrg ? (ownOrg.status === "active" ? "Active" : ownOrg.status) : undefined,
    };
  });
}

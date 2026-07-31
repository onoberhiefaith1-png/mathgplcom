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

/* ------------------------------------------------------------------ *
 * Account lifecycle + workspace entry (platform administrators only)
 * ------------------------------------------------------------------ */

export type AccountDetail = {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  orgKind: string | null;
  status: string;
  joinedAt: string;
  lastSignInAt: string | null;
  teachers: number;
  students: number;
  parents: number;
  classes: number;
  subscription: string | null;
};

const HOME_BY_ROLE: Record<string, string> = {
  platform_owner: "/admin",
  co_admin: "/admin",
  school: "/school",
  teacher: "/teaching-hub",
  parent: "/family",
  student: "/student/classes",
};

/** Profile / organisation / subscription facts only — never workspace content. */
export async function accountDetail(userId: string): Promise<AccountDetail> {
  const db = await admin();
  const [{ data: profile }, { data: roles }, { data: memberships }, { data: orgs }] =
    await Promise.all([
      db
        .from("profiles")
        .select("display_name, first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle(),
      db.from("user_roles").select("role, created_at").eq("user_id", userId),
      db.from("account_memberships").select("user_id, org_id, role, status"),
      db.from("organizations").select("id, name, kind, status, owner_user_id, created_at"),
    ]);

  const { data: userRes } = await db.auth.admin.getUserById(userId);
  const ownOrg = (orgs ?? []).find((o) => o.owner_user_id === userId) ?? null;
  const membership = (memberships ?? []).find((m) => m.user_id === userId) ?? null;
  const org = ownOrg ?? (orgs ?? []).find((o) => o.id === membership?.org_id) ?? null;
  const orgMembers = ownOrg ? (memberships ?? []).filter((m) => m.org_id === ownOrg.id) : [];

  let classes = 0;
  if (ownOrg) {
    const ids = orgMembers.map((m) => m.user_id);
    if (ids.length) {
      const { count } = await db
        .from("classes")
        .select("id", { count: "exact", head: true })
        .in("teacher_id", ids);
      classes = count ?? 0;
    }
  } else {
    const { count } = await db
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", userId);
    classes = count ?? 0;
  }

  return {
    userId,
    name:
      profile?.display_name?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      userRes?.user?.email ||
      "Account",
    email: userRes?.user?.email ?? "",
    role: (roles ?? [])[0]?.role ?? null,
    organisation: org?.name ?? null,
    orgKind: org?.kind ?? null,
    status: membership?.status ?? org?.status ?? "active",
    joinedAt: (roles ?? [])[0]?.created_at ?? org?.created_at ?? "",
    lastSignInAt: userRes?.user?.last_sign_in_at ?? null,
    teachers: orgMembers.filter((m) => m.role === "teacher").length,
    students: orgMembers.filter((m) => m.role === "student").length,
    parents: orgMembers.filter((m) => m.role === "parent").length,
    classes,
    subscription: ownOrg ? (ownOrg.status === "active" ? "Active" : ownOrg.status) : null,
  };
}

/** Suspend / reactivate. Memberships and any owned organisation move together. */
export async function setAccountStatus(userId: string, status: "active" | "suspended") {
  const db = await admin();
  await db.from("account_memberships").update({ status }).eq("user_id", userId);
  await db.from("organizations").update({ status }).eq("owner_user_id", userId);
  if (status === "suspended") {
    await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  } else {
    await db.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }
  return { ok: true };
}

export async function deleteAccount(userId: string) {
  const db = await admin();
  await db.from("account_memberships").delete().eq("user_id", userId);
  await db.from("user_roles").delete().eq("user_id", userId);
  await db.auth.admin.deleteUser(userId);
  return { ok: true };
}

export async function createAccount(params: {
  email: string;
  password: string;
  role: "school" | "teacher" | "parent" | "student" | "co_admin";
  name?: string;
  organisation?: string;
}) {
  const db = await admin();
  const { data, error } = await db.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      account_role: params.role,
      display_name: params.name ?? null,
      organization_name: params.organisation ?? null,
    },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create that account.");

  const uid = data.user.id;
  await db
    .from("user_roles")
    .upsert(
      { user_id: uid, role: params.role as Database["public"]["Enums"]["app_role"] },
      { onConflict: "user_id,role" },
    );
  if (params.name) {
    await db.from("profiles").upsert({ user_id: uid, display_name: params.name }, { onConflict: "user_id" });
  }
  return { userId: uid };
}

/**
 * Mints a one-time sign-in token for `targetUserId` so the platform owner can
 * enter that workspace exactly as the real account experiences it. Audited.
 */
export async function workspaceEntryToken(adminUserId: string, targetUserId: string) {
  const db = await admin();
  const { data: userRes } = await db.auth.admin.getUserById(targetUserId);
  const email = userRes?.user?.email;
  if (!email) throw new Error("That account has no email address to sign in with.");

  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", targetUserId);
  const role = (roleRows ?? [])[0]?.role ?? "teacher";

  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(error?.message ?? "Could not open that workspace.");
  }

  await db.from("admin_impersonation_log").insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
    target_role: role as string,
  });

  const { data: profile } = await db
    .from("profiles")
    .select("display_name, first_name, last_name")
    .eq("user_id", targetUserId)
    .maybeSingle();

  return {
    tokenHash: link.properties.hashed_token,
    email,
    role: role as string,
    home: HOME_BY_ROLE[role as string] ?? "/",
    name:
      profile?.display_name?.trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      email,
  };
}

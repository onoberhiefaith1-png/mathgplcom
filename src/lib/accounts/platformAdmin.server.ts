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
  isMine?: boolean;
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

export async function platformAccounts(kind: string, ownerUserId?: string): Promise<AccountRow[]> {
  const db = await admin();
  const mine = ownerUserId ? await myAccountIds(ownerUserId) : new Set<string>();
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
      isMine: mine.has(id),

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
        .in("owner_id", ids);
      classes = count ?? 0;
    }
  } else {
    const { count } = await db
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
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

/**
 * Creates an account, or — when the email already exists — grants the role to
 * that existing account instead. Never throws for expected input problems: it
 * returns { ok: false, message } so the dialog can show a friendly notice.
 */
export async function createAccount(params: {
  email: string;
  password: string;
  role: "school" | "teacher" | "parent" | "student" | "co_admin";
  name?: string;
  organisation?: string;
}): Promise<{ ok: boolean; userId?: string; existing?: boolean; message?: string }> {
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

  let uid = data?.user?.id;
  let existing = false;

  if (!uid) {
    const alreadyRegistered = /already been registered|already exists|already registered/i.test(
      error?.message ?? "",
    );
    if (!alreadyRegistered) {
      return { ok: false, message: error?.message ?? "Could not create that account." };
    }
    // Reuse the existing account and simply give it the requested role.
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = (list?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === params.email.toLowerCase(),
    );
    if (!match) {
      return { ok: false, message: "That email is already registered on another account." };
    }
    uid = match.id;
    existing = true;
  }

  await db
    .from("user_roles")
    .upsert(
      { user_id: uid, role: params.role as Database["public"]["Enums"]["app_role"] },
      { onConflict: "user_id,role" },
    );
  if (params.name) {
    await db.from("profiles").upsert({ user_id: uid, display_name: params.name }, { onConflict: "user_id" });
  }
  return { ok: true, userId: uid, existing };
}


/**
 * Mints a one-time sign-in token for `targetUserId` — but only for accounts the
 * platform owner created for themselves (or their own account). Any other
 * customer account returns `requiresCredentials`, so the owner must supply that
 * customer's own email and password to open it. Audited.
 */
export async function workspaceEntryToken(adminUserId: string, targetUserId: string) {
  const db = await admin();
  const { data: userRes } = await db.auth.admin.getUserById(targetUserId);
  const email = userRes?.user?.email;
  if (!email) throw new Error("That account has no email address to sign in with.");

  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", targetUserId);
  const role = (roleRows ?? [])[0]?.role ?? "teacher";

  const { data: profileRow } = await db
    .from("profiles")
    .select("display_name, first_name, last_name")
    .eq("user_id", targetUserId)
    .maybeSingle();

  const displayName =
    profileRow?.display_name?.trim() ||
    [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(" ").trim() ||
    email;

  const mine = await myAccountIds(adminUserId);
  if (targetUserId !== adminUserId && !mine.has(targetUserId)) {
    return {
      requiresCredentials: true as const,
      email,
      role: role as string,
      home: HOME_BY_ROLE[role as string] ?? "/",
      name: displayName,
    };
  }

  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(error?.message ?? "Could not open that workspace.");
  }


  await db.from("admin_impersonation_log").insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
    target_role: role as string,
  });

  return {
    requiresCredentials: false as const,
    tokenHash: link.properties.hashed_token,
    email,
    role: role as string,
    home: HOME_BY_ROLE[role as string] ?? "/",
    name: displayName,
  };
}

/* ------------------------------------------------------------------ *
 * The platform owner's own test accounts (one per role)
 * ------------------------------------------------------------------ */

export type MyAccountRole = "school" | "teacher" | "parent" | "student";

export type MyAccount = {
  role: MyAccountRole;
  userId: string | null;
  email: string;
  name: string;
  home: string;
};

const MY_ACCOUNT_SPECS: { role: MyAccountRole; suffix: string; name: string }[] = [
  { role: "school", suffix: "school", name: "My School" },
  { role: "teacher", suffix: "teacher", name: "My Teacher" },
  { role: "parent", suffix: "parent", name: "My Parent" },
  { role: "student", suffix: "student", name: "My Student" },
];

/** The table is newer than the generated types, so it is reached untyped. */
async function testAccountsTable() {
  const db = await admin();
  return (db as unknown as { from: (t: string) => any }).from("platform_test_accounts");
}

async function myAccountIds(ownerUserId: string): Promise<Set<string>> {
  const table = await testAccountsTable();
  const { data } = await table.select("target_user_id").eq("owner_user_id", ownerUserId);
  return new Set<string>(((data ?? []) as { target_user_id: string }[]).map((r) => r.target_user_id));
}

function aliasEmail(ownerEmail: string, suffix: string) {
  const [local, domain] = ownerEmail.split("@");
  return `${local}+${suffix}@${domain}`;
}

/** Creates (or adopts) one account per role for the owner. Safe to re-run. */
export async function ensureMyAccounts(ownerUserId: string): Promise<MyAccount[]> {
  const db = await admin();
  const table = await testAccountsTable();

  const { data: ownerRes } = await db.auth.admin.getUserById(ownerUserId);
  const ownerEmail = ownerRes?.user?.email;
  if (!ownerEmail) throw new Error("Your account has no email address.");

  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byEmail = new Map<string, string>();
  for (const u of userList?.users ?? []) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);

  const out: MyAccount[] = [];

  for (const spec of MY_ACCOUNT_SPECS) {
    const email = aliasEmail(ownerEmail, spec.suffix);
    let uid = byEmail.get(email.toLowerCase()) ?? null;

    if (!uid) {
      const password = `Mgpl-${spec.suffix}-${crypto.randomUUID().slice(0, 12)}`;
      const { data: created, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { account_role: spec.role, display_name: spec.name },
      });
      if (error || !created?.user?.id) {
        throw new Error(error?.message ?? `Could not create ${spec.name}.`);
      }
      uid = created.user.id;
    }

    await db.from("user_roles").upsert(
      { user_id: uid, role: spec.role as Database["public"]["Enums"]["app_role"] },
      { onConflict: "user_id,role" },
    );
    await db
      .from("profiles")
      .upsert({ user_id: uid, display_name: spec.name }, { onConflict: "user_id" });

    if (spec.role === "school") {
      const { data: existingOrg } = await db
        .from("organizations")
        .select("id")
        .eq("owner_user_id", uid)
        .maybeSingle();
      if (!existingOrg) {
        const { data: org } = await db
          .from("organizations")
          .insert({ name: spec.name, kind: "school", status: "active", owner_user_id: uid })
          .select("id")
          .maybeSingle();
        if (org?.id) {
          await db
            .from("account_memberships")
            .upsert(
              { user_id: uid, org_id: org.id, role: "school" as Database["public"]["Enums"]["app_role"], status: "active" },
              { onConflict: "user_id,org_id,role" },
            );
        }
      }
    }

    await table.upsert(
      { owner_user_id: ownerUserId, target_user_id: uid, role: spec.role },
      { onConflict: "target_user_id" },
    );

    out.push({
      role: spec.role,
      userId: uid,
      email,
      name: spec.name,
      home: HOME_BY_ROLE[spec.role] ?? "/",
    });
  }

  return out;
}

/** Reads the owner's four accounts without creating anything. */
export async function myAccounts(ownerUserId: string): Promise<MyAccount[]> {
  const db = await admin();
  const table = await testAccountsTable();
  const { data: ownerRes } = await db.auth.admin.getUserById(ownerUserId);
  const ownerEmail = ownerRes?.user?.email ?? "";

  const { data: rows } = await table
    .select("target_user_id, role")
    .eq("owner_user_id", ownerUserId);
  const byRole = new Map<string, string>();
  for (const r of (rows ?? []) as { target_user_id: string; role: string }[]) {
    byRole.set(r.role, r.target_user_id);
  }

  return MY_ACCOUNT_SPECS.map((spec) => ({
    role: spec.role,
    userId: byRole.get(spec.role) ?? null,
    email: ownerEmail ? aliasEmail(ownerEmail, spec.suffix) : "",
    name: spec.name,
    home: HOME_BY_ROLE[spec.role] ?? "/",
  }));
}


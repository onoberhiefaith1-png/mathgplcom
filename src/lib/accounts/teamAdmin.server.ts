/**
 * Server-only helpers behind the Account management server functions.
 *
 * Every helper takes an already-authenticated caller. Privileged work uses the
 * admin client, but only after the caller has been proven to own the
 * organisation (school / parent) the action targets.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type TeacherRow = {
  userId: string;
  email: string;
  name: string;
  status: "invited" | "active" | "suspended";
  joinedAt: string;
  classCount: number;
  studentCount: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The organisation this caller owns, or null when they own none. */
export async function ownedOrg(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("organizations")
    .select("id, kind, name")
    .eq("owner_user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function requireOwnedOrg(supabase: Client, userId: string) {
  const org = await ownedOrg(supabase, userId);
  if (!org) throw new Error("This account does not own a workspace yet.");
  return org;
}

export async function callerRoles(supabase: Client, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}

/** Moves a freshly created teacher out of their auto-created org into `orgId`. */
async function attachToOrg(userId: string, orgId: string, status: "invited" | "active") {
  const db = await admin();
  const { data: existing } = await db
    .from("account_memberships")
    .select("id, org_id")
    .eq("user_id", userId);

  for (const row of existing ?? []) {
    if (row.org_id !== orgId) {
      await db.from("account_memberships").delete().eq("id", row.id);
    }
  }

  const mine = (existing ?? []).find((r) => r.org_id === orgId);
  if (mine) {
    await db.from("account_memberships").update({ status }).eq("id", mine.id);
  } else {
    await db
      .from("account_memberships")
      .insert({ user_id: userId, org_id: orgId, role: "teacher", status });
  }

  await db.from("user_roles").insert({ user_id: userId, role: "teacher" }).select().maybeSingle();
}

export async function listTeachers(orgId: string): Promise<TeacherRow[]> {
  const db = await admin();
  const { data: members } = await db
    .from("account_memberships")
    .select("user_id, status, created_at")
    .eq("org_id", orgId)
    .eq("role", "teacher")
    .order("created_at");

  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return [];

  const [{ data: profiles }, { data: classes }] = await Promise.all([
    db.from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", ids),
    db.from("classes").select("id, owner_id").in("owner_id", ids),
  ]);

  const classIds = (classes ?? []).map((c) => c.id);
  const memberCounts = new Map<string, number>();
  if (classIds.length) {
    const { data: classMembers } = await db
      .from("class_members")
      .select("class_id")
      .in("class_id", classIds);
    const classOwner = new Map((classes ?? []).map((c) => [c.id, c.owner_id]));
    for (const cm of classMembers ?? []) {
      const owner = classOwner.get(cm.class_id);
      if (owner) memberCounts.set(owner, (memberCounts.get(owner) ?? 0) + 1);
    }
  }

  const emails = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user?.email) emails.set(id, data.user.email);
    }),
  );

  return (members ?? []).map((m) => {
    const p = (profiles ?? []).find((x) => x.user_id === m.user_id);
    const name =
      p?.display_name?.trim() ||
      [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
      emails.get(m.user_id) ||
      "Teacher";
    return {
      userId: m.user_id,
      email: emails.get(m.user_id) ?? "",
      name,
      status: (m.status as TeacherRow["status"]) ?? "active",
      joinedAt: m.created_at,
      classCount: (classes ?? []).filter((c) => c.owner_id === m.user_id).length,
      studentCount: memberCounts.get(m.user_id) ?? 0,
    };
  });
}

export async function inviteTeacher(params: {
  orgId: string;
  invitedBy: string;
  email: string;
  firstName?: string;
  lastName?: string;
  origin: string;
}) {
  const db = await admin();
  const metadata = {
    account_role: "teacher",
    first_name: params.firstName ?? "",
    last_name: params.lastName ?? "",
    display_name: [params.firstName, params.lastName].filter(Boolean).join(" "),
  };

  const { data, error } = await db.auth.admin.inviteUserByEmail(params.email, {
    data: metadata,
    redirectTo: `${params.origin}/auth/accept-invite`,
  });

  let userId = data?.user?.id ?? null;
  if (error) {
    // Already registered — connect the existing account instead of failing.
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find(
      (u) => u.email?.toLowerCase() === params.email.toLowerCase(),
    );
    if (!found) throw new Error(error.message);
    userId = found.id;
  }
  if (!userId) throw new Error("Could not create the teacher account.");

  await attachToOrg(userId, params.orgId, "invited");
  await db.from("teacher_invitations").insert({
    org_id: params.orgId,
    invited_by: params.invitedBy,
    email: params.email,
    first_name: params.firstName ?? null,
    last_name: params.lastName ?? null,
  });

  return { userId };
}

export async function createTeacherWithPassword(params: {
  orgId: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const db = await admin();
  const { data, error } = await db.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      account_role: "teacher",
      first_name: params.firstName ?? "",
      last_name: params.lastName ?? "",
      display_name: [params.firstName, params.lastName].filter(Boolean).join(" "),
    },
  });
  if (error || !data?.user) throw new Error(error?.message ?? "Could not create the teacher.");
  await attachToOrg(data.user.id, params.orgId, "active");
  return { userId: data.user.id };
}

export async function setTeacherStatus(params: {
  orgId: string;
  teacherId: string;
  status: "active" | "suspended";
}) {
  const db = await admin();
  await db
    .from("account_memberships")
    .update({ status: params.status })
    .eq("org_id", params.orgId)
    .eq("user_id", params.teacherId);
  await db.auth.admin.updateUserById(params.teacherId, {
    ban_duration: params.status === "suspended" ? "876000h" : "none",
  });
}

export async function removeTeacher(params: { orgId: string; teacherId: string }) {
  const db = await admin();
  await db
    .from("account_memberships")
    .delete()
    .eq("org_id", params.orgId)
    .eq("user_id", params.teacherId);
  await db
    .from("teacher_invitations")
    .update({ status: "revoked" })
    .eq("org_id", params.orgId)
    .eq("status", "pending");
}

/* ---------------- Parent ↔ teacher connections ---------------- */

export type LinkedTeacher = {
  linkId: string;
  teacherId: string;
  name: string;
  email: string;
  childName: string | null;
  status: string;
};

export async function listParentTeachers(parentId: string): Promise<LinkedTeacher[]> {
  const db = await admin();
  const { data: links } = await db
    .from("parent_teacher_links")
    .select("id, teacher_user_id, child_user_id, status")
    .eq("parent_user_id", parentId)
    .neq("status", "removed")
    .order("created_at");

  if (!links?.length) return [];
  const ids = [
    ...new Set(links.flatMap((l) => [l.teacher_user_id, l.child_user_id].filter(Boolean) as string[])),
  ];
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, first_name, last_name")
    .in("user_id", ids);

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p = (profiles ?? []).find((x) => x.user_id === id);
    return (
      p?.display_name?.trim() ||
      [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
      null
    );
  };

  const emails = new Map<string, string>();
  await Promise.all(
    links.map(async (l) => {
      const { data } = await db.auth.admin.getUserById(l.teacher_user_id);
      if (data?.user?.email) emails.set(l.teacher_user_id, data.user.email);
    }),
  );

  return links.map((l) => ({
    linkId: l.id,
    teacherId: l.teacher_user_id,
    name: nameOf(l.teacher_user_id) ?? emails.get(l.teacher_user_id) ?? "Teacher",
    email: emails.get(l.teacher_user_id) ?? "",
    childName: nameOf(l.child_user_id),
    status: l.status,
  }));
}

export async function linkParentTeacher(params: {
  parentId: string;
  email: string;
  childUserId?: string | null;
}) {
  const db = await admin();
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const teacher = list?.users?.find((u) => u.email?.toLowerCase() === params.email.toLowerCase());
  if (!teacher) {
    throw new Error("No MathGPL teacher is registered with that email address yet.");
  }
  await db.from("parent_teacher_links").upsert(
    {
      parent_user_id: params.parentId,
      teacher_user_id: teacher.id,
      child_user_id: params.childUserId ?? null,
      status: "active",
    },
    { onConflict: "parent_user_id,teacher_user_id,child_user_id" },
  );
  return { teacherId: teacher.id };
}

export async function unlinkParentTeacher(params: { parentId: string; linkId: string }) {
  const db = await admin();
  await db
    .from("parent_teacher_links")
    .delete()
    .eq("id", params.linkId)
    .eq("parent_user_id", params.parentId);
}

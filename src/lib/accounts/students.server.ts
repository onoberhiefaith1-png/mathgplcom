/**
 * Student accounts created by a school or a teacher.
 *
 * These accounts have no email address: the creator chooses the ID and the
 * password and hands both to the student. The account belongs to the workspace
 * that created it and to no other, which the database also enforces.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { customIdError } from "./customIdRules";
import { issuedIdExists, userIdByCustomId } from "./accountIds.server";

const MANAGED_DOMAIN = "managed.mathgpl.local";

export type ManagedStudent = {
  userId: string;
  name: string;
  studentId: string | null;
  issuedId: string | null;
  status: string;
  createdAt: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The workspace this caller creates students in, plus how they own it. */
export async function creatorContext(supabase: any, userId: string) {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, kind, name")
    .eq("owner_user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!org) throw new Error("This account does not own a workspace yet.");
  return { orgId: org.id as string, kind: org.kind as string, name: org.name as string };
}

export async function listManagedStudents(orgId: string, creatorId: string): Promise<ManagedStudent[]> {
  const db = await admin();
  const { data: profiles } = await db
    .from("profiles")
    .select("user_id, display_name, first_name, last_name, created_at, managed_by_org_id, managed_by_user_id")
    .or(`managed_by_org_id.eq.${orgId},managed_by_user_id.eq.${creatorId}`);

  const rows = (profiles ?? []) as any[];
  const ids = rows.map((r) => r.user_id as string);
  if (!ids.length) return [];

  const [{ data: accountIds }, { data: members }] = await Promise.all([
    db.from("account_ids").select("user_id, custom_id, mathgpl_id").in("user_id", ids),
    db.from("account_memberships").select("user_id, status").eq("org_id", orgId).in("user_id", ids),
  ]);

  return rows
    .map((r) => {
      const account = (accountIds ?? []).find((a: any) => a.user_id === r.user_id);
      const membership = (members ?? []).find((m: any) => m.user_id === r.user_id);
      const name =
        (r.display_name as string)?.trim() ||
        [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
        "Student";
      return {
        userId: r.user_id as string,
        name,
        studentId: (account?.custom_id as string | null) ?? null,
        issuedId: (account?.mathgpl_id as string | null) ?? null,
        status: (membership?.status as string) ?? "active",
        createdAt: (r.created_at as string) ?? "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The caller may only touch a student their own workspace created. */
export async function requireOwnStudent(studentId: string, orgId: string, creatorId: string) {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("user_id, managed_by_org_id, managed_by_user_id")
    .eq("user_id", studentId)
    .maybeSingle();
  const row = data as any;
  if (!row || (row.managed_by_org_id !== orgId && row.managed_by_user_id !== creatorId)) {
    throw new Error("That student account does not belong to this workspace.");
  }
  return row;
}

export async function createManagedStudent(params: {
  orgId: string;
  orgKind: string;
  creatorId: string;
  firstName: string;
  lastName: string;
  customId: string;
  password: string;
}): Promise<{ ok: boolean; message?: string; userId?: string; studentId?: string }> {
  const problem = customIdError(params.customId);
  if (problem) return { ok: false, message: problem };
  if (await issuedIdExists(params.customId)) return { ok: false, message: "That ID is already taken." };
  if (await userIdByCustomId(params.customId)) return { ok: false, message: "That ID is already taken." };

  const db = await admin();
  const displayName = [params.firstName, params.lastName].filter(Boolean).join(" ").trim();
  const email = `${crypto.randomUUID()}@${MANAGED_DOMAIN}`;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      account_role: "student",
      first_name: params.firstName,
      last_name: params.lastName,
      display_name: displayName,
      managed: true,
    },
  });
  if (error || !created?.user) {
    return { ok: false, message: error?.message ?? "Could not create the student account." };
  }
  const userId = created.user.id as string;

  try {
    await db.from("user_roles").insert({ user_id: userId, role: "student" });

    // Belongs to this workspace only: any auto-created personal membership goes.
    const { data: existing } = await db.from("account_memberships").select("id, org_id").eq("user_id", userId);
    for (const row of (existing ?? []) as any[]) {
      if (row.org_id !== params.orgId) await db.from("account_memberships").delete().eq("id", row.id);
    }
    const mine = ((existing ?? []) as any[]).find((r) => r.org_id === params.orgId);
    if (!mine) {
      await db
        .from("account_memberships")
        .insert({ user_id: userId, org_id: params.orgId, role: "student", status: "active" });
    }

    await db.rpc("issue_account_id", { _user_id: userId, _role: "student" });

    const { error: idError } = await db
      .from("account_ids")
      .update({ custom_id: params.customId, custom_id_updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (idError) throw new Error("That ID is already taken.");

    await db
      .from("profiles")
      .update({
        display_name: displayName || "Student",
        first_name: params.firstName,
        last_name: params.lastName,
        active_org_id: params.orgId,
        managed_by_org_id: params.orgId,
        managed_by_user_id: params.creatorId,
      })
      .eq("user_id", userId);

    // A teacher-created student is connected to that teacher straight away.
    if (params.orgKind !== "school") {
      await db.from("connections").insert({
        from_user_id: params.creatorId,
        to_user_id: userId,
        relation: "teacher_student",
        status: "accepted",
        org_id: params.orgId,
        counterpart_accepted_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
      });
    }

    return { ok: true, userId, studentId: params.customId };
  } catch (e) {
    // Rollback: never leave a half-created account behind.
    await db.auth.admin.deleteUser(userId).catch(() => undefined);
    return { ok: false, message: (e as Error).message };
  }
}

export async function resetManagedStudentPassword(studentId: string, password: string) {
  const db = await admin();
  const { error } = await db.auth.admin.updateUserById(studentId, { password });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setManagedStudentStatus(studentId: string, orgId: string, status: string) {
  const db = await admin();
  await db.from("account_memberships").update({ status }).eq("user_id", studentId).eq("org_id", orgId);
  return { ok: true };
}

export async function removeManagedStudent(studentId: string) {
  const db = await admin();
  const { error } = await db.auth.admin.deleteUser(studentId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

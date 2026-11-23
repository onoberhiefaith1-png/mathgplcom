/**
 * Server-only support access: grant lookups, request + notification, and the
 * audit row written when a platform administrator enters an account.
 */
import { createNotification } from "@/lib/notifications/notifications.server";
import {
  SUPPORT_ACCESS_ACCOUNT_PATH,
  SUPPORT_ACCESS_NOTIFICATION_SOURCE,
  type SupportAccessStatus,
} from "./supportAccess";

type Db = { from: (table: string) => any };

const adminDb = async (): Promise<Db> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
};

export async function supportAccessGrantAllowed(userId: string): Promise<boolean> {
  const db = await adminDb();
  const { data } = await db
    .from("support_access_grants")
    .select("allowed")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { allowed?: boolean } | null)?.allowed === true;
}

export async function supportAccessStatusByUser(
  ids: string[],
): Promise<Map<string, SupportAccessStatus>> {
  const map = new Map<string, SupportAccessStatus>();
  for (const id of ids) map.set(id, "none");
  if (ids.length === 0) return map;
  const db = await adminDb();
  const [{ data: grants }, { data: requests }] = await Promise.all([
    db.from("support_access_grants").select("user_id, allowed").in("user_id", ids),
    db
      .from("support_access_requests")
      .select("target_user_id, status")
      .in("target_user_id", ids)
      .eq("status", "pending"),
  ]);
  const pending = new Set(
    ((requests ?? []) as { target_user_id: string }[]).map((row) => row.target_user_id),
  );
  for (const row of (grants ?? []) as { user_id: string; allowed: boolean }[]) {
    if (row.allowed) map.set(row.user_id, "granted");
  }
  for (const id of pending) {
    if (map.get(id) !== "granted") map.set(id, "pending");
  }
  return map;
}

export async function logSupportAccessEntry(adminUserId: string, targetUserId: string) {
  if (adminUserId === targetUserId) return;
  const db = await adminDb();
  const { error } = await db.from("support_access_log").insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
}

export type SupportAccessRequestResult =
  | { alreadyGranted: true }
  | { alreadyRequested: true; requestId: string }
  | { requestId: string };

export async function requestSupportAccess(
  adminUserId: string,
  targetUserId: string,
  adminName?: string,
): Promise<SupportAccessRequestResult> {
  if (adminUserId === targetUserId) {
    throw new Error("You are already signed in to this account.");
  }
  if (await supportAccessGrantAllowed(targetUserId)) {
    return { alreadyGranted: true };
  }

  const db = await adminDb();
  const { data: existing } = await db
    .from("support_access_requests")
    .select("id")
    .eq("target_user_id", targetUserId)
    .eq("admin_user_id", adminUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing?.id) {
    return { alreadyRequested: true, requestId: existing.id as string };
  }

  const { data, error } = await db
    .from("support_access_requests")
    .insert({
      target_user_id: targetUserId,
      admin_user_id: adminUserId,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not send that request.");
  }
  const requestId = data.id as string;

  const who = adminName?.trim() || "A platform administrator";
  try {
    await createNotification({
      kind: "system",
      senderUserId: adminUserId,
      senderRole: "system",
      subject: "Support access request",
      body:
        `${who} has asked for permission to enter your account, so they can see a problem the way you see it. ` +
        "They will not need your password. You can allow or deny this on your account page, and you can turn access off at any time.",
      context: {
        supportRequestId: requestId,
        source: SUPPORT_ACCESS_NOTIFICATION_SOURCE,
      },
      targetPath: SUPPORT_ACCESS_ACCOUNT_PATH,
      recipients: [targetUserId],
      category: "system",
      allowResponses: false,
    });
  } catch {
    // The request itself is what matters; a notification failure must not roll it back.
  }

  return { requestId };
}

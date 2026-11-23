/**
 * support-access — consent-based admin entry and access requests.
 *
 * The service role stays on the server. Callers must be signed in as a
 * platform_owner or co_admin (the same check the /admin console uses).
 *
 * Actions:
 *   { action: "enter", targetUserId }    -> one-time magic-link token hash
 *   { action: "request", targetUserId }  -> pending request + notification
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser } from "../_shared/requireUser.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const service = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

async function assertPlatformAdmin(db: ReturnType<typeof service>, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((row: { role: string }) => row.role);
  if (!roles.includes("platform_owner") && !roles.includes("co_admin")) {
    const deny = new Error("Platform administrators only.");
    (deny as Error & { status?: number }).status = 403;
    throw deny;
  }
}

async function isOwnTestAccount(
  db: ReturnType<typeof service>,
  adminUserId: string,
  targetUserId: string,
): Promise<boolean> {
  const { data } = await db
    .from("platform_test_accounts")
    .select("target_user_id")
    .eq("owner_user_id", adminUserId)
    .eq("target_user_id", targetUserId)
    .maybeSingle();
  return Boolean(data?.target_user_id);
}

async function grantAllowed(db: ReturnType<typeof service>, userId: string): Promise<boolean> {
  const { data } = await db
    .from("support_access_grants")
    .select("allowed")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.allowed === true;
}

async function displayName(
  db: ReturnType<typeof service>,
  userId: string,
  fallback: string,
): Promise<string> {
  const { data } = await db
    .from("profiles")
    .select("display_name, first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    data?.display_name?.trim() ||
    [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
    fallback
  );
}

const HOME_BY_ROLE: Record<string, string> = {
  platform_owner: "/admin",
  co_admin: "/admin",
  school: "/school",
  teacher: "/teaching-hub",
  parent: "/family",
  student: "/student/classes",
};

async function enter(db: ReturnType<typeof service>, adminUserId: string, targetUserId: string) {
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(targetUserId);
  if (userErr) throw new Error(userErr.message);
  const email = userRes?.user?.email;
  if (!email) throw new Error("That account has no email address to sign in with.");

  const { data: roleRows } = await db.from("user_roles").select("role").eq("user_id", targetUserId);
  const role = (roleRows ?? [])[0]?.role ?? "teacher";
  const name = await displayName(db, targetUserId, email);
  const owned = await isOwnTestAccount(db, adminUserId, targetUserId);
  const granted = await grantAllowed(db, targetUserId);
  const canMint =
    targetUserId === adminUserId || owned || granted === true;

  if (!canMint) {
    return json({
      requiresCredentials: true,
      supportAccess: "none",
      email,
      role,
      home: HOME_BY_ROLE[role] ?? "/",
      name,
    });
  }

  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(error?.message ?? "Could not open that workspace.");
  }

  await db.from("admin_impersonation_log").insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
    target_role: role,
  });
  if (targetUserId !== adminUserId) {
    await db.from("support_access_log").insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
    });
  }

  return json({
    requiresCredentials: false,
    tokenHash: link.properties.hashed_token,
    email,
    role,
    home: HOME_BY_ROLE[role] ?? "/",
    name,
    via: targetUserId === adminUserId || owned ? "owned" : "grant",
  });
}

async function requestAccess(
  db: ReturnType<typeof service>,
  adminUserId: string,
  targetUserId: string,
) {
  if (adminUserId === targetUserId) {
    throw new Error("You are already signed in to this account.");
  }
  if (await grantAllowed(db, targetUserId)) {
    return json({ alreadyGranted: true });
  }

  const { data: existing } = await db
    .from("support_access_requests")
    .select("id")
    .eq("target_user_id", targetUserId)
    .eq("admin_user_id", adminUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing?.id) {
    return json({ alreadyRequested: true, requestId: existing.id });
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

  const adminName = await displayName(db, adminUserId, "A platform administrator");
  const { data: notification, error: notifyError } = await db
    .from("notifications")
    .insert({
      kind: "system",
      sender_user_id: adminUserId,
      sender_role: "system",
      subject: "Support access request",
      body:
        `${adminName} has asked for permission to enter your account, so they can see a problem the way you see it. ` +
        "They will not need your password. You can allow or deny this on your account page, and you can turn access off at any time.",
      context: { supportRequestId: data.id, source: "support_access" },
      target_path: "/account#support-access",
      category: "system",
      allow_responses: false,
      recipient_count: 1,
    })
    .select("id")
    .single();
  if (!notifyError && notification?.id) {
    await db.from("notifications").update({ thread_root_id: notification.id }).eq("id", notification.id);
    await db.from("notification_recipients").insert({
      notification_id: notification.id,
      recipient_user_id: targetUserId,
    });
  }

  return json({ requestId: data.id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await requireUser(req);
  if (user instanceof Response) return user;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const targetUserId = String(body?.targetUserId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json({ error: "A valid account is required." }, 400);
    }

    const db = service();
    await assertPlatformAdmin(db, user);

    if (action === "enter") return await enter(db, user, targetUserId);
    if (action === "request") return await requestAccess(db, user, targetUserId);
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 400;
    return json({ error: (error as Error).message ?? "Request failed." }, status);
  }
});

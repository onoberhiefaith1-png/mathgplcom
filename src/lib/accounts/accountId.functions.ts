/**
 * MathGPL ID sign-in and account-identity emails.
 *
 * A MathGPL ID is an identifier, never a secret: the ID alone tells the
 * browser nothing. The ID and the password travel together to the server,
 * which resolves the account, verifies the password, and only then returns a
 * session. An unknown ID and a wrong password produce the same message, so
 * the form cannot be used to discover which IDs exist.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EMAIL_NOT_FOUND_MESSAGE,
  ID_NOT_FOUND_MESSAGE,
  ID_PATTERN,
  PASSWORD_INCORRECT_MESSAGE,
  credentialsSchema,
  emailSchema,
  firstNameOf,
  throttle,
  userIdSchema,
} from "./accountIdRules";

/**
 * A wrong ID or password is an ordinary outcome of a login form, not a server
 * fault, so it is RETURNED as `{ ok: false }` instead of thrown. Throwing here
 * surfaced the failed attempt as an unhandled server-function runtime error
 * (dev error overlay, blank screen) even though the form handled it.
 */
export const signInWithMathgplId = createServerFn({ method: "POST" })
  .inputValidator((data: { mathgplId: string; password: string }) => credentialsSchema.parse(data))
  .handler(async ({ data }): Promise<
    | { ok: true; accessToken: string; refreshToken: string }
    | { ok: false; reason: "id_not_found" | "email_not_found" | "password_incorrect" | "unconfirmed" | "throttled"; message: string }
  > => {
    try {
      throttle(data.mathgplId);
    } catch (error) {
      return { ok: false, reason: "throttled", message: (error as Error).message };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = await import("./accountIds.server");
    const entry = data.mathgplId.trim();
    const issued = normaliseId(entry);

    // A chosen ID first, then the permanent issued one.
    let userId: string | null = null;
    if (!entry.includes("/")) userId = await ids.userIdByCustomId(entry);
    if (!userId && ID_PATTERN.test(issued)) userId = await ids.userIdByIssuedId(issued);
    if (!userId) {
      return { ok: false, reason: "id_not_found", message: ID_NOT_FOUND_MESSAGE };
    }
    const row = { user_id: userId };

    const { data: found } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = found?.user?.email;
    if (!email) {
      return { ok: false, reason: "email_not_found", message: EMAIL_NOT_FOUND_MESSAGE };
    }

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: signIn, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.session) {
      if (error && /not confirmed/i.test(error.message)) {
        return {
          ok: false,
          reason: "unconfirmed",
          message: "Please confirm your email address before signing in.",
        };
      }
      return { ok: false, reason: "password_incorrect", message: PASSWORD_INCORRECT_MESSAGE };
    }

    return {
      ok: true,
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });


/**
 * The permanent MathGPL ID of a freshly created account, so the sign-up
 * screen can show it before the person has confirmed their email address.
 *
 * An account that somehow has no ID yet (older row, administrator-created,
 * interrupted trigger) is issued one here against the same user record — never
 * a second account. The account type chosen at registration decides the ID, so
 * a student is never given a teacher ID.
 */
export const mathgplIdForUser = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; role?: string | null }) => userIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("account_ids")
      .select("mathgpl_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (row?.mathgpl_id) return { mathgplId: row.mathgpl_id };

    const { data: issued } = await supabaseAdmin.rpc("issue_account_id", {
      _user_id: data.userId,
      ...(data.role ? { _role: data.role } : {}),
    });
    return { mathgplId: (issued as string | null) ?? null };
  });


/**
 * Forgot MathGPL ID.
 *
 * The existing ID is emailed to the address on file; no new ID is ever issued
 * and the password is untouched. The response is identical whether or not the
 * address belongs to an account, so this form cannot be used to discover which
 * email addresses are registered.
 */
export const sendMathgplIdReminder = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) =>
    emailSchema.parse(data),
  )
  .handler(async ({ data }) => {
    throttle(`id-reminder:${data.email.toLowerCase()}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mathgplId } = await supabaseAdmin.rpc("mathgpl_id_for_email", {
      _email: data.email,
    });

    if (typeof mathgplId === "string" && mathgplId.length > 0) {
      const { data: account } = await supabaseAdmin
        .from("account_ids")
        .select("user_id")
        .eq("mathgpl_id", mathgplId)
        .maybeSingle();

      let userName: string | undefined;
      if (account?.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, first_name")
          .eq("user_id", account.user_id)
          .maybeSingle();
        userName = firstNameOf(profile?.display_name ?? null, profile?.first_name ?? null);
      }

      const { enqueueAccountEmail } = await import("@/lib/email/accountEmails.server");

      await enqueueAccountEmail({
        to: data.email,
        label: "account_id_reminder",
        templateName: "account-id",
        templateData: { userName, mathgplId, email: data.email },
        idempotencyKey: `account-id-${mathgplId}-${data.email}`,
      });
    }

    return { ok: true };
  });

/**
 * The "Your MathGPL account has been created" record, sent once the account is
 * confirmed and the person has a session. Sending is idempotent: if the notice
 * has already gone to this address, nothing is sent again.
 */
export const sendAccountCreatedNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = found?.user?.email;
    if (!email) return { ok: false };

    const { alreadySent, enqueueAccountEmail } = await import("@/lib/email/accountEmails.server");
    if (await alreadySent("account_created", email)) return { ok: true, skipped: true };

    let mathgplId: string | null = null;
    const { data: row } = await supabaseAdmin
      .from("account_ids")
      .select("mathgpl_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    mathgplId = row?.mathgpl_id ?? null;
    if (!mathgplId) {
      const { data: issued } = await supabaseAdmin.rpc("issue_account_id", {
        _user_id: context.userId,
      });
      mathgplId = (issued as string | null) ?? null;
    }
    if (!mathgplId) return { ok: false };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, first_name")
      .eq("user_id", context.userId)
      .maybeSingle();

    const result = await enqueueAccountEmail({
      to: email,
      label: "account_created",
      templateName: "account-created",
      templateData: {
        userName: firstNameOf(profile?.display_name ?? null, profile?.first_name ?? null),
        mathgplId,
        email,
      },
      idempotencyKey: `account-created-${mathgplId}`,
    });

    return { ok: result.ok };
  });


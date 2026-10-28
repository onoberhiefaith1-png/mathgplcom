/**
 * Secret entrance: authorised access without a subscription.
 *
 * Three things must line up — MathGPL ID, password and an access code that
 * either belongs to nobody yet or already belongs to this exact person. The
 * code is bound to the first account that uses it, so a shared code stops
 * working for everyone else. Nothing here can grant administrative rights:
 * the code only unlocks the paid features of the person's own account type.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const GENERIC = "Those details don't match an authorised entrance.";

export const signInWithAccessCode = createServerFn({ method: "POST" })
  .inputValidator((data: { mathgplId: string; password: string; accessCode: string }) => {
    const mathgplId = String(data.mathgplId ?? "").trim().toUpperCase();
    const password = String(data.password ?? "");
    const accessCode = String(data.accessCode ?? "").trim().toUpperCase();
    if (!mathgplId || !password || !accessCode) throw new Error(GENERIC);
    return { mathgplId, password, accessCode };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeRow } = await supabaseAdmin
      .from("staff_codes")
      .select("id, active, expires_at, revoked_at, claimed_by")
      .eq("code", data.accessCode)
      .maybeSingle();

    const expired = codeRow?.expires_at ? new Date(codeRow.expires_at as string) <= new Date() : false;
    if (!codeRow || codeRow.active === false || codeRow.revoked_at || expired) throw new Error(GENERIC);

    const { data: idRow } = await supabaseAdmin
      .from("account_ids")
      .select("user_id")
      .eq("mathgpl_id", data.mathgplId)
      .maybeSingle();
    if (!idRow?.user_id) throw new Error(GENERIC);
    const userId = idRow.user_id as string;

    // A code belongs to one person only.
    if (codeRow.claimed_by && codeRow.claimed_by !== userId) {
      throw new Error("That access code is already in use by another person.");
    }

    const { data: found } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = found?.user?.email;
    if (!email) throw new Error(GENERIC);

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
    if (error || !signIn.session) throw new Error(GENERIC);

    // Bind the code and carry the person's usage on the platform.
    if (!codeRow.claimed_by) {
      await supabaseAdmin
        .from("staff_codes")
        .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
        .eq("id", codeRow.id as string);
    }
    const { data: unit } = await supabaseAdmin.rpc("ensure_user_cost_unit", { _user_id: userId });
    if (unit) {
      await supabaseAdmin
        .from("staff_redemptions")
        .upsert(
          { code_id: codeRow.id as string, cost_unit_id: unit as string, user_id: userId, active: true },
          { onConflict: "code_id,cost_unit_id" },
        );
    }

    return {
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });

/**
 * Choosing your own sign-in ID.
 *
 * The permanent issued ID (TCH/000012) is never touched, so nobody can lock
 * themselves out; the chosen ID is simply an additional, memorable way in.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { customIdError, customIdSchema } from "./customIdRules";
import { firstNameOf } from "./accountIdRules";

const TAKEN = "That ID is already taken.";

/** Is this ID free? Never reveals who holds a taken ID. */
export const checkAccountIdAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customId: string }) => ({ customId: String(data.customId ?? "").trim() }))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message?: string }> => {
    const problem = customIdError(data.customId);
    if (problem) return { ok: false, message: problem };

    const ids = await import("./accountIds.server");
    if (await ids.issuedIdExists(data.customId)) return { ok: false, message: TAKEN };
    const holder = await ids.userIdByCustomId(data.customId);
    if (holder && holder !== context.userId) return { ok: false, message: TAKEN };
    return { ok: true };
  });

/** Set (or change) the caller's own chosen ID. */
export const changeMyAccountId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customId: string }) => customIdSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message?: string; customId?: string }> => {
    const problem = customIdError(data.customId);
    if (problem) return { ok: false, message: problem };

    const ids = await import("./accountIds.server");
    if (await ids.issuedIdExists(data.customId)) return { ok: false, message: TAKEN };
    const holder = await ids.userIdByCustomId(data.customId);
    if (holder && holder !== context.userId) return { ok: false, message: TAKEN };

    const mine = await ids.accountIdRow(context.userId);
    const history = Array.isArray(mine?.custom_id_history) ? (mine!.custom_id_history as unknown[]) : [];
    const nextHistory = mine?.custom_id
      ? [...history, { id: mine.custom_id, changedAt: new Date().toISOString() }].slice(-20)
      : history;

    const written = await ids.writeCustomId(context.userId, data.customId, nextHistory);
    if (!written.ok) {
      return {
        ok: false,
        message: written.duplicate ? TAKEN : "That ID could not be saved. Please try again.",
      };
    }

    // Record the change by email, so the person always has their ID on file.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = found?.user?.email;
    if (email && !email.endsWith("@managed.mathgpl.local")) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("display_name, first_name")
        .eq("user_id", context.userId)
        .maybeSingle();
      const { enqueueAccountEmail } = await import("@/lib/email/accountEmails.server");
      await enqueueAccountEmail({
        to: email,
        label: "account_id_changed",
        templateName: "account-id",
        templateData: {
          userName: firstNameOf(profile?.display_name ?? null, profile?.first_name ?? null),
          mathgplId: data.customId,
          email,
        },
        idempotencyKey: `account-id-changed-${context.userId}-${data.customId}`,
      });
    }

    return { ok: true, customId: data.customId };
  });

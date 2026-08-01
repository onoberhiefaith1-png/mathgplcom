/**
 * Email Dashboard server functions (administrator only).
 *
 * Client-safe module: the server-only helpers are imported inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const senderSchema = z.object({
  sender_name: z.string().trim().min(1).max(80),
  sender_email: z.string().trim().email().max(255),
  reply_to_email: z.union([z.string().trim().email().max(255), z.literal("")]),
  notes: z.string().trim().max(500).optional(),
});

const colorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, "Use a colour like #f59e0b");

const templateSchema = z.object({
  template_key: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(1).max(200),
  body: z.string().max(8000),
  footer: z.string().max(2000),
  signature: z.string().max(500),
  heading_color: colorSchema,
  text_color: colorSchema,
  button_color: colorSchema,
  button_label: z.string().trim().min(1).max(60),
  logo_text: z.string().trim().max(60),
});

export const fetchEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const [sender, templates, connection] = await Promise.all([
      mod.loadSender(),
      mod.loadTemplates(),
      mod.connectionStatus(),
    ]);
    return { sender, templates, connection };
  });

export const saveEmailSender = createServerFn({ method: "POST" })
  .inputValidator((data) => senderSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_email_settings")
      .update({
        sender_name: data.sender_name,
        sender_email: data.sender_email,
        reply_to_email: data.reply_to_email,
        notes: data.notes ?? "",
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((data) => templateSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_email_templates")
      .update({
        subject: data.subject,
        body: data.body,
        footer: data.footer,
        signature: data.signature,
        heading_color: data.heading_color,
        text_color: data.text_color,
        button_color: data.button_color,
        button_label: data.button_label,
        logo_text: data.logo_text,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("template_key", data.template_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        to: z.string().trim().email().max(255),
        template_key: z.string().trim().min(1).max(60),
        origin: z.string().trim().url(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { PREVIEW_DATA } = await import("./templates");
    return mod.sendPlatformEmail({
      templateKey: data.template_key,
      to: data.to,
      data: PREVIEW_DATA,
      origin: data.origin,
    });
  });

/** Sender addresses saved for reuse, plus the one currently in use. */
export const fetchSavedSenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    return mod.loadSavedSenders();
  });

export const addSavedSender = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        sender_name: z.string().trim().min(1).max(80),
        sender_email: z.string().trim().email().max(255),
        reply_to_email: z.union([z.string().trim().email().max(255), z.literal("")]),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_email_senders")
      .upsert(
        {
          sender_name: data.sender_name,
          sender_email: data.sender_email,
          reply_to_email: data.reply_to_email,
        },
        { onConflict: "sender_email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSavedSender = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_email_senders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Make a saved address the live sender — this is what every email then uses. */
export const activateSavedSender = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: readError } = await supabaseAdmin
      .from("platform_email_senders")
      .select("sender_name, sender_email, reply_to_email")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("That sender address no longer exists.");

    await supabaseAdmin.from("platform_email_senders").update({ is_active: false }).neq("id", data.id);
    await supabaseAdmin.from("platform_email_senders").update({ is_active: true }).eq("id", data.id);

    const { error } = await supabaseAdmin
      .from("platform_email_settings")
      .update({
        sender_name: row.sender_name,
        sender_email: row.sender_email,
        reply_to_email: row.reply_to_email,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delivery history: how many emails went out, to whom, and what failed. */
export const fetchEmailActivity = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        since: z.string().datetime(),
        until: z.string().datetime(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const mod = await import("./platformEmail.server");
    await mod.assertOwner(context.supabase, context.userId);
    return mod.loadActivity(data.since, data.until);
  });

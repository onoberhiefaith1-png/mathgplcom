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

const templateSchema = z.object({
  template_key: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(1).max(200),
  body: z.string().max(8000),
  footer: z.string().max(2000),
  signature: z.string().max(500),
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

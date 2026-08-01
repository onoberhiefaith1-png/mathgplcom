/**
 * Server-only email plumbing.
 *
 * This is the single place the platform resolves the sender identity and a
 * saved template, and the single place an email leaves the application. When
 * the administrator changes the sender address in the Email Dashboard, nothing
 * else in the app has to change.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderTemplate, type ConnectionState } from "./templates";

type AnyClient = SupabaseClient<any, any, any>;

export async function assertOwner(supabase: AnyClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["platform_owner"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Only the platform administrator can manage email settings.");
}

export async function loadSender() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_email_settings")
    .select("sender_name, sender_email, reply_to_email, notes, updated_at")
    .eq("id", true)
    .maybeSingle();
  return (
    data ?? {
      sender_name: "MathGPL",
      sender_email: "",
      reply_to_email: "",
      notes: "",
      updated_at: null,
    }
  );
}

export async function loadTemplates() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_email_templates")
    .select("template_key, display_name, subject, body, footer, signature, updated_at")
    .order("display_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Is the platform actually able to deliver mail right now?
 *
 * Delivery requires the shared email infrastructure (queue + send log). Until a
 * sender domain is attached, MathGPL still sends built-in account emails
 * (verification, password reset) through the default platform sender, which is
 * why that case reports `awaiting_dns` rather than a hard failure.
 */
export async function connectionStatus(): Promise<{
  state: ConnectionState;
  detail: string;
  infrastructure: boolean;
  lastError: string | null;
  recentSends: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const probe = await (supabaseAdmin as unknown as AnyClient)
    .from("email_send_log")
    .select("status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(25);

  if (probe.error) {
    return {
      state: "not_connected",
      detail:
        "No sending domain is attached yet. Account emails go out from the default MathGPL sender; attach your own domain to send from your address.",
      infrastructure: false,
      lastError: null,
      recentSends: 0,
    };
  }

  const rows = (probe.data ?? []) as unknown as { status: string; error_message: string | null }[];
  const failed = rows.find((r) => r.status === "failed" || r.status === "dlq");
  const message = failed?.error_message ?? "";
  let state: ConnectionState = "connected";
  if (/rate|limit/i.test(message)) state = "limit_reached";
  else if (/invalid.*(key|credential)/i.test(message)) state = "invalid_credentials";
  else if (/unauthor|401|403/i.test(message)) state = "auth_failed";

  return {
    state,
    detail:
      state === "connected"
        ? "Email delivery is active."
        : "The last send attempt did not succeed — see the reported reason.",
    infrastructure: true,
    lastError: failed?.error_message ?? null,
    recentSends: rows.filter((r) => r.status === "sent").length,
  };
}

export type SendInput = {
  templateKey: string;
  to: string;
  data?: Record<string, string>;
  origin: string;
  idempotencyKey?: string;
};

/**
 * The only outgoing email path in the application. Every feature that needs to
 * notify somebody calls this, so sender changes apply everywhere at once.
 */
export async function sendPlatformEmail(input: SendInput): Promise<{ ok: boolean; message: string }> {
  const sender = await loadSender();
  const templates = await loadTemplates();
  const template = templates.find((t) => t.template_key === input.templateKey);
  if (!template) return { ok: false, message: `Unknown email template: ${input.templateKey}` };

  const data = { ...(input.data ?? {}) };
  const subject = renderTemplate(template.subject, data);
  const body = renderTemplate(template.body, data);

  const status = await connectionStatus();
  if (!status.infrastructure) {
    return {
      ok: false,
      message:
        "Email delivery is not connected yet. Attach a sending domain in the Email Dashboard, then try again.",
    };
  }

  try {
    const res = await fetch(`${input.origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName: "platform-message",
        recipientEmail: input.to,
        idempotencyKey: input.idempotencyKey ?? `${input.templateKey}-${input.to}-${Date.now()}`,
        templateData: {
          subject,
          body,
          footer: renderTemplate(template.footer, data),
          signature: renderTemplate(template.signature, data),
          senderName: sender.sender_name,
          replyTo: sender.reply_to_email || sender.sender_email,
        },
      }),
    });
    if (!res.ok) return { ok: false, message: `Send failed (${res.status}): ${(await res.text()).slice(0, 300)}` };
    return { ok: true, message: `Sent to ${input.to}.` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

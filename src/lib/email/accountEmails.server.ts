/**
 * Server-only sender for account-identity emails (MathGPL ID reminder,
 * account-created notice).
 *
 * Sending goes through Lovable's managed email delivery: the registered
 * template is rendered and sent synchronously, and the outcome is recorded in
 * `email_send_log` so the Email Dashboard keeps its history.
 */

type SendInput = {
  to: string;
  label: string;
  templateName: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
};

async function logSend(
  label: string,
  to: string,
  status: "sent" | "suppressed" | "failed",
  errorMessage?: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_send_log").insert({
    template_name: label,
    recipient_email: to,
    status,
    error_message: errorMessage ?? null,
  });
  if (error) console.error("email_send_log insert failed", error.code, error.message);
}

/** Send one account email to one recipient. */
export async function enqueueAccountEmail(input: SendInput): Promise<{ ok: boolean; message: string }> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  try {
    const result = await sendTemplateEmail(input.templateName, input.to, {
      templateData: input.templateData ?? {},
      idempotencyKey: input.idempotencyKey ?? `${input.label}-${input.to}`,
    });

    if (!result.sent) {
      await logSend(input.label, input.to, "suppressed", "Recipient is suppressed.");
      return { ok: true, message: "Recipient is unsubscribed or blocked, so nothing was sent." };
    }

    await logSend(input.label, input.to, "sent");
    return { ok: true, message: "sent" };
  } catch (error) {
    const message = (error as Error).message;
    await logSend(input.label, input.to, "failed", message);
    return { ok: false, message };
  }
}

/** Has this exact email already gone to this address? */
export async function alreadySent(label: string, email: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("email_send_log")
    .select("message_id")
    .eq("template_name", label)
    .eq("recipient_email", email)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Server-only sender for account-identity emails (MathGPL ID reminder,
 * account-created notice).
 *
 * These go through exactly the same path as the built-in account emails: the
 * message is rendered here, logged as pending, and handed to the shared email
 * queue, which sends it and retries on failure. Nothing here touches the
 * sending domain, the webhook or the cron job.
 */
import * as React from "react";
import { render } from "@react-email/render";

const SITE_NAME = "MathGPL";
const SENDER_DOMAIN = "notify.mathgpl.com";
const FROM_DOMAIN = "mathgpl.com";

type SendInput = {
  to: string;
  subject: string;
  label: string;
  element: React.ReactElement;
};

/** Enqueue one rendered email for one recipient. */
export async function enqueueAccountEmail(input: SendInput): Promise<{ ok: boolean; message: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const html = await render(input.element);
  const text = await render(input.element, { plainText: true });
  const messageId = crypto.randomUUID();

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: input.label,
    recipient_email: input.to,
    status: "pending",
  });

  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: input.to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: input.subject,
      html,
      text,
      purpose: "transactional",
      label: input.label,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.label,
      recipient_email: input.to,
      status: "failed",
      error_message: error.message,
    });
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "queued" };
}

/** Has this exact email already been queued for this address? */
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

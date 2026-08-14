import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stripe's own account of what happened.
 *
 * A student's paid access is granted, kept or withdrawn here and nowhere else:
 * a click on a pay button proves nothing. Events arrive from the connected
 * accounts of teachers and schools, so each one carries the account it belongs
 * to and we match it back to that workspace.
 */

type StripeEvent = {
  id: string;
  type: string;
  account?: string;
  data: { object: Record<string, unknown> };
};

const verify = (payload: string, header: string | null, secret: string): boolean => {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;
    (acc[key] ??= []).push(value);
    return acc;
  }, {});
  const timestamp = parts["t"]?.[0];
  const signatures = parts["v1"] ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const exp = Buffer.from(expected);
  return signatures.some((signature) => {
    const sig = Buffer.from(signature);
    return sig.length === exp.length && timingSafeEqual(sig, exp);
  });
};

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_CONNECT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const body = await request.text();
        if (!verify(body, request.headers.get("stripe-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as StripeEvent;
        const object = event.data.object;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const activate = async (input: {
          sessionId: string | null;
          subscriptionId: string | null;
          customerId: string | null;
          paymentIntentId: string | null;
          invoiceId: string | null;
          planId: string | null;
          ownerId: string | null;
          ownerKind: string | null;
          studentId: string | null;
        }) => {
          let { planId, ownerId, ownerKind, studentId } = input;

          if ((!planId || !studentId) && input.sessionId) {
            const { data: payment } = await supabaseAdmin
              .from("gateway_payments")
              .select("plan_id, owner_id, owner_kind, student_id, granted_items")
              .eq("stripe_checkout_session_id", input.sessionId)
              .maybeSingle();
            planId ??= payment?.plan_id ?? null;
            ownerId ??= payment?.owner_id ?? null;
            ownerKind ??= payment?.owner_kind ?? null;
            studentId ??= payment?.student_id ?? null;
          }

          if (!planId || !ownerId || !ownerKind || !studentId) return;

          let lockedItems: string[] = [];
          if (input.sessionId) {
            const { data: paymentSnapshot } = await supabaseAdmin
              .from("gateway_payments")
              .select("granted_items")
              .eq("stripe_checkout_session_id", input.sessionId)
              .maybeSingle();
            lockedItems = paymentSnapshot?.granted_items ?? [];
          }

          await supabaseAdmin.from("gateway_entitlements").upsert(
            {
              owner_id: ownerId,
              owner_kind: ownerKind,
              student_id: studentId,
              plan_id: planId,
              granted_items: lockedItems,
              source: "paid",
              status: "active",
              payment_provider: "stripe",
              payment_reference: input.paymentIntentId ?? input.subscriptionId ?? input.sessionId,
              stripe_customer_id: input.customerId,
              stripe_subscription_id: input.subscriptionId,
              stripe_checkout_session_id: input.sessionId,
            },
            { onConflict: "owner_id,owner_kind,student_id" },
          );

          // Paying is entering: the student's workspace access is recorded here,
          // so the school's or teacher's learning activates on their dashboard.
          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("owner_user_id", ownerId)
            .maybeSingle();
          await supabaseAdmin.from("student_workspace_access").upsert(
            {
              student_id: studentId,
              owner_id: ownerId,
              org_id: ownerKind === "school" ? org?.id ?? null : null,
              source: "paid",
              granted_at: new Date().toISOString(),
            },
            { onConflict: "student_id,owner_id" },
          );



          if (input.sessionId) {
            await supabaseAdmin
              .from("gateway_payments")
              .update({
                status: "paid",
                stripe_payment_intent_id: input.paymentIntentId,
                stripe_subscription_id: input.subscriptionId,
                stripe_invoice_id: input.invoiceId,
              })
              .eq("stripe_checkout_session_id", input.sessionId);
          }
        };

        const setStatus = async (subscriptionId: string, status: "active" | "pending_payment" | "revoked") => {
          await supabaseAdmin
            .from("gateway_entitlements")
            .update({ status })
            .eq("stripe_subscription_id", subscriptionId);
        };

        switch (event.type) {
          case "account.updated": {
            const accountId = asString(object["id"]) ?? event.account ?? null;
            if (accountId) {
              const charges = Boolean(object["charges_enabled"]);
              await supabaseAdmin
                .from("gateway_payout_accounts")
                .update({
                  charges_enabled: charges,
                  details_submitted: Boolean(object["details_submitted"]),
                  status: charges ? "verified" : "pending",
                  ...(charges ? {} : { payments_active: false }),
                })
                .eq("stripe_account_id", accountId);
            }
            break;
          }

          case "checkout.session.completed": {
            const metadata = (object["metadata"] ?? {}) as Record<string, string>;
            if (object["payment_status"] === "unpaid") break;
            await activate({
              sessionId: asString(object["id"]),
              subscriptionId: asString(object["subscription"]),
              customerId: asString(object["customer"]),
              paymentIntentId: asString(object["payment_intent"]),
              invoiceId: asString(object["invoice"]),
              planId: metadata["mathgpl_plan_id"] ?? null,
              ownerId: metadata["mathgpl_owner_id"] ?? null,
              ownerKind: metadata["mathgpl_owner_kind"] ?? null,
              studentId: metadata["mathgpl_student_id"] ?? null,
            });
            break;
          }

          case "invoice.paid": {
            const subscriptionId = asString(object["subscription"]);
            if (subscriptionId) await setStatus(subscriptionId, "active");
            break;
          }

          case "invoice.payment_failed": {
            const subscriptionId = asString(object["subscription"]);
            if (subscriptionId) await setStatus(subscriptionId, "pending_payment");
            break;
          }

          case "customer.subscription.updated": {
            const subscriptionId = asString(object["id"]);
            const status = asString(object["status"]);
            if (!subscriptionId || !status) break;
            if (status === "active" || status === "trialing") await setStatus(subscriptionId, "active");
            else if (status === "past_due" || status === "unpaid" || status === "incomplete")
              await setStatus(subscriptionId, "pending_payment");
            else await setStatus(subscriptionId, "revoked");
            break;
          }

          case "customer.subscription.deleted": {
            const subscriptionId = asString(object["id"]);
            if (subscriptionId) await setStatus(subscriptionId, "revoked");
            break;
          }

          case "charge.refunded": {
            const paymentIntentId = asString(object["payment_intent"]);
            if (paymentIntentId) {
              await supabaseAdmin
                .from("gateway_payments")
                .update({ status: "refunded" })
                .eq("stripe_payment_intent_id", paymentIntentId);
              const { data: payment } = await supabaseAdmin
                .from("gateway_payments")
                .select("owner_id, owner_kind, student_id")
                .eq("stripe_payment_intent_id", paymentIntentId)
                .maybeSingle();
              if (payment) {
                await supabaseAdmin
                  .from("gateway_entitlements")
                  .update({ status: "revoked" })
                  .eq("owner_id", payment.owner_id)
                  .eq("owner_kind", payment.owner_kind)
                  .eq("student_id", payment.student_id);
              }
            }
            break;
          }

          default:
            break;
        }

        return new Response("ok");
      },
    },
  },
});

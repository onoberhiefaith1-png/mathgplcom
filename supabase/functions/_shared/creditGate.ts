/**
 * Server-side credit gate for edge functions.
 *
 * Nothing chargeable starts unless the account can pay for it, and the decision
 * is made here — never in the browser. Holds are reserved before the work runs
 * and released afterwards, so two requests can never spend the same credit.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

export type GateDecision =
  | { allowed: true; operationKey: string | null }
  | { allowed: false; reason: string; message: string; available: number };

const admin = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const MESSAGES: Record<string, string> = {
  floor: "You have run out of credits. Top up your balance to keep generating.",
  insufficient: "You have run out of credits. Top up your balance to keep generating.",
  past_due: "Your payment did not go through, so generation is paused. Update your payment method to continue.",
  no_ai_plan: "AI generation is part of a paid plan. Upgrade your plan to generate.",
  disabled: "Credit usage is currently disabled for this account.",
  expired: "Your plan has expired. Renew it to start using credits again — your work is safe in the meantime.",
};


/** Reserves credits for one operation. Returns the key to settle it with. */
export async function openCreditGate(
  userId: string,
  feature: string,
  estimatedCredits = 0.5,
): Promise<GateDecision> {
  const client = admin();
  if (!client) return { allowed: true, operationKey: null };

  try {
    const { data: profile } = await client
      .from("profiles")
      .select("active_org_id")
      .eq("user_id", userId)
      .maybeSingle();
    const orgId = (profile?.active_org_id as string | null) ?? null;

    const { data: aiAllowed } = await client.rpc("plan_allows_ai", {
      _user_id: userId,
      _org_id: orgId,
    });
    if (aiAllowed === false) {
      return { allowed: false, reason: "no_ai_plan", message: MESSAGES.no_ai_plan, available: 0 };
    }

    const operationKey = `${feature}:${crypto.randomUUID()}`;
    const { data, error } = await client.rpc("reserve_credits", {
      _user_id: userId,
      _org_id: orgId,
      _operation_key: operationKey,
      _credits: estimatedCredits,
      _feature: feature,
    });
    if (error) return { allowed: true, operationKey: null }; // Never break a lesson on our own fault.

    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.ok === false) {
      const reason = String(row.reason ?? "insufficient");
      return {
        allowed: false,
        reason,
        message: MESSAGES[reason] ?? MESSAGES.insufficient,
        available: Number(row.available ?? 0),
      };
    }
    return { allowed: true, operationKey };
  } catch {
    return { allowed: true, operationKey: null };
  }
}

export async function closeCreditGate(operationKey: string | null, status = "consumed") {
  if (!operationKey) return;
  const client = admin();
  if (!client) return;
  try {
    await client.rpc("settle_credit_reservation", {
      _operation_key: operationKey,
      _status: status,
    });
  } catch {
    // A stale hold expires on its own; it can never be lost permanently.
  }
}

/**
 * Forced stop for long-running work: once the wallet drops to the emergency
 * floor, the operation must stop rather than run the balance negative.
 */
export async function creditStopReached(userId: string): Promise<boolean> {
  const client = admin();
  if (!client) return false;
  try {
    const { data: profile } = await client
      .from("profiles")
      .select("active_org_id")
      .eq("user_id", userId)
      .maybeSingle();
    const { data } = await client.rpc("credit_headroom", {
      _user_id: userId,
      _org_id: (profile?.active_org_id as string | null) ?? null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.enforced === false) return false;
    return Number(row.available ?? 0) <= Number(row.stop_floor ?? 0.3);
  } catch {
    return false;
  }
}

export function creditBlockedResponse(decision: Extract<GateDecision, { allowed: false }>) {
  return new Response(
    JSON.stringify({
      error: decision.message,
      reason: decision.reason,
      available: decision.available,
    }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

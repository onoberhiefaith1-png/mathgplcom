/**
 * Server-only credit gate for server functions.
 *
 * The rule is the same everywhere: required credit must be available before the
 * work starts, the hold is taken atomically, and it is released the moment the
 * operation finishes — success or failure.
 */

export type Headroom = {
  enforced: boolean;
  balance: number;
  reserved: number;
  available: number;
  startFloor: number;
  stopFloor: number;
  blockedReason: string | null;
};

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const first = <T,>(data: T | T[] | null): T | null =>
  Array.isArray(data) ? (data[0] ?? null) : (data ?? null);

export async function activeOrgFor(userId: string): Promise<string | null> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.active_org_id as string | null) ?? null;
}

export async function creditHeadroom(userId: string, orgId?: string | null): Promise<Headroom> {
  const supabaseAdmin = await admin();
  const org = orgId === undefined ? await activeOrgFor(userId) : orgId;
  const { data } = await supabaseAdmin.rpc("credit_headroom", {
    _user_id: userId,
    _org_id: org,
  } as never);
  const row = first(data as never) as Record<string, unknown> | null;
  return {
    enforced: Boolean(row?.enforced),
    balance: Number(row?.balance ?? 0),
    reserved: Number(row?.reserved ?? 0),
    available: Number(row?.available ?? 0),
    startFloor: Number(row?.start_floor ?? 0.5),
    stopFloor: Number(row?.stop_floor ?? 0.3),
    blockedReason: (row?.blocked_reason as string | null) ?? null,
  };
}

export async function planAllowsAi(userId: string, orgId?: string | null): Promise<boolean> {
  const supabaseAdmin = await admin();
  const org = orgId === undefined ? await activeOrgFor(userId) : orgId;
  const { data, error } = await supabaseAdmin.rpc("plan_allows_ai", {
    _user_id: userId,
    _org_id: org,
  } as never);
  if (error) return true;
  return data !== false;
}

export const CREDIT_MESSAGES: Record<string, string> = {
  floor: "You have run out of credits. Top up your balance to keep generating.",
  insufficient: "You have run out of credits. Top up your balance to keep generating.",
  past_due: "Your payment did not go through, so generation is paused. Update your payment method to continue.",
  no_ai_plan: "AI generation is part of a paid plan. Upgrade your plan to generate.",
  stopped: "Your credits ran out while this was running, so it stopped early.",
};

/**
 * Runs `work` only if the account can pay for it. The reservation is settled in
 * `finally`, so a crash can never leave credits stranded.
 */
export async function withCredits<T>(
  options: { userId: string; feature: string; estimatedCredits?: number; requiresAi?: boolean },
  work: (operationKey: string | null) => Promise<T>,
): Promise<T> {
  const supabaseAdmin = await admin();
  const orgId = await activeOrgFor(options.userId);

  if (options.requiresAi !== false && !(await planAllowsAi(options.userId, orgId))) {
    throw new Error(CREDIT_MESSAGES.no_ai_plan);
  }

  const operationKey = `${options.feature}:${crypto.randomUUID()}`;
  const { data, error } = await supabaseAdmin.rpc("reserve_credits", {
    _user_id: options.userId,
    _org_id: orgId,
    _operation_key: operationKey,
    _credits: options.estimatedCredits ?? 0.5,
    _feature: options.feature,
  } as never);

  // Accounting faults must never block teaching; only an explicit refusal does.
  if (error) return work(null);

  const row = first(data as never) as Record<string, unknown> | null;
  if (row && row.ok === false) {
    const reason = String(row.reason ?? "insufficient");
    throw new Error(CREDIT_MESSAGES[reason] ?? CREDIT_MESSAGES.insufficient);
  }

  try {
    return await work(operationKey);
  } finally {
    void supabaseAdmin
      .rpc("settle_credit_reservation", { _operation_key: operationKey, _status: "consumed" } as never)
      .then(() => undefined, () => undefined);
  }
}

/** Forced stop for long operations: stop rather than run a balance negative. */
export async function creditStopReached(userId: string): Promise<boolean> {
  const head = await creditHeadroom(userId);
  if (!head.enforced) return false;
  return head.available <= head.stopFloor;
}

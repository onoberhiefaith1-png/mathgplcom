/**
 * The account's own credit position, as the account is allowed to see it:
 * a balance, a plain activity list, and the switch that stops chargeable work.
 *
 * Nothing here returns provider cost, margin, pricing version or multiplier —
 * those stay administrative.
 */

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export type CreditActivityRow = {
  id: string;
  at: string;
  label: string;
  credits: number;
  balanceAfter: number;
};

const LABELS: Record<string, string> = {
  topup: "Top-up",
  allocation: "Plan credits",
  grant: "Plan credits",
  deduction: "Usage",
  adjustment: "Adjustment",
  expiry: "Expired credits",
};

const readableLabel = (kind: string, note: string | null) => {
  const feature = (note ?? "").trim();
  if (kind === "deduction" && feature) {
    return feature
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return LABELS[kind] ?? feature ?? "Activity";
};

/** Resolves the wallet that pays for this user — their own, or their school's. */
async function payerUnit(userId: string) {
  const db = await admin();
  const { data: profile } = await db
    .from("profiles")
    .select("active_org_id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data } = await db.rpc("resolve_cost_unit", {
    _user_id: userId,
    _org_id: (profile?.active_org_id as string | null) ?? null,
  } as never);
  const unit = Array.isArray(data) ? data[0] : data;
  return (unit as string | null) ?? null;
}

export async function creditActivity(userId: string, limit = 40) {
  const db = await admin();
  const unit = await payerUnit(userId);
  if (!unit) return { balance: 0, rows: [] as CreditActivityRow[], usageEnabled: true, canManage: false };

  const [{ data: wallet }, { data: ledger }, { data: costUnit }] = await Promise.all([
    db.from("credit_wallets").select("balance").eq("cost_unit_id", unit).maybeSingle(),
    db
      .from("credit_ledger")
      .select("id, kind, amount, balance_after, note, created_at")
      .eq("cost_unit_id", unit)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200)),
    db.from("cost_units").select("credit_usage_enabled, user_id, org_id").eq("id", unit).maybeSingle(),
  ]);

  const rows: CreditActivityRow[] = (ledger ?? []).map((l) => ({
    id: String(l.id),
    at: String(l.created_at),
    label: readableLabel(String(l.kind), (l.note as string | null) ?? null),
    credits: Number(l.amount ?? 0),
    balanceAfter: Number(l.balance_after ?? 0),
  }));

  let canManage = (costUnit?.user_id as string | null) === userId;
  if (!canManage && costUnit?.org_id) {
    const { data: owns } = await db.rpc("owns_org", { _org_id: costUnit.org_id } as never);
    canManage = Boolean(owns);
    if (!canManage) {
      const { data: org } = await db
        .from("organizations")
        .select("owner_user_id")
        .eq("id", costUnit.org_id as string)
        .maybeSingle();
      canManage = (org?.owner_user_id as string | null) === userId;

    }
  }

  return {
    balance: Number(wallet?.balance ?? 0),
    rows,
    usageEnabled: costUnit?.credit_usage_enabled !== false,
    canManage,
  };
}

/**
 * Turning credit usage off stops chargeable actions for everyone paid for by
 * this wallet; ordinary non-chargeable work continues untouched.
 */
export async function setCreditUsageEnabled(userId: string, enabled: boolean) {
  const db = await admin();
  const state = await creditActivity(userId, 1);
  if (!state.canManage) throw new Error("Only the account that pays for credits can change this.");
  const unit = await payerUnit(userId);
  if (!unit) throw new Error("No credit account found.");
  await db.from("cost_units").update({ credit_usage_enabled: enabled }).eq("id", unit);
  return enabled;
}

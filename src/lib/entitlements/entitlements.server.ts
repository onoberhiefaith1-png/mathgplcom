/**
 * Entitlement resolution and enforcement, server side.
 *
 * `PLAN → ENTITLEMENT → ACCESS`: the database resolver
 * `public.effective_entitlements` is the single source of truth. Nothing here
 * decides access from a role name or a plan key.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EntitlementCategory, EntitlementSource, FeatureKey, LimitKey } from "./features";
import { upgradeMessage } from "./features";

type Client = SupabaseClient<Database>;

export type EntitlementGrant = {
  feature: FeatureKey;
  source: EntitlementSource;
  /** The account financially responsible for the feature. */
  payerUserId: string | null;
};

export type CatalogueFeature = {
  key: FeatureKey;
  label: string;
  category: EntitlementCategory;
  appliesTo: string[];
  sortOrder: number;
};

export type EntitlementState = {
  features: EntitlementGrant[];
  limits: Partial<Record<LimitKey, number | null>>;
  catalogue: CatalogueFeature[];
  /** Owner/co-admin and student accounts are never gated by plans. */
  unrestricted: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function featureCatalogue(): Promise<CatalogueFeature[]> {
  const db = await admin();
  const { data } = await db
    .from("feature_entitlements")
    .select("key, label, category, applies_to, sort_order")
    .order("sort_order");
  return (data ?? []).map((r) => ({
    key: String(r.key) as FeatureKey,
    label: String(r.label),
    category: String(r.category) as EntitlementCategory,
    appliesTo: (r.applies_to as string[]) ?? [],
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

const LIMIT_KEYS: LimitKey[] = ["max_classes", "max_students"];

/** Everything the signed-in account may do right now. */
export async function myEntitlements(supabase: Client, userId: string): Promise<EntitlementState> {
  const db = await admin();

  const [{ data: roles }, { data: grants }, catalogue] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    supabase.rpc("effective_entitlements", { _user_id: userId }),
    featureCatalogue(),
  ]);

  const roleList = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  const unrestricted = roleList.some((r) => r === "platform_owner" || r === "co_admin");

  const { data: planId } = await db.rpc("account_plan_id", { _user_id: userId });
  const limits: Partial<Record<LimitKey, number | null>> = {};
  if (planId) {
    const { data: rows } = await db
      .from("plan_limits")
      .select("limit_key, limit_value")
      .eq("plan_id", planId as string);
    for (const row of rows ?? []) {
      const key = String(row.limit_key) as LimitKey;
      if (LIMIT_KEYS.includes(key)) {
        limits[key] = row.limit_value === null ? null : Number(row.limit_value);
      }
    }
  }

  return {
    unrestricted,
    catalogue,
    limits,
    features: ((grants ?? []) as { feature_key: string; source: string; payer_user_id: string | null }[]).map(
      (g) => ({
        feature: g.feature_key as FeatureKey,
        source: g.source as EntitlementSource,
        payerUserId: g.payer_user_id ?? null,
      }),
    ),
  };
}

/** Thrown when a protected path is reached without the entitlement. */
export class EntitlementError extends Error {
  readonly code = "entitlement_required";
  constructor(readonly feature: FeatureKey, message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * The security boundary. Every protected server path calls this before doing
 * work, so hiding a button is never the only thing standing in the way.
 */
export async function requireEntitlement(userId: string, feature: FeatureKey): Promise<void> {
  const db = await admin();
  const { data, error } = await db.rpc("has_entitlement", { _user_id: userId, _feature: feature });
  if (error) return; // Never break teaching because of our own fault.
  if (data === false) throw new EntitlementError(feature, upgradeMessage(feature));
}

export async function hasEntitlement(userId: string, feature: FeatureKey): Promise<boolean> {
  const db = await admin();
  const { data, error } = await db.rpc("has_entitlement", { _user_id: userId, _feature: feature });
  if (error) return true;
  return data !== false;
}

/** `null` means unlimited; `undefined` means the plan sets no cap at all. */
export async function effectiveLimit(userId: string, limit: LimitKey): Promise<number | null> {
  const db = await admin();
  const { data } = await db.rpc("effective_limit", { _user_id: userId, _limit: limit });
  return data === null || data === undefined ? null : Number(data);
}

/* ─────────── administrator: plan configuration ─────────── */

export type PlanEntitlementMap = Record<string, { features: FeatureKey[]; limits: Record<string, number | null> }>;

export async function planEntitlementMap(): Promise<PlanEntitlementMap> {
  const db = await admin();
  const [{ data: rows }, { data: limits }] = await Promise.all([
    db.from("plan_entitlements").select("plan_id, feature_key"),
    db.from("plan_limits").select("plan_id, limit_key, limit_value"),
  ]);
  const map: PlanEntitlementMap = {};
  for (const row of rows ?? []) {
    const id = String(row.plan_id);
    map[id] ??= { features: [], limits: {} };
    map[id].features.push(String(row.feature_key) as FeatureKey);
  }
  for (const row of limits ?? []) {
    const id = String(row.plan_id);
    map[id] ??= { features: [], limits: {} };
    map[id].limits[String(row.limit_key)] = row.limit_value === null ? null : Number(row.limit_value);
  }
  return map;
}

/** Replaces a plan's entitlements and limits with exactly what was selected. */
export async function savePlanEntitlements(input: {
  planId: string;
  features: string[];
  limits: Record<string, number | null>;
}) {
  const db = await admin();
  await db.from("plan_entitlements").delete().eq("plan_id", input.planId);
  if (input.features.length > 0) {
    const { error } = await db
      .from("plan_entitlements")
      .insert(input.features.map((feature_key) => ({ plan_id: input.planId, feature_key })));
    if (error) throw new Error(error.message);
  }

  for (const [limit_key, limit_value] of Object.entries(input.limits)) {
    const { error } = await db
      .from("plan_limits")
      .upsert({ plan_id: input.planId, limit_key, limit_value }, { onConflict: "plan_id,limit_key" });
    if (error) throw new Error(error.message);
  }
  return planEntitlementMap();
}

/**
 * The teacher/school Gateway.
 *
 * A teacher or a school decides, in their own words and at their own price,
 * what a student receives when they come through their door. That decision is
 * theirs alone: it has nothing to do with the MathGPL platform subscription,
 * nothing to do with credits, and nothing to do with the platform owner's
 * pricing. A gateway plan is simply PLAN -> ITEMS -> PRICE.
 */
import { supabase } from "@/integrations/supabase/client";

import {
  SLOT_ORDER,
  SLOT_SEED,
  type GatewayItem,
  type GatewayOwnerKind,
  type GatewaySlot,
} from "./items";

export type GatewayBillingMode = "free" | "one_off" | "subscription";

export type GatewayPlan = {
  id: string;
  ownerId: string;
  ownerKind: GatewayOwnerKind;
  slot: GatewaySlot;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  items: GatewayItem[];
  isPublished: boolean;
  autoGrantExisting: boolean;
  billingMode: GatewayBillingMode;
};

export type GatewayEntitlement = {
  id: string;
  ownerId: string;
  ownerKind: GatewayOwnerKind;
  studentId: string;
  planId: string;
  grantedItems: GatewayItem[];
  source: "free" | "manual_grant" | "paid";
  status: "active" | "pending_payment" | "revoked";
};

type PlanRow = {
  id: string;
  owner_id: string;
  owner_kind: string;
  slot: string;
  name: string;
  description: string;
  price_amount: number | string | null;
  currency: string;
  items: string[];
  is_published: boolean;
  auto_grant_existing: boolean;
  billing_mode?: string | null;
};

const toPlan = (row: PlanRow): GatewayPlan => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerKind: row.owner_kind as GatewayOwnerKind,
  slot: row.slot as GatewaySlot,
  name: row.name,
  description: row.description ?? "",
  price: row.price_amount === null ? null : Number(row.price_amount),
  currency: row.currency ?? "GBP",
  items: (row.items ?? []) as GatewayItem[],
  isPublished: row.is_published,
  autoGrantExisting: row.auto_grant_existing,
  billingMode: (row.billing_mode ?? "free") as GatewayBillingMode,
});


const toEntitlement = (row: {
  id: string;
  owner_id: string;
  owner_kind: string;
  student_id: string;
  plan_id: string;
  granted_items: string[];
  source: string;
  status: string;
}): GatewayEntitlement => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerKind: row.owner_kind as GatewayOwnerKind,
  studentId: row.student_id,
  planId: row.plan_id,
  grantedItems: (row.granted_items ?? []) as GatewayItem[],
  source: row.source as GatewayEntitlement["source"],
  status: row.status as GatewayEntitlement["status"],
});

const currentUserId = async (): Promise<string> => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in to manage your gateway.");
  return data.user.id;
};

/**
 * Reads this owner's three plan slots, creating any that are missing. The Free
 * slot is seeded published so a workspace never goes dark before its owner has
 * had a chance to set anything up.
 */
export const loadMyPlans = async (ownerKind: GatewayOwnerKind): Promise<GatewayPlan[]> => {
  const ownerId = await currentUserId();

  const { data, error } = await supabase
    .from("gateway_plans")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("owner_kind", ownerKind);
  if (error) throw error;

  const existing = ((data ?? []) as PlanRow[]).map(toPlan);
  const missing = SLOT_ORDER.filter((slot) => !existing.some((plan) => plan.slot === slot));

  if (missing.length > 0) {
    const seeds = missing.map((slot) => ({
      owner_id: ownerId,
      owner_kind: ownerKind,
      slot,
      name: SLOT_SEED[slot].name,
      description: SLOT_SEED[slot].description,
      price_amount: SLOT_SEED[slot].price,
      items: SLOT_SEED[slot].items,
      is_published: SLOT_SEED[slot].published,
    }));
    const { data: created, error: seedError } = await supabase
      .from("gateway_plans")
      .upsert(seeds, { onConflict: "owner_id,owner_kind,slot" })
      .select("*");
    if (seedError) throw seedError;
    existing.push(...((created ?? []) as PlanRow[]).map(toPlan).filter((plan) => missing.includes(plan.slot)));
  }

  return SLOT_ORDER.map((slot) => existing.find((plan) => plan.slot === slot)).filter(
    (plan): plan is GatewayPlan => Boolean(plan),
  );
};

export type PlanDraft = {
  name: string;
  description: string;
  price: number | null;
  items: GatewayItem[];
  isPublished: boolean;
  autoGrantExisting: boolean;
  billingMode: GatewayBillingMode;
};

export const savePlan = async (planId: string, draft: PlanDraft): Promise<GatewayPlan> => {
  const price = draft.price;
  const billingMode: GatewayBillingMode = !price || price <= 0 ? "free" : draft.billingMode === "subscription" ? "subscription" : "one_off";
  const { data, error } = await supabase
    .from("gateway_plans")
    .update({
      name: draft.name.trim() || "Plan",
      description: draft.description,
      price_amount: draft.price,
      items: draft.items,
      is_published: draft.isPublished,
      auto_grant_existing: draft.autoGrantExisting,
      billing_mode: billingMode,
    })

    .eq("id", planId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That plan could not be saved.");
  return toPlan(data as PlanRow);
};

/**
 * Existing students are not thrown out of a workspace when its owner publishes
 * a plan. When the owner asks for it, everyone already connected receives this
 * plan straight away; otherwise they meet the Gateway on their next visit.
 */
export const grantPlanToExistingStudents = async (plan: GatewayPlan): Promise<number> => {
  const ownerId = await currentUserId();
  const { data, error } = await supabase.rpc("my_connections", { _status: "accepted" });
  if (error) throw error;

  const students = ((data ?? []) as { counterpart_user_id: string; counterpart_role: string | null }[])
    .filter((row) => row.counterpart_role === "student")
    .map((row) => row.counterpart_user_id);
  if (students.length === 0) return 0;

  const rows = students.map((studentId) => ({
    owner_id: ownerId,
    owner_kind: plan.ownerKind,
    student_id: studentId,
    plan_id: plan.id,
    granted_items: plan.items,
    source: "manual_grant" as const,
    status: "active" as const,
  }));

  const { error: insertError } = await supabase
    .from("gateway_entitlements")
    .upsert(rows, { onConflict: "owner_id,owner_kind,student_id" });
  if (insertError) throw insertError;
  return rows.length;
};

export type GatewayOwnerView = {
  ownerId: string;
  ownerKind: GatewayOwnerKind;
  ownerName: string;
  username: string;
  /** Payment is only real once Stripe has verified the owner and they switched it on. */
  paymentsActive: boolean;
  plans: Pick<
    GatewayPlan,
    "id" | "slot" | "name" | "description" | "price" | "currency" | "items" | "billingMode"
  >[];
};

/** The public gateway for an @handle — what a visiting student sees first. */
export const loadGatewayByHandle = async (handle: string): Promise<GatewayOwnerView | null> => {
  const { data, error } = await supabase.rpc("gateway_by_handle", { _handle: handle });
  if (error) throw error;
  const rows = (data ?? []) as {
    owner_id: string;
    owner_kind: string;
    owner_name: string | null;
    username: string;
    plan_id: string;
    slot: string;
    name: string;
    description: string | null;
    price_amount: number | string | null;
    currency: string;
    items: string[];
    billing_mode: string | null;
    payments_active: boolean | null;
  }[];
  if (rows.length === 0) return null;

  return {
    ownerId: rows[0].owner_id,
    ownerKind: rows[0].owner_kind as GatewayOwnerKind,
    ownerName: rows[0].owner_name ?? rows[0].username,
    username: rows[0].username,
    paymentsActive: Boolean(rows[0].payments_active),
    plans: rows.map((row) => ({
      id: row.plan_id,
      slot: row.slot as GatewaySlot,
      name: row.name,
      description: row.description ?? "",
      price: row.price_amount === null ? null : Number(row.price_amount),
      currency: row.currency ?? "GBP",
      items: (row.items ?? []) as GatewayItem[],
      billingMode: (row.billing_mode ?? "free") as GatewayBillingMode,
    })),
  };
};


/** The student's own choice. Paid plans wait for payment, which comes later. */
export const choosePlan = async (planId: string): Promise<GatewayEntitlement> => {
  const { data, error } = await supabase.rpc("gateway_choose_plan", { _plan_id: planId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return toEntitlement(row as Parameters<typeof toEntitlement>[0]);
};

export const loadMyEntitlement = async (ownerId: string): Promise<GatewayEntitlement | null> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("gateway_entitlements")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("student_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? toEntitlement(data as Parameters<typeof toEntitlement>[0]) : null;
};

/** Everyone who has come through this owner's gateway. */
export const loadMyGatewayStudents = async (ownerKind: GatewayOwnerKind): Promise<GatewayEntitlement[]> => {
  const ownerId = await currentUserId();
  const { data, error } = await supabase
    .from("gateway_entitlements")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("owner_kind", ownerKind);
  if (error) throw error;
  return ((data ?? []) as Parameters<typeof toEntitlement>[0][]).map(toEntitlement);
};

export const loadMyPayoutAccount = async (ownerKind: GatewayOwnerKind) => {
  const ownerId = await currentUserId();
  const { data, error } = await supabase
    .from("gateway_payout_accounts")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("owner_kind", ownerKind)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
};

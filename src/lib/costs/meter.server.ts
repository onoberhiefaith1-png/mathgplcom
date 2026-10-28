/**
 * Server-only usage recorder. Every metered operation lands here; the database
 * function prices it against the versioned price book, applies the locked
 * subscription profit rate and rolls it up into the owner's Cost Unit.
 *
 * This module never decides who pays: `resolve_cost_unit` does, so a teacher
 * working inside a paid school workspace bills the school Cost Unit and the
 * same event is never charged twice.
 */
import type { MetricId } from "./categories";
import { METRIC_CATEGORY } from "./categories";

export type MeterInput = {
  userId: string | null;
  orgId?: string | null;
  metric: MetricId;
  /** Quantity expressed in the price-book unit (e.g. tokens / 1e6). */
  quantity: number;
  unit?: string;
  feature?: string;
  model?: string;
  occurredAt?: string;
};

export async function recordUsage(input: MeterInput): Promise<void> {
  if (!input.userId || !Number.isFinite(input.quantity) || input.quantity <= 0) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const args = {
      _user_id: input.userId,
      _org_id: input.orgId ?? null,
      _category: METRIC_CATEGORY[input.metric],
      _metric: input.metric as string,
      _quantity: input.quantity,
      _unit: input.unit ?? "unit",
      _feature: input.feature ?? null,
      _model: input.model ?? null,
      ...(input.occurredAt ? { _occurred_at: input.occurredAt } : {}),
    };
    await supabaseAdmin.rpc(
      "record_usage_event",
      args as unknown as Parameters<typeof supabaseAdmin.rpc<"record_usage_event">>[1],
    );
  } catch (error) {
    // Accounting must never break a customer-facing operation.
    console.error("[costs] failed to record usage", error);
  }
}

export async function recordMany(events: MeterInput[]): Promise<void> {
  for (const event of events) await recordUsage(event);
}

/** The workspace a user is currently acting in, used as the billing owner. */
export async function activeOrgOf(userId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.active_org_id as string | null) ?? null;
  } catch {
    return null;
  }
}

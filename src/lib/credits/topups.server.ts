/**
 * Pay-as-you-go credit packs. A pack stores only its credit amount — the money
 * price always comes from the live credit sell price, so an admin pricing change
 * repriced every pack at once.
 */
import { packagePrice } from "@/lib/pricing/sellPrice";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type CreditPack = {
  externalId: string;
  credits: number;
  label: string;
  price: number;
  currency: string;
  perCredit: number;
};

export async function creditPacks(): Promise<CreditPack[]> {
  const db = await admin();
  const { resolvePricing } = await import("@/lib/costs/costAdmin.server");
  const [{ data }, pricing] = await Promise.all([
    db
      .from("credit_packages")
      .select("external_id, credits, label, sort_order")
      .eq("active", true)
      .order("sort_order"),
    resolvePricing("GBP"),
  ]);

  return (data ?? []).map((p) => ({
    externalId: String(p.external_id),
    credits: Number(p.credits),
    label: String(p.label),
    price: packagePrice(Number(p.credits), pricing.costPrice, pricing.profitPercentage),
    currency: pricing.currency,
    perCredit: pricing.sellPrice,
  }));
}

/** How many credits a bought pack is worth, looked up by its readable id. */
export async function creditsForPack(externalId: string): Promise<number | null> {
  const db = await admin();
  const { data } = await db
    .from("credit_packages")
    .select("credits")
    .eq("external_id", externalId)
    .maybeSingle();
  return data ? Number(data.credits) : null;
}

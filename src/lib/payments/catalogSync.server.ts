/**
 * Keeps the payment provider's amounts equal to the amounts the administrator
 * published. Plans and credit packs are both derived from the credit cost price
 * and profit percentage, so a pricing change moves everything in one action.
 */
import { minorUnits, packagePrice } from "@/lib/pricing/sellPrice";
import { paddleFetch, type PaddleEnv } from "@/lib/paddle.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type CatalogRow = {
  kind: "plan" | "credits";
  externalId: string;
  label: string;
  expected: number;
  provider: number | null;
  currency: string;
  inSync: boolean;
  missing: boolean;
};

type ProviderPrice = { id: string; unit_price?: { amount?: string; currency_code?: string } };

async function providerPrice(env: PaddleEnv, externalId: string): Promise<ProviderPrice | null> {
  const res = await paddleFetch(env, `/prices?external_id=${encodeURIComponent(externalId)}&status=active`);
  const body = (await res.json()) as { data?: ProviderPrice[] };
  return body.data?.[0] ?? null;
}

/** Everything that should exist at the provider, with the amount it should hold. */
async function expected(): Promise<CatalogRow[]> {
  const db = await admin();
  const { resolvePricing } = await import("@/lib/costs/costAdmin.server");
  const [{ data: plans }, { data: versions }, { data: packs }, pricing] = await Promise.all([
    db.from("plans").select("id, key, label, currency, active"),
    db.from("plan_versions").select("plan_id, price, currency, status").eq("status", "published"),
    db.from("credit_packages").select("external_id, credits, label, sort_order").eq("active", true).order("sort_order"),
    resolvePricing("GBP"),
  ]);

  const rows: CatalogRow[] = [];

  for (const plan of plans ?? []) {
    if (plan.active === false) continue;
    const live = (versions ?? []).find((v) => String(v.plan_id) === String(plan.id));
    const price = Number(live?.price ?? 0);
    if (!(price > 0)) continue; // free plans never reach the provider
    rows.push({
      kind: "plan",
      externalId: `${String(plan.key)}_monthly`,
      label: String(plan.label),
      expected: price,
      provider: null,
      currency: (live?.currency as string) ?? (plan.currency as string) ?? "GBP",
      inSync: false,
      missing: false,
    });
  }

  for (const pack of packs ?? []) {
    rows.push({
      kind: "credits",
      externalId: String(pack.external_id),
      label: `${Number(pack.credits)} credits — ${String(pack.label)}`,
      expected: packagePrice(Number(pack.credits), pricing.costPrice, pricing.profitPercentage),
      provider: null,
      currency: pricing.currency,
      inSync: false,
      missing: false,
    });
  }

  return rows;
}

/** Read-only comparison used by the admin pricing pipeline panel. */
export async function catalogStatus(env: PaddleEnv): Promise<CatalogRow[]> {
  const rows = await expected();
  return Promise.all(
    rows.map(async (row) => {
      const price = await providerPrice(env, row.externalId);
      const provider = price?.unit_price?.amount ? Number(price.unit_price.amount) / 100 : null;
      return {
        ...row,
        provider,
        missing: !price,
        inSync: provider !== null && minorUnits(provider) === minorUnits(row.expected),
      };
    }),
  );
}

/** Pushes every published amount to the provider and reports what moved. */
export async function syncCatalog(env: PaddleEnv) {
  const status = await catalogStatus(env);
  const updated: string[] = [];
  const missing: string[] = [];

  for (const row of status) {
    if (row.missing) {
      missing.push(row.externalId);
      continue;
    }
    if (row.inSync) continue;
    const price = await providerPrice(env, row.externalId);
    if (!price) continue;
    await paddleFetch(env, `/prices/${price.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        unit_price: { amount: String(minorUnits(row.expected)), currency_code: row.currency.toUpperCase() },
      }),
    });
    updated.push(row.externalId);
  }

  return { updated, missing, rows: await catalogStatus(env) };
}

/** Called after a publish so a new plan price never lags behind the catalogue. */
export async function syncCatalogQuietly(env: PaddleEnv) {
  try {
    await syncCatalog(env);
  } catch (e) {
    console.error("Payment catalogue sync failed:", e);
  }
}

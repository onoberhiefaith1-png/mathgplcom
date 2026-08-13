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
  environment: PaddleEnv;
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
async function expected(env: PaddleEnv): Promise<CatalogRow[]> {
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
    const currency = (live?.currency as string) ?? (plan.currency as string) ?? "GBP";
    rows.push({
      kind: "plan",
      environment: env,
      externalId: `${String(plan.key)}_monthly`,
      label: String(plan.label),
      expected: price,
      provider: null,
      currency,
      inSync: false,
      missing: false,
    });
    // The yearly amount is always derived: 12 months less the 20% discount.
    if ((plan as { yearly_enabled?: boolean }).yearly_enabled !== false) {
      rows.push({
        kind: "plan",
        environment: env,
        externalId: `${String(plan.key)}_yearly`,
        label: `${String(plan.label)} — yearly`,
        expected: Math.round(price * 12 * 0.8 * 100) / 100,
        provider: null,
        currency,
        inSync: false,
        missing: false,
      });
    }
  }

  for (const pack of packs ?? []) {
    rows.push({
      kind: "credits",
      environment: env,
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
  const rows = await expected(env);
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

/**
 * One item's published amount against the amount the provider would charge.
 * Checkout calls this so a customer can never be billed an amount that
 * disagrees with the published plan.
 */
export async function verifyExternalPrice(env: PaddleEnv, externalId: string) {
  const row = (await expected(env)).find((r) => r.externalId === externalId);
  if (!row) return { ok: false, reason: "unknown" as const, published: null, provider: null, currency: "GBP" };
  const price = await providerPrice(env, externalId);
  const provider = price?.unit_price?.amount ? Number(price.unit_price.amount) / 100 : null;
  return {
    ok: provider !== null && minorUnits(provider) === minorUnits(row.expected),
    reason: provider === null ? ("missing" as const) : ("mismatch" as const),
    published: row.expected,
    provider,
    currency: row.currency,
  };
}

export type SyncReport = {
  environment: PaddleEnv;
  updated: string[];
  missing: string[];
  failed: { externalId: string; message: string }[];
  rows: CatalogRow[];
};

/** Pushes every published amount to the provider and reports what moved. */
export async function syncCatalog(env: PaddleEnv): Promise<SyncReport> {
  const status = await catalogStatus(env);
  const updated: string[] = [];
  const missing: string[] = [];
  const failed: { externalId: string; message: string }[] = [];

  for (const row of status) {
    if (row.missing) {
      missing.push(row.externalId);
      continue;
    }
    if (row.inSync) continue;
    try {
      const price = await providerPrice(env, row.externalId);
      if (!price) {
        missing.push(row.externalId);
        continue;
      }
      await paddleFetch(env, `/prices/${price.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          unit_price: { amount: String(minorUnits(row.expected)), currency_code: row.currency.toUpperCase() },
        }),
      });
      updated.push(row.externalId);
    } catch (e) {
      failed.push({ externalId: row.externalId, message: (e as Error).message });
    }
  }

  return { environment: env, updated, missing, failed, rows: await catalogStatus(env) };
}

/**
 * Publish-time push. Never throws — a provider outage must not stop a plan
 * from being published — but always reports, so the administrator is told
 * when checkout is still charging the old amount.
 */
export async function syncCatalogReport(env: PaddleEnv): Promise<SyncReport> {
  try {
    return await syncCatalog(env);
  } catch (e) {
    console.error("Payment catalogue sync failed:", e);
    return {
      environment: env,
      updated: [],
      missing: [],
      failed: [{ externalId: "*", message: (e as Error).message }],
      rows: [],
    };
  }
}


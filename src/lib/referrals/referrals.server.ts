/**
 * Referral engine reads and writes.
 *
 * Everything the dashboards show is derived here from campaign rules plus
 * attribution rows — no number is stored twice, and money is grouped per
 * currency so two currencies are never added together.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import {
  addTotal,
  rewardRuleLabel,
  type ActivityFilter,
  type AdminCampaign,
  type AudienceRole,
  type Campaign,
  type CampaignStatus,
  type CurrencyTotal,
  type ReferralDashboard,
  type ReferralOverview,
  type ReferralRow,
  type ReferralScope,
  type RewardRule,
  type RewardStatus,
  type RewardType,
  type TopReferrer,
  type TriggerEvent,
} from "./types";

type Client = SupabaseClient<Database>;
/**
 * The referral tables are created when this change is accepted, so they are not
 * in the generated database types yet. Queries run through an untyped view of
 * the same authenticated client, keeping RLS in force.
 */
type Loose = SupabaseClient;
const loose = (client: Client): Loose => client as unknown as Loose;

async function admin(): Promise<Loose> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Loose;
}

type CampaignRow = {
  id: string;
  owner_kind: ReferralScope;
  owner_user_id: string;
  org_id: string | null;
  name: string;
  reward_type: RewardType;
  reward_rule: RewardRule | null;
  trigger_event: TriggerEvent;
  is_active: boolean;
  audience: string[] | null;
  status: CampaignStatus | null;
  target_user_id: string | null;
};

const toCampaign = (row: CampaignRow): Campaign => ({
  id: row.id,
  ownerKind: row.owner_kind,
  ownerUserId: row.owner_user_id,
  orgId: row.org_id,
  name: row.name,
  rewardType: row.reward_type,
  rewardRule: row.reward_rule ?? {},
  trigger: row.trigger_event,
  isActive: row.is_active,
  audience: ((row.audience ?? []) as AudienceRole[]).filter((role) =>
    ["school", "teacher", "parent", "student"].includes(role),
  ),
  status: row.status ?? "draft",
  targetUserId: row.target_user_id,
});

const CAMPAIGN_COLUMNS =
  "id, owner_kind, owner_user_id, org_id, name, reward_type, reward_rule, trigger_event, is_active, audience, status, target_user_id";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
  let out = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return out;
}

export async function assertAdmin(client: Client, userId: string) {
  const { data } = await loose(client)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["platform_owner", "co_admin"]);
  if (!data || data.length === 0) throw new Error("Administrator access is required.");
}

/** The single role a person is treated as when an audience is matched. */
async function roleOf(client: Client, userId: string): Promise<string | null> {
  const { data } = await loose(client).from("user_roles").select("role").eq("user_id", userId).limit(1);
  return ((data as { role: string }[] | null) ?? [])[0]?.role ?? null;
}

const isLive = (row: CampaignRow): boolean => (row.status ?? "draft") === "live" && row.is_active;

/**
 * The campaign a person refers under: their own live one, else the platform
 * offer whose audience the administrator assigned them to. When the
 * administrator has set nothing, this is deliberately null — no offer exists,
 * so no amount and no link may be shown.
 */
async function campaignFor(
  client: Client,
  userId: string,
  scope: ReferralScope,
  orgId: string | null,
): Promise<Campaign | null> {
  const db = loose(client);
  if (scope !== "platform") {
    let own = db.from("referral_campaigns").select(CAMPAIGN_COLUMNS).eq("status", "live").eq("is_active", true).limit(1);
    own = scope === "school" && orgId ? own.eq("org_id", orgId) : own.eq("owner_user_id", userId);
    const mine = await own;
    const row = (mine.data as CampaignRow[] | null)?.[0];
    if (row) return toCampaign(row);
  }

  const platform = await (await admin())
    .from("referral_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("owner_kind", "platform")
    .eq("status", "live")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const rows = ((platform.data as CampaignRow[] | null) ?? []).filter(isLive);
  if (scope === "platform") return rows[0] ? toCampaign(rows[0]) : null;
  const role = scope;
  const targeted = rows.find((row) => row.target_user_id === userId);
  if (targeted) return toCampaign(targeted);
  const forRole = rows.find((row) => (row.audience ?? []).includes(role) && !row.target_user_id);
  return forRole ? toCampaign(forRole) : null;
}


/** Creates the caller's link for their campaign on first visit; never duplicates. */
export async function ensureLink(
  client: Client,
  userId: string,
  scope: ReferralScope,
  orgId: string | null,
): Promise<{ code: string; campaign: Campaign | null }> {
  const campaign = await campaignFor(client, userId, scope, orgId);
  if (!campaign) return { code: "", campaign: null };

  const db = await admin();
  const existing = await db
    .from("referral_links")
    .select("code")
    .eq("campaign_id", campaign.id)
    .eq("referrer_user_id", userId)
    .limit(1);
  const found = (existing.data as { code: string }[] | null)?.[0];
  if (found) return { code: found.code, campaign };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode();
    const { error } = await db.from("referral_links").insert({
      campaign_id: campaign.id,
      referrer_user_id: userId,
      org_id: scope === "school" ? orgId : null,
      code,
    });
    if (!error) return { code, campaign };
  }
  throw new Error("Could not create a referral link. Please try again.");
}

type AttributionRow = {
  id: string;
  campaign_id: string;
  referrer_user_id: string;
  org_id: string | null;
  referred_role: string | null;
  registered_at: string;
  subscribed_at: string | null;
};

type RewardRow = {
  id: string;
  attribution_id: string;
  referrer_user_id: string;
  reward_type: RewardType;
  currency: string | null;
  amount: number | null;
  discount_kind: string | null;
  description: string | null;
  status: RewardStatus;
};

const emptyOverview = (): ReferralOverview => ({
  referred: 0,
  registered: 0,
  subscribed: 0,
  eligible: 0,
  conversionRate: 0,
  earned: [],
  pending: [],
  paid: [],
  nonCashRewards: 0,
});

const rewardLabelOf = (reward: RewardRow | undefined): string => {
  if (!reward) return "—";
  if (reward.reward_type === "payment" && reward.amount != null) {
    return rewardRuleLabel({ rewardType: "payment", rewardRule: { amount: reward.amount, currency: reward.currency ?? undefined } });
  }
  if (reward.reward_type === "discount" && reward.amount != null) {
    return rewardRuleLabel({
      rewardType: "discount",
      rewardRule: {
        amount: reward.amount,
        currency: reward.currency ?? undefined,
        discountKind: reward.discount_kind === "fixed" ? "fixed" : "percentage",
      },
    });
  }
  return reward.description?.trim() || "Reward";
};

const matches = (row: ReferralRow, filter: ActivityFilter): boolean => {
  switch (filter) {
    case "teacher":
    case "school":
    case "student":
    case "parent":
      return row.role === filter;
    case "registered":
      return !row.subscribedAt;
    case "subscribed":
      return Boolean(row.subscribedAt);
    case "pending":
      return row.status === "pending";
    case "paid":
      return row.status === "paid";
    default:
      return true;
  }
};

export async function dashboard(
  client: Client,
  userId: string,
  input: { scope: ReferralScope; orgId?: string | null; filter?: ActivityFilter },
): Promise<ReferralDashboard> {
  const scope = input.scope;
  const orgId = input.orgId ?? null;
  if (scope === "platform") await assertAdmin(client, userId);

  const db = loose(client);

  let attributionQuery = db
    .from("referral_attributions")
    .select("id, campaign_id, referrer_user_id, org_id, referred_role, registered_at, subscribed_at")
    .order("registered_at", { ascending: true });
  if (scope === "teacher") attributionQuery = attributionQuery.eq("referrer_user_id", userId);
  if (scope === "school" && orgId) attributionQuery = attributionQuery.eq("org_id", orgId);

  const [attributions, rewards, campaignList, linkResult] = await Promise.all([
    attributionQuery,
    db
      .from("referral_rewards")
      .select("id, attribution_id, referrer_user_id, reward_type, currency, amount, discount_kind, description, status"),
    db.from("referral_campaigns").select(CAMPAIGN_COLUMNS).order("created_at", { ascending: true }),
    ensureLink(client, userId, scope, orgId).catch(() => ({ code: "", campaign: null })),
  ]);

  const attributionRows = (attributions.data as AttributionRow[] | null) ?? [];
  const rewardRows = (rewards.data as RewardRow[] | null) ?? [];
  const rewardByAttribution = new Map(rewardRows.map((r) => [r.attribution_id, r]));

  const overview = emptyOverview();
  const rows: ReferralRow[] = [];

  attributionRows.forEach((attribution, index) => {
    const reward = rewardByAttribution.get(attribution.id);
    overview.referred += 1;
    overview.registered += 1;
    if (attribution.subscribed_at) overview.subscribed += 1;
    const status: RewardStatus = reward?.status ?? "pending";
    if (status !== "pending") overview.eligible += 1;

    const cash = reward?.reward_type === "payment" ? reward : undefined;
    if (cash?.amount != null && cash.currency) {
      if (status === "eligible") {
        addTotal(overview.earned, cash.currency, cash.amount);
      } else if (status === "paid") {
        addTotal(overview.earned, cash.currency, cash.amount);
        addTotal(overview.paid, cash.currency, cash.amount);
      } else {
        addTotal(overview.pending, cash.currency, cash.amount);
      }
    } else if (reward && status !== "pending") {
      overview.nonCashRewards += 1;
    }

    rows.push({
      id: attribution.id,
      label: `Referral ${String(index + 1).padStart(3, "0")}`,
      role: attribution.referred_role,
      registeredAt: attribution.registered_at,
      subscribedAt: attribution.subscribed_at,
      status,
      rewardType: reward?.reward_type ?? "payment",
      currency: reward?.currency ?? null,
      amount: reward?.amount ?? null,
      description: reward?.description ?? null,
      rewardLabel: rewardLabelOf(reward),
    });
  });

  overview.conversionRate =
    overview.registered === 0 ? 0 : Math.round((overview.subscribed / overview.registered) * 100);

  const topReferrers: TopReferrer[] = [];
  if (scope !== "teacher") {
    const grouped = new Map<string, TopReferrer>();
    attributionRows.forEach((attribution) => {
      const entry =
        grouped.get(attribution.referrer_user_id) ??
        { referrerUserId: attribution.referrer_user_id, label: "", registered: 0, subscribed: 0 };
      entry.registered += 1;
      if (attribution.subscribed_at) entry.subscribed += 1;
      grouped.set(attribution.referrer_user_id, entry);
    });
    const ids = [...grouped.keys()];
    if (ids.length > 0) {
      const profiles = await db.from("profiles").select("id, display_name").in("id", ids);
      const names = new Map(
        ((profiles.data as { id: string; display_name: string | null }[] | null) ?? []).map((p) => [
          p.id,
          p.display_name,
        ]),
      );
      for (const [id, entry] of grouped) {
        entry.label = names.get(id) || "Referrer";
        topReferrers.push(entry);
      }
      topReferrers.sort((a, b) => b.subscribed - a.subscribed || b.registered - a.registered);
    }
  }

  const campaigns = ((campaignList.data as CampaignRow[] | null) ?? []).map(toCampaign);
  const filter = input.filter ?? "all";

  return {
    scope,
    link: linkResult.code ? { code: linkResult.code, url: "" } : null,
    campaign: linkResult.campaign,
    campaigns,
    overview,
    rows: rows.filter((row) => matches(row, filter)).reverse(),
    topReferrers: topReferrers.slice(0, 10),
    canConfigure: scope !== "teacher" ? true : true,
  };
}

/** Records that a referral link was opened. Public and deliberately anonymous. */
export async function recordOpen(code: string) {
  const db = await admin();
  const link = await db.from("referral_links").select("id").eq("code", code).eq("is_active", true).limit(1);
  if (!((link.data as { id: string }[] | null) ?? []).length) return { ok: false };
  await db.from("referral_events").insert({ code, kind: "opened" });
  return { ok: true };
}

/**
 * Turns a captured code into an attribution for the signed-in person, and opens
 * the reward in the state the campaign's trigger demands.
 */
export async function claim(client: Client, userId: string, code: string) {
  const db = await admin();

  const existing = await db
    .from("referral_attributions")
    .select("id")
    .eq("referred_user_id", userId)
    .limit(1);
  if (((existing.data as { id: string }[] | null) ?? []).length > 0) return { claimed: false };

  const linkResult = await db
    .from("referral_links")
    .select("id, campaign_id, referrer_user_id, org_id")
    .eq("code", code)
    .eq("is_active", true)
    .limit(1);
  const link = (
    (linkResult.data as
      | { id: string; campaign_id: string; referrer_user_id: string; org_id: string | null }[]
      | null) ?? []
  )[0];
  if (!link || link.referrer_user_id === userId) return { claimed: false };

  const campaignResult = await db
    .from("referral_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", link.campaign_id)
    .limit(1);
  const campaignRow = (campaignResult.data as CampaignRow[] | null)?.[0];
  if (!campaignRow || !campaignRow.is_active) return { claimed: false };
  const campaign = toCampaign(campaignRow);

  const roleResult = await loose(client).from("user_roles").select("role").eq("user_id", userId).limit(1);
  const role = ((roleResult.data as { role: string }[] | null) ?? [])[0]?.role ?? null;

  const inserted = await db
    .from("referral_attributions")
    .insert({
      link_id: link.id,
      campaign_id: campaign.id,
      referrer_user_id: link.referrer_user_id,
      org_id: link.org_id,
      referred_user_id: userId,
      referred_role: role,
    })
    .select("id")
    .single();
  const attributionId = (inserted.data as { id: string } | null)?.id;
  if (!attributionId) return { claimed: false };

  const rule = campaign.rewardRule ?? {};
  const eligibleNow = campaign.trigger === "registration";
  await db.from("referral_rewards").insert({
    attribution_id: attributionId,
    campaign_id: campaign.id,
    referrer_user_id: link.referrer_user_id,
    org_id: link.org_id,
    reward_type: campaign.rewardType,
    currency: rule.currency ?? null,
    amount: rule.amount ?? null,
    discount_kind: campaign.rewardType === "discount" ? rule.discountKind ?? "percentage" : null,
    description: rule.description ?? null,
    status: eligibleNow ? "eligible" : "pending",
    qualified_at: eligibleNow ? new Date().toISOString() : null,
  });

  await db.from("referral_events").insert({ code, kind: "registered", referred_user_id: userId });
  return { claimed: true };
}

export type CampaignInput = {
  id?: string;
  ownerKind: ReferralScope;
  orgId?: string | null;
  name: string;
  rewardType: RewardType;
  rewardRule: RewardRule;
  trigger: TriggerEvent;
  isActive: boolean;
};

export async function saveCampaign(client: Client, userId: string, input: CampaignInput) {
  if (input.ownerKind === "platform") await assertAdmin(client, userId);
  const db = loose(client);
  const payload = {
    owner_kind: input.ownerKind,
    owner_user_id: userId,
    org_id: input.ownerKind === "school" ? input.orgId ?? null : null,
    name: input.name.trim() || "Referral campaign",
    reward_type: input.rewardType,
    reward_rule: input.rewardRule,
    trigger_event: input.trigger,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await db.from("referral_campaigns").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await db.from("referral_campaigns").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function setCampaignActive(client: Client, id: string, isActive: boolean) {
  const { error } = await loose(client)
    .from("referral_campaigns")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** MathGPL never moves the money — an administrator records that it moved. */
export async function markRewardPaid(client: Client, id: string, note: string | null) {
  const { error } = await loose(client)
    .from("referral_rewards")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_note: note })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** The small summary the dashboard card needs. */
export async function summary(
  client: Client,
  userId: string,
  scope: ReferralScope,
  orgId: string | null,
): Promise<{ referred: number; registered: number; subscribed: number; earned: CurrencyTotal[] }> {
  const view = await dashboard(client, userId, { scope, orgId });
  return {
    referred: view.overview.referred,
    registered: view.overview.registered,
    subscribed: view.overview.subscribed,
    earned: view.overview.earned,
  };
}

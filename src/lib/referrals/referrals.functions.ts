import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ActivityFilter, AdminCampaign, CampaignStatus, ReferralScope, ReferralTarget } from "./types";
import type { CampaignInput } from "./referrals.server";

export const getReferralDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: ReferralScope; orgId?: string | null; filter?: ActivityFilter }) => input)
  .handler(async ({ data, context }) => {
    const { dashboard } = await import("./referrals.server");
    return dashboard(context.supabase, context.userId, data);
  });

export const getReferralSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: ReferralScope; orgId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { summary } = await import("./referrals.server");
    return summary(context.supabase, context.userId, data.scope, data.orgId ?? null);
  });

export const saveReferralCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CampaignInput) => input)
  .handler(async ({ data, context }) => {
    const { saveCampaign } = await import("./referrals.server");
    return saveCampaign(context.supabase, context.userId, data);
  });

export const setReferralCampaignActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { setCampaignActive } = await import("./referrals.server");
    return setCampaignActive(context.supabase, data.id, data.isActive);
  });

export const markReferralRewardPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { markRewardPaid } = await import("./referrals.server");
    return markRewardPaid(context.supabase, data.id, data.note ?? null);
  });

export const listAdminReferralCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminCampaign[] }> => {
    const { adminCampaigns } = await import("./referrals.server");
    return { rows: await adminCampaigns(context.supabase, context.userId) };
  });

export const setReferralCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: CampaignStatus }) => input)
  .handler(async ({ data, context }) => {
    const { setCampaignStatus } = await import("./referrals.server");
    return setCampaignStatus(context.supabase, context.userId, data.id, data.status);
  });

export const deleteReferralCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { deleteCampaign } = await import("./referrals.server");
    return deleteCampaign(context.supabase, context.userId, data.id);
  });

export const listReferralTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) => input)
  .handler(async ({ data, context }): Promise<{ rows: ReferralTarget[] }> => {
    const { referralTargets } = await import("./referrals.server");
    return referralTargets(context.supabase, context.userId, data.search ?? "");
  });

export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { claim } = await import("./referrals.server");
    return claim(context.supabase, context.userId, data.code.trim().toUpperCase());
  });

/** Anonymous: a link was opened. Records nothing about the visitor. */
export const recordReferralOpen = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const { recordOpen } = await import("./referrals.server");
    return recordOpen(data.code.trim().toUpperCase());
  });

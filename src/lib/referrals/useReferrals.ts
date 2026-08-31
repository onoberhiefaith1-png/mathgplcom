import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAccount } from "@/lib/accounts/useAccount";
import type { AppRole } from "@/lib/accounts/roles";
import { referralUrl } from "@/lib/links/publicUrl";
import { getReferralDashboard, getReferralSummary } from "./referrals.functions";
import type { ActivityFilter, ReferralDashboard, ReferralScope } from "./types";

/**
 * Referral belongs to the people who grow the platform: the platform
 * administrator, a school administrator and a teacher. Students, parents and
 * guests have no referral surface at all.
 */
export const referralScopeFor = (role: AppRole | null): ReferralScope | null => {
  if (role === "platform_owner" || role === "co_admin") return "platform";
  if (role === "school") return "school";
  if (role === "teacher") return "teacher";
  return null;
};

export const SCOPE_LABEL: Record<ReferralScope, string> = {
  platform: "Platform referrals",
  school: "School referrals",
  teacher: "My referrals",
};

export function useReferralAccess() {
  const { role, orgId, isLoading } = useAccount();
  return { scope: referralScopeFor(role), orgId, isLoading };
}

/** The full role-aware dashboard. */
export function useReferralDashboard(filter: ActivityFilter = "all") {
  const { scope, orgId } = useReferralAccess();
  const fetch = useServerFn(getReferralDashboard);
  const query = useQuery<ReferralDashboard>({
    queryKey: ["referral-dashboard", scope, orgId, filter],
    enabled: Boolean(scope),
    queryFn: () => fetch({ data: { scope: scope!, orgId, filter } }),
  });
  // Always the public MathGPL address — never the preview or workspace host.
  const data = query.data
    ? {
        ...query.data,
        link: query.data.link ? { ...query.data.link, url: referralUrl(query.data.link.code) } : null,
      }
    : undefined;
  return { ...query, data };
}

/** The small Refer & Earn figures for a workspace dashboard card. */
export function useReferralSummary() {
  const { scope, orgId } = useReferralAccess();
  const fetch = useServerFn(getReferralSummary);
  return useQuery({
    queryKey: ["referral-summary", scope, orgId],
    enabled: Boolean(scope),
    queryFn: () => fetch({ data: { scope: scope!, orgId } }),
  });
}

export function useReferralRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["referral-dashboard"] });
    void qc.invalidateQueries({ queryKey: ["referral-summary"] });
  };
}

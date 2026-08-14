import { useQuery } from "@tanstack/react-query";

import { useAccount } from "@/lib/accounts/useAccount";
import { fetchMyPlan, fetchPublishedPlans } from "./plans.functions";

export type PlanAudience = "teacher" | "school" | "parent";

/**
 * Which account types hold a platform plan of their own. Students never
 * subscribe — their access comes from the school or teacher they belong to —
 * and the platform owner is not a customer.
 */
export const PLAN_AUDIENCE_FOR_ROLE: Record<string, PlanAudience | null> = {
  school: "school",
  teacher: "teacher",
  parent: "parent",
  student: null,
  platform_owner: null,
  co_admin: null,
};

/**
 * Where the signed-in account stands with the platform subscription.
 *
 * `needsPlan` is the gateway condition: this account type subscribes, has no
 * active plan yet, and there is at least one plan published for it. When the
 * administrator has published nothing for that audience the gate stays open —
 * nobody is ever locked out of their own workspace.
 */
export function usePlanGate() {
  const { role, isLoading: roleLoading } = useAccount();
  const audience = role ? PLAN_AUDIENCE_FOR_ROLE[role] ?? null : null;

  const mine = useQuery({
    queryKey: ["my-plan"],
    queryFn: () => fetchMyPlan({}),
    enabled: Boolean(audience),
  });

  const plans = useQuery({
    queryKey: ["published-plans", audience],
    queryFn: () => fetchPublishedPlans({ data: audience ? { audience } : {} }),
    enabled: Boolean(audience),
  });

  const choices = (plans.data?.plans ?? []).filter((p) => p.status !== "coming_soon");
  const loading = roleLoading || (Boolean(audience) && (mine.isLoading || plans.isLoading));
  const subscription = mine.data?.subscription ?? null;

  // Access-code holders and the platform owner's own test accounts hold full
  // access without a subscription — the pricing gateway never applies to them.
  const freeAccess = mine.data?.freeAccess === true;

  // An expired plan sits in a renewal grace window: the workspace stays open
  // and the work is safe, but credit spending is paused until it is renewed.
  const expired = !freeAccess && subscription?.status === "expired";
  const graceDaysLeft =
    expired && subscription?.graceUntil
      ? Math.max(0, Math.ceil((new Date(subscription.graceUntil).getTime() - Date.now()) / 86_400_000))
      : null;

  return {
    loading,
    audience,
    subscription,
    choices,
    /** Full access without a subscription (access code or owner test account). */
    freeAccess,
    /** This account type subscribes at all. */
    subscribes: Boolean(audience),
    /** Nothing published for this audience yet. */
    noPlansYet: Boolean(audience) && !loading && !freeAccess && choices.length === 0,
    needsPlan: Boolean(audience) && !loading && !freeAccess && !subscription && choices.length > 0,
    /** The paid period ended without a renewal. */
    expired,
    /** Whole days left before the account falls back to the free plan. */
    graceDaysLeft,
  };
}


import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchMyEntitlements } from "./entitlements.functions";

import type { EntitlementSource, FeatureKey, LimitKey } from "./features";

export type EntitlementsState = {
  loading: boolean;
  /** True when this account is never gated by a plan (owner, co-admin). */
  unrestricted: boolean;
  has: (feature: FeatureKey) => boolean;
  /** Where the entitlement came from — own plan or a connected payer. */
  source: (feature: FeatureKey) => EntitlementSource | null;
  /** The account paying for the feature, when it arrives through a connection. */
  payer: (feature: FeatureKey) => string | null;
  /** `null` = unlimited / no cap configured. */
  limit: (limit: LimitKey) => number | null;
  labelOf: (feature: FeatureKey) => string;
};

/**
 * The client half of `PLAN → ENTITLEMENT → ACCESS`. UI uses it to show the
 * right affordances; the server re-checks every protected action regardless.
 */
export function useEntitlements(): EntitlementsState {
  const { user } = useAuth();
  const fetchMine = useServerFn(fetchMyEntitlements);
  const query = useQuery({
    queryKey: ["my-entitlements", user?.id ?? "anon"],
    queryFn: () => fetchMine(),
    // Signed-out visitors have no bearer token; asking would throw Unauthorized.
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const data = query.data ?? null;

  const grants = data?.features ?? [];
  const grant = (feature: FeatureKey) => grants.find((g) => g.feature === feature) ?? null;

  return {
    loading: query.isLoading,
    unrestricted: data?.unrestricted === true,
    has: (feature) => data?.unrestricted === true || Boolean(grant(feature)),
    source: (feature) => grant(feature)?.source ?? null,
    payer: (feature) => grant(feature)?.payerUserId ?? null,
    limit: (limit) => {
      const value = data?.limits?.[limit];
      return value === undefined || value === null ? null : value;
    },
    labelOf: (feature) => data?.catalogue.find((c) => c.key === feature)?.label ?? feature,
  };
}

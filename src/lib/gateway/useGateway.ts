import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GatewayItem, GatewayOwnerKind } from "./items";
import {
  choosePlan,
  grantPlanToExistingStudents,
  loadGatewayByHandle,
  loadMyEntitlement,
  loadMyGatewayStudents,
  loadMyPlans,
  savePlan,
  type GatewayPlan,
  type PlanDraft,
} from "./gateway";

/** The owner's three plan slots, seeded on first read. */
export const useMyGatewayPlans = (ownerKind: GatewayOwnerKind) =>
  useQuery({
    queryKey: ["gateway-plans", ownerKind],
    queryFn: () => loadMyPlans(ownerKind),
    staleTime: 30_000,
  });

export const useSaveGatewayPlan = (ownerKind: GatewayOwnerKind) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, draft }: { plan: GatewayPlan; draft: PlanDraft }) => {
      const saved = await savePlan(plan.id, draft);
      let granted = 0;
      if (saved.isPublished && saved.autoGrantExisting) {
        granted = await grantPlanToExistingStudents(saved);
      }
      return { saved, granted };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gateway-plans", ownerKind] });
      void queryClient.invalidateQueries({ queryKey: ["gateway-students", ownerKind] });
    },
  });
};

export const useGatewayStudents = (ownerKind: GatewayOwnerKind) =>
  useQuery({
    queryKey: ["gateway-students", ownerKind],
    queryFn: () => loadMyGatewayStudents(ownerKind),
    staleTime: 30_000,
  });

/** The public gateway behind an @handle. */
export const useGatewayByHandle = (handle: string | undefined) =>
  useQuery({
    queryKey: ["gateway-handle", handle ?? ""],
    enabled: Boolean(handle),
    queryFn: () => loadGatewayByHandle(handle!),
  });

export const useChoosePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => choosePlan(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gateway-access"] });
    },
  });
};

export type GatewayAccess = {
  loading: boolean;
  /** No plans published by this owner: the gateway is not in force at all. */
  gated: boolean;
  items: GatewayItem[];
  awaitingPayment: boolean;
  has: (item: GatewayItem) => boolean;
};

/**
 * What the signed-in student may open inside this teacher's or school's
 * workspace. Access is read from the entitlement snapshot taken when the
 * student chose their plan, so a later plan edit never silently removes
 * something a student already holds.
 */
export const useGatewayAccess = (ownerId: string | null | undefined): GatewayAccess => {
  const query = useQuery({
    queryKey: ["gateway-access", ownerId ?? ""],
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    queryFn: () => loadMyEntitlement(ownerId!),
  });

  const entitlement = query.data ?? null;
  const items = entitlement?.status === "active" ? entitlement.grantedItems : [];

  return {
    loading: query.isLoading,
    gated: Boolean(ownerId) && !query.isLoading && (!entitlement || entitlement.status !== "active"),
    items,
    awaitingPayment: entitlement?.status === "pending_payment",
    has: (item: GatewayItem) => items.includes(item),
  };
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { GatewayItem, GatewayOwnerKind } from "./items";
import {
  choosePlan,
  grantPlanToExistingStudents,
  loadGatewayByHandle,
  loadMyEntitlement,
  loadMyGatewayPayments,
  loadMyGatewayStudents,
  loadMyPlans,
  savePlan,
  type GatewayPlan,
  type GatewayBillingInterval,
  type PlanDraft,
} from "./gateway";
import {
  createPlanCheckout,
  getStripeStatus,
  openStripeDashboard,
  resetStripeAccount,
  setPaymentsActive,
  startStripeOnboarding,
} from "./stripe.functions";


/** Where this workspace stands with its own Stripe account. */
export const useStripeStatus = (ownerKind: GatewayOwnerKind) => {
  const fetchStatus = useServerFn(getStripeStatus);
  return useQuery({
    queryKey: ["gateway-stripe", ownerKind],
    queryFn: () => fetchStatus({ data: { ownerKind } }),
    staleTime: 15_000,
  });
};

export const useStripeConnectActions = (ownerKind: GatewayOwnerKind) => {
  const queryClient = useQueryClient();
  const onboard = useServerFn(startStripeOnboarding);
  const dashboard = useServerFn(openStripeDashboard);
  const activate = useServerFn(setPaymentsActive);
  const startOver = useServerFn(resetStripeAccount);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["gateway-stripe", ownerKind] });


  return {
    connect: useMutation({
      mutationFn: async () => {
        const { url } = await onboard({ data: { ownerKind, origin: window.location.origin } });
        window.location.href = url;
      },
    }),
    manage: useMutation({
      mutationFn: async () => {
        const { url } = await dashboard({ data: { ownerKind } });
        window.open(url, "_blank", "noreferrer");
      },
    }),
    setActive: useMutation({
      mutationFn: (active: boolean) => activate({ data: { ownerKind, active } }),
      onSuccess: () => {
        void invalidate();
        // Paid plans appear on the public gateway the moment payment goes live.
        void queryClient.invalidateQueries({ queryKey: ["gateway-handle"] });
      },
    }),
    /** Detaches an empty Stripe account, then opens fresh onboarding. */
    reset: useMutation({
      mutationFn: async () => {
        await startOver({ data: { ownerKind } });
        await invalidate();
        const { url } = await onboard({ data: { ownerKind, origin: window.location.origin } });
        window.location.href = url;
      },
    }),
    /** Re-read straight from Stripe, e.g. on return from hosted onboarding. */
    refresh: () => invalidate(),

  };
};

/** Stripe Checkout on the owner's connected account — the platform takes nothing. */
export const usePlanCheckout = () => {
  const checkout = useServerFn(createPlanCheckout);
  return useMutation({
    mutationFn: async ({ planId, interval }: { planId: string; interval: GatewayBillingInterval }) => {
      const { url } = await checkout({ data: { planId, interval, origin: window.location.origin } });
      window.location.href = url;
    },
  });
};

export const useGatewayPayments = (ownerKind: GatewayOwnerKind) =>
  useQuery({
    queryKey: ["gateway-payments", ownerKind],
    queryFn: () => loadMyGatewayPayments(ownerKind),
    staleTime: 15_000,
  });


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
      void queryClient.invalidateQueries({ queryKey: ["gateway-stripe", ownerKind] });
      void queryClient.invalidateQueries({ queryKey: ["gateway-handle"] });
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

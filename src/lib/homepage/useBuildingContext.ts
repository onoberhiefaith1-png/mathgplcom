// Which building the current context should show, and whether the platform
// advertisement billboard plays on it.
//
//   USER / CONTEXT → workspace → plan → building → advertisement rule
//
// The Pro building is the account's own customizable building. The Free
// building is platform-owned: free teachers and parents (and everyone in
// Community) see it read-only, with the platform's 8 advertisements.
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { usePlanGate } from "@/lib/plans/usePlanGate";
import type { HomepageConfigMode } from "./homepageConfig";

export interface BuildingContext {
  configMode: HomepageConfigMode;
  /** The platform advertisement billboard plays on this building. */
  adsEnabled: boolean;
  /** This person may open the building customization pages. */
  canCustomize: boolean;
  /** Only the platform owner may manage the 8 advertisement slots. */
  canManageAds: boolean;
  isLoading: boolean;
}

/**
 * `community: true` forces the platform advertisement building: Community is a
 * public environment, so its rotating building always carries advertisements —
 * even for a Pro visitor, who does not own or edit that building.
 */
export function useBuildingContext(options?: {
  community?: boolean;
  /** Platform-owner-only live preview override: render Pro or Free on screen. */
  previewVersion?: "pro" | "free";
}): BuildingContext {
  const community = options?.community ?? false;
  const { role, isPlatformOwner, isLoading: accountLoading } = useAccount();
  const { active, isPersonal, isLoading: workspaceLoading } = useWorkspace();
  const { subscription, subscribes, loading: planLoading } = usePlanGate();

  const isLoading = accountLoading || workspaceLoading || planLoading;

  // The platform owner can flip the building on screen between the Pro version
  // and the Free advertising version. Preview only — nobody else is affected.
  if (isPlatformOwner && options?.previewVersion) {
    const free = options.previewVersion === "free";
    return {
      configMode: free ? "platform-free" : "self",
      adsEnabled: free,
      canCustomize: true,
      canManageAds: true,
      isLoading,
    };
  }

  if (community) {
    return {
      configMode: "platform-free",
      adsEnabled: true,
      canCustomize: false,
      canManageAds: isPlatformOwner,
      isLoading,
    };
  }

  // Inside somebody else's workspace (a paid school, a teacher's shared
  // workspace) the building belongs to its owner and never carries free ads.
  const visitingSharedWorkspace = Boolean(active && !active.isOwner);
  if (visitingSharedWorkspace) {
    return {
      configMode: "school-readonly",
      adsEnabled: false,
      canCustomize: false,
      canManageAds: isPlatformOwner,
      isLoading,
    };
  }

  // Students never hold a plan of their own and never see ads in their own
  // workspace; the platform owner always works on the Pro building.
  // No subscription yet, or a free/zero-price plan → the Free building.
  const onFreeTerms =
    !subscription || subscription.price <= 0 || /free/i.test(subscription.planKey);
  const freePlan = subscribes && !isPlatformOwner && onFreeTerms;


  if (freePlan) {
    return {
      configMode: "platform-free",
      adsEnabled: true,
      canCustomize: false,
      canManageAds: isPlatformOwner,
      isLoading,
    };
  }

  return {
    configMode: role === "student" && !isPersonal ? "school-readonly" : "self",
    adsEnabled: false,
    canCustomize: true,
    canManageAds: isPlatformOwner,
    isLoading,
  };
}

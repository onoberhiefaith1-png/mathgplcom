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

export interface BuildingContextInput {
  role: string | null;
  isPlatformOwner: boolean;
  /** Viewing a workspace this account does not own. */
  visitingSharedWorkspace: boolean;
  /** Own personal workspace (not a school / shared workspace). */
  isPersonal: boolean;
  /** This account type holds a platform plan of its own. */
  subscribes: boolean;
  /** Full access without a subscription: access code, owner test account, admin. */
  freeAccess: boolean;
  subscription: { price: number; planKey: string } | null;
  community: boolean;
  previewVersion?: "pro" | "free" | undefined;
}

export type BuildingAccess = Omit<BuildingContext, "isLoading">;

/**
 * Pure resolution of `WHO → WHICH BUILDING → MAY THEY EDIT IT`.
 *
 * Paid terms are not only a paid subscription: access-code holders, the
 * platform owner's test accounts, the owner and co-admins all hold full access
 * and own their building exactly like a Pro subscriber. Only a genuinely unpaid
 * account falls back to the platform advertising building.
 */
export function resolveBuildingContext(input: BuildingContextInput): BuildingAccess {
  const { role, isPlatformOwner, freeAccess, subscription, subscribes, community } = input;
  const canManageAds = isPlatformOwner;

  // The platform owner can flip the building on screen between the Pro version
  // and the Free advertising version. Preview only — nobody else is affected.
  if (isPlatformOwner && input.previewVersion) {
    const free = input.previewVersion === "free";
    return {
      configMode: free ? "platform-free" : "self",
      adsEnabled: free,
      canCustomize: true,
      canManageAds: true,
    };
  }

  // Community is a public environment: always the advertisement building, and
  // never editable — not even by a Pro visitor.
  if (community) {
    return { configMode: "platform-free", adsEnabled: true, canCustomize: false, canManageAds };
  }

  // Inside somebody else's workspace (a paid school, a teacher's shared
  // workspace) the building belongs to its owner and never carries free ads.
  if (input.visitingSharedWorkspace) {
    return { configMode: "school-readonly", adsEnabled: false, canCustomize: false, canManageAds };
  }

  /** Treated as paid: owner, co-admin, access code, owner test account, Pro. */
  const fullAccess = freeAccess || isPlatformOwner;

  // No subscription yet, or a free/zero-price plan → the Free building, unless
  // this account holds full access some other way.
  const onFreeTerms =
    !subscription || subscription.price <= 0 || /free/i.test(subscription.planKey);
  const freePlan = subscribes && !fullAccess && onFreeTerms;

  if (freePlan) {
    return { configMode: "platform-free", adsEnabled: true, canCustomize: false, canManageAds };
  }

  // Students do not own buildings as a rule. The exception is a full-access
  // student (test account / access-code holder) on their own personal homepage.
  if (role === "student") {
    const ownsIt = fullAccess && input.isPersonal;
    return {
      configMode: ownsIt ? "self" : "school-readonly",
      adsEnabled: false,
      canCustomize: ownsIt,
      canManageAds,
    };
  }

  return { configMode: "self", adsEnabled: false, canCustomize: true, canManageAds };
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
  const { role, isPlatformOwner, isLoading: accountLoading } = useAccount();
  const { active, isPersonal, isLoading: workspaceLoading } = useWorkspace();
  const { subscription, subscribes, freeAccess, loading: planLoading } = usePlanGate();

  const isLoading = accountLoading || workspaceLoading || planLoading;

  return {
    ...resolveBuildingContext({
      role: role ?? null,
      isPlatformOwner,
      visitingSharedWorkspace: Boolean(active && !active.isOwner),
      isPersonal,
      subscribes,
      freeAccess,
      subscription: subscription ? { price: subscription.price, planKey: subscription.planKey } : null,
      community: options?.community ?? false,
      previewVersion: options?.previewVersion,
    }),
    isLoading,
  };
}


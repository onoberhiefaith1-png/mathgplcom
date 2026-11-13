// Which building the current context should show, and whether it can be changed.
//
// The artwork itself is loaded by useResolvedBuilding. This resolves the same
// rules for permissions and for which tier is on screen.
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { usePlanGate } from "@/lib/plans/usePlanGate";
import type { HomepageConfigMode } from "./homepageConfig";
import {
  resolveDisplayedBuilding,
  viewerBuildingTier,
  type BuildingRef,
  type BuildingTier,
  type WorkspaceKind,
} from "./resolveDisplayedBuilding";

export interface BuildingContext {
  configMode: HomepageConfigMode;
  /** The platform advertisement billboard plays on this building. */
  adsEnabled: boolean;
  /** This person may open the building chooser. */
  canCustomize: boolean;
  /** Only an admin may manage the advertisement slots. */
  canManageAds: boolean;
  isLoading: boolean;
}

export interface BuildingContextInput {
  role: string | null;
  isPlatformOwner: boolean;
  /** Linked to an admin via platform_test_accounts. Treated as an admin. */
  isLinkedAdmin?: boolean;
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
  /** Workspace kind when it is not implied by the role. */
  workspaceKind?: WorkspaceKind;
  /** The workspace owner is on a pro tier. Schools are always pro. */
  workspaceOwnerIsPro?: boolean;
  workspaceBuilding?: BuildingRef | null;
  ownerPro?: BuildingRef | null;
  ownerFree?: BuildingRef | null;
}

export type BuildingAccess = Omit<BuildingContext, "isLoading">;

const kindFor = (input: BuildingContextInput): WorkspaceKind => {
  if (input.workspaceKind) return input.workspaceKind;
  if (input.visitingSharedWorkspace) return "school";
  if (input.role === "school" || input.role === "teacher" || input.role === "parent" || input.role === "student") {
    return input.role;
  }
  return "personal";
};

/**
 * Pure resolution of who sees which building and whether they may change it.
 */
export function resolveBuildingContext(input: BuildingContextInput): BuildingAccess {
  const isAdmin = input.isPlatformOwner || input.isLinkedAdmin === true;
  const viewerTier: BuildingTier = viewerBuildingTier({
    role: input.role,
    isAdmin,
    fullAccess: input.freeAccess || isAdmin,
    subscription: input.subscription,
  });
  const kind = kindFor(input);
  const ownsWorkspace =
    !input.visitingSharedWorkspace &&
    (input.isPersonal || input.role === "school" || input.role === "teacher");
  const ownerIsPro =
    input.workspaceOwnerIsPro ??
    (kind === "school" || (kind === "teacher" && ownsWorkspace && viewerTier === "pro"));

  const resolved = resolveDisplayedBuilding({
    role: input.role,
    isAdmin,
    viewerTier,
    publicFree: input.community,
    adminPreview: isAdmin ? input.previewVersion ?? null : null,
    workspace: {
      kind,
      ownsWorkspace,
      ownerIsPro,
      selection: input.workspaceBuilding ?? null,
    },
    ownerPro: input.ownerPro ?? null,
    ownerFree: input.ownerFree ?? null,
  });

  const configMode: HomepageConfigMode =
    resolved.source === "workspace"
      ? "school-readonly"
      : resolved.tier === "free"
        ? "platform-free"
        : "self";

  return {
    configMode,
    adsEnabled: resolved.adsEnabled,
    canCustomize: resolved.canChange,
    canManageAds: isAdmin,
  };
}

/**
 * `community: true` forces the platform Free building: Community is a public
 * environment, so its rotating building carries advertisements.
 */
export function useBuildingContext(options?: {
  community?: boolean;
  /** Platform-owner-only live preview: render the Pro or Free selection. */
  previewVersion?: "pro" | "free";
}): BuildingContext {
  const { role, isPlatformOwner, isLoading: accountLoading } = useAccount();
  const { active, isPersonal, isLoading: workspaceLoading } = useWorkspace();
  const { subscription, subscribes, freeAccess, loading: planLoading } = usePlanGate();

  const isLoading = accountLoading || workspaceLoading || planLoading;
  const kind = (active?.kind ?? null) as WorkspaceKind | null;

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
      ...(kind ? { workspaceKind: kind } : {}),
      workspaceOwnerIsPro: kind === "school" ? true : undefined,
    }),
    isLoading,
  };
}

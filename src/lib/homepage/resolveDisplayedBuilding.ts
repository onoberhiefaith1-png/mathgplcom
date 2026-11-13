/**
 * Which rotating building is on screen, and who may change it.
 *
 * The face everyone sees is a live selection, never a copy baked into the
 * client. The platform owner keeps two selections (Pro and Free) and can point
 * either one at any building she still has, including an older one. A pro
 * teacher or a pro school can point their own workspace at a building; until
 * they do, viewers of that workspace still see the owner's building.
 *
 * Order:
 *   1. The current workspace (a school, or a pro teacher) when that owner has
 *      explicitly chosen a building.
 *   2. Otherwise the owner's Pro or Free building, from the viewer's tier.
 *
 * Students always take the Pro tier. Schools are never a free tier. A free
 * account (a free teacher; parents on a free plan) takes the Free tier.
 * Students and free accounts cannot change or edit a building. Linked accounts
 * of an admin (`platform_test_accounts` / `is_flow_admin`) are admins.
 */

export type BuildingTier = "pro" | "free";

export type BuildingSource = "workspace" | "owner-pro" | "owner-free";

export interface BuildingRef {
  id: string;
  config?: Record<string, unknown> | null;
}

export type WorkspaceKind =
  | "school"
  | "teacher"
  | "parent"
  | "student"
  | "platform"
  | "personal";

export interface WorkspaceBuildingInput {
  kind: WorkspaceKind;
  /** The viewer owns this workspace. */
  ownsWorkspace: boolean;
  /**
   * School workspaces are always pro. A teacher workspace counts only when
   * that teacher is on a pro tier.
   */
  ownerIsPro: boolean;
  /** Set only after an explicit choice. An auto-created building is not a choice. */
  selection: BuildingRef | null;
}

export interface DisplayedBuildingInput {
  role: string | null;
  /** platform owner, co-admin, or an account linked to one. */
  isAdmin: boolean;
  viewerTier: BuildingTier;
  /** Signed-out home and Community: the public Free building, never editable. */
  publicFree?: boolean;
  /** Admin-only preview of one platform category. Does not change anyone else's building. */
  adminPreview?: BuildingTier | null;
  workspace: WorkspaceBuildingInput | null;
  ownerPro: BuildingRef | null;
  ownerFree: BuildingRef | null;
}

export interface DisplayedBuilding {
  source: BuildingSource;
  tier: BuildingTier;
  /** Defaults for artwork slots this building did not replace. */
  slotVersion: BuildingTier;
  building: BuildingRef | null;
  /**
   * True when the result is an explicit choice, not a fallback to the other
   * category. Editing is allowed only for an explicit choice the viewer owns.
   */
  explicit: boolean;
  canChange: boolean;
  canEdit: boolean;
  adsEnabled: boolean;
}

export interface ViewerTierInput {
  role: string | null;
  isAdmin: boolean;
  /** Access code or other full-access grant. Not the same as being an admin. */
  fullAccess: boolean;
  subscription: { price: number; planKey: string } | null;
}

const FREE_PLAN = /free/i;

/** Pro or Free for the platform building a viewer falls back to. */
export function viewerBuildingTier(input: ViewerTierInput): BuildingTier {
  if (input.isAdmin) return "pro";
  if (
    input.role === "platform_owner" ||
    input.role === "co_admin" ||
    input.role === "school" ||
    input.role === "student"
  ) {
    return "pro";
  }
  if (input.fullAccess) return "pro";
  const sub = input.subscription;
  if (!sub || sub.price <= 0 || FREE_PLAN.test(sub.planKey)) return "free";
  return "pro";
}

export function mayChangeBuilding(input: {
  role: string | null;
  isAdmin: boolean;
  viewerTier: BuildingTier;
  ownsWorkspace: boolean;
  workspaceKind: WorkspaceKind | null;
  /** Public Free building (signed out, Community). */
  locked?: boolean;
}): boolean {
  if (input.locked) return false;
  if (input.isAdmin) return true;
  if (input.role === "student") return false;
  if (input.viewerTier === "free") return false;
  if (!input.ownsWorkspace) return false;
  if (input.role === "school" && input.workspaceKind === "school") return true;
  if (input.role === "teacher" && input.viewerTier === "pro" && input.workspaceKind === "teacher") {
    return true;
  }
  return false;
}

const platformFace = (
  tier: BuildingTier,
  ownerPro: BuildingRef | null,
  ownerFree: BuildingRef | null,
): Pick<DisplayedBuilding, "source" | "slotVersion" | "building" | "explicit"> => {
  if (tier === "free" && ownerFree) {
    return { source: "owner-free", slotVersion: "free", building: ownerFree, explicit: true };
  }
  if (ownerPro) {
    return { source: "owner-pro", slotVersion: "pro", building: ownerPro, explicit: tier === "pro" };
  }
  return {
    source: tier === "free" ? "owner-free" : "owner-pro",
    slotVersion: "pro",
    building: null,
    explicit: false,
  };
};

/**
 * Resolve the building on screen.
 * Callers pass the current selections; nothing here is cached or hard-coded.
 */
export function resolveDisplayedBuilding(input: DisplayedBuildingInput): DisplayedBuilding {
  const preview = input.isAdmin ? input.adminPreview ?? null : null;
  const tier: BuildingTier = input.publicFree ? "free" : preview ?? input.viewerTier;
  const workspace = input.workspace;
  const canChange = mayChangeBuilding({
    role: input.role,
    isAdmin: input.isAdmin,
    viewerTier: input.viewerTier,
    ownsWorkspace: Boolean(workspace?.ownsWorkspace),
    workspaceKind: workspace?.kind ?? null,
    locked: Boolean(input.publicFree),
  });

  const workspaceHit =
    !input.publicFree &&
    !preview &&
    workspace &&
    (workspace.kind === "school" || workspace.kind === "teacher") &&
    workspace.ownerIsPro &&
    workspace.selection
      ? workspace.selection
      : null;

  const face = workspaceHit
    ? {
        source: "workspace" as const,
        slotVersion: "pro" as const,
        building: workspaceHit,
        explicit: true,
      }
    : platformFace(tier, input.ownerPro, input.ownerFree);

  const canEdit =
    canChange &&
    face.explicit &&
    (face.source === "workspace" ||
      (input.isAdmin && (face.source === "owner-pro" || face.source === "owner-free")));

  return {
    ...face,
    tier,
    canChange,
    canEdit,
    adsEnabled: face.source !== "workspace" && tier === "free",
  };
}

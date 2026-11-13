// The rotating building currently on screen.
//
// Read from the server on every visit. Nothing is copied into localStorage,
// so a selection the owner makes is the one the next load paints.
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import type { HomepageConfig } from "./homepageConfig";
import type { BuildingSource, BuildingTier } from "./resolveDisplayedBuilding";

export interface ResolvedBuilding {
  buildingId: string | null;
  name: string | null;
  config: HomepageConfig;
  source: BuildingSource;
  tier: BuildingTier;
  slotVersion: BuildingTier;
  explicit: boolean;
  canChange: boolean;
  canEdit: boolean;
  adsEnabled: boolean;
  isAdmin: boolean;
}

const EMPTY: ResolvedBuilding = {
  buildingId: null,
  name: null,
  config: {},
  source: "owner-pro",
  tier: "pro",
  slotVersion: "pro",
  explicit: false,
  canChange: false,
  canEdit: false,
  adsEnabled: false,
  isAdmin: false,
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

export const parseResolvedBuilding = (value: unknown): ResolvedBuilding => {
  const row = asRecord(value);
  if (!row) return EMPTY;
  const tier = row.tier === "free" ? "free" : "pro";
  const source: BuildingSource =
    row.source === "workspace" || row.source === "owner-free" || row.source === "owner-pro"
      ? row.source
      : "owner-pro";
  const config = asRecord(row.config) ?? {};
  return {
    buildingId: typeof row.buildingId === "string" ? row.buildingId : null,
    name: typeof row.name === "string" ? row.name : null,
    config: config as HomepageConfig,
    source,
    tier,
    slotVersion: row.slotVersion === "free" ? "free" : "pro",
    explicit: row.explicit === true,
    canChange: row.canChange === true,
    canEdit: row.canEdit === true,
    adsEnabled: row.adsEnabled === true,
    isAdmin: row.isAdmin === true,
  };
};

export async function fetchResolvedBuilding(input: {
  orgId: string | null;
  ownerId?: string | null;
  audience: string | null;
}): Promise<ResolvedBuilding> {
  const { data, error } = await supabase.rpc("get_resolved_building", {
    _org_id: input.orgId,
    _audience: input.audience,
    _owner_id: input.ownerId ?? null,
  });
  if (error) throw error;
  return parseResolvedBuilding(data);
}

export function useResolvedBuilding(options?: {
  /** Resolve this workspace instead of the one the viewer is standing in. */
  orgId?: string | null;
  /** Teacher whose workspace to show when their organisation id is not known. */
  ownerId?: string | null;
  orgExplicit?: boolean;
  /** Signed-out home and Community. */
  publicFree?: boolean;
  /** Admin preview of the Pro or Free platform building. */
  adminPreview?: BuildingTier | null;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const orgId = options?.publicFree
    ? null
    : options?.orgExplicit
      ? options.orgId ?? null
      : options?.orgId ?? workspace.activeOrgId ?? null;
  const audience = options?.publicFree
    ? "public-free"
    : options?.adminPreview
      ? `preview-${options.adminPreview}`
      : null;
  const callerEnabled = options?.enabled ?? true;
  // Wait for the active workspace before asking, so the first paint is the
  // resolved building and not the shipped artwork.
  const queryEnabled = callerEnabled && (options?.publicFree || !workspace.isLoading);

  const ownerId = options?.ownerId ?? null;
  const query = useQuery({
    queryKey: ["resolved-building", user?.id ?? null, orgId, ownerId, audience],
    queryFn: () => fetchResolvedBuilding({ orgId, ownerId, audience }),
    enabled: queryEnabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const resolved = query.data ?? EMPTY;
  return {
    ...resolved,
    // A background refetch keeps the building that is already on screen.
    ready: !callerEnabled || (queryEnabled && (query.isSuccess || query.isError)),
    isLoading: callerEnabled && (!queryEnabled || query.isPending),
    error: query.error,
  };
}

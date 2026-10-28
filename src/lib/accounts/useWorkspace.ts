import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  fetchWorkspaces,
  setActiveWorkspace,
  type Workspace,
  type WorkspaceKind,
} from "./workspace";
import { useAccount } from "./useAccount";
import { clearWorkspaceScopeCache } from "./workspaceScope";


/**
 * The active workspace context every surface reads: which workspace the person
 * is operating in, what kind it is, whether they merely visit it (view only)
 * and how to switch. Switching invalidates every cached query so lists,
 * navigation and the rotating building all re-resolve for the new context.
 */
export function useWorkspace() {
  const queryClient = useQueryClient();
  const { role, userId } = useAccount();

  const query = useQuery({
    queryKey: ["workspaces", userId],
    queryFn: fetchWorkspaces,
    staleTime: 5 * 60 * 1000,
  });


  const workspaces: Workspace[] = query.data?.workspaces ?? [];
  const activeOrgId = query.data?.activeOrgId ?? null;
  const active = workspaces.find((w) => w.orgId === activeOrgId) ?? null;
  const kind: WorkspaceKind = active?.kind ?? (role === "school" ? "school" : "teacher");

  /** Visiting someone else's workspace (e.g. a school) — never authoring as them. */
  const viewOnly = Boolean(active && !active.isOwner && active.kind === "school" && role !== "school");

  const switchTo = useCallback(
    async (orgId: string) => {
      if (orgId === activeOrgId) return;
      await setActiveWorkspace(orgId);
      clearWorkspaceScopeCache();
      await queryClient.invalidateQueries();

      // MathGPL is the school: entering a workspace always opens its building
      // first, never a dashboard deep inside it.
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.assign("/");
      }
    },
    [activeOrgId, queryClient],
  );

  return {
    workspaces,
    active,
    activeOrgId,
    kind,
    viewOnly,
    isPersonal: Boolean(active?.isOwner),
    switchTo,
    isLoading: query.isLoading,
  };
}

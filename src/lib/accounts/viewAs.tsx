/**
 * ViewAsProvider — renders the real teacher pages, frozen.
 *
 * Wrap any teacher page with this provider and it becomes a faithful copy of
 * what the teacher sees, with every authoring action refused. There is no
 * separate "school layout": the school looks through the teacher's own screens.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { toast } from "@/hooks/use-toast";
import { clearWorkspaceScopeCache } from "@/lib/accounts/workspaceScope";
import {
  currentViewAs,
  lockMessage,
  setViewAsScope,
  type ViewAsScope,
} from "@/lib/accounts/viewAsScope";

const ViewAsContext = createContext<ViewAsScope | null>(null);

export const ViewAsProvider = ({
  ownerId,
  orgId,
  personName,
  basePath,
  children,
}: ViewAsScope & { children: ReactNode }) => {
  const scope = useMemo<ViewAsScope>(
    () => ({ ownerId, orgId, personName, basePath }),
    [ownerId, orgId, personName, basePath],
  );

  // Set synchronously on first render so queries fired from child effects
  // already see the viewed workspace.
  if (currentViewAs()?.ownerId !== ownerId || currentViewAs()?.orgId !== orgId) {
    setViewAsScope(scope);
    clearWorkspaceScopeCache();
  }

  useEffect(() => {
    setViewAsScope(scope);
    clearWorkspaceScopeCache();
    return () => {
      setViewAsScope(null);
      clearWorkspaceScopeCache();
    };
  }, [scope]);

  return <ViewAsContext.Provider value={scope}>{children}</ViewAsContext.Provider>;
};

export function useViewAs() {
  const scope = useContext(ViewAsContext);
  const viewOnly = Boolean(scope);

  /** Returns false and explains why when the viewer may not change anything. */
  const allowEdit = () => {
    if (!scope) return true;
    toast({ title: "View only", description: lockMessage(scope.personName), variant: "destructive" });
    return false;
  };

  return { viewOnly, scope, ownerId: scope?.ownerId ?? null, allowEdit };
}

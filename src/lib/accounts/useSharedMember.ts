import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchMemberOverview } from "@/lib/accounts/schoolDirectory";

/**
 * Resolves the school the administrator is operating and the member whose
 * Shared Workspace they are viewing. Both are needed by every shared-workspace
 * read, and both are school-scoped in SQL.
 */
export function useSharedMember(userId: string) {
  const { active } = useWorkspace();
  const orgId = active?.kind === "school" ? active.orgId : null;

  const overview = useQuery({
    queryKey: ["school-member", orgId, userId],
    queryFn: async () => fetchMemberOverview(orgId!, userId),
    enabled: Boolean(orgId),
  });

  const person = overview.data
    ? {
        displayName: overview.data.displayName,
        username: overview.data.username,
        avatarUrl: overview.data.avatarUrl,
      }
    : null;

  return { orgId, person, overview };
}

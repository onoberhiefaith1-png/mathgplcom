import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useViewAs } from "@/lib/accounts/viewAs";
import { myAdventures, myAssignments, myClasses, myProgress, mySkillBuilders } from "./allClasses";

/** One cache key shape: student data is per person, per workspace, per context. */
const keyFor = (part: string, userId?: string, orgId?: string | null, context?: string) => [
  "student-learning",
  part,
  userId ?? "anon",
  orgId ?? "personal",
  context ?? "own",
];

const useStudentQuery = <T,>(part: string, fn: () => Promise<T>) => {
  const { user } = useAuth();
  const { activeOrgId } = useWorkspace();
  const { scope } = useViewAs();
  // While a school or teacher views this workspace, the data belongs to the
  // person being viewed and to that viewer's class context.
  const ownerId = scope?.ownerId ?? user?.id;
  const orgId = scope ? scope.orgId : activeOrgId;
  const context = scope ? `${scope.viewer ?? "school"}:${(scope.classIds ?? []).join(",")}` : "own";

  return useQuery({
    queryKey: keyFor(part, ownerId, orgId, context),
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    queryFn: fn,
  });
};


export const useMyClasses = () => useStudentQuery("classes", myClasses);
export const useMyProgress = () => useStudentQuery("progress", myProgress);
export const useMyAssignments = () => useStudentQuery("assignments", myAssignments);
export const useMyAdventures = () => useStudentQuery("adventures", myAdventures);
export const useMySkillBuilders = () => useStudentQuery("skill-builders", mySkillBuilders);

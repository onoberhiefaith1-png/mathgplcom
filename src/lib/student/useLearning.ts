import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { myAdventures, myAssignments, myClasses, myProgress, mySkillBuilders } from "./allClasses";

/** One cache key shape: student data is per person and per workspace. */
const keyFor = (part: string, userId?: string, orgId?: string | null) => [
  "student-learning",
  part,
  userId ?? "anon",
  orgId ?? "personal",
];

const useStudentQuery = <T,>(part: string, fn: () => Promise<T>) => {
  const { user } = useAuth();
  const { activeOrgId } = useWorkspace();
  return useQuery({
    queryKey: keyFor(part, user?.id, activeOrgId),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: fn,
  });
};

export const useMyClasses = () => useStudentQuery("classes", myClasses);
export const useMyProgress = () => useStudentQuery("progress", myProgress);
export const useMyAssignments = () => useStudentQuery("assignments", myAssignments);
export const useMyAdventures = () => useStudentQuery("adventures", myAdventures);
export const useMySkillBuilders = () => useStudentQuery("skill-builders", mySkillBuilders);

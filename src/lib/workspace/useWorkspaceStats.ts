import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { fetchSchoolStats, fetchStudentStats, fetchTeacherStats } from "./stats";

/** Teacher dashboard figures for the active workspace. */
export const useTeacherStats = () => {
  const { user } = useAuth();
  const { activeOrgId } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-stats", "teacher", user?.id ?? "anon", activeOrgId ?? "personal"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchTeacherStats,
  });
};

/** School dashboard figures for the school workspace being administered. */
export const useSchoolStats = () => {
  const { user } = useAuth();
  const { activeOrgId, active } = useWorkspace();
  const orgId = active?.kind === "school" ? activeOrgId : null;
  return useQuery({
    queryKey: ["workspace-stats", "school", user?.id ?? "anon", orgId ?? "none"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: () => fetchSchoolStats(orgId),
  });
};

/** Student dashboard figures for the active workspace. */
export const useStudentStats = () => {
  const { user } = useAuth();
  const { activeOrgId } = useWorkspace();
  return useQuery({
    queryKey: ["workspace-stats", "student", user?.id ?? "anon", activeOrgId ?? "personal"],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchStudentStats,
  });
};

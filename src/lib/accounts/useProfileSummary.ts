import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchProfileSummary } from "./avatar";

/** Name and profile picture of the signed-in person. */
export const useProfileSummary = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile-summary", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: fetchProfileSummary,
  });

  return {
    profile: query.data ?? null,
    displayName: query.data?.displayName ?? "",
    firstName: query.data?.firstName ?? query.data?.displayName?.split(" ")[0] ?? "",
    avatarUrl: query.data?.avatarUrl ?? null,
    loading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["profile-summary"] }),
  };
};

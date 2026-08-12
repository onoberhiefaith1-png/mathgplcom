import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { requestConnectionForChild } from "@/lib/connections/connections";
import {
  fetchChildBreakdown,
  fetchChildren,
  fetchFamilyActivity,
  fetchFamilyConnections,
} from "./family";


/** The children linked to the signed-in parent. */
export const useChildren = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["family-children", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: fetchChildren,
  });
  return { children: query.data ?? [], loading: query.isLoading, error: query.error };
};

/** One child's progress split by school and by teacher. */
export const useChildBreakdown = (childUserId: string | null) =>
  useQuery({
    queryKey: ["family-child-breakdown", childUserId ?? "none"],
    enabled: Boolean(childUserId),
    queryFn: () => fetchChildBreakdown(childUserId!),
  });

/**
 * A parent introducing a child to a school or a teacher. Two yeses are needed:
 * the school or teacher accepts, then the child confirms.
 */
export const useConnectChild = () => {
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: ({
      childUserId,
      targetUserId,
      relation,
      message,
    }: {
      childUserId: string;
      targetUserId: string;
      relation: "parent_school" | "parent_teacher";
      message?: string;
    }) => requestConnectionForChild(childUserId, targetUserId, relation, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      queryClient.invalidateQueries({ queryKey: ["connection-counts"] });
      queryClient.invalidateQueries({ queryKey: ["family-children"] });
    },
  });

  return { connectChild: send.mutateAsync, connecting: send.isPending };
};

/** Schools and teachers connected to the parent's children. */
export const useFamilyConnections = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["family-connections", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: fetchFamilyConnections,
  });
};

/** The latest completions across the parent's children. */
export const useFamilyActivity = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["family-activity", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    queryFn: fetchFamilyActivity,
  });
};

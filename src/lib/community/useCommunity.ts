import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyCommunityProfile,
  listCommunity,
  listMyLikes,
  toggleLike,
  type FeedFilter,
} from "./community";
import { useAccount } from "@/lib/accounts/useAccount";

/** The signed-in member's creator identity (username). */
export const useCommunityIdentity = () => {
  const query = useQuery({
    queryKey: ["community", "profile"],
    queryFn: getMyCommunityProfile,
    staleTime: 5 * 60 * 1000,
  });
  return {
    profile: query.data ?? null,
    username: query.data?.username ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
};

/** What this role may do inside the Community workspace. */
export const useCommunityRights = () => {
  const { role } = useAccount();
  const isAdmin = role === "platform_owner" || role === "co_admin";
  const isStudent = role === "student";
  return {
    role,
    isAdmin,
    isStudent,
    /** Administrator moderates everything; everyone else only their own work. */
    canModerate: isAdmin,
    /** Students never publish teaching resources. */
    canPublish: !isStudent,
    /** Students copy nothing except class access. */
    canDownload: !isStudent,
  };
};

export const useCommunityFeed = (filter: FeedFilter) => {
  const queryClient = useQueryClient();
  const feed = useQuery({
    queryKey: ["community", "feed", filter],
    queryFn: () => listCommunity(filter),
  });
  const likes = useQuery({
    queryKey: ["community", "likes"],
    queryFn: listMyLikes,
    staleTime: 60 * 1000,
  });

  const likeSet = useMemo(() => likes.data ?? new Set<string>(), [likes.data]);

  const like = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) => toggleLike(id, liked),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["community", "likes"] });
      void queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
    },
  });

  const onToggleLike = useCallback(
    (id: string) => like.mutate({ id, liked: likeSet.has(id) }),
    [like, likeSet],
  );

  return {
    cards: feed.data ?? [],
    isLoading: feed.isLoading,
    error: feed.error as Error | null,
    likedIds: likeSet,
    onToggleLike,
    refetch: feed.refetch,
  };
};

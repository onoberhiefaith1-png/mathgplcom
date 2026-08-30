import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyCommunityProfile,
  listCommunity,
  listCommunityPage,
  listMyLikes,
  toggleLike,
  type FeedFilter,
} from "./community";
import type { CommunityKind } from "./types";
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

/**
 * The Main Community stream: a continuously growing list of published
 * references, newest first. Community should always feel like there is more to
 * see, so this pages rather than capping.
 */
export const useCommunityStream = (
  filter: FeedFilter & { kinds?: CommunityKind[] } = {},
  pageSize = 12,
) => {
  const queryClient = useQueryClient();
  const stream = useInfiniteQuery({
    queryKey: ["community", "stream", filter, pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listCommunityPage(filter, pageParam as number, pageSize),
    getNextPageParam: (last, all) => (last.length < pageSize ? undefined : all.length),
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
      void queryClient.invalidateQueries({ queryKey: ["community", "stream"] });
    },
  });

  const cards = useMemo(() => (stream.data?.pages ?? []).flat(), [stream.data]);

  return {
    cards,
    isLoading: stream.isLoading,
    hasMore: Boolean(stream.hasNextPage),
    isFetchingMore: stream.isFetchingNextPage,
    loadMore: () => void stream.fetchNextPage(),
    likedIds: likeSet,
    onToggleLike: (id: string) => like.mutate({ id, liked: likeSet.has(id) }),
    refetch: stream.refetch,
  };
};


import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  listComments,
  listMyPostLikes,
  listPosts,
  suggestHashtags,
  togglePostLike,
  type NewPost,
  type PostFilter,
} from "./posts";

export const useMyUserId = () => {
  const query = useQuery({
    queryKey: ["auth", "uid"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: 5 * 60 * 1000,
  });
  return query.data ?? null;
};

export const useCommunityPosts = (filter: PostFilter = {}) => {
  const queryClient = useQueryClient();
  const posts = useQuery({ queryKey: ["community", "posts", filter], queryFn: () => listPosts(filter) });
  const likes = useQuery({
    queryKey: ["community", "post-likes"],
    queryFn: listMyPostLikes,
    staleTime: 60 * 1000,
  });

  const likedIds = useMemo(() => likes.data ?? new Set<string>(), [likes.data]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["community", "posts"] });
    void queryClient.invalidateQueries({ queryKey: ["community", "post-likes"] });
  }, [queryClient]);

  const like = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) => togglePostLike(id, liked),
    onSuccess: invalidate,
  });

  const publish = useMutation({ mutationFn: (input: NewPost) => createPost(input), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deletePost(id), onSuccess: invalidate });

  return {
    posts: posts.data ?? [],
    isLoading: posts.isLoading,
    error: posts.error as Error | null,
    likedIds,
    onToggleLike: (id: string) => like.mutate({ id, liked: likedIds.has(id) }),
    publish,
    remove,
    refetch: posts.refetch,
  };
};

export const usePostComments = (postId: string, enabled: boolean) => {
  const queryClient = useQueryClient();
  const comments = useQuery({
    queryKey: ["community", "post-comments", postId],
    queryFn: () => listComments(postId),
    enabled,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["community", "post-comments", postId] });
    void queryClient.invalidateQueries({ queryKey: ["community", "posts"] });
  };

  const add = useMutation({ mutationFn: (body: string) => addComment(postId, body), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => deleteComment(id), onSuccess: invalidate });

  return { comments: comments.data ?? [], isLoading: comments.isLoading, add, remove };
};

export const useHashtagSuggestions = (prefix: string) => {
  const query = useQuery({
    queryKey: ["community", "hashtags", prefix],
    queryFn: () => suggestHashtags(prefix),
    staleTime: 60 * 1000,
  });
  return query.data ?? [];
};

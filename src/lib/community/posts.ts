/**
 * The Community feed — posts, likes, comments and hashtags.
 *
 * A post is the one thing that genuinely originates in Community: it is talk
 * about teaching, not teaching material. Everything else (lesson notes,
 * courses, adventures, live sessions, smart cards) is created in the workspace
 * and only *shared* here, so it stays in `community_resources`.
 */
import { supabase } from "@/integrations/supabase/client";

/** These tables ship with this feature, so they are newer than the generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string): any => (supabase.from as unknown as (n: string) => any)(name);


const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
    name,
    args,
  );

export const POST_CATEGORIES = [
  "update",
  "teaching tip",
  "resource",
  "announcement",
  "course launch",
  "live session",
  "question",
  "promotion",
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export type CommunityPost = {
  id: string;
  authorId: string;
  body: string;
  mediaUrl: string | null;
  mediaKind: "none" | "image" | "video";
  category: string;
  hashtags: string[];
  attachedResourceId: string | null;
  isPromotion: boolean;
  promotionUrl: string | null;
  viewCount: number;
  createdAt: string;
  username: string | null;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  likeCount: number;
  commentCount: number;
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  media_url: string | null;
  media_kind: string | null;
  category: string | null;
  hashtags: string[] | null;
  attached_resource_id: string | null;
  is_promotion: boolean | null;
  promotion_url: string | null;
  view_count: number | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  headline: string | null;
  avatar_url: string | null;
  like_count: number | null;
  comment_count: number | null;
};

const toPost = (row: PostRow): CommunityPost => ({
  id: row.id,
  authorId: row.author_id,
  body: row.body,
  mediaUrl: row.media_url,
  mediaKind: row.media_kind === "image" || row.media_kind === "video" ? row.media_kind : "none",
  category: row.category ?? "update",
  hashtags: row.hashtags ?? [],
  attachedResourceId: row.attached_resource_id,
  isPromotion: Boolean(row.is_promotion),
  promotionUrl: row.promotion_url,
  viewCount: Number(row.view_count ?? 0),
  createdAt: row.created_at,
  username: row.username,
  displayName: row.display_name || row.username || "MathGPL member",
  headline: row.headline,
  avatarUrl: row.avatar_url,
  likeCount: Number(row.like_count ?? 0),
  commentCount: Number(row.comment_count ?? 0),
});

export type PostFilter = {
  authorId?: string;
  hashtag?: string;
  search?: string;
  promotionsOnly?: boolean;
};

export const listPosts = async (filter: PostFilter = {}): Promise<CommunityPost[]> => {
  let query = table("community_post_cards")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(120);

  if (filter.authorId) query = query.eq("author_id", filter.authorId);
  if (filter.promotionsOnly) query = query.eq("is_promotion", true);
  if (filter.hashtag) query = query.contains("hashtags", [filter.hashtag]);
  if (filter.search?.trim()) query = query.ilike("body", `%${filter.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as PostRow[]).map(toPost);
};

export type NewPost = {
  body: string;
  mediaUrl?: string | null;
  mediaKind?: "none" | "image" | "video";
  category: string;
  hashtags: string[];
  attachedResourceId?: string | null;
  isPromotion?: boolean;
  promotionUrl?: string | null;
};

export const createPost = async (input: NewPost): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const { data, error } = await table("community_posts")
    .insert({
      author_id: uid,
      body: input.body.trim(),
      media_url: input.mediaUrl?.trim() || null,
      media_kind: input.mediaKind ?? "none",
      category: input.category,
      hashtags: input.hashtags,
      attached_resource_id: input.attachedResourceId ?? null,
      is_promotion: Boolean(input.isPromotion),
      promotion_url: input.promotionUrl?.trim() || null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as unknown as { id: string }).id;
};

export const deletePost = async (id: string) => {
  const { error } = await table("community_posts").delete().eq("id", id);
  if (error) throw error;
};

export const countPostView = async (id: string): Promise<number> => {
  const { data } = await rpc("community_post_viewed", { _post_id: id });
  return Number(data ?? 0);
};

/* ------------------------------------------------------------------- likes */

export const listMyPostLikes = async (): Promise<Set<string>> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return new Set();
  const { data } = await table("community_post_likes").select("post_id").eq("user_id", uid);
  return new Set(((data ?? []) as unknown as { post_id: string }[]).map((r) => r.post_id));
};

export const togglePostLike = async (postId: string, liked: boolean) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (liked) {
    const { error } = await table("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", uid);
    if (error) throw error;
    return;
  }
  const { error } = await table("community_post_likes").insert({ post_id: postId, user_id: uid } as never);
  if (error) throw error;
};

/* ---------------------------------------------------------------- comments */

export type PostComment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export const listComments = async (postId: string): Promise<PostComment[]> => {
  const { data, error } = await table("community_post_comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as {
    id: string;
    post_id: string;
    author_id: string;
    body: string;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  }));
};

export const addComment = async (postId: string, body: string) => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await table("community_post_comments").insert({
    post_id: postId,
    author_id: uid,
    body: body.trim(),
  } as never);
  if (error) throw error;
};

export const deleteComment = async (id: string) => {
  const { error } = await table("community_post_comments").delete().eq("id", id);
  if (error) throw error;
};

/* ---------------------------------------------------------------- hashtags */

export type HashtagCount = { tag: string; uses: number };

/** Suggestions are counted from what Community actually holds — never a fixed list. */
export const suggestHashtags = async (prefix: string, limit = 12): Promise<HashtagCount[]> => {
  const { data, error } = await rpc("community_hashtag_counts", {
    _prefix: prefix.trim() || null,
    _limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as unknown as { tag: string; uses: number }[]).map((row) => ({
    tag: row.tag,
    uses: Number(row.uses ?? 0),
  }));
};

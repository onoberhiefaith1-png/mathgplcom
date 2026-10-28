CREATE OR REPLACE FUNCTION public.community_post_like_count(_post_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.community_post_likes WHERE post_id = _post_id
$$;
REVOKE EXECUTE ON FUNCTION public.community_post_like_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_post_like_count(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.community_post_cards WITH (security_invoker=on) AS
SELECT cpst.id, cpst.author_id, cpst.body, cpst.media_url, cpst.media_kind, cpst.category, cpst.hashtags,
  cpst.attached_resource_id, cpst.is_promotion, cpst.promotion_url, cpst.status, cpst.view_count, cpst.created_at,
  cp.username,
  COALESCE(NULLIF(cp.display_name, ''), p.full_name, p.display_name, cp.username) AS display_name,
  cp.headline,
  COALESCE(NULLIF(cp.avatar_url, ''), p.avatar_url) AS avatar_url,
  public.community_post_like_count(cpst.id) AS like_count,
  (SELECT count(*) FROM community_post_comments c WHERE c.post_id = cpst.id AND c.moderation_state <> 'rejected') AS comment_count
FROM community_posts cpst
LEFT JOIN community_profiles cp ON cp.user_id = cpst.author_id
LEFT JOIN profiles p ON p.user_id = cpst.author_id;

DROP POLICY IF EXISTS "likes are readable" ON public.community_post_likes;
CREATE POLICY "users read own likes" ON public.community_post_likes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);